/* Module Vulnérabilités (ADR 0100, points 9 et 16 ; lot V4a) : priorité d'une faille (chaque ligne de la grille, seuil
   réglé, faits rendus, rejouabilité) et rang d'une machine (ordre, faits). Lot ALH5 : majoration d'un cran quand l'actif
   exposé mène à une machine interne vulnérable (cas en table). Fonctions pures, données fictives. */
import { describe, expect, it } from 'vitest';
import {
  calculerPriorite,
  comparerControlesGlobal,
  comparerMachines,
  faitsDepuisSources,
  graviteDepuisScore,
  premierSignalement,
  prioriteLaPlusHaute,
  rangerSignalements,
  rangPriorite,
  SOURCES_EXPLOITABLE,
  SOURCE_EXPLOITATION_LIBELLES,
  SOURCES_EXPLOITATION,
  type SourcesFailleDto,
  valeursRetenues,
  type FaitsFaille,
  faitsRang,
  graviteDepuisNvd,
  libelleFaitPriorite,
  libelleFaitRang,
  machineVulnerable,
  majorerPriorite,
  NIVEAUX_MACHINE_VULNERABLE,
  NIVEAUX_PRIORITE,
  type Priorite,
  rangerMachines,
  REGLAGE_PRIORITE_DEFAUT,
  ReglagePriorite,
  RechercheConstats,
  RechercheDeclarees,
  DELAIS_CORRECTION_DEFAUT,
  SaisieReglagePriorite,
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
    // Lot S1 : les délais de correction sont rangés avec le seuil (valeurs par défaut du code).
    expect(REGLAGE_PRIORITE_DEFAUT).toEqual({ seuilEpss: 0.5, delais: DELAIS_CORRECTION_DEFAUT });
    const delais = DELAIS_CORRECTION_DEFAUT;
    expect(ReglagePriorite.safeParse({ seuilEpss: 0, delais }).success).toBe(false);
    expect(ReglagePriorite.safeParse({ seuilEpss: 1.01, delais }).success).toBe(false);
    expect(ReglagePriorite.safeParse({ seuilEpss: 1, delais }).success).toBe(true);
    expect(ReglagePriorite.safeParse({ seuilEpss: 1 }).success).toBe(false);
    expect(ReglagePriorite.safeParse({ seuilEpss: 0.5, delais, autre: 1 }).success).toBe(false);
    // Saisie (PUT) : le seuil, les délais, ou les deux ; jamais rien.
    expect(SaisieReglagePriorite.safeParse({ seuilEpss: 0.3 }).success).toBe(true);
    expect(SaisieReglagePriorite.safeParse({ delais }).success).toBe(true);
    expect(SaisieReglagePriorite.safeParse({}).success).toBe(false);
    expect(SaisieReglagePriorite.safeParse({ seuilEpss: 0.3, autre: 1 }).success).toBe(false);
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

describe('lot N2 : contrôle exploité par un logiciel malveillant (selon Tenable)', () => {
  it('source d’exploitation avérée, libellé exact, rangée après les sources datées', () => {
    expect(SOURCES_EXPLOITATION).toEqual(['kev', 'cert-fr', 'cert-sante', 'alh', 'tenable']);
    expect(SOURCE_EXPLOITATION_LIBELLES.tenable).toBe('Exploitée par un logiciel malveillant (selon Tenable)');
    expect(calculerPriorite(faits({ exploitation: ['tenable'], gravite: 'moyenne' }))).toEqual({
      niveau: 'P1',
      faits: [
        { fait: 'exploitation', sources: ['tenable'] },
        { fait: 'presence', presence: 'detectee' },
      ],
    });
    expect(libelleFaitPriorite({ fait: 'exploitation', sources: ['kev', 'tenable'] })).toBe(
      'Exploitation avérée (catalogue KEV, Exploitée par un logiciel malveillant (selon Tenable))',
    );
    expect(
      rangerSignalements(
        [
          { source: 'tenable', le: null },
          { source: 'kev', le: '2026-11-13T00:00:00.000Z' },
        ],
        SOURCES_EXPLOITATION,
      ),
    ).toEqual([
      { source: 'kev', le: '2026-11-13T00:00:00.000Z' },
      { source: 'tenable', le: null },
    ]);
    // Produit à confirmer : P2, comme pour toute autre source ; faille absente : P4 avec le fait.
    expect(calculerPriorite(faits({ exploitation: ['tenable'], presence: 'a_confirmer' })).niveau).toBe('P2');
    expect(calculerPriorite(faits({ exploitation: ['tenable'], presence: 'absente' })).niveau).toBe('P4');
  });

  it('non-régression : sans ce fait, la priorité est exactement celle d’avant pour chaque cas de la grille', () => {
    const cas: Partial<FaitsFaille>[] = [];
    for (const presence of ['detectee', 'declaree', 'exposee', 'a_confirmer', 'absente'] as const)
      for (const gravite of ['critique', 'elevee', 'moyenne', 'faible', null] as const)
        for (const epss of [null, 0.2, 0.9])
          for (const exploitable of [[], ['tenable']] as const)
            for (const exploitation of [[], ['kev'], ['alh', 'cert-fr']] as const)
              cas.push({ presence, gravite, epss, exploitable: [...exploitable], exploitation: [...exploitation] });
    for (const c of cas) {
      const p = calculerPriorite(faits(c));
      // Résultat attendu, recalculé à la main d'après la grille d'avant le lot N2.
      const exploitee = (c.exploitation ?? []).length > 0;
      const presente = ['detectee', 'declaree', 'exposee'].includes(c.presence!);
      const attendu =
        exploitee && presente
          ? 'P1'
          : (exploitee && c.presence === 'a_confirmer') ||
              (presente &&
                (c.gravite === 'critique' ||
                  (c.epss !== null && c.epss! >= 0.5) ||
                  (c.gravite === 'elevee' && (c.exploitable ?? []).length > 0)))
            ? 'P2'
            : presente && c.gravite === 'elevee'
              ? 'P3'
              : 'P4';
      expect(p.niveau, JSON.stringify(c)).toBe(attendu);
      for (const f of p.faits) if (f.fait === 'exploitation') expect(f.sources).not.toContain('tenable');
    }
  });

  it('faitsDepuisSources : le signalement de Tenable passe dans les faits, sans rien changer d’autre', () => {
    const s: SourcesFailleDto = {
      exploitation: [],
      exploitable: [{ source: 'tenable', le: null }],
      valeurs: { gravites: [{ source: 'tenable', gravite: 'elevee' }], cvss: [], epss: [] },
      certSante: null,
    };
    const sans = faitsDepuisSources(s);
    const avec = faitsDepuisSources({ ...s, exploitation: [{ source: 'tenable', le: null }] });
    expect(avec).toEqual({ ...sans, exploitation: ['tenable'] });
    expect(calculerPriorite({ ...sans, presence: 'detectee' }).niveau).toBe('P2');
    expect(calculerPriorite({ ...avec, presence: 'detectee' }).niveau).toBe('P1');
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

describe('surface externe (lot ALH2) : présence « exposée » et AlgoLightHouse, source de plus', () => {
  it('une CVE portée par un actif exposé est présente chez nous : P1 avec une exploitation avérée, quelle qu’en soit la source', () => {
    expect(calculerPriorite(faits({ exploitation: ['alh'], presence: 'exposee' }))).toEqual({
      niveau: 'P1',
      faits: [
        { fait: 'exploitation', sources: ['alh'] },
        { fait: 'presence', presence: 'exposee' },
      ],
    });
    expect(calculerPriorite(faits({ exploitation: ['kev'], presence: 'exposee' })).niveau).toBe('P1');
    expect(calculerPriorite(faits({ gravite: 'critique', presence: 'exposee' })).niveau).toBe('P2');
    expect(
      calculerPriorite(faits({ gravite: 'elevee', presence: 'exposee', exploitable: ['alh'] })).faits,
    ).toContainEqual({ fait: 'exploit_disponible', sources: ['alh'] });
    expect(calculerPriorite(faits({ gravite: 'elevee', presence: 'exposee' })).niveau).toBe('P3');
    expect(libelleFaitPriorite({ fait: 'presence', presence: 'exposee' })).toBe(
      'Exposée sur Internet (AlgoLightHouse)',
    );
    expect(libelleFaitPriorite({ fait: 'exploitation', sources: ['kev', 'alh'] })).toBe(
      'Exploitation avérée (catalogue KEV, AlgoLightHouse)',
    );
  });

  it('valeurs d’AlgoLightHouse gardées avec leur source ; la plus sévère prime (V27)', () => {
    const r = valeursRetenues({
      gravites: [
        { source: 'nvd', gravite: 'elevee' },
        { source: 'alh', gravite: 'critique' },
      ],
      cvss: [
        { source: 'nvd', score: 8.1 },
        { source: 'alh', score: 9.8 },
      ],
      epss: [
        { source: 'first', score: 0.42 },
        { source: 'alh', score: 0.42 },
      ],
    });
    expect(r.gravite).toEqual({ source: 'alh', gravite: 'critique' });
    expect(r.cvss).toEqual({ source: 'alh', score: 9.8 });
    // À valeur égale, l'ordre des sources départage (FIRST avant AlgoLightHouse).
    expect(r.epss).toEqual({ source: 'first', score: 0.42 });
  });

  it('priorité la plus haute d’une liste ; rang d’un niveau', () => {
    const p = (niveau: 'P1' | 'P2' | 'P3' | 'P4') => ({ niveau, faits: [] });
    expect(prioriteLaPlusHaute([p('P3'), p('P2'), p('P4')])).toEqual(p('P2'));
    expect(prioriteLaPlusHaute([])).toBeNull();
    expect(rangPriorite(p('P1'))).toBe(1);
  });
});

describe('ordre des contrôles du calcul global (lot PERF-04, décision du RSSI du 20/11/2026)', () => {
  const id = (n: number) => `0d0d0d0d-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
  const c = (n: number, d: string | null) => ({ id: id(n), dernierePresente: d });

  it('le contrôle détecté le plus récemment d’abord', () => {
    expect(comparerControlesGlobal(c(1, '2026-11-10T08:00:00.000Z'), c(2, '2026-11-15T08:00:00.000Z'))).toBeGreaterThan(
      0,
    );
    expect(comparerControlesGlobal(c(2, '2026-11-15T08:00:00.000Z'), c(1, '2026-11-10T08:00:00.000Z'))).toBeLessThan(0);
    // Mêmes instants écrits autrement : comparés comme des dates.
    expect(
      comparerControlesGlobal(c(1, '2026-11-15T09:00:00.000+01:00'), c(2, '2026-11-15T08:00:00.000Z')),
    ).toBeLessThan(0);
  });

  it('égalité parfaite : le plus petit identifiant ; sans date : après les contrôles datés', () => {
    expect(comparerControlesGlobal(c(4, '2026-11-12T08:00:00.000Z'), c(3, '2026-11-12T08:00:00.000Z'))).toBeGreaterThan(
      0,
    );
    expect(comparerControlesGlobal(c(3, '2026-11-12T08:00:00.000Z'), c(4, '2026-11-12T08:00:00.000Z'))).toBeLessThan(0);
    expect(comparerControlesGlobal(c(1, null), c(9, '2026-01-01T08:00:00.000Z'))).toBeGreaterThan(0);
    expect(comparerControlesGlobal(c(9, '2026-01-01T08:00:00.000Z'), c(1, null))).toBeLessThan(0);
    expect(comparerControlesGlobal(c(3, null), c(4, null))).toBeLessThan(0);
    expect(comparerControlesGlobal(c(3, null), c(3, null))).toBe(0);
  });

  it('ordre total : le même résultat quel que soit l’ordre reçu', () => {
    const liste = [
      c(5, '2026-11-12T08:00:00.000Z'),
      c(2, null),
      c(7, '2026-11-20T08:00:00.000Z'),
      c(1, '2026-11-12T08:00:00.000Z'),
      c(9, null),
      c(3, '2026-11-01T08:00:00.000Z'),
    ];
    const attendu = [7, 1, 5, 3, 2, 9].map((n) => id(n));
    // Toutes les rotations et leurs miroirs, plus un mélange pseudo-aléatoire rejouable.
    const ordres: (typeof liste)[] = [];
    for (let i = 0; i < liste.length; i++) {
      const r = [...liste.slice(i), ...liste.slice(0, i)];
      ordres.push(r, [...r].reverse());
    }
    let graine = 7;
    const melange = [...liste];
    for (let i = melange.length - 1; i > 0; i--) {
      graine = (graine * 48271) % 2147483647;
      const j = graine % (i + 1);
      [melange[i], melange[j]] = [melange[j]!, melange[i]!];
    }
    ordres.push(melange);
    for (const o of ordres) expect([...o].sort(comparerControlesGlobal).map((x) => x.id)).toEqual(attendu);
    // Avec prioriteLaPlusHaute (la première à niveau égal), le contrôle retenu ne dépend donc plus de l'ordre reçu.
    const p = (n: number, niveau: 'P1' | 'P2'): Priorite => ({
      niveau,
      faits: [
        { fait: 'presence', presence: 'detectee' },
        { fait: 'gravite', gravite: n === 1 ? 'critique' : null },
      ],
    });
    for (const o of ordres) {
      const triee = [...o].sort(comparerControlesGlobal);
      const niveaux = triee.map((x) => p(Number(x.id.slice(-2)), x.id === id(3) ? 'P1' : 'P2'));
      // P1 l'emporte toujours, quel que soit son rang ; à P2 égal, le plus récent (07) le serait.
      expect(prioriteLaPlusHaute(niveaux)?.niveau).toBe('P1');
      expect(prioriteLaPlusHaute(niveaux.filter((x) => x.niveau === 'P2'))).toEqual(p(7, 'P2'));
    }
  });
});

describe('majoration par la machine interne (lot ALH5, décision B)', () => {
  const p = (niveau: 'P1' | 'P2' | 'P3' | 'P4'): Priorite => ({
    niveau,
    faits: [{ fait: 'presence', presence: 'exposee' }],
  });
  it.each([
    ['P4', true, 'P3'],
    ['P3', true, 'P2'],
    ['P2', true, 'P1'],
    ['P1', true, 'P1'],
    ['P4', false, 'P4'],
    ['P3', false, 'P3'],
    ['P2', false, 'P2'],
    ['P1', false, 'P1'],
  ] as const)('%s, mène à une machine vulnérable : %s → %s', (avant, mene, apres) => {
    const r = majorerPriorite(p(avant), mene);
    expect(r.niveau).toBe(apres);
    if (mene) expect(r.faits.at(-1)).toEqual({ fait: 'machine_interne_vulnerable' });
    else expect(r).toEqual(p(avant));
  });

  it('enchaînée à la grille : P3 (présente et élevée) devient P2 avec le fait ; rien ne monte au-delà de P1', () => {
    const base = calculerPriorite(faits({ presence: 'exposee', gravite: 'elevee' }));
    expect(base.niveau).toBe('P3');
    expect(majorerPriorite(base, true)).toEqual({
      niveau: 'P2',
      faits: [...base.faits, { fait: 'machine_interne_vulnerable' }],
    });
    expect(majorerPriorite(majorerPriorite(p('P2'), true), true).niveau).toBe('P1');
  });

  it.each([
    [['P1'], true],
    [['P2', 'P4'], true],
    [['P3', 'P4'], false],
    [[], false],
  ] as const)('machine vulnérable si une faille présente est en P1 ou P2 : %j → %s', (niveaux, attendu) => {
    expect(machineVulnerable(niveaux.map((n) => p(n)))).toBe(attendu);
  });

  it('libellé du fait, sans nom de machine', () => {
    expect(NIVEAUX_MACHINE_VULNERABLE).toEqual(['P1', 'P2']);
    expect(libelleFaitPriorite({ fait: 'machine_interne_vulnerable' })).toBe('Mène à une machine interne vulnérable');
  });
});
