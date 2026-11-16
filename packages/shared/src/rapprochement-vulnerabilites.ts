/* Module Vulnérabilités (ADR 0100, point 8 ; décisions V20 et V21 ; lot V4a) : rapprochement entre un produit surveillé et
   les CVE de la veille, par la version déclarée. Fonctions pures, sans appel réseau ni accès aux données, rejouables à
   l'identique : l'API les applique après chaque collecte NVD et à chaque modification d'un produit.

   Comparaison de versions sûre : une version comparable est faite de segments numériques séparés par des points
   (« 10.0.17 »), avec au plus un préfixe « v » ou « V » toléré (« v2.4 » vaut « 2.4 »), dix segments au plus, neuf chiffres
   au plus par segment. Les segments manquants valent zéro (« 1.2 » = « 1.2.0 »), les zéros de tête sont ignorés
   (« 1.02 » = « 1.2 »). Toute autre forme (lettres, suffixe « -rc1 », « 2024-05-01 », « * », « - », espace) n'est pas
   comparée : le résultat est « incertain », jamais un résultat faux. */
import { z } from 'zod';
import type { GraviteTenable } from './failles-tenable.js';
import type { Priorite, SourcesFailleDto } from './priorite-vulnerabilites.js';
import type { ProduitSurveilleDto } from './vulnerabilites.js';
import { NOM_CPE, type PartieCpe, PARTIES_CPE } from './veille-vulnerabilites.js';

/* ------------------------------------------------------------------ Versions */
/** Forme comparable : préfixe « v » facultatif, segments numériques séparés par des points. */
export const VERSION_COMPARABLE = /^[vV]?\d{1,9}(?:\.\d{1,9}){0,9}$/;

/** Segments numériques d'une version comparable, ou null. */
export function segmentsVersion(v: string): number[] | null {
  if (!VERSION_COMPARABLE.test(v)) return null;
  return v.replace(/^[vV]/, '').split('.').map(Number);
}

/** -1, 0 ou 1 ; null si l'une des deux versions n'a pas une forme comparable. */
export function comparerVersions(a: string, b: string): -1 | 0 | 1 | null {
  const x = segmentsVersion(a);
  const y = segmentsVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Plage de versions touchées publiée par la source (une entrée de configuration NVD). */
export interface PlageVersions {
  /** Version exacte du CPE, ou null (« * » ou « - » : aucune version précise). */
  version: string | null;
  debutInclus: string | null;
  debutExclus: string | null;
  finInclus: string | null;
  finExclus: string | null;
}

/** Pourquoi une position est incertaine : aucune plage publiée, ou versions qui ne se comparent pas sûrement. */
export type MotifIncertain = 'sans_plage' | 'non_comparable';
export type PositionVersion = { resultat: 'dans' | 'hors' } | { resultat: 'incertain'; motif: MotifIncertain };

/** Position de la version déclarée dans une plage. Version exacte : égalité. Bornes : chacune doit se comparer. Ni version
    exacte ni borne (« * » sans borne) : aucune plage. Version exacte et bornes ensemble (forme inattendue) : incertain. */
export function positionDansPlage(versionDeclaree: string, plage: PlageVersions): PositionVersion {
  const bornes = [plage.debutInclus, plage.debutExclus, plage.finInclus, plage.finExclus];
  const avecBorne = bornes.some((b) => b !== null);
  if (plage.version !== null) {
    if (avecBorne) return { resultat: 'incertain', motif: 'non_comparable' };
    const c = comparerVersions(versionDeclaree, plage.version);
    if (c === null) return { resultat: 'incertain', motif: 'non_comparable' };
    return { resultat: c === 0 ? 'dans' : 'hors' };
  }
  if (!avecBorne) return { resultat: 'incertain', motif: 'sans_plage' };
  const tests: [string | null, (c: number) => boolean][] = [
    [plage.debutInclus, (c) => c >= 0],
    [plage.debutExclus, (c) => c > 0],
    [plage.finInclus, (c) => c <= 0],
    [plage.finExclus, (c) => c < 0],
  ];
  let dans = true;
  for (const [borne, ok] of tests) {
    if (borne === null) continue;
    const c = comparerVersions(versionDeclaree, borne);
    if (c === null) return { resultat: 'incertain', motif: 'non_comparable' };
    if (!ok(c)) dans = false;
  }
  return { resultat: dans ? 'dans' : 'hors' };
}

/** Position sur toutes les plages publiées pour le produit : dans l'une d'elles suffit ; sinon une seule incertaine rend
    l'ensemble incertain ; « hors » seulement si toutes se comparent et l'excluent. Aucune plage : incertain. */
export function positionSurPlages(versionDeclaree: string, plages: readonly PlageVersions[]): PositionVersion {
  if (!plages.length) return { resultat: 'incertain', motif: 'sans_plage' };
  const positions = plages.map((p) => positionDansPlage(versionDeclaree, p));
  if (positions.some((p) => p.resultat === 'dans')) return { resultat: 'dans' };
  const incertaines = positions.filter((p) => p.resultat === 'incertain');
  if (incertaines.some((p) => p.motif === 'non_comparable')) return { resultat: 'incertain', motif: 'non_comparable' };
  if (incertaines.length) return { resultat: 'incertain', motif: 'sans_plage' };
  return { resultat: 'hors' };
}

/* ------------------------------------------------------------------ Noms et identifiant CPE */
/** Nom normalisé pour le rapprochement par nom : minuscules, accents retirés, toute suite d'autres caractères que lettres
    et chiffres remplacée par « _ » (comme les noms des CPE : « HTTP Server » → « http_server »), « _ » de bord retirés. */
export function normaliserNom(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Composantes d'un CPE 2.3 formaté, échappements retirés (même lecture que le script de veille). */
export function composantesCpe(cpe: string): string[] {
  const parts: string[] = [];
  let courant = '';
  let echappe = false;
  for (const c of cpe.slice(0, 500)) {
    if (echappe) {
      courant += c;
      echappe = false;
    } else if (c === '\\') echappe = true;
    else if (c === ':') {
      parts.push(courant);
      courant = '';
    } else courant += c;
  }
  parts.push(courant);
  return parts;
}

/** Identité d'un produit pour le rapprochement : partie, éditeur et produit de son identifiant CPE (en minuscules). La
    version du CPE n'est jamais lue : c'est la version déclarée qui sert (V21). */
export interface IdentiteCpe {
  partie: PartieCpe;
  editeur: string;
  produit: string;
}

export function identiteCpe(cpe: string | null): IdentiteCpe | null {
  if (!cpe) return null;
  const p = composantesCpe(cpe);
  if (p.length < 5 || p[0] !== 'cpe' || p[1] !== '2.3') return null;
  const [partie, editeur, produit] = [p[2]!, p[3]!.toLowerCase(), p[4]!.toLowerCase()];
  if (!(PARTIES_CPE as readonly string[]).includes(partie)) return null;
  if (['*', '-', ''].includes(editeur) || ['*', '-', ''].includes(produit)) return null;
  if (!NOM_CPE.test(editeur) || !NOM_CPE.test(produit)) return null;
  return { partie: partie as PartieCpe, editeur, produit };
}

/** Identifiant CPE 2.3 composé à partir d'un couple choisi par la personne : version et autres composantes en « * ». Tout
    caractère autre que lettre, chiffre, « _ », « - » et « . » est échappé. */
export function cpeDepuisIdentite(i: IdentiteCpe): string {
  const echapper = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, (c) => `\\${c}`);
  return `cpe:2.3:${i.partie}:${echapper(i.editeur)}:${echapper(i.produit)}:*:*:*:*:*:*:*:*`;
}

/* ------------------------------------------------------------------ Classement d'un rapprochement */
export const MOTIFS_PROPOSITION = [
  'nom_seulement',
  'sans_plage',
  'non_comparable',
  'donnees_tronquees',
  'avis_seulement',
] as const;
export type MotifProposition = (typeof MOTIFS_PROPOSITION)[number];
export const MOTIF_PROPOSITION_LIBELLES: Record<MotifProposition, string> = {
  nom_seulement: 'Nom seulement',
  sans_plage: 'Aucune plage publiée',
  non_comparable: 'Version non comparable',
  donnees_tronquees: 'Liste des produits touchés incomplète',
  avis_seulement: 'Publiée par le CERT Santé, pas encore par NVD',
};

/** La version déclarée semble-t-elle dans la plage (indication donnée avec une proposition) ? */
export type VersionDansPlage = 'oui' | 'non' | 'inconnu';
export const VERSION_DANS_PLAGE_LIBELLES: Record<VersionDansPlage, string> = {
  oui: 'La version déclarée semble dans la plage',
  non: 'La version déclarée semble hors de la plage',
  inconnu: 'Position de la version inconnue',
};

export type ResultatRapprochement =
  | { calcul: 'office' }
  | { calcul: 'ecartee' }
  | { calcul: 'proposee'; motif: MotifProposition; versionDansPlage: VersionDansPlage };

/** Règle du point 8 (V21), déterministe :
    - par identifiant CPE (correspondance exacte de l'éditeur et du produit) : rattachée d'office si la version déclarée
      est dans une plage publiée (comparaison sûre), écartée si elle est hors de toutes ; proposée sinon (aucune plage,
      version non comparable) ;
    - par nom seulement (produit sans identifiant CPE) : toujours proposée, avec l'indication de la position de la version ;
    - liste des produits touchés tronquée par la veille : jamais écartée (le produit a pu être retiré de la liste), proposée ;
    - CVE connue seulement par un avis (V26 : publiée par le CERT Santé, NVD n'en donne pas encore les produits touchés),
      rapprochée par le nom du produit cité : toujours proposée, sans position de version. */
export function classerRapprochement(a: {
  versionDeclaree: string;
  parIdentifiant: boolean;
  plages: readonly PlageVersions[];
  tronque: boolean;
  /** Candidat venu d'un avis (nom du produit cité par la source), et non des configurations de NVD. */
  parAvis?: boolean;
}): ResultatRapprochement {
  if (a.parAvis) return { calcul: 'proposee', motif: 'avis_seulement', versionDansPlage: 'inconnu' };
  const pos = positionSurPlages(a.versionDeclaree, a.plages);
  const indication: VersionDansPlage = pos.resultat === 'dans' ? 'oui' : pos.resultat === 'hors' ? 'non' : 'inconnu';
  if (!a.parIdentifiant) return { calcul: 'proposee', motif: 'nom_seulement', versionDansPlage: indication };
  if (pos.resultat === 'incertain') return { calcul: 'proposee', motif: pos.motif, versionDansPlage: 'inconnu' };
  if (pos.resultat === 'dans') return { calcul: 'office' };
  return a.tronque
    ? { calcul: 'proposee', motif: 'donnees_tronquees', versionDansPlage: 'non' }
    : { calcul: 'ecartee' };
}

/* ------------------------------------------------------------------ Statuts et transitions */
/** Statuts (modèle « proposition puis décision ») : rattachée d'office, écartée, proposée (à décider), confirmée ou rejetée
    par une personne, retirée (la correspondance n'existe plus). */
export const STATUTS_RAPPROCHEMENT = ['rattachee', 'ecartee', 'proposee', 'confirmee', 'rejetee', 'retiree'] as const;
export type StatutRapprochement = (typeof STATUTS_RAPPROCHEMENT)[number];
export const STATUT_RAPPROCHEMENT_LIBELLES: Record<StatutRapprochement, string> = {
  rattachee: 'Rattachée d’office',
  ecartee: 'Écartée',
  proposee: 'À décider',
  confirmee: 'Confirmée',
  rejetee: 'Rejetée',
  retiree: 'Retirée',
};
/** Statuts qui rattachent la CVE au produit (et à ses machines reliées, mention « déclaré »). */
export const STATUTS_RATTACHES: readonly StatutRapprochement[] = ['rattachee', 'confirmee'];

const statutCalcule = (r: ResultatRapprochement | null): StatutRapprochement =>
  r === null ? 'retiree' : r.calcul === 'office' ? 'rattachee' : r.calcul === 'ecartee' ? 'ecartee' : 'proposee';

export interface EtatRapprochement {
  statut: StatutRapprochement;
  empreinteProduit: string;
  empreinteCve: string;
  /** Version déclarée du produit au moment de la décision (confirmée, rejetée), sinon null. */
  versionDecidee: string | null;
}

/** Statut suivant d'un rapprochement, au recalcul :
    - aucune ligne : créée au statut calculé (rien si la CVE ne correspond pas) ;
    - confirmée : reste tant que la version déclarée du produit n'a pas changé ; sinon, statut calculé (à décider de
      nouveau si la règle d'office ne tranche pas) ;
    - rejetée : reste tant que ni le produit (version, identifiant, noms) ni les données de la CVE n'ont changé (mêmes
      empreintes) ; sinon, statut calculé ;
    - autre : statut calculé (« retirée » si la CVE ne correspond plus).
    `garderDecision` : l'auteur, la date et la note de la décision sont gardés. Null : rien à créer. */
export function transitionRapprochement(
  courant: EtatRapprochement | null,
  calcul: ResultatRapprochement | null,
  actuel: { empreinteProduit: string; empreinteCve: string; versionProduit: string },
): { statut: StatutRapprochement; garderDecision: boolean } | null {
  if (!courant) return calcul ? { statut: statutCalcule(calcul), garderDecision: false } : null;
  if (courant.statut === 'confirmee' && courant.versionDecidee === actuel.versionProduit)
    return { statut: 'confirmee', garderDecision: true };
  if (
    courant.statut === 'rejetee' &&
    courant.empreinteProduit === actuel.empreinteProduit &&
    courant.empreinteCve === actuel.empreinteCve
  )
    return { statut: 'rejetee', garderDecision: true };
  return { statut: statutCalcule(calcul), garderDecision: false };
}

/* ------------------------------------------------------------------ API */
/** Décision d'une personne sur une proposition (`vulnerabilites:modifier`, If-Match : version du rapprochement). */
export const DecisionRapprochement = z
  .object({
    decision: z.enum(['confirmer', 'rejeter']),
    note: z
      .string()
      .trim()
      .max(1000)
      .refine((s) => !/\p{Cc}/u.test(s), 'Caractère de contrôle refusé.')
      .default(''),
  })
  .strict();
export type DecisionRapprochement = z.infer<typeof DecisionRapprochement>;

/** Annulation d'une confirmation ou d'un rejet (V24 ; `vulnerabilites:modifier`, If-Match : version du rapprochement), note
    facultative. Le rapprochement redevient à décider, ou reprend le statut que la règle d'office lui donne. */
export const AnnulationRapprochement = z
  .object({
    note: z
      .string()
      .trim()
      .max(1000)
      .refine((s) => !/\p{Cc}/u.test(s), 'Caractère de contrôle refusé.')
      .default(''),
  })
  .strict();
export type AnnulationRapprochement = z.infer<typeof AnnulationRapprochement>;

/** Dernière annulation d'une décision sur un rapprochement : décision annulée, auteur, date, note. */
export interface AnnulationRapprochementDto {
  decision: 'confirmee' | 'rejetee';
  par: string;
  le: string;
  note: string;
}

/** Recherche des couples éditeur et produit connus de la veille qui ressemblent au nom saisi (aucun appel réseau). */
export const SuggestionsCpeQuery = z
  .object({ nom: z.string().trim().min(2).max(200), editeur: z.string().trim().max(200).optional() })
  .strict();
export type SuggestionsCpeQuery = z.infer<typeof SuggestionsCpeQuery>;
export const SUGGESTIONS_CPE_MAX = 10;

export interface SuggestionCpeDto extends IdentiteCpe {
  /** Identifiant CPE 2.3 composé (version en « * ») à reporter dans la fiche. */
  cpe: string;
  /** Nombre de CVE de la veille qui citent ce couple. */
  cves: number;
}

/** Plage affichée sur la fiche d'un rapprochement. */
export interface PlageAfficheeDto extends PlageVersions {
  editeur: string;
  produit: string;
}

export interface RapprochementDto {
  id: string;
  cve: string;
  statut: StatutRapprochement;
  motif: MotifProposition | null;
  versionDansPlage: VersionDansPlage | null;
  parIdentifiant: boolean;
  /** Plages des produits touchés qui ont fondé le rapprochement (vulnérables seulement). */
  plages: PlageAfficheeDto[];
  /** La veille n'a pas pu garder tous les produits touchés de la CVE. */
  tronque: boolean;
  description: string | null;
  gravite: GraviteTenable | null;
  cvssScore: number | null;
  epss: number | null;
  kev: boolean;
  alerteCertFr: boolean;
  /** Ce que chaque source dit de la CVE (V26, V27) ; `gravite`, `cvssScore` et `epss` sont les valeurs retenues. */
  sources: SourcesFailleDto;
  /** Dernière décision annulée (V24), ou null. */
  annulation: AnnulationRapprochementDto | null;
  decidePar: string | null;
  decideLe: string | null;
  note: string;
  /** Version déclarée du produit lors de la décision. */
  versionDecidee: string | null;
  calculeLe: string;
  version: number;
  /** Priorité calculée : présence « déclarée » si rattachée, « produit à confirmer » si proposée, absente sinon. */
  priorite: Priorite;
}

/** Plus de rapprochements que cette borne pour un même statut : les premiers seulement sont rendus. */
export const RAPPROCHEMENTS_PAR_STATUT_MAX = 300;

export interface MachineRelieeDto {
  id: string;
  nom: string | null;
  adresse: string | null;
  role: 'front' | 'back' | 'bdd' | null;
  perimetreNom: string | null;
  relieLe: string;
}

/** Produit relié à une machine (lu depuis la machine). */
export interface ProduitRelieDto {
  id: string;
  editeur: string;
  nom: string;
  versionProduit: string;
  version: number;
  /** CVE rattachées (d'office ou confirmées) au produit. */
  cvesRattachees: number;
}

/** Fiche d'un produit surveillé : identité CPE lue, machines reliées lisibles, rapprochements (sauf retirés), comptés par
    statut ; les rapprochements de chaque statut sont bornés. */
export interface FicheProduitDto {
  produit: ProduitSurveilleDto;
  identite: IdentiteCpe | null;
  machines: MachineRelieeDto[];
  compteurs: Record<Exclude<StatutRapprochement, 'retiree'>, number>;
  rapprochements: RapprochementDto[];
}
