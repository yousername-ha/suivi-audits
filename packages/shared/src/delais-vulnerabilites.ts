/* Module Vulnérabilités (ADR 0100, lot S1 ; décision du RSSI du 18/11/2026) : délais de correction et exceptions à échéance.
   Fonctions pures et déterministes, testées à part : à faits égaux, même résultat (rejouable), les mêmes pour tout le monde
   (lot ALH5). Aucun nom de machine, de domaine, d'adresse ni de périmètre ici.
   - Délai cible par priorité, réglé avec les seuils de priorité (vulnerabilites:administrer, If-Match, journal). Valeurs par
     défaut portées par le code, À CONFIRMER PAR LE RSSI : P1 48 heures, P2 15 jours, P3 90 jours, P4 aucun délai. Un jour
     vaut 24 heures (jours calendaires, ni ouvrés ni fériés).
   - Point de départ : la première présence connue chez nous (première détection de Tenable sur une machine, sinon entrée du
     constat dans la plateforme ; date du rapprochement pour une faille déclarée), ou la reprise du délai (fin d'une
     exception, réapparition) si elle est plus récente. La priorité qui fixe le délai est la priorité courante : son passage
     n'est pas historisé, le délai court donc depuis la première présence même après une montée (P2 → P1).
   - États : en dépassement, échéance proche (moins d'un quart du délai restant), dans les délais, sans délai ; une faille
     close (corrigée, non concernée), sous exception (risque accepté) ou que la source ne rapporte plus (proposition
     « corrigée » à confirmer) n'est jamais en dépassement.
   - Exceptions (acceptation du risque) : justification, mesure compensatoire et échéance obligatoires, échéance à douze mois
     au plus (À CONFIRMER) ; décidées par le seul rôle « RSSI » de la plateforme ; rappel quatorze jours avant l'échéance ;
     à l'échéance passée, l'exception expire d'elle-même. */
import { z } from 'zod';
import { NIVEAUX_PRIORITE, type NiveauPriorite } from './failles-tenable.js';
import type { EtatSuiviFaille, NatureSuivi } from './suivi-vulnerabilites.js';

/* ------------------------------------------------------------------ Réglage des délais */
export const UNITES_DELAI = ['heures', 'jours'] as const;
export type UniteDelai = (typeof UNITES_DELAI)[number];
export const UNITE_DELAI_LIBELLES: Record<UniteDelai, string> = { heures: 'heures', jours: 'jours' };
/** Bornes d'un délai : une heure à un an. */
export const DELAI_CORRECTION_MAX: Record<UniteDelai, number> = { heures: 8760, jours: 365 };

/** Délai cible d'une priorité : une durée entière en heures ou en jours ; `null` : aucun délai. */
export const DelaiCorrection = z
  .object({ duree: z.number().int().min(1, 'Durée d’au moins 1.'), unite: z.enum(UNITES_DELAI) })
  .strict()
  .refine((d) => d.duree <= DELAI_CORRECTION_MAX[d.unite], {
    message: 'Délai d’un an au plus (365 jours ou 8 760 heures).',
    path: ['duree'],
  })
  .nullable();
export type DelaiCorrection = z.infer<typeof DelaiCorrection>;

export const DelaisCorrection = z
  .object({ P1: DelaiCorrection, P2: DelaiCorrection, P3: DelaiCorrection, P4: DelaiCorrection })
  .strict();
export type DelaisCorrection = z.infer<typeof DelaisCorrection>;

/** Valeurs par défaut, À CONFIRMER PAR LE RSSI (aucune donnée de départ en base). */
export const DELAIS_CORRECTION_DEFAUT: DelaisCorrection = {
  P1: { duree: 48, unite: 'heures' },
  P2: { duree: 15, unite: 'jours' },
  P3: { duree: 90, unite: 'jours' },
  P4: null,
};

const HEURE = 3_600_000;
/** Durée d'un délai en millisecondes (un jour vaut 24 heures) ; null sans délai. */
export const dureeDelaiMs = (d: DelaiCorrection): number | null =>
  d ? d.duree * HEURE * (d.unite === 'jours' ? 24 : 1) : null;
export function libelleDelai(d: DelaiCorrection): string {
  if (!d) return 'Aucun délai';
  const u = d.unite === 'jours' ? (d.duree > 1 ? 'jours' : 'jour') : d.duree > 1 ? 'heures' : 'heure';
  return `${d.duree.toLocaleString('fr-FR')} ${u}`;
}

/* ------------------------------------------------------------------ État de délai d'une faille suivie */
/** Part du délai en deçà de laquelle l'échéance est « proche » : moins d'un quart du délai restant (fixe). */
export const PART_ECHEANCE_PROCHE = 0.25;

export const ETATS_DELAI = [
  'en_depassement',
  'echeance_proche',
  'dans_les_delais',
  'sans_delai',
  'sous_exception',
  'non_rapportee',
  'close',
] as const;
export type EtatDelai = (typeof ETATS_DELAI)[number];
export const EtatDelaiFiltre = z.enum(ETATS_DELAI);
export const ETAT_DELAI_LIBELLES: Record<EtatDelai, string> = {
  en_depassement: 'En dépassement',
  echeance_proche: 'Échéance proche',
  dans_les_delais: 'Dans les délais',
  sans_delai: 'Sans délai',
  sous_exception: 'Sous exception',
  non_rapportee: 'Plus rapportée par la source',
  close: 'Close',
};
/** États où le délai court : la faille est ouverte, présente et a un délai. */
export const ETATS_DELAI_COURANT: readonly EtatDelai[] = ['en_depassement', 'echeance_proche', 'dans_les_delais'];

/** Tri des listes de failles : par priorité (défaut) ou par échéance de correction (la plus proche d'abord). */
export const TRIS_FAILLES = ['priorite', 'echeance'] as const;
export type TriFailles = (typeof TRIS_FAILLES)[number];
export const TriFailles = z.enum(TRIS_FAILLES);

export interface DelaiFailleDto {
  etat: EtatDelai;
  /** Priorité qui fixe le délai : la priorité courante de la faille. */
  priorite: NiveauPriorite;
  delai: DelaiCorrection;
  /** Première présence connue chez nous (sert à l'âge). */
  premiere: string | null;
  /** Point de départ du délai : la première présence, ou la reprise du délai si elle est plus récente. */
  depuis: string | null;
  /** Échéance calculée (jamais saisie) ; null sans délai. */
  echeance: string | null;
}

export interface EntreeDelai {
  priorite: NiveauPriorite;
  etatSuivi: EtatSuiviFaille;
  /** La source rapporte encore la faille. */
  present: boolean;
  premiere: string | null;
  /** Reprise du délai (fin d'une exception, réapparition), ou null. */
  repartLe: string | null;
  delais: DelaisCorrection;
  maintenant: Date;
}

const plusTard = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b);

/** Délai d'une faille suivie : point de départ, échéance calculée et état. */
export function calculerDelai(e: EntreeDelai): DelaiFailleDto {
  const delai = e.delais[e.priorite];
  const depuis = plusTard(e.premiere, e.repartLe);
  const duree = dureeDelaiMs(delai);
  const echeance = depuis && duree !== null ? new Date(Date.parse(depuis) + duree).toISOString() : null;
  const sortie = (etat: EtatDelai): DelaiFailleDto => ({
    etat,
    priorite: e.priorite,
    delai,
    premiere: e.premiere,
    depuis,
    echeance,
  });
  if (e.etatSuivi === 'corrigee' || e.etatSuivi === 'non_concernee') return sortie('close');
  if (e.etatSuivi === 'risque_accepte') return sortie('sous_exception');
  if (!e.present) return sortie('non_rapportee');
  if (!echeance || duree === null) return sortie('sans_delai');
  const reste = Date.parse(echeance) - e.maintenant.getTime();
  if (reste < 0) return sortie('en_depassement');
  if (reste <= duree * PART_ECHEANCE_PROCHE) return sortie('echeance_proche');
  return sortie('dans_les_delais');
}

/** Ordre « par échéance » : les délais qui courent, de la plus proche échéance à la plus lointaine, puis le reste. */
export function comparerEcheances(a: DelaiFailleDto, b: DelaiFailleDto): number {
  const cle = (d: DelaiFailleDto) =>
    d.echeance && ETATS_DELAI_COURANT.includes(d.etat) ? Date.parse(d.echeance) : Number.POSITIVE_INFINITY;
  const x = cle(a);
  const y = cle(b);
  return x === y ? 0 : x < y ? -1 : 1;
}

/** Âge en clair depuis la première présence : « 3 h », « 12 j ». */
export function libelleAge(premiere: string | null, maintenant: Date): string {
  if (!premiere) return 'Inconnu';
  const h = Math.max(0, Math.floor((maintenant.getTime() - Date.parse(premiere)) / HEURE));
  return h < 48 ? `${h} h` : `${Math.floor(h / 24).toLocaleString('fr-FR')} j`;
}

/* ------------------------------------------------------------------ Exceptions (acceptation du risque) */
/** Durée maximale d'une exception, en mois, À CONFIRMER PAR LE RSSI. */
export const EXCEPTION_DUREE_MAX_MOIS = 12;
/** Rappel et « bientôt échue » : quatorze jours avant l'échéance (fixe). */
export const RAPPEL_EXCEPTION_JOURS = 14;
export const MESURE_COMPENSATOIRE_MAX = 1000;
export const EXCEPTION_RESERVEE = 'Seul le RSSI peut accorder, prolonger ou lever une exception (risque accepté).';

const JOUR = 24 * HEURE;
const enJour = (d: string) => Date.parse(`${d}T00:00:00Z`);
const versDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Échéance la plus lointaine admise depuis `aujourdhui` (AAAA-MM-JJ) : même jour, douze mois plus tard (fin du mois si ce
    jour n'existe pas). */
export function echeanceMaxException(aujourdhui: string): string {
  const [a, m, j] = aujourdhui.split('-').map(Number) as [number, number, number];
  const mois = m - 1 + EXCEPTION_DUREE_MAX_MOIS;
  const annee = a + Math.floor(mois / 12);
  const mm = mois % 12;
  const dernier = new Date(Date.UTC(annee, mm + 1, 0)).getUTCDate();
  return versDate(Date.UTC(annee, mm, Math.min(j, dernier)));
}

/** Motif de refus d'une échéance d'exception, ou null : obligatoire, ni passée ni au-delà de douze mois. */
export function refusEcheanceException(echeance: string | null | undefined, aujourdhui: string): string | null {
  if (!echeance) return 'Une date d’échéance est obligatoire pour accepter un risque.';
  if (echeance < aujourdhui) return 'L’échéance de l’exception ne peut pas être passée.';
  if (echeance > echeanceMaxException(aujourdhui))
    return `L’échéance d’une exception est de ${EXCEPTION_DUREE_MAX_MOIS} mois au plus (le ${echeanceMaxException(aujourdhui)} au plus tard).`;
  return null;
}

export const STATUTS_EXCEPTION = ['en_cours', 'bientot_echue', 'echue', 'sans_echeance'] as const;
export type StatutException = (typeof STATUTS_EXCEPTION)[number];
export const STATUT_EXCEPTION_LIBELLES: Record<StatutException, string> = {
  en_cours: 'En cours',
  bientot_echue: 'Bientôt échue',
  echue: 'Échue',
  sans_echeance: 'Sans échéance, à compléter',
};

/** Statut d'une exception au jour donné (AAAA-MM-JJ, fuseau de l'organisation). Valide jusqu'au jour de l'échéance compris ;
    une exception enregistrée avant le lot S1 sans échéance reste valide et est signalée « à compléter ». */
export function statutException(echeance: string | null, aujourdhui: string): StatutException {
  if (!echeance) return 'sans_echeance';
  if (echeance < aujourdhui) return 'echue';
  if (enJour(echeance) - enJour(aujourdhui) <= RAPPEL_EXCEPTION_JOURS * JOUR) return 'bientot_echue';
  return 'en_cours';
}

/** État d'une faille quand son exception expire : l'état d'avant l'exception s'il était « à traiter » ou « en cours », sinon
    « à traiter ». */
export function etatApresExpiration(avant: EtatSuiviFaille | null): EtatSuiviFaille {
  return avant === 'en_cours' || avant === 'a_traiter' ? avant : 'a_traiter';
}

/** Exception d'une faille : en cours (risque accepté) ou échue (expirée par la plateforme, gardée à l'historique). */
export interface ExceptionDto {
  nature: NatureSuivi;
  objetId: string;
  /** Nom du contrôle de Tenable, ou CVE et produit surveillé ; jamais de nom de machine. */
  titre: string;
  statut: StatutException;
  echeance: string | null;
  justification: string | null;
  mesure: string | null;
  par: string | null;
  le: string | null;
  /** Exception échue : date de l'expiration et état rendu à la faille. */
  expireeLe: string | null;
  etatApres: EtatSuiviFaille | null;
}

/* ------------------------------------------------------------------ Mesure des délais de correction */
export const PERIODES_MESURE = [30, 90, 365] as const;
export const RechercheDelais = z
  .object({
    periode: z.coerce
      .number()
      .int()
      .refine((p) => (PERIODES_MESURE as readonly number[]).includes(p), 'Période de 30, 90 ou 365 jours.')
      .default(90),
  })
  .strict();
export type RechercheDelais = z.infer<typeof RechercheDelais>;

/** Une faille passée à « corrigée » : priorité, point de départ et échéance de son délai, relevés à la décision. */
export interface CorrectionMesuree {
  priorite: NiveauPriorite;
  depuis: string;
  fin: string;
  echeance: string | null;
}

export interface MesurePrioriteDto {
  priorite: NiveauPriorite;
  nombre: number;
  /** Durée de correction, en heures : moyenne et médiane ; null sans correction. */
  moyenneHeures: number | null;
  medianeHeures: number | null;
  /** Corrections qui avaient un délai, et celles faites au plus tard à l'échéance. */
  avecDelai: number;
  dansLesDelais: number;
  /** Part des corrections faites dans les délais (0 à 1) ; null sans correction soumise à un délai. */
  taux: number | null;
}

export interface MesuresDelaisDto {
  parPriorite: MesurePrioriteDto[];
  total: Omit<MesurePrioriteDto, 'priorite'>;
}

const arrondi = (x: number) => Math.round(x * 10) / 10;
function mesurer(lignes: readonly CorrectionMesuree[]) {
  const durees = lignes
    .map((l) => Math.max(0, (Date.parse(l.fin) - Date.parse(l.depuis)) / HEURE))
    .sort((a, b) => a - b);
  const n = durees.length;
  const avec = lignes.filter((l) => l.echeance);
  const dans = avec.filter((l) => Date.parse(l.fin) <= Date.parse(l.echeance!)).length;
  return {
    nombre: n,
    moyenneHeures: n ? arrondi(durees.reduce((s, x) => s + x, 0) / n) : null,
    medianeHeures: n ? arrondi(n % 2 ? durees[(n - 1) / 2]! : (durees[n / 2 - 1]! + durees[n / 2]!) / 2) : null,
    avecDelai: avec.length,
    dansLesDelais: dans,
    taux: avec.length ? dans / avec.length : null,
  };
}

/** Délai moyen et médian de correction par priorité, et part des corrections faites dans les délais. */
export function mesurerCorrections(lignes: readonly CorrectionMesuree[]): MesuresDelaisDto {
  return {
    parPriorite: NIVEAUX_PRIORITE.map((p) => ({ priorite: p, ...mesurer(lignes.filter((l) => l.priorite === p)) })),
    total: mesurer(lignes),
  };
}

/** Durée en clair (heures en dessous de deux jours, jours au-delà). */
export function libelleDuree(heures: number | null): string {
  if (heures === null) return '—';
  return heures < 48
    ? `${heures.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`
    : `${(heures / 24).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`;
}
export const libelleTaux = (t: number | null) =>
  t === null ? '—' : `${(t * 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %`;

/* ------------------------------------------------------------------ Lecture : onglet « Délais et exceptions » */
export interface DelaisVueDto {
  delais: DelaisCorrection;
  periode: number;
  du: string;
  au: string;
  mesures: MesuresDelaisDto;
  /** Corrections de la période sans priorité relevée (décidées avant le lot S1) : non mesurées. */
  nonMesurees: number;
  /** Exceptions en cours et échues depuis 90 jours, parmi les failles que la personne lit. */
  exceptions: ExceptionDto[];
  compteurs: Record<StatutException, number>;
  /** La personne tient le rôle RSSI : elle peut accorder, prolonger ou lever une exception. */
  peutDeciderException: boolean;
  calculeLe: string;
}
/** Exceptions échues gardées dans l'onglet (jours). */
export const EXCEPTIONS_ECHUES_JOURS = 90;
export const EXCEPTIONS_MAX = 500;

/* ------------------------------------------------------------------ Notifications (résumés, sans nom) */
export const PREFIXE_RESUME_DELAIS = 'delais:';
export const PREFIXE_RESUME_EXCEPTIONS = 'exceptions:';
export const LIEN_DEPASSEMENTS = '/vulnerabilites/failles?delai=en_depassement';
export const LIEN_EXCEPTIONS = '/vulnerabilites/delais';
export function titreResumeDepassements(n: number): string {
  return n === 1
    ? 'Vulnérabilités : 1 faille en dépassement de délai'
    : `Vulnérabilités : ${n} failles en dépassement de délai`;
}
export const MESSAGE_RESUME_DEPASSEMENTS =
  'Délai de correction dépassé, selon la priorité calculée par la plateforme. La liste est dans la rubrique Vulnérabilités, Failles détectées, selon vos droits de lecture.';
export function titreResumeExceptions(echues: number, proches: number): string {
  const morceaux: string[] = [];
  if (echues) morceaux.push(echues === 1 ? '1 exception échue' : `${echues} exceptions échues`);
  if (proches)
    morceaux.push(
      proches === 1
        ? `1 exception à échéance sous ${RAPPEL_EXCEPTION_JOURS} jours`
        : `${proches} exceptions à échéance sous ${RAPPEL_EXCEPTION_JOURS} jours`,
    );
  return `Vulnérabilités : ${morceaux.join(', ')}`;
}
export const MESSAGE_RESUME_EXCEPTIONS =
  'Une exception échue a rendu la faille à traiter ; une exception proche de son échéance est à prolonger ou à lever par le RSSI. Le détail est dans la rubrique Vulnérabilités, Délais et exceptions, selon vos droits de lecture.';
