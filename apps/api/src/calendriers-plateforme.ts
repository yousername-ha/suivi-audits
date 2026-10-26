/* Calendriers de plateforme (décision 4, migration 039) : jours fériés français calculés par la loi et calendriers iCalendar
   importés par l'administrateur. Rien n'est récupéré à distance et rien ne se renouvelle seul : la mise à jour annuelle est une
   action de l'administrateur, consignée avec sa provenance. L'aperçu précède toujours l'écriture ; rejouer une mise à jour
   n'ajoute aucun jour déjà présent. Accès aux données en Kysely (ADR 0062). */
import {
  anneesAttendues,
  ICAL_MAX_JOURS,
  joursFeriesFrance,
  lireIcs,
  type ApercuMiseAJourCalendrier,
  type CalendrierPlateformeBody,
  type CalendrierPlateformeDto,
  type GenererFeriesBody,
  type ImporterCalendrierPlateformeBody,
  type JourCalendrierDto,
} from '@suivi/shared';
import { sql } from 'kysely';
import { surConnexion, type Actor, type Client, type Db } from './db/db.js';
import { HttpError } from './http/errors.js';

const PROVENANCE_LOI = 'Calcul légal (Code du travail, art. L3133-1), métropole';
/** Jour au format AAAA-MM-JJ, calculé par PostgreSQL (pas de conversion de fuseau côté Node). */
const jourIso = sql<string>`to_char(day, 'YYYY-MM-DD')`;

export interface EntreeJournalCalendrier {
  seq: number;
  operation: string;
  year: number | null;
  daysAdded: number;
  daysRemoved: number;
  provenance: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export class CalendriersPlateforme {
  constructor(private readonly db: Db) {}

  async lister(maintenant = new Date()): Promise<CalendrierPlateformeDto[]> {
    const lignes = await this.db.k
      .selectFrom('calendriers_plateforme as c')
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom('calendriers_plateforme_journal')
            .select(['created_at', 'created_by'])
            .whereRef('calendrier_id', '=', 'c.id')
            .orderBy('seq', 'desc')
            .limit(1)
            .as('j'),
        (join) => join.onTrue(),
      )
      .select([
        'c.id',
        'c.name',
        'c.kind',
        sql<
          { year: number; days: number }[]
        >`coalesce((SELECT json_agg(json_build_object('year', t.y, 'days', t.n) ORDER BY t.y)
          FROM (SELECT extract(year FROM day)::int y, count(*)::int n FROM calendriers_plateforme_jours
                 WHERE calendrier_id = c.id GROUP BY 1) t), '[]'::json)`.as('years'),
        'j.created_at as updatedAt',
        'j.created_by as updatedBy',
      ])
      .orderBy(sql`lower(c.name)`)
      .execute();
    const attendues = anneesAttendues(maintenant);
    return lignes.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      years: l.years,
      updatedAt: l.updatedAt ? l.updatedAt.toISOString() : null,
      updatedBy: l.updatedBy,
      missingYears: l.kind === 'feries' ? attendues.filter((a) => !l.years.some((y) => y.year === a)) : [],
    }));
  }

  private async existe(c: Pick<Client, 'query'>, id: string) {
    const r = await surConnexion(c)
      .selectFrom('calendriers_plateforme')
      .select(['kind', 'name'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Calendrier inconnu.');
    return r;
  }

  async jours(id: string, annee?: number): Promise<JourCalendrierDto[]> {
    await this.existe(this.db.pool, id);
    let q = this.db.k
      .selectFrom('calendriers_plateforme_jours')
      .select([jourIso.as('date'), 'label', 'origin'])
      .where('calendrier_id', '=', id);
    if (annee !== undefined) q = q.where(sql<number>`extract(year FROM day)`, '=', annee);
    return q.orderBy('day').execute();
  }

  async journal(id: string): Promise<EntreeJournalCalendrier[]> {
    await this.existe(this.db.pool, id);
    return this.db.k
      .selectFrom('calendriers_plateforme_journal')
      .select([
        'seq',
        'operation',
        'year',
        'days_added as daysAdded',
        'days_removed as daysRemoved',
        'provenance',
        'reason',
        'created_by as createdBy',
        sql<string>`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`.as('createdAt'),
      ])
      .where('calendrier_id', '=', id)
      .orderBy('seq', 'desc')
      .limit(100)
      .execute();
  }

  async creer(body: CalendrierPlateformeBody, user: Actor, ip: string): Promise<CalendrierPlateformeDto> {
    const id = await this.db.tx(async (c, k) => {
      const doublon = await k
        .selectFrom('calendriers_plateforme')
        .select('id')
        .where(sql<string>`lower(name)`, '=', sql<string>`lower(${body.name})`)
        .executeTakeFirst();
      if (doublon) throw new HttpError(409, 'Un calendrier porte déjà ce nom.');
      const { id } = await k
        .insertInto('calendriers_plateforme')
        .values({ name: body.name, kind: body.kind, created_by: user.username })
        .returning('id')
        .executeTakeFirstOrThrow();
      await k
        .insertInto('calendriers_plateforme_journal')
        .values({ calendrier_id: id, operation: 'creer', created_by: user.username })
        .execute();
      await this.db.audit(user, ip, 'admin.calendrier_cree', id, { name: body.name, kind: body.kind }, c);
      return id;
    }, user.username);
    return (await this.lister()).find((x) => x.id === id)!;
  }

  /** Jours fériés légaux d'une année (calendrier de type « jours fériés » seulement). */
  async genererFeries(
    id: string,
    body: GenererFeriesBody,
    user: Actor,
    ip: string,
  ): Promise<ApercuMiseAJourCalendrier> {
    return this.db.tx(async (c) => {
      const cal = await this.existe(c, id);
      if (cal.kind !== 'feries') throw new HttpError(422, 'Seul un calendrier de jours fériés se génère par la loi.');
      const calcules: JourCalendrierDto[] = joursFeriesFrance(body.year).map((j) => ({
        date: j.date,
        label: j.label,
        origin: 'calcul',
      }));
      return this.appliquer(c, id, calcules, [], [], body.apercu, user, ip, {
        operation: 'generer',
        year: body.year,
        provenance: PROVENANCE_LOI,
      });
    }, user.username);
  }

  async importer(
    id: string,
    body: ImporterCalendrierPlateformeBody,
    user: Actor,
    ip: string,
  ): Promise<ApercuMiseAJourCalendrier> {
    const lecture = lireIcs(body.ics);
    return this.db.tx(async (c) => {
      await this.existe(c, id);
      const jours: JourCalendrierDto[] = lecture.jours.map((date) => ({ date, label: '', origin: 'ical' }));
      const erreurs = lecture.erreurs.map((e) => ({ line: e.ligne, message: e.message }));
      if (jours.length > ICAL_MAX_JOURS) erreurs.push({ line: 1, message: `Plus de ${ICAL_MAX_JOURS} jours.` });
      return this.appliquer(
        c,
        id,
        jours,
        erreurs,
        lecture.ignores.map((e) => ({ line: e.ligne, message: e.message })),
        body.apercu,
        user,
        ip,
        {
          operation: 'importer',
          year: null,
          provenance: `Fichier iCalendar${body.filename ? ' : ' + body.filename : ''}`,
        },
      );
    }, user.username);
  }

  private async appliquer(
    c: Client,
    id: string,
    jours: JourCalendrierDto[],
    errors: ApercuMiseAJourCalendrier['errors'],
    ignored: ApercuMiseAJourCalendrier['ignored'],
    apercu: boolean,
    user: Actor,
    ip: string,
    meta: { operation: 'generer' | 'importer'; year: number | null; provenance: string },
  ): Promise<ApercuMiseAJourCalendrier> {
    const k = surConnexion(c);
    const presents = new Set(
      (
        await k
          .selectFrom('calendriers_plateforme_jours')
          .select(jourIso.as('d'))
          .where('calendrier_id', '=', id)
          .execute()
      ).map((r) => r.d),
    );
    const added = jours.filter((j) => !presents.has(j.date));
    const alreadyPresent = jours.filter((j) => presents.has(j.date));
    const resultat: ApercuMiseAJourCalendrier = { added, alreadyPresent, errors, ignored, applied: false };
    if (apercu) return resultat;
    if (errors.length)
      throw new HttpError(
        422,
        'Le calendrier contient des erreurs : rien n’a été importé. Corrigez le fichier puis réessayez.',
      );
    if (!added.length) return resultat;
    for (const j of added)
      await k
        .insertInto('calendriers_plateforme_jours')
        .values({ calendrier_id: id, day: j.date, label: j.label, origin: j.origin, added_by: user.username })
        .onConflict((oc) => oc.doNothing())
        .execute();
    await k
      .insertInto('calendriers_plateforme_journal')
      .values({
        calendrier_id: id,
        operation: meta.operation,
        year: meta.year,
        days_added: added.length,
        provenance: meta.provenance,
        created_by: user.username,
      })
      .execute();
    await this.db.audit(
      user,
      ip,
      meta.operation === 'generer' ? 'admin.calendrier_genere' : 'admin.calendrier_importe',
      id,
      { year: meta.year, added: added.length, provenance: meta.provenance },
      c,
    );
    return { ...resultat, applied: true };
  }

  /** Retire tous les jours d'une année, avec un motif consigné. */
  async retirerAnnee(id: string, annee: number, reason: string, user: Actor, ip: string): Promise<{ removed: number }> {
    return this.db.tx(async (c, k) => {
      await this.existe(c, id);
      const supprimes = Number(
        (
          await k
            .deleteFrom('calendriers_plateforme_jours')
            .where('calendrier_id', '=', id)
            .where(sql<number>`extract(year FROM day)`, '=', annee)
            .executeTakeFirst()
        ).numDeletedRows,
      );
      if (!supprimes) throw new HttpError(404, 'Aucun jour pour cette année.');
      await k
        .insertInto('calendriers_plateforme_journal')
        .values({
          calendrier_id: id,
          operation: 'retirer_annee',
          year: annee,
          days_removed: supprimes,
          reason,
          created_by: user.username,
        })
        .execute();
      await this.db.audit(
        user,
        ip,
        'admin.calendrier_annee_retiree',
        id,
        { year: annee, removed: supprimes, reason },
        c,
      );
      return { removed: supprimes };
    }, user.username);
  }

  /** Suppression d'un calendrier vide (créé par erreur) ; un calendrier qui porte des jours se vide année par année. */
  async supprimer(id: string, user: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c, k) => {
      const cal = await this.existe(c, id);
      const { n } = await k
        .selectFrom('calendriers_plateforme_jours')
        .select(sql<number>`count(*)::int`.as('n'))
        .where('calendrier_id', '=', id)
        .executeTakeFirstOrThrow();
      if (n) throw new HttpError(409, 'Ce calendrier porte encore des jours : retirez d’abord chaque année.');
      await k.deleteFrom('calendriers_plateforme').where('id', '=', id).execute();
      await k
        .insertInto('calendriers_plateforme_journal')
        .values({ calendrier_id: id, operation: 'supprimer', provenance: cal.name, created_by: user.username })
        .execute();
      await this.db.audit(user, ip, 'admin.calendrier_supprime', id, { name: cal.name }, c);
    }, user.username);
  }
}
