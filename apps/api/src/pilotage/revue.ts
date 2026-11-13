/* Entrées de la revue de direction (ISO/IEC 27001:2022, 9.3.2) : faits chiffrés tirés des données de la plateforme, préparés
   pour la direction. Rien n'est interprété ni complété : une donnée absente donne « aucune donnée ». Chaque périmètre a sa
   propre revue ; les périmètres enfants qui héritent des référentiels du parent remontent dans la sienne (BUG-042). Les données sont filtrées selon les droits de la personne qui prépare la revue. */
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
import { compter } from '../grc/cartes.js';
import { perimetreDe } from '../historique/registre.js';
import { PorteeLecture } from '../acces/portee.js';

const lignes = (v: unknown): JsonObject[] => (Array.isArray(v) ? v.filter(isObject) : []);
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const jour = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

export class PilotageRevue {
  constructor(private readonly g: Grc) {}

  /** Périmètre et périmètres enfants qui héritent de ses référentiels (chaîne arrêtée au premier qui n'hérite pas, ADR 0039) :
      leurs entrées remontent dans la revue de ce périmètre. */
  private async heritiers(smsi: string, portee: PorteeLecture): Promise<{ id: string; name: string }[]> {
    const rows = await sql<{ id: string; name: string }>`WITH RECURSIVE h(id, name) AS (
        SELECT id, name FROM grc_smsis WHERE parent_id = ${smsi}::uuid AND inherit_frameworks
        UNION
        SELECT s.id, s.name FROM grc_smsis s JOIN h ON s.parent_id = h.id WHERE s.inherit_frameworks
      ) SELECT id::text, name FROM h`.execute(this.g.db.k);
    const lisibles = await portee.perimetresLisibles();
    return rows.rows.filter((r) => lisibles.has(r.id));
  }

  async entrees(
    smsi: string,
    user: SessionUser,
  ): Promise<{ precedente: { id: string; date: string } | null; entrees: EntreeRevue[] }> {
    await this.g.access(smsi, user);
    await this.g.permission(user, GRC_MODULES.management_review, 'lire');
    const portee = PorteeLecture.pour(this.g, user);
    const etat = (await portee.etatHistorique()).data;
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const racine = smsi === DEFAULT_SMSI;
    const enfants = await this.heritiers(smsi, portee);
    const ids = [smsi, ...enfants.map((e) => e.id)];
    const faits = {
      a: [] as string[],
      b: [] as string[],
      c: [] as string[],
      d1: [] as string[],
      d2: [] as string[],
      d3: [] as string[],
      d4: [] as string[],
      e: [] as string[],
      f: [] as string[],
      g: [] as string[],
    };

    // a) actions décidées lors de la revue précédente : revues du périmètre (celles de l'outil historique sont au commun).
    const revuesNatives = await this.g.db.k
      .selectFrom('grc_objects')
      .select(['id', sql<string>`data->>'heldAt'`.as('date')])
      .where('smsi_id', '=', smsi)
      .where('kind', '=', 'management_review')
      .where('archived', '=', false)
      .execute();
    const revues = [
      ...(racine
        ? lignes(etat.reviews).map((r) => ({
            id: String(r.id),
            source: `legacy:reviews:${String(r.id)}`,
            date: String(isObject(r.pilotage) && r.pilotage.heldAt ? r.pilotage.heldAt : (r.date ?? '')).slice(0, 10),
          }))
        : []),
      ...revuesNatives.map((r) => ({ id: r.id, source: `object:${r.id}`, date: String(r.date ?? '').slice(0, 10) })),
    ]
      .filter((r) => r.date && r.date <= aujourdhui)
      .sort((x, y) => y.date.localeCompare(x.date));
    const precedente = revues[0] ? { id: revues[0].id, date: revues[0].date } : null;
    if (revues[0]) {
      const decisions = await this.g.db.k
        .selectFrom('pilotage_decisions')
        .select('generated_refs')
        .where('smsi_id', '=', smsi)
        .where('source_ref', '=', revues[0].source)
        .execute();
      const generes = [
        ...new Set(
          decisions
            .flatMap((d) => d.generated_refs as string[])
            .filter((r) => r.startsWith('object:'))
            .map((r) => r.slice(7)),
        ),
      ];
      if (generes.length) {
        const politique = (await this.g.policy(smsi, user)).definition;
        const clos = new Set(politique.statuses.filter((s) => s.terminal).map((s) => s.id));
        const masques = await portee.masquesDuPerimetre(smsi);
        // Chemins jsonb fixes ; registres masqués exclus (aucun masque : tout est lisible, comme <> ALL d'un tableau vide).
        const actions = await this.g.db.k
          .selectFrom('grc_objects')
          .select([sql<string>`data->>'status'`.as('status'), sql<string | null>`data->>'dueAt'`.as('due')])
          .where('smsi_id', '=', smsi)
          .where('id', 'in', generes)
          .where('kind', '=', 'action')
          .$if(masques.length > 0, (q) =>
            q.where((eb) => eb.or([eb('registre_id', 'is', null), eb('registre_id', 'not in', masques)])),
          )
          .execute();
        const ouvertes = actions.filter((a) => !clos.has(a.status));
        const retard = ouvertes.filter((a) => a.due && a.due.slice(0, 10) < aujourdhui).length;
        faits.a.push(
          `Revue du ${jour(revues[0].date)} : ${pluriel(actions.length, 'action décidée', 'actions décidées')}, ${actions.length - ouvertes.length} terminée(s), ${ouvertes.length} ouverte(s)${retard ? ` dont ${retard} en retard` : ''}.`,
        );
      } else faits.a.push(`Revue du ${jour(revues[0].date)} : aucune action créée à partir de ses décisions.`);
    } else faits.a.push('Aucune revue de direction précédente enregistrée pour ce périmètre.');

    // Fiches saisies à l'écran du périmètre et de ses périmètres enfants héritiers (objets du Pilotage).
    const natifs = async (kind: string) =>
      (
        await this.g.db.k
          .selectFrom('grc_objects')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('smsi_id', 'in', ids)
          .where('kind', '=', kind as never)
          .where('archived', '=', false)
          .executeTakeFirst()
      )?.n ?? 0;
    const suffixe = enfants.length
      ? ` (dont les périmètres enfants héritiers : ${enfants.map((e) => e.name).join(', ')})`
      : '';
    // b) enjeux : fiches de contexte.
    faits.b.push(`${pluriel(await natifs('context'), 'fiche de contexte', 'fiches de contexte')}${suffixe}.`);
    // c) parties intéressées (historiques au commun, fiches saisies à l'écran partout).
    const historiqueParties = racine ? lignes(etat.interested) : [];
    const nonRevues = historiqueParties.filter(
      (p) => !p.reviewed || String(p.reviewed) < new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10),
    ).length;
    faits.c.push(
      `${pluriel(historiqueParties.length + (await natifs('stakeholder')), 'partie intéressée', 'parties intéressées')} enregistrée(s)${racine ? `, dont ${nonRevues} non revue(s) depuis un an parmi les parties historiques` : ''}${suffixe}.`,
    );

    // d4) objectifs et indicateurs (historiques au commun) ; e) retours (satisfaction, prestataires).
    if (racine) {
      const objectifs = objectifsPilotage(etat);
      const synthese = indicateursSynthese(etat);
      const indicateurs = lignes(etat.indicators);
      faits.d4.push(
        `${synthese.atteints}/${synthese.total} indicateur(s) atteint(s), ${synthese.nonAtteints} non atteint(s), ${synthese.nonMesures} non mesuré(s) ou sans cible.`,
        `${pluriel(objectifs.length, 'objectif', 'objectifs')} : ${objectifs.filter((o) => o.indicateurs.length && o.atteints === o.indicateurs.length).length} entièrement atteint(s).`,
      );
      for (const o of objectifs.filter((x) => x.indicateurs.some((i) => i.etat === 'ko')))
        faits.d4.push(
          `Objectif ${o.id} ${o.nom} : ${o.indicateurs
            .filter((i) => i.etat === 'ko')
            .map((i) => i.id)
            .join(', ')} non atteint(s).`,
        );
      const nonMesures = indicateurs.filter((i) => etatIndicateur(i, etat) === 'na');
      faits.d2.push(
        nonMesures.length
          ? `${pluriel(nonMesures.length, 'indicateur non mesuré', 'indicateurs non mesurés')} : ${nonMesures.map((i) => String(i.id)).join(', ')}.`
          : 'Tous les indicateurs disposent d’une valeur mesurée.',
      );
      const satisfaction = indicateurs.filter((i) => i.category === 'satisfaction');
      if (satisfaction.length)
        for (const i of satisfaction) {
          const f = objectifs.flatMap((o) => o.indicateurs).find((x) => x.id === i.id);
          faits.e.push(`${String(i.id)} ${String(i.name)} : ${f?.valeur ?? '–'} (cible ${f?.cible ?? '–'}).`);
        }
      else faits.e.push('Aucun indicateur de retour des parties intéressées enregistré (catégorie « satisfaction »).');
      if (user.rights.can('fournisseurs', 'lire')) {
        const fournisseurs = await this.g.suppliers.list(user);
        const evalues = fournisseurs.filter((f) => f.current).length;
        faits.e.push(
          `${pluriel(fournisseurs.length, 'fournisseur', 'fournisseurs')} : ${evalues} évalué(s), ${fournisseurs.length - evalues} non évalué(s), ${fournisseurs.filter((f) => f.toReview).length} à réévaluer.`,
        );
      } else faits.e.push('Données fournisseurs non accessibles avec vos droits.');
    } else {
      faits.d4.push(
        `${pluriel(await natifs('objective'), 'objectif', 'objectifs')} et ${pluriel(await natifs('indicator'), 'indicateur', 'indicateurs')} saisis pour ce périmètre${suffixe}.`,
      );
      faits.d2.push(
        'Aucune donnée de surveillance propre à ce périmètre : les indicateurs historiques relèvent du périmètre commun.',
      );
      faits.e.push('Aucune donnée propre à ce périmètre.');
    }

    // d3) audits : plans d'audit de l'année du périmètre et de ses périmètres enfants héritiers (BUG-062).
    {
      const annee = new Date().getFullYear();
      const concernes = new Set(ids);
      const types = plansAnnee(
        { ...etat, plans: lignes(etat.plans).filter((p) => concernes.has(perimetreDe(p))) },
        annee,
        aujourdhui,
      ).filter((t) => t.type === 'audit');
      if (types.some((t) => t.realises + t.aVenir + t.enRetard > 0))
        for (const t of types)
          faits.d3.push(
            `${t.libelle} ${annee} : ${t.realises} réalisé(s), ${t.aVenir} à venir, ${t.enRetard} en retard.`,
          );
      else faits.d3.push(`Aucun plan d’audit enregistré pour ${annee}.`);
    }

    // d1) non-conformités et actions correctives des périmètres concernés (objets natifs ; au commun, la projection historique
    // des constats couvre les mêmes fiches).
    const masques = await portee.masquesDuPerimetre(smsi);
    const c = await compter(this.g, ids, masques, new Date().toISOString());
    faits.d1.push(
      `${pluriel(c?.ecartsOuverts ?? 0, 'constat ouvert', 'constats ouverts')}${c?.ecartsRetard ? ` dont ${c.ecartsRetard} en retard` : ''}, ${c?.ecartsMajeurs ?? 0} majeur(s)${suffixe}.`,
      `${pluriel(c?.actionsOuvertes ?? 0, 'action ouverte', 'actions ouvertes')}${c?.actionsRetard ? ` dont ${c.actionsRetard} en retard` : ''}.`,
    );

    // d2) incidents de sécurité du périmètre et de ses périmètres enfants héritiers (BUG-070).
    const lisibles = new Set(ids);
    const incidents = lignes(etat.incidents).filter((i) => lisibles.has(perimetreDe(i)));
    const ouvertsInc = incidents.filter((i) => !['Résolu', 'Clos'].includes(String(i.status ?? '')));
    faits.d2.push(
      incidents.length
        ? `${pluriel(incidents.length, 'incident enregistré', 'incidents enregistrés')}, ${ouvertsInc.length} ouvert(s)${suffixe}.`
        : `Aucun incident enregistré pour ce périmètre${suffixe}.`,
    );

    // f) risques et traitements.
    const risques = await this.g.db.k
      .selectFrom('grc_objects')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('smsi_id', 'in', ids)
      .where('kind', '=', 'risk')
      .where('archived', '=', false)
      .executeTakeFirst();
    faits.f.push(
      `${pluriel(risques?.n ?? 0, 'risque enregistré', 'risques enregistrés')} et ${pluriel(await natifs('treatment'), 'traitement', 'traitements')}${suffixe}.`,
    );

    // g) opportunités d'amélioration : constats de type observation ou opportunité.
    if (racine) {
      const ecarts = lignes(etat.findings);
      const ameliorations = ecarts.filter((f) => ['observation', 'opportunity'].includes(String(f.findingType))).length;
      faits.g.push(
        `${pluriel(ameliorations, 'constat de type observation ou opportunité', 'constats de type observation ou opportunité')}.`,
      );
    } else faits.g.push('Aucune donnée propre à ce périmètre.');

    return {
      precedente,
      entrees: ENTREES_REVUE.map((e) => ({
        ...e,
        faits: faits[e.id as keyof typeof faits] ?? [],
        aSaisir: false,
      })),
    };
  }
}
