import { isObject, type JsonObject } from '@suivi/shared/legacy';
import { validDate, type GrcObject } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { verrouillerEtat } from '../legacy/store.js';
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
    if (prefix !== 'legacy' || key !== 'recurring') throw new HttpError(422, 'Action historique attendue.');
    const id = rest.join(':');
    await this.g.access(DEFAULT_SMSI, user, true);
    await this.g.permission(user, 'pilotage', 'modifier');
    return this.g.db.tx(async (c) => {
      await verrouillerEtat(c);
      const state = await this.g.legacy.recompose(c);
      if (!state || state.version !== expected)
        throw new HttpError(412, 'La source historique a changé. Rechargez avant de confirmer.');
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
      const saved = await this.g.legacy.nativeWrite(c, state.data, user, expected);
      if (saved.conflict) throw new HttpError(412, 'Version obsolète.');
      await this.g.db.audit(user, ip, 'grc.legacy.task.completed', ref, { ...input, sourceSha }, c);
      await this.g.notify(c, ref, saved.version, DEFAULT_SMSI, 'pilotage', user.username);
      return { ok: true, version: saved.version };
    }, user.username);
  }
}
