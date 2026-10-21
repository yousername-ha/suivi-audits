/* Évaluation des exigences : états de couverture et cohérence des dimensions. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  EvaluationExigenceCorps,
  etatExigence,
  evaluationEffective,
  exigenceConforme,
  exclusionInterdite,
  incoherencesEvaluation,
  syntheseEtats,
} from '../src/couverture.js';

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

describe('exigences obligatoires et applicabilité à déterminer', () => {
  const iso = { identifier: 'iso-27001-2022' };
  it('les clauses 4 à 10 de l’ISO 27001 ne sont pas excluables, l’Annexe A l’est', () => {
    for (const n of [4, 5, 6, 7, 8, 9, 10]) expect(exclusionInterdite(iso, `clause_${n}`)).toBe(true);
    expect(exclusionInterdite(iso, 'clause_11')).toBe(false);
    expect(exclusionInterdite(iso, 'annexe_a_5')).toBe(false);
    expect(exclusionInterdite({ identifier: 'autre' }, 'clause_4')).toBe(false);
  });
  it('une copie d’un référentiel ISO 27001 garde la règle', () => {
    const copie = {
      identifier: 'ma-copie',
      derivedFrom: { identifier: 'iso-27001-2022', name: 'ISO', version: 1 },
    };
    expect(exclusionInterdite(copie, 'clause_9')).toBe(true);
  });
  it('une exclusion antérieure sur une clause est ignorée par la couverture', () => {
    const e = { applicability: 'exclue' as const };
    expect(evaluationEffective(e, true)?.applicability).toBe('a_determiner');
    expect(evaluationEffective(e, false)).toBe(e);
  });
  it('compte à part les exigences à déterminer, hors exigences obligatoires', () => {
    const s = syntheseEtats([
      { etat: 'non_implemente', applicability: 'a_determiner' },
      { etat: 'non_implemente', applicability: 'a_determiner', obligatoire: true },
      { etat: 'teste', applicability: 'applicable' },
      { etat: 'non_applicable', applicability: 'exclue' },
    ]);
    expect(s).toMatchObject({ applicables: 3, aDeterminer: 1, teste: 1, non_applicable: 1 });
  });
});

describe('clauses obligatoires pas encore conformes', () => {
  it('une exigence est conforme quand elle est testée ou validée', () => {
    expect(
      ['non_implemente', 'partiel', 'implemente', 'teste', 'valide_metier'].map((e) => exigenceConforme(e as never)),
    ).toEqual([false, false, false, true, true]);
  });
  it('compte les clauses obligatoires pas encore conformes, pas les mesures de l’Annexe A', () => {
    const s = syntheseEtats([
      { etat: 'partiel', applicability: 'applicable', obligatoire: true },
      { etat: 'teste', applicability: 'applicable', obligatoire: true },
      { etat: 'valide_metier', applicability: 'applicable', obligatoire: true },
      { etat: 'non_implemente', applicability: 'a_determiner', obligatoire: true },
      { etat: 'non_implemente', applicability: 'applicable' },
    ]);
    expect(s.obligatoiresNonConformes).toBe(2);
  });
});
