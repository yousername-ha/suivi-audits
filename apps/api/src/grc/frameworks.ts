import { FrameworkDefinition, FrameworkImport, MappingData, type GrcObject } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { sql } from 'kysely';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { hash, type Grc } from './core.js';

/** Référentiel actif du périmètre portant cet identifiant (chemin jsonb fixe). */
const memeIdentifiant = (k: Kdb, smsi: string, identifiant: string) =>
  k
    .selectFrom('grc_objects')
    .select('id')
    .where('smsi_id', '=', smsi)
    .where('kind', '=', 'framework')
    .where('archived', '=', false)
    .where(sql<string>`data->'definition'->>'identifier'`, '=', identifiant)
    .executeTakeFirst();

/** Version publiée (immuable) d'un référentiel du périmètre. */
const publierVersion = (
  k: Kdb,
  frameworkId: string,
  smsi: string,
  version: number,
  definition: FrameworkDefinition,
  reason: string,
  auteur: string,
) =>
  k
    .insertInto('grc_framework_versions')
    .values({
      framework_id: frameworkId,
      smsi_id: smsi,
      version,
      definition: JSON.stringify(definition),
      reason,
      created_by: auteur,
    })
    .execute();

export class GrcFrameworks {
  constructor(private readonly g: Grc) {}
  async version(smsi: string, id: string, version: number, user: SessionUser, c?: Client) {
    // Un référentiel de la bibliothèque rattaché au périmètre se résout comme un référentiel publié dans le périmètre.
    const attached = await this.g.library.versionForScope(smsi, id, version, user, c);
    if (attached) return attached;
    const object = await this.g.object(smsi, id, user, false, c);
    if (object.kind !== 'framework') throw new HttpError(422, 'Référentiel attendu.');
    const row = await (c ? surConnexion(c) : this.g.db.k)
      .selectFrom('grc_framework_versions')
      .select(['definition', 'version'])
      .where('framework_id', '=', id)
      .where('version', '=', version)
      .where('smsi_id', '=', smsi)
      .executeTakeFirst();
    if (!row) throw new HttpError(404, 'Version publiée introuvable.');
    return row as { definition: FrameworkDefinition; version: number };
  }
  async validateMapping(smsi: string, input: unknown, user: SessionUser, c?: Client) {
    const d = MappingData.parse(input);
    for (const endpoint of [d.source, d.target]) {
      const f = await this.version(smsi, endpoint.frameworkId, endpoint.version, user, c);
      if (!f.definition.requirements.some((r) => r.id === endpoint.requirementId))
        throw new HttpError(422, 'Exigence absente de cette version publiée.');
    }
    if (JSON.stringify(d.source) === JSON.stringify(d.target))
      throw new HttpError(422, 'Deux exigences distinctes sont requises.');
  }
  async preview(smsi: string, id: string | null, input: unknown, user: SessionUser) {
    await this.g.access(smsi, user, true);
    await this.g.permission(user, 'conformite', 'modifier');
    const definition = FrameworkDefinition.parse(input);
    const current = id ? await this.g.object(smsi, id, user) : null;
    if (current && current.kind !== 'framework') throw new HttpError(422, 'Référentiel attendu.');
    const version = current?.version ?? 0;
    for (const r of definition.requirements) for (const ref of r.measureRefs) await this.g.resolve(smsi, ref, user);
    return {
      definition,
      version,
      previewId: hash({ smsi, id, version, definition }),
      requirements: definition.requirements.length,
      domains: definition.domains.length,
      warning:
        definition.source.status === 'unverified'
          ? 'Source non vérifiée : ne pas présenter ces données comme exigences officielles.'
          : null,
    };
  }
  async publish(
    smsi: string,
    id: string | null,
    input: unknown,
    expected: number,
    previewId: string,
    reason: string,
    user: SessionUser,
    ip: string,
  ) {
    const p = await this.preview(smsi, id, input, user);
    if (p.version !== expected) throw new HttpError(412, 'Version obsolète.');
    if (p.previewId !== previewId) throw new HttpError(422, 'Relancez la simulation.');
    return this.g.db.tx(async (c, k) => {
      await this.g.access(smsi, user, true, c);
      let o: GrcObject;
      if (id) {
        const current = await this.g.raw(id, c, true);
        if (!current || current.version !== expected) throw new HttpError(412, 'Le référentiel a changé.');
        o = await this.g.write(
          c,
          current,
          p.definition.name,
          { definition: p.definition, enabled: current.data.enabled === true },
          user,
          ip,
          reason,
        );
      } else
        o = await this.g.insert(
          c,
          smsi,
          'framework',
          p.definition.name,
          { definition: p.definition, enabled: true },
          user,
          ip,
        );
      await publierVersion(k, o.id, smsi, o.version, p.definition, reason, user.username);
      // Les exigences sont des projections de la publication, jamais un second formulaire modifiable.
      return o;
    }, user.username);
  }
  async requirements(smsi: string, id: string, version: number, user: SessionUser) {
    return (await this.version(smsi, id, version, user)).definition.requirements;
  }
  async activate(smsi: string, id: string, enabled: boolean, expected: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'modifier');
    return this.g.db.tx(async (c) => {
      const o = await this.g.object(smsi, id, user, true, c);
      const locked = await this.g.raw(id, c, true);
      if (!locked || locked.version !== expected) throw new HttpError(412, 'Version obsolète.');
      if (o.kind !== 'framework') throw new HttpError(422, 'Référentiel attendu.');
      return this.g.write(c, locked, locked.name, { ...locked.data, enabled }, user, ip, 'Activation du référentiel');
    }, user.username);
  }
  async validate(smsi: string, id: string, expected: number, note: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'administrer');
    return this.g.db.tx(async (c) => {
      await this.g.object(smsi, id, user, true, c);
      const o = await this.g.raw(id, c, true);
      if (!o || o.version !== expected) throw new HttpError(412, 'Version obsolète.');
      if (o.kind !== 'mapping' || o.archived) throw new HttpError(422, 'Correspondance active attendue.');
      await this.validateMapping(smsi, o.data, user, c);
      return this.g.write(
        c,
        o,
        o.name,
        {
          ...o.data,
          status: 'validated',
          reviewNote: note,
          validatedBy: user.username,
          validatedAt: new Date().toISOString(),
        },
        user,
        ip,
        'Validation humaine de la correspondance',
      );
    }, user.username);
  }
  async importPreview(smsi: string, input: unknown, user: SessionUser) {
    await this.g.permission(user, 'import_export', 'modifier');
    const d = FrameworkImport.parse(input);
    const p = await this.preview(smsi, null, d.definition, user);
    for (const mapping of d.mappings) {
      if (mapping.status === 'validated')
        throw new HttpError(422, 'Une importation ne valide pas les correspondances.');
      await this.validateMapping(smsi, mapping, user);
    }
    const duplicate = !!(await memeIdentifiant(this.g.db.k, smsi, d.definition.identifier));
    return {
      ...p,
      previewId: hash({ smsi, import: d }),
      duplicate,
      mappings: d.mappings.length,
      canImport: !duplicate,
    };
  }
  async import(smsi: string, input: unknown, previewId: string, user: SessionUser, ip: string) {
    const d = FrameworkImport.parse(input),
      p = await this.importPreview(smsi, d, user);
    if (p.previewId !== previewId || !p.canImport)
      throw new HttpError(409, 'Simulation obsolète ou référentiel déjà présent.');
    await this.g.permission(user, 'conformite', 'modifier');
    return this.g.db.tx(async (c, k) => {
      await k.selectFrom('grc_smsis').select('id').where('id', '=', smsi).forUpdate().execute();
      await this.g.access(smsi, user, true, c);
      if (await memeIdentifiant(k, smsi, d.definition.identifier))
        throw new HttpError(409, 'Référentiel déjà importé.');
      const o = await this.g.insert(
        c,
        smsi,
        'framework',
        d.definition.name,
        { definition: d.definition, enabled: true },
        user,
        ip,
      );
      await publierVersion(k, o.id, smsi, 1, d.definition, 'Importation simulée et confirmée', user.username);
      for (const mapping of d.mappings)
        await this.g.insert(c, smsi, 'mapping', 'Correspondance importée', mapping, user, ip);
      return o;
    }, user.username);
  }
}
