/* Objectifs et indicateurs (refonte Neon, lot 3) : règles de présentation pures, sans React. Deux lectures distinctes :
   - l'état (atteint, non atteint, non mesuré, cible à définir) vient des fonctions partagées, qui comparent la valeur à la
     cible selon son opérateur (≥, ≤, =) : une baisse vers un maximum reste « Atteint » ;
   - la flèche décrit seulement la variation numérique de la dernière mesure (hausse verte, baisse rouge, stable neutre).
   Aucun état n'est déduit de la flèche, aucune valeur n'est estimée. */
import type { EtatIndicateur, IndicateurObjectif } from '@suivi/shared';

export const LIBELLES_ETAT: Record<EtatIndicateur, string> = {
  ok: 'Atteint',
  ko: 'Non atteint',
  na: 'Non mesuré',
  undef: 'Cible à définir',
};
/** Explication courte sous l'état, dans les blocs des vues Par processus et Par objectif. */
export const EXPLICATIONS_ETAT: Record<EtatIndicateur, string> = {
  ok: 'Seuil respecté',
  ko: 'Écart constaté',
  na: 'Aucune mesure courante',
  undef: 'Renseigner une cible',
};
/** Ordre du plus défavorable au plus favorable : l'état d'un ensemble est le pire de ses indicateurs. */
export const ORDRE_ETATS: readonly EtatIndicateur[] = ['ko', 'undef', 'na', 'ok'];
export const FILTRES_ETAT = [
  ['all', 'Tous'],
  ['ok', 'Atteints'],
  ['ko', 'Non atteints'],
  ['na', 'Non mesurés'],
  ['undef', 'Cible à définir'],
] as const;
export type FiltreEtat = (typeof FILTRES_ETAT)[number][0];

/** État le plus défavorable d'un ensemble d'indicateurs ; absent sans indicateur. */
export function pireEtat(indicateurs: readonly { etat: EtatIndicateur }[]): EtatIndicateur | undefined {
  return ORDRE_ETATS.find((e) => indicateurs.some((i) => i.etat === e));
}

export type SensTendance = 'hausse' | 'baisse' | 'stable';
/** Sens de la flèche, d'après la seule variation numérique ; null sans tendance connue (aucune flèche ajoutée). */
export function sensTendance(t: IndicateurObjectif['tendance']): SensTendance | null {
  return t === '↗' ? 'hausse' : t === '↘' ? 'baisse' : t === '→' ? 'stable' : null;
}
export const LIBELLES_TENDANCE: Record<SensTendance, string> = {
  hausse: 'en hausse',
  baisse: 'en baisse',
  stable: 'stable',
};

/** Nombre d'indicateurs par filtre d'état (raccourcis du registre) ; « Tous » compte chaque ligne affichée. */
export function compterParEtat(indicateurs: readonly { etat: EtatIndicateur }[]): Record<FiltreEtat, number> {
  const compte: Record<FiltreEtat, number> = { all: indicateurs.length, ok: 0, ko: 0, na: 0, undef: 0 };
  for (const i of indicateurs) compte[i.etat]++;
  return compte;
}

/** Date AAAA-MM-JJ affichée JJ/MM/AAAA ; « – » si absente ou illisible. */
export const jour = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');
