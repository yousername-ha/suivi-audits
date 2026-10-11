import crypto from 'node:crypto';
import {
  calculateRisk,
  legacyAiRisk,
  type AssessmentIntent,
  type AssessmentPublication,
  type AssessmentSource,
  type RiskAssessment,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { Actor, Client, Db } from './db/db.js';
import type { Environment } from './environment.js';
import type { LegacyStore } from './legacy/store.js';
import { HttpError } from './http/errors.js';

// Trier les clés uniquement : les tableaux et les clés inconnues appartiennent à la source.
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : isObject(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
const serialize = (source: JsonObject) => JSON.stringify(stable(source));
const sha = (source: JsonObject) => crypto.createHash('sha256').update(serialize(source)).digest('hex');
const summary = (source: JsonObject | undefined, key: string, max: number) =>
  typeof source?.[key] === 'string' ? source[key].slice(0, max) : '';
const columns = `a.id, a.source_id AS "sourceId", a.source_sha AS "sourceSha", a.source_snapshot AS "sourceSnapshot",
 a.revision,a.ratings,a.result,a.rationale,a.created_at AS "createdAt",a.created_by AS "createdBy",
 jsonb_build_object('version',v.version,'definition',v.definition,'reason',v.reason,'createdAt',v.created_at,'createdBy',v.created_by) AS configuration`;
type Row = Omit<RiskAssessment, 'createdAt'> & { createdAt: Date };
const dto = (r: Row): RiskAssessment => ({ ...r, createdAt: r.createdAt.toISOString() });
type User = Actor & { id: string };

export class RiskAssessments {
  constructor(
    private readonly db: Db,
    private readonly legacy: LegacyStore,
    private readonly environment: Environment,
  ) {}
  private async sources(c?: Client) {
    const data = (await this.legacy.recompose(c))?.data;
    const ai = data?.ai;
    return isObject(ai) && Array.isArray(ai.evals)
      ? ai.evals.filter((e): e is JsonObject => isObject(e) && typeof e.id === 'string')
      : [];
  }
  private async source(id: string, c?: Client) {
    const matches = (await this.sources(c)).filter((e) => e.id === id);
    if (!matches.length)
      throw new HttpError(404, 'Le scénario source a été retiré. Les évaluations passées sont conservées.');
    if (matches.length !== 1)
      throw new HttpError(
        409,
        'Identifiant de scénario ambigu : corrigez les doublons dans le registre avant de réévaluer.',
      );
    return matches[0]!;
  }
  private async latest(id: string, c?: Client) {
    const row = (
      await (c ?? this.db.pool).query<Row>(
        `SELECT ${columns} FROM risk_assessments a JOIN environment_versions v ON v.version=a.configuration_version WHERE a.source_id=$1 ORDER BY a.revision DESC LIMIT 1`,
        [id],
      )
    ).rows[0];
    return row ? dto(row) : null;
  }
  async list(search: string, offset: number) {
    const sources = await this.sources();
    const rows = (
      await this.db.q<{
        sourceId: string;
        id: string;
        revision: number;
        configurationVersion: number;
        result: RiskAssessment['result'];
        createdAt: Date;
        domain: string;
        scenario: string;
      }>(
        `SELECT DISTINCT ON(source_id) source_id AS "sourceId", id, revision, configuration_version AS "configurationVersion", result, created_at AS "createdAt", left(source_snapshot->>'domain',300) AS domain, left(source_snapshot->>'scenario',2000) AS scenario FROM risk_assessments ORDER BY source_id,revision DESC`,
      )
    ).rows;
    const latest = new Map(
        rows.map((r) => [
          r.sourceId,
          {
            id: r.id,
            revision: r.revision,
            configurationVersion: r.configurationVersion,
            result: r.result,
            createdAt: r.createdAt.toISOString(),
            domain: r.domain,
            scenario: r.scenario,
          },
        ]),
      ),
      grouped = new Map<string, JsonObject[]>();
    for (const source of sources) {
      const id = source.id as string;
      grouped.set(id, [...(grouped.get(id) ?? []), source]);
    }
    const ids = [...new Set([...grouped.keys(), ...latest.keys()])].sort();
    const results: AssessmentSource[] = ids
      .map((id) => {
        const matches = grouped.get(id) ?? [];
        const last = latest.get(id);
        const snapshot = matches[0] ?? (last ? { domain: last.domain, scenario: last.scenario } : undefined);
        const lastAssessment = last
          ? {
              id: last.id,
              revision: last.revision,
              configurationVersion: last.configurationVersion,
              result: last.result,
              createdAt: last.createdAt,
            }
          : null;
        return {
          id,
          domain: summary(snapshot, 'domain', 300),
          scenario: summary(snapshot, 'scenario', 2000),
          sourcePresent: matches.length > 0,
          ambiguous: matches.length > 1,
          sourceSha: matches.length === 1 ? sha(matches[0]!) : null,
          revision: lastAssessment?.revision ?? 0,
          lastAssessment,
        };
      })
      .filter((x) =>
        `${x.id} ${x.domain} ${x.scenario}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
      );
    return {
      items: results.slice(offset, offset + 50),
      total: results.length,
      nextOffset: offset + 50 < results.length ? offset + 50 : null,
    };
  }
  async detail(id: string, configurationVersion?: number) {
    let source: JsonObject | null = null,
      ambiguous = false;
    const matches = (await this.sources()).filter((e) => e.id === id);
    if (matches.length === 1) source = matches[0]!;
    else if (matches.length > 1) ambiguous = true;
    const last = await this.latest(id);
    if (!matches.length && !last) throw new HttpError(404, 'Scénario introuvable.');
    const configuration =
      configurationVersion === undefined
        ? await this.environment.current()
        : await this.environment.version(configurationVersion);
    return {
      source,
      sourceSha: source ? sha(source) : null,
      ambiguous,
      revision: last?.revision ?? 0,
      configuration,
      legacy: source ? legacyAiRisk(source) : null,
      lastAssessment: last,
    };
  }
  async configurations() {
    return this.environment.history();
  }
  private fingerprint(id: string, revision: number, intent: AssessmentIntent) {
    return crypto.createHash('sha256').update(JSON.stringify({ id, revision, intent })).digest('hex');
  }
  private async prepare(id: string, intent: AssessmentIntent, c?: Client) {
    const source = await this.source(id, c);
    if (Buffer.byteLength(serialize(source)) > 256 * 1024)
      throw new HttpError(413, 'Le scénario dépasse la taille maximale d’un instantané (256 Ko).');
    if (sha(source) !== intent.sourceSha)
      throw new HttpError(412, 'Le scénario a changé. Rechargez et revalidez la décision.');
    if (legacyAiRisk(source).idx === null)
      throw new HttpError(
        409,
        'Ce scénario est conditionnel. Validez son applicabilité dans le registre avant de réévaluer.',
      );
    const configuration = await this.environment.version(intent.configurationVersion);
    let result;
    try {
      result = calculateRisk(configuration.definition, intent.ratings);
    } catch {
      throw new HttpError(422, 'Les niveaux doivent appartenir à la configuration choisie.');
    }
    return { source, configuration, result };
  }
  async preview(id: string, intent: AssessmentIntent) {
    // Même instantané que les mutations du registre ; aucune décision enregistrée.
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM app_state WHERE id=1 FOR SHARE');
      const prepared = await this.prepare(id, intent, c),
        latest = await this.latest(id, c),
        revision = latest?.revision ?? 0;
      return {
        revision,
        previewId: this.fingerprint(id, revision, intent),
        configuration: prepared.configuration,
        result: prepared.result,
        legacy: legacyAiRisk(prepared.source),
      };
    });
  }
  async publish(id: string, body: AssessmentPublication, expected: number, user: User, ip: string) {
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM app_state WHERE id=1 FOR UPDATE');
      const replay = (
        await c.query<{
          id: string;
          source_id: string;
          user_id: string;
          preview_id: string;
          rationale: string;
          ratings: AssessmentIntent['ratings'];
          configuration_version: number;
          source_sha: string;
        }>(
          'SELECT id,source_id,user_id,preview_id,rationale,ratings,configuration_version,source_sha FROM risk_assessments WHERE request_id=$1',
          [body.requestId],
        )
      ).rows[0];
      if (replay) {
        if (!(
          replay.source_id === id &&
          replay.user_id === user.id &&
          replay.preview_id === body.previewId &&
          replay.rationale === body.rationale &&
          replay.configuration_version === body.intent.configurationVersion &&
          replay.source_sha === body.intent.sourceSha &&
          replay.ratings.impact === body.intent.ratings.impact &&
          replay.ratings.probability === body.intent.ratings.probability &&
          replay.ratings.maturity === body.intent.ratings.maturity
        ))
          throw new HttpError(409, 'Cette demande a déjà été utilisée pour une autre décision.');
        return this.record(replay.id, c);
      }
      const prepared = await this.prepare(id, body.intent, c),
        latest = await this.latest(id, c),
        revision = latest?.revision ?? 0;
      if (expected !== revision)
        throw new HttpError(412, 'Une évaluation a été enregistrée par ailleurs. Rechargez avant de confirmer.');
      if (body.previewId !== this.fingerprint(id, revision, body.intent))
        throw new HttpError(422, 'La décision ne correspond plus à la prévisualisation.');
      const row = (
        await c.query<{ id: string }>(
          `INSERT INTO risk_assessments(request_id,source_id,source_sha,source_snapshot,configuration_version,revision,ratings,result,preview_id,rationale,user_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            body.requestId,
            id,
            body.intent.sourceSha,
            prepared.source,
            body.intent.configurationVersion,
            revision + 1,
            body.intent.ratings,
            prepared.result,
            body.previewId,
            body.rationale,
            user.id,
            user.username,
          ],
        )
      ).rows[0]!;
      await this.db.audit(
        user,
        ip,
        'risk.assessment.created',
        row.id,
        {
          sourceId: id,
          sourceSha: body.intent.sourceSha,
          configurationVersion: body.intent.configurationVersion,
          revision: revision + 1,
        },
        c,
      );
      return this.record(row.id, c);
    }, user.username);
  }
  private async record(id: string, c: Client) {
    const row = (
      await c.query<Row>(
        `SELECT ${columns} FROM risk_assessments a JOIN environment_versions v ON v.version=a.configuration_version WHERE a.id=$1`,
        [id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Évaluation introuvable.');
    return dto(row);
  }
  async history(id: string, before = 2147483647, limit = 25) {
    const rows = (
      await this.db.q<Row>(
        `SELECT ${columns} FROM risk_assessments a JOIN environment_versions v ON v.version=a.configuration_version WHERE a.source_id=$1 AND a.revision<$2 ORDER BY a.revision DESC LIMIT $3`,
        [id, before, limit + 1],
      )
    ).rows;
    if (!rows.length && !(await this.sources()).some((s) => s.id === id) && !(await this.latest(id)))
      throw new HttpError(404, 'Scénario introuvable.');
    const items = rows.slice(0, limit).map(dto);
    return { items, nextBefore: rows.length > limit ? items[items.length - 1]!.revision : null };
  }
  async export(id: string) {
    const page = await this.history(id, 2147483647, 1000);
    if (page.nextBefore !== null)
      throw new HttpError(
        413,
        'L’export complet est limité à 1 000 décisions par scénario. Utilisez la consultation paginée pour les historiques plus longs.',
      );
    return { format: 'suivi-risk-assessments', formatVersion: 1, sourceId: id, assessments: page.items };
  }
}
