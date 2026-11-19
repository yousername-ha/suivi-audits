/* Module Vulnérabilités (ADR 0100, points 9 et 16 ; lot V4a) : priorité d'une faille et rang d'une machine, calculés par
   la plateforme, jamais par le modèle. Fonctions pures et déterministes : à faits égaux, même résultat (rejouable). Chaque
   résultat rend les faits qui le fondent, sous forme structurée ; aucun taux n'est calculé ni inventé. */
import { z } from 'zod';
import {
  GRAVITE_TENABLE_LIBELLES,
  type GraviteTenable,
  NiveauPriorite,
  NIVEAUX_PRIORITE,
  ROLE_MACHINE_LIBELLES,
  type RoleMachine,
} from './failles-tenable.js';
import type { StatutRapprochement } from './rapprochement-vulnerabilites.js';
import {
  DELAIS_CORRECTION_DEFAUT,
  DelaisCorrection,
  type DelaiFailleDto,
  EtatDelaiFiltre,
  TriFailles,
} from './delais-vulnerabilites.js';
import { FiltreSuivi, type SuiviResumeDto } from './suivi-vulnerabilites.js';

/* ------------------------------------------------------------------ Réglage (vulnerabilites:administrer) */
/** Seuil du score EPSS (probabilité entre 0 et 1) à partir duquel une faille présente passe en P2. Seul seuil réglable de la
    grille de départ ; les gravités de la grille sont fixes. Lot S1 : délai cible de correction par priorité, réglé avec
    les seuils (même droit, même If-Match, même journal ; valeurs par défaut à confirmer par le RSSI). */
const seuilEpss = z.number().min(0.01, 'Seuil EPSS entre 0,01 et 1.').max(1, 'Seuil EPSS entre 0,01 et 1.');
export const ReglagePriorite = z.object({ seuilEpss, delais: DelaisCorrection }).strict();
export type ReglagePriorite = z.infer<typeof ReglagePriorite>;
export const REGLAGE_PRIORITE_DEFAUT: ReglagePriorite = { seuilEpss: 0.5, delais: DELAIS_CORRECTION_DEFAUT };
/** Saisie d'un réglage (PUT) : le seuil, les délais, ou les deux ; ce qui n'est pas cité reste inchangé. */
export const SaisieReglagePriorite = z
  .object({ seuilEpss: seuilEpss.optional(), delais: DelaisCorrection.optional() })
  .strict()
  .refine((v) => v.seuilEpss !== undefined || v.delais !== undefined, 'Aucune modification.');
export type SaisieReglagePriorite = z.infer<typeof SaisieReglagePriorite>;

export interface ReglagePrioriteOut {
  values: ReglagePriorite;
  version: number;
}

/* ------------------------------------------------------------------ Priorité d'une faille */
/** Présence dans l'organisation : détectée par Tenable, déclarée (produit surveillé, rapprochement rattaché), exposée sur
    Internet (CVE portée par un actif vu par AlgoLightHouse, lot ALH2 : une faille présente chez nous), produit à confirmer
    (rapprochement proposé), ou absente. */
export const PRESENCES = ['detectee', 'declaree', 'exposee', 'a_confirmer', 'absente'] as const;
export type Presence = (typeof PRESENCES)[number];
export const PRESENCE_LIBELLES: Record<Presence, string> = {
  detectee: 'Détectée par Tenable',
  declaree: 'Déclarée (produit surveillé)',
  exposee: 'Exposée sur Internet (AlgoLightHouse)',
  a_confirmer: 'Produit à confirmer',
  absente: 'Absente',
};
/** Présences qui valent « présente chez nous » pour la grille. */
export const presenceAveree = (p: Presence): boolean => p === 'detectee' || p === 'declaree' || p === 'exposee';

/** Sources d'une exploitation avérée (V26 : une seule suffit, « ou » logique) : catalogue KEV de la CISA, alerte du CERT-FR
    qui cite la CVE, mention « La faille est activement exploitée : Oui » de la fiche du CERT Santé (V23), champ
    `is_exploited` d'une CVE de technologie selon AlgoLightHouse (lot ALH2, décision B du 17/11/2026), contrôle de Tenable
    marqué « exploité par un logiciel malveillant » (`exploited_by_malware` d'un fichier .nessus, lot N2, décision du RSSI
    du 19/11/2026 ; un fait du contrôle, sans date : rangé après les sources datées). */
export const SOURCES_EXPLOITATION = ['kev', 'cert-fr', 'cert-sante', 'alh', 'tenable'] as const;
export type SourceExploitation = (typeof SOURCES_EXPLOITATION)[number];
export const SOURCE_EXPLOITATION_LIBELLES: Record<SourceExploitation, string> = {
  kev: 'catalogue KEV',
  'cert-fr': 'alerte du CERT-FR',
  'cert-sante': 'fiche du CERT Santé',
  alh: 'AlgoLightHouse',
  tenable: 'Exploitée par un logiciel malveillant (selon Tenable)',
};

/** Sources de « exploitable » (un code d'exploitation existe, sans exploitation observée ; V26) : champ `exploitAvailable`
    de Tenable, preuve de concept disponible selon la fiche du CERT Santé (V23), champ `has_poc` d'AlgoLightHouse (lot
    ALH2). */
export const SOURCES_EXPLOITABLE = ['tenable', 'cert-sante', 'alh'] as const;
export type SourceExploitable = (typeof SOURCES_EXPLOITABLE)[number];
export const SOURCE_EXPLOITABLE_LIBELLES: Record<SourceExploitable, string> = {
  tenable: 'Tenable',
  'cert-sante': 'preuve de concept selon le CERT Santé',
  alh: 'preuve de concept selon AlgoLightHouse',
};

/** Un fait signalé par une source, avec la date à laquelle elle l'a signalé (null : date inconnue, par exemple Tenable). */
export interface Signalement<S extends string> {
  source: S;
  le: string | null;
}

/** Signalements rangés de la source en avance à la plus tardive (V26 : « la source en avance prime ») ; date inconnue en
    dernier ; à date égale, ordre de la liste des sources. Une source n'apparaît qu'une fois, à sa date la plus ancienne. */
export function rangerSignalements<S extends string>(
  liste: readonly Signalement<S>[],
  ordre: readonly S[],
): Signalement<S>[] {
  const parSource = new Map<S, Signalement<S>>();
  for (const x of liste) {
    if (!ordre.includes(x.source)) continue;
    const deja = parSource.get(x.source);
    if (!deja || (x.le !== null && (deja.le === null || x.le < deja.le))) parSource.set(x.source, { ...x });
  }
  return [...parSource.values()].sort(
    (a, b) =>
      (a.le === null ? 1 : 0) - (b.le === null ? 1 : 0) ||
      (a.le !== null && b.le !== null && a.le !== b.le ? (a.le < b.le ? -1 : 1) : 0) ||
      ordre.indexOf(a.source) - ordre.indexOf(b.source),
  );
}

/** Première source à avoir signalé le fait, ou null. */
export const premierSignalement = <S extends string>(
  liste: readonly Signalement<S>[],
  ordre: readonly S[],
): Signalement<S> | null => rangerSignalements(liste, ordre)[0] ?? null;

/* ------------------------------------------------------------------ Valeurs par source (V27) */
/** Sources d'une gravité ou d'un score : NVD, Tenable, CERT Santé (score CVSS v3.1 de sa fiche), FIRST (score EPSS lu par
    la veille), AlgoLightHouse (score CVSS et EPSS d'une CVE de technologie, gravité déduite du score ; lot ALH2). */
export const SOURCES_VALEUR = ['nvd', 'tenable', 'cert-sante', 'first', 'alh'] as const;
export type SourceValeur = (typeof SOURCES_VALEUR)[number];
export const SOURCE_VALEUR_LIBELLES: Record<SourceValeur, string> = {
  nvd: 'NVD',
  tenable: 'Tenable',
  'cert-sante': 'CERT Santé',
  first: 'FIRST (veille)',
  alh: 'AlgoLightHouse',
};

export interface GraviteSource {
  source: SourceValeur;
  gravite: GraviteTenable;
}
export interface ScoreSource {
  source: SourceValeur;
  score: number;
}

/** Valeurs d'un même fait selon chaque source, toutes gardées (V27). */
export interface ValeursFaille {
  gravites: GraviteSource[];
  /** Scores CVSS (sur 10). */
  cvss: ScoreSource[];
  /** Scores EPSS (probabilité entre 0 et 1). */
  epss: ScoreSource[];
}
export const VALEURS_VIDES: ValeursFaille = { gravites: [], cvss: [], epss: [] };

const RANG_GRAVITE: Record<GraviteTenable, number> = { critique: 4, elevee: 3, moyenne: 2, faible: 1 };

/** Gravité qualitative d'un score CVSS v3 (échelle publiée par FIRST) : 9 à 10 critique, 7 à 8,9 élevée, 4 à 6,9 moyenne,
    0,1 à 3,9 faible ; 0 ou hors échelle : null. */
export function graviteDepuisScore(score: number | null): GraviteTenable | null {
  if (score === null || !Number.isFinite(score) || score <= 0 || score > 10) return null;
  return score >= 9 ? 'critique' : score >= 7 ? 'elevee' : score >= 4 ? 'moyenne' : 'faible';
}

/** Valeur la plus sévère de chaque fait (V27), avec sa source : gravité la plus haute, score CVSS et score EPSS les plus
    hauts. À valeur égale, la première source de SOURCES_VALEUR l'emporte (résultat rejouable). Aucune valeur : null. */
export function valeursRetenues(v: ValeursFaille): {
  gravite: GraviteSource | null;
  cvss: ScoreSource | null;
  epss: ScoreSource | null;
} {
  const ordre = (s: SourceValeur) => SOURCES_VALEUR.indexOf(s);
  const plus = <T extends { source: SourceValeur }>(liste: readonly T[], valeur: (x: T) => number): T | null =>
    [...liste].sort((a, b) => valeur(b) - valeur(a) || ordre(a.source) - ordre(b.source))[0] ?? null;
  return {
    gravite: plus(v.gravites, (x) => RANG_GRAVITE[x.gravite]),
    cvss: plus(
      v.cvss.filter((x) => Number.isFinite(x.score)),
      (x) => x.score,
    ),
    epss: plus(
      v.epss.filter((x) => Number.isFinite(x.score)),
      (x) => x.score,
    ),
  };
}

/** Mention structurée de la fiche du CERT Santé, telle quelle : oui, non, ou null (non renseignée). */
export type MentionCertSante = 'oui' | 'non';

/** Ce que chaque source dit d'une faille (V26, V27) : sources de l'exploitation avérée et de « exploitable », rangées de la
    première à la dernière avec leur date ; valeurs par source ; mentions « correctif » et « contournement » de la fiche du
    CERT Santé (null : non renseignées, ou aucune fiche lue). */
export interface SourcesFailleDto {
  exploitation: Signalement<SourceExploitation>[];
  exploitable: Signalement<SourceExploitable>[];
  valeurs: ValeursFaille;
  certSante: { correctif: MentionCertSante | null; contournement: MentionCertSante | null } | null;
}

/** Part des faits d'une priorité tirée de ce que disent les sources : exploitation, « exploitable », gravité et score
    EPSS les plus sévères (V26, V27). La présence vient du rapprochement ou de la détection. */
export function faitsDepuisSources(s: SourcesFailleDto): Omit<FaitsFaille, 'presence'> {
  const r = valeursRetenues(s.valeurs);
  return {
    exploitation: s.exploitation.map((x) => x.source),
    exploitable: s.exploitable.map((x) => x.source),
    gravite: r.gravite?.gravite ?? null,
    epss: r.epss?.score ?? null,
  };
}

/** Faits d'une faille, rassemblés par l'API (fonction faitsDepuisSources pour la part venue des sources). */
export interface FaitsFaille {
  exploitation: readonly SourceExploitation[];
  presence: Presence;
  /** Gravité retenue : la plus sévère des sources (V27). */
  gravite: GraviteTenable | null;
  /** Score EPSS retenu (probabilité entre 0 et 1, le plus haut des sources), ou null s'il n'est pas connu. */
  epss: number | null;
  /** Sources selon lesquelles un code d'exploitation existe (Tenable, preuve de concept du CERT Santé). */
  exploitable: readonly SourceExploitable[];
}

export type FaitPriorite =
  | { fait: 'exploitation'; sources: SourceExploitation[] }
  | { fait: 'presence'; presence: Presence }
  | { fait: 'gravite'; gravite: GraviteTenable | null }
  | { fait: 'epss'; score: number; seuil: number }
  | { fait: 'exploit_disponible'; sources: SourceExploitable[] }
  /** Lot ALH5 (décision B) : l'actif exposé est relié (liaison confirmée) à une machine interne qui porte elle-même une
      faille présente en P1 ou P2. Aucun nom : la machine n'est montrée qu'à qui la lit, ailleurs. */
  | { fait: 'machine_interne_vulnerable' };

export interface Priorite {
  niveau: NiveauPriorite;
  faits: FaitPriorite[];
}

/** Grille de départ (ADR 0100, point 9) :
    - P1 : exploitation avérée (une source suffit, V26) et présente (détectée, déclarée ou exposée sur Internet) ;
    - P2 : exploitation avérée et produit à confirmer ; ou présente et critique ; ou présente et score EPSS au moins égal
      au seuil ; ou présente, élevée et exploitable selon une source (Tenable, CERT Santé) ;
    - P3 : présente et élevée ;
    - P4 : le reste.
    Les faits rendus sont ceux des règles remplies au niveau retenu (dans l'ordre de la grille, sans doublon) ; au niveau
    P4, la présence, la gravité et, le cas échéant, l'exploitation. */
export function calculerPriorite(
  f: FaitsFaille,
  reglage: Pick<ReglagePriorite, 'seuilEpss'> = REGLAGE_PRIORITE_DEFAUT,
): Priorite {
  const sources = SOURCES_EXPLOITATION.filter((s) => f.exploitation.includes(s));
  const exploitables = SOURCES_EXPLOITABLE.filter((s) => f.exploitable.includes(s));
  const exploitee = sources.length > 0;
  const presente = presenceAveree(f.presence);
  const exploitation: FaitPriorite = { fait: 'exploitation', sources };
  const presence: FaitPriorite = { fait: 'presence', presence: f.presence };
  const gravite: FaitPriorite = { fait: 'gravite', gravite: f.gravite };
  if (exploitee && presente) return { niveau: 'P1', faits: [exploitation, presence] };
  const p2: FaitPriorite[] = [];
  const ajouter = (...faits: FaitPriorite[]) => {
    for (const x of faits) if (!p2.some((y) => JSON.stringify(y) === JSON.stringify(x))) p2.push(x);
  };
  if (exploitee && f.presence === 'a_confirmer') ajouter(exploitation, presence);
  if (presente && f.gravite === 'critique') ajouter(presence, gravite);
  if (presente && f.epss !== null && f.epss >= reglage.seuilEpss)
    ajouter(presence, { fait: 'epss', score: f.epss, seuil: reglage.seuilEpss });
  if (presente && f.gravite === 'elevee' && exploitables.length)
    ajouter(presence, gravite, { fait: 'exploit_disponible', sources: exploitables });
  if (p2.length) return { niveau: 'P2', faits: p2 };
  if (presente && f.gravite === 'elevee') return { niveau: 'P3', faits: [presence, gravite] };
  return { niveau: 'P4', faits: exploitee ? [exploitation, presence, gravite] : [presence, gravite] };
}

/** Rang d'un niveau (P1 : 1). */
export const rangPriorite = (p: Pick<Priorite, 'niveau'>): number => Number(p.niveau.slice(1));
/** Priorité la plus haute d'une liste (la première à niveau égal), ou null pour une liste vide. */
export function prioriteLaPlusHaute(liste: readonly Priorite[]): Priorite | null {
  let m: Priorite | null = null;
  for (const p of liste) if (!m || rangPriorite(p) < rangPriorite(m)) m = p;
  return m;
}

/* ------------------------------------------------------------------ Majoration par la machine interne (lot ALH5) */
/** Niveaux d'une faille présente qui rendent une machine interne « vulnérable » (décision B du RSSI du 17/11/2026). */
export const NIVEAUX_MACHINE_VULNERABLE: readonly NiveauPriorite[] = ['P1', 'P2'];

/** Une machine interne est « vulnérable » si au moins une faille présente chez elle (détectée ou déclarée, non close) est
    en P1 ou en P2. Les priorités reçues sont celles de ces failles, calculées sur tous les faits connus. */
export const machineVulnerable = (priorites: readonly Pick<Priorite, 'niveau'>[]): boolean =>
  priorites.some((p) => NIVEAUX_MACHINE_VULNERABLE.includes(p.niveau));

/** Majoration d'une alerte ouverte ou d'une technologie exposée (et des CVE qu'elle porte sur la surface externe) dont
    l'actif est relié, par une liaison CONFIRMÉE, à une machine interne vulnérable : un cran de plus (P4 → P3, P3 → P2,
    P2 → P1 ; P1 reste P1), avec le fait « mène à une machine interne vulnérable » ajouté à la fin. Sans liaison
    confirmée vers une telle machine (proposition non confirmée comprise), la priorité est rendue telle quelle. Seconde
    étape de la grille, jamais appliquée aux failles des machines elles-mêmes (pas de cycle). */
export function majorerPriorite(p: Priorite, meneAUneMachineVulnerable: boolean): Priorite {
  if (!meneAUneMachineVulnerable) return p;
  const niveau = NIVEAUX_PRIORITE[Math.max(0, rangPriorite(p) - 2)]!;
  return { niveau, faits: [...p.faits, { fait: 'machine_interne_vulnerable' }] };
}

const pourcent = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

/** Libellé d'un fait, pour l'affichage. */
export function libelleFaitPriorite(f: FaitPriorite): string {
  switch (f.fait) {
    case 'exploitation':
      return `Exploitation avérée (${f.sources.map((s) => SOURCE_EXPLOITATION_LIBELLES[s]).join(', ')})`;
    case 'presence':
      return PRESENCE_LIBELLES[f.presence];
    case 'gravite':
      return f.gravite ? `Gravité ${GRAVITE_TENABLE_LIBELLES[f.gravite].toLowerCase()}` : 'Gravité non publiée';
    case 'epss':
      return `Score EPSS ${pourcent(f.score)} (seuil ${pourcent(f.seuil)})`;
    case 'exploit_disponible':
      return `Code d’exploitation disponible (${f.sources.map((s) => SOURCE_EXPLOITABLE_LIBELLES[s]).join(', ')})`;
    case 'machine_interne_vulnerable':
      return 'Mène à une machine interne vulnérable';
  }
}

/** Gravité d'une CVE d'après NVD : CVSS 3.1 d'abord, sinon CVSS 4.0 ; « NONE » ou absente : null. */
export function graviteDepuisNvd(cvss31: string | null, cvss40: string | null): GraviteTenable | null {
  const g = cvss31 ?? cvss40;
  switch (g) {
    case 'CRITICAL':
      return 'critique';
    case 'HIGH':
      return 'elevee';
    case 'MEDIUM':
      return 'moyenne';
    case 'LOW':
      return 'faible';
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ Rang d'une machine */
/** Ordre des rôles dans le rang : front, puis back applicatif, puis base de données, puis rôle non renseigné. */
export const ORDRE_ROLES_RANG: readonly (RoleMachine | null)[] = ['front', 'back', 'bdd', null];

export interface FaitsMachine {
  /** Failles présentes sur la machine dont l'exploitation est avérée (détectées ou déclarées). */
  exploitationAveree: number;
  role: RoleMachine | null;
  critiques: number;
  elevees: number;
}

export type FaitRang =
  | { fait: 'exploitation'; nombre: number }
  | { fait: 'role'; role: RoleMachine | null }
  | { fait: 'critiques'; nombre: number }
  | { fait: 'elevees'; nombre: number };

/** Faits qui fondent le rang, dans l'ordre du classement. */
export function faitsRang(m: FaitsMachine): FaitRang[] {
  return [
    { fait: 'exploitation', nombre: m.exploitationAveree },
    { fait: 'role', role: m.role },
    { fait: 'critiques', nombre: m.critiques },
    { fait: 'elevees', nombre: m.elevees },
  ];
}

/** Ordre (ADR 0100, point 16) : exploitation avérée d'abord, puis rôle (front, back, base de données, sans rôle), puis
    nombre de failles critiques, puis d'élevées, du plus au moins ; à égalité, la clé (nom affiché puis identifiant)
    départage, pour un ordre stable et rejouable. */
export function comparerMachines<T extends FaitsMachine & { cle: string }>(a: T, b: T): number {
  const ea = a.exploitationAveree > 0 ? 0 : 1;
  const eb = b.exploitationAveree > 0 ? 0 : 1;
  if (ea !== eb) return ea - eb;
  const ra = ORDRE_ROLES_RANG.indexOf(a.role);
  const rb = ORDRE_ROLES_RANG.indexOf(b.role);
  if (ra !== rb) return ra - rb;
  if (a.critiques !== b.critiques) return b.critiques - a.critiques;
  if (a.elevees !== b.elevees) return b.elevees - a.elevees;
  return a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0;
}

/** Machines rangées de la plus critique à la moins critique, avec leur position (1 pour la première). */
export function rangerMachines<T extends FaitsMachine & { cle: string }>(
  machines: readonly T[],
): (T & { rang: number })[] {
  return [...machines].sort(comparerMachines).map((m, i) => ({ ...m, rang: i + 1 }));
}

export function libelleFaitRang(f: FaitRang): string {
  switch (f.fait) {
    case 'exploitation':
      return f.nombre
        ? `${f.nombre} faille${f.nombre > 1 ? 's' : ''} à l’exploitation avérée`
        : 'Aucune exploitation avérée';
    case 'role':
      return f.role ? `Rôle : ${ROLE_MACHINE_LIBELLES[f.role]}` : 'Rôle non renseigné';
    case 'critiques':
      return `${f.nombre} critique${f.nombre > 1 ? 's' : ''}`;
    case 'elevees':
      return `${f.nombre} élevée${f.nombre > 1 ? 's' : ''}`;
  }
}

/** Rang d'une machine parmi celles que la personne peut lire. */
export interface RangMachineDto {
  position: number;
  total: number;
  faits: FaitRang[];
}

/* ------------------------------------------------------------------ Failles déclarées (V20) */
/** Failles déclarées : CVE rattachées (d'office ou confirmées) à un produit relié à des machines lisibles, hors machines où
    Tenable détecte déjà la CVE. Recherche par identifiant CVE, éditeur ou nom du produit ; filtre par priorité ; filtre de
    suivi (lot V4b). Une CVE qui n'est plus rattachée reste listée si elle a un suivi (proposition « corrigée », état). */
export const RechercheDeclarees = z
  .object({
    q: z.string().trim().max(100).optional(),
    priorite: NiveauPriorite.optional(),
    etat: FiltreSuivi.optional(),
    /** Lot S1 : état du délai de correction, et tri par échéance. */
    delai: EtatDelaiFiltre.optional(),
    tri: TriFailles.optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();
export type RechercheDeclarees = z.infer<typeof RechercheDeclarees>;

export interface FailleDeclareeDto {
  rapprochementId: string;
  cve: string;
  /** Rattachée ou confirmée ; un autre statut quand le rapprochement n'est plus rattaché (lot V4b, proposition « corrigée »). */
  statut: StatutRapprochement;
  produit: { id: string; editeur: string; nom: string; versionProduit: string };
  gravite: GraviteTenable | null;
  cvssScore: number | null;
  epss: number | null;
  kev: boolean;
  alerteCertFr: boolean;
  /** Ce que chaque source dit de la CVE (V26, V27) : `gravite`, `cvssScore` et `epss` sont les valeurs retenues. */
  sources: SourcesFailleDto;
  /** Machines lisibles reliées au produit où Tenable ne détecte pas cette CVE. */
  machines: number;
  /** Le rapprochement est rattaché (d'office ou confirmé) : la faille vise toujours la version déclarée (lot V4b). */
  present: boolean;
  priorite: Priorite;
  suivi: SuiviResumeDto;
  /** Délai de correction (lot S1) : âge, échéance calculée, état. */
  delai: DelaiFailleDto;
}

/** Machine lisible reliée au produit d'une faille déclarée ; `detectee` : Tenable y détecte aussi la CVE. */
export interface MachineDeclareeDto {
  id: string;
  nom: string | null;
  adresse: string | null;
  role: RoleMachine | null;
  perimetreNom: string | null;
  detectee: boolean;
}

/** Fiche d'une faille déclarée (lot V4b) : description de NVD et action exigée du catalogue KEV (en anglais, telles quelles),
    machines lisibles reliées au produit. */
export interface FicheDeclareeDto extends FailleDeclareeDto {
  description: string | null;
  kevAction: string | null;
  kevEcheance: string | null;
  machinesReliees: MachineDeclareeDto[];
}
