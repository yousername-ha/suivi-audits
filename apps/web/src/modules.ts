/* Après une reconfiguration, aucune ancienne donnée privée ne doit rester dans un observateur actif. */
import type { QueryClient } from '@tanstack/react-query';
import { isPrivateSessionQuery, WALL_QUERY_KEY } from './logout';
import { fetchMe, ME_KEY } from './session';

export async function reloadModuleConfiguration(qc: QueryClient) {
  await qc.cancelQueries();
  const me = await fetchMe();
  qc.setQueryData(ME_KEY, me);
  // resetQueries avertit aussi les observateurs déjà montés ; removeQueries seul ne le fait pas.
  await qc.resetQueries({ predicate: isPrivateSessionQuery });
  qc.removeQueries({ predicate: (q) => isPrivateSessionQuery(q) && q.getObserversCount() === 0 });
  await qc.resetQueries({ queryKey: WALL_QUERY_KEY, exact: true });
}
