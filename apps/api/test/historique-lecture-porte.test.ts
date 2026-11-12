/* L'état historique lu par les vues natives (audit, DdA, GAP, incidents…) vient de la porte de lecture (ADR 0083) : la
   lecture d'un module renvoie exactement l'état rédigé de la porte, après le contrôle du droit de ce module. Données
   fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PorteeLecture } from '../src/acces/portee.js';
import { createTestApp, makeUser, seedState, sessionUser, type TestApp, type TestUser } from './helpers.js';

describe('lecture de l’état historique par la porte', () => {
  let t: TestApp;
  const u: Record<'admin' | 'audit' | 'conformite' | 'sansDroit', TestUser> = {} as never;
  const lire = async (x: TestUser, module: Parameters<typeof t.svc.historique.registre.lire>[1]) =>
    t.svc.historique.registre.lire(await sessionUser(t, x), module);

  beforeAll(async () => {
    t = await createTestApp();
    u.admin = await makeUser(t, 'hl_admin', 'admin');
    u.audit = await makeUser(t, 'hl_audit', 'ro', { modules: ['audit'] });
    u.conformite = await makeUser(t, 'hl_conformite', 'ro', { modules: ['conformite'] });
    u.sansDroit = await makeUser(t, 'hl_sans_droit', null);
    await seedState(t, {
      suppliers: [{ id: 's1', name: 'Fournisseur fictif', certs: [], controls: [] }],
      processes: [{ id: 'P1', name: 'Processus fictif', family: 'Support', owner: 'Responsable' }],
    });
  }, 60000);
  afterAll(() => t.close());

  it('la lecture d’un module est l’état rédigé de la porte, pour chaque lecteur', async () => {
    for (const [x, module] of [
      [u.admin, 'audit'],
      [u.audit, 'audit'],
      [u.conformite, 'conformite'],
    ] as const) {
      const porte = await PorteeLecture.pour(t.svc.grc, await sessionUser(t, x)).etatHistorique();
      expect(await lire(x, module), x.username).toEqual(porte);
    }
  });

  it('les clés d’un autre module sont vidées, celles du module du lecteur et l’administrateur gardent tout', async () => {
    expect((await lire(u.admin, 'audit')).data.suppliers).toHaveLength(1);
    const vueAudit = (await lire(u.audit, 'audit')).data;
    expect(vueAudit.suppliers).toEqual([]);
    expect(vueAudit.processes).toEqual([]);
  });

  it('sans droit de lecture sur le module, la lecture est refusée avant tout accès à l’état', async () => {
    await expect(lire(u.sansDroit, 'audit')).rejects.toMatchObject({ status: 403 });
    await expect(lire(u.conformite, 'audit')).rejects.toMatchObject({ status: 403 });
  });
});
