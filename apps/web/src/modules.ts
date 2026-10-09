/* Après une reconfiguration, aucune ancienne donnée privée ne doit rester dans un observateur actif. */
import type { QueryClient } from '@tanstack/react-query';
import type { MeOut } from '@suivi/shared';
import { isPrivateSessionQuery, WALL_QUERY_KEY } from './logout';
import { fetchMe, ME_KEY } from './session';

export async function reloadModuleConfiguration(qc: QueryClient, initialConnection = false) {
  const previous = qc.getQueryData<MeOut>(ME_KEY);
  if (!initialConnection) await qc.cancelQueries();
  const me = await fetchMe();
  qc.setQueryData(ME_KEY, me);
  // Au premier hello, les données viennent d'être chargées avec ces droits. Éviter
  // de les vider une seconde fois ; une modification effective exige toujours la purge.
  if (
    initialConnection &&
    previous?.stage === 'ok' &&
    me.stage === 'ok' &&
    JSON.stringify(previous.permissions) === JSON.stringify(me.permissions)
  )
    return;
  if (initialConnection) await qc.cancelQueries();
  // resetQueries avertit aussi les observateurs déjà montés ; removeQueries seul ne le fait pas.
  await qc.resetQueries({ predicate: isPrivateSessionQuery });
  qc.removeQueries({ predicate: (q) => isPrivateSessionQuery(q) && q.getObserversCount() === 0 });
  await qc.resetQueries({ queryKey: WALL_QUERY_KEY, exact: true });
}
