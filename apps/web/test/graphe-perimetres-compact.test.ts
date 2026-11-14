/* Graphe compact des périmètres (refonte Neon, lot 3) : disposition sur les dimensions réelles des cartes (dépliées en
   largeur, hauteurs mesurées), rangées d'arbres indépendants, hiérarchie verticale, colonne des fournisseurs extérieurs,
   cadrage centré et valeurs résumées (jamais un zéro fictif). Données fictives. */
import { describe, expect, it } from 'vitest';
import type { CartePerimetre } from '@suivi/shared';
import {
  cadrer,
  cheminLien,
  disposer,
  ECART_X,
  ECART_Y,
  HAUTEUR_FOURNISSEUR,
  LARGEUR_CARTE,
  LARGEUR_CARTE_DEPLIEE,
  LARGEUR_FOURNISSEUR,
  MARGE_GRAPHE,
  partEnRetard,
  placerFournisseurs,
  pourcentageCouverture,
  type Place,
} from '../src/pilotage/disposition-perimetres';

const vide = { actions: null, recurrentes: null, ecarts: null, continuite: null, couverture: null };
const carte = (id: string, parentId: string | null): CartePerimetre => ({
  id,
  name: id,
  parentId,
  nature: '',
  entityKind: 'organisation',
  supplierId: null,
  compteurs: vide,
  total: vide,
  sousPerimetres: 0,
});
const place = (places: Place[], id: string) => places.find((p) => p.carte.id === id)!;
/** Aucune carte d'une même rangée horizontale ne recouvre sa voisine, écart compris. */
function sansChevauchement(places: Place[]) {
  for (const a of places)
    for (const b of places) {
      if (a === b) continue;
      const memeBande = a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
      const memeColonne = a.x < b.x + b.largeur + ECART_X && b.x < a.x + a.largeur + ECART_X;
      expect(memeBande && memeColonne, `${a.carte.id} recouvre ${b.carte.id}`).toBe(false);
    }
}

describe('disposer : dimensions réelles', () => {
  it('une carte dépliée en largeur écarte ses voisines, sans chevauchement', () => {
    const cartes = [carte('p', null), carte('a', 'p'), carte('b', 'p'), carte('c', 'p')];
    const { places } = disposer(cartes, {}, { largeurs: { b: LARGEUR_CARTE_DEPLIEE } });
    expect(place(places, 'b').largeur).toBe(LARGEUR_CARTE_DEPLIEE);
    expect(place(places, 'c').x).toBe(place(places, 'b').x + LARGEUR_CARTE_DEPLIEE + ECART_X);
    sansChevauchement(places);
  });

  it('plusieurs cartes dépliées d’un même niveau ne se recouvrent pas', () => {
    const cartes = [carte('r', null)];
    for (let i = 0; i < 5; i++) cartes.push(carte(`e${i}`, 'r'));
    for (let i = 0; i < 5; i++) cartes.push(carte(`e${i}-a`, `e${i}`), carte(`e${i}-b`, `e${i}`));
    const largeurs = { e1: LARGEUR_CARTE_DEPLIEE, e3: LARGEUR_CARTE_DEPLIEE, 'e4-b': LARGEUR_CARTE_DEPLIEE };
    sansChevauchement(disposer(cartes, {}, { largeurs }).places);
  });

  it('un parent plus large que son enfant reste centré sur lui', () => {
    const { places } = disposer([carte('p', null), carte('a', 'p')], {}, { largeurs: { p: LARGEUR_CARTE_DEPLIEE } });
    const centre = (p: Place) => p.x + p.largeur / 2;
    expect(centre(place(places, 'p'))).toBe(centre(place(places, 'a')));
  });

  it('chaque niveau commence sous la carte la plus haute du niveau précédent', () => {
    const { places, hauteur } = disposer([carte('p', null), carte('a', 'p'), carte('b', 'p')], {
      p: 410,
      a: 200,
      b: 300,
    });
    expect(place(places, 'a').y).toBe(410 + ECART_Y);
    expect(place(places, 'b').y).toBe(410 + ECART_Y);
    expect(hauteur).toBe(410 + ECART_Y + 300);
  });
});

describe('disposer : rangées et hiérarchie verticale', () => {
  it('les arbres indépendants passent à la rangée suivante au-delà de la largeur disponible', () => {
    const cartes = ['a', 'b', 'c', 'd'].map((id) => carte(id, null));
    const largeurMax = LARGEUR_CARTE * 2 + ECART_X;
    const { places, largeur } = disposer(cartes, { a: 250, b: 320, c: 200, d: 200 }, { largeurMax });
    expect(place(places, 'a').y).toBe(0);
    expect(place(places, 'b').y).toBe(0);
    // Deuxième rangée : sous la plus haute carte de la première.
    expect(place(places, 'c').y).toBe(320 + ECART_Y);
    expect(place(places, 'c').x).toBe(0);
    expect(largeur).toBeLessThanOrEqual(largeurMax);
    sansChevauchement(places);
  });

  it('chaque rangée est centrée sur la plus large', () => {
    const cartes = [carte('a', null), carte('a1', 'a'), carte('a2', 'a'), carte('b', null)];
    const largeurMax = LARGEUR_CARTE * 2 + ECART_X;
    const { places } = disposer(cartes, {}, { largeurMax });
    expect(place(places, 'a1').x).toBe(0);
    expect(place(places, 'b').x).toBe((largeurMax - LARGEUR_CARTE) / 2);
    expect(place(places, 'b').y).toBeGreaterThan(place(places, 'a1').y);
  });

  it('sans largeur maximale, une seule rangée', () => {
    const { places } = disposer(['a', 'b', 'c'].map((id) => carte(id, null)));
    expect(new Set(places.map((p) => p.y))).toEqual(new Set([0]));
  });

  it('écran étroit : une carte sous l’autre, retrait limité à deux niveaux', () => {
    const cartes = [carte('r', null), carte('e', 'r'), carte('s', 'e'), carte('t', 's')];
    const { places, hauteur } = disposer(
      cartes,
      { r: 100, e: 120, s: 80, t: 90 },
      { vertical: true, largeurCarte: 240 },
    );
    expect(places.map((p) => p.carte.id)).toEqual(['r', 'e', 's', 't']);
    expect(places.map((p) => p.x)).toEqual([0, 16, 32, 32]);
    expect(place(places, 'e').y).toBe(100 + 24);
    expect(hauteur).toBe(100 + 120 + 80 + 90 + 3 * 24);
    expect(places.every((p) => p.largeur === 240)).toBe(true);
  });

  it('liaison : du bas du parent au haut de l’enfant, en arbre ; vers le flanc de l’enfant, en vertical', () => {
    const { places } = disposer([carte('p', null), carte('a', 'p')], { p: 100, a: 100 });
    const d = cheminLien(place(places, 'p'), place(places, 'a'), false);
    expect(d.startsWith(`M${LARGEUR_CARTE / 2} 100`)).toBe(true);
    expect(d.endsWith(`V${100 + ECART_Y}`)).toBe(true);
    const v = disposer([carte('p', null), carte('a', 'p')], { p: 100, a: 100 }, { vertical: true }).places;
    expect(cheminLien(place(v, 'p'), place(v, 'a'), true).endsWith('H16')).toBe(true);
  });
});

describe('fournisseurs extérieurs', () => {
  it('colonne à droite de l’arbre, à hauteur du premier périmètre rattaché, sans chevauchement', () => {
    const { places, largeur, hauteur } = disposer([carte('p', null), carte('a', 'p')], { p: 200, a: 200 });
    const { placees, colonneX, bas } = placerFournisseurs(
      [
        { id: 'f1', scopes: ['a'] },
        { id: 'f2', scopes: ['a'] },
        { id: 'f3', scopes: ['inconnu'] },
      ],
      places,
      { vertical: false, largeurArbre: largeur, hauteurArbre: hauteur },
    );
    expect(placees.map((f) => f.fournisseur.id)).toEqual(['f1', 'f2']);
    expect(colonneX).toBeGreaterThan(largeur);
    expect(placees[0]!.y).toBe(place(places, 'a').y + 100 - HAUTEUR_FOURNISSEUR / 2);
    expect(placees[1]!.y).toBeGreaterThanOrEqual(placees[0]!.y + HAUTEUR_FOURNISSEUR);
    expect(bas).toBe(placees[1]!.y + HAUTEUR_FOURNISSEUR);
  });

  it('écran étroit : sous l’arbre, alignés à droite', () => {
    const { places, largeur, hauteur } = disposer([carte('p', null)], { p: 150 }, { vertical: true });
    const { placees } = placerFournisseurs([{ id: 'f', scopes: ['p'] }], places, {
      vertical: true,
      largeurArbre: largeur,
      hauteurArbre: hauteur,
    });
    expect(placees[0]!.y).toBeGreaterThan(hauteur);
    expect(placees[0]!.x + LARGEUR_FOURNISSEUR).toBeLessThanOrEqual(Math.max(largeur, LARGEUR_FOURNISSEUR));
  });
});

describe('cadrer', () => {
  it('taille réelle par défaut, sans réduction globale : un graphe trop large défile ; « Ajuster » le fait tenir', () => {
    const large = cadrer({ largeurZone: 1000, largeur: 1904, hauteur: 600, zoom: null, vertical: false });
    expect(large.echelle).toBe(1);
    expect(large.largeurCadre).toBe(1904 + MARGE_GRAPHE * 2);
    expect(large.origineX).toBe(MARGE_GRAPHE);
    expect(large.ajustee).toBe(0.5);
    const ajuste = cadrer({ largeurZone: 1000, largeur: 1904, hauteur: 600, zoom: large.ajustee, vertical: false });
    expect(ajuste.largeurCadre).toBe(1000);
    expect(ajuste.origineX).toBe(MARGE_GRAPHE);
    const petit = cadrer({ largeurZone: 1000, largeur: 264, hauteur: 200, zoom: null, vertical: false });
    expect(petit.echelle).toBe(1);
    expect(petit.origineX).toBe((1000 - 264) / 2);
    expect(petit.origineY).toBe((petit.hauteurCadre - 200) / 2);
  });

  it('un graphe à peine plus large que la zone garde la zone : seules les marges se resserrent', () => {
    const c = cadrer({ largeurZone: 1000, largeur: 990, hauteur: 300, zoom: null, vertical: false });
    expect(c.largeurCadre).toBe(1000);
    expect(c.origineX).toBe(5);
  });

  it('respecte le zoom choisi et le déplacement', () => {
    const c = cadrer({
      largeurZone: 800,
      largeur: 500,
      hauteur: 300,
      zoom: 2,
      vertical: true,
      decalage: { x: 10, y: -5 },
    });
    expect(c.echelle).toBe(2);
    expect(c.hauteurCadre).toBe(300 * 2 + MARGE_GRAPHE * 2);
    expect(c.largeurCadre).toBe(1000 + MARGE_GRAPHE * 2);
    expect(c.origineX).toBe(MARGE_GRAPHE + 10);
    expect(c.origineY).toBe(MARGE_GRAPHE - 5);
  });
});

describe('valeurs résumées', () => {
  it('couverture : indisponible sans exigence applicable, jamais 0 % fictif', () => {
    expect(pourcentageCouverture(null)).toBeNull();
    expect(pourcentageCouverture({ testees: 0, applicables: 0 })).toBeNull();
    expect(pourcentageCouverture({ testees: 0, applicables: 12 })).toBe(0);
    expect(pourcentageCouverture({ testees: 2, applicables: 3 })).toBe(67);
    expect(pourcentageCouverture({ testees: 5, applicables: 3 })).toBe(100);
  });

  it('jauge des retards : piste vide sans élément ouvert', () => {
    expect(partEnRetard({ ouverts: 0, enRetard: 0 })).toBe(0);
    expect(partEnRetard({ ouverts: 4, enRetard: 1 })).toBe(25);
    expect(partEnRetard({ ouverts: 2, enRetard: 5 })).toBe(100);
  });
});
