import { QueryClient, QueryObserver } from '@tanstack/react-query';
import type { MeOut } from '@suivi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setCsrf } from '../src/api';
import { closeLocalSession, logout, SESSION_KEY, WALL_QUERY_KEY } from '../src/logout';

const me: MeOut = {
  stage: 'ok',
  csrf: 'csrf-test',
  user: {
    id: '1',
    username: 'test',
    displayName: 'Test',
    roles: [],
    expiresAt: null,
    totpEnabled: true,
    cles: 0,
    mustChangePassword: false,
  },
  permissions: ['documents:lire'],
  preferences: null,
  mfaRequired: true,
  webauthn: true,
  passwordMinLength: 12,
  appName: 'Suivi',
  orgName: 'Test',
  orgSite: '',
  appearance: { theme: 'auto', densite: 'normale', style: 'sage' },
  version: '3.0.0',
};
let qc: QueryClient;
const request = vi.fn();
const messages = vi.fn();
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(SESSION_KEY, me);
  qc.setQueryData(['documents'], ['contenu privé']);
  setCsrf(me.csrf);
  vi.stubGlobal('fetch', request);
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      postMessage = messages;
      close() {}
    },
  );
});
afterEach(() => {
  qc.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('déconnexion', () => {
  it('réinitialise les données murales sans supprimer leur requête observée et recontrôle leur accès', async () => {
    qc.setQueryData(WALL_QUERY_KEY, { contenu: 'ancienne synthèse privée' });
    const observer = new QueryObserver(qc, {
      queryKey: WALL_QUERY_KEY,
      queryFn: async () => ({ autorise: false }),
      staleTime: Infinity,
    });
    const stop = observer.subscribe(() => {});
    const query = qc.getQueryCache().find({ queryKey: WALL_QUERY_KEY });
    await closeLocalSession(qc);
    expect(qc.getQueryCache().find({ queryKey: WALL_QUERY_KEY })).toBe(query);
    expect(qc.getQueryData(WALL_QUERY_KEY)).toEqual({ autorise: false });
    expect(qc.getQueryData(['documents'])).toBeUndefined();
    stop();
  });
  it('attend le serveur, conserve la requête session observée et retire les données privées', async () => {
    request.mockResolvedValue(new Response(null, { status: 204 }));
    await logout(qc);
    expect(request.mock.calls[0]![1].headers['X-CSRF-Token']).toBe(me.csrf);
    expect(qc.getQueryData(SESSION_KEY)).toMatchObject({ stage: 'anon', user: null, csrf: null, permissions: [] });
    expect(qc.getQueryData(['documents'])).toBeUndefined();
    expect(messages).toHaveBeenCalledWith('logout');
    await api('POST', '/test');
    expect(request.mock.calls[1]![1].headers['X-CSRF-Token']).toBeUndefined();
  });
  it.each([403, 500])('préserve la session et le cache si le serveur refuse (%i)', async (status) => {
    request.mockResolvedValue(
      new Response('{"error":"Refus"}', { status, headers: { 'Content-Type': 'application/json' } }),
    );
    await expect(logout(qc)).rejects.toThrow('Refus');
    expect(qc.getQueryData(SESSION_KEY)).toEqual(me);
    expect(qc.getQueryData(['documents'])).toEqual(['contenu privé']);
    expect(messages).not.toHaveBeenCalled();
  });
  it('ne prétend pas avoir fermé la session en cas d’échec réseau', async () => {
    request.mockRejectedValue(new Error('network'));
    await expect(logout(qc)).rejects.toThrow('Serveur injoignable');
    expect(qc.getQueryData(SESSION_KEY)).toEqual(me);
    expect(messages).not.toHaveBeenCalled();
  });
  it('purge une session déjà expirée (401)', async () => {
    request.mockResolvedValue(new Response(null, { status: 401 }));
    await logout(qc);
    expect(qc.getQueryData<MeOut>(SESSION_KEY)?.stage).toBe('anon');
  });
  it('annule une lecture privée en cours pour empêcher son retour après la purge', async () => {
    const running = qc
      .fetchQuery({
        queryKey: ['documents', 'pending'],
        queryFn: ({ signal }) =>
          new Promise<string>((resolve) => {
            signal.addEventListener('abort', () => resolve('ancien contenu'));
          }),
      })
      .catch(() => {});
    await closeLocalSession(qc);
    await running;
    expect(qc.getQueryData(['documents', 'pending'])).toBeUndefined();
  });
});
