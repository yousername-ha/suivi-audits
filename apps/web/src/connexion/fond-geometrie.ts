/* Fond animé de l'écran de connexion : géométrie en fonctions pures (testées), sans accès au DOM ni au canevas.
   Grille large qui défile, barres larges espacées, halos, deux courbes en pointillés et une courbe principale montante
   dont certains nœuds, cerclés, émettent une onde. Les teintes sont des noms de variables de la charte (palettes). */

/** Vitesse de défilement (px/s), pas de la grille (px), écart des barres (px), cadence (images/s). */
export const VITESSE = 16;
export const PAS_GRILLE = 112;
export const ECART_BARRES = 125;
export const LARGEUR_BARRE = 48;
export const IMAGES_PAR_SECONDE = 30;
/** Instant dessiné en image fixe (moins de mouvement demandé). */
export const INSTANT_FIXE = 12;
export const NB_HALOS = 14;
export const LIBELLES = ['ISO 27001', 'HDS', 'NIS 2', 'RGPD', 'ISO 9001', 'EBIOS RM'] as const;

/** Pseudo-aléatoire déterministe dans [0, 1[. */
export function hasard(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
/** Bruit lissé dans [0, 1] (interpolation de deux tirages voisins). */
export function bruit(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hasard(i) * (1 - u) + hasard(i + 1) * u;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
/** Grille : verticales décalées du défilement, horizontales fixes à mi-pas. */
export function lignesGrille(t: number, l: number, h: number, pas = PAS_GRILLE): Segment[] {
  const decalage = (t * VITESSE) % pas;
  const lignes: Segment[] = [];
  for (let x = -decalage; x < l; x += pas) {
    const xa = Math.round(x) + 0.5;
    lignes.push({ x1: xa, y1: 0, x2: xa, y2: h });
  }
  for (let y = pas / 2; y < h; y += pas) {
    const ya = Math.round(y) + 0.5;
    lignes.push({ x1: 0, y1: ya, x2: l, y2: ya });
  }
  return lignes;
}

export interface Barre {
  x: number;
  y: number;
  l: number;
  h: number;
}
/** Barres larges (48 px pour un pas de 125 px), plus hautes vers la droite ; environ une sur cinq manque.
    Défilement à mi-vitesse ; chaque barre reste centrée au même endroit du pas. */
export function barres(t: number, l: number, h: number): Barre[] {
  const ob = t * VITESSE * 0.5;
  const premier = Math.floor(ob / ECART_BARRES);
  const liste: Barre[] = [];
  for (let i = -1; i < Math.ceil(l / ECART_BARRES) + 2; i++) {
    const idx = i + premier;
    if (hasard(idx + 300) < 0.22) continue;
    const x = i * ECART_BARRES - (ob % ECART_BARRES);
    const hb = h * (0.12 + 0.4 * Math.max(0, x / Math.max(l, 1)) + 0.1 * bruit(idx * 0.7 + t * 0.15));
    liste.push({ x: x + 63 - LARGEUR_BARRE / 2, y: h - hb, l: LARGEUR_BARRE, h: hb });
  }
  return liste;
}

export interface Halo {
  x: number;
  y: number;
  r: number;
}
/** Halos flous qui dérivent lentement vers la droite et vers le haut. */
export function halos(t: number, l: number, h: number): Halo[] {
  return Array.from({ length: NB_HALOS }, (_, i) => {
    const r = 10 + hasard(i + 94) * 26;
    const x = ((hasard(i + 90) * (l + 80) + t * 8 * (0.5 + hasard(i + 91))) % (l + 80)) - 40;
    const y = h * (0.1 + 0.85 * hasard(i + 92)) - ((t * 5 * (0.3 + hasard(i + 93))) % (h * 0.3));
    return { x, y, r };
  });
}

export interface Point {
  /** Rang absolu du nœud (stable pendant le défilement). */
  i: number;
  x: number;
  y: number;
}
/** Écart horizontal entre deux nœuds d'une courbe. */
export const ecartNoeuds = (l: number) => Math.max(90, l / 12);
/** Courbe montante de gauche à droite (74 % à 32 % de la hauteur), bruitée selon la graine et l'amplitude. */
export function courbe(t: number, l: number, h: number, graine: number, amplitude: number): Point[] {
  const s = ecartNoeuds(l);
  const off = t * VITESSE;
  const i0 = Math.floor(off / s) - 1;
  const n = Math.ceil(l / s) + 3;
  return Array.from({ length: n }, (_, k) => {
    const i = i0 + k;
    const x = i * s - off;
    const y =
      h * (0.74 - 0.42 * (x / Math.max(l, 1))) +
      (bruit(i * 0.9 + graine) - 0.5) * h * amplitude +
      (hasard(i + graine) - 0.5) * h * 0.04;
    return { i, x, y };
  });
}
/** Courbe principale puis les deux courbes en pointillés. */
export const courbePrincipale = (t: number, l: number, h: number) => courbe(t, l, h, 0, 0.16);
export const courbesPointillees = (t: number, l: number, h: number) => [
  courbe(t, l, h, 50, 0.22),
  courbe(t, l, h, 120, 0.3),
];

export interface Noeud {
  x: number;
  y: number;
  /** Nœud cerclé : anneau, onde et libellé. */
  cercle: boolean;
  /** Onde : rayon et opacité relative (1 à l'émission, 0 à la fin). */
  onde: { r: number; opacite: number } | null;
  libelle: string | null;
}
/** Nœuds de la courbe principale : environ un sur deux est cerclé et porte un libellé de référentiel. */
export function noeuds(t: number, points: Point[]): Noeud[] {
  return points.map((q) => {
    if (hasard(q.i + 77) <= 0.5) return { x: q.x, y: q.y, cercle: false, onde: null, libelle: null };
    const phase = (t * 0.6 + hasard(q.i)) % 1;
    return {
      x: q.x,
      y: q.y,
      cercle: true,
      onde: { r: 9 + phase * 14, opacite: 1 - phase },
      libelle: LIBELLES[((q.i % LIBELLES.length) + LIBELLES.length) % LIBELLES.length]!,
    };
  });
}

/** Teinte d'un élément : variable de la charte et opacité. */
export type Teinte = readonly [variable: string, opacite: number];
export interface Palette {
  grille: Teinte;
  barre: Teinte;
  halo: Teinte;
  pointille: Teinte;
  lueur: Teinte;
  ombre: Teinte;
  ligne: Teinte;
  anneau: Teinte;
  centre: Teinte;
  onde: Teinte;
  texte: Teinte;
  point: Teinte;
}
const TQ_NAV = '--suivi-turquoise-nav';
const TQ = '--suivi-turquoise';
const NAV_FOND = '--suivi-nav-fond';
const NAV_ACTIVE = '--suivi-nav-active';
/** Sombre : tout en turquoise lumineux. Clair : structure en vert de la navigation, accents en turquoise. */
export const PALETTES: Record<'clair' | 'sombre', Palette> = {
  sombre: {
    grille: [TQ_NAV, 0.04],
    barre: [TQ_NAV, 0.05],
    halo: [TQ_NAV, 0.14],
    pointille: [TQ_NAV, 0.32],
    lueur: [TQ_NAV, 0.08],
    ombre: [TQ_NAV, 0.6],
    ligne: [TQ_NAV, 0.75],
    anneau: [TQ_NAV, 0.85],
    centre: [TQ_NAV, 0.9],
    onde: [TQ_NAV, 0.35],
    texte: [TQ_NAV, 0.45],
    point: [TQ_NAV, 0.7],
  },
  clair: {
    grille: [NAV_FOND, 0.11],
    barre: [NAV_ACTIVE, 0.15],
    halo: [TQ, 0.1],
    pointille: [NAV_ACTIVE, 0.7],
    lueur: [TQ, 0.14],
    ombre: [TQ, 0.3],
    ligne: [NAV_FOND, 0.82],
    anneau: [NAV_FOND, 0.9],
    centre: [TQ, 1],
    onde: [TQ, 0.5],
    texte: [NAV_ACTIVE, 0.8],
    point: [NAV_FOND, 0.75],
  },
};

/** Animation permise : ni automate de test (captures stables), ni impression ; moins de mouvement = image fixe. */
export function modeAnimation(env: { webdriver: boolean; impression: boolean; mouvementReduit: boolean }) {
  if (env.webdriver || env.impression) return 'aucun' as const;
  return env.mouvementReduit ? ('fixe' as const) : ('anime' as const);
}
/** Faut-il dessiner une nouvelle image (cadence plafonnée) ? Tolérance de 2 ms : à 60 Hz, une image sur deux. */
export const imageDue = (maintenant: number, derniere: number, ips = IMAGES_PAR_SECONDE) =>
  maintenant - derniere >= 1000 / ips - 2;
