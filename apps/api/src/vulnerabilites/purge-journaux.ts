/* Module Vulnérabilités (ADR 0100, lot PRIO-1 ; décision du RSSI du 20/11/2026) : purge du journal des collectes de la veille
   et des exécutions des connecteurs au-delà de 90 jours (JOURNAUX_CONSERVATION_JOURS). Avec la fréquence réglable du lot F1,
   ces journaux grossissent avec la cadence (une cinquantaine de collectes par jour) ; ils ne servent qu'à l'affichage de
   l'état et au dépannage. Au tic de l'API, au plus une fois par heure, dans une transaction.
   Gardés, quel que soit leur âge :
   - ce qui est en file ou en cours ;
   - la dernière collecte de chaque source, la dernière exécution de chaque instance et de chaque opération (état affiché) ;
   - les exécutions qui portent le journal d'un import de fichier (Nessus, Silène) : ce journal dit qui a importé quoi et
     quand, il n'est pas un simple journal de cadence (choix prudent, à confirmer par le RSSI).
   La suppression d'une exécution efface par cascade sa ligne du journal des synchronisations de Tenable ou d'AlgoLightHouse
   (numéro, lots, éléments), jamais l'état de l'instance (numéro de la dernière synchronisation complète). Le journal d'audit
   n'est jamais touché : il reçoit une entrée `vulnerabilites.journaux.purges` (nombres seulement) quand quelque chose est
   effacé. */
import { JOURNAUX_CONSERVATION_JOURS } from '@suivi/shared';
import { sql } from 'kysely';
import type { Db, Kdb } from '../db/db.js';
import type { VeilleVulnerabilites } from './veille.js';

const SYSTEME = { username: 'système' };
/** Au plus une purge par heure (mémoire du processus : un redémarrage purge au premier tic, sans effet de bord). */
export const INTERVALLE_PURGE_MS = 3_600_000;

export interface BilanPurge {
  collectes: number;
  executions: number;
}

/** Exécutions des connecteurs terminées depuis plus de 90 jours, hors dernière de chaque instance et opération et hors
    imports de fichier. Rend le nombre de lignes effacées. */
export async function purgerExecutions(k: Kdb): Promise<number> {
  const r = await sql<{ n: number }>`
    WITH effacees AS (
      DELETE FROM integration_executions x
      WHERE x.etat NOT IN ('en_file', 'en_cours')
        AND x.demande_le < now() - make_interval(days => ${JOURNAUX_CONSERVATION_JOURS})
        AND x.id <> (SELECT y.id FROM integration_executions y
                     WHERE y.integration_id = x.integration_id AND y.operation = x.operation
                     ORDER BY y.demande_le DESC, y.id LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM vulnerabilites_imports vi WHERE vi.execution_id = x.id)
        AND NOT EXISTS (SELECT 1 FROM vulnerabilites_silene_imports si WHERE si.execution_id = x.id)
      RETURNING 1)
    SELECT count(*)::int AS n FROM effacees`.execute(k);
  return r.rows[0]?.n ?? 0;
}

export class PurgeJournaux {
  private derniere = 0;

  constructor(
    private readonly db: Db,
    private readonly veille: Pick<VeilleVulnerabilites, 'purgerJournal'>,
  ) {}

  /** Purge si la précédente date de plus d'une heure ; null sinon. Le module est contrôlé par l'appelant. */
  async tic(maintenant = new Date()): Promise<BilanPurge | null> {
    if (maintenant.getTime() - this.derniere < INTERVALLE_PURGE_MS) return null;
    this.derniere = maintenant.getTime();
    return this.purger();
  }

  async purger(): Promise<BilanPurge> {
    return this.db.tx(async (c, k) => {
      const bilan = { collectes: await this.veille.purgerJournal(k), executions: await purgerExecutions(k) };
      if (bilan.collectes || bilan.executions)
        await this.db.audit(SYSTEME, null, 'vulnerabilites.journaux.purges', '', { ...bilan }, c);
      return bilan;
    }, SYSTEME.username);
  }
}
