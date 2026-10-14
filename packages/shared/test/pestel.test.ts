/* PESTEL, séries proposées et parties intéressées : fonctions pures. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  PESTEL_PAR_DEFAUT,
  SERIES_PROPOSEES,
  regrouperPestel,
  syntheseParties,
  type EnjeuPestel,
} from '../src/pestel.js';

const enjeu = (label: string, nature: 'ext' | 'int', facteur: string | null): EnjeuPestel => ({
  ref: 'issue:' + label,
  label,
  nature,
  description: '',
  processus: [],
  facteur,
});
describe('PESTEL', () => {
  it('regroupe les enjeux externes par facteur et laisse les internes hors PESTEL', () => {
    const vue = regrouperPestel(
      [enjeu('a', 'ext', 'legal'), enjeu('b', 'ext', null), enjeu('c', 'int', 'legal'), enjeu('d', 'ext', 'disparu')],
      PESTEL_PAR_DEFAUT,
    );
    expect(vue.parFacteur.find((f) => f.facteur.id === 'legal')!.enjeux.map((e) => e.label)).toEqual(['a']);
    expect(vue.nonClasses.map((e) => e.label)).toEqual(['b', 'd']);
    expect(vue.internes.map((e) => e.label)).toEqual(['c']);
    expect(vue.parFacteur).toHaveLength(6);
  });
});
describe('séries proposées', () => {
  it('ne portent ni fréquence ni date, seulement l’article de la norme qui les motive', () => {
    expect(SERIES_PROPOSEES).toHaveLength(8);
    for (const s of SERIES_PROPOSEES) expect(Object.keys(s).sort()).toEqual(['article', 'description', 'id', 'titre']);
    expect(new Set(SERIES_PROPOSEES.map((s) => s.id)).size).toBe(8);
  });
});
describe('parties intéressées', () => {
  it('compte les exigences traitées et les parties non revues depuis un an', () => {
    expect(
      syntheseParties(
        [
          { addressed: 'Oui', reviewed: '2026-09-01' },
          { addressed: 'Partiel', reviewed: '2024-01-01' },
          { addressed: 'Non' },
          { addressed: '', reviewed: '2026-10-01' },
        ],
        '2026-10-13',
      ),
    ).toEqual({ total: 4, traitees: 1, partielles: 2, nonRevues: 2 });
  });
});
