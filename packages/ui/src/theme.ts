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
  InputWrapper,
  Modal,
  NativeSelect,
  Notification,
  NumberInput,
  Select,
  Table,
  TextInput,
  type CSSVariablesResolver,
} from '@mantine/core';
import { rendreFocusFiche } from './focus-fiche.ts';
import { proportionChamp } from './proportions-champs.ts';
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
  NEON,
  SCEAU,
  variablesCarte,
  variablesMenu,
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
  // Lexend (choix du RSSI du 19/11/2026) : titres en 600 et graisse « medium » à 500, moins lourds que 650 et 600.
  headings: { fontFamily: POLICE, fontWeight: '600' },
  fontWeights: { medium: '500' },
  radius: RAYONS,
  defaultRadius: 'md',
  spacing: ESPACEMENTS,
  breakpoints: POINTS_DE_RUPTURE,
  components: {
    InputWrapper: InputWrapper.extend({
      defaultProps: { inputWrapperOrder: ['label', 'input', 'description', 'error'] },
    }),
    TextInput: TextInput.extend({ classNames: (_theme, props) => ({ root: proportionChamp(props) }) }),
    NativeSelect: NativeSelect.extend({ classNames: (_theme, props) => ({ root: proportionChamp(props) }) }),
    Select: Select.extend({
      classNames: (_theme, props) => ({ root: proportionChamp(props) }),
      defaultProps: { comboboxProps: { width: 'max-content', position: 'bottom-start' } },
    }),
    NumberInput: NumberInput.extend({ classNames: { root: 'champ-format-nombre' } }),
    // Le verrouillage du défilement (react-remove-scroll) injecte une balise <style> : interdit par la CSP stricte.
    /* Retour du focus à la ligne ou au bouton qui a ouvert la fiche (lignes ouvrables, refonte Neon lot 2). Le bouton
       de fermeture reçoit un nom précis en français ; les tests visant un bouton métier « Fermer » utilisent son nom exact. */
    Modal: Modal.extend({
      classNames: (_theme, props) => ({
        content: props.fullScreen || ['lg', 'xl'].includes(String(props.size)) ? 'fenetre-large' : '',
      }),
      defaultProps: {
        lockScroll: false,
        radius: 'lg',
        centered: true,
        closeButtonProps: { 'aria-label': 'Fermer la fenêtre' },
        onExitTransitionEnd: () => requestAnimationFrame(rendreFocusFiche),
        // Le corps défile seul quand il dépasse (taille automatique, addendum de l'ADR 0093) : il doit être atteignable
        // au clavier pour défiler sans souris (règle axe « scrollable-region-focusable », WCAG 2.1.1).
        attributes: { body: { tabIndex: 0 } },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        lockScroll: false,
        closeButtonProps: { 'aria-label': 'Fermer le panneau' },
        onExitTransitionEnd: () => requestAnimationFrame(rendreFocusFiche),
        attributes: { body: { tabIndex: 0 } },
      },
    }),
    Card: Card.extend({ defaultProps: { radius: 'lg', withBorder: true } }),
    Button: Button.extend({
      defaultProps: { radius: 'md', variant: 'outline' },
      classNames: (_theme, props) => ({
        root: props.color && !['suivi', 'violet'].includes(props.color) ? 'commande-metier' : 'commande-neon',
      }),
    }),
    Badge: Badge.extend({ defaultProps: { radius: 'sm' } }),
    // Un lien ne doit pas se distinguer par la seule couleur (WCAG 1.4.1) : souligné en permanence.
    Anchor: Anchor.extend({ defaultProps: { underline: 'always' } }),
    Table: Table.extend({ defaultProps: { verticalSpacing: 'xs', highlightOnHover: true } }),
    // Le bouton de fermeture d'une notification doit avoir un nom accessible (WCAG 4.1.2).
    Notification: Notification.extend({
      defaultProps: { closeButtonProps: { 'aria-label': 'Fermer la notification' } },
    }),
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

/** Palette sémantique Neon commune à la navigation, aux surfaces et aux dessins. */
const variablesNeon = (mode: 'clair' | 'sombre'): Record<string, string> => ({
  '--neon-secondaire': FONDS[mode].secondaire,
  '--neon-rose': NEON.rose,
  '--neon-violet': NEON.violet,
  '--neon-bleu': NEON.bleu,
  '--neon-cyan': NEON.cyan,
  '--neon-orange': NEON.orange,
  '--neon-menthe': NEON.menthe,
  '--neon-navigation': NEON[mode].navigation,
  '--neon-titre': NEON[mode].titre,
  '--neon-accent': NEON[mode].accent,
  '--neon-doux': NEON[mode].doux,
});

/** Variables CSS : celles de Mantine, ajustées (fonds, bordures, texte secondaire) et complétées par la charte. */
export const cssVariablesResolver: CSSVariablesResolver = (t) => {
  const base = defaultCssVariablesResolver(t);
  return {
    variables: {
      ...base.variables,
      '--suivi-encre': BRAND.encre,
      '--suivi-vert': BRAND.vert,
      '--suivi-violet': BRAND.violet,
      '--suivi-sceau-bleu': SCEAU.bleu,
      '--suivi-sceau-blanc': SCEAU.blanc,
      '--suivi-sceau-rouge': SCEAU.rouge,
      ...variablesMenu(),
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
      ...variablesNeon('clair'),
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
      ...variablesNeon('sombre'),
    },
  };
};
