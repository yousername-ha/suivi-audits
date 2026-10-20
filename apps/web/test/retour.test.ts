/* Contexte de retour : chemins internes seulement, liens de fiche, références d'objet. */
import { describe, expect, it } from 'vitest';
import { cheminRetourSur, idObjetDeRef, lienContexte } from '../src/retour';

describe('cheminRetourSur', () => {
  it('accepte un chemin interne, filtres compris', () => {
    expect(cheminRetourSur('/pilotage/ecarts?audit=1&tri=nom')).toBe('/pilotage/ecarts?audit=1&tri=nom');
  });
  it.each([
    'https://exemple.test/',
    '//exemple.test/',
    'javascript:alert(1)',
    '/\\exemple.test',
    '/chemin\nsuite',
    '',
    'pilotage',
  ])('refuse %j', (v) => expect(cheminRetourSur(v)).toBeNull());
  it('refuse l’absence de valeur et les valeurs démesurées', () => {
    expect(cheminRetourSur(null)).toBeNull();
    expect(cheminRetourSur('/' + 'a'.repeat(600))).toBeNull();
  });
});

describe('lienContexte et idObjetDeRef', () => {
  it('encode la page d’origine', () => {
    expect(lienContexte('audits', 'abc', '/pilotage/ecarts?x=1&y=2')).toBe(
      '/pilotage/audits?ouvrir=abc&retour=%2Fpilotage%2Fecarts%3Fx%3D1%26y%3D2',
    );
  });
  it('ne reconnaît que les références d’objet', () => {
    expect(idObjetDeRef('object:11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
    expect(idObjetDeRef('legacy:findings:42')).toBeNull();
    expect(idObjetDeRef(undefined)).toBeNull();
  });
});
