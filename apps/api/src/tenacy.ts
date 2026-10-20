/* Import Tenacy : crée ou met à jour des écarts natifs (non-conformités) et leurs actions depuis l'onglet « Gaps » d'un export
   Tenacy. La simulation calcule tout sans rien écrire et renvoie une empreinte des lignes ; l'application recalcule dans une
   transaction et refuse si les lignes ont changé depuis la simulation. Un écart se retrouve par son identifiant Tenacy
   (`data.tenacy.id`) dans le périmètre choisi : un second import du même fichier ne change rien. */
import { cleTexte, lireGaps, TENACY_LIMITES, type LigneTenacy, type TenacyBody } from '@suivi/shared';
import { deepEqual, type Json } from '@suivi/shared/legacy';
import type { SessionUser } from './auth.js';
import type { Client } from './db/db.js';
import { DEFAULT_SMSI, type Grc } from './grc/core.js';
import { HttpError } from './http/errors.js';
import { sha256hex } from './security/crypto.js';

export type ResultatLigne = 'cree' | 'maj' | 'inchange' | 'conserve';

export interface LigneRapport {
  ligne: number;
  id: string;
  nom: string;
  resultat: ResultatLigne;
  statut: string;
  /** Champs qui changent pour un écart déjà importé. */
  changements: string[];
  actionsACreer: number;
  actionsExistantes: number;
  mesures: string[];
  mesuresInconnues: string[];
  pilote: string;
  piloteRattache: boolean;
}
export interface RapportTenacy {
  empreinte: string;
  perimetre: string;
  totaux: {
    lignes: number;
    crees: number;
    miseAJour: number;
    inchanges: number;
    closConserves: number;
    actionsACreer: number;
  };
  lignes: LigneRapport[];
  avertissements: string[];
  erreurs: { ligne: number; message: string }[];
}

interface Travail {
  lecture: LigneTenacy;
  existant: Awaited<ReturnType<Grc['raw']>> | null;
  /** Données natives à enregistrer (écart créé ou mis à jour). */
  donnees: Record<string, unknown> | null;
  clore: boolean;
  taches: string[];
  ownerId: string | null;
}

const PRIORITE = (criticite: string) =>
  /crit|urgent/i.test(criticite)
    ? 'urgent'
    : /haut|high|major/i.test(criticite)
      ? 'high'
      : /bas|low|faible/i.test(criticite)
        ? 'low'
        : 'normal';
const aujourdhui = () => new Date().toISOString().slice(0, 10);
export const empreinteTenacy = (b: Pick<TenacyBody, 'perimetre' | 'lignes'>) =>
  sha256hex(JSON.stringify({ perimetre: b.perimetre, lignes: b.lignes }));

export class ImportTenacy {
  constructor(private readonly g: Grc) {}

  async simuler(user: SessionUser, body: TenacyBody): Promise<RapportTenacy> {
    return this.g.db.tx(async (c) => (await this.calculer(c, user, body)).rapport, user.username);
  }

  async appliquer(user: SessionUser, ip: string, body: TenacyBody, empreinte: string): Promise<RapportTenacy> {
    if (empreinteTenacy(body) !== empreinte)
      throw new HttpError(409, 'Les lignes diffèrent de celles qui ont été simulées : relancez la simulation.');
    return this.g.db.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['tenacy:' + body.perimetre]);
      const { rapport, travaux } = await this.calculer(c, user, body);
      if (rapport.erreurs.length) throw new HttpError(422, 'Corrigez les erreurs du fichier avant de l’appliquer.');
      const politique = (await this.g.politiqueDe(body.perimetre, c)).definition;
      const initial = politique.statuses.find((s) => !s.terminal)!;
      const terminal =
        politique.statuses.find((s) => s.id === 'done' && s.terminal) ?? politique.statuses.find((s) => s.terminal)!;
      const categorie = politique.catalogues.actionCategories[0]!.id;
      for (const t of travaux) if (t.donnees) await this.ecrire(c, user, ip, body.perimetre, t);
      // Actions : après les écarts, pour pouvoir les lier (un second passage relit les identifiants créés).
      for (const t of travaux) {
        if (!t.taches.length) continue;
        const ecart = (await this.trouver(c, body.perimetre, [t.lecture.id])).get(t.lecture.id);
        if (!ecart) continue;
        for (const nom of t.taches) {
          const data = {
            description: `Tâche issue de la recommandation Tenacy ${t.lecture.id}.`,
            status: initial.id,
            ownerId: t.ownerId,
            startAt: null,
            dueAt: t.lecture.echeance ? t.lecture.echeance + 'T09:00:00Z' : null,
            priority: PRIORITE(t.lecture.criticite),
            category: categorie,
            justification: '',
            reminderDays: 7,
            dependencies: [],
          };
          const normalisee = await this.g.normalize(body.perimetre, 'action', data, user, c);
          const a = await this.g.insert(c, body.perimetre, 'action', nom.slice(0, 200), normalisee, user, ip);
          if (t.lecture.statut === 'closed') {
            await this.g.write(
              c,
              (await this.g.raw(a.id, c, true))!,
              a.name,
              { ...normalisee, status: terminal.id, justification: 'Clos dans Tenacy.' },
              user,
              ip,
              'Import Tenacy : tâche close',
            );
          }
          await this.g.linkIn(
            c,
            body.perimetre,
            'object:' + a.id,
            'object:' + ecart.id,
            'treats',
            'Import Tenacy',
            user,
            ip,
          );
        }
      }
      await this.g.db.audit(
        user,
        ip,
        'import.tenacy',
        'tenacy:' + empreinte.slice(0, 12),
        { perimetre: body.perimetre, empreinte, totaux: rapport.totaux },
        c,
      );
      return rapport;
    }, user.username);
  }

  /** Écrit un écart créé ou mis à jour (la clôture passe par une écriture directe : l'API normale la refuse). */
  private async ecrire(c: Client, user: SessionUser, ip: string, smsi: string, t: Travail) {
    const l = t.lecture;
    const nom = l.nom;
    const donnees = t.donnees!;
    if (t.existant) {
      const normalisee = await this.g.normalize(
        smsi,
        'nonconformity',
        { ...donnees, status: t.clore ? t.existant.data.status : donnees.status },
        user,
        c,
        t.existant,
      );
      let courant = await this.g.write(c, t.existant, nom, normalisee, user, ip, 'Import Tenacy');
      if (t.clore) courant = await this.cloture(c, user, ip, courant, normalisee);
      return courant;
    }
    const ouverte = await this.g.normalize(
      smsi,
      'nonconformity',
      { ...donnees, status: donnees.status === 'closed' ? 'open' : donnees.status },
      user,
      c,
    );
    const o = await this.g.insert(c, smsi, 'nonconformity', nom, ouverte, user, ip);
    if (t.clore) await this.cloture(c, user, ip, o, ouverte);
    return o;
  }
  private async cloture(c: Client, user: SessionUser, ip: string, o: { id: string }, donnees: Record<string, unknown>) {
    const frais = (await this.g.raw(o.id, c, true))!;
    const jour = aujourdhui();
    return this.g.write(
      c,
      frais,
      frais.name,
      { ...donnees, status: 'closed', closedAt: jour, closureNote: `Clos dans Tenacy (import du ${jour}).` },
      user,
      ip,
      'Import Tenacy : écart clos',
    );
  }

  private async trouver(c: Client, smsi: string, ids: string[]) {
    const r = await c.query<{ id: string }>(
      "SELECT id FROM grc_objects WHERE smsi_id=$1 AND kind='nonconformity' AND NOT archived AND data #>> '{tenacy,id}' = ANY($2::text[])",
      [smsi, ids],
    );
    const out = new Map<string, NonNullable<Awaited<ReturnType<Grc['raw']>>>>();
    for (const row of r.rows) {
      const o = await this.g.raw(row.id, c, true);
      if (o) out.set(String((o.data.tenacy as { id?: string } | undefined)?.id ?? ''), o);
    }
    return out;
  }

  private async calculer(c: Client, user: SessionUser, body: TenacyBody) {
    await this.g.access(body.perimetre, user, true, c);
    await this.g.permission(user, 'ecarts', 'modifier');
    const lecture = lireGaps(body.lignes);
    const avertissements: string[] = [];
    if (lecture.vide) avertissements.push('L’onglet « Gaps » ne contient aucun écart.');
    if (lecture.statutsInconnus.length)
      avertissements.push(
        `Statuts Tenacy non reconnus, traités comme « Ouvert » : ${lecture.statutsInconnus.join(', ')}.`,
      );
    const connues = new Set(
      ((await this.g.legacy.recompose(c))?.data?.items as { id?: unknown }[] | undefined)?.map((i) => String(i.id)) ??
        [],
    );
    const existants = await this.trouver(
      c,
      body.perimetre,
      lecture.lignes.map((l) => l.id),
    );
    const liees = await c.query<{ ref: string; name: string }>(
      `SELECT l.target_ref AS ref, o.name FROM grc_links l JOIN grc_objects o ON o.id=l.source_id
       WHERE l.smsi_id=$1 AND l.type='treats' AND o.kind='action' AND NOT o.archived AND l.target_ref = ANY($2::text[])`,
      [body.perimetre, [...existants.values()].map((o) => 'object:' + o.id)],
    );
    const tachesDe = new Map<string, Set<string>>();
    for (const r of liees.rows)
      (tachesDe.get(r.ref) ?? tachesDe.set(r.ref, new Set()).get(r.ref)!).add(cleTexte(r.name));
    const utilisateurs = (
      await c.query<{ id: string; username: string; display_name: string; email: string }>(
        'SELECT id, username, display_name, email FROM users WHERE NOT disabled AND (expires_at IS NULL OR expires_at>now())',
      )
    ).rows;
    const travaux: Travail[] = [];
    const lignes: LigneRapport[] = [];
    let actions = 0;
    for (const l of lecture.lignes) {
      const existant = existants.get(l.id) ?? null;
      const pilote = await this.pilote(c, body.perimetre, l.pilote, utilisateurs);
      // Les mesures de l'outil de suivi ne se rattachent que dans le périmètre commun ; ailleurs le code reste sur la fiche.
      const rattachables = body.perimetre === DEFAULT_SMSI ? connues : new Set<string>();
      const refs = l.mesures.filter((m) => rattachables.has(m)).map((m) => 'legacy:items:' + m);
      const inconnues = l.mesures.filter((m) => !rattachables.has(m));
      const deja = existant ? (tachesDe.get('object:' + existant.id) ?? new Set<string>()) : new Set<string>();
      const taches = l.taches.filter(
        (t, i, a) => a.findIndex((x) => cleTexte(x) === cleTexte(t)) === i && !deja.has(cleTexte(t)),
      );
      const description = [l.description, l.action ? `Recommandation : ${l.action}` : ''].filter(Boolean).join('\n\n');
      const champs = {
        description,
        findingType: l.nature,
        classification: l.classification,
        source: l.source,
        origin: l.source ? 'audit' : 'other',
        dueAt: l.echeance,
      };
      const tenacy = {
        id: l.id,
        pilote: l.pilote,
        groupe: l.groupe,
        criticite: l.criticite,
        statut: l.statutBrut,
        perimetre: l.perimetre,
        actions: l.actionsTenacy,
        mesures: l.mesures,
        annee: l.annee,
      };
      let resultat: ResultatLigne;
      let donnees: Record<string, unknown> | null = null;
      let clore = false;
      const changements: string[] = [];
      if (!existant) {
        resultat = 'cree';
        clore = l.statut === 'closed';
        donnees = {
          cause: '',
          priority: PRIORITE(l.criticite),
          ...champs,
          status: l.statut === 'progress' ? 'progress' : 'open',
          ownerId: pilote.id,
          refs,
          tenacy,
        };
      } else if (existant.data.status === 'closed' || existant.data.effectiveness !== 'pending') {
        resultat = 'conserve';
      } else {
        const avant = existant.data;
        const autresRefs = (Array.isArray(avant.refs) ? (avant.refs as string[]) : []).filter(
          (r) => !r.startsWith('legacy:items:'),
        );
        const suivant: Record<string, unknown> = {
          ...avant,
          ...champs,
          ownerId: avant.ownerId ?? pilote.id,
          refs: [...autresRefs, ...refs],
          tenacy,
        };
        clore = l.statut === 'closed';
        if (!clore && l.statut === 'progress' && avant.status === 'open') suivant.status = 'progress';
        if (existant.name !== l.nom) changements.push('intitulé');
        for (const [k, libelle] of [
          ['description', 'description'],
          ['findingType', 'nature'],
          ['classification', 'classification'],
          ['source', 'audit à l’origine'],
          ['dueAt', 'échéance'],
          ['ownerId', 'pilote'],
          ['refs', 'mesures'],
          ['status', 'statut'],
          ['tenacy', 'informations Tenacy'],
        ] as const)
          if (!deepEqual(avant[k] as Json | undefined, suivant[k] as Json | undefined)) changements.push(libelle);
        if (clore) changements.push('clôture');
        resultat = changements.length || taches.length ? 'maj' : 'inchange';
        donnees = changements.length ? suivant : null;
      }
      actions += taches.length;
      travaux.push({ lecture: l, existant, donnees, clore, taches, ownerId: pilote.id });
      lignes.push({
        ligne: l.ligne,
        id: l.id,
        nom: l.nom,
        resultat,
        statut: l.statut,
        changements,
        actionsACreer: taches.length,
        actionsExistantes: l.taches.length - taches.length,
        mesures: refs.map((r) => r.slice('legacy:items:'.length)),
        mesuresInconnues: inconnues,
        pilote: l.pilote,
        piloteRattache: !!pilote.id,
      });
    }
    if (actions > TENACY_LIMITES.actions)
      throw new HttpError(422, `Au plus ${TENACY_LIMITES.actions} actions créées par import (${actions} demandées).`);
    const nb = (r: ResultatLigne) => lignes.filter((x) => x.resultat === r).length;
    const sansPilote = lignes.filter((x) => x.pilote && !x.piloteRattache).length;
    if (sansPilote)
      avertissements.push(
        `${sansPilote} pilote(s) Tenacy sans compte correspondant dans ce périmètre : le nom est conservé sur la fiche.`,
      );
    if (body.perimetre !== DEFAULT_SMSI)
      avertissements.push(
        'Les mesures de l’outil de suivi ne se rattachent que dans le périmètre commun : les codes Tenacy sont conservés sur les fiches.',
      );
    else {
      const sansMesure = lignes.filter((x) => !x.mesures.length).length;
      if (sansMesure)
        avertissements.push(`${sansMesure} écart(s) sans mesure reconnue (orphelins) : à rattacher depuis leur fiche.`);
    }
    return {
      travaux,
      rapport: {
        empreinte: empreinteTenacy(body),
        perimetre: body.perimetre,
        totaux: {
          lignes: lignes.length,
          crees: nb('cree'),
          miseAJour: nb('maj'),
          inchanges: nb('inchange'),
          closConserves: nb('conserve'),
          actionsACreer: actions,
        },
        lignes,
        avertissements,
        erreurs: lecture.erreurs,
      } satisfies RapportTenacy,
    };
  }

  /** Compte actif correspondant au pilote Tenacy (identifiant, nom affiché ou courriel, sans casse), s'il est unique et autorisé. */
  private async pilote(
    c: Client,
    smsi: string,
    nom: string,
    utilisateurs: { id: string; username: string; display_name: string; email: string }[],
  ) {
    const cle = nom.trim().toLowerCase();
    if (!cle) return { id: null as string | null };
    const trouves = utilisateurs.filter((u) =>
      [u.username, u.display_name, u.email].some((x) => x && x.trim().toLowerCase() === cle),
    );
    if (trouves.length !== 1) return { id: null };
    try {
      await this.g.checkOwner(smsi, trouves[0]!.id, c);
      return { id: trouves[0]!.id };
    } catch {
      return { id: null };
    }
  }
}
