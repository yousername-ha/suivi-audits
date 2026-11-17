/* Module Vulnérabilités (ADR 0100, lot V4d) : dépôts de Tenable Security Center et leur liaison à un périmètre de la
   plateforme. Décision du RSSI du 17/11/2026 : pour Tenable, le périmètre se relie par groupe entier, comme les périmètres
   AlgoLightHouse (lot ALH1, surface-externe.ts) ; le groupe retenu est le dépôt (`repository`, lu par la synchronisation
   dans les résultats déjà reçus, tenable.ts), choix à confirmer par le RSSI.
   - Une machine sans périmètre indiqué à la main prend celui de son dépôt relié ; le périmètre indiqué à la main prime
     (failles.ts) et la machine revient au dépôt quand on le retire. Droits de lecture sur le périmètre effectif (sql.ts).
   - Liste et liaison avec vulnerabilites:administrer (route), If-Match, écriture exigée sur le périmètre actuel et sur le
     périmètre visé (mêmes garde-fous que la liaison des périmètres ALH). Une synchronisation ne touche jamais une liaison.
   Journal `vulnerabilites.depot.*` : identifiants internes et nombres seulement, jamais un nom de machine ni de dépôt. */
import { type DepotTenableDto, LiaisonDepotTenable } from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Db, Kdb } from '../db/db.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';

export class DepotsTenable {
  constructor(
    private readonly db: Db,
    private readonly g: Grc,
  ) {}

  /** Dépôts de toutes les instances (ou un seul), présents d'abord, avec leurs machines et leurs exceptions. */
  async lister(id?: string, k: Kdb = this.db.k): Promise<DepotTenableDto[]> {
    const { rows } = await sql<{
      id: string;
      depot_tenable: number;
      nom: string;
      perimetre_id: string | null;
      perimetre_nom: string | null;
      present: boolean;
      machines: number;
      exceptions: number;
      version: number;
      maj_par: string | null;
      maj_le: Date;
      integration_id: string;
      integration_nom: string;
    }>`
      SELECT td.id, td.depot_tenable, td.nom, td.perimetre_id, sm.name AS perimetre_nom,
        (td.vu_numero >= coalesce(e.numero_complet, 0)) AS present,
        (SELECT count(*)::int FROM vulnerabilites_machines m WHERE m.depot_id = td.id) AS machines,
        (SELECT count(*)::int FROM vulnerabilites_machines m WHERE m.depot_id = td.id AND m.perimetre_id IS NOT NULL)
          AS exceptions,
        td.version, td.maj_par, td.maj_le, td.integration_id, i.nom AS integration_nom
      FROM vulnerabilites_tenable_depots td
      JOIN integrations i ON i.id = td.integration_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = td.integration_id
      LEFT JOIN grc_smsis sm ON sm.id = td.perimetre_id
      WHERE ${id ? sql<boolean>`td.id = ${id}::uuid` : sql<boolean>`true`}
      ORDER BY (td.vu_numero >= coalesce(e.numero_complet, 0)) DESC, lower(td.nom), td.depot_tenable, td.id`.execute(k);
    return rows.map((d) => ({
      id: d.id,
      depotTenable: d.depot_tenable,
      nom: d.nom,
      perimetreId: d.perimetre_id,
      perimetreNom: d.perimetre_nom,
      present: d.present,
      machines: d.machines,
      exceptions: d.exceptions,
      version: d.version,
      majPar: d.maj_par,
      majLe: d.maj_le.toISOString(),
      integration: { id: d.integration_id, nom: d.integration_nom },
    }));
  }

  /** Relier (ou délier) un dépôt : If-Match ; écriture exigée sur le périmètre actuel et sur le périmètre visé. */
  async lier(
    id: string,
    corps: LiaisonDepotTenable,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<DepotTenableDto> {
    const p = LiaisonDepotTenable.parse(corps);
    await this.db.tx(async (c, k) => {
      const td = await k
        .selectFrom('vulnerabilites_tenable_depots')
        .select(['id', 'integration_id', 'perimetre_id', 'version', 'maj_par'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!td) throw new HttpError(404, 'Dépôt Tenable introuvable.');
      if (td.version !== attendue) throw conflict({ ...(await this.lister(id, k))[0]!, updated_by: td.maj_par ?? '' });
      if (td.perimetre_id === p.perimetreId) return;
      if (td.perimetre_id) await this.g.access(td.perimetre_id, user, true, c);
      if (p.perimetreId)
        await this.g.access(p.perimetreId, user, true, c).catch((e: unknown) => {
          if (e instanceof HttpError && e.status === 404)
            throw new HttpError(422, 'Périmètre introuvable ou non accessible.');
          throw e;
        });
      const apres = await k
        .updateTable('vulnerabilites_tenable_depots')
        .set((eb) => ({
          perimetre_id: p.perimetreId,
          version: eb('version', '+', 1),
          maj_le: sql<Date>`now()`,
          maj_par: user.username,
        }))
        .where('id', '=', id)
        .returning('version')
        .executeTakeFirstOrThrow();
      // Nombre de machines qui suivent le dépôt (sans périmètre indiqué à la main) : jamais leurs noms.
      const { heritieres } = await k
        .selectFrom('vulnerabilites_machines')
        .select(sql<number>`count(*)::int`.as('heritieres'))
        .where('depot_id', '=', id)
        .where('perimetre_id', 'is', null)
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        p.perimetreId ? 'vulnerabilites.depot.relie' : 'vulnerabilites.depot.delie',
        id,
        {
          integration: td.integration_id,
          avant: { perimetreId: td.perimetre_id },
          apres: { perimetreId: p.perimetreId },
          machinesHeritieres: heritieres,
          version: apres.version,
        },
        c,
      );
    }, user.username);
    return (await this.lister(id))[0]!;
  }
}
