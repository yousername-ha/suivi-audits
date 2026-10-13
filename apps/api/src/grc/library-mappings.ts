/* Correspondances organisationnelles entre exigences de la bibliothèque (ADR 0031, lot M3) : proposées, puis validées une
   seule fois pour toute l'organisation par une décision humaine (`conformite:administrer`). Une correspondance validée
   n'est plus modifiable : on la retire et on en propose une autre. Chaque changement laisse un instantané immuable. */
import { LibraryMappingBody, type FrameworkDefinition } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

export interface LibraryMapping {
  id: string;
  source: { frameworkId: string; version: number; requirementId: string };
  target: { frameworkId: string; version: number; requirementId: string };
  type: string;
  justification: string;
  coverage: number;
  origin: string;
  status: 'proposed' | 'validated' | 'withdrawn';
  sourceUrl: string;
  reviewNote: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  validatedBy: string | null;
  validatedAt: string | null;
}
const COLUMNS = `id,
  jsonb_build_object('frameworkId',source_framework_id,'version',source_version,'requirementId',source_requirement_id) AS source,
  jsonb_build_object('frameworkId',target_framework_id,'version',target_version,'requirementId',target_requirement_id) AS target,
  type,justification,coverage,origin,status,source_url AS "sourceUrl",review_note AS "reviewNote",version,
  created_by AS "createdBy",created_at AS "createdAt",updated_by AS "updatedBy",updated_at AS "updatedAt",
  validated_by AS "validatedBy",validated_at AS "validatedAt"`;

export class GrcLibraryMappings {
  constructor(private readonly g: Grc) {}

  async list(user: SessionUser, filter: { frameworkId?: string; status?: string } = {}): Promise<LibraryMapping[]> {
    await this.g.permission(user, 'conformite', 'lire');
    return (
      await this.g.db.q<LibraryMapping>(
        `SELECT ${COLUMNS} FROM lib_mappings
          WHERE ($1::uuid IS NULL OR source_framework_id=$1 OR target_framework_id=$1) AND ($2::text IS NULL OR status=$2)
          ORDER BY updated_at DESC,id LIMIT 500`,
        [filter.frameworkId ?? null, filter.status ?? null],
      )
    ).rows;
  }

  private async row(id: string, c?: Client, lock = false) {
    const r = (
      await (c ?? this.g.db.pool).query<LibraryMapping>(
        `SELECT ${COLUMNS} FROM lib_mappings WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
    if (!r) throw new HttpError(404, 'Correspondance introuvable.');
    return r;
  }

  /** Les deux extrémités doivent exister dans des versions publiées de la bibliothèque. */
  private async checkEnds(body: LibraryMappingBody, c: Client) {
    for (const end of [body.source, body.target]) {
      const v = (
        await c.query<{ definition: FrameworkDefinition }>(
          'SELECT definition FROM lib_framework_versions WHERE framework_id=$1 AND version=$2',
          [end.frameworkId, end.version],
        )
      ).rows[0];
      if (!v) throw new HttpError(404, 'Version de la bibliothèque introuvable.');
      if (!v.definition.requirements.some((r) => r.id === end.requirementId))
        throw new HttpError(422, `Exigence « ${end.requirementId} » absente de cette version publiée.`);
    }
    if (JSON.stringify(body.source) === JSON.stringify(body.target))
      throw new HttpError(422, 'Deux exigences distinctes sont requises.');
  }

  private async history(c: Client, m: LibraryMapping, reason: string, user: SessionUser) {
    await c.query(
      'INSERT INTO lib_mapping_history(mapping_id,version,snapshot,reason,created_by) VALUES($1,$2,$3,$4,$5)',
      [m.id, m.version, m, reason, user.username],
    );
  }

  async create(input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'modifier');
    const body = LibraryMappingBody.parse(input);
    return this.g.db.tx(async (c) => {
      await this.checkEnds(body, c);
      const dup = await c.query(
        `SELECT 1 FROM lib_mappings WHERE status<>'withdrawn' AND source_framework_id=$1 AND source_version=$2 AND source_requirement_id=$3
           AND target_framework_id=$4 AND target_version=$5 AND target_requirement_id=$6`,
        [
          body.source.frameworkId,
          body.source.version,
          body.source.requirementId,
          body.target.frameworkId,
          body.target.version,
          body.target.requirementId,
        ],
      );
      if (dup.rowCount) throw new HttpError(409, 'Une correspondance existe déjà entre ces deux exigences.');
      const id = (
        await c.query<{ id: string }>(
          `INSERT INTO lib_mappings(source_framework_id,source_version,source_requirement_id,target_framework_id,target_version,
             target_requirement_id,type,justification,coverage,origin,status,source_url,created_by,updated_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed',$11,$12,$12) RETURNING id`,
          [
            body.source.frameworkId,
            body.source.version,
            body.source.requirementId,
            body.target.frameworkId,
            body.target.version,
            body.target.requirementId,
            body.type,
            body.justification,
            body.coverage,
            body.origin,
            body.sourceUrl,
            user.username,
          ],
        )
      ).rows[0]!.id;
      const m = await this.row(id, c);
      await this.history(c, m, 'Correspondance proposée', user);
      await this.g.db.audit(user, ip, 'library.mapping.created', id, { type: body.type, origin: body.origin }, c);
      return m;
    }, user.username);
  }

  async update(id: string, input: unknown, expected: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'modifier');
    const body = LibraryMappingBody.parse(input);
    return this.g.db.tx(async (c) => {
      const current = await this.row(id, c, true);
      if (current.version !== expected) throw new HttpError(412, 'La correspondance a changé.');
      if (current.status !== 'proposed')
        throw new HttpError(409, 'Seule une correspondance proposée se modifie : retirez-la et proposez-en une autre.');
      await this.checkEnds(body, c);
      await c.query(
        `UPDATE lib_mappings SET source_framework_id=$2,source_version=$3,source_requirement_id=$4,target_framework_id=$5,
           target_version=$6,target_requirement_id=$7,type=$8,justification=$9,coverage=$10,origin=$11,source_url=$12,
           version=version+1,updated_by=$13,updated_at=now() WHERE id=$1`,
        [
          id,
          body.source.frameworkId,
          body.source.version,
          body.source.requirementId,
          body.target.frameworkId,
          body.target.version,
          body.target.requirementId,
          body.type,
          body.justification,
          body.coverage,
          body.origin,
          body.sourceUrl,
          user.username,
        ],
      );
      const m = await this.row(id, c);
      await this.history(c, m, 'Correspondance modifiée', user);
      await this.g.db.audit(user, ip, 'library.mapping.updated', id, { version: m.version }, c);
      return m;
    }, user.username);
  }

  /** Décision humaine : la correspondance devient utilisable pour proposer des rapprochements dans les périmètres. */
  async validate(id: string, expected: number, note: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'administrer');
    const m = await this.g.db.tx(async (c) => {
      const current = await this.row(id, c, true);
      if (current.version !== expected) throw new HttpError(412, 'La correspondance a changé.');
      if (current.status !== 'proposed') throw new HttpError(409, 'Seule une correspondance proposée se valide.');
      await c.query(
        `UPDATE lib_mappings SET status='validated',review_note=$2,validated_by=$3,validated_at=now(),version=version+1,
           updated_by=$3,updated_at=now() WHERE id=$1`,
        [id, note, user.username],
      );
      const m = await this.row(id, c);
      await this.history(c, m, 'Validation humaine : ' + note, user);
      await this.g.db.audit(user, ip, 'library.mapping.validated', id, { version: m.version }, c);
      return m;
    }, user.username);
    await this.g.rapprochements.syncFrameworks([m.source.frameworkId, m.target.frameworkId]);
    return m;
  }

  /** Retire une correspondance : les propositions encore en attente qui en dépendent sont retirées ; les décisions déjà
      prises (liens explicites confirmés, rejets) restent. */
  async withdraw(id: string, expected: number, note: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'administrer');
    const m = await this.g.db.tx(async (c) => {
      const current = await this.row(id, c, true);
      if (current.version !== expected) throw new HttpError(412, 'La correspondance a changé.');
      if (current.status === 'withdrawn') throw new HttpError(409, 'Correspondance déjà retirée.');
      await c.query(
        `UPDATE lib_mappings SET status='withdrawn',review_note=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1`,
        [id, note, user.username],
      );
      const m = await this.row(id, c);
      await this.history(c, m, 'Retrait : ' + note, user);
      await this.g.db.audit(user, ip, 'library.mapping.withdrawn', id, { version: m.version }, c);
      return m;
    }, user.username);
    await this.g.rapprochements.syncFrameworks([m.source.frameworkId, m.target.frameworkId]);
    return m;
  }
}
