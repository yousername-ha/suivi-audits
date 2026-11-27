/* Tâches récurrentes, style « Verre » (dessin TachesTimeline validé par le RSSI le 27/11/2026) : calculs purs des tuiles
   d'en-tête, du total de la Timeline (occurrences par période, récapitulatif) et de la ligne discrète « Résultats du
   mois · OK · KO ». Tout est calculé sur les fiches déjà chargées par la page : aucune occurrence, aucune date ni aucun
   résultat n'est créé ; une donnée absente reste absente (null, « — »). */
import type { BusinessPolicy, GrcObject, StyleInstance } from '@suivi/shared';
import { classeResultat, enRetard, estOccurrence, validationDe } from './etat-action';
import { dateCourte } from './Timeline';
import { jour, type Placement } from './timeline-calendrier';

/** Vue d'ouverture de la page : en style « Verre », les tâches récurrentes et le plan d'actions s'ouvrent sur la Timeline
    (décisions du RSSI du 27/11/2026) ; ailleurs, la vue par défaut de la politique métier du périmètre. La vue choisie
    reste dans l'adresse (« tvue »), prioritaire. */
export function vueParDefaut(style: StyleInstance, defautPolitique: string): string {
  return style === 'verre' ? 'timeline' : defautPolitique;
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/* ---------- Séries ---------- */

interface Recurrence {
  unit?: string;
  interval?: number;
  active?: boolean;
}
const recurrence = (s: GrcObject) => s.data.recurrence as Recurrence | undefined;

/** Séries actives (une série sans réglage lisible n'est pas comptée) et, parmi elles, les mensuelles (tous les mois). */
export function syntheseSeries(series: readonly GrcObject[]): { actives: number; mensuelles: number } {
  const actives = series.filter((s) => {
    const r = recurrence(s);
    return !!r && typeof r.unit === 'string' && r.active !== false;
  });
  return {
    actives: actives.length,
    mensuelles: actives.filter((s) => recurrence(s)?.unit === 'month' && (recurrence(s)?.interval ?? 1) === 1).length,
  };
}

/* ---------- Occurrences ---------- */

export interface SyntheseOccurrences {
  /** Occurrences dont l'échéance est passée, sans résultat enregistré (en retard comprises). */
  attendus: number;
  /** Occurrences en retard (même règle que la Timeline et les compteurs du serveur). */
  retards: number;
  /** Occurrence en retard la plus ancienne : nom de sa série et date courte de son échéance. */
  plusEnRetard: { nom: string; date: string } | null;
  /** Résultats des occurrences dont l'échéance tombe dans l'année. */
  ok: number;
  ko: number;
  /** Tenue des échéances : OK / (OK + KO) en pour cent, arrondi ; null sans aucun résultat OK ni KO dans l'année. */
  tenue: number | null;
  annee: number;
}

/** Synthèse des occurrences chargées : résultats attendus, retards, tenue des échéances sur `annee`. */
export function syntheseOccurrences(
  items: readonly GrcObject[],
  series: readonly GrcObject[],
  policy: BusinessPolicy,
  maintenant: number,
  annee: number,
): SyntheseOccurrences {
  const occurrences = items.filter(estOccurrence);
  const echeance = (o: GrcObject) => (typeof o.data.dueAt === 'string' ? Date.parse(o.data.dueAt) : Number.NaN);
  const attendus = occurrences.filter((o) => {
    const t = echeance(o);
    return Number.isFinite(t) && t < maintenant && !validationDe(o);
  }).length;
  const enRetards = occurrences
    .filter((o) => enRetard(o, policy, maintenant))
    .sort((a, b) => echeance(a) - echeance(b));
  const premier = enRetards[0];
  const nomSerie = (o: GrcObject) => series.find((s) => s.id === o.data.seriesId)?.name ?? o.name;
  const dansAnnee = occurrences.filter((o) => {
    const n = jour(o.data.dueAt);
    return Number.isFinite(n) && new Date(n).getUTCFullYear() === annee;
  });
  const ok = dansAnnee.filter((o) => classeResultat(o) === 'ok').length,
    ko = dansAnnee.filter((o) => classeResultat(o) === 'ko').length;
  return {
    attendus,
    retards: enRetards.length,
    plusEnRetard: premier
      ? { nom: nomSerie(premier), date: dateCourte(jour(premier.data.dueAt), new Date(maintenant).getUTCFullYear()) }
      : null,
    ok,
    ko,
    tenue: ok + ko ? Math.round((ok / (ok + ko)) * 100) : null,
    annee,
  };
}

/** Année affichée par la Timeline : celle du début de période choisi (adresse « tdebut »), sinon l'année en cours. */
export function anneeAffichee(debut: string, maintenant: number): number {
  const n = jour(debut);
  return new Date(Number.isFinite(n) ? n : maintenant).getUTCFullYear();
}

/** Tuiles d'en-tête : titre, valeur affichée, ligne secondaire, ton (couleur du grand chiffre) et texte lu. */
export interface TuileRecurrence {
  cle: string;
  titre: string;
  valeur: string;
  detail: string;
  ton: 'neutre' | 'orange' | 'rouge' | 'vert';
}
export function tuilesRecurrences(
  s: { actives: number; mensuelles: number },
  o: SyntheseOccurrences,
): TuileRecurrence[] {
  return [
    {
      cle: 'series',
      titre: 'Séries actives',
      valeur: String(s.actives),
      detail: s.mensuelles ? `dont ${pluriel(s.mensuelles, 'mensuelle', 'mensuelles')}` : 'aucune mensuelle',
      ton: 'neutre',
    },
    {
      cle: 'attendus',
      titre: 'Résultat attendu',
      valeur: String(o.attendus),
      // « Échues sans résultat » comprend les occurrences en retard (tuile suivante) : le lien est écrit.
      detail: o.retards
        ? `échue${o.attendus > 1 ? 's' : ''} sans résultat, dont ${o.retards} en retard`
        : o.attendus === 1
          ? 'occurrence échue sans résultat'
          : 'occurrences échues sans résultat',
      ton: o.attendus ? 'orange' : 'neutre',
    },
    {
      cle: 'retard',
      titre: 'En retard',
      valeur: String(o.retards),
      detail: o.plusEnRetard ? `${o.plusEnRetard.nom} · ${o.plusEnRetard.date}` : 'aucune échéance dépassée',
      ton: o.retards ? 'rouge' : 'neutre',
    },
    {
      cle: 'tenue',
      titre: 'Tenue des échéances',
      valeur: o.tenue === null ? '—' : `${o.tenue} %`,
      detail:
        o.tenue === null
          ? `aucun résultat OK ou KO en ${o.annee}`
          : `${o.ok} OK sur ${pluriel(o.ok + o.ko, 'résultat', 'résultats')} en ${o.annee}`,
      ton: o.tenue === null ? 'neutre' : 'vert',
    },
  ];
}

/* ---------- Total et résultats par période (Timeline) ---------- */

export interface RecapPeriode {
  total: number;
  faites: number;
  ok: number;
  ko: number;
  na: number;
  retards: number;
  /** Sans résultat et pas en retard : à venir, ou échue sans résultat d'une action close. */
  aVenir: number;
}
/** Récapitulatif des occurrences placées dans la période affichée. */
export function recapPeriode(visibles: readonly Placement[], policy: BusinessPolicy, maintenant: number): RecapPeriode {
  const r: RecapPeriode = { total: visibles.length, faites: 0, ok: 0, ko: 0, na: 0, retards: 0, aVenir: 0 };
  for (const { objet } of visibles) {
    const c = classeResultat(objet);
    if (c !== 'attente') {
      r.faites++;
      r[c]++;
    } else if (enRetard(objet, policy, maintenant)) r.retards++;
    else r.aVenir++;
  }
  return r;
}
/** « 49 sur l'année · 40 faites (36 OK, 3 KO, 1 NA) · 8 à venir ou attendues », « · 1 en retard » s'il y a lieu. */
export function libelleRecap(r: RecapPeriode, surAnnee: boolean): string {
  return [
    `${r.total} sur ${surAnnee ? 'l’année' : 'la période'}`,
    `${pluriel(r.faites, 'faite', 'faites')} (${r.ok} OK, ${r.ko} KO, ${r.na} NA)`,
    `${r.aVenir} à venir ou attendue${r.aVenir > 1 ? 's' : ''}`,
    ...(r.retards ? [`${r.retards} en retard`] : []),
  ].join(' · ');
}

/** Nombre de résultats OK et KO de chaque colonne (échéance dans la colonne). */
export function resultatsParColonne(
  colonnes: readonly { debut: number; fin: number }[],
  visibles: readonly Placement[],
): { ok: number; ko: number }[] {
  return colonnes.map((c) => {
    const dedans = visibles.filter((e) => e.fin >= c.debut && e.fin < c.fin).map((e) => classeResultat(e.objet));
    return { ok: dedans.filter((x) => x === 'ok').length, ko: dedans.filter((x) => x === 'ko').length };
  });
}

/** Filet d'une colonne : longueur verte (OK) et rose (KO), proportionnelles, sur `largeur` ; rien sans résultat. */
export function filetResultats(r: { ok: number; ko: number }, largeur: number): { ok: number; ko: number } {
  const n = r.ok + r.ko;
  return n ? { ok: (r.ok / n) * largeur, ko: (r.ko / n) * largeur } : { ok: 0, ko: 0 };
}

/** Index de la colonne qui contient `n` (aujourd'hui), ou -1. */
export const colonneCourante = (colonnes: readonly { debut: number; fin: number }[], n: number) =>
  colonnes.findIndex((c) => n >= c.debut && n < c.fin);
