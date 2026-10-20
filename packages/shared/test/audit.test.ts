/* Modèle et schémas du module Audit. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  type AuditState,
  COVERAGE_LABELS,
  CoverageUpdateBody,
  CycleUpdateBody,
  FINDING_SOURCES,
  FINDING_STATUSES,
  FINDING_TYPES,
  FINDING_TYPE_LABELS,
  LEVEL_LABELS,
  LV,
  PLAN_STATUSES,
  PREP_LABELS,
  PreparationCopyBody,
  PreparationUpdateBody,
  RequirementId,
  RequirementUpdateBody,
  SLOT_KIND_LABELS,
  SlotCreateBody,
  SlotUpdateBody,
  findingTypeLabel,
  itemCode,
  nextCoverage,
} from '../src/audit/index.js';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const INDEX = readFileSync(path.join(RACINE, 'app/public/index.html'), 'utf8');
const DONNEES = JSON.parse(readFileSync(path.join(RACINE, 'tests/fixtures/audit-donnees.json'), 'utf8')) as AuditState;

/** Évalue une expression de l'outil historique (constante ou fonction d'une ligne). */
function historique<T>(debut: string, nom: string): T {
  const i = INDEX.indexOf(debut);
  if (i < 0) throw new Error(`introuvable : ${debut}`);
  const ligne = INDEX.slice(i, INDEX.indexOf('\n', i));
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  vm.runInContext(`${ligne}\n;globalThis.__x=${nom};`, ctx);
  return JSON.parse(JSON.stringify(ctx.__x, (_k, v: unknown) => (typeof v === 'function' ? String(v) : v))) as T;
}

describe('Modèle : libellés identiques à l’outil historique', () => {
  it('LV, PREP, STATUTS, TYPES, SKIND, PLANST', () => {
    expect(LV).toEqual(historique('const LV={', 'LV'));
    expect(PREP_LABELS).toEqual(historique('const PREP={', 'PREP'));
    expect([...FINDING_STATUSES]).toEqual(historique('const STATUTS=[', 'STATUTS'));
    expect([...FINDING_TYPES]).toEqual(historique('const TYPES=[', 'TYPES'));
    expect(SLOT_KIND_LABELS).toEqual(historique('const SKIND={', 'SKIND'));
    expect([...PLAN_STATUSES]).toEqual(historique('const PLANST=[', 'PLANST'));
    expect(LEVEL_LABELS).toEqual({
      certain: 'Certain',
      tres: 'Très probable',
      probable: 'Probable',
      socle: 'Systématique',
      faible: 'Peu probable',
    });
  });
  it('sources, libellés de types, couverture, codes', () => {
    expect(INDEX).toContain(`opts(${JSON.stringify(FINDING_SOURCES).replaceAll('"', "'")},f.source)`);
    for (const t of FINDING_TYPES) expect(findingTypeLabel(t)).toBe(FINDING_TYPE_LABELS[t]);
    expect(findingTypeLabel('inconnu')).toBe('Remarque');
    expect(COVERAGE_LABELS).toEqual({ '': 'Non auditée', P: 'Prévue', X: 'Auditée' });
    expect([nextCoverage(''), nextCoverage('P'), nextCoverage('X'), nextCoverage(undefined)]).toEqual([
      'P',
      'X',
      '',
      'P',
    ]);
    expect(itemCode({ ref: 'A', num: '5.15' })).toBe('A.5.15');
    expect(itemCode({ ref: 'HDS', num: '01' })).toBe('HDS 01');
    expect(itemCode({ ref: 'ISO', num: '6.1.2' })).toBe('6.1.2');
  });
});

describe('Schémas (zod)', () => {
  it('identifiants d’exigence du jeu fictif', () => {
    for (const it of DONNEES.items) expect(RequirementId.safeParse(it.id).success).toBe(true);
    for (const x of ['A-9.99x', 'ISO-4', 'HDS-1', 'iso-4.1', 'A-5.15 '])
      expect(RequirementId.safeParse(x).success).toBe(false);
  });
  it('cycle, couverture, préparation, exigence', () => {
    expect(CycleUpdateBody.safeParse({}).success).toBe(false);
    expect(CycleUpdateBody.parse({ findingsDeadline: '2026-12-31' })).toEqual({
      findingsDeadline: '2026-12-31',
      rescheduleFindings: true,
    });
    expect(CoverageUpdateBody.safeParse({ afnor: 'X' }).success).toBe(true);
    expect(CoverageUpdateBody.safeParse({ afnor: 'x' }).success).toBe(false);
    expect(CoverageUpdateBody.safeParse({}).success).toBe(false);
    expect(PreparationUpdateBody.safeParse({ status: 'pret' }).success).toBe(true);
    expect(PreparationUpdateBody.safeParse({ status: 'Prête' }).success).toBe(false);
    expect(PreparationCopyBody.safeParse({ from: 2026, to: 2026 }).success).toBe(false);
    expect(RequirementUpdateBody.safeParse({ title: '' }).success).toBe(false);
    expect(RequirementUpdateBody.safeParse({ refText: 'Texte\nde référence' }).success).toBe(true);
  });
  it('créneaux', () => {
    const c = SlotCreateBody.parse({ day: 'j1', start: '09:00', end: '10:00' });
    expect(c).toMatchObject({ type: 'audit', requirements: [], people: [], proofs: [], questions: [] });
    expect(SlotCreateBody.safeParse({ day: 'j1', start: '10:00', end: '09:00' }).success).toBe(false);
    expect(SlotCreateBody.safeParse({ day: 'j1', start: '24:00', end: '24:30' }).success).toBe(false);
    expect(SlotCreateBody.safeParse({ day: 'j1', start: '09:00', end: '10:00', type: 'repas' }).success).toBe(false);
    expect(SlotUpdateBody.safeParse({ start: '11:00', end: '10:00' }).success).toBe(false);
    expect(SlotUpdateBody.safeParse({ title: 'Entretien fictif' }).success).toBe(true);
    expect(SlotUpdateBody.safeParse({}).success).toBe(false);
  });
});
