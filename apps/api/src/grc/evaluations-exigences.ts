/* Évaluations des exigences par périmètre (ADR 0041, lot H3) : lecture de la version courante et de l'historique, écriture
   d'une nouvelle version immuable. L'état de couverture se déduit de l'évaluation (packages/shared/src/couverture.ts) ;
   une preuve ou une mesure partagée entre référentiels ne rend jamais une autre exigence « testée » ou « validée ». */
import {
  etatExigence,
  exclusionInterdite,
  MESSAGE_EXCLUSION_INTERDITE,
  type EvaluationExigenceCorps,
  type EtatExigence,
  type EvaluationExigence,
  type FrameworkDefinition,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { sql } from 'kysely';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

/** Évaluations telles que les renvoie l'API : dates métier au format AAAA-MM-JJ (to_char, fragments fixes). */
const evaluations = (k: Kdb) =>
  k
    .selectFrom('grc_requirement_assessments')
    .select([
      'version',
      'applicability',
      'justification',
      'implementation',
      'implementation_note as implementationNote',
      sql<string | null>`to_char(tested_at, 'YYYY-MM-DD')`.as('testedAt'),
      'test_result as testResult',
      'test_note as testNote',
      'test_ref as testRef',
      sql<string | null>`to_char(validated_at, 'YYYY-MM-DD')`.as('validatedAt'),
      'validated_by as validatedBy',
      'validation_note as validationNote',
      'reason',
      'created_by as createdBy',
      'created_at as createdAt',
      'framework_version as frameworkVersion',
    ]);

export type EvaluationCourante = EvaluationExigence & { frameworkVersion: number };

export class GrcEvaluationsExigences {
  constructor(private readonly g: Grc) {}

  /** Version courante de chaque exigence évaluée des référentiels donnés : `framework_id:requirement_id` → évaluation. */
  async courantes(smsi: string, frameworkIds: string[], c?: Client): Promise<Map<string, EvaluationCourante>> {
    if (!frameworkIds.length) return new Map();
    const rows = (await evaluations(c ? surConnexion(c) : this.g.db.k)
      .select(['framework_id as frameworkId', 'requirement_id as requirementId'])
      .distinctOn(['framework_id', 'requirement_id'])
      .where('smsi_id', '=', smsi)
      .where('framework_id', 'in', frameworkIds)
      .orderBy('framework_id')
      .orderBy('requirement_id')
      .orderBy('version', 'desc')
      .execute()) as unknown as (EvaluationCourante & { frameworkId: string; requirementId: string })[];
    return new Map(rows.map((r) => [`${r.frameworkId}:${r.requirementId}`, r]));
  }

  async historique(smsi: string, frameworkId: string, requirementId: string, user: SessionUser) {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    const rows = (await evaluations(this.g.db.k)
      .where('smsi_id', '=', smsi)
      .where('framework_id', '=', frameworkId)
      .where('requirement_id', '=', requirementId)
      .orderBy('version', 'desc')
      .execute()) as unknown as (EvaluationCourante & { etat?: EtatExigence })[];
    return rows.map((e) => ({ ...e, etat: etatExigence(e) }));
  }

  /** Enregistre une nouvelle version. `attendue` : version courante lue par l'appelant (0 : aucune évaluation). */
  async evaluer(
    smsi: string,
    frameworkId: string,
    requirementId: string,
    corps: EvaluationExigenceCorps,
    attendue: number,
    user: SessionUser,
    ip: string,
  ) {
    await this.g.permission(user, 'conformite', 'modifier');
    await this.g.access(smsi, user, true);
    // La validation métier est une décision de pilotage : droit d'administration du Pilotage.
    if (corps.validatedAt !== null) await this.g.permission(user, 'pilotage', 'administrer');
    return this.g.db.tx(async (c, k) => {
      await k.selectFrom('grc_smsis').select('id').where('id', '=', smsi).forUpdate().execute();
      const effectif = (await this.g.effectiveFrameworks(smsi, c)).find(
        (e) => e.frameworkId === frameworkId && e.enabled,
      );
      if (!effectif) throw new HttpError(404, 'Référentiel non rattaché et actif dans ce périmètre.');
      const def = (
        await k
          .selectFrom('lib_framework_versions')
          .select('definition')
          .where('framework_id', '=', frameworkId)
          .where('version', '=', effectif.version)
          .executeTakeFirst()
      )?.definition as FrameworkDefinition | undefined;
      const exigence = def?.requirements.find((r) => r.id === requirementId);
      if (!def || !exigence) throw new HttpError(404, 'Exigence inconnue.');
      if (corps.applicability === 'exclue' && exclusionInterdite(def, exigence.domain))
        throw new HttpError(422, MESSAGE_EXCLUSION_INTERDITE);
      const courante =
        (
          await k
            .selectFrom('grc_requirement_assessments')
            .select(sql<number | null>`max(version)::int`.as('version'))
            .where('smsi_id', '=', smsi)
            .where('framework_id', '=', frameworkId)
            .where('requirement_id', '=', requirementId)
            .executeTakeFirstOrThrow()
        ).version ?? 0;
      if (courante !== attendue)
        throw new HttpError(412, 'L’évaluation a changé : rechargez l’exigence avant de l’enregistrer.');
      await k
        .insertInto('grc_requirement_assessments')
        .values({
          smsi_id: smsi,
          framework_id: frameworkId,
          framework_version: effectif.version,
          requirement_id: requirementId,
          version: courante + 1,
          applicability: corps.applicability,
          justification: corps.justification,
          implementation: corps.implementation,
          implementation_note: corps.implementationNote,
          tested_at: corps.testedAt,
          test_result: corps.testResult,
          test_note: corps.testNote,
          test_ref: corps.testRef,
          validated_at: corps.validatedAt,
          validated_by: corps.validatedAt ? user.username : null,
          validation_note: corps.validationNote,
          reason: corps.reason,
          created_by: user.username,
        })
        .execute();
      await this.g.db.audit(
        user,
        ip,
        'grc.exigence.evaluated',
        smsi,
        { frameworkId, requirementId, version: courante + 1, etat: etatExigence(corps) },
        c,
      );
      await this.g.notify(c, `${frameworkId}:${requirementId}`, courante + 1, smsi, 'conformite', user.username);
      return { version: courante + 1, etat: etatExigence(corps) };
    }, user.username);
  }
}
