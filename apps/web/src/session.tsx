/* Session courante : étape d'accès, utilisateur, jeton CSRF. */
import {
  BUSINESS_MODULES,
  DEFAULT_PREFERENCES,
  type Action,
  type MeOut,
  type Module,
  type Preferences,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { api, get, setCsrf } from './api';
import { closeLocalSession, isPrivateSessionQuery, SESSION_CHANNEL } from './logout';

export const ME_KEY = ['me'] as const;

export async function fetchMe(): Promise<MeOut> {
  const me = await get<MeOut>('/api/auth/me');
  setCsrf(me.csrf);
  return me;
}

const Ctx = createContext<MeOut | null>(null);

export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 60_000, retry: 1 });
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data === 'logout') void closeLocalSession(qc);
    };
    return () => channel.close();
  }, [qc]);
  useEffect(() => {
    if (q.data?.stage === 'anon') {
      void qc.cancelQueries({ predicate: isPrivateSessionQuery });
      qc.removeQueries({ predicate: isPrivateSessionQuery });
    }
  }, [q.data?.stage, qc]);
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

/** Droit « module:action » de la session (affichage seulement : le serveur reste seul juge). */
export function useCan() {
  const me = useMe();
  const set = new Set<string>(me.permissions);
  return (m: Module, a: Action) => set.has(`${m}:${a}`);
}

/** Accès à l'espace d'administration : administration (comptes, journal…) ou import et export. */
export const canAdminArea = (can: (m: Module, a: Action) => boolean) =>
  can('administration', 'lire') || can('import_export', 'lire');

/** Au moins un module métier lisible : accès à l'outil historique. */
export const canReadBusiness = (can: (m: Module, a: Action) => boolean) => BUSINESS_MODULES.some((m) => can(m, 'lire'));

/** Préférences d'affichage de la personne (enregistrées sur le serveur, communes à tous ses appareils). */
export function usePreferences() {
  const me = useMe();
  const qc = useQueryClient();
  const prefs = me.preferences ?? DEFAULT_PREFERENCES;
  const save = async (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch };
    qc.setQueryData<MeOut>(ME_KEY, (m) => (m ? { ...m, preferences: next } : m));
    await api('PUT', '/api/account/preferences', { body: next });
  };
  return { prefs, save };
}
