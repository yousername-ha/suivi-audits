/* Module Vulnérabilités (ADR 0100, points 9 et 16 ; lot V4a) : priorité d'une faille (chaque ligne de la grille, seuil
   réglé, faits rendus, rejouabilité) et rang d'une machine (ordre, faits). Fonctions pures, données fictives. */
import { describe, expect, it } from 'vitest';
import {
  calculerPriorite,
  comparerMachines,
  faitsDepuisSources,
  graviteDepuisScore,
  premierSignalement,
  rangerSignalements,
  SOURCES_EXPLOITABLE,
  SOURCES_EXPLOITATION,
  type SourcesFailleDto,
  valeursRetenues,
  type FaitsFaille,
  faitsRang,
  graviteDepuisNvd,
  libelleFaitPriorite,
  libelleFaitRang,
  NIVEAUX_PRIORITE,
  rangerMachines,
  REGLAGE_PRIORITE_DEFAUT,
  ReglagePriorite,
  RechercheConstats,
  RechercheDeclarees,
} from '../src/index.js';

const faits = (f: Partial<FaitsFaille> = {}): FaitsFaille => ({
  exploitation: [],
  presence: 'detectee',
  gravite: 'moyenne',
  epss: null,
  exploitable: [],
  ...f,
});

describe('priorité d’une faille (grille de départ)', () => {
  it('P1 : exploitation avérée et présente (détectée ou déclarée)', () => {
    expect(calculerPriorite(faits({ exploitation: ['kev'], gravite: 'faible' }))).toEqual({
      niveau: 'P1',
      faits: [
        { fait: 'exploitation', sources: ['kev'] },
        { fait: 'presence', presence: 'detectee' },
      ],
    });
    expect(calculerPriorite(faits({ exploitation: ['cert-fr', 'kev'], presence: 'declaree' }))).toEqual({
      niveau: 'P1',
      faits: [
        { fait: 'exploitation', sources: ['kev', 'cert-fr'] },
        { fait: 'presence', presence: 'declaree' },
      ],
    });
  });

  it('P2 : exploitée et produit à confirmer', () => {
    expect(
      calculerPriorite(faits({ exploitation: ['cert-fr'], presence: 'a_confirmer', gravite: 'critique' })),
    ).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'exploitation', sources: ['cert-fr'] },
        { fait: 'presence', presence: 'a_confirmer' },
      ],
    });
  });

  it('P2 : présente et critique', () => {
    expect(calculerPriorite(faits({ gravite: 'critique' }))).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'detectee' },
        { fait: 'gravite', gravite: 'critique' },
      ],
    });
  });

  it('P2 : présente et score EPSS au moins égal au seuil (0,5 par défaut)', () => {
    expect(calculerPriorite(faits({ presence: 'declaree', epss: 0.5 }))).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'declaree' },
        { fait: 'epss', score: 0.5, seuil: 0.5 },
      ],
    });
    expect(calculerPriorite(faits({ epss: 0.4999 })).niveau).toBe('P4');
  });

  it('P2 : présente, élevée et exploit disponible ; plusieurs règles remplies : faits réunis sans doublon', () => {
    expect(calculerPriorite(faits({ gravite: 'elevee', exploitable: ['tenable'] }))).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'detectee' },
        { fait: 'gravite', gravite: 'elevee' },
        { fait: 'exploit_disponible', sources: ['tenable'] },
      ],
    });
    expect(calculerPriorite(faits({ gravite: 'critique', epss: 0.9 })).faits).toEqual([
      { fait: 'presence', presence: 'detectee' },
      { fait: 'gravite', gravite: 'critique' },
      { fait: 'epss', score: 0.9, seuil: 0.5 },
    ]);
    // Exploit disponible sans gravité élevée : pas de P2 pour autant.
    expect(calculerPriorite(faits({ gravite: 'moyenne', exploitable: ['tenable'] })).niveau).toBe('P4');
  });

  it('P3 : présente et élevée', () => {
    expect(calculerPriorite(faits({ gravite: 'elevee', presence: 'declaree' }))).toEqual({
      niveau: 'P3',
      faits: [
        { fait: 'presence', presence: 'declaree' },
        { fait: 'gravite', gravite: 'elevee' },
      ],
    });
  });

  it('P4 : le reste (absente, à confirmer sans exploitation, gravité moyenne, faible ou inconnue)', () => {
    expect(calculerPriorite(faits({ presence: 'absente', gravite: 'critique', epss: 0.99 }))).toEqual({
      niveau: 'P4',
      faits: [
        { fait: 'presence', presence: 'absente' },
        { fait: 'gravite', gravite: 'critique' },
      ],
    });
    expect(calculerPriorite(faits({ presence: 'a_confirmer', gravite: 'critique' })).niveau).toBe('P4');
    expect(calculerPriorite(faits({ gravite: null })).faits).toEqual([
      { fait: 'presence', presence: 'detectee' },
      { fait: 'gravite', gravite: null },
    ]);
    // Exploitée mais absente : P4, l'exploitation figure dans les faits.
    expect(calculerPriorite(faits({ exploitation: ['kev'], presence: 'absente' })).faits[0]).toEqual({
      fait: 'exploitation',
      sources: ['kev'],
    });
  });

  it('constat sans CVE (non maintenu) : classé sur sa gravité et sa présence', () => {
    expect(calculerPriorite(faits({ gravite: 'critique' })).niveau).toBe('P2');
    expect(calculerPriorite(faits({ gravite: 'elevee' })).niveau).toBe('P3');
    expect(calculerPriorite(faits({ gravite: 'faible' })).niveau).toBe('P4');
  });

  it('seuil réglé : appliqué et cité dans les faits ; réglage contrôlé', () => {
    const r = { seuilEpss: 0.2 };
    expect(calculerPriorite(faits({ epss: 0.25 }), r)).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'detectee' },
        { fait: 'epss', score: 0.25, seuil: 0.2 },
      ],
    });
    expect(calculerPriorite(faits({ epss: 0.25 })).niveau).toBe('P4');
    expect(REGLAGE_PRIORITE_DEFAUT).toEqual({ seuilEpss: 0.5 });
    expect(ReglagePriorite.safeParse({ seuilEpss: 0 }).success).toBe(false);
    expect(ReglagePriorite.safeParse({ seuilEpss: 1.01 }).success).toBe(false);
    expect(ReglagePriorite.safeParse({ seuilEpss: 1 }).success).toBe(true);
    expect(ReglagePriorite.safeParse({ seuilEpss: 0.5, autre: 1 }).success).toBe(false);
  });

  it('rejouable : mêmes faits, même résultat, sans dépendre de l’ordre des sources', () => {
    const f = faits({ exploitation: ['cert-fr', 'kev'], presence: 'a_confirmer', gravite: 'elevee', epss: 0.7 });
    const a = calculerPriorite(f);
    for (let i = 0; i < 5; i++) expect(calculerPriorite({ ...f })).toEqual(a);
    expect(calculerPriorite({ ...f, exploitation: ['kev', 'cert-fr'] })).toEqual(a);
  });

  it('libellés des faits et gravité tirée de NVD', () => {
    expect(libelleFaitPriorite({ fait: 'exploitation', sources: ['kev', 'cert-fr'] })).toBe(
      'Exploitation avérée (catalogue KEV, alerte du CERT-FR)',
    );
    expect(libelleFaitPriorite({ fait: 'presence', presence: 'declaree' })).toBe('Déclarée (produit surveillé)');
    expect(libelleFaitPriorite({ fait: 'gravite', gravite: 'elevee' })).toBe('Gravité élevée');
    expect(libelleFaitPriorite({ fait: 'gravite', gravite: null })).toBe('Gravité non publiée');
    expect(libelleFaitPriorite({ fait: 'epss', score: 0.62, seuil: 0.5 })).toBe('Score EPSS 62 % (seuil 50 %)');
    expect(libelleFaitPriorite({ fait: 'exploit_disponible', sources: ['tenable'] })).toBe(
      'Code d’exploitation disponible (Tenable)',
    );
    expect(libelleFaitPriorite({ fait: 'exploitation', sources: ['cert-sante'] })).toBe(
      'Exploitation avérée (fiche du CERT Santé)',
    );
    expect(libelleFaitPriorite({ fait: 'exploit_disponible', sources: ['tenable', 'cert-sante'] })).toBe(
      'Code d’exploitation disponible (Tenable, preuve de concept selon le CERT Santé)',
    );
    expect(graviteDepuisNvd('CRITICAL', 'LOW')).toBe('critique');
    expect(graviteDepuisNvd(null, 'HIGH')).toBe('elevee');
    expect(graviteDepuisNvd('MEDIUM', null)).toBe('moyenne');
    expect(graviteDepuisNvd('LOW', null)).toBe('faible');
    expect(graviteDepuisNvd('NONE', null)).toBeNull();
    expect(graviteDepuisNvd(null, null)).toBeNull();
  });

  it('filtres de priorité des listes : P1 à P4 seulement', () => {
    expect(NIVEAUX_PRIORITE).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(RechercheConstats.parse({ priorite: 'P2' }).priorite).toBe('P2');
    expect(RechercheConstats.safeParse({ priorite: 'P5' }).success).toBe(false);
    expect(RechercheDeclarees.parse({})).toEqual({ page: 1 });
    expect(RechercheDeclarees.safeParse({ priorite: 'p1' }).success).toBe(false);
  });
});

describe('rang d’une machine', () => {
  const m = (
    cle: string,
    x: Partial<{
      exploitationAveree: number;
      role: 'front' | 'back' | 'bdd' | null;
      critiques: number;
      elevees: number;
    }> = {},
  ) => ({
    cle,
    exploitationAveree: 0,
    role: null as 'front' | 'back' | 'bdd' | null,
    critiques: 0,
    elevees: 0,
    ...x,
  });

  it('exploitation avérée d’abord, puis rôle (front, back, base, sans rôle), puis critiques, puis élevées', () => {
    const parc = [
      m('a', { role: 'front', critiques: 9 }),
      m('b', { role: 'bdd', exploitationAveree: 1 }),
      m('c', { role: 'back', critiques: 5 }),
      m('d', { role: null, critiques: 50 }),
      m('e', { role: 'back', critiques: 5, elevees: 2 }),
      m('f', { role: 'front', exploitationAveree: 3 }),
      m('g', { role: 'bdd', critiques: 1 }),
    ];
    expect(rangerMachines(parc).map((x) => [x.cle, x.rang])).toEqual([
      ['f', 1],
      ['b', 2],
      ['a', 3],
      ['e', 4],
      ['c', 5],
      ['g', 6],
      ['d', 7],
    ]);
  });

  it('égalité : la clé départage ; ordre stable et rejouable, indépendant de l’ordre d’entrée', () => {
    const parc = [m('srv-b'), m('srv-a'), m('srv-c', { elevees: 1 })];
    const attendu = ['srv-c', 'srv-a', 'srv-b'];
    expect(rangerMachines(parc).map((x) => x.cle)).toEqual(attendu);
    expect(rangerMachines([...parc].reverse()).map((x) => x.cle)).toEqual(attendu);
    expect(comparerMachines(m('x'), m('x'))).toBe(0);
    // L'entrée n'est pas modifiée.
    expect(parc.map((x) => x.cle)).toEqual(['srv-b', 'srv-a', 'srv-c']);
  });

  it('faits rendus dans l’ordre du classement, avec leurs libellés', () => {
    const f = faitsRang({ exploitationAveree: 2, role: 'back', critiques: 1, elevees: 0 });
    expect(f).toEqual([
      { fait: 'exploitation', nombre: 2 },
      { fait: 'role', role: 'back' },
      { fait: 'critiques', nombre: 1 },
      { fait: 'elevees', nombre: 0 },
    ]);
    expect(f.map(libelleFaitRang)).toEqual([
      '2 failles à l’exploitation avérée',
      'Rôle : Back applicatif',
      '1 critique',
      '0 élevée',
    ]);
    expect(libelleFaitRang({ fait: 'exploitation', nombre: 0 })).toBe('Aucune exploitation avérée');
    expect(libelleFaitRang({ fait: 'role', role: null })).toBe('Rôle non renseigné');
  });
});

describe('plusieurs sources (V26) : exploitation avérée et « exploitable »', () => {
  it('une seule source suffit pour l’exploitation avérée, quelle qu’elle soit', () => {
    for (const source of SOURCES_EXPLOITATION)
      expect(calculerPriorite(faits({ exploitation: [source], presence: 'declaree' }))).toEqual({
        niveau: 'P1',
        faits: [
          { fait: 'exploitation', sources: [source] },
          { fait: 'presence', presence: 'declaree' },
        ],
      });
    // Plusieurs sources : toutes citées, dans l'ordre de la liste, quel que soit l'ordre reçu.
    expect(
      calculerPriorite(faits({ exploitation: ['cert-sante', 'kev', 'cert-fr'], presence: 'detectee' })).faits[0],
    ).toEqual({ fait: 'exploitation', sources: ['kev', 'cert-fr', 'cert-sante'] });
    // Produit à confirmer et exploitation signalée par le seul CERT Santé : P2.
    expect(calculerPriorite(faits({ exploitation: ['cert-sante'], presence: 'a_confirmer' })).niveau).toBe('P2');
  });

  it('« exploitable » selon une seule source suffit (Tenable ou preuve de concept du CERT Santé)', () => {
    for (const source of SOURCES_EXPLOITABLE)
      expect(calculerPriorite(faits({ gravite: 'elevee', exploitable: [source] })).faits).toContainEqual({
        fait: 'exploit_disponible',
        sources: [source],
      });
    expect(calculerPriorite(faits({ gravite: 'elevee', exploitable: ['cert-sante', 'tenable'] })).faits.at(-1)).toEqual(
      { fait: 'exploit_disponible', sources: ['tenable', 'cert-sante'] },
    );
    // « Exploitable » n'est pas une exploitation avérée : jamais de P1 à lui seul.
    expect(calculerPriorite(faits({ gravite: 'critique', exploitable: ['cert-sante'] })).niveau).toBe('P2');
    expect(calculerPriorite(faits({ gravite: 'faible', exploitable: ['cert-sante'] })).niveau).toBe('P4');
  });

  it('la source en avance prime : signalements rangés par date, date inconnue en dernier, une fois par source', () => {
    const liste = [
      { source: 'kev' as const, le: '2026-11-13T00:00:00.000Z' },
      { source: 'cert-sante' as const, le: '2026-11-10T02:28:01.000Z' },
      { source: 'cert-fr' as const, le: null },
      { source: 'cert-sante' as const, le: '2026-11-12T00:00:00.000Z' },
    ];
    expect(rangerSignalements(liste, SOURCES_EXPLOITATION)).toEqual([
      { source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' },
      { source: 'kev', le: '2026-11-13T00:00:00.000Z' },
      { source: 'cert-fr', le: null },
    ]);
    expect(premierSignalement(liste, SOURCES_EXPLOITATION)).toEqual({
      source: 'cert-sante',
      le: '2026-11-10T02:28:01.000Z',
    });
    expect(premierSignalement([], SOURCES_EXPLOITATION)).toBeNull();
    // Dates égales ou toutes inconnues : ordre de la liste des sources ; source hors liste ignorée.
    expect(
      rangerSignalements(
        [
          { source: 'cert-sante', le: null },
          { source: 'tenable', le: null },
          { source: 'autre' as 'tenable', le: '2000-01-01T00:00:00.000Z' },
        ],
        SOURCES_EXPLOITABLE,
      ),
    ).toEqual([
      { source: 'tenable', le: null },
      { source: 'cert-sante', le: null },
    ]);
  });
});

describe('valeur la plus sévère entre les sources (V27)', () => {
  it('gravité, score CVSS et score EPSS : la plus haute, avec sa source ; chaque valeur reste disponible', () => {
    const v = {
      gravites: [
        { source: 'tenable' as const, gravite: 'elevee' as const },
        { source: 'nvd' as const, gravite: 'moyenne' as const },
        { source: 'cert-sante' as const, gravite: 'critique' as const },
      ],
      cvss: [
        { source: 'nvd' as const, score: 6.5 },
        { source: 'cert-sante' as const, score: 9.8 },
        { source: 'tenable' as const, score: 7.5 },
      ],
      epss: [
        { source: 'first' as const, score: 0.12 },
        { source: 'tenable' as const, score: 0.31 },
      ],
    };
    expect(valeursRetenues(v)).toEqual({
      gravite: { source: 'cert-sante', gravite: 'critique' },
      cvss: { source: 'cert-sante', score: 9.8 },
      epss: { source: 'tenable', score: 0.31 },
    });
    // L'entrée n'est pas modifiée (chaque valeur gardée avec sa source).
    expect(v.cvss.map((x) => x.source)).toEqual(['nvd', 'cert-sante', 'tenable']);
  });

  it('égalité : la première source de la liste ; aucune valeur : null ; rejouable', () => {
    const v = {
      gravites: [
        { source: 'cert-sante' as const, gravite: 'elevee' as const },
        { source: 'nvd' as const, gravite: 'elevee' as const },
      ],
      cvss: [
        { source: 'tenable' as const, score: 7.5 },
        { source: 'nvd' as const, score: 7.5 },
      ],
      epss: [],
    };
    const r = valeursRetenues(v);
    expect(r).toEqual({
      gravite: { source: 'nvd', gravite: 'elevee' },
      cvss: { source: 'nvd', score: 7.5 },
      epss: null,
    });
    expect(valeursRetenues({ gravites: [...v.gravites].reverse(), cvss: [...v.cvss].reverse(), epss: [] })).toEqual(r);
  });

  it('gravité tirée d’un score CVSS v3 (échelle de FIRST)', () => {
    expect([10, 9, 8.9, 7, 6.9, 4, 3.9, 0.1].map(graviteDepuisScore)).toEqual([
      'critique',
      'critique',
      'elevee',
      'elevee',
      'moyenne',
      'moyenne',
      'faible',
      'faible',
    ]);
    for (const x of [0, -1, 10.1, Number.NaN, null]) expect(graviteDepuisScore(x)).toBeNull();
  });

  it('la priorité prend la valeur la plus sévère et les sources de l’exploitation', () => {
    const s: SourcesFailleDto = {
      exploitation: [{ source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' }],
      exploitable: [{ source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' }],
      valeurs: {
        gravites: [
          { source: 'nvd', gravite: 'moyenne' },
          { source: 'cert-sante', gravite: 'critique' },
        ],
        cvss: [],
        epss: [
          { source: 'first', score: 0.2 },
          { source: 'tenable', score: 0.7 },
        ],
      },
      certSante: { correctif: 'oui', contournement: null },
    };
    expect(faitsDepuisSources(s)).toEqual({
      exploitation: ['cert-sante'],
      exploitable: ['cert-sante'],
      gravite: 'critique',
      epss: 0.7,
    });
    expect(calculerPriorite({ ...faitsDepuisSources(s), presence: 'a_confirmer' }).niveau).toBe('P2');
    expect(calculerPriorite({ ...faitsDepuisSources(s), presence: 'declaree' }).niveau).toBe('P1');
    const sansExploitation = { ...s, exploitation: [] };
    expect(calculerPriorite({ ...faitsDepuisSources(sansExploitation), presence: 'declaree' })).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'declaree' },
        { fait: 'gravite', gravite: 'critique' },
        { fait: 'epss', score: 0.7, seuil: 0.5 },
      ],
    });
  });
});
