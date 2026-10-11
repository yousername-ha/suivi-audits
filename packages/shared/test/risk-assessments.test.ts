import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { AssessmentPublication, legacyAiRisk } from '../src/risk-assessments.js';
const html = readFileSync(new URL('../../../app/public/index.html', import.meta.url), 'utf8');
const legacy = vm.runInNewContext(
  `(${html.slice(html.indexOf('function aiEval(e){'), html.indexOf('function aiStep(p){')).trim()})`,
) as (e: Record<string, unknown>) => { idx: number | null; res?: number; level: string };
describe('compatibilité du calcul IA historique inchangé', () => {
  it('compare la fonction v2 réelle sur les seuils, maturités, DSCP et champs absents', () => {
    for (const app of ['Applicable', 'Conditionnel à confirmer', ''])
      for (const c of [0, 1, 3, 5])
        for (const prob of [0, 1, 5])
          for (const maturity of [0, 1, 5])
            for (const effort of [0, 5])
              for (const dscp of ['Oui', 'Non']) {
                const e = { app, c, prob, maturity, effort, dscp };
                const r = legacy(e);
                expect(legacyAiRisk(e)).toEqual({ idx: r.idx, res: r.res ?? null, level: r.level });
              }
    const r = legacy({});
    expect(legacyAiRisk({})).toEqual({ idx: r.idx, res: r.res ?? null, level: r.level });
  });
  it('refuse les résultats fournis par un client dans une décision', () => {
    expect(AssessmentPublication.safeParse({ result: { residual: 0 } }).success).toBe(false);
  });
});
