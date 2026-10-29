/* Fond animé de l'écran de connexion : géométrie pure (grille, barres, halos, courbes, nœuds), palettes et cadence. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  barres,
  bruit,
  courbe,
  courbePrincipale,
  courbesPointillees,
  ecartNoeuds,
  ECART_BARRES,
  halos,
  hasard,
  imageDue,
  LARGEUR_BARRE,
  LIBELLES,
  lignesGrille,
  modeAnimation,
  NB_HALOS,
  noeuds,
  PALETTES,
  PAS_GRILLE,
  VITESSE,
} from '../src/connexion/fond-geometrie';

const L = 1440;
const H = 900;
const INSTANTS = [0, 0.5, 7.3, 12, 61, 600];

describe('fond de connexion : tirages', () => {
  it('hasard et bruit sont déterministes et bornés', () => {
    for (let n = -50; n < 50; n += 0.37) {
      expect(hasard(n)).toBe(hasard(n));
      expect(hasard(n)).toBeGreaterThanOrEqual(0);
      expect(hasard(n)).toBeLessThan(1);
      expect(bruit(n)).toBeGreaterThanOrEqual(0);
      expect(bruit(n)).toBeLessThanOrEqual(1);
    }
  });
  it('le bruit est continu (aucun saut entre deux entiers)', () => {
    for (let i = -5; i < 5; i++) expect(bruit(i + 1e-9)).toBeCloseTo(bruit(i - 1e-9), 6);
  });
});

describe('fond de connexion : grille large qui défile', () => {
  it.each(INSTANTS)('à t = %s s, verticales espacées du pas et couvrant la largeur', (t) => {
    const lignes = lignesGrille(t, L, H);
    const verticales = lignes.filter((s) => s.x1 === s.x2).map((s) => s.x1);
    const horizontales = lignes.filter((s) => s.y1 === s.y2).map((s) => s.y1);
    expect(PAS_GRILLE).toBe(112);
    expect(verticales[0]).toBeLessThanOrEqual(1);
    expect(verticales.at(-1)!).toBeGreaterThan(L - PAS_GRILLE);
    for (let k = 1; k < verticales.length; k++)
      expect(Math.abs(verticales[k]! - verticales[k - 1]! - PAS_GRILLE)).toBeLessThanOrEqual(1);
    expect(horizontales[0]).toBeCloseTo(PAS_GRILLE / 2 + 0.5, 5);
    for (const s of lignes.filter((x) => x.x1 === x.x2)) expect([s.y1, s.y2]).toEqual([0, H]);
  });
  it('la grille défile vers la gauche à la vitesse annoncée, puis revient au même motif après un pas', () => {
    const x0 = lignesGrille(0, L, H)[0]!.x1;
    const x1 = lignesGrille(1, L, H)[0]!.x1;
    expect(x0 - x1).toBeCloseTo(VITESSE, 0);
    expect(lignesGrille(PAS_GRILLE / VITESSE, L, H)).toEqual(lignesGrille(0, L, H));
  });
});

describe('fond de connexion : barres fines espacées', () => {
  it.each(INSTANTS)('à t = %s s, barres posées sur le bas, fines, espacées, certaines absentes', (t) => {
    const b = barres(t, L, H);
    const attendues = Math.ceil(L / ECART_BARRES) + 3;
    expect(b.length).toBeGreaterThan(attendues / 2);
    expect(b.length).toBeLessThan(attendues);
    for (const x of b) {
      expect(x.l).toBe(LARGEUR_BARRE);
      expect(x.y + x.h).toBeCloseTo(H, 6);
      expect(x.h).toBeGreaterThan(0);
      expect(x.h).toBeLessThan(H * 0.7);
    }
    const xs = b.map((x) => x.x);
    for (let k = 1; k < xs.length; k++) expect(xs[k]! - xs[k - 1]!).toBeGreaterThanOrEqual(ECART_BARRES - 1e-6);
  });
  it('les barres montent vers la droite', () => {
    const b = barres(3, L, H);
    const gauche = b.filter((x) => x.x < L / 3).map((x) => x.h);
    const droite = b.filter((x) => x.x > (2 * L) / 3).map((x) => x.h);
    expect(Math.min(...droite)).toBeGreaterThan(Math.max(...gauche) - H * 0.1);
  });
});

describe('fond de connexion : halos', () => {
  it.each(INSTANTS)('à t = %s s, halos dans la fenêtre élargie', (t) => {
    const h = halos(t, L, H);
    expect(h).toHaveLength(NB_HALOS);
    for (const o of h) {
      expect(o.r).toBeGreaterThanOrEqual(10);
      expect(o.r).toBeLessThanOrEqual(36);
      expect(o.x).toBeGreaterThanOrEqual(-40);
      expect(o.x).toBeLessThanOrEqual(L + 40);
      expect(o.y).toBeGreaterThan(H * 0.1 - H * 0.3);
      expect(o.y).toBeLessThanOrEqual(H * 0.95);
    }
  });
});

describe('fond de connexion : courbes', () => {
  it.each(INSTANTS)('à t = %s s, la courbe principale couvre la largeur et monte de gauche à droite', (t) => {
    const p = courbePrincipale(t, L, H);
    const s = ecartNoeuds(L);
    expect(p[0]!.x).toBeLessThanOrEqual(0);
    expect(p.at(-1)!.x).toBeGreaterThanOrEqual(L);
    for (let k = 1; k < p.length; k++) {
      expect(p[k]!.i).toBe(p[k - 1]!.i + 1);
      expect(p[k]!.x - p[k - 1]!.x).toBeCloseTo(s, 6);
    }
    const gauche = p.filter((q) => q.x < L * 0.2).map((q) => q.y);
    const droite = p.filter((q) => q.x > L * 0.8).map((q) => q.y);
    const moy = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    expect(moy(droite)).toBeLessThan(moy(gauche));
    for (const q of p) {
      expect(q.y).toBeGreaterThan(0);
      expect(q.y).toBeLessThan(H);
    }
  });
  it('deux courbes en pointillés, distinctes de la principale', () => {
    const [a, b] = courbesPointillees(4, L, H);
    const p = courbePrincipale(4, L, H);
    expect(a).toHaveLength(p.length);
    expect(b).toHaveLength(p.length);
    expect(a!.map((q) => q.y)).not.toEqual(p.map((q) => q.y));
    expect(b!.map((q) => q.y)).not.toEqual(a!.map((q) => q.y));
  });
  it('un nœud garde son relief en défilant : il ne suit que la tendance montante', () => {
    const a = courbe(2, L, H, 0, 0.16);
    const b = courbe(3, L, H, 0, 0.16);
    const commun = a.find((q) => b.some((r) => r.i === q.i))!;
    const suivant = b.find((r) => r.i === commun.i)!;
    expect(commun.x - suivant.x).toBeCloseTo(VITESSE, 6);
    expect(suivant.y - commun.y).toBeCloseTo((0.42 * H * VITESSE) / L, 6);
  });
  it('fenêtre étroite (téléphone) : écart minimal de 90 px entre nœuds', () => {
    expect(ecartNoeuds(390)).toBe(90);
    expect(courbePrincipale(0, 390, 844).at(-1)!.x).toBeGreaterThanOrEqual(390);
  });
});

describe('fond de connexion : nœuds cerclés et ondes', () => {
  it('environ un nœud sur deux est cerclé, porte une onde et un libellé de référentiel', () => {
    const n = noeuds(
      5,
      Array.from({ length: 200 }, (_, i) => ({ i, x: i, y: 0 })),
    );
    const cercles = n.filter((x) => x.cercle);
    expect(cercles.length).toBeGreaterThan(n.length * 0.25);
    expect(cercles.length).toBeLessThan(n.length * 0.75);
    for (const c of cercles) {
      expect(LIBELLES).toContain(c.libelle);
      expect(c.onde!.r).toBeGreaterThanOrEqual(9);
      expect(c.onde!.r).toBeLessThan(23);
      expect(c.onde!.opacite).toBeGreaterThan(0);
      expect(c.onde!.opacite).toBeLessThanOrEqual(1);
    }
    for (const x of n.filter((y) => !y.cercle)) expect([x.onde, x.libelle]).toEqual([null, null]);
  });
  it('l’onde s’élargit et s’efface avec le temps', () => {
    const p = courbePrincipale(0, L, H);
    const a = noeuds(0, p).find((x) => x.cercle && x.onde!.opacite > 0.5)!;
    const b = noeuds(0.2, p).find((x) => x.x === a.x)!;
    expect(b.onde!.r).toBeGreaterThan(a.onde!.r);
    expect(b.onde!.opacite).toBeLessThan(a.onde!.opacite);
  });
  it('libellés : ISO 27001, HDS, NIS 2, RGPD, ISO 9001, EBIOS RM', () => {
    expect([...LIBELLES]).toEqual(['ISO 27001', 'HDS', 'NIS 2', 'RGPD', 'ISO 9001', 'EBIOS RM']);
  });
});

describe('fond de connexion : palettes et mouvement', () => {
  const css = readFileSync(new URL('../../../packages/ui/src/styles.css', import.meta.url), 'utf8');
  it('sombre : tout en turquoise de la navigation ; clair : structure en vert, accents en turquoise', () => {
    for (const [v] of Object.values(PALETTES.sombre)) expect(v).toBe('--suivi-turquoise-nav');
    const clair = PALETTES.clair;
    for (const k of ['grille', 'ligne', 'anneau', 'point'] as const) expect(clair[k][0]).toBe('--suivi-nav-fond');
    for (const k of ['barre', 'pointille', 'texte'] as const) expect(clair[k][0]).toBe('--suivi-nav-active');
    for (const k of ['halo', 'lueur', 'ombre', 'centre', 'onde'] as const)
      expect(clair[k][0]).toBe('--suivi-turquoise');
  });
  it('chaque teinte est une variable définie par la charte, avec une opacité entre 0 et 1', () => {
    for (const p of Object.values(PALETTES))
      for (const [v, a] of Object.values(p)) {
        expect(css).toContain(`${v}:`);
        expect(a).toBeGreaterThan(0);
        expect(a).toBeLessThanOrEqual(1);
      }
  });
  it('rien sous un automate ni à l’impression ; image fixe si moins de mouvement est demandé', () => {
    const base = { webdriver: false, impression: false, mouvementReduit: false };
    expect(modeAnimation(base)).toBe('anime');
    expect(modeAnimation({ ...base, mouvementReduit: true })).toBe('fixe');
    expect(modeAnimation({ ...base, webdriver: true })).toBe('aucun');
    expect(modeAnimation({ ...base, impression: true, mouvementReduit: true })).toBe('aucun');
  });
  it('30 images par seconde au plus (une image sur deux à 60 Hz)', () => {
    let derniere = -Infinity;
    let images = 0;
    for (let k = 0; k < 600; k++) {
      const m = (k * 1000) / 60;
      if (imageDue(m, derniere)) {
        derniere = m;
        images++;
      }
    }
    expect(images).toBe(300);
    expect(imageDue(10, 0)).toBe(false);
  });
});
