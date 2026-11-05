/* Bibliothèque de référentiels de l'organisation (ADR 0031, lot M2 ; ADR 0082) : un référentiel est importé une fois, hors
   périmètre, par versions immuables ; la bibliothèque est figée (aucune personnalisation). L'attribuer à un périmètre en
      crée une copie propre au périmètre (copies-referentiels.ts), modifiable, « en préparation » jusqu'à son application.
   Les référentiels publiés dans un périmètre (frameworks.ts) restent inchangés ; une promotion explicite, simulée avant
   application, les copie ici. Aucun lien vers une mesure n'est stocké dans la bibliothèque : ces liens sont propres à
   chaque périmètre. */
import { LibraryFrameworkDefinition, nomCopiePerimetre, type FrameworkDefinition } from '@suivi/shared';
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
  /** Toujours vrai : la bibliothèque est figée (ADR 0082) ; la personnalisation se fait dans la copie d'un périmètre. */
  locked: boolean;
  derivedFrom: { identifier: string; name: string; version: number } | null;
}
/** Référentiel d'un périmètre (ADR 0082) : copie propre au périmètre, ou copie héritée d'un ancêtre. */
export interface ScopeAttachment {
  frameworkId: string;
  identifier: string;
  /** Nom de la copie (modifiable) ; `libraryName` : nom du référentiel de la bibliothèque. */
  name: string;
  libraryName: string;
  /** Édition de la bibliothèque dont la copie est issue ; `latestVersion` : dernière édition de la bibliothèque. */
  version: number;
  latestVersion: number;
  enabled: boolean;
  /** « preparation » : copie en cours d'adaptation, hors conformité ; « applique » : référentiel suivi en conformité. */
  statut: 'preparation' | 'applique';
  /** Actif et appliqué : compté dans la conformité. */
  suivi: boolean;
  copyVersion: number;
  requirements: number;
  attachedBy: string;
  attachedAt: Date | null;
  statusBy: string | null;
  statusAt: Date | null;
  /** Copie portée par un périmètre ancêtre (chaîne d'héritage explicite) : elle se modifie et s'applique là-bas. */
  inherited: boolean;
  /** Hérité, avec une surcharge locale d'activation. */
  overridden: boolean;
  /** Périmètre qui porte la copie. */
  originId: string;
  /** Nom du périmètre porteur, absent si l'utilisateur n'y a pas accès. */
  originName: string | null;
  /** Surcharge locale d'un référentiel qui n'est plus hérité : sans effet, à retirer. */
  orphan: boolean;
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
        sql<boolean>`true`.as('locked'),
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

  /** Définition d'une édition d'un référentiel effectif du périmètre, ou null s'il n'y est pas attribué : la copie du
      périmètre (ou de l'ancêtre détenteur) pour l'édition dont elle est issue, sinon l'édition de la bibliothèque (anciennes
      références). */
  async versionForScope(smsi: string, id: string, version: number, user: SessionUser, c?: Client) {
    const e = await this.g.copies.effective(smsi, id, c, false);
    if (!e) return null;
    await this.g.access(smsi, user, false, c);
    if (e.effectif.version === version) return { definition: e.definition, version };
    const row = await this.versionBibliotheque(this.k(c), id, version);
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

  /** Référentiels du périmètre : ceux qu'il porte (sa copie, ou une surcharge d'activation d'un référentiel hérité) et
      ceux dont il hérite. Nom et nombre d'exigences : ceux de la copie effective. */
  async attachments(smsi: string, user: SessionUser): Promise<ScopeAttachment[]> {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    const k = this.g.db.k;
    const effectifs = await this.g.effectiveFrameworks(smsi);
    const propres = await k
      .selectFrom('grc_scope_frameworks')
      .select([
        'framework_id as frameworkId',
        'version',
        'enabled',
        'status',
        'copy_version as copyVersion',
        'attached_by as attachedBy',
        'attached_at as attachedAt',
        'status_by as statusBy',
        'status_at as statusAt',
      ])
      .where('smsi_id', '=', smsi)
      .execute();
    const ids = [...new Set([...effectifs.map((e) => e.frameworkId), ...propres.map((p) => p.frameworkId)])];
    if (!ids.length) return [];
    const biblio = new Map(
      (
        await k
          .selectFrom('lib_frameworks')
          .select(['id', 'identifier', 'name', 'version'])
          .where('id', 'in', ids)
          .execute()
      ).map((f) => [f.id, f]),
    );
    // Ligne de statut de chaque copie détenue par un ancêtre (qui l'a appliquée, quand).
    const detenteurs = [...new Set(effectifs.map((e) => e.detenteurId).filter((d) => d !== smsi))];
    const lignesDetenteurs = detenteurs.length
      ? await k
          .selectFrom('grc_scope_frameworks')
          .select(['smsi_id', 'framework_id', 'status_by as statusBy', 'status_at as statusAt'])
          .where('smsi_id', 'in', detenteurs)
          .where('framework_id', 'in', ids)
          .execute()
      : [];
    const copies = effectifs.length
      ? await k
          .selectFrom('grc_framework_copy_versions')
          .select([
            'smsi_id',
            'framework_id',
            'version',
            sql<string>`definition->>'name'`.as('name'),
            sql<number>`jsonb_array_length(definition->'requirements')::int`.as('requirements'),
          ])
          .where((eb) =>
            eb.or(
              effectifs.map((e) =>
                eb.and([
                  eb('smsi_id', '=', e.detenteurId),
                  eb('framework_id', '=', e.frameworkId),
                  eb('version', '=', e.versionCopie),
                ]),
              ),
            ),
          )
          .execute()
      : [];
    const noms = new Map<string, string | null>([[smsi, null]]);
    for (const o of new Set(effectifs.flatMap((e) => [e.origineId, e.detenteurId]).filter((x) => x !== smsi)))
      noms.set(o, (await this.g.visible(user, o)) ? (await this.g.access(o, user)).name : null);
    const out: ScopeAttachment[] = [];
    for (const e of effectifs) {
      const f = biblio.get(e.frameworkId)!;
      const propre = propres.find((p) => p.frameworkId === e.frameworkId);
      const copie = copies.find((x) => x.smsi_id === e.detenteurId && x.framework_id === e.frameworkId);
      const statutDe =
        e.detenteurId === smsi
          ? propre
          : lignesDetenteurs.find((l) => l.smsi_id === e.detenteurId && l.framework_id === e.frameworkId);
      out.push({
        frameworkId: e.frameworkId,
        identifier: f.identifier,
        name: copie?.name ?? f.name,
        libraryName: f.name,
        version: e.version,
        latestVersion: f.version,
        enabled: e.enabled,
        statut: e.statut,
        suivi: e.suivi,
        copyVersion: e.versionCopie,
        requirements: copie?.requirements ?? 0,
        attachedBy: propre?.attachedBy ?? '',
        attachedAt: propre?.attachedAt ?? null,
        statusBy: statutDe?.statusBy ?? null,
        statusAt: statutDe?.statusAt ?? null,
        inherited: e.detenteurId !== smsi,
        overridden: e.detenteurId !== smsi && !!propre,
        originId: e.detenteurId,
        originName: noms.get(e.detenteurId) ?? null,
        orphan: false,
      });
    }
    // Surcharges d'un référentiel qui n'est plus hérité (héritage coupé) : listées pour pouvoir les retirer.
    for (const p of propres)
      if (!effectifs.some((e) => e.frameworkId === p.frameworkId)) {
        const f = biblio.get(p.frameworkId)!;
        out.push({
          frameworkId: p.frameworkId,
          identifier: f.identifier,
          name: f.name,
          libraryName: f.name,
          version: p.version,
          latestVersion: f.version,
          enabled: p.enabled,
          statut: p.status === 'applique' ? 'applique' : 'preparation',
          suivi: false,
          copyVersion: 0,
          requirements: 0,
          attachedBy: p.attachedBy,
          attachedAt: p.attachedAt,
          statusBy: p.statusBy,
          statusAt: p.statusAt,
          inherited: false,
          overridden: false,
          originId: smsi,
          originName: null,
          orphan: true,
        });
      }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.frameworkId.localeCompare(b.frameworkId));
  }

  private async verrouillerPerimetre(k: Kdb, smsi: string) {
    await k.selectFrom('grc_smsis').select('id').where('id', '=', smsi).forUpdate().execute();
  }
  /** Attribue un référentiel de la bibliothèque au périmètre : crée sa copie, propre au périmètre, à l'édition choisie,
      « en préparation » par défaut. Déjà attribué : reprend l'édition demandée de la bibliothèque (nouvelle version de la
      copie, qui remplace son contenu). Hérité : le périmètre reçoit sa propre copie, qui l'emporte sur celle de l'ancêtre. */
  async attach(
    smsi: string,
    id: string,
    version: number,
    user: SessionUser,
    ip: string,
    statut?: 'preparation' | 'applique',
  ) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    const source = await this.version(id, version, user);
    await this.g.db.tx(async (c, k) => {
      await this.verrouillerPerimetre(k, smsi);
      const perimetre = await this.g.access(smsi, user, true, c);
      const previous = await k
        .selectFrom('grc_scope_frameworks')
        .select(['version', 'copy_version as copyVersion', 'status'])
        .where('smsi_id', '=', smsi)
        .where('framework_id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (previous?.copyVersion != null && previous.version === version) {
        // Déjà attribué à cette édition : seul un changement de statut demandé est appliqué.
        if (statut && statut !== previous.status) {
          await this.ecrireStatut(c, smsi, id, statut, user, ip);
          await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
          await this.g.resynchroniser(smsi, c);
        }
        return;
      }
      const motif =
        previous?.copyVersion != null
          ? `Reprise de l’édition ${version} de la bibliothèque (remplace le contenu de la copie).`
          : `Copie attribuée depuis la bibliothèque (édition ${version}).`;
      // Nom de la copie (décision du RSSI du 05/11/2026) : « <référentiel> (PRIVE - <périmètre>) » à la création ; une
      // reprise d'édition garde le nom courant de la copie, éventuellement renommée.
      const nom =
        previous?.copyVersion != null
          ? ((await this.g.copies.versionCopie(smsi, id, previous.copyVersion, c))?.definition.name ??
            nomCopiePerimetre(source.definition.name, perimetre.name))
          : nomCopiePerimetre(source.definition.name, perimetre.name);
      const copyVersion = await this.g.copies.publier(
        c,
        smsi,
        id,
        previous?.copyVersion ?? null,
        version,
        { ...source.definition, name: nom },
        motif,
        user.username,
      );
      const nouveauStatut = statut ?? (previous?.copyVersion != null ? previous.status : 'preparation');
      await k
        .insertInto('grc_scope_frameworks')
        .values({
          smsi_id: smsi,
          framework_id: id,
          version,
          copy_version: copyVersion,
          status: nouveauStatut,
          status_by: user.username,
          status_at: sql<Date>`now()`,
          attached_by: user.username,
        })
        .onConflict((oc) =>
          oc.columns(['smsi_id', 'framework_id']).doUpdateSet({
            version,
            copy_version: copyVersion,
            status: nouveauStatut,
            attached_by: user.username,
            attached_at: sql<Date>`now()`,
          }),
        )
        .execute();
      await this.g.db.audit(
        user,
        ip,
        'library.framework.attached',
        smsi,
        { frameworkId: id, version, previousVersion: previous?.version ?? null, copyVersion, statut: nouveauStatut },
        c,
      );
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.resynchroniser(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  private async ecrireStatut(
    c: Client,
    smsi: string,
    id: string,
    statut: 'preparation' | 'applique',
    user: SessionUser,
    ip: string,
  ) {
    await surConnexion(c)
      .updateTable('grc_scope_frameworks')
      .set({ status: statut, status_by: user.username, status_at: sql<Date>`now()` })
      .where('smsi_id', '=', smsi)
      .where('framework_id', '=', id)
      .execute();
    await this.g.db.audit(
      user,
      ip,
      statut === 'applique' ? 'grc.referentiel.applique' : 'grc.referentiel.preparation',
      smsi,
      { frameworkId: id },
      c,
    );
  }

  /** Applique la copie du périmètre (elle devient un référentiel suivi en conformité) ou la repasse en préparation (elle
      sort du suivi ; évaluations, liens et historique sont conservés). Réservé au périmètre qui porte la copie. */
  async setStatus(smsi: string, id: string, statut: 'preparation' | 'applique', user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.g.db.tx(async (c, k) => {
      await this.verrouillerPerimetre(k, smsi);
      const row = await k
        .selectFrom('grc_scope_frameworks')
        .select(['copy_version as copyVersion', 'status'])
        .where('smsi_id', '=', smsi)
        .where('framework_id', '=', id)
        .executeTakeFirst();
      if (!row) throw new HttpError(404, 'Référentiel non attribué à ce périmètre.');
      if (row.copyVersion === null)
        throw new HttpError(422, 'Ce référentiel est hérité : il s’applique dans le périmètre qui porte la copie.');
      if (row.status === statut) return;
      await this.ecrireStatut(c, smsi, id, statut, user, ip);
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.resynchroniser(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  /** Active ou désactive un référentiel, sans le détacher. Hérité : une surcharge locale (sans copie) est créée. */
  async setEnabled(smsi: string, id: string, enabled: boolean, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.g.db.tx(async (c, k) => {
      await this.verrouillerPerimetre(k, smsi);
      const r = await k
        .updateTable('grc_scope_frameworks')
        .set({ enabled })
        .where('smsi_id', '=', smsi)
        .where('framework_id', '=', id)
        .executeTakeFirst();
      if (!Number(r.numUpdatedRows)) {
        const herite = (await this.g.effectiveFrameworks(smsi, c)).find((e) => e.frameworkId === id);
        if (!herite) throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
        await k
          .insertInto('grc_scope_frameworks')
          .values({
            smsi_id: smsi,
            framework_id: id,
            version: herite.version,
            enabled,
            status: herite.statut,
            attached_by: user.username,
          })
          .execute();
      }
      await this.g.db.audit(user, ip, 'library.framework.enabled', smsi, { frameworkId: id, enabled }, c);
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.resynchroniser(smsi, c);
    }, user.username);
    return this.attachments(smsi, user);
  }

  /** Détache un référentiel (sa copie ou sa surcharge locale). Refusé tant qu'un objet ou un lien du périmètre référence
      ses exigences, sauf si le référentiel reste hérité d'un ancêtre (les références restent alors valables). Les
      surcharges locales des périmètres héritiers qui n'auraient plus de copie au-dessus d'elles sont retirées. Les versions
      de la copie restent dans l'historique. */
  async detach(smsi: string, id: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'administrer');
    await this.g.access(smsi, user, true);
    await this.g.db.tx(async (c, k) => {
      await this.verrouillerPerimetre(k, smsi);
      if (!(await this.rattache(k, smsi, id).executeTakeFirst()))
        throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
      await k.deleteFrom('grc_scope_frameworks').where('smsi_id', '=', smsi).where('framework_id', '=', id).execute();
      if (!(await this.g.effectiveFrameworks(smsi, c)).some((e) => e.frameworkId === id)) {
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
      }
      for (const h of await this.g.heritiers(smsi, c))
        if (!(await this.g.effectiveFrameworks(h, c)).some((e) => e.frameworkId === id))
          await k
            .deleteFrom('grc_scope_frameworks')
            .where('smsi_id', '=', h)
            .where('framework_id', '=', id)
            .where('copy_version', 'is', null)
            .execute();
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
      // Le périmètre d'origine reçoit sa copie (ADR 0082), appliquée : le référentiel y était déjà suivi.
      const copyVersion = await this.g.copies.publier(
        c,
        smsi,
        libraryId,
        null,
        1,
        { ...again.definition, name: nomCopiePerimetre(again.definition.name, perimetre) },
        `Copie créée à la promotion depuis le périmètre « ${perimetre} ».`,
        user.username,
      );
      await k
        .insertInto('grc_scope_frameworks')
        .values({
          smsi_id: smsi,
          framework_id: libraryId,
          version: 1,
          copy_version: copyVersion,
          status: 'applique',
          status_by: user.username,
          status_at: sql<Date>`now()`,
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
