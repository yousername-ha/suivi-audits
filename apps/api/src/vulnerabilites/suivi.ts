/* Module Vulnérabilités (ADR 0100, point 10 ; lot V4b) : suivi d'une faille. Deux objets suivis : un constat de Tenable (un
   contrôle, pour une instance) et une faille déclarée (un rapprochement entre un produit surveillé et une CVE).
   - État décidé par une personne (`vulnerabilites:modifier`, If-Match sur la version du suivi) : à traiter, en cours,
     corrigée, risque accepté (note obligatoire, date de revue facultative), non concernée (note obligatoire). « Nouvelle »
     est l'état initial : sans ligne de suivi, l'objet est nouveau. Chaque changement entre à l'historique, en ajout seul, dans
     la même transaction que l'état courant.
   - Droits : un objet suivi n'est lisible que s'il touche au moins une machine que la personne peut lire (périmètre). Décider
     vaut pour toute l'organisation : il faut en plus pouvoir lire TOUTES les machines touchées (constat : machines où il est
     présent, à défaut celles où il a été vu en dernier ; faille déclarée : machines reliées au produit). Sinon, refus.
   - Actions du registre existant : création par le service du registre (registreDeCreation, normalize, insert), SOUS
     L'IDENTITÉ ET AVEC LES DROITS de la personne (droit du module des actions, écriture sur le périmètre choisi), dans la
     transaction du lien ; justification portant la mention de l'origine. La description porte en plus les actifs touchés
     (V30, remplace le choix initial du lot) : noms des machines que la personne peut lire, rangées par rang (20 au plus,
     puis « et N autres » avec le renvoi à la faille ; jamais d'adresse), et applications touchées (produit surveillé avec
     sa version, sinon nom du contrôle). Une action proposée par l'assistant puis confirmée passe par la même création
     (creerActionProposee), dans la transaction de la décision. Relier une action
     existante que la personne peut lire ; délier. Créer ou relier fait passer une faille « nouvelle » à « à traiter » ; la
     clôture d'une action ne change jamais l'état de la faille.
   - Proposition « corrigée » : la plateforme ne fait que proposer. Après une synchronisation complète, un constat qui n'est
     plus présent nulle part est « corrigé selon Tenable, à confirmer » ; un rapprochement qui n'est plus rattaché aussi. Une
     personne confirme (état « corrigée ») ou refuse avec une note. Une faille « corrigée » qui réapparaît repasse « à
     traiter », avec une entrée « réapparue » dont l'auteur est le système.
   Lot S1 (décision du RSSI du 18/11/2026) : un risque accepté est une EXCEPTION. L'accorder, la prolonger (même état,
   nouvelle échéance) ou la lever (tout autre état) est réservé au rôle « RSSI » de la plateforme (rssi.ts ; 403 sinon,
   administrateur compris), en plus du droit de modifier et de la lecture de toutes les machines touchées. Elle exige une
   justification (la note), une mesure compensatoire et une échéance (la date de revue du lot V4b) d'au plus douze mois. À
   l'échéance passée, la plateforme l'expire (expirerExceptions, au tic de l'API) : la faille revient à l'état d'avant
   l'exception (« à traiter » ou « en cours »), sinon « à traiter », son délai de correction repart de l'expiration, et
   l'événement « expiration » entre à l'historique. Lever une exception fait aussi repartir le délai ; une faille corrigée
   qui réapparaît aussi. Au passage à « corrigée », la priorité, le point de départ, la fin et l'échéance du délai sont
   relevés à l'historique (mesure des délais) ; la fin est la date de la proposition « corrigée » quand la décision la
   confirme (la source ne voyait plus la faille), sinon la date de la décision.
   Journal `vulnerabilites.suivi.*` : identifiants internes et états seulement ; ni nom ni adresse de machine, ni la note
   (texte libre, gardé à l'historique), ni la mesure compensatoire, ni la description de l'action. */
import {
  type ActifsTouches,
  type DelaiFailleDto,
  echeanceMaxException,
  etatApresExpiration,
  EXCEPTION_RESERVEE,
  type ExceptionSuiviDto,
  refusEcheanceException,
  RAPPEL_EXCEPTION_JOURS,
  statutException,
  ACTIFS_MACHINES_MAX,
  type ActionLieeDto,
  blocActifsTouches,
  descriptionAvecActifs,
  type MachineDto,
  ChangementEtatSuivi,
  CreationActionSuivi,
  type EntreeHistoriqueSuiviDto,
  type EtatSuiviFaille,
  type EvenementSuivi,
  type FiltreSuivi,
  LienActionSuivi,
  mentionOrigineAction,
  type NatureSuivi,
  preremplirAction,
  type PropositionSuivi,
  RefusPropositionSuivi,
  refusChangementSuivi,
  registreKindOf,
  type SourceAction,
  type SuiviDto,
  type SuiviResumeDto,
} from '@suivi/shared';
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { tientLeRoleRssi } from './rssi.js';
import { lisible, present } from './sql.js';

const SYSTEME = { username: 'système' };
const FUSEAU = 'Europe/Paris';
const INTROUVABLE = 'Faille introuvable ou non accessible.';
const MACHINES_NON_LISIBLES =
  'Cette faille touche des machines que vous ne pouvez pas lire : la décision vaut pour toute l’organisation et revient à une personne qui les voit toutes.';
const ACTION_INTROUVABLE = 'Action introuvable ou non accessible.';
const HISTORIQUE_MAX = 200;
export const aujourdhui = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(d);

/* ---------------------------------------------------------------- Fragments communs aux listes (failles.ts) */
/** Colonnes du suivi résumé, sur l'alias `s` (vulnerabilites_suivis, en jointure externe). */
export const colonnesSuivi = sql`coalesce(s.etat, 'nouvelle') AS suivi_etat,
  coalesce(s.proposition, 'aucune') AS suivi_proposition, s.revue_le::text AS suivi_revue,
  coalesce(s.version, 0) AS suivi_version, s.delai_repart_le AS suivi_repart,
  coalesce(s.etat = 'risque_accepte' AND s.revue_le < (now() AT TIME ZONE ${FUSEAU})::date, false) AS suivi_revue_depassee,
  (SELECT count(*)::int FROM vulnerabilites_suivi_actions sa WHERE sa.suivi_id = s.id) AS suivi_actions`;

export interface LigneSuivi {
  suivi_etat: EtatSuiviFaille;
  suivi_proposition: PropositionSuivi;
  suivi_revue: string | null;
  suivi_version: number;
  suivi_revue_depassee: boolean;
  suivi_actions: number;
  /** Lot S1 : reprise du délai de correction (fin d'une exception, réapparition). */
  suivi_repart: Date | null;
}

export const versSuiviResume = (l: LigneSuivi, jour = aujourdhui()): SuiviResumeDto => ({
  etat: l.suivi_etat,
  proposition: l.suivi_proposition,
  revueLe: l.suivi_revue,
  revueDepassee: l.suivi_revue_depassee,
  exceptionStatut: l.suivi_etat === 'risque_accepte' ? statutException(l.suivi_revue, jour) : null,
  nombreActions: l.suivi_actions,
  version: l.suivi_version,
});

/** Filtre de suivi d'une liste (alias `s`). `rapportee` : la source rapporte encore la faille. Par défaut : failles encore à
    traiter, hors propositions « corrigée » à confirmer ; une faille qui n'est plus rapportée n'est listée que si elle a un
    suivi (décision, proposition). */
export function filtreSuivi(f: FiltreSuivi | undefined, rapportee: RawBuilder<boolean>): RawBuilder<boolean> {
  const base = sql<boolean>`(${rapportee} OR s.id IS NOT NULL)`;
  if (f === 'a_clore') return sql<boolean>`(s.proposition = 'a_confirmer')`;
  if (f === 'tous') return base;
  if (f) return sql<boolean>`(${base} AND coalesce(s.etat, 'nouvelle') = ${f})`;
  return sql<boolean>`(${base} AND coalesce(s.etat, 'nouvelle') IN ('nouvelle', 'a_traiter', 'en_cours')
    AND coalesce(s.proposition, 'aucune') <> 'a_confirmer')`;
}

/** La faille de l'alias (constat `c` ou rapprochement `r`) est close : elle sort des compteurs et du rang des machines. */
export const close = (nature: NatureSuivi): RawBuilder<boolean> =>
  nature === 'constat'
    ? sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_suivis sc WHERE sc.constat_id = c.id
        AND sc.etat IN ('corrigee', 'risque_accepte', 'non_concernee'))`
    : sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_suivis sc WHERE sc.rapprochement_id = r.id
        AND sc.etat IN ('corrigee', 'risque_accepte', 'non_concernee'))`;

/** Lot PRIO-1 : le constat `c` ou la faille déclarée `r` est sous exception (état « risque accepté »). */
export const sousException = (nature: NatureSuivi): RawBuilder<boolean> =>
  nature === 'constat'
    ? sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_suivis sc WHERE sc.constat_id = c.id AND sc.etat = 'risque_accepte')`
    : sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_suivis sc WHERE sc.rapprochement_id = r.id
        AND sc.etat = 'risque_accepte')`;

/* ---------------------------------------------------------------- Types internes */
interface ObjetSuivi {
  /** Au moins une machine touchée est lisible. */
  visible: boolean;
  /** Toutes les machines touchées sont lisibles (vrai s'il n'y en a aucune). */
  toutes: boolean;
  /** La source rapporte encore la faille. */
  present: boolean;
  source: SourceAction;
}

interface LigneEtat {
  id: string;
  etat: EtatSuiviFaille;
  proposition: PropositionSuivi;
  absente: boolean;
  revue_le: string | null;
  version: number;
  maj_le: Date | null;
  maj_par: string | null;
  exception_justification: string | null;
  exception_mesure: string | null;
  exception_par: string | null;
  exception_le: Date | null;
  exception_etat_avant: EtatSuiviFaille | null;
}

/** Délai relevé au passage à « corrigée » (mesure des délais, lot S1). */
export type DelaiObjet = Pick<DelaiFailleDto, 'priorite' | 'depuis' | 'echeance'>;

const colonne = (nature: NatureSuivi) => (nature === 'constat' ? 'constat_id' : 'rapprochement_id');

export class SuiviFailles {
  /** Machines lisibles rangées par rang (FaillesDetectees.machinesRangees), branché par les services : ordre des machines
      nommées dans une action (V30). Absent, l'ordre est celui des noms. */
  rangs?: (user: SessionUser) => Promise<MachineDto[]>;
  /** Délai de correction d'un objet (priorité courante, point de départ, échéance), branché par les services (délais.ts) :
      relevé à l'historique au passage à « corrigée ». Absent, rien n'est relevé. */
  delaiObjet?: (k: Kdb, nature: NatureSuivi, id: string) => Promise<DelaiObjet | null>;

  constructor(
    private readonly db: Db,
    private readonly g: Grc,
  ) {}

  /* ---------------------------------------------------------------- Objet suivi et droits */
  /** Objet suivi vu par la personne, ou null s'il n'existe pas. */
  private async objet(k: Kdb, user: SessionUser, nature: NatureSuivi, id: string): Promise<ObjetSuivi | null> {
    if (nature === 'constat') {
      const c = await k
        .selectFrom('vulnerabilites_constats')
        .select(['plugin_id', 'nom', 'correctif'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!c) return null;
      // Machines touchées : celles où le constat est présent ; s'il ne l'est plus nulle part, celles où il a été vu.
      const { rows } = await sql<{ present: boolean; visible: boolean; toutes: boolean }>`
        WITH x AS (
          SELECT DISTINCT d.machine_id, ${present} AS present, ${lisible(user)} AS lisible
          FROM vulnerabilites_detections d
          JOIN vulnerabilites_machines m ON m.id = d.machine_id
          LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
          WHERE d.constat_id = ${id}::uuid),
        p AS (SELECT coalesce(bool_or(present), false) AS present FROM x)
        SELECT p.present, coalesce(bool_or(x.lisible), false) AS visible, coalesce(bool_and(x.lisible), true) AS toutes
        FROM p LEFT JOIN x ON (x.present OR NOT p.present)
        GROUP BY p.present`.execute(k);
      const r = rows[0]!;
      return {
        ...r,
        source: { nature: 'constat', plugin: String(c.plugin_id), nom: c.nom, correctif: c.correctif },
      };
    }
    const { rows } = await sql<{
      statut: string;
      cve: string;
      editeur: string;
      nom: string;
      version_produit: string;
      kev_action: string | null;
      suivi: boolean;
      visible: boolean;
      toutes: boolean;
    }>`
      SELECT r.statut, r.cve, p.editeur, p.nom, p.version_produit, v.kev_action,
             EXISTS (SELECT 1 FROM vulnerabilites_suivis s WHERE s.rapprochement_id = r.id) AS suivi,
             coalesce((SELECT bool_or(${lisible(user)}) FROM vulnerabilites_produits_machines pm
                       JOIN vulnerabilites_machines m ON m.id = pm.machine_id WHERE pm.produit_id = p.id), false) AS visible,
             coalesce((SELECT bool_and(${lisible(user)}) FROM vulnerabilites_produits_machines pm
                       JOIN vulnerabilites_machines m ON m.id = pm.machine_id WHERE pm.produit_id = p.id), true) AS toutes
      FROM vulnerabilites_rapprochements r
      JOIN vulnerabilites_produits p ON p.id = r.produit_id
      JOIN vulnerabilites_veille_cve v ON v.cve = r.cve
      WHERE r.id = ${id}::uuid`.execute(k);
    const r = rows[0];
    if (!r) return null;
    const rattachee = r.statut === 'rattachee' || r.statut === 'confirmee';
    return {
      // Une CVE jamais rattachée (proposée, écartée…) n'est pas une faille déclarée, sauf si elle a déjà un suivi.
      visible: r.visible && (rattachee || r.suivi),
      toutes: r.toutes,
      present: rattachee,
      source: {
        nature: 'declaree',
        cve: r.cve,
        produit: { editeur: r.editeur, nom: r.nom, versionProduit: r.version_produit },
        actionKev: r.kev_action,
      },
    };
  }

  /** Objet lisible, sinon 404. */
  private async lisibleOu404(k: Kdb, user: SessionUser, nature: NatureSuivi, id: string): Promise<ObjetSuivi> {
    const o = await this.objet(k, user, nature, id);
    if (!o?.visible) throw new HttpError(404, INTROUVABLE);
    return o;
  }

  /** L'objet existe et la personne le lit (au moins une machine touchée lisible). */
  async estLisible(user: SessionUser, nature: NatureSuivi, id: string): Promise<boolean> {
    return !!(await this.objet(this.db.k, user, nature, id))?.visible;
  }

  /** Actifs touchés par la faille (V30), dans la limite de ce que la personne peut lire : machines touchées (constat :
      où il est présent, à défaut où il a été vu en dernier ; faille déclarée : machines reliées au produit), rangées par
      rang ; applications touchées : produit surveillé avec sa version (faille déclarée, ou produits rattachés aux CVE du
      constat), sinon nom du contrôle. */
  async actifs(k: Kdb, user: SessionUser, nature: NatureSuivi, id: string): Promise<ActifsTouches> {
    const { rows: machines } =
      nature === 'constat'
        ? await sql<{ id: string; nom: string | null }>`
            WITH x AS (
              SELECT DISTINCT d.machine_id, m.nom, ${present} AS present, ${lisible(user)} AS lisible
              FROM vulnerabilites_detections d
              JOIN vulnerabilites_machines m ON m.id = d.machine_id
              LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
              WHERE d.constat_id = ${id}::uuid)
            SELECT DISTINCT x.machine_id AS id, x.nom FROM x
            WHERE x.lisible AND (x.present OR NOT EXISTS (SELECT 1 FROM x y WHERE y.present))`.execute(k)
        : await sql<{ id: string; nom: string | null }>`
            SELECT DISTINCT m.id, m.nom FROM vulnerabilites_rapprochements r
            JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id
            JOIN vulnerabilites_machines m ON m.id = pm.machine_id
            WHERE r.id = ${id}::uuid AND ${lisible(user)}`.execute(k);
    const rang = new Map(((await this.rangs?.(user)) ?? []).map((m) => [m.id, m.rang.position]));
    const ordonnees = [...machines].sort(
      (a, b) =>
        (rang.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rang.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        (a.nom ?? '').localeCompare(b.nom ?? '') ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const nommees = ordonnees.filter((m) => m.nom).map((m) => m.nom!);
    let applications: string[];
    let renvoi: string;
    if (nature === 'constat') {
      const c = await k
        .selectFrom('vulnerabilites_constats')
        .select(['plugin_id', 'nom'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      const { rows } = await sql<{ produit: string }>`
        SELECT DISTINCT p.editeur || ' ' || p.nom || CASE WHEN p.version_produit <> '' THEN ' ' || p.version_produit ELSE '' END
          AS produit
        FROM vulnerabilites_constat_cves cc
        JOIN vulnerabilites_rapprochements r ON r.cve = cc.cve AND r.statut IN ('rattachee', 'confirmee')
        JOIN vulnerabilites_produits p ON p.id = r.produit_id
        WHERE cc.constat_id = ${id}::uuid ORDER BY 1`.execute(k);
      applications = rows.length ? rows.map((r) => r.produit) : [c.nom];
      renvoi = `contrôle n° ${c.plugin_id} de Tenable Security Center`;
    } else {
      const { rows } = await sql<{ cve: string; produit: string }>`
        SELECT r.cve, p.editeur || ' ' || p.nom || CASE WHEN p.version_produit <> '' THEN ' ' || p.version_produit ELSE '' END
          AS produit
        FROM vulnerabilites_rapprochements r JOIN vulnerabilites_produits p ON p.id = r.produit_id
        WHERE r.id = ${id}::uuid`.execute(k);
      applications = rows.map((r) => r.produit);
      renvoi = rows[0]?.cve ?? '';
    }
    return {
      machines: nommees.slice(0, ACTIFS_MACHINES_MAX),
      autres: Math.max(0, nommees.length - ACTIFS_MACHINES_MAX),
      sansNom: ordonnees.length - nommees.length,
      applications,
      renvoi,
    };
  }

  /** Objet sur lequel la personne peut décider : lisible, et toutes ses machines touchées lisibles. */
  private async decidable(k: Kdb, user: SessionUser, nature: NatureSuivi, id: string): Promise<ObjetSuivi> {
    const o = await this.lisibleOu404(k, user, nature, id);
    if (!o.toutes) throw new HttpError(403, MACHINES_NON_LISIBLES);
    return o;
  }

  /** Ligne de suivi de l'objet, créée au besoin (état « nouvelle », version 0), verrouillée jusqu'à la fin de la transaction. */
  private async verrouiller(k: Kdb, nature: NatureSuivi, id: string): Promise<LigneEtat> {
    await k
      .insertInto('vulnerabilites_suivis')
      .values({ nature, [colonne(nature)]: id })
      .onConflict((oc) => oc.doNothing())
      .execute();
    return this.ligne(k, nature, id, true) as Promise<LigneEtat>;
  }

  private async ligne(k: Kdb, nature: NatureSuivi, id: string, verrou = false): Promise<LigneEtat | undefined> {
    let q = k
      .selectFrom('vulnerabilites_suivis')
      .select([
        'id',
        sql<EtatSuiviFaille>`etat`.as('etat'),
        sql<PropositionSuivi>`proposition`.as('proposition'),
        'absente',
        sql<string | null>`revue_le::text`.as('revue_le'),
        'version',
        'maj_le',
        'maj_par',
        'exception_justification',
        'exception_mesure',
        'exception_par',
        'exception_le',
        sql<EtatSuiviFaille | null>`exception_etat_avant`.as('exception_etat_avant'),
      ])
      .where(colonne(nature), '=', id);
    if (verrou) q = q.forUpdate();
    return q.executeTakeFirst();
  }

  private async historiser(
    k: Kdb,
    nature: NatureSuivi,
    objetId: string,
    e: {
      evenement: EvenementSuivi;
      avant: EtatSuiviFaille | null;
      apres: EtatSuiviFaille;
      note?: string;
      revueLe?: string | null;
      mesure?: string | null;
      delai?: (DelaiObjet & { fin: string }) | null;
      auteur: { id?: string; username: string };
    },
  ) {
    await k
      .insertInto('vulnerabilites_suivi_historique')
      .values({
        nature,
        objet_id: objetId,
        evenement: e.evenement,
        etat_avant: e.avant,
        etat_apres: e.apres,
        note: e.note ?? '',
        revue_le: e.revueLe ?? null,
        mesure: e.mesure || null,
        priorite: e.delai?.priorite ?? null,
        delai_depuis: e.delai?.depuis ?? null,
        delai_fin: e.delai?.fin ?? null,
        delai_echeance: e.delai?.echeance ?? null,
        auteur: e.auteur.username,
        auteur_id: e.auteur.id ?? null,
      })
      .execute();
  }

  /* ---------------------------------------------------------------- Lecture */
  async lire(user: SessionUser, nature: NatureSuivi, id: string): Promise<SuiviDto> {
    const k = this.db.k;
    const o = await this.lisibleOu404(k, user, nature, id);
    const s = await this.ligne(k, nature, id);
    const historique = await k
      .selectFrom('vulnerabilites_suivi_historique')
      .select([
        'id',
        sql<EvenementSuivi>`evenement`.as('evenement'),
        sql<EtatSuiviFaille | null>`etat_avant`.as('etat_avant'),
        sql<EtatSuiviFaille>`etat_apres`.as('etat_apres'),
        'note',
        sql<string | null>`revue_le::text`.as('revue_le'),
        'mesure',
        'auteur',
        'cree_le',
      ])
      .where('nature', '=', nature)
      .where('objet_id', '=', id)
      .orderBy('cree_le', 'desc')
      .orderBy('id', 'desc')
      .limit(HISTORIQUE_MAX)
      .execute();
    const actions = s ? await this.actionsLiees(user, s.id) : [];
    const modifier = user.rights.can('vulnerabilites', 'modifier');
    const jour = aujourdhui();
    const exception: ExceptionSuiviDto | null =
      s?.etat === 'risque_accepte'
        ? {
            statut: statutException(s.revue_le, jour),
            echeance: s.revue_le,
            justification: s.exception_justification,
            mesure: s.exception_mesure,
            par: s.exception_par,
            le: s.exception_le?.toISOString() ?? null,
          }
        : null;
    return {
      nature,
      objetId: id,
      present: o.present,
      etat: s?.etat ?? 'nouvelle',
      proposition: s?.proposition ?? 'aucune',
      revueLe: s?.revue_le ?? null,
      revueDepassee: s?.etat === 'risque_accepte' && !!s.revue_le && s.revue_le < jour,
      exceptionStatut: exception?.statut ?? null,
      exception,
      peutDeciderException: modifier && o.toutes && (await tientLeRoleRssi(this.db, user)),
      aujourdhui: jour,
      echeanceMax: echeanceMaxException(jour),
      nombreActions: actions.length,
      version: s?.version ?? 0,
      majLe: s?.maj_le?.toISOString() ?? null,
      majPar: s?.maj_par ?? null,
      historique: historique.map((h): EntreeHistoriqueSuiviDto => ({
        id: h.id,
        evenement: h.evenement,
        etatAvant: h.etat_avant,
        etatApres: h.etat_apres,
        note: h.note,
        revueLe: h.revue_le,
        mesure: h.mesure,
        auteur: h.auteur,
        le: h.cree_le.toISOString(),
      })),
      actions,
      peutDecider: modifier && o.toutes,
      motifRefus: !modifier
        ? 'Décider demande le droit de modifier les vulnérabilités.'
        : o.toutes
          ? null
          : MACHINES_NON_LISIBLES,
      preremplissage: preremplirAction(o.source),
      actifsAction: blocActifsTouches(await this.actifs(k, user, nature, id)),
    };
  }

  /** Actions liées ; détails seulement pour celles que la personne peut lire (droit du module des actions, périmètre ou
      registre), état lu dans la politique du périmètre de l'action. */
  private async actionsLiees(user: SessionUser, suiviId: string): Promise<ActionLieeDto[]> {
    const liens = await this.db.k
      .selectFrom('vulnerabilites_suivi_actions')
      .select(['action_id', 'relie_le'])
      .where('suivi_id', '=', suiviId)
      .orderBy('relie_le')
      .orderBy('action_id')
      .execute();
    const out: ActionLieeDto[] = [];
    for (const l of liens) {
      const brut = await this.g.raw(l.action_id);
      const lue = brut ? await this.g.object(brut.smsiId, brut.id, user).catch(() => null) : null;
      if (!lue) {
        out.push({ lisible: false, relieLe: l.relie_le.toISOString() });
        continue;
      }
      const statut = typeof lue.data.status === 'string' ? lue.data.status : '';
      const def = (await this.g.politiqueDe(lue.smsiId)).definition.statuses.find((x) => x.id === statut);
      out.push({
        lisible: true,
        id: lue.id,
        perimetreId: lue.smsiId,
        nom: lue.name,
        statut,
        statutLibelle: def?.label ?? statut,
        terminee: def?.terminal ?? false,
        archivee: lue.archived,
        echeance: typeof lue.data.dueAt === 'string' ? lue.data.dueAt : null,
        relieLe: l.relie_le.toISOString(),
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- Décisions (vulnerabilites:modifier) */
  async changerEtat(
    nature: NatureSuivi,
    id: string,
    corps: unknown,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<SuiviDto> {
    const b = ChangementEtatSuivi.parse(corps);
    // Accorder ou prolonger une exception : rôle RSSI, vérifié avant toute lecture (lot S1).
    if (b.etat === 'risque_accepte' && !(await tientLeRoleRssi(this.db, user)))
      throw new HttpError(403, EXCEPTION_RESERVEE);
    await this.db.tx(async (c, k) => {
      await this.decidable(k, user, nature, id);
      const s = await this.verrouiller(k, nature, id);
      if (s.version !== attendue) throw conflict({ version: s.version, updated_by: s.maj_par ?? '' });
      // Lever une exception (quitter le risque accepté) : rôle RSSI aussi.
      if (s.etat === 'risque_accepte' && b.etat !== 'risque_accepte' && !(await tientLeRoleRssi(this.db, user, c)))
        throw new HttpError(403, EXCEPTION_RESERVEE);
      const refus = refusChangementSuivi(s.etat, b.etat);
      if (refus) throw new HttpError(409, refus);
      const exception = b.etat === 'risque_accepte';
      const revue = exception ? (b.revueLe ?? null) : null;
      if (exception) {
        const motif = refusEcheanceException(revue, aujourdhui());
        if (motif) throw new HttpError(422, motif);
      }
      const confirme = b.etat === 'corrigee' && s.proposition === 'a_confirmer';
      // Mesure des délais : délai relevé avant la décision ; fin à la proposition « corrigée » qu'elle confirme.
      let delai: (DelaiObjet & { fin: string }) | null = null;
      if (b.etat === 'corrigee' && this.delaiObjet) {
        const d = await this.delaiObjet(k, nature, id);
        const proposee = confirme
          ? (
              await k
                .selectFrom('vulnerabilites_suivi_historique')
                .select((eb) => eb.fn.max('cree_le').as('le'))
                .where('nature', '=', nature)
                .where('objet_id', '=', id)
                .where('evenement', '=', 'proposition')
                .executeTakeFirst()
            )?.le
          : null;
        if (d?.depuis) delai = { ...d, fin: (proposee ? new Date(proposee) : new Date()).toISOString() };
      }
      const leve = s.etat === 'risque_accepte' && !exception;
      await k
        .updateTable('vulnerabilites_suivis')
        .set({
          etat: b.etat,
          revue_le: revue,
          // Confirmer « corrigée » clôt la proposition ; un autre état la laisse telle quelle.
          proposition: b.etat === 'corrigee' ? 'aucune' : s.proposition,
          ...(exception
            ? {
                exception_justification: b.note,
                exception_mesure: b.mesure ?? null,
                exception_par: user.displayName || user.username,
                exception_le: sql<Date>`now()`,
                // Une prolongation garde l'état d'avant l'exception d'origine.
                exception_etat_avant: s.etat === 'risque_accepte' ? s.exception_etat_avant : s.etat,
                exception_rappel_le: null,
              }
            : {
                exception_justification: null,
                exception_mesure: null,
                exception_par: null,
                exception_le: null,
                exception_etat_avant: null,
                exception_rappel_le: null,
              }),
          // Lever une exception fait repartir le délai de correction.
          ...(leve ? { delai_repart_le: sql<Date>`now()` } : {}),
          version: s.version + 1,
          maj_le: sql<Date>`now()`,
          maj_par: user.username,
        })
        .where('id', '=', s.id)
        .execute();
      await this.historiser(k, nature, id, {
        evenement: 'changement',
        avant: s.etat,
        apres: b.etat,
        note: b.note,
        revueLe: revue,
        mesure: exception ? b.mesure : null,
        delai,
        auteur: user,
      });
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.suivi.etat_modifie',
        s.id,
        {
          nature,
          objet: id,
          avant: s.etat,
          apres: b.etat,
          revueLe: revue,
          propositionConfirmee: confirme,
          ...(exception ? { exception: s.etat === 'risque_accepte' ? 'prolongee' : 'accordee' } : {}),
          ...(leve ? { exception: 'levee' } : {}),
          ...(delai ? { priorite: delai.priorite } : {}),
        },
        c,
      );
    }, user.username);
    return this.lire(user, nature, id);
  }

  /** Refus de la proposition « corrigée » : note obligatoire ; l'état ne change pas. */
  async refuserProposition(
    nature: NatureSuivi,
    id: string,
    corps: unknown,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<SuiviDto> {
    const b = RefusPropositionSuivi.parse(corps);
    await this.db.tx(async (c, k) => {
      await this.decidable(k, user, nature, id);
      const s = await this.verrouiller(k, nature, id);
      if (s.version !== attendue) throw conflict({ version: s.version, updated_by: s.maj_par ?? '' });
      if (s.proposition !== 'a_confirmer') throw new HttpError(409, 'Aucune proposition « corrigée » à refuser.');
      await k
        .updateTable('vulnerabilites_suivis')
        .set({ proposition: 'refusee', version: s.version + 1, maj_le: sql<Date>`now()`, maj_par: user.username })
        .where('id', '=', s.id)
        .execute();
      await this.historiser(k, nature, id, {
        evenement: 'refus',
        avant: s.etat,
        apres: s.etat,
        note: b.note,
        auteur: user,
      });
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.suivi.proposition_refusee',
        s.id,
        { nature, objet: id, etat: s.etat },
        c,
      );
    }, user.username);
    return this.lire(user, nature, id);
  }

  /** Une action vient d'être liée : une faille « nouvelle » passe « à traiter » (historisé) ; la version augmente. */
  private async apresLien(k: Kdb, nature: NatureSuivi, id: string, s: LigneEtat, user: SessionUser) {
    const apres: EtatSuiviFaille = s.etat === 'nouvelle' ? 'a_traiter' : s.etat;
    await k
      .updateTable('vulnerabilites_suivis')
      .set({ etat: apres, version: s.version + 1, maj_le: sql<Date>`now()`, maj_par: user.username })
      .where('id', '=', s.id)
      .execute();
    if (apres !== s.etat)
      await this.historiser(k, nature, id, { evenement: 'action', avant: s.etat, apres, auteur: user });
    return apres;
  }

  /** Crée une action du registre existant, dans le périmètre choisi, sous l'identité et avec les droits de la personne. */
  async creerAction(
    nature: NatureSuivi,
    id: string,
    corps: unknown,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<SuiviDto> {
    const b = CreationActionSuivi.parse(corps);
    await this.db.tx(async (c, k) => {
      await this.creer(c, k, nature, id, b, attendue, user, ip, null);
    }, user.username);
    return this.lire(user, nature, id);
  }

  /** Action proposée par l'assistant puis confirmée par la personne (ADR 0100, V29) : même création que depuis la fiche,
      dans la transaction de la décision, sans If-Match (la personne décide de la proposition, pas d'une version du suivi).
      Rend l'identifiant de l'action créée. */
  async creerActionProposee(
    c: Client,
    k: Kdb,
    nature: NatureSuivi,
    id: string,
    b: CreationActionSuivi,
    user: SessionUser,
    ip: string,
    proposition: string,
  ): Promise<string> {
    return this.creer(c, k, nature, id, CreationActionSuivi.parse(b), null, user, ip, proposition);
  }

  private async creer(
    c: Client,
    k: Kdb,
    nature: NatureSuivi,
    id: string,
    b: CreationActionSuivi,
    attendue: number | null,
    user: SessionUser,
    ip: string,
    proposition: string | null,
  ): Promise<string> {
    const o = await this.decidable(k, user, nature, id);
    const s = await this.verrouiller(k, nature, id);
    if (attendue !== null && s.version !== attendue)
      throw conflict({ version: s.version, updated_by: s.maj_par ?? '' });
    // Service du registre, comme une création depuis l'écran des actions (createObject, sans registre choisi) : droit du
    // module des actions (module actif) et écriture sur le périmètre, sinon rien n'est créé.
    await this.g.registreDeCreation(c, b.perimetreId, 'action', registreKindOf('action'), null, user);
    const politique = (await this.g.politiqueDe(b.perimetreId, c)).definition;
    const statut = politique.statuses.find((x) => !x.terminal)?.id;
    const categorie = politique.catalogues.actionCategories[0]?.id;
    if (!statut || !categorie) throw new HttpError(422, 'La politique du périmètre ne permet pas de créer une action.');
    const mention = mentionOrigineAction(
      o.source.nature === 'constat'
        ? { nature: 'constat', plugin: o.source.plugin }
        : { nature: 'declaree', cve: o.source.cve },
    );
    const data = await this.g.normalize(
      b.perimetreId,
      'action',
      {
        // V30 : machines et applications touchées, dans la limite de ce que la personne peut lire.
        description: descriptionAvecActifs(b.description, blocActifsTouches(await this.actifs(k, user, nature, id))),
        status: statut,
        ownerId: null,
        startAt: null,
        dueAt: b.echeance ? `${b.echeance}T12:00:00.000Z` : null,
        priority: 'normal',
        category: categorie,
        justification: proposition
          ? `${mention} Proposée par l’assistant RSSI, confirmée par ${user.displayName || user.username}.`
          : mention,
        reminderDays: 7,
        dependencies: [],
      },
      user,
      c,
    );
    const a = await this.g.insert(c, b.perimetreId, 'action', b.titre, data, user, ip);
    await k
      .insertInto('vulnerabilites_suivi_actions')
      .values({ suivi_id: s.id, action_id: a.id, cree_ici: true, relie_par: user.username })
      .execute();
    const apres = await this.apresLien(k, nature, id, s, user);
    await this.db.audit(
      user,
      ip,
      'vulnerabilites.suivi.action_creee',
      s.id,
      {
        nature,
        objet: id,
        action: a.id,
        perimetre: b.perimetreId,
        avant: s.etat,
        apres,
        ...(proposition ? { origine: 'assistant', proposition } : {}),
      },
      c,
    );
    return a.id;
  }

  /** Relie une action existante du registre, que la personne peut lire. */
  async relierAction(
    nature: NatureSuivi,
    id: string,
    corps: unknown,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<SuiviDto> {
    const b = LienActionSuivi.parse(corps);
    await this.db.tx(async (c, k) => {
      await this.decidable(k, user, nature, id);
      const s = await this.verrouiller(k, nature, id);
      if (s.version !== attendue) throw conflict({ version: s.version, updated_by: s.maj_par ?? '' });
      const action = await this.actionLisible(c, user, b.actionId);
      if (action.archived) throw new HttpError(422, 'Cette action est archivée : elle ne se relie pas.');
      const r = await k
        .insertInto('vulnerabilites_suivi_actions')
        .values({ suivi_id: s.id, action_id: action.id, cree_ici: false, relie_par: user.username })
        .onConflict((oc) => oc.doNothing())
        .executeTakeFirst();
      if (!Number(r.numInsertedOrUpdatedRows)) throw new HttpError(409, 'Cette action est déjà liée à la faille.');
      const apres = await this.apresLien(k, nature, id, s, user);
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.suivi.action_reliee',
        s.id,
        { nature, objet: id, action: action.id, avant: s.etat, apres },
        c,
      );
    }, user.username);
    return this.lire(user, nature, id);
  }

  /** Délie une action que la personne peut lire. L'état de la faille ne change pas. */
  async delierAction(
    nature: NatureSuivi,
    id: string,
    actionId: string,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<SuiviDto> {
    await this.db.tx(async (c, k) => {
      await this.decidable(k, user, nature, id);
      const s = await this.ligne(k, nature, id, true);
      if (!s) throw new HttpError(404, 'Cette action n’est pas liée à la faille.');
      if (s.version !== attendue) throw conflict({ version: s.version, updated_by: s.maj_par ?? '' });
      const lien = await k
        .selectFrom('vulnerabilites_suivi_actions')
        .select('action_id')
        .where('suivi_id', '=', s.id)
        .where('action_id', '=', actionId)
        .executeTakeFirst();
      if (!lien) throw new HttpError(404, 'Cette action n’est pas liée à la faille.');
      await this.actionLisible(c, user, actionId);
      await k
        .deleteFrom('vulnerabilites_suivi_actions')
        .where('suivi_id', '=', s.id)
        .where('action_id', '=', actionId)
        .execute();
      await k
        .updateTable('vulnerabilites_suivis')
        .set({ version: s.version + 1, maj_le: sql<Date>`now()`, maj_par: user.username })
        .where('id', '=', s.id)
        .execute();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.suivi.action_deliee',
        s.id,
        { nature, objet: id, action: actionId },
        c,
      );
    }, user.username);
    return this.lire(user, nature, id);
  }

  /** Action du registre que la personne peut lire (périmètre ou registre, droit du module des actions), sinon 404. Un
      module des actions désactivé répond comme tel (409). */
  private async actionLisible(c: Client, user: SessionUser, actionId: string) {
    const brut = await this.g.raw(actionId, c);
    if (!brut || brut.kind !== 'action') throw new HttpError(404, ACTION_INTROUVABLE);
    try {
      return await this.g.object(brut.smsiId, brut.id, user, false, c);
    } catch (e) {
      if (e instanceof HttpError && (e.status === 403 || e.status === 404))
        throw new HttpError(404, ACTION_INTROUVABLE);
      throw e;
    }
  }

  /* ---------------------------------------------------------------- Propositions de la plateforme */
  /** La source rapporte (ou ne rapporte plus) la faille : retrait de la proposition et réapparition, ou proposition
      « corrigée ». Rend l'événement historisé, s'il y en a un. Aucun passage à « corrigée » sans une personne. */
  private async basculer(k: Kdb, nature: NatureSuivi, id: string, rapportee: boolean): Promise<EvenementSuivi | null> {
    if (!rapportee)
      await k
        .insertInto('vulnerabilites_suivis')
        .values({ nature, [colonne(nature)]: id })
        .onConflict((oc) => oc.doNothing())
        .execute();
    const s = await this.ligne(k, nature, id, true);
    if (!s) return null;
    if (rapportee) {
      if (!s.absente && s.proposition === 'aucune') return null;
      const reapparue = s.etat === 'corrigee' && s.absente;
      const evenement: EvenementSuivi | null = reapparue
        ? 'reapparition'
        : s.proposition === 'a_confirmer'
          ? 'retrait_proposition'
          : null;
      const visible = evenement !== null || s.proposition !== 'aucune';
      const apres: EtatSuiviFaille = reapparue ? 'a_traiter' : s.etat;
      await k
        .updateTable('vulnerabilites_suivis')
        .set({
          etat: apres,
          proposition: 'aucune',
          absente: false,
          // Lot S1 : une faille corrigée qui réapparaît voit son délai de correction repartir.
          ...(reapparue ? { delai_repart_le: sql<Date>`now()` } : {}),
          ...(visible ? { version: s.version + 1, maj_le: sql<Date>`now()`, maj_par: SYSTEME.username } : {}),
        })
        .where('id', '=', s.id)
        .execute();
      if (evenement) await this.historiser(k, nature, id, { evenement, avant: s.etat, apres, auteur: SYSTEME });
      return evenement;
    }
    const proposer = s.etat !== 'corrigee' && s.proposition === 'aucune';
    if (!proposer && s.absente) return null;
    await k
      .updateTable('vulnerabilites_suivis')
      .set({
        absente: true,
        ...(proposer
          ? { proposition: 'a_confirmer', version: s.version + 1, maj_le: sql<Date>`now()`, maj_par: SYSTEME.username }
          : {}),
      })
      .where('id', '=', s.id)
      .execute();
    if (!proposer) return null;
    await this.historiser(k, nature, id, { evenement: 'proposition', avant: s.etat, apres: s.etat, auteur: SYSTEME });
    return 'proposition';
  }

  /* ---------------------------------------------------------------- Exceptions à échéance (lot S1, tic de l'API) */
  /** Expire les exceptions dont l'échéance est passée (au fuseau de l'organisation) : la faille revient à l'état d'avant
      l'exception (« à traiter » ou « en cours »), sinon « à traiter » ; son délai de correction repart de l'expiration ;
      l'événement « expiration » entre à l'historique, avec l'échéance. Ensemble, en un nombre fixe de requêtes. Rend les
      exceptions expirées (identifiants internes seulement). */
  async expirerExceptions(
    k: Kdb,
    jour = aujourdhui(),
  ): Promise<{ suivi: string; nature: NatureSuivi; objet: string }[]> {
    const { rows } = await sql<{
      id: string;
      nature: NatureSuivi;
      objet: string;
      revue_le: string;
      avant: EtatSuiviFaille | null;
    }>`SELECT s.id, s.nature, coalesce(s.constat_id, s.rapprochement_id) AS objet, s.revue_le::text AS revue_le,
         s.exception_etat_avant AS avant
       FROM vulnerabilites_suivis s
       WHERE s.etat = 'risque_accepte' AND s.revue_le IS NOT NULL AND s.revue_le < ${jour}::date
       ORDER BY s.id FOR UPDATE`.execute(k);
    if (!rows.length) return [];
    for (const etat of ['a_traiter', 'en_cours'] as const) {
      const ids = rows.filter((r) => etatApresExpiration(r.avant) === etat).map((r) => r.id);
      if (!ids.length) continue;
      await k
        .updateTable('vulnerabilites_suivis')
        .set((eb) => ({
          etat,
          revue_le: null,
          exception_justification: null,
          exception_mesure: null,
          exception_par: null,
          exception_le: null,
          exception_etat_avant: null,
          exception_rappel_le: null,
          delai_repart_le: sql<Date>`now()`,
          version: eb('version', '+', 1),
          maj_le: sql<Date>`now()`,
          maj_par: SYSTEME.username,
        }))
        .where('id', 'in', ids)
        .execute();
    }
    await k
      .insertInto('vulnerabilites_suivi_historique')
      .values(
        rows.map((r) => ({
          nature: r.nature,
          objet_id: r.objet,
          evenement: 'expiration' as const,
          etat_avant: 'risque_accepte',
          etat_apres: etatApresExpiration(r.avant),
          note: '',
          revue_le: r.revue_le,
          auteur: SYSTEME.username,
        })),
      )
      .execute();
    return rows.map((r) => ({ suivi: r.id, nature: r.nature, objet: r.objet }));
  }

  /** Exceptions qui arrivent à échéance sous RAPPEL_EXCEPTION_JOURS jours et n'ont pas encore eu de rappel : marquées (un
      rappel par exception et par échéance ; une prolongation le réarme). Rend leurs identifiants internes. */
  async rappelerExceptions(k: Kdb, jour = aujourdhui()): Promise<string[]> {
    const { rows } = await sql<{ id: string }>`
      UPDATE vulnerabilites_suivis SET exception_rappel_le = now()
      WHERE etat = 'risque_accepte' AND exception_rappel_le IS NULL AND revue_le IS NOT NULL
        AND revue_le >= ${jour}::date AND revue_le <= ${jour}::date + ${RAPPEL_EXCEPTION_JOURS}::int
      RETURNING id`.execute(k);
    return rows.map((r) => r.id).sort();
  }

  /** Après une synchronisation reçue de Tenable (dans sa transaction, numéro de référence déjà avancé si elle est complète).
      Réapparitions et retraits à chaque synchronisation reçue (une détection vue est présente) ; propositions « corrigée »
      seulement après une synchronisation complète, seule à faire foi pour l'absence. */
  async apresSynchronisation(k: Kdb, c: Client, integrationId: string, complete: boolean): Promise<void> {
    const { rows } = await sql<{ id: string; present: boolean }>`
      SELECT x.id, x.present FROM (
        SELECT c.id, EXISTS (SELECT 1 FROM vulnerabilites_detections d WHERE d.constat_id = c.id
                               AND d.vu_numero >= coalesce(e.numero_complet, 0)) AS present,
               s.id AS suivi, s.etat, s.proposition, s.absente
        FROM vulnerabilites_constats c
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = c.integration_id
        LEFT JOIN vulnerabilites_suivis s ON s.constat_id = c.id
        WHERE c.integration_id = ${integrationId}::uuid) x
      WHERE (x.present AND x.suivi IS NOT NULL AND (x.absente OR x.proposition <> 'aucune'))
         OR (${complete}::boolean AND NOT x.present
             AND (x.suivi IS NULL OR NOT x.absente OR (x.etat <> 'corrigee' AND x.proposition = 'aucune')))
      ORDER BY x.id`.execute(k);
    const bilan = { propositions: 0, retraits: 0, reapparitions: 0 };
    for (const r of rows) this.compter(bilan, await this.basculer(k, 'constat', r.id, r.present));
    if (bilan.propositions || bilan.retraits || bilan.reapparitions)
      await this.db.audit(
        SYSTEME,
        null,
        'vulnerabilites.suivi.synchronisation',
        integrationId,
        { complete, ...bilan },
        c,
      );
  }

  /** Après un recalcul des rapprochements d'un produit (dans sa transaction) : une CVE qui n'est plus rattachée est
      proposée « corrigée », une CVE de nouveau rattachée retire la proposition ou réapparaît. */
  async apresRapprochement(
    k: Kdb,
    c: Client,
    produitId: string,
    bascules: { id: string; rattachee: boolean }[],
  ): Promise<void> {
    const bilan = { propositions: 0, retraits: 0, reapparitions: 0 };
    for (const b of [...bascules].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)))
      this.compter(bilan, await this.basculer(k, 'declaree', b.id, b.rattachee));
    if (bilan.propositions || bilan.retraits || bilan.reapparitions)
      await this.db.audit(SYSTEME, null, 'vulnerabilites.suivi.rapprochement', produitId, bilan, c);
  }

  private compter(bilan: { propositions: number; retraits: number; reapparitions: number }, e: EvenementSuivi | null) {
    if (e === 'proposition') bilan.propositions++;
    if (e === 'retrait_proposition') bilan.retraits++;
    if (e === 'reapparition') bilan.reapparitions++;
  }
}
