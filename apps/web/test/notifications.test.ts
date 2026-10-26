/* Libellés des notifications : l'origine du résultat est écrite en toutes lettres, jamais par la couleur seule. */
import { describe, expect, it } from 'vitest';
import { textOrigine, textSources } from '../src/notifications/libelles';

describe('origine d’un résultat de notification', () => {
  it('dit le groupe ou le rôle en toutes lettres', () => {
    const sources = [
      { kind: 'groupe', id: 'g', nom: 'Équipe qualité' },
      { kind: 'role', id: 'contributeur', nom: 'Contributeur' },
    ] as const;
    expect(textSources(sources)).toBe('groupe « Équipe qualité », rôle « Contributeur »');
    expect(textOrigine('groupe', sources)).toContain('groupe « Équipe qualité »');
  });
  it('distingue « votre » et « son » réglage personnel, et la valeur par défaut', () => {
    expect(textOrigine('utilisateur', [], 'votre')).toBe('votre réglage personnel');
    expect(textOrigine('utilisateur', [])).toBe('son réglage personnel');
    expect(textOrigine('defaut', [])).toBe('valeur par défaut');
  });
});
