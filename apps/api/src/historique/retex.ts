/* RETEX d'un incident : collecte des éléments (ouverture par le pilote, invitations de contributeurs d'autres pôles, file à
   valider, récupération depuis la fiche de l'incident et la main courante de crise, clôture et diffusion).

   Deux habilitations distinctes :
   - le pilote agit avec le droit « incidents:modifier » (routes déclarées avec cette permission, `registre.modifier`) ;
   - un contributeur n'a AUCUN droit de module : il est habilité sur un seul RETEX parce que son compte figure dans la liste
     des contributeurs. Ses routes exigent une session complète (« auth », double authentification comprise) et passent par
     `registre.modifierDelegue` / `lireDelegue` : l'habilitation est vérifiée sous verrou, sur l'état courant. Il ne reçoit
     que le contexte minimal et ses propres propositions ; la chronologie complète seulement si le pilote l'a diffusée.
   Toute écriture est journalisée (audit) ; les invitations et relances sont des notifications métier « retex_contribution »
   (application et courriel selon les réglages de la personne, ADR 0058). */
import {
  ContributionTerminee,
  DiffusionRetex,
  InvitationRetex,
  LotEvenementsRetex,
  MAX_CONTRIBUTEURS_RETEX,
  MAX_EVENEMENTS_RETEX,
  MAX_PROPOSITIONS_RETEX,
  OuvertureRetex,
  PropositionRetexModification,
  PropositionRetexSaisie,
  ReglageCollecte,
  TraitementProposition,
  identifiantEvenementRetex,
  identifiantProposition,
  lireCollecteRetex,
  lireEvenementsRetex,
  lireIncident,
  propositionModifiable,
  type CandidatRetex,
  type CollecteRetex,
  type EvenementRetex,
  type Incident,
  type InvitationVue,
  type PropositionRetex,
} from '@suivi/shared';
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { surConnexion, type Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { NotificationEmise } from '../notifications-metier.js';
import { entrees, remplacerEntree, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const maintenant = () => new Date().toISOString();
const nomDe = (u: SessionUser) => u.displayName || u.username;
const KIND = 'retex_contribution';
const actif = sql<boolean>`(NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at > now()))`;

/** Contribution vue par son auteur : contexte, ses propositions, et la chronologie si elle a été diffusée. */
export interface ContributionVue {
  invitation: InvitationVue;
  propositions: PropositionRetex[];
  chronologie: EvenementRetex[] | null;
}

export class Retex {
  constructor(private readonly r: RegistreHistorique) {}

  /* ------------------------------------------------------------------------------------------ pilote */
  ouvrir(id: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const b = OuvertureRetex.parse(input);
    return this.ecrire(user, ip, 'retex.opened', id, (i) => {
      if (lireCollecteRetex(i.retexCollecte)) throw new HttpError(409, 'Un RETEX est déjà ouvert pour cet incident.');
      return {
        ...i,
        retexCollecte: {
          statut: 'ouverte',
          piloteId: user.id,
          piloteNom: nomDe(user),
          ouverteLe: maintenant(),
          clotureeLe: '',
          echeance: b.echeance ?? '',
          consigne: b.consigne ?? '',
          diffusee: false,
          diffuseeLe: '',
          contributeurs: [],
          propositions: [],
        },
      };
    });
  }

  regler(id: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const b = ReglageCollecte.parse(input);
    return this.ecrire(user, ip, 'retex.updated', id, (i) => ({ ...i, retexCollecte: { ...collecteBrute(i), ...b } }));
  }

  /** Comptes actifs proposables comme contributeurs (nom affiché et pôles), hors pilote. */
  async candidats(user: SessionUser): Promise<CandidatRetex[]> {
    await this.r.g.permission(user, 'incidents', 'modifier');
    const rows = await this.r.g.db.k
      .selectFrom('users as u')
      .leftJoin('user_groups as ug', 'ug.user_id', 'u.id')
      .leftJoin('groups as g', 'g.id', 'ug.group_id')
      .select([
        sql<string>`u.id::text`.as('id'),
        sql<string>`coalesce(nullif(u.display_name, ''), u.username)`.as('nom'),
        sql<string>`coalesce(string_agg(g.name, ', ' ORDER BY lower(g.name)), '')`.as('pole'),
      ])
      .where(actif)
      .where('u.id', '!=', user.id)
      .groupBy('u.id')
      .orderBy(sql`lower(coalesce(nullif(u.display_name, ''), u.username))`)
      .execute();
    return rows;
  }

  /** Invite des contributeurs (comptes actifs) et leur adresse une notification. Une personne déjà invitée est ignorée. */
  inviter(id: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const b = InvitationRetex.parse(input);
    return this.ecrire(user, ip, 'retex.invited', id, async (i, c) => {
      const col = collecteOuverte(i);
      const deja = new Set(listeObjets(col.contributeurs).map((x) => str(x.id)));
      const nouveaux = [...new Set(b.utilisateurs)].filter((u) => !deja.has(u) && u !== user.id);
      if (deja.size + nouveaux.length > MAX_CONTRIBUTEURS_RETEX)
        throw new HttpError(409, `Un RETEX compte au plus ${MAX_CONTRIBUTEURS_RETEX} contributeurs.`);
      const comptes = nouveaux.length ? await this.comptes(c, nouveaux) : [];
      if (comptes.length !== nouveaux.length) throw new HttpError(422, 'Compte inconnu, désactivé ou expiré.');
      const envoi = Number(col.envois ?? 0) + 1;
      const t = maintenant();
      const suivant = {
        ...col,
        ...(b.consigne !== undefined ? { consigne: b.consigne } : {}),
        ...(b.echeance !== undefined ? { echeance: b.echeance } : {}),
        envois: comptes.length ? envoi : Number(col.envois ?? 0),
        contributeurs: [
          ...listeObjets(col.contributeurs),
          ...comptes.map((x) => ({ id: x.id, nom: x.nom, pole: x.pole, inviteLe: t, relanceLe: '', termineLe: '' })),
        ],
      };
      if (comptes.length)
        await this.notifier(
          c,
          id,
          envoi,
          comptes.map((x) => x.id),
          'invitation',
        );
      return { ...i, retexCollecte: suivant };
    });
  }

  /** Relance les contributeurs qui n'ont pas terminé (ou un seul). */
  relancer(id: string, uid: string | undefined, user: SessionUser, ip: string): Promise<Incident> {
    return this.ecrire(user, ip, 'retex.reminded', id, async (i, c) => {
      const col = collecteOuverte(i);
      const cibles = listeObjets(col.contributeurs).filter((x) => !str(x.termineLe) && (!uid || x.id === uid));
      if (!cibles.length) throw new HttpError(409, 'Aucun contributeur à relancer.');
      const envoi = Number(col.envois ?? 0) + 1;
      const t = maintenant();
      const ids = new Set(cibles.map((x) => str(x.id)));
      await this.notifier(c, id, envoi, [...ids], 'relance');
      return {
        ...i,
        retexCollecte: {
          ...col,
          envois: envoi,
          contributeurs: listeObjets(col.contributeurs).map((x) => (ids.has(str(x.id)) ? { ...x, relanceLe: t } : x)),
        },
      };
    });
  }

  /** Retire un contributeur : ses propositions déjà traitées restent ; celles en attente sont retirées. */
  retirerContributeur(id: string, uid: string, user: SessionUser, ip: string): Promise<Incident> {
    return this.ecrire(user, ip, 'retex.contributor-removed', id, (i) => {
      const col = collecteBrute(i);
      const avant = listeObjets(col.contributeurs);
      if (!avant.some((x) => x.id === uid)) throw new HttpError(404, 'Contributeur absent.');
      return {
        ...i,
        retexCollecte: {
          ...col,
          contributeurs: avant.filter((x) => x.id !== uid),
          propositions: listeObjets(col.propositions).filter(
            (p) => !(p.auteurId === uid && str(p.statut || 'en_attente') === 'en_attente'),
          ),
        },
      };
    });
  }

  /** Décision du pilote sur une proposition : accepter (éventuellement corrigée), doublon d'un événement, rejeter. */
  traiter(id: string, pid: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const b = TraitementProposition.parse(input);
    return this.ecrire(user, ip, `retex.proposal-${b.decision}`, id, (i) => {
      const col = collecteBrute(i);
      const props = listeObjets(col.propositions);
      const p = props.find((x) => x.id === pid);
      if (!p) throw new HttpError(404, 'Proposition absente.');
      if (str(p.statut || 'en_attente') !== 'en_attente') throw new HttpError(409, 'Proposition déjà traitée.');
      const chrono = chronologieBrute(i);
      let timeline = chrono,
        timelineSeq = i.timelineSeq,
        evenementId = '';
      if (b.decision === 'accepter') {
        if (chrono.length >= MAX_EVENEMENTS_RETEX) throw new HttpError(409, 'Chronologie complète.');
        evenementId = identifiantEvenementRetex(
          chrono.filter(isObject).map((e) => str(e.id)),
          typeof i.timelineSeq === 'number' ? i.timelineSeq : 0,
        );
        const champs = {
          ts: str(p.ts),
          type: str(p.type),
          titre: str(p.titre),
          description: str(p.description),
          acteur: str(p.acteur),
          gravite: str(p.gravite),
        };
        const evt: JsonObject = {
          id: evenementId,
          createdAt: maintenant(),
          ...champs,
          ...(b.corrections ?? {}),
          source: `proposition:${pid}`,
          apport: str(p.auteurNom),
        };
        // Les corrections du pilote passent par la même validation qu'une saisie (date, type, intitulé).
        if (!lireEvenementsRetex([evt]).length) throw new HttpError(422, 'Date et heure de la proposition invalides.');
        timeline = [...chrono, evt];
        timelineSeq = Number(evenementId.slice(3));
      } else if (b.decision === 'doublon') {
        if (!chrono.some((e) => isObject(e) && e.id === b.evenementId))
          throw new HttpError(422, 'Événement de la chronologie introuvable.');
        evenementId = b.evenementId;
      }
      const traitee = {
        ...p,
        statut: b.decision === 'accepter' ? 'acceptee' : b.decision === 'doublon' ? 'doublon' : 'rejetee',
        motif: b.decision === 'accepter' ? '' : (b.motif ?? ''),
        evenementId,
        traiteLe: maintenant(),
      };
      return {
        ...i,
        timeline,
        ...(timelineSeq !== undefined ? { timelineSeq } : {}),
        retexCollecte: { ...col, propositions: props.map((x) => (x.id === pid ? traitee : x)) },
      };
    });
  }

  /** Import en lot (fiche de l'incident, main courante de crise) : un élément déjà importé (même source) est ignoré. */
  importer(id: string, input: unknown, user: SessionUser, ip: string): Promise<Incident & { importes?: number }> {
    const b = LotEvenementsRetex.parse(input);
    return this.ecrire(user, ip, 'retex.imported', id, (i) => {
      const chrono = chronologieBrute(i);
      const connues = new Set(
        chrono
          .filter(isObject)
          .map((e) => str(e.source))
          .filter(Boolean),
      );
      const nouveaux = b.evenements.filter(
        (e, k, l) => !connues.has(e.source) && l.findIndex((x) => x.source === e.source) === k,
      );
      if (chrono.length + nouveaux.length > MAX_EVENEMENTS_RETEX)
        throw new HttpError(409, `La chronologie est limitée à ${MAX_EVENEMENTS_RETEX} événements.`);
      let seq = typeof i.timelineSeq === 'number' ? i.timelineSeq : 0;
      const ids = chrono.filter(isObject).map((e) => str(e.id));
      const ajout = nouveaux.map((e) => {
        const eid = identifiantEvenementRetex(ids, seq);
        ids.push(eid);
        seq = Number(eid.slice(3));
        return { id: eid, createdAt: maintenant(), description: '', acteur: '', gravite: '', apport: '', ...e };
      });
      const suivant = { ...i, timeline: [...chrono, ...ajout], ...(ajout.length ? { timelineSeq: seq } : {}) };
      return { ...suivant, importes: ajout.length };
    });
  }

  /** Clôt la collecte : plus aucune proposition ; refusé tant que des propositions attendent une décision. */
  cloturer(id: string, user: SessionUser, ip: string): Promise<Incident> {
    return this.ecrire(user, ip, 'retex.closed', id, (i) => {
      const col = collecteOuverte(i);
      const attente = listeObjets(col.propositions).filter((p) => str(p.statut || 'en_attente') === 'en_attente');
      if (attente.length)
        throw new HttpError(
          409,
          `${attente.length} proposition(s) attendent encore une décision dans la file à valider.`,
        );
      return { ...i, retexCollecte: { ...col, statut: 'cloturee', clotureeLe: maintenant() } };
    });
  }

  rouvrir(id: string, user: SessionUser, ip: string): Promise<Incident> {
    return this.ecrire(user, ip, 'retex.reopened', id, (i) => {
      const col = collecteBrute(i);
      if (str(col.statut) !== 'cloturee') throw new HttpError(409, 'La collecte est déjà ouverte.');
      return { ...i, retexCollecte: { ...col, statut: 'ouverte', clotureeLe: '', diffusee: false, diffuseeLe: '' } };
    });
  }

  /** Diffuse (ou retire) la chronologie générée aux contributeurs, en lecture seule, après clôture. */
  diffuser(id: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const b = DiffusionRetex.parse(input);
    return this.ecrire(user, ip, b.diffusee ? 'retex.shared' : 'retex.unshared', id, (i) => {
      const col = collecteBrute(i);
      if (b.diffusee && str(col.statut) !== 'cloturee')
        throw new HttpError(409, 'Clôturez la collecte avant de diffuser la chronologie.');
      return { ...i, retexCollecte: { ...col, diffusee: b.diffusee, diffuseeLe: b.diffusee ? maintenant() : '' } };
    });
  }

  /* ------------------------------------------------------------------------------------- contributeur */
  /** RETEX auxquels l'utilisateur est invité (toutes collectes, ouvertes ou closes). */
  async invitations(user: SessionUser): Promise<InvitationVue[]> {
    const { data } = await this.r.lireDelegue('incidents');
    return entrees(data, 'incidents').flatMap((brut) => {
      const i = lireIncident(brut);
      const c = i?.collecte;
      const moi = c?.contributeurs.find((x) => x.id === user.id);
      return i && c && moi ? [vueInvitation(i, c, user.id)] : [];
    });
  }

  async contribution(id: string, user: SessionUser): Promise<ContributionVue> {
    const { data } = await this.r.lireDelegue('incidents');
    const { incident, collecte } = habilite(data, id, user.id);
    // Lecture vaut prise de connaissance des invitations de ce RETEX.
    await this.r.g.db.k
      .updateTable('grc_notifications')
      .set({ read_at: sql<Date>`now()` })
      .where('user_id', '=', user.id)
      .where('kind', '=', KIND)
      .where('due_key', 'like', `${id.replace(/[\\%_]/g, '\\$&')}:%`)
      .where('read_at', 'is', null)
      .execute();
    return {
      invitation: vueInvitation(incident, collecte, user.id),
      propositions: collecte.propositions.filter((p) => p.auteurId === user.id),
      chronologie: collecte.diffusee && collecte.statut === 'cloturee' ? incident.timeline : null,
    };
  }

  proposer(id: string, input: unknown, user: SessionUser, ip: string): Promise<ContributionVue> {
    const b = PropositionRetexSaisie.parse(input);
    return this.ecrireContributeur(user, ip, 'retex.proposal-added', id, (i, col) => {
      const props = listeObjets(col.propositions);
      if (props.length >= MAX_PROPOSITIONS_RETEX) throw new HttpError(409, 'Nombre maximal de propositions atteint.');
      const pid = identifiantProposition(
        props.map((p) => str(p.id)),
        typeof col.propositionsSeq === 'number' ? col.propositionsSeq : 0,
      );
      const p = {
        id: pid,
        auteurId: user.id,
        auteurNom: nomDe(user),
        soumisLe: maintenant(),
        statut: 'en_attente',
        motif: '',
        evenementId: '',
        traiteLe: '',
        description: '',
        acteur: '',
        gravite: '',
        ...b,
      };
      return { ...i, retexCollecte: { ...col, propositionsSeq: Number(pid.slice(3)), propositions: [...props, p] } };
    });
  }

  modifierProposition(id: string, pid: string, input: unknown, user: SessionUser, ip: string) {
    const b = PropositionRetexModification.parse(input);
    return this.ecrireContributeur(user, ip, 'retex.proposal-updated', id, (i, col) => {
      const props = listeObjets(col.propositions);
      this.propre(col, pid, user.id);
      return { ...i, retexCollecte: { ...col, propositions: props.map((p) => (p.id === pid ? { ...p, ...b } : p)) } };
    });
  }

  retirerProposition(id: string, pid: string, user: SessionUser, ip: string) {
    return this.ecrireContributeur(user, ip, 'retex.proposal-withdrawn', id, (i, col) => {
      this.propre(col, pid, user.id);
      return {
        ...i,
        retexCollecte: { ...col, propositions: listeObjets(col.propositions).filter((p) => p.id !== pid) },
      };
    });
  }

  terminer(id: string, input: unknown, user: SessionUser, ip: string) {
    const b = ContributionTerminee.parse(input);
    return this.ecrireContributeur(
      user,
      ip,
      b.terminee ? 'retex.contribution-done' : 'retex.contribution-resumed',
      id,
      (i, col) => ({
        ...i,
        retexCollecte: {
          ...col,
          contributeurs: listeObjets(col.contributeurs).map((x) =>
            x.id === user.id ? { ...x, termineLe: b.terminee ? maintenant() : '' } : x,
          ),
        },
      }),
    );
  }

  /* ----------------------------------------------------------------------------------------- interne */
  /** Écriture du pilote (droit incidents:modifier) sur l'incident `id`. */
  private ecrire(
    user: SessionUser,
    ip: string,
    action: string,
    id: string,
    f: (i: JsonObject, c: Client) => JsonObject | Promise<JsonObject>,
  ): Promise<Incident & { importes?: number }> {
    return this.r.modifier(
      user,
      ip,
      { module: 'incidents', action, reference: () => `legacy:incidents:${id}` },
      async (data, c) => {
        const { importes, ...suivant } = await f(trouver(data, id), c);
        remplacerEntree(data, 'incidents', id, suivant);
        return { ...lireIncident(suivant)!, ...(typeof importes === 'number' ? { importes } : {}) };
      },
    );
  }

  /** Écriture d'un contributeur : habilitation vérifiée sous verrou, collecte ouverte exigée. */
  private ecrireContributeur(
    user: SessionUser,
    ip: string,
    action: string,
    id: string,
    f: (i: JsonObject, col: JsonObject) => JsonObject,
  ): Promise<ContributionVue> {
    return this.r.modifierDelegue(
      user,
      ip,
      { module: 'incidents', action, reference: () => `legacy:incidents:${id}:retex` },
      (data) => {
        const { collecte } = habilite(data, id, user.id);
        if (collecte.statut !== 'ouverte') throw new HttpError(409, 'La collecte de ce RETEX est close.');
      },
      (data) => {
        const i = trouver(data, id);
        const suivant = f(i, collecteBrute(i));
        remplacerEntree(data, 'incidents', id, suivant);
        const incident = lireIncident(suivant)!;
        const collecte = incident.collecte!;
        return {
          invitation: vueInvitation(incident, collecte, user.id),
          propositions: collecte.propositions.filter((p) => p.auteurId === user.id),
          chronologie: null,
        };
      },
    );
  }

  /** Proposition de l'utilisateur, encore modifiable (en attente, collecte ouverte). */
  private propre(col: JsonObject, pid: string, uid: string) {
    const c = lireCollecteRetex(col)!;
    const p = c.propositions.find((x) => x.id === pid);
    // Une proposition d'un autre contributeur est traitée comme absente : rien n'en est révélé.
    if (!p || p.auteurId !== uid) throw new HttpError(404, 'Proposition absente.');
    if (!propositionModifiable(c, p, uid)) throw new HttpError(409, 'Proposition déjà traitée par le pilote.');
  }

  private async comptes(c: Client, ids: string[]) {
    return surConnexion(c)
      .selectFrom('users as u')
      .leftJoin('user_groups as ug', 'ug.user_id', 'u.id')
      .leftJoin('groups as g', 'g.id', 'ug.group_id')
      .select([
        sql<string>`u.id::text`.as('id'),
        sql<string>`coalesce(nullif(u.display_name, ''), u.username)`.as('nom'),
        sql<string>`coalesce(string_agg(g.name, ', ' ORDER BY lower(g.name)), '')`.as('pole'),
      ])
      .where(actif)
      .where('u.id', 'in', ids)
      .groupBy('u.id')
      .orderBy(sql`lower(coalesce(nullif(u.display_name, ''), u.username))`)
      .execute();
  }

  /** Notification « retex_contribution » : titre sans donnée métier (repris dans le courriel). */
  private async notifier(c: Client, id: string, envoi: number, uids: string[], nature: 'invitation' | 'relance') {
    const k = surConnexion(c);
    const emises: NotificationEmise[] = [];
    for (const uid of uids) {
      const r = await k
        .insertInto('grc_notifications')
        .values({
          smsi_id: null,
          object_id: null,
          user_id: uid,
          kind: KIND,
          due_key: `${id}:${envoi}`,
          title: (nature === 'invitation'
            ? `RETEX de l’incident ${id} : votre contribution est demandée`
            : `RETEX de l’incident ${id} : relance de votre contribution`
          ).slice(0, 180),
          message: 'Ajoutez vos éléments dans Mes contributions RETEX.',
        })
        .returning(sql<string>`id::text`.as('id'))
        .executeTakeFirstOrThrow();
      emises.push({ id: r.id, userId: uid, kind: KIND });
    }
    await this.r.g.notificationsMetier?.diffuser(c, emises);
  }
}

/* --------------------------------------------------------------------------------------------- outils */
function trouver(data: JsonObject, id: string): JsonObject {
  const t = entrees(data, 'incidents').filter((x) => x.id === id);
  if (t.length > 1) throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
  if (!t[0]) throw new HttpError(404, 'Incident absent.');
  return t[0];
}
const listeObjets = (v: unknown): JsonObject[] => (Array.isArray(v) ? v.filter(isObject) : []);
const chronologieBrute = (i: JsonObject): Json[] => (Array.isArray(i.timeline) ? [...i.timeline] : []);
function collecteBrute(i: JsonObject): JsonObject {
  const col = i.retexCollecte;
  if (!isObject(col) || !lireCollecteRetex(col)) throw new HttpError(409, 'Aucun RETEX ouvert pour cet incident.');
  return { ...col };
}
function collecteOuverte(i: JsonObject): JsonObject {
  const col = collecteBrute(i);
  if (str(col.statut) === 'cloturee') throw new HttpError(409, 'La collecte est close : rouvrez-la d’abord.');
  return col;
}
/** Habilitation d'un contributeur ; 404 identique pour un incident absent, sans RETEX ou sans invitation (rien n'est révélé). */
function habilite(data: JsonObject, id: string, uid: string): { incident: Incident; collecte: CollecteRetex } {
  const brut = entrees(data, 'incidents').filter((x) => x.id === id);
  const incident = brut.length === 1 ? lireIncident(brut[0]) : null;
  const collecte = incident?.collecte;
  if (!incident || !collecte || !collecte.contributeurs.some((x) => x.id === uid))
    throw new HttpError(404, 'RETEX introuvable.');
  return { incident, collecte };
}
function vueInvitation(i: Incident, c: CollecteRetex, uid: string): InvitationVue {
  const moi = c.contributeurs.find((x) => x.id === uid);
  return {
    incidentId: i.id,
    titre: i.title,
    piloteNom: c.piloteNom,
    consigne: c.consigne,
    echeance: c.echeance,
    statut: c.statut,
    termineLe: moi?.termineLe ?? '',
    diffusee: c.diffusee && c.statut === 'cloturee',
    propositions: c.propositions.filter((p) => p.auteurId === uid).length,
  };
}
