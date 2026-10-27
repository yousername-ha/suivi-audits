/* Correspondances organisationnelles entre exigences de la bibliothèque (ADR 0031, lot M3) : proposées, puis validées une
   seule fois pour toute l'organisation par une décision humaine (`conformite:administrer`). Une correspondance validée
   n'est plus modifiable : on la retire et on en propose une autre. Chaque changement laisse un instantané immuable. */
import { LibraryMappingBody, type FrameworkDefinition } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { sql, type UpdateObject } from 'kysely';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import type { DB } from '../db/types.generated.js';
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
type Extremite = LibraryMapping['source'];
/** Correspondance telle que la renvoie l'API : extrémités regroupées (jsonb_build_object, fragments fixes). */
const correspondances = (k: Kdb) =>
  k
    .selectFrom('lib_mappings')
    .select([
      'id',
      sql<Extremite>`jsonb_build_object('frameworkId', source_framework_id, 'version', source_version, 'requirementId', source_requirement_id)`.as(
        'source',
      ),
      sql<Extremite>`jsonb_build_object('frameworkId', target_framework_id, 'version', target_version, 'requirementId', target_requirement_id)`.as(
        'target',
      ),
      'type',
      'justification',
      'coverage',
      'origin',
      'status',
      'source_url as sourceUrl',
      'review_note as reviewNote',
      'version',
      'created_by as createdBy',
      'created_at as createdAt',
      'updated_by as updatedBy',
      'updated_at as updatedAt',
      'validated_by as validatedBy',
      'validated_at as validatedAt',
    ]);
/** Dates relues telles quelles (sérialisées en ISO), comme avant la conversion. */
const versCorrespondance = (r: unknown) => r as LibraryMapping;
/** Colonnes des deux extrémités d'une correspondance. */
const extremites = (b: LibraryMappingBody) => ({
  source_framework_id: b.source.frameworkId,
  source_version: b.source.version,
  source_requirement_id: b.source.requirementId,
  target_framework_id: b.target.frameworkId,
  target_version: b.target.version,
  target_requirement_id: b.target.requirementId,
});

export class GrcLibraryMappings {
  constructor(private readonly g: Grc) {}
  private k(c?: Client): Kdb {
    return c ? surConnexion(c) : this.g.db.k;
  }

  async list(user: SessionUser, filter: { frameworkId?: string; status?: string } = {}): Promise<LibraryMapping[]> {
    await this.g.permission(user, 'conformite', 'lire');
    return (
      await correspondances(this.g.db.k)
        .$if(filter.frameworkId != null, (q) =>
          q.where((eb) =>
            eb.or([
              eb('source_framework_id', '=', filter.frameworkId!),
              eb('target_framework_id', '=', filter.frameworkId!),
            ]),
          ),
        )
        .$if(filter.status != null, (q) => q.where('status', '=', filter.status as LibraryMapping['status']))
        .orderBy('updated_at', 'desc')
        .orderBy('id')
        .limit(500)
        .execute()
    ).map(versCorrespondance);
  }

  private async row(id: string, c?: Client, lock = false) {
    const r = await correspondances(this.k(c))
      .where('id', '=', id)
      .$if(lock, (q) => q.forUpdate())
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Correspondance introuvable.');
    return versCorrespondance(r);
  }

  /** Les deux extrémités doivent exister dans des versions publiées de la bibliothèque. */
  private async checkEnds(body: LibraryMappingBody, c: Client) {
    for (const end of [body.source, body.target]) {
      const v = await surConnexion(c)
        .selectFrom('lib_framework_versions')
        .select('definition')
        .where('framework_id', '=', end.frameworkId)
        .where('version', '=', end.version)
        .executeTakeFirst();
      if (!v) throw new HttpError(404, 'Version de la bibliothèque introuvable.');
      if (!(v.definition as FrameworkDefinition).requirements.some((r) => r.id === end.requirementId))
        throw new HttpError(422, `Exigence « ${end.requirementId} » absente de cette version publiée.`);
    }
    if (JSON.stringify(body.source) === JSON.stringify(body.target))
      throw new HttpError(422, 'Deux exigences distinctes sont requises.');
  }

  private async history(c: Client, m: LibraryMapping, reason: string, user: SessionUser) {
    await surConnexion(c)
      .insertInto('lib_mapping_history')
      .values({ mapping_id: m.id, version: m.version, snapshot: JSON.stringify(m), reason, created_by: user.username })
      .execute();
  }

  async create(input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'modifier');
    const body = LibraryMappingBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      await this.checkEnds(body, c);
      const ext = extremites(body);
      const dup = await k
        .selectFrom('lib_mappings')
        .select('id')
        .where('status', '<>', 'withdrawn')
        .where('source_framework_id', '=', ext.source_framework_id)
        .where('source_version', '=', ext.source_version)
        .where('source_requirement_id', '=', ext.source_requirement_id)
        .where('target_framework_id', '=', ext.target_framework_id)
        .where('target_version', '=', ext.target_version)
        .where('target_requirement_id', '=', ext.target_requirement_id)
        .executeTakeFirst();
      if (dup) throw new HttpError(409, 'Une correspondance existe déjà entre ces deux exigences.');
      const { id } = await k
        .insertInto('lib_mappings')
        .values({
          ...ext,
          type: body.type,
          justification: body.justification,
          coverage: body.coverage,
          origin: body.origin,
          status: 'proposed',
          source_url: body.sourceUrl,
          created_by: user.username,
          updated_by: user.username,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const m = await this.row(id, c);
      await this.history(c, m, 'Correspondance proposée', user);
      await this.g.db.audit(user, ip, 'library.mapping.created', id, { type: body.type, origin: body.origin }, c);
      return m;
    }, user.username);
  }

  async update(id: string, input: unknown, expected: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'modifier');
    const body = LibraryMappingBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      const current = await this.row(id, c, true);
      if (current.version !== expected) throw new HttpError(412, 'La correspondance a changé.');
      if (current.status !== 'proposed')
        throw new HttpError(409, 'Seule une correspondance proposée se modifie : retirez-la et proposez-en une autre.');
      await this.checkEnds(body, c);
      await this.ecrire(k, id, user.username, {
        ...extremites(body),
        type: body.type,
        justification: body.justification,
        coverage: body.coverage,
        origin: body.origin,
        source_url: body.sourceUrl,
      });
      const m = await this.row(id, c);
      await this.history(c, m, 'Correspondance modifiée', user);
      await this.g.db.audit(user, ip, 'library.mapping.updated', id, { version: m.version }, c);
      return m;
    }, user.username);
  }

  /** Nouvelle version d'une correspondance (champs donnés, version, auteur et date). */
  private async ecrire(
    k: Kdb,
    id: string,
    auteur: string,
    champs: Omit<UpdateObject<DB, 'lib_mappings'>, 'version' | 'updated_by' | 'updated_at'>,
  ) {
    await k
      .updateTable('lib_mappings')
      .set((eb) => ({ ...champs, version: eb('version', '+', 1), updated_by: auteur, updated_at: sql<Date>`now()` }))
      .where('id', '=', id)
      .execute();
  }
  /** Décision humaine : la correspondance devient utilisable pour proposer des rapprochements dans les périmètres. */
  async validate(id: string, expected: number, note: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'administrer');
    const m = await this.g.db.tx(async (c, k) => {
      const current = await this.row(id, c, true);
      if (current.version !== expected) throw new HttpError(412, 'La correspondance a changé.');
      if (current.status !== 'proposed') throw new HttpError(409, 'Seule une correspondance proposée se valide.');
      await this.ecrire(k, id, user.username, {
        status: 'validated',
        review_note: note,
        validated_by: user.username,
        validated_at: sql<Date>`now()`,
      });
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
    const m = await this.g.db.tx(async (c, k) => {
      const current = await this.row(id, c, true);
      if (current.version !== expected) throw new HttpError(412, 'La correspondance a changé.');
      if (current.status === 'withdrawn') throw new HttpError(409, 'Correspondance déjà retirée.');
      await this.ecrire(k, id, user.username, { status: 'withdrawn', review_note: note });
      const m = await this.row(id, c);
      await this.history(c, m, 'Retrait : ' + note, user);
      await this.g.db.audit(user, ip, 'library.mapping.withdrawn', id, { version: m.version }, c);
      return m;
    }, user.username);
    await this.g.rapprochements.syncFrameworks([m.source.frameworkId, m.target.frameworkId]);
    return m;
  }
}
