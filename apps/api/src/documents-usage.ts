/* Citations d'un document comme preuve (fiche, lien, décision, validation d'occurrence) : une version de document citée ne se
   purge pas, l'historique des preuves est conservé. Partagé par la suppression définitive et par l'aperçu de conservation. */
import { sql } from 'kysely';
import { surConnexion, type Client } from './db/db.js';

export interface UsagesPreuve {
  liens: number;
  fiches: number;
  decisions: number;
  validations: number;
}

export async function usagesPreuve(c: Pick<Client, 'query'>, id: string): Promise<UsagesPreuve> {
  const ref = `document:${id}:%`,
    dans = `%document:${id}:%`;
  const n = sql<number>`count(*)::int`;
  // Recherche dans le texte des colonnes jsonb et tableaux : conversions ::text fixes, motifs liés.
  return surConnexion(c)
    .selectNoFrom((eb) => [
      eb
        .selectFrom('grc_links')
        .select(n.as('n'))
        .where((w) => w.or([w('source_ref', 'like', ref), w('target_ref', 'like', ref)]))
        .as('liens'),
      eb
        .selectFrom('grc_objects')
        .select(n.as('n'))
        .where(sql<string>`data::text`, 'like', dans)
        .as('fiches'),
      eb
        .selectFrom('pilotage_decisions')
        .select(n.as('n'))
        .where((w) => w.or([w(sql<string>`refs::text`, 'like', dans), w(sql<string>`snapshot::text`, 'like', dans)]))
        .as('decisions'),
      eb.selectFrom('occurrence_validations').select(n.as('n')).where('proof_ref', 'like', ref).as('validations'),
    ])
    .executeTakeFirstOrThrow() as Promise<UsagesPreuve>;
}

export const totalUsages = (u: UsagesPreuve) => u.liens + u.fiches + u.decisions + u.validations;
