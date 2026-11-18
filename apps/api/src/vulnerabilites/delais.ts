/* Module Vulnérabilités (ADR 0100, lot S1 ; décision du RSSI du 18/11/2026) : délais de correction et exceptions à échéance.
   - Délai d'un objet suivi (constat de Tenable, faille déclarée) : fonction pure calculerDelai du paquet partagé, avec la
     priorité courante calculée sur TOUS les faits connus (lot ALH5 : la même pour tout le monde) et le délai cible réglé
     avec les seuils de priorité. Aucune requête par faille : l'évaluation reprend le calcul global des alertes
     (AlertesVulnerabilites.situationGlobale, nombre de requêtes fixe).
   - Évaluation (tic de l'API, au plus une fois par quart d'heure ; rien si le module est désactivé), dans une transaction
     sous verrou consultatif : expiration des exceptions échues (suivi.ts), rappel des exceptions proches de leur échéance,
     failles entrées en dépassement depuis l'évaluation précédente (table vulnerabilites_depassements). Deux notifications
     de résumé au plus (ADR 0058), aux comptes qui lisent le module, selon leurs réglages : « n failles en dépassement de
     délai » et « n exceptions échues, m à échéance sous 14 jours » ; ni CVE, ni nom de machine, de domaine, d'adresse ou de
     périmètre. Puis, si des exceptions ont expiré, réévaluation des alertes (les failles rouvertes comptent de nouveau).
   - Lecture (vulnerabilites:lire) : délais réglés, mesure des corrections sur une période (priorité, point de départ, fin
     et échéance relevés à la décision « corrigée » ; les mêmes nombres pour tout le monde, sans nom) et exceptions en cours
     ou échues depuis 90 jours parmi les failles que la personne lit (au moins une machine touchée lisible, comme les
     listes). Lecture seule, aucune entrée de journal ; 4 requêtes (réglage 1, mesures 1, exceptions 1, rôle RSSI 1).
   Journal : `vulnerabilites.exceptions.echues`, `vulnerabilites.exceptions.rappel`, `vulnerabilites.delais.evalues`
   (identifiants internes et nombres seulement). */
import {
  calculerDelai,
  type CorrectionMesuree,
  type DelaisVueDto,
  EXCEPTIONS_ECHUES_JOURS,
  EXCEPTIONS_MAX,
  type EtatSuiviFaille,
  type ExceptionDto,
  faitsDepuisSources,
  calculerPriorite,
  MESSAGE_RESUME_DEPASSEMENTS,
  MESSAGE_RESUME_EXCEPTIONS,
  mesurerCorrections,
  type NatureSuivi,
  type NiveauPriorite,
  PREFIXE_RESUME_DELAIS,
  PREFIXE_RESUME_EXCEPTIONS,
  type RechercheDelais,
  statutException,
  STATUTS_EXCEPTION,
  type StatutException,
  titreResumeDepassements,
  titreResumeExceptions,
} from '@suivi/shared';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { Modules } from '../modules.js';
import type { NotificationEmise, NotificationsMetier } from '../notifications-metier.js';
import { type AlertesVulnerabilites, lecteursDuModule, type ObjetDelai } from './alertes.js';
import { sourcesDesConstats } from './failles.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { tientLeRoleRssi } from './rssi.js';
import { lireFaitsCve, sourcesDe } from './sources.js';
import { lisible, premiereConstat, present } from './sql.js';
import { aujourdhui, type DelaiObjet, type SuiviFailles } from './suivi.js';

const SYSTEME = { username: 'système' };
const KIND = { delais: 'vulnerabilites_delais', exceptions: 'vulnerabilites_exceptions' } as const;
/** Intervalle minimal entre deux évaluations lancées par le tic (millisecondes). */
export const INTERVALLE_EVALUATION_DELAIS = 15 * 60_000;
const verrou = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(hashtextextended('vulnerabilites.delais', 0))`.execute(k);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export interface BilanDelais {
  expirees: number;
  rappels: number;
  enDepassement: number;
  nouveaux: number;
  notifiees: number;
}

/** Objets en dépassement de délai, sur les objets présents du calcul global. */
export function objetsEnDepassement(
  objets: readonly ObjetDelai[],
  delais: Parameters<typeof calculerDelai>[0]['delais'],
  maintenant: Date,
) {
  const out: { nature: NatureSuivi; id: string; priorite: NiveauPriorite; echeance: string }[] = [];
  for (const o of objets) {
    const d = calculerDelai({
      priorite: o.priorite,
      etatSuivi: o.etat,
      present: true,
      premiere: o.premiere,
      repartLe: o.repart,
      delais,
      maintenant,
    });
    if (d.etat === 'en_depassement' && d.echeance)
      out.push({ nature: o.nature, id: o.id, priorite: o.priorite, echeance: d.echeance });
  }
  return out;
}

export class DelaisVulnerabilites {
  private derniere = 0;

  constructor(
    private readonly db: Db,
    private readonly reglage: ReglagePrioriteVulnerabilites,
    private readonly modules: Pick<Modules, 'state'>,
    private readonly alertes: Pick<AlertesVulnerabilites, 'situationGlobale' | 'evaluer'>,
    private readonly suivi: Pick<SuiviFailles, 'expirerExceptions' | 'rappelerExceptions'>,
    private readonly notifications: Pick<NotificationsMetier, 'diffuser'>,
  ) {}

  /* ---------------------------------------------------------------- Délai d'un objet (décision « corrigée ») */
  /** Priorité courante (présence de l'objet : « détectée » ou « déclarée »), point de départ et échéance du délai d'un objet
      suivi ; null s'il n'existe pas. Quelques requêtes, pour une décision (jamais dans une liste). */
  async delaiObjet(k: Kdb, nature: NatureSuivi, id: string): Promise<DelaiObjet | null> {
    const reglage = await this.reglage.valeurs();
    let priorite: NiveauPriorite;
    let premiere: Date;
    let repart: Date | null;
    if (nature === 'constat') {
      const { rows } = await sql<{
        id: string;
        gravite: 'critique' | 'elevee' | 'moyenne' | 'faible';
        cvss3_score: string | null;
        epss_score: string | null;
        exploitable: boolean;
        premiere: Date;
        repart: Date | null;
      }>`SELECT c.id, c.gravite, c.cvss3_score, c.epss_score, c.exploitable, ${premiereConstat} AS premiere,
           (SELECT s.delai_repart_le FROM vulnerabilites_suivis s WHERE s.constat_id = c.id) AS repart
         FROM vulnerabilites_constats c WHERE c.id = ${id}::uuid`.execute(k);
      const c = rows[0];
      if (!c) return null;
      const sources = (await sourcesDesConstats(k, [c])).get(c.id)!;
      priorite = calculerPriorite({ ...faitsDepuisSources(sources), presence: 'detectee' }, reglage).niveau;
      premiere = c.premiere;
      repart = c.repart;
    } else {
      const { rows } = await sql<{ cve: string; premiere: Date; repart: Date | null }>`
        SELECT r.cve, r.cree_le AS premiere,
          (SELECT s.delai_repart_le FROM vulnerabilites_suivis s WHERE s.rapprochement_id = r.id) AS repart
        FROM vulnerabilites_rapprochements r WHERE r.id = ${id}::uuid`.execute(k);
      const r = rows[0];
      if (!r) return null;
      const f = (await lireFaitsCve(k, [r.cve])).get(r.cve);
      priorite = calculerPriorite(
        { ...faitsDepuisSources(sourcesDe(f ? [f] : [])), presence: 'declaree' },
        reglage,
      ).niveau;
      premiere = r.premiere;
      repart = r.repart;
    }
    const d = calculerDelai({
      priorite,
      etatSuivi: 'a_traiter',
      present: true,
      premiere: premiere.toISOString(),
      repartLe: iso(repart),
      delais: reglage.delais,
      maintenant: new Date(),
    });
    return { priorite: d.priorite, depuis: d.depuis, echeance: d.echeance };
  }

  /* ---------------------------------------------------------------- Évaluation (tic de l'API) */
  /** Appelé à chaque tic : évalue au plus une fois par INTERVALLE_EVALUATION_DELAIS. */
  async tic(maintenant = new Date()): Promise<BilanDelais | null> {
    if (maintenant.getTime() - this.derniere < INTERVALLE_EVALUATION_DELAIS) return null;
    this.derniere = maintenant.getTime();
    return this.evaluer(maintenant);
  }

  /** Évaluation complète, dans une transaction propre. Module désactivé : rien. Un échec est journalisé, jamais rendu. */
  async evaluer(maintenant = new Date()): Promise<BilanDelais | null> {
    try {
      if ((await this.modules.state(true)).disabled.includes('vulnerabilites')) return null;
    } catch (e) {
      this.db.log.error({ err: (e as Error).message }, 'délais vulnérabilités : état des modules illisible');
      return null;
    }
    let bilan: BilanDelais;
    try {
      bilan = await this.db.tx((c, k) => this.appliquer(k, c, maintenant), SYSTEME.username);
    } catch (e) {
      this.db.log.error({ err: (e as Error).message }, 'délais vulnérabilités : évaluation en échec');
      return null;
    }
    // Les failles rendues par une exception échue comptent de nouveau pour les alertes.
    if (bilan.expirees) await this.alertes.evaluer('exceptions-echues');
    return bilan;
  }

  private async appliquer(k: Kdb, c: Client, maintenant: Date): Promise<BilanDelais> {
    await verrou(k);
    const jour = aujourdhui(maintenant);
    const expirees = await this.suivi.expirerExceptions(k, jour);
    const rappels = await this.suivi.rappelerExceptions(k, jour);
    if (expirees.length)
      await this.db.audit(
        SYSTEME,
        null,
        'vulnerabilites.exceptions.echues',
        '',
        {
          nombre: expirees.length,
          suivis: expirees.map((x) => x.suivi),
          objets: expirees.map((x) => ({ nature: x.nature, objet: x.objet })),
        },
        c,
      );
    if (rappels.length)
      await this.db.audit(
        SYSTEME,
        null,
        'vulnerabilites.exceptions.rappel',
        '',
        { nombre: rappels.length, suivis: rappels },
        c,
      );
    // Dépassements : sur tous les faits connus, après l'expiration (une faille rendue à traiter compte de nouveau).
    const { objets, reglage } = await this.alertes.situationGlobale(k, []);
    const depasses = objetsEnDepassement(objets, reglage.delais, maintenant);
    const cle = (x: { nature: string; id: string }) => `${x.nature}:${x.id}`;
    const deja = new Map(
      (
        await sql<{ nature: NatureSuivi; objet_id: string; echeance: Date }>`
          SELECT nature, objet_id, echeance FROM vulnerabilites_depassements FOR UPDATE`.execute(k)
      ).rows.map((r) => [`${r.nature}:${r.objet_id}`, r.echeance.toISOString()]),
    );
    const actuels = new Set(depasses.map(cle));
    const sortis = [...deja.keys()].filter((x) => !actuels.has(x));
    // Une faille déjà signalée dont l'échéance a changé (délai reparti, priorité changée) est signalée de nouveau.
    const nouveaux = depasses.filter((x) => deja.get(cle(x)) !== x.echeance);
    if (sortis.length)
      await sql`DELETE FROM vulnerabilites_depassements WHERE (nature || ':' || objet_id::text) = ANY(${sortis}::text[])`.execute(
        k,
      );
    if (nouveaux.length)
      await k
        .insertInto('vulnerabilites_depassements')
        .values(nouveaux.map((x) => ({ nature: x.nature, objet_id: x.id, priorite: x.priorite, echeance: x.echeance })))
        .onConflict((oc) =>
          oc.columns(['nature', 'objet_id']).doUpdateSet((eb) => ({
            priorite: eb.ref('excluded.priorite'),
            echeance: eb.ref('excluded.echeance'),
            signale_le: sql<Date>`now()`,
          })),
        )
        .execute();
    const notifiees = await this.notifier(k, c, nouveaux.length, expirees.length, rappels.length);
    const bilan: BilanDelais = {
      expirees: expirees.length,
      rappels: rappels.length,
      enDepassement: depasses.length,
      nouveaux: nouveaux.length,
      notifiees,
    };
    if (nouveaux.length || sortis.length)
      await this.db.audit(
        SYSTEME,
        null,
        'vulnerabilites.delais.evalues',
        '',
        { enDepassement: depasses.length, nouveaux: nouveaux.length, sortis: sortis.length },
        c,
      );
    return bilan;
  }

  /** Deux résumés au plus par évaluation, à chaque compte qui lit le module (réglages personnels appliqués par la
      diffusion) ; aucun quand il n'y a rien. Rend le nombre de notifications créées. */
  private async notifier(k: Kdb, c: Client, depassements: number, echues: number, proches: number): Promise<number> {
    if (!depassements && !echues && !proches) return 0;
    const destinataires = await lecteursDuModule(c);
    const emises: NotificationEmise[] = [];
    const inserer = async (uid: string, kind: string, cle: string, titre: string, message: string) => {
      const { rows } = await sql<{ id: string }>`
        INSERT INTO grc_notifications (smsi_id, object_id, user_id, kind, due_key, title, message)
        VALUES (NULL, NULL, ${uid}::uuid, ${kind}, ${cle}, ${titre}, ${message})
        ON CONFLICT (user_id, due_key) WHERE kind IN ('vulnerabilites_delais', 'vulnerabilites_exceptions')
        DO NOTHING RETURNING id::text AS id`.execute(k);
      if (rows[0]) emises.push({ id: rows[0].id, userId: uid, kind });
    };
    if (depassements) {
      const cle = `${PREFIXE_RESUME_DELAIS}${randomUUID()}`;
      for (const uid of destinataires)
        await inserer(uid, KIND.delais, cle, titreResumeDepassements(depassements), MESSAGE_RESUME_DEPASSEMENTS);
    }
    if (echues || proches) {
      const cle = `${PREFIXE_RESUME_EXCEPTIONS}${randomUUID()}`;
      for (const uid of destinataires)
        await inserer(uid, KIND.exceptions, cle, titreResumeExceptions(echues, proches), MESSAGE_RESUME_EXCEPTIONS);
    }
    await this.notifications.diffuser(c, emises);
    return emises.length;
  }

  /* ---------------------------------------------------------------- Lecture (vulnerabilites:lire) */
  async lire(user: SessionUser, q: RechercheDelais): Promise<DelaisVueDto> {
    const k = this.db.k;
    const maintenant = new Date();
    const jour = aujourdhui(maintenant);
    const reglage = await this.reglage.valeurs();
    const du = new Date(maintenant.getTime() - q.periode * 86_400_000);
    const { rows: corrections } = await sql<{
      priorite: NiveauPriorite | null;
      delai_depuis: Date | null;
      delai_fin: Date | null;
      delai_echeance: Date | null;
    }>`SELECT DISTINCT ON (h.nature, h.objet_id) h.priorite, h.delai_depuis, h.delai_fin, h.delai_echeance
       FROM vulnerabilites_suivi_historique h
       WHERE h.evenement = 'changement' AND h.etat_apres = 'corrigee' AND h.cree_le >= ${du}
       ORDER BY h.nature, h.objet_id, h.cree_le DESC`.execute(k);
    const mesurables: CorrectionMesuree[] = corrections.flatMap((r) =>
      r.priorite && r.delai_depuis && r.delai_fin
        ? [
            {
              priorite: r.priorite,
              depuis: r.delai_depuis.toISOString(),
              fin: r.delai_fin.toISOString(),
              echeance: iso(r.delai_echeance),
            },
          ]
        : [],
    );
    const exceptions = await this.exceptions(user, jour);
    const compteurs = Object.fromEntries(STATUTS_EXCEPTION.map((s) => [s, 0])) as Record<StatutException, number>;
    for (const e of exceptions) compteurs[e.statut]++;
    return {
      delais: reglage.delais,
      periode: q.periode,
      du: du.toISOString(),
      au: maintenant.toISOString(),
      mesures: mesurerCorrections(mesurables),
      nonMesurees: corrections.length - mesurables.length,
      exceptions,
      compteurs,
      peutDeciderException: user.rights.can('vulnerabilites', 'modifier') && (await tientLeRoleRssi(this.db, user)),
      calculeLe: maintenant.toISOString(),
    };
  }

  /** Exceptions en cours (risque accepté) et échues depuis EXCEPTIONS_ECHUES_JOURS jours, des failles que la personne lit :
      au moins une machine touchée lisible (constat : où il est présent, à défaut où il a été vu ; faille déclarée : machines
      reliées au produit), comme les listes. Une requête ; aucun nom de machine. */
  private async exceptions(user: SessionUser, jour: string): Promise<ExceptionDto[]> {
    const { rows } = await sql<{
      nature: NatureSuivi;
      objet: string;
      sorte: 'en_cours' | 'echue';
      echeance: string | null;
      justification: string | null;
      mesure: string | null;
      par: string | null;
      le: Date | null;
      expiree_le: Date | null;
      etat_apres: EtatSuiviFaille | null;
      constat: string | null;
      cve: string | null;
      editeur: string | null;
      produit: string | null;
      version_produit: string | null;
    }>`
      WITH ex AS (
        SELECT s.nature, coalesce(s.constat_id, s.rapprochement_id) AS objet, 'en_cours' AS sorte,
               s.revue_le::text AS echeance, s.exception_justification AS justification, s.exception_mesure AS mesure,
               s.exception_par AS par, s.exception_le AS le, NULL::timestamptz AS expiree_le, NULL::text AS etat_apres
        FROM vulnerabilites_suivis s WHERE s.etat = 'risque_accepte'
        UNION ALL
        SELECT h.nature, h.objet_id, 'echue', h.revue_le::text, d.note, d.mesure, d.auteur, d.cree_le, h.cree_le,
               h.etat_apres
        FROM vulnerabilites_suivi_historique h
        LEFT JOIN LATERAL (
          SELECT x.note, x.mesure, x.auteur, x.cree_le FROM vulnerabilites_suivi_historique x
          WHERE x.nature = h.nature AND x.objet_id = h.objet_id AND x.evenement = 'changement'
            AND x.etat_apres = 'risque_accepte' AND x.cree_le <= h.cree_le
          ORDER BY x.cree_le DESC, x.id DESC LIMIT 1) d ON true
        WHERE h.evenement = 'expiration' AND h.cree_le >= now() - ${EXCEPTIONS_ECHUES_JOURS}::int * interval '1 day')
      SELECT ex.*, c.nom AS constat, r.cve, p.editeur, p.nom AS produit, p.version_produit
      FROM ex
      LEFT JOIN vulnerabilites_constats c ON ex.nature = 'constat' AND c.id = ex.objet
      LEFT JOIN vulnerabilites_rapprochements r ON ex.nature = 'declaree' AND r.id = ex.objet
      LEFT JOIN vulnerabilites_produits p ON p.id = r.produit_id
      WHERE (c.id IS NOT NULL AND EXISTS (
               SELECT 1 FROM vulnerabilites_detections d
               JOIN vulnerabilites_machines m ON m.id = d.machine_id
               LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
               WHERE d.constat_id = c.id AND ${lisible(user)}
                 AND (${present} OR NOT EXISTS (
                   SELECT 1 FROM vulnerabilites_detections d
                   JOIN vulnerabilites_machines m ON m.id = d.machine_id
                   LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
                   WHERE d.constat_id = c.id AND ${present}))))
         OR (r.id IS NOT NULL AND EXISTS (
               SELECT 1 FROM vulnerabilites_produits_machines pm
               JOIN vulnerabilites_machines m ON m.id = pm.machine_id
               WHERE pm.produit_id = r.produit_id AND ${lisible(user)}))
      ORDER BY (ex.sorte = 'echue'), ex.echeance NULLS FIRST, ex.expiree_le DESC NULLS LAST, ex.objet
      LIMIT ${EXCEPTIONS_MAX}`.execute(this.db.k);
    return rows.map((r): ExceptionDto => ({
      nature: r.nature,
      objetId: r.objet,
      titre:
        r.nature === 'constat'
          ? (r.constat ?? 'Constat de Tenable')
          : `${r.cve ?? ''} : ${[r.editeur, r.produit, r.version_produit].filter(Boolean).join(' ')}`,
      statut: r.sorte === 'echue' ? 'echue' : statutException(r.echeance, jour),
      echeance: r.echeance,
      justification: r.justification || null,
      mesure: r.mesure,
      par: r.par,
      le: iso(r.le),
      expireeLe: iso(r.expiree_le),
      etatApres: r.etat_apres,
    }));
  }
}
