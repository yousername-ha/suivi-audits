/* Rapprochements entre référentiels (ADR 0031, lot M3) : une mesure déclarée une fois pour une exigence peut couvrir
   l'exigence équivalente d'un autre référentiel rattaché, selon une correspondance VALIDÉE. Le système ne fait que
   PROPOSER : tant que le pilote n'a pas décidé, l'exigence reste « à valider », hors de toute couverture comptée.
   Confirmer crée un lien explicite « met en œuvre » au nom du pilote ; rejeter conserve le motif et ne se reproposera
   pas tant que la correspondance ne change pas. Les calculs sont des aides au pilotage, jamais un taux de conformité. */
import {
  effectivePermissions,
  etatExigence,
  evaluationEffective,
  exclusionInterdite,
  syntheseEtats,
  type EntreeSynthese,
  type FrameworkDefinition,
  type Permission,
  type RapprochementDecision,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { sql } from 'kysely';
import { surConnexion, type Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { NotificationEmise } from '../notifications-metier.js';
import { loadGrants } from '../rights.js';
import type { Grc } from './core.js';

type Status = 'pending' | 'confirmed' | 'rejected' | 'withdrawn';
interface Candidate {
  measure: string;
  source: string;
  target: string;
  mappingId: string;
  type: string;
  coverage: number;
}
const SYMETRIQUES = new Set(['identical', 'equivalent']);

/** « requirement:<référentiel>:<version>:<identifiant> » : l'identifiant d'exigence peut contenir « : ». */
export function parseRequirementRef(ref: string) {
  const [kind, fw, version, ...rest] = ref.split(':');
  if (kind !== 'requirement' || !fw || !version || !rest.length) return null;
  return { frameworkId: fw, version: Number(version), requirementId: rest.join(':') };
}
const requirementRef = (fw: string, v: number, id: string) => `requirement:${fw}:${v}:${id}`;
/** Compte actif : ni désactivé, ni expiré (fragment SQL fixe sur l'alias u). */
const COMPTE_ACTIF = sql<boolean>`(NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at > now()))`;

export class GrcRapprochements {
  constructor(private readonly g: Grc) {}

  /** Comptes qui décident des rapprochements : écriture sur le périmètre et droit `pilotage:modifier`. */
  private async pilots(c: Client, smsi: string): Promise<string[]> {
    const k = surConnexion(c);
    const s = await k.selectFrom('grc_smsis').select('visibility').where('id', '=', smsi).executeTakeFirst();
    const candidates =
      s?.visibility === 'instance'
        ? await k.selectFrom('users as u').select('u.id').where(COMPTE_ACTIF).execute()
        : await k
            .selectFrom('grc_members as m')
            .innerJoin('users as u', 'u.id', 'm.user_id')
            .select('u.id')
            .where('m.smsi_id', '=', smsi)
            .where('m.can_write', '=', true)
            .where(COMPTE_ACTIF)
            .execute();
    const out: string[] = [];
    for (const { id } of candidates) {
      const perms = effectivePermissions(await loadGrants(c, id));
      if (perms.has('pilotage:modifier' as Permission) && perms.has('conformite:lire' as Permission)) out.push(id);
    }
    return out;
  }

  /** Recalcule les propositions du périmètre à partir des liens, des rattachements et des correspondances validées.
      Idempotent. Renvoie le nombre de propositions nouvelles (ou rouvertes) et prévient les pilotes, par mesure. */
  async sync(smsi: string, c: Client): Promise<number> {
    // Référentiels actifs du périmètre : rattachements propres et hérités (hiérarchie des périmètres, lot H1).
    const attached = new Map(
      (await this.g.effectiveFrameworks(smsi, c)).filter((a) => a.enabled).map((a) => [a.frameworkId, a.version]),
    );
    const k = surConnexion(c);
    const candidates = new Map<string, Candidate>();
    if (attached.size) {
      const links = await k
        .selectFrom('grc_links')
        .select(['source_ref', 'target_ref'])
        .where('smsi_id', '=', smsi)
        .where('type', '=', 'implements')
        .where('source_ref', 'like', 'object:%')
        .where('target_ref', 'like', 'requirement:%')
        .execute();
      const explicit = new Set(links.map((l) => l.source_ref + '|' + l.target_ref));
      const ids = [...attached.keys()];
      const mappings = await k
        .selectFrom('lib_mappings')
        .select([
          'id',
          'type',
          'coverage',
          'source_framework_id',
          'source_version',
          'source_requirement_id',
          'target_framework_id',
          'target_version',
          'target_requirement_id',
        ])
        .where('status', '=', 'validated')
        .where('type', '<>', 'none')
        .where((eb) => eb.or([eb('source_framework_id', 'in', ids), eb('target_framework_id', 'in', ids)]))
        .execute();
      for (const link of links) {
        const req = parseRequirementRef(link.target_ref);
        if (!req || attached.get(req.frameworkId) !== req.version) continue;
        for (const m of mappings) {
          let other: { fw: string; v: number; id: string } | null = null;
          if (
            m.source_framework_id === req.frameworkId &&
            m.source_version === req.version &&
            m.source_requirement_id === req.requirementId
          )
            other = { fw: m.target_framework_id, v: m.target_version, id: m.target_requirement_id };
          else if (
            SYMETRIQUES.has(m.type) &&
            m.target_framework_id === req.frameworkId &&
            m.target_version === req.version &&
            m.target_requirement_id === req.requirementId
          )
            other = { fw: m.source_framework_id, v: m.source_version, id: m.source_requirement_id };
          if (!other || attached.get(other.fw) !== other.v) continue;
          const target = requirementRef(other.fw, other.v, other.id);
          if (explicit.has(link.source_ref + '|' + target)) continue;
          candidates.set(`${link.source_ref}|${target}|${m.id}`, {
            measure: link.source_ref,
            source: link.target_ref,
            target,
            mappingId: m.id,
            type: m.type,
            coverage: m.coverage,
          });
        }
      }
    }
    const created: Candidate[] = [];
    for (const cand of candidates.values()) {
      // Nouvelle proposition, ou proposition retirée qui redevient justifiée ; une décision prise n'est jamais rouverte.
      const r = await k
        .insertInto('grc_rapprochements')
        .values({
          smsi_id: smsi,
          measure_ref: cand.measure,
          source_ref: cand.source,
          target_ref: cand.target,
          mapping_id: cand.mappingId,
          mapping_type: cand.type,
          coverage: cand.coverage,
          status: 'pending',
        })
        .onConflict((oc) =>
          oc
            .columns(['smsi_id', 'measure_ref', 'target_ref', 'mapping_id'])
            .doUpdateSet({ status: 'pending', decided_by: null, decided_at: null })
            .where('grc_rapprochements.status', '=', 'withdrawn'),
        )
        .returning('id')
        .executeTakeFirst();
      if (r) created.push(cand);
    }
    // Les propositions en attente qui ne se justifient plus (lien retiré, référentiel détaché, correspondance retirée,
    // exigence déjà liée) sont retirées ; les décisions prises (confirmées, rejetées) ne changent jamais.
    const pending = await k
      .selectFrom('grc_rapprochements')
      .select(['id', 'measure_ref', 'target_ref', 'mapping_id'])
      .where('smsi_id', '=', smsi)
      .where('status', '=', 'pending')
      .execute();
    const stale = pending
      .filter((p) => !candidates.has(`${p.measure_ref}|${p.target_ref}|${p.mapping_id}`))
      .map((p) => p.id);
    if (stale.length)
      await k
        .updateTable('grc_rapprochements')
        .set({ status: 'withdrawn' })
        .where('id', 'in', stale)
        .where('status', '=', 'pending')
        .execute();
    if (created.length) await this.notify(c, smsi, created);
    return created.length;
  }

  /** Une notification par mesure et par pilote, regroupant ses nouvelles propositions (« Mes rappels »). */
  private async notify(c: Client, smsi: string, created: Candidate[]) {
    const pilots = await this.pilots(c, smsi);
    if (!pilots.length) return;
    const k = surConnexion(c);
    const byMeasure = new Map<string, Candidate[]>();
    for (const cand of created) byMeasure.set(cand.measure, [...(byMeasure.get(cand.measure) ?? []), cand]);
    for (const [ref, list] of byMeasure) {
      const id = ref.slice('object:'.length);
      const o = await k
        .selectFrom('grc_objects')
        .select('name')
        .where('id', '=', id)
        .where('smsi_id', '=', smsi)
        .executeTakeFirst();
      if (!o) continue;
      const key = list
        .map((x) => x.target + x.mappingId)
        .sort()
        .join('|');
      for (const user of pilots) {
        const r: NotificationEmise[] = await k
          .insertInto('grc_notifications')
          .values({
            smsi_id: smsi,
            object_id: id,
            user_id: user,
            kind: 'rapprochement',
            due_key: sql<string>`md5(${key})`,
            title: 'Rapprochements à valider',
            message: `${list.length} rapprochement(s) à valider pour la mesure « ${o.name} » : décidez de les confirmer ou de les rejeter.`,
          })
          .onConflict((oc) => oc.doNothing())
          .returning(['id', 'user_id as userId', 'kind'])
          .execute();
        // Réglages de notification par groupe, rôle et utilisateur (ADR 0058) : visibilité dans Rappels et courriel éventuel.
        await this.g.notificationsMetier?.diffuser(c, r);
      }
    }
  }

  /** Après un changement de correspondance : recalcule chaque périmètre qui utilise l'un des référentiels. */
  async syncFrameworks(frameworkIds: string[]) {
    const directs = frameworkIds.length
      ? (
          await this.g.db.k
            .selectFrom('grc_scope_frameworks')
            .select('smsi_id')
            .distinct()
            .where('framework_id', 'in', frameworkIds)
            .execute()
        ).map((r) => r.smsi_id)
      : [];
    // Les périmètres qui en héritent sont recalculés aussi.
    const smsis = new Set(directs);
    for (const d of directs) for (const h of await this.g.heritiers(d)) smsis.add(h);
    for (const smsi_id of smsis) await this.g.db.tx((c) => this.sync(smsi_id, c), 'Automate SMSI');
  }

  /** Actualisation à la demande du pilote. */
  async refresh(smsi: string, user: SessionUser) {
    await this.g.permission(user, 'pilotage', 'modifier');
    await this.g.access(smsi, user, true);
    const created = await this.g.db.tx((c) => this.sync(smsi, c), user.username);
    return { created, ...(await this.summary(smsi, user)) };
  }

  async summary(smsi: string, user: SessionUser) {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    const r = await this.g.db.k
      .selectFrom('grc_rapprochements')
      .select(sql<number>`count(*)::int`.as('pending'))
      .where('smsi_id', '=', smsi)
      .where('status', '=', 'pending')
      .executeTakeFirstOrThrow();
    return { pending: r.pending };
  }

  private async definitions(pairs: { frameworkId: string; version: number }[]) {
    const out = new Map<string, { identifier: string; name: string; definition: FrameworkDefinition }>();
    for (const p of pairs) {
      const key = `${p.frameworkId}:${p.version}`;
      if (out.has(key)) continue;
      const r = await this.g.db.k
        .selectFrom('lib_framework_versions as v')
        .innerJoin('lib_frameworks as f', 'f.id', 'v.framework_id')
        .select(['f.identifier', 'f.name', 'v.definition'])
        .where('v.framework_id', '=', p.frameworkId)
        .where('v.version', '=', p.version)
        .executeTakeFirst();
      // Définitions écrites après validation (LibraryFrameworkDefinition) : relues telles quelles.
      if (r) out.set(key, { ...r, definition: r.definition as FrameworkDefinition });
    }
    return out;
  }

  private describe(defs: Awaited<ReturnType<GrcRapprochements['definitions']>>, ref: string) {
    const p = parseRequirementRef(ref);
    if (!p) return { ref, framework: '', requirementId: ref, title: '' };
    const d = defs.get(`${p.frameworkId}:${p.version}`);
    return {
      ref,
      frameworkId: p.frameworkId,
      version: p.version,
      framework: d?.name ?? '',
      requirementId: p.requirementId,
      title: d?.definition.requirements.find((r) => r.id === p.requirementId)?.title ?? '',
    };
  }

  async list(smsi: string, user: SessionUser, filter: { status?: string; frameworkId?: string } = {}) {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    // Dates renvoyées telles quelles (sérialisées en ISO par la réponse), comme avant la conversion.
    const rows = await this.g.db.k
      .selectFrom('grc_rapprochements as r')
      .innerJoin('lib_mappings as m', 'm.id', 'r.mapping_id')
      .selectAll('r')
      .select(['m.justification', 'm.validated_by', 'm.validated_at'])
      .where('r.smsi_id', '=', smsi)
      .$if(!!filter.status, (q) => q.where('r.status', '=', filter.status as Status))
      .$if(!!filter.frameworkId, (q) =>
        q.where('r.target_ref', 'like', sql<string>`'requirement:' || ${filter.frameworkId} || ':%'`),
      )
      .orderBy(sql`(r.status = 'pending')`, 'desc')
      .orderBy('r.created_at', 'desc')
      .orderBy('r.id')
      .limit(500)
      .execute();
    const pairs = rows
      .flatMap((r) => [parseRequirementRef(r.source_ref), parseRequirementRef(r.target_ref)])
      .filter((x) => !!x);
    const defs = await this.definitions(pairs as { frameworkId: string; version: number }[]);
    const mesures = [...new Set(rows.map((r) => r.measure_ref.slice('object:'.length)))];
    const names = new Map(
      (mesures.length
        ? await this.g.db.k
            .selectFrom('grc_objects')
            .select(['id', 'name'])
            .where('smsi_id', '=', smsi)
            .where('id', 'in', mesures)
            .execute()
        : []
      ).map((o) => [o.id, o.name]),
    );
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      coverage: r.coverage,
      mappingId: r.mapping_id,
      mappingType: r.mapping_type,
      justification: r.justification,
      validatedBy: r.validated_by,
      validatedAt: r.validated_at,
      measure: { ref: r.measure_ref, name: names.get(r.measure_ref.slice('object:'.length)) ?? '' },
      source: this.describe(defs, r.source_ref),
      target: this.describe(defs, r.target_ref),
      decidedBy: r.decided_by,
      decidedAt: r.decided_at,
      decisionNote: r.decision_note,
      createdAt: r.created_at,
    }));
  }

  /** Décision du pilote, proposition par proposition (chacune dans sa propre transaction : un échec n'arrête pas le lot). */
  async decide(smsi: string, input: RapprochementDecision, user: SessionUser, ip: string) {
    await this.g.permission(user, 'pilotage', 'modifier');
    await this.g.access(smsi, user, true);
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of input.ids) {
      try {
        await this.g.db.tx(async (c, k) => {
          const r = await k
            .selectFrom('grc_rapprochements')
            .selectAll()
            .where('id', '=', id)
            .where('smsi_id', '=', smsi)
            .forUpdate()
            .executeTakeFirst();
          if (!r) throw new HttpError(404, 'Proposition introuvable.');
          if (r.status !== 'pending') throw new HttpError(409, 'Cette proposition a déjà été décidée ou retirée.');
          await k
            .updateTable('grc_rapprochements')
            .set({
              status: input.decision === 'confirm' ? 'confirmed' : 'rejected',
              decided_by: user.username,
              decided_at: sql<Date>`now()`,
              decision_note: input.note,
            })
            .where('id', '=', id)
            .execute();
          if (input.decision === 'confirm')
            await this.g.linkIn(
              c,
              smsi,
              r.measure_ref,
              r.target_ref,
              'implements',
              `Rapprochement confirmé (correspondance ${r.mapping_type}, ${r.coverage} %)${input.note ? ' : ' + input.note : ''}`.slice(
                0,
                2000,
              ),
              user,
              ip,
            );
          await this.g.db.audit(
            user,
            ip,
            input.decision === 'confirm' ? 'grc.rapprochement.confirmed' : 'grc.rapprochement.rejected',
            id,
            { smsiId: smsi, measure: r.measure_ref, target: r.target_ref, mappingId: r.mapping_id },
            c,
          );
        }, user.username);
        results.push({ id, ok: true });
      } catch (e) {
        if (!(e instanceof HttpError))
          this.g.db.log.error({ err: e instanceof Error ? e.message : String(e), id }, 'rapprochement decision failed');
        results.push({
          id,
          ok: false,
          error: e instanceof HttpError ? e.message : 'Erreur interne lors de la décision.',
        });
      }
    }
    return { results, ...(await this.summary(smsi, user)) };
  }

  /** Vue commune : par référentiel rattaché, exigences couvertes explicitement, rapprochements à valider et non couvertes ;
      avec `frameworkId`, le détail par exigence et les mesures reliées. Indicateurs d'aide au pilotage. */
  async coverage(smsi: string, user: SessionUser, frameworkId?: string) {
    await this.g.permission(user, 'conformite', 'lire');
    await this.g.access(smsi, user);
    const effectifs = (await this.g.effectiveFrameworks(smsi)).filter((e) => e.enabled);
    // Version effective de chaque référentiel actif : une seule par référentiel (effectiveFrameworks).
    const versions = new Map(effectifs.map((e) => [e.frameworkId, e.version]));
    const attached = effectifs.length
      ? (
          await this.g.db.k
            .selectFrom('lib_frameworks as f')
            .select(['f.id as framework_id', 'f.name', 'f.identifier'])
            .where('f.id', 'in', [...versions.keys()])
            .orderBy('f.name')
            .orderBy('f.id')
            .execute()
        ).map((f) => ({ ...f, version: versions.get(f.framework_id)! }))
      : [];
    const links = await this.g.db.k
      .selectFrom('grc_links')
      .select(['source_ref', 'target_ref'])
      .where('smsi_id', '=', smsi)
      .where('type', '=', 'implements')
      .where('target_ref', 'like', 'requirement:%')
      .execute();
    const explicit = new Map<string, string[]>();
    for (const l of links) explicit.set(l.target_ref, [...(explicit.get(l.target_ref) ?? []), l.source_ref]);
    const toValidate = new Set(
      (
        await this.g.db.k
          .selectFrom('grc_rapprochements')
          .select('target_ref')
          .distinct()
          .where('smsi_id', '=', smsi)
          .where('status', '=', 'pending')
          .execute()
      ).map((r) => r.target_ref),
    );
    const defs = await this.definitions(attached.map((a) => ({ frameworkId: a.framework_id, version: a.version })));
    const measureNames = new Map(
      (
        await this.g.db.k
          .selectFrom('grc_objects')
          .select(['id', 'name'])
          .where('smsi_id', '=', smsi)
          .where('kind', '=', 'measure')
          .execute()
      ).map((o) => ['object:' + o.id, o.name]),
    );
    const evaluations = await this.g.evaluations.courantes(
      smsi,
      attached.map((a) => a.framework_id),
    );
    const frameworks = attached.map((a) => {
      const definition = defs.get(`${a.framework_id}:${a.version}`)?.definition;
      const reqs = definition?.requirements ?? [];
      let covered = 0,
        pending = 0;
      const etats: EntreeSynthese[] = [];
      for (const r of reqs) {
        const ref = requirementRef(a.framework_id, a.version, r.id);
        if (explicit.has(ref)) covered++;
        else if (toValidate.has(ref)) pending++;
        const obligatoire = !!definition && exclusionInterdite(definition, r.domain);
        const evaluation = evaluationEffective(evaluations.get(`${a.framework_id}:${r.id}`) ?? null, obligatoire);
        etats.push({
          etat: etatExigence(evaluation),
          applicability: evaluation?.applicability ?? 'a_determiner',
          obligatoire,
        });
      }
      return {
        frameworkId: a.framework_id,
        identifier: a.identifier,
        name: a.name,
        version: a.version,
        /** Périmètre qui porte le rattachement (le périmètre lui-même, ou l'ancêtre dont il hérite). */
        origineId: effectifs.find((e) => e.frameworkId === a.framework_id)?.origineId ?? smsi,
        requirements: reqs.length,
        covered,
        toValidate: pending,
        uncovered: reqs.length - covered - pending,
        etats: syntheseEtats(etats),
      };
    });
    const detail = frameworkId
      ? (() => {
          const a = attached.find((x) => x.framework_id === frameworkId);
          if (!a) throw new HttpError(404, 'Référentiel non rattaché à ce périmètre.');
          const definition = defs.get(`${a.framework_id}:${a.version}`)?.definition;
          return (definition?.requirements ?? []).slice(0, 1000).map((r) => {
            const ref = requirementRef(a.framework_id, a.version, r.id);
            const measures = (explicit.get(ref) ?? []).map((m) => ({ ref: m, name: measureNames.get(m) ?? '' }));
            const obligatoire = !!definition && exclusionInterdite(definition, r.domain);
            const enregistree = evaluations.get(`${a.framework_id}:${r.id}`) ?? null;
            const evaluation = evaluationEffective(enregistree, obligatoire);
            const etat = etatExigence(evaluation);
            return {
              id: r.id,
              title: r.title,
              status: measures.length ? 'covered' : toValidate.has(ref) ? 'to_validate' : 'uncovered',
              measures,
              evaluation,
              etat,
              obligatoire,
              exclusionIllicite: obligatoire && enregistree?.applicability === 'exclue',
              // Une mise en œuvre déclarée sans mesure reliée : à justifier, jamais comptée comme preuve.
              sansMesure:
                !measures.length &&
                (etat === 'partiel' || etat === 'implemente' || etat === 'teste' || etat === 'valide_metier'),
            };
          });
        })()
      : null;
    return { frameworks, detail };
  }
}
