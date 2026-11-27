/* Gestion des risques, dessins validés par le RSSI le 27/11/2026 : échelle lue dans la méthode (décision 2), tuiles du
   registre, avancement des études EBIOS RM et case « Afficher les études terminées » (décision 1), répartition du brut au
   résiduel de la cartographie. Données fictives, rendu statique sans réseau ni base. */
import { MantineProvider } from '@mantine/core';
import type { GrcObject, RiskMethod } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ListeEtudesVue } from '../src/grc/Ebios';
import { LegendeEchelle, NiveauRisque } from '../src/grc/EchelleRisques';
import {
  etatEtude,
  etudesAffichees,
  joursEcoules,
  legendeMethode,
  libelleAvancement,
  niveauParLibelle,
  plagesScores,
  repartitionBrutResiduel,
  risquesNonPlaces,
  segmentsRepartition,
  syntheseEtudes,
  syntheseRegistre,
  type EtatEtude,
  type LigneRegistre,
  type VueEtudeResume,
} from '../src/grc/gestion-risques';
import { MatriceRisques } from '../src/grc/MatriceRisques';

const html = (n: ReactNode) => renderToStaticMarkup(createElement(MantineProvider, null, n));
const decode = (h: string) =>
  h
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, '’')
    .replace(/&quot;/g, '"');

/* Méthode fictive à trois niveaux aux libellés et couleurs inhabituels : rien ne doit venir d'une échelle codée en dur. */
const methode = {
  name: 'Méthode fictive',
  family: 'custom',
  dimensions: [
    {
      id: 'impact',
      label: 'Gravité',
      levels: [
        { id: 'g1', label: 'Légère', value: 1 },
        { id: 'g2', label: 'Lourde', value: 2 },
      ],
    },
  ],
  likelihood: [
    { id: 'v1', label: 'Rare', value: 1 },
    { id: 'v2', label: 'Fréquente', value: 2 },
  ],
  levels: [
    { id: 'n1', label: 'Niveau vert', color: '#118844', acceptability: 'acceptable' },
    { id: 'n2', label: 'Niveau ambre', color: '#cc9900', acceptability: 'conditional' },
    { id: 'n3', label: 'Niveau pourpre', color: '#880088', acceptability: 'unacceptable' },
  ],
  calculation: {
    kind: 'matrix',
    dimension: 'impact',
    cells: [
      { impact: 'g1', likelihood: 'v1', level: 'n1', score: 1 },
      { impact: 'g1', likelihood: 'v2', level: 'n2', score: 2 },
      { impact: 'g2', likelihood: 'v1', level: 'n2', score: 3 },
      { impact: 'g2', likelihood: 'v2', level: 'n3', score: 4 },
    ],
  },
} as unknown as RiskMethod;

const ligne = (p: Partial<LigneRegistre> & { id: string }): LigneRegistre => ({
  name: 'Risque ' + p.id,
  code: '',
  demarche: null,
  strategie: 'reduce',
  ownerId: null,
  brut: null,
  residuel: null,
  acceptabilite: null,
  appreciationValidee: false,
  acceptation: 'sans_objet',
  decisionAcceptation: null,
  prochaineRevue: null,
  enRetard: false,
  etude: null,
  ecartMatrice: null,
  ...p,
});

describe('échelle de la méthode (décision 2 : jamais d’échelle codée en dur)', () => {
  it('retrouve le niveau par son libellé, sans tenir compte de la casse ; rien sans méthode ou libellé inconnu', () => {
    expect(niveauParLibelle(methode, 'niveau AMBRE')?.id).toBe('n2');
    expect(niveauParLibelle(methode, 'Critique')).toBeNull();
    expect(niveauParLibelle(null, 'Niveau vert')).toBeNull();
    expect(niveauParLibelle(methode, null)).toBeNull();
  });

  it('plages de score tirées des cases de la matrice publiée', () => {
    expect([...plagesScores(methode)]).toEqual([
      ['n1', '1'],
      ['n2', '2–3'],
      ['n3', '4'],
    ]);
    const sansScore = {
      ...methode,
      calculation: {
        ...methode.calculation,
        cells: (methode.calculation as { cells: object[] }).cells.map((c) => ({ ...c, score: null })),
      },
    } as RiskMethod;
    expect([...plagesScores(sansScore).values()]).toEqual([null, null, null]);
    expect([...plagesScores({ ...methode, calculation: { kind: 'judgement' } } as RiskMethod).values()]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('légende : formule, niveaux de la méthode et seuil d’acceptation par acceptabilité', () => {
    const l = legendeMethode(methode);
    expect(l.formule).toBe('Niveau : gravité × vraisemblance (2 × 2), méthode « Méthode fictive »');
    expect(l.niveaux.map((n) => [n.label, n.color, n.plage])).toEqual([
      ['Niveau vert', '#118844', '1'],
      ['Niveau ambre', '#cc9900', '2–3'],
      ['Niveau pourpre', '#880088', '4'],
    ]);
    expect(l.acceptabilite).toEqual([
      { acceptabilite: 'acceptable', niveaux: ['Niveau vert'] },
      { acceptabilite: 'conditional', niveaux: ['Niveau ambre'] },
      { acceptabilite: 'unacceptable', niveaux: ['Niveau pourpre'] },
    ]);
    const rendu = decode(html(createElement(LegendeEchelle, { methode })));
    for (const n of ['Niveau vert', 'Niveau ambre', 'Niveau pourpre']) expect(rendu).toContain(n);
    for (const c of ['#118844', '#cc9900', '#880088']) expect(rendu).toContain(`fill="${c}"`);
    expect(rendu).toContain('Inacceptable : Niveau pourpre');
    // Aucune échelle par défaut ne s'invite.
    expect(rendu).not.toMatch(/Critique|Faible|Modéré/);
  });

  it('gélule de niveau : pastille à la couleur publiée, teinte selon l’acceptabilité ; neutre si le libellé est inconnu', () => {
    const connu = html(
      createElement(NiveauRisque, { libelle: 'Niveau pourpre', niveau: niveauParLibelle(methode, 'Niveau pourpre') }),
    );
    expect(connu).toContain('data-acceptabilite="unacceptable"');
    expect(connu).toContain('fill="#880088"');
    const inconnu = html(createElement(NiveauRisque, { libelle: 'Critique', niveau: null }));
    expect(inconnu).toContain('data-acceptabilite="inconnue"');
    expect(inconnu).not.toContain('<svg');
    expect(html(createElement(NiveauRisque, { libelle: null, niveau: null, vide: 'Non apprécié' }))).toContain(
      'Non apprécié',
    );
  });

  it('matrice : score de la case et cases d’un niveau inacceptable marquées « au-dessus » du seuil', () => {
    const rendu = html(
      createElement(MatriceRisques, {
        methode,
        publicationId: 'pub-1',
        items: [],
        basis: 'residual',
        onOpen: () => {},
      }),
    );
    expect(rendu.match(/data-seuil="au-dessus"/g)).toHaveLength(1);
    for (const n of [1, 2, 3, 4]) expect(rendu).toContain(`<span class="matrice-score chiffres">${n}</span>`);
  });
});

describe('registre : tuiles et revue échue', () => {
  it('compte les risques, à apprécier, sans validation, revues échues et résiduels au-dessus du seuil', () => {
    const s = syntheseRegistre(
      [
        ligne({ id: '1', brut: 'Niveau pourpre', residuel: 'Niveau ambre', acceptabilite: 'conditional' }),
        ligne({
          id: '2',
          brut: 'Niveau pourpre',
          residuel: 'Niveau pourpre',
          acceptabilite: 'unacceptable',
          appreciationValidee: true,
          enRetard: true,
        }),
        ligne({ id: '3', enRetard: true }),
        ligne({ id: '4', brut: 'Niveau vert', residuel: 'Niveau vert', acceptabilite: 'acceptable' }),
      ],
      methode,
    );
    expect(s.total).toBe(4);
    expect(s.aApprecier).toBe(1);
    expect(s.sansValidation).toBe(3);
    expect(s.revuesEchues).toEqual({ nombre: 2, noms: ['Risque 2', 'Risque 3'] });
    expect(s.auDessusSeuil).toEqual({ nombre: 1, apprecies: 3, brut: 2 });
    expect(s.repartition.map((n) => [n.label, n.nombre])).toEqual([
      ['Niveau vert', 1],
      ['Niveau ambre', 1],
      ['Niveau pourpre', 1],
    ]);
    // Sans méthode : ni répartition ni décompte du brut, rien n'est deviné.
    const sans = syntheseRegistre([ligne({ id: '1', brut: 'Niveau pourpre' })], null);
    expect(sans.repartition).toEqual([]);
    expect(sans.auDessusSeuil.brut).toBeNull();
  });

  it('jours de retard entre deux dates civiles (0 si invalide ou à venir)', () => {
    expect(joursEcoules('2026-11-24', '2026-11-27')).toBe(3);
    expect(joursEcoules('2026-02-28', '2026-03-01')).toBe(1);
    expect(joursEcoules('2026-12-01', '2026-11-27')).toBe(0);
    expect(joursEcoules(null, '2026-11-27')).toBe(0);
    expect(joursEcoules('27/11/2026', '2026-11-27')).toBe(0);
  });

  it('segments de la barre de répartition : proportions, niveaux vides omis', () => {
    expect(
      segmentsRepartition([
        { id: 'a', color: '#111111', nombre: 1 },
        { id: 'b', color: '#222222', nombre: 0 },
        { id: 'c', color: '#333333', nombre: 3 },
      ]),
    ).toEqual([
      { id: 'a', color: '#111111', x: 0, largeur: 25 },
      { id: 'c', color: '#333333', x: 25, largeur: 75 },
    ]);
    expect(segmentsRepartition([{ id: 'a', color: '#111111', nombre: 0 }])).toEqual([]);
  });
});

/* Vue d'étude fictive : `valides` ateliers validés (dans l'ordre), objets par type. */
function vue(valides: number, extra: Partial<Record<string, number>> = {}, modifie?: string): VueEtudeResume {
  const kinds: Record<string, string[]> = {
    a1: ['feared_event'],
    a2: ['sr_ov'],
    a3: ['strategic_scenario'],
    a4: ['operational_scenario'],
    a5: ['risk'],
  };
  return {
    ateliers: ['a1', 'a2', 'a3', 'a4', 'a5'].map((id, i) => ({
      id,
      objets: Array.from({ length: extra[id] ?? 0 }, () => ({ kind: kinds[id]![0]! })),
      valide: i < valides && id !== modifie,
      modifieDepuisValidation: id === modifie,
      validations: i < valides ? [{ step: id, date: `2026-10-0${i + 1}` }] : [],
    })),
  };
}

describe('études EBIOS RM : avancement', () => {
  it('atelier courant = premier atelier non validé ; chiffres lus dans les objets de l’étude', () => {
    const e = etatEtude(vue(3, { a1: 9, a2: 5, a3: 6, a5: 0 }));
    expect(e.courant).toBe(4);
    expect(e.terminee).toBe(false);
    expect(e.ateliers.map((a) => a.etat)).toEqual(['valide', 'valide', 'valide', 'courant', 'a_venir']);
    expect([e.evenements, e.couples, e.scenariosStrategiques, e.scenariosOperationnels, e.risques]).toEqual([
      9, 5, 6, 0, 0,
    ]);
    expect(e.derniereValidation).toEqual({ numero: 3, date: '2026-10-03' });
    expect(libelleAvancement(e)).toBe('En cours · atelier 4');
    expect(e.ateliers[0]!.libelle).toBe('Cadrage et socle');
  });

  it('cadrage à valider, étude terminée, atelier modifié depuis sa validation', () => {
    expect(libelleAvancement(etatEtude(vue(0)))).toBe('Cadrage à valider');
    const fin = etatEtude(vue(5, { a5: 4 }));
    expect(fin.terminee).toBe(true);
    expect(fin.courant).toBeNull();
    expect(fin.risques).toBe(4);
    expect(libelleAvancement(fin)).toBe('Terminée');
    // Un atelier modifié depuis sa validation n'est plus validé : l'étude n'est pas terminée.
    const modifiee = etatEtude(vue(5, {}, 'a2'));
    expect(modifiee.terminee).toBe(false);
    expect(modifiee.courant).toBe(2);
    expect(modifiee.ateliers[1]).toMatchObject({ etat: 'courant', modifie: true });
    // Une vue sans atelier n'est jamais « terminée ».
    expect(etatEtude({ ateliers: [] }).terminee).toBe(false);
  });

  it('décision 1 : études terminées masquées par défaut, affichées quand la case est cochée ; état inconnu affiché', () => {
    const etudes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const etats = new Map<string, EtatEtude | undefined>([
      ['a', etatEtude(vue(5))],
      ['b', etatEtude(vue(2))],
      ['c', undefined],
    ]);
    expect(etudesAffichees(etudes, etats, false)).toEqual({ visibles: [{ id: 'b' }, { id: 'c' }], masquees: 1 });
    expect(etudesAffichees(etudes, etats, true)).toEqual({ visibles: etudes, masquees: 0 });
    expect(syntheseEtudes(etudes, etats)).toEqual({ total: 3, enCours: 1, auCadrage: 0, terminees: 1, risques: 0 });
  });
});

const etude = (id: string, name: string): GrcObject => ({
  id,
  smsiId: 'p',
  kind: 'risk_study',
  name,
  data: { objective: 'Objet fictif', startAt: '2026-03-03', endAt: '2027-01-31' },
  version: 1,
  createdAt: '2026-03-01T09:00:00.000Z',
  createdBy: 'recette',
  updatedAt: '2026-03-01T09:00:00.000Z',
  updatedBy: 'recette',
  legacyKey: null,
  legacyId: null,
  archived: false,
});

describe('liste des études : case « Afficher les études terminées » (décision 1)', () => {
  const etudes = [etude('e1', 'Étude close fictive'), etude('e2', 'Étude en cours fictive')];
  const etats = new Map<string, EtatEtude | undefined>([
    ['e1', etatEtude(vue(5, { a5: 2 }))],
    ['e2', etatEtude(vue(1, { a1: 3 }))],
  ]);
  const liste = (terminees: boolean) =>
    decode(
      html(
        createElement(ListeEtudesVue, {
          etudes,
          etats,
          terminees,
          onTerminees: () => {},
          recherche: '',
          onRecherche: () => {},
          onOpen: () => {},
          onOuvrir: () => {},
        }),
      ),
    );

  it('décochée par défaut : l’étude terminée est masquée et le nombre d’études masquées est dit', () => {
    const h = liste(false);
    expect(h).toContain('Afficher les études terminées');
    expect(h).not.toMatch(/<input[^>]*type="checkbox"[^>]*checked/);
    expect(h).not.toContain('Étude close fictive');
    expect(h).toContain('Étude en cours fictive');
    expect(h).toContain('1 étude terminée masquée');
    // Les compteurs portent sur toutes les études, terminées comprises.
    expect(h).toMatch(/<b class="chiffres">2<\/b> études EBIOS RM/);
    expect(h).toMatch(/<b class="chiffres">1<\/b> terminée et validée/);
  });

  it('cochée : l’étude terminée est affichée, plus rien n’est masqué', () => {
    const h = liste(true);
    expect(h).toMatch(/<input[^>]*type="checkbox"[^>]*checked/);
    expect(h).toContain('Étude close fictive');
    expect(h).toContain('Étude en cours fictive');
    expect(h).not.toContain('masquée');
    expect(h).toContain('Terminée');
  });

  it('carte : cinq ateliers nommés, « Reprendre l’atelier » nommé avec l’étude, autres actions nommées', () => {
    const h = liste(false);
    expect(h).toContain('aria-label="Atelier 1, Cadrage et socle : validé"');
    expect(h).toContain('aria-label="Atelier 2, Sources de risque : en cours"');
    expect(h).toContain('aria-label="Atelier 5, Traitement : à faire"');
    expect(h).toContain('aria-label="Reprendre l’atelier 2 : ouvrir l’étude Étude en cours fictive"');
    expect(h).toContain('>Reprendre l’atelier<');
    expect(h).toContain('aria-label="Autres actions pour Étude en cours fictive"');
    expect(h).toContain('<h2 id="ris-etude-e2" class="ris-etude__titre">Étude en cours fictive</h2>');
    expect(h).toContain('Atelier 1 validé le 01/10/2026');
  });
});

describe('cartographie : du brut au résiduel', () => {
  const item = (brut: string, residuel: string, pub = 'pub-1') => ({
    assessment: { method_version_id: pub, result: { gross: { level: brut }, residual: { level: residuel } } },
  });
  it('compte les niveaux bruts et résiduels de la publication ; les risques sans appréciation ne sont pas placés', () => {
    const items = [
      item('n3', 'n2'),
      item('n3', 'n1'),
      item('n2', 'n2'),
      item('n3', 'n3', 'autre'),
      { assessment: null },
    ];
    const r = repartitionBrutResiduel(items, 'pub-1', methode);
    expect(r.places).toBe(3);
    expect(r.niveaux.map((n) => [n.label, n.brut, n.residuel])).toEqual([
      ['Niveau vert', 0, 1],
      ['Niveau ambre', 1, 2],
      ['Niveau pourpre', 2, 0],
    ]);
    expect(risquesNonPlaces(items)).toBe(1);
  });
});
