import crypto from 'node:crypto';
import { BusinessPolicy, businessDefaults } from '@suivi/shared';
export interface BusinessPolicyVersion {
  version: number;
  definition: BusinessPolicy;
  reason: string;
  createdAt: string;
  createdBy: string;
}
import type { JsonValue } from './db/types.generated.js';
import { surConnexion, type Actor, type Client, type Db, type Kdb } from './db/db.js';
import { HttpError } from './http/errors.js';

/* Accès aux données en Kysely (ADR 0062). Verrou consultatif et pg_notify restent des appels SQL directs. */
const colonnes = [
  'v.version',
  'v.definition',
  'v.reason',
  'v.created_at as createdAt',
  'v.created_by as createdBy',
] as const;
type Row = { version: number; definition: JsonValue; reason: string; createdAt: Date; createdBy: string };
// La définition n'est écrite que par publish(), après validation zod : elle est relue telle quelle (comportement inchangé ;
// la valider ici appliquerait les valeurs par défaut récentes à d'anciennes versions publiées).
const out = (r: Row): BusinessPolicyVersion => ({
  ...r,
  definition: r.definition as BusinessPolicy,
  createdAt: r.createdAt.toISOString(),
});
const versionCourante = (k: Kdb) =>
  k
    .selectFrom('business_policy_configuration as s')
    .innerJoin('business_policy_versions as v', 'v.version', 's.version')
    .select(colonnes)
    .where('s.id', '=', 1);

export class BusinessPolicies {
  constructor(private readonly db: Db) {}
  async initialize() {
    await this.db.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(727279)');
      const k = surConnexion(c);
      await k
        .insertInto('business_policy_versions')
        .values({
          version: 1,
          definition: JSON.stringify(businessDefaults()),
          reason: 'Configuration initiale pour de nouveaux usages ; aucune évaluation historique recalculée.',
          created_by: 'système',
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
      await k
        .insertInto('business_policy_configuration')
        .values({ id: 1, version: 1 })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }, 'système');
  }
  async current(c?: Client) {
    const row = await versionCourante(c ? surConnexion(c) : this.db.k).executeTakeFirst();
    if (!row) throw new HttpError(503, 'La configuration de l’environnement n’est pas initialisée.');
    return out(row);
  }
  async version(version: number) {
    const row = await this.db.k
      .selectFrom('business_policy_versions as v')
      .select(colonnes)
      .where('v.version', '=', version)
      .executeTakeFirst();
    if (!row) throw new HttpError(404, 'Version de configuration introuvable.');
    return out(row);
  }
  async history() {
    const rows = await this.db.k
      .selectFrom('business_policy_versions')
      .select(['version', 'reason', 'created_at as createdAt', 'created_by as createdBy'])
      .orderBy('version', 'desc')
      .limit(100)
      .execute();
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
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
    return this.db.tx(async (c, k) => {
      await k.selectFrom('business_policy_configuration').select('id').where('id', '=', 1).forUpdate().execute();
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
      await k
        .insertInto('business_policy_versions')
        .values({ version, definition: JSON.stringify(definition), reason, created_by: actor.username })
        .execute();
      await k.updateTable('business_policy_configuration').set({ version }).where('id', '=', 1).execute();
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
