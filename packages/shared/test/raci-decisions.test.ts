/* Matrice « Qui décide quoi » des rôles et responsabilités (ADR 0115) : forme et bornes du contrat, colonnes issues du
   registre (rôles retirés compris), règle « exactement un A, au moins un R » commune avec la matrice des fournisseurs
   (ADR 0113). Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  MatriceDecisionsBody,
  RACI_DECISIONS_BORNES,
  RACI_DECISIONS_LETTRES_LIBELLES,
  RACI_ROLE_RETIRE,
  colonnesRolesRaci,
  controleDecisionsRaci,
  controleRaci,
  regleRaci,
  type MatriceDecisionsBody as Corps,
} from '../src/index.js';

const RSSI = 'object:11111111-1111-4111-8111-111111111111';
const DG = 'object:22222222-2222-4222-8222-222222222222';
const HISTORIQUE = 'legacy:roles:ROL-1';
const erreurs = (v: unknown) => {
  const r = MatriceDecisionsBody.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};
const corps = (): Corps => ({
  decisions: [
    { id: 'budget', libelle: 'Valider le budget fictif' },
    { id: 'derogation', libelle: 'Accorder une dérogation fictive' },
  ],
  cases: [
    { decision: 'budget', role: RSSI, lettre: 'R' },
    { decision: 'budget', role: DG, lettre: 'A' },
    { decision: 'derogation', role: HISTORIQUE, lettre: 'C' },
  ],
});

describe('contrat', () => {
  it('accepte des décisions et des cases désignant des fiches du registre ou des rôles de l’outil de suivi', () => {
    expect(MatriceDecisionsBody.parse(corps())).toEqual(corps());
    expect(MatriceDecisionsBody.parse({ decisions: [], cases: [] })).toEqual({ decisions: [], cases: [] });
  });
  it('nettoie les libellés des décisions', () => {
    const c = corps();
    c.decisions[0]!.libelle = '  Valider\u0000le\tbudget  ';
    expect(MatriceDecisionsBody.parse(c).decisions[0]!.libelle).toBe('Valider le budget');
  });
  it('refuse une référence de rôle d’une autre nature, une lettre inconnue, une décision inconnue, deux lettres', () => {
    const cas: [Corps['cases'], string][] = [
      [[{ decision: 'budget', role: 'legacy:suppliers:SUP-1', lettre: 'R' }], 'Référence de rôle attendue'],
      [[{ decision: 'budget', role: 'object:pas-un-uuid', lettre: 'R' }], 'Référence de rôle attendue'],
      [[{ decision: 'budget', role: 'legacy:roles:\u0007', lettre: 'R' }], 'Référence de rôle attendue'],
      [[{ decision: 'inconnue', role: RSSI, lettre: 'R' }], 'Décision inconnue de la matrice.'],
      [
        [
          { decision: 'budget', role: RSSI, lettre: 'R' },
          { decision: 'budget', role: RSSI, lettre: 'A' },
        ],
        'Une case ne porte qu’une seule lettre.',
      ],
    ];
    for (const [cases, message] of cas)
      expect(
        erreurs({ ...corps(), cases }).some((m) => m.includes(message)),
        message,
      ).toBe(true);
    expect(erreurs({ ...corps(), cases: [{ decision: 'budget', role: RSSI, lettre: 'X' }] })).not.toEqual([]);
  });
  it('borne le nombre de décisions et de cases, refuse les identifiants dupliqués et les champs inconnus', () => {
    const decisions = Array.from({ length: RACI_DECISIONS_BORNES.decisions + 1 }, (_, i) => ({
      id: `d-${i}`,
      libelle: `Décision ${i}`,
    }));
    expect(erreurs({ decisions, cases: [] })).not.toEqual([]);
    expect(erreurs({ decisions: decisions.slice(0, 60), cases: [] })).toEqual([]);
    expect(
      erreurs({
        decisions: [
          { id: 'a', libelle: 'Une' },
          { id: 'a', libelle: 'Deux' },
        ],
        cases: [],
      }),
    ).toContain('Identifiants de décisions dupliqués.');
    expect(erreurs({ ...corps(), acteurs: [] })).not.toEqual([]);
    expect(RACI_DECISIONS_BORNES).toEqual({ decisions: 60, cases: 3000, role: 220 });
  });
  it('donne la légende courte décidée par le RSSI', () => {
    expect(RACI_DECISIONS_LETTRES_LIBELLES).toEqual({ R: 'réalise', A: 'approuve', C: 'consulté', I: 'informé' });
  });
});

describe('colonnes', () => {
  it('les rôles du registre, dans l’ordre donné, puis un « Rôle retiré » par rôle absent qui porte encore une lettre', () => {
    const roles = [
      { ref: DG, libelle: 'Direction fictive' },
      { ref: RSSI, libelle: 'RSSI fictif' },
    ];
    expect(colonnesRolesRaci(roles, corps().cases)).toEqual([
      { ref: DG, libelle: 'Direction fictive', retire: false },
      { ref: RSSI, libelle: 'RSSI fictif', retire: false },
      { ref: HISTORIQUE, libelle: RACI_ROLE_RETIRE, retire: true },
    ]);
    expect(colonnesRolesRaci(roles.slice(0, 1), corps().cases).map((c) => [c.ref, c.libelle])).toEqual([
      [DG, 'Direction fictive'],
      [RSSI, 'Rôle retiré 1'],
      [HISTORIQUE, 'Rôle retiré 2'],
    ]);
    expect(colonnesRolesRaci(roles, [])).toHaveLength(2);
  });
});

describe('règle', () => {
  it('la même que celle de la matrice des fournisseurs : exactement un A et au moins un R', () => {
    expect(regleRaci(['R', 'A', 'C'])).toEqual({ a: 1, r: 1, ecarts: [] });
    expect(regleRaci([])).toEqual({ a: 0, r: 0, ecarts: ['aucun_a', 'aucun_r'] });
    expect(regleRaci(['A', 'A'])).toEqual({ a: 2, r: 0, ecarts: ['plusieurs_a', 'aucun_r'] });
    expect(
      controleRaci({
        activites: [{ id: 'x', libelle: 'Activité fictive' }],
        acteurs: [{ id: 'dsi', libelle: 'DSI' }],
        cases: [
          { activite: 'x', acteur: 'fournisseur', lettre: 'R' },
          { activite: 'x', acteur: 'dsi', lettre: 'A' },
        ],
      })[0],
    ).toEqual({ activite: 'x', libelle: 'Activité fictive', a: 1, r: 1, ecarts: [] });
  });
  it('contrôle chaque décision dans l’ordre ; les lettres d’un rôle retiré sont ignorées', () => {
    expect(controleDecisionsRaci(corps(), [RSSI, DG, HISTORIQUE])).toEqual([
      { decision: 'budget', libelle: 'Valider le budget fictif', a: 1, r: 1, ecarts: [] },
      {
        decision: 'derogation',
        libelle: 'Accorder une dérogation fictive',
        a: 0,
        r: 0,
        ecarts: ['aucun_a', 'aucun_r'],
      },
    ]);
    // La direction a quitté le registre : son A ne compte plus.
    expect(controleDecisionsRaci(corps(), [RSSI, HISTORIQUE])[0]!.ecarts).toEqual(['aucun_a']);
  });
});
