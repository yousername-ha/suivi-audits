/* Frise des actions : une barre par action, du début à l'échéance, sur une période qui défile (le Gantt mensuel ne
   montre qu'un mois). Calcul pur de la période, du placement, des colonnes de temps et des regroupements ; le rendu est
   celui de la Timeline Studio (TimelineStudio.tsx, refonte des frises du 20/11/2026). Les actions sans aucune date sont
   listées à part ; rien n'est inventé pour les placer. */
import type { BusinessPolicy, GrcObject, TacheAction, TaskData } from '@suivi/shared';
import { lundi, numeroSemaine } from './timeline-calendrier';

const JOUR = 86_400_000;

export interface Frise {
  /** Premier jour affiché (minuit UTC) et nombre de jours. */
  debut: number;
  jours: number;
  /** Actions placées (au moins une date) et actions sans date. */
  placees: { objet: GrcObject; de: number; a: number }[];
  sansDate: GrcObject[];
  /** Actions dont les dates ne se placent pas, avec la raison : jamais corrigées ni inversées en silence. */
  incoherentes: { objet: GrcObject; raison: RaisonDate }[];
  /** Vrai quand la période a été bornée à deux ans : des actions peuvent alors tomber hors de la période affichée. */
  tronquee: boolean;
  /** Actions placées dont la barre est entièrement hors de la période affichée (non dessinées). */
  horsPeriode: GrcObject[];
}
export type RaisonDate = 'debut-apres-echeance' | 'date-illisible';
export const RAISON_DATE_LABELS: Record<RaisonDate, string> = {
  'debut-apres-echeance': 'le début est postérieur à l’échéance',
  'date-illisible': 'une date est illisible',
};
const jourDe = (iso: string) => Math.floor(new Date(iso).getTime() / JOUR) * JOUR;

/** Calcul pur (testé) : bornes de la période affichée et position de chaque action. Marge d'une semaine de chaque côté,
    période bornée à deux ans pour garder une frise lisible. */
export function calculerFrise(items: GrcObject[], aujourdhui: number): Frise {
  const placees: Frise['placees'] = [];
  const sansDate: GrcObject[] = [];
  const incoherentes: Frise['incoherentes'] = [];
  for (const objet of items) {
    const t = objet.data as Partial<TaskData>;
    const brutes = [t.startAt, t.dueAt].filter((d): d is string => typeof d === 'string' && !!d);
    if (!brutes.length) {
      sansDate.push(objet);
      continue;
    }
    const dates = brutes.map(jourDe);
    if (dates.some((d) => !Number.isFinite(d))) {
      incoherentes.push({ objet, raison: 'date-illisible' });
      continue;
    }
    // Début et échéance renseignés : un début après l'échéance est une erreur de saisie, pas une barre à l'envers.
    if (brutes.length === 2 && dates[0]! > dates[1]!) {
      incoherentes.push({ objet, raison: 'debut-apres-echeance' });
      continue;
    }
    placees.push({ objet, de: Math.min(...dates), a: Math.max(...dates) });
  }
  const jourAuj = Math.floor(aujourdhui / JOUR) * JOUR;
  const bornes = [...placees.flatMap((p) => [p.de, p.a]), jourAuj];
  const debut = Math.min(...bornes) - 7 * JOUR;
  const finComplete = Math.max(...bornes) + 7 * JOUR;
  const fin = Math.min(finComplete, debut + 730 * JOUR);
  placees.sort((x, y) => x.de - y.de || x.a - y.a);
  const horsPeriode = placees.filter((p) => p.de > fin || p.a < debut).map((p) => p.objet);
  return {
    debut,
    jours: Math.round((fin - debut) / JOUR) + 1,
    placees: placees.filter((p) => !horsPeriode.includes(p.objet)),
    sansDate,
    incoherentes,
    tronquee: finComplete > fin,
    horsPeriode,
  };
}

/* ---------- Colonnes de temps de la frise des actions ---------- */

/** Échelles de la frise des actions : une colonne par semaine ISO, mois, trimestre ou année civile. */
export const UNITES_FRISE = {
  semaine: { libelle: 'Semaines', pied: 'Échéances de la semaine', jours: 7 },
  mois: { libelle: 'Mois', pied: 'Échéances du mois', jours: 30.44 },
  trimestre: { libelle: 'Trimestres', pied: 'Échéances du trimestre', jours: 91.31 },
  annee: { libelle: 'Année', pied: 'Échéances de l’année', jours: 365.25 },
} as const;
export type UniteFrise = keyof typeof UNITES_FRISE;
export const estUniteFrise = (v: string): v is UniteFrise => v in UNITES_FRISE;

/** Premier jour (minuit UTC) de l'unité qui contient `n`. */
export function debutUnite(n: number, unite: UniteFrise): number {
  const d = new Date(n),
    a = d.getUTCFullYear(),
    m = d.getUTCMonth();
  if (unite === 'semaine') return lundi(Math.floor(n / JOUR) * JOUR);
  if (unite === 'mois') return Date.UTC(a, m, 1);
  if (unite === 'trimestre') return Date.UTC(a, m - (m % 3), 1);
  return Date.UTC(a, 0, 1);
}
/** Premier jour de l'unité suivante (vraies longueurs des mois et des années). */
export function uniteSuivante(n: number, unite: UniteFrise): number {
  if (unite === 'semaine') return n + 7 * JOUR;
  const d = new Date(n);
  const pas = unite === 'mois' ? 1 : unite === 'trimestre' ? 3 : 12;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + pas, 1);
}

export interface ColonneFrise {
  debut: number;
  /** Fin exclue. */
  fin: number;
  libelle: string;
  court: string;
}
const moisCourt = (n: number) => new Date(n).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' });
const deuxChiffres = (n: number) => String(n).padStart(2, '0');
function libelleColonne(n: number, unite: UniteFrise): Pick<ColonneFrise, 'libelle' | 'court'> {
  const d = new Date(n),
    annee = d.getUTCFullYear(),
    aa = deuxChiffres(annee % 100);
  if (unite === 'semaine')
    return {
      libelle: `S${numeroSemaine(n)} · ${deuxChiffres(d.getUTCDate())}/${deuxChiffres(d.getUTCMonth() + 1)}`,
      court: `S${numeroSemaine(n)}`,
    };
  if (unite === 'mois') return { libelle: `${moisCourt(n)} ${aa}`, court: moisCourt(n) };
  if (unite === 'trimestre') {
    const t = Math.floor(d.getUTCMonth() / 3) + 1;
    return { libelle: `T${t} ${annee}`, court: `T${t} ${aa}` };
  }
  return { libelle: String(annee), court: String(annee) };
}

/* ---------- Action qui n'a qu'une échéance : tube depuis la création de sa fiche ---------- */

/** Décision du RSSI du 20/11/2026 (proposition B) : une action hors série qui n'a qu'une échéance se dessine en tube depuis
    la création de sa fiche (`createdAt`), si cette création ne suit pas l'échéance. Renvoie ce jour de création, ou null :
    occurrence de série ou tâche récurrente historique (carré), date de début présente (tube ordinaire), création
    postérieure à l'échéance ou illisible (losange « Échéance seule »). Rien n'est écrit dans la fiche. */
export function debutDepuisCreation(objet: GrcObject): number | null {
  const d = objet.data;
  const serie =
    (typeof d.seriesId === 'string' && d.seriesId !== '') ||
    (typeof d.occurrenceKey === 'string' && d.occurrenceKey !== '') ||
    d.legacyRecurring === true;
  if (serie || (typeof d.startAt === 'string' && d.startAt) || typeof d.dueAt !== 'string' || !d.dueAt) return null;
  const echeance = jourDe(d.dueAt),
    creation = typeof objet.createdAt === 'string' ? jourDe(objet.createdAt) : Number.NaN;
  return Number.isFinite(creation) && Number.isFinite(echeance) && creation <= echeance ? creation : null;
}
export interface PlaceeDessinee {
  objet: GrcObject;
  /** Début dessiné : date de début, ou jour de création pour une action qui n'a qu'une échéance (proposition B). */
  de: number;
  a: number;
  /** Jour de création utilisé comme début, ou null. */
  creation: number | null;
}
/** Actions placées par `calculerFrise`, avec leur début dessiné (création pour une action qui n'a qu'une échéance). */
export function placerActions(placees: Frise['placees']): PlaceeDessinee[] {
  return placees.map((p) => {
    const creation = p.de === p.a ? debutDepuisCreation(p.objet) : null;
    return { ...p, de: creation ?? p.de, creation };
  });
}

export interface PeriodeFrise {
  /** Premier jour affiché et fin exclue, alignés sur l'échelle. */
  debut: number;
  fin: number;
  colonnes: ColonneFrise[];
}
/** Période affichée de la frise des actions : celle de `calculerFrise` (dates placées et aujourd'hui, bornée à deux ans),
    sans sa marge d'une semaine, étendue aux débuts dessinés plus anciens (création d'une action qui n'a qu'une
    échéance, toujours dans la limite de deux ans) et aux bornes de l'échelle choisie. Aucune action n'est déplacée. */
export function periodeFrise(
  frise: Pick<Frise, 'debut' | 'jours' | 'tronquee'>,
  unite: UniteFrise,
  debuts: readonly number[] = [],
): PeriodeFrise {
  const finFrise = frise.debut + (frise.jours - 1) * JOUR;
  const premier = Math.max(
      finFrise - 730 * JOUR,
      Math.min(frise.debut + 7 * JOUR, ...debuts.filter((n) => Number.isFinite(n))),
    ),
    dernier = Math.max(premier, frise.tronquee ? finFrise : finFrise - 7 * JOUR);
  const debut = debutUnite(premier, unite),
    fin = uniteSuivante(debutUnite(dernier, unite), unite);
  const colonnes: ColonneFrise[] = [];
  for (let n = debut; n < fin; n = uniteSuivante(n, unite))
    colonnes.push({ debut: n, fin: uniteSuivante(n, unite), ...libelleColonne(n, unite) });
  return { debut, fin, colonnes };
}

/** Nombre de dates (échéances, occurrences) dans chaque colonne ; une date hors des colonnes n'est pas comptée. */
export function compterParColonne(colonnes: readonly Pick<ColonneFrise, 'debut' | 'fin'>[], dates: number[]): number[] {
  return colonnes.map((c) => dates.filter((d) => Number.isFinite(d) && d >= c.debut && d < c.fin).length);
}

/* ---------- Regroupements de la frise des actions ---------- */

export const CRITERES_GROUPE = {
  priorite: 'Priorité',
  responsable: 'Responsable',
  etat: 'État',
  aucun: 'Aucun',
} as const;
export type CritereGroupe = keyof typeof CRITERES_GROUPE;
export const estCritereGroupe = (v: string): v is CritereGroupe => v in CRITERES_GROUPE;

const PRIORITES: { id: string; libelle: string }[] = [
  { id: 'urgent', libelle: 'Priorité urgente' },
  { id: 'high', libelle: 'Priorité haute' },
  { id: 'normal', libelle: 'Priorité normale' },
  { id: 'low', libelle: 'Priorité basse' },
];

export interface GroupeFrise<T> {
  cle: string;
  libelle: string;
  lignes: T[];
}
/** Regroupe les lignes (dans leur ordre) par priorité (urgente, haute, normale, basse), responsable (ordre alphabétique,
    « Non attribué » en dernier), état (ordre de la politique) ou en un seul groupe sans en-tête (« Aucun »). Une valeur
    inconnue garde son propre groupe, après les valeurs connues : rien n'est écarté. */
export function grouperActions<T>(
  lignes: readonly T[],
  critere: CritereGroupe,
  {
    objet,
    policy,
    responsable,
  }: { objet: (l: T) => GrcObject; policy: BusinessPolicy; responsable: (o: GrcObject) => string },
): GroupeFrise<T>[] {
  if (critere === 'aucun') return lignes.length ? [{ cle: 'tout', libelle: '', lignes: [...lignes] }] : [];
  const groupes = new Map<string, GroupeFrise<T> & { rang: number }>();
  for (const l of lignes) {
    const o = objet(l);
    let cle: string, libelle: string, rang: number;
    if (critere === 'priorite') {
      const brute = typeof o.data.priority === 'string' ? o.data.priority : '';
      const i = PRIORITES.findIndex((p) => p.id === brute);
      cle = brute || 'sans';
      libelle = i >= 0 ? PRIORITES[i]!.libelle : brute ? `Priorité ${brute}` : 'Priorité non renseignée';
      rang = i >= 0 ? i : PRIORITES.length;
    } else if (critere === 'etat') {
      const id = String(o.data.status ?? '');
      const i = policy.statuses.findIndex((s) => s.id === id);
      cle = id;
      libelle = i >= 0 ? policy.statuses[i]!.label : id === 'done' ? 'Terminée (historique)' : 'État historique';
      rang = i >= 0 ? i : policy.statuses.length;
    } else {
      libelle = responsable(o);
      cle = libelle;
      rang = sansResponsable(o) ? 1 : 0;
    }
    const g = groupes.get(cle) ?? { cle, libelle, lignes: [], rang };
    g.lignes.push(l);
    groupes.set(cle, g);
  }
  return [...groupes.values()]
    .sort((a, b) => a.rang - b.rang || a.libelle.localeCompare(b.libelle, 'fr'))
    .map(({ cle, libelle, lignes }) => ({ cle, libelle, lignes }));
}

/** Vrai si la fiche n'a aucun responsable désigné (ni personne, ni groupe, ni fonction). */
export function sansResponsable(o: GrcObject): boolean {
  const r: unknown = o.data.responsable;
  return !(r && typeof r === 'object') && typeof o.data.ownerId !== 'string';
}

/** Initiales d'un responsable : premières lettres du premier et du dernier mot, ou deux lettres d'un mot seul. Pour un
    groupe ou une fonction, celles de son libellé (« Groupe Équipe réseau » donne « ÉR »). */
export function initiales(libelle: string): string {
  const nom = libelle.replace(/^(Groupe|Fonction)\s+/u, '').trim();
  const mots = nom
    .split(/[\s'’-]+/u)
    .map((m) => Array.from(m).filter((c) => /[\p{L}\p{N}]/u.test(c)))
    .filter((m) => m.length > 0);
  if (!mots.length) return '';
  const premier = mots[0]!,
    dernier = mots[mots.length - 1]!;
  return (mots.length === 1 ? premier.slice(0, 2).join('') : premier[0]! + dernier[0]!).toLocaleUpperCase('fr-FR');
}

/** Date courte : jj/mm, suivie de l'année sur deux chiffres si elle diffère de `annee`. */
export function dateCourte(n: number, annee: number): string {
  const d = new Date(n);
  const jm = `${deuxChiffres(d.getUTCDate())}/${deuxChiffres(d.getUTCMonth() + 1)}`;
  return d.getUTCFullYear() === annee ? jm : `${jm}/${deuxChiffres(d.getUTCFullYear() % 100)}`;
}

/* ---------- Tâches d'une action (ADR 0111) ---------- */

export type EtatTacheAction = 'afaire' | 'faite' | 'retard';
export interface RepereTache {
  tache: TacheAction;
  /** Jour de l'échéance (minuit UTC). */
  jour: number;
  etat: EtatTacheAction;
}
/** Tâches de l'action lisibles dans ses données (tableau absent ou mal formé : aucune). */
export function tachesDe(o: GrcObject): TacheAction[] {
  const t = o.data.taches;
  return Array.isArray(t) ? (t as TacheAction[]).filter((x) => x && typeof x === 'object') : [];
}
/** Repères des tâches datées, dans l'ordre des échéances : faite, en retard (échéance passée, avant aujourd'hui, et non
    faite) ou à faire. Une tâche sans échéance ou à la date illisible n'a pas de repère : rien n'est inventé. */
export function reperesTaches(taches: readonly TacheAction[], aujourdhui: number): RepereTache[] {
  const jourAuj = Math.floor(aujourdhui / JOUR) * JOUR;
  return taches
    .map((tache) => ({
      tache,
      jour: typeof tache.echeance === 'string' ? Date.parse(tache.echeance + 'T00:00:00Z') : Number.NaN,
    }))
    .filter((r) => Number.isFinite(r.jour))
    .map((r) => ({ ...r, etat: (r.tache.faite ? 'faite' : r.jour < jourAuj ? 'retard' : 'afaire') as EtatTacheAction }))
    .sort((a, b) => a.jour - b.jour);
}
