import { describe, expect, it } from 'vitest';
import { RESULTATS_MAX, trouverPages, type PageMenu } from '../src/components/recherche-menu';

const pages: PageMenu[] = [
  { to: '/', label: 'Tableau de bord', groupe: 'Espace de travail' },
  { to: '/pilotage/controles', label: 'Preuves et contrôles', groupe: 'Conformité et audits' },
  { to: '/pilotage/fournisseurs', label: 'Fournisseurs', groupe: 'Organisation' },
  { to: '/pilotage/perimetres', label: 'Périmètres', groupe: 'Organisation' },
  { to: '/systeme', label: 'Configuration système', groupe: 'Compte et administration' },
];

describe('recherche de pages du menu', () => {
  it('ne propose rien sans saisie', () => {
    expect(trouverPages(pages, '')).toEqual([]);
    expect(trouverPages(pages, '   ')).toEqual([]);
  });

  it('ignore les accents et la casse', () => {
    expect(trouverPages(pages, 'CONTROLE').map((p) => p.to)).toEqual(['/pilotage/controles']);
    expect(trouverPages(pages, 'perimetre').map((p) => p.to)).toEqual(['/pilotage/perimetres']);
  });

  it('place les pages trouvées par leur nom avant celles trouvées par leur famille', () => {
    expect(trouverPages(pages, 'organisation').map((p) => p.to)).toEqual([
      '/pilotage/fournisseurs',
      '/pilotage/perimetres',
    ]);
    expect(trouverPages(pages, 'syst').map((p) => p.to)).toEqual(['/systeme']);
  });

  it('ne montre une page qu’une fois et limite la liste', () => {
    const doublons = [...pages, pages[2]!];
    expect(trouverPages(doublons, 'fourn')).toHaveLength(1);
    const nombreuses = Array.from({ length: 20 }, (_, i) => ({ to: `/p${i}`, label: `Page ${i}`, groupe: 'G' }));
    expect(trouverPages(nombreuses, 'page')).toHaveLength(RESULTATS_MAX);
  });
});
