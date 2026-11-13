/* Pastilles du menu : rouge quand un indicateur est mauvais, neutre pour un volume à traiter, absente sans alerte. */
import { describe, expect, it } from 'vitest';
import { alerteDeFamille, alertesDepuisSynthese } from '../src/pilotage/alertes-menu';
import type { SyntheseApi } from '../src/components/Synthese';

const base = {
  ecarts: { total: 5, ouverts: 3, enRetard: 2, aEcheance: 0, parStatut: {}, parType: {} },
  indicateurs: { total: 6, atteints: 3, nonAtteints: 1, nonMesures: 2 },
  pilotage: { constatsOuverts: 1, risques: 4, risquesSansDecision: 2, actionsEnRetard: 3 },
} as unknown as SyntheseApi;

describe('alertes du menu', () => {
  it('compte en rouge les indicateurs non atteints et les échéances dépassées', () => {
    const a = alertesDepuisSynthese(base, 0);
    expect(a['objectifs']).toMatchObject({ n: 1, rouge: true });
    expect(a['plan-actions']).toMatchObject({ n: 5, rouge: true });
    expect(a['risques']).toMatchObject({ n: 2, rouge: false });
    expect(a['referentiels']).toBeUndefined();
  });
  it('totalise une famille et reste rouge dès qu’une destination est rouge', () => {
    const a = alertesDepuisSynthese(base, 4);
    expect(a['referentiels']).toMatchObject({ n: 4, rouge: false });
    expect(alerteDeFamille(a, [{ id: 'objectifs' }, { id: 'plan-actions' }, { id: 'revues' }])).toMatchObject({
      n: 6,
      rouge: true,
    });
    expect(alerteDeFamille(a, [{ id: 'revues' }])).toBeUndefined();
  });
  it('n’affiche aucune pastille sans donnée ni droit de lecture', () => {
    expect(alertesDepuisSynthese(undefined, 0)).toEqual({});
    const sain = {
      ...base,
      ecarts: { ...base.ecarts, enRetard: 0 },
      indicateurs: { ...base.indicateurs!, nonAtteints: 0 },
      pilotage: { ...base.pilotage!, risquesSansDecision: 0, actionsEnRetard: 0 },
    } as SyntheseApi;
    expect(alertesDepuisSynthese(sain, 0)).toEqual({});
  });
  it('une famille est neutre quand seules des pastilles neutres existent', () => {
    const a = alertesDepuisSynthese(undefined, 3);
    expect(alerteDeFamille(a, [{ id: 'referentiels' }])).toMatchObject({ n: 3, rouge: false });
  });
});
