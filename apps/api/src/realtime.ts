/* Temps réel : écoute LISTEN/NOTIFY de PostgreSQL (canaux suivi_events et suivi_presence) et diffusion aux flux SSE.
   Une connexion dédiée, reconnectée automatiquement ; la présence transite aussi par PostgreSQL, ce qui permet
   plusieurs instances d'API derrière le même frontal. */
import { EventEmitter } from 'node:events';
import { ENTITIES, PRESENCE_TTL_MS, type ChangeEvent, type PresenceEntry } from '@suivi/shared';
import pg from 'pg';
import type { Logger } from 'pino';
import type { Config } from './config.js';
import type { Db } from './db/db.js';

const ENTITY_SET = new Set<string>(ENTITIES);

export class Bus extends EventEmitter {
  private client: pg.Client | null = null;
  private stopped = false;
  private retry = 1000;
  constructor(
    private readonly cfg: Config['db'],
    private readonly log: Logger,
  ) {
    super();
    this.setMaxListeners(0);
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
  }

  private async connect(): Promise<void> {
    const c = new pg.Client({ ...this.cfg, application_name: 'suivi-audits-events' });
    c.on('notification', (n) => this.onNotification(n.channel, n.payload ?? ''));
    c.on('error', (e) => this.log.warn({ err: e.message }, 'events connection error'));
    c.on('end', () => {
      if (this.client === c) this.client = null;
      if (!this.stopped) this.reconnectLater();
    });
    try {
      await c.connect();
      await c.query('LISTEN suivi_events');
      await c.query('LISTEN suivi_presence');
      this.client = c;
      this.retry = 1000;
      this.emit('ready');
    } catch (e) {
      this.log.warn({ err: (e as Error).message }, 'events connection failed');
      c.end().catch(() => {});
      if (!this.stopped) this.reconnectLater();
    }
  }
  private reconnectLater() {
    const t = setTimeout(() => void this.connect(), this.retry);
    t.unref();
    this.retry = Math.min(this.retry * 2, 30000);
  }

  private onNotification(channel: string, payload: string) {
    let msg: unknown;
    try {
      msg = JSON.parse(payload);
    } catch {
      return;
    }
    if (channel === 'suivi_events') {
      const e = msg as ChangeEvent;
      if (ENTITY_SET.has(e.entity)) this.emit('change', e);
    } else if (channel === 'suivi_presence') this.emit('presence-raw', msg);
  }

  get connected() {
    return this.client !== null;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    const c = this.client;
    this.client = null;
    if (c) await c.end().catch(() => {});
  }
}

/** Registre de présence : qui consulte ou modifie quoi. Alimenté par le canal suivi_presence. */
export class Presence extends EventEmitter {
  private readonly entries = new Map<string, PresenceEntry & { expires: number }>();
  private readonly timer: NodeJS.Timeout;
  constructor(
    private readonly db: Db,
    bus: Bus,
  ) {
    super();
    this.setMaxListeners(0);
    bus.on('presence-raw', (m: { op: 'set' | 'leave'; entry: PresenceEntry }) => this.apply(m));
    this.timer = setInterval(() => this.sweep(), 5000);
    this.timer.unref();
  }
  private apply(m: { op: 'set' | 'leave'; entry: PresenceEntry }) {
    if (!m || !m.entry || typeof m.entry.client !== 'string') return;
    const before = JSON.stringify(this.list());
    if (m.op === 'leave') this.entries.delete(m.entry.client);
    else {
      // Le renouvellement d'une même présence conserve son heure de début.
      const prev = this.entries.get(m.entry.client);
      const since =
        prev && prev.resource === m.entry.resource && prev.mode === m.entry.mode ? prev.since : m.entry.since;
      this.entries.set(m.entry.client, { ...m.entry, since, expires: Date.now() + PRESENCE_TTL_MS });
    }
    if (JSON.stringify(this.list()) !== before) this.emit('update');
  }
  private sweep() {
    const now = Date.now();
    let changed = false;
    for (const [k, v] of this.entries) if (v.expires < now) changed = this.entries.delete(k) || changed;
    if (changed) this.emit('update');
  }
  list(): PresenceEntry[] {
    return [...this.entries.values()]
      .map(({ expires: _e, ...rest }) => rest)
      .sort((a, b) => a.resource.localeCompare(b.resource) || a.username.localeCompare(b.username));
  }
  /** Présence visible selon le rôle : l'activité dans l'administration n'est visible que des administrateurs. */
  visibleTo(role: string): PresenceEntry[] {
    return this.list().filter((e) => role === 'admin' || !e.resource.startsWith('admin'));
  }
  async publish(op: 'set' | 'leave', entry: PresenceEntry) {
    await this.db.q('SELECT pg_notify($1, $2)', ['suivi_presence', JSON.stringify({ op, entry })]);
  }
  stop() {
    clearInterval(this.timer);
  }
}
