/* Statistiques du planificateur recalculées après une écriture massive (décision du RSSI du 19/11/2026). Une
   synchronisation de connecteur réécrit chaque ligne de ses tables (mises à jour en masse, liens supprimés puis réinsérés) :
   jusqu'au passage de l'autovacuum, PostgreSQL planifie avec des statistiques périmées. Après la validation (hors
   transaction), un ANALYZE par table de la liste figée de l'appelant. Le rôle applicatif est propriétaire des tables
   (db/init/10-app-role.sh) : il peut les analyser sans droit supplémentaire. ANALYZE lit un échantillon borné (300 fois la
   cible de statistiques, 30 000 lignes par défaut), quelle que soit la taille de la table : chacun tient sous le délai de
   30 s du pool (db.ts), sans réglage particulier. Un échec est journalisé (nom de table et code d'erreur seulement) et
   n'interrompt rien. */
import { sql } from 'kysely';
import type { Logger } from 'pino';
import type { Kdb } from './db.js';
import type { DB } from './types.generated.js';

/** Nom d'une table du schéma (types générés des migrations) : jamais un nom venu d'une entrée. */
export type TableDb = keyof DB & string;

/** Lance ANALYZE sur chaque table, une à une ; rend le nombre de tables analysées. Ne lève jamais. */
export async function analyserTables(k: Kdb, tables: readonly TableDb[], journal: Logger): Promise<number> {
  let analysees = 0;
  for (const table of tables)
    try {
      await sql`ANALYZE ${sql.table(table)}`.execute(k);
      analysees++;
    } catch (e) {
      journal.warn({ table, code: (e as { code?: string }).code ?? null }, 'statistiques non recalculées (ANALYZE)');
    }
  return analysees;
}
