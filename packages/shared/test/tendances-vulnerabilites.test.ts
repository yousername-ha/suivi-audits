/* Module Vulnérabilités (ADR 0100, lot S2) : tendances et rapport de pilotage. Composition d'un instantané (toute la
   plateforme et par périmètre, « sans périmètre » à part), points jour par jour, agrégation semaine après semaine, règle de
   la tendance, variation sur sept jours, période d'un rapport, synthèse du niveau, délais de prise en compte, tableaux du
   rapport et export CSV (aucun nom de machine ni d'adresse). Fonctions pures, données entièrement fictives. */
import { describe, expect, it } from 'vitest';
import {
  agregerParSemaine,
  composerInstantane,
  csvRapport,
  decalerJour,
  DELAIS_CORRECTION_DEFAUT,
  type EntreeInstantane,
  granularite,
  type InstantaneLu,
  libelleEcart,
  lundiDe,
  type MesuresAffichees,
  MESURES_VIDES,
  mesurerCorrections,
  mesurerPrisesEnCompte,
  periodeRapport,
  pointsParJour,
  type RapportVulnerabilitesDto,
  RechercheRapport,
  RechercheTendances,
  syntheseNiveau,
  tableauxRapport,
  tendanceSituation,
  variationSeptJours,
} from '../src/index.js';

const PA = '00000000-0000-4000-8000-0000000000a1';
const PB = '00000000-0000-4000-8000-0000000000b2';
const entree = (e: Partial<EntreeInstantane> = {}): EntreeInstantane => ({
  failles: [],
  objets: [],
  corrections: [],
  perimetreMachine: new Map([
    ['m1', PA],
    ['m2', PA],
    ['m3', PB],
    ['m4', null],
  ]),
  perimetreActif: new Map([
    ['x1', PB],
    ['x2', null],
  ]),
  ...e,
});
const mesures = (m: Partial<MesuresAffichees> = {}): MesuresAffichees => ({ ...MESURES_VIDES, ...m });
const lu = (jour: string, niveau: 1 | 2 | 3 | 4, m: Partial<MesuresAffichees> = {}): InstantaneLu => ({
  jour,
  niveau,
  mesures: mesures(m),
});

describe('instantané : composition', () => {
  it('compte chaque faille une fois pour toute la plateforme et une fois par périmètre touché', () => {
    const i = composerInstantane(
      entree({
        failles: [
          { priorite: 'P1', exploitee: true, machines: ['m1', 'm2', 'm3'], actifs: [] },
          { priorite: 'P2', exploitee: false, machines: ['m4'], actifs: ['x1'] },
          { priorite: 'P3', exploitee: false, machines: [], actifs: ['x2'] },
          // Faille déclarée sans machine reliée : toute la plateforme seulement.
          { priorite: 'P4', exploitee: false, machines: [], actifs: [] },
        ],
      }),
    );
    expect(i.global).toMatchObject({ p1: 1, p2: 1, p3: 1, p4: 1, exploitees: 1, machines: 4, actifs: 2 });
    expect(i.perimetres.get(PA)).toMatchObject({ p1: 1, p2: 0, exploitees: 1, machines: 2, actifs: 0 });
    expect(i.perimetres.get(PB)).toMatchObject({ p1: 1, p2: 1, exploitees: 1, machines: 1, actifs: 1 });
    expect(i.perimetres.get('aucun')).toMatchObject({ p1: 0, p2: 1, p3: 1, p4: 0, machines: 1, actifs: 1 });
    expect([...i.perimetres.keys()].sort()).toEqual([PA, PB, 'aucun'].sort());
  });

  it.each([
    ['dépassement', { depassement: true, exception: false }, { depassements: 1, exceptions: 0 }],
    ['exception', { depassement: false, exception: true }, { depassements: 0, exceptions: 1 }],
    ['ni l’un ni l’autre', { depassement: false, exception: false }, { depassements: 0, exceptions: 0 }],
  ])('objet suivi en %s : compté globalement et dans ses périmètres', (_n, o, attendu) => {
    const i = composerInstantane(entree({ objets: [{ ...o, machines: ['m1', 'm3'] }] }));
    expect(i.global).toMatchObject(attendu);
    if (attendu.depassements || attendu.exceptions) {
      expect(i.perimetres.get(PA)).toMatchObject(attendu);
      expect(i.perimetres.get(PB)).toMatchObject(attendu);
    } else expect(i.perimetres.size).toBe(0);
  });

  it('corrections de la veille par périmètre ; machine inconnue rangée « sans périmètre »', () => {
    const i = composerInstantane(
      entree({ corrections: [{ machines: ['m1', 'm2'] }, { machines: ['inconnue'] }, { machines: [] }] }),
    );
    expect(i.global.corrigeesVeille).toBe(3);
    expect(i.perimetres.get(PA)?.corrigeesVeille).toBe(1);
    expect(i.perimetres.get('aucun')?.corrigeesVeille).toBe(1);
  });

  it('ne garde que des nombres : aucun identifiant de machine ni d’actif dans le résultat', () => {
    const i = composerInstantane(
      entree({ failles: [{ priorite: 'P1', exploitee: true, machines: ['m1'], actifs: ['x1'] }] }),
    );
    const texte = JSON.stringify({ global: i.global, perimetres: [...i.perimetres.values()] });
    expect(texte).not.toMatch(/m1|x1/);
  });
});

describe('jours et semaines', () => {
  it.each([
    ['2026-11-16', '2026-11-16'],
    ['2026-11-18', '2026-11-16'],
    ['2026-11-22', '2026-11-16'],
    ['2026-11-23', '2026-11-23'],
    ['2027-01-01', '2026-12-28'],
  ])('lundi de la semaine de %s : %s', (j, lundi) => expect(lundiDe(j)).toBe(lundi));

  it('décale un jour par-delà la fin de mois et le changement d’heure', () => {
    expect(decalerJour('2026-10-24', 2)).toBe('2026-10-26');
    expect(decalerJour('2026-03-01', -1)).toBe('2026-02-28');
  });

  it.each([
    [30, 'jour'],
    [91, 'semaine'],
    [364, 'semaine'],
  ] as const)('période de %i jours : %s', (p, g) => expect(granularite(p)).toBe(g));

  it('un point par jour ; corrections du jour lues dans l’instantané du lendemain ; trous sans instantané', () => {
    const points = pointsParJour(
      [lu('2026-11-16', 2, { p1: 0, corrigeesVeille: 9 }), lu('2026-11-18', 4, { p1: 1, corrigeesVeille: 3 })],
      '2026-11-16',
      '2026-11-18',
    );
    expect(points.map((p) => [p.jour, p.niveau, p.mesures?.p1 ?? null, p.corrigees])).toEqual([
      ['2026-11-16', 2, 0, null],
      ['2026-11-17', null, null, 3],
      ['2026-11-18', 4, 1, null],
    ]);
  });

  it('semaine après semaine : dernier instantané, niveau le plus haut, somme des corrections connues', () => {
    const points = pointsParJour(
      [
        lu('2026-11-09', 1, { p1: 5 }),
        lu('2026-11-10', 3, { p1: 4, corrigeesVeille: 2 }),
        lu('2026-11-11', 2, { p1: 3, corrigeesVeille: 1 }),
        lu('2026-11-16', 1, { p1: 1, corrigeesVeille: 7 }),
      ],
      '2026-11-09',
      '2026-11-17',
    );
    const s = agregerParSemaine(points);
    expect(s.map((x) => [x.debut, x.fin, x.instantanes, x.niveauMax, x.mesures?.p1, x.corrigees])).toEqual([
      // Corrections des 10, 11 et 15/11 (dimanche, lues dans l'instantané du lundi 16/11).
      ['2026-11-09', '2026-11-15', 3, 3, 3, 10],
      ['2026-11-16', '2026-11-17', 1, 1, 1, null],
    ]);
  });

  it('semaine sans instantané : nombres absents (jamais zéro inventé)', () => {
    const s = agregerParSemaine(pointsParJour([], '2026-11-16', '2026-11-22'));
    expect(s).toEqual([
      { debut: '2026-11-16', fin: '2026-11-22', instantanes: 0, niveauMax: null, mesures: null, corrigees: null },
    ]);
  });
});

describe('tendance (règle à confirmer)', () => {
  const p = (m: Partial<MesuresAffichees> | null) => ({ mesures: m ? mesures(m) : null });
  it.each([
    ['P1 en baisse', [p({ p1: 3, p2: 1 }), p(null), p({ p1: 2, p2: 9 })], 'amelioration'],
    ['P1 en hausse', [p({ p1: 1 }), p({ p1: 2 })], 'degradation'],
    ['P1 égal, P2 en baisse', [p({ p1: 1, p2: 5 }), p({ p1: 1, p2: 4 })], 'amelioration'],
    [
      'P1 et P2 égaux, dépassements en hausse',
      [p({ p1: 1, depassements: 0 }), p({ p1: 1, depassements: 2 })],
      'degradation',
    ],
    ['tout égal', [p({ p1: 1, p3: 4 }), p({ p1: 1, p3: 9 })], 'stable'],
    ['un seul instantané', [p(null), p({ p1: 1 })], 'indeterminee'],
    ['aucun instantané', [], 'indeterminee'],
  ] as const)('%s : %s', (_n, points, sens) => {
    const t = tendanceSituation(points);
    expect(t.sens).toBe(sens);
    expect(t.explication.length).toBeGreaterThan(10);
  });
});

describe('variation sur sept jours', () => {
  it('écart par nombre et niveau, en clair', () => {
    const v = variationSeptJours(
      { jour: '2026-11-11', niveau: 2, mesures: mesures({ p1: 0, p2: 3, depassements: 4 }) },
      { niveau: 4, mesures: mesures({ p1: 2, p2: 1, depassements: 4 }) },
    );
    expect(v.reference).toBe('2026-11-11');
    expect(v.niveau).toEqual({ avant: 2, apres: 4 });
    expect(v.lignes.map((l) => [l.cle, l.ecart])).toEqual([
      ['p1', 2],
      ['p2', -2],
      ['exploitees', 0],
      ['depassements', 0],
      ['exceptions', 0],
    ]);
  });
  it.each([
    [2, '+2 (en hausse)'],
    [-1, '−1 (en baisse)'],
    [0, '0 (inchangé)'],
  ])('écart %i : %s', (e, l) => expect(libelleEcart(e)).toBe(l));
});

describe('période du rapport', () => {
  it.each([
    [{ mois: '2026-10' }, '2026-11-18', { du: '2026-10-01', au: '2026-10-31' }],
    [{ mois: '2026-02' }, '2026-11-18', { du: '2026-02-01', au: '2026-02-28' }],
    [{ mois: '2026-12' }, '2027-01-05', { du: '2026-12-01', au: '2026-12-31' }],
    [{ mois: '2026-11' }, '2026-11-18', { du: '2026-11-01', au: '2026-11-18' }],
    [{ du: '2026-11-01', au: '2026-11-30' }, '2026-11-18', { du: '2026-11-01', au: '2026-11-18' }],
    [{ mois: '2026-12' }, '2026-11-18', null],
  ])('%o le %s', (q, jour, attendu) => expect(periodeRapport(RechercheRapport.parse(q), jour)).toEqual(attendu));

  it.each([
    [{}, 'Choisir un mois'],
    [{ mois: '2026-11', du: '2026-11-01', au: '2026-11-02' }, 'Choisir un mois'],
    [{ du: '2026-11-01' }, 'début et une fin'],
    [{ du: '2026-11-10', au: '2026-11-01' }, 'précède'],
    [{ du: '2025-01-01', au: '2026-11-01' }, '366 jours'],
    [{ du: '2026-02-30', au: '2026-03-01' }, 'Date invalide'],
    [{ mois: '2026-13' }, 'AAAA-MM'],
  ])('refuse %o', (q, motif) => {
    const r = RechercheRapport.safeParse(q);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain(motif);
  });

  it('recherche des tendances : périodes fermées, périmètre « aucun » ou identifiant', () => {
    expect(RechercheTendances.parse({}).periode).toBe(30);
    expect(RechercheTendances.parse({ periode: '91', perimetre: 'aucun' })).toEqual({
      periode: 91,
      perimetre: 'aucun',
    });
    expect(RechercheTendances.safeParse({ periode: '45' }).success).toBe(false);
    expect(RechercheTendances.safeParse({ perimetre: 'tous' }).success).toBe(false);
  });
});

describe('synthèses du rapport', () => {
  it('niveau : début, fin, plus haut, jours par niveau', () => {
    expect(
      syntheseNiveau([
        { jour: '2026-11-03', niveau: 4 },
        { jour: '2026-11-01', niveau: 2 },
        { jour: '2026-11-02', niveau: 2 },
        { jour: '2026-11-04', niveau: 3 },
      ]),
    ).toEqual({ instantanes: 4, debut: 2, fin: 3, max: 4, joursParNiveau: { 1: 0, 2: 2, 3: 1, 4: 1 } });
    expect(syntheseNiveau([])).toMatchObject({ instantanes: 0, debut: null, fin: null, max: null });
  });

  it('délai de prise en compte : moyenne, médiane, plus long, alertes non prises écartées', () => {
    expect(
      mesurerPrisesEnCompte([
        { critiqueLe: '2026-11-01T00:00:00Z', priseLe: '2026-11-01T02:00:00Z' },
        { critiqueLe: '2026-11-01T00:00:00Z', priseLe: '2026-11-01T06:00:00Z' },
        { critiqueLe: '2026-11-01T00:00:00Z', priseLe: '2026-11-02T01:00:00Z' },
        { critiqueLe: '2026-11-01T00:00:00Z', priseLe: null },
      ]),
    ).toEqual({ nombre: 3, moyenneHeures: 11, medianeHeures: 6, maxHeures: 25 });
    expect(mesurerPrisesEnCompte([])).toEqual({
      nombre: 0,
      moyenneHeures: null,
      medianeHeures: null,
      maxHeures: null,
    });
  });
});

/** Rapport fictif : une faille critique, un dépassement, une exception, une alerte. */
const rapport = (r: Partial<RapportVulnerabilitesDto> = {}): RapportVulnerabilitesDto => ({
  etablissement: 'Établissement fictif',
  produitLe: '2026-11-18T09:30:00.000Z',
  du: '2026-11-01',
  au: '2026-11-18',
  perimetre: { id: null, nom: null, aucun: false },
  avecDetail: false,
  niveau: {
    ...syntheseNiveau([
      { jour: '2026-11-17', niveau: 3 },
      { jour: '2026-11-18', niveau: 4 },
    ]),
    actuel: {
      niveau: 4,
      libelle: 'Maximale',
      explication: '1 faille exploitée et présente chez nous (P1) : seuil d’alerte critique.',
      faits: { critiques: 1, simples: 0, p2Presentes: 0, exploiteesAConfirmer: 0 },
    },
  },
  situation: mesures({ p1: 1, p2: 2, machines: null, actifs: null }),
  critiques: {
    total: 1,
    p2: 2,
    elements: [
      {
        cle: 'CVE-2026-0001',
        cve: 'CVE-2026-0001',
        titre: 'Exemple : faille fictive',
        produit: 'Produit fictif',
        presences: ['detectee', 'exposee'],
        depuis: '2026-11-10T08:00:00.000Z',
        enDepassement: true,
      },
    ],
  },
  delais: {
    reglage: DELAIS_CORRECTION_DEFAUT,
    mesures: mesurerCorrections([
      { priorite: 'P1', depuis: '2026-11-01T00:00:00Z', fin: '2026-11-02T00:00:00Z', echeance: '2026-11-03T00:00:00Z' },
    ]),
    nonMesurees: 1,
  },
  depassements: {
    total: 3,
    elements: [
      {
        nature: 'constat',
        titre: 'Exemple Linux : contrôle fictif',
        cves: ['CVE-2026-0001'],
        priorite: 'P1',
        echeance: '2026-11-12T08:00:00.000Z',
        retardHeures: 49,
      },
    ],
  },
  exceptions: {
    compteurs: { en_cours: 1, bientot_echue: 0, echue: 0, sans_echeance: 0 },
    elements: [
      {
        nature: 'constat',
        objetId: '00000000-0000-4000-8000-0000000000e5',
        titre: 'Exemple : équipement fictif',
        statut: 'en_cours',
        echeance: '2027-03-31',
        justification: 'Équipement biomédical fictif, [machine] non corrigeable.',
        mesure: '=Flux filtré (fictif).',
        par: 'rssi.fictif',
        le: '2026-11-05T09:00:00.000Z',
        expireeLe: null,
        etatApres: null,
      },
    ],
  },
  tendances: {
    depuis: '2026-11-17',
    semaines: agregerParSemaine(
      pointsParJour([lu('2026-11-17', 3, { p1: 0 }), lu('2026-11-18', 4, { p1: 1 })], '2026-11-16', '2026-11-18'),
    ),
    tendance: tendanceSituation([{ mesures: mesures({ p1: 0 }) }, { mesures: mesures({ p1: 1 }) }]),
  },
  alertes: {
    ouvertes: 1,
    prisesEnCompte: 1,
    closes: 0,
    enCours: 1,
    delai: mesurerPrisesEnCompte([{ critiqueLe: '2026-11-17T08:00:00Z', priseLe: '2026-11-17T10:00:00Z' }]),
    total: 1,
    elements: [
      {
        cve: 'CVE-2026-0001',
        titre: 'Exemple : faille fictive',
        produit: 'Produit fictif',
        critiqueLe: '2026-11-17T08:00:00.000Z',
        priseLe: '2026-11-17T10:00:00.000Z',
        closeLe: null,
        motif: null,
      },
    ],
  },
  sources: {
    fluxOuvert: true,
    veille: [
      { libelle: 'Source fictive à jour', derniereReussite: '2026-11-18T06:00:00Z', enRetard: false, enEchec: false },
      { libelle: 'Source fictive en retard', derniereReussite: null, enRetard: true, enEchec: false },
    ],
    connecteurs: [
      { libelle: 'Tenable Security Center n° 1', actif: true, derniereCompleteLe: null, derniereEtat: 'Reçue' },
    ],
  },
  bornes: { liste: 200 },
  ...r,
});

describe('tableaux du rapport', () => {
  it('sections dans l’ordre de lecture', () => {
    expect(tableauxRapport(rapport()).map((t) => t.id)).toEqual([
      'niveau',
      'situation',
      'critiques',
      'delais',
      'depassements',
      'exceptions',
      'tendances',
      'alertes',
      'sources',
    ]);
  });

  it.each([
    ['niveau', 'Au moment du rapport', ['Au moment du rapport', '4 (Maximale)']],
    ['niveau', 'Plus haut', ['Plus haut niveau de la période', '4 (Maximale)']],
    ['situation', 'Machines', ['Machines touchées', 'Par périmètre seulement']],
    [
      'critiques',
      'CVE',
      [
        'CVE-2026-0001',
        'Exemple : faille fictive',
        'Produit fictif',
        'Détectée par Tenable, Exposée sur Internet (AlgoLightHouse)',
        '10/11/2026 09:00',
        'En dépassement',
      ],
    ],
    ['delais', 'P1', ['P1', '48 heures', '1', '24 h', '24 h', '1 sur 1', '100 %']],
    ['depassements', 'Linux', ['Exemple Linux : contrôle fictif', 'CVE-2026-0001', 'P1', '12/11/2026 09:00', '2 j']],
    [
      'exceptions',
      'équipement',
      [
        'Exemple : équipement fictif',
        'En cours',
        '31/03/2027',
        'rssi.fictif',
        '05/11/2026 10:00',
        'Équipement biomédical fictif, [machine] non corrigeable.',
        '=Flux filtré (fictif).',
      ],
    ],
    [
      'alertes',
      'CVE',
      ['CVE-2026-0001', 'Exemple : faille fictive', 'Produit fictif', '17/11/2026 09:00', '17/11/2026 11:00', '—', '—'],
    ],
    ['sources', 'retard', ['Source fictive en retard', 'En retard', 'Jamais']],
  ])('%s : ligne « %s »', (id, debut, ligne) => {
    const t = tableauxRapport(rapport()).find((x) => x.id === id)!;
    expect(t.lignes.find((l) => l.some((c) => c.includes(debut)))).toEqual(ligne);
  });

  it('dit la borne atteinte, la tendance, l’historique et la règle', () => {
    const t = tableauxRapport(rapport());
    expect(t.find((x) => x.id === 'depassements')!.note).toBe(
      '1 lignes listées sur 3 ; les autres ne sont pas reprises.',
    );
    const tendances = t.find((x) => x.id === 'tendances')!;
    expect(tendances.titre).toBe('Tendance de la période : Se dégrade');
    expect(tendances.note).toContain('Historique depuis le 17/11/2026.');
    expect(tendances.note).toContain('à confirmer par le RSSI');
    expect(t.find((x) => x.id === 'alertes')!.note).toContain('moyen 2 h');
  });

  it('sans historique ni faille : textes des tables vides', () => {
    const t = tableauxRapport(
      rapport({
        critiques: { total: 0, p2: 0, elements: [] },
        tendances: { depuis: null, semaines: [], tendance: tendanceSituation([]) },
      }),
    );
    expect(t.find((x) => x.id === 'critiques')!.vide).toBe('Aucune faille présente en P1.');
    expect(t.find((x) => x.id === 'tendances')!.note).toContain('l’historique commence à l’installation du lot');
  });

  it('export CSV : en-tête, titres, formules neutralisées, BOM, aucun nom de machine ni d’adresse', () => {
    const csv = csvRapport(rapport({ perimetre: { id: PA, nom: 'Périmètre fictif', aucun: false } }));
    expect(csv.startsWith('﻿"Rapport de pilotage des vulnérabilités"')).toBe(true);
    expect(csv).toContain('"Établissement";"Établissement fictif"');
    expect(csv).toContain('"Période";"du 01/11/2026 au 18/11/2026"');
    expect(csv).toContain('"Portée";"Périmètre fictif"');
    expect(csv).toContain('"Document produit par la plateforme le";"18/11/2026 10:30"');
    expect(csv).toContain(`"'=Flux filtré (fictif)."`);
    expect(csv).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    expect(csv.split('\r\n').length).toBeGreaterThan(40);
  });
});
