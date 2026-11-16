/* Questions « Flux vers l'extérieur » de l'assistant d'installation (ADR 0097, lot 3). Même mécanisme que les données de
   démonstration (demo-installation.ts) : la demande est mémorisée à la création du compte administrateur par l'installation,
   dans la transaction qui consomme le jeton, puis proposée à ce seul compte, une fois sa session complète (second facteur
   enrôlé), jusqu'à ce qu'il termine ou passe l'étape. Aucune ouverture ici : l'étape ouvre chaque flux par le geste
   d'activation du module (routes, droit administration:administrer, validation explicite et journal du lot 1). */
import { FLUX_MODULES } from '@suivi/shared';
import { sql } from 'kysely';
import type { Actor, Kdb } from './db/db.js';
import type { Services } from './services.js';

const CLE = 'flux_questions_en_attente';

/** Mémorise la demande pour le compte créé (dans la transaction de création du compte). */
export async function proposerQuestionsFlux(k: Kdb, utilisateur: { id: string; username: string }) {
  await k
    .insertInto('settings')
    .values({ key: CLE, value: JSON.stringify(utilisateur) })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value: JSON.stringify(utilisateur) }))
    .execute();
}

/** Vrai si l'étape reste à proposer à ce compte. */
export async function questionsFluxAProposer(svc: Services, id: string): Promise<boolean> {
  const l = await svc.db.k
    .selectFrom('settings')
    .select('key')
    .where('key', '=', CLE)
    .where(sql`value->>'id'`, '=', id)
    .executeTakeFirst();
  return !!l;
}

/** L'étape est terminée ou passée : la demande est consommée (elle n'est plus reposée) et l'état des flux à cet instant est
    inscrit au journal. Sans demande pour ce compte, rien n'est écrit. */
export async function questionsFluxVues(svc: Services, utilisateur: Actor & { id: string }, ip: string) {
  const ligne = await svc.db.k
    .deleteFrom('settings')
    .where('key', '=', CLE)
    .where(sql`value->>'id'`, '=', utilisateur.id)
    .returning('key')
    .executeTakeFirst();
  if (!ligne) return;
  const etats = await svc.flux.etat();
  await svc.db.audit(utilisateur, ip, 'setup.flux_questions_vues', '', {
    ouverts: etats.filter((e) => e.ouvert).map((e) => e.module),
    fermes: FLUX_MODULES.filter((m) => !etats.some((e) => e.module === m && e.ouvert)),
  });
}
