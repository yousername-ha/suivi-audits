/* Thème Mantine. Ses variables CSS sont générées en fichier statique (scripts/mantine-css-vars.ts) : CSP stricte. */
import { createTheme, Drawer, Modal, type MantineColorsTuple } from '@mantine/core';

const suivi: MantineColorsTuple = [
  '#e6f6f5',
  '#d1ebe9',
  '#a5d6d2',
  '#75c0ba',
  '#4fada6',
  '#37a199',
  '#279a92',
  '#13867e',
  '#0d6b6b',
  '#005c5a',
];

export const themeOverride = createTheme({
  primaryColor: 'suivi',
  primaryShade: { light: 8, dark: 5 },
  colors: { suivi },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  defaultRadius: 'md',
  headings: { fontWeight: '650' },
  components: {
    // Le verrouillage du défilement (react-remove-scroll) injecte une balise <style> : interdit par la CSP stricte.
    Modal: Modal.extend({ defaultProps: { lockScroll: false } }),
    Drawer: Drawer.extend({ defaultProps: { lockScroll: false } }),
  },
});
