/* Onde en fond de panneau (OndeMenu) : géométrie en fonctions pures (testées), sans accès au DOM ni au canevas.
   Grille en perspective qui ondule et avance vers l'observateur, onde sonore lumineuse posée sur l'horizon (crêtes
   au-dessus, traits fins en dessous) et quelques particules qui montent. Teintes : variables de la charte (PALETTE_ONDE). */
import type { Teinte } from '../connexion/fond-geometrie';

/** Hauteur de l'horizon (part de la hauteur : entre l'accroche et le formulaire), avance de la grille (rangées/s), profondeur visible (rangées). */
export const HORIZON = 0.35;
export const AVANCE = 0.35;
export const PROFONDEUR = 12;
/** Profondeur la plus proche dessinée (en deçà, la rangée sort par le bas). */
export const PROCHE = 0.6;
/** Écart latéral des fuyantes (px au premier plan), focale, amplitude de l'ondulation (px au premier plan). */
export const PAS_FUYANTES = 64;
export const AMPLITUDE_SOL = 10;
/** Onde : nombre d'échantillons et hauteur maximale des crêtes (part de la hauteur). */
export const ECHANTILLONS = 72;
export const CRETE_MAX = 0.12;
/** Les traits du dessous reflètent les crêtes à cette échelle. */
export const REFLET = 0.55;
export const NB_PARTICULES = 14;

const lisse = (x: number) => x - Math.floor(x);
const hasard = (n: number) => lisse(Math.sin(n * 91.7 + 47.3) * 24634.6345);

export interface Point {
  x: number;
  y: number;
}
export interface Trace {
  points: Point[];
  /** Opacité relative (1 au premier plan, vers 0 à l'horizon). */
  opacite: number;
}

/** Ondulation verticale du sol (px au premier plan) en un point du monde (X latéral, Z profondeur absolue). */
export const ondulation = (X: number, Z: number, t: number) =>
  AMPLITUDE_SOL * Math.sin(X * 0.012 + t * 0.9) * Math.cos(Z * 0.8 - t * 0.6);

/** Projection d'un point du sol (X latéral au premier plan, z profondeur relative > 0) sur le panneau, sous l'horizon
    donné en part de la hauteur. */
export function projeter(X: number, z: number, Z: number, t: number, l: number, h: number, horizon = HORIZON): Point {
  const y0 = h * horizon;
  return { x: l / 2 + X / z, y: y0 + (h - y0) / z + ondulation(X, Z, t) / z };
}

/** Grille en perspective : rangées (parallèles à l'horizon) qui avancent, puis fuyantes vers le centre de l'horizon. */
export function grillePerspective(
  t: number,
  l: number,
  h: number,
  horizon = HORIZON,
): { rangees: Trace[]; fuyantes: Trace[] } {
  const phase = lisse(t * AVANCE);
  const rangees: Trace[] = [];
  for (let k = 0; k <= PROFONDEUR; k++) {
    const z = k + 1 - phase;
    if (z < PROCHE) continue;
    const Z = k + Math.floor(t * AVANCE);
    // Abscisses régulières à l'écran : X choisi pour que la projection tombe sur s/24 de la largeur.
    const points = Array.from({ length: 25 }, (_, s) => projeter(((s / 24) * l - l / 2) * z, z, Z, t, l, h, horizon));
    rangees.push({ points, opacite: Math.max(0, 1 - z / (PROFONDEUR + 1)) });
  }
  const demi = Math.ceil((l / 2 / PAS_FUYANTES) * 1.6);
  const fuyantes: Trace[] = [];
  for (let j = -demi; j <= demi; j++) {
    const X = j * PAS_FUYANTES;
    const points = Array.from({ length: 17 }, (_, s) => {
      const z = PROCHE * ((PROFONDEUR + 1) / PROCHE) ** (s / 16);
      return projeter(X, z, z + t * AVANCE, t, l, h, horizon);
    });
    fuyantes.push({ points, opacite: Math.max(0.25, 1 - Math.abs(j) / (demi + 1)) });
  }
  return { rangees, fuyantes };
}

/** Hauteur de l'onde sonore (px) à l'abscisse x : enveloppe nulle aux bords, deux sinusoïdes qui glissent. */
export function hauteurOnde(x: number, t: number, l: number, h: number): number {
  const u = Math.min(1, Math.max(0, x / Math.max(l, 1)));
  const enveloppe = Math.sin(Math.PI * u) ** 1.5;
  const signal = Math.abs(0.6 * Math.sin(u * 19 + t * 2.1) + 0.4 * Math.sin(u * 47 - t * 3.3));
  const souffle = 0.65 + 0.35 * Math.sin(t * 0.9 + u * 4);
  return h * CRETE_MAX * enveloppe * signal * souffle;
}

/** Onde sur l'horizon : crêtes (ligne au-dessus) et traits fins verticaux en dessous (reflet atténué). */
export function ondeHorizon(
  t: number,
  l: number,
  h: number,
): { cretes: Point[]; traits: { x: number; y1: number; y2: number }[] } {
  const y0 = h * HORIZON;
  const cretes: Point[] = [];
  const traits: { x: number; y1: number; y2: number }[] = [];
  for (let i = 0; i < ECHANTILLONS; i++) {
    const x = (i / (ECHANTILLONS - 1)) * l;
    const a = hauteurOnde(x, t, l, h);
    cretes.push({ x, y: y0 - a });
    traits.push({ x, y1: y0 + 1, y2: y0 + 1 + a * REFLET });
  }
  return { cretes, traits };
}

/* ---------------------------------------------------------------- Variante de l'écran de connexion
   Onde signée (au-dessus et en dessous de la ligne centrale), placée à mi-chemin entre le titre et la première carte. */

/** Disposition mesurée sur le panneau : horizon et espace libre entre le titre et la première carte, en part de la hauteur. */
export interface DispositionConnexion {
  horizon: number;
  ecart: number;
}
const borne = (x: number) => Math.min(1, Math.max(0, x));
/** Horizon à mi-chemin entre le bas du titre et le haut de la première carte (positions en px dans la page). */
export function dispositionConnexion(
  panneau: { top: number; height: number },
  basTitre: number,
  hautCarte: number,
): DispositionConnexion {
  const h = Math.max(panneau.height, 1);
  return {
    horizon: borne(((basTitre + hautCarte) / 2 - panneau.top) / h),
    ecart: borne((hautCarte - basTitre) / h),
  };
}

/** Signal signé dans [−1 ; 1], nul aux bords (u de 0 à 1, t en secondes). */
export function signalOnde(u: number, t: number): number {
  const v = borne(u);
  const enveloppe = Math.sin(Math.PI * v) ** 1.4;
  const souffle = 0.65 + 0.35 * Math.sin(0.9 * t + 4 * v);
  const porteuse =
    0.5 * Math.sin(23 * v + 2.1 * t) + 0.3 * Math.sin(51 * v - 3.3 * t) + 0.2 * Math.sin(9 * v + 0.7 * t);
  return enveloppe * souffle * porteuse;
}
/** Compression douce des grandes crêtes. */
export const compresser = (z: number) => z / (1 + 0.4 * Math.abs(z));

/** Amplitude (px) : 7,5 % de la hauteur, au plus la moitié de l'espace entre le titre et la première carte. */
export const AMPLITUDE_CONNEXION = 0.075;
export const amplitudeConnexion = (h: number, ecart: number) => Math.min(h * AMPLITUDE_CONNEXION, (h * ecart) / 2);

/** Pas des traits verticaux (px), leur part de l'amplitude et leur décalage de phase (s). */
export const PAS_TRAITS = 4;
export const PART_TRAITS = 0.75;
export const DECALAGE_TRAITS = 0.35;
/** Onde signée : signal (un point tous les PAS_TRAITS px), traits verticaux signés et ligne centrale (y0). */
export function ondeSignee(
  t: number,
  l: number,
  h: number,
  d: DispositionConnexion,
): { y0: number; signal: Point[]; traits: { x: number; y1: number; y2: number }[] } {
  const y0 = h * d.horizon;
  const a = amplitudeConnexion(h, d.ecart);
  const n = Math.max(2, Math.ceil(l / PAS_TRAITS) + 1);
  const signal: Point[] = [];
  const traits: { x: number; y1: number; y2: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.min(l, i * PAS_TRAITS);
    const u = x / Math.max(l, 1);
    signal.push({ x, y: y0 - a * compresser(signalOnde(u, t)) });
    traits.push({ x, y1: y0, y2: y0 - a * PART_TRAITS * compresser(signalOnde(u, t - DECALAGE_TRAITS)) });
  }
  return { y0, signal, traits };
}

/** Teintes de l'onde de connexion : dégradé conformité (bords) / risques (centre). */
export const PALETTE_CONNEXION = {
  bord: '--suivi-famille-conformite',
  centre: '--suivi-famille-risques',
  surface: 0.22,
  traits: 0.3,
  ligne: 0.4,
  onde: 0.95,
  epaisseur: 2.4,
  flou: 18,
} as const;

export interface Particule {
  x: number;
  y: number;
  r: number;
  opacite: number;
}
/** Particules qui montent du bas vers le haut du panneau et s'effacent en approchant du haut. */
export function particules(t: number, l: number, h: number): Particule[] {
  return Array.from({ length: NB_PARTICULES }, (_, i) => {
    const vitesse = 10 + hasard(i + 3) * 18;
    const course = h * 0.9;
    const progres = lisse((t * vitesse + hasard(i + 5) * course) / course);
    return {
      x: hasard(i + 1) * l + Math.sin(t * 0.7 + i) * 6,
      y: h - progres * course,
      r: 0.8 + hasard(i + 9) * 1.4,
      opacite: 1 - progres,
    };
  });
}

/** Teintes de la charte, à faible opacité (le panneau reste lisible). */
export const PALETTE_ONDE = {
  grille: ['--suivi-turquoise-nav', 0.16],
  crete: ['--suivi-famille-conformite', 0.55],
  lueur: ['--suivi-famille-conformite', 0.12],
  trait: ['--suivi-famille-risques', 0.35],
  particule: ['--suivi-nav-repere', 0.5],
} as const satisfies Record<string, Teinte>;

/** Onde dessinée seulement en mouvement libre : rien sous automate, à l'impression ou si moins de mouvement est demandé. */
export const ondeVisible = (env: { webdriver: boolean; impression: boolean; mouvementReduit: boolean }) =>
  !env.webdriver && !env.impression && !env.mouvementReduit;
