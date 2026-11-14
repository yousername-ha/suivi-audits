import { describe, expect, it } from 'vitest';
import { compterMois, journalNeon } from '../src/components/neon-donnees';
describe('agrégations de présentation Neon', () => {
  it('compte les mois présents avec leur année, sans fabriquer de mois intermédiaires', () => {
    expect(
      compterMois([{ date: '2025-12-02' }, { date: '2026-01-03' }, { date: '2025-12-09' }, { date: 'inconnue' }]),
    ).toEqual([
      { libelle: '2025-12', valeur: 2 },
      { libelle: '2026-01', valeur: 1 },
    ]);
  });
  it('conserve chaque événement dans les intervalles chronologiques, autres catégories comprises', () => {
    const lignes = ['a', 'b', 'c', 'd', 'e', 'f'].map((action, i) => ({
      ts: `2026-01-01T00:00:0${i}Z`,
      action: action + '.cree',
    }));
    const s = journalNeon([...lignes, { ts: '?', action: 'inconnue' }]);
    expect(s.series.reduce((n, g) => n + g.valeurs.reduce((a, b) => a + b, 0), 0)).toBe(6);
    expect(s.series).toHaveLength(5);
    expect(s.series.at(-1)?.libelle).toBe('Autres');
  });
  it('conserve les événements simultanés et distingue un journal vide', () => {
    expect(journalNeon([]).series).toEqual([]);
    const s = journalNeon([
      { ts: '2026-01-01T00:00:00Z', action: 'a.x' },
      { ts: '2026-01-01T00:00:00Z', action: 'a.y' },
    ]);
    expect(s.series[0]?.valeurs[0]).toBe(2);
  });
});
