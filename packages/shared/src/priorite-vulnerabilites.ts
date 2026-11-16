/* Module Vulnérabilités (ADR 0100, points 9 et 16 ; lot V4a) : priorité d'une faille et rang d'une machine, calculés par
   la plateforme, jamais par le modèle. Fonctions pures et déterministes : à faits égaux, même résultat (rejouable). Chaque
   résultat rend les faits qui le fondent, sous forme structurée ; aucun taux n'est calculé ni inventé. */
import { z } from 'zod';
import {
  GRAVITE_TENABLE_LIBELLES,
  type GraviteTenable,
  NiveauPriorite,
  ROLE_MACHINE_LIBELLES,
  type RoleMachine,
} from './failles-tenable.js';

/* ------------------------------------------------------------------ Réglage (vulnerabilites:administrer) */
/** Seuil du score EPSS (probabilité entre 0 et 1) à partir duquel une faille présente passe en P2. Seul seuil réglable de la
    grille de départ ; les gravités de la grille sont fixes. */
export const ReglagePriorite = z
  .object({ seuilEpss: z.number().min(0.01, 'Seuil EPSS entre 0,01 et 1.').max(1, 'Seuil EPSS entre 0,01 et 1.') })
  .strict();
export type ReglagePriorite = z.infer<typeof ReglagePriorite>;
export const REGLAGE_PRIORITE_DEFAUT: ReglagePriorite = { seuilEpss: 0.5 };

export interface ReglagePrioriteOut {
  values: ReglagePriorite;
  version: number;
}

/* ------------------------------------------------------------------ Priorité d'une faille */
/** Présence dans l'organisation : détectée par Tenable, déclarée (produit surveillé, rapprochement rattaché), produit à
    confirmer (rapprochement proposé), ou absente. */
export const PRESENCES = ['detectee', 'declaree', 'a_confirmer', 'absente'] as const;
export type Presence = (typeof PRESENCES)[number];
export const PRESENCE_LIBELLES: Record<Presence, string> = {
  detectee: 'Détectée par Tenable',
  declaree: 'Déclarée (produit surveillé)',
  a_confirmer: 'Produit à confirmer',
  absente: 'Absente',
};

/** Sources d'une exploitation avérée : catalogue KEV de la CISA, alerte du CERT-FR qui cite la CVE. */
export const SOURCES_EXPLOITATION = ['kev', 'cert-fr'] as const;
export type SourceExploitation = (typeof SOURCES_EXPLOITATION)[number];
export const SOURCE_EXPLOITATION_LIBELLES: Record<SourceExploitation, string> = {
  kev: 'catalogue KEV',
  'cert-fr': 'alerte du CERT-FR',
};

/** Faits d'une faille, rassemblés par l'API. */
export interface FaitsFaille {
  exploitation: readonly SourceExploitation[];
  presence: Presence;
  gravite: GraviteTenable | null;
  /** Score EPSS (probabilité entre 0 et 1), ou null s'il n'est pas connu. */
  epss: number | null;
  /** Un code d'exploitation est disponible (Tenable). */
  exploitDisponible: boolean;
}

export type FaitPriorite =
  | { fait: 'exploitation'; sources: SourceExploitation[] }
  | { fait: 'presence'; presence: Presence }
  | { fait: 'gravite'; gravite: GraviteTenable | null }
  | { fait: 'epss'; score: number; seuil: number }
  | { fait: 'exploit_disponible' };

export interface Priorite {
  niveau: NiveauPriorite;
  faits: FaitPriorite[];
}

/** Grille de départ (ADR 0100, point 9) :
    - P1 : exploitation avérée et présente (détectée ou déclarée) ;
    - P2 : exploitation avérée et produit à confirmer ; ou présente et critique ; ou présente et score EPSS au moins égal
      au seuil ; ou présente, élevée et exploit disponible ;
    - P3 : présente et élevée ;
    - P4 : le reste.
    Les faits rendus sont ceux des règles remplies au niveau retenu (dans l'ordre de la grille, sans doublon) ; au niveau
    P4, la présence, la gravité et, le cas échéant, l'exploitation. */
export function calculerPriorite(f: FaitsFaille, reglage: ReglagePriorite = REGLAGE_PRIORITE_DEFAUT): Priorite {
  const sources = SOURCES_EXPLOITATION.filter((s) => f.exploitation.includes(s));
  const exploitee = sources.length > 0;
  const presente = f.presence === 'detectee' || f.presence === 'declaree';
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
  if (presente && f.gravite === 'elevee' && f.exploitDisponible)
    ajouter(presence, gravite, { fait: 'exploit_disponible' });
  if (p2.length) return { niveau: 'P2', faits: p2 };
  if (presente && f.gravite === 'elevee') return { niveau: 'P3', faits: [presence, gravite] };
  return { niveau: 'P4', faits: exploitee ? [exploitation, presence, gravite] : [presence, gravite] };
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
      return 'Code d’exploitation disponible (Tenable)';
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
    Tenable détecte déjà la CVE. Recherche par identifiant CVE, éditeur ou nom du produit ; filtre par priorité. */
export const RechercheDeclarees = z
  .object({
    q: z.string().trim().max(100).optional(),
    priorite: NiveauPriorite.optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();
export type RechercheDeclarees = z.infer<typeof RechercheDeclarees>;

export interface FailleDeclareeDto {
  rapprochementId: string;
  cve: string;
  statut: 'rattachee' | 'confirmee';
  produit: { id: string; editeur: string; nom: string; versionProduit: string };
  gravite: GraviteTenable | null;
  cvssScore: number | null;
  epss: number | null;
  kev: boolean;
  alerteCertFr: boolean;
  /** Machines lisibles reliées au produit où Tenable ne détecte pas cette CVE. */
  machines: number;
  priorite: Priorite;
}
