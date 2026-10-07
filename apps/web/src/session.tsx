/* Session courante : étape d'accès, utilisateur, jeton CSRF. */
import type { MeOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { get, setCsrf } from './api';

export const ME_KEY = ['me'] as const;

export async function fetchMe(): Promise<MeOut> {
  const me = await get<MeOut>('/api/auth/me');
  setCsrf(me.csrf);
  return me;
}

const Ctx = createContext<MeOut | null>(null);

export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const q = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 60_000, retry: 1 });
  if (!q.data) return <>{fallback}</>;
  return <Ctx.Provider value={q.data}>{children}</Ctx.Provider>;
}

export function useMe(): MeOut {
  const me = useContext(Ctx);
  if (!me) throw new Error('SessionProvider manquant');
  return me;
}

/** Recharge la session (après connexion, double authentification, déconnexion…). */
export function useRefreshMe() {
  const qc = useQueryClient();
  return async () => {
    const me = await fetchMe();
    qc.setQueryData(ME_KEY, me);
    return me;
  };
}
