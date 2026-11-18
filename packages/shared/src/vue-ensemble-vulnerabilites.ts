/* Module Vulnérabilités (ADR 0100, point 18 ; lot PC1) : « Vue d'ensemble », écran d'accueil du module, dans l'esprit d'un
   poste de commandement. Niveau d'alerte de 1 à 4 calculé par la plateforme, le même pour tout le monde (principe du lot
   ALH5), secteurs du radar, ordre des cibles et forme de la réponse de la route de lecture. Fonctions pures et
   déterministes : à faits égaux, même résultat. Aucun nom de machine, de domaine, d'adresse ni de périmètre ici ; les nombres
   de machines et d'actifs sont ceux que la personne lit (NombreLisible), jamais un total global. */
import type { NiveauAlerte, NombreLisible } from './alertes-vulnerabilites.js';
import { GRAVITES_TENABLE, type GraviteTenable, NIVEAUX_PRIORITE, type NiveauPriorite } from './failles-tenable.js';
import type { Presence, Priorite } from './priorite-vulnerabilites.js';
import type { EtatSuiviFaille } from './suivi-vulnerabilites.js';
import type { SourceVeille } from './veille-vulnerabilites.js';
import { FAMILLE_PRODUIT_LIBELLES, FAMILLES_PRODUIT, type FamilleProduit } from './vulnerabilites.js';

/* ------------------------------------------------------------------ Niveau d'alerte (1 à 4) */
export const NIVEAUX_ALERTE_GLOBAL = [1, 2, 3, 4] as const;
export type NiveauAlerteGlobal = (typeof NIVEAUX_ALERTE_GLOBAL)[number];
export const NIVEAU_ALERTE_GLOBAL_LIBELLES: Record<NiveauAlerteGlobal, string> = {
  1: 'Veille',
  2: 'Vigilance',
  3: 'Alerte',
  4: 'Maximale',
};

/** Faits du niveau d'alerte, comptés sur TOUS les faits connus de la plateforme (les mêmes pour tout le monde) :
    - `critiques` : failles au seuil d'une alerte critique (présentes en P1 : exploitation avérée et présence chez nous) ;
    - `simples` : failles au seuil d'une alerte simple (P2 exploitable sur un actif exposé directement sur Internet, V6b) ;
    - `p2Presentes` : failles présentes (détectées, déclarées ou exposées) en P2 ;
    - `exploiteesAConfirmer` : failles à exploitation avérée dont le produit reste à confirmer (rapprochement proposé). */
export interface FaitsNiveauAlerteGlobal {
  critiques: number;
  simples: number;
  p2Presentes: number;
  exploiteesAConfirmer: number;
}

export interface NiveauAlerteGlobalDto {
  niveau: NiveauAlerteGlobal;
  libelle: string;
  /** Phrase d'explication affichée sous le niveau : la règle remplie, avec ses nombres de failles. */
  explication: string;
  faits: FaitsNiveauAlerteGlobal;
}

/** Règle proposée au lot PC1, À CONFIRMER PAR LE RSSI :
    4 (Maximale) : au moins une faille au seuil d'alerte critique (présente en P1) ;
    3 (Alerte) : sinon, au moins une faille au seuil d'alerte simple (P2 exploitable exposée directement sur Internet) ;
    2 (Vigilance) : sinon, au moins une faille présente en P2, ou une faille exploitée dont le produit reste à confirmer ;
    1 (Veille) : sinon. */
export const REGLE_NIVEAU_ALERTE_GLOBAL =
  'Niveau 4 : au moins une faille présente en P1 (exploitation avérée). Niveau 3 : au moins une faille P2 exploitable sur un actif exposé directement sur Internet. Niveau 2 : au moins une faille présente en P2, ou une faille exploitée dont le produit reste à confirmer. Niveau 1 : aucune de ces situations. Règle proposée, à confirmer par le RSSI.';

const failles = (n: number) => `${n} faille${n > 1 ? 's' : ''}`;

export function niveauAlerteGlobal(f: FaitsNiveauAlerteGlobal): NiveauAlerteGlobalDto {
  const sortie = (niveau: NiveauAlerteGlobal, explication: string): NiveauAlerteGlobalDto => ({
    niveau,
    libelle: NIVEAU_ALERTE_GLOBAL_LIBELLES[niveau],
    explication,
    faits: { ...f },
  });
  if (f.critiques > 0)
    return sortie(
      4,
      `${failles(f.critiques)} exploitée${f.critiques > 1 ? 's' : ''} et présente${f.critiques > 1 ? 's' : ''} chez nous (P1) : seuil d’alerte critique.`,
    );
  if (f.simples > 0)
    return sortie(
      3,
      `${failles(f.simples)} en P2, exploitable${f.simples > 1 ? 's' : ''} et exposée${f.simples > 1 ? 's' : ''} directement sur Internet : seuil d’alerte simple.`,
    );
  if (f.p2Presentes > 0 || f.exploiteesAConfirmer > 0) {
    const morceaux: string[] = [];
    if (f.p2Presentes > 0) morceaux.push(`${failles(f.p2Presentes)} présente${f.p2Presentes > 1 ? 's' : ''} en P2`);
    if (f.exploiteesAConfirmer > 0)
      morceaux.push(
        `${failles(f.exploiteesAConfirmer)} exploitée${f.exploiteesAConfirmer > 1 ? 's' : ''} dont le produit reste à confirmer`,
      );
    return sortie(2, `${morceaux.join(' ; ')}.`);
  }
  return sortie(1, 'Aucune faille présente en P1 ni en P2, aucune faille exploitée dont le produit reste à confirmer.');
}

/* ------------------------------------------------------------------ Secteurs du radar */
/** Secteur d'une faille : la famille du produit surveillé rapproché (registre des produits, point 18), sinon « Non classé ».
    Aucune nomenclature nouvelle : la liste fermée des familles, plus le secteur des failles sans produit rapproché. */
export const SECTEURS_RADAR = [...FAMILLES_PRODUIT, 'non_classe'] as const;
export type SecteurRadar = (typeof SECTEURS_RADAR)[number];
export const SECTEUR_RADAR_LIBELLES: Record<SecteurRadar, string> = {
  ...FAMILLE_PRODUIT_LIBELLES,
  non_classe: 'Non classé',
};
/** Secteur retenu parmi les familles des produits rapprochés : la première dans l'ordre de la liste fermée (déterministe). */
export function secteurDe(familles: readonly FamilleProduit[]): SecteurRadar {
  for (const f of FAMILLES_PRODUIT) if (familles.includes(f)) return f;
  return 'non_classe';
}

/* ------------------------------------------------------------------ Cibles (failles suivies) */
/** Fiche existante qu'ouvre un point ou une ligne : un constat de Tenable, ou une faille déclarée (rapprochement), que la
    personne lit (au moins une machine lisible) ; sinon null (la faille se cherche dans la veille par sa CVE). */
export type FicheCibleDto = { nature: 'constat'; id: string } | { nature: 'declaree'; id: string } | null;

export interface CibleVueDto {
  /** CVE, ou « constat:<identifiant> » pour un constat de Tenable sans CVE (même clé que les alertes). */
  cle: string;
  cve: string | null;
  titre: string;
  produit: string | null;
  secteur: SecteurRadar;
  /** Priorité la plus haute des présences (P1 à P4), avec ses faits ; la même pour tout le monde. */
  priorite: Priorite;
  presences: Presence[];
  /** Exploitation avérée (une source suffit) ; « exploitable » (code d'exploitation connu, sans exploitation observée). */
  exploitee: boolean;
  exploitable: boolean;
  /** Seule présence : produit à confirmer (rapprochement proposé). Point vide sur le radar. */
  aConfirmer: boolean;
  gravite: GraviteTenable | null;
  epss: number | null;
  /** État de suivi le moins avancé des objets suivis encore ouverts (constats, failles déclarées) ; null sans objet suivi
      (faille seulement exposée ou à confirmer). */
  etat: EtatSuiviFaille | null;
  /** Machines touchées que la personne lit, actifs exposés qu'elle lit ; drapeau sans nombre pour les autres. */
  machines: NombreLisible;
  actifs: NombreLisible;
  /** Produit surveillé rapproché (pour son responsable, lu dans le registre), ou null. */
  produitId: string | null;
  fiche: FicheCibleDto;
}

const RANG_GRAVITE: Record<GraviteTenable, number> = { critique: 0, elevee: 1, moyenne: 2, faible: 3 };
/** Ordre des cibles, le même pour tout le monde (aucun nombre lié aux droits n'y entre) : priorité, exploitation avérée,
    présence (une faille présente avant une faille à confirmer), « exploitable », gravité, score EPSS décroissant, clé. */
export function comparerCibles(
  a: Pick<CibleVueDto, 'priorite' | 'exploitee' | 'aConfirmer' | 'exploitable' | 'gravite' | 'epss' | 'cle'>,
  b: Pick<CibleVueDto, 'priorite' | 'exploitee' | 'aConfirmer' | 'exploitable' | 'gravite' | 'epss' | 'cle'>,
): number {
  const g = (x: GraviteTenable | null) => (x ? RANG_GRAVITE[x] : GRAVITES_TENABLE.length);
  return (
    NIVEAUX_PRIORITE.indexOf(a.priorite.niveau) - NIVEAUX_PRIORITE.indexOf(b.priorite.niveau) ||
    Number(b.exploitee) - Number(a.exploitee) ||
    Number(a.aConfirmer) - Number(b.aConfirmer) ||
    Number(b.exploitable) - Number(a.exploitable) ||
    g(a.gravite) - g(b.gravite) ||
    (b.epss ?? -1) - (a.epss ?? -1) ||
    (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0)
  );
}

/* ------------------------------------------------------------------ Journal (traces existantes) */
export type EntreeJournalVueDto =
  | { nature: 'collecte'; le: string; source: SourceVeille; etat: 'recu' | 'echec' | 'expire'; elements: number }
  | {
      nature: 'synchronisation';
      le: string;
      connecteur: 'tenable' | 'algolighthouse';
      nom: string;
      etat: 'recu' | 'echec' | 'expire';
      elements: number | null;
      complete: boolean | null;
    }
  | { nature: 'alerte_ouverte'; le: string; cve: string | null; niveau: NiveauAlerte }
  | { nature: 'alerte_close'; le: string; cve: string | null; niveau: NiveauAlerte };

/* ------------------------------------------------------------------ Réponse de la route */
/** Bornes : cibles rendues par case du radar (secteur × priorité), les plus prioritaires d'abord ; entrées du journal. Le
    nombre total de chaque case est toujours donné : ce qui n'est pas rendu est compté. */
export const VUE_ENSEMBLE_BORNES = { ciblesParCase: 40, journal: 12 } as const;

export interface CaseRadarDto {
  secteur: SecteurRadar;
  priorite: NiveauPriorite;
  total: number;
}

export interface VueEnsembleDto {
  niveau: NiveauAlerteGlobalDto;
  tuiles: {
    /** Failles exploitées et présentes chez nous (P1). */
    exploiteesPresentes: number;
    /** Failles à traiter : présentes ou à confirmer, en P1 et en P2. */
    aTraiter: { p1: number; p2: number };
    /** Failles dont le produit reste à confirmer (rapprochement proposé), et produits surveillés concernés. */
    aConfirmer: { failles: number; produits: number };
    /** Objets suivis (constats, failles déclarées) passés à « Corrigée » depuis le premier jour du mois (Europe/Paris). */
    corrigeesCeMois: number;
  };
  /** Nombre total de failles suivies, par priorité, et par case du radar (cases vides omises). */
  total: number;
  parPriorite: Record<NiveauPriorite, number>;
  cases: CaseRadarDto[];
  /** Cibles rendues (bornées par case), dans l'ordre de comparerCibles. */
  cibles: CibleVueDto[];
  /** Au moins une case compte plus de failles que de cibles rendues. */
  tronquee: boolean;
  journal: EntreeJournalVueDto[];
  calculeLe: string;
}
