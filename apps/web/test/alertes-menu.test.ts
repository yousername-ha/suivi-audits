/* Pastilles du menu : rouge quand un indicateur est mauvais, neutre pour un volume à traiter, absente sans alerte. */
import { describe, expect, it } from 'vitest';
import { alertesDepuisSynthese } from '../src/pilotage/alertes-menu';
import type { SyntheseApi } from '../src/components/Synthese';

const base = {
  ecarts: { total: 5, ouverts: 3, enRetard: 2, aEcheance: 0, parStatut: {}, parType: {} },
  indicateurs: { total: 6, atteints: 3, nonAtteints: 1, nonMesures: 2 },
  pilotage: { constatsOuverts: 1, risques: 4, risquesSansDecision: 2, actionsEnRetard: 3 },
} as unknown as SyntheseApi;

describe('alertes du menu', () => {
  it('compte en rouge les indicateurs non atteints et les échéances dépassées', () => {
    const a = alertesDepuisSynthese(base, 0);
    expect(a['Objectifs et indicateurs']).toMatchObject({ n: 1, rouge: true });
    expect(a['Écarts et actions']).toMatchObject({ n: 5, rouge: true });
    expect(a['Risques']).toMatchObject({ n: 2, rouge: false });
    expect(a['Conformité']).toBeUndefined();
  });
  it('totalise la racine et reste rouge dès qu’un groupe est rouge', () => {
    const a = alertesDepuisSynthese(base, 4);
    expect(a['Conformité']).toMatchObject({ n: 4, rouge: false });
    expect(a['Pilotage']).toMatchObject({ n: 12, rouge: true });
  });
  it('n’affiche aucune pastille sans donnée ni droit de lecture', () => {
    expect(alertesDepuisSynthese(undefined, 0)).toEqual({});
    const sain = { ...base, ecarts: { ...base.ecarts, enRetard: 0 }, indicateurs: { ...base.indicateurs!, nonAtteints: 0 }, pilotage: { ...base.pilotage!, risquesSansDecision: 0, actionsEnRetard: 0 } } as SyntheseApi;
    expect(alertesDepuisSynthese(sain, 0)).toEqual({});
  });
  it('la racine est neutre quand seules des pastilles neutres existent', () => {
    expect(alertesDepuisSynthese(undefined, 3)['Pilotage']).toMatchObject({ n: 3, rouge: false });
  });
});
