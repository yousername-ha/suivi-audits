/* Disposition du tableau de bord (ADR 0078, lot 2a) : schéma, lecture tolérante, complétion, déplacements. */
import { describe, expect, it } from 'vitest';
import {
  completerDisposition,
  DALLES_TABLEAU_DE_BORD,
  dallesAffichees,
  deplacerDalle,
  deplacerDalleAuClavier,
  Disposition,
  LARGEUR_STANDARD,
  lireDisposition,
  memesDispositions,
  modifierDalle,
  type IdDalle,
} from '../src/disposition-tableau-de-bord.js';

const ids = (d: Disposition) => d.dalles.map((x) => x.id);
const tout = new Set<IdDalle>(DALLES_TABLEAU_DE_BORD);

describe('schéma', () => {
  it('accepte une disposition partielle valide', () => {
    expect(
      Disposition.safeParse({
        dalles: [
          { id: 'ecarts', largeur: 12, masquee: false },
          { id: 'phare', largeur: 6, masquee: true },
        ],
      }).success,
    ).toBe(true);
  });
  it.each([
    ['une dalle inconnue', { dalles: [{ id: 'inconnue', largeur: 4, masquee: false }] }],
    ['une largeur hors liste', { dalles: [{ id: 'phare', largeur: 5, masquee: false }] }],
    [
      'une dalle en double',
      {
        dalles: [
          { id: 'phare', largeur: 6, masquee: false },
          { id: 'phare', largeur: 4, masquee: true },
        ],
      },
    ],
    ['un champ en trop', { dalles: [{ id: 'phare', largeur: 6, masquee: false, valeur: 42 }] }],
    ['un champ en trop à la racine', { dalles: [], donnees: { taux: 80 } }],
    [
      'plus de dalles que le catalogue',
      { dalles: [...DALLES_TABLEAU_DE_BORD, 'phare'].map((id) => ({ id, largeur: 4, masquee: false })) },
    ],
  ])('refuse %s', (_, v) => {
    expect(Disposition.safeParse(v).success).toBe(false);
  });
});

describe('lecture tolérante', () => {
  it('ignore les dalles retirées, en double ou mal formées, sans échouer', () => {
    expect(
      lireDisposition({
        dalles: [
          { id: 'retiree', largeur: 4, masquee: false },
          { id: 'ecarts', largeur: 12, masquee: false },
          { id: 'ecarts', largeur: 3, masquee: true },
          { id: 'phare', largeur: 7, masquee: false },
          'texte',
        ],
      }),
    ).toEqual({ dalles: [{ id: 'ecarts', largeur: 12, masquee: false }] });
    expect(lireDisposition(null)).toEqual({ dalles: [] });
    expect(lireDisposition({ dalles: 'non' })).toEqual({ dalles: [] });
  });
});

describe('complétion', () => {
  it('sans disposition : catalogue dans l’ordre standard, aux largeurs standard ou affichées', () => {
    const d = completerDisposition(null, { indicateurs: 6 });
    expect(ids(d)).toEqual([...DALLES_TABLEAU_DE_BORD]);
    expect(d.dalles.find((x) => x.id === 'indicateurs')!.largeur).toBe(6);
    expect(d.dalles.find((x) => x.id === 'phare')!.largeur).toBe(LARGEUR_STANDARD.phare);
    expect(d.dalles.every((x) => !x.masquee)).toBe(true);
  });
  it('garde l’ordre et les réglages enregistrés, puis ajoute les dalles absentes, affichées', () => {
    const d = completerDisposition({
      dalles: [
        { id: 'echeances', largeur: 12, masquee: false },
        { id: 'phare', largeur: 4, masquee: true },
      ],
    });
    expect(ids(d).slice(0, 2)).toEqual(['echeances', 'phare']);
    expect(d.dalles[1]).toEqual({ id: 'phare', largeur: 4, masquee: true });
    expect(d.dalles).toHaveLength(DALLES_TABLEAU_DE_BORD.length);
    expect(Disposition.safeParse(d).success).toBe(true);
  });
});

describe('affichage et déplacements', () => {
  const base = completerDisposition(null);

  it('n’affiche ni les dalles masquées ni celles sans données', () => {
    const d = modifierDalle(base, 'ecarts', { masquee: true });
    const vues = dallesAffichees(d, new Set<IdDalle>(['phare', 'ecarts', 'echeances']));
    expect(vues.map((x) => x.id)).toEqual(['phare', 'echeances']);
  });

  it('déplace avant ou après une autre dalle', () => {
    expect(ids(deplacerDalle(base, 'echeances', 'phare')).slice(0, 2)).toEqual(['echeances', 'phare']);
    const apres = ids(deplacerDalle(base, 'phare', 'ecarts', true));
    expect(apres.slice(0, 2)).toEqual(['ecarts', 'phare']);
    expect(deplacerDalle(base, 'phare', 'phare')).toBe(base);
  });

  it('au clavier, saute les dalles masquées ou sans données et annonce le rang', () => {
    // Affichées : phare, actions-retard, echeances (ecarts est masquée, les autres sans données).
    const d = modifierDalle(base, 'ecarts', { masquee: true });
    const disponibles = new Set<IdDalle>(['phare', 'ecarts', 'actions-retard', 'echeances']);
    const r = deplacerDalleAuClavier(d, 'phare', 1, disponibles);
    expect(dallesAffichees(r.disposition, disponibles).map((x) => x.id)).toEqual([
      'actions-retard',
      'phare',
      'echeances',
    ]);
    expect([r.rang, r.total]).toEqual([2, 3]);
    const fin = deplacerDalleAuClavier(d, 'phare', 'fin', disponibles);
    expect([fin.rang, fin.total]).toEqual([3, 3]);
    const debut = deplacerDalleAuClavier(fin.disposition, 'phare', 'debut', disponibles);
    expect(debut.rang).toBe(1);
    // Déjà en tête : rien ne bouge.
    expect(deplacerDalleAuClavier(d, 'phare', -1, disponibles).disposition).toBe(d);
    // Toutes les dalles restent présentes une fois.
    expect(new Set(ids(fin.disposition)).size).toBe(DALLES_TABLEAU_DE_BORD.length);
  });

  it('compare deux dispositions', () => {
    expect(memesDispositions(base, completerDisposition(null))).toBe(true);
    expect(memesDispositions(base, modifierDalle(base, 'phare', { largeur: 12 }))).toBe(false);
    expect(memesDispositions(base, deplacerDalle(base, 'ecarts', 'phare'))).toBe(false);
    expect(dallesAffichees(base, tout)).toHaveLength(DALLES_TABLEAU_DE_BORD.length);
  });
});
