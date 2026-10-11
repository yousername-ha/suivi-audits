import crypto from 'node:crypto';
import { BusinessPolicy, businessDefaults } from '@suivi/shared';
export interface BusinessPolicyVersion {
  version: number;
  definition: BusinessPolicy;
  reason: string;
  createdAt: string;
  createdBy: string;
}
import type { Actor, Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';

const columns = 'v.version, v.definition, v.reason, v.created_at AS "createdAt", v.created_by AS "createdBy"';
type Row = Omit<BusinessPolicyVersion, 'createdAt'> & { createdAt: Date };
const out = (r: Row): BusinessPolicyVersion => ({ ...r, createdAt: r.createdAt.toISOString() });

export class BusinessPolicies {
  constructor(private readonly db: Db) {}
  async initialize() {
    await this.db.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(727279)');
      await c.query(
        'INSERT INTO business_policy_versions(version,definition,reason,created_by) VALUES (1,$1,$2,$3) ON CONFLICT DO NOTHING',
        [
          businessDefaults(),
          'Configuration initiale pour de nouveaux usages ; aucune évaluation historique recalculée.',
          'système',
        ],
      );
      await c.query('INSERT INTO business_policy_configuration(id,version) VALUES (1,1) ON CONFLICT DO NOTHING');
    }, 'système');
  }
  async current(c?: Client) {
    const row = (
      await (c ?? this.db.pool).query<Row>(
        `SELECT ${columns} FROM business_policy_configuration s JOIN business_policy_versions v USING(version) WHERE s.id=1`,
      )
    ).rows[0];
    if (!row) throw new HttpError(503, 'La configuration de l’environnement n’est pas initialisée.');
    return out(row);
  }
  async version(version: number) {
    const row = await this.db.one<Row>(`SELECT ${columns} FROM business_policy_versions v WHERE version=$1`, [version]);
    if (!row) throw new HttpError(404, 'Version de configuration introuvable.');
    return out(row);
  }
  async history() {
    return (
      await this.db.q<Omit<Row, 'definition'>>(
        'SELECT version,reason,created_at AS "createdAt",created_by AS "createdBy" FROM business_policy_versions ORDER BY version DESC LIMIT 100',
      )
    ).rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }
  private parse(input: unknown) {
    const parsed = BusinessPolicy.safeParse(input);
    if (!parsed.success)
      throw new HttpError(422, parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; '));
    return parsed.data;
  }
  private fingerprint(version: number, definition: BusinessPolicy) {
    return crypto.createHash('sha256').update(JSON.stringify({ version, definition })).digest('hex');
  }
  async preview(input: unknown) {
    const definition = this.parse(input),
      current = await this.current();
    return {
      version: current.version,
      previewId: this.fingerprint(current.version, definition),
      definition,
      changed:
        this.fingerprint(current.version, this.parse(current.definition)) !==
        this.fingerprint(current.version, definition),
    };
  }
  async publish(input: unknown, expected: number, previewId: string, reason: string, actor: Actor, ip: string) {
    const definition = this.parse(input);
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM business_policy_configuration WHERE id=1 FOR UPDATE');
      const current = await this.current(c);
      if (current.version !== expected)
        throw new HttpError(
          412,
          'La configuration a changé. Votre brouillon est conservé ; rechargez avant de publier.',
          { current },
        );
      if (previewId !== this.fingerprint(current.version, definition))
        throw new HttpError(422, 'La définition ne correspond plus à la prévisualisation. Relancez la simulation.');
      if (this.fingerprint(expected, definition) === this.fingerprint(expected, this.parse(current.definition)))
        throw new HttpError(422, 'Aucun changement à publier.');
      const version = current.version + 1;
      await c.query('INSERT INTO business_policy_versions(version,definition,reason,created_by) VALUES ($1,$2,$3,$4)', [
        version,
        definition,
        reason,
        actor.username,
      ]);
      await c.query('UPDATE business_policy_configuration SET version=$1 WHERE id=1', [version]);
      await this.db.audit(
        actor,
        ip,
        'business.policy.publish',
        String(version),
        { previousVersion: current.version, version, reason, previewId },
        c,
      );
      await c.query("SELECT pg_notify('suivi_events',$1)", [
        JSON.stringify({
          entity: 'grc',
          id: String(version),
          version,
          scope: '00000000-0000-4000-8000-000000000001',
          module: 'administration',
          author: actor.username,
          op: 'update',
          ts: new Date().toISOString(),
        }),
      ]);
      return this.current(c);
    }, actor.username);
  }
}
