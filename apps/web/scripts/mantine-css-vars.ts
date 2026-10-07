/* Génère src/generated/mantine-vars.css : variables CSS du thème et classes de points de rupture (hiddenFrom/visibleFrom),
   servies en fichier statique. Mantine les injecte normalement dans des balises <style> ; la CSP stricte
   (style-src 'self') l'interdit : MantineProvider est configuré avec withCssVariables={false} et withGlobalClasses={false}.
   Lancé avant « vite » et « vite build » (Node 24 exécute directement ce fichier TypeScript). */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertCssVariables, defaultCssVariablesResolver, DEFAULT_THEME, mergeMantineTheme } from '@mantine/core';
import { themeOverride } from '../src/theme.ts';

const theme = mergeMantineTheme(DEFAULT_THEME, themeOverride);
const vars = defaultCssVariablesResolver(theme);
// Même calcul que MantineClasses (@mantine/core) : une règle par point de rupture.
const em = (px: number) => `${px / 16}em`;
const pxOf = (v: string) => (v.includes('px') ? parseFloat(v) : parseFloat(v) * 16);
const classes = Object.entries(theme.breakpoints)
  .map(([bp, v]) => {
    const isPx = v.includes('px');
    const px = pxOf(v);
    const max = isPx ? `${px - 0.1}px` : em(px - 0.1);
    const min = isPx ? `${px}px` : em(px);
    return `@media (max-width: ${max}) {.mantine-visible-from-${bp} {display: none !important;}}@media (min-width: ${min}) {.mantine-hidden-from-${bp} {display: none !important;}}`;
  })
  .join('');
const css =
  '/* Fichier généré par scripts/mantine-css-vars.ts — ne pas modifier. */\n' +
  classes +
  '\n' +
  convertCssVariables(vars) +
  '\n' +
  convertCssVariables({
    variables: {},
    dark: { '--mantine-color-scheme': 'dark' },
    light: { '--mantine-color-scheme': 'light' },
  }) +
  '\n';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/generated/mantine-vars.css');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, css);
console.log(`Variables Mantine écrites dans ${path.relative(process.cwd(), out)} (${css.length} octets)`);
