/* Calendriers de plateforme (décision 4, migration 039) : jours fériés français calculés par la loi et calendriers iCalendar
   importés par l'administrateur. Rien n'est récupéré à distance et rien ne se renouvelle seul : la mise à jour annuelle est une
   action de l'administrateur, consignée avec sa provenance. L'aperçu précède toujours l'écriture ; rejouer une mise à jour
   n'ajoute aucun jour déjà présent. */
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
import type { Actor, Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';

const PROVENANCE_LOI = 'Calcul légal (Code du travail, art. L3133-1), métropole';

interface LigneCalendrier {
  id: string;
  name: string;
  kind: CalendrierPlateformeDto['kind'];
  years: { year: number; days: number }[];
  updatedAt: Date | null;
  updatedBy: string | null;
}

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
    const lignes = (
      await this.db.q<LigneCalendrier>(
        `SELECT c.id,c.name,c.kind,
           coalesce((SELECT json_agg(json_build_object('year',t.y,'days',t.n) ORDER BY t.y)
                       FROM (SELECT extract(year FROM day)::int y,count(*)::int n FROM calendriers_plateforme_jours
                              WHERE calendrier_id=c.id GROUP BY 1) t),'[]'::json) AS years,
           j.created_at AS "updatedAt", j.created_by AS "updatedBy"
         FROM calendriers_plateforme c
         LEFT JOIN LATERAL (SELECT created_at,created_by FROM calendriers_plateforme_journal WHERE calendrier_id=c.id ORDER BY seq DESC LIMIT 1) j ON true
        ORDER BY lower(c.name)`,
      )
    ).rows;
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
    const r = await c.query<{ kind: CalendrierPlateformeDto['kind']; name: string }>(
      'SELECT kind,name FROM calendriers_plateforme WHERE id=$1',
      [id],
    );
    if (!r.rowCount) throw new HttpError(404, 'Calendrier inconnu.');
    return r.rows[0]!;
  }

  async jours(id: string, annee?: number): Promise<JourCalendrierDto[]> {
    await this.existe(this.db.pool, id);
    return (
      await this.db.q<JourCalendrierDto>(
        `SELECT to_char(day,'YYYY-MM-DD') AS date,label,origin FROM calendriers_plateforme_jours
          WHERE calendrier_id=$1 AND ($2::int IS NULL OR extract(year FROM day)=$2) ORDER BY day`,
        [id, annee ?? null],
      )
    ).rows;
  }

  async journal(id: string): Promise<EntreeJournalCalendrier[]> {
    await this.existe(this.db.pool, id);
    return (
      await this.db.q<EntreeJournalCalendrier>(
        `SELECT seq,operation,year,days_added AS "daysAdded",days_removed AS "daysRemoved",provenance,reason,
                created_by AS "createdBy",to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt"
           FROM calendriers_plateforme_journal WHERE calendrier_id=$1 ORDER BY seq DESC LIMIT 100`,
        [id],
      )
    ).rows;
  }

  async creer(body: CalendrierPlateformeBody, user: Actor, ip: string): Promise<CalendrierPlateformeDto> {
    const id = await this.db.tx(async (c) => {
      const doublon = await c.query('SELECT 1 FROM calendriers_plateforme WHERE lower(name)=lower($1)', [body.name]);
      if (doublon.rowCount) throw new HttpError(409, 'Un calendrier porte déjà ce nom.');
      const id = (
        await c.query<{ id: string }>(
          'INSERT INTO calendriers_plateforme (name,kind,created_by) VALUES ($1,$2,$3) RETURNING id',
          [body.name, body.kind, user.username],
        )
      ).rows[0]!.id;
      await c.query(
        `INSERT INTO calendriers_plateforme_journal (calendrier_id,operation,created_by) VALUES ($1,'creer',$2)`,
        [id, user.username],
      );
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
    const presents = new Set(
      (
        await c.query<{ d: string }>(
          `SELECT to_char(day,'YYYY-MM-DD') d FROM calendriers_plateforme_jours WHERE calendrier_id=$1`,
          [id],
        )
      ).rows.map((r) => r.d),
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
      await c.query(
        `INSERT INTO calendriers_plateforme_jours (calendrier_id,day,label,origin,added_by) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [id, j.date, j.label, j.origin, user.username],
      );
    await c.query(
      `INSERT INTO calendriers_plateforme_journal (calendrier_id,operation,year,days_added,provenance,created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, meta.operation, meta.year, added.length, meta.provenance, user.username],
    );
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
    return this.db.tx(async (c) => {
      await this.existe(c, id);
      const r = await c.query(
        'DELETE FROM calendriers_plateforme_jours WHERE calendrier_id=$1 AND extract(year FROM day)=$2',
        [id, annee],
      );
      if (!r.rowCount) throw new HttpError(404, 'Aucun jour pour cette année.');
      await c.query(
        `INSERT INTO calendriers_plateforme_journal (calendrier_id,operation,year,days_removed,reason,created_by)
         VALUES ($1,'retirer_annee',$2,$3,$4,$5)`,
        [id, annee, r.rowCount, reason, user.username],
      );
      await this.db.audit(
        user,
        ip,
        'admin.calendrier_annee_retiree',
        id,
        { year: annee, removed: r.rowCount, reason },
        c,
      );
      return { removed: r.rowCount ?? 0 };
    }, user.username);
  }

  /** Suppression d'un calendrier vide (créé par erreur) ; un calendrier qui porte des jours se vide année par année. */
  async supprimer(id: string, user: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c) => {
      const cal = await this.existe(c, id);
      const n = (
        await c.query<{ n: number }>(
          'SELECT count(*)::int n FROM calendriers_plateforme_jours WHERE calendrier_id=$1',
          [id],
        )
      ).rows[0]!.n;
      if (n) throw new HttpError(409, 'Ce calendrier porte encore des jours : retirez d’abord chaque année.');
      await c.query('DELETE FROM calendriers_plateforme WHERE id=$1', [id]);
      await c.query(
        `INSERT INTO calendriers_plateforme_journal (calendrier_id,operation,provenance,created_by) VALUES ($1,'supprimer',$2,$3)`,
        [id, cal.name, user.username],
      );
      await this.db.audit(user, ip, 'admin.calendrier_supprime', id, { name: cal.name }, c);
    }, user.username);
  }
}
