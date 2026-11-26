/* Style d'instance « Verre » (refonte verre, lot 1, décision du RSSI du 26/11/2026) : choisi dans Paramètres > Apparence à
   côté de « Sauge » et « Clair bleuté », appliqué par html[data-style], feuille de la charte chargée en dernier. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { styleInstance } from '../src/style-instance';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (...p: string[]) => readFileSync(path.resolve(ICI, ...p), 'utf8');

describe('style « Verre »', () => {
  it('valeur lue telle quelle ; absente ou inconnue : le style par défaut', () => {
    expect(styleInstance('verre')).toBe('verre');
    expect(styleInstance('clair')).toBe('clair');
    expect(styleInstance('sage')).toBe('sage');
    for (const v of [undefined, null, '', 'Verre', 'glass', 3]) expect(styleInstance(v), String(v)).toBe('sage');
  });

  it('proposé dans Paramètres > Apparence, à côté des deux autres styles', () => {
    const settings = lire('../src/pages/Settings.tsx');
    expect(settings).toMatch(/<Radio\s+value="verre"\s+label="Verre"/);
    expect(settings).toMatch(/<Radio\s+value="sage"/);
    expect(settings).toMatch(/<Radio\s+value="clair"/);
    expect(settings).toContain('const choisi = styleInstance(p.values.style);');
  });

  it('feuille exportée par la charte et chargée après toutes les autres', () => {
    expect(lire('../../../packages/ui/package.json')).toContain('"./verre.css": "./src/verre.css"');
    const main = lire('../src/main.tsx');
    const feuilles = [...main.matchAll(/^import '(@suivi\/ui\/[^']+\.css)';/gm)].map((m) => m[1]);
    expect(feuilles.at(-1)).toBe('@suivi/ui/verre.css');
    expect(feuilles.filter((f) => f === '@suivi/ui/verre.css')).toHaveLength(1);
  });
});
