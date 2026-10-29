/* Onde en fond de panneau (OndeMenu) : grille en perspective, onde sur l'horizon, particules, teintes et mouvement. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AMPLITUDE_SOL,
  AVANCE,
  CRETE_MAX,
  ECHANTILLONS,
  grillePerspective,
  hauteurOnde,
  HORIZON,
  NB_PARTICULES,
  ondeHorizon,
  ondeVisible,
  PALETTE_ONDE,
  particules,
  projeter,
  PROFONDEUR,
  REFLET,
} from '../src/components/onde-menu';

const L = 576;
const H = 720;
const Y0 = H * HORIZON;
const INSTANTS = [0, 0.4, 3.7, 12, 95];

describe('onde : grille en perspective', () => {
  it('projection : le premier plan touche le bas, le lointain tend vers le centre de l’horizon', () => {
    const proche = projeter(0, 1, 0, 0, L, H);
    expect(proche.x).toBe(L / 2);
    expect(Math.abs(proche.y - H)).toBeLessThanOrEqual(AMPLITUDE_SOL);
    const loin = projeter(200, 1000, 0, 0, L, H);
    expect(loin.x).toBeCloseTo(L / 2, 0);
    expect(loin.y).toBeCloseTo(Y0, 0);
  });

  it.each(INSTANTS)('à t = %s s, rangées sous l’horizon, couvrant la largeur, plus pâles au loin', (t) => {
    const { rangees } = grillePerspective(t, L, H);
    expect(rangees.length).toBeGreaterThanOrEqual(PROFONDEUR - 1);
    for (const r of rangees) {
      expect(r.points[0]!.x).toBeCloseTo(0, 6);
      expect(r.points.at(-1)!.x).toBeCloseTo(L, 6);
      for (const p of r.points) expect(p.y).toBeGreaterThan(Y0);
      expect(r.opacite).toBeGreaterThanOrEqual(0);
      expect(r.opacite).toBeLessThanOrEqual(1);
    }
    const hauteurs = rangees.map((r) => r.points[12]!.y);
    for (let k = 1; k < hauteurs.length; k++) expect(hauteurs[k]!).toBeLessThan(hauteurs[k - 1]! + AMPLITUDE_SOL);
    const opacites = rangees.map((r) => r.opacite);
    expect(opacites).toEqual([...opacites].sort((a, b) => b - a));
  });

  it('les rangées avancent vers l’observateur et le motif revient après une rangée', () => {
    // Rangée proche : son déplacement (une quinzaine de px) dépasse l'ondulation (au plus AMPLITUDE_SOL / z).
    const y = (t: number) => grillePerspective(t, L, H).rangees[1]!.points[12]!.y;
    expect(y(0.5)).toBeGreaterThan(y(0));
    const periode = 1 / AVANCE;
    const a = grillePerspective(0.2, L, H).rangees.map((r) => r.opacite);
    const b = grillePerspective(0.2 + periode, L, H).rangees.map((r) => r.opacite);
    expect(b.length).toBe(a.length);
    b.forEach((o, i) => expect(o).toBeCloseTo(a[i]!, 9));
  });

  it('le sol ondule : une rangée n’est pas droite et change de forme avec le temps', () => {
    const forme = (t: number) => grillePerspective(t, L, H).rangees[0]!.points.map((p) => p.y);
    const a = forme(1);
    expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(1);
    expect(forme(2)).not.toEqual(a);
  });

  it('fuyantes : symétriques, elles convergent vers le centre de l’horizon', () => {
    const { fuyantes } = grillePerspective(3, L, H);
    expect(fuyantes.length % 2).toBe(1);
    const centre = fuyantes[(fuyantes.length - 1) / 2]!;
    for (const p of centre.points) expect(p.x).toBeCloseTo(L / 2, 6);
    for (const f of fuyantes) {
      const fin = f.points.at(-1)!;
      expect(Math.abs(fin.x - L / 2)).toBeLessThan(Math.abs(f.points[0]!.x - L / 2) + 1e-9);
      expect(fin.y).toBeGreaterThan(Y0);
      expect(fin.y).toBeLessThan(Y0 + (H - Y0) / 10);
    }
  });
});

describe('onde : onde sonore sur l’horizon', () => {
  it.each(INSTANTS)('à t = %s s, crêtes au-dessus de l’horizon, traits fins en dessous', (t) => {
    const { cretes, traits } = ondeHorizon(t, L, H);
    expect(cretes).toHaveLength(ECHANTILLONS);
    expect(traits).toHaveLength(ECHANTILLONS);
    cretes.forEach((c, i) => {
      expect(c.y).toBeLessThanOrEqual(Y0);
      expect(Y0 - c.y).toBeLessThanOrEqual(H * CRETE_MAX + 1e-9);
      const s = traits[i]!;
      expect(s.x).toBe(c.x);
      expect(s.y1).toBeGreaterThan(Y0);
      expect(s.y2 - s.y1).toBeCloseTo((Y0 - c.y) * REFLET, 9);
    });
  });
  it('enveloppe nulle aux bords, onde marquée au centre, qui varie dans le temps', () => {
    expect(hauteurOnde(0, 2, L, H)).toBeCloseTo(0, 9);
    expect(hauteurOnde(L, 2, L, H)).toBeCloseTo(0, 9);
    const centre = ondeHorizon(2, L, H).cretes.slice(24, 48);
    expect(Math.max(...centre.map((c) => Y0 - c.y))).toBeGreaterThan(H * CRETE_MAX * 0.3);
    expect(hauteurOnde(L / 2, 2, L, H)).not.toBeCloseTo(hauteurOnde(L / 2, 2.5, L, H), 3);
  });
});

describe('onde : particules', () => {
  it.each(INSTANTS)('à t = %s s, quelques particules dans le panneau', (t) => {
    const p = particules(t, L, H);
    expect(p).toHaveLength(NB_PARTICULES);
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(-6);
      expect(q.x).toBeLessThanOrEqual(L + 6);
      expect(q.y).toBeGreaterThan(H * 0.1 - 1e-9);
      expect(q.y).toBeLessThanOrEqual(H);
      expect(q.r).toBeGreaterThan(0);
      expect(q.opacite).toBeGreaterThan(0);
      expect(q.opacite).toBeLessThanOrEqual(1);
    }
  });
  it('elles montent et s’effacent en montant', () => {
    const a = particules(5, L, H);
    const b = particules(5.1, L, H);
    const montee = a.filter((q, i) => b[i]!.y < q.y);
    expect(montee.length).toBeGreaterThan(NB_PARTICULES / 2);
    for (const q of a) expect(q.opacite).toBeCloseTo((q.y - H * 0.1) / (H * 0.9), 6);
  });
});

describe('onde : teintes et mouvement', () => {
  const css = readFileSync(new URL('../../../packages/ui/src/styles.css', import.meta.url), 'utf8');
  it('teintes de la charte demandées, à faible opacité', () => {
    expect(PALETTE_ONDE.grille[0]).toBe('--suivi-turquoise-nav');
    expect([PALETTE_ONDE.crete[0], PALETTE_ONDE.lueur[0], PALETTE_ONDE.trait[0]].sort()).toEqual(
      ['--suivi-famille-conformite', '--suivi-famille-conformite', '--suivi-famille-risques'].sort(),
    );
    expect(PALETTE_ONDE.particule[0]).toBe('--suivi-nav-repere');
    for (const [v, a] of Object.values(PALETTE_ONDE)) {
      expect(css).toContain(`${v}:`);
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThanOrEqual(0.6);
    }
  });
  it('rien si moins de mouvement est demandé, sous un automate ou à l’impression', () => {
    const base = { webdriver: false, impression: false, mouvementReduit: false };
    expect(ondeVisible(base)).toBe(true);
    expect(ondeVisible({ ...base, mouvementReduit: true })).toBe(false);
    expect(ondeVisible({ ...base, webdriver: true })).toBe(false);
    expect(ondeVisible({ ...base, impression: true })).toBe(false);
  });
});
