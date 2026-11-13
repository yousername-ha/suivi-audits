/* Exports Excel du pronostic de l'audit et des évaluations par le clausier : contenu des lignes
   calculées par les fonctions partagées. Données fictives, aucune base nécessaire. */
import { describe, expect, it } from 'vitest';
import { LV } from '@suivi/shared/audit';
import type { JsonObject } from '@suivi/shared/legacy';
import { CLAUSIER_2026 } from '../src/historique/clausier-club-rssi-sante-2026.js';
import { GROUPES, JEUX, feuillesDuGroupe } from '../src/export/rubriques.js';

const ctx = (etat: JsonObject) => ({ etat, aujourdhui: '2026-10-19' });

describe('pronostic de l’audit', () => {
  const etat: JsonObject = {
    years: [2025, 2026],
    nextYear: 2026,
    items: [
      { id: 'A-5.1', ref: 'A', num: '5.1', title: 'Politiques', afnor: {}, interne: {}, prep: 'encours' },
      { id: 'A-5.2', ref: 'A', num: '5.2', title: 'Rôles', afnor: { '2025': 'X' }, interne: {} },
      { id: 'ISO-4.1', ref: 'ISO', num: '4.1', title: 'Contexte', afnor: {}, interne: {} },
    ],
    findings: [{ id: 'E-1', source: 'AFNOR', year: 2025, type: 'NC min', status: 'Ouvert', items: ['ISO-4.1'] }],
    plan: {
      days: [{ id: 'j1', label: 'Jour 1', date: '2026-11-10' }],
      slots: [{ id: 's1', day: 'j1', start: '09:00', end: '10:00', title: 'Ouverture', items: ['A-5.1'], people: [] }],
    },
  };
  const lignes = JEUX.pronostic!.lignes(ctx(etat));

  it('liste les exigences par probabilité décroissante et écarte les « faibles »', () => {
    expect(lignes.map((l) => l[0])).toEqual(['4.1', 'A.5.1']);
    expect(lignes[0]![3]).toBe(LV.certain.l);
    expect(lignes[1]![3]).toBe(LV.tres.l);
  });
  it('reprend les raisons, la préparation et le créneau du plan', () => {
    expect(lignes[1]![2]).toBe('Annexe A');
    expect(String(lignes[1]![4])).toContain("Non vue par l'AFNOR en 2025");
    expect(lignes[1]![5]).toBe('En cours');
    expect(lignes[1]![6]).toBe('Jour 1 09:00 — Ouverture');
    expect(lignes[0]![6]).toBe('');
  });
  it('ne plante pas sans données', () => {
    expect(JEUX.pronostic!.lignes(ctx({}))).toEqual([]);
  });
});

describe('évaluations fournisseurs par le clausier', () => {
  const sans = CLAUSIER_2026.reqs.filter((r) => !r.removed && !CLAUSIER_2026.cases[r.sec]);
  const etat: JsonObject = {
    suppliers: [{ id: 's1', name: 'Fournisseur fictif' }],
    supEvals: [
      {
        id: 'ev1',
        supplier: 's1',
        product: 'Produit',
        date: '2026-06-01',
        cases: [],
        ans: { [sans[0]!.ref]: { st: 'Conforme', c: 'Preuve fournie' } },
      },
    ],
  };
  const lignes = JEUX.evalFournisseurs!.lignes(ctx(etat));
  it('une ligne par point applicable, avec note et conformité', () => {
    expect(lignes).toHaveLength(sans.length);
    const l = lignes.find((x) => x[5] === sans[0]!.ref)!;
    expect(l.slice(0, 5)).toEqual(['Fournisseur fictif', 'Produit', '01/06/2026', 'A', '100 %']);
    expect(l[7]).toBe('Conforme');
    expect(l[8]).toBe('Preuve fournie');
    expect(lignes.filter((x) => x[7] === 'À évaluer')).toHaveLength(sans.length - 1);
  });
});

describe('groupes', () => {
  it('exposent les nouvelles feuilles', () => {
    expect(GROUPES.find((g) => g.id === 'apps')).toBeUndefined();
    expect(GROUPES.find((g) => g.id === 'audit')?.jeux[0]).toBe('pronostic');
    expect(GROUPES.find((g) => g.id === 'sup')?.jeux).toContain('evalFournisseurs');
    expect(feuillesDuGroupe('apps', ctx({}))).toBeNull();
  });
});
