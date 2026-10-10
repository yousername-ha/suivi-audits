import { recurrenceSlot, SeriesData } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { objectColumns, objectDto, type ObjectRow, type Grc } from './core.js';

export class GrcTasks {
  constructor(private readonly g: Grc) {}
  async list(
    smsi: string,
    user: SessionUser,
    search: string,
    offset: number,
    filters: { status?: string; ownerId?: string },
  ) {
    const native = await this.g.listObjects(smsi, user, 'action', search, offset, filters);
    const legacy = (await this.g.legacyTasks.list(smsi, user)).filter(
      (o) =>
        o.name.toLowerCase().includes(search.toLowerCase()) &&
        (!filters.status || o.data.status === filters.status) &&
        (!filters.ownerId || o.data.ownerId === filters.ownerId),
    );
    const remaining = 50 - native.items.length;
    const items = [
      ...native.items,
      ...legacy.slice(Math.max(0, offset - native.total), Math.max(0, offset - native.total) + remaining),
    ];
    const total = native.total + legacy.length;
    return { items, total, nextOffset: offset + 50 < total ? offset + 50 : null };
  }
  async window(smsi: string, user: SessionUser, from: string, to: string) {
    await this.g.access(smsi, user);
    await this.g.permission(user, 'ecarts', 'lire');
    const items = (
      await this.g.db.q<ObjectRow>(
        `SELECT ${objectColumns} FROM grc_objects WHERE smsi_id=$1 AND kind='action' AND NOT archived AND (data->>'dueAt' IS NULL OR data->>'dueAt'>=$2 AND data->>'dueAt'<=$3) ORDER BY data->>'dueAt' NULLS LAST,id LIMIT 2001`,
        [smsi, from, to],
      )
    ).rows;
    const legacy = (await this.g.legacyTasks.list(smsi, user)).filter(
      (o) => !o.data.dueAt || (String(o.data.dueAt) >= from && String(o.data.dueAt) <= to),
    );
    if (items.length + legacy.length > 2000) throw new HttpError(422, 'Réduisez la période : plus de 2 000 actions.');
    return { items: [...items.map(objectDto), ...legacy], from, to };
  }
  async dashboard(smsi: string, user: SessionUser) {
    await this.g.access(smsi, user);
    await this.g.permission(user, 'ecarts', 'lire');
    const policy = (await this.g.policy(smsi, user)).definition;
    const closed = policy.statuses.filter((s) => s.terminal).map((s) => s.id);
    const summary = await this.g.db.one(
      `SELECT count(*)::int total,count(*) FILTER(WHERE data->>'status'=ANY($2))::int closed,count(*) FILTER(WHERE NOT(data->>'status'=ANY($2)) AND data->>'dueAt'<$3)::int overdue,count(*) FILTER(WHERE data->>'ownerId' IS NULL)::int unassigned FROM grc_objects WHERE smsi_id=$1 AND kind='action' AND NOT archived`,
      [smsi, closed, new Date().toISOString()],
    );
    const byStatus = (
      await this.g.db.q(
        `SELECT data->>'status' status,count(*)::int count FROM grc_objects WHERE smsi_id=$1 AND kind='action' AND NOT archived GROUP BY data->>'status'`,
        [smsi],
      )
    ).rows;
    const legacy = await this.g.legacyTasks.list(smsi, user);
    const totals = summary as { total: number; closed: number; overdue: number; unassigned: number };
    const counts = new Map(byStatus.map((r) => [String(r.status), Number(r.count)]));
    for (const item of legacy) {
      const terminal = closed.includes(String(item.data.status)) || item.data.status === 'done';
      totals.total++;
      if (terminal) totals.closed++;
      if (!terminal && item.data.dueAt && String(item.data.dueAt) < new Date().toISOString()) totals.overdue++;
      if (!item.data.ownerId) totals.unassigned++;
      const status = String(item.data.status);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return { summary: totals, byStatus: [...counts].map(([status, count]) => ({ status, count })) };
  }
  async occurrences(smsi: string, id: string, user: SessionUser, before?: string) {
    const o = await this.g.object(smsi, id, user);
    if (o.kind !== 'task_series') throw new HttpError(422, 'Série attendue.');
    return (
      await this.g.db.q(
        `SELECT s.slot,s.action_id AS "actionId",o.name,o.data,o.version FROM grc_occurrences s JOIN grc_objects o ON o.id=s.action_id WHERE s.series_id=$1 AND ($2::text IS NULL OR s.slot<$2) ORDER BY s.slot DESC LIMIT 50`,
        [id, before ?? null],
      )
    ).rows;
  }
  async tick(now = new Date()) {
    // Verrou par série + clé d’occurrence unique : plusieurs instances peuvent travailler sans doublons.
    await this.g.modules.assert('ecarts');
    const series = (
      await this.g.db.q<{ id: string }>(
        `SELECT o.id FROM grc_objects o LEFT JOIN grc_series s ON s.object_id=o.id WHERE o.kind='task_series' AND NOT o.archived AND o.data->'recurrence'->>'active'='true' ORDER BY s.checked_at NULLS FIRST,o.id LIMIT 500`,
      )
    ).rows;
    for (const { id } of series)
      await this.g.db.tx(async (c) => {
        const lock = (
          await c.query<{ locked: boolean }>('SELECT pg_try_advisory_xact_lock(hashtextextended($1,727281)) locked', [
            id,
          ])
        ).rows[0];
        if (!lock?.locked) return;
        const row = (
          await c.query<ObjectRow>(`SELECT ${objectColumns} FROM grc_objects WHERE id=$1 AND NOT archived FOR UPDATE`, [
            id,
          ])
        ).rows[0];
        if (!row) return;
        const o = objectDto(row),
          d = SeriesData.parse(o.data);
        if (!d.recurrence.active) return;
        await c.query('INSERT INTO grc_series(object_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
        let index = (
          await c.query<{ next_index: number }>('SELECT next_index FROM grc_series WHERE object_id=$1 FOR UPDATE', [id])
        ).rows[0]!.next_index;
        const policyRow = (
          await c.query<{ definition: { statuses: { id: string; terminal: boolean }[] } }>(
            `SELECT p.definition FROM grc_smsis s JOIN business_policy_versions p ON p.version=s.business_version WHERE s.id=$1 FOR SHARE OF s`,
            [o.smsiId],
          )
        ).rows[0];
        if (!policyRow) return;
        await c.query('UPDATE grc_series SET checked_at=$2 WHERE object_id=$1', [id, now]);
        // Une série liée à un référentiel désactivé est suspendue, sans perdre son curseur.
        const frameworks = d.refs
          .filter((ref) => ref.startsWith('requirement:') || ref.startsWith('object:'))
          .map((ref) => ref.split(':')[1]);
        if (frameworks.length) {
          const publications = (
            await c.query<{ enabled: string; archived: boolean }>(
              "SELECT data->>'enabled' enabled,archived FROM grc_objects WHERE smsi_id=$1 AND id=ANY($2::uuid[]) AND kind='framework' FOR SHARE",
              [o.smsiId, frameworks],
            )
          ).rows;
          if (publications.some((p) => p.archived || p.enabled !== 'true')) return;
        }
        const status = policyRow.definition.statuses.find((s) => !s.terminal)!.id;
        // Rattrapage plafonné par transaction, poursuivi au prochain passage ; aucune occurrence perdue.
        for (let generated = 0; generated < 50; generated++) {
          const slot = recurrenceSlot(d.recurrence, index);
          if (
            !slot ||
            new Date(slot.dueAt).getTime() > now.getTime() + Math.max(7, d.recurrence.reminderDays) * 86400000
          )
            break;
          if (
            !(await c.query('SELECT 1 FROM grc_occurrences WHERE series_id=$1 AND slot=$2', [id, slot.key])).rowCount
          ) {
            const action = await this.g.insert(
              c,
              o.smsiId,
              'action',
              o.name,
              {
                description: d.description,
                status,
                ownerId: d.ownerId,
                startAt: null,
                dueAt: slot.dueAt,
                priority: d.priority,
                category: d.category,
                justification: '',
                reminderDays: d.recurrence.reminderDays,
                dependencies: [],
                seriesId: id,
                occurrenceKey: slot.key,
              },
              { username: 'Automate SMSI' },
              '',
            );
            await c.query('INSERT INTO grc_occurrences(series_id,slot,action_id) VALUES($1,$2,$3)', [
              id,
              slot.key,
              action.id,
            ]);
            for (const target of ['object:' + id, ...d.refs])
              await c.query(
                `INSERT INTO grc_links(smsi_id,source_id,source_ref,target_ref,type,note,created_by) VALUES($1,$2,$3,$4,'related_to','Occurrence récurrente','Automate SMSI') ON CONFLICT DO NOTHING`,
                [o.smsiId, action.id, 'object:' + action.id, target],
              );
          }
          index++;
        }
        await c.query('UPDATE grc_series SET next_index=$2 WHERE object_id=$1', [id, index]);
      }, 'Automate SMSI');
    await this.reminders(now);
  }
  private async reminders(now: Date) {
    await this.g.db.tx(async (c) => {
      await c.query(
        `INSERT INTO grc_notifications(smsi_id,object_id,user_id,kind,due_key,title,message)
   SELECT o.smsi_id,o.id,u.id,'task_due',o.data->>'dueAt',p.definition->'notifications'->>'title',p.definition->'notifications'->>'message'
   FROM grc_objects o JOIN grc_smsis s ON s.id=o.smsi_id JOIN business_policy_versions p ON p.version=s.business_version JOIN users u ON u.id=(o.data->>'ownerId')::uuid
   WHERE o.kind='action' AND NOT o.archived AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()) AND p.definition->'notifications'->>'enabled'='true'
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.definition->'statuses') st WHERE st->>'id'=o.data->>'status' AND st->>'terminal'='true')
   AND (o.data->>'dueAt')::timestamptz <= $1::timestamptz + make_interval(days => (o.data->>'reminderDays')::int)
   AND (s.visibility='instance' OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=u.id)) ON CONFLICT DO NOTHING`,
        [now],
      );
      if (!(await this.g.modules.state()).disabled.includes('pilotage'))
        await c.query(
          `INSERT INTO grc_notifications(smsi_id,object_id,user_id,kind,due_key,title,message)
        SELECT o.smsi_id,o.id,u.id,'risk_review',o.data->>'reviewAt','Réévaluation d’un risque','Une appréciation périodique du risque est à préparer.'
        FROM grc_objects o JOIN grc_smsis s ON s.id=o.smsi_id JOIN business_policy_versions p ON p.version=s.business_version JOIN users u ON u.id=(o.data->>'ownerId')::uuid
        WHERE o.kind='risk' AND NOT o.archived AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now())
        AND p.definition->'notifications'->>'enabled'='true' AND (o.data->>'reviewAt')::date <= $1::timestamptz::date + (p.definition->'notifications'->>'leadDays')::int
        AND (s.visibility='instance' OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=u.id)) ON CONFLICT DO NOTHING`,
          [now],
        );
    }, 'Automate SMSI');
  }
  async notifications(user: SessionUser) {
    const rows = (
      await this.g.db.q<{ smsiId: string; [key: string]: unknown }>(
        `SELECT id,smsi_id AS "smsiId",object_id AS "objectId",kind,title,message,read_at AS "readAt",created_at AS "createdAt" FROM grc_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [user.id],
      )
    ).rows;
    const visible = [];
    for (const r of rows)
      if (await this.g.visible(user, r.smsiId, r.kind === 'risk_review' ? 'pilotage' : 'ecarts')) visible.push(r);
    return visible;
  }
  async read(id: string, user: SessionUser) {
    await this.g.db.q('UPDATE grc_notifications SET read_at=now() WHERE id=$1 AND user_id=$2', [id, user.id]);
    return { ok: true };
  }
}
