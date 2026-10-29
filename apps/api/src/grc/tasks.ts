import {
  CalendrierBody,
  fenetreOccurrence,
  ICAL_MAX_JOURS,
  lireIcs,
  recurrenceSlot,
  SeriesData,
  type ApercuCalendrier,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { NotificationEmise } from '../notifications-metier.js';
import { COLONNES_OBJET, objets, versObjet, type Grc } from './core.js';
import { OCCURRENCE_VALIDEE, occurrenceValidee } from './cartes.js';

/** Actions non archivées d'un périmètre et des registres partagés avec lui, hors registres restreints illisibles (R05). */
const actionsVisibles = (k: Kdb, smsi: string, masques: string[], partages: string[]) => {
  let q = k
    .selectFrom('grc_objects as o')
    .where((eb) =>
      partages.length
        ? eb.or([eb('o.smsi_id', '=', smsi), eb('o.registre_id', 'in', partages)])
        : eb('o.smsi_id', '=', smsi),
    )
    .where('o.kind', '=', 'action')
    .where('o.archived', '=', false);
  if (masques.length)
    q = q.where((eb) => eb.or([eb('o.registre_id', 'is', null), eb('o.registre_id', 'not in', masques)]));
  return q;
};
/** Dernière décision de chaque occurrence (journal immuable, migration 030). */
const dernieresDecisions = (k: Kdb, ids: string[]) =>
  k
    .selectFrom('occurrence_validations')
    .distinctOn('objet_id')
    .select(['objet_id as id', 'kind', 'result', 'created_at as at', 'created_by as by'])
    .where('objet_id', 'in', ids)
    .orderBy('objet_id')
    .orderBy('seq', 'desc')
    .execute();
/** Occurrences d'une série avec l'action qui les porte. */
const occurrencesSerie = (k: Kdb, serie: string) =>
  k
    .selectFrom('grc_occurrences as s')
    .innerJoin('grc_objects as o', 'o.id', 's.action_id')
    .select(['s.slot', 's.action_id as actionId', 'o.name', 'o.data', 'o.version'])
    .where('s.series_id', '=', serie);
const versLigne = (r: { slot: string; actionId: string; name: string; data: unknown; version: number }) => ({
  ...r,
  data: r.data as Record<string, unknown>,
});

export class GrcTasks {
  constructor(private readonly g: Grc) {}
  async list(
    smsi: string,
    user: SessionUser,
    search: string,
    offset: number,
    filters: { status?: string; ownerId?: string },
  ) {
    const native = await this.g.listObjects(smsi, user, 'action', search, offset, filters);
    native.items = await this.avecValidation(native.items);
    const legacy = (await this.g.legacyTasks.list(smsi, user)).filter(
      (o) =>
        o.name.toLowerCase().includes(search.toLowerCase()) &&
        (!filters.status || o.data.status === filters.status) &&
        (!filters.ownerId || o.data.ownerId === filters.ownerId),
    );
    const remaining = 50 - native.items.length;
    const items = [
      ...native.items,
      ...legacy.slice(Math.max(0, offset - native.total), Math.max(0, offset - native.total) + remaining),
    ];
    const total = native.total + legacy.length;
    return { items, total, nextOffset: offset + 50 < total ? offset + 50 : null };
  }
  async window(smsi: string, user: SessionUser, from: string, to: string) {
    await this.g.access(smsi, user);
    await this.g.permission(user, 'ecarts', 'lire');
    // Les actions d'un registre restreint que la personne ne peut pas lire n'apparaissent pas (R05).
    const masques = await this.g.registres.inaccessiblesPartout(user);
    const partages = await this.g.registres.partagesLisibles(user, smsi);
    const echeance = sql<string | null>`o.data->>'dueAt'`;
    const items = await actionsVisibles(this.g.db.k, smsi, masques, partages)
      .select(COLONNES_OBJET)
      .where((eb) => eb.or([eb(echeance, 'is', null), eb.and([eb(echeance, '>=', from), eb(echeance, '<=', to)])]))
      .orderBy(echeance, (ob) => ob.asc().nullsLast())
      .orderBy('o.id')
      .limit(2001)
      .execute();
    const legacy = (await this.g.legacyTasks.list(smsi, user)).filter(
      (o) => !o.data.dueAt || (String(o.data.dueAt) >= from && String(o.data.dueAt) <= to),
    );
    if (items.length + legacy.length > 2000) throw new HttpError(422, 'Réduisez la période : plus de 2 000 actions.');
    return { items: [...(await this.avecValidation(items.map(versObjet))), ...legacy], from, to };
  }
  /** Joint à chaque occurrence de série sa dernière décision de validation (OK, KO, NA) ou sa réouverture : les vues de
      tâches montrent ainsi l'état réel de l'occurrence, que le statut d'action ne dit pas. */
  private async avecValidation<T extends { id: string; data: Record<string, unknown> }>(items: T[]) {
    const ids = items.filter((o) => o.data.seriesId).map((o) => o.id);
    if (!ids.length) return items;
    const lignes = await dernieresDecisions(this.g.db.k, ids);
    const parId = new Map(lignes.map((l) => [l.id, l]));
    return items.map((o) => {
      const l = parId.get(o.id);
      return {
        ...o,
        validation: l && l.kind === 'validation' ? { result: l.result, at: l.at.toISOString(), by: l.by } : null,
      };
    });
  }
  async dashboard(smsi: string, user: SessionUser) {
    await this.g.access(smsi, user);
    await this.g.permission(user, 'ecarts', 'lire');
    const policy = (await this.g.policy(smsi, user)).definition;
    const closed = policy.statuses.filter((s) => s.terminal).map((s) => s.id);
    const masques = await this.g.registres.inaccessiblesPartout(user);
    const partages = await this.g.registres.partagesLisibles(user, smsi);
    const statut = sql<string | null>`o.data->>'status'`;
    const totals = await actionsVisibles(this.g.db.k, smsi, masques, partages)
      .select([
        sql<number>`count(*)::int`.as('total'),
        sql<number>`count(*) FILTER (WHERE ${statut} = ANY(${closed}))::int`.as('closed'),
        sql<number>`count(*) FILTER (WHERE NOT (${statut} = ANY(${closed})) AND NOT ${occurrenceValidee} AND o.data->>'dueAt' < ${new Date().toISOString()})::int`.as(
          'overdue',
        ),
        sql<number>`count(*) FILTER (WHERE o.data->>'ownerId' IS NULL AND COALESCE(o.data->'responsable', 'null'::jsonb) = 'null'::jsonb)::int`.as(
          'unassigned',
        ),
      ])
      .executeTakeFirstOrThrow();
    const byStatus = await actionsVisibles(this.g.db.k, smsi, masques, partages)
      .select([statut.as('status'), sql<number>`count(*)::int`.as('count')])
      .groupBy(statut)
      .execute();
    const legacy = await this.g.legacyTasks.list(smsi, user);
    const counts = new Map(byStatus.map((r) => [String(r.status), Number(r.count)]));
    for (const item of legacy) {
      const terminal = closed.includes(String(item.data.status)) || item.data.status === 'done';
      totals.total++;
      if (terminal) totals.closed++;
      if (!terminal && item.data.dueAt && String(item.data.dueAt) < new Date().toISOString()) totals.overdue++;
      if (!item.data.ownerId && !item.data.responsable) totals.unassigned++;
      const status = String(item.data.status);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return { summary: totals, byStatus: [...counts].map(([status, count]) => ({ status, count })) };
  }
  /** Occurrences d'une série, de la plus récente à la plus ancienne, avec leur fenêtre de réalisation et l'état de leur
      validation (journal immuable : migration 030). */
  async occurrences(smsi: string, id: string, user: SessionUser, before?: string) {
    const o = await this.g.object(smsi, id, user);
    if (o.kind !== 'task_series') throw new HttpError(422, 'Série attendue.');
    const lignes = await occurrencesSerie(this.g.db.k, id)
      .$if(before != null, (q) => q.where('s.slot', '<', before!))
      .orderBy('s.slot', 'desc')
      .limit(50)
      .execute();
    return this.enrichir(o.data, lignes.map(versLigne));
  }
  private async enrichir<T extends { actionId: string; data: Record<string, unknown> }>(
    serie: Record<string, unknown>,
    lignes: T[],
    maintenant = new Date(),
  ) {
    const recurrence = SeriesData.parse(serie).recurrence;
    const derniers = lignes.length
      ? await dernieresDecisions(
          this.g.db.k,
          lignes.map((l) => l.actionId),
        )
      : [];
    const parId = new Map(derniers.map((d) => [d.id, d]));
    return lignes.map((l) => {
      const d = parId.get(l.actionId);
      const etat = !d ? 'ouverte' : d.kind === 'validation' ? 'validee' : 'rouverte';
      const dueAt = typeof l.data.dueAt === 'string' ? l.data.dueAt : null;
      return {
        ...l,
        fenetre: dueAt ? fenetreOccurrence(recurrence, dueAt, maintenant) : null,
        validation: { etat, result: etat === 'validee' ? d!.result : null },
      };
    });
  }
  /** Occurrence suivante à traiter : la plus ancienne qui n'est pas validée et dont la fenêtre est ouverte (enchaînement
      après une validation ; l'occurrence qu'on vient de traiter est écartée même si sa validation tarde à apparaître). */
  async prochaine(smsi: string, id: string, user: SessionUser, apres?: string) {
    const o = await this.g.object(smsi, id, user);
    if (o.kind !== 'task_series') throw new HttpError(422, 'Série attendue.');
    const lignes = await occurrencesSerie(this.g.db.k, id)
      .where('o.archived', '=', false)
      .orderBy('s.slot', 'asc')
      .limit(1000)
      .execute();
    const occurrence = (await this.enrichir(o.data, lignes.map(versLigne))).find(
      (l) => l.actionId !== apres && l.validation.etat !== 'validee' && l.fenetre?.etat === 'ouverte',
    );
    return { occurrence: occurrence ?? null };
  }
  /** Occurrence suivante dans la liste courante (ids ordonnés par le client, toutes séries confondues) : la première, après
      `apres`, qui n'est pas validée, dont la fenêtre est ouverte et que la personne peut lire. Une occurrence illisible ou
      absente de la base est ignorée ; rien n'est validé ni modifié. */
  async prochaineDansListe(smsi: string, liste: string[], apres: string, user: SessionUser) {
    await this.g.access(smsi, user);
    const ids = [...new Set(liste)].slice(0, 500);
    const debut = ids.indexOf(apres);
    const series = new Map<string, Record<string, unknown> | null>();
    for (const id of ids.slice(debut + 1)) {
      const o = await this.g.raw(id);
      if (!o || o.archived || o.kind !== 'action' || typeof o.data.seriesId !== 'string' || !o.registreId) continue;
      try {
        await this.g.registres.exigerElement(user, o, 'lire');
      } catch {
        continue;
      }
      const serieId = o.data.seriesId;
      if (!series.has(serieId)) series.set(serieId, (await this.g.raw(serieId))?.data ?? null);
      const donneesSerie = series.get(serieId);
      const dueAt = typeof o.data.dueAt === 'string' ? o.data.dueAt : null;
      if (!donneesSerie || !dueAt) continue;
      const [ligne] = await this.enrichir(donneesSerie, [{ actionId: id, data: o.data }]);
      if (ligne!.validation.etat !== 'validee' && ligne!.fenetre?.etat === 'ouverte')
        return { occurrence: { actionId: id, name: o.name } };
    }
    return { occurrence: null };
  }
  /** Jours d'un calendrier de plateforme (d'une année, ou tous), copiés dans la série à la date de l'import. */
  private async joursPlateforme(calendrier: string, annee?: number): Promise<string[]> {
    const k = this.g.db.k;
    const existe = await k
      .selectFrom('calendriers_plateforme')
      .select('id')
      .where('id', '=', calendrier)
      .executeTakeFirst();
    if (!existe) throw new HttpError(404, 'Calendrier de plateforme inconnu.');
    return (
      await k
        .selectFrom('calendriers_plateforme_jours')
        .select(sql<string>`to_char(day, 'YYYY-MM-DD')`.as('d'))
        .where('calendrier_id', '=', calendrier)
        .$if(annee != null, (q) => q.where(sql`extract(year FROM day)`, '=', annee!))
        .orderBy('day')
        .execute()
    ).map((r) => r.d);
  }
  /** Import d'un calendrier iCalendar dans les jours exclus d'une série. L'aperçu décrit l'effet sans rien écrire ; l'import
      est tout ou rien (une erreur dans le fichier ne modifie rien) et rejouer le même fichier n'ajoute aucun doublon. */
  async importerCalendrier(
    smsi: string,
    id: string,
    input: CalendrierBody,
    expected: number,
    user: SessionUser,
    ip: string,
  ): Promise<ApercuCalendrier> {
    const b = CalendrierBody.parse(input);
    const o = await this.g.object(smsi, id, user);
    if (o.kind !== 'task_series') throw new HttpError(422, 'Série attendue.');
    const recurrence = SeriesData.parse(o.data).recurrence;
    const lecture = b.calendrier
      ? { jours: await this.joursPlateforme(b.calendrier, b.annee), ignores: [], erreurs: [] }
      : lireIcs(b.ics!);
    if (b.calendrier && !lecture.jours.length)
      throw new HttpError(
        422,
        'Ce calendrier ne porte aucun jour pour cette période : l’administrateur doit d’abord générer ou importer ses jours.',
      );
    const presents = new Set(recurrence.excludedDays ?? []);
    const nouveaux = lecture.jours.filter((j) => !presents.has(j));
    const dejaPresents = lecture.jours.filter((j) => presents.has(j));
    const total = presents.size + nouveaux.length;
    if (total > ICAL_MAX_JOURS)
      lecture.erreurs.push({ ligne: 1, message: `Une série ne peut pas exclure plus de ${ICAL_MAX_JOURS} jours.` });
    const apercu: ApercuCalendrier = { ...lecture, nouveaux, dejaPresents, total, applique: false };
    if (b.apercu) return apercu;
    if (lecture.erreurs.length)
      throw new HttpError(
        422,
        'Le calendrier contient des erreurs : rien n’a été importé. Corrigez le fichier puis réessayez.',
      );
    if (!nouveaux.length) return { ...apercu, total: presents.size };
    await this.g.updateObject(
      smsi,
      id,
      {
        kind: 'task_series',
        name: o.name,
        data: { ...o.data, recurrence: { ...recurrence, excludedDays: [...presents, ...nouveaux].sort() } },
      },
      expected,
      user,
      ip,
    );
    return { ...apercu, applique: true };
  }
  async tick(now = new Date()) {
    // Verrou par série + clé d’occurrence unique : plusieurs instances peuvent travailler sans doublons.
    await this.g.modules.assert('ecarts');
    const series = await this.g.db.k
      .selectFrom('grc_objects as o')
      .leftJoin('grc_series as s', 's.object_id', 'o.id')
      .select('o.id')
      .where('o.kind', '=', 'task_series')
      .where('o.archived', '=', false)
      .where(sql<string | null>`o.data->'recurrence'->>'active'`, '=', 'true')
      .orderBy('s.checked_at', (ob) => ob.asc().nullsFirst())
      .orderBy('o.id')
      .limit(500)
      .execute();
    for (const { id } of series)
      await this.g.db.tx(async (c, k) => {
        // Verrou consultatif transactionnel : fonction PostgreSQL appelée directement (ADR 0062 §5).
        const lock = (
          await c.query<{ locked: boolean }>('SELECT pg_try_advisory_xact_lock(hashtextextended($1,727281)) locked', [
            id,
          ])
        ).rows[0];
        if (!lock?.locked) return;
        const row = await objets(k).where('id', '=', id).where('archived', '=', false).forUpdate().executeTakeFirst();
        if (!row) return;
        const o = versObjet(row),
          d = SeriesData.parse(o.data);
        if (!d.recurrence.active) return;
        await k
          .insertInto('grc_series')
          .values({ object_id: id })
          .onConflict((oc) => oc.doNothing())
          .execute();
        let index = (
          await k
            .selectFrom('grc_series')
            .select('next_index')
            .where('object_id', '=', id)
            .forUpdate()
            .executeTakeFirstOrThrow()
        ).next_index;
        const policyRow = await k
          .selectFrom('grc_smsis as s')
          .innerJoin('business_policy_versions as p', 'p.version', 's.business_version')
          .select('p.definition')
          .where('s.id', '=', o.smsiId)
          .forShare('s')
          .executeTakeFirst();
        if (!policyRow) return;
        const definition = policyRow.definition as { statuses: { id: string; terminal: boolean }[] };
        await k.updateTable('grc_series').set({ checked_at: now }).where('object_id', '=', id).execute();
        // Une série liée à un référentiel désactivé est suspendue, sans perdre son curseur.
        const frameworks = d.refs
          .filter((ref) => ref.startsWith('requirement:') || ref.startsWith('object:'))
          .map((ref) => ref.split(':')[1]!); // préfixe vérifié ci-dessus : le second segment existe
        if (frameworks.length) {
          const publications = await k
            .selectFrom('grc_objects')
            .select([sql<string | null>`data->>'enabled'`.as('enabled'), 'archived'])
            .where('smsi_id', '=', o.smsiId)
            .where('id', 'in', frameworks)
            .where('kind', '=', 'framework')
            .forShare()
            .execute();
          if (publications.some((p) => p.archived || p.enabled !== 'true')) return;
        }
        const status = definition.statuses.find((s) => !s.terminal)!.id;
        // Rattrapage plafonné par transaction, poursuivi au prochain passage ; aucune occurrence perdue.
        for (let generated = 0; generated < 50; generated++) {
          const slot = recurrenceSlot(d.recurrence, index);
          if (
            !slot ||
            new Date(slot.dueAt).getTime() > now.getTime() + Math.max(7, d.recurrence.reminderDays) * 86400000
          )
            break;
          if (
            !(await k
              .selectFrom('grc_occurrences')
              .select('slot')
              .where('series_id', '=', id)
              .where('slot', '=', slot.key)
              .executeTakeFirst())
          ) {
            const action = await this.g.insert(
              c,
              o.smsiId,
              'action',
              o.name,
              {
                description: d.description,
                status,
                ownerId: d.ownerId,
                // Une série confiée à un groupe ou à une fonction le reste pour chacune de ses occurrences.
                ...(d.responsable ? { responsable: d.responsable } : {}),
                startAt: null,
                dueAt: slot.dueAt,
                priority: d.priority,
                category: d.category,
                justification: '',
                reminderDays: d.recurrence.reminderDays,
                dependencies: [],
                seriesId: id,
                occurrenceKey: slot.key,
              },
              { username: 'Automate SMSI' },
              '',
              o.registreId ?? null,
            );
            await k
              .insertInto('grc_occurrences')
              .values({ series_id: id, slot: slot.key, action_id: action.id })
              .execute();
            for (const target of ['object:' + id, ...d.refs])
              await k
                .insertInto('grc_links')
                .values({
                  smsi_id: o.smsiId,
                  source_id: action.id,
                  source_ref: 'object:' + action.id,
                  target_ref: target,
                  type: 'related_to',
                  note: 'Occurrence récurrente',
                  created_by: 'Automate SMSI',
                })
                .onConflict((oc) => oc.doNothing())
                .execute();
          }
          index++;
        }
        await k.updateTable('grc_series').set({ next_index: index }).where('object_id', '=', id).execute();
      }, 'Automate SMSI');
    await this.reminders(now);
  }
  private async reminders(now: Date) {
    await this.g.db.tx(async (c) => {
      // Notifications réellement créées à ce passage (les doublons sont ignorés) : seules elles sont diffusées (ADR 0058).
      // Ces INSERT … SELECT (jointure latérale, jsonb_array_elements, make_interval) restent en SQL paramétré : Kysely les
      // exprimerait par fragments sans gain de vérification (ADR 0062 §5).
      const emises: NotificationEmise[] = [];
      const noter = (r: { rows: NotificationEmise[] }) => void emises.push(...r.rows);
      noter(
        await c.query<NotificationEmise>(
          `INSERT INTO grc_notifications(smsi_id,object_id,user_id,kind,due_key,title,message)
   SELECT o.smsi_id,o.id,u.id,'task_due',o.data->>'dueAt',p.definition->'notifications'->>'title',p.definition->'notifications'->>'message'
   FROM grc_objects o JOIN grc_smsis s ON s.id=o.smsi_id JOIN business_policy_versions p ON p.version=s.business_version JOIN users u ON u.id=(o.data->>'ownerId')::uuid
   WHERE o.kind='action' AND NOT o.archived AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()) AND p.definition->'notifications'->>'enabled'='true'
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.definition->'statuses') st WHERE st->>'id'=o.data->>'status' AND st->>'terminal'='true')
   AND NOT ${OCCURRENCE_VALIDEE}
   AND (o.data->>'dueAt')::timestamptz <= $1::timestamptz + make_interval(days => (o.data->>'reminderDays')::int)
   AND (s.visibility='instance' OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=u.id)) ON CONFLICT DO NOTHING RETURNING id,user_id AS "userId",kind`,
          [now],
        ),
      );
      // Responsable de type groupe ou fonction : le rappel va aux personnes qui le composent aujourd'hui.
      noter(
        await c.query<NotificationEmise>(
          `INSERT INTO grc_notifications(smsi_id,object_id,user_id,kind,due_key,title,message)
   SELECT o.smsi_id,o.id,u.id,'task_due',o.data->>'dueAt',p.definition->'notifications'->>'title',p.definition->'notifications'->>'message'
   FROM grc_objects o JOIN grc_smsis s ON s.id=o.smsi_id JOIN business_policy_versions p ON p.version=s.business_version
   JOIN LATERAL (
     SELECT ug.user_id FROM user_groups ug WHERE o.data->'responsable'->>'type'='groupe' AND ug.group_id=(o.data->'responsable'->>'id')::uuid
     UNION
     SELECT fm.user_id FROM fonction_membres fm JOIN fonctions f ON f.id=fm.fonction_id
      WHERE o.data->'responsable'->>'type'='fonction' AND NOT f.archived AND fm.fonction_id=(o.data->'responsable'->>'id')::uuid
   ) r ON true
   JOIN users u ON u.id=r.user_id
   WHERE o.kind='action' AND NOT o.archived AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()) AND p.definition->'notifications'->>'enabled'='true'
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.definition->'statuses') st WHERE st->>'id'=o.data->>'status' AND st->>'terminal'='true')
   AND NOT ${OCCURRENCE_VALIDEE}
   AND (o.data->>'dueAt')::timestamptz <= $1::timestamptz + make_interval(days => (o.data->>'reminderDays')::int)
   AND (s.visibility='instance' OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=u.id)) ON CONFLICT DO NOTHING RETURNING id,user_id AS "userId",kind`,
          [now],
        ),
      );
      if (!(await this.g.modules.state()).disabled.includes('pilotage'))
        noter(
          await c.query<NotificationEmise>(
            `INSERT INTO grc_notifications(smsi_id,object_id,user_id,kind,due_key,title,message)
        SELECT o.smsi_id,o.id,u.id,'risk_review',o.data->>'reviewAt','Réévaluation d’un risque','Une appréciation périodique du risque est à préparer.'
        FROM grc_objects o JOIN grc_smsis s ON s.id=o.smsi_id JOIN business_policy_versions p ON p.version=s.business_version JOIN users u ON u.id=(o.data->>'ownerId')::uuid
        WHERE o.kind='risk' AND NOT o.archived AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now())
        AND p.definition->'notifications'->>'enabled'='true' AND (o.data->>'reviewAt')::date <= $1::timestamptz::date + (p.definition->'notifications'->>'leadDays')::int
        AND (s.visibility='instance' OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=u.id)) ON CONFLICT DO NOTHING RETURNING id,user_id AS "userId",kind`,
            [now],
          ),
        );
      await this.g.notificationsMetier?.diffuser(c, emises);
    }, 'Automate SMSI');
  }
  async notifications(user: SessionUser) {
    const rows = await this.g.db.k
      .selectFrom('grc_notifications')
      .select([
        'id',
        'smsi_id as smsiId',
        'object_id as objectId',
        'kind',
        'title',
        'message',
        'read_at as readAt',
        'created_at as createdAt',
      ])
      .where('user_id', '=', user.id)
      .where('canal_application', '=', true)
      // Les alertes de sécurité (sans SMSI) ont leur propre route : /api/account/alertes-securite (ADR 0074).
      .where('smsi_id', 'is not', null)
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();
    const visible = [];
    for (const r of rows)
      if (
        r.smsiId &&
        r.objectId &&
        (await this.g.visible(
          user,
          r.smsiId,
          r.kind === 'risk_review' ? 'pilotage' : r.kind === 'rapprochement' ? 'conformite' : 'ecarts',
        ))
      )
        visible.push(r);
    return visible;
  }
  async read(id: string, user: SessionUser) {
    await this.g.db.k
      .updateTable('grc_notifications')
      .set({ read_at: sql<Date>`now()` })
      .where('id', '=', id)
      .where('user_id', '=', user.id)
      .execute();
    return { ok: true };
  }
}
