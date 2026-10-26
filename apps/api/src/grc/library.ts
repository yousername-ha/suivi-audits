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
import { sql } from 'kysely';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
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
  /** Hérité d'un périmètre parent (chaîne d'héritage explicite) : se modifie là où il est rattaché. */
  inherited: boolean;
  originId: string;
  /** Nom du périmètre porteur, absent si l'utilisateur n'y a pas accès. */
  originName: string | null;
}
interface LibraryRow {
  id: string;
  identifier: string;
  name: string;
  version: number;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

/** Version courante d'un référentiel de la bibliothèque, avec sa définition. */
const avecVersionCourante = (k: Kdb) =>
  k
    .selectFrom('lib_frameworks as f')
    .innerJoin('lib_framework_versions as v', (j) =>
      j.onRef('v.framework_id', '=', 'f.id').onRef('v.version', '=', 'f.version'),
    );
/** Les définitions ne sont écrites qu'après validation (LibraryFrameworkDefinition) : relues telles quelles. */
const definitionDe = <T extends { definition: unknown }>(r: T) =>
  ({ ...r, definition: r.definition as FrameworkDefinition }) as Omit<T, 'definition'> & {
    definition: FrameworkDefinition;
  };

export class GrcLibrary {
  constructor(private readonly g: Grc) {}
  /** Kysely sur la transaction de l'appelant, sinon sur le pool. */
  private k(c?: Client): Kdb {
    return c ? surConnexion(c) : this.g.db.k;
  }
  private identifiantPris(k: Kdb, identifier: string) {
    return k.selectFrom('lib_frameworks').select('id').where('identifier', '=', identifier).executeTakeFirst();
  }
  private rattache(k: Kdb, smsi: string, id: string) {
    return k
      .selectFrom('grc_scope_frameworks')
      .select('version')
      .where('smsi_id', '=', smsi)
      .where('framework_id', '=', id);
  }
  private versionBibliotheque(k: Kdb, id: string, version: number) {
    return k
      .selectFrom('lib_framework_versions')
      .select(['definition', 'version'])
      .where('framework_id', '=', id)
      .where('version', '=', version)
      .executeTakeFirst()
      .then((r) => (r ? definitionDe(r) : undefined));
  }
  /** Rattachements d'un périmètre (colonnes communes aux référentiels propres et hérités). */
  private rattachements(k: Kdb, herite: boolean) {
    return k
      .selectFrom('grc_scope_frameworks as s')
      .innerJoin('lib_frameworks as f', 'f.id', 's.framework_id')
      .select([
        's.framework_id as frameworkId',
        'f.identifier',
        'f.name',
        's.version',
        'f.version as latestVersion',
        's.enabled',
        's.attached_by as attachedBy',
        's.attached_at as attachedAt',
        sql<boolean>`${herite}::boolean`.as('inherited'),
        's.smsi_id as originId',
        sql<string | null>`NULL::text`.as('originName'),
      ])
      .orderBy('f.name')
      .orderBy('f.id');
  }

  async list(user: SessionUser): Promise<LibraryFramework[]> {
    await this.g.permission(user, 'conformite', 'lire');
    // Dates renvoyées telles quelles (sérialisées en ISO par la réponse), comme avant la conversion.
    return (await avecVersionCourante(this.g.db.k)
      .select([
        'f.id',
        'f.identifier',
        'f.name',
        'f.version',
        'f.updated_at as updatedAt',
        sql<FrameworkDefinition['source']>`v.definition->'source'`.as('source'),
        sql<number>`jsonb_array_length(v.definition->'requirements')::int`.as('requirements'),
        (eb) =>
          eb
            .selectFrom('grc_scope_frameworks as s')
            .select(sql<number>`count(*)::int`.as('n'))
            .whereRef('s.framework_id', '=', 'f.id')
            .as('scopes'),
        sql<boolean>`NOT (v.definition ? 'derivedFrom')`.as('locked'),
        sql<LibraryFramework['derivedFrom']>`v.definition->'derivedFrom'`.as('derivedFrom'),
      ])
      .orderBy('f.name')
      .orderBy('f.id')
      .execute()) as unknown as LibraryFramework[];
  }

  async version(id: string, version: number, user: SessionUser, c?: Client) {
    await this.g.permission(user, 'conformite', 'lire');
    const row = await this.versionBibliotheque(this.k(c), id, version);
    if (!row) throw new HttpError(404, 'Version de la bibliothèque introuvable.');
    return row;
  }

  /** Définition d'une version d'un référentiel rattaché au périmètre, ou null si ce référentiel n'y est pas rattaché. */
  async versionForScope(smsi: string, id: string, version: number, user: SessionUser, c?: Client) {
    const k = this.k(c);
    if (!(await this.rattache(k, smsi, id).executeTakeFirst())) return null;
    await this.g.access(smsi, user, false, c);
    const row = await this.versionBibliotheque(k, id, version);
    if (!row) throw new HttpError(404, 'Version publiée introuvable.');
    return row;
  }

  private async current(id: string, c?: Client, lock = false) {
    return (await this.k(c)
      .selectFrom('lib_frameworks')
      .select(['id', 'identifier', 'name', 'version'])
      .where('id', '=', id)
      .$if(lock, (q) => q.forUpdate())
      .executeTakeFirst()) satisfies LibraryRow | undefined;
  }

  async preview(id: string | null, input: unknown, user: SessionUser) {
    await this.g.permission(user, 'conformite', 'modifier');
    const definition = LibraryFrameworkDefinition.parse(input);
    const existing = id ? await this.current(id) : undefined;
    if (id && !existing) throw new HttpError(404, 'Référentiel de la bibliothèque introuvable.');
    if (existing && existing.identifier !== definition.identifier)
      throw new HttpError(422, 'L’identifiant d’un référentiel de la bibliothèque ne change pas entre deux versions.');
    const duplicate = !id && !!(await this.identifiantPris(this.g.db.k, definition.identifier));
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
    return this.g.db.tx(async (c, k) => {
      let frameworkId = id;
      let version = 1;
      if (id) {
        const locked = await this.current(id, c, true);
        if (!locked || locked.version !== expected) throw new HttpError(412, 'Le référentiel a changé.');
        version = locked.version + 1;
        await k
          .updateTable('lib_frameworks')
          .set({ name: p.definition.name, version, updated_by: user.username, updated_at: sql<Date>`now()` })
          .where('id', '=', id)
          .execute();
      } else {
        if (await this.identifiantPris(k, p.definition.identifier))
          throw new HttpError(409, 'Un référentiel de la bibliothèque porte déjà cet identifiant.');
        frameworkId = await this.creer(k, p.definition, user.username);
      }
      await k
        .insertInto('lib_framework_versions')
        .values({
          framework_id: frameworkId!,
          version,
          definition: JSON.stringify(p.definition),
          reason,
          created_by: user.username,
        })
        .execute();
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

  /** Nouveau référentiel de la bibliothèque, en version 1. */
  private async creer(k: Kdb, definition: { identifier: string; name: string }, auteur: string) {
    return (
      await k
        .insertInto('lib_frameworks')
        .values({
          identifier: definition.identifier,
          name: definition.name,
          version: 1,
          created_by: auteur,
          updated_by: auteur,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  }
  /** Crée une copie personnalisable d'un référentiel de la bibliothèque (version courante). L'original reste verrouillé. */
  async copy(id: string, body: LibraryCopyBody, user: SessionUser, ip: string) {
    await this.g.permission(user, 'conformite', 'modifier');
    const r = await avecVersionCourante(this.g.db.k)
      .select(['v.definition', 'f.version', 'f.name'])
      .where('f.id', '=', id)
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Référentiel de la bibliothèque introuvable.');
    const row = definitionDe(r);
    const base = body.identifier ?? `${row.definition.identifier}-copie`;
    let identifier = base;
    for (let n = 2; await this.identifiantPris(this.g.db.k, identifier); n++) {
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
    const r = await avecVersionCourante(this.g.db.k)
      .select(['v.definition', 'f.version'])
      .where('f.id', '=', id)
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Référentiel de la bibliothèque introuvable.');
    const row = definitionDe(r);
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
      const existing = await this.g.db.k
        .selectFrom('lib_frameworks')
        .select(['id', 'name', 'version'])
        .where('identifier', '=', identifier)
        .executeTakeFirstOrThrow();
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
    // Dates renvoyées telles quelles (sérialisées en ISO par la réponse), comme avant la conversion.
    const propres = (await this.rattachements(this.g.db.k, false)
      .where('s.smsi_id', '=', smsi)
      .execute()) as unknown as ScopeAttachment[];
    const heritees = (await this.g.effectiveFrameworks(smsi)).filter((e) => e.origineId !== smsi);
    if (!heritees.length) return propres;
    const origines = new Map<string, string | null>();
    for (const o of new Set(heritees.map((h) => h.origineId)))
      origines.set(o, (await this.g.visible(user, o)) ? (await this.g.access(o, user)).name : null);
    // Couples (référentiel, périmètre porteur) : un seul par référentiel (effectiveFrameworks), donc aucun doublon.
    const rows = (await this.rattachements(this.g.db.k, true)
      .where((eb) =>
        eb.or(
          heritees.map((h) => eb.and([eb('s.framework_id', '=', h.frameworkId), eb('s.smsi_id', '=', h.origineId)])),
        ),
      )
      .execute()) as unknown as ScopeAttachment[];
    return [...propres, ...rows.map((r) => ({ ...r, originName: origines.get(r.originId) ?? null }))];
  }

  private async verrouillerPerimetre(k: Kdb, smsi: string) {
    await k.selectFrom('grc_smsis').select('id').where('id', '=', smsi).forUpdate().execute();
  }
  /** Rattache (ou change la version rattachée de) un référentiel de la bibliothèque à un périmètre. */
  async attach(smsi: string, id: string, version: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.version(id, version, user);
    await this.g.db.tx(async (c, k) => {
      await this.verrouillerPerimetre(k, smsi);
      await this.g.access(smsi, user, true, c);
      const previous = await this.rattache(k, smsi, id).executeTakeFirst();
      await k
        .insertInto('grc_scope_frameworks')
        .values({ smsi_id: smsi, framework_id: id, version, attached_by: user.username })
        .onConflict((oc) =>
          oc
            .columns(['smsi_id', 'framework_id'])
            .doUpdateSet({ version, attached_by: user.username, attached_at: sql<Date>`now()` }),
        )
        .execute();
      await this.g.db.audit(
        user,
        ip,
        'library.framework.attached',
        smsi,
        { frameworkId: id, version, previousVersion: previous?.version ?? null },
        c,
      );
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.resynchroniser(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  /** Active ou désactive un référentiel rattaché, sans le détacher. */
  async setEnabled(smsi: string, id: string, enabled: boolean, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.g.db.tx(async (c, k) => {
      const r = await k
        .updateTable('grc_scope_frameworks')
        .set({ enabled })
        .where('smsi_id', '=', smsi)
        .where('framework_id', '=', id)
        .executeTakeFirst();
      if (!Number(r.numUpdatedRows)) throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
      await this.g.db.audit(user, ip, 'library.framework.enabled', smsi, { frameworkId: id, enabled }, c);
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.resynchroniser(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  /** Détache un référentiel : refusé tant qu'un objet ou un lien du périmètre référence ses exigences. */
  async detach(smsi: string, id: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.g.db.tx(async (c, k) => {
      await this.verrouillerPerimetre(k, smsi);
      if (!(await this.rattache(k, smsi, id).executeTakeFirst()))
        throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
      const ref = `%requirement:${escapeLike(id)}:%`;
      const n = sql<number>`count(*)::int`.as('n');
      const { n: links } = await k
        .selectFrom('grc_links')
        .select(n)
        .where('smsi_id', '=', smsi)
        .where((eb) => eb.or([eb('target_ref', 'like', ref), eb('source_ref', 'like', ref)]))
        .executeTakeFirstOrThrow();
      const texte = sql<string>`data::text`;
      const { n: objects } = await k
        .selectFrom('grc_objects')
        .select(n)
        .where('smsi_id', '=', smsi)
        .where('archived', '=', false)
        .where((eb) => eb.or([eb(texte, 'like', ref), eb(texte, 'like', `%"frameworkId":"${escapeLike(id)}"%`)]))
        .executeTakeFirstOrThrow();
      if (links + objects)
        throw new HttpError(
          409,
          `Ce référentiel est utilisé dans le périmètre (${links} lien(s), ${objects} objet(s)) : retirez d’abord ces références.`,
        );
      await k.deleteFrom('grc_scope_frameworks').where('smsi_id', '=', smsi).where('framework_id', '=', id).execute();
      await this.g.db.audit(user, ip, 'library.framework.detached', smsi, { frameworkId: id }, c);
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.resynchroniser(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  /** Simulation de la promotion d'un référentiel publié dans un périmètre : rien n'est écrit. */
  async promotionPreview(smsi: string, id: string, user: SessionUser, c?: Client) {
    await this.g.permission(user, 'conformite', 'modifier');
    const o = await this.g.object(smsi, id, user, false, c);
    if (o.kind !== 'framework') throw new HttpError(422, 'Référentiel attendu.');
    const k = this.k(c);
    const r = await k
      .selectFrom('grc_framework_versions')
      .select('definition')
      .where('framework_id', '=', id)
      .where('version', '=', o.version)
      .where('smsi_id', '=', smsi)
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Version publiée introuvable.');
    const row = definitionDe(r);
    const droppedMeasureRefs = row.definition.requirements.reduce((n, r) => n + r.measureRefs.length, 0);
    const definition = LibraryFrameworkDefinition.parse({
      ...row.definition,
      requirements: row.definition.requirements.map((r) => ({ ...r, measureRefs: [] })),
    });
    const alreadyPromoted = !!(await k
      .selectFrom('lib_framework_promotions')
      .select('source_version')
      .where('source_framework_id', '=', id)
      .where('source_version', '=', o.version)
      .executeTakeFirst());
    const inLibrary = await avecVersionCourante(k)
      .select(['f.id', 'f.version', 'v.definition'])
      .where('f.identifier', '=', definition.identifier)
      .executeTakeFirst();
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
    return this.g.db.tx(async (c, k) => {
      await this.verrouillerPerimetre(k, smsi);
      const again = await this.promotionPreview(smsi, id, user, c);
      if (again.previewId !== previewId || !again.canPromote)
        throw new HttpError(409, 'Simulation obsolète : relancez-la.');
      const o = await this.g.object(smsi, id, user, true, c);
      const libraryId = await this.creer(k, again.definition, user.username);
      const perimetre = (await this.g.access(smsi, user, false, c)).name;
      await k
        .insertInto('lib_framework_versions')
        .values({
          framework_id: libraryId,
          version: 1,
          definition: JSON.stringify(again.definition),
          reason: `Promu depuis le périmètre « ${perimetre} » (version ${again.sourceVersion})`,
          created_by: user.username,
        })
        .execute();
      await k
        .insertInto('lib_framework_promotions')
        .values({
          source_framework_id: id,
          source_version: again.sourceVersion,
          smsi_id: smsi,
          library_framework_id: libraryId,
          library_version: 1,
          promoted_by: user.username,
        })
        .execute();
      await k
        .insertInto('grc_scope_frameworks')
        .values({
          smsi_id: smsi,
          framework_id: libraryId,
          version: 1,
          enabled: o.data.enabled !== false,
          attached_by: user.username,
        })
        .execute();
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
      await this.g.resynchroniser(smsi, c);
      return { libraryFrameworkId: libraryId, version: 1, droppedMeasureRefs: again.droppedMeasureRefs };
    }, user.username);
  }
}
