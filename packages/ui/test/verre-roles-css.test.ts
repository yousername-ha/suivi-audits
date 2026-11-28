/* Style « Verre », rôles et responsabilités (décisions du RSSI du 28/11/2026) : la feuille verre-roles.css suit les règles
   de verre.css (verre-css.test.ts). Chaque sélecteur commence par html[data-style='verre'] ; seules les règles @media
   sont permises ; aucun flou propre (le pied opaque l'annule seulement) ; aucune couleur codée en dur (jetons --verre-*,
   redéfinis par le mode clair et le fond bleu nuit) ; textes de 13 px au moins, graisse 500 à 700. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const brut = readFileSync(new URL('../src/verre-roles.css', import.meta.url), 'utf8');
const css = brut.replace(/\/\*[\s\S]*?\*\//g, '');
const PORTEE = "html[data-style='verre']";

interface Regle {
  prelude: string;
  corps: string;
}
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
const toutes = (texte: string): Regle[] =>
  regles(texte).flatMap((r) => (r.prelude.startsWith('@') ? toutes(r.corps) : [r]));

describe('verre-roles.css : limitée au style « Verre »', () => {
  const liste = toutes(css);

  it('la feuille contient la fenêtre d’un rôle et la matrice de la page (lecture réussie)', () => {
    expect(liste.length).toBeGreaterThan(30);
    for (const prefixe of ['.rolev-fenetre', '.rolev-champs', '.rolev-lettre', '.qui-decide-quoi', '.raci-puce'])
      expect(css).toContain(prefixe);
  });

  it("chaque sélecteur commence par html[data-style='verre']", () => {
    const hors = liste.flatMap((r) => selecteurs(r.prelude).filter((s) => !s.startsWith(PORTEE)));
    expect(hors).toEqual([]);
  });

  it('seules les règles @media sont permises (ni @import, ni @font-face, ni @keyframes)', () => {
    for (const r of regles(css).filter((x) => x.prelude.startsWith('@')))
      expect(r.prelude.split(/[\s(]/)[0]).toBe('@media');
    expect(css).not.toMatch(/@(import|font-face|keyframes|layer|property|supports)\b/);
    expect(css).not.toMatch(/:root\b/);
  });

  it('aucun flou propre : le pied ne fait que retirer celui du verre', () => {
    const flous = [...css.matchAll(/^\s*(?:-webkit-)?backdrop-filter:\s*([^;]+);/gm)].map((m) => m[1]!.trim());
    for (const f of flous) expect(f, f).toMatch(/^(none|var\(--verre-flou(-leger)?\))$/);
  });

  it('teintes et textes tirés des jetons du verre : aucune couleur écrite en dur', () => {
    expect([...css.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g)].map((m) => m[0])).toEqual([]);
  });

  it('lettres RACI : R violet, A ambre, C et I gris (teinte secondaire par défaut)', () => {
    const plat = css.replace(/\s+/g, ' ');
    expect(plat).toMatch(/\[data-lettre='R'\] \{ --raci-ton: var\(--verre-violet\); \}/);
    expect(plat).toMatch(/\[data-lettre='A'\] \{ --raci-ton: var\(--verre-ambre\); \}/);
    expect(plat).not.toMatch(/\[data-lettre='[CI]'\]/);
    expect(plat).toContain('--raci-ton: var(--verre-secondaire);');
  });

  it('lisibilité : aucune taille de texte sous 13 px (0,8125 rem), graisse 500 à 700', () => {
    const tailles = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(tailles.length).toBeGreaterThan(0);
    for (const t of tailles) {
      if (t.startsWith('var(--verre-texte-min)')) continue;
      const rem = /^([\d.]+)rem$/.exec(t);
      expect(rem, t).not.toBeNull();
      expect(Number(rem![1]), t).toBeGreaterThanOrEqual(0.8125);
    }
    for (const g of [...css.matchAll(/font-weight:\s*(\d+);/g)].map((m) => Number(m[1]))) {
      expect(g).toBeGreaterThanOrEqual(500);
      expect(g).toBeLessThanOrEqual(700);
    }
  });

  it('exportée par la charte', () => {
    const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    expect(pkg).toContain('"./verre-roles.css": "./src/verre-roles.css"');
  });
});
