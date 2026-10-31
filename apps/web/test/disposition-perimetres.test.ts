/* Disposition du graphe des périmètres : feuilles de gauche à droite, parent centré sur ses enfants, aucune carte ne
   chevauche sa voisine, y compris pour un grand arbre ou des noms longs. */
import { describe, expect, it } from 'vitest';
import type { CartePerimetre } from '@suivi/shared';
import { disposer, LARGEUR_CARTE_PERIMETRE, HAUTEUR_CARTE_PERIMETRE } from '../src/pilotage/CartesPerimetres';

const vide = { actions: null, recurrentes: null, ecarts: null, continuite: null, couverture: null };
const carte = (id: string, parentId: string | null, name = id): CartePerimetre => ({
  id,
  name,
  parentId,
  nature: '',
  entityKind: 'perimetre',
  compteurs: vide,
  total: vide,
  sousPerimetres: 0,
});

describe('disposer', () => {
  it('centre le parent entre son premier et son dernier enfant', () => {
    const { places } = disposer([carte('p', null), carte('a', 'p'), carte('b', 'p'), carte('c', 'p')]);
    const x = (id: string) => places.find((q) => q.carte.id === id)!.x;
    expect(x('p')).toBe((x('a') + x('c')) / 2);
    expect(x('b')).toBeGreaterThan(x('a'));
  });

  it('ne superpose aucune carte, même sur un grand arbre à noms longs', () => {
    const cartes: CartePerimetre[] = [carte('racine', null, 'Organisation très très longue '.repeat(6))];
    for (let i = 0; i < 12; i++) {
      cartes.push(carte(`e${i}`, 'racine', `Entité ${i} avec un intitulé particulièrement long`));
      for (let j = 0; j < 4; j++) cartes.push(carte(`e${i}-${j}`, `e${i}`, `Sous-périmètre ${i}.${j}`));
    }
    const { places, largeur } = disposer(cartes);
    expect(places).toHaveLength(cartes.length);
    // Deux cartes d'un même niveau ne se recouvrent pas : leurs abscisses diffèrent d'au moins une largeur de carte.
    const niveaux = [...new Set(places.map((p) => p.y))];
    for (const y of niveaux) {
      const xs = places
        .filter((p) => p.y === y)
        .map((p) => p.x)
        .sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(LARGEUR_CARTE_PERIMETRE);
    }
    for (const parent of places)
      for (const enfant of places.filter((p) => p.parent === parent.carte.id))
        expect(enfant.y).toBeGreaterThanOrEqual(parent.y + HAUTEUR_CARTE_PERIMETRE);
    expect(Math.max(...places.map((p) => p.x)) + LARGEUR_CARTE_PERIMETRE).toBeLessThanOrEqual(largeur);
  });

  it('un périmètre sans parent accessible devient une racine', () => {
    const { places } = disposer([carte('a', 'inconnu'), carte('b', null)]);
    expect(places.map((p) => p.y)).toEqual([0, 0]);
  });
});
