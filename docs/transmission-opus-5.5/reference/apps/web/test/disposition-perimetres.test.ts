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
  it('écarte chaque niveau selon sa plus haute dalle, même après ouverture des détails', () => {
    const cartes = [carte('p', null), carte('a', 'p'), carte('b', 'p'), carte('c', 'a')];
    const { places, hauteur } = disposer(cartes, { p: 1320, a: 1700, b: 950, c: 810 });
    const p = (id: string) => places.find((place) => place.carte.id === id)!;
    expect(p('a').y).toBeGreaterThan(p('p').y + 1320);
    expect(p('a').y).toBe(p('b').y);
    expect(p('c').y).toBeGreaterThan(p('a').y + 1700);
    expect(hauteur).toBe(p('c').y + 810);
    expect(p('b').hauteur).toBe(950);
  });

  it('garde une hiérarchie profonde lisible en colonne, sans chevauchement après dépliage', () => {
    const cartes = [carte('p', null), carte('a', 'p'), carte('b', 'a'), carte('c', 'b'), carte('d', 'p')];
    const { places, largeur, hauteur } = disposer(
      cartes,
      { p: 194, a: 730, b: 210, c: 225, d: 194 },
      {
        vertical: true,
        largeurCarte: 230,
      },
    );
    expect(places.map((p) => p.carte.id)).toEqual(['p', 'a', 'b', 'c', 'd']);
    for (let i = 1; i < places.length; i++) {
      expect(places[i]!.y).toBeGreaterThan(places[i - 1]!.y + places[i - 1]!.hauteur);
      expect(places[i]!.x + 230).toBeLessThanOrEqual(largeur);
    }
    expect(largeur).toBeLessThanOrEqual(262);
    expect(hauteur).toBe(places.at(-1)!.y + places.at(-1)!.hauteur);
  });

  it('répartit plusieurs arbres en rangées tout en gardant les liens et les hauteurs dépliées', () => {
    const cartes = [carte('p', null), carte('a', 'p'), carte('b', 'p'), carte('q', null), carte('r', null)];
    const { places, largeur, hauteur } = disposer(
      cartes,
      { p: 700, a: 194, b: 194, q: 200, r: 194 },
      { largeurMax: 832 },
    );
    expect(largeur).toBeLessThanOrEqual(832);
    expect(places.find((p) => p.carte.id === 'r')!.y).toBeGreaterThan(0);
    expect(places.find((p) => p.carte.id === 'a')!.parent).toBe('p');
    for (let i = 0; i < places.length; i++)
      for (let j = i + 1; j < places.length; j++) {
        const a = places[i]!,
          b = places[j]!;
        expect(
          a.x >= b.x + LARGEUR_CARTE_PERIMETRE ||
            b.x >= a.x + LARGEUR_CARTE_PERIMETRE ||
            a.y >= b.y + b.hauteur ||
            b.y >= a.y + a.hauteur,
        ).toBe(true);
      }
    expect(hauteur).toBe(Math.max(...places.map((p) => p.y + p.hauteur)));
  });

  it('réserve la largeur des cartes ouvertes, y compris aux parents de sous-arbres voisins', () => {
    const cartes = [
      carte('p', null),
      carte('a', 'p'),
      carte('b', 'p'),
      carte('c', 'a'),
      carte('d', 'b'),
      carte('q', null),
    ];
    const { places, largeur } = disposer(
      cartes,
      { a: 390, d: 420 },
      {
        largeurs: { p: 620, a: 620, d: 620, q: 620 },
        largeurMax: 1250,
      },
    );
    for (const place of places) {
      expect(place.x).toBeGreaterThanOrEqual(0);
      expect(place.x + place.largeur).toBeLessThanOrEqual(largeur);
      for (const autre of places.filter((p) => p !== place)) {
        expect(
          place.x >= autre.x + autre.largeur ||
            autre.x >= place.x + place.largeur ||
            place.y >= autre.y + autre.hauteur ||
            autre.y >= place.y + place.hauteur,
        ).toBe(true);
      }
    }
    expect(places.find((p) => p.carte.id === 'a')!.largeur).toBe(620);
    expect(places.find((p) => p.carte.id === 'b')!.largeur).toBe(LARGEUR_CARTE_PERIMETRE);
  });

  it('recadre une carte racine plus large que tous ses enfants sans coordonnées négatives', () => {
    const { places, largeur } = disposer([carte('p', null), carte('a', 'p')], {}, { largeurs: { p: 620 } });
    const parent = places.find((p) => p.carte.id === 'p')!,
      enfant = places.find((p) => p.carte.id === 'a')!;
    expect(parent.x + parent.largeur / 2).toBe(enfant.x + enfant.largeur / 2);
    expect(parent.x).toBe(0);
    expect(largeur).toBe(620);
  });
});
