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
    // Seuls ses compléments par famille (verre-*.css, mêmes règles) la suivent (famille Documents, 28/11/2026).
    const rang = feuilles.indexOf('@suivi/ui/verre.css');
    expect(feuilles.slice(rang + 1)).toEqual(['@suivi/ui/verre-documents.css']);
    expect(feuilles.filter((f) => f === '@suivi/ui/verre.css')).toHaveLength(1);
  });

  it('dalle phare du tableau de bord en acrylique lumineux (26/11/2026)', () => {
    const verre = lire('../../../packages/ui/src/verre.css');
    expect(verre).toContain('.tdb .tdb-dalle.tdb-bandeau {');
    // Repli : fond uni, sans lueur, pour la transparence réduite, le contraste renforcé et les couleurs forcées.
    expect(verre).toMatch(
      /@media \(prefers-reduced-transparency: reduce\), \(prefers-contrast: more\), \(forced-colors: active\) \{\s*html\[data-style='verre'\]\[data-mantine-color-scheme\] \.tdb \.tdb-dalle\.tdb-bandeau \{\s*background: #82a346;/,
    );
  });

  it('connexion : maquette 1 du canevas avec la touche acrylique, en-tête masqué hors du style « Verre »', () => {
    const login = lire('../src/pages/Login.tsx');
    expect(login).toContain('const style = styleInstance(me.appearance?.style);');
    expect(login).toContain('document.documentElement.dataset.style = style;');
    expect(login).toMatch(/<div className="auth-verre-tete" aria-hidden="true">/);
    expect(login).toContain('Bon retour');
    expect(lire('../../../packages/ui/src/styles.css')).toMatch(/\.auth-verre-tete \{\s*display: none;/);
    const verre = lire('../../../packages/ui/src/verre.css');
    expect(verre).toMatch(/html\[data-style='verre'\] \.auth-connexion \.auth-verre-tete \{\s*display: flex;/);
    expect(verre).toContain("html[data-style='verre'] .auth-connexion .auth-carte--valider {");
  });

  it('lots 2 et 3, Organisation et Pilotage : famille de la page posée par la coquille, en-tête et compteurs habillés en style « Verre »', () => {
    const layout = lire('../src/components/Layout.tsx');
    expect(layout).toContain('data-famille={familleDeLaPage}');
    expect(layout).toContain('data-famille-libelle={localiser(loc.pathname)?.famille.label}');
    const verre = lire('../../../packages/ui/src/verre.css');
    // Prettier coupe les longs sélecteurs : comparaison sur le texte aux blancs normalisés.
    const plat = verre.replace(/\s+/g, ' ');
    expect(plat).toContain(
      "html[data-style='verre'] .app-main:is([data-famille='organisation'], [data-famille='pilotage']) > .page:has(> .page-header) {",
    );
    expect(verre).toContain('content: attr(data-famille-libelle);');
    expect(verre).toContain("html[data-style='verre'] .app-main[data-famille='organisation'] .pr-lane {");
    expect(verre).toContain("html[data-style='verre'] .app-main[data-famille='pilotage'] .revue-temps {");
  });
});
