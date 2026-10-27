/* Entrées de la revue de direction (ISO 9001:2015, 9.3.2) : faits chiffrés tirés des données de la plateforme, préparés pour
   la direction. Rien n'est interprété ni complété : une donnée absente donne « aucune donnée » et l'adéquation des ressources
   (d) reste à saisir. Les données sont filtrées selon les droits de la personne qui prépare la revue. */
import {
  ENTREES_REVUE,
  GRC_MODULES,
  etatIndicateur,
  indicateursSynthese,
  objectifsPilotage,
  plansAnnee,
  type EntreeRevue,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { DEFAULT_SMSI, type Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';
import { redactLegacy } from '../routes/suivi.js';

const lignes = (v: unknown): JsonObject[] => (Array.isArray(v) ? v.filter(isObject) : []);
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const jour = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

export class PilotageRevue {
  constructor(private readonly g: Grc) {}

  async entrees(
    smsi: string,
    user: SessionUser,
  ): Promise<{ precedente: { id: string; date: string } | null; entrees: EntreeRevue[] }> {
    if (smsi !== DEFAULT_SMSI) throw new HttpError(404, 'Ces données appartiennent au pilotage commun.');
    await this.g.access(smsi, user);
    await this.g.permission(user, GRC_MODULES.management_review, 'lire');
    const brut = (await this.g.legacy.recompose())?.data ?? {};
    const etat = redactLegacy(brut as JsonObject, user.rights);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const faits = {
      a: [] as string[],
      b: [] as string[],
      c1: [] as string[],
      c2: [] as string[],
      c3: [] as string[],
      c4: [] as string[],
      c5: [] as string[],
      c6: [] as string[],
      c7: [] as string[],
      d: [] as string[],
      e: [] as string[],
      f: [] as string[],
    };

    // a) actions décidées lors de la revue précédente : les actions créées par ses décisions, avec leur état actuel.
    const revues = lignes(etat.reviews)
      .map((r) => ({
        id: String(r.id),
        date: String(isObject(r.pilotage) && r.pilotage.heldAt ? r.pilotage.heldAt : (r.date ?? '')).slice(0, 10),
      }))
      .filter((r) => r.date && r.date <= aujourdhui)
      .sort((x, y) => y.date.localeCompare(x.date));
    const precedente = revues[0] ?? null;
    if (precedente) {
      const decisions = await this.g.db.k
        .selectFrom('pilotage_decisions')
        .select('generated_refs')
        .where('smsi_id', '=', smsi)
        .where('source_ref', '=', `legacy:reviews:${precedente.id}`)
        .execute();
      const ids = [
        ...new Set(
          decisions
            .flatMap((d) => d.generated_refs as string[])
            .filter((r) => r.startsWith('object:'))
            .map((r) => r.slice(7)),
        ),
      ];
      if (ids.length) {
        const politique = (await this.g.policy(smsi, user)).definition;
        const clos = new Set(politique.statuses.filter((s) => s.terminal).map((s) => s.id));
        const masques = await this.g.registres.inaccessibles(user, smsi);
        // Chemins jsonb fixes ; registres masqués exclus (aucun masque : tout est lisible, comme <> ALL d'un tableau vide).
        const actions = await this.g.db.k
          .selectFrom('grc_objects')
          .select([sql<string>`data->>'status'`.as('status'), sql<string | null>`data->>'dueAt'`.as('due')])
          .where('smsi_id', '=', smsi)
          .where('id', 'in', ids)
          .where('kind', '=', 'action')
          .$if(masques.length > 0, (q) =>
            q.where((eb) => eb.or([eb('registre_id', 'is', null), eb('registre_id', 'not in', masques)])),
          )
          .execute();
        const ouvertes = actions.filter((a) => !clos.has(a.status));
        const retard = ouvertes.filter((a) => a.due && a.due.slice(0, 10) < aujourdhui).length;
        faits.a.push(
          `Revue du ${jour(precedente.date)} : ${pluriel(actions.length, 'action décidée', 'actions décidées')}, ${actions.length - ouvertes.length} terminée(s), ${ouvertes.length} ouverte(s)${retard ? ` dont ${retard} en retard` : ''}.`,
        );
      } else faits.a.push(`Revue du ${jour(precedente.date)} : aucune action créée à partir de ses décisions.`);
    } else faits.a.push('Aucune revue de direction précédente enregistrée.');

    // b) enjeux et parties intéressées.
    const parties = lignes(etat.interested);
    const nonRevues = parties.filter(
      (p) => !p.reviewed || String(p.reviewed) < new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10),
    ).length;
    faits.b.push(
      `${pluriel(parties.length, 'partie intéressée', 'parties intéressées')} enregistrée(s), ${nonRevues} non revue(s) depuis un an.`,
    );

    // c1 à c3, c5) objectifs et indicateurs.
    const objectifs = objectifsPilotage(etat);
    const synthese = indicateursSynthese(etat);
    const indicateurs = lignes(etat.indicators);
    const satisfaction = indicateurs.filter((i) => i.category === 'satisfaction');
    if (satisfaction.length)
      for (const i of satisfaction) {
        const f = objectifs.flatMap((o) => o.indicateurs).find((x) => x.id === i.id);
        faits.c1.push(`${String(i.id)} ${String(i.name)} : ${f?.valeur ?? '–'} (cible ${f?.cible ?? '–'}).`);
      }
    else faits.c1.push('Aucun indicateur de satisfaction du client enregistré (catégorie « satisfaction »).');
    faits.c2.push(
      `${synthese.atteints}/${synthese.total} indicateur(s) atteint(s), ${synthese.nonAtteints} non atteint(s), ${synthese.nonMesures} non mesuré(s) ou sans cible.`,
      `${pluriel(objectifs.length, 'objectif', 'objectifs')} : ${objectifs.filter((o) => o.indicateurs.length && o.atteints === o.indicateurs.length).length} entièrement atteint(s).`,
    );
    for (const o of objectifs.filter((x) => x.indicateurs.some((i) => i.etat === 'ko')))
      faits.c2.push(
        `Objectif ${o.id} ${o.nom} : ${o.indicateurs
          .filter((i) => i.etat === 'ko')
          .map((i) => i.id)
          .join(', ')} non atteint(s).`,
      );
    const processus = lignes(etat.processes);
    for (const p of processus) {
      const os = objectifs.filter((o) => o.processus.includes(String(p.id)));
      const etats = [...new Map(os.flatMap((o) => o.indicateurs).map((i) => [i.id, i.etat])).values()];
      if (etats.length)
        faits.c3.push(
          `Processus ${String(p.id)} ${String(p.name)} : ${etats.filter((e) => e === 'ok').length} atteint(s), ${etats.filter((e) => e === 'ko').length} non atteint(s), ${etats.filter((e) => e !== 'ok' && e !== 'ko').length} à mesurer.`,
        );
    }
    if (!faits.c3.length) faits.c3.push('Aucun processus relié à des indicateurs.');
    const nonMesures = indicateurs.filter((i) => etatIndicateur(i, etat) === 'na');
    faits.c5.push(
      nonMesures.length
        ? `${pluriel(nonMesures.length, 'indicateur non mesuré', 'indicateurs non mesurés')} : ${nonMesures.map((i) => String(i.id)).join(', ')}.`
        : 'Tous les indicateurs disposent d’une valeur mesurée.',
    );

    // c4) non-conformités et actions correctives (registre des écarts).
    const ecarts = lignes(etat.findings);
    const ouverts = ecarts.filter((f) => !/^(clos|close|clôturé|soldé|levé)/i.test(String(f.status ?? '')));
    const enRetard = ouverts.filter((f) => f.due && String(f.due).slice(0, 10) < aujourdhui).length;
    faits.c4.push(
      `${pluriel(ecarts.length, 'constat enregistré', 'constats enregistrés')}, ${ouverts.length} ouvert(s)${enRetard ? ` dont ${enRetard} en retard` : ''}.`,
    );

    // c6) audits : plans de l'année.
    const annee = new Date().getFullYear();
    const types = plansAnnee(etat, annee, aujourdhui).filter((t) => t.type === 'audit');
    if (types.length)
      for (const t of types)
        faits.c6.push(
          `${t.libelle} ${annee} : ${t.realises} réalisé(s), ${t.aVenir} à venir, ${t.enRetard} en retard.`,
        );
    else faits.c6.push(`Aucun plan d’audit enregistré pour ${annee}.`);

    // c7) prestataires externes : évaluations immuables de l'organisation.
    if (user.rights.can('fournisseurs', 'lire')) {
      const fournisseurs = await this.g.suppliers.list(user);
      const evalues = fournisseurs.filter((f) => f.current).length;
      faits.c7.push(
        `${pluriel(fournisseurs.length, 'fournisseur', 'fournisseurs')} : ${evalues} évalué(s), ${fournisseurs.length - evalues} non évalué(s), ${fournisseurs.filter((f) => f.toReview).length} à réévaluer.`,
      );
    } else faits.c7.push('Données fournisseurs non accessibles avec vos droits.');

    // e) risques et opportunités ; f) opportunités d'amélioration.
    const risques = await this.g.db.k
      .selectFrom('grc_objects')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('smsi_id', '=', smsi)
      .where('kind', '=', 'risk')
      .where('archived', '=', false)
      .executeTakeFirst();
    const opportunites = await this.g.db.k
      .selectFrom('grc_objects')
      .select([sql<string>`data->>'status'`.as('status'), sql<number>`count(*)::int`.as('n')])
      .where('smsi_id', '=', smsi)
      .where('kind', '=', 'opportunity')
      .where('archived', '=', false)
      .groupBy(sql`1`)
      .execute();
    faits.e.push(`${pluriel(risques?.n ?? 0, 'risque enregistré', 'risques enregistrés')} dans le registre commun.`);
    const parStatut = (s: string) => opportunites.find((o) => o.status === s)?.n ?? 0;
    faits.e.push(
      `Opportunités : ${parStatut('identified')} identifiée(s), ${parStatut('evaluated')} évaluée(s), ${parStatut('pursued')} poursuivie(s), ${parStatut('realised')} réalisée(s), ${parStatut('dropped')} écartée(s).`,
    );
    const ameliorations = ecarts.filter((f) => ['observation', 'opportunity'].includes(String(f.findingType))).length;
    faits.f.push(
      `${pluriel(ameliorations, 'constat de type observation ou opportunité', 'constats de type observation ou opportunité')} ; ${parStatut('identified') + parStatut('evaluated')} opportunité(s) à traiter.`,
    );
    faits.d.push('Adéquation des ressources : à apprécier par la direction (aucune donnée calculée).');

    return {
      precedente,
      entrees: ENTREES_REVUE.map((e) => ({
        ...e,
        faits: faits[e.id as keyof typeof faits] ?? [],
        aSaisir: e.id === 'd',
      })),
    };
  }
}
