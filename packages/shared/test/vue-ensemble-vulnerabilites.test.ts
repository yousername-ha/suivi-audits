/* Module Vulnérabilités (ADR 0100, lot PC1) : « Vue d'ensemble ». Niveau d'alerte de 1 à 4 en table (règle proposée, à
   confirmer par le RSSI), secteur d'une faille (famille du produit rapproché, sinon « Non classé »), ordre des cibles, le
   même pour tout le monde. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  type CibleVueDto,
  comparerCibles,
  type FaitsNiveauAlerteGlobal,
  FAMILLES_PRODUIT,
  type NiveauAlerteGlobal,
  NIVEAU_ALERTE_GLOBAL_LIBELLES,
  niveauAlerteGlobal,
  REGLE_NIVEAU_ALERTE_GLOBAL,
  SECTEUR_RADAR_LIBELLES,
  SECTEURS_RADAR,
  secteurDe,
} from '../src/index.js';

const f = (critiques: number, simples: number, p2Presentes: number, exploiteesAConfirmer: number) => ({
  critiques,
  simples,
  p2Presentes,
  exploiteesAConfirmer,
});

describe('niveau d’alerte (1 à 4), règle proposée au lot PC1', () => {
  const cas: [string, FaitsNiveauAlerteGlobal, NiveauAlerteGlobal, RegExp][] = [
    ['rien du tout', f(0, 0, 0, 0), 1, /^Aucune faille présente en P1 ni en P2/],
    ['une faille P2 présente', f(0, 0, 1, 0), 2, /^1 faille présente en P2\.$/],
    [
      'une faille exploitée à confirmer seulement',
      f(0, 0, 0, 1),
      2,
      /^1 faille exploitée dont le produit reste à confirmer\.$/,
    ],
    ['P2 présentes et exploitées à confirmer', f(0, 0, 3, 2), 2, /^3 failles présentes en P2 ; 2 failles exploitées/],
    ['une alerte simple', f(0, 1, 1, 0), 3, /^1 faille en P2, exploitable et exposée directement sur Internet/],
    ['deux alertes simples', f(0, 2, 5, 4), 3, /^2 failles en P2, exploitables et exposées/],
    [
      'une faille P1 présente',
      f(1, 0, 0, 0),
      4,
      /^1 faille présente chez nous en P1 \(exploitation avérée, ou machine en fin de support\)/,
    ],
    ['P1 l’emporte sur tout le reste', f(3, 9, 9, 9), 4, /^3 failles présentes chez nous en P1/],
  ];
  for (const [nom, faits, niveau, phrase] of cas)
    it(nom, () => {
      const n = niveauAlerteGlobal(faits);
      expect(n.niveau).toBe(niveau);
      expect(n.libelle).toBe(NIVEAU_ALERTE_GLOBAL_LIBELLES[niveau]);
      expect(n.explication).toMatch(phrase);
      expect(n.faits).toEqual(faits);
    });
  it('libellés des quatre crans et règle écrite « à confirmer »', () => {
    expect(NIVEAU_ALERTE_GLOBAL_LIBELLES).toEqual({ 1: 'Veille', 2: 'Vigilance', 3: 'Alerte', 4: 'Maximale' });
    expect(REGLE_NIVEAU_ALERTE_GLOBAL).toContain('à confirmer par le RSSI');
  });
  it('déterministe : mêmes faits, même résultat', () => {
    expect(niveauAlerteGlobal(f(0, 2, 1, 0))).toEqual(niveauAlerteGlobal(f(0, 2, 1, 0)));
  });
});

describe('secteur du radar : famille du produit rapproché, sans nomenclature nouvelle', () => {
  it('les secteurs sont les familles du registre, plus « Non classé »', () => {
    expect(SECTEURS_RADAR).toEqual([...FAMILLES_PRODUIT, 'non_classe']);
    expect(SECTEUR_RADAR_LIBELLES.non_classe).toBe('Non classé');
    expect(SECTEUR_RADAR_LIBELLES.web).toBe('Web');
  });
  it('aucune famille : non classé ; plusieurs : la première de la liste fermée', () => {
    expect(secteurDe([])).toBe('non_classe');
    expect(secteurDe(['web'])).toBe('web');
    expect(secteurDe(['web', 'reseau', 'web'])).toBe('reseau');
    expect(secteurDe(['web', 'reseau'])).toBe(secteurDe(['reseau', 'web']));
  });
});

describe('ordre des cibles, le même pour tout le monde', () => {
  type C = Pick<CibleVueDto, 'priorite' | 'exploitee' | 'aConfirmer' | 'exploitable' | 'gravite' | 'epss' | 'cle'>;
  const c = (cle: string, niveau: 'P1' | 'P2' | 'P3' | 'P4', autres: Partial<C> = {}): C => ({
    cle,
    priorite: { niveau, faits: [] },
    exploitee: false,
    aConfirmer: false,
    exploitable: false,
    gravite: null,
    epss: null,
    ...autres,
  });
  it('lot PRIO-1 : à priorité égale, une faille utilisée par des rançongiciels passe devant ; le niveau prime', () => {
    const rancon = (cle: string, niveau: 'P1' | 'P2', autres: Partial<C> = {}): C =>
      c(cle, niveau, { priorite: { niveau, faits: [{ fait: 'rancongiciel' }] }, ...autres });
    const liste = [
      c('CVE-2026-90013', 'P1', { exploitee: true, gravite: 'critique', epss: 0.9 }),
      rancon('CVE-2026-90012', 'P1', { exploitee: true, gravite: 'faible' }),
      rancon('CVE-2026-90011', 'P2', { exploitee: true, aConfirmer: true }),
      c('CVE-2026-90010', 'P1'),
    ];
    expect([...liste].sort(comparerCibles).map((x) => x.cle)).toEqual([
      'CVE-2026-90012',
      'CVE-2026-90013',
      'CVE-2026-90010',
      'CVE-2026-90011',
    ]);
    expect([...liste].reverse().sort(comparerCibles)).toEqual([...liste].sort(comparerCibles));
  });
  it('priorité, exploitation, présence, exploitable, gravité, EPSS puis clé', () => {
    const liste = [
      c('CVE-2026-90009', 'P4'),
      c('CVE-2026-90008', 'P2', { epss: 0.2 }),
      c('CVE-2026-90007', 'P2', { epss: 0.9 }),
      c('CVE-2026-90006', 'P2', { gravite: 'critique' }),
      c('CVE-2026-90005', 'P2', { exploitable: true }),
      c('CVE-2026-90004', 'P2', { exploitee: true, aConfirmer: true }),
      c('CVE-2026-90003', 'P2', { exploitee: true }),
      c('CVE-2026-90002', 'P1', { exploitee: true }),
      c('CVE-2026-90001', 'P3'),
      c('CVE-2026-90000', 'P3'),
    ];
    expect([...liste].sort(comparerCibles).map((x) => x.cle)).toEqual([
      'CVE-2026-90002',
      'CVE-2026-90003',
      'CVE-2026-90004',
      'CVE-2026-90005',
      'CVE-2026-90006',
      'CVE-2026-90007',
      'CVE-2026-90008',
      'CVE-2026-90000',
      'CVE-2026-90001',
      'CVE-2026-90009',
    ]);
    // Ordre indépendant de l'ordre d'arrivée.
    expect([...liste].reverse().sort(comparerCibles)).toEqual([...liste].sort(comparerCibles));
  });
});
