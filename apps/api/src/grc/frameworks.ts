import { FrameworkDefinition, FrameworkImport, MappingData, type GrcObject } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { hash, type Grc } from './core.js';

export class GrcFrameworks {
  constructor(private readonly g: Grc) {}
  async version(smsi: string, id: string, version: number, user: SessionUser, c?: Client) {
    const object = await this.g.object(smsi, id, user, false, c);
    if (object.kind !== 'framework') throw new HttpError(422, 'Référentiel attendu.');
    const row = (
      await (c ?? this.g.db.pool).query<{ definition: FrameworkDefinition; version: number }>(
        `SELECT definition,version FROM grc_framework_versions WHERE framework_id=$1 AND version=$2 AND smsi_id=$3`,
        [id, version, smsi],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Version publiée introuvable.');
    return row;
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
    return this.g.db.tx(async (c) => {
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
      await c.query(
        'INSERT INTO grc_framework_versions(framework_id,smsi_id,version,definition,reason,created_by) VALUES($1,$2,$3,$4,$5,$6)',
        [o.id, smsi, o.version, p.definition, reason, user.username],
      );
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
    const duplicate =
      (
        await this.g.db.q(
          `SELECT id FROM grc_objects WHERE smsi_id=$1 AND kind='framework' AND NOT archived AND data->'definition'->>'identifier'=$2`,
          [smsi, d.definition.identifier],
        )
      ).rowCount! > 0;
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
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      await this.g.access(smsi, user, true, c);
      if (
        (
          await c.query(
            `SELECT id FROM grc_objects WHERE smsi_id=$1 AND kind='framework' AND NOT archived AND data->'definition'->>'identifier'=$2`,
            [smsi, d.definition.identifier],
          )
        ).rowCount
      )
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
      await c.query(
        'INSERT INTO grc_framework_versions(framework_id,smsi_id,version,definition,reason,created_by) VALUES($1,$2,1,$3,$4,$5)',
        [o.id, smsi, d.definition, 'Importation simulée et confirmée', user.username],
      );
      for (const mapping of d.mappings)
        await this.g.insert(c, smsi, 'mapping', 'Correspondance importée', mapping, user, ip);
      return o;
    }, user.username);
  }
}
