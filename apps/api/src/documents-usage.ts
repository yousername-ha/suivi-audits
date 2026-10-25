/* Citations d'un document comme preuve (fiche, lien, décision, validation d'occurrence) : une version de document citée ne se
   purge pas, l'historique des preuves est conservé. Partagé par la suppression définitive et par l'aperçu de conservation. */
import type { Client } from './db/db.js';

export interface UsagesPreuve {
  liens: number;
  fiches: number;
  decisions: number;
  validations: number;
}

export async function usagesPreuve(c: Pick<Client, 'query'>, id: string): Promise<UsagesPreuve> {
  return (
    await c.query<UsagesPreuve>(
      `SELECT (SELECT count(*)::int FROM grc_links WHERE source_ref LIKE $1 OR target_ref LIKE $1) liens,
              (SELECT count(*)::int FROM grc_objects WHERE data::text LIKE $2) fiches,
              (SELECT count(*)::int FROM pilotage_decisions WHERE refs::text LIKE $2 OR snapshot::text LIKE $2) decisions,
              (SELECT count(*)::int FROM occurrence_validations WHERE proof_ref LIKE $1) validations`,
      [`document:${id}:%`, `%document:${id}:%`],
    )
  ).rows[0]!;
}

export const totalUsages = (u: UsagesPreuve) => u.liens + u.fiches + u.decisions + u.validations;
