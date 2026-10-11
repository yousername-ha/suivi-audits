/* Règles des écarts (AUD-09), plan d'actions (AUD-10), modèle et schémas du module Audit. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  type AuditFinding,
  type AuditState,
  COVERAGE_LABELS,
  CoverageUpdateBody,
  CycleUpdateBody,
  FINDING_SOURCES,
  FINDING_STATUSES,
  FINDING_TYPES,
  FINDING_TYPE_LABELS,
  FindingCreateBody,
  FindingReopenBody,
  FindingRuleError,
  FindingStatusBody,
  FindingUpdateBody,
  LEVEL_LABELS,
  LV,
  PLAN_STATUSES,
  PREP_LABELS,
  PreparationCopyBody,
  PreparationUpdateBody,
  RequirementId,
  RequirementUpdateBody,
  SLOT_KIND_LABELS,
  SlotCreateBody,
  SlotUpdateBody,
  TaskCreateBody,
  TaskUpdateBody,
  actionPlan,
  changeFindingStatus,
  closeFinding,
  compareFindings,
  deadlineSummary,
  findingTypeLabel,
  findingsFollowingDeadline,
  isFindingLate,
  isTaskLate,
  itemCode,
  newFindingDefaults,
  nextCoverage,
  nextFindingId,
  reopenFinding,
  setTaskDone,
  shouldProposeClosure,
  sortFindings,
  taskDue,
} from '../src/audit/index.js';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const INDEX = readFileSync(path.join(RACINE, 'app/public/index.html'), 'utf8');
const DONNEES = JSON.parse(readFileSync(path.join(RACINE, 'tests/fixtures/audit-donnees.json'), 'utf8')) as AuditState;
const AUJOURDHUI = '2026-10-08';
const QUI = { at: '2026-10-08T10:00:00.000Z', by: 'rssi' };

/** Évalue une expression de l'outil historique (constante ou fonction d'une ligne). */
function historique<T>(debut: string, nom: string): T {
  const i = INDEX.indexOf(debut);
  if (i < 0) throw new Error(`introuvable : ${debut}`);
  const ligne = INDEX.slice(i, INDEX.indexOf('\n', i));
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  vm.runInContext(`${ligne}\n;globalThis.__x=${nom};`, ctx);
  return JSON.parse(JSON.stringify(ctx.__x, (_k, v: unknown) => (typeof v === 'function' ? String(v) : v))) as T;
}

const ecart = (o: Partial<AuditFinding> & { id: string }): AuditFinding => ({
  source: 'AFNOR',
  year: 2026,
  type: 'PS',
  status: 'Ouvert',
  items: [],
  tasks: [],
  ...o,
});

describe('Modèle : libellés identiques à l’outil historique', () => {
  it('LV, PREP, STATUTS, TYPES, SKIND, PLANST', () => {
    expect(LV).toEqual(historique('const LV={', 'LV'));
    expect(PREP_LABELS).toEqual(historique('const PREP={', 'PREP'));
    expect([...FINDING_STATUSES]).toEqual(historique('const STATUTS=[', 'STATUTS'));
    expect([...FINDING_TYPES]).toEqual(historique('const TYPES=[', 'TYPES'));
    expect(SLOT_KIND_LABELS).toEqual(historique('const SKIND={', 'SKIND'));
    expect([...PLAN_STATUSES]).toEqual(historique('const PLANST=[', 'PLANST'));
    expect(LEVEL_LABELS).toEqual({
      certain: 'Certain',
      tres: 'Très probable',
      probable: 'Probable',
      socle: 'Systématique',
      faible: 'Peu probable',
    });
  });
  it('sources, libellés de types, couverture, codes', () => {
    expect(INDEX).toContain(`opts(${JSON.stringify(FINDING_SOURCES).replaceAll('"', "'")},f.source)`);
    for (const t of FINDING_TYPES) expect(findingTypeLabel(t)).toBe(FINDING_TYPE_LABELS[t]);
    expect(findingTypeLabel('inconnu')).toBe('Remarque');
    expect(COVERAGE_LABELS).toEqual({ '': 'Non auditée', P: 'Prévue', X: 'Auditée' });
    expect([nextCoverage(''), nextCoverage('P'), nextCoverage('X'), nextCoverage(undefined)]).toEqual([
      'P',
      'X',
      '',
      'P',
    ]);
    expect(itemCode({ ref: 'A', num: '5.15' })).toBe('A.5.15');
    expect(itemCode({ ref: 'HDS', num: '01' })).toBe('HDS 01');
    expect(itemCode({ ref: 'ISO', num: '6.1.2' })).toBe('6.1.2');
  });
});

describe('Écarts : tâches et statut (AUD-09)', () => {
  const base = ecart({
    id: 'F01',
    tasks: [
      { t: 'Première', done: false },
      { t: 'Seconde', done: false },
    ],
  });

  it('cocher une tâche d’un écart ouvert le passe « En cours » et trace l’auteur', () => {
    const r = setTaskDone(base, 0, true, QUI);
    expect(r.finding.status).toBe('En cours');
    expect(r.finding.tasks![0]).toMatchObject({ done: true, doneAt: QUI.at, doneBy: 'rssi' });
    expect(r.proposeClosure).toBe(false);
    expect(base.tasks![0]!.done).toBe(false); // pas de mutation
  });
  it('toutes les tâches faites : proposer la clôture', () => {
    const r1 = setTaskDone(base, 0, true, QUI);
    const r2 = setTaskDone(r1.finding, 1, true, QUI);
    expect(r2.proposeClosure).toBe(true);
    expect(r2.finding.status).toBe('En cours');
  });
  it('décocher ne change pas le statut et efface la trace', () => {
    const r = setTaskDone(setTaskDone(base, 0, true, QUI).finding, 0, false, QUI);
    expect(r.finding.status).toBe('En cours');
    expect(r.finding.tasks![0]).toMatchObject({ done: false, doneAt: null, doneBy: null });
  });
  it('cocher une tâche d’un écart « En cours » ou « Clos » ne change pas le statut', () => {
    expect(setTaskDone({ ...base, status: 'En cours' }, 0, true, QUI).finding.status).toBe('En cours');
    const clos = { ...base, status: 'Clos', tasks: [{ t: 'x', done: true }] };
    const r = setTaskDone(clos, 0, true, QUI);
    expect(r.finding.status).toBe('Clos');
    expect(r.proposeClosure).toBe(false);
  });
  it('tâche introuvable', () => {
    expect(() => setTaskDone(base, 5, true, QUI)).toThrow(FindingRuleError);
    expect(() => setTaskDone(base, 0.5, true, QUI)).toThrow(/Tâche introuvable/);
  });
  it('sans tâche, pas de proposition de clôture', () => {
    expect(shouldProposeClosure(ecart({ id: 'F02' }))).toBe(false);
  });

  it('clôture : tâches restantes cochées, date et auteur de clôture', () => {
    const r = setTaskDone(base, 0, true, { at: '2026-10-01T08:00:00.000Z', by: 'contrib' });
    const clos = closeFinding(r.finding, QUI);
    expect(clos).toMatchObject({ status: 'Clos', closedAt: QUI.at, closedBy: 'rssi' });
    expect(clos.tasks).toMatchObject([
      { done: true, doneBy: 'contrib' },
      { done: true, doneBy: 'rssi', doneAt: QUI.at },
    ]);
    expect(closeFinding(clos, { at: 'plus tard', by: 'autre' })).toBe(clos);
  });

  it('réouverture : motif obligatoire, « En cours » par défaut, clôture effacée', () => {
    const clos = closeFinding(base, QUI);
    expect(() => reopenFinding(clos, '')).toThrow(/motif de réouverture est obligatoire/);
    expect(() => reopenFinding(clos, '   ')).toThrow(FindingRuleError);
    expect(() => reopenFinding(clos, 'x'.repeat(1001))).toThrow(FindingRuleError);
    expect(() => reopenFinding(base, 'motif')).toThrow(/Seul un écart clos/);
    const r = reopenFinding(clos, '  Preuve insuffisante  ');
    expect(r.motif).toBe('Preuve insuffisante');
    expect(r.finding).toMatchObject({ status: 'En cours', closedAt: null, closedBy: null });
    expect(r.finding.tasks!.every((t) => t.done)).toBe(true);
    expect(reopenFinding(clos, 'motif', 'Ouvert').finding.status).toBe('Ouvert');
  });

  it('changement de statut depuis la fiche', () => {
    expect(changeFindingStatus(base, 'Ouvert', QUI).event).toBe('inchange');
    expect(changeFindingStatus(base, 'En cours', QUI)).toMatchObject({
      event: 'statut',
      finding: { status: 'En cours' },
    });
    const c = changeFindingStatus(base, 'Clos', QUI);
    expect(c.event).toBe('cloture');
    expect(c.finding.tasks!.every((t) => t.done)).toBe(true);
    expect(() => changeFindingStatus(c.finding, 'Ouvert', QUI)).toThrow(FindingRuleError);
    expect(changeFindingStatus(c.finding, 'Ouvert', QUI, 'Nouvelle preuve demandée')).toMatchObject({
      event: 'reouverture',
      motif: 'Nouvelle preuve demandée',
      finding: { status: 'Ouvert', closedAt: null },
    });
    expect(() => changeFindingStatus(base, 'Fermé', QUI)).toThrow(/Statut inconnu/);
  });
});

describe('Écarts : échéances, retards, plan d’actions (AUD-09, AUD-10)', () => {
  it('écart en retard = non clos et échéance dépassée', () => {
    expect(isFindingLate({ status: 'Ouvert', due: '2026-10-07' }, AUJOURDHUI)).toBe(true);
    expect(isFindingLate({ status: 'En cours', due: '2026-10-08' }, AUJOURDHUI)).toBe(false);
    expect(isFindingLate({ status: 'Clos', due: '2026-01-01' }, AUJOURDHUI)).toBe(false);
    expect(isFindingLate({ status: 'Ouvert', due: '' }, AUJOURDHUI)).toBe(false);
    expect(isFindingLate({ status: 'Ouvert', due: null }, AUJOURDHUI)).toBe(false);
    expect(DONNEES.findings.filter((f) => isFindingLate(f, AUJOURDHUI)).map((f) => f.id)).toEqual(['F02', 'F07']);
  });
  it('échéance d’une tâche : la sienne, sinon celle de l’écart', () => {
    expect(taskDue({ due: '2026-11-15' }, { due: '2026-09-30' })).toBe('2026-11-15');
    expect(taskDue({}, { due: '2026-09-30' })).toBe('2026-09-30');
    expect(taskDue({ due: '' }, {})).toBe('');
    expect(isTaskLate({ done: false, due: '2026-11-15' }, { due: '2026-09-30' }, AUJOURDHUI)).toBe(false);
    expect(isTaskLate({ done: false }, { due: '2026-09-30' }, AUJOURDHUI)).toBe(true);
    expect(isTaskLate({ done: true }, { due: '2026-09-30' }, AUJOURDHUI)).toBe(false);
  });
  it('plan d’actions sur le jeu fictif', () => {
    const p = actionPlan(DONNEES.findings, 'todo', AUJOURDHUI);
    expect({ todo: p.todo, done: p.done, late: p.late, progress: p.progress }).toEqual({
      todo: 7,
      done: 5,
      late: 1,
      progress: 42,
    });
    expect(p.rows.map((r) => `${r.finding.id}#${r.index}`)).toEqual([
      'F07#1',
      'F02#1',
      'F01#0',
      'F01#1',
      'F05#0',
      'F09#0',
      'GAP-01#0',
    ]);
    expect(p.rows.find((r) => r.finding.id === 'F02')).toMatchObject({ due: '2026-11-15', late: false });
    expect(actionPlan(DONNEES.findings, 'done', AUJOURDHUI).rows).toHaveLength(5);
    expect(actionPlan(DONNEES.findings, 'all', AUJOURDHUI).rows).toHaveLength(12);
    expect(actionPlan([], 'all', AUJOURDHUI).progress).toBe(0);
  });
  it('bandeau d’échéance de clôture', () => {
    expect(deadlineSummary(DONNEES.findings, AUJOURDHUI)).toEqual({
      open: 9,
      byType: { NC: 3, PS: 3, PP: 1, autres: 2 },
      late: 2,
      tasks: 9,
      tasksDone: 2,
      progress: 22,
    });
  });
  it('report de l’échéance globale : non clos, sans échéance ou à l’ancienne', () => {
    const l = [
      ecart({ id: 'F01', due: '2026-12-08' }),
      ecart({ id: 'F02', due: '' }),
      ecart({ id: 'F03', due: '2026-11-01' }),
      ecart({ id: 'F04', due: '2026-12-08', status: 'Clos' }),
    ];
    expect(findingsFollowingDeadline(l, '2026-12-08').map((f) => f.id)).toEqual(['F01', 'F02']);
    expect(findingsFollowingDeadline(l, '').map((f) => f.id)).toEqual(['F02']);
    expect(findingsFollowingDeadline(DONNEES.findings, DONNEES.closeDeadline)).toHaveLength(7);
  });
});

describe('Registre : tri et identifiants (AUD-09)', () => {
  /** Tri de l'outil historique (l. 1206-1207), exécuté tel quel. */
  function triHistorique(fs: AuditFinding[]): string[] {
    const i = INDEX.indexOf("const rank=f=>(f.type==='NC maj'");
    const rank = INDEX.slice(i, INDEX.indexOf('\n', i));
    const j = INDEX.indexOf("fs.sort((a,b)=>(a.status==='Clos')", i);
    const tri = INDEX.slice(j, INDEX.indexOf('\n', j));
    const ctx: Record<string, unknown> = { fs: JSON.parse(JSON.stringify(fs)) };
    vm.createContext(ctx);
    vm.runInContext(`${rank}\n${tri}\n;globalThis.__ids=fs.map(f=>f.id);`, ctx);
    return [...(ctx.__ids as string[])];
  }

  it('tri identique à l’outil historique sur le jeu fictif', () => {
    const attendu = triHistorique(DONNEES.findings);
    expect(sortFindings(DONNEES.findings).map((f) => f.id)).toEqual(attendu);
    expect(attendu.slice(0, 4)).toEqual(['F01', 'F05', 'F09', 'F02']);
    expect(attendu.slice(-3)).toEqual(['F03', 'F06', 'F10']);
  });
  it('tri identique sur des registres aléatoires (identifiants numériques)', () => {
    let s = 42;
    const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    const pick = <T>(l: readonly T[]) => l[Math.floor(r() * l.length)]!;
    for (let k = 0; k < 10; k++) {
      const fs = Array.from({ length: 30 }, () =>
        ecart({
          id: `${pick(['F', 'GAP-', 'EXO-', 'INC-AC-'])}${1 + Math.floor(r() * 120)}`,
          source: pick(FINDING_SOURCES),
          type: pick(FINDING_TYPES),
          status: pick(FINDING_STATUSES),
        }),
      );
      expect(sortFindings(fs).map((f) => f.id)).toEqual(triHistorique(fs));
    }
    expect(compareFindings(ecart({ id: 'F2' }), ecart({ id: 'F10' }))).toBeLessThan(0);
  });
  it('prochain identifiant F01, F02… (premier libre, comme l’outil historique)', () => {
    expect(nextFindingId([])).toBe('F01');
    expect(nextFindingId(DONNEES.findings.map((f) => f.id))).toBe('F12');
    expect(nextFindingId(['F01', 'F03'])).toBe('F02');
    expect(nextFindingId(Array.from({ length: 99 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`))).toBe('F100');
    expect(nextFindingId(['GAP-01'], 'GAP-')).toBe('GAP-02');
  });
  it('valeurs d’un écart créé à la main', () => {
    expect(newFindingDefaults(2026, '2026-12-08', ['A-5.15'])).toEqual({
      source: 'AFNOR',
      year: 2026,
      type: 'PS',
      status: 'Ouvert',
      items: ['A-5.15'],
      due: '2026-12-08',
    });
    expect(newFindingDefaults(2026, undefined).due).toBe('');
  });
});

describe('Schémas (zod)', () => {
  it('identifiants d’exigence du jeu fictif', () => {
    for (const it of DONNEES.items) expect(RequirementId.safeParse(it.id).success).toBe(true);
    for (const x of ['A-9.99x', 'ISO-4', 'HDS-1', 'iso-4.1', 'A-5.15 '])
      expect(RequirementId.safeParse(x).success).toBe(false);
  });
  it('création d’écart : valeurs par défaut, bornes, caractères de contrôle', () => {
    const c = FindingCreateBody.parse({ year: 2026, title: '  Constat fictif  ', dueDate: '' });
    expect(c).toMatchObject({ source: 'AFNOR', type: 'PS', title: 'Constat fictif', dueDate: null, requirements: [] });
    expect(FindingCreateBody.safeParse({ year: 2026, title: 'a\u0007b' }).success).toBe(false);
    expect(FindingCreateBody.safeParse({ year: 2026, description: 'ligne 1\nligne 2\tfin' }).success).toBe(true);
    expect(FindingCreateBody.safeParse({ year: 2026, description: 'a\u0000b' }).success).toBe(false);
    expect(FindingCreateBody.safeParse({ year: 2026, title: 'x'.repeat(501) }).success).toBe(false);
    expect(FindingCreateBody.safeParse({ year: 1999 }).success).toBe(false);
    expect(FindingCreateBody.safeParse({ year: 2026, type: 'NC' }).success).toBe(false);
    expect(FindingCreateBody.safeParse({ year: 2026, source: 'Autre' }).success).toBe(false);
    expect(FindingCreateBody.safeParse({ year: 2026, dueDate: '2026-02-30' }).success).toBe(false);
    expect(FindingCreateBody.safeParse({ year: 2026, requirements: ['A-5.15', 'A-5.15'] }).success).toBe(false);
  });
  it('modification, statut, réouverture', () => {
    expect(FindingUpdateBody.safeParse({}).success).toBe(false);
    expect(FindingUpdateBody.safeParse({ owner: 'Pilote fictif' }).success).toBe(true);
    expect(FindingUpdateBody.safeParse({ status: 'Clos' }).success).toBe(false); // statut : route dédiée
    expect(FindingStatusBody.parse({ status: 'Clos' })).toEqual({ status: 'Clos' });
    expect(FindingReopenBody.safeParse({ motif: '  ' }).success).toBe(false);
    expect(FindingReopenBody.parse({ motif: 'Preuve refusée' })).toEqual({
      motif: 'Preuve refusée',
      status: 'En cours',
    });
  });
  it('tâches', () => {
    expect(TaskCreateBody.safeParse({ text: '' }).success).toBe(false);
    expect(TaskCreateBody.parse({ text: 'Action', due: '2026-11-01' })).toEqual({ text: 'Action', due: '2026-11-01' });
    expect(TaskUpdateBody.safeParse({}).success).toBe(false);
    expect(TaskUpdateBody.parse({ done: true })).toEqual({ done: true });
  });
  it('cycle, couverture, préparation, exigence', () => {
    expect(CycleUpdateBody.safeParse({}).success).toBe(false);
    expect(CycleUpdateBody.parse({ findingsDeadline: '2026-12-31' })).toEqual({
      findingsDeadline: '2026-12-31',
      rescheduleFindings: true,
    });
    expect(CoverageUpdateBody.safeParse({ afnor: 'X' }).success).toBe(true);
    expect(CoverageUpdateBody.safeParse({ afnor: 'x' }).success).toBe(false);
    expect(CoverageUpdateBody.safeParse({}).success).toBe(false);
    expect(PreparationUpdateBody.safeParse({ status: 'pret' }).success).toBe(true);
    expect(PreparationUpdateBody.safeParse({ status: 'Prête' }).success).toBe(false);
    expect(PreparationCopyBody.safeParse({ from: 2026, to: 2026 }).success).toBe(false);
    expect(RequirementUpdateBody.safeParse({ title: '' }).success).toBe(false);
    expect(RequirementUpdateBody.safeParse({ refText: 'Texte\nde référence' }).success).toBe(true);
  });
  it('créneaux', () => {
    const c = SlotCreateBody.parse({ day: 'j1', start: '09:00', end: '10:00' });
    expect(c).toMatchObject({ type: 'audit', requirements: [], people: [], proofs: [], questions: [] });
    expect(SlotCreateBody.safeParse({ day: 'j1', start: '10:00', end: '09:00' }).success).toBe(false);
    expect(SlotCreateBody.safeParse({ day: 'j1', start: '24:00', end: '24:30' }).success).toBe(false);
    expect(SlotCreateBody.safeParse({ day: 'j1', start: '09:00', end: '10:00', type: 'repas' }).success).toBe(false);
    expect(SlotUpdateBody.safeParse({ start: '11:00', end: '10:00' }).success).toBe(false);
    expect(SlotUpdateBody.safeParse({ title: 'Entretien fictif' }).success).toBe(true);
    expect(SlotUpdateBody.safeParse({}).success).toBe(false);
  });
});
