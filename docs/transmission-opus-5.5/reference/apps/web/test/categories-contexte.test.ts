import { describe, expect, it } from 'vitest';
import { repartirContexte } from '../src/pilotage/categories-contexte';

describe('catégories explicites de la fiche Contexte', () => {
  it('sépare les préfixes internes et externes, sans déduire la nature des autres enjeux', () => {
    expect(
      repartirContexte('Interne : Compétences\n[Externe] Réglementation\nDépendance à un hébergeur', 'issues'),
    ).toEqual({
      premier: 'Compétences',
      second: 'Réglementation',
      aPreciser: 'Dépendance à un hébergeur',
    });
  });
  it('respecte les titres explicites, les accents et les listes sur plusieurs lignes', () => {
    expect(
      repartirContexte('ENJEUX INTERNES :\r\nCulture\r\nCompétences\r\nEnjeux externes\r\nMarché', 'issues'),
    ).toEqual({
      premier: 'Culture\nCompétences',
      second: 'Marché',
      aPreciser: '',
    });
  });
  it('distingue les interfaces des dépendances, sans scinder le contenu enregistré', () => {
    expect(
      repartirContexte('Interfaces :\nÉditeur (dossiers, imagerie)\nDÉPENDANCES :\nRéseau 1,5 Gbit/s', 'interfaces'),
    ).toEqual({
      premier: 'Éditeur (dossiers, imagerie)',
      second: 'Réseau 1,5 Gbit/s',
      aPreciser: '',
    });
  });
  it('garde les textes historiques non classés et les intitulés qui contiennent interne ou externe', () => {
    const texte = 'Culture interne\nRéglementation externe\nCompétences internes et environnement externe';
    expect(repartirContexte(texte, 'issues')).toEqual({ premier: '', second: '', aPreciser: texte });
  });
  it('ne confond pas les familles et ne traite pas les propriétés JavaScript comme des catégories', () => {
    const texte = 'Dépendance : SI\nconstructor\n__proto__\ntoString';
    expect(repartirContexte(texte, 'issues')).toEqual({ premier: '', second: '', aPreciser: texte });
  });
  it('reconnaît les préfixes dans les puces et le retour explicite à la catégorie À préciser', () => {
    expect(
      repartirContexte('- [Interface] Flux partenaire\nDépendances\nÉnergie\n[À préciser]\nPrestataire', 'interfaces'),
    ).toEqual({
      premier: 'Flux partenaire',
      second: 'Énergie',
      aPreciser: 'Prestataire',
    });
  });
  it('ne fabrique pas de contenu pour un texte vide', () => {
    expect(repartirContexte('', 'issues')).toEqual({ premier: '', second: '', aPreciser: '' });
  });
});
