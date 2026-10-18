/* Rapprochements entre référentiels (ADR 0031, lot M3) : une mesure déclarée une fois pour une exigence peut couvrir
   l'exigence équivalente d'un autre référentiel rattaché, selon une correspondance VALIDÉE. Le système ne fait que
   PROPOSER : tant que le pilote n'a pas décidé, l'exigence reste « à valider », hors de toute couverture comptée.
   Confirmer crée un lien explicite « met en œuvre » au nom du pilote ; rejeter conserve le motif et ne se reproposera
   pas tant que la correspondance ne change pas. Les calculs sont des aides au pilotage, jamais un taux de conformité. */
import {
  effectivePermissions,
  etatExigence,
  syntheseEtats,
  type EtatExigence,
  type FrameworkDefinition,
  type Permission,
  type RapprochementDecision,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { loadGrants } from '../rights.js';
import type { Grc } from './core.js';

type Status = 'pending' | 'confirmed' | 'rejected' | 'withdrawn';
interface Row {
  id: string;
  measure_ref: string;
  source_ref: string;
  target_ref: string;
  mapping_id: string;
  mapping_type: string;
  coverage: number;
  status: Status;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
}
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

export class GrcRapprochements {
  constructor(private readonly g: Grc) {}

  /** Comptes qui décident des rapprochements : écriture sur le périmètre et droit `pilotage:modifier`. */
  private async pilots(c: Client, smsi: string): Promise<string[]> {
    const s = (await c.query<{ visibility: string }>('SELECT visibility FROM grc_smsis WHERE id=$1', [smsi])).rows[0];
    const candidates =
      s?.visibility === 'instance'
        ? await c.query<{ id: string }>(
            'SELECT id FROM users WHERE NOT disabled AND (expires_at IS NULL OR expires_at>now())',
          )
        : await c.query<{ id: string }>(
            `SELECT u.id FROM grc_members m JOIN users u ON u.id=m.user_id
              WHERE m.smsi_id=$1 AND m.can_write AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now())`,
            [smsi],
          );
    const out: string[] = [];
    for (const { id } of candidates.rows) {
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
    const candidates = new Map<string, Candidate>();
    if (attached.size) {
      const links = (
        await c.query<{ source_ref: string; target_ref: string }>(
          `SELECT source_ref,target_ref FROM grc_links WHERE smsi_id=$1 AND type='implements'
             AND source_ref LIKE 'object:%' AND target_ref LIKE 'requirement:%'`,
          [smsi],
        )
      ).rows;
      const explicit = new Set(links.map((l) => l.source_ref + '|' + l.target_ref));
      const ids = [...attached.keys()];
      const mappings = (
        await c.query<{
          id: string;
          type: string;
          coverage: number;
          source_framework_id: string;
          source_version: number;
          source_requirement_id: string;
          target_framework_id: string;
          target_version: number;
          target_requirement_id: string;
        }>(
          `SELECT id,type,coverage,source_framework_id,source_version,source_requirement_id,target_framework_id,target_version,
                  target_requirement_id FROM lib_mappings
            WHERE status='validated' AND type<>'none' AND (source_framework_id=ANY($1::uuid[]) OR target_framework_id=ANY($1::uuid[]))`,
          [ids],
        )
      ).rows;
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
      const r = await c.query(
        `INSERT INTO grc_rapprochements(smsi_id,measure_ref,source_ref,target_ref,mapping_id,mapping_type,coverage,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,'pending')
         ON CONFLICT(smsi_id,measure_ref,target_ref,mapping_id) DO UPDATE SET status='pending',decided_by=NULL,decided_at=NULL
           WHERE grc_rapprochements.status='withdrawn'
         RETURNING id`,
        [smsi, cand.measure, cand.source, cand.target, cand.mappingId, cand.type, cand.coverage],
      );
      if (r.rowCount) created.push(cand);
    }
    // Les propositions en attente qui ne se justifient plus (lien retiré, référentiel détaché, correspondance retirée,
    // exigence déjà liée) sont retirées ; les décisions prises (confirmées, rejetées) ne changent jamais.
    const pending = (
      await c.query<{ id: string; measure_ref: string; target_ref: string; mapping_id: string }>(
        `SELECT id,measure_ref,target_ref,mapping_id FROM grc_rapprochements WHERE smsi_id=$1 AND status='pending'`,
        [smsi],
      )
    ).rows;
    const stale = pending
      .filter((p) => !candidates.has(`${p.measure_ref}|${p.target_ref}|${p.mapping_id}`))
      .map((p) => p.id);
    if (stale.length)
      await c.query(`UPDATE grc_rapprochements SET status='withdrawn' WHERE id=ANY($1::uuid[]) AND status='pending'`, [
        stale,
      ]);
    if (created.length) await this.notify(c, smsi, created);
    return created.length;
  }

  /** Une notification par mesure et par pilote, regroupant ses nouvelles propositions (« Mes rappels »). */
  private async notify(c: Client, smsi: string, created: Candidate[]) {
    const pilots = await this.pilots(c, smsi);
    if (!pilots.length) return;
    const byMeasure = new Map<string, Candidate[]>();
    for (const cand of created) byMeasure.set(cand.measure, [...(byMeasure.get(cand.measure) ?? []), cand]);
    for (const [ref, list] of byMeasure) {
      const id = ref.slice('object:'.length);
      const o = (await c.query<{ name: string }>('SELECT name FROM grc_objects WHERE id=$1 AND smsi_id=$2', [id, smsi]))
        .rows[0];
      if (!o) continue;
      const key = list
        .map((x) => x.target + x.mappingId)
        .sort()
        .join('|');
      for (const user of pilots)
        await c.query(
          `INSERT INTO grc_notifications(smsi_id,object_id,user_id,kind,due_key,title,message)
           VALUES($1,$2,$3,'rapprochement',md5($4),$5,$6) ON CONFLICT DO NOTHING`,
          [
            smsi,
            id,
            user,
            key,
            'Rapprochements à valider',
            `${list.length} rapprochement(s) à valider pour la mesure « ${o.name} » : décidez de les confirmer ou de les rejeter.`,
          ],
        );
    }
  }

  /** Après un changement de correspondance : recalcule chaque périmètre qui utilise l'un des référentiels. */
  async syncFrameworks(frameworkIds: string[]) {
    const directs = (
      await this.g.db.q<{ smsi_id: string }>(
        'SELECT DISTINCT smsi_id FROM grc_scope_frameworks WHERE framework_id=ANY($1::uuid[])',
        [frameworkIds],
      )
    ).rows.map((r) => r.smsi_id);
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
    const r = (
      await this.g.db.q<{ pending: number }>(
        `SELECT count(*)::int AS pending FROM grc_rapprochements WHERE smsi_id=$1 AND status='pending'`,
        [smsi],
      )
    ).rows[0]!;
    return { pending: r.pending };
  }

  private async definitions(pairs: { frameworkId: string; version: number }[]) {
    const out = new Map<string, { identifier: string; name: string; definition: FrameworkDefinition }>();
    for (const p of pairs) {
      const key = `${p.frameworkId}:${p.version}`;
      if (out.has(key)) continue;
      const r = (
        await this.g.db.q<{ identifier: string; name: string; definition: FrameworkDefinition }>(
          `SELECT f.identifier,f.name,v.definition FROM lib_framework_versions v JOIN lib_frameworks f ON f.id=v.framework_id
            WHERE v.framework_id=$1 AND v.version=$2`,
          [p.frameworkId, p.version],
        )
      ).rows[0];
      if (r) out.set(key, r);
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
    const rows = (
      await this.g.db.q<
        Row & { v_type: string; justification: string; validated_by: string | null; validated_at: string | null }
      >(
        `SELECT r.*,m.justification,m.validated_by,m.validated_at FROM grc_rapprochements r JOIN lib_mappings m ON m.id=r.mapping_id
          WHERE r.smsi_id=$1 AND ($2::text IS NULL OR r.status=$2) AND ($3::text IS NULL OR r.target_ref LIKE 'requirement:'||$3||':%')
          ORDER BY (r.status='pending') DESC,r.created_at DESC,r.id LIMIT 500`,
        [smsi, filter.status ?? null, filter.frameworkId ?? null],
      )
    ).rows;
    const pairs = rows
      .flatMap((r) => [parseRequirementRef(r.source_ref), parseRequirementRef(r.target_ref)])
      .filter((x) => !!x);
    const defs = await this.definitions(pairs as { frameworkId: string; version: number }[]);
    const names = new Map(
      (
        await this.g.db.q<{ id: string; name: string }>(
          'SELECT id,name FROM grc_objects WHERE smsi_id=$1 AND id=ANY($2::uuid[])',
          [smsi, [...new Set(rows.map((r) => r.measure_ref.slice('object:'.length)))]],
        )
      ).rows.map((o) => [o.id, o.name]),
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
        await this.g.db.tx(async (c) => {
          const r = (
            await c.query<Row>('SELECT * FROM grc_rapprochements WHERE id=$1 AND smsi_id=$2 FOR UPDATE', [id, smsi])
          ).rows[0];
          if (!r) throw new HttpError(404, 'Proposition introuvable.');
          if (r.status !== 'pending') throw new HttpError(409, 'Cette proposition a déjà été décidée ou retirée.');
          await c.query(
            `UPDATE grc_rapprochements SET status=$2,decided_by=$3,decided_at=now(),decision_note=$4 WHERE id=$1`,
            [id, input.decision === 'confirm' ? 'confirmed' : 'rejected', user.username, input.note],
          );
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
        results.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
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
    const attached = effectifs.length
      ? (
          await this.g.db.q<{ framework_id: string; version: number; name: string; identifier: string }>(
            `SELECT f.id AS framework_id,f.name,f.identifier,v.version
               FROM lib_frameworks f JOIN unnest($1::uuid[],$2::int[]) AS v(id,version) ON v.id=f.id
              ORDER BY f.name,f.id`,
            [effectifs.map((e) => e.frameworkId), effectifs.map((e) => e.version)],
          )
        ).rows
      : [];
    const links = (
      await this.g.db.q<{ source_ref: string; target_ref: string }>(
        `SELECT source_ref,target_ref FROM grc_links WHERE smsi_id=$1 AND type='implements' AND target_ref LIKE 'requirement:%'`,
        [smsi],
      )
    ).rows;
    const explicit = new Map<string, string[]>();
    for (const l of links) explicit.set(l.target_ref, [...(explicit.get(l.target_ref) ?? []), l.source_ref]);
    const toValidate = new Set(
      (
        await this.g.db.q<{ target_ref: string }>(
          `SELECT DISTINCT target_ref FROM grc_rapprochements WHERE smsi_id=$1 AND status='pending'`,
          [smsi],
        )
      ).rows.map((r) => r.target_ref),
    );
    const defs = await this.definitions(attached.map((a) => ({ frameworkId: a.framework_id, version: a.version })));
    const measureNames = new Map(
      (
        await this.g.db.q<{ id: string; name: string }>(
          'SELECT id,name FROM grc_objects WHERE smsi_id=$1 AND kind=$2',
          [smsi, 'measure'],
        )
      ).rows.map((o) => ['object:' + o.id, o.name]),
    );
    const evaluations = await this.g.evaluations.courantes(
      smsi,
      attached.map((a) => a.framework_id),
    );
    const frameworks = attached.map((a) => {
      const reqs = defs.get(`${a.framework_id}:${a.version}`)?.definition.requirements ?? [];
      let covered = 0,
        pending = 0;
      const etats: EtatExigence[] = [];
      for (const r of reqs) {
        const ref = requirementRef(a.framework_id, a.version, r.id);
        if (explicit.has(ref)) covered++;
        else if (toValidate.has(ref)) pending++;
        etats.push(etatExigence(evaluations.get(`${a.framework_id}:${r.id}`) ?? null));
      }
      return {
        frameworkId: a.framework_id,
        identifier: a.identifier,
        name: a.name,
        version: a.version,
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
          return (defs.get(`${a.framework_id}:${a.version}`)?.definition.requirements ?? []).slice(0, 1000).map((r) => {
            const ref = requirementRef(a.framework_id, a.version, r.id);
            const measures = (explicit.get(ref) ?? []).map((m) => ({ ref: m, name: measureNames.get(m) ?? '' }));
            const evaluation = evaluations.get(`${a.framework_id}:${r.id}`) ?? null;
            const etat = etatExigence(evaluation);
            return {
              id: r.id,
              title: r.title,
              status: measures.length ? 'covered' : toValidate.has(ref) ? 'to_validate' : 'uncovered',
              measures,
              evaluation,
              etat,
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
