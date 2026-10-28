/* Jetons de la charte (direction graphique Sauge) : couleurs, rayons, espacements, points de rupture.
   Source unique : le thème Mantine (theme.ts), la feuille statique (styles.css) et les tests de contraste
   s'y réfèrent. Aucune couleur ni aucun espacement ne doit être codé en dur ailleurs. */

/** Couleurs de marque. */
export const BRAND = {
  encre: '#243B34',
  vert: '#245F4C',
  violet: '#5A48B5',
  fond: '#F5F6F2',
  surface: '#FFFFFF',
} as const;

/** Matrice des risques : encre du texte sur les cases claires et fond d'une case sans niveau défini (les couleurs de niveau
    viennent de la méthode publiée, jamais d'ici). */
export const MATRICE = { encre: '#173f34', neutre: '#e5e9e2' } as const;

/** Calque « santé des indicateurs » de la cartographie : liseré de la couleur d'état au bas d'un processus. Le rouge est
    réservé à un indicateur non atteint ; l'orange signale des indicateurs non mesurés ou sans cible. */
export const SANTE = { ok: '#2f8f5b', ko: '#c2312a', mesure: '#d98a1d' } as const;

type Tuple = readonly [string, string, string, string, string, string, string, string, string, string];

/** Vert (couleur principale) : nuance 8 = vert de marque. */
export const VERT: Tuple = [
  '#edf4ef',
  '#dceadf',
  '#bdd6c6',
  '#9abca8',
  '#79a68d',
  '#578b6e',
  '#40775e',
  '#306b53',
  '#245f4c',
  '#194b3b',
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
  '#f8f9f6',
  '#f1f3ee',
  '#e5e9e2',
  '#d5dcd3',
  '#b7c2b8',
  '#819087',
  '#58695f',
  '#46584e',
  '#35473d',
  '#25382d',
];
/** Mode sombre (palette « dark » de Mantine) : fond = nuance 7, texte = nuance 0, texte secondaire = nuance 2. */
export const SOMBRE: Tuple = [
  '#e7eee9',
  '#ced9d1',
  '#acbdb1',
  '#84998b',
  '#50685b',
  '#384f42',
  '#273e32',
  '#1a2f25',
  '#12241c',
  '#0d1b15',
];

/** Fonds de page et de surface, par mode. */
export const FONDS = {
  clair: { page: BRAND.fond, surface: BRAND.surface, texte: BRAND.encre, secondaire: GRIS[6] },
  sombre: { page: SOMBRE[8], surface: SOMBRE[7], texte: SOMBRE[0], secondaire: SOMBRE[2] },
} as const;

/** Cartographie du SMSI (ADR 0013, CARTO-06) : teintes des objets de la carte, en clair et en sombre.
    marine = SMSI ; bleu = interne (processus de réalisation, SI, périmètre) ; violet = externe (parties intéressées,
    fournisseurs, pilotage) ; orange = enjeux ; vert = support ; gris = hors périmètre, indisponible ; rouge = KO.
    Pour chaque teinte : accent (texte, icône, lien), doux (pastille), fond (boîte, bande), trait (bordure). */
export const TEINTES_CARTE = ['marine', 'bleu', 'violet', 'orange', 'vert', 'gris', 'rouge'] as const;
export type TeinteCarte = (typeof TEINTES_CARTE)[number];
interface Teinte {
  accent: string;
  doux: string;
  fond: string;
  trait: string;
}
interface PaletteCarte {
  /** Fond du canevas, surface des boîtes, textes, surbrillance de recherche, texte sur le SMSI. */
  canevas: string;
  boite: string;
  texte: string;
  secondaire: string;
  surbrillance: string;
  surMarine: string;
  surMarineSecondaire: string;
  teintes: Record<TeinteCarte, Teinte>;
}
export const CARTE: { clair: PaletteCarte; sombre: PaletteCarte } = {
  clair: {
    canevas: '#F5F8FC',
    boite: '#FFFFFF',
    texte: '#102445',
    secondaire: '#56657D',
    surbrillance: '#B07A00',
    surMarine: '#FFFFFF',
    surMarineSecondaire: '#C9D7EE',
    teintes: {
      marine: { accent: '#0B2B55', doux: '#E3EAF5', fond: '#0B2B55', trait: '#0B2B55' },
      bleu: { accent: '#1662D6', doux: '#EAF3FF', fond: '#F2F7FF', trait: '#9DBFF2' },
      violet: { accent: '#6A3FD0', doux: '#F1EAFF', fond: '#F8F5FF', trait: '#C9B5F2' },
      orange: { accent: '#A85808', doux: '#FFF1DE', fond: '#FFF9F1', trait: '#E3B27A' },
      vert: { accent: '#18763F', doux: '#E5F6EC', fond: '#F1FAF4', trait: '#A6D9BA' },
      gris: { accent: '#56657D', doux: '#EEF1F5', fond: '#F8F9FB', trait: '#B9C3D0' },
      rouge: { accent: '#C2312A', doux: '#FDECEC', fond: '#FFF6F6', trait: '#EBA9A5' },
    },
  },
  sombre: {
    canevas: '#0F1726',
    boite: '#18233A',
    texte: '#E6ECF5',
    secondaire: '#A9B6CA',
    surbrillance: '#F2C14E',
    surMarine: '#FFFFFF',
    surMarineSecondaire: '#D3DEF2',
    teintes: {
      marine: { accent: '#9DB8E8', doux: '#22355A', fond: '#2B4C80', trait: '#5B7DB5' },
      bleu: { accent: '#7FB0FF', doux: '#1B2E4F', fond: '#16243D', trait: '#3B5D94' },
      violet: { accent: '#B9A2FF', doux: '#2C2550', fond: '#1D1B36', trait: '#5B4C9A' },
      orange: { accent: '#F4B060', doux: '#3A2A14', fond: '#241C14', trait: '#8A6332' },
      vert: { accent: '#6FD69A', doux: '#173A29', fond: '#14261E', trait: '#2F6B4B' },
      gris: { accent: '#A9B6CA', doux: '#253247', fond: '#1A2333', trait: '#4A5870' },
      rouge: { accent: '#FF8F87', doux: '#41201F', fond: '#2A1819', trait: '#8A3E3A' },
    },
  },
};
/** Variables CSS de la carte (--carte-*) pour un mode. */
export function variablesCarte(p: PaletteCarte): Record<string, string> {
  const v: Record<string, string> = {
    '--carte-canevas': p.canevas,
    '--carte-boite': p.boite,
    '--carte-texte': p.texte,
    '--carte-secondaire': p.secondaire,
    '--carte-surbrillance': p.surbrillance,
    '--carte-sur-marine': p.surMarine,
    '--carte-sur-marine-secondaire': p.surMarineSecondaire,
  };
  for (const [k, t] of Object.entries(p.teintes)) for (const [n, c] of Object.entries(t)) v[`--carte-${k}-${n}`] = c;
  return v;
}

/** Tableau de bord « verre et relief » de l'accueil (ADR 0069) : teintes des seuils et des métriques.
    remplissage : barre, arc ou part, toujours cerné du contour, qui porte le contraste de l'élément graphique
    (WCAG 1.4.11) ; texte : chiffre coloré ; doux : fond de pastille ; surface : verre posé sur le fond de page. */
export const TEINTES_SEUIL = ['vert', 'orange', 'rouge', 'violet', 'bleu', 'gris'] as const;
export type TeinteSeuil = (typeof TEINTES_SEUIL)[number];
interface PaletteTableauDeBord {
  remplissage: Record<TeinteSeuil, string>;
  texte: Record<TeinteSeuil, string>;
  doux: Record<TeinteSeuil, string>;
  contour: string;
  surface: string;
}
export const TABLEAU_DE_BORD: { clair: PaletteTableauDeBord; sombre: PaletteTableauDeBord } = {
  clair: {
    remplissage: {
      vert: '#278A58',
      orange: '#EA8A1A',
      rouge: '#D63A30',
      violet: '#6556C2',
      bleu: '#3A66B5',
      gris: '#7A887F',
    },
    texte: {
      vert: '#17633F',
      orange: '#8F4D00',
      rouge: '#9E1F18',
      violet: '#4F3FA1',
      bleu: '#24478A',
      gris: '#46584E',
    },
    doux: {
      vert: '#CBE9D6',
      orange: '#FDE2B9',
      rouge: '#F8CFCB',
      violet: '#DDD8F4',
      bleu: '#D6E0F1',
      gris: '#E0E4DE',
    },
    contour: '#10201A',
    surface: '#F3F6F1',
  },
  sombre: {
    remplissage: {
      vert: '#3FAE74',
      orange: '#E89A3C',
      rouge: '#E5645A',
      violet: '#9A8AE8',
      bleu: '#6F97E0',
      gris: '#8E9B92',
    },
    texte: {
      vert: '#7FD9A6',
      orange: '#F6BD77',
      rouge: '#FF9C93',
      violet: '#C3B8FF',
      bleu: '#A9C4F5',
      gris: '#C3CDC6',
    },
    doux: {
      vert: '#173A29',
      orange: '#3A2A14',
      rouge: '#41201F',
      violet: '#2C2550',
      bleu: '#1B2E4F',
      gris: '#253247',
    },
    contour: '#A9BDB2',
    surface: '#22382D',
  },
};
/** Variables CSS du tableau de bord (--tdb-*) pour un mode. */
export function variablesTableauDeBord(p: PaletteTableauDeBord): Record<string, string> {
  const v: Record<string, string> = { '--tdb-contour': p.contour };
  for (const k of TEINTES_SEUIL) {
    v[`--tdb-${k}-remplissage`] = p.remplissage[k];
    v[`--tdb-${k}-texte`] = p.texte[k];
    v[`--tdb-${k}-doux`] = p.doux[k];
  }
  return v;
}

/** Rayons : de 6 à 12 px, conformément à la charte. */
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
  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif';
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

/** Couleurs d'état de Mantine (rouge, orange, jaune, vert, sarcelle, bleu, violet), assombries pour le contraste WCAG AA
    (l'audit d'accessibilité automatique a relevé 2,1 à 3,9 pour 4,5 attendus avec les nuances par défaut).
    fond : fond plein sous texte blanc ; survol : fond plein survolé ; texte : texte des variantes légère et contour
    sur la teinte de l'état (nuance 6 de Mantine, 10 à 15 % d'opacité) ; teinte : cette nuance 6. */
export const ETATS = {
  red: { fond: '#C92A2A', survol: '#B12525', texte: '#A82424', teinte: '#FA5252' },
  orange: { fond: '#CE440E', survol: '#B53C0C', texte: '#A03E08', teinte: '#FD7E14' },
  yellow: { fond: '#AC5900', survol: '#974E00', texte: '#925500', teinte: '#FAB005' },
  green: { fond: '#29833B', survol: '#247334', texte: '#206D2F', teinte: '#40C057' },
  teal: { fond: '#087F5B', survol: '#077050', texte: '#066A4C', teinte: '#12B886' },
  blue: { fond: '#1971C2', survol: '#1663AB', texte: '#145B9C', teinte: '#228BE6' },
  violet: { fond: '#6741D9', survol: '#5B37C4', texte: '#5A2FB0', teinte: '#7950F2' },
} as const;
export type EtatCouleur = keyof typeof ETATS;

/** Fonds du style global « Clair » (Paramètres > Apparence), posés par `html[data-style='clair']` en mode clair. */
export const STYLE_CLAIR = { page: '#f7f9fb', surfaceDouce: '#f0f4f7' } as const;

/** Couleur obtenue en posant `couleur` à l'opacité `alpha` sur `fond` (variantes légères de Mantine). */
export function melange(couleur: string, alpha: number, fond: string): string {
  const v = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [c, f] = [v(couleur), v(fond)];
  return (
    '#' +
    c
      .map((x, i) =>
        Math.round(x! * alpha + f[i]! * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
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
  ...(
    [
      ['page', STYLE_CLAIR.page],
      ['surface douce', STYLE_CLAIR.surfaceDouce],
    ] as const
  ).flatMap(([nom, fond]) => [
    { nom: `style Clair : texte sur ${nom}`, texte: FONDS.clair.texte, fond, seuil: 4.5 },
    { nom: `style Clair : texte secondaire sur ${nom}`, texte: FONDS.clair.secondaire, fond, seuil: 4.5 },
    { nom: `style Clair : lien vert sur ${nom}`, texte: VERT[8], fond, seuil: 4.5 },
    ...(Object.keys(ETATS) as EtatCouleur[]).map((k) => ({
      nom: `style Clair : état ${k}, texte léger sur ${nom}, teinte 15 %`,
      texte: ETATS[k].texte,
      fond: melange(ETATS[k].teinte, 0.15, fond),
      seuil: 4.5,
    })),
  ]),
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
  ...(Object.keys(ETATS) as EtatCouleur[]).flatMap((k) => [
    { nom: `état ${k} : texte blanc sur fond plein`, texte: '#FFFFFF', fond: ETATS[k].fond, seuil: 4.5 },
    { nom: `état ${k} : texte blanc sur fond plein survolé`, texte: '#FFFFFF', fond: ETATS[k].survol, seuil: 4.5 },
    ...(
      [
        ['page (clair)', FONDS.clair.page],
        ['surface (clair)', FONDS.clair.surface],
      ] as const
    ).flatMap(([nom, fond]) =>
      [0.1, 0.15, 0.3].map((alpha) => ({
        nom: `état ${k} : texte léger sur ${nom}, teinte ${alpha * 100} %`,
        texte: ETATS[k].texte,
        fond: melange(ETATS[k].teinte, alpha, fond),
        seuil: 4.5,
      })),
    ),
  ]),
  { nom: 'onglet actif (sombre)', texte: VERT[2], fond: FONDS.sombre.page, seuil: 4.5 },
  { nom: 'bordure de champ (clair)', texte: GRIS[5], fond: FONDS.clair.surface, seuil: 3 },
  { nom: 'bordure de champ (sombre)', texte: SOMBRE[3], fond: FONDS.sombre.surface, seuil: 3 },
  ...(['clair', 'sombre'] as const).flatMap((m) => {
    const p = CARTE[m];
    return [
      { nom: `carte : texte sur boîte (${m})`, texte: p.texte, fond: p.boite, seuil: 4.5 },
      { nom: `carte : texte secondaire sur boîte (${m})`, texte: p.secondaire, fond: p.boite, seuil: 4.5 },
      { nom: `carte : texte sur canevas (${m})`, texte: p.texte, fond: p.canevas, seuil: 4.5 },
      { nom: `carte : texte sur le SMSI (${m})`, texte: p.surMarine, fond: p.teintes.marine.fond, seuil: 4.5 },
      {
        nom: `carte : sous-titre du SMSI (${m})`,
        texte: p.surMarineSecondaire,
        fond: p.teintes.marine.fond,
        seuil: 4.5,
      },
      { nom: `carte : surbrillance sur canevas (${m})`, texte: p.surbrillance, fond: p.canevas, seuil: 3 },
      ...TEINTES_CARTE.filter((k) => k !== 'marine').flatMap((k) => {
        const t = p.teintes[k];
        return [
          { nom: `carte ${k} : accent sur fond (${m})`, texte: t.accent, fond: t.fond, seuil: 4.5 },
          { nom: `carte ${k} : accent sur pastille (${m})`, texte: t.accent, fond: t.doux, seuil: 4.5 },
          { nom: `carte ${k} : accent sur boîte (${m})`, texte: t.accent, fond: p.boite, seuil: 4.5 },
          { nom: `carte ${k} : lien sur canevas (${m})`, texte: t.accent, fond: p.canevas, seuil: 3 },
          { nom: `carte ${k} : texte sur fond (${m})`, texte: p.texte, fond: t.fond, seuil: 4.5 },
          { nom: `carte ${k} : texte secondaire sur fond (${m})`, texte: p.secondaire, fond: t.fond, seuil: 4.5 },
          // Graphiques du tableau de bord (UI-02) : élément graphique sur la surface des cartes (WCAG 1.4.11).
          { nom: `graphique ${k} sur surface (${m})`, texte: t.accent, fond: FONDS[m].surface, seuil: 3 },
        ];
      }),
    ];
  }),
  // Tableau de bord « verre et relief » (ADR 0069) : textes et pastilles sur le verre, contour des métriques.
  ...(['clair', 'sombre'] as const).flatMap((m) => {
    const p = TABLEAU_DE_BORD[m];
    return [
      { nom: `tableau de bord : contour des métriques sur verre (${m})`, texte: p.contour, fond: p.surface, seuil: 3 },
      { nom: `tableau de bord : texte sur verre (${m})`, texte: FONDS[m].texte, fond: p.surface, seuil: 4.5 },
      {
        nom: `tableau de bord : texte secondaire sur verre (${m})`,
        texte: FONDS[m].secondaire,
        fond: p.surface,
        seuil: 4.5,
      },
      ...TEINTES_SEUIL.flatMap((k) => [
        { nom: `tableau de bord ${k} : chiffre sur verre (${m})`, texte: p.texte[k], fond: p.surface, seuil: 4.5 },
        { nom: `tableau de bord ${k} : texte de pastille (${m})`, texte: p.texte[k], fond: p.doux[k], seuil: 4.5 },
      ]),
    ];
  }),
];
