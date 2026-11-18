/* Module Vulnérabilités (ADR 0100, lot PC1) : mise en page du radar « Situation tactique ». Déterminisme (même faille, même
   place d'un chargement à l'autre, quel que soit l'ordre d'arrivée), stabilité (une faille d'une autre case ne déplace
   rien), aucun chevauchement entre points ni avec les pastilles, chaque point dans son anneau (priorité) et son secteur,
   regroupement au-delà de la capacité d'une case (les plus prioritaires restent individuels, la pastille compte aussi ce que
   la route n'a pas rendu), étiquettes peu nombreuses, sans chevauchement et dans la scène. Données fictives : 300 failles
   réparties sur les quatre priorités et les sept secteurs. */
import {
  type CaseRadarDto,
  type CibleVueDto,
  comparerCibles,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  SECTEURS_RADAR,
  type SecteurRadar,
} from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import {
  ANNEAUX,
  angleSecteur,
  disposerRadar,
  emplacements,
  empreinte,
  ESPACE,
  ETIQUETTES_MAX,
  nomPoint,
  POINT_MAX,
  rayonPoint,
  VUE,
} from '../src/vulnerabilites/radar';

const cible = (
  n: number,
  niveau: NiveauPriorite,
  secteur: SecteurRadar,
  c: Partial<CibleVueDto> = {},
): CibleVueDto => ({
  cle: `CVE-2026-${String(90000 + n)}`,
  cve: `CVE-2026-${String(90000 + n)}`,
  titre: `Fictional Product ${n} vulnerability`,
  produit: `Produit fictif ${n}`,
  secteur,
  priorite: { niveau, faits: [] },
  presences: ['detectee'],
  exploitee: niveau === 'P1',
  exploitable: false,
  aConfirmer: false,
  gravite: niveau === 'P4' ? 'moyenne' : 'critique',
  epss: (n % 100) / 100,
  etat: 'nouvelle',
  machines: { lisibles: n % 12, horsLecture: n % 5 === 0 },
  actifs: { lisibles: 0, horsLecture: false },
  produitId: null,
  fiche: null,
  ...c,
});
/** 300 failles : 15 P1, 60 P2, 105 P3, 120 P4 ; la moitié sans produit rapproché (« Non classé », comme un parc lu
    surtout par Tenable), le reste réparti sur les sept secteurs. */
function jeu(): CibleVueDto[] {
  const out: CibleVueDto[] = [];
  const parts: [NiveauPriorite, number][] = [
    ['P1', 15],
    ['P2', 60],
    ['P3', 105],
    ['P4', 120],
  ];
  let n = 0;
  for (const [niveau, combien] of parts)
    for (let i = 0; i < combien; i++, n++)
      out.push(cible(n, niveau, n % 2 ? SECTEURS_RADAR[(n * 3) % SECTEURS_RADAR.length]! : 'non_classe'));
  return out;
}
const casesDe = (cibles: readonly CibleVueDto[], enPlus: Record<string, number> = {}): CaseRadarDto[] => {
  const m = new Map<string, CaseRadarDto>();
  for (const c of cibles) {
    const k = `${c.secteur}|${c.priorite.niveau}`;
    const x = m.get(k) ?? { secteur: c.secteur, priorite: c.priorite.niveau, total: 0 };
    x.total++;
    m.set(k, x);
  }
  for (const [k, n] of Object.entries(enPlus)) m.get(k)!.total += n;
  return [...m.values()];
};
const melanger = <T>(l: readonly T[]) =>
  [...l].sort((a, b) => empreinte(JSON.stringify(a)) - empreinte(JSON.stringify(b)));

describe('emplacements d’une case', () => {
  it('dans leur anneau et leur secteur, séparés d’au moins deux rayons maximaux', () => {
    const tous: { x: number; y: number }[] = [];
    for (const s of SECTEURS_RADAR)
      for (const n of NIVEAUX_PRIORITE) {
        const e = emplacements(s, n);
        expect(e.length, `${s} ${n}`).toBeGreaterThan(0);
        for (const p of e) {
          const r = Math.hypot(p.x, p.y);
          expect(r).toBeGreaterThanOrEqual(ANNEAUX[n][0] + POINT_MAX - 0.1);
          expect(r).toBeLessThanOrEqual(ANNEAUX[n][1] - POINT_MAX + 0.1);
          const a = (Math.atan2(p.x, -p.y) + 2 * Math.PI) % (2 * Math.PI);
          const a0 = angleSecteur(s);
          expect(a).toBeGreaterThanOrEqual(a0 - 1e-6);
          expect(a).toBeLessThanOrEqual(a0 + (2 * Math.PI) / SECTEURS_RADAR.length + 1e-6);
        }
        tous.push(...e);
      }
    for (let i = 0; i < tous.length; i++)
      for (let j = i + 1; j < tous.length; j++)
        expect(Math.hypot(tous[i]!.x - tous[j]!.x, tous[i]!.y - tous[j]!.y)).toBeGreaterThanOrEqual(2 * POINT_MAX);
    expect(ESPACE).toBeGreaterThan(2 * POINT_MAX);
  });
  it('taille selon les machines et actifs lisibles, bornée', () => {
    const t = (m: number, a = 0) =>
      rayonPoint({ machines: { lisibles: m, horsLecture: true }, actifs: { lisibles: a, horsLecture: false } });
    expect(t(0)).toBeLessThan(t(1));
    expect(t(1)).toBeLessThan(t(10));
    expect(t(10_000)).toBe(POINT_MAX);
    expect(t(2, 3)).toBe(t(5));
  });
});

describe('disposerRadar : 300 failles sur quatre priorités', () => {
  const cibles = jeu();
  const scene = disposerRadar(cibles, casesDe(cibles));

  it('chaque point est une faille réelle, une seule fois ; chaque faille est un point ou comptée dans une pastille', () => {
    const cles = scene.points.map((p) => p.cle);
    expect(new Set(cles).size).toBe(cles.length);
    for (const c of cles) expect(cibles.some((x) => x.cle === c)).toBe(true);
    expect(scene.points.length + scene.groupes.reduce((n, g) => n + g.nombre, 0)).toBe(cibles.length);
    expect(scene.points.length).toBeGreaterThan(100);
    expect(scene.groupes.length).toBeGreaterThan(0);
  });
  it('déterministe : mêmes données, mêmes places, quel que soit l’ordre d’arrivée', () => {
    const autre = disposerRadar(melanger(cibles), melanger(casesDe(cibles)));
    expect(autre.points.map((p) => [p.cle, p.x, p.y, p.r]).sort()).toEqual(
      scene.points.map((p) => [p.cle, p.x, p.y, p.r]).sort(),
    );
    expect(autre.groupes).toEqual(scene.groupes);
    expect(autre.etiquettes).toEqual(scene.etiquettes);
  });
  it('stable : une faille de plus dans une autre case ne déplace aucun point', () => {
    const peu = cibles.filter((c) => c.secteur !== 'web' || c.priorite.niveau !== 'P2').slice(0, 40);
    const avant = disposerRadar(peu, casesDe(peu));
    const plus = [...peu, cible(999, 'P2', 'web')];
    const apres = disposerRadar(plus, casesDe(plus));
    for (const p of avant.points) expect(apres.points.find((q) => q.cle === p.cle)).toMatchObject({ x: p.x, y: p.y });
  });
  it('aucun chevauchement : points entre eux et avec les pastilles', () => {
    const formes = [
      ...scene.points.map((p) => ({ x: p.x, y: p.y, r: p.r })),
      ...scene.groupes.map((g) => ({ x: g.x, y: g.y, r: POINT_MAX })),
    ];
    for (let i = 0; i < formes.length; i++)
      for (let j = i + 1; j < formes.length; j++) {
        const a = formes[i]!,
          b = formes[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }
  });
  it('distance au centre = priorité : chaque point dans l’anneau de sa priorité', () => {
    for (const p of scene.points) {
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeGreaterThan(ANNEAUX[p.niveau][0]);
      expect(r).toBeLessThan(ANNEAUX[p.niveau][1]);
    }
  });
  it('regroupement : les plus prioritaires de chaque case restent individuels', () => {
    for (const g of scene.groupes) {
      const dansCase = cibles
        .filter((c) => c.secteur === g.secteur && c.priorite.niveau === g.niveau)
        .sort(comparerCibles);
      const individuels = scene.points.filter((p) => p.cible.secteur === g.secteur && p.niveau === g.niveau);
      expect(individuels.map((p) => p.cle).sort()).toEqual(
        dansCase
          .slice(0, individuels.length)
          .map((c) => c.cle)
          .sort(),
      );
      expect(g.nombre).toBe(dansCase.length - individuels.length);
      expect(g.nom).toMatch(new RegExp(`^${g.nombre} autres? failles? en ${g.niveau}, secteur `));
    }
  });
  it('étiquettes : quelques-unes, pour les plus prioritaires, sans chevauchement et dans la scène', () => {
    expect(scene.etiquettes.length).toBeGreaterThan(0);
    expect(scene.etiquettes.length).toBeLessThanOrEqual(ETIQUETTES_MAX);
    const p1 = scene.points.filter((p) => p.niveau === 'P1').map((p) => p.cle);
    for (const e of scene.etiquettes) expect(p1).toContain(e.cle);
    for (let i = 0; i < scene.etiquettes.length; i++) {
      const a = scene.etiquettes[i]!.boite;
      expect(a.x).toBeGreaterThanOrEqual(VUE.x);
      expect(a.x + a.l).toBeLessThanOrEqual(VUE.x + VUE.l);
      expect(a.y).toBeGreaterThanOrEqual(VUE.y);
      expect(a.y + a.h).toBeLessThanOrEqual(VUE.y + VUE.h);
      for (let j = i + 1; j < scene.etiquettes.length; j++) {
        const b = scene.etiquettes[j]!.boite;
        expect(a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
    }
  });
  it('ordre clavier : tous les points et pastilles, P1 d’abord', () => {
    expect(scene.ordre).toHaveLength(scene.points.length + scene.groupes.length);
    expect(scene.points.find((p) => p.cle === scene.ordre[0])?.niveau).toBe('P1');
  });
  it('nom lisible : priorité, faille, secteur, nombres lisibles, sans total global', () => {
    const c = cible(5, 'P1', 'web', { machines: { lisibles: 3, horsLecture: true } });
    expect(nomPoint(c)).toBe(
      'P1 · CVE-2026-90005 · Fictional Product 5 vulnerability · secteur Web · exploitation avérée · 3 machines lisibles, et d’autres hors de vos droits · EPSS 0,05',
    );
  });
});

describe('disposerRadar : regroupement et failles non rendues par la route', () => {
  it('une case qui déborde : pastille chiffrée, qui compte aussi les failles non rendues', () => {
    const cibles = Array.from({ length: 30 }, (_, i) => cible(i, 'P1', 'non_classe'));
    const scene = disposerRadar(cibles, casesDe(cibles, { 'non_classe|P1': 970 }));
    const g = scene.groupes.find((x) => x.cle === 'non_classe|P1')!;
    expect(g.nombre).toBe(1000 - scene.points.length);
    expect(scene.points.length).toBe(emplacements('non_classe', 'P1').length - 2);
  });
  it('case sans débordement : aucune pastille', () => {
    const cibles = [cible(1, 'P3', 'reseau'), cible(2, 'P3', 'reseau')];
    const scene = disposerRadar(cibles, casesDe(cibles));
    expect(scene.groupes).toEqual([]);
    expect(scene.points).toHaveLength(2);
  });
  it('radar vide : aucun point, aucune pastille, aucune étiquette', () => {
    const scene = disposerRadar([], []);
    expect(scene.points).toEqual([]);
    expect(scene.groupes).toEqual([]);
    expect(scene.etiquettes).toEqual([]);
    expect(scene.secteurs).toHaveLength(SECTEURS_RADAR.length);
  });
});
