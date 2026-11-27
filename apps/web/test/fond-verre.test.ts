import { describe, expect, it } from 'vitest';
import { appliquerFond, ecrireFond, fondSuivant, lireFond } from '../src/fond-verre';

const memoire = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('essai du fond bleu nuit (refonte Verre)', () => {
  it('lit « actuel » par défaut, « bleu » une fois choisi', () => {
    const s = memoire();
    expect(lireFond(s)).toBe('actuel');
    ecrireFond('bleu', s);
    expect(lireFond(s)).toBe('bleu');
  });
  it('reste sur le fond actuel si le stockage est bloqué', () => {
    const bloque = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
    };
    expect(lireFond(bloque)).toBe('actuel');
    expect(() => ecrireFond('bleu', bloque)).not.toThrow();
  });
  it('bascule entre les deux fonds', () => {
    expect(fondSuivant('actuel')).toBe('bleu');
    expect(fondSuivant('bleu')).toBe('actuel');
  });
  it('pose et retire l’attribut data-fond de <html>', () => {
    const html = { dataset: {} as DOMStringMap } as HTMLElement;
    appliquerFond(html, 'bleu');
    expect(html.dataset.fond).toBe('bleu');
    appliquerFond(html, 'actuel');
    expect(html.dataset.fond).toBeUndefined();
  });
});
