/* Adresse du site (ADR 0077) : l'application enregistre l'adresse demandée (assistant d'installation, administration) ;
   l'exécutant du serveur la relit (« suivi site-adresse ») et l'applique à la configuration. L'API n'écrit pas .env. */
import { estAdresseSite, type AdresseSiteEtat } from '@suivi/shared';
import type { Config } from './config.js';
import type { Db, Kdb } from './db/db.js';

const CLE = 'site:adresse';
interface Ligne {
  adresse: string;
  definiLe: string;
  definiPar: string;
}

export class AdresseSiteService {
  constructor(
    private readonly db: Db,
    private readonly cfg: Config,
  ) {}

  /** Adresse en service : hôte de PUBLIC_URL (https://SITE_ADDRESS). */
  actuelle(): string | null {
    try {
      return this.cfg.publicUrl ? new URL(this.cfg.publicUrl).hostname : null;
    } catch {
      return null;
    }
  }

  private async ligne(k: Kdb = this.db.k): Promise<Ligne | null> {
    const r = await k.selectFrom('settings').select('value').where('key', '=', CLE).executeTakeFirst();
    const l = (r?.value as Ligne | undefined) ?? null;
    return l && estAdresseSite(l.adresse) ? l : null;
  }

  async demander(k: Kdb, adresse: string, par: string): Promise<void> {
    if (!estAdresseSite(adresse)) throw new Error('Adresse de site invalide.');
    const valeur: Ligne = { adresse, definiLe: new Date().toISOString(), definiPar: par };
    await k
      .insertInto('settings')
      .values({ key: CLE, value: JSON.stringify(valeur) })
      .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
      .execute();
  }

  /** Adresse à appliquer par l'exécutant, ou null si aucune demande. */
  async demandee(): Promise<string | null> {
    return (await this.ligne())?.adresse ?? null;
  }

  async etat(): Promise<AdresseSiteEtat> {
    const l = await this.ligne();
    return {
      actuelle: this.actuelle(),
      demandee: l?.adresse ?? null,
      demandeeLe: l?.definiLe ?? null,
      demandeePar: l?.definiPar ?? null,
    };
  }
}
