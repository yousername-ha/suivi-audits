/* Thème Mantine de la charte (clair et sombre). Ses variables CSS sont écrites dans un fichier statique
   (apps/web/scripts/mantine-css-vars.ts) : CSP stricte, aucune balise <style> injectée. */
import {
  Anchor,
  Badge,
  Button,
  Card,
  createTheme,
  defaultCssVariablesResolver,
  Drawer,
  Modal,
  Table,
  type CSSVariablesResolver,
} from '@mantine/core';
import {
  BRAND,
  ENCRE,
  ESPACEMENTS,
  FONDS,
  GRIS,
  POINTS_DE_RUPTURE,
  POLICE,
  POLICE_MONO,
  RAYONS,
  SOMBRE,
  VERT,
  VIOLET,
  CARTE,
  ETATS,
  variablesCarte,
  type EtatCouleur,
} from './tokens.ts';

export const theme = createTheme({
  primaryColor: 'suivi',
  primaryShade: { light: 8, dark: 7 },
  colors: { suivi: VERT, encre: ENCRE, violet: VIOLET, gray: GRIS, dark: SOMBRE },
  white: BRAND.surface,
  black: BRAND.encre,
  fontFamily: POLICE,
  fontFamilyMonospace: POLICE_MONO,
  headings: { fontFamily: POLICE, fontWeight: '650' },
  radius: RAYONS,
  defaultRadius: 'md',
  spacing: ESPACEMENTS,
  breakpoints: POINTS_DE_RUPTURE,
  components: {
    // Le verrouillage du défilement (react-remove-scroll) injecte une balise <style> : interdit par la CSP stricte.
    Modal: Modal.extend({ defaultProps: { lockScroll: false, radius: 'lg' } }),
    Drawer: Drawer.extend({ defaultProps: { lockScroll: false } }),
    Card: Card.extend({ defaultProps: { radius: 'lg', withBorder: true } }),
    Button: Button.extend({ defaultProps: { radius: 'md' } }),
    Badge: Badge.extend({ defaultProps: { radius: 'sm' } }),
    // Un lien ne doit pas se distinguer par la seule couleur (WCAG 1.4.1) : souligné en permanence.
    Anchor: Anchor.extend({ defaultProps: { underline: 'always' } }),
    Table: Table.extend({ defaultProps: { verticalSpacing: 'xs', highlightOnHover: true } }),
  },
});

/** Couleurs d'état : fonds pleins, survol, texte et contour assombris pour le contraste (voir ETATS dans tokens.ts). */
const variablesEtats = (mode: 'clair' | 'sombre'): Record<string, string> =>
  Object.fromEntries(
    (Object.keys(ETATS) as EtatCouleur[]).flatMap((k) => {
      const e = ETATS[k];
      const communes: [string, string][] = [
        [`--mantine-color-${k}-filled`, e.fond],
        [`--mantine-color-${k}-filled-hover`, e.survol],
      ];
      // En sombre, le texte et le contour clairs de Mantine (nuances 2 à 4) sont déjà très contrastés.
      return mode === 'clair'
        ? [...communes, [`--mantine-color-${k}-light-color`, e.texte], [`--mantine-color-${k}-outline`, e.texte]]
        : communes;
    }),
  );

/** Variables CSS : celles de Mantine, ajustées (fonds, bordures, texte secondaire) et complétées par la charte. */
export const cssVariablesResolver: CSSVariablesResolver = (t) => {
  const base = defaultCssVariablesResolver(t);
  return {
    variables: {
      ...base.variables,
      '--suivi-encre': BRAND.encre,
      '--suivi-vert': BRAND.vert,
      '--suivi-violet': BRAND.violet,
    },
    light: {
      ...base.light,
      '--mantine-color-body': FONDS.clair.surface,
      '--mantine-color-text': FONDS.clair.texte,
      '--mantine-color-dimmed': FONDS.clair.secondaire,
      '--mantine-color-default-border': GRIS[5],
      '--suivi-fond-page': FONDS.clair.page,
      '--suivi-surface': FONDS.clair.surface,
      '--suivi-marque-texte': '#FFFFFF',
      '--suivi-marque-fond': VERT[8],
      '--suivi-qr-fond': '#FFFFFF',
      '--suivi-trait': GRIS[3],
      ...variablesEtats('clair'),
      ...variablesCarte(CARTE.clair),
    },
    dark: {
      ...base.dark,
      '--mantine-color-body': FONDS.sombre.surface,
      '--mantine-color-text': FONDS.sombre.texte,
      '--mantine-color-dimmed': FONDS.sombre.secondaire,
      '--mantine-color-default-border': SOMBRE[3],
      '--suivi-fond-page': FONDS.sombre.page,
      '--suivi-surface': FONDS.sombre.surface,
      '--suivi-marque-texte': '#FFFFFF',
      '--suivi-marque-fond': VERT[7],
      '--suivi-qr-fond': '#FFFFFF',
      '--suivi-trait': SOMBRE[5],
      ...variablesEtats('sombre'),
      ...variablesCarte(CARTE.sombre),
    },
  };
};
