/* Migration explicite d'une étude EBIOS RM vers une nouvelle version de sa configuration (ADR 0038). L'étude épingle des
   éléments du catalogue à une version précise ; une version plus récente n'est jamais appliquée seule. L'aperçu mesure
   l'impact (cellules ou correspondances modifiées, niveaux déjà choisis qui n'existent plus) ; l'application est confirmée,
   motivée, journalisée, et ne réécrit aucune évaluation déjà saisie. */
import {
  evaluateMatrix,
  MappingDefinition,
  MatrixDefinition,
  ScaleDefinition,
  StudyConfiguration,
  type CfgRef,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { sql } from 'kysely';
import { surConnexion, type Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { hash, type Grc } from './core.js';

type Slot = 'relevanceMatrix' | 'severityMapping' | 'likelihoodScale' | 'scenarioSeverityScale';
/** Échelles épinglées par l'étude pour les scénarios : type de fiche et champ qui porte le niveau retenu. */
const ECHELLES_SCENARIO = {
  likelihoodScale: { kind: 'operational_scenario', champ: 'likelihoodLevel' },
  scenarioSeverityScale: { kind: 'strategic_scenario', champ: 'severityLevel' },
} as const;
interface CfgRow {
  key: string;
  state: string;
  currentVersion: number | null;
}
export interface PinImpact {
  slot: Slot;
  key: string;
  from: number;
  to: number;
  changed: boolean;
  archived: boolean;
  /** Cellules de la matrice ou correspondances de niveaux dont le résultat change. */
  resultsChanged: number;
  /** Niveaux déjà choisis dans l'étude qui n'existent plus dans la nouvelle version, par champ. */
  orphans: Record<string, string[]>;
  /** Fiches de l'étude qui portent un niveau sur cette configuration. */
  evaluations: number;
}

export class GrcStudyConfig {
  constructor(private readonly g: Grc) {}

  private async item(c: Client, id: string) {
    const r: CfgRow | undefined = await surConnexion(c)
      .selectFrom('cfg_items')
      .select(['key', 'state', 'current_version as currentVersion'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!r || !r.currentVersion) throw new HttpError(422, 'Élément de configuration introuvable ou jamais publié.');
    return r as CfgRow & { currentVersion: number };
  }
  private async definition(c: Client, ref: CfgRef) {
    const r = await surConnexion(c)
      .selectFrom('cfg_versions')
      .select('definition')
      .where('item_id', '=', ref.item)
      .where('version', '=', ref.version)
      .executeTakeFirst();
    if (!r) throw new HttpError(422, 'Version de configuration introuvable.');
    return r.definition;
  }
  private async levels(c: Client, ref: CfgRef) {
    const s = ScaleDefinition.safeParse(await this.definition(c, ref));
    return new Set(s.success ? s.data.levels.map((l) => l.id) : []);
  }
  /** Pertinence retenue d'un couple (dossier 003) : un choix différent de la proposition de la matrice se justifie, et un
      niveau qui écarte le couple n'est pas compatible avec « retenu ». Contrôlé seulement quand le couple change. */
  private async verifierPertinence(
    m: MatrixDefinition,
    data: Record<string, unknown>,
    avant: Record<string, unknown> | undefined,
    c: Client,
  ) {
    const champs = ['resourcesLevel', 'motivationLevel', 'relevanceLevel', 'justification', 'retained'];
    if (champs.every((k) => data[k] === avant?.[k])) return;
    const retenu = typeof data.relevanceLevel === 'string' && data.relevanceLevel ? data.relevanceLevel : null;
    if (!retenu) return;
    const texte = (k: string) => (typeof data[k] === 'string' && data[k] ? (data[k] as string) : null);
    const propose = evaluateMatrix(m, texte('resourcesLevel'), texte('motivationLevel'))?.result ?? null;
    if (propose && propose !== retenu && !String(data.justification ?? '').trim())
      throw new HttpError(422, 'Justifiez la pertinence retenue : elle diffère de la proposition de la matrice.');
    const echelle = ScaleDefinition.safeParse(await this.definition(c, m.result.scale));
    const niveau = echelle.success ? echelle.data.levels.find((l) => l.id === retenu) : undefined;
    if (data.retained === true && niveau?.effect === 'excluded')
      throw new HttpError(422, 'Un couple dont la pertinence écarte le couple ne peut pas être retenu.');
  }
  private async used(c: Client, smsi: string, studyId: string, kind: string) {
    return (
      await surConnexion(c)
        .selectFrom('grc_objects')
        .select('data')
        .where('smsi_id', '=', smsi)
        .where('kind', '=', kind)
        .where('archived', '=', false)
        .where(sql<string>`data->>'studyRef'`, '=', 'object:' + studyId)
        .execute()
    ).map((r) => r.data as Record<string, unknown>);
  }
  private missing(used: unknown[], keep: Set<string>) {
    return [...new Set(used.filter((x): x is string => typeof x === 'string' && x !== ''))].filter((x) => !keep.has(x));
  }

  /** Les niveaux saisis dans une fiche de l'étude (couple SR/OV, événement redouté) doivent exister dans les échelles que
      l'étude a épinglées. Seuls les niveaux modifiés sont contrôlés : une évaluation passée n'est jamais réécrite. */
  async verifierNiveaux(
    smsi: string,
    kind: 'sr_ov' | 'feared_event' | 'strategic_scenario' | 'operational_scenario',
    data: Record<string, unknown>,
    avant: Record<string, unknown> | undefined,
    c: Client,
  ) {
    if (typeof data.studyRef !== 'string' || !data.studyRef.startsWith('object:')) return;
    const study = (await surConnexion(c)
      .selectFrom('grc_objects')
      .select('data')
      .where('id', '=', data.studyRef.slice(7))
      .where('smsi_id', '=', smsi)
      .where('kind', '=', 'risk_study')
      .executeTakeFirst()) as { data: Record<string, unknown> } | undefined;
    const conf = StudyConfiguration.safeParse(study?.data.configuration);
    if (!conf.success) return;
    const controler = (champ: string, valeur: unknown, permis: Set<string>) => {
      if (typeof valeur !== 'string' || !valeur) return;
      if (!permis.has(valeur))
        throw new HttpError(422, `Niveau « ${valeur} » absent de l’échelle épinglée par l’étude (${champ}).`);
    };
    if (kind === 'sr_ov' && conf.data.relevanceMatrix) {
      const m = MatrixDefinition.parse(await this.definition(c, conf.data.relevanceMatrix));
      for (const [champ, echelle] of [
        ['resourcesLevel', m.rows.scale],
        ['motivationLevel', m.columns.scale],
        ['relevanceLevel', m.result.scale],
      ] as const)
        if (data[champ] !== avant?.[champ]) controler(champ, data[champ], await this.levels(c, echelle));
      await this.verifierPertinence(m, data, avant, c);
    }
    for (const [slot, cible] of Object.entries(ECHELLES_SCENARIO) as [
      keyof typeof ECHELLES_SCENARIO,
      (typeof ECHELLES_SCENARIO)[keyof typeof ECHELLES_SCENARIO],
    ][]) {
      const ref = conf.data[slot];
      if (kind === cible.kind && ref && data[cible.champ] !== avant?.[cible.champ])
        controler(cible.champ, data[cible.champ], await this.levels(c, ref));
    }
    if (kind === 'feared_event' && conf.data.severityMapping) {
      const m = MappingDefinition.parse(await this.definition(c, conf.data.severityMapping));
      if (data.severityLevel !== avant?.severityLevel)
        controler('severityLevel', data.severityLevel, await this.levels(c, m.to));
      const anciens = new Set(
        (Array.isArray(avant?.impactLevels) ? (avant.impactLevels as { level?: unknown }[]) : []).map((i) =>
          String(i.level),
        ),
      );
      const impacts = Array.isArray(data.impactLevels) ? (data.impactLevels as { level?: unknown }[]) : [];
      const permis = await this.levels(c, m.from);
      for (const i of impacts) if (!anciens.has(String(i.level))) controler('impactLevels', i.level, permis);
    }
  }

  async preview(smsi: string, id: string, user: SessionUser, c?: Client) {
    const conn = c ?? (this.g.db.pool as unknown as Client);
    const study = await this.g.object(smsi, id, user, false, c);
    if (study.kind !== 'risk_study') throw new HttpError(404, 'Étude introuvable.');
    const conf = StudyConfiguration.safeParse(study.data.configuration);
    const pins: PinImpact[] = [];
    if (conf.success) {
      if (conf.data.relevanceMatrix) pins.push(await this.matrixImpact(conn, smsi, id, conf.data.relevanceMatrix));
      if (conf.data.severityMapping) pins.push(await this.mappingImpact(conn, smsi, id, conf.data.severityMapping));
      for (const slot of Object.keys(ECHELLES_SCENARIO) as (keyof typeof ECHELLES_SCENARIO)[]) {
        const ref = conf.data[slot];
        if (ref) pins.push(await this.echelleImpact(conn, smsi, id, ref, slot));
      }
    }
    const upToDate = pins.every((p) => !p.changed);
    return {
      studyId: id,
      version: study.version,
      pins,
      upToDate,
      previewId: hash({ id, version: study.version, pins }),
    };
  }

  private async matrixImpact(c: Client, smsi: string, studyId: string, ref: CfgRef): Promise<PinImpact> {
    const item = await this.item(c, ref.item);
    const to = item.currentVersion;
    const before = MatrixDefinition.parse(await this.definition(c, ref));
    const after = MatrixDefinition.parse(await this.definition(c, { item: ref.item, version: to }));
    const cell = (m: MatrixDefinition, r: string, k: string) =>
      m.cells.find((x) => x.row === r && x.column === k)?.result ?? null;
    const keys = new Set([...before.cells, ...after.cells].map((x) => x.row + '\u0000' + x.column));
    let resultsChanged = 0;
    for (const k of keys) {
      const [r, col] = k.split('\u0000') as [string, string];
      if (cell(before, r, col) !== cell(after, r, col)) resultsChanged++;
    }
    const rows = await this.levels(c, after.rows.scale);
    const cols = await this.levels(c, after.columns.scale);
    const result = await this.levels(c, after.result.scale);
    const couples = await this.used(c, smsi, studyId, 'sr_ov');
    const orphans: Record<string, string[]> = {};
    const add = (field: string, list: string[]) => list.length && (orphans[field] = list);
    add(
      'resourcesLevel',
      this.missing(
        couples.map((d) => d.resourcesLevel),
        rows,
      ),
    );
    add(
      'motivationLevel',
      this.missing(
        couples.map((d) => d.motivationLevel),
        cols,
      ),
    );
    add(
      'relevanceLevel',
      this.missing(
        couples.map((d) => d.relevanceLevel),
        result,
      ),
    );
    const evaluations = couples.filter((d) => d.resourcesLevel || d.motivationLevel || d.relevanceLevel).length;
    return {
      slot: 'relevanceMatrix',
      key: item.key,
      from: ref.version,
      to,
      changed: to > ref.version,
      archived: item.state === 'archived',
      resultsChanged,
      orphans,
      evaluations,
    };
  }

  private async mappingImpact(c: Client, smsi: string, studyId: string, ref: CfgRef): Promise<PinImpact> {
    const item = await this.item(c, ref.item);
    const to = item.currentVersion;
    const before = MappingDefinition.parse(await this.definition(c, ref));
    const after = MappingDefinition.parse(await this.definition(c, { item: ref.item, version: to }));
    const pairs = (m: MappingDefinition) => new Map(m.pairs.map((p) => [p.from, p.to]));
    const a = pairs(before),
      b = pairs(after);
    let resultsChanged = 0;
    for (const k of new Set([...a.keys(), ...b.keys()])) if (a.get(k) !== b.get(k)) resultsChanged++;
    const from = await this.levels(c, after.from);
    const target = await this.levels(c, after.to);
    const events = await this.used(c, smsi, studyId, 'feared_event');
    const orphans: Record<string, string[]> = {};
    const impacts = events.flatMap((d) =>
      Array.isArray(d.impactLevels) ? (d.impactLevels as { level?: unknown }[]).map((i) => i.level) : [],
    );
    const o1 = this.missing(impacts, from);
    const o2 = this.missing(
      events.map((d) => d.severityLevel),
      target,
    );
    if (o1.length) orphans.impactLevels = o1;
    if (o2.length) orphans.severityLevel = o2;
    const evaluations = events.filter(
      (d) => (Array.isArray(d.impactLevels) && d.impactLevels.length) || d.severityLevel,
    ).length;
    return {
      slot: 'severityMapping',
      key: item.key,
      from: ref.version,
      to,
      changed: to > ref.version,
      archived: item.state === 'archived',
      resultsChanged,
      orphans,
      evaluations,
    };
  }

  /** Échelle de vraisemblance ou de gravité des scénarios : « résultats modifiés » = niveaux ajoutés, retirés ou renommés ;
      les niveaux déjà retenus dans les scénarios de l'étude qui n'existent plus sont signalés, jamais réécrits. */
  private async echelleImpact(
    c: Client,
    smsi: string,
    studyId: string,
    ref: CfgRef,
    slot: keyof typeof ECHELLES_SCENARIO,
  ): Promise<PinImpact> {
    const item = await this.item(c, ref.item);
    const to = item.currentVersion;
    const lire = async (r: CfgRef) => {
      const s = ScaleDefinition.safeParse(await this.definition(c, r));
      return new Map(s.success ? s.data.levels.map((l) => [l.id, l.label]) : []);
    };
    const avant = await lire(ref);
    const apres = await lire({ item: ref.item, version: to });
    let resultsChanged = 0;
    for (const k of new Set([...avant.keys(), ...apres.keys()])) if (avant.get(k) !== apres.get(k)) resultsChanged++;
    const { kind, champ } = ECHELLES_SCENARIO[slot];
    const fiches = await this.used(c, smsi, studyId, kind);
    const orphans: Record<string, string[]> = {};
    const absents = this.missing(
      fiches.map((d) => d[champ]),
      new Set(apres.keys()),
    );
    if (absents.length) orphans[champ] = absents;
    return {
      slot,
      key: item.key,
      from: ref.version,
      to,
      changed: to > ref.version,
      archived: item.state === 'archived',
      resultsChanged,
      orphans,
      evaluations: fiches.filter((d) => d[champ]).length,
    };
  }

  async apply(
    smsi: string,
    id: string,
    expected: number,
    previewId: string,
    reason: string,
    user: SessionUser,
    ip: string,
  ) {
    await this.g.access(smsi, user, true);
    return this.g.db.tx(async (c) => {
      const current = await this.g.raw(id, c, true);
      if (!current || current.smsiId !== smsi || current.kind !== 'risk_study')
        throw new HttpError(404, 'Étude introuvable.');
      await this.g.permission(user, 'pilotage', 'modifier');
      if (current.version !== expected) throw new HttpError(412, 'L’étude a changé. Rechargez avant de migrer.');
      const p = await this.preview(smsi, id, user, c);
      if (p.previewId !== previewId) throw new HttpError(422, 'La simulation ne correspond plus à l’état de l’étude.');
      const changed = p.pins.filter((x) => x.changed);
      if (!changed.length) throw new HttpError(422, 'La configuration de l’étude est déjà à jour.');
      const conf = StudyConfiguration.parse(current.data.configuration);
      const next = { ...conf };
      for (const x of changed) {
        const ref = conf[x.slot]!;
        next[x.slot] = { item: ref.item, version: x.to };
      }
      const data = await this.g.normalize(
        smsi,
        'risk_study',
        { ...current.data, configuration: next },
        user,
        c,
        current,
      );
      const o = await this.g.write(c, current, current.name, data, user, ip, 'Migration de configuration : ' + reason);
      await this.g.recordStudyUsage(c, o, user);
      await this.g.db.audit(
        user,
        ip,
        'grc.study.configuration.migrated',
        id,
        { smsiId: smsi, reason, pins: changed.map((x) => ({ slot: x.slot, from: x.from, to: x.to })) },
        c,
      );
      return o;
    }, user.username);
  }
}
