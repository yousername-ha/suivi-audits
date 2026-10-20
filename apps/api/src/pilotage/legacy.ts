import { GRC_MODULES, type GrcObject } from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { DEFAULT_SMSI, hash, type Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';

const LEGACY_PILOTAGE = {
  scope: {
    kind: 'context',
    name: 'organisation',
    fields: {
      scope: 'text',
      organisation: 'org',
      interfaces: 'interfaces',
      issues: 'issues',
      exclusions: 'exclusions',
    },
  },
  interested: {
    kind: 'stakeholder',
    name: 'name',
    fields: {
      expectations: 'needs',
      requirements: 'req',
      contact: 'contact',
      nature: 'type',
      category: 'cat',
      addressed: 'addressed',
      treatment: 'how',
      reviewedAt: 'reviewed',
    },
  },
  swots: { kind: 'swot', name: 'name', fields: { strengths: 'S', weaknesses: 'W', opportunities: 'O', threats: 'T' } },
  roles: {
    kind: 'governance',
    name: 'name',
    fields: { role: 'role', responsibilities: 'resp', resources: 'resources', commitment: 'commitment' },
  },
  processes: { kind: 'process', name: 'name', fields: { mission: 'purpose', entity: 'entity', scope: 'scope' } },
  objectives: { kind: 'objective', name: 'name', fields: { target: 'target', dueAt: 'due' } },
  indicators: {
    kind: 'indicator',
    name: 'name',
    fields: { value: 'value', target: 'target', unit: 'unit', measuredAt: 'measuredAt' },
  },
  evidences: { kind: 'evidence', name: 'title', fields: { source: 'source', validUntil: 'review' } },
  /** Déclaration d'applicabilité historique (lot U2) : une ligne par exigence de `items` (clauses ISO 27001,
      Annexe A, HDS), décision lue et écrite dans `dda[<id exigence>]`, sans copie. */
  dda: {
    kind: 'soa',
    name: 'title',
    fields: { reason: 'just', level: 'level', risk: 'risk', actions: 'actions', docs: 'docs', comment: 'comment' },
  },
  reviews: {
    kind: 'management_review',
    name: 'title',
    fields: {
      heldAt: 'date',
      participants: 'participants',
      inputs: 'inputs',
      decisions: 'decisions',
      followup: 'followup',
    },
  },
} as const;
type LegacyPilotageKey = keyof typeof LEGACY_PILOTAGE;
export class PilotageLegacy {
  constructor(readonly g: Grc) {}
  definition(key: string) {
    if (!(key in LEGACY_PILOTAGE)) throw new HttpError(422, 'Origine historique non gérée par cet écran.');
    return LEGACY_PILOTAGE[key as LegacyPilotageKey];
  }
  async state(smsi: string, key: string, user: SessionUser, c?: Client, write = false) {
    if (smsi !== DEFAULT_SMSI) throw new HttpError(404, 'Ces données appartiennent au pilotage commun.');
    const def = this.definition(key);
    await this.g.access(smsi, user, write, c);
    await this.g.permission(user, GRC_MODULES[def.kind], write ? 'modifier' : 'lire');
    if (key === 'evidences') await this.g.permission(user, 'pilotage', write ? 'modifier' : 'lire');
    if (key === 'dda') await this.g.permission(user, 'audit', 'lire');
    return { def, state: await this.g.legacy.recompose(c) };
  }
  rows(data: JsonObject, key: string): JsonObject[] {
    if (key === 'scope') return isObject(data.scope) ? [{ ...data.scope, id: 'instance' }] : [];
    if (key === 'dda') {
      const dda = isObject(data.dda) ? data.dda : {};
      return (Array.isArray(data.items) ? data.items : [])
        .filter(isObject)
        .filter((i) => typeof i.id === 'string' && ['ISO', 'A', 'HDS'].includes(String(i.ref)))
        .map((i) => {
          const d = isObject(dda[i.id as string]) ? (dda[i.id as string] as JsonObject) : {};
          return { ...d, id: i.id, title: `${String(i.id)} — ${String(i.title ?? '')}`, ref: i.ref } as JsonObject;
        });
    }
    return (Array.isArray(data[key]) ? data[key] : [])
      .filter(isObject)
      .map((r, i) => (typeof r.id === 'string' ? r : { ...r, id: '@' + i }));
  }
  dto(smsi: string, key: string, raw: JsonObject, version: number): GrcObject {
    const def = this.definition(key);
    const data: Record<string, unknown> = {
      ...raw,
      ...(isObject(raw.pilotage) ? raw.pilotage : {}),
      description: String(raw.desc ?? raw.description ?? ''),
      refs: [],
      ownerId: null,
    };
    if (isObject(raw.pilotage)) Object.assign(data, raw.pilotage);
    else if (isObject(raw.links)) {
      data.refs = Object.entries(raw.links).flatMap(([origin, ids]) =>
        ['items', 'plans', 'recurring', 'indicators', 'suppliers'].includes(origin) && Array.isArray(ids)
          ? ids.filter((id): id is string => typeof id === 'string').map((id) => `legacy:${origin}:${id}`)
          : [],
      );
    }
    if (key === 'evidences' && !isObject(raw.pilotage)) data.status = 'draft';
    if (key === 'reviews' && !['draft', 'review', 'validated'].includes(String(data.status))) data.status = 'draft';
    for (const [field, source] of Object.entries(def.fields))
      if (data[field] === undefined && raw[source] !== undefined) data[field] = raw[source];
    if (key === 'roles' && data.refs && !Array.isArray(data.refs)) data.refs = [];
    if (key === 'swots')
      for (const [field, source] of Object.entries(def.fields)) {
        if (Array.isArray(raw[source]) && !isObject(raw.pilotage))
          data[field] = (raw[source] as unknown[])
            .map((v) => (typeof v === 'string' ? v : isObject(v) ? String(v.text ?? v.t ?? v.label ?? '') : ''))
            .join('\n');
      }
    if (key === 'indicators') {
      const values = Array.isArray(raw.values) ? raw.values.filter(isObject) : [];
      const latest = values.at(-1);
      if (latest) {
        data.value = latest.v;
        data.measuredAt = latest.date;
      }
    }
    if (key === 'reviews') {
      if (isObject(raw.inputs) && !isObject(raw.pilotage))
        data.inputs = Object.entries(raw.inputs)
          .map(([k, v]) => k + ': ' + (typeof v === 'string' ? v : JSON.stringify(v)))
          .join('\n');
      if (Array.isArray(raw.decisions) && !isObject(raw.pilotage))
        data.decisions = raw.decisions
          .filter(isObject)
          .map((v) => String(v.text ?? v.t ?? v.title ?? ''))
          .join('\n');
    }
    if (key === 'dda') {
      data.applicable = raw.app !== 'non';
      data.implemented = raw.level === 'Total';
      data.description = String(raw.comment ?? '');
    }
    return {
      id: `legacy:${key}:${raw.id}`,
      smsiId: smsi,
      kind: def.kind,
      name: String(
        raw[def.name] ?? raw.title ?? raw.name ?? (key === 'scope' ? 'Périmètre de l’organisation' : raw.id),
      ),
      data: { ...data, sourceSha: hash(raw), legacy: true, ownerLabel: raw.owner ?? '' },
      version,
      archived: false,
      legacyKey: key,
      legacyId: String(raw.id),
      createdAt: String(raw.createdAt ?? new Date(0).toISOString()),
      updatedAt: String(raw.updatedAt ?? new Date(0).toISOString()),
      createdBy: 'Historique',
      updatedBy: 'Historique',
    };
  }
  async list(smsi: string, key: string, user: SessionUser, search = '', offset = 0) {
    const { state } = await this.state(smsi, key, user);
    const rows = this.rows(state?.data ?? {}, key).filter((r) => typeof r.id === 'string');
    const items = rows
      .map((r) => this.dto(smsi, key, r, state?.version ?? 0))
      .filter((r) => (r.name + ' ' + String(r.data.description)).toLowerCase().includes(search.toLowerCase()));
    return {
      items: items.slice(offset, offset + 50),
      total: items.length,
      nextOffset: offset + 50 < items.length ? offset + 50 : null,
    };
  }
  async get(smsi: string, key: string, id: string, user: SessionUser, c?: Client, write = false) {
    const { state } = await this.state(smsi, key, user, c, write);
    const rows = this.rows(state?.data ?? {}, key).filter((r) => r.id === id);
    if (rows.length !== 1) throw new HttpError(404, 'Fiche historique absente ou identifiant ambigu.');
    return { object: this.dto(smsi, key, rows[0]!, state!.version), raw: rows[0]!, state: state! };
  }
  async update(
    smsi: string,
    key: string,
    id: string,
    input: { name: string; data: Record<string, unknown>; sourceSha: string },
    expected: number,
    user: SessionUser,
    ip: string,
  ) {
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM app_state WHERE id=1 FOR UPDATE');
      const { object, raw, state } = await this.get(smsi, key, id, user, c, true);
      if (state.version !== expected || hash(raw) !== input.sourceSha)
        throw new HttpError(412, 'La fiche historique a changé. Rechargez avant d’enregistrer.');
      if (object.data.status === 'closed')
        throw new HttpError(409, 'Conservez la clôture : créer un nouveau constat pour une récidive.');
      if (
        key === 'indicators' &&
        raw.auto === true &&
        (input.data.value !== object.data.value || input.data.measuredAt !== object.data.measuredAt)
      )
        throw new HttpError(
          422,
          'Cet indicateur est calculé automatiquement : sa valeur ne se saisit pas manuellement.',
        );
      const data = await this.g.normalize(smsi, object.kind, input.data, user, c);
      const updated = this.merge(key, raw, input.name, data, user.username);
      await this.save(c, key, id, updated, state.data, expected, user, ip, 'Modification de la fiche historique');
      return this.dto(smsi, key, updated, expected + 1);
    }, user.username);
  }
  merge(key: string, raw: JsonObject, name: string, data: Record<string, unknown>, actor: string): JsonObject {
    const def = this.definition(key);
    if (key === 'dda') {
      // Seuls les champs de la DdA historique sont écrits ; l'intitulé vient de l'exigence et ne se modifie pas ici.
      const { title: ignored, ref: ignoredRef, ...entree } = raw;
      void ignored;
      void ignoredRef;
      const next: JsonObject = { ...entree, app: data.applicable === false ? 'non' : 'oui' };
      for (const [field, source] of Object.entries(def.fields))
        if (typeof data[field] === 'string') next[source] = data[field] as string;
      if (data.implemented === true && !next.level) next.level = 'Total';
      return next;
    }
    const next = {
      ...raw,
      [def.name]: name,
      desc: String(data.description ?? ''),
      pilotage: JSON.parse(JSON.stringify(data)),
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    } as JsonObject;
    if (isObject(raw.links) && Array.isArray(data.refs)) {
      next.links = { ...raw.links };
      for (const key of ['items', 'plans', 'recurring', 'indicators', 'suppliers'])
        (next.links as JsonObject)[key] = data.refs
          .filter((r): r is string => typeof r === 'string' && r.startsWith(`legacy:${key}:`))
          .map((r) => r.split(':').slice(2).join(':'));
    }
    for (const [field, source] of Object.entries(def.fields))
      if (data[field] !== undefined) next[source] = JSON.parse(JSON.stringify(data[field]));
    if (key === 'swots')
      for (const [field, source] of Object.entries(def.fields)) {
        if (typeof data[field] === 'string') {
          const before = Array.isArray(raw[source]) ? raw[source] : [];
          next[source] = (data[field] as string)
            .split('\n')
            .filter(Boolean)
            .map((line, i) =>
              isObject(before[i]) ? { ...before[i], ...('t' in before[i] ? { t: line } : { text: line }) } : line,
            );
        }
      }
    if (key === 'reviews') {
      next.inputs = raw.inputs ?? {};
      next.decisions = raw.decisions ?? [];
    }
    if (key === 'indicators' && raw.auto !== true && data.value !== undefined && data.measuredAt) {
      const before = Array.isArray(raw.values) ? raw.values : [];
      const latest = before.filter(isObject).at(-1);
      if (latest?.v !== data.value || latest?.date !== data.measuredAt)
        next.values = [
          ...before,
          {
            date: String(data.measuredAt),
            v: JSON.parse(JSON.stringify(data.value)),
            note: 'Saisie depuis Pilotage',
            hist: '',
          },
        ];
    }
    return next;
  }
  async save(
    c: Client,
    key: string,
    id: string,
    raw: JsonObject,
    data: JsonObject,
    expected: number,
    user: SessionUser,
    ip: string,
    note: string,
  ) {
    if (key === 'scope') {
      const { id: ignored, ...scope } = raw;
      void ignored;
      data.scope = scope;
    } else if (key === 'dda') {
      const { id: ignored, ...entree } = raw;
      void ignored;
      data.dda = { ...(isObject(data.dda) ? data.dda : {}), [id]: entree };
    } else
      data[key] = (Array.isArray(data[key]) ? data[key] : []).map((r, i) =>
        isObject(r) && (r.id === id || (!r.id && id === '@' + i))
          ? r.id
            ? raw
            : (Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'id')) as JsonObject)
          : r,
      );
    const result = await this.g.legacy.nativeWrite(c, data, user, expected);
    if (result.conflict) throw new HttpError(412, 'La source historique a changé.');
    await this.g.db.audit(
      user,
      ip,
      'pilotage.legacy.updated',
      `legacy:${key}:${id}`,
      { note, version: result.version },
      c,
    );
    await this.g.notify(
      c,
      `legacy:${key}:${id}`,
      result.version,
      DEFAULT_SMSI,
      GRC_MODULES[this.definition(key).kind],
      user.username,
    );
    return result;
  }
}
