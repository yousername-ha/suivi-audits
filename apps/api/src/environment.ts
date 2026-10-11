import crypto from 'node:crypto';
import {
  EnvironmentDefinition,
  type EnvironmentVersion,
  environmentDefaults,
  calculateRisk,
  type RiskExample,
} from '@suivi/shared';
import type { Actor, Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';

const columns = 'v.version, v.definition, v.reason, v.created_at AS "createdAt", v.created_by AS "createdBy"';
type Row = Omit<EnvironmentVersion, 'createdAt'> & { createdAt: Date };
const out = (r: Row): EnvironmentVersion => ({ ...r, createdAt: r.createdAt.toISOString() });

export class Environment {
  constructor(private readonly db: Db) {}
  async initialize() {
    await this.db.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(727278)');
      await c.query(
        'INSERT INTO environment_versions(version,definition,reason,created_by) VALUES (1,$1,$2,$3) ON CONFLICT DO NOTHING',
        [
          environmentDefaults(),
          'Configuration initiale pour de nouveaux usages ; aucune évaluation historique recalculée.',
          'système',
        ],
      );
      await c.query('INSERT INTO environment_configuration(id,version) VALUES (1,1) ON CONFLICT DO NOTHING');
    }, 'système');
  }
  async current(c?: Client) {
    const row = (
      await (c ?? this.db.pool).query<Row>(
        `SELECT ${columns} FROM environment_configuration s JOIN environment_versions v USING(version) WHERE s.id=1`,
      )
    ).rows[0];
    if (!row) throw new HttpError(503, 'La configuration de l’environnement n’est pas initialisée.');
    return out(row);
  }
  async version(version: number) {
    const row = await this.db.one<Row>(`SELECT ${columns} FROM environment_versions v WHERE version=$1`, [version]);
    if (!row) throw new HttpError(404, 'Version de configuration introuvable.');
    return out(row);
  }
  async history() {
    return (
      await this.db.q<Omit<Row, 'definition'>>(
        'SELECT version,reason,created_at AS "createdAt",created_by AS "createdBy" FROM environment_versions ORDER BY version DESC LIMIT 100',
      )
    ).rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }
  private parse(input: unknown) {
    const parsed = EnvironmentDefinition.safeParse(input);
    if (!parsed.success)
      throw new HttpError(422, parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; '));
    return parsed.data;
  }
  private fingerprint(version: number, definition: EnvironmentDefinition) {
    return crypto.createHash('sha256').update(JSON.stringify({ version, definition })).digest('hex');
  }
  async preview(input: unknown, example: RiskExample) {
    const definition = this.parse(input),
      current = await this.current();
    let calculation;
    try {
      calculation = calculateRisk(definition, example);
    } catch {
      throw new HttpError(422, 'Le scénario doit utiliser les niveaux de cette définition.');
    }
    return {
      version: current.version,
      previewId: this.fingerprint(current.version, definition),
      definition,
      calculation,
      changed:
        this.fingerprint(current.version, this.parse(current.definition)) !==
        this.fingerprint(current.version, definition),
    };
  }
  async publish(input: unknown, expected: number, previewId: string, reason: string, actor: Actor, ip: string) {
    const definition = this.parse(input);
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM environment_configuration WHERE id=1 FOR UPDATE');
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
      await c.query('INSERT INTO environment_versions(version,definition,reason,created_by) VALUES ($1,$2,$3,$4)', [
        version,
        definition,
        reason,
        actor.username,
      ]);
      await c.query('UPDATE environment_configuration SET version=$1 WHERE id=1', [version]);
      await this.db.audit(
        actor,
        ip,
        'environment.publish',
        String(version),
        { previousVersion: current.version, version, reason, previewId },
        c,
      );
      return this.current(c);
    }, actor.username);
  }
}
