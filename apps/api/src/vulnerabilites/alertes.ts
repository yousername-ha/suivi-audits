/* Module Vulnérabilités (ADR 0100, point 21 et lot V6) : alertes décidées par la PLATEFORME, par règle (fonctions pures de
   packages/shared/src/alertes-vulnerabilites.ts), jamais par l'assistant ni par le modèle ; aucun appel réseau.
   - Évaluation : à la fin de chaque collecte reçue de la veille, de chaque synchronisation reçue de Tenable ou
     d'AlgoLightHouse (dans sa transaction, sous un point de sauvegarde : un échec de l'évaluation est journalisé et ne fait
     jamais échouer la synchronisation), et après une décision qui change les faits (rapprochement, liaison d'un actif, état
     de suivi, seuil de priorité ; dans une transaction propre, après celle de la décision). Module désactivé : rien n'est
     évalué, rien n'est créé, aucune notification.
   - Faits : ceux de la grille partagée, sur TOUS les faits connus (lot ALH5, décision A : la même priorité pour tout le
     monde), majoration du lot ALH5 comprise pour une CVE exposée sur un actif qui mène à une machine interne vulnérable. Une
     faille est « présente » par un constat de Tenable présent et non traité (présence « détectée »), une faille déclarée
     rattachée et non traitée (« déclarée »), ou une exposition sur Internet (« exposée »).
   - Ordre (décision du RSSI du 20/11/2026, lot PERF-04) : à priorité égale, les faits d'une faille sont ceux du contrôle
     détecté le plus récemment, puis du plus petit identifiant (comparerControlesGlobal) ; failles rendues dans l'ordre de
     leur clé, objets suivis dans l'ordre de leur identifiant : rien ne dépend de l'ordre des lignes en base.
   - Seuil (décision du RSSI du 18/11/2026, lot V6b) : critique en P1 ; simple en P2 seulement si la faille est
     exploitable (une source exploitable sur l'une de ses présences non traitées) et exposée directement sur Internet
     (présence « exposée ») ; une alerte simple qui ne satisfait plus la règle se clôt « sous le seuil ».
   - Une alerte par faille (CVE, ou constat sans CVE) tant qu'elle n'est pas close ; mise à jour sans rejeu ; clôture
     automatique avec son motif ; montée d'une alerte simple en critique notifiée une fois.
   - Lecture (vulnerabilites:lire) : priorité, faits et existence de l'alerte pour tous ; nombres limités à ce que la personne
     lit (machines par leur périmètre effectif, actifs par leur périmètre ALH relié), avec un drapeau sans nombre pour le
     reste. Aucun nom de machine, de domaine, d'adresse ni de périmètre n'est rendu par ce service.
   - Prise en compte (décision B du 18/11/2026 : rôle « RSSI » de la plateforme seulement, direct ou par un groupe ; 403
     pour tout autre compte, administrateur compris ; If-Match sur la version) : par alerte, pour tout le monde ; journal
     `vulnerabilites.alerte.prise_en_compte`.
   - Notifications (ADR 0058), aux comptes actifs qui ont vulnerabilites:lire, réglages par personne appliqués par la
     diffusion existante (application, courriel si choisi et si le courriel est configuré) : une par alerte critique (type
     `vulnerabilites_alerte_critique` ; titre : niveau, CVE, produit) ; pour les alertes simples ouvertes par une même
     évaluation, UN résumé (type `vulnerabilites_alerte`, clé « resume:<évaluation> », titre : leur nombre seulement).
   Journal : `vulnerabilites.alerte.ouverte`, `.niveau`, `.close`, `.prise_en_compte`, `vulnerabilites.alertes.evaluees`
   (identifiants, CVE, niveaux, motifs et nombres ; jamais de nom). */
import {
  ALERTES_FENETRE_MAX,
  ALERTES_PAR_PAGE,
  type AlerteExistante,
  type AlerteVulnerabiliteDto,
  calculerPriorite,
  cleAlerte,
  comparerControlesGlobal,
  deciderAlerte,
  effectivePermissions,
  empreinteAlerte,
  type EtatAlerte,
  type EtatSuiviFaille,
  type FaitsAlerte,
  type FamilleProduit,
  faitsDepuisSources,
  type FenetreAlertesDto,
  type GraviteTenable,
  majorerPriorite,
  MESSAGE_NOTIFICATION_ALERTE,
  MESSAGE_RESUME_ALERTES,
  type MotifClotureAlerte,
  type NiveauAlerte,
  type NiveauPriorite,
  type NatureSuivi,
  niveauAlerte,
  type NombreLisible,
  type PageAlertesVulnerabilites,
  type Presence,
  PRESENCES,
  type Priorite,
  prioriteLaPlusHaute,
  type RechercheAlertesVulnerabilites,
  type ReglagePriorite,
  PREFIXE_RESUME_ALERTES,
  PRISE_EN_COMPTE_RESERVEE,
  rangPriorite,
  rangerSignalements,
  Rights,
  type Signalement,
  type SourceExploitation,
  SOURCES_EXPLOITATION,
  type SituationFaille,
  type SourcesFailleDto,
  titreNotificationAlerte,
  titreResumeAlertes,
} from '@suivi/shared';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import { surConnexion, type Client, type Db, type Kdb } from '../db/db.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import type { Modules } from '../modules.js';
import { COMPTE_ACTIF, type NotificationEmise, type NotificationsMetier } from '../notifications-metier.js';
import { loadGrants } from '../rights.js';
import { tientLeRoleRssi } from './rssi.js';
import { actifsMenantAUneMachineVulnerable } from './majoration.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { type FaitsTenable, lireFaitsCve, sourcesDe } from './sources.js';
import { lisible, present } from './sql.js';
import { close } from './suivi.js';
import type { SurfaceExterneAlh } from './surface-externe.js';

const SYSTEME = { username: 'système' };
const INTROUVABLE = 'Alerte introuvable.';
const KIND: Record<NiveauAlerte, string> = {
  critique: 'vulnerabilites_alerte_critique',
  simple: 'vulnerabilites_alerte',
};
const verrou = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(hashtextextended('vulnerabilites.alertes', 0))`.execute(k);
const nombre = (v: string | number | null) => (v === null ? null : Number(v));
const iso = (d: Date | null) => (d ? d.toISOString() : null);
/** Texte d'une source (titre, produit) : sans caractère de contrôle, sur une ligne, borné. */
const propre = (v: string | null | undefined, max: number): string | null => {
  const t = (v ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return t || null;
};

/** Sources de l'exploitation avérée d'une faille du calcul global : celles rangées avec sa CVE, et Tenable quand un contrôle
    présent et non traité qui la porte est marqué « exploité par un logiciel malveillant » (lot N2). Une faille sans ce
    marquage garde exactement les sources de sa CVE. Reprise par les faits d'une alerte, la vue d'ensemble, les tendances
    et le rapport (exploiteeSelonSources). */
export function exploitationDeCumul(
  x: Pick<Cumul, 'cve' | 'malware'>,
  sources: ReadonlyMap<string, SourcesFailleDto>,
): Signalement<SourceExploitation>[] {
  const cve = x.cve ? (sources.get(x.cve)?.exploitation ?? []) : [];
  return x.malware ? rangerSignalements([...cve, { source: 'tenable', le: null }], SOURCES_EXPLOITATION) : cve;
}

/** Rapprochement proposé (produit à confirmer), remis par la vue d'ensemble (lot PC1) ; jamais par l'évaluation des alertes. */
export interface PropositionCumul {
  id: string;
  cve: string;
  produit_id: string;
  editeur: string;
  nom: string;
  famille: FamilleProduit;
}

/** Ce que l'évaluation retient d'une faille. Les champs marqués « PC1 » servent seulement à la vue d'ensemble : ils ne changent
    rien aux décisions d'alerte. */
export interface Cumul {
  cle: string;
  cve: string | null;
  priorites: Priorite[];
  presences: Set<Presence>;
  machines: Set<string>;
  produits: Set<string>;
  actifs: number;
  /** Lot S2 : actifs exposés (identifiants internes, rangés seulement) qui portent la faille ; jamais rendus tels quels. */
  actifIds: string[];
  /** Une source dit qu'un code d'exploitation existe, sur l'une des présences non traitées (lot V6b). */
  exploitable: boolean;
  /** Objets présents qui portent la faille (constats présents, failles déclarées rattachées), et parmi eux les traités. */
  objets: number;
  traites: number;
  constats: string[];
  produitsDeclares: { editeur: string; nom: string }[];
  /** PC1 : gravité et score EPSS les plus sévères des présences non traitées (valeurs retenues par la grille). */
  gravite: GraviteTenable | null;
  epss: number | null;
  /** PC1 : objets suivis encore ouverts (constats présents, failles déclarées), leur état, familles et produits rapprochés. */
  constatIds: string[];
  rapprochementIds: string[];
  etats: EtatSuiviFaille[];
  familles: FamilleProduit[];
  produitIds: string[];
  /** PC1 : priorité « produit à confirmer » (rapprochement proposé), seulement si des propositions sont remises. */
  aConfirmer: Priorite | null;
  /** Lot S3 : date de publication du correctif la plus ancienne selon Tenable, parmi les contrôles présents qui portent la
      faille (traités compris : c'est un fait sur la faille), ou null. */
  correctifTenableLe: string | null;
  /** Lot N2 : un contrôle présent et non traité qui porte la faille est marqué « exploité par un logiciel malveillant »
      par Tenable (exploitation avérée propre au contrôle, absente des sources de la CVE). */
  malware: boolean;
}

/** Objet suivi présent (constat de Tenable présent, faille déclarée rattachée), pour son délai de correction (lot S1) : état
    de suivi, priorité courante (sur tous les faits connus), première présence connue et reprise du délai. Aucun nom. */
export interface ObjetDelai {
  nature: NatureSuivi;
  id: string;
  etat: EtatSuiviFaille;
  priorite: NiveauPriorite;
  premiere: string;
  repart: string | null;
  /** Lot S2 : machines (identifiants internes) de l'objet, CVE, et nom du contrôle de Tenable ou « éditeur produit » d'une
      faille déclarée ; pour les instantanés et le rapport (jamais un nom de machine). */
  machines: string[];
  cves: string[];
  nom: string;
  /** Lot S3 : date de fin de support du logiciel selon Tenable (constat seulement), ou null. */
  finSupportLe?: string | null;
}

interface LigneAlerte {
  id: string;
  cle: string;
  cve: string | null;
  niveau: NiveauAlerte;
  priorite: string;
  etat: EtatAlerte;
  titre: string;
  produit: string | null;
  faits: FaitsAlerte;
  empreinte: string;
  notifiee: boolean;
  ouverte_le: Date;
  critique_le: Date | null;
  maj_le: Date;
  prise_par: string | null;
  prise_le: Date | null;
  close_le: Date | null;
  motif_cloture: MotifClotureAlerte | null;
  version: number;
  updated_by: string;
}

export interface BilanAlertes {
  creees: number;
  misesAJour: number;
  closes: number;
  notifiees: number;
}

export class AlertesVulnerabilites {
  constructor(
    private readonly db: Db,
    private readonly reglage: ReglagePrioriteVulnerabilites,
    private readonly modules: Pick<Modules, 'state'>,
    private readonly surface: Pick<SurfaceExterneAlh, 'expositionsGlobales' | 'surfaceDesCves'>,
    private readonly notifications: Pick<NotificationsMetier, 'diffuser'>,
  ) {}

  /* ---------------------------------------------------------------- Évaluation */
  /** Évalue les alertes. Dans la transaction d'une synchronisation (`tx`), sous un point de sauvegarde : un échec est
      journalisé et annulé seul. Sans `tx`, dans une transaction propre ; un échec est journalisé, jamais rendu (l'opération
      qui précède est déjà enregistrée ; l'évaluation suivante rattrape). Module désactivé : rien. */
  async evaluer(declencheur: string, tx?: { k: Kdb; c: Client }): Promise<BilanAlertes | null> {
    try {
      if ((await this.modules.state(true)).disabled.includes('vulnerabilites')) return null;
    } catch (e) {
      this.db.log.error(
        { err: (e as Error).message, declencheur },
        'alertes vulnérabilités : état des modules illisible',
      );
      return null;
    }
    if (tx) {
      await tx.c.query('SAVEPOINT vulnerabilites_alertes');
      try {
        const r = await this.appliquer(tx.k, tx.c, declencheur);
        await tx.c.query('RELEASE SAVEPOINT vulnerabilites_alertes');
        return r;
      } catch (e) {
        await tx.c.query('ROLLBACK TO SAVEPOINT vulnerabilites_alertes');
        this.db.log.error({ err: (e as Error).message, declencheur }, 'alertes vulnérabilités : évaluation en échec');
        return null;
      }
    }
    try {
      return await this.db.tx((c, k) => this.appliquer(k, c, declencheur), SYSTEME.username);
    } catch (e) {
      this.db.log.error({ err: (e as Error).message, declencheur }, 'alertes vulnérabilités : évaluation en échec');
      return null;
    }
  }

  /** Évaluation dans une transaction : verrou, faits, décisions, notifications, journal. */
  private async appliquer(k: Kdb, c: Client, declencheur: string): Promise<BilanAlertes> {
    await verrou(k);
    const reglage = await this.reglage.valeurs();
    const { cumuls, sources } = await this.calculer(k, reglage);
    const existantes = new Map(
      (
        await sql<LigneAlerte>`SELECT * FROM vulnerabilites_alertes WHERE etat <> 'close' ORDER BY cle FOR UPDATE`.execute(
          k,
        )
      ).rows.map((l) => [l.cle, l]),
    );
    const titres = await this.titres(
      k,
      [...cumuls.values()].filter((x) => x.cve && x.priorites.length).map((x) => x.cve!),
    );
    const bilan: BilanAlertes = { creees: 0, misesAJour: 0, closes: 0, notifiees: 0 };
    const aNotifier: { id: string; niveau: NiveauAlerte; cve: string | null; produit: string | null }[] = [];
    const cles = [...new Set([...cumuls.keys(), ...existantes.keys()])].sort();
    for (const cle of cles) {
      const x = cumuls.get(cle);
      const ex = existantes.get(cle) ?? null;
      const p = x ? prioriteLaPlusHaute(x.priorites) : null;
      const niveau =
        x && p
          ? niveauAlerte({ priorite: p.niveau, exploitable: x.exploitable, exposee: x.presences.has('exposee') })
          : null;
      const faits = x && p && niveau ? this.faits(x, p, titres, sources) : null;
      const situation: SituationFaille = {
        priorite: p?.niveau ?? null,
        traitee: !!x && x.objets > 0 && x.traites === x.objets && !x.priorites.length,
      };
      const existante: AlerteExistante | null = ex
        ? { niveau: ex.niveau, etat: ex.etat, empreinte: ex.empreinte }
        : null;
      const d = deciderAlerte(existante, {
        niveau,
        empreinte: faits ? empreinteAlerte(faits) : null,
        situation,
      });
      if (d.action === 'rien') continue;
      if (d.action === 'creer') {
        const f = faits!;
        const r = await k
          .insertInto('vulnerabilites_alertes')
          .values({
            cle,
            cve: x!.cve,
            niveau: d.niveau,
            priorite: f.priorite.niveau,
            titre: f.titre,
            produit: f.produit,
            faits: JSON.stringify(f),
            empreinte: empreinteAlerte(f),
            critique_le: d.niveau === 'critique' ? sql<Date>`now()` : null,
          })
          .returning(['id'])
          .executeTakeFirstOrThrow();
        bilan.creees++;
        aNotifier.push({ id: r.id, niveau: d.notifier, cve: x!.cve, produit: f.produit });
        await this.db.audit(
          SYSTEME,
          null,
          'vulnerabilites.alerte.ouverte',
          r.id,
          { cle, niveau: d.niveau, priorite: f.priorite.niveau, declencheur },
          c,
        );
      } else if (d.action === 'mettre_a_jour') {
        const f = faits!;
        await k
          .updateTable('vulnerabilites_alertes')
          .set((eb) => ({
            niveau: d.niveau,
            priorite: f.priorite.niveau,
            titre: f.titre,
            produit: f.produit,
            faits: JSON.stringify(f),
            empreinte: empreinteAlerte(f),
            maj_le: sql<Date>`now()`,
            version: eb('version', '+', 1),
            updated_by: SYSTEME.username,
            ...(d.notifier === 'critique' ? { critique_le: sql<Date>`now()`, notifiee: false } : {}),
            ...(d.reprise ? { etat: 'ouverte', prise_par: null, prise_le: null } : {}),
          }))
          .where('id', '=', ex!.id)
          .execute();
        bilan.misesAJour++;
        if (d.notifier) aNotifier.push({ id: ex!.id, niveau: d.notifier, cve: ex!.cve, produit: f.produit });
        if (d.niveau !== ex!.niveau)
          await this.db.audit(
            SYSTEME,
            null,
            'vulnerabilites.alerte.niveau',
            ex!.id,
            {
              cle,
              avant: ex!.niveau,
              apres: d.niveau,
              priorite: f.priorite.niveau,
              priseEnCompteAnnulee: d.reprise,
              declencheur,
            },
            c,
          );
      } else {
        await k
          .updateTable('vulnerabilites_alertes')
          .set((eb) => ({
            etat: 'close',
            close_le: sql<Date>`now()`,
            motif_cloture: d.motif,
            maj_le: sql<Date>`now()`,
            version: eb('version', '+', 1),
            updated_by: SYSTEME.username,
          }))
          .where('id', '=', ex!.id)
          .execute();
        bilan.closes++;
        await this.db.audit(
          SYSTEME,
          null,
          'vulnerabilites.alerte.close',
          ex!.id,
          { cle, niveau: ex!.niveau, motif: d.motif, declencheur },
          c,
        );
      }
    }
    bilan.notifiees = await this.notifier(k, c, aNotifier);
    if (bilan.creees || bilan.misesAJour || bilan.closes)
      await this.db.audit(SYSTEME, null, 'vulnerabilites.alertes.evaluees', '', { declencheur, ...bilan }, c);
    return bilan;
  }

  /** Vue d'ensemble (lot PC1) : faits de chaque faille suivie, sur tous les faits connus (sans droits), propositions comprises
      (présence « produit à confirmer »), titres et produits. Lecture seule, nombre de requêtes fixe (aucune par faille).
      Lot PERF-04 : `titres` à false, aucun titre n'est lu (la vue d'ensemble lit ceux des seules failles qu'elle rend) ;
      `machines` à false, les machines des contrôles de Tenable ne sont pas lues (Cumul.machines et ObjetDelai.machines n'ont
      alors que celles des failles déclarées), pour qui ne les compte pas (vue d'ensemble, dépassements de délai). Priorités,
      faits et nombres de failles inchangés. */
  async situationGlobale(
    k: Kdb,
    propositions: readonly PropositionCumul[],
    options: { titres?: boolean; machines?: boolean } = {},
  ) {
    const reglage = await this.reglage.valeurs();
    const { cumuls, sources, objets } = await this.calculer(k, reglage, propositions, options.machines ?? true);
    const titres =
      (options.titres ?? true)
        ? await this.titres(
            k,
            [...cumuls.values()].flatMap((x) => (x.cve ? [x.cve] : [])),
          )
        : new Map<string, { titre: string | null; produit: string | null }>();
    return { cumuls, sources, titres, objets, reglage };
  }

  /** Titre et produit d'une faille (mêmes règles que les alertes). */
  titreEtProduit(x: Cumul, titres: Map<string, { titre: string | null; produit: string | null }>) {
    const veille = x.cve ? titres.get(x.cve) : undefined;
    const constat = [...x.constats].sort()[0];
    const declare = [...x.produitsDeclares].sort((a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0))[0];
    const titre =
      propre(veille?.titre, 300) ??
      propre(constat, 300) ??
      propre(declare ? `${declare.editeur} ${declare.nom}` : null, 300) ??
      `Faille ${x.cve ?? 'sans CVE'}`;
    const produit = propre(veille?.produit, 200) ?? propre(declare?.nom, 200);
    return { titre, produit };
  }

  /** Faits de chaque faille présente, sur tous les faits connus (sans droits). `propositions` (vue d'ensemble seulement) :
      rapprochements proposés, comptés en présence « produit à confirmer » à part, sans effet sur les alertes. `machines` à
      false : machines des constats non lues (Cumul.machines et ObjetDelai.machines vides pour les constats). */
  private async calculer(
    k: Kdb,
    reglage: ReglagePriorite,
    propositions: readonly PropositionCumul[] = [],
    machines = true,
  ): Promise<{ cumuls: Map<string, Cumul>; sources: Map<string, SourcesFailleDto>; objets: ObjetDelai[] }> {
    // Constats de Tenable présents (au moins une détection vue par la dernière synchronisation complète de l'instance de sa
    // machine), avec leurs CVE, leurs machines (présentes, rangées), leur dernière détection présente et leur état de suivi.
    // Lot PERF-04 : un agrégat des détections par constat et un des CVE, au lieu de sous-requêtes par constat. Mêmes règles
    // qu'avant : machines où le constat est présent ; première présence sur TOUTES ses détections, sinon son entrée dans la
    // plateforme (premiereConstat) ; état de suivi lu dans vulnerabilites_suivis (un suivi au plus par constat).
    const { rows: lignes } = await sql<{
      id: string;
      nom: string;
      gravite: GraviteTenable;
      cvss3_score: string | null;
      epss_score: string | null;
      exploitable: boolean;
      exploite_malware: boolean;
      clos: boolean;
      etat: EtatSuiviFaille | null;
      /** Listes séparées par des virgules (CVE rangées, identifiants de machines rangés) : plus rapides à lire qu'un tableau
          PostgreSQL pour des dizaines de milliers de lignes. */
      cves: string;
      machines: string | null;
      premiere: Date;
      derniere: Date | null;
      repart: Date | null;
      correctif_publie_le: Date | null;
      fin_support_le: Date | null;
    }>`WITH p AS (
         SELECT d.constat_id,
                ${machines ? sql`array_to_string(array_agg(DISTINCT d.machine_id) FILTER (WHERE ${present}), ',')` : sql`NULL::text`}
                  AS machines,
                max(d.derniere_detection) FILTER (WHERE ${present}) AS derniere,
                min(d.premiere_detection) AS premiere
         FROM vulnerabilites_detections d
         JOIN vulnerabilites_machines m ON m.id = d.machine_id
         LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
         GROUP BY d.constat_id HAVING bool_or(${present})),
       cv AS (
         SELECT cc.constat_id, string_agg(cc.cve, ',' ORDER BY cc.cve) AS cves FROM vulnerabilites_constat_cves cc
         GROUP BY cc.constat_id)
       SELECT c.id, c.nom, c.gravite, c.cvss3_score, c.epss_score, c.exploitable, c.exploite_malware,
         ${close('constat')} AS clos,
         c.correctif_publie_le, c.fin_support_le, s.etat, coalesce(p.premiere, c.cree_le) AS premiere,
         p.derniere, s.delai_repart_le AS repart, coalesce(cv.cves, '') AS cves, p.machines
       FROM p JOIN vulnerabilites_constats c ON c.id = p.constat_id
       LEFT JOIN vulnerabilites_suivis s ON s.constat_id = c.id
       LEFT JOIN cv ON cv.constat_id = c.id`.execute(k);
    // Ordre des contrôles (décision du RSSI du 20/11/2026) : à priorité égale, le contrôle détecté le plus récemment fournit
    // les faits d'une faille, puis le plus petit identifiant. Fixé ici, il ne dépend plus de l'ordre des lignes en base.
    const constats = lignes
      .map((c) => ({
        c: { ...c, cves: c.cves ? c.cves.split(',') : [], machines: c.machines ? c.machines.split(',') : [] },
        o: { id: c.id, dernierePresente: iso(c.derniere) },
      }))
      .sort((a, b) => comparerControlesGlobal(a.o, b.o))
      .map((x) => x.c);
    // Failles déclarées : CVE rattachées (d'office ou confirmées) à un produit surveillé ; présentes même sans machine
    // reliée (V22).
    const { rows: declarees } = await sql<{
      id: string;
      cve: string;
      produit_id: string;
      editeur: string;
      nom: string;
      famille: FamilleProduit;
      clos: boolean;
      etat: EtatSuiviFaille | null;
      machines: string[];
      premiere: Date;
      repart: Date | null;
    }>`SELECT r.id, r.cve, r.produit_id, p.editeur, p.nom, p.famille, ${close('declaree')} AS clos,
         (SELECT sc.etat FROM vulnerabilites_suivis sc WHERE sc.rapprochement_id = r.id) AS etat,
         r.cree_le AS premiere,
         (SELECT sc.delai_repart_le FROM vulnerabilites_suivis sc WHERE sc.rapprochement_id = r.id) AS repart,
         coalesce((SELECT array_agg(pm.machine_id) FROM vulnerabilites_produits_machines pm
                   WHERE pm.produit_id = r.produit_id), '{}') AS machines
       FROM vulnerabilites_rapprochements r JOIN vulnerabilites_produits p ON p.id = r.produit_id
       WHERE r.statut IN ('rattachee', 'confirmee') ORDER BY r.id`.execute(k);
    const expositions = await this.surface.expositionsGlobales(k);
    const menants = expositions.size ? await actifsMenantAUneMachineVulnerable(k, reglage) : new Set<string>();
    const faits = await lireFaitsCve(k, [
      ...constats.flatMap((x) => x.cves),
      ...declarees.map((x) => x.cve),
      ...expositions.keys(),
      ...propositions.map((x) => x.cve),
    ]);
    const cache = new Map<string, SourcesFailleDto>();
    const sourcesCve = (cve: string) => {
      let s = cache.get(cve);
      if (!s) {
        const f = faits.get(cve);
        cache.set(cve, (s = sourcesDe(f ? [f] : [])));
      }
      return s;
    };
    const priorite = (s: SourcesFailleDto, presence: Presence) =>
      calculerPriorite({ ...faitsDepuisSources(s), presence }, reglage);
    /** PC1 : garde la gravité et le score EPSS les plus sévères d'une présence non traitée. */
    const RANG: Record<GraviteTenable, number> = { critique: 4, elevee: 3, moyenne: 2, faible: 1 };
    const retenir = (x: Cumul, s: SourcesFailleDto) => {
      const f = faitsDepuisSources(s);
      if (f.gravite && (!x.gravite || RANG[f.gravite] > RANG[x.gravite])) x.gravite = f.gravite;
      if (f.epss !== null && (x.epss === null || f.epss > x.epss)) x.epss = f.epss;
    };

    const cumuls = new Map<string, Cumul>();
    const cumul = (cle: string, cve: string | null): Cumul => {
      let x = cumuls.get(cle);
      if (!x)
        cumuls.set(
          cle,
          (x = {
            cle,
            cve,
            priorites: [],
            presences: new Set(),
            machines: new Set(),
            produits: new Set(),
            actifs: 0,
            actifIds: [],
            exploitable: false,
            objets: 0,
            traites: 0,
            constats: [],
            produitsDeclares: [],
            gravite: null,
            epss: null,
            constatIds: [],
            rapprochementIds: [],
            etats: [],
            familles: [],
            produitIds: [],
            aConfirmer: null,
            correctifTenableLe: null,
            malware: false,
          }),
        );
      return x;
    };
    // Lot S1 : chaque objet suivi présent (constat présent, faille déclarée rattachée), avec la priorité qui fixe son délai
    // (celle des listes : toutes les CVE du constat et Tenable, présence « détectée » ; la CVE, présence « déclarée »).
    // Lot PERF-04 : une seule passe par constat. Les sources de toutes ses CVE (et de Tenable) donnent la priorité de son
    // délai ; pour un constat d'au plus une CVE, ce sont aussi celles de sa faille (même priorité, calculée une fois). Les
    // sources d'une faille ne sont calculées que pour un constat non traité (seul à donner une priorité).
    const objets: ObjetDelai[] = [];
    for (const c of constats) {
      const tenable: FaitsTenable = {
        gravite: c.gravite,
        cvss3: nombre(c.cvss3_score),
        epss: nombre(c.epss_score),
        exploitable: c.exploitable,
        malware: c.exploite_malware,
      };
      const sTout = sourcesDe(
        c.cves.flatMap((cve) => (faits.has(cve) ? [faits.get(cve)!] : [])),
        tenable,
      );
      const pTout = priorite(sTout, 'detectee');
      objets.push({
        nature: 'constat',
        id: c.id,
        etat: c.etat ?? 'nouvelle',
        priorite: pTout.niveau,
        premiere: c.premiere.toISOString(),
        repart: iso(c.repart),
        machines: c.machines,
        cves: c.cves,
        nom: c.nom,
        finSupportLe: iso(c.fin_support_le),
      });
      const seule = c.cves.length <= 1;
      const cibles = c.cves.length
        ? c.cves.map((cve) => ({ x: cumul(cleAlerte({ cve }), cve), cve }))
        : [{ x: cumul(cleAlerte({ constatId: c.id }), null), cve: null }];
      const publie = iso(c.correctif_publie_le);
      for (const { x, cve } of cibles) {
        x.objets++;
        x.constats.push(c.nom);
        if (publie && (!x.correctifTenableLe || publie < x.correctifTenableLe)) x.correctifTenableLe = publie;
        if (c.clos) {
          x.traites++;
          continue;
        }
        const s = seule ? sTout : sourcesDe(cve && faits.has(cve) ? [faits.get(cve)!] : [], tenable);
        x.priorites.push(seule ? pTout : priorite(s, 'detectee'));
        x.presences.add('detectee');
        if (s.exploitable.length) x.exploitable = true;
        // Lot N2 : exploitation avérée selon Tenable (contrôle présent, non traité), gardée avec la faille.
        if (c.exploite_malware) x.malware = true;
        for (const m of c.machines) x.machines.add(m);
        retenir(x, s);
        x.constatIds.push(c.id);
        x.etats.push(c.etat ?? 'nouvelle');
      }
    }
    for (const r of declarees)
      objets.push({
        nature: 'declaree',
        id: r.id,
        etat: r.etat ?? 'nouvelle',
        priorite: priorite(sourcesCve(r.cve), 'declaree').niveau,
        premiere: r.premiere.toISOString(),
        repart: iso(r.repart),
        machines: r.machines,
        cves: [r.cve],
        nom: `${r.editeur} ${r.nom}`,
      });
    // Objets suivis rendus dans l'ordre de leur identifiant (constats, puis failles déclarées) : les listes du rapport qui
    // les rangent par date (dépassements, fins de support) départagent les dates égales toujours de la même façon.
    objets.sort((a, b) =>
      a.nature !== b.nature ? (a.nature === 'constat' ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    for (const r of declarees) {
      const x = cumul(cleAlerte({ cve: r.cve }), r.cve);
      x.objets++;
      x.produitsDeclares.push({ editeur: r.editeur, nom: r.nom });
      if (r.clos) {
        x.traites++;
        continue;
      }
      x.priorites.push(priorite(sourcesCve(r.cve), 'declaree'));
      x.presences.add('declaree');
      if (sourcesCve(r.cve).exploitable.length) x.exploitable = true;
      x.produits.add(r.produit_id);
      for (const m of r.machines) x.machines.add(m);
      retenir(x, sourcesCve(r.cve));
      x.rapprochementIds.push(r.id);
      x.etats.push(r.etat ?? 'nouvelle');
      x.familles.push(r.famille);
      x.produitIds.push(r.produit_id);
    }
    for (const [cve, e] of expositions) {
      if (!e.cles.size && !e.actifs.size) continue;
      const x = cumul(cleAlerte({ cve }), cve);
      const mene = [...e.actifs].some((a) => menants.has(a));
      x.priorites.push(majorerPriorite(priorite(sourcesCve(cve), 'exposee'), mene));
      x.presences.add('exposee');
      if (sourcesCve(cve).exploitable.length) x.exploitable = true;
      x.actifs = e.cles.size;
      x.actifIds = [...e.actifs];
      retenir(x, sourcesCve(cve));
    }
    // Vue d'ensemble seulement : produits à confirmer (rapprochements proposés). Rien n'entre dans `priorites`, `presences`
    // ni `objets` : l'évaluation des alertes, qui ne remet aucune proposition, n'en est pas changée.
    for (const r of propositions) {
      const x = cumul(cleAlerte({ cve: r.cve }), r.cve);
      const p = priorite(sourcesCve(r.cve), 'a_confirmer');
      if (!x.aConfirmer || rangPriorite(p) < rangPriorite(x.aConfirmer)) x.aConfirmer = p;
      x.produitsDeclares.push({ editeur: r.editeur, nom: r.nom });
      x.familles.push(r.famille);
      x.produitIds.push(r.produit_id);
      retenir(x, sourcesCve(r.cve));
    }
    // Sources de l'exploitation (rangées, avec leur date), gardées avec la CVE.
    for (const x of cumuls.values()) if (x.cve) sourcesCve(x.cve);
    // Failles rendues dans l'ordre de leur clé (CVE, puis « constat:<identifiant> ») : les listes qui en reprennent l'ordre
    // (failles critiques du rapport, bornées) ne dépendent plus de l'ordre des lignes en base (lot PERF-04).
    const ranges = new Map([...cumuls].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    return { cumuls: ranges, sources: cache, objets };
  }

  /** Titre et produit des CVE à alerter, lus dans la veille (catalogue KEV, puis produit de NVD). */
  async titres(k: Kdb, cves: readonly string[]) {
    const liste = [...new Set(cves)];
    if (!liste.length) return new Map<string, { titre: string | null; produit: string | null }>();
    const { rows } = await sql<{
      cve: string;
      kev_nom: string | null;
      kev_produit: string | null;
      produit: string | null;
    }>`
      SELECT cve, kev_nom, kev_produit, produits[1] AS produit FROM vulnerabilites_veille_cve
      WHERE cve = ANY(${liste}::text[])`.execute(k);
    return new Map(rows.map((r) => [r.cve, { titre: r.kev_nom, produit: r.kev_produit ?? r.produit }]));
  }

  /** Faits rangés d'une alerte : priorité retenue, présences, sources de l'exploitation, nombres globaux, titre, produit. */
  private faits(
    x: Cumul,
    p: Priorite,
    titres: Map<string, { titre: string | null; produit: string | null }>,
    sources: Map<string, SourcesFailleDto>,
  ): FaitsAlerte {
    const { titre, produit } = this.titreEtProduit(x, titres);
    return {
      priorite: p,
      presences: PRESENCES.filter((s) => x.presences.has(s)),
      exploitation: exploitationDeCumul(x, sources),
      nombres: { machines: x.machines.size, produits: x.produits.size, actifs: x.actifs },
      titre,
      produit,
    };
  }

  /** Notifications aux comptes actifs qui lisent le module : une par alerte critique (création ou montée), une par personne,
      alerte et niveau ; pour les alertes simples ouvertes par cette évaluation, un seul résumé par personne (leur nombre et
      un lien vers l'onglet « Alertes » filtré), aucun quand il n'y en a pas. Rend le nombre d'alertes notifiées. */
  private async notifier(
    k: Kdb,
    c: Client,
    alertes: { id: string; niveau: NiveauAlerte; cve: string | null; produit: string | null }[],
  ): Promise<number> {
    const critiques = alertes.filter((a) => a.niveau === 'critique');
    const simples = alertes.filter((a) => a.niveau === 'simple');
    if (!critiques.length && !simples.length) return 0;
    const destinataires = await this.destinataires(c);
    const emises: NotificationEmise[] = [];
    const inserer = async (uid: string, kind: string, cle: string, titre: string, message: string) => {
      const { rows } = await sql<{ id: string }>`
        INSERT INTO grc_notifications (smsi_id, object_id, user_id, kind, due_key, title, message)
        VALUES (NULL, NULL, ${uid}::uuid, ${kind}, ${cle}, ${titre}, ${message})
        ON CONFLICT (user_id, due_key) WHERE kind IN ('vulnerabilites_alerte_critique', 'vulnerabilites_alerte')
        DO NOTHING RETURNING id::text AS id`.execute(k);
      if (rows[0]) emises.push({ id: rows[0].id, userId: uid, kind });
    };
    for (const a of critiques) {
      const titre = titreNotificationAlerte(a).slice(0, 180);
      for (const uid of destinataires)
        await inserer(uid, KIND.critique, `${a.id}:critique`, titre, MESSAGE_NOTIFICATION_ALERTE);
    }
    if (simples.length) {
      // Clé propre à cette évaluation : un résumé par personne et par évaluation.
      const cle = `${PREFIXE_RESUME_ALERTES}${randomUUID()}`;
      const titre = titreResumeAlertes(simples.length);
      for (const uid of destinataires) await inserer(uid, KIND.simple, cle, titre, MESSAGE_RESUME_ALERTES);
    }
    const notifiees = [...critiques, ...simples].map((a) => a.id);
    await k.updateTable('vulnerabilites_alertes').set({ notifiee: true }).where('id', 'in', notifiees).execute();
    await this.notifications.diffuser(c, emises);
    return notifiees.length;
  }

  /** Comptes actifs qui ont le droit de lire le module (rôles directs ou par un groupe). */
  private destinataires(c: Client): Promise<string[]> {
    return lecteursDuModule(c);
  }

  /* ---------------------------------------------------------------- Lecture (vulnerabilites:lire) */
  /** La personne tient le rôle « RSSI » de la plateforme (ROLE_PRISE_EN_COMPTE_ALERTE), directement ou par un groupe,
      sans portée qui écarte le module (décision B du 18/11/2026). Lu à chaque appel : un retrait du rôle vaut aussitôt. */
  async peutPrendreEnCompte(user: SessionUser, c?: Client): Promise<boolean> {
    return tientLeRoleRssi(this.db, user, c);
  }

  async lister(user: SessionUser, q: RechercheAlertesVulnerabilites): Promise<PageAlertesVulnerabilites> {
    const conditions = [
      q.etat === 'actives'
        ? sql<boolean>`a.etat <> 'close'`
        : q.etat === 'toutes'
          ? sql<boolean>`true`
          : sql<boolean>`a.etat = ${q.etat}`,
      q.niveau ? sql<boolean>`a.niveau = ${q.niveau}` : sql<boolean>`true`,
    ];
    const { rows } = await sql<LigneAlerte & { total: number }>`
      SELECT a.*, count(*) OVER ()::int AS total FROM vulnerabilites_alertes a
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY CASE a.etat WHEN 'ouverte' THEN 0 WHEN 'prise_en_compte' THEN 1 ELSE 2 END,
               CASE a.niveau WHEN 'critique' THEN 0 ELSE 1 END,
               coalesce(a.critique_le, a.ouverte_le) DESC, a.id
      LIMIT ${ALERTES_PAR_PAGE} OFFSET ${(q.page - 1) * ALERTES_PAR_PAGE}`.execute(this.db.k);
    return {
      elements: await this.versDto(user, rows),
      total: rows[0]?.total ?? 0,
      page: q.page,
      parPage: ALERTES_PAR_PAGE,
      peutPrendreEnCompte: await this.peutPrendreEnCompte(user),
    };
  }

  async lire(user: SessionUser, id: string): Promise<AlerteVulnerabiliteDto> {
    const { rows } = await sql<LigneAlerte>`SELECT * FROM vulnerabilites_alertes WHERE id = ${id}::uuid`.execute(
      this.db.k,
    );
    if (!rows[0]) throw new HttpError(404, INTROUVABLE);
    return (await this.versDto(user, rows))[0]!;
  }

  /** Fenêtre d'alerte critique : alertes critiques ouvertes non prises en compte, la plus récente en tête (bornées). */
  async fenetre(user: SessionUser): Promise<FenetreAlertesDto> {
    const { rows } = await sql<LigneAlerte & { total: number; en_cours: number }>`
      SELECT a.*, count(*) OVER ()::int AS total,
        (SELECT count(*)::int FROM vulnerabilites_alertes x WHERE x.niveau = 'critique' AND x.etat <> 'close') AS en_cours
      FROM vulnerabilites_alertes a WHERE a.niveau = 'critique' AND a.etat = 'ouverte'
      ORDER BY a.critique_le DESC, a.id LIMIT ${ALERTES_FENETRE_MAX}`.execute(this.db.k);
    const enCours = rows[0]
      ? rows[0].en_cours
      : ((
          await sql<{ n: number }>`SELECT count(*)::int AS n FROM vulnerabilites_alertes
            WHERE niveau = 'critique' AND etat <> 'close'`.execute(this.db.k)
        ).rows[0]?.n ?? 0);
    return {
      alertes: await this.versDto(user, rows),
      total: rows[0]?.total ?? 0,
      enCours,
      peutPrendreEnCompte: await this.peutPrendreEnCompte(user),
    };
  }

  /** Lignes rendues avec les nombres que la personne lit (machines par leur périmètre effectif, actifs exposés par leur
      périmètre ALH relié) ; une alerte close ne compte plus rien. */
  private async versDto(user: SessionUser, lignes: LigneAlerte[]): Promise<AlerteVulnerabiliteDto[]> {
    const actives = lignes.filter((l) => l.etat !== 'close');
    const machines = await this.machinesLisibles(
      user,
      actives.map((l) => l.cle),
    );
    const cves = actives.flatMap((l) => (l.cve ? [l.cve] : []));
    const surface = cves.length ? await this.surface.surfaceDesCves(user, cves) : new Map();
    const vide: NombreLisible = { lisibles: 0, horsLecture: false };
    return lignes.map((l) => {
      const actif = l.etat !== 'close';
      const s = actif && l.cve ? surface.get(l.cve) : undefined;
      return {
        id: l.id,
        cle: l.cle,
        cve: l.cve,
        titre: l.titre,
        produit: l.produit,
        niveau: l.niveau,
        priorite: l.faits.priorite,
        presences: l.faits.presences,
        exploitation: l.faits.exploitation,
        etat: l.etat,
        ouverteLe: l.ouverte_le.toISOString(),
        critiqueLe: iso(l.critique_le),
        majLe: l.maj_le.toISOString(),
        priseEnCompte: l.prise_par && l.prise_le ? { par: l.prise_par, le: l.prise_le.toISOString() } : null,
        cloture:
          l.etat === 'close' && l.close_le && l.motif_cloture
            ? { le: l.close_le.toISOString(), motif: l.motif_cloture }
            : null,
        notifiee: l.notifiee,
        machines: actif ? (machines.get(l.cle) ?? vide) : vide,
        actifs: s ? { lisibles: s.actifs, horsLecture: s.horsLecture } : vide,
        produits: actif ? l.faits.nombres.produits : 0,
        version: l.version,
      };
    });
  }

  /** Machines touchées par chaque faille (constats présents et non traités, failles déclarées rattachées et non traitées),
      comptées parmi celles que la personne lit, avec un drapeau quand il y en a d'autres. */
  private async machinesLisibles(user: SessionUser, cles: readonly string[]): Promise<Map<string, NombreLisible>> {
    const cves = cles.filter((c) => c.startsWith('CVE-'));
    const constats = cles.filter((c) => c.startsWith('constat:')).map((c) => c.slice('constat:'.length));
    if (!cves.length && !constats.length) return new Map();
    const { rows } = await sql<{ cle: string; lisibles: number; total: number }>`
      SELECT x.cle, count(DISTINCT x.machine_id) FILTER (WHERE x.lu)::int AS lisibles,
        count(DISTINCT x.machine_id)::int AS total
      FROM (
        SELECT cc.cve AS cle, m.id AS machine_id, ${lisible(user)} AS lu
        FROM vulnerabilites_constat_cves cc
        JOIN vulnerabilites_constats c ON c.id = cc.constat_id
        JOIN vulnerabilites_detections d ON d.constat_id = c.id
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE cc.cve = ANY(${cves}::text[]) AND ${present} AND NOT ${close('constat')}
        UNION ALL
        SELECT 'constat:' || c.id::text, m.id, ${lisible(user)}
        FROM vulnerabilites_constats c
        JOIN vulnerabilites_detections d ON d.constat_id = c.id
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE c.id = ANY(${constats}::uuid[]) AND ${present} AND NOT ${close('constat')}
        UNION ALL
        SELECT r.cve, m.id, ${lisible(user)}
        FROM vulnerabilites_rapprochements r
        JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id
        JOIN vulnerabilites_machines m ON m.id = pm.machine_id
        WHERE r.cve = ANY(${cves}::text[]) AND r.statut IN ('rattachee', 'confirmee') AND NOT ${close('declaree')}
      ) x GROUP BY x.cle`.execute(this.db.k);
    return new Map(rows.map((r) => [r.cle, { lisibles: r.lisibles, horsLecture: r.total > r.lisibles }]));
  }

  /* ---------------------------------------------------------------- Prise en compte (rôle RSSI seulement) */
  async prendreEnCompte(id: string, attendue: number, user: SessionUser, ip: string): Promise<AlerteVulnerabiliteDto> {
    await this.db.tx(async (c, k) => {
      if (!(await this.peutPrendreEnCompte(user, c))) throw new HttpError(403, PRISE_EN_COMPTE_RESERVEE);
      await verrou(k);
      const { rows } =
        await sql<LigneAlerte>`SELECT * FROM vulnerabilites_alertes WHERE id = ${id}::uuid FOR UPDATE`.execute(k);
      const l = rows[0];
      if (!l) throw new HttpError(404, INTROUVABLE);
      if (l.version !== attendue) throw conflict({ version: l.version, updated_by: l.updated_by } as never);
      if (l.etat === 'close')
        throw new HttpError(409, 'Cette alerte est close : il n’y a plus rien à prendre en compte.');
      if (l.etat === 'prise_en_compte') throw new HttpError(409, 'Cette alerte est déjà prise en compte.');
      await k
        .updateTable('vulnerabilites_alertes')
        .set((eb) => ({
          etat: 'prise_en_compte',
          prise_par: user.displayName || user.username,
          prise_le: sql<Date>`now()`,
          version: eb('version', '+', 1),
          updated_by: user.username,
        }))
        .where('id', '=', id)
        .execute();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.alerte.prise_en_compte',
        id,
        { cle: l.cle, niveau: l.niveau, version: l.version + 1 },
        c,
      );
    }, user.username);
    return this.lire(user, id);
  }
}

/** Comptes actifs qui ont le droit de lire le module Vulnérabilités (rôles directs ou par un groupe) : destinataires des
    notifications du module (alertes, lot V6 ; délais et exceptions, lot S1). */
export async function lecteursDuModule(c: Client): Promise<string[]> {
  const comptes = await sql<{
    id: string;
  }>`SELECT u.id::text AS id FROM users u WHERE ${COMPTE_ACTIF} ORDER BY u.username`.execute(surConnexion(c));
  const out: string[] = [];
  for (const u of comptes.rows)
    if (new Rights(effectivePermissions(await loadGrants(c, u.id)).keys()).can('vulnerabilites', 'lire'))
      out.push(u.id);
  return out;
}
