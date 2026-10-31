/* Disposition du tableau de bord (ADR 0078, lots 2a et 2c) : schéma, lecture tolérante, complétion, déplacements,
   réglages par dalle (seuils, cible, visualisation). */
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
  REGLAGES_DALLE,
  visualisationDalle,
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

describe('réglages des dalles (lot 2c)', () => {
  const dalle = (id: string, reglages: unknown) => ({ dalles: [{ id, largeur: 6, masquee: false, reglages }] });

  it('accepte les réglages permis par la dalle', () => {
    for (const [id, r] of [
      ['phare', { seuils: { orange: 50, vert: 90 }, seuilsJours: { orange: 15, vert: 45 } }],
      ['conformite-referentiels', { seuils: { orange: 70, vert: 70 }, cible: 85, visualisation: 'tableau' }],
      ['indicateurs', { visualisation: 'chiffre', cible: 100 }],
      ['ecarts-statut', { visualisation: 'anneau' }],
      ['mise-en-oeuvre', {}],
    ] as const)
      expect(Disposition.safeParse(dalle(id, r)).success, id).toBe(true);
  });

  it.each([
    ['des seuils sur une dalle sans taux', dalle('ecarts', { seuils: { orange: 60, vert: 80 } })],
    ['une cible sur la carte phare', dalle('phare', { cible: 80 })],
    ['une visualisation non proposée', dalle('ecarts-statut', { visualisation: 'jauge' })],
    ['une visualisation inconnue', dalle('ecarts-statut', { visualisation: 'camembert3d' })],
    ['un seuil orange au-dessus du vert', dalle('indicateurs', { seuils: { orange: 90, vert: 80 } })],
    ['un taux au-delà de 100', dalle('indicateurs', { seuils: { orange: 60, vert: 120 } })],
    ['une cible décimale', dalle('indicateurs', { cible: 80.5 })],
    ['des jours au-delà d’un an', dalle('phare', { seuilsJours: { orange: 30, vert: 400 } })],
    ['un réglage inconnu', dalle('indicateurs', { couleur: 'rouge' })],
  ])('refuse %s', (_, v) => {
    expect(Disposition.safeParse(v).success).toBe(false);
  });

  it('chaque visualisation standard est la première proposée', () => {
    expect(visualisationDalle('ecarts-type')).toBe('anneau');
    expect(visualisationDalle('ecarts-type', { visualisation: 'histogramme' })).toBe('histogramme');
    expect(visualisationDalle('phare', { visualisation: 'tableau' })).toBeNull();
    for (const r of Object.values(REGLAGES_DALLE))
      if (r.visualisations) expect(r.visualisations.length).toBeGreaterThan(1);
  });

  it('lecture tolérante : des réglages devenus invalides sont abandonnés, la dalle reste', () => {
    expect(lireDisposition(dalle('ecarts-statut', { visualisation: 'retiree' }))).toEqual({
      dalles: [{ id: 'ecarts-statut', largeur: 6, masquee: false }],
    });
  });

  it('modifier, comparer, retirer les réglages', () => {
    const base = completerDisposition(null);
    const avec = modifierDalle(base, 'indicateurs', { reglages: { cible: 90 } });
    expect(avec.dalles.find((x) => x.id === 'indicateurs')!.reglages).toEqual({ cible: 90 });
    expect(memesDispositions(base, avec)).toBe(false);
    expect(memesDispositions(avec, modifierDalle(avec, 'indicateurs', { reglages: { cible: 90 } }))).toBe(true);
    const sans = modifierDalle(avec, 'indicateurs', { reglages: { cible: undefined } });
    expect('reglages' in sans.dalles.find((x) => x.id === 'indicateurs')!).toBe(false);
    expect(memesDispositions(base, sans)).toBe(true);
    // Déplacer ou compléter garde les réglages.
    expect(completerDisposition(deplacerDalle(avec, 'indicateurs', 'phare')).dalles[0]).toMatchObject({
      id: 'indicateurs',
      reglages: { cible: 90 },
    });
  });
});
