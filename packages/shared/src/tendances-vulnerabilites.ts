/* Module Vulnérabilités (ADR 0100, lot S2 ; décision du RSSI du 18/11/2026) : tendances et rapport de pilotage.
   Fonctions pures et déterministes, testées à part : à faits égaux, même résultat. Aucun nom de machine, de domaine,
   d'adresse ni de compte ici : des nombres, des CVE, des produits et des identifiants de périmètre.
   - Instantané quotidien (pris au tic de l'API, au plus une fois par jour, fuseau de l'organisation) : niveau d'alerte de la
     plateforme et nombres de failles, pour toute la plateforme et par périmètre (périmètre effectif des machines, périmètre
     AlgoLightHouse relié des actifs ; « sans périmètre » à part). L'historique commence à l'installation du lot : aucun passé
     n'est reconstruit.
   - Tendances : jour par jour sur une période courte (30 jours), semaine après semaine au-delà ; indicateur « s'améliore /
     se dégrade / stable » par une règle simple et écrite, À CONFIRMER PAR LE RSSI.
   - Rapport de pilotage (mois ou période libre) : sections et tableaux composés ici, rendus tels quels à l'écran (page
     imprimable) et dans l'export CSV. */
import { z } from 'zod';
import type { MesuresDelaisDto, DelaisCorrection, ExceptionDto, StatutException } from './delais-vulnerabilites.js';
import {
  libelleDelai,
  libelleDuree,
  libelleTaux,
  STATUT_EXCEPTION_LIBELLES,
  STATUTS_EXCEPTION,
} from './delais-vulnerabilites.js';
import { MOTIF_CLOTURE_ALERTE_LIBELLES, type MotifClotureAlerte } from './alertes-vulnerabilites.js';
import type { NiveauPriorite } from './failles-tenable.js';
import { IdPerimetreVue } from './perimetres-vulnerabilites.js';
import { PRESENCE_LIBELLES, type Presence } from './priorite-vulnerabilites.js';
import {
  NIVEAU_ALERTE_GLOBAL_LIBELLES,
  NIVEAUX_ALERTE_GLOBAL,
  type NiveauAlerteGlobal,
  type NiveauAlerteGlobalDto,
} from './vue-ensemble-vulnerabilites.js';

/* ------------------------------------------------------------------ Instantané */
/** Rétention des instantanés (purgés au tic qui suit), À CONFIRMER PAR LE RSSI. */
export const RETENTION_INSTANTANES_ANS = 3;

/** Nombres d'un instantané. Failles : une CVE (ou un constat de Tenable sans CVE), comptée une fois, avec sa priorité commune
    (lot ALH5). Objets suivis : constats de Tenable présents et failles déclarées rattachées (lot S1). */
export const MESURES_INSTANTANE = [
  'p1',
  'p2',
  'p3',
  'p4',
  'exploitees',
  'depassements',
  'exceptions',
  'corrigeesVeille',
  'machines',
  'actifs',
] as const;
export type CleMesure = (typeof MESURES_INSTANTANE)[number];
export type MesuresInstantane = Record<CleMesure, number>;
/** Nombres rendus : `machines` et `actifs` valent null pour toute la plateforme (jamais de total global de machines ni
    d'actifs, comme la vue d'ensemble) ; ils ne se lisent que par périmètre lu. */
export type MesuresAffichees = Record<CleMesure, number | null>;
export const MESURES_VIDES: MesuresInstantane = Object.fromEntries(
  MESURES_INSTANTANE.map((c) => [c, 0]),
) as MesuresInstantane;

export const MESURE_LIBELLES: Record<CleMesure, string> = {
  p1: 'Failles présentes en P1',
  p2: 'Failles présentes en P2',
  p3: 'Failles présentes en P3',
  p4: 'Failles présentes en P4',
  exploitees: 'Failles exploitées et présentes',
  depassements: 'Failles en dépassement de délai',
  exceptions: 'Failles sous exception',
  corrigeesVeille: 'Failles corrigées',
  machines: 'Machines touchées',
  actifs: 'Actifs exposés touchés',
};
/** Définition de chaque nombre, écrite sous les tableaux et dans l'aide. */
export const MESURE_DEFINITIONS: Record<CleMesure, string> = {
  p1: 'failles présentes (détectées, déclarées ou exposées, non traitées) dont la priorité est P1',
  p2: 'failles présentes dont la priorité est P2',
  p3: 'failles présentes dont la priorité est P3',
  p4: 'failles présentes dont la priorité est P4',
  exploitees: 'failles présentes dont l’exploitation est avérée par une source',
  depassements:
    'objets suivis présents (constats de Tenable, failles déclarées) dont le délai de correction est dépassé',
  exceptions: 'objets suivis présents sous exception (risque accepté)',
  corrigeesVeille: 'objets suivis passés à « Corrigée » au cours du jour civil (Europe/Paris)',
  machines: 'machines qui portent au moins une faille présente',
  actifs: 'actifs exposés sur Internet qui portent au moins une faille présente',
};

/** Clé de périmètre d'un instantané : l'identifiant du périmètre, ou « aucun » (machine sans périmètre effectif, actif d'un
    périmètre AlgoLightHouse non relié). */
export const PERIMETRE_INSTANTANE_AUCUN = 'aucun';

export interface FailleInstantane {
  priorite: NiveauPriorite;
  exploitee: boolean;
  /** Machines (identifiants internes) et actifs exposés (identifiants internes) qui portent la faille. */
  machines: readonly string[];
  actifs: readonly string[];
}
export interface ObjetInstantane {
  depassement: boolean;
  exception: boolean;
  machines: readonly string[];
}
export interface EntreeInstantane {
  /** Failles présentes seulement (au moins une présence non traitée). */
  failles: readonly FailleInstantane[];
  objets: readonly ObjetInstantane[];
  /** Objets passés à « Corrigée » au cours du jour civil précédent, avec leurs machines. */
  corrections: readonly { machines: readonly string[] }[];
  /** Périmètre de chaque machine et de chaque actif (null : sans périmètre). */
  perimetreMachine: ReadonlyMap<string, string | null>;
  perimetreActif: ReadonlyMap<string, string | null>;
}
export interface Instantane {
  global: MesuresInstantane;
  /** Par périmètre (identifiant, ou « aucun ») ; un périmètre sans aucun nombre est absent. */
  perimetres: Map<string, MesuresInstantane>;
}

const PRIORITE_CLE: Record<NiveauPriorite, CleMesure> = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4' };

/** Nombres d'un instantané, pour toute la plateforme et par périmètre. Une faille compte une fois dans chaque périmètre où
    elle a au moins une machine ou un actif ; une faille déclarée sans machine reliée ne compte que pour toute la plateforme. */
export function composerInstantane(e: EntreeInstantane): Instantane {
  const global = { ...MESURES_VIDES };
  const perimetres = new Map<string, MesuresInstantane>();
  const machinesPar = new Map<string, Set<string>>();
  const actifsPar = new Map<string, Set<string>>();
  const cleMachine = (m: string) => e.perimetreMachine.get(m) ?? PERIMETRE_INSTANTANE_AUCUN;
  const cleActif = (a: string) => e.perimetreActif.get(a) ?? PERIMETRE_INSTANTANE_AUCUN;
  const de = (cle: string) => {
    let m = perimetres.get(cle);
    if (!m) perimetres.set(cle, (m = { ...MESURES_VIDES }));
    return m;
  };
  const ajouter = (ensemble: Map<string, Set<string>>, cle: string, id: string) => {
    let s = ensemble.get(cle);
    if (!s) ensemble.set(cle, (s = new Set()));
    s.add(id);
  };
  const toutesMachines = new Set<string>();
  const tousActifs = new Set<string>();
  for (const f of e.failles) {
    global[PRIORITE_CLE[f.priorite]]++;
    if (f.exploitee) global.exploitees++;
    const cles = new Set<string>();
    for (const m of f.machines) {
      toutesMachines.add(m);
      cles.add(cleMachine(m));
      ajouter(machinesPar, cleMachine(m), m);
    }
    for (const a of f.actifs) {
      tousActifs.add(a);
      cles.add(cleActif(a));
      ajouter(actifsPar, cleActif(a), a);
    }
    for (const c of cles) {
      const m = de(c);
      m[PRIORITE_CLE[f.priorite]]++;
      if (f.exploitee) m.exploitees++;
    }
  }
  global.machines = toutesMachines.size;
  global.actifs = tousActifs.size;
  for (const [c, s] of machinesPar) de(c).machines = s.size;
  for (const [c, s] of actifsPar) de(c).actifs = s.size;
  const parObjet = (machines: readonly string[]) => new Set(machines.map(cleMachine));
  for (const o of e.objets) {
    if (o.depassement) global.depassements++;
    if (o.exception) global.exceptions++;
    if (!o.depassement && !o.exception) continue;
    for (const c of parObjet(o.machines)) {
      const m = de(c);
      if (o.depassement) m.depassements++;
      if (o.exception) m.exceptions++;
    }
  }
  global.corrigeesVeille = e.corrections.length;
  for (const x of e.corrections) for (const c of parObjet(x.machines)) de(c).corrigeesVeille++;
  return { global, perimetres };
}

/* ------------------------------------------------------------------ Jours civils (AAAA-MM-JJ) */
const JOUR_MS = 86_400_000;
const enMs = (j: string) => Date.parse(`${j}T00:00:00Z`);
const versJour = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Jour décalé de `n` jours (calendrier civil, sans fuseau). */
export const decalerJour = (j: string, n: number) => versJour(enMs(j) + n * JOUR_MS);
/** Lundi de la semaine du jour (semaine ISO). */
export function lundiDe(j: string): string {
  const jourSemaine = (new Date(enMs(j)).getUTCDay() + 6) % 7;
  return decalerJour(j, -jourSemaine);
}
/** Jour valide au format AAAA-MM-JJ. */
export const JourCivil = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ.')
  .refine((j) => Number.isFinite(enMs(j)) && versJour(enMs(j)) === j, 'Date invalide.');
export const fmtJour = (j: string | null) => (j ? j.split('-').reverse().join('/') : '');

/* ------------------------------------------------------------------ Tendances */
/** Périodes proposées, en jours : 30 jours (jour par jour), puis 13, 26 et 52 semaines (semaine après semaine). */
export const PERIODES_TENDANCES = [30, 91, 182, 364] as const;
export type PeriodeTendances = (typeof PERIODES_TENDANCES)[number];
export const PERIODE_TENDANCES_LIBELLES: Record<PeriodeTendances, string> = {
  30: '30 jours, jour par jour',
  91: '13 semaines',
  182: '26 semaines',
  364: '52 semaines',
};
export type Granularite = 'jour' | 'semaine';
export const granularite = (periode: number): Granularite => (periode <= 30 ? 'jour' : 'semaine');

export const RechercheTendances = z
  .object({
    periode: z.coerce
      .number()
      .int()
      .refine((p) => (PERIODES_TENDANCES as readonly number[]).includes(p), 'Période de 30, 91, 182 ou 364 jours.')
      .default(30),
    perimetre: IdPerimetreVue.optional(),
  })
  .strict();
export type RechercheTendances = z.infer<typeof RechercheTendances>;

/** Un instantané lu : son jour, le niveau d'alerte de la plateforme et les nombres de la portée demandée. */
export interface InstantaneLu {
  jour: string;
  niveau: NiveauAlerteGlobal;
  mesures: MesuresAffichees;
}

export interface PointJourDto {
  jour: string;
  /** Null : aucun instantané ce jour-là (avant l'installation, panne, ou jour à venir). */
  niveau: NiveauAlerteGlobal | null;
  mesures: MesuresAffichees | null;
  /** Corrections du jour : lues dans l'instantané du lendemain ; null si celui-ci manque (ou pour aujourd'hui). */
  corrigees: number | null;
}
export interface PointSemaineDto {
  /** Lundi de la semaine et dernier jour retenu (dimanche, ou la fin de la période). */
  debut: string;
  fin: string;
  instantanes: number;
  /** Plus haut niveau d'alerte de la semaine. */
  niveauMax: NiveauAlerteGlobal | null;
  /** Nombres du dernier instantané de la semaine (situation en fin de semaine). */
  mesures: MesuresAffichees | null;
  /** Somme des corrections connues des jours de la semaine ; null si aucune n'est connue. */
  corrigees: number | null;
}

/** Un point par jour de `du` à `au` compris. */
export function pointsParJour(instantanes: readonly InstantaneLu[], du: string, au: string): PointJourDto[] {
  const par = new Map(instantanes.map((i) => [i.jour, i]));
  const out: PointJourDto[] = [];
  for (let j = du; j <= au; j = decalerJour(j, 1)) {
    const i = par.get(j);
    const lendemain = par.get(decalerJour(j, 1));
    out.push({
      jour: j,
      niveau: i?.niveau ?? null,
      mesures: i ? i.mesures : null,
      corrigees: lendemain ? lendemain.mesures.corrigeesVeille : null,
    });
  }
  return out;
}

/** Semaine après semaine (semaines ISO, du lundi au dimanche) : situation du dernier instantané de la semaine, plus haut
    niveau atteint, somme des corrections connues. */
export function agregerParSemaine(points: readonly PointJourDto[]): PointSemaineDto[] {
  const out: PointSemaineDto[] = [];
  for (const p of points) {
    const debut = lundiDe(p.jour);
    let s = out.at(-1);
    if (!s || s.debut !== debut) {
      out.push((s = { debut, fin: p.jour, instantanes: 0, niveauMax: null, mesures: null, corrigees: null }));
    }
    s.fin = p.jour;
    if (p.mesures) {
      s.instantanes++;
      s.mesures = p.mesures;
    }
    if (p.niveau !== null && (s.niveauMax === null || p.niveau > s.niveauMax)) s.niveauMax = p.niveau;
    if (p.corrigees !== null) s.corrigees = (s.corrigees ?? 0) + p.corrigees;
  }
  return out;
}

export const TENDANCES = ['amelioration', 'degradation', 'stable', 'indeterminee'] as const;
export type SensTendance = (typeof TENDANCES)[number];
export const TENDANCE_LIBELLES: Record<SensTendance, string> = {
  amelioration: 'S’améliore',
  degradation: 'Se dégrade',
  stable: 'Stable',
  indeterminee: 'Indéterminée',
};
/** Ordre des nombres comparés par la règle de la tendance. */
export const MESURES_TENDANCE: readonly CleMesure[] = ['p1', 'p2', 'depassements'];
/** Règle proposée au lot S2, À CONFIRMER PAR LE RSSI. */
export const REGLE_TENDANCE =
  'On compare le premier et le dernier instantané de la période : d’abord le nombre de failles présentes en P1 ; à égalité, celui des failles en P2 ; à égalité encore, celui des failles en dépassement de délai. Moins : la situation s’améliore ; plus : elle se dégrade ; tout égal : stable. Moins de deux instantanés : indéterminée. Règle proposée, à confirmer par le RSSI.';

export interface TendanceDto {
  sens: SensTendance;
  /** Phrase en clair : le nombre qui a tranché, avec ses deux valeurs. */
  explication: string;
  premier: string | null;
  dernier: string | null;
}

/** Indicateur de tendance (REGLE_TENDANCE) sur les points d'une période (jours ou semaines). */
export function tendanceSituation(
  points: readonly { mesures: MesuresAffichees | null; jour?: string; fin?: string }[],
): TendanceDto {
  const avec = points.filter((p) => p.mesures !== null);
  const premier = avec[0];
  const dernier = avec.at(-1);
  const date = (p: (typeof avec)[number] | undefined) => (p ? (p.jour ?? p.fin ?? null) : null);
  if (!premier || !dernier || avec.length < 2)
    return {
      sens: 'indeterminee',
      explication: 'Moins de deux instantanés sur la période : pas de tendance.',
      premier: date(premier),
      dernier: date(dernier),
    };
  for (const c of MESURES_TENDANCE) {
    const a = premier.mesures![c] ?? 0;
    const b = dernier.mesures![c] ?? 0;
    if (a !== b)
      return {
        sens: b < a ? 'amelioration' : 'degradation',
        explication: `${MESURE_LIBELLES[c]} : ${a} au premier instantané, ${b} au dernier.`,
        premier: date(premier),
        dernier: date(dernier),
      };
  }
  return {
    sens: 'stable',
    explication:
      'Mêmes nombres de failles présentes en P1 et en P2 et en dépassement au premier et au dernier instantané.',
    premier: date(premier),
    dernier: date(dernier),
  };
}

export interface TendancesDto {
  periode: number;
  granularite: Granularite;
  du: string;
  au: string;
  /** Portée : toute la plateforme (id null, aucun false), un périmètre lu, ou « sans périmètre » (administration). */
  perimetre: { id: string | null; nom: string | null; aucun: boolean };
  /** Jour du premier instantané pris (l'historique commence à l'installation du lot) ; null : aucun encore. */
  depuis: string | null;
  jours: PointJourDto[];
  semaines: PointSemaineDto[];
  tendance: TendanceDto;
  /** Périmètres que la personne lit (choix du périmètre) ; « sans périmètre » avec le droit d'administrer le module. */
  perimetres: { id: string; nom: string }[];
  sansPerimetre: boolean;
  retentionAns: number;
  calculeLe: string;
}

/* ------------------------------------------------------------------ Variation sur 7 jours (vue d'ensemble) */
export const MESURES_VARIATION: readonly CleMesure[] = ['p1', 'p2', 'exploitees', 'depassements', 'exceptions'];
export interface VariationSeptJoursDto {
  /** Jour de l'instantané de référence (sept jours avant, ou le plus proche avant, jusqu'à quatorze jours). */
  reference: string;
  niveau: { avant: NiveauAlerteGlobal; apres: NiveauAlerteGlobal };
  lignes: { cle: CleMesure; libelle: string; avant: number; apres: number; ecart: number }[];
}
/** Écart entre l'instantané de référence et la situation du moment, pour les nombres de MESURES_VARIATION. */
export function variationSeptJours(
  reference: { jour: string; niveau: NiveauAlerteGlobal; mesures: MesuresAffichees },
  actuel: { niveau: NiveauAlerteGlobal; mesures: MesuresAffichees },
): VariationSeptJoursDto {
  return {
    reference: reference.jour,
    niveau: { avant: reference.niveau, apres: actuel.niveau },
    lignes: MESURES_VARIATION.map((cle) => {
      const avant = reference.mesures[cle] ?? 0;
      const apres = actuel.mesures[cle] ?? 0;
      return { cle, libelle: MESURE_LIBELLES[cle], avant, apres, ecart: apres - avant };
    }),
  };
}
/** Écart en clair, jamais par la seule couleur : « +2 (en hausse) », « −1 (en baisse) », « 0 (inchangé) ». */
export function libelleEcart(ecart: number): string {
  if (ecart > 0) return `+${ecart} (en hausse)`;
  if (ecart < 0) return `−${-ecart} (en baisse)`;
  return '0 (inchangé)';
}

/* ------------------------------------------------------------------ Rapport de pilotage */
/** Durée maximale d'une période libre (jours). */
export const RAPPORT_PERIODE_MAX_JOURS = 366;
/** Lignes listées au plus par tableau (failles critiques, dépassements, exceptions, alertes) ; le total est toujours dit. */
export const RAPPORT_LISTE_MAX = 200;

export const RechercheRapport = z
  .object({
    mois: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mois au format AAAA-MM.')
      .optional(),
    du: JourCivil.optional(),
    au: JourCivil.optional(),
    perimetre: IdPerimetreVue.optional(),
    format: z.enum(['json', 'csv']).default('json'),
  })
  .strict()
  .refine((q) => !!q.mois !== !!(q.du || q.au), 'Choisir un mois, ou une période (du, au).')
  .refine((q) => !q.du === !q.au, 'Une période libre a un début et une fin.')
  .refine((q) => !q.du || !q.au || q.du <= q.au, 'La fin de la période précède son début.')
  .refine(
    (q) => !q.du || !q.au || enMs(q.au) - enMs(q.du) < RAPPORT_PERIODE_MAX_JOURS * JOUR_MS,
    `Une période de ${RAPPORT_PERIODE_MAX_JOURS} jours au plus.`,
  );
export type RechercheRapport = z.infer<typeof RechercheRapport>;

/** Début et fin d'une demande (mois entier, ou période libre), fin ramenée à aujourd'hui ; null si la période commence après
    aujourd'hui. */
export function periodeRapport(q: RechercheRapport, aujourdhui: string): { du: string; au: string } | null {
  let du: string, au: string;
  if (q.mois) {
    du = `${q.mois}-01`;
    const [a, m] = q.mois.split('-').map(Number) as [number, number];
    au = decalerJour(versJour(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 1)), -1);
  } else {
    du = q.du!;
    au = q.au!;
  }
  if (du > aujourdhui) return null;
  return { du, au: au > aujourdhui ? aujourdhui : au };
}

export interface SyntheseNiveauDto {
  instantanes: number;
  debut: NiveauAlerteGlobal | null;
  fin: NiveauAlerteGlobal | null;
  max: NiveauAlerteGlobal | null;
  /** Nombre de jours (instantanés) passés à chaque niveau. */
  joursParNiveau: Record<NiveauAlerteGlobal, number>;
}
export function syntheseNiveau(
  instantanes: readonly { jour: string; niveau: NiveauAlerteGlobal }[],
): SyntheseNiveauDto {
  const tries = [...instantanes].sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0));
  const joursParNiveau = Object.fromEntries(NIVEAUX_ALERTE_GLOBAL.map((n) => [n, 0])) as Record<
    NiveauAlerteGlobal,
    number
  >;
  let max: NiveauAlerteGlobal | null = null;
  for (const i of tries) {
    joursParNiveau[i.niveau]++;
    if (max === null || i.niveau > max) max = i.niveau;
  }
  return {
    instantanes: tries.length,
    debut: tries[0]?.niveau ?? null,
    fin: tries.at(-1)?.niveau ?? null,
    max,
    joursParNiveau,
  };
}

export interface DelaiPriseEnCompteDto {
  nombre: number;
  moyenneHeures: number | null;
  medianeHeures: number | null;
  maxHeures: number | null;
}
const arrondi = (x: number) => Math.round(x * 10) / 10;
/** Délai de prise en compte des alertes critiques prises en compte : de la montée en critique à la prise en compte. */
export function mesurerPrisesEnCompte(
  alertes: readonly { critiqueLe: string; priseLe: string | null }[],
): DelaiPriseEnCompteDto {
  const d = alertes
    .filter((a) => a.priseLe)
    .map((a) => Math.max(0, (Date.parse(a.priseLe!) - Date.parse(a.critiqueLe)) / 3_600_000))
    .sort((a, b) => a - b);
  const n = d.length;
  return {
    nombre: n,
    moyenneHeures: n ? arrondi(d.reduce((s, x) => s + x, 0) / n) : null,
    medianeHeures: n ? arrondi(n % 2 ? d[(n - 1) / 2]! : (d[n / 2 - 1]! + d[n / 2]!) / 2) : null,
    maxHeures: n ? arrondi(d[n - 1]!) : null,
  };
}

export interface FailleRapportDto {
  cle: string;
  cve: string | null;
  titre: string;
  produit: string | null;
  presences: Presence[];
  /** Première présence connue de ses objets suivis (null : exposée seulement). */
  depuis: string | null;
  enDepassement: boolean;
}
export interface DepassementRapportDto {
  nature: 'constat' | 'declaree';
  titre: string;
  cves: string[];
  priorite: NiveauPriorite;
  echeance: string;
  retardHeures: number;
}
export interface AlerteRapportDto {
  cve: string | null;
  titre: string;
  produit: string | null;
  critiqueLe: string;
  priseLe: string | null;
  closeLe: string | null;
  motif: MotifClotureAlerte | null;
}
export interface SourcesRapportDto {
  fluxOuvert: boolean;
  veille: { libelle: string; derniereReussite: string | null; enRetard: boolean; enEchec: boolean }[];
  /** Connecteurs désignés par leur type et un numéro d'ordre (ni nom d'instance ni adresse). */
  connecteurs: { libelle: string; actif: boolean; derniereCompleteLe: string | null; derniereEtat: string | null }[];
}

export interface RapportVulnerabilitesDto {
  etablissement: string;
  produitLe: string;
  du: string;
  au: string;
  perimetre: { id: string | null; nom: string | null; aucun: boolean };
  /** Le détail des machines n'est jamais inclus par ce lot (point ouvert). */
  avecDetail: false;
  niveau: SyntheseNiveauDto & { actuel: NiveauAlerteGlobalDto };
  situation: MesuresAffichees;
  critiques: { total: number; p2: number; elements: FailleRapportDto[] };
  delais: { reglage: DelaisCorrection; mesures: MesuresDelaisDto; nonMesurees: number };
  depassements: { total: number; elements: DepassementRapportDto[] };
  exceptions: { compteurs: Record<StatutException, number>; elements: ExceptionDto[] };
  tendances: { depuis: string | null; semaines: PointSemaineDto[]; tendance: TendanceDto };
  alertes: {
    ouvertes: number;
    prisesEnCompte: number;
    closes: number;
    enCours: number;
    delai: DelaiPriseEnCompteDto;
    total: number;
    elements: AlerteRapportDto[];
  };
  sources: SourcesRapportDto;
  bornes: { liste: number };
}

/** Un tableau du rapport, rendu tel quel à l'écran (page imprimable) et dans l'export CSV. */
export interface TableauRapport {
  id: string;
  titre: string;
  entetes: string[];
  lignes: string[][];
  /** Texte d'une table vide. */
  vide: string;
  /** Précision écrite sous le tableau (borne atteinte, définition). */
  note: string | null;
}

const FUSEAU = 'Europe/Paris';
/** Date et heure en clair, fuseau de l'organisation (jj/mm/aaaa hh:mm). */
export function fmtHorodatage(iso: string | null): string {
  if (!iso) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: FUSEAU,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
const niveauEnClair = (n: NiveauAlerteGlobal | null) =>
  n === null ? '—' : `${n} (${NIVEAU_ALERTE_GLOBAL_LIBELLES[n]})`;
const nombre = (n: number | null) => (n === null ? '—' : String(n));
const borne = (total: number, rendus: number) =>
  total > rendus ? `${rendus} lignes listées sur ${total} ; les autres ne sont pas reprises.` : null;

/** Tableaux du rapport, dans l'ordre de lecture. Aucun nom de machine, de domaine, d'adresse ni de compte ; seules les
    personnes qui ont accordé une exception sont nommées (comme l'onglet « Délais et exceptions »). */
export function tableauxRapport(r: RapportVulnerabilitesDto): TableauRapport[] {
  const n = r.niveau;
  const lignesSituation = MESURES_INSTANTANE.filter((c) => c !== 'corrigeesVeille').map((c) => [
    MESURE_LIBELLES[c],
    r.situation[c] === null ? 'Par périmètre seulement' : String(r.situation[c]),
  ]);
  return [
    {
      id: 'niveau',
      titre: 'Niveau d’alerte de la plateforme',
      entetes: ['Repère', 'Niveau'],
      lignes: [
        ['Au moment du rapport', niveauEnClair(n.actuel.niveau)],
        ['Premier instantané de la période', niveauEnClair(n.debut)],
        ['Dernier instantané de la période', niveauEnClair(n.fin)],
        ['Plus haut niveau de la période', niveauEnClair(n.max)],
        ...NIVEAUX_ALERTE_GLOBAL.map((x) => [
          `Jours au niveau ${x} (${NIVEAU_ALERTE_GLOBAL_LIBELLES[x]})`,
          String(n.joursParNiveau[x]),
        ]),
      ],
      vide: '',
      note: `${n.instantanes} instantané${n.instantanes > 1 ? 's' : ''} sur la période. Le niveau d’alerte est celui de la plateforme, le même pour tout le monde. ${n.actuel.explication}`,
    },
    {
      id: 'situation',
      titre: 'Situation au moment du rapport',
      entetes: ['Nombre', 'Valeur'],
      lignes: lignesSituation,
      vide: '',
      note: 'Nombres de failles communs à tous ; machines et actifs exposés comptés par périmètre seulement.',
    },
    {
      id: 'critiques',
      titre: `Failles critiques (P1) présentes : ${r.critiques.total} ; failles présentes en P2 : ${r.critiques.p2}`,
      entetes: ['CVE', 'Faille', 'Produit', 'Présence', 'Depuis', 'Délai'],
      lignes: r.critiques.elements.map((f) => [
        f.cve ?? 'Sans CVE',
        f.titre,
        f.produit ?? '—',
        f.presences.map((p) => PRESENCE_LIBELLES[p]).join(', '),
        f.depuis ? fmtHorodatage(f.depuis) : '—',
        f.enDepassement ? 'En dépassement' : 'Dans les délais ou sans objet',
      ]),
      vide: 'Aucune faille présente en P1.',
      note: borne(r.critiques.total, r.critiques.elements.length),
    },
    {
      id: 'delais',
      titre: 'Délais de correction des failles corrigées sur la période',
      entetes: [
        'Priorité',
        'Délai cible',
        'Failles corrigées',
        'Délai moyen',
        'Délai médian',
        'Dans les délais',
        'Taux',
      ],
      lignes: [
        ...r.delais.mesures.parPriorite.map((m) => [
          m.priorite,
          libelleDelai(r.delais.reglage[m.priorite]),
          String(m.nombre),
          libelleDuree(m.moyenneHeures),
          libelleDuree(m.medianeHeures),
          m.avecDelai ? `${m.dansLesDelais} sur ${m.avecDelai}` : 'Sans délai',
          libelleTaux(m.taux),
        ]),
        [
          'Toutes',
          '—',
          String(r.delais.mesures.total.nombre),
          libelleDuree(r.delais.mesures.total.moyenneHeures),
          libelleDuree(r.delais.mesures.total.medianeHeures),
          r.delais.mesures.total.avecDelai
            ? `${r.delais.mesures.total.dansLesDelais} sur ${r.delais.mesures.total.avecDelai}`
            : 'Sans délai',
          libelleTaux(r.delais.mesures.total.taux),
        ],
      ],
      vide: '',
      note: r.delais.nonMesurees
        ? `${r.delais.nonMesurees} correction${r.delais.nonMesurees > 1 ? 's' : ''} décidée${r.delais.nonMesurees > 1 ? 's' : ''} avant la mesure des délais, non mesurée${r.delais.nonMesurees > 1 ? 's' : ''}.`
        : null,
    },
    {
      id: 'depassements',
      titre: `Failles en dépassement de délai au moment du rapport : ${r.depassements.total}`,
      entetes: ['Faille', 'CVE', 'Priorité', 'Échéance', 'Retard'],
      lignes: r.depassements.elements.map((d) => [
        d.titre,
        d.cves.join(', ') || '—',
        d.priorite,
        fmtHorodatage(d.echeance),
        libelleDuree(d.retardHeures),
      ]),
      vide: 'Aucune faille en dépassement de délai.',
      note: borne(r.depassements.total, r.depassements.elements.length),
    },
    {
      id: 'exceptions',
      titre: `Exceptions (risques acceptés) : ${STATUTS_EXCEPTION.map((s) => `${STATUT_EXCEPTION_LIBELLES[s].toLowerCase()} ${r.exceptions.compteurs[s]}`).join(', ')}`,
      entetes: ['Faille', 'Statut', 'Échéance', 'Accordée par', 'Accordée le', 'Justification', 'Mesure compensatoire'],
      lignes: r.exceptions.elements.map((e) => [
        e.titre,
        STATUT_EXCEPTION_LIBELLES[e.statut] + (e.expireeLe ? ` le ${fmtHorodatage(e.expireeLe)}` : ''),
        fmtJour(e.echeance) || 'Aucune',
        e.par ?? '—',
        e.le ? fmtHorodatage(e.le) : '—',
        e.justification ?? '—',
        e.mesure ?? '—',
      ]),
      vide: 'Aucune exception en cours ni échue sur la période.',
      note: 'Textes saisis par le RSSI, passés au masque des machines : un nom de machine, de domaine ou une adresse y est remplacé par « [machine] ».',
    },
    {
      id: 'tendances',
      titre: `Tendance de la période : ${TENDANCE_LIBELLES[r.tendances.tendance.sens]}`,
      entetes: [
        'Semaine du',
        'au',
        'Niveau le plus haut',
        'P1',
        'P2',
        'Exploitées et présentes',
        'En dépassement',
        'Sous exception',
        'Corrigées',
      ],
      lignes: r.tendances.semaines.map((s) => [
        fmtJour(s.debut),
        fmtJour(s.fin),
        niveauEnClair(s.niveauMax),
        nombre(s.mesures?.p1 ?? null),
        nombre(s.mesures?.p2 ?? null),
        nombre(s.mesures?.exploitees ?? null),
        nombre(s.mesures?.depassements ?? null),
        nombre(s.mesures?.exceptions ?? null),
        nombre(s.corrigees),
      ]),
      vide: 'Aucun instantané sur la période.',
      note: `${r.tendances.tendance.explication} ${REGLE_TENDANCE} ${r.tendances.depuis ? `Historique depuis le ${fmtJour(r.tendances.depuis)}.` : 'Aucun instantané pris : l’historique commence à l’installation du lot.'} Nombres du dernier instantané de chaque semaine ; « — » : aucun instantané.`,
    },
    {
      id: 'alertes',
      titre: `Alertes critiques de la période : ${r.alertes.ouvertes} ouverte${r.alertes.ouvertes > 1 ? 's' : ''}, ${r.alertes.prisesEnCompte} prise${r.alertes.prisesEnCompte > 1 ? 's' : ''} en compte, ${r.alertes.closes} close${r.alertes.closes > 1 ? 's' : ''}, ${r.alertes.enCours} encore en cours à la fin`,
      entetes: ['CVE', 'Faille', 'Produit', 'Critique depuis le', 'Prise en compte le', 'Close le', 'Motif de clôture'],
      lignes: r.alertes.elements.map((a) => [
        a.cve ?? 'Sans CVE',
        a.titre,
        a.produit ?? '—',
        fmtHorodatage(a.critiqueLe),
        a.priseLe ? fmtHorodatage(a.priseLe) : '—',
        a.closeLe ? fmtHorodatage(a.closeLe) : '—',
        a.motif ? MOTIF_CLOTURE_ALERTE_LIBELLES[a.motif] : '—',
      ]),
      vide: 'Aucune alerte critique sur la période.',
      note: [
        `Délai de prise en compte (${r.alertes.delai.nombre} alerte${r.alertes.delai.nombre > 1 ? 's' : ''}) : moyen ${libelleDuree(r.alertes.delai.moyenneHeures)}, médian ${libelleDuree(r.alertes.delai.medianeHeures)}, le plus long ${libelleDuree(r.alertes.delai.maxHeures)}.`,
        'Alertes de la plateforme, communes à tous.',
        borne(r.alertes.total, r.alertes.elements.length),
      ]
        .filter(Boolean)
        .join(' '),
    },
    {
      id: 'sources',
      titre: 'État des sources de veille et des connecteurs',
      entetes: ['Source ou connecteur', 'État', 'Dernière réussite'],
      lignes: [
        ...r.sources.veille.map((s) => [
          s.libelle,
          !r.sources.fluxOuvert ? 'Veille fermée' : s.enEchec ? 'En échec' : s.enRetard ? 'En retard' : 'À jour',
          s.derniereReussite ? fmtHorodatage(s.derniereReussite) : 'Jamais',
        ]),
        ...r.sources.connecteurs.map((c) => [
          c.libelle,
          !c.actif ? 'Désactivé' : (c.derniereEtat ?? 'Aucune synchronisation'),
          c.derniereCompleteLe ? fmtHorodatage(c.derniereCompleteLe) : 'Jamais',
        ]),
      ],
      vide: 'Aucune source ni aucun connecteur.',
      note: null,
    },
  ];
}

/** Libellé de la portée d'un rapport ou d'une tendance. */
export function libellePortee(p: { nom: string | null; aucun: boolean }): string {
  return p.aucun ? 'Sans périmètre' : (p.nom ?? 'Toute la plateforme');
}

/** Export CSV des tableaux du rapport : en-tête (établissement, période, portée, date de production), puis chaque tableau
    précédé de son titre. Séparateur « ; », cellules entre guillemets, formules neutralisées (comme les autres exports). */
export function csvRapport(r: RapportVulnerabilitesDto): string {
  const cellule = (v: string) => {
    const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const ligne = (l: readonly string[]) => l.map(cellule).join(';');
  const out: string[] = [
    ligne(['Rapport de pilotage des vulnérabilités']),
    ligne(['Établissement', r.etablissement]),
    ligne(['Période', `du ${fmtJour(r.du)} au ${fmtJour(r.au)}`]),
    ligne(['Portée', libellePortee(r.perimetre)]),
    ligne(['Document produit par la plateforme le', fmtHorodatage(r.produitLe)]),
  ];
  for (const t of tableauxRapport(r)) {
    out.push('', ligne([t.titre]), ligne(t.entetes));
    for (const l of t.lignes) out.push(ligne(l));
    if (!t.lignes.length) out.push(ligne([t.vide]));
    if (t.note) out.push(ligne([t.note]));
  }
  return '﻿' + out.join('\r\n');
}
