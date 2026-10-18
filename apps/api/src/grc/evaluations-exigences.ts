/* Évaluations des exigences par périmètre (ADR 0041, lot H3) : lecture de la version courante et de l'historique, écriture
   d'une nouvelle version immuable. L'état de couverture se déduit de l'évaluation (packages/shared/src/couverture.ts) ;
   une preuve ou une mesure partagée entre référentiels ne rend jamais une autre exigence « testée » ou « validée ». */
import {
  etatExigence,
  type EvaluationExigenceCorps,
  type EtatExigence,
  type EvaluationExigence,
  type FrameworkDefinition,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

const COLONNES = `version,applicability,justification,implementation,implementation_note AS "implementationNote",
  to_char(tested_at,'YYYY-MM-DD') AS "testedAt",test_result AS "testResult",test_note AS "testNote",test_ref AS "testRef",
  to_char(validated_at,'YYYY-MM-DD') AS "validatedAt",validated_by AS "validatedBy",validation_note AS "validationNote",
  reason,created_by AS "createdBy",created_at AS "createdAt",framework_version AS "frameworkVersion"`;

export type EvaluationCourante = EvaluationExigence & { frameworkVersion: number };

export class GrcEvaluationsExigences {
  constructor(private readonly g: Grc) {}

  /** Version courante de chaque exigence évaluée des référentiels donnés : `framework_id:requirement_id` → évaluation. */
  async courantes(smsi: string, frameworkIds: string[], c?: Client): Promise<Map<string, EvaluationCourante>> {
    if (!frameworkIds.length) return new Map();
    const rows = (
      await (c ?? this.g.db.pool).query<EvaluationCourante & { frameworkId: string; requirementId: string }>(
        `SELECT DISTINCT ON (framework_id,requirement_id) framework_id AS "frameworkId",requirement_id AS "requirementId",${COLONNES}
           FROM grc_requirement_assessments WHERE smsi_id=$1 AND framework_id=ANY($2::uuid[])
          ORDER BY framework_id,requirement_id,version DESC`,
        [smsi, frameworkIds],
      )
    ).rows;
    return new Map(rows.map((r) => [`${r.frameworkId}:${r.requirementId}`, r]));
  }

  async historique(smsi: string, frameworkId: string, requirementId: string, user: SessionUser) {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    return (
      await this.g.db.q<EvaluationCourante & { etat?: EtatExigence }>(
        `SELECT ${COLONNES} FROM grc_requirement_assessments WHERE smsi_id=$1 AND framework_id=$2 AND requirement_id=$3
          ORDER BY version DESC`,
        [smsi, frameworkId, requirementId],
      )
    ).rows.map((e) => ({ ...e, etat: etatExigence(e) }));
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
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      const effectif = (await this.g.effectiveFrameworks(smsi, c)).find(
        (e) => e.frameworkId === frameworkId && e.enabled,
      );
      if (!effectif) throw new HttpError(404, 'Référentiel non rattaché et actif dans ce périmètre.');
      const def = (
        await c.query<{ definition: FrameworkDefinition }>(
          'SELECT definition FROM lib_framework_versions WHERE framework_id=$1 AND version=$2',
          [frameworkId, effectif.version],
        )
      ).rows[0]?.definition;
      if (!def?.requirements.some((r) => r.id === requirementId)) throw new HttpError(404, 'Exigence inconnue.');
      const courante =
        (
          await c.query<{ version: number }>(
            `SELECT max(version)::int AS version FROM grc_requirement_assessments
            WHERE smsi_id=$1 AND framework_id=$2 AND requirement_id=$3`,
            [smsi, frameworkId, requirementId],
          )
        ).rows[0]!.version ?? 0;
      if (courante !== attendue)
        throw new HttpError(412, 'L’évaluation a changé : rechargez l’exigence avant de l’enregistrer.');
      await c.query(
        `INSERT INTO grc_requirement_assessments(smsi_id,framework_id,framework_version,requirement_id,version,applicability,
           justification,implementation,implementation_note,tested_at,test_result,test_note,test_ref,validated_at,validated_by,
           validation_note,reason,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          smsi,
          frameworkId,
          effectif.version,
          requirementId,
          courante + 1,
          corps.applicability,
          corps.justification,
          corps.implementation,
          corps.implementationNote,
          corps.testedAt,
          corps.testResult,
          corps.testNote,
          corps.testRef,
          corps.validatedAt,
          corps.validatedAt ? user.username : null,
          corps.validationNote,
          corps.reason,
          user.username,
        ],
      );
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
