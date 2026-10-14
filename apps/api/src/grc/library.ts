/* Bibliothèque de référentiels de l'organisation (ADR 0031, lot M2) : un référentiel est importé une fois, hors périmètre,
   par versions immuables, puis rattaché à une version précise dans chaque périmètre qui l'utilise. Les référentiels publiés
   dans un périmètre (frameworks.ts) restent inchangés ; une promotion explicite, simulée avant application, les copie ici.
   Aucun lien vers une mesure n'est stocké dans la bibliothèque : ces liens sont propres à chaque périmètre. */
import {
  LibraryFrameworkDefinition,
  type FrameworkDefinition,
  type LibraryCopyBody,
  type LibraryRequirementBody,
} from '@suivi/shared';
import { ZodError } from 'zod';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { hash, type Grc } from './core.js';
import { trackerCandidates } from './library-tracker.js';

export interface LibraryFramework {
  id: string;
  identifier: string;
  name: string;
  version: number;
  updatedAt: string;
  source: FrameworkDefinition['source'];
  requirements: number;
  scopes: number;
  /** Version source (importée) : verrouillée, on n'y ajoute rien ; seule une copie se personnalise. */
  locked: boolean;
  derivedFrom: { identifier: string; name: string; version: number } | null;
}
export interface ScopeAttachment {
  frameworkId: string;
  identifier: string;
  name: string;
  version: number;
  latestVersion: number;
  enabled: boolean;
  attachedBy: string;
  attachedAt: string;
}
interface LibraryRow {
  id: string;
  identifier: string;
  name: string;
  version: number;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

export class GrcLibrary {
  constructor(private readonly g: Grc) {}

  async list(user: SessionUser): Promise<LibraryFramework[]> {
    await this.g.permission(user, 'conformite', 'lire');
    return (
      await this.g.db.q<LibraryFramework>(
        `SELECT f.id,f.identifier,f.name,f.version,f.updated_at AS "updatedAt",v.definition->'source' AS source,
                jsonb_array_length(v.definition->'requirements')::int AS requirements,
                (SELECT count(*)::int FROM grc_scope_frameworks s WHERE s.framework_id=f.id) AS scopes,
                NOT (v.definition ? 'derivedFrom') AS locked,v.definition->'derivedFrom' AS "derivedFrom"
           FROM lib_frameworks f JOIN lib_framework_versions v ON v.framework_id=f.id AND v.version=f.version
          ORDER BY f.name,f.id`,
      )
    ).rows;
  }

  async version(id: string, version: number, user: SessionUser, c?: Client) {
    await this.g.permission(user, 'conformite', 'lire');
    const row = (
      await (c ?? this.g.db.pool).query<{ definition: FrameworkDefinition; version: number }>(
        'SELECT definition,version FROM lib_framework_versions WHERE framework_id=$1 AND version=$2',
        [id, version],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Version de la bibliothèque introuvable.');
    return row;
  }

  /** Définition d'une version d'un référentiel rattaché au périmètre, ou null si ce référentiel n'y est pas rattaché. */
  async versionForScope(smsi: string, id: string, version: number, user: SessionUser, c?: Client) {
    const q = c ?? this.g.db.pool;
    if (
      !(await q.query('SELECT 1 FROM grc_scope_frameworks WHERE smsi_id=$1 AND framework_id=$2', [smsi, id])).rowCount
    )
      return null;
    await this.g.access(smsi, user, false, c);
    const row = (
      await q.query<{ definition: FrameworkDefinition; version: number }>(
        'SELECT definition,version FROM lib_framework_versions WHERE framework_id=$1 AND version=$2',
        [id, version],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Version publiée introuvable.');
    return row;
  }

  private async current(id: string, c?: Client, lock = false) {
    return (
      await (c ?? this.g.db.pool).query<LibraryRow>(
        `SELECT id,identifier,name,version FROM lib_frameworks WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }

  async preview(id: string | null, input: unknown, user: SessionUser) {
    await this.g.permission(user, 'conformite', 'modifier');
    const definition = LibraryFrameworkDefinition.parse(input);
    const existing = id ? await this.current(id) : undefined;
    if (id && !existing) throw new HttpError(404, 'Référentiel de la bibliothèque introuvable.');
    if (existing && existing.identifier !== definition.identifier)
      throw new HttpError(422, 'L’identifiant d’un référentiel de la bibliothèque ne change pas entre deux versions.');
    const duplicate =
      !id &&
      (await this.g.db.q('SELECT 1 FROM lib_frameworks WHERE identifier=$1', [definition.identifier])).rowCount! > 0;
    const version = existing?.version ?? 0;
    return {
      definition,
      version,
      previewId: hash({ library: id, version, definition }),
      requirements: definition.requirements.length,
      domains: definition.domains.length,
      duplicate,
      canPublish: !duplicate,
      warning:
        definition.source.status === 'unverified'
          ? 'Source non vérifiée : ne pas présenter ces données comme exigences officielles.'
          : null,
    };
  }

  async publish(
    id: string | null,
    input: unknown,
    expected: number,
    previewId: string,
    reason: string,
    user: SessionUser,
    ip: string,
  ) {
    const p = await this.preview(id, input, user);
    if (p.version !== expected) throw new HttpError(412, 'Version obsolète.');
    if (p.previewId !== previewId) throw new HttpError(422, 'Relancez la simulation.');
    if (!p.canPublish) throw new HttpError(409, 'Un référentiel de la bibliothèque porte déjà cet identifiant.');
    return this.g.db.tx(async (c) => {
      let frameworkId = id;
      let version = 1;
      if (id) {
        const locked = await this.current(id, c, true);
        if (!locked || locked.version !== expected) throw new HttpError(412, 'Le référentiel a changé.');
        version = locked.version + 1;
        await c.query('UPDATE lib_frameworks SET name=$2,version=$3,updated_by=$4,updated_at=now() WHERE id=$1', [
          id,
          p.definition.name,
          version,
          user.username,
        ]);
      } else {
        if ((await c.query('SELECT 1 FROM lib_frameworks WHERE identifier=$1', [p.definition.identifier])).rowCount)
          throw new HttpError(409, 'Un référentiel de la bibliothèque porte déjà cet identifiant.');
        frameworkId = (
          await c.query<{ id: string }>(
            'INSERT INTO lib_frameworks(identifier,name,version,created_by,updated_by) VALUES($1,$2,1,$3,$3) RETURNING id',
            [p.definition.identifier, p.definition.name, user.username],
          )
        ).rows[0]!.id;
      }
      await c.query(
        'INSERT INTO lib_framework_versions(framework_id,version,definition,reason,created_by) VALUES($1,$2,$3,$4,$5)',
        [frameworkId, version, p.definition, reason, user.username],
      );
      await this.g.db.audit(
        user,
        ip,
        'library.framework.published',
        frameworkId!,
        { identifier: p.definition.identifier, version },
        c,
      );
      return { id: frameworkId!, identifier: p.definition.identifier, name: p.definition.name, version };
    }, user.username);
  }

  /** Crée une copie personnalisable d'un référentiel de la bibliothèque (version courante). L'original reste verrouillé. */
  async copy(id: string, body: LibraryCopyBody, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'modifier');
    const row = (
      await this.g.db.q<{ definition: FrameworkDefinition; version: number; name: string }>(
        `SELECT v.definition,f.version,f.name FROM lib_frameworks f
           JOIN lib_framework_versions v ON v.framework_id=f.id AND v.version=f.version WHERE f.id=$1`,
        [id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Référentiel de la bibliothèque introuvable.');
    const base = body.identifier ?? `${row.definition.identifier}-copie`;
    let identifier = base;
    for (
      let n = 2;
      (await this.g.db.q('SELECT 1 FROM lib_frameworks WHERE identifier=$1', [identifier])).rowCount;
      n++
    ) {
      if (body.identifier) throw new HttpError(409, 'Un référentiel de la bibliothèque porte déjà cet identifiant.');
      identifier = `${base}-${n}`;
    }
    const definition: FrameworkDefinition = {
      ...row.definition,
      name: body.name,
      identifier,
      source: {
        ...row.definition.source,
        document: `Copie de l’organisation de « ${row.name} » (version ${row.version})`.slice(0, 300),
        normative: false,
        status: 'organisation',
        verifiedAt: '',
      },
      derivedFrom: row.definition.derivedFrom ?? {
        identifier: row.definition.identifier,
        name: row.name,
        version: row.version,
      },
    };
    const p = await this.preview(null, definition, user);
    return this.publish(
      null,
      definition,
      0,
      p.previewId,
      `Copie personnalisable de « ${row.name} » (version ${row.version}).`,
      user,
      ip,
    );
  }

  /** Ajoute (ou remplace par identifiant) une exigence dans une copie : nouvelle version immuable. Une version source
      est verrouillée : il faut d'abord en créer une copie. */
  async upsertRequirement(id: string, body: LibraryRequirementBody, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'modifier');
    const row = (
      await this.g.db.q<{ definition: FrameworkDefinition; version: number }>(
        `SELECT v.definition,f.version FROM lib_frameworks f
           JOIN lib_framework_versions v ON v.framework_id=f.id AND v.version=f.version WHERE f.id=$1`,
        [id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Référentiel de la bibliothèque introuvable.');
    if (!row.definition.derivedFrom)
      throw new HttpError(422, 'Version source verrouillée : créez une copie pour la personnaliser.');
    if (row.version !== body.expectedVersion) throw new HttpError(412, 'Version obsolète.');
    const domains = [...row.definition.domains];
    let domain = body.domain;
    if (body.newDomainLabel) {
      domain = `domaine_${domains.length + 1}`;
      while (domains.some((d) => d.id === domain)) domain += '_x';
      domains.push({ id: domain, label: body.newDomainLabel });
    }
    const requirement = {
      id: body.id,
      domain: domain!,
      title: body.title,
      description: body.description,
      applicability: body.applicability,
      measureRefs: [],
    };
    const existing = row.definition.requirements.some((r) => r.id === body.id);
    const requirements = existing
      ? row.definition.requirements.map((r) => (r.id === body.id ? requirement : r))
      : [...row.definition.requirements, requirement];
    const definition = { ...row.definition, domains, requirements };
    const p = await this.preview(id, definition, user);
    return this.publish(
      id,
      definition,
      row.version,
      p.previewId,
      `${existing ? 'Modification' : 'Ajout'} de l’exigence ${body.id}.`,
      user,
      ip,
    );
  }

  /** Référentiels présents dans l'outil de suivi, simulés avant toute importation (rien n'est écrit). */
  async trackerPreview(user: SessionUser) {
    await this.g.permission(user, 'conformite', 'modifier');
    const state = await this.g.legacy.recompose();
    const candidates = trackerCandidates((state?.data ?? {}) as Record<string, unknown>);
    return Promise.all(
      candidates.map(async (c) => {
        try {
          return { ...(await this.preview(null, c.definition, user)), notes: c.notes, error: null as string | null };
        } catch (e) {
          // Un référentiel invalide ne masque pas les autres : il est listé, non importable, avec la raison.
          const raison = e instanceof ZodError ? e.issues.map((i) => i.message).join(' ; ') : (e as Error).message;
          return {
            definition: c.definition,
            version: 0,
            previewId: '',
            requirements: c.definition.requirements.length,
            domains: c.definition.domains.length,
            duplicate: false,
            canPublish: false,
            warning: null,
            notes: c.notes,
            error: raison,
          };
        }
      }),
    );
  }

  /** Publie en version 1 un référentiel de l'outil de suivi, après simulation identique (previewId) et confirmation. */
  async trackerImport(identifier: string, previewId: string, user: SessionUser, ip: string) {
    const p = (await this.trackerPreview(user)).find((x) => x.definition.identifier === identifier);
    if (!p) throw new HttpError(404, 'Référentiel introuvable dans l’outil de suivi.');
    if (p.error) throw new HttpError(422, `Référentiel non importable : ${p.error}`);
    return this.publish(
      null,
      p.definition,
      0,
      previewId,
      'Importé depuis l’outil de suivi (simulation confirmée).',
      user,
      ip,
    );
  }

  /** Rend un standard de l'outil de suivi disponible dans la bibliothèque en un geste (version source verrouillée). Déjà
      présent : renvoie l'existant. Un standard non repris (données incomplètes) est refusé avec sa raison, sans alerte. */
  async adoptStandard(identifier: string, user: SessionUser, ip: string) {
    const p = (await this.trackerPreview(user)).find((x) => x.definition.identifier === identifier);
    if (!p) throw new HttpError(404, 'Standard introuvable dans l’outil de suivi.');
    if (p.error) throw new HttpError(422, `Standard non repris : ${p.error}`);
    if (p.duplicate) {
      const existing = (
        await this.g.db.q<{ id: string; name: string; version: number }>(
          'SELECT id,name,version FROM lib_frameworks WHERE identifier=$1',
          [identifier],
        )
      ).rows[0]!;
      return { id: existing.id, identifier, name: existing.name, version: existing.version, created: false };
    }
    return {
      ...(await this.publish(
        null,
        p.definition,
        0,
        p.previewId,
        'Standard repris de l’outil de suivi (version source verrouillée).',
        user,
        ip,
      )),
      created: true,
    };
  }

  async attachments(smsi: string, user: SessionUser): Promise<ScopeAttachment[]> {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    return (
      await this.g.db.q<ScopeAttachment>(
        `SELECT s.framework_id AS "frameworkId",f.identifier,f.name,s.version,f.version AS "latestVersion",s.enabled,
                s.attached_by AS "attachedBy",s.attached_at AS "attachedAt"
           FROM grc_scope_frameworks s JOIN lib_frameworks f ON f.id=s.framework_id
          WHERE s.smsi_id=$1 ORDER BY f.name,f.id`,
        [smsi],
      )
    ).rows;
  }

  /** Rattache (ou change la version rattachée de) un référentiel de la bibliothèque à un périmètre. */
  async attach(smsi: string, id: string, version: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.version(id, version, user);
    await this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      await this.g.access(smsi, user, true, c);
      const previous = (
        await c.query<{ version: number }>(
          'SELECT version FROM grc_scope_frameworks WHERE smsi_id=$1 AND framework_id=$2',
          [smsi, id],
        )
      ).rows[0];
      await c.query(
        `INSERT INTO grc_scope_frameworks(smsi_id,framework_id,version,attached_by) VALUES($1,$2,$3,$4)
         ON CONFLICT(smsi_id,framework_id) DO UPDATE SET version=$3,attached_by=$4,attached_at=now()`,
        [smsi, id, version, user.username],
      );
      await this.g.db.audit(
        user,
        ip,
        'library.framework.attached',
        smsi,
        { frameworkId: id, version, previousVersion: previous?.version ?? null },
        c,
      );
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.rapprochements.sync(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  /** Active ou désactive un référentiel rattaché, sans le détacher. */
  async setEnabled(smsi: string, id: string, enabled: boolean, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.g.db.tx(async (c) => {
      const r = await c.query('UPDATE grc_scope_frameworks SET enabled=$3 WHERE smsi_id=$1 AND framework_id=$2', [
        smsi,
        id,
        enabled,
      ]);
      if (!r.rowCount) throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
      await this.g.db.audit(user, ip, 'library.framework.enabled', smsi, { frameworkId: id, enabled }, c);
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.rapprochements.sync(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  /** Détache un référentiel : refusé tant qu'un objet ou un lien du périmètre référence ses exigences. */
  async detach(smsi: string, id: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      if (
        !(await c.query('SELECT 1 FROM grc_scope_frameworks WHERE smsi_id=$1 AND framework_id=$2', [smsi, id])).rowCount
      )
        throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
      const ref = `%requirement:${escapeLike(id)}:%`;
      const links = (
        await c.query<{ n: number }>(
          'SELECT count(*)::int AS n FROM grc_links WHERE smsi_id=$1 AND (target_ref LIKE $2 OR source_ref LIKE $2)',
          [smsi, ref],
        )
      ).rows[0]!.n;
      const objects = (
        await c.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM grc_objects WHERE smsi_id=$1 AND NOT archived AND (data::text LIKE $2 OR data::text LIKE $3)`,
          [smsi, ref, `%"frameworkId":"${escapeLike(id)}"%`],
        )
      ).rows[0]!.n;
      if (links + objects)
        throw new HttpError(
          409,
          `Ce référentiel est utilisé dans le périmètre (${links} lien(s), ${objects} objet(s)) : retirez d’abord ces références.`,
        );
      await c.query('DELETE FROM grc_scope_frameworks WHERE smsi_id=$1 AND framework_id=$2', [smsi, id]);
      await this.g.db.audit(user, ip, 'library.framework.detached', smsi, { frameworkId: id }, c);
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.rapprochements.sync(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  /** Simulation de la promotion d'un référentiel publié dans un périmètre : rien n'est écrit. */
  async promotionPreview(smsi: string, id: string, user: SessionUser, c?: Client) {
    await this.g.permission(user, 'conformite', 'modifier');
    const o = await this.g.object(smsi, id, user, false, c);
    if (o.kind !== 'framework') throw new HttpError(422, 'Référentiel attendu.');
    const row = (
      await (c ?? this.g.db.pool).query<{ definition: FrameworkDefinition }>(
        'SELECT definition FROM grc_framework_versions WHERE framework_id=$1 AND version=$2 AND smsi_id=$3',
        [id, o.version, smsi],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Version publiée introuvable.');
    const droppedMeasureRefs = row.definition.requirements.reduce((n, r) => n + r.measureRefs.length, 0);
    const definition = LibraryFrameworkDefinition.parse({
      ...row.definition,
      requirements: row.definition.requirements.map((r) => ({ ...r, measureRefs: [] })),
    });
    const q = c ?? this.g.db.pool;
    const alreadyPromoted =
      (
        await q.query('SELECT 1 FROM lib_framework_promotions WHERE source_framework_id=$1 AND source_version=$2', [
          id,
          o.version,
        ])
      ).rowCount! > 0;
    const inLibrary = (
      await q.query<{ id: string; version: number; definition: FrameworkDefinition }>(
        `SELECT f.id,f.version,v.definition FROM lib_frameworks f JOIN lib_framework_versions v ON v.framework_id=f.id AND v.version=f.version WHERE f.identifier=$1`,
        [definition.identifier],
      )
    ).rows[0];
    return {
      sourceVersion: o.version,
      definition,
      requirements: definition.requirements.length,
      droppedMeasureRefs,
      alreadyPromoted,
      libraryFrameworkId: inLibrary?.id ?? null,
      identicalToLibrary: inLibrary ? hash(inLibrary.definition) === hash(definition) : false,
      canPromote: !alreadyPromoted && !inLibrary,
      previewId: hash({ smsi, id, version: o.version, definition }),
    };
  }

  /** Copie une version publiée dans la bibliothèque, la rattache au périmètre d'origine et consigne l'alias. */
  async promote(smsi: string, id: string, previewId: string, user: SessionUser, ip: string) {
    const p = await this.promotionPreview(smsi, id, user);
    if (p.previewId !== previewId) throw new HttpError(409, 'Simulation obsolète : relancez-la.');
    if (!p.canPromote)
      throw new HttpError(
        409,
        p.alreadyPromoted
          ? 'Cette version est déjà dans la bibliothèque.'
          : 'Un référentiel de la bibliothèque porte déjà cet identifiant : rattachez-le au périmètre.',
      );
    await this.g.permission(user, 'pilotage', 'administrer');
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      const again = await this.promotionPreview(smsi, id, user, c);
      if (again.previewId !== previewId || !again.canPromote)
        throw new HttpError(409, 'Simulation obsolète : relancez-la.');
      const o = await this.g.object(smsi, id, user, true, c);
      const libraryId = (
        await c.query<{ id: string }>(
          'INSERT INTO lib_frameworks(identifier,name,version,created_by,updated_by) VALUES($1,$2,1,$3,$3) RETURNING id',
          [again.definition.identifier, again.definition.name, user.username],
        )
      ).rows[0]!.id;
      await c.query(
        'INSERT INTO lib_framework_versions(framework_id,version,definition,reason,created_by) VALUES($1,1,$2,$3,$4)',
        [
          libraryId,
          again.definition,
          `Promu depuis le périmètre « ${(await this.g.access(smsi, user, false, c)).name} » (version ${again.sourceVersion})`,
          user.username,
        ],
      );
      await c.query(
        'INSERT INTO lib_framework_promotions(source_framework_id,source_version,smsi_id,library_framework_id,library_version,promoted_by) VALUES($1,$2,$3,$4,1,$5)',
        [id, again.sourceVersion, smsi, libraryId, user.username],
      );
      await c.query(
        'INSERT INTO grc_scope_frameworks(smsi_id,framework_id,version,enabled,attached_by) VALUES($1,$2,1,$3,$4)',
        [smsi, libraryId, o.data.enabled !== false, user.username],
      );
      await this.g.db.audit(
        user,
        ip,
        'library.framework.promoted',
        libraryId,
        {
          smsi,
          sourceFrameworkId: id,
          sourceVersion: again.sourceVersion,
          droppedMeasureRefs: again.droppedMeasureRefs,
        },
        c,
      );
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.rapprochements.sync(smsi, c);
      return { libraryFrameworkId: libraryId, version: 1, droppedMeasureRefs: again.droppedMeasureRefs };
    }, user.username);
  }
}
