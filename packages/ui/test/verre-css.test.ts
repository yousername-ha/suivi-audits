/* Style d'instance « Verre » (refonte verre, lot 1, décision du RSSI du 26/11/2026) : la feuille verre.css ne touche
   jamais les autres styles. Chaque règle est limitée à html[data-style='verre'] ; les seules règles conditionnelles sont
   @media et @supports (mêmes contraintes à l'intérieur). Le repli opaque (transparence réduite, contraste renforcé,
   navigateur sans backdrop-filter) passe par les variables du verre. Sur le modèle de charte-css.test.ts. */
import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Dalle } from '../src/tableau-de-bord.tsx';

const css = readFileSync(new URL('../src/verre.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const PORTEE = "html[data-style='verre']";

interface Regle {
  prelude: string;
  corps: string;
}
/** Règles de premier niveau d'une feuille (accolades équilibrées). */
function regles(texte: string): Regle[] {
  const out: Regle[] = [];
  let i = 0;
  while (i < texte.length) {
    const ouvre = texte.indexOf('{', i);
    if (ouvre < 0) {
      expect(texte.slice(i).trim(), 'texte hors règle').toBe('');
      break;
    }
    let profondeur = 0,
      j = ouvre;
    for (; j < texte.length; j++) {
      if (texte[j] === '{') profondeur++;
      else if (texte[j] === '}' && --profondeur === 0) break;
    }
    out.push({ prelude: texte.slice(i, ouvre).trim(), corps: texte.slice(ouvre + 1, j) });
    i = j + 1;
  }
  return out;
}
/** Sélecteurs d'une liste, séparés aux virgules de premier niveau (hors parenthèses de :is(), :not(), :has()). */
function selecteurs(prelude: string): string[] {
  const out: string[] = [];
  let profondeur = 0,
    debut = 0;
  for (let k = 0; k < prelude.length; k++) {
    if (prelude[k] === '(') profondeur++;
    else if (prelude[k] === ')') profondeur--;
    else if (prelude[k] === ',' && profondeur === 0) {
      out.push(prelude.slice(debut, k).trim());
      debut = k + 1;
    }
  }
  out.push(prelude.slice(debut).trim());
  return out.map((s) => s.replace(/\s+/g, ' '));
}
/** Toutes les règles de style, y compris celles des blocs @media et @supports, avec leur condition. */
function toutes(texte: string, condition = ''): (Regle & { condition: string })[] {
  return regles(texte).flatMap((r) => (r.prelude.startsWith('@') ? toutes(r.corps, r.prelude) : [{ ...r, condition }]));
}

describe('verre.css : limitée au style « Verre »', () => {
  const liste = toutes(css);

  it('la feuille contient des règles (lecture réussie)', () => {
    expect(liste.length).toBeGreaterThan(80);
  });

  it("chaque sélecteur commence par html[data-style='verre']", () => {
    const hors = liste.flatMap((r) =>
      selecteurs(r.prelude)
        .filter((s) => !s.startsWith(PORTEE))
        .map((s) => `${r.condition ? r.condition + ' → ' : ''}${s}`),
    );
    expect(hors).toEqual([]);
  });

  it('seules les règles conditionnelles @media et @supports sont permises (ni @font-face, ni @keyframes, ni @import)', () => {
    const conditions = regles(css)
      .filter((r) => r.prelude.startsWith('@'))
      .map((r) => r.prelude.split(/[\s(]/)[0]);
    expect(conditions.length).toBeGreaterThan(0);
    for (const c of conditions) expect(['@media', '@supports'], c).toContain(c);
    expect(css).not.toMatch(/@(import|font-face|keyframes|layer|property)\b/);
  });

  it('aucun :root, aucun sélecteur universel ni de balise html sans l’attribut du style', () => {
    expect(css).not.toMatch(/:root\b/);
    for (const r of liste) for (const s of selecteurs(r.prelude)) expect(s).not.toMatch(/^(\*|html(?!\[data-style))/);
  });
});

describe('verre.css : repli opaque et accessibilité', () => {
  const blocs = (requete: string) =>
    regles(css)
      .filter((r) => r.prelude.startsWith(requete))
      .map((r) => r.corps)
      .join('\n');

  it('chaque flou passe par les variables du verre (coupées par le repli) ou vaut none', () => {
    const flous = [...css.matchAll(/^\s*(?:-webkit-)?backdrop-filter:\s*([^;]+);/gm)].map((m) => m[1]!.trim());
    expect(flous.length).toBeGreaterThan(0);
    for (const f of flous) expect(f, f).toMatch(/^(var\(--verre-flou(-leger)?\)|none)$/);
  });

  it('transparence réduite et contraste renforcé : surfaces opaques, sans flou ni halos', () => {
    const repli = blocs('@media (prefers-reduced-transparency: reduce), (prefers-contrast: more)');
    for (const d of [
      '--verre-surface: var(--verre-surface-opaque);',
      '--verre-surface-flottante: var(--verre-surface-opaque);',
      '--verre-flou: none;',
      '--verre-flou-leger: none;',
      '--verre-halos: none;',
    ])
      expect(repli).toContain(d);
  });

  it('navigateur sans backdrop-filter : surfaces opaques', () => {
    const repli = blocs('@supports not');
    expect(repli).toContain('--verre-surface: var(--verre-surface-opaque);');
    expect(repli).toContain('--verre-surface-flottante: var(--verre-surface-opaque);');
  });

  it('texte : 13 px au moins pour les petits textes, focus visible', () => {
    expect(css).toMatch(/--verre-texte-min:\s*max\(13px, 0\.8125rem\);/);
    expect(css).toMatch(/--mantine-font-size-xs:\s*var\(--verre-texte-min\);/);
    expect(css).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--verre-focus\);/);
  });

  it('variante claire : texte foncé sur verre blanc', () => {
    const clair = regles(css).find((r) => r.prelude === `${PORTEE}[data-mantine-color-scheme='light']`);
    expect(clair?.corps).toMatch(/--verre-texte:\s*#1c2033;/);
    expect(clair?.corps).toMatch(/--verre-surface:\s*linear-gradient\(150deg, rgba\(255, 255, 255, 0\.78\)/);
  });
});

describe('dalle « Incidents de sécurité » : repères de mois bornés au tracé', () => {
  const corps = (prelude: string) => toutes(css).find((r) => r.prelude === prelude)?.corps ?? '';
  it('l’axe ne compte pas dans la largeur de la courbe ; premier repère à gauche, dernier à droite ; texte non réduit', () => {
    const axe = corps(`${PORTEE} .tdb .tdbv-axes--mois`);
    expect(axe).toMatch(/contain:\s*inline-size;/);
    expect(axe).toMatch(/white-space:\s*nowrap;/);
    expect(axe).not.toMatch(/font-size/);
    expect(corps(`${PORTEE} .tdb .tdbv-axes--mois > :first-child`)).toMatch(/justify-self:\s*start;/);
    expect(corps(`${PORTEE} .tdb .tdbv-axes--mois > :last-child`)).toMatch(/justify-self:\s*end;/);
    expect(corps(`${PORTEE} .tdb .tdbv-axes`)).toMatch(/font-size:\s*var\(--verre-texte-min\);/);
  });
});

describe('dalle du tableau de bord : attribut data-dalle inerte hors du style « Verre »', () => {
  const section = (p: Parameters<typeof Dalle>[0]) => Dalle(p) as ReactElement<Record<string, unknown>>;
  it('absent quand la dalle ne le demande pas (React n’écrit pas un attribut indéfini), présent sinon', () => {
    const sans = section({ titre: 'Essai', children: 'x' });
    expect(sans.type).toBe('section');
    expect(sans.props['data-dalle']).toBeUndefined();
    expect(section({ titre: 'Essai', dalle: 'incidents', children: 'x' }).props['data-dalle']).toBe('incidents');
  });
});
