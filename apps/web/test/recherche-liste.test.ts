/* Recherche et filtres des listes (refonte Verre, règle validée par le RSSI le 27/11/2026) : seuil de 8 éléments, recherche
   sans casse ni accents, surlignage, calcul des puces (nombres, puces inutiles masquées). Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  compterPuces,
  correspond,
  pucesUtiles,
  rechercheVisible,
  segmentsSurlignes,
  SEUIL_RECHERCHE_LISTE,
  textesFiche,
} from '../src/components/recherche-liste';

describe('seuil d’apparition de la recherche et des puces', () => {
  it('masque la barre sous 8 éléments, la montre à 8 et au-delà', () => {
    expect(SEUIL_RECHERCHE_LISTE).toBe(8);
    expect(rechercheVisible(0, false)).toBe(false);
    expect(rechercheVisible(7, false)).toBe(false);
    expect(rechercheVisible(8, false)).toBe(true);
    expect(rechercheVisible(14, false)).toBe(true);
  });
  it('garde la barre quand une recherche ou un filtre est déjà actif, même pour 3 éléments', () => {
    expect(rechercheVisible(3, true)).toBe(true);
    expect(rechercheVisible(0, true)).toBe(true);
  });
  it('montre la barre quand le nombre total est inconnu (liste servie par une recherche du serveur)', () => {
    expect(rechercheVisible(undefined, false)).toBe(true);
  });
});

describe('recherche dans l’intitulé et le texte des fiches', () => {
  const fiche = {
    name: 'Agence régionale de santé fictive',
    data: { description: 'Déclaration des incidents graves', revue: 3, tags: ['x'] },
  };
  it('ignore la casse et les accents ; une recherche vide garde tout', () => {
    expect(correspond(textesFiche(fiche), 'SANTE')).toBe(true);
    expect(correspond(textesFiche(fiche), ' declaration ')).toBe(true);
    expect(correspond(textesFiche(fiche), '')).toBe(true);
    expect(correspond(textesFiche(fiche), '   ')).toBe(true);
    expect(correspond(textesFiche(fiche), 'introuvable')).toBe(false);
  });
  it('ignore les valeurs qui ne sont pas du texte et accepte des textes ajoutés (responsable, état)', () => {
    expect(correspond(textesFiche(fiche), '3')).toBe(false);
    expect(correspond(textesFiche(fiche, 'Personne fictive'), 'personne')).toBe(true);
  });
});

describe('surlignage des correspondances', () => {
  const trouves = (texte: string, q: string) =>
    segmentsSurlignes(texte, q)
      .filter((s) => s.trouve)
      .map((s) => s.texte);
  it('garde le texte d’origine, accents compris, et le reconstitue à l’identique', () => {
    const texte = 'Hébergeur de données de santé fictif';
    const segments = segmentsSurlignes(texte, 'sante');
    expect(segments.map((s) => s.texte).join('')).toBe(texte);
    expect(trouves(texte, 'sante')).toEqual(['santé']);
    expect(trouves(texte, 'HEBERGEUR')).toEqual(['Hébergeur']);
  });
  it('surligne chaque occurrence', () => {
    expect(trouves('Santé et santé publique', 'santé')).toEqual(['Santé', 'santé']);
  });
  it('ne surligne rien sans recherche ni correspondance', () => {
    expect(segmentsSurlignes('Texte fictif', '')).toEqual([{ texte: 'Texte fictif', trouve: false }]);
    expect(segmentsSurlignes('Texte fictif', 'absent')).toEqual([{ texte: 'Texte fictif', trouve: false }]);
  });
  it('rattache un accent déjà décomposé à sa lettre', () => {
    const decompose = 'santé fictive';
    expect(trouves(decompose, 'santé')).toEqual(['santé']);
    expect(
      segmentsSurlignes(decompose, 'sante')
        .map((s) => s.texte)
        .join(''),
    ).toBe(decompose);
  });
});

describe('calcul des puces', () => {
  const parties = [
    ...Array.from({ length: 9 }, () => ({ nature: 'Externe', revue: 'ok' })),
    ...Array.from({ length: 5 }, () => ({ nature: 'Interne', revue: 'ok' })),
  ];
  it('compte les éléments par valeur, du plus fréquent au moins fréquent', () => {
    const options = compterPuces(parties, (p) => p.nature, { libelle: (v) => v + 's' });
    expect(options).toEqual([
      { value: 'Externe', label: 'Externes', compte: 9 },
      { value: 'Interne', label: 'Internes', compte: 5 },
    ]);
  });
  it('suit l’ordre des valeurs connues, comptées même à 0, et le ton demandé', () => {
    const options = compterPuces(parties, (p) => p.nature, {
      ordre: ['Interne', 'Externe', 'À préciser'],
      ton: (v) => (v === 'Interne' ? 'alerte' : undefined),
    });
    expect(options.map((o) => [o.value, o.compte, o.ton])).toEqual([
      ['Interne', 5, 'alerte'],
      ['Externe', 9, undefined],
      ['À préciser', 0, undefined],
    ]);
  });
  it('ignore les valeurs vides et compte un élément à plusieurs valeurs pour chacune, une seule fois', () => {
    const options = compterPuces(
      [{ t: ['a', 'b', 'a'] }, { t: ['b'] }, { t: [] }, { t: null }, { t: '' }],
      (o) => o.t as string | string[] | null,
    );
    expect(options.map((o) => [o.value, o.compte])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });
  it('masque une puce qui ne trierait rien : aucun élément, ou tous les éléments (seule valeur)', () => {
    const options = compterPuces(parties, (p) => p.nature, { ordre: ['Externe', 'Interne', 'À préciser'] });
    expect(pucesUtiles(options, parties.length, null).map((o) => o.value)).toEqual(['Externe', 'Interne']);
    const seule = compterPuces(parties, (p) => p.revue);
    expect(seule).toEqual([{ value: 'ok', label: 'ok', compte: 14 }]);
    expect(pucesUtiles(seule, parties.length, null)).toEqual([]);
  });
  it('garde toujours la puce active, pour pouvoir la retirer', () => {
    const options = [
      { value: 'vide', label: 'Vide', compte: 0 },
      { value: 'tout', label: 'Tout', compte: 14 },
    ];
    expect(pucesUtiles(options, 14, 'vide').map((o) => o.value)).toEqual(['vide']);
    expect(pucesUtiles(options, 14, 'tout').map((o) => o.value)).toEqual(['tout']);
  });
});
