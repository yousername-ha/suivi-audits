/* Hiérarchie des périmètres : cycles, profondeur, héritage des référentiels, arbre d'affichage. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  PROFONDEUR_MAX_PERIMETRES,
  aplatir,
  ancetres,
  arbre,
  descendants,
  referentielsEffectifs,
  refusRattachement,
  type NoeudPerimetre,
} from '../src/hierarchie-perimetres.js';

const n = (id: string, parentId: string | null, inheritFrameworks = false): NoeudPerimetre => ({
  id,
  parentId,
  inheritFrameworks,
});
// groupe → (hopital, clinique) ; hopital → labo
const noeuds = [n('groupe', null), n('hopital', 'groupe', true), n('clinique', 'groupe'), n('labo', 'hopital', true)];

describe('arbre parent/enfant', () => {
  it('liste ancêtres et descendants', () => {
    expect(ancetres(noeuds, 'labo')).toEqual(['hopital', 'groupe']);
    expect(ancetres(noeuds, 'groupe')).toEqual([]);
    expect(descendants(noeuds, 'groupe').sort()).toEqual(['clinique', 'hopital', 'labo']);
    expect(descendants(noeuds, 'groupe', true).sort()).toEqual(['hopital', 'labo']);
  });
  it('refuse soi-même, boucle et parent inconnu, accepte la racine', () => {
    expect(refusRattachement(noeuds, 'hopital', 'hopital')).toBe('soi-meme');
    expect(refusRattachement(noeuds, 'groupe', 'labo')).toBe('cycle');
    expect(refusRattachement(noeuds, 'hopital', 'labo')).toBe('cycle');
    expect(refusRattachement(noeuds, 'labo', 'absent')).toBe('inconnu');
    expect(refusRattachement(noeuds, 'labo', null)).toBeNull();
    expect(refusRattachement(noeuds, 'labo', 'clinique')).toBeNull();
  });
  it('limite la profondeur en tenant compte du sous-arbre déplacé', () => {
    const chaine = Array.from({ length: PROFONDEUR_MAX_PERIMETRES }, (_, i) => n('c' + i, i ? 'c' + (i - 1) : null));
    expect(refusRattachement([...chaine, n('x', null)], 'x', 'c' + (PROFONDEUR_MAX_PERIMETRES - 1))).toBe('profondeur');
    expect(refusRattachement([...chaine, n('x', null)], 'x', 'c' + (PROFONDEUR_MAX_PERIMETRES - 2))).toBeNull();
    // Déplacer un nœud qui porte un sous-arbre sous une branche profonde dépasse aussi la limite.
    const avecEnfant = [...chaine, n('y', null), n('z', 'y')];
    expect(refusRattachement(avecEnfant, 'y', 'c' + (PROFONDEUR_MAX_PERIMETRES - 2))).toBe('profondeur');
  });
  it('ne boucle pas sur des données corrompues', () => {
    const cassé = [n('a', 'b'), n('b', 'a')];
    expect(ancetres(cassé, 'a')).toEqual(['b']);
    expect(descendants(cassé, 'a')).toEqual(['b']);
  });
});

describe('référentiels effectifs', () => {
  const r = (origineId: string, frameworkId: string, enabled = true, version = 1) => ({
    origineId,
    frameworkId,
    enabled,
    version,
  });
  it('hérite tant que la chaîne est explicitement ouverte', () => {
    const att = [r('groupe', 'iso27001'), r('hopital', 'hds')];
    const labo = referentielsEffectifs(noeuds, 'labo', att);
    expect(labo.map((x) => [x.frameworkId, x.heritage]).sort()).toEqual([
      ['hds', true],
      ['iso27001', true],
    ]);
    // La clinique n'a pas ouvert l'héritage : elle ne reçoit rien.
    expect(referentielsEffectifs(noeuds, 'clinique', att)).toEqual([]);
    // L'hôpital hérite du groupe mais pas son enfant vers le haut.
    expect(referentielsEffectifs(noeuds, 'groupe', att)).toEqual([{ ...r('groupe', 'iso27001'), heritage: false }]);
  });
  it('le rattachement local l’emporte, y compris désactivé', () => {
    const att = [r('groupe', 'iso27001', true, 1), r('hopital', 'iso27001', false, 2)];
    const h = referentielsEffectifs(noeuds, 'hopital', att);
    expect(h).toEqual([{ ...r('hopital', 'iso27001', false, 2), heritage: false }]);
    // Le laboratoire hérite de la décision de l'hôpital (le plus proche l'emporte).
    expect(referentielsEffectifs(noeuds, 'labo', att)).toEqual([
      { ...r('hopital', 'iso27001', false, 2), heritage: true },
    ]);
  });
});

describe('arbre d’affichage', () => {
  it('ordonne par nom et indente ; un parent non visible rend l’enfant racine', () => {
    const items = [
      { id: 'g', parentId: null, name: 'Groupe' },
      { id: 'b', parentId: 'g', name: 'B' },
      { id: 'a', parentId: 'g', name: 'A' },
      { id: 'o', parentId: 'invisible', name: 'Orphelin' },
    ];
    expect(aplatir(arbre(items)).map((x) => `${x.profondeur}:${x.item.name}`)).toEqual([
      '0:Groupe',
      '1:A',
      '1:B',
      '0:Orphelin',
    ]);
  });
});
