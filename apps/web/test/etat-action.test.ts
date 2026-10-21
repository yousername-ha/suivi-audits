/* Retard et symbole d'une action : dérivés, jamais portés par la couleur seule. */
import { businessDefaults, type GrcObject } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { enRetard, libelleStatut, symboleStatut, validationDe } from '../src/grc/etat-action';

const policy = businessDefaults();
const NOW = Date.parse('2026-10-21T10:00:00Z');
const action = (data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id: 'a', name: 'A', kind: 'action', data, ...extra }) as unknown as GrcObject;

describe('enRetard', () => {
  it('une action ouverte dont l’échéance est passée est en retard', () => {
    expect(enRetard(action({ status: 'progress', dueAt: '2026-10-20T10:00:00Z' }), policy, NOW)).toBe(true);
    expect(enRetard(action({ status: 'blocked', dueAt: '2026-01-01T00:00:00Z' }), policy, NOW)).toBe(true);
  });
  it('ni terminée, ni annulée, ni sans échéance, ni à échoir, ni illisible', () => {
    expect(enRetard(action({ status: 'done', dueAt: '2026-01-01T00:00:00Z' }), policy, NOW)).toBe(false);
    expect(enRetard(action({ status: 'cancelled', dueAt: '2026-01-01T00:00:00Z' }), policy, NOW)).toBe(false);
    expect(enRetard(action({ status: 'todo', dueAt: null }), policy, NOW)).toBe(false);
    expect(enRetard(action({ status: 'todo', dueAt: '2026-10-21T10:00:01Z' }), policy, NOW)).toBe(false);
    expect(enRetard(action({ status: 'todo', dueAt: 'pas une date' }), policy, NOW)).toBe(false);
  });
  it('une occurrence validée n’est plus en retard', () => {
    const o = action({ status: 'todo', dueAt: '2026-10-01T00:00:00Z' }, { validation: { result: 'OK' } });
    expect(enRetard(o, policy, NOW)).toBe(false);
  });
});

describe('symbole et libellé du statut', () => {
  it('cinq statuts par défaut, un symbole chacun ; statut personnalisé selon qu’il est terminal', () => {
    expect(['todo', 'progress', 'blocked', 'done', 'cancelled'].map((s) => symboleStatut(policy, s))).toEqual([
      '○',
      '▶',
      '⏸',
      '✓',
      '✕',
    ]);
    const perso = {
      ...policy,
      statuses: [...policy.statuses, { id: 'x', label: 'X', terminal: true, color: '#000000' }],
    };
    expect(symboleStatut(perso, 'x')).toBe('✓');
    expect(symboleStatut(policy, 'inconnu')).toBe('●');
  });
  it('le libellé vient de la politique publiée', () => {
    expect(libelleStatut(policy, action({ status: 'blocked' }))).toBe('Bloquée');
  });
});

describe('validationDe', () => {
  it('lit le résultat de la dernière validation, sans rien inventer', () => {
    expect(validationDe(action({}, { validation: { result: 'ok' } }))).toBe('OK');
    expect(validationDe(action({}, { validation: { result: 'KO' } }))).toBe('KO');
    expect(validationDe(action({}, { validation: { result: 'na' } }))).toBe('NA');
    expect(validationDe(action({}, { validation: null }))).toBeNull();
    expect(validationDe(action({}))).toBeNull();
  });
});
