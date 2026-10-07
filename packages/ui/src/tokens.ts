/* Jetons de la charte (identité de l'outil historique) : couleurs, rayons, espacements, points de rupture.
   Source unique : le thème Mantine (theme.ts), la feuille statique (styles.css) et les tests de contraste
   s'y réfèrent. Aucune couleur ni aucun espacement ne doit être codé en dur ailleurs. */

/** Couleurs de marque. */
export const BRAND = {
  encre: '#14213D',
  vert: '#0D6B6B',
  violet: '#5A48B5',
  fond: '#EDF1F0',
  surface: '#FFFFFF',
} as const;

type Tuple = readonly [string, string, string, string, string, string, string, string, string, string];

/** Vert (couleur principale) : nuance 8 = vert de marque. */
export const VERT: Tuple = [
  '#e6f4f3',
  '#cde9e7',
  '#9fd3cf',
  '#6dbcb6',
  '#45a8a1',
  '#2c9a93',
  '#1b8f88',
  '#127c76',
  '#0d6b6b',
  '#08595a',
];
/** Encre (textes, en-têtes) : nuance 8 = encre de marque. */
export const ENCRE: Tuple = [
  '#eef1f6',
  '#dce2ec',
  '#b6c2d8',
  '#8ea0c3',
  '#6c83b1',
  '#5672a7',
  '#4a68a3',
  '#3b578f',
  '#14213d',
  '#0b1529',
];
/** Violet (accent) : nuance 7 = violet de marque. */
export const VIOLET: Tuple = [
  '#f2f0fb',
  '#e2def5',
  '#c2b8ea',
  '#a092de',
  '#8371d4',
  '#7060ce',
  '#6553c9',
  '#5a48b5',
  '#4f3fa1',
  '#43358b',
];
/** Gris neutres, assez soutenus pour que le texte secondaire (nuance 6) reste lisible (WCAG AA). */
export const GRIS: Tuple = [
  '#f6f8f8',
  '#edf1f0',
  '#e1e7e6',
  '#cfd8d7',
  '#b4c0bf',
  '#83908f',
  '#56636a',
  '#46525a',
  '#353f46',
  '#252d33',
];
/** Mode sombre (palette « dark » de Mantine) : fond = nuance 7, texte = nuance 0, texte secondaire = nuance 2. */
export const SOMBRE: Tuple = [
  '#e7ecf3',
  '#cdd5e1',
  '#a9b5c8',
  '#7b8aa3',
  '#4e5d78',
  '#36445e',
  '#28354d',
  '#1b2539',
  '#141c2d',
  '#0d1320',
];

/** Fonds de page et de surface, par mode. */
export const FONDS = {
  clair: { page: BRAND.fond, surface: BRAND.surface, texte: BRAND.encre, secondaire: GRIS[6] },
  sombre: { page: SOMBRE[8], surface: SOMBRE[7], texte: SOMBRE[0], secondaire: SOMBRE[2] },
} as const;

/** Rayons : de 6 à 12 px. */
export const RAYONS = { xs: '6px', sm: '8px', md: '10px', lg: '12px', xl: '12px' } as const;

/** Espacements (rem). */
export const ESPACEMENTS = {
  '2xs': '0.25rem',
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
} as const;

/** Points de rupture (largeur de fenêtre) : téléphone < 576, tablette 576 à 1024, bureau 1024 à 1440,
    large 1440 à 1920, très large 1920 à 2560, ultra au-delà de 2560 px. « sm » (768) reste pour les menus. */
export const POINTS_DE_RUPTURE = {
  xs: '36em',
  sm: '48em',
  md: '64em',
  lg: '90em',
  xl: '120em',
  xxl: '160em',
} as const;

export const POLICE =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif';
export const POLICE_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/* ---------------------------------------------------------------- Contraste (WCAG 2.1) */
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const v =
    h.length === 3 ? [...h].map((x) => parseInt(x + x, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(v[0]!) + 0.7152 * lin(v[1]!) + 0.0722 * lin(v[2]!);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Couples texte / fond utilisés par l'interface, avec le seuil WCAG AA attendu (4,5 texte, 3 composants). */
export const COUPLES_CONTRASTE: { nom: string; texte: string; fond: string; seuil: number }[] = [
  { nom: 'texte sur fond de page (clair)', texte: FONDS.clair.texte, fond: FONDS.clair.page, seuil: 4.5 },
  { nom: 'texte sur surface (clair)', texte: FONDS.clair.texte, fond: FONDS.clair.surface, seuil: 4.5 },
  { nom: 'texte secondaire sur surface (clair)', texte: FONDS.clair.secondaire, fond: FONDS.clair.surface, seuil: 4.5 },
  { nom: 'texte secondaire sur fond (clair)', texte: FONDS.clair.secondaire, fond: FONDS.clair.page, seuil: 4.5 },
  { nom: 'bouton principal (clair)', texte: '#FFFFFF', fond: VERT[8], seuil: 4.5 },
  { nom: 'lien vert sur surface (clair)', texte: VERT[8], fond: FONDS.clair.surface, seuil: 4.5 },
  { nom: 'accent violet (clair)', texte: '#FFFFFF', fond: VIOLET[7], seuil: 4.5 },
  { nom: 'puce légère verte (clair)', texte: VERT[8], fond: VERT[0], seuil: 4.5 },
  { nom: 'puce légère violette (clair)', texte: VIOLET[7], fond: VIOLET[0], seuil: 4.5 },
  { nom: 'texte sur fond de page (sombre)', texte: FONDS.sombre.texte, fond: FONDS.sombre.page, seuil: 4.5 },
  { nom: 'texte sur surface (sombre)', texte: FONDS.sombre.texte, fond: FONDS.sombre.surface, seuil: 4.5 },
  {
    nom: 'texte secondaire sur surface (sombre)',
    texte: FONDS.sombre.secondaire,
    fond: FONDS.sombre.surface,
    seuil: 4.5,
  },
  { nom: 'bouton principal (sombre)', texte: '#FFFFFF', fond: VERT[7], seuil: 4.5 },
  { nom: 'lien vert sur surface (sombre)', texte: VERT[3], fond: FONDS.sombre.surface, seuil: 4.5 },
  { nom: 'bordure de champ (clair)', texte: GRIS[5], fond: FONDS.clair.surface, seuil: 3 },
  { nom: 'bordure de champ (sombre)', texte: SOMBRE[3], fond: FONDS.sombre.surface, seuil: 3 },
];
