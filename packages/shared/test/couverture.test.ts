/* Évaluation des exigences : états de couverture et cohérence des dimensions. Données fictives. */
import { describe, expect, it } from 'vitest';
import { EvaluationExigenceCorps, etatExigence, incoherencesEvaluation, syntheseEtats } from '../src/couverture.js';

const base = {
  applicability: 'applicable' as const,
  justification: '',
  implementation: 'aucune' as const,
  testedAt: null,
  testResult: null,
  validatedAt: null,
};
describe('état de couverture', () => {
  it('sans évaluation : non implémenté', () => expect(etatExigence(null)).toBe('non_implemente'));
  it('progresse avec la mise en œuvre, le test puis la validation', () => {
    expect(etatExigence(base)).toBe('non_implemente');
    expect(etatExigence({ ...base, implementation: 'partielle' })).toBe('partiel');
    expect(etatExigence({ ...base, implementation: 'complete' })).toBe('implemente');
    const teste = {
      ...base,
      implementation: 'complete' as const,
      testedAt: '2026-10-01',
      testResult: 'conforme' as const,
    };
    expect(etatExigence(teste)).toBe('teste');
    expect(etatExigence({ ...teste, validatedAt: '2026-10-05' })).toBe('valide_metier');
  });
  it('un test non conforme ne fait pas passer à « testé »', () => {
    const e = {
      ...base,
      implementation: 'complete' as const,
      testedAt: '2026-10-01',
      testResult: 'non_conforme' as const,
    };
    expect(etatExigence(e)).toBe('implemente');
  });
  it('une exigence exclue est à part, quelles que soient les autres dimensions', () => {
    expect(etatExigence({ ...base, applicability: 'exclue', justification: 'Hors périmètre' })).toBe('non_applicable');
  });
});

describe('cohérence', () => {
  it('exige une justification pour exclure', () => {
    expect(incoherencesEvaluation({ ...base, applicability: 'exclue' })).toHaveLength(1);
    expect(incoherencesEvaluation({ ...base, applicability: 'exclue', justification: 'Motif' })).toEqual([]);
  });
  it('lie résultat et date du test, et refuse de tester sans mise en œuvre ou hors applicabilité', () => {
    expect(incoherencesEvaluation({ ...base, testedAt: '2026-10-01' })).not.toEqual([]);
    expect(
      incoherencesEvaluation({ ...base, implementation: 'partielle', testedAt: '2026-10-01', testResult: 'conforme' }),
    ).toEqual([]);
    expect(incoherencesEvaluation({ ...base, testedAt: '2026-10-01', testResult: 'conforme' })).not.toEqual([]);
    expect(
      incoherencesEvaluation({
        ...base,
        applicability: 'a_determiner',
        implementation: 'complete',
        testedAt: '2026-10-01',
        testResult: 'conforme',
      }),
    ).not.toEqual([]);
  });
  it('la validation suppose applicable, complète, testée conforme et postérieure au test', () => {
    const t = { ...base, implementation: 'complete' as const, testedAt: '2026-10-05', testResult: 'conforme' as const };
    expect(incoherencesEvaluation({ ...t, validatedAt: '2026-10-06' })).toEqual([]);
    expect(incoherencesEvaluation({ ...t, validatedAt: '2026-10-01' })).not.toEqual([]);
    expect(incoherencesEvaluation({ ...base, validatedAt: '2026-10-06' })).not.toEqual([]);
    expect(incoherencesEvaluation({ ...t, testResult: 'non_conforme', validatedAt: '2026-10-06' })).not.toEqual([]);
  });
});

describe('corps de saisie', () => {
  const ok = { applicability: 'applicable', implementation: 'partielle', reason: 'Revue', confirm: 'EVALUER' };
  it('accepte une version cohérente et applique les valeurs par défaut', () => {
    const r = EvaluationExigenceCorps.parse(ok);
    expect(r).toMatchObject({ testedAt: null, testResult: null, validatedAt: null, justification: '' });
  });
  it('refuse une version incohérente, sans motif ou sans confirmation', () => {
    expect(EvaluationExigenceCorps.safeParse({ ...ok, applicability: 'exclue' }).success).toBe(false);
    expect(EvaluationExigenceCorps.safeParse({ ...ok, reason: '' }).success).toBe(false);
    expect(EvaluationExigenceCorps.safeParse({ ...ok, confirm: 'OK' }).success).toBe(false);
    expect(EvaluationExigenceCorps.safeParse({ ...ok, inconnu: 1 }).success).toBe(false);
  });
});

describe('synthèse', () => {
  it('dénombre par état et exclut les non applicables du total applicable', () => {
    const s = syntheseEtats(['non_implemente', 'partiel', 'teste', 'non_applicable', 'non_applicable']);
    expect(s).toMatchObject({ non_implemente: 1, partiel: 1, teste: 1, non_applicable: 2, applicables: 3 });
  });
});
