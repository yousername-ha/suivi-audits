/* Fermeture de session : conserver la requête observée « me », purger les données privées et avertir les onglets.
   Aucun identifiant de session ou jeton n'est transmis sur le canal navigateur. */
import type { MeOut } from '@suivi/shared';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError, api, setCsrf } from './api';

export const SESSION_CHANNEL = 'suivi-session';
export const SESSION_KEY = ['me'] as const;
export const WALL_QUERY_KEY = ['synthese', 'mur'] as const;

/** L'écran mural a sa propre autorisation serveur ; conserver sa requête observée, pas son ancienne donnée. */
export const isPrivateSessionQuery = (q: { queryKey: readonly unknown[] }) =>
  q.queryKey[0] !== SESSION_KEY[0] &&
  q.queryKey[0] !== 'setup' &&
  !(q.queryKey[0] === WALL_QUERY_KEY[0] && q.queryKey[1] === WALL_QUERY_KEY[1]);

export async function closeLocalSession(qc: QueryClient) {
  await qc.cancelQueries();
  setCsrf(null);
  qc.setQueryData<MeOut>(SESSION_KEY, (me) =>
    me ? { ...me, stage: 'anon', csrf: null, user: null, permissions: [], preferences: null } : me,
  );
  qc.removeQueries({ predicate: isPrivateSessionQuery });
  await qc.resetQueries({ queryKey: WALL_QUERY_KEY, exact: true });
}

export async function logout(qc: QueryClient) {
  try {
    await api('POST', '/api/auth/logout');
  } catch (e) {
    // Une session déjà expirée renvoie 401 à la garde CSRF ; les autres erreurs ne prouvent pas sa fermeture.
    if (!(e instanceof ApiError && e.status === 401)) throw e;
  }
  await closeLocalSession(qc);
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.postMessage('logout');
    channel.close();
  }
}
