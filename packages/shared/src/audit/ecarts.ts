/* Règles métier des écarts (AUD-09) et du plan d'actions (AUD-10), en fonctions pures appliquées par le serveur et
   affichées par l'interface (ADR 0025 § 4). Règles conservées de l'outil historique (l. 1207, 4916, 4922, 4981,
   4990) ; ajouts de la v3 : date et auteur de clôture, réouverture avec motif obligatoire, échéance propre d'une
   tâche. Les dates sont au format AAAA-MM-JJ ; la date du jour est toujours un paramètre. */
import { type FindingStatus } from './model.js';

/** Tâche, telle que la voient les règles (champs v3 facultatifs). */
export interface RuleTask {
  done: boolean;
  /** Échéance propre (AAAA-MM-JJ), sinon celle de l'écart. */
  due?: string | null;
  owner?: string | null;
  doneAt?: string | null;
  doneBy?: string | null;
}
/** Écart, tel que le voient les règles. */
export interface RuleFinding<T extends RuleTask = RuleTask> {
  status: FindingStatus | string;
  due?: string | null;
  tasks?: readonly T[];
  closedAt?: string | null;
  closedBy?: string | null;
}
/** Auteur et horodatage d'une action (horodatage ISO 8601, auteur = identifiant ou nom affiché). */
export interface Actor {
  at: string;
  by: string;
}

export type FindingRuleCode = 'TACHE_INTROUVABLE' | 'MOTIF_OBLIGATOIRE' | 'PAS_CLOS' | 'STATUT_INVALIDE';
/** Refus d'une règle métier (le serveur le traduit en 400 ou 409). */
export class FindingRuleError extends Error {
  constructor(
    readonly code: FindingRuleCode,
    message: string,
  ) {
    super(message);
    this.name = 'FindingRuleError';
  }
}

/** Longueur maximale du motif de réouverture. */
export const REOPEN_REASON_MAX = 1000;

function tasksOf<T extends RuleTask>(f: RuleFinding<T>): readonly T[] {
  return f.tasks ?? [];
}

export interface TaskResult<F> {
  finding: F;
  /** Toutes les tâches sont faites et l'écart n'est pas clos : proposer la clôture (toast l. 4924). */
  proposeClosure: boolean;
}

/** Coche ou décoche une tâche. Cocher une tâche d'un écart « Ouvert » le passe « En cours » ; décocher ne change
 *  pas le statut (comme l'outil historique). */
export function setTaskDone<T extends RuleTask, F extends RuleFinding<T>>(
  f: F,
  index: number,
  done: boolean,
  actor: Actor,
): TaskResult<F> {
  const tasks = tasksOf(f);
  const cur = tasks[index];
  if (!Number.isInteger(index) || !cur) throw new FindingRuleError('TACHE_INTROUVABLE', 'Tâche introuvable.');
  const t: T =
    cur.done === done
      ? cur
      : done
        ? { ...cur, done: true, doneAt: actor.at, doneBy: actor.by }
        : { ...cur, done: false, doneAt: null, doneBy: null };
  const next = tasks.map((x, i) => (i === index ? t : x));
  const status = done && f.status === 'Ouvert' ? 'En cours' : f.status;
  const finding = { ...f, status, tasks: next } as F;
  return { finding, proposeClosure: shouldProposeClosure(finding) };
}

/** Toutes les tâches faites (au moins une) et écart non clos. */
export function shouldProposeClosure(f: RuleFinding): boolean {
  const tasks = tasksOf(f);
  return tasks.length > 0 && tasks.every((x) => x.done) && f.status !== 'Clos';
}

/** Clôture : coche les tâches restantes et enregistre la date et l'auteur de la clôture. Sans effet si déjà clos. */
export function closeFinding<T extends RuleTask, F extends RuleFinding<T>>(f: F, actor: Actor): F {
  if (f.status === 'Clos') return f;
  const tasks = tasksOf(f).map((x) => (x.done ? x : { ...x, done: true, doneAt: actor.at, doneBy: actor.by }));
  return { ...f, status: 'Clos', tasks, closedAt: actor.at, closedBy: actor.by };
}

/** Motif de réouverture nettoyé, ou erreur s'il est vide. */
export function reopenReason(motif: string | null | undefined): string {
  const m = (motif ?? '').trim();
  if (!m) throw new FindingRuleError('MOTIF_OBLIGATOIRE', 'Le motif de réouverture est obligatoire.');
  if (m.length > REOPEN_REASON_MAX)
    throw new FindingRuleError('MOTIF_OBLIGATOIRE', `Le motif ne doit pas dépasser ${REOPEN_REASON_MAX} caractères.`);
  return m;
}

/** Réouverture explicite d'un écart clos (motif obligatoire, à journaliser) : statut « En cours » par défaut, date
 *  et auteur de clôture effacés, tâches inchangées. */
export function reopenFinding<F extends RuleFinding>(
  f: F,
  motif: string | null | undefined,
  status: 'Ouvert' | 'En cours' = 'En cours',
): { finding: F; motif: string } {
  if (f.status !== 'Clos') throw new FindingRuleError('PAS_CLOS', 'Seul un écart clos peut être rouvert.');
  const m = reopenReason(motif);
  return { finding: { ...f, status, closedAt: null, closedBy: null }, motif: m };
}

export interface StatusChange<F> {
  finding: F;
  /** Événement à journaliser. */
  event: 'inchange' | 'statut' | 'cloture' | 'reouverture';
  motif?: string;
}

/** Changement de statut depuis la fiche : « Clos » applique la clôture, quitter « Clos » exige un motif. */
export function changeFindingStatus<T extends RuleTask, F extends RuleFinding<T>>(
  f: F,
  status: string,
  actor: Actor,
  motif?: string | null,
): StatusChange<F> {
  if (status !== 'Ouvert' && status !== 'En cours' && status !== 'Clos')
    throw new FindingRuleError('STATUT_INVALIDE', 'Statut inconnu.');
  if (status === f.status) return { finding: f, event: 'inchange' };
  if (status === 'Clos') return { finding: closeFinding<T, F>(f, actor), event: 'cloture' };
  if (f.status === 'Clos') {
    const r = reopenFinding(f, motif, status);
    return { finding: r.finding, event: 'reouverture', motif: r.motif };
  }
  return { finding: { ...f, status }, event: 'statut' };
}

/* ---------------------------------------------------------------- Échéances et retards */
/** Écart en retard : non clos et échéance dépassée (strictement antérieure au jour donné). */
export function isFindingLate(f: Pick<RuleFinding, 'status' | 'due'>, today: string): boolean {
  return f.status !== 'Clos' && !!f.due && f.due < today;
}
/** Échéance d'une tâche : la sienne si renseignée, sinon celle de l'écart (AUD-10). */
export function taskDue(t: Pick<RuleTask, 'due'>, f: Pick<RuleFinding, 'due'>): string {
  return t.due || f.due || '';
}
/** Tâche en retard : non faite et échéance (de la tâche, sinon de l'écart) dépassée (l. 1162). */
export function isTaskLate(t: Pick<RuleTask, 'done' | 'due'>, f: Pick<RuleFinding, 'due'>, today: string): boolean {
  const d = taskDue(t, f);
  return !t.done && !!d && d < today;
}

/* ---------------------------------------------------------------- Registre */
interface SortableFinding {
  id: string;
  status: string;
  source: string;
  type: string;
}
/** Rang du type dans le tri : NC majeure, NC mineure, point sensible, puis le reste. */
export function typeRank(type: string): number {
  return type === 'NC maj' ? 0 : type === 'NC min' ? 1 : type === 'PS' ? 2 : 3;
}
/** Tri du registre (l. 1207) : non clos d'abord, AFNOR d'abord, type, puis identifiant (ordre numérique). */
export function compareFindings(a: SortableFinding, b: SortableFinding): number {
  return (
    Number(a.status === 'Clos') - Number(b.status === 'Clos') ||
    (a.source === 'AFNOR' ? 0 : 1) - (b.source === 'AFNOR' ? 0 : 1) ||
    typeRank(a.type) - typeRank(b.type) ||
    String(a.id).localeCompare(String(b.id), 'fr', { numeric: true })
  );
}
export function sortFindings<F extends SortableFinding>(list: readonly F[]): F[] {
  return list.slice().sort(compareFindings);
}

/** Prochain identifiant libre `F01`, `F02`… (l. 4916), ou avec un autre préfixe (`GAP-`, `EXO-`, `INC-AC-`, `FOU-`). */
export function nextFindingId(ids: Iterable<string>, prefix = 'F'): string {
  const used = new Set(ids);
  let n = 1;
  while (used.has(prefix + String(n).padStart(2, '0'))) n++;
  return prefix + String(n).padStart(2, '0');
}

/** Valeurs d'un écart créé à la main (l. 4917) : AFNOR, point sensible, ouvert, année N, échéance de clôture. */
export function newFindingDefaults(N: number, closeDeadline: string | null | undefined, items: string[] = []) {
  return {
    source: 'AFNOR' as const,
    year: N,
    type: 'PS' as const,
    status: 'Ouvert' as const,
    items,
    due: closeDeadline || '',
  };
}

/** Écarts dont l'échéance suit l'échéance globale de clôture quand elle change (l. 4990) : non clos, sans échéance
 *  ou à l'ancienne échéance (AUD-02). */
export function findingsFollowingDeadline<F extends Pick<RuleFinding, 'status' | 'due'>>(
  findings: readonly F[],
  oldDeadline: string | null | undefined,
): F[] {
  return findings.filter((f) => f.status !== 'Clos' && (!f.due || f.due === (oldDeadline ?? '')));
}

/** Pourcentage arrondi, 0 si le total est nul (`pct`, l. 1501). */
export function pct(n: number, d: number): number {
  return d ? Math.round((n * 100) / d) : 0;
}

export interface DeadlineSummary {
  open: number;
  /** Ouverts par type, comme le bandeau d'échéance (l. 1215) : NC, PS, PP, autres. */
  byType: { NC: number; PS: number; PP: number; autres: number };
  late: number;
  tasks: number;
  tasksDone: number;
  /** % des actions faites (écarts non clos). */
  progress: number;
}
/** Bandeau d'échéance de clôture du registre (l. 1208 à 1216). */
export function deadlineSummary(findings: readonly (RuleFinding & { type: string })[], today: string): DeadlineSummary {
  const open = findings.filter((f) => f.status !== 'Clos');
  const tk = open.flatMap((f) => tasksOf(f));
  const tasksDone = tk.filter((x) => x.done).length;
  return {
    open: open.length,
    byType: {
      NC: open.filter((f) => f.type.startsWith('NC')).length,
      PS: open.filter((f) => f.type === 'PS').length,
      PP: open.filter((f) => f.type === 'PP').length,
      autres: open.filter((f) => !/^(NC|PS|PP)/.test(f.type)).length,
    },
    late: open.filter((f) => isFindingLate(f, today)).length,
    tasks: tk.length,
    tasksDone,
    progress: pct(tasksDone, tk.length),
  };
}

/* ---------------------------------------------------------------- Plan d'actions (AUD-10) */
export type ActionFilter = 'todo' | 'done' | 'all';
export interface ActionRow<F, T> {
  finding: F;
  task: T;
  index: number;
  /** Échéance retenue : celle de la tâche, sinon celle de l'écart. */
  due: string;
  late: boolean;
}
export interface ActionPlan<F, T> {
  rows: ActionRow<F, T>[];
  todo: number;
  done: number;
  late: number;
  progress: number;
}
/** Vue transversale des tâches : filtre, tri par échéance (sans échéance en dernier) puis identifiant d'écart,
 *  indicateurs calculés sur toutes les tâches (l. 1160 à 1170). */
export function actionPlan<T extends RuleTask, F extends RuleFinding<T> & { id: string }>(
  findings: readonly F[],
  filter: ActionFilter,
  today: string,
): ActionPlan<F, T> {
  const all: ActionRow<F, T>[] = findings.flatMap((f) =>
    tasksOf(f).map((task, index) => ({
      finding: f,
      task,
      index,
      due: taskDue(task, f),
      late: isTaskLate(task, f, today),
    })),
  );
  const rows = all
    .filter((o) => (filter === 'all' ? true : filter === 'done' ? o.task.done : !o.task.done))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.finding.id.localeCompare(b.finding.id));
  const todo = all.filter((o) => !o.task.done).length;
  return {
    rows,
    todo,
    done: all.length - todo,
    late: all.filter((o) => o.late).length,
    progress: pct(all.length - todo, all.length),
  };
}
