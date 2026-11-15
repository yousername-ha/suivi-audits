/* Critères rattachés aux fournisseurs (ADR 0098) : corps du rattachement en masse et décompte des réponses. Données fictives. */
import { describe, expect, it } from 'vitest';
import { SupplierCriterionLinksBody, resumeCriteresRattaches } from '../src/fournisseurs.js';

describe('rattachement en masse depuis un critère', () => {
  it('accepte un écart à rattacher et à détacher, vide par défaut d’un côté', () => {
    expect(SupplierCriterionLinksBody.parse({ attach: ['SUP-001', 'SUP-002'] })).toEqual({
      attach: ['SUP-001', 'SUP-002'],
      detach: [],
    });
    expect(SupplierCriterionLinksBody.parse({ detach: [' SUP-003 '] }).detach).toEqual(['SUP-003']);
  });
  it('refuse une opération vide, un doublon, un fournisseur des deux côtés et un champ inconnu', () => {
    expect(SupplierCriterionLinksBody.safeParse({}).success).toBe(false);
    expect(SupplierCriterionLinksBody.safeParse({ attach: [], detach: [] }).success).toBe(false);
    expect(SupplierCriterionLinksBody.safeParse({ attach: ['SUP-001', 'SUP-001'] }).success).toBe(false);
    expect(SupplierCriterionLinksBody.safeParse({ attach: ['SUP-001'], detach: ['SUP-001'] }).success).toBe(false);
    expect(SupplierCriterionLinksBody.safeParse({ attach: [''] }).success).toBe(false);
    expect(SupplierCriterionLinksBody.safeParse({ attach: ['SUP-001'], tous: true }).success).toBe(false);
  });
});

describe('décompte des critères rattachés', () => {
  const reponse = (meets: boolean | null) => ({ meets, evaluatedAt: '2026-10-01', evaluationId: 'e1' });
  it('compte oui, non et non évalué (jamais évalué ou réponse « non évalué »), sans score', () => {
    expect(
      resumeCriteresRattaches([
        { answer: reponse(true) },
        { answer: reponse(true) },
        { answer: reponse(false) },
        { answer: reponse(null) },
        { answer: null },
      ]),
    ).toEqual({ total: 5, remplis: 2, non: 1, nonEvalues: 2 });
    expect(resumeCriteresRattaches([])).toEqual({ total: 0, remplis: 0, non: 0, nonEvalues: 0 });
  });
});
