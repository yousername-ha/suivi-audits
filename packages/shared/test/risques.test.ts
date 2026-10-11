/* Gestion des risques (lot U3, ADR 0027) : calculs d'aide à la décision, état d'acceptation, références typées et
   compatibilité avec les fiches enregistrées avant la refonte. */
import { describe, expect, it } from 'vitest';
import {
  cibleAutorisee,
  EBIOS_ATELIERS,
  etatAcceptation,
  graviteProposee,
  grcReferences,
  indiceMenace,
  PILOTAGE_FIELDS,
  PILOTAGE_SCHEMAS,
  referencesTypees,
  RISK_REF_KINDS,
  RiskData,
} from '../src/index.js';

const U = '11111111-1111-4111-8111-111111111111';
const V = '22222222-2222-4222-8222-222222222222';

describe('calculs EBIOS RM', () => {
  it('indice de menace : (dépendance × pénétration) / (maturité × confiance), null si un critère manque', () => {
    expect(indiceMenace({ dependency: 4, penetration: 3, maturity: 2, trust: 2 })).toBe(3);
    expect(indiceMenace({ dependency: 1, penetration: 1, maturity: 3, trust: 4 })).toBe(0.08);
    expect(indiceMenace({ dependency: 4, penetration: 3, maturity: null, trust: 2 })).toBeNull();
  });
  it('gravité proposée : la plus forte des événements redoutés gradués', () => {
    expect(graviteProposee([2, null, 4, undefined, 1])).toBe(4);
    expect(graviteProposee([null, undefined])).toBeNull();
  });
  it('cinq ateliers, chacun avec ses types d’objets ; tout type d’atelier a un formulaire', () => {
    expect(EBIOS_ATELIERS.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    for (const k of EBIOS_ATELIERS.flatMap((a) => a.kinds).filter((k) => k !== 'risk'))
      expect(PILOTAGE_FIELDS[k]?.length, k).toBeGreaterThan(0);
  });
});

describe('acceptation formelle (ISO/IEC 27005)', () => {
  const j = '2026-10-11';
  it('« accepter » sans décision : à décider ; refus ; échéance dépassée : échue', () => {
    expect(etatAcceptation('accept', null, j)).toBe('a_decider');
    expect(etatAcceptation('accept', { result: 'rejected', until: null }, j)).toBe('refusee');
    expect(etatAcceptation('accept', { result: 'accepted', until: '2027-01-01' }, j)).toBe('acceptee');
    expect(etatAcceptation('accept', { result: 'accepted', until: '2026-10-10' }, j)).toBe('echue');
  });
  it('autre option : sans objet', () => {
    expect(etatAcceptation('reduce', null, j)).toBe('sans_objet');
  });
});

describe('références typées', () => {
  it('cible autorisée selon le type d’objet ou la clé historique', () => {
    const c = RISK_REF_KINDS.strategic_scenario!.fearedEventRefs!;
    expect(cibleAutorisee(`object:${U}`, 'feared_event', c)).toBe(true);
    expect(cibleAutorisee(`object:${U}`, 'risk', c)).toBe(false);
    expect(cibleAutorisee('legacy:processes:P1', null, RISK_REF_KINDS.risk!.assetRefs!)).toBe(true);
    expect(cibleAutorisee('legacy:findings:E1', null, RISK_REF_KINDS.risk!.assetRefs!)).toBe(false);
    expect(cibleAutorisee(`document:${U}:1`, null, c)).toBe(false);
  });
  it('les champs typés sont collectés pour la résolution des droits, sans les autres champs « …Ref »', () => {
    const data = { studyRef: `object:${U}`, fearedEventRefs: [`object:${V}`], seriesRef: `object:${V}`, refs: [] };
    expect(referencesTypees('strategic_scenario', data).map((r) => r.champ)).toEqual(['studyRef', 'fearedEventRefs']);
    expect(grcReferences(data).sort()).toEqual([`object:${U}`, `object:${V}`]);
    expect(grcReferences({ seriesRef: `object:${V}` })).toEqual([]);
  });
});

describe('compatibilité des fiches antérieures', () => {
  it('objets EBIOS en texte libre et risque sans champs ISO restent valides', () => {
    expect(
      PILOTAGE_SCHEMAS.feared_event.parse({ consequences: 'Arrêt', severity: 'Grave', businessValue: 'Soins' }),
    ).toMatchObject({ severity: 'Grave', gravity: null, studyRef: null });
    expect(PILOTAGE_SCHEMAS.operational_scenario.parse({ likelihood: 'Forte' }).likelihood).toBe('Forte');
    const risque = RiskData.parse({
      description: '',
      code: 'R1',
      ownerId: null,
      methodId: U,
      methodVersion: 1,
      domain: '',
      entity: '',
      scope: '',
      strategy: 'reduce',
      acceptanceReason: '',
      reviewAt: null,
      stages: {},
    });
    expect(risque.assetRefs).toBeUndefined();
  });
  it('niveaux bornés de 1 à 4 ; couple retenu sans source refusé', () => {
    expect(() => PILOTAGE_SCHEMAS.ecosystem_party.parse({ dependency: 5 })).toThrow();
    expect(() => PILOTAGE_SCHEMAS.sr_ov.parse({ retained: true })).toThrow();
    expect(PILOTAGE_SCHEMAS.sr_ov.parse({ retained: true, sourceRef: `object:${U}` }).retained).toBe(true);
  });
});
