/* Temps réel : flux SSE /api/events. Chaque changement invalide le cache TanStack Query de l'entité concernée ;
   la présence (qui consulte ou modifie quoi) est partagée par contexte. Reconnexion automatique (EventSource). */
import { PRESENCE_HEARTBEAT_MS, type ChangeEvent, type PresenceEntry, type PresenceMode } from '@suivi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { ME_KEY, useMe } from './session';

/** Clés de requête invalidées pour chaque entité. */
const KEYS: Record<string, string[][]> = {
  documents: [['documents'], ['document'], ['categories']],
  document_versions: [['document'], ['documents']],
  links: [['links'], ['categories']],
  users: [['admin', 'users'], ME_KEY as unknown as string[]],
  sessions: [
    ['admin', 'sessions'],
    ['account', 'sessions'],
  ],
  settings: [['setup'], ['synthese'], ['settings']],
  legacy_state: [['refs'], ['admin', 'versions'], ['admin', 'info'], ['synthese']],
  wall_screens: [['admin', 'murs']],
  groups: [['admin']],
  roles: [['admin']],
  import_batches: [['admin', 'imports']],
};

interface Live {
  connected: boolean;
  presence: PresenceEntry[];
  lastChange: ChangeEvent | null;
  client: string;
}
const LiveCtx = createContext<Live>({ connected: false, presence: [], lastChange: null, client: '' });

const newClientId = () => {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return 'c' + [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useMe();
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [lastChange, setLastChange] = useState<ChangeEvent | null>(null);
  const client = useMemo(newClientId, []);

  useEffect(() => {
    if (me.stage !== 'ok') return;
    const es = new EventSource('/api/events');
    let first = true;
    es.addEventListener('hello', (m) => {
      setConnected(true);
      setPresence((JSON.parse((m as MessageEvent).data) as { presence: PresenceEntry[] }).presence);
      // Après une reconnexion, des changements ont pu être manqués : on recharge tout.
      if (!first) void qc.invalidateQueries();
      first = false;
    });
    es.addEventListener('change', (m) => {
      const e = JSON.parse((m as MessageEvent).data) as ChangeEvent;
      setLastChange(e);
      for (const k of KEYS[e.entity] ?? []) void qc.invalidateQueries({ queryKey: k });
    });
    es.addEventListener('presence', (m) => setPresence(JSON.parse((m as MessageEvent).data) as PresenceEntry[]));
    es.addEventListener('logout', () => {
      es.close();
      void qc.invalidateQueries({ queryKey: ME_KEY });
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [me.stage, qc]);

  const value = useMemo(() => ({ connected, presence, lastChange, client }), [connected, presence, lastChange, client]);
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export const useLive = () => useContext(LiveCtx);

/** Déclare la présence de l'utilisateur sur une ressource (renouvelée toutes les 20 s, retirée en quittant). */
export function usePresence(resource: string | null, mode: PresenceMode = 'view') {
  const { client } = useLive();
  const sent = useRef<string>('');
  useEffect(() => {
    if (!resource || !client) return;
    const key = `${client}-${resource.replace(/[^a-z0-9_-]/gi, '_')}`.slice(0, 64);
    const beat = () => api('POST', '/api/presence', { body: { client: key, resource, mode } }).catch(() => {});
    void beat();
    sent.current = key;
    const t = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    return () => {
      clearInterval(t);
      void api('DELETE', `/api/presence/${key}`).catch(() => {});
    };
  }, [client, resource, mode]);
}

/** Présences sur une ressource (ou ses sous-ressources), hors utilisateur courant. */
export function usePresenceOn(prefix: string) {
  const { presence } = useLive();
  const me = useMe();
  return presence.filter(
    (p) => (p.resource === prefix || p.resource.startsWith(prefix + '/')) && p.username !== me.user?.username,
  );
}
