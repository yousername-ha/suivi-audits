/* Module Vulnérabilités (ADR 0100, points 9 et 16 ; lot V4a) : priorité d'une faille (chaque ligne de la grille, seuil
   réglé, faits rendus, rejouabilité) et rang d'une machine (ordre, faits). Fonctions pures, données fictives. */
import { describe, expect, it } from 'vitest';
import {
  calculerPriorite,
  comparerMachines,
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
  exploitDisponible: false,
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
    expect(calculerPriorite(faits({ gravite: 'elevee', exploitDisponible: true }))).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'detectee' },
        { fait: 'gravite', gravite: 'elevee' },
        { fait: 'exploit_disponible' },
      ],
    });
    expect(calculerPriorite(faits({ gravite: 'critique', epss: 0.9 })).faits).toEqual([
      { fait: 'presence', presence: 'detectee' },
      { fait: 'gravite', gravite: 'critique' },
      { fait: 'epss', score: 0.9, seuil: 0.5 },
    ]);
    // Exploit disponible sans gravité élevée : pas de P2 pour autant.
    expect(calculerPriorite(faits({ gravite: 'moyenne', exploitDisponible: true })).niveau).toBe('P4');
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
    expect(libelleFaitPriorite({ fait: 'exploit_disponible' })).toBe('Code d’exploitation disponible (Tenable)');
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
