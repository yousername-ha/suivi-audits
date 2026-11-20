/* Tableau de bord unique (ADR 0108) : disposition standard de la vue analytique, copies d'une dalle, hauteur réglable,
   placement magnétique en largeur et en hauteur. */
import { describe, expect, it } from 'vitest';
import {
  ajouterDalle,
  cleDalle,
  compacterDisposition,
  completerDisposition,
  DALLES_STANDARD,
  DALLES_TABLEAU_DE_BORD,
  dallesAffichees,
  deplacerDalle,
  deplacerDalleAuClavier,
  Disposition,
  dispositionStandard,
  HAUTEUR_STANDARD,
  hauteurAimantee,
  hauteurDalle,
  lireDisposition,
  MAX_DALLES,
  memesDispositions,
  modifierDalle,
  retirerDalle,
  type DalleDisposee,
  type IdDalle,
} from '../src/disposition-tableau-de-bord.js';

const tout = new Set<IdDalle>(DALLES_TABLEAU_DE_BORD);
const cles = (d: Disposition) => d.dalles.map(cleDalle);
const vues = (d: Disposition) => dallesAffichees(d, tout).map(cleDalle);

describe('disposition standard', () => {
  it('affiche les cartes de la vue analytique dans son ordre et garde les autres dalles au catalogue, masquées', () => {
    const d = dispositionStandard();
    expect(vues(d)).toEqual([...DALLES_STANDARD]);
    expect(cles(d)).toHaveLength(DALLES_TABLEAU_DE_BORD.length);
    expect(d.dalles.filter((x) => x.masquee).map((x) => x.id)).toContain('phare');
    expect(Disposition.safeParse(d).success).toBe(true);
    // Complète : rien n'est ajouté, l'enregistrer ne fait réapparaître aucune dalle masquée.
    expect(memesDispositions(completerDisposition(d), d)).toBe(true);
  });
});

describe('copies d’une dalle', () => {
  it('ajouter réaffiche d’abord la dalle masquée de ce type, en fin de grille', () => {
    const r = ajouterDalle(dispositionStandard(), 'echeances');
    expect(r.cle).toBe('echeances');
    expect(vues(r.disposition).at(-1)).toBe('echeances');
    expect(r.disposition.dalles.filter((x) => x.id === 'echeances')).toHaveLength(1);
  });

  it('ajouter une dalle déjà affichée crée une copie avec sa clé, à sa largeur standard', () => {
    const une = ajouterDalle(dispositionStandard(), 'incidents');
    expect(une.cle).toBe('incidents~2');
    const deux = ajouterDalle(une.disposition, 'incidents');
    expect(deux.cle).toBe('incidents~3');
    expect(vues(deux.disposition).filter((c) => c.startsWith('incidents'))).toEqual([
      'incidents',
      'incidents~2',
      'incidents~3',
    ]);
    expect(Disposition.safeParse(deux.disposition).success).toBe(true);
  });

  it('chaque copie a ses propres réglages, sa largeur et sa hauteur', () => {
    let d = ajouterDalle(completerDisposition(null), 'ecarts-statut').disposition;
    d = modifierDalle(d, 'ecarts-statut~2', { largeur: 12, hauteur: 6, reglages: { visualisation: 'anneau' } });
    const [a, b] = d.dalles.filter((x) => x.id === 'ecarts-statut');
    expect(a).toEqual({ id: 'ecarts-statut', largeur: 4, masquee: false });
    expect(b).toEqual({
      id: 'ecarts-statut',
      cle: 'ecarts-statut~2',
      largeur: 12,
      hauteur: 6,
      masquee: false,
      reglages: { visualisation: 'anneau' },
    });
  });

  it('retirer supprime une copie, mais masque la première de son type', () => {
    const d = ajouterDalle(dispositionStandard(), 'journal').disposition;
    const sansCopie = retirerDalle(d, 'journal~2');
    expect(cles(sansCopie)).not.toContain('journal~2');
    const masquee = retirerDalle(sansCopie, 'journal');
    expect(masquee.dalles.find((x) => x.id === 'journal')!.masquee).toBe(true);
    expect(retirerDalle(d, 'inconnue')).toBe(d);
  });

  it('déplace une copie par sa clé, au glisser comme au clavier', () => {
    const d = ajouterDalle(dispositionStandard(), 'bandeau').disposition;
    expect(vues(deplacerDalle(d, 'bandeau~2', 'conformite'))[1]).toBe('bandeau~2');
    const r = deplacerDalleAuClavier(d, 'bandeau~2', 'debut', tout);
    expect(vues(r.disposition)[0]).toBe('bandeau~2');
    expect([r.rang, r.total]).toEqual([1, DALLES_STANDARD.length + 1]);
  });

  it.each([
    [
      'deux copies de même clé',
      [
        { id: 'phare', cle: 'phare~2' },
        { id: 'phare', cle: 'phare~2' },
      ],
    ],
    ['une clé d’un autre type', [{ id: 'phare', cle: 'ecarts~2' }]],
    ['une clé mal formée', [{ id: 'phare', cle: 'phare-2' }]],
    ['une copie numéro 0', [{ id: 'phare', cle: 'phare~0' }]],
  ])('refuse %s', (_, dalles) => {
    expect(Disposition.safeParse({ dalles: dalles.map((x) => ({ ...x, largeur: 4, masquee: false })) }).success).toBe(
      false,
    );
  });

  it('accepte des copies distinctes, jusqu’à la limite', () => {
    const copies = (n: number) => ({
      dalles: Array.from({ length: n }, (_, i) => ({
        id: 'ecarts' as const,
        ...(i ? { cle: `ecarts~${i + 1}` } : {}),
        largeur: 3 as const,
        masquee: false,
      })),
    });
    expect(Disposition.safeParse(copies(MAX_DALLES)).success).toBe(true);
    expect(Disposition.safeParse(copies(MAX_DALLES + 1)).success).toBe(false);
    const pleine = copies(MAX_DALLES);
    expect(ajouterDalle(pleine, 'ecarts')).toEqual({ disposition: pleine, cle: null });
  });

  it('lecture tolérante : garde les copies, ignore une clé en double', () => {
    expect(
      lireDisposition({
        dalles: [
          { id: 'ecarts', largeur: 4, masquee: false },
          { id: 'ecarts', cle: 'ecarts~2', largeur: 6, masquee: false },
          { id: 'ecarts', cle: 'ecarts~2', largeur: 12, masquee: false },
        ],
      }).dalles.map(cleDalle),
    ).toEqual(['ecarts', 'ecarts~2']);
  });
});

describe('hauteur', () => {
  it('absente : la hauteur standard ; égale à la standard, elle n’est pas enregistrée', () => {
    const d = completerDisposition(null);
    expect(hauteurDalle(d.dalles[0]!)).toBe(HAUTEUR_STANDARD.phare);
    const haute = modifierDalle(d, 'phare', { hauteur: 8 });
    expect(haute.dalles[0]!.hauteur).toBe(8);
    expect(memesDispositions(d, haute)).toBe(false);
    const standard = modifierDalle(haute, 'phare', { hauteur: HAUTEUR_STANDARD.phare });
    expect('hauteur' in standard.dalles[0]!).toBe(false);
    expect(memesDispositions(d, standard)).toBe(true);
  });

  it('refuse une hauteur hors liste', () => {
    expect(Disposition.safeParse({ dalles: [{ id: 'phare', largeur: 6, hauteur: 7, masquee: false }] }).success).toBe(
      false,
    );
  });

  it('aimante une hauteur sur la plus proche des hauteurs proposées', () => {
    expect([0, 2.4, 3.6, 7, 7.1, 9.2, 11.4, 20].map(hauteurAimantee)).toEqual([2, 2, 4, 6, 8, 10, 12, 12]);
  });
});

describe('placement magnétique en hauteur', () => {
  const disp = (...x: [string, 3 | 4 | 6 | 8 | 12, (2 | 4 | 6 | 8)?][]): Disposition => ({
    dalles: x.map(([cle, largeur, hauteur]): DalleDisposee => ({
      id: cle.split('~')[0] as IdDalle,
      ...(cle.includes('~') ? { cle } : {}),
      largeur,
      ...(hauteur ? { hauteur } : {}),
      masquee: false,
    })),
  });

  it('comble le creux laissé à côté d’une dalle haute', () => {
    // « phare » occupe la moitié sur deux rangées ; « ecarts » (moitié) se place à droite, puis « echeances » (toute
    // la largeur) ne tient qu'après « phare » : « plans » (moitié, une rangée) remonte sous « ecarts ».
    const d = disp(['phare', 6, 8], ['ecarts', 6], ['echeances', 12], ['plans', 6]);
    expect(cles(compacterDisposition(d, tout))).toEqual(['phare', 'ecarts', 'plans', 'echeances']);
  });

  it('n’avance pas la dalle posée, même pour combler un creux', () => {
    const d = disp(['phare', 6, 8], ['ecarts', 6], ['echeances', 12], ['plans', 6]);
    expect(cles(compacterDisposition(d, tout, 'plans'))).toEqual(cles(d));
  });

  it('traite les copies comme des dalles distinctes', () => {
    const d = disp(['incidents', 8], ['journal', 12], ['incidents~2', 4]);
    expect(cles(compacterDisposition(d, tout))).toEqual(['incidents', 'incidents~2', 'journal']);
  });
});
