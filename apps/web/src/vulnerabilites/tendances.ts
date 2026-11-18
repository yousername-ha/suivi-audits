/* Tendances et rapport de pilotage (ADR 0100, lot S2) : présentation sans état ni appel réseau (testée à part). Le serveur
   prend les instantanés et compose le rapport ; l'écran met en forme les séries, les tableaux et les adresses. Chaque série a
   sa teinte, sa forme de marque, son trait et son libellé (jamais la couleur seule) et son équivalent en tableau. */
import {
  type CleMesure,
  fmtJour,
  type Granularite,
  type IdPerimetreVue,
  MESURE_LIBELLES,
  NIVEAU_ALERTE_GLOBAL_LIBELLES,
  type NiveauAlerteGlobal,
  PERIMETRE_AUCUN,
  PERIODE_TENDANCES_LIBELLES,
  PERIODES_TENDANCES,
  type PointJourDto,
  type PointSemaineDto,
  type SensTendance,
  type TendancesDto,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';

export const CLE_TENDANCES = ['vulnerabilites', 'tendances'] as const;
export const ADRESSE_TENDANCES = '/vulnerabilites/tendances';
export const ADRESSE_RAPPORT = '/vulnerabilites/rapport';
/** Valeur du choix « Toute la plateforme » (aucun paramètre envoyé). */
export const PORTEE_TOUT = 'tout';

export function urlTendances(periode: number, perimetre: string): string {
  const q = new URLSearchParams({ periode: String(periode) });
  if (perimetre !== PORTEE_TOUT) q.set('perimetre', perimetre);
  return `/api/vulnerabilites/tendances?${q}`;
}
export const OPTIONS_PERIODE_TENDANCES = PERIODES_TENDANCES.map((p) => ({
  value: String(p),
  label: PERIODE_TENDANCES_LIBELLES[p],
}));
/** Choix de la portée : toute la plateforme, les périmètres lus, « sans périmètre » avec le droit d'administrer. */
export function optionsPortee(
  v: Pick<TendancesDto, 'perimetres' | 'sansPerimetre'>,
): { value: string; label: string }[] {
  return [
    { value: PORTEE_TOUT, label: 'Toute la plateforme' },
    ...v.perimetres.map((p) => ({ value: p.id, label: p.nom })),
    ...(v.sansPerimetre ? [{ value: PERIMETRE_AUCUN, label: 'Sans périmètre' }] : []),
  ];
}

/** Sens de la puce de la tendance (le libellé porte le sens) et flèche en texte. */
export const TENDANCE_PUCE: Record<SensTendance, Etat> = {
  amelioration: 'succes',
  degradation: 'erreur',
  stable: 'info',
  indeterminee: 'neutre',
};
export const TENDANCE_FLECHE: Record<SensTendance, string> = {
  amelioration: '↘',
  degradation: '↗',
  stable: '→',
  indeterminee: '·',
};

/** Un point de la courbe, jour ou semaine, mis à plat. */
export interface PointTendance {
  etiquette: string;
  etiquetteLongue: string;
  niveau: NiveauAlerteGlobal | null;
  mesures: Partial<Record<CleMesure, number | null>> | null;
  corrigees: number | null;
}
export function pointsAffiches(v: Pick<TendancesDto, 'granularite' | 'jours' | 'semaines'>): PointTendance[] {
  if (v.granularite === 'jour')
    return v.jours.map((p: PointJourDto) => ({
      etiquette: fmtJour(p.jour).slice(0, 5),
      etiquetteLongue: fmtJour(p.jour),
      niveau: p.niveau,
      mesures: p.mesures,
      corrigees: p.corrigees,
    }));
  return v.semaines.map((s: PointSemaineDto) => ({
    etiquette: fmtJour(s.debut).slice(0, 5),
    etiquetteLongue: `semaine du ${fmtJour(s.debut)} au ${fmtJour(s.fin)}`,
    niveau: s.niveauMax,
    mesures: s.mesures,
    corrigees: s.corrigees,
  }));
}

/** Une série : son libellé, sa classe de teinte et ses valeurs (null : aucune mesure). */
export interface SerieTendance {
  cle: string;
  libelle: string;
  classe: string;
  valeurs: (number | null)[];
}
const valeur = (p: PointTendance, c: CleMesure) => (p.mesures ? (p.mesures[c] ?? null) : null);
export function seriesPriorites(points: readonly PointTendance[]): SerieTendance[] {
  return (['p1', 'p2', 'p3', 'p4'] as const).map((c) => ({
    cle: c,
    libelle: MESURE_LIBELLES[c],
    classe: `vt-serie--${c}`,
    valeurs: points.map((p) => valeur(p, c)),
  }));
}
export function seriesSuivi(points: readonly PointTendance[], granularite: Granularite): SerieTendance[] {
  return [
    ...(['exploitees', 'depassements', 'exceptions'] as const).map((c) => ({
      cle: c,
      libelle: MESURE_LIBELLES[c],
      classe: `vt-serie--${c}`,
      valeurs: points.map((p) => valeur(p, c)),
    })),
    {
      cle: 'corrigees',
      libelle: granularite === 'jour' ? 'Failles corrigées dans la journée' : 'Failles corrigées dans la semaine',
      classe: 'vt-serie--corrigees',
      valeurs: points.map((p) => p.corrigees),
    },
  ];
}
export function serieNiveau(points: readonly PointTendance[], granularite: Granularite): SerieTendance[] {
  return [
    {
      cle: 'niveau',
      libelle: granularite === 'jour' ? 'Niveau d’alerte' : 'Niveau d’alerte le plus haut de la semaine',
      classe: 'vt-serie--niveau',
      valeurs: points.map((p) => p.niveau),
    },
  ];
}
export function seriesParc(points: readonly PointTendance[]): SerieTendance[] {
  return (['machines', 'actifs'] as const).map((c) => ({
    cle: c,
    libelle: MESURE_LIBELLES[c],
    classe: `vt-serie--${c}`,
    valeurs: points.map((p) => valeur(p, c)),
  }));
}
/** Cellule d'un tableau de tendance : la valeur, ou « — » sans mesure. */
export const cellule = (v: number | null) => (v === null ? '—' : String(v));
export const libelleNiveau = (n: NiveauAlerteGlobal | null) =>
  n === null ? '—' : `${n} (${NIVEAU_ALERTE_GLOBAL_LIBELLES[n]})`;

/* ------------------------------------------------------------------ Rapport */
export type ModePeriode = 'mois' | 'libre';
/** Jour civil du fuseau de l'organisation (AAAA-MM-JJ), comme le serveur. */
export const aujourdhui = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
/** Les vingt-quatre derniers mois, du plus récent au plus ancien (AAAA-MM et libellé « novembre 2026 »). */
export function moisProposes(aujourdhui: string, nombre = 24): { value: string; label: string }[] {
  const [a, m] = aujourdhui.split('-').map(Number) as [number, number];
  return Array.from({ length: nombre }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    const value = d.toISOString().slice(0, 7);
    return { value, label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  });
}
export function urlRapport(
  q: { mode: ModePeriode; mois: string; du: string; au: string; perimetre: string },
  format: 'json' | 'csv',
): string {
  const p = new URLSearchParams();
  if (q.mode === 'mois') p.set('mois', q.mois);
  else {
    p.set('du', q.du);
    p.set('au', q.au);
  }
  if (q.perimetre !== PORTEE_TOUT) p.set('perimetre', q.perimetre as IdPerimetreVue);
  p.set('format', format);
  return `/api/vulnerabilites/rapport?${p}`;
}
