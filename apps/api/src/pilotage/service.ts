import { EBIOS_ATELIERS, GRC_MODULES, JOURNEY_STEPS, PilotageRecord, SeriesData } from '@suivi/shared';
import { isObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { hash, type Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';
import { PilotageLegacy } from './legacy.js';

const columns = `id,source_ref AS "sourceRef",source_version AS "sourceVersion",operation,step,result,performed_on::text AS date,note,refs,generated_refs AS "generatedRefs",terms,snapshot,created_by AS "createdBy",created_at AS "createdAt"`;
export class Pilotage {
  readonly legacy: PilotageLegacy;
  constructor(readonly g: Grc) {
    this.legacy = new PilotageLegacy(g);
  }
  async source(smsi: string, ref: string, user: SessionUser, c?: Client, write = false) {
    if (ref.startsWith('object:')) return this.g.object(smsi, ref.slice(7), user, write, c);
    const [, key, ...id] = ref.split(':');
    if (!ref.startsWith('legacy:') || !key) throw new HttpError(422, 'Fiche de pilotage attendue.');
    return (await this.legacy.get(smsi, key, id.join(':'), user, c, write)).object;
  }
  async history(smsi: string, ref: string, user: SessionUser, before?: string) {
    await this.source(smsi, ref, user);
    // Le journal des décisions est immuable : après le déplacement d'un élément vers un autre périmètre de référence, ses
    // décisions gardent le périmètre d'origine. L'accès à l'élément vient d'être contrôlé : on lit par sa référence.
    const args: unknown[] = [ref, before ?? null];
    let where = 'source_ref=$1 AND ($2::timestamptz IS NULL OR created_at<$2)';
    if (!ref.startsWith('object:')) where += ` AND smsi_id=$${args.push(smsi)}`;
    const rows = (
      await this.g.db.q(
        `SELECT ${columns} FROM pilotage_decisions WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 50`,
        args,
      )
    ).rows;
    const refs: string[] = [...new Set(rows.flatMap((r) => (Array.isArray(r.refs) ? (r.refs as string[]) : [])))];
    const references: Record<string, { name: string; version: number }> = {};
    for (const ref of refs.slice(0, 200)) {
      try {
        const r = await this.g.resolve(smsi, ref, user);
        references[ref] = { name: r.name, version: r.version };
      } catch (e) {
        if (!(e instanceof HttpError) || ![403, 404].includes(e.status)) throw e;
      }
    }
    return {
      items: rows,
      references,
      referencesTruncated: refs.length > 200,
      nextBefore: rows.length === 50 ? rows.at(-1)!.createdAt : null,
    };
  }
  async action(c: Client, smsi: string, ref: string, name: string, ownerId: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'ecarts', 'modifier');
    const policy = (await this.g.policy(smsi, user)).definition;
    const data = await this.g.normalize(
      smsi,
      'action',
      {
        description: name,
        status: policy.statuses.find((s) => !s.terminal)!.id,
        ownerId: ownerId ?? null,
        startAt: null,
        dueAt: null,
        priority: 'normal',
        category: policy.catalogues.actionCategories[0]!.id,
        justification: '',
        reminderDays: policy.notifications.leadDays,
        dependencies: [],
      },
      user,
      c,
    );
    const action = await this.g.insert(c, smsi, 'action', name, data, user, ip);
    await c.query(
      "INSERT INTO grc_links(smsi_id,source_id,source_ref,target_ref,type,note,created_by) VALUES($1,$2,$3,$4,'treats','Action issue du pilotage',$5)",
      [smsi, action.id, 'object:' + action.id, ref, user.username],
    );
    return 'object:' + action.id;
  }
  async record(smsi: string, ref: string, raw: PilotageRecord, expected: number, user: SessionUser, ip: string) {
    const input = PilotageRecord.parse(raw);
    return this.g.db.tx(async (c) => {
      const scope = await this.g.access(smsi, user, true, c);
      const isLegacy = ref.startsWith('legacy:');
      if (isLegacy) await c.query('SELECT id FROM app_state WHERE id=1 FOR UPDATE');
      else await c.query('SELECT id FROM grc_objects WHERE id=$1 FOR UPDATE', [ref.slice(7)]);
      const source = await this.source(smsi, ref, user, c, true);
      const intentHash = hash({ smsi, ref, input, actor: user.username });
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.requestId]);
      const duplicate = (
        await c.query(`SELECT ${columns},intent_hash AS "intentHash" FROM pilotage_decisions WHERE request_id=$1`, [
          input.requestId,
        ])
      ).rows[0];
      if (duplicate) {
        if (duplicate.intentHash !== intentHash)
          throw new HttpError(409, 'Cet identifiant de demande correspond à une autre décision.');
        return duplicate;
      }
      if (source.version !== expected) throw new HttpError(412, 'La fiche a changé. Rechargez avant de confirmer.');
      if (source.archived) throw new HttpError(409, 'La fiche est archivée.');
      if (source.data.status === 'closed' && input.operation !== 'reopen')
        throw new HttpError(
          409,
          'La fiche est close. Rouvrez le constat avec un motif, ou créez-en un nouveau pour une récidive.',
        );
      if (input.date > new Date().toLocaleDateString('sv-SE', { timeZone: scope.timezone }))
        throw new HttpError(422, 'Une réalisation ne peut être datée dans le futur.');
      for (const r of input.refs) await this.g.resolve(smsi, r, user, c);
      const data = { ...source.data };
      delete data.sourceSha;
      delete data.legacy;
      delete data.ownerLabel;
      const compatible: Record<string, string[]> = {
        proof_review: ['evidence'],
        control_execution: ['control'],
        effectiveness: ['nonconformity'],
        close: ['nonconformity'],
        reopen: ['nonconformity'],
        step_validation: ['journey', 'risk_study'],
        risk_acceptance: ['risk'],
        approval: ['bia', 'continuity_plan', 'management_review'],
        action_create: [
          'nonconformity',
          'control',
          'management_review',
          'continuity_exercise',
          'continuity_plan',
          'bia',
          'objective',
        ],
      };
      if (!compatible[input.operation]!.includes(source.kind))
        throw new HttpError(422, 'Cette opération ne concerne pas cette fiche.');
      if (input.operation !== 'control_execution' && input.createFinding)
        throw new HttpError(422, 'Le constat automatique est réservé au contrôle.');
      if (
        input.createAction &&
        !['control_execution', 'effectiveness', 'approval', 'action_create'].includes(input.operation)
      )
        throw new HttpError(422, 'Création d’action non prévue pour cette décision.');
      if (input.operation === 'proof_review') {
        if (!['accepted', 'rejected'].includes(input.result)) throw new HttpError(422, 'Résultat d’examen attendu.');
        if (!input.refs.length || input.refs.some((r) => !r.startsWith('document:')))
          throw new HttpError(422, 'Sélectionnez les versions exactes des documents examinés.');
        data.status = input.result === 'accepted' ? 'validated' : 'rejected';
        data.documentRefs = input.refs;
        data.justification = input.note;
      }
      if (input.operation === 'control_execution') {
        if (!['pass', 'partial', 'fail'].includes(input.result))
          throw new HttpError(422, 'Résultat de contrôle attendu.');
        if (
          !String(data.objective ?? '').trim() ||
          !String(data.method ?? '').trim() ||
          !String(data.criteria ?? '').trim()
        )
          throw new HttpError(422, 'Définissez l’objectif, la méthode et les critères du contrôle.');
        if (!input.refs.length)
          throw new HttpError(422, 'Reliez au moins une preuve ou un enregistrement au résultat.');
        if (input.result === 'pass' && input.createFinding)
          throw new HttpError(422, 'Un contrôle réussi ne génère pas automatiquement un écart.');
        data.result = input.result;
        data.performedAt = input.date;
      }
      if (input.operation === 'effectiveness') {
        if (!['effective', 'ineffective'].includes(input.result))
          throw new HttpError(422, 'Résultat d’efficacité attendu.');
        if (!String(data.cause ?? '').trim() || !input.refs.length)
          throw new HttpError(422, 'Renseignez les causes et les preuves de la vérification.');
        data.effectiveness = input.result;
        data.effectivenessNote = input.note;
        data.status = input.result === 'effective' ? 'effectiveness' : 'progress';
      }
      if (input.operation === 'close') {
        if (input.result !== 'completed' || data.effectiveness !== 'effective' || !String(data.cause ?? '').trim())
          throw new HttpError(409, 'Analyser les causes et vérifier une efficacité positive avant clôture.');
        const effective = (
          await c.query(
            "SELECT 1 FROM pilotage_decisions WHERE smsi_id=$1 AND source_ref=$2 AND operation='effectiveness' AND result='effective' ORDER BY created_at DESC LIMIT 1",
            [smsi, ref],
          )
        ).rowCount;
        if (!effective) throw new HttpError(409, 'Vérification d’efficacité tracée requise.');
        const policy = (await this.g.policy(smsi, user)).definition;
        const terminal = policy.statuses.filter((s) => s.terminal).map((s) => s.id);
        const pending = (
          await c.query(
            `SELECT 1 FROM grc_objects a WHERE a.smsi_id=$1 AND a.kind='action' AND NOT(a.data->>'status'=ANY($3)) AND EXISTS(SELECT 1 FROM grc_links l WHERE l.smsi_id=$1 AND ((l.source_ref='object:'||a.id AND l.target_ref=$2) OR (l.target_ref='object:'||a.id AND l.source_ref=$2))) LIMIT 1`,
            [smsi, ref, terminal],
          )
        ).rowCount;
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        if (pending || tasks.some((t) => isObject(t) && t.done !== true))
          throw new HttpError(409, 'Terminez les actions liées avant de clôturer.');
        if (data.status === 'closed') throw new HttpError(409, 'Constat déjà clos.');
        data.status = 'closed';
        data.closedAt = input.date;
        data.closureNote = input.note;
      }
      if (input.operation === 'reopen') {
        // Pas de réouverture silencieuse : le motif (note) est inscrit au journal des décisions et à l'historique de la
        // fiche ; la clôture d'origine reste lisible dans le journal et ses versions. L'efficacité est à revérifier.
        if (input.result !== 'completed') throw new HttpError(422, 'Réouverture attendue.');
        if (data.status !== 'closed') throw new HttpError(409, 'Seul un constat clos peut être rouvert.');
        data.status = 'open';
        data.effectiveness = 'pending';
        data.effectivenessNote = '';
        data.closedAt = '';
        data.closureNote = '';
      }
      if (input.operation === 'approval') {
        await this.g.permission(user, 'pilotage', 'administrer');
        if (!['accepted', 'rejected'].includes(input.result))
          throw new HttpError(422, 'Décision de validation attendue.');
        if (input.result === 'accepted') {
          const required =
            source.kind === 'bia'
              ? ['activity', 'scenario', 'minimumService']
              : source.kind === 'continuity_plan'
                ? ['scope', 'trigger', 'strategy', 'procedures', 'roles', 'returnToNormal']
                : ['inputs', 'decisions'];
          if (required.some((k) => !String(data[k] ?? '').trim()) || !input.refs.length)
            throw new HttpError(422, 'Complétez les informations et justificatifs avant validation.');
          if (
            source.kind === 'bia' &&
            (!Array.isArray(data.impacts) ||
              !data.impacts.length ||
              data.recoveryHours == null ||
              data.maxInterruptionHours == null)
          )
            throw new HttpError(422, 'Décrivez les impacts dans le temps et les objectifs d’interruption/reprise.');
        }
        data.status = input.result === 'accepted' ? 'validated' : 'draft';
        data.justification = input.note;
      }
      let terms: Record<string, unknown> = {};
      if (input.operation === 'risk_acceptance') {
        await this.g.permission(user, 'pilotage', 'administrer');
        if (!['accepted', 'rejected'].includes(input.result))
          throw new HttpError(422, 'Décision d’acceptation attendue : acceptée ou refusée.');
        if (input.result === 'accepted') {
          if (!input.until || input.until < input.date)
            throw new HttpError(422, 'Indiquez l’échéance de l’acceptation, postérieure à la décision.');
          if (data.strategy !== 'accept')
            throw new HttpError(409, 'Choisissez d’abord l’option de traitement « accepter » sur la fiche du risque.');
        }
        terms = input.until ? { until: input.until } : {};
      }
      if (input.operation === 'step_validation' && source.kind === 'risk_study') {
        await this.g.permission(user, 'pilotage', 'administrer');
        if (input.result !== 'completed') throw new HttpError(422, 'Validation d’atelier attendue.');
        const atelier = EBIOS_ATELIERS.find((a) => a.id === input.step);
        if (!atelier) throw new HttpError(422, 'Atelier inconnu.');
        if (!String(data.objective ?? '').trim() || !String(data.scope ?? '').trim())
          throw new HttpError(422, 'Renseignez l’objet et le périmètre de l’étude.');
        const resolved = await Promise.all(input.refs.map((r) => this.g.resolve(smsi, r, user, c)));
        if (!resolved.some((r) => (atelier.kinds as readonly string[]).includes(r.kind) && r.data.studyRef === ref))
          throw new HttpError(422, 'Reliez au moins un élément de cet atelier, rattaché à l’étude.');
        for (const previous of EBIOS_ATELIERS.slice(0, EBIOS_ATELIERS.indexOf(atelier)))
          if (
            !(
              await c.query(
                "SELECT 1 FROM pilotage_decisions WHERE smsi_id=$1 AND source_ref=$2 AND source_version=$3 AND operation='step_validation' AND step=$4",
                [smsi, ref, source.version, previous.id],
              )
            ).rowCount
          )
            throw new HttpError(409, 'Validez d’abord : ' + previous.label);
      }
      if (input.operation === 'step_validation' && source.kind === 'journey') {
        await this.g.permission(user, 'pilotage', 'administrer');
        if (input.result !== 'completed') throw new HttpError(422, 'Validation d’étape attendue.');
        const step = JOURNEY_STEPS.find((s) => s.id === input.step);
        if (!step) throw new HttpError(422, 'Étape inconnue.');
        if (!input.refs.length) throw new HttpError(422, 'Reliez les travaux réellement réalisés à cette étape.');
        const resolved = await Promise.all(input.refs.map((r) => this.g.resolve(smsi, r, user, c)));
        if (!resolved.some((r) => (step.kinds as readonly string[]).includes(r.kind) || r.ref.startsWith('document:')))
          throw new HttpError(422, 'Une référence correspondant aux travaux de cette étape est requise.');
        const index = JOURNEY_STEPS.indexOf(step);
        for (const previous of JOURNEY_STEPS.slice(0, index)) {
          if (
            !(
              await c.query(
                "SELECT 1 FROM pilotage_decisions WHERE smsi_id=$1 AND source_ref=$2 AND source_version=$3 AND operation='step_validation' AND step=$4",
                [smsi, ref, source.version, previous.id],
              )
            ).rowCount
          )
            throw new HttpError(409, 'Validez d’abord : ' + previous.label);
        }
        if (
          !String(data.organisation ?? '').trim() ||
          !String(data.scope ?? '').trim() ||
          !String(data.goals ?? '').trim()
        )
          throw new HttpError(422, 'Renseignez organisation, périmètre et objectifs du parcours.');
        if (
          data.approach === 'hds' &&
          (!String(data.hdsActivities ?? '').trim() || !String(data.hdsApplicability ?? '').trim())
        )
          throw new HttpError(422, 'Justifiez les activités et le périmètre HDS retenus.');
      }
      if (
        input.operation === 'action_create' &&
        (!input.createAction || input.result !== 'completed' || data.status === 'closed')
      )
        throw new HttpError(422, 'Action à créer sur une fiche ouverte attendue.');
      const generated: string[] = [];
      if (input.createFinding) {
        const finding = await this.finding(
          c,
          smsi,
          'Écart du contrôle : ' + source.name,
          { description: input.note, origin: 'control', cause: '', refs: [ref, ...input.refs] },
          user,
          ip,
        );
        generated.push('object:' + finding.id);
      }
      if (input.createAction)
        generated.push(
          await this.action(c, smsi, generated[0] ?? ref, 'Action : ' + source.name, data.ownerId, user, ip),
        );
      if (input.operation !== 'step_validation') {
        data.refs = [...new Set([...(Array.isArray(data.refs) ? data.refs : []), ...input.refs])];
        if (isLegacy) {
          const [, key, ...ids] = ref.split(':');
          const fresh = await this.legacy.get(smsi, key!, ids.join(':'), user, c, true);
          const next = this.legacy.merge(key!, fresh.raw, source.name, data, user.username);
          await this.legacy.save(
            c,
            key!,
            ids.join(':'),
            next,
            fresh.state.data,
            fresh.state.version,
            user,
            ip,
            input.note,
          );
        } else await this.g.write(c, source, source.name, data, user, ip, input.note);
      }
      const row = (
        await c.query(
          `INSERT INTO pilotage_decisions(smsi_id,source_ref,source_version,operation,step,result,performed_on,note,refs,snapshot,generated_refs,request_id,intent_hash,created_by,terms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING ${columns}`,
          [
            smsi,
            ref,
            source.version,
            input.operation,
            input.step,
            input.result,
            input.date,
            input.note,
            JSON.stringify(input.refs),
            JSON.stringify(source),
            JSON.stringify(generated),
            input.requestId,
            intentHash,
            user.username,
            JSON.stringify(terms),
          ],
        )
      ).rows[0]!;
      await this.g.db.audit(
        user,
        ip,
        'pilotage.' + input.operation,
        ref,
        { decisionId: row.id, result: input.result, generated },
        c,
      );
      await this.g.notify(c, ref, source.version, smsi, GRC_MODULES[source.kind], user.username);
      return row;
    }, user.username);
  }
  async finding(c: Client, smsi: string, name: string, data: Record<string, unknown>, user: SessionUser, ip: string) {
    await this.g.permission(user, 'ecarts', 'modifier');
    const normalized = await this.g.normalize(smsi, 'nonconformity', data, user, c);
    return this.g.insert(c, smsi, 'nonconformity', name, normalized, user, ip);
  }
  async schedule(smsi: string, ref: string, recurrence: unknown, expected: number, user: SessionUser, ip: string) {
    return this.g.db.tx(async (c) => {
      const o = await this.source(smsi, ref, user, c, true);
      if (o.kind !== 'control') throw new HttpError(422, 'Plan de contrôle attendu.');
      await c.query('SELECT id FROM grc_objects WHERE id=$1 FOR UPDATE', [o.id]);
      const current = await this.g.raw(o.id, c);
      if (!current || current.version !== expected) throw new HttpError(412, 'Le contrôle a changé.');
      if (current.data.seriesRef)
        throw new HttpError(409, 'Ce contrôle a déjà une planification ; modifiez la série existante.');
      await this.g.permission(user, 'ecarts', 'modifier');
      const policy = (await this.g.policy(smsi, user)).definition;
      const data = SeriesData.parse({
        description: 'Réaliser le contrôle : ' + o.name,
        ownerId: o.data.ownerId ?? null,
        category: policy.catalogues.actionCategories[0]!.id,
        priority: 'normal',
        refs: [ref],
        recurrence,
      });
      await this.g.normalize(smsi, 'task_series', data, user, c);
      const series = await this.g.insert(c, smsi, 'task_series', 'Contrôle périodique : ' + o.name, data, user, ip);
      await this.g.write(
        c,
        current,
        current.name,
        {
          ...current.data,
          seriesRef: 'object:' + series.id,
          refs: [...new Set([...(Array.isArray(current.data.refs) ? current.data.refs : []), 'object:' + series.id])],
        },
        user,
        ip,
        'Planification récurrente du contrôle',
      );
      return series;
    }, user.username);
  }
  async journey(smsi: string, id: string, user: SessionUser) {
    const o = await this.g.object(smsi, id, user);
    if (o.kind !== 'journey') throw new HttpError(422, 'Parcours attendu.');
    const history = (
      await this.g.db.q(
        `SELECT ${columns} FROM pilotage_decisions WHERE smsi_id=$1 AND source_ref=$2 AND operation='step_validation' ORDER BY created_at DESC LIMIT 500`,
        [smsi, 'object:' + id],
      )
    ).rows;
    return {
      object: o,
      steps: JOURNEY_STEPS.map((step) => {
        const decision = history.find((h) => h.sourceVersion === o.version && h.step === step.id);
        return { ...step, state: decision ? 'completed' : 'todo', decision };
      }),
      history,
      note: 'Avancement des travaux, sans attestation de conformité ni certification.',
    };
  }
  async indicators(smsi: string, user: SessionUser) {
    await this.g.permission(user, 'ecarts', 'lire');
    const scope = await this.g.access(smsi, user);
    const masques = await this.g.registres.inaccessibles(user, smsi);
    const native = (await this.g.db.one<{
      findings: number;
      closed: number;
      effective: number;
      verified: number;
      days: number;
      samples: number;
    }>(
      `WITH findings AS (SELECT data,CASE WHEN pg_input_is_valid(NULLIF(data->>'closedAt',''),'date') THEN (data->>'closedAt')::date-(created_at AT TIME ZONE $2)::date END days FROM grc_objects WHERE smsi_id=$1 AND kind='nonconformity' AND NOT archived AND (registre_id IS NULL OR registre_id<>ALL($3::uuid[])))
       SELECT count(*)::int findings,count(*) FILTER(WHERE data->>'status'='closed')::int closed,count(*) FILTER(WHERE data->>'effectiveness'='effective')::int effective,count(*) FILTER(WHERE data->>'effectiveness' IN ('effective','ineffective'))::int verified,COALESCE(sum(days) FILTER(WHERE data->>'status'='closed' AND days>=0),0)::float8 days,count(*) FILTER(WHERE data->>'status'='closed' AND days>=0)::int samples FROM findings`,
      [smsi, scope.timezone, masques],
    ))!;
    const nativeCauses = (
      await this.g.db.q<{ cause: string; count: number }>(
        `SELECT trim(data->>'cause') cause,count(*)::int count FROM grc_objects WHERE smsi_id=$1 AND kind='nonconformity' AND NOT archived AND trim(COALESCE(data->>'cause',''))<>'' AND (registre_id IS NULL OR registre_id<>ALL($2::uuid[])) GROUP BY trim(data->>'cause') ORDER BY count DESC,cause LIMIT 1001`,
        [smsi, masques],
      )
    ).rows;
    const causes = new Map(nativeCauses.slice(0, 1000).map((r) => [r.cause, r.count]));
    const samples = native.samples;
    return {
      tasks: (await this.g.tasks.dashboard(smsi, user)).summary,
      findings: native.findings,
      closed: native.closed,
      effective: native.effective,
      verified: native.verified,
      meanDays: samples ? native.days / samples : null,
      durationSamples: samples,
      repeatedCauses: [...causes].filter(([, n]) => n > 1).map(([cause, count]) => ({ cause, count })),
      causesTruncated: nativeCauses.length > 1000,
      note:
        'Les délais sont exprimés en jours calendaires et portent uniquement sur les dates et causes réellement renseignées.' +
        (nativeCauses.length > 1000
          ? ' La liste des causes natives est limitée aux 1 000 plus fréquentes ; les compteurs et délais portent sur tout le registre.'
          : ''),
    };
  }
}
