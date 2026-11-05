/* Copies des référentiels propres à un périmètre (ADR 0082). La bibliothèque est figée ; attribuer un de ses référentiels à
   un périmètre en crée une copie, que le périmètre modifie librement. Chaque modification publie une version immuable de
   la copie (historique conservé). La copie garde l'identifiant du référentiel de la bibliothèque et l'édition dont elle est
   issue : les références d'exigences, les évaluations, les liens et les correspondances suivent l'exigence par son
   identifiant, quelles que soient les modifications. Une exigence retirée garde son historique (évaluations, liens) : elle
   n'est simplement plus comptée. Seul le périmètre qui porte la copie la modifie ; ceux qui en héritent la lisent. */
import { LibraryFrameworkDefinition, type FrameworkDefinition, type LibraryRequirementBody } from '@suivi/shared';
import { ZodError } from 'zod';
import type { SessionUser } from '../auth.js';
import { sql } from 'kysely';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc, ReferentielEffectifPerimetre } from './core.js';

export interface DefinitionEffective {
  effectif: ReferentielEffectifPerimetre;
  definition: FrameworkDefinition;
}
export interface VersionCopie {
  version: number;
  sourceVersion: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  requirements: number;
}

export class GrcCopiesReferentiels {
  constructor(private readonly g: Grc) {}
  private k(c?: Client): Kdb {
    return c ? surConnexion(c) : this.g.db.k;
  }

  /** Définition d'une version de la copie portée par un périmètre. */
  async versionCopie(detenteur: string, frameworkId: string, version: number, c?: Client) {
    const r = await this.k(c)
      .selectFrom('grc_framework_copy_versions')
      .select(['definition', 'source_version as sourceVersion'])
      .where('smsi_id', '=', detenteur)
      .where('framework_id', '=', frameworkId)
      .where('version', '=', version)
      .executeTakeFirst();
    // Définitions écrites après validation (LibraryFrameworkDefinition) : relues telles quelles.
    return r ? { definition: r.definition as FrameworkDefinition, sourceVersion: r.sourceVersion } : undefined;
  }

  /** Définitions courantes des référentiels effectifs du périmètre (copie du périmètre ou de l'ancêtre détenteur).
      `suivisSeulement` : uniquement les référentiels actifs et appliqués, ceux de la conformité. */
  async effectives(smsi: string, c?: Client, suivisSeulement = true): Promise<Map<string, DefinitionEffective>> {
    const effectifs = (await this.g.effectiveFrameworks(smsi, c)).filter((e) => !suivisSeulement || e.suivi);
    const out = new Map<string, DefinitionEffective>();
    if (!effectifs.length) return out;
    const rows = await this.k(c)
      .selectFrom('grc_framework_copy_versions')
      .select(['smsi_id', 'framework_id', 'version', 'definition'])
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
      .execute();
    for (const e of effectifs) {
      const r = rows.find(
        (x) => x.smsi_id === e.detenteurId && x.framework_id === e.frameworkId && x.version === e.versionCopie,
      );
      if (r) out.set(e.frameworkId, { effectif: e, definition: r.definition as FrameworkDefinition });
    }
    return out;
  }

  /** Définition courante d'un référentiel effectif du périmètre, ou undefined. */
  async effective(smsi: string, frameworkId: string, c?: Client, suivisSeulement = true) {
    return (await this.effectives(smsi, c, suivisSeulement)).get(frameworkId);
  }

  /** Copie effective du périmètre pour l'écran d'édition : définition (courante ou version demandée), statut, historique. */
  async lire(smsi: string, frameworkId: string, user: SessionUser, version?: number) {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    const e = await this.effective(smsi, frameworkId, undefined, false);
    if (!e) throw new HttpError(404, 'Référentiel non attribué à ce périmètre.');
    const { effectif } = e;
    let definition = e.definition,
      sourceVersion = effectif.version;
    if (version !== undefined && version !== effectif.versionCopie) {
      const v = await this.versionCopie(effectif.detenteurId, frameworkId, version);
      if (!v) throw new HttpError(404, 'Version de la copie introuvable.');
      definition = v.definition;
      sourceVersion = v.sourceVersion;
    }
    const historique = (await this.g.db.k
      .selectFrom('grc_framework_copy_versions')
      .select([
        'version',
        'source_version as sourceVersion',
        'reason',
        'created_by as createdBy',
        'created_at as createdAt',
        sql<number>`jsonb_array_length(definition->'requirements')::int`.as('requirements'),
      ])
      .where('smsi_id', '=', effectif.detenteurId)
      .where('framework_id', '=', frameworkId)
      .orderBy('version', 'desc')
      .limit(200)
      .execute()) as unknown as VersionCopie[];
    return {
      frameworkId,
      definition,
      version: version ?? effectif.versionCopie,
      versionCourante: effectif.versionCopie,
      sourceVersion,
      statut: effectif.statut,
      detenteurId: effectif.detenteurId,
      /** Seul le périmètre qui porte la copie la modifie ; un périmètre qui en hérite la lit. */
      modifiable: effectif.detenteurId === smsi && user.rights.can('conformite', 'modifier'),
      historique,
    };
  }

  /** Copie portée par ce périmètre, verrouillée pour écriture ; refusée si elle est héritée. */
  private async copieDetenue(c: Client, smsi: string, frameworkId: string) {
    const row = await surConnexion(c)
      .selectFrom('grc_scope_frameworks')
      .select(['version', 'copy_version as copyVersion'])
      .where('smsi_id', '=', smsi)
      .where('framework_id', '=', frameworkId)
      .forUpdate()
      .executeTakeFirst();
    if (!row) throw new HttpError(404, 'Référentiel non attribué à ce périmètre.');
    if (row.copyVersion === null)
      throw new HttpError(422, 'Ce référentiel est hérité : sa copie se modifie dans le périmètre qui la porte.');
    const v = await this.versionCopie(smsi, frameworkId, row.copyVersion, c);
    return { sourceVersion: row.version, copyVersion: row.copyVersion, definition: v!.definition };
  }

  /** Publie une nouvelle version de la copie du périmètre (dans la transaction de l'appelant). */
  async publier(
    c: Client,
    smsi: string,
    frameworkId: string,
    precedente: number | null,
    sourceVersion: number,
    definition: unknown,
    reason: string,
    auteur: string,
  ) {
    let valide: FrameworkDefinition;
    try {
      valide = LibraryFrameworkDefinition.parse(definition);
    } catch (e) {
      if (e instanceof ZodError) throw new HttpError(422, e.issues.map((i) => i.message).join(' ; '));
      throw e;
    }
    const k = surConnexion(c);
    // Les versions d'une copie détachée puis attribuée à nouveau sont conservées : la numérotation continue.
    const max = (
      await k
        .selectFrom('grc_framework_copy_versions')
        .select((eb) => eb.fn.max<number | null>('version').as('v'))
        .where('smsi_id', '=', smsi)
        .where('framework_id', '=', frameworkId)
        .executeTakeFirstOrThrow()
    ).v;
    const version = Math.max(precedente ?? 0, max ?? 0) + 1;
    await k
      .insertInto('grc_framework_copy_versions')
      .values({
        smsi_id: smsi,
        framework_id: frameworkId,
        version,
        source_version: sourceVersion,
        definition: JSON.stringify(valide),
        reason: reason.slice(0, 500),
        created_by: auteur,
      })
      .execute();
    return version;
  }

  /** Modifie la copie détenue par le périmètre : la fonction reçoit la définition courante et renvoie la nouvelle. */
  private async modifier(
    smsi: string,
    frameworkId: string,
    attendue: number,
    user: SessionUser,
    ip: string,
    changer: (d: FrameworkDefinition) => { definition: FrameworkDefinition; motif: string },
  ) {
    await this.g.permission(user, 'conformite', 'modifier');
    await this.g.access(smsi, user, true);
    return this.g.db.tx(async (c, k) => {
      await k.selectFrom('grc_smsis').select('id').where('id', '=', smsi).forUpdate().execute();
      await this.g.access(smsi, user, true, c);
      const copie = await this.copieDetenue(c, smsi, frameworkId);
      if (copie.copyVersion !== attendue)
        throw new HttpError(412, 'La copie a changé : rechargez-la avant de la modifier.');
      const { definition, motif } = changer(copie.definition);
      if (definition.identifier !== copie.definition.identifier)
        throw new HttpError(422, 'L’identifiant du référentiel ne change pas dans une copie.');
      const version = await this.publier(
        c,
        smsi,
        frameworkId,
        copie.copyVersion,
        copie.sourceVersion,
        definition,
        motif,
        user.username,
      );
      await k
        .updateTable('grc_scope_frameworks')
        .set({ copy_version: version })
        .where('smsi_id', '=', smsi)
        .where('framework_id', '=', frameworkId)
        .execute();
      await this.g.db.audit(
        user,
        ip,
        'grc.referentiel.copie.modifiee',
        smsi,
        { frameworkId, version, previousVersion: copie.copyVersion, motif },
        c,
      );
      await this.g.notify(c, smsi, 0, smsi, 'conformite', user.username);
      await this.g.resynchroniser(smsi, c);
      return { frameworkId, version, requirements: definition.requirements.length };
    }, user.username);
  }

  /** Ajoute une exigence à la copie, ou remplace celle qui porte le même identifiant. */
  async enregistrerExigence(
    smsi: string,
    frameworkId: string,
    body: LibraryRequirementBody,
    user: SessionUser,
    ip: string,
  ) {
    return this.modifier(smsi, frameworkId, body.expectedVersion, user, ip, (d) => {
      const domains = [...d.domains];
      let domain = body.domain;
      if (body.newDomainLabel) {
        domain = `domaine_${domains.length + 1}`;
        while (domains.some((x) => x.id === domain)) domain += '_x';
        domains.push({ id: domain, label: body.newDomainLabel });
      } else if (!domains.some((x) => x.id === domain)) throw new HttpError(422, 'Domaine inconnu dans cette copie.');
      const precedente = d.requirements.find((r) => r.id === body.id);
      const exigence = {
        ...(precedente ?? {}),
        id: body.id,
        domain: domain!,
        title: body.title,
        description: body.description,
        applicability: body.applicability,
        measureRefs: [],
      };
      const requirements = precedente
        ? d.requirements.map((r) => (r.id === body.id ? exigence : r))
        : [...d.requirements, exigence];
      return {
        definition: { ...d, domains, requirements },
        motif: `${precedente ? 'Modification' : 'Ajout'} de l’exigence ${body.id}.`,
      };
    });
  }

  /** Retire une exigence de la copie. Ses évaluations et liens restent dans l'historique ; elle n'est plus comptée. */
  async retirerExigence(
    smsi: string,
    frameworkId: string,
    requirementId: string,
    attendue: number,
    user: SessionUser,
    ip: string,
  ) {
    return this.modifier(smsi, frameworkId, attendue, user, ip, (d) => {
      if (!d.requirements.some((r) => r.id === requirementId))
        throw new HttpError(404, 'Exigence absente de cette copie.');
      return {
        definition: { ...d, requirements: d.requirements.filter((r) => r.id !== requirementId) },
        motif: `Retrait de l’exigence ${requirementId}.`,
      };
    });
  }

  /** Renomme la copie (le nom affiché dans le périmètre ; l'identifiant reste celui de la bibliothèque). */
  async renommer(smsi: string, frameworkId: string, name: string, attendue: number, user: SessionUser, ip: string) {
    return this.modifier(smsi, frameworkId, attendue, user, ip, (d) => ({
      definition: { ...d, name },
      motif: `Copie renommée « ${name} ».`,
    }));
  }
}
