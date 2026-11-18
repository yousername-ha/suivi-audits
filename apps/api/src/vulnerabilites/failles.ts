/* Module Vulnérabilités (ADR 0100, lot V5) : failles détectées par Tenable Security Center et machines, en lecture et en
   affectation (rôle, périmètre). Droits du module contrôlés par route() ; ce service applique en plus les droits par
   périmètre (ADR 0100, point 14) :
   - une machine se lit à travers les droits de son périmètre (pyramide des ADR 0092 et 0095 : fonction grc_smsi_visible) ;
     une machine sans périmètre n'est lisible qu'avec vulnerabilites:administrer ;
   - un constat ne compte que les machines lisibles où il est présent ; sans aucune, il n'est ni listé ni ouvert ;
   - indiquer le rôle ou le périmètre exige vulnerabilites:modifier (route), l'écriture sur le périmètre actuel de la machine
     et sur le périmètre visé ; retirer le périmètre (la machine ne serait plus lisible que par l'administration du module)
     exige vulnerabilites:administrer. Choix le plus restrictif, à confirmer par le RSSI.
   « Présent » : détection vue par la dernière synchronisation complète de son instance, ou plus récemment (tenable.ts).
   « Exploité » : une CVE du constat figure au catalogue KEV rangé par la veille (jointure en lecture, aucun appel).
   « Non maintenu » : constat sans CVE (V18).
   Lot V4a : priorité de chaque constat (présence « détectée ») et de chaque faille déclarée (CVE rattachée à un produit
   relié à des machines lisibles, hors machines où Tenable détecte déjà la CVE), calculée par la fonction pure du paquet
   partagé avec le seuil réglé ; rang de chaque machine parmi celles que la personne peut lire, compteurs complétés des
   failles déclarées (comptées une fois, et pas si Tenable les détecte sur la machine). Listes calculées en mémoire puis
   filtrées et paginées : l'ordre et la priorité sont ceux de la fonction partagée, sans copie en SQL.
   Lot V4b : état de suivi de chaque faille (suivi.ts) et filtre d'état ; par défaut, les failles encore à traiter. Un constat
   qui n'est plus présent nulle part reste lisible par les machines où il a été vu en dernier (proposition « corrigée »,
   état décidé). Les failles corrigées, au risque accepté ou non concernées sortent des compteurs et du rang des machines ;
   la priorité reste calculée sur les faits.
   Lot V4c (V26, V27) : ce que chaque source dit des CVE (sources.ts) accompagne chaque faille ; la priorité prend
   l'exploitation avérée et « exploitable » selon toutes les sources, et la valeur la plus sévère de chaque fait ; les
   filtres « exploitée » et « exploitable » valent pour toutes les sources ; le rang compte les exploitations avérées de
   toutes les sources. Lot ALH5 (décision A) : ces faits, AlgoLightHouse compris, sont les mêmes pour tout le monde ;
   seules les lignes (machines, constats) restent filtrées par les droits.
   Lot V4d : le périmètre d'une machine est son périmètre effectif (sql.ts, perimetreMachine) : celui indiqué à la main, qui
   prime, sinon celui de son dépôt Tenable relié (depots.ts). Il vaut pour toutes les lectures, les compteurs, le rang et
   l'affichage. Retirer le périmètre indiqué à la main fait revenir la machine au périmètre de son dépôt : écriture exigée
   sur ce périmètre ; sans dépôt relié, la machine ne serait plus lisible que par l'administration du module, d'où
   administrer, comme avant.
   Journal `vulnerabilites.machine*` : identifiants internes seulement, jamais un nom ni une adresse de machine. */
import {
  AffectationMachine,
  AffectationMachines,
  type OriginePerimetreMachine,
  calculerPriorite,
  type CompteursMachine,
  faitsDepuisSources,
  graviteDepuisScore,
  type SourcesFailleDto,
  valeursRetenues,
  type FailleDeclareeDto,
  type FicheDeclareeDto,
  faitsRang,
  graviteDepuisNvd,
  type RechercheDeclarees,
  rangerMachines,
  type ReglagePriorite,
  type ConstatDto,
  type ConstatResumeDto,
  FAILLES_PAR_PAGE,
  GRAVITES_TENABLE,
  type GraviteTenable,
  type MachineDetectionDto,
  type FailleMarquee,
  type MachineDto,
  type MachineMarqueeDto,
  marquesMachine,
  PARC_PAR_ZONE,
  type ParcMachinesDto,
  type RechercheParc,
  repartirParc,
  type PageFailles,
  type PageMachines,
  type PerimetreAffectableDto,
  type RechercheConstats,
  type RechercheMachines,
  type RoleMachine,
  type StatutRapprochement,
} from '@suivi/shared';
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { lireFaitsCve, exploiteeCve, preuveCertSante, sourcesDe } from './sources.js';
import { alerteCertFr, detecteeSurMachine, lisible, perimetreMachine, present, scoreNvd } from './sql.js';
import { close, colonnesSuivi, filtreSuivi, type LigneSuivi, versSuiviResume } from './suivi.js';

const INTROUVABLE = 'Machine introuvable ou non accessible.';
/** Motif ILIKE littéral : les jokers saisis sont échappés. */
const litteral = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const nombre = (v: string | number | null) => (v === null ? null : Number(v));
const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Le constat `c` cite une CVE du catalogue KEV (veille). */
const exploite = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc
  JOIN vulnerabilites_veille_cve v ON v.cve = cc.cve WHERE cc.constat_id = c.id AND v.kev_ajout IS NOT NULL)`;
/** Une CVE du constat `c` a une exploitation avérée selon une source (KEV, alerte du CERT-FR, fiche du CERT Santé,
    AlgoLightHouse sur une technologie encore détectée) ; le même résultat pour tout le monde (lot ALH5). */
const exploiteeAvere = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc
  WHERE cc.constat_id = c.id AND ${exploiteeCve('cc.cve')})`;
/** Le constat `c` est exploitable selon Tenable, ou selon la fiche du CERT Santé ou AlgoLightHouse pour une de ses CVE. */
const exploitableSources = sql<boolean>`(c.exploitable OR EXISTS (SELECT 1
  FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id AND ${preuveCertSante('cc.cve')}))`;
const sansCve = sql<boolean>`NOT EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id)`;
/** Une CVE du constat `c` est citée par une alerte du CERT-FR (veille). */
const alerteConstat = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc
  WHERE cc.constat_id = c.id AND ${alerteCertFr('cc.cve')})`;
/** Score EPSS le plus haut des CVE du constat `c`, d'après la veille. */
const epssVeille = sql<string | null>`(SELECT max(v.epss_score) FROM vulnerabilites_constat_cves cc
  JOIN vulnerabilites_veille_cve v ON v.cve = cc.cve WHERE cc.constat_id = c.id)`;
const ORDRE_GRAVITE = (g: GraviteTenable | null) => (g ? GRAVITES_TENABLE.indexOf(g) : GRAVITES_TENABLE.length);

interface LigneConstat extends LigneSuivi {
  id: string;
  plugin_id: number;
  nom: string;
  gravite: GraviteTenable;
  famille: string | null;
  synopsis: string | null;
  correctif: string | null;
  cvss3_vecteur: string | null;
  cvss3_score: string | null;
  vpr_score: string | null;
  epss_score: string | null;
  exploitable: boolean;
  exploit_libelle: string | null;
  faille_publiee_le: Date | null;
  correctif_publie_le: Date | null;
  fin_support_le: Date | null;
  voir_aussi: string | null;
  cves_tronquees: boolean;
  integration_id: string;
  exploite: boolean;
  non_maintenu: boolean;
  nombre_cves: number;
  cves: string[];
  machines: number;
  derniere: Date | null;
  present: boolean;
  alerte_certfr: boolean;
  epss_veille: string | null;
}

interface LigneMachine {
  id: string;
  nom: string | null;
  adresse: string | null;
  systeme: string | null;
  role: RoleMachine | null;
  perimetre_id: string | null;
  perimetre_nom: string | null;
  perimetre_origine: OriginePerimetreMachine | null;
  depot_id: string | null;
  depot_nom: string | null;
  depot_perimetre_id: string | null;
  depot_perimetre_nom: string | null;
  exposition: string | null;
  acr: string | null;
  premiere_detection: Date | null;
  derniere_detection: Date | null;
  integration_id: string;
  integration_nom: string;
  version: number;
  critique: number;
  elevee: number;
  moyenne: number;
  faible: number;
  exploites: number;
  exploitables: number;
  exploitees_avere: number;
}

/** Priorité d'un constat présent sur une machine lisible : présence « détectée » (« absente » s'il n'est plus rapporté).
    Exploitation et « exploitable » selon toutes les sources ; gravité et EPSS : la valeur la plus sévère entre Tenable et
    les sources de la veille (V27). Un constat sans CVE (non maintenu) n'a que les valeurs de Tenable : il est classé sur sa
    gravité. L'état de suivi n'entre pas dans la priorité. */
const prioriteConstat = (l: LigneConstat, sources: SourcesFailleDto, reglage: ReglagePriorite) =>
  calculerPriorite({ ...faitsDepuisSources(sources), presence: l.present ? 'detectee' : 'absente' }, reglage);

/** Sources d'un constat : faits des CVE qu'il cite (AlgoLightHouse compris, les mêmes pour tout le monde), et Tenable
    lui-même. */
export async function sourcesDesConstats(
  k: Kdb,
  lignes: Pick<LigneConstat, 'id' | 'gravite' | 'cvss3_score' | 'epss_score' | 'exploitable'>[],
): Promise<Map<string, SourcesFailleDto>> {
  const ids = lignes.map((l) => l.id);
  // Tableau en un seul paramètre : aucune limite au nombre de constats d'une liste.
  const cc = ids.length
    ? (
        await sql<{ constat_id: string; cve: string }>`SELECT constat_id, cve FROM vulnerabilites_constat_cves
          WHERE constat_id = ANY(${ids}::uuid[])`.execute(k)
      ).rows
    : [];
  const faits = await lireFaitsCve(
    k,
    cc.map((x) => x.cve),
  );
  const parConstat = new Map<string, string[]>();
  for (const x of cc) parConstat.set(x.constat_id, [...(parConstat.get(x.constat_id) ?? []), x.cve]);
  return new Map(
    lignes.map((l) => [
      l.id,
      sourcesDe(
        (parConstat.get(l.id) ?? []).flatMap((cve) => (faits.has(cve) ? [faits.get(cve)!] : [])),
        { gravite: l.gravite, cvss3: nombre(l.cvss3_score), epss: nombre(l.epss_score), exploitable: l.exploitable },
      ),
    ]),
  );
}

const versResume = (l: LigneConstat, sources: SourcesFailleDto, reglage: ReglagePriorite): ConstatResumeDto => ({
  id: l.id,
  plugin: String(l.plugin_id),
  nom: l.nom,
  gravite: l.gravite,
  famille: l.famille,
  cvss3Score: nombre(l.cvss3_score),
  vpr: nombre(l.vpr_score),
  epss: nombre(l.epss_score),
  exploitable: l.exploitable,
  exploite: l.exploite,
  nonMaintenu: l.non_maintenu,
  finSupportLe: iso(l.fin_support_le),
  nombreCves: l.nombre_cves,
  cves: l.cves,
  machines: l.machines,
  derniereDetection: iso(l.derniere),
  present: l.present,
  alerteCertFr: l.alerte_certfr,
  sources,
  priorite: prioriteConstat(l, sources, reglage),
  suivi: versSuiviResume(l),
});

/** Faille déclarée sur une machine : CVE rattachée à un produit relié, non détectée par Tenable sur cette machine. */
export interface DeclareeMachine {
  machine_id: string;
  cve: string;
  cvss31_gravite: string | null;
  cvss40_gravite: string | null;
  /** Score CVSS v3.1 le plus haut des fiches du CERT Santé qui citent la CVE. */
  cvss_cert_sante: string | null;
  exploitee: boolean;
}

/** Gravité retenue d'une faille déclarée : la plus sévère entre NVD et la fiche du CERT Santé (V27). Sert aux compteurs des
    machines et à ceux d'un périmètre (lot PC3). */
export function graviteDeclaree(
  x: Pick<DeclareeMachine, 'cvss31_gravite' | 'cvss40_gravite' | 'cvss_cert_sante'>,
): GraviteTenable | undefined {
  const nvd = graviteDepuisNvd(x.cvss31_gravite, x.cvss40_gravite);
  const cs = graviteDepuisScore(nombre(x.cvss_cert_sante));
  return valeursRetenues({
    gravites: [
      ...(nvd ? [{ source: 'nvd' as const, gravite: nvd }] : []),
      ...(cs ? [{ source: 'cert-sante' as const, gravite: cs }] : []),
    ],
    cvss: [],
    epss: [],
  }).gravite?.gravite;
}

const versMachine = (l: LigneMachine, declarees: DeclareeMachine[]): Omit<MachineDto, 'rang'> => {
  const compteurs: CompteursMachine = {
    critique: l.critique,
    elevee: l.elevee,
    moyenne: l.moyenne,
    faible: l.faible,
    exploites: l.exploites,
    exploitables: l.exploitables,
    declarees: declarees.length,
    exploitationAveree: l.exploitees_avere,
  };
  for (const x of declarees) {
    const g = graviteDeclaree(x);
    if (g) compteurs[g]++;
    if (x.exploitee) compteurs.exploitationAveree++;
  }
  return {
    id: l.id,
    nom: l.nom,
    adresse: l.adresse,
    systeme: l.systeme,
    role: l.role,
    perimetreId: l.perimetre_id,
    perimetreNom: l.perimetre_nom,
    perimetreOrigine: l.perimetre_origine,
    depot:
      l.depot_id && l.depot_nom
        ? {
            id: l.depot_id,
            nom: l.depot_nom,
            perimetreId: l.depot_perimetre_id,
            perimetreNom: l.depot_perimetre_nom,
          }
        : null,
    exposition: l.exposition,
    acr: nombre(l.acr),
    premiere: iso(l.premiere_detection),
    derniere: iso(l.derniere_detection),
    source: 'tenable',
    integration: { id: l.integration_id, nom: l.integration_nom },
    compteurs,
    version: l.version,
  };
};

/** Failles présentes sur chacune des machines demandées (identifiants internes) : constats de Tenable présents et non
    traités (présence « détectée »), failles déclarées par un produit relié à la machine, non détectées sur elle et non
    traitées (« déclarée »). Priorité, exploitation avérée et « exploitable » selon toutes les sources, sur tous les faits
    connus (lot ALH5 : le même résultat pour tout le monde), sans majoration par la surface externe. Nombre de requêtes fixe,
    quel que soit le nombre de machines : constats 1, failles déclarées 1, CVE des constats 1, faits des sources 3 + 3.
    Sert au rang de vulnérabilité de la majoration (majoration.ts) et aux marques de l'écran « Machines » (lot PC2). */
export async function faillesDesMachines(
  k: Kdb,
  reglage: ReglagePriorite,
  machines: readonly string[],
): Promise<Map<string, FailleMarquee[]>> {
  const ids = [...new Set(machines)];
  const parMachine = new Map<string, FailleMarquee[]>();
  if (!ids.length) return parMachine;
  const { rows: constats } = await sql<{
    machine_id: string;
    id: string;
    gravite: GraviteTenable;
    cvss3_score: string | null;
    epss_score: string | null;
    exploitable: boolean;
  }>`SELECT DISTINCT d.machine_id, c.id, c.gravite, c.cvss3_score, c.epss_score, c.exploitable
     FROM vulnerabilites_detections d
     JOIN vulnerabilites_machines m ON m.id = d.machine_id
     LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
     JOIN vulnerabilites_constats c ON c.id = d.constat_id
     WHERE d.machine_id = ANY(${ids}::uuid[]) AND ${present} AND NOT ${close('constat')}`.execute(k);
  const { rows: declarees } = await sql<{ machine_id: string; cve: string }>`
     SELECT DISTINCT m.id AS machine_id, r.cve
     FROM vulnerabilites_produits_machines pm
     JOIN vulnerabilites_machines m ON m.id = pm.machine_id
     LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
     JOIN vulnerabilites_rapprochements r ON r.produit_id = pm.produit_id AND r.statut IN ('rattachee', 'confirmee')
     WHERE m.id = ANY(${ids}::uuid[]) AND NOT ${detecteeSurMachine} AND NOT ${close('declaree')}`.execute(k);
  const ajouter = (machine: string, sources: SourcesFailleDto, presence: 'detectee' | 'declaree') => {
    const faits = faitsDepuisSources(sources);
    parMachine.set(machine, [
      ...(parMachine.get(machine) ?? []),
      {
        niveau: calculerPriorite({ ...faits, presence }, reglage).niveau,
        exploitee: faits.exploitation.length > 0,
        exploitable: faits.exploitable.length > 0,
      },
    ]);
  };
  const uniques = [...new Map(constats.map((c) => [c.id, c])).values()];
  const sources = await sourcesDesConstats(k, uniques);
  for (const c of constats) ajouter(c.machine_id, sources.get(c.id)!, 'detectee');
  const faits = await lireFaitsCve(
    k,
    declarees.map((d) => d.cve),
  );
  for (const d of declarees) {
    const f = faits.get(d.cve);
    ajouter(d.machine_id, sourcesDe(f ? [f] : []), 'declaree');
  }
  return parMachine;
}

export class FaillesDetectees {
  constructor(
    private readonly db: Db,
    private readonly g: Grc,
    private readonly reglage: ReglagePrioriteVulnerabilites,
  ) {}

  /* ---------------------------------------------------------------- Constats */
  /** Requête des constats lisibles, avec leurs compteurs limités aux machines lisibles touchées : celles où le constat est
      présent ; s'il ne l'est plus nulle part (lot V4b), celles où il a été vu en dernier. Sans aucune machine lisible
      touchée, le constat n'est ni listé ni ouvert. */
  private requeteConstats(user: SessionUser, conditions: RawBuilder<boolean>[], constatId?: string) {
    const ou = conditions.length ? sql.join(conditions, sql` AND `) : sql`true`;
    const un = constatId ? sql`d.constat_id = ${constatId}::uuid` : sql`true`;
    return sql`
      WITH x AS (
        SELECT d.constat_id, d.machine_id, d.derniere_detection, ${present} AS present, ${lisible(user)} AS lisible
        FROM vulnerabilites_detections d
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE ${un}),
      pc AS (SELECT constat_id, bool_or(present) AS present FROM x GROUP BY constat_id),
      par_constat AS (
        SELECT x.constat_id, pc.present, count(DISTINCT x.machine_id) FILTER (WHERE x.lisible)::int AS machines,
               max(x.derniere_detection) FILTER (WHERE x.lisible) AS derniere
        FROM x JOIN pc ON pc.constat_id = x.constat_id
        WHERE x.present OR NOT pc.present
        GROUP BY x.constat_id, pc.present
        HAVING bool_or(x.lisible))
      SELECT c.*, p.machines, p.derniere, p.present, ${exploite} AS exploite, ${sansCve} AS non_maintenu,
        ${alerteConstat} AS alerte_certfr, ${epssVeille} AS epss_veille,
        (SELECT count(*)::int FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id) AS nombre_cves,
        ARRAY(SELECT cc.cve FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id ORDER BY cc.cve DESC LIMIT 5)
          AS cves,
        ${colonnesSuivi}
      FROM vulnerabilites_constats c JOIN par_constat p ON p.constat_id = c.id
      LEFT JOIN vulnerabilites_suivis s ON s.constat_id = c.id
      WHERE ${ou}`;
  }

  async constats(user: SessionUser, q: RechercheConstats): Promise<PageFailles<ConstatResumeDto>> {
    const conditions: RawBuilder<boolean>[] = [];
    if (q.gravite) conditions.push(sql<boolean>`c.gravite = ${q.gravite}`);
    if (q.exploite) conditions.push(exploiteeAvere);
    if (q.exploitable) conditions.push(exploitableSources);
    if (q.nonMaintenu) conditions.push(sansCve);
    conditions.push(filtreSuivi(q.etat, sql<boolean>`p.present`));
    const texte = q.q?.trim();
    if (texte) {
      const motif = litteral(texte);
      if (/^cve-\d/i.test(texte))
        conditions.push(
          sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id
                         AND cc.cve LIKE ${`${motif.toUpperCase()}%`})`,
        );
      else if (/^\d{1,9}$/.test(texte))
        conditions.push(sql<boolean>`(c.plugin_id = ${Number(texte)}::int OR c.nom ILIKE ${`%${motif}%`})`);
      else conditions.push(sql<boolean>`c.nom ILIKE ${`%${motif}%`}`);
    }
    const reglage = await this.reglage.valeurs();
    const { rows } = await sql<LigneConstat>`SELECT * FROM (${this.requeteConstats(user, conditions)}) c`.execute(
      this.db.k,
    );
    const sources = await sourcesDesConstats(this.db.k, rows);
    // Priorité calculée par la fonction partagée, puis filtre et ordre : priorité, gravité, exploitée, machines, contrôle.
    const tous = rows
      .map((l) => ({ l, r: versResume(l, sources.get(l.id)!, reglage) }))
      .filter((x) => !q.priorite || x.r.priorite.niveau === q.priorite)
      .sort(
        (a, b) =>
          a.r.priorite.niveau.localeCompare(b.r.priorite.niveau) ||
          ORDRE_GRAVITE(a.l.gravite) - ORDRE_GRAVITE(b.l.gravite) ||
          Number(b.l.exploite) - Number(a.l.exploite) ||
          b.l.machines - a.l.machines ||
          a.l.plugin_id - b.l.plugin_id,
      );
    const debut = (q.page - 1) * FAILLES_PAR_PAGE;
    return {
      total: tous.length,
      page: q.page,
      parPage: FAILLES_PAR_PAGE,
      elements: tous.slice(debut, debut + FAILLES_PAR_PAGE).map((x) => x.r),
    };
  }

  /** Fiche d'un constat : ses CVE (avec leur présence au catalogue KEV) et les machines lisibles où il est présent (à
      défaut, où il a été vu en dernier), par rôle. Un constat sans machine lisible répond comme un constat inconnu. */
  async constat(user: SessionUser, id: string): Promise<ConstatDto> {
    const { rows } = await sql<LigneConstat & { integration_nom: string }>`
      SELECT x.*, i.nom AS integration_nom FROM (${this.requeteConstats(user, [sql<boolean>`c.id = ${id}::uuid`], id)}) x
      JOIN integrations i ON i.id = x.integration_id`.execute(this.db.k);
    const l = rows[0];
    if (!l) throw new HttpError(404, 'Faille introuvable ou non accessible.');
    const cves = await this.db.k
      .selectFrom('vulnerabilites_constat_cves as cc')
      .leftJoin('vulnerabilites_veille_cve as v', 'v.cve', 'cc.cve')
      .select(['cc.cve', sql<boolean>`v.kev_ajout IS NOT NULL`.as('kev')])
      .where('cc.constat_id', '=', id)
      .orderBy('cc.cve', 'desc')
      .execute();
    const { rows: detections } = await sql<{
      machine_id: string;
      nom: string | null;
      adresse: string | null;
      role: RoleMachine | null;
      perimetre_id: string | null;
      perimetre_nom: string | null;
      port: number;
      protocole: string;
      premiere_detection: Date | null;
      derniere_detection: Date | null;
      attenue: boolean;
      risque_accepte: boolean;
      risque_requalifie: boolean;
    }>`
      SELECT m.id AS machine_id, m.nom, m.adresse, m.role, ${perimetreMachine} AS perimetre_id, s.name AS perimetre_nom,
             d.port, d.protocole, d.premiere_detection, d.derniere_detection, d.attenue, d.risque_accepte,
             d.risque_requalifie
      FROM vulnerabilites_detections d
      JOIN vulnerabilites_machines m ON m.id = d.machine_id
      LEFT JOIN grc_smsis s ON s.id = ${perimetreMachine}
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      WHERE d.constat_id = ${id}::uuid AND (${present} OR NOT ${l.present}::boolean) AND ${lisible(user)}
      ORDER BY lower(coalesce(m.nom, m.adresse, '')), m.id, d.port, d.protocole`.execute(this.db.k);
    const parRole: ConstatDto['parRole'] = { front: [], back: [], bdd: [], aucun: [] };
    for (const d of detections)
      parRole[d.role ?? 'aucun'].push({
        machineId: d.machine_id,
        nom: d.nom,
        adresse: d.adresse,
        role: d.role,
        perimetreId: d.perimetre_id,
        perimetreNom: d.perimetre_nom,
        port: d.port,
        protocole: d.protocole,
        premiere: iso(d.premiere_detection),
        derniere: iso(d.derniere_detection),
        attenue: d.attenue,
        risqueAccepte: d.risque_accepte,
        risqueRequalifie: d.risque_requalifie,
      } satisfies MachineDetectionDto);
    const sources = await sourcesDesConstats(this.db.k, [l]);
    return {
      ...versResume(l, sources.get(l.id)!, await this.reglage.valeurs()),
      synopsis: l.synopsis,
      correctif: l.correctif,
      cvss3Vecteur: l.cvss3_vecteur,
      exploitLibelle: l.exploit_libelle,
      failleLe: iso(l.faille_publiee_le),
      correctifLe: iso(l.correctif_publie_le),
      voirAussi: l.voir_aussi,
      cvesTronquees: l.cves_tronquees,
      cvesDetail: cves.map((x) => ({ cve: x.cve, kev: x.kev })),
      parRole,
      integration: { id: l.integration_id, nom: l.integration_nom },
    };
  }

  /* ---------------------------------------------------------------- Machines */
  /** Toutes les machines lisibles, avec leurs compteurs (constats présents, puis failles déclarées non détectées), rangées
      de la plus critique à la moins critique (rangerMachines du paquet partagé). Une faille corrigée, au risque accepté ou
      non concernée ne compte pas (lot V4b). Public : le suivi (V30) et l'assistant (repères) rangent les machines par ce
      même rang. */
  async machinesRangees(user: SessionUser): Promise<MachineDto[]> {
    const { rows } = await sql<LigneMachine>`
      SELECT m.id, m.nom, m.adresse, m.systeme, m.role, ${perimetreMachine} AS perimetre_id, s.name AS perimetre_nom,
             CASE WHEN m.perimetre_id IS NOT NULL THEN 'machine' WHEN td.perimetre_id IS NOT NULL THEN 'depot' END
               AS perimetre_origine,
             td.id AS depot_id, td.nom AS depot_nom,
             -- Périmètre du dépôt : montré seulement s'il est visible de la personne (son nom ne fuit pas autrement).
             CASE WHEN grc_smsi_visible(td.perimetre_id, ${user.id}::uuid) THEN td.perimetre_id END AS depot_perimetre_id,
             CASE WHEN grc_smsi_visible(td.perimetre_id, ${user.id}::uuid) THEN sd.name END AS depot_perimetre_nom,
             m.exposition, m.acr,
             m.premiere_detection, m.derniere_detection, m.integration_id, i.nom AS integration_nom, m.version,
             coalesce(k.critique, 0) AS critique, coalesce(k.elevee, 0) AS elevee, coalesce(k.moyenne, 0) AS moyenne,
             coalesce(k.faible, 0) AS faible, coalesce(k.exploites, 0) AS exploites,
             coalesce(k.exploitables, 0) AS exploitables, coalesce(k.exploitees_avere, 0) AS exploitees_avere
      FROM vulnerabilites_machines m
      JOIN integrations i ON i.id = m.integration_id
      LEFT JOIN vulnerabilites_tenable_depots td ON td.id = m.depot_id
      LEFT JOIN grc_smsis sd ON sd.id = td.perimetre_id
      LEFT JOIN grc_smsis s ON s.id = ${perimetreMachine}
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      LEFT JOIN LATERAL (
        SELECT count(DISTINCT c.id) FILTER (WHERE c.gravite = 'critique')::int AS critique,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'elevee')::int AS elevee,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'moyenne')::int AS moyenne,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'faible')::int AS faible,
               count(DISTINCT c.id) FILTER (WHERE ${exploite})::int AS exploites,
               count(DISTINCT c.id) FILTER (WHERE c.exploitable)::int AS exploitables,
               count(DISTINCT c.id) FILTER (WHERE ${exploiteeAvere})::int AS exploitees_avere
        FROM vulnerabilites_detections d JOIN vulnerabilites_constats c ON c.id = d.constat_id
        WHERE d.machine_id = m.id AND ${present} AND NOT ${close('constat')}) k ON true
      WHERE ${lisible(user)}`.execute(this.db.k);
    const { rows: declarees } = await sql<DeclareeMachine>`
      SELECT DISTINCT m.id AS machine_id, r.cve, v.cvss31_gravite, v.cvss40_gravite,
             (SELECT max(a.fiche_cvss31) FROM vulnerabilites_veille_avis a WHERE a.source = 'cert-sante'
                AND a.cves @> ARRAY[v.cve]) AS cvss_cert_sante,
             ${exploiteeCve('v.cve')} AS exploitee
      FROM vulnerabilites_produits_machines pm
      JOIN vulnerabilites_machines m ON m.id = pm.machine_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      JOIN vulnerabilites_rapprochements r ON r.produit_id = pm.produit_id AND r.statut IN ('rattachee', 'confirmee')
      JOIN vulnerabilites_veille_cve v ON v.cve = r.cve
      WHERE ${lisible(user)} AND NOT ${detecteeSurMachine} AND NOT ${close('declaree')}`.execute(this.db.k);
    const parMachine = new Map<string, DeclareeMachine[]>();
    for (const x of declarees) parMachine.set(x.machine_id, [...(parMachine.get(x.machine_id) ?? []), x]);
    const machines = rows.map((l) => versMachine(l, parMachine.get(l.id) ?? []));
    const ranges = rangerMachines(
      machines.map((m) => ({
        m,
        exploitationAveree: m.compteurs.exploitationAveree,
        role: m.role,
        critiques: m.compteurs.critique,
        elevees: m.compteurs.elevee,
        cle: `${(m.nom ?? m.adresse ?? '').toLowerCase()}\u0000${m.id}`,
      })),
    );
    return ranges.map((x) => ({
      ...x.m,
      rang: { position: x.rang, total: ranges.length, faits: faitsRang(x) },
    }));
  }

  /** Machines lisibles, de la plus critique à la moins critique ; recherche par nom, filtres par rôle et périmètre. Le rang
      est calculé sur toutes les machines lisibles, avant les filtres. */
  async machines(user: SessionUser, q: RechercheMachines): Promise<PageMachines> {
    const toutes = await this.machinesRangees(user);
    const texte = q.q?.trim().toLowerCase();
    const filtrees = toutes.filter(
      (m) =>
        (!texte || (m.nom ?? '').includes(texte)) &&
        (q.role === 'aucun' ? m.role === null : !q.role || m.role === q.role) &&
        (q.perimetre === 'aucun' ? m.perimetreId === null : !q.perimetre || m.perimetreId === q.perimetre),
    );
    const debut = (q.page - 1) * FAILLES_PAR_PAGE;
    return {
      total: filtrees.length,
      page: q.page,
      parPage: FAILLES_PAR_PAGE,
      elements: await this.marquer(filtrees.slice(debut, debut + FAILLES_PAR_PAGE)),
      sansRole: toutes.filter((m) => m.role === null).length,
    };
  }

  /** Marques des machines rendues (lot PC2) : priorité la plus haute, zero-day, exploitable. */
  private async marquer(machines: MachineDto[]): Promise<MachineMarqueeDto[]> {
    const failles = await faillesDesMachines(
      this.db.k,
      await this.reglage.valeurs(),
      machines.map((m) => m.id),
    );
    return machines.map((m) => ({ ...m, marques: marquesMachine(failles.get(m.id) ?? []) }));
  }

  /** Parc des machines lisibles (lot PC2), par zone de rôle, dans l'ordre du rang : mêmes filtres que la liste, au plus
      PARC_PAR_ZONE machines par zone (les plus prioritaires), totaux de chaque zone toujours rendus. Seules les machines que
      la personne lit sont listées ou comptées. Lecture seule. Nombre de requêtes fixe, aucune par machine : machines et
      leurs compteurs 2, réglage 1, marques 9 (faillesDesMachines) ; 12 au plus. */
  async parc(user: SessionUser, q: RechercheParc): Promise<ParcMachinesDto> {
    const toutes = await this.machinesRangees(user);
    const texte = q.q?.trim().toLowerCase();
    const filtrees = toutes.filter(
      (m) =>
        (!texte || (m.nom ?? '').includes(texte)) &&
        (q.role === 'aucun' ? m.role === null : !q.role || m.role === q.role) &&
        (q.perimetre === 'aucun' ? m.perimetreId === null : !q.perimetre || m.perimetreId === q.perimetre),
    );
    // Marques de toutes les machines filtrées (mêmes requêtes, quel que soit leur nombre) : le nombre de machines marquées
    // « zero-day » d'une zone compte aussi celles au-delà de la borne.
    const zones = repartirParc(await this.marquer(filtrees), PARC_PAR_ZONE);
    return {
      zones,
      total: filtrees.length,
      parZone: PARC_PAR_ZONE,
      tronquee: zones.some((z) => z.total > z.machines.length),
    };
  }

  async machine(user: SessionUser, id: string): Promise<MachineDto> {
    const m = (await this.machinesRangees(user)).find((x) => x.id === id);
    if (!m) throw new HttpError(404, INTROUVABLE);
    return m;
  }

  /* ---------------------------------------------------------------- Failles déclarées (V20, lot V4a) */
  /** Lignes des failles déclarées : une par produit et par CVE, sur les machines lisibles reliées au produit où Tenable ne
      détecte pas la CVE, avec sa priorité et son suivi (lot V4b). `toutes` : garder une ligne même si Tenable détecte la CVE
      sur toutes ces machines (fiche). */
  private async lignesDeclarees(
    user: SessionUser,
    conditions: RawBuilder<boolean>[],
    toutes = false,
  ): Promise<FailleDeclareeDto[]> {
    const et = conditions.length ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``;
    const { rows } = await sql<
      LigneSuivi & {
        id: string;
        cve: string;
        statut: StatutRapprochement;
        produit_id: string;
        editeur: string;
        nom: string;
        version_produit: string;
        cvss31_gravite: string | null;
        cvss40_gravite: string | null;
        score: string | null;
        epss_score: string | null;
        kev: boolean;
        alerte: boolean;
        machines: number;
      }
    >`
      SELECT r.id, r.cve, r.statut, p.id AS produit_id, p.editeur, p.nom, p.version_produit, v.cvss31_gravite,
             v.cvss40_gravite, ${scoreNvd} AS score, v.epss_score, v.kev_ajout IS NOT NULL AS kev,
             ${alerteCertFr('v.cve')} AS alerte,
             count(DISTINCT m.id) FILTER (WHERE NOT ${detecteeSurMachine})::int AS machines,
             ${colonnesSuivi}
      FROM vulnerabilites_rapprochements r
      JOIN vulnerabilites_produits p ON p.id = r.produit_id
      JOIN vulnerabilites_veille_cve v ON v.cve = r.cve
      JOIN vulnerabilites_produits_machines pm ON pm.produit_id = p.id
      JOIN vulnerabilites_machines m ON m.id = pm.machine_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      LEFT JOIN vulnerabilites_suivis s ON s.rapprochement_id = r.id
      WHERE ${lisible(user)} ${et}
      GROUP BY r.id, p.id, v.cve, s.id
      HAVING ${toutes}::boolean OR count(DISTINCT m.id) FILTER (WHERE NOT ${detecteeSurMachine}) > 0`.execute(
      this.db.k,
    );
    const reglage = await this.reglage.valeurs();
    const faits = await lireFaitsCve(
      this.db.k,
      rows.map((l) => l.cve),
    );
    return rows.map((l): FailleDeclareeDto => {
      const f = faits.get(l.cve);
      const sources = sourcesDe(f ? [f] : []);
      const retenues = valeursRetenues(sources.valeurs);
      const rattachee = l.statut === 'rattachee' || l.statut === 'confirmee';
      return {
        rapprochementId: l.id,
        cve: l.cve,
        statut: l.statut,
        produit: { id: l.produit_id, editeur: l.editeur, nom: l.nom, versionProduit: l.version_produit },
        gravite: retenues.gravite?.gravite ?? null,
        cvssScore: retenues.cvss?.score ?? null,
        epss: retenues.epss?.score ?? null,
        kev: l.kev,
        alerteCertFr: l.alerte,
        sources,
        machines: l.machines,
        present: rattachee,
        priorite: calculerPriorite(
          {
            ...faitsDepuisSources(sources),
            presence: rattachee ? 'declaree' : l.statut === 'proposee' ? 'a_confirmer' : 'absente',
          },
          reglage,
        ),
        suivi: versSuiviResume(l),
      };
    });
  }

  /** CVE rattachées (d'office ou confirmées) à un produit relié à des machines lisibles, sur les machines où Tenable ne les
      détecte pas ; une par produit et par CVE, avec sa priorité (présence « déclarée »). Filtre de suivi (lot V4b) : une CVE
      qui n'est plus rattachée reste listée si elle a un suivi (proposition « corrigée », état décidé). */
  async declarees(user: SessionUser, q: RechercheDeclarees): Promise<PageFailles<FailleDeclareeDto>> {
    const conditions: RawBuilder<boolean>[] = [
      filtreSuivi(q.etat, sql<boolean>`r.statut IN ('rattachee', 'confirmee')`),
    ];
    const texte = q.q?.trim();
    if (texte) {
      const motif = litteral(texte);
      conditions.push(
        /^cve-\d/i.test(texte)
          ? sql<boolean>`r.cve LIKE ${`${motif.toUpperCase()}%`}`
          : sql<boolean>`(p.nom ILIKE ${`%${motif}%`} OR p.editeur ILIKE ${`%${motif}%`})`,
      );
    }
    const tous = (await this.lignesDeclarees(user, conditions))
      .filter((x) => !q.priorite || x.priorite.niveau === q.priorite)
      .sort(
        (a, b) =>
          a.priorite.niveau.localeCompare(b.priorite.niveau) ||
          ORDRE_GRAVITE(a.gravite) - ORDRE_GRAVITE(b.gravite) ||
          (a.cve < b.cve ? 1 : a.cve > b.cve ? -1 : 0) ||
          (a.produit.id < b.produit.id ? -1 : a.produit.id > b.produit.id ? 1 : 0),
      );
    const debut = (q.page - 1) * FAILLES_PAR_PAGE;
    return {
      total: tous.length,
      page: q.page,
      parPage: FAILLES_PAR_PAGE,
      elements: tous.slice(debut, debut + FAILLES_PAR_PAGE),
    };
  }

  /** Fiche d'une faille déclarée (lot V4b) : description de NVD, action exigée du catalogue KEV, machines lisibles reliées
      au produit (avec « détectée par Tenable »). Lisible si au moins une machine reliée l'est, et si la CVE est rattachée ou
      a un suivi ; sinon, comme une faille inconnue. */
  async declaree(user: SessionUser, id: string): Promise<FicheDeclareeDto> {
    const [f] = await this.lignesDeclarees(
      user,
      [sql<boolean>`r.id = ${id}::uuid`, sql<boolean>`(r.statut IN ('rattachee', 'confirmee') OR s.id IS NOT NULL)`],
      true,
    );
    if (!f) throw new HttpError(404, 'Faille introuvable ou non accessible.');
    const v = await this.db.k
      .selectFrom('vulnerabilites_veille_cve')
      .select(['description', 'kev_action', sql<string | null>`kev_echeance::text`.as('kev_echeance')])
      .where('cve', '=', f.cve)
      .executeTakeFirstOrThrow();
    const { rows } = await sql<{
      id: string;
      nom: string | null;
      adresse: string | null;
      role: RoleMachine | null;
      perimetre_nom: string | null;
      detectee: boolean;
    }>`
      SELECT m.id, m.nom, m.adresse, m.role, sm.name AS perimetre_nom, ${detecteeSurMachine} AS detectee
      FROM vulnerabilites_rapprochements r
      JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id
      JOIN vulnerabilites_machines m ON m.id = pm.machine_id
      LEFT JOIN grc_smsis sm ON sm.id = ${perimetreMachine}
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      WHERE r.id = ${id}::uuid AND ${lisible(user)}
      ORDER BY lower(coalesce(m.nom, m.adresse, '')), m.id`.execute(this.db.k);
    return {
      ...f,
      description: v.description,
      kevAction: v.kev_action,
      kevEcheance: v.kev_echeance,
      machinesReliees: rows.map((m) => ({
        id: m.id,
        nom: m.nom,
        adresse: m.adresse,
        role: m.role,
        perimetreNom: m.perimetre_nom,
        detectee: m.detectee,
      })),
    };
  }

  /** Périmètres où la personne peut écrire : seuls choix admis pour l'affectation. */
  async perimetresAffectables(user: SessionUser): Promise<PerimetreAffectableDto[]> {
    const { rows } = await sql<PerimetreAffectableDto>`SELECT s.id, s.name AS nom FROM grc_smsis s
      WHERE grc_est_admin(${user.id}::uuid) OR grc_acces_perimetre(s.id, ${user.id}::uuid) IS TRUE
      ORDER BY lower(s.name), s.id`.execute(this.db.k);
    return rows;
  }

  /* ---------------------------------------------------------------- Affectation (vulnerabilites:modifier) */
  /** Rôle et périmètre d'une machine (If-Match). Périmètre `null` : retour au périmètre du dépôt (lot V4d). */
  async affecter(
    id: string,
    patch: AffectationMachine,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<MachineDto> {
    const p = AffectationMachine.parse(patch);
    await this.db.tx(async (c, k) => {
      const [m] = await this.verrouiller(k, user, [id]);
      if (!m) throw new HttpError(404, INTROUVABLE);
      if (m.version !== attendue) throw conflict({ ...(await this.machine(user, id)), updated_by: m.maj_par ?? '' });
      await this.controlerEcriture(c, user, m, p.perimetreId);
      const apres = await this.ecrire(k, user, m, p);
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.machine.modifiee',
        id,
        {
          avant: { role: m.role, perimetreId: m.perimetre_id },
          apres: { role: apres.role, perimetreId: apres.perimetre_id },
          version: apres.version,
        },
        c,
      );
    }, user.username);
    return this.machine(user, id);
  }

  /** Affectation en masse : tout ou rien. Chaque machine porte sa version attendue ; une seule périmée fait tout refuser. */
  async affecterEnMasse(body: AffectationMachines, user: SessionUser, ip: string): Promise<{ machines: number }> {
    const p = AffectationMachines.parse(body);
    const ids = p.machines.map((x) => x.id);
    await this.db.tx(async (c, k) => {
      const lues = await this.verrouiller(k, user, ids);
      if (lues.length !== ids.length) throw new HttpError(404, 'Une machine est introuvable ou non accessible.');
      const attendues = new Map(p.machines.map((x) => [x.id, x.version]));
      const perimees = lues.filter((m) => m.version !== attendues.get(m.id));
      if (perimees.length)
        throw new HttpError(
          412,
          `${perimees.length} machine(s) modifiée(s) depuis leur affichage : rechargez la liste avant de recommencer.`,
          { reason: 'conflict', current: perimees.map((m) => ({ id: m.id, version: m.version })) },
        );
      const patch = {
        ...(p.role !== undefined ? { role: p.role } : {}),
        ...(p.perimetreId !== undefined ? { perimetreId: p.perimetreId } : {}),
      };
      for (const m of lues) {
        await this.controlerEcriture(c, user, m, patch.perimetreId);
        await this.ecrire(k, user, m, patch);
      }
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.machines.affectees',
        '',
        { machines: [...ids].sort(), nombre: ids.length, ...patch },
        c,
      );
    }, user.username);
    return { machines: ids.length };
  }

  /** Machines lisibles par la personne, verrouillées dans l'ordre des identifiants (aucun interblocage entre deux envois). */
  private async verrouiller(k: Kdb, user: SessionUser, ids: string[]) {
    const { rows } = await sql<{
      id: string;
      role: RoleMachine | null;
      perimetre_id: string | null;
      perimetre_depot: string | null;
      version: number;
      maj_par: string | null;
    }>`SELECT m.id, m.role, m.perimetre_id,
              (SELECT td.perimetre_id FROM vulnerabilites_tenable_depots td WHERE td.id = m.depot_id) AS perimetre_depot,
              m.version, m.maj_par
       FROM vulnerabilites_machines m
       WHERE m.id = ANY(${ids}::uuid[]) AND ${lisible(user)} ORDER BY m.id FOR UPDATE OF m`.execute(k);
    return rows;
  }

  /** Écriture sur le périmètre effectif actuel ; sur le périmètre effectif visé s'il change. Retirer le périmètre indiqué à
      la main fait revenir la machine à celui de son dépôt (lot V4d) : écriture exigée sur ce périmètre ; sans dépôt relié,
      administrer, la machine n'étant plus lisible que par ce droit. */
  private async controlerEcriture(
    c: Client,
    user: SessionUser,
    m: { perimetre_id: string | null; perimetre_depot: string | null },
    vise: string | null | undefined,
  ) {
    const actuel = m.perimetre_id ?? m.perimetre_depot;
    if (actuel) await this.g.access(actuel, user, true, c);
    if (vise === undefined || vise === m.perimetre_id) return;
    const apres = vise ?? m.perimetre_depot;
    if (apres === null) {
      if (!user.rights.can('vulnerabilites', 'administrer'))
        throw new HttpError(
          403,
          'Retirer le périmètre d’une machine demande le droit d’administrer le module Vulnérabilités : elle ne serait plus lisible que par ce droit.',
        );
      return;
    }
    if (apres === actuel) return;
    await this.g.access(apres, user, true, c).catch((e: unknown) => {
      if (e instanceof HttpError && e.status === 404)
        throw new HttpError(422, 'Périmètre introuvable ou non accessible.');
      throw e;
    });
  }

  private async ecrire(
    k: Kdb,
    user: SessionUser,
    m: { id: string; role: RoleMachine | null; perimetre_id: string | null },
    p: AffectationMachine,
  ) {
    return k
      .updateTable('vulnerabilites_machines')
      .set((eb) => ({
        role: p.role !== undefined ? p.role : m.role,
        perimetre_id: p.perimetreId !== undefined ? p.perimetreId : m.perimetre_id,
        version: eb('version', '+', 1),
        maj_le: sql<Date>`now()`,
        maj_par: user.username,
      }))
      .where('id', '=', m.id)
      .returning(['role', 'perimetre_id', 'version'])
      .executeTakeFirstOrThrow();
  }
}
