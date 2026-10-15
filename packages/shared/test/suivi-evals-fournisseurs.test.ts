/* Évaluations de sécurité des fournisseurs par le clausier : points, état et note de l'outil de suivi. Clausier fictif. */
import { describe, expect, it } from 'vitest';
import {
  EvaluationClausierModification,
  ReponsePoint,
  ecartsEvaluation,
  identifiantActionFournisseur,
  lireEvaluationClausier,
  pointsEvaluation,
  scoreEvaluation,
  type Clausier,
} from '../src/index.js';

const c: Clausier = {
  version: 'fictif',
  source: 'Clausier fictif',
  sections: { '1': 'Général', '2': 'Sous-traitance', '12.3': 'Hébergé' },
  cases: { '2': 'rgpd', '12.3': 'cloud' },
  reqs: [
    { ref: 'O-1.1', sec: '1', sub: null, title: 'Un', text: 'Texte un' },
    { ref: 'O-1.2', sec: '1', sub: 'Sous', title: 'Deux', text: 'Texte deux' },
    { ref: 'O-1.3', sec: '1', sub: null, title: 'Supprimé', text: 'x', removed: true },
    { ref: 'O-2.1', sec: '2', sub: null, title: 'RGPD', text: 'Texte rgpd' },
    { ref: 'O-12.3.1', sec: '12.3', sub: null, title: 'Hébergé', text: 'Texte hébergé' },
  ],
};
const ev = (ans: Record<string, { st: string; c?: string }>, cases: string[] = []) =>
  lireEvaluationClausier({ id: 'EVAL-1', cases, ans })!;

describe('points applicables', () => {
  it('chapitres sans cas toujours, chapitres de cas seulement si cochés, exigences supprimées écartées', () => {
    expect(pointsEvaluation(c, []).map((p) => p.id)).toEqual(['O-1.1', 'O-1.2']);
    expect(pointsEvaluation(c, ['rgpd']).map((p) => p.id)).toEqual(['O-1.1', 'O-1.2', 'O-2.1']);
    expect(pointsEvaluation(c, ['rgpd', 'cloud']).map((p) => p.id)).toEqual(['O-1.1', 'O-1.2', 'O-2.1', 'O-12.3.1']);
    expect(pointsEvaluation(c, [])[1]).toMatchObject({
      libelleChapitre: 'Général',
      sousChapitre: 'Sous',
      titre: 'Deux',
    });
  });
});

describe('note indicative', () => {
  const pts = pointsEvaluation(c, ['rgpd', 'cloud']);
  it('sans point évalué : pas de note', () => {
    expect(scoreEvaluation(pts, ev({}))).toEqual({ n: 4, done: 0, pc: null, note: '–', nc: 0, pa: 0 });
  });
  it('conforme 1, partiel 0,5, non conforme 0 ; « non applicable » sort du total', () => {
    const s = scoreEvaluation(
      pts,
      ev({
        'O-1.1': { st: 'Conforme' },
        'O-1.2': { st: 'Partiel' },
        'O-2.1': { st: 'Non conforme' },
        'O-12.3.1': { st: 'Non applicable' },
      }),
    );
    expect(s).toEqual({ n: 3, done: 3, pc: 50, note: 'D', nc: 1, pa: 1 });
  });
  it('seuils A à E', () => {
    const un = pointsEvaluation(c, []).slice(0, 1);
    const note = (st: string) => scoreEvaluation(un, ev({ 'O-1.1': { st } })).note;
    expect(note('Conforme')).toBe('A');
    expect(note('Non conforme')).toBe('E');
    const dix = Array.from({ length: 20 }, (_, i) => ({ id: `P${i}` }));
    const avec = (k: number) =>
      scoreEvaluation(
        dix,
        ev(Object.fromEntries(dix.map((p, i) => [p.id, { st: i < k ? 'Conforme' : 'Non conforme' }]))),
      ).note;
    expect([avec(18), avec(15), avec(12), avec(8), avec(7)]).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
  it('écarts : partiels et non conformes', () => {
    expect(
      ecartsEvaluation(
        pts,
        ev({ 'O-1.1': { st: 'Conforme' }, 'O-1.2': { st: 'Partiel' }, 'O-2.1': { st: 'Non conforme' } }),
      ).map((p) => p.id),
    ).toEqual(['O-1.2', 'O-2.1']);
  });
});

describe('lecture et validation', () => {
  it('lecture tolérante et identifiant d’action', () => {
    expect(lireEvaluationClausier({ title: 'sans id' })).toBeNull();
    expect(lireEvaluationClausier({ id: 'E', ans: { 'O-1.1': { st: 'Conforme', c: 'ok' } } })!.ans['O-1.1']).toEqual({
      st: 'Conforme',
      c: 'ok',
    });
    expect(identifiantActionFournisseur(['FOU-01', 'FOU-03'])).toBe('FOU-02');
  });
  it('refuse un cas inconnu, un état inconnu et une date mal formée', () => {
    expect(EvaluationClausierModification.safeParse({ cases: ['inconnu'] }).success).toBe(false);
    expect(EvaluationClausierModification.safeParse({ date: '1/1/2026' }).success).toBe(false);
    expect(EvaluationClausierModification.safeParse({ cases: ['rgpd'], date: '2026-10-14' }).success).toBe(true);
    expect(ReponsePoint.safeParse({ st: 'Autre' }).success).toBe(false);
  });
});
