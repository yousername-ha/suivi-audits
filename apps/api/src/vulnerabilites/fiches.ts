/* Module Vulnérabilités (ADR 0100, point 19 et décision V10 ; lot PC4) : fiche d'une faille illustrée, commune aux quatre
   fiches existantes (constat de Tenable, faille déclarée, CVE de la veille, alerte d'AlgoLightHouse). Lecture seule, sans
   journal, sans appel réseau ni appel au modèle : tout vient de ce qui est déjà rangé.
   - Droits : le constat, la faille déclarée et l'alerte se lisent par leur fiche existante (même 404 pour ce qui est
     illisible ou inconnu) ; une CVE de la veille se lit avec `vulnerabilites:lire`, comme la veille.
   - Priorité, faits et marques : les mêmes pour tout le monde (lot ALH5) ; les nombres de machines et d'actifs sont ceux que
     la personne lit, avec un drapeau sans nombre pour le reste ; aucun nom n'est rendu ici.
   - Vecteurs : ceux de NVD (v3.1 et v4.0, par CVE, lot V2) et celui du contrôle de Tenable (v3, lot V5), déjà rangés ; la
     plateforme choisit celui qui parle (règle des sources, paquet partagé). Aucun champ nouveau, aucune migration.
   - Recommandations par source, telles quelles, bornées : correctif de Tenable, action exigée du catalogue KEV, versions
     touchées selon NVD, mentions du CERT Santé, avis du CERT-FR et du CERT Santé, défauts et résolutions de l'éditeur
     d'AlgoLightHouse (alertes lisibles seulement).
   Lot S3 : état du correctif (date de publication du correctif de Tenable, mention « Un correctif existe » du CERT Santé),
   avec la source qui parle, précision de l'exploitation (« exploitée, sans correctif connu »…) et fin de support (date
   `seolDate` de Tenable pour un constat ; service exposé `version_status = eol` d'AlgoLightHouse pour une alerte). Pour une
   faille déclarée, une CVE ou une alerte, Tenable parle s'il cite la CVE dans un contrôle qui porte une date de correctif
   (une lecture de plus, fixe).
   Lot QF-TEN : rubrique « Correctif recommandé par Tenable » d'un constat ou d'une CVE : les correctifs regroupés de Tenable
   (vue `sumremediation`, dernière synchronisation reçue en entier) qui couvrent le constat, ou un constat qui cite la CVE ;
   machines comptées selon les droits (une lecture de plus, fixe ; aucune pour une faille déclarée ou une alerte).
   Nombre de lectures fixe (aucune par CVE ni par élément). */
import {
  etatCorrectif,
  etatFinSupport,
  serviceEnFinDeSupport,
  situationExploitation,
  calculerPriorite,
  type AvisFicheDto,
  type CorrectifRegroupeFicheDto,
  FICHE_FAILLE_BORNES,
  type FicheFailleDto,
  faitsDepuisSources,
  marquesFaille,
  type MentionCertSante,
  type NatureFicheFaille,
  type NiveauAlerte,
  type NiveauPriorite,
  type Presence,
  type Priorite,
  type RecommandationsFicheDto,
  type SourcesFailleDto,
  STATUTS_ALERTE_ALH_OUVERTS,
  type VecteurPublieDto,
  type VersionsNvdDto,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Db, Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { FaillesDetectees } from './failles.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { lireFaitsCve, sourcesDe } from './sources.js';
import { cveSurMachineFinSupport, lisible, present } from './sql.js';
import type { SurfaceExterneAlh } from './surface-externe.js';

const B = FICHE_FAILLE_BORNES;

/** Une CVE a sa fiche (lot PC4) : connue de la veille, citée par un contrôle de Tenable, rapprochée d'un produit surveillé
    (proposée, rattachée ou confirmée) ou exposée sur Internet (version encore détectée d'une technologie, alerte ouverte et
    présente, quels que soient les droits : lot ALH5). Seule définition : la fiche d'une CVE (404 sinon) et la CVE inconnue
    de la veille (lot CVE-INC : `connue` des compléments, ouverture, consultation) l'emploient. Une CVE citée seulement par
    une alerte close ou par une technologie qui n'est plus détectée n'a pas de fiche. */
export async function cveAUneFiche(
  k: Kdb,
  surface: Pick<SurfaceExterneAlh, 'cvesExposees'>,
  cve: string,
): Promise<boolean> {
  const { rows } = await sql<{ a: boolean }>`
    SELECT EXISTS (SELECT 1 FROM vulnerabilites_veille_cve WHERE cve = ${cve})
      OR EXISTS (SELECT 1 FROM vulnerabilites_constat_cves WHERE cve = ${cve})
      OR EXISTS (SELECT 1 FROM vulnerabilites_rapprochements WHERE cve = ${cve}
                   AND statut IN ('proposee', 'rattachee', 'confirmee')) AS a`.execute(k);
  return !!rows[0]?.a || (await surface.cvesExposees([cve])).has(cve);
}
const nombre = (v: string | number | null) => (v === null ? null : Number(v));
const SANS_SOURCES: SourcesFailleDto = {
  exploitation: [],
  exploitable: [],
  valeurs: { gravites: [], cvss: [], epss: [] },
  certSante: null,
};

/** Ce que chaque nature apporte à la partie commune. */
interface Entree {
  nature: NatureFicheFaille;
  cves: string[];
  priorite: Priorite | null;
  sources: SourcesFailleDto;
  presente: boolean;
  machines: number | null;
  machinesHorsLecture: boolean;
  composant: string | null;
  tenable: { vecteur: string | null; score: number | null; correctif: string | null; publieLe: string | null } | null;
  /** Clés d'alerte de la plateforme (CVE, ou « constat:<id> » pour un constat sans CVE). */
  cles: string[];
  /** Défauts de l'alerte d'AlgoLightHouse elle-même (nature `alerte-alh`). */
  alh: RecommandationsFicheDto['alh'] | null;
  /** Actifs exposés lus, s'ils sont déjà connus (alerte d'AlgoLightHouse : son actif). */
  actifs: number | null;
  /** Lot S1 : délai de correction et exception d'un objet suivi (constat, faille déclarée). */
  delai?: FicheFailleDto['delai'];
  exception?: FicheFailleDto['exception'];
  /** Lot S3 : date de publication du correctif selon le contrôle de Tenable (constat) ; absent : lue sur les contrôles qui
      citent les CVE de la faille. */
  correctifTenableLe?: string | null;
  finSupport?: FicheFailleDto['finSupport'];
  /** Lot QF-TEN : constat dont on cherche les correctifs regroupés de Tenable (nature `constat`). */
  constatId?: string;
}

export class FichesFailles {
  constructor(
    private db: Db,
    private failles: FaillesDetectees,
    private surface: SurfaceExterneAlh,
    private reglage: ReglagePrioriteVulnerabilites,
  ) {}

  async fiche(user: SessionUser, nature: NatureFicheFaille, id: string): Promise<FicheFailleDto> {
    const e =
      nature === 'constat'
        ? await this.constat(user, id)
        : nature === 'declaree'
          ? await this.declaree(user, id)
          : nature === 'alerte-alh'
            ? await this.alerteAlh(user, id)
            : await this.cve(user, id);
    return this.commun(user, e);
  }

  /* ---------------------------------------------------------------- Natures */
  private async constat(user: SessionUser, id: string): Promise<Entree> {
    const c = await this.failles.constat(user, id);
    const cves = c.cvesDetail.map((x) => x.cve);
    const lues = new Set(Object.values(c.parRole).flatMap((l) => l.map((d) => d.machineId)));
    const { rows } = await sql<{ hors: boolean }>`SELECT EXISTS (SELECT 1 FROM vulnerabilites_detections d
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE d.constat_id = ${id}::uuid AND (${present} OR NOT ${c.present}::boolean) AND NOT ${lisible(user)}) AS hors`.execute(
      this.db.k,
    );
    return {
      nature: 'constat',
      constatId: c.id,
      cves,
      priorite: c.priorite,
      sources: c.sources,
      presente: c.present,
      machines: lues.size,
      machinesHorsLecture: rows[0]!.hors,
      composant: (await this.produitDesCves(cves)) ?? c.nom,
      tenable: { vecteur: c.cvss3Vecteur, score: c.cvss3Score, correctif: c.correctif, publieLe: c.correctifLe },
      cles: cves.length ? cves : [`constat:${c.id}`],
      alh: null,
      actifs: null,
      delai: c.delai,
      exception: c.suivi.exceptionStatut ? { statut: c.suivi.exceptionStatut, echeance: c.suivi.revueLe } : null,
      correctifTenableLe: c.correctifLe,
      finSupport: (() => {
        const etat = etatFinSupport(c.finSupportLe, new Date());
        return etat ? { etat, le: c.finSupportLe, source: 'tenable' as const } : null;
      })(),
    };
  }

  private async declaree(user: SessionUser, id: string): Promise<Entree> {
    const f = await this.failles.declaree(user, id);
    const { rows } = await sql<{ hors: boolean }>`SELECT EXISTS (SELECT 1 FROM vulnerabilites_rapprochements r
        JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id
        JOIN vulnerabilites_machines m ON m.id = pm.machine_id
        WHERE r.id = ${id}::uuid AND NOT ${lisible(user)}) AS hors`.execute(this.db.k);
    return {
      nature: 'declaree',
      cves: [f.cve],
      priorite: f.priorite,
      sources: f.sources,
      presente: f.present,
      machines: f.machinesReliees.length,
      machinesHorsLecture: rows[0]!.hors,
      composant: `${f.produit.editeur} ${f.produit.nom} ${f.produit.versionProduit}`,
      tenable: null,
      cles: [f.cve],
      alh: null,
      actifs: null,
      delai: f.delai,
      exception: f.suivi.exceptionStatut ? { statut: f.suivi.exceptionStatut, echeance: f.suivi.revueLe } : null,
    };
  }

  private async alerteAlh(user: SessionUser, id: string): Promise<Entree> {
    const a = await this.surface.alerte(user, id);
    const cves = a.cvesDetail.map((x) => x.cve);
    const ouverte = STATUTS_ALERTE_ALH_OUVERTS.includes(a.statut);
    // Faits de la faille : ceux de la CVE de plus haute priorité de l'alerte (la priorité de l'alerte est la sienne).
    const tete = a.cvesDetail[0];
    const service = a.services.find((s) => s.produit);
    return {
      nature: 'alerte-alh',
      cves,
      priorite: a.priorite,
      sources: tete
        ? {
            ...tete.sources,
            exploitation: a.cvesDetail.flatMap((x) => x.sources.exploitation),
            exploitable: a.cvesDetail.flatMap((x) => x.sources.exploitable),
          }
        : SANS_SOURCES,
      presente: ouverte,
      machines: null,
      machinesHorsLecture: false,
      composant: service
        ? [service.produit, service.version].filter(Boolean).join(' ')
        : ((await this.produitDesCves(cves)) ?? 'Actif exposé visé par l’alerte'),
      tenable: null,
      cles: cves,
      alh: a.defauts.length ? [{ alerteId: a.id, titre: a.titre, defauts: a.defauts }] : [],
      // L'actif visé (hôte ou domaine) se lit avec l'alerte ; une alerte sur un service ou un mot-clé n'en a pas.
      actifs: a.cible?.type === 'host' || a.cible?.type === 'domain' ? 1 : 0,
      finSupport: a.services.some((x) => serviceEnFinDeSupport(x.statutVersion))
        ? { etat: 'atteinte', le: null, source: 'alh' }
        : null,
    };
  }

  private async cve(user: SessionUser, cve: string): Promise<Entree> {
    const k = this.db.k;
    if (!(await cveAUneFiche(k, this.surface, cve))) throw new HttpError(404, 'Faille introuvable.');
    const faits = (await lireFaitsCve(k, [cve])).get(cve) ?? null;
    const { rows: t } = await sql<{ origine: 'd' | 'p'; lu: boolean }>`
      SELECT 'd' AS origine, ${lisible(user)} AS lu FROM vulnerabilites_constat_cves cc
        JOIN vulnerabilites_detections d ON d.constat_id = cc.constat_id
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE cc.cve = ${cve} AND ${present}
      UNION ALL
      SELECT 'p', ${lisible(user)} FROM vulnerabilites_rapprochements r
        JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id
        JOIN vulnerabilites_machines m ON m.id = pm.machine_id
        WHERE r.cve = ${cve} AND r.statut IN ('rattachee', 'confirmee')`.execute(k);
    const { rows: rr } = await sql<{ rattachee: boolean; proposee: boolean; fin_support: boolean }>`
      SELECT EXISTS (SELECT 1 FROM vulnerabilites_rapprochements WHERE cve = ${cve}
                       AND statut IN ('rattachee', 'confirmee')) AS rattachee,
             ${cveSurMachineFinSupport(cve)} AS fin_support,
             EXISTS (SELECT 1 FROM vulnerabilites_rapprochements WHERE cve = ${cve} AND statut = 'proposee') AS proposee`.execute(
      k,
    );
    const r = rr[0]!;
    const exposition = await this.surface.expositionFiche(user, [cve], 0);
    const detectee = t.some((x) => x.origine === 'd');
    const presence: Presence = detectee
      ? 'detectee'
      : r.rattachee
        ? 'declaree'
        : exposition.exposee
          ? 'exposee'
          : r.proposee
            ? 'a_confirmer'
            : 'absente';
    const sources = sourcesDe(faits ? [faits] : []);
    // Machines distinctes : une même machine peut être détectée et reliée ; compter sans doublon demande les identifiants.
    const { rows: n } = await sql<{ lues: number }>`
      SELECT count(DISTINCT m.id)::int AS lues FROM vulnerabilites_machines m
      WHERE ${lisible(user)} AND (
        EXISTS (SELECT 1 FROM vulnerabilites_detections d JOIN vulnerabilites_constat_cves cc ON cc.constat_id = d.constat_id
                LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
                WHERE d.machine_id = m.id AND cc.cve = ${cve} AND ${present})
        OR EXISTS (SELECT 1 FROM vulnerabilites_rapprochements r JOIN vulnerabilites_produits_machines pm
                     ON pm.produit_id = r.produit_id
                   WHERE pm.machine_id = m.id AND r.cve = ${cve} AND r.statut IN ('rattachee', 'confirmee')))`.execute(
      k,
    );
    return {
      nature: 'cve',
      cves: [cve],
      // Lot PRIO-1 : un cran de plus si la CVE est présente sur une machine en fin de support.
      priorite: calculerPriorite(
        { ...faitsDepuisSources(sources), presence, finDeSupport: r.fin_support },
        await this.reglage.valeurs(),
      ),
      sources,
      presente: presence === 'detectee' || presence === 'declaree' || presence === 'exposee',
      machines: n[0]!.lues,
      machinesHorsLecture: t.some((x) => !x.lu),
      composant: await this.produitDesCves([cve]),
      tenable: null,
      cles: [cve],
      alh: null,
      actifs: null,
    };
  }

  /* ---------------------------------------------------------------- Partie commune */
  /** Produit touché, d'après le catalogue KEV, sinon NVD (premier éditeur et premier produit des CPE). */
  private async produitDesCves(cves: readonly string[]): Promise<string | null> {
    if (!cves.length) return null;
    const { rows } = await sql<{ produit: string | null }>`
      SELECT coalesce(nullif(concat_ws(' ', kev_editeur, kev_produit), ''),
                      nullif(concat_ws(' ', editeurs[1], produits[1]), '')) AS produit
      FROM vulnerabilites_veille_cve WHERE cve = ANY(${cves.slice(0, B.cves)}::text[])
      ORDER BY (kev_produit IS NULL), cve LIMIT 1`.execute(this.db.k);
    return rows[0]?.produit ?? null;
  }

  private async commun(user: SessionUser, e: Entree): Promise<FicheFailleDto> {
    const k = this.db.k;
    const cves = [...new Set(e.cves)].slice(0, B.cves);
    const { rows: nvd } = await sql<{
      cve: string;
      cvss31_vecteur: string | null;
      cvss31_score: string | null;
      cvss40_vecteur: string | null;
      cvss40_score: string | null;
      kev_action: string | null;
      kev_echeance: string | null;
    }>`SELECT cve, cvss31_vecteur, cvss31_score, cvss40_vecteur, cvss40_score, kev_action, kev_echeance::text AS kev_echeance
       FROM vulnerabilites_veille_cve WHERE cve = ANY(${cves}::text[])
         AND (cvss31_vecteur IS NOT NULL OR cvss40_vecteur IS NOT NULL OR kev_action IS NOT NULL)
       ORDER BY greatest(coalesce(cvss31_score, 0), coalesce(cvss40_score, 0)) DESC, cve`.execute(k);
    const vecteurs: VecteurPublieDto[] = [];
    if (e.tenable?.vecteur)
      vecteurs.push({ source: 'tenable', cve: null, brut: e.tenable.vecteur, score: e.tenable.score });
    for (const l of nvd) {
      if (l.cvss40_vecteur)
        vecteurs.push({ source: 'nvd', cve: l.cve, brut: l.cvss40_vecteur, score: nombre(l.cvss40_score) });
      if (l.cvss31_vecteur)
        vecteurs.push({ source: 'nvd', cve: l.cve, brut: l.cvss31_vecteur, score: nombre(l.cvss31_score) });
    }
    const kev = nvd
      .filter((l) => l.kev_action)
      .sort((a, b) => (a.kev_echeance ?? '9999').localeCompare(b.kev_echeance ?? '9999') || a.cve.localeCompare(b.cve))
      .map((l) => ({ cve: l.cve, action: l.kev_action!, echeance: l.kev_echeance }));
    const { rows: versions } = await sql<{
      cve: string;
      editeur: string;
      produit: string;
      version: string | null;
      debut_inclus: string | null;
      debut_exclus: string | null;
      fin_inclus: string | null;
      fin_exclus: string | null;
    }>`SELECT cve, editeur, produit, version, debut_inclus, debut_exclus, fin_inclus, fin_exclus
       FROM vulnerabilites_veille_cve_produits
       WHERE cve = ANY(${cves}::text[]) AND vulnerable AND (fin_inclus IS NOT NULL OR fin_exclus IS NOT NULL)
       ORDER BY cve, rang LIMIT ${B.versionsNvd + 1}`.execute(k);
    const { rows: avis } = await sql<{
      source: 'cert-fr' | 'cert-sante';
      identifiant: string;
      nature: 'alerte' | 'avis';
      titre: string;
      adresse: string | null;
      le: Date;
    }>`SELECT source, identifiant, nature, titre, adresse, coalesce(publie_le, vu_le) AS le
       FROM vulnerabilites_veille_avis WHERE cves && ${cves}::text[]
       ORDER BY (source = 'cert-fr' AND nature = 'alerte') DESC, le DESC, identifiant LIMIT ${B.avis + 1}`.execute(k);
    const exposition = await this.surface.expositionFiche(user, cves, e.alh ? 0 : B.alertesAlh);
    const { rows: alertes } = e.cles.length
      ? await sql<{ id: string; niveau: NiveauAlerte; priorite: NiveauPriorite }>`
          SELECT id, niveau, priorite FROM vulnerabilites_alertes
          WHERE etat <> 'close' AND cle = ANY(${e.cles.slice(0, B.cves)}::text[])
          ORDER BY (niveau = 'critique') DESC, priorite, ouverte_le DESC, id LIMIT 1`.execute(k)
      : { rows: [] };
    const certSante: { correctif: MentionCertSante | null; contournement: MentionCertSante | null } | null =
      e.sources.certSante;
    // Lot S3 : date de publication du correctif selon Tenable, pour les CVE de la faille (une lecture, hors constat).
    let correctifTenableLe = e.correctifTenableLe ?? null;
    if (e.correctifTenableLe === undefined && cves.length) {
      const { rows: t } = await sql<{ le: Date | null }>`SELECT min(c.correctif_publie_le) AS le
        FROM vulnerabilites_constat_cves cc JOIN vulnerabilites_constats c ON c.id = cc.constat_id
        WHERE cc.cve = ANY(${cves}::text[])`.execute(k);
      correctifTenableLe = t[0]?.le?.toISOString() ?? null;
    }
    const correctif = etatCorrectif({ tenablePublieLe: correctifTenableLe, certSante: certSante?.correctif ?? null });
    const tenableRegroupes = await this.correctifsRegroupes(user, e);
    return {
      nature: e.nature,
      cves: e.cves.slice(0, B.cvesAffichees),
      nombreCves: e.cves.length,
      composant: e.composant,
      priorite: e.priorite,
      marques: marquesFaille(e.sources, e.presente),
      alerte: alertes[0] ?? null,
      presence: {
        machines: e.machines,
        actifs: e.actifs ?? exposition.actifs,
        horsLecture: e.machinesHorsLecture || (e.actifs === null && exposition.horsLecture),
      },
      vecteurs: vecteurs.slice(0, B.vecteurs),
      delai: e.delai ?? null,
      exception: e.exception ?? null,
      correctif,
      situationExploitation: situationExploitation(e.sources.exploitation.length > 0, correctif.etat),
      finSupport: e.finSupport ?? null,
      recommandations: {
        tenable: e.tenable ? { correctif: e.tenable.correctif, publieLe: e.tenable.publieLe } : null,
        tenableRegroupes,
        kev: kev.slice(0, B.kev),
        kevTronque: kev.length > B.kev,
        versionsNvd: versions.slice(0, B.versionsNvd).map((v): VersionsNvdDto => ({
          cve: v.cve,
          editeur: v.editeur,
          produit: v.produit,
          version: v.version,
          debutInclus: v.debut_inclus,
          debutExclus: v.debut_exclus,
          finInclus: v.fin_inclus,
          finExclus: v.fin_exclus,
        })),
        versionsNvdTronquees: versions.length > B.versionsNvd,
        certSante,
        avis: avis.slice(0, B.avis).map((a): AvisFicheDto => ({
          source: a.source,
          identifiant: a.identifiant,
          nature: a.nature,
          titre: a.titre,
          adresse: a.adresse,
          le: a.le.toISOString(),
        })),
        avisTronques: avis.length > B.avis,
        alh: e.alh ?? exposition.alertes.map((a) => ({ alerteId: a.id, titre: a.titre, defauts: a.defauts })),
        alhTronquees: e.alh ? false : exposition.alertesTronquees,
      },
    };
  }

  /** Lot QF-TEN : correctifs regroupés de Tenable qui couvrent un constat (nature `constat`) ou un constat qui cite la CVE
      (nature `cve`), parmi ceux de la dernière synchronisation reçue en entier de chaque instance ; une seule lecture. Les
      machines sont comptées selon les droits ; aucun nom ni aucune adresse n'est rendu. */
  private async correctifsRegroupes(user: SessionUser, e: Entree): Promise<CorrectifRegroupeFicheDto[]> {
    const couverts =
      e.nature === 'constat' && e.constatId
        ? sql`SELECT ${e.constatId}::uuid AS id`
        : e.nature === 'cve' && e.cves[0]
          ? sql`SELECT constat_id AS id FROM vulnerabilites_constat_cves WHERE cve = ${e.cves[0]}`
          : null;
    if (!couverts) return [];
    const { rows } = await sql<{
      identifiant: string;
      solution: string;
      cves: number | null;
      controles: number;
      lues: number;
      hors: boolean;
    }>`
      WITH t AS (
        SELECT DISTINCT tc.id, tc.solution_id, tc.solution, tc.cves FROM vulnerabilites_tenable_correctifs tc
        JOIN vulnerabilites_tenable_etat te ON te.integration_id = tc.integration_id AND te.correctifs_numero = tc.vu_numero
        JOIN vulnerabilites_tenable_correctif_constats l ON l.correctif_id = tc.id
        WHERE l.constat_id IN (${couverts})),
      x AS (
        SELECT l.correctif_id, d.machine_id, ${lisible(user)} AS lu FROM vulnerabilites_tenable_correctif_constats l
        JOIN vulnerabilites_detections d ON d.constat_id = l.constat_id
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE l.correctif_id IN (SELECT id FROM t) AND ${present})
      SELECT t.solution_id AS identifiant, t.solution, t.cves,
        (SELECT count(*)::int FROM vulnerabilites_tenable_correctif_constats l WHERE l.correctif_id = t.id) AS controles,
        (SELECT count(DISTINCT x.machine_id)::int FROM x WHERE x.correctif_id = t.id AND x.lu) AS lues,
        EXISTS (SELECT 1 FROM x WHERE x.correctif_id = t.id AND NOT x.lu) AS hors
      FROM t ORDER BY controles DESC, t.solution_id LIMIT ${B.correctifsRegroupes}`.execute(this.db.k);
    return rows.map((r) => ({
      identifiant: r.identifiant,
      solution: r.solution,
      controles: r.controles,
      cves: r.cves,
      machinesLues: r.lues,
      machinesHorsLecture: r.hors,
    }));
  }
}
