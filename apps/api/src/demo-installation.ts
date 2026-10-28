/* Données de démonstration demandées à l'installation initiale. Le chargement passe par l'API publique et exige donc un compte
   dont le second facteur est actif : la demande est mémorisée à la création du compte administrateur, puis exécutée une
   seule fois, à la fin de l'enrôlement du second facteur de ce compte. Un échec ne bloque jamais l'installation. */
import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import type { Services } from './services.js';

const CLE = 'demo_en_attente';

/** Mémorise la demande (dans la transaction de création du compte). */
export async function demanderDemo(svc: Services, utilisateur: { id: string; username: string }) {
  await svc.db.k
    .insertInto('settings')
    .values({ key: CLE, value: JSON.stringify(utilisateur) })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value: JSON.stringify(utilisateur) }))
    .execute();
}

/** Exécute la démonstration demandée pour ce compte, une seule fois ; `undefined` si rien n'était demandé pour lui. */
export async function chargerDemoDemandee(
  svc: Services,
  app: FastifyInstance,
  utilisateur: { id: string; username: string },
  ip: string | null,
): Promise<'ok' | 'echec' | undefined> {
  // La demande est consommée d'abord : un échec ne se rejoue pas à chaque connexion.
  const ligne = await svc.db.k
    .deleteFrom('settings')
    .where('key', '=', CLE)
    .where(sql`value->>'id'`, '=', utilisateur.id)
    .returning('key')
    .executeTakeFirst();
  if (!ligne) return undefined;
  try {
    const { chargerJeuDeTest } = await import('./jeu-de-test.js');
    await chargerJeuDeTest(svc, app, utilisateur.username, { publicUrl: svc.cfg.publicUrl || 'https://localhost' });
    await svc.db.audit(utilisateur, ip, 'setup.demo_loaded');
    return 'ok';
  } catch (e) {
    svc.log.error({ err: (e as Error).message }, 'chargement des données de démonstration interrompu');
    await svc.db.audit(utilisateur, ip, 'setup.demo_failed', '', { erreur: (e as Error).message.slice(0, 500) });
    return 'echec';
  }
}
