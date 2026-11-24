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
   Lot N2 : « exploitation avérée » d'un constat compte aussi le contrôle marqué « exploité par un logiciel malveillant »
   par Tenable (import Nessus) : priorité, filtre « Exploitation avérée », compteurs et rang des machines, marques.
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
   Lot S1 : délai de correction de chaque faille (calculerDelai du paquet partagé) : première présence connue (première
   détection de Tenable, sinon entrée du constat ; date du rapprochement d'une faille déclarée), reprise du délai, délai
   cible de la priorité courante, échéance calculée et état ; filtre par état de délai et tri par échéance, en mémoire comme
   la priorité (aucune requête de plus).
   Lot S3 : état du correctif de chaque constat (date de publication du correctif de Tenable, mention du CERT Santé de ses
   CVE ; etatCorrectif du paquet partagé) et fin de support (date `seolDate` de Tenable passée) ; filtre « fin de support »
   des constats et des machines ; une machine est en fin de support dès qu'un constat présent sur elle l'est, quel que soit
   son état de suivi (c'est un fait, pas une décision). Colonnes ajoutées aux requêtes existantes : aucune requête de plus.
   Lot GRP-MACHINES : filtre de la liste et du parc par groupe de machines (groupes.ts), ou « sans groupe », dans la requête
   des filtres d'ACR et d'AES (une de plus au plus).
   Journal `vulnerabilites.machine*` : identifiants internes seulement, jamais un nom ni une adresse de machine. */
import {
  etatCorrectif,
  etatFinSupport,
  calculerDelai,
  comparerEcheances,
  type DelaiFailleDto,
  AffectationMachine,
  AffectationMachines,
  type OriginePerimetreMachine,
  calculerPriorite,
  type CompteursMachine,
  faitsDepuisSources,
  graviteDepuisScore,
  type SourceMachine,
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
  kitsRanges,
  prioriteRancongiciel,
  FAILLES_PAR_PAGE,
  type FiltreAcr,
  type FiltreAes,
  SEUILS_ACR,
  SEUILS_AES,
  GRAVITES_TENABLE,
  type GraviteTenable,
  type MachineDetectionDto,
  type FailleMarquee,
  type MachineDto,
  type MachineMarqueeDto,
  machineCorrespond,
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
import { cvesExploitees, lireFaitsCve, exploiteeCve, preuveCertSante, sourcesDe } from './sources.js';
import {
  alerteCertFr,
  detecteeSurMachine,
  lisible,
  machinesFinSupport,
  perimetreMachine,
  produitSurMachineFinSupport,
  perimetresVisibles,
  present,
  scoreNvd,
} from './sql.js';
import { aujourdhui, close, colonnesSuivi, filtreSuivi, type LigneSuivi, versSuiviResume } from './suivi.js';

const INTROUVABLE = 'Machine introuvable ou non accessible.';
/** Motif ILIKE littéral : les jokers saisis sont échappés. */
const litteral = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const nombre = (v: string | number | null) => (v === null ? null : Number(v));
const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Le constat `c` cite une CVE du catalogue KEV (veille). */
const exploite = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc
  JOIN vulnerabilites_veille_cve v ON v.cve = cc.cve WHERE cc.constat_id = c.id AND v.kev_ajout IS NOT NULL)`;
/** Le constat `c` a une exploitation avérée selon une source : Tenable lui-même (contrôle « exploité par un logiciel
    malveillant », lot N2), ou une de ses CVE (KEV, alerte du CERT-FR, fiche du CERT Santé, AlgoLightHouse sur une
    technologie encore détectée) ; le même résultat pour tout le monde (lot ALH5). Même règle que sourcesDe. */
const exploiteeAvere = sql<boolean>`(c.exploite_malware OR EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc
  WHERE cc.constat_id = c.id AND ${exploiteeCve('cc.cve')}))`;
/** Le constat `c` est exploitable selon Tenable, ou selon la fiche du CERT Santé ou AlgoLightHouse pour une de ses CVE. */
const exploitableSources = sql<boolean>`(c.exploitable OR cardinality(c.kits_exploitation) > 0 OR EXISTS (SELECT 1
  FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id AND ${preuveCertSante('cc.cve')}))`;
const sansCve = sql<boolean>`NOT EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id)`;
/** Lot S3 : le constat `c` est en fin de support selon Tenable (date de fin de support du logiciel passée). */
export const finSupportConstat = sql<boolean>`(c.fin_support_le IS NOT NULL AND c.fin_support_le <= now())`;
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
  /** Lot N2 : contrôle « exploité par un logiciel malveillant » selon Tenable (import Nessus). */
  exploite_malware: boolean;
  /** Lot PRIO-1 : kits d'exploitation cités par Tenable. */
  kits_exploitation: string[];
  /** Lot PRIO-1 : présent sur au moins une machine en fin de support (toutes machines, un fait commun), et n'est pas
      lui-même le contrôle de fin de support (décision du RSSI du 20/11/2026 : celui-ci ne monte pas). */
  sur_fin_support: boolean;
  faille_publiee_le: Date | null;
  correctif_publie_le: Date | null;
  fin_support_le: Date | null;
  voir_aussi: string | null;
  cves_tronquees: boolean;
  integration_id: string;
  /** Lot N1 : instance qui a rapporté le constat (nom et type). */
  integration_nom: string;
  integration_type: SourceMachine;
  exploite: boolean;
  non_maintenu: boolean;
  nombre_cves: number;
  cves: string[];
  machines: number;
  derniere: Date | null;
  present: boolean;
  alerte_certfr: boolean;
  epss_veille: string | null;
  /** Lot S1 : première présence connue chez nous. */
  premiere: Date;
}

/** Colonnes d'un constat utiles à la priorité, au délai et à l'ordre de la liste (lot PERF). */
type LigneOrdre = Pick<
  LigneConstat,
  | 'id'
  | 'plugin_id'
  | 'gravite'
  | 'cvss3_score'
  | 'epss_score'
  | 'exploitable'
  | 'exploite_malware'
  | 'kits_exploitation'
  | 'sur_fin_support'
  | 'machines'
  | 'present'
  | 'exploite'
  | 'premiere'
  | 'suivi_etat'
  | 'suivi_repart'
>;

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
  /** Lot TEN-SCORES : score d'exposition de l'actif selon Tenable (0 à 1000). */
  aes: number | null;
  premiere_detection: Date | null;
  derniere_detection: Date | null;
  integration_id: string;
  integration_nom: string;
  /** Lot N1 : source de la machine (type de son instance). */
  source: SourceMachine;
  version: number;
  critique: number;
  elevee: number;
  moyenne: number;
  faible: number;
  exploites: number;
  exploitables: number;
  exploitees_avere: number;
  /** Lot S3 : contrôles présents en fin de support (cinq au plus), en JSON. */
  fins_support: { nom: string; le: string }[];
}

/** Priorité d'un constat présent sur une machine lisible : présence « détectée » (« absente » s'il n'est plus rapporté).
    Exploitation et « exploitable » selon toutes les sources ; gravité et EPSS : la valeur la plus sévère entre Tenable et
    les sources de la veille (V27). Un constat sans CVE (non maintenu) n'a que les valeurs de Tenable : il est classé sur sa
    gravité. L'état de suivi n'entre pas dans la priorité. */
const prioriteConstat = (
  l: Pick<LigneConstat, 'present' | 'sur_fin_support'>,
  sources: SourcesFailleDto,
  reglage: ReglagePriorite,
) =>
  calculerPriorite(
    {
      ...faitsDepuisSources(sources),
      presence: l.present ? 'detectee' : 'absente',
      // Lot PRIO-1 : un cran de plus sur une machine en fin de support.
      finDeSupport: l.present && l.sur_fin_support,
    },
    reglage,
  );

/** Sources d'un constat : faits des CVE qu'il cite (AlgoLightHouse compris, les mêmes pour tout le monde), et Tenable
    lui-même. */
export async function sourcesDesConstats(
  k: Kdb,
  lignes: (Pick<LigneConstat, 'id' | 'gravite' | 'cvss3_score' | 'epss_score' | 'exploitable' | 'exploite_malware'> & {
    kits_exploitation?: readonly string[];
  })[],
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
        {
          gravite: l.gravite,
          cvss3: nombre(l.cvss3_score),
          epss: nombre(l.epss_score),
          exploitable: l.exploitable,
          malware: l.exploite_malware,
          kits: l.kits_exploitation ?? [],
        },
      ),
    ]),
  );
}

const versResume = (
  l: LigneConstat,
  sources: SourcesFailleDto,
  reglage: ReglagePriorite,
  maintenant = new Date(),
  jour = aujourdhui(maintenant),
  priorite = prioriteConstat(l, sources, reglage),
): ConstatResumeDto => {
  return {
    finDeSupport: etatFinSupport(iso(l.fin_support_le), maintenant) === 'atteinte',
    correctifEtat: etatCorrectif({
      tenablePublieLe: iso(l.correctif_publie_le),
      certSante: sources.certSante?.correctif ?? null,
    }),
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
    exploiteMalware: l.exploite_malware,
    kitsExploitation: kitsRanges(l.kits_exploitation),
    surMachineFinSupport: l.present && l.sur_fin_support,
    nonMaintenu: l.non_maintenu,
    finSupportLe: iso(l.fin_support_le),
    nombreCves: l.nombre_cves,
    cves: l.cves,
    machines: l.machines,
    derniereDetection: iso(l.derniere),
    present: l.present,
    alerteCertFr: l.alerte_certfr,
    sources,
    priorite,
    integration: { id: l.integration_id, nom: l.integration_nom, type: l.integration_type },
    suivi: versSuiviResume(l, jour),
    delai: delaiConstat(l, priorite, reglage, maintenant),
  };
};

/** Délai de correction d'un constat (lot S1), pour sa priorité courante. */
const delaiConstat = (
  l: Pick<LigneConstat, 'suivi_etat' | 'present' | 'premiere' | 'suivi_repart'>,
  priorite: ReturnType<typeof prioriteConstat>,
  reglage: ReglagePriorite,
  maintenant: Date,
): DelaiFailleDto =>
  calculerDelai({
    priorite: priorite.niveau,
    etatSuivi: l.suivi_etat,
    present: l.present,
    premiere: l.premiere.toISOString(),
    repartLe: iso(l.suivi_repart),
    delais: reglage.delais,
    maintenant,
  });

/** Filtre par état de délai et ordre « par échéance » (lot S1), sur les éléments déjà rangés par priorité. */
function delaiFiltreTrie<T>(liste: T[], delai: (x: T) => DelaiFailleDto, q: { delai?: string; tri?: string }): T[] {
  const filtres = q.delai ? liste.filter((x) => delai(x).etat === q.delai) : liste;
  // Tri stable : à échéance égale (ou sans échéance), l'ordre par priorité est gardé.
  return q.tri === 'echeance' ? [...filtres].sort((a, b) => comparerEcheances(delai(a), delai(b))) : filtres;
}

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
    aes: nombre(l.aes),
    premiere: iso(l.premiere_detection),
    derniere: iso(l.derniere_detection),
    source: l.source,
    integration: { id: l.integration_id, nom: l.integration_nom, type: l.source },
    compteurs,
    finDeSupport: l.fins_support.length > 0,
    finsDeSupport: l.fins_support.map((f) => ({ nom: f.nom, le: new Date(f.le).toISOString() })),
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
    exploite_malware: boolean;
    kits_exploitation: string[];
    correctif_publie_le: Date | null;
    fin_support: boolean;
  }>`SELECT DISTINCT d.machine_id, c.id, c.gravite, c.cvss3_score, c.epss_score, c.exploitable, c.exploite_malware,
            c.kits_exploitation, c.correctif_publie_le,
            (d.machine_id IN (${machinesFinSupport}) AND NOT ${finSupportConstat}) AS fin_support
     FROM vulnerabilites_detections d
     JOIN vulnerabilites_machines m ON m.id = d.machine_id
     LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
     JOIN vulnerabilites_constats c ON c.id = d.constat_id
     WHERE d.machine_id = ANY(${ids}::uuid[]) AND ${present} AND NOT ${close('constat')}`.execute(k);
  // Lot S3 : Tenable parle du correctif d'une CVE déclarée s'il la cite dans un contrôle qui porte une date de correctif.
  const { rows: declarees } = await sql<{
    machine_id: string;
    cve: string;
    correctif_tenable: Date | null;
    fin_support: boolean;
  }>`
     SELECT DISTINCT m.id AS machine_id, r.cve, (SELECT min(c2.correctif_publie_le) FROM vulnerabilites_constat_cves cc2
       JOIN vulnerabilites_constats c2 ON c2.id = cc2.constat_id WHERE cc2.cve = r.cve) AS correctif_tenable,
       m.id IN (${machinesFinSupport}) AS fin_support
     FROM vulnerabilites_produits_machines pm
     JOIN vulnerabilites_machines m ON m.id = pm.machine_id
     LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
     JOIN vulnerabilites_rapprochements r ON r.produit_id = pm.produit_id AND r.statut IN ('rattachee', 'confirmee')
     WHERE m.id = ANY(${ids}::uuid[]) AND NOT ${detecteeSurMachine} AND NOT ${close('declaree')}`.execute(k);
  const ajouter = (
    machine: string,
    sources: SourcesFailleDto,
    presence: 'detectee' | 'declaree',
    correctifTenable: Date | null,
    finDeSupport: boolean,
  ) => {
    const faits = faitsDepuisSources(sources);
    const correctif = etatCorrectif({
      tenablePublieLe: iso(correctifTenable),
      certSante: sources.certSante?.correctif ?? null,
    });
    parMachine.set(machine, [
      ...(parMachine.get(machine) ?? []),
      {
        niveau: calculerPriorite({ ...faits, presence, finDeSupport }, reglage).niveau,
        exploitee: faits.exploitation.length > 0,
        exploitable: faits.exploitable.length > 0,
        sansCorrectif: correctif.etat === 'aucun_connu',
      },
    ]);
  };
  const uniques = [...new Map(constats.map((c) => [c.id, c])).values()];
  const sources = await sourcesDesConstats(k, uniques);
  for (const c of constats) ajouter(c.machine_id, sources.get(c.id)!, 'detectee', c.correctif_publie_le, c.fin_support);
  const faits = await lireFaitsCve(
    k,
    declarees.map((d) => d.cve),
  );
  for (const d of declarees) {
    const f = faits.get(d.cve);
    ajouter(d.machine_id, sourcesDe(f ? [f] : []), 'declaree', d.correctif_tenable, d.fin_support);
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
  private requeteConstats(
    user: SessionUser,
    conditions: RawBuilder<boolean>[],
    constatIds?: readonly string[],
    colonnes: 'resume' | 'ordre' = 'resume',
  ) {
    const ou = conditions.length ? sql.join(conditions, sql` AND `) : sql`true`;
    const un = constatIds ? sql`d.constat_id = ANY(${[...constatIds]}::uuid[])` : sql`true`;
    // Lot PERF (PERF-01) : lisibilité calculée une fois par machine (lm), puis deux agrégats sans tri distinct : par
    // constat et machine (x), puis par constat (par_constat). Mêmes règles qu'avant : « présent » si une détection l'est
    // sur une machine quelconque ; machines comptées et dernière détection parmi les machines lisibles où il est présent,
    // ou, s'il ne l'est plus nulle part, où il a été vu ; première présence sur toutes ses détections (premiereConstat).
    return sql`
      WITH lm AS MATERIALIZED (
        SELECT m.id, m.integration_id, ${lisible(user)} AS lisible FROM vulnerabilites_machines m),
      -- Lot PRIO-1 : machines en fin de support (toutes, un fait commun), lues une fois.
      fsm AS MATERIALIZED (${machinesFinSupport}),
      x AS (
        SELECT d.constat_id, bool_or(${present}) AS present, bool_or(m.lisible) AS lisible,
               bool_or(${present} AND d.machine_id IN (SELECT fsm.machine_id FROM fsm)) AS present_fds,
               max(d.derniere_detection) FILTER (WHERE ${present}) AS derniere_presente,
               max(d.derniere_detection) AS derniere, min(d.premiere_detection) AS premiere
        FROM vulnerabilites_detections d
        JOIN lm m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE ${un}
        GROUP BY d.constat_id, d.machine_id),
      par_constat AS (
        SELECT y.* FROM (
          SELECT x.constat_id, bool_or(x.present) AS present, bool_or(x.present_fds) AS sur_fin_support,
                 CASE WHEN bool_or(x.present) THEN count(*) FILTER (WHERE x.present AND x.lisible)
                      ELSE count(*) FILTER (WHERE x.lisible) END::int AS machines,
                 CASE WHEN bool_or(x.present) THEN max(x.derniere_presente) FILTER (WHERE x.lisible)
                      ELSE max(x.derniere) FILTER (WHERE x.lisible) END AS derniere,
                 min(x.premiere) AS premiere
          FROM x GROUP BY x.constat_id) y
        WHERE y.machines > 0)
      SELECT ${
        colonnes === 'ordre'
          ? // Colonnes de la priorité, du délai et de l'ordre seulement (LigneOrdre) : le résumé est lu pour la page.
            sql`c.id, c.plugin_id, c.gravite, c.cvss3_score, c.epss_score, c.exploitable, c.exploite_malware,
              c.kits_exploitation, (p.sur_fin_support AND NOT ${finSupportConstat}) AS sur_fin_support, p.machines,
              p.present, ${exploite} AS exploite, coalesce(p.premiere, c.cree_le) AS premiere,
              coalesce(s.etat, 'nouvelle') AS suivi_etat, s.delai_repart_le AS suivi_repart`
          : sql`c.*, i.nom AS integration_nom, i.type AS integration_type, p.machines, p.derniere, p.present,
              (p.sur_fin_support AND NOT ${finSupportConstat}) AS sur_fin_support,
              ${exploite} AS exploite, ${sansCve} AS non_maintenu,
              coalesce(p.premiere, c.cree_le) AS premiere,
              ${alerteConstat} AS alerte_certfr, ${epssVeille} AS epss_veille,
              (SELECT count(*)::int FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id) AS nombre_cves,
              ARRAY(SELECT cc.cve FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id ORDER BY cc.cve DESC
                LIMIT 5) AS cves,
              ${colonnesSuivi}`
      }
      FROM vulnerabilites_constats c JOIN par_constat p ON p.constat_id = c.id
      JOIN integrations i ON i.id = c.integration_id
      LEFT JOIN vulnerabilites_suivis s ON s.constat_id = c.id
      WHERE ${ou}`;
  }

  async constats(user: SessionUser, q: RechercheConstats): Promise<PageFailles<ConstatResumeDto>> {
    const conditions: RawBuilder<boolean>[] = [];
    if (q.gravite) conditions.push(sql<boolean>`c.gravite = ${q.gravite}`);
    if (q.exploite) conditions.push(exploiteeAvere);
    if (q.exploitable) conditions.push(exploitableSources);
    if (q.nonMaintenu) conditions.push(sansCve);
    if (q.finSupport) conditions.push(finSupportConstat);
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
    const { rows } = await sql<LigneOrdre>`SELECT * FROM (${this.requeteConstats(
      user,
      conditions,
      undefined,
      'ordre',
    )}) c`.execute(this.db.k);
    const sources = await sourcesDesConstats(this.db.k, rows);
    const maintenant = new Date();
    const jour = aujourdhui(maintenant);
    // Priorité calculée par la fonction partagée, puis filtre et ordre : priorité, gravité, exploitée, machines, contrôle.
    // Lot PERF (PERF-01) : l'ordre dépend de la priorité, calculée en TypeScript sur les faits des sources ; il reste fait
    // en mémoire, sur les constats déjà filtrés en SQL, sans copie de la règle en SQL. Seuls la priorité (et le délai, s'il
    // sert au filtre ou à l'ordre) sont calculés pour tous, sur les colonnes utiles (LigneOrdre) ; le résumé complet n'est lu
    // et calculé que pour la page rendue (seconde requête, mêmes règles, limitée à ces constats), avec la même priorité.
    const ranges = rows
      .map((l) => {
        const s = sources.get(l.id)!;
        return { l, s, priorite: prioriteConstat(l, s, reglage), delai: null as DelaiFailleDto | null };
      })
      .filter((x) => !q.priorite || x.priorite.niveau === q.priorite)
      .sort(
        (a, b) =>
          a.priorite.niveau.localeCompare(b.priorite.niveau) ||
          // Lot PRIO-1 (décision du RSSI du 20/11/2026) : à priorité égale, utilisée par des rançongiciels d'abord.
          Number(prioriteRancongiciel(b.priorite)) - Number(prioriteRancongiciel(a.priorite)) ||
          ORDRE_GRAVITE(a.l.gravite) - ORDRE_GRAVITE(b.l.gravite) ||
          Number(b.l.exploite) - Number(a.l.exploite) ||
          b.l.machines - a.l.machines ||
          a.l.plugin_id - b.l.plugin_id,
      );
    const delai = (x: (typeof ranges)[number]) => (x.delai ??= delaiConstat(x.l, x.priorite, reglage, maintenant));
    const tous = delaiFiltreTrie(ranges, delai, q);
    const debut = (q.page - 1) * FAILLES_PAR_PAGE;
    const page = tous.slice(debut, debut + FAILLES_PAR_PAGE);
    const { rows: completes } = page.length
      ? await sql<LigneConstat>`SELECT * FROM (${this.requeteConstats(
          user,
          [],
          page.map((x) => x.l.id),
        )}) c`.execute(this.db.k)
      : { rows: [] };
    const parId = new Map(completes.map((l) => [l.id, l]));
    return {
      total: tous.length,
      page: q.page,
      parPage: FAILLES_PAR_PAGE,
      // Un constat retiré entre les deux lectures (synchronisation concurrente) n'est pas rendu.
      elements: page.flatMap((x) => {
        const l = parId.get(x.l.id);
        return l ? [versResume(l, x.s, reglage, maintenant, jour, x.priorite)] : [];
      }),
    };
  }

  /** Fiche d'un constat : ses CVE (avec leur présence au catalogue KEV) et les machines lisibles où il est présent (à
      défaut, où il a été vu en dernier), par rôle. Un constat sans machine lisible répond comme un constat inconnu. */
  async constat(user: SessionUser, id: string): Promise<ConstatDto> {
    const { rows } = await sql<LigneConstat>`
      SELECT x.* FROM (${this.requeteConstats(user, [sql<boolean>`c.id = ${id}::uuid`], [id])}) x`.execute(this.db.k);
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
    };
  }

  /* ---------------------------------------------------------------- Machines */
  /** Toutes les machines lisibles, avec leurs compteurs (constats présents, puis failles déclarées non détectées), rangées
      de la plus critique à la moins critique (rangerMachines du paquet partagé). Une faille corrigée, au risque accepté ou
      non concernée ne compte pas (lot V4b). Public : le suivi (V30) et l'assistant (repères) rangent les machines par ce
      même rang. */
  async machinesRangees(user: SessionUser): Promise<MachineDto[]> {
    // Lot PERF (PERF-02) : machines lisibles calculées une fois (lm), faits de chaque constat ouvert une fois (cf), puis un
    // seul agrégat par machine (k) et une seule lecture des fins de support (fs), au lieu d'une sous-requête latérale et
    // d'une sous-requête « fin de support » par machine. Mêmes compteurs, mêmes cinq fins de support au plus, même ordre.
    const { rows } = await sql<LigneMachine>`
      WITH lm AS MATERIALIZED (
        SELECT m.id, m.integration_id FROM vulnerabilites_machines m WHERE ${lisible(user)}),
      -- Mêmes règles que les fragments exploite et exploiteeAvere, sous forme d'ensembles (une lecture chacun).
      ex AS MATERIALIZED (${cvesExploitees}),
      cf AS MATERIALIZED (
        SELECT c.id, c.gravite, (c.exploitable OR cardinality(c.kits_exploitation) > 0) AS exploitable,
               c.id IN (SELECT cc.constat_id FROM vulnerabilites_constat_cves cc
                        JOIN vulnerabilites_veille_cve v ON v.cve = cc.cve WHERE v.kev_ajout IS NOT NULL) AS exploite,
               (c.exploite_malware OR c.id IN (SELECT cc.constat_id FROM vulnerabilites_constat_cves cc
                                               JOIN ex ON ex.cve = cc.cve)) AS avere
        FROM vulnerabilites_constats c WHERE NOT ${close('constat')}),
      k AS (
        SELECT d.machine_id,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'critique')::int AS critique,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'elevee')::int AS elevee,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'moyenne')::int AS moyenne,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'faible')::int AS faible,
               count(DISTINCT c.id) FILTER (WHERE c.exploite)::int AS exploites,
               count(DISTINCT c.id) FILTER (WHERE c.exploitable)::int AS exploitables,
               count(DISTINCT c.id) FILTER (WHERE c.avere)::int AS exploitees_avere
        FROM lm m JOIN vulnerabilites_detections d ON d.machine_id = m.id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        JOIN cf c ON c.id = d.constat_id
        WHERE ${present}
        GROUP BY d.machine_id),
      -- Lot S3 : contrôles présents en fin de support, quel que soit leur état de suivi (cinq au plus par machine).
      fs AS (
        SELECT z.machine_id, json_agg(json_build_object('nom', z.nom, 'le', z.le) ORDER BY z.le, z.nom) AS fins
        FROM (SELECT y.*, row_number() OVER (PARTITION BY y.machine_id ORDER BY y.le, y.nom) AS n
              FROM (SELECT DISTINCT d.machine_id, c.nom, c.fin_support_le AS le
                    FROM vulnerabilites_constats c JOIN vulnerabilites_detections d ON d.constat_id = c.id
                    JOIN lm m ON m.id = d.machine_id
                    LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
                    WHERE ${finSupportConstat} AND ${present}) y) z
        WHERE z.n <= 5 GROUP BY z.machine_id)
      SELECT m.id, m.nom, m.adresse, m.systeme, m.role, ${perimetreMachine} AS perimetre_id, s.name AS perimetre_nom,
             CASE WHEN m.perimetre_id IS NOT NULL THEN 'machine' WHEN td.perimetre_id IS NOT NULL THEN 'depot' END
               AS perimetre_origine,
             td.id AS depot_id, td.nom AS depot_nom,
             -- Périmètre du dépôt : montré seulement s'il est visible de la personne (son nom ne fuit pas autrement).
             CASE WHEN td.perimetre_id = ANY(${perimetresVisibles(user)}) THEN td.perimetre_id END AS depot_perimetre_id,
             CASE WHEN td.perimetre_id = ANY(${perimetresVisibles(user)}) THEN sd.name END AS depot_perimetre_nom,
             m.exposition, m.acr, m.aes,
             m.premiere_detection, m.derniere_detection, m.integration_id, i.nom AS integration_nom, m.source, m.version,
             coalesce(k.critique, 0) AS critique, coalesce(k.elevee, 0) AS elevee, coalesce(k.moyenne, 0) AS moyenne,
             coalesce(k.faible, 0) AS faible, coalesce(k.exploites, 0) AS exploites,
             coalesce(k.exploitables, 0) AS exploitables, coalesce(k.exploitees_avere, 0) AS exploitees_avere,
             coalesce(fs.fins, '[]'::json) AS fins_support
      FROM lm
      JOIN vulnerabilites_machines m ON m.id = lm.id
      JOIN integrations i ON i.id = m.integration_id
      LEFT JOIN vulnerabilites_tenable_depots td ON td.id = m.depot_id
      LEFT JOIN grc_smsis sd ON sd.id = td.perimetre_id
      LEFT JOIN grc_smsis s ON s.id = ${perimetreMachine}
      LEFT JOIN k ON k.machine_id = m.id
      LEFT JOIN fs ON fs.machine_id = m.id`.execute(this.db.k);
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

  /** Machines lisibles, de la plus critique à la moins critique ; recherche par nom ou système (partiels, casse ignorée) ou
      par adresse IP (préfixe), règle commune avec la barre de recherche (lot R1) ; filtres par rôle et périmètre. Le rang
      est calculé sur toutes les machines lisibles, avant les filtres. Lot TEN-SCORES : filtres par catégorie minimale d'ACR
      et d'AES, en SQL (selonFiltresSql), avant la pagination ; lot GRP-MACHINES : filtre par groupe, dans la même requête. */
  async machines(user: SessionUser, q: RechercheMachines): Promise<PageMachines> {
    const toutes = await this.machinesRangees(user);
    const scores = await this.selonFiltresSql(user, q);
    const texte = q.q?.trim();
    const filtrees = toutes.filter(
      (m) =>
        (!texte || machineCorrespond(m, texte)) &&
        (q.role === 'aucun' ? m.role === null : !q.role || m.role === q.role) &&
        (q.perimetre === 'aucun' ? m.perimetreId === null : !q.perimetre || m.perimetreId === q.perimetre) &&
        (!q.finSupport || m.finDeSupport) &&
        (!scores || scores.has(m.id)),
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

  /** Lot TEN-SCORES : identifiants des machines lisibles (même règle `lisible` que la liste) dont la criticité (ACR) et
      l'exposition (AES) selon Tenable atteignent la catégorie minimale demandée ; une machine sans valeur ne répond à aucun
      filtre actif. Lot GRP-MACHINES : dans la même requête, machines d'un groupe, ou sans aucun groupe (`aucun`). `null` :
      aucun filtre demandé (aucune requête). Une requête de plus, seulement avec un filtre, quel que soit leur nombre. Le
      rang reste calculé sur toutes les machines lisibles ; ni priorité ni rang ne dépendent de ces filtres. */
  private async selonFiltresSql(
    user: SessionUser,
    q: { acr?: FiltreAcr; aes?: FiltreAes; groupe?: string },
  ): Promise<Set<string> | null> {
    if (!q.acr && !q.aes && !q.groupe) return null;
    const conditions: RawBuilder<boolean>[] = [lisible(user)];
    if (q.acr) conditions.push(sql<boolean>`m.acr >= ${SEUILS_ACR[q.acr]}`);
    if (q.aes) conditions.push(sql<boolean>`m.aes >= ${SEUILS_AES[q.aes]}`);
    if (q.groupe === 'aucun')
      conditions.push(
        sql<boolean>`NOT EXISTS (SELECT 1 FROM vulnerabilites_groupe_machines gm WHERE gm.machine_id = m.id)`,
      );
    else if (q.groupe)
      conditions.push(sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_groupe_machines gm
        WHERE gm.machine_id = m.id AND gm.groupe_id = ${q.groupe}::uuid)`);
    const { rows } = await sql<{ id: string }>`
      SELECT m.id FROM vulnerabilites_machines m WHERE ${sql.join(conditions, sql` AND `)}`.execute(this.db.k);
    return new Set(rows.map((r) => r.id));
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
      leurs compteurs 2, réglage 1, marques 9 (faillesDesMachines) ; 12 au plus, 13 avec un filtre d'ACR, d'AES (lot
      TEN-SCORES) ou de groupe (lot GRP-MACHINES), une seule de plus quel que soit le nombre de ces filtres. */
  async parc(user: SessionUser, q: RechercheParc): Promise<ParcMachinesDto> {
    const toutes = await this.machinesRangees(user);
    const scores = await this.selonFiltresSql(user, q);
    const texte = q.q?.trim();
    const filtrees = toutes.filter(
      (m) =>
        (!texte || machineCorrespond(m, texte)) &&
        (q.role === 'aucun' ? m.role === null : !q.role || m.role === q.role) &&
        (q.perimetre === 'aucun' ? m.perimetreId === null : !q.perimetre || m.perimetreId === q.perimetre) &&
        (!q.finSupport || m.finDeSupport) &&
        (!scores || scores.has(m.id)),
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
        premiere: Date;
        fin_support: boolean;
      }
    >`
      SELECT r.id, r.cve, r.statut, r.cree_le AS premiere, p.id AS produit_id, p.editeur, p.nom, p.version_produit,
             ${produitSurMachineFinSupport} AS fin_support,
             v.cvss31_gravite,
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
    const maintenant = new Date();
    const jour = aujourdhui(maintenant);
    return rows.map((l): FailleDeclareeDto => {
      const f = faits.get(l.cve);
      const sources = sourcesDe(f ? [f] : []);
      const retenues = valeursRetenues(sources.valeurs);
      const rattachee = l.statut === 'rattachee' || l.statut === 'confirmee';
      const priorite = calculerPriorite(
        {
          ...faitsDepuisSources(sources),
          presence: rattachee ? 'declaree' : l.statut === 'proposee' ? 'a_confirmer' : 'absente',
          // Lot PRIO-1 : un cran de plus si une machine reliée au produit est en fin de support.
          finDeSupport: rattachee && l.fin_support,
        },
        reglage,
      );
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
        priorite,
        suivi: versSuiviResume(l, jour),
        delai: calculerDelai({
          priorite: priorite.niveau,
          etatSuivi: l.suivi_etat,
          present: rattachee,
          premiere: l.premiere.toISOString(),
          repartLe: iso(l.suivi_repart),
          delais: reglage.delais,
          maintenant,
        }),
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
    const ranges = (await this.lignesDeclarees(user, conditions))
      .filter((x) => !q.priorite || x.priorite.niveau === q.priorite)
      .sort(
        (a, b) =>
          a.priorite.niveau.localeCompare(b.priorite.niveau) ||
          Number(prioriteRancongiciel(b.priorite)) - Number(prioriteRancongiciel(a.priorite)) ||
          ORDRE_GRAVITE(a.gravite) - ORDRE_GRAVITE(b.gravite) ||
          (a.cve < b.cve ? 1 : a.cve > b.cve ? -1 : 0) ||
          (a.produit.id < b.produit.id ? -1 : a.produit.id > b.produit.id ? 1 : 0),
      );
    const tous = delaiFiltreTrie(ranges, (x) => x.delai, q);
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
