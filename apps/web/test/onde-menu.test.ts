/* Onde en fond de panneau (OndeMenu) : grille en perspective, onde sur l'horizon, particules, teintes et mouvement. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AMPLITUDE_CONNEXION,
  amplitudeConnexion,
  AMPLITUDE_SOL,
  AVANCE,
  compresser,
  DECALAGE_TRAITS,
  dispositionConnexion,
  ondeSignee,
  PALETTE_CONNEXION,
  PART_TRAITS,
  PAS_TRAITS,
  signalOnde,
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

describe('onde de connexion : horizon mesuré', () => {
  it('à mi-chemin entre le bas du titre et le haut de la première carte, en part de la hauteur', () => {
    // Panneau de 600 px à 100 px du haut de la page ; titre jusqu'à 300 ; carte à 348 (3rem à 16 px).
    const d = dispositionConnexion({ top: 100, height: 600 }, 300, 348);
    expect(d.horizon).toBeCloseTo((324 - 100) / 600, 12);
    expect(d.ecart).toBeCloseTo(48 / 600, 12);
  });
  it('bornée dans [0 ; 1], sans division par zéro', () => {
    expect(dispositionConnexion({ top: 0, height: 100 }, 300, 400)).toEqual({ horizon: 1, ecart: 1 });
    expect(dispositionConnexion({ top: 500, height: 100 }, 300, 200)).toEqual({ horizon: 0, ecart: 0 });
    const d = dispositionConnexion({ top: 0, height: 0 }, 0.2, 0.4);
    expect(Number.isFinite(d.horizon)).toBe(true);
  });
  it('la grille en perspective part du même horizon', () => {
    const d = dispositionConnexion({ top: 0, height: H }, 250, 298);
    const { fuyantes } = grillePerspective(2, L, H, d.horizon);
    for (const f of fuyantes) expect(f.points.at(-1)!.y).toBeGreaterThan(H * d.horizon);
    expect(Math.min(...fuyantes.flatMap((f) => f.points.map((p) => p.y)))).toBeLessThan(
      H * d.horizon + (H * (1 - d.horizon)) / PROFONDEUR,
    );
  });
});

describe('onde de connexion : signal signé et compression', () => {
  const us = Array.from({ length: 401 }, (_, i) => i / 400);
  it.each(INSTANTS)('à t = %s s, signal dans [−1 ; 1], nul aux bords, positif et négatif', (t) => {
    const z = us.map((u) => signalOnde(u, t));
    for (const v of z) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(signalOnde(0, t)).toBeCloseTo(0, 12);
    expect(signalOnde(1, t)).toBeCloseTo(0, 12);
    expect(Math.max(...z)).toBeGreaterThan(0.05);
    expect(Math.min(...z)).toBeLessThan(-0.05);
  });
  it('formule demandée', () => {
    const u = 0.37;
    const t = 4.2;
    const attendu =
      Math.sin(Math.PI * u) ** 1.4 *
      (0.65 + 0.35 * Math.sin(0.9 * t + 4 * u)) *
      (0.5 * Math.sin(23 * u + 2.1 * t) + 0.3 * Math.sin(51 * u - 3.3 * t) + 0.2 * Math.sin(9 * u + 0.7 * t));
    expect(signalOnde(u, t)).toBeCloseTo(attendu, 12);
  });
  it('compression : signe conservé, bornée, réduit les grandes valeurs plus que les petites', () => {
    expect(compresser(0)).toBe(0);
    expect(compresser(-0.5)).toBeCloseTo(-compresser(0.5), 12);
    expect(compresser(1)).toBeCloseTo(1 / 1.4, 12);
    for (const z of [0.1, 0.3, 0.6, 1]) {
      expect(compresser(z)).toBeLessThan(z);
      expect(compresser(z)).toBeGreaterThan(0);
    }
    const reduction = (z: number) => compresser(z) / z;
    expect(reduction(1)).toBeLessThan(reduction(0.5));
    expect(reduction(0.5)).toBeLessThan(reduction(0.1));
    for (let z = 0; z < 1; z += 0.05) expect(compresser(z + 0.05)).toBeGreaterThan(compresser(z));
  });
});

describe('onde de connexion : amplitude et tracé', () => {
  it('7,5 % de la hauteur, au plus la moitié de l’espace entre le titre et la carte', () => {
    expect(AMPLITUDE_CONNEXION).toBe(0.075);
    expect(amplitudeConnexion(600, 0.5)).toBeCloseTo(45, 9);
    expect(amplitudeConnexion(600, 48 / 600)).toBeCloseTo(24, 9);
  });
  it.each([
    ['bureau', 576, 640, 304, 352],
    ['téléphone', 362, 860, 210, 252],
  ])('%s : les crêtes restent entre le titre et la carte', (_, l, h, basTitre, hautCarte) => {
    const d = dispositionConnexion({ top: 0, height: h }, basTitre, hautCarte);
    for (const t of INSTANTS) {
      const { y0, signal, traits } = ondeSignee(t, l, h, d);
      expect(y0).toBeCloseTo((basTitre + hautCarte) / 2, 9);
      for (const p of [...signal, ...traits.map((s) => ({ x: s.x, y: s.y2 }))]) {
        expect(p.y).toBeGreaterThan(basTitre);
        expect(p.y).toBeLessThan(hautCarte);
      }
    }
  });
  it('un point et un trait signé tous les 4 px, traits à 75 % de l’amplitude avec une phase décalée', () => {
    const d = { horizon: 0.4, ecart: 0.5 };
    const { y0, signal, traits } = ondeSignee(3, L, H, d);
    expect(signal[0]!.x).toBe(0);
    expect(signal.at(-1)!.x).toBe(L);
    for (let i = 1; i < signal.length - 1; i++) expect(signal[i]!.x - signal[i - 1]!.x).toBe(PAS_TRAITS);
    const a = amplitudeConnexion(H, d.ecart);
    traits.forEach((s, i) => {
      expect(s.y1).toBe(y0);
      expect(s.y2).toBeCloseTo(y0 - a * PART_TRAITS * compresser(signalOnde(s.x / L, 3 - DECALAGE_TRAITS)), 9);
      expect(s.x).toBe(signal[i]!.x);
    });
    expect(traits.some((s) => s.y2 > y0)).toBe(true);
    expect(traits.some((s) => s.y2 < y0)).toBe(true);
  });
  it('rendu : opacités et teintes demandées, définies par la charte', () => {
    const css = readFileSync(new URL('../../../packages/ui/src/styles.css', import.meta.url), 'utf8');
    expect(PALETTE_CONNEXION).toMatchObject({
      surface: 0.22,
      traits: 0.3,
      ligne: 0.4,
      onde: 0.95,
      epaisseur: 2.4,
      flou: 18,
    });
    expect(PALETTE_CONNEXION.bord).toBe('--suivi-famille-conformite');
    expect(PALETTE_CONNEXION.centre).toBe('--suivi-famille-risques');
    expect(css).toContain(`${PALETTE_CONNEXION.bord}:`);
    expect(css).toContain(`${PALETTE_CONNEXION.centre}:`);
  });
});
