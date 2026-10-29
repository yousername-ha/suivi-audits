/* Clé de secours des sauvegardes (ADR 0071, ADR 0077) : l'application ne détient que la clé PUBLIQUE age, choisie dans
   l'assistant d'installation ou dans l'administration ; la clé privée est générée et gardée par le navigateur de la personne
   qui l'a créée. L'exécutant des sauvegardes (conteneur updater, root) relit cette clé par « suivi backup-secours » et l'écrit
   dans son fichier ; l'API, sans accès en écriture au dossier des données, ne touche jamais aux fichiers de clés. */
import { CleSecoursEtat, estClePubliqueAge } from '@suivi/shared';
import type { Config } from './config.js';
import type { Db, Kdb } from './db/db.js';
import { readHost } from './operations.js';

const CLE = 'sauvegarde:cle-secours';
interface Ligne {
  publique: string;
  definiLe: string;
  definiPar: string;
}

export class CleSecours {
  constructor(
    private readonly db: Db,
    private readonly cfg: Config,
  ) {}

  private async ligne(k: Kdb = this.db.k): Promise<Ligne | null> {
    const r = await k.selectFrom('settings').select('value').where('key', '=', CLE).executeTakeFirst();
    const l = (r?.value as Ligne | undefined) ?? null;
    return l && estClePubliqueAge(l.publique) ? l : null;
  }

  async definie(): Promise<boolean> {
    return (await this.ligne()) !== null;
  }

  /** Enregistre (ou remplace) la clé publique ; les sauvegardes suivantes sont chiffrées pour elle. */
  async inscrire(k: Kdb, publique: string, par: string): Promise<void> {
    if (!estClePubliqueAge(publique)) throw new Error('Clé publique age invalide.');
    const valeur: Ligne = { publique, definiLe: new Date().toISOString(), definiPar: par };
    await k
      .insertInto('settings')
      .values({ key: CLE, value: JSON.stringify(valeur) })
      .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
      .execute();
  }

  /** Clés publiques à écrire dans le fichier de l'exécutant (une par ligne ; vide si aucune). */
  async publiques(): Promise<string[]> {
    const l = await this.ligne();
    return l ? [l.publique] : [];
  }

  async etat(): Promise<CleSecoursEtat> {
    const l = await this.ligne();
    const h = readHost(this.cfg);
    const serveur = (h?.secours ?? []).filter(estClePubliqueAge);
    return CleSecoursEtat.parse({
      publique: l?.publique ?? null,
      definiLe: l?.definiLe ?? null,
      definiPar: l?.definiPar ?? null,
      serveur,
      vuLe: h?.seenAt ?? null,
      sauvegardesPossibles: !!h && h.cleServeur === true && serveur.length > 0,
    });
  }
}
