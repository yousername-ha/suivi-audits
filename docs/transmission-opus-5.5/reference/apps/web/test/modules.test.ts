import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadModuleConfiguration } from '../src/modules';
import type { MeOut } from '@suivi/shared';
import { fetchMe } from '../src/session';
vi.mock('../src/session', () => ({ ME_KEY: ['me'], fetchMe: vi.fn() }));
afterEach(() => vi.clearAllMocks());
describe('reconfiguration des modules dans le navigateur', () => {
  it.each([false, true])(
    'renouvelle les droits et purge les observateurs (première connexion : %s)',
    async (initial) => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
      const me = { stage: 'ok', permissions: ['administration:lire'] } as MeOut;
      vi.mocked(fetchMe).mockResolvedValue(me);
      qc.setQueryData(['me'], { stage: 'ok', permissions: ['documents:lire', 'administration:lire'] });
      qc.setQueryData(['documents'], ['ancien document confidentiel']);
      qc.setQueryData(['document', 'inactif'], { title: 'ancienne donnée' });
      const observer = new QueryObserver(qc, { queryKey: ['documents'], queryFn: async () => [] });
      const seen: unknown[] = [];
      const stop = observer.subscribe((r) => seen.push(r.data));
      expect(await reloadModuleConfiguration(qc, initial)).toBe(true);
      expect(qc.getQueryData(['me'])).toEqual(me);
      expect(seen).toContain(undefined);
      expect(observer.getCurrentResult().data).toEqual([]);
      expect(qc.getQueryData(['document', 'inactif'])).toBeUndefined();
      stop();
      qc.clear();
    },
  );
  it('au premier hello avec les mêmes droits, conserve les données qui viennent d’être chargées', async () => {
    const qc = new QueryClient();
    const me = { stage: 'ok', permissions: ['documents:lire'] } as MeOut;
    qc.setQueryData(['me'], me);
    qc.setQueryData(['documents'], ['document visible']);
    vi.mocked(fetchMe).mockResolvedValue(me);
    expect(await reloadModuleConfiguration(qc, true)).toBe(false);
    expect(fetchMe).toHaveBeenCalledOnce();
    expect(qc.getQueryData(['documents'])).toEqual(['document visible']);
    qc.clear();
  });
  it('réinitialise aussi les données de l’écran mural', async () => {
    const qc = new QueryClient();
    vi.mocked(fetchMe).mockResolvedValue({ stage: 'ok', permissions: [] } as unknown as MeOut);
    qc.setQueryData(['synthese', 'mur'], { suppliers: ['ancienne valeur'] });
    await reloadModuleConfiguration(qc);
    expect(qc.getQueryData(['synthese', 'mur'])).toBeUndefined();
    qc.clear();
  });
});
