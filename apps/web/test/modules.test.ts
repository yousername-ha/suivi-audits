import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadModuleConfiguration } from '../src/modules';
import type { MeOut } from '@suivi/shared';
import { fetchMe } from '../src/session';
vi.mock('../src/session', () => ({ ME_KEY: ['me'], fetchMe: vi.fn() }));
afterEach(() => vi.clearAllMocks());
describe('reconfiguration des modules dans le navigateur', () => {
  it('renouvelle les droits, efface les données des observateurs et recharge des données filtrées', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const me = { stage: 'ok', permissions: ['administration:lire'] } as MeOut;
    vi.mocked(fetchMe).mockResolvedValue(me);
    qc.setQueryData(['me'], { permissions: ['documents:lire', 'administration:lire'] });
    qc.setQueryData(['documents'], ['ancien document confidentiel']);
    qc.setQueryData(['document', 'inactif'], { title: 'ancienne donnée' });
    const observer = new QueryObserver(qc, { queryKey: ['documents'], queryFn: async () => [] });
    const seen: unknown[] = [];
    const stop = observer.subscribe((r) => seen.push(r.data));
    await reloadModuleConfiguration(qc);
    expect(qc.getQueryData(['me'])).toEqual(me);
    expect(seen).toContain(undefined);
    expect(observer.getCurrentResult().data).toEqual([]);
    expect(qc.getQueryData(['document', 'inactif'])).toBeUndefined();
    stop();
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
