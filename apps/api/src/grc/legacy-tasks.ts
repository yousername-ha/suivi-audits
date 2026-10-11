import { isObject, type JsonObject } from '@suivi/shared/legacy';
import { validDate, type GrcObject } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { DEFAULT_SMSI, hash, type Grc } from './core.js';
/** Adaptateur sans copie : les actions v2 restent modifiables dans leur source historique. */
export class LegacyTasks {
  constructor(private readonly g: Grc) {}
  async list(smsi: string, user: SessionUser): Promise<GrcObject[]> {
    if (smsi !== DEFAULT_SMSI) return [];
    const state = await this.g.legacy.recompose();
    if (!state) return [];
    const out: GrcObject[] = [];
    const push = (ref: string, name: string, data: Record<string, unknown>, raw: JsonObject) =>
      out.push({
        id: ref,
        smsiId: smsi,
        kind: 'action',
        name,
        data: { ...data, sourceSha: hash(raw), legacy: true },
        version: state.version,
        createdAt: String(raw.createdAt ?? new Date(0).toISOString()),
        updatedAt: String(raw.createdAt ?? new Date(0).toISOString()),
        createdBy: 'Historique',
        updatedBy: 'Historique',
        legacyKey: ref.split(':')[1]!,
        legacyId: ref,
        archived: false,
      });
    if (user.rights.can('ecarts', 'lire'))
      for (const f of Array.isArray(state.data.findings) ? state.data.findings : []) {
        if (!isObject(f) || typeof f.id !== 'string') continue;
        for (const [i, t] of (Array.isArray(f.tasks) ? f.tasks : []).entries()) {
          if (!isObject(t)) continue;
          push(
            `legacy:tasks:${f.id}/${i}`,
            String(t.t ?? 'Action historique'),
            {
              description: String(f.text ?? ''),
              status: t.done ? 'done' : 'todo',
              ownerId: null,
              ownerLabel: String(f.owner ?? ''),
              startAt: null,
              dueAt: typeof f.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.due) ? f.due + 'T12:00:00Z' : null,
              priority: 'normal',
              category: 'action',
              justification: String(f.proof ?? ''),
              reminderDays: 7,
              dependencies: [],
            },
            { finding: f, task: t },
          );
        }
      }
    if (user.rights.can('pilotage', 'lire'))
      for (const r of Array.isArray(state.data.recurring) ? state.data.recurring : []) {
        if (!isObject(r) || typeof r.id !== 'string' || r.active === false) continue;
        const start = typeof r.last === 'string' && r.last ? r.last : String(r.start ?? '');
        let due: Date | null = /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(start + 'T12:00:00Z') : null;
        if (due && r.last) {
          const n = Number(r.n) || 1;
          if (r.u === 'j') due.setUTCDate(due.getUTCDate() + n);
          else if (r.u === 's') due.setUTCDate(due.getUTCDate() + 7 * n);
          else if (r.u === 'm') due.setUTCMonth(due.getUTCMonth() + n);
          else due.setUTCFullYear(due.getUTCFullYear() + n);
        }
        if (due && !Number.isFinite(due.getTime())) due = null;
        push(
          'legacy:recurring:' + r.id,
          String(r.title ?? r.id),
          {
            description: String(r.refs ?? ''),
            status: 'todo',
            ownerId: null,
            ownerLabel: String(r.owner ?? ''),
            startAt: null,
            dueAt: due?.toISOString() ?? null,
            priority: 'normal',
            category: 'action',
            justification: '',
            reminderDays: 7,
            dependencies: [],
            legacyRecurring: true,
          },
          r,
        );
      }
    return out;
  }
  async complete(
    ref: string,
    expected: number,
    sourceSha: string,
    input: { date: string; comment: string; proof: string },
    user: SessionUser,
    ip: string,
  ) {
    if (!validDate(input.date)) throw new HttpError(422, 'Date de réalisation invalide.');
    const [prefix, key, ...rest] = ref.split(':');
    if (prefix !== 'legacy' || !['tasks', 'recurring'].includes(key ?? ''))
      throw new HttpError(422, 'Action historique attendue.');
    const id = rest.join(':');
    await this.g.access(DEFAULT_SMSI, user, true);
    await this.g.permission(user, key === 'tasks' ? 'ecarts' : 'pilotage', 'modifier');
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM app_state WHERE id=1 FOR UPDATE');
      const state = await this.g.legacy.recompose(c);
      if (!state || state.version !== expected)
        throw new HttpError(412, 'La source historique a changé. Rechargez avant de confirmer.');
      let raw: JsonObject, source: JsonObject;
      if (key === 'tasks') {
        const slash = id.lastIndexOf('/'),
          finding = id.slice(0, slash),
          index = Number(id.slice(slash + 1));
        const matches = (Array.isArray(state.data.findings) ? state.data.findings : []).filter(
          (x) => isObject(x) && x.id === finding,
        );
        if (matches.length > 1)
          throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
        const f = matches[0];
        if (!isObject(f) || !Array.isArray(f.tasks) || !isObject(f.tasks[index]))
          throw new HttpError(404, 'Action introuvable.');
        source = f.tasks[index] as JsonObject;
        raw = { finding: f, task: source };
        if (hash(raw) !== sourceSha) throw new HttpError(412, 'Source différente.');
        source.done = true;
        source.grcCompletion = { ...input, by: user.username, createdAt: new Date().toISOString() };
      } else {
        const matches = (Array.isArray(state.data.recurring) ? state.data.recurring : []).filter(
          (x) => isObject(x) && x.id === id,
        );
        if (matches.length > 1)
          throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
        const r = matches[0];
        if (!isObject(r)) throw new HttpError(404, 'Tâche récurrente introuvable.');
        if (hash(r) !== sourceSha) throw new HttpError(412, 'Source différente.');
        const history = Array.isArray(r.history) ? r.history : [];
        history.push({
          date: input.date,
          by: user.username,
          comment: input.comment,
          proof: input.proof,
          createdAt: new Date().toISOString(),
        });
        r.history = history;
        r.last =
          history
            .filter(isObject)
            .map((x) => String(x.date ?? ''))
            .sort()
            .at(-1) ?? '';
      }
      const saved = await this.g.legacy.legacyWrite(c, state.data, user, expected);
      if (saved.conflict) throw new HttpError(412, 'Version obsolète.');
      await this.g.db.audit(user, ip, 'grc.legacy.task.completed', ref, { ...input, sourceSha }, c);
      await this.g.notify(c, ref, saved.version, DEFAULT_SMSI, key === 'tasks' ? 'ecarts' : 'pilotage', user.username);
      return { ok: true, version: saved.version };
    }, user.username);
  }
}
