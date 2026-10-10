import { describe, expect, it } from 'vitest';
import {
  Recurrence,
  recurrenceSlot,
  methodTemplate,
  RiskMethod,
  evaluateMethod,
  BusinessPolicy,
  businessDefaults,
} from '../src/index.js';
const base = {
  start: '2026-01-31',
  time: '09:00',
  timezone: 'Europe/Paris',
  unit: 'month' as const,
  interval: 1,
  until: null,
  count: null,
  reminderDays: 7,
  active: true,
};
describe('Récurrences calendaires réelles', () => {
  it('conserve le jour d’origine après un mois court', () => {
    expect([0, 1, 2].map((i) => recurrenceSlot(base, i)?.local)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
  it('résout une heure inexistante au premier instant local valable', () => {
    expect(recurrenceSlot({ ...base, start: '2026-03-29', time: '02:30', unit: 'day' }, 0)?.dueAt).toBe(
      '2026-03-29T01:00:00.000Z',
    );
  });
  it('choisit une seule occurrence lors du retour à l’heure d’hiver', () => {
    expect(recurrenceSlot({ ...base, start: '2026-10-25', time: '02:30' }, 0)?.dueAt).toBe('2026-10-25T00:30:00.000Z');
  });
  it('conserve une heure locale au passage de l’heure d’été', () => {
    expect(recurrenceSlot({ ...base, start: '2026-03-28', unit: 'day' }, 1)?.dueAt).toBe('2026-03-29T07:00:00.000Z');
  });
  it('respecte la fin, le compte et les années bissextiles', () => {
    expect(recurrenceSlot({ ...base, count: 1 }, 1)).toBeNull();
    expect(recurrenceSlot({ ...base, until: '2026-02-27' }, 1)).toBeNull();
    expect(recurrenceSlot({ ...base, start: '2024-02-29', unit: 'year' }, 1)?.local).toBe('2025-02-28');
    expect(Recurrence.safeParse({ ...base, start: '2026-02-30' }).success).toBe(false);
  });
});
describe('Méthodes indépendantes et nomenclatures', () => {
  it.each(['ebios_rm', 'iso27005', 'mehari', 'custom'] as const)(
    'valide le modèle %s sans contenu ISO reproduit',
    (family) => {
      const m = RiskMethod.parse(methodTemplate(family));
      expect(m.family).toBe(family);
      expect(m.source.normative).toBe(false);
    },
  );
  it('ne force pas un jugement qualitatif dans une multiplication', () => {
    const m = methodTemplate('mehari');
    expect(
      evaluateMethod(m, { dimensions: { severity: 'impact_4' }, likelihood: 'likelihood_4', level: 'low', inputs: {} }),
    ).toMatchObject({ level: 'low', score: null });
  });
  it('rejette une matrice incomplète ou des échelles ambiguës', () => {
    const m = methodTemplate('ebios_rm');
    if (m.calculation.kind === 'matrix') m.calculation.cells.pop();
    expect(RiskMethod.safeParse(m).success).toBe(false);
    const p = businessDefaults();
    p.transitions.push({ from: 'inexistant', to: 'done' });
    expect(BusinessPolicy.safeParse(p).success).toBe(false);
  });
});
