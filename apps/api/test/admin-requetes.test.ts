/* Requêtes de l'administration (conversion Kysely, ADR 0062) : sessions ouvertes et fermeture d'une session, historique
   des versions de l'état de l'outil historique (liste, téléchargement, restauration). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp, a: Agent, u: TestUser;

beforeAll(async () => {
  t = await createTestApp();
  u = await makeUser(t, 'adq_admin', 'admin');
  a = await login(t, u);
});
afterAll(() => t.close());

describe('administration : requêtes', () => {
  it('sessions ouvertes de tous les comptes, la courante signalée ; fermeture d’une autre session', async () => {
    await login(t, u);
    const liste = (await a.get('/api/admin/sessions')).json() as {
      id: string;
      username: string;
      current: boolean;
      mfa_ok: boolean;
    }[];
    const miennes = liste.filter((x) => x.username === 'adq_admin');
    expect(miennes).toHaveLength(2);
    expect(miennes.filter((x) => x.current)).toHaveLength(1);
    expect(miennes.every((x) => /^[0-9a-f]{64}$/.test(x.id) && x.mfa_ok)).toBe(true);
    const autre = miennes.find((x) => !x.current)!;
    expect((await a.del(`/api/admin/sessions/${autre.id}`)).statusCode).toBeLessThan(300);
    const apres = ((await a.get('/api/admin/sessions')).json() as { id: string }[]).map((x) => x.id);
    expect(apres).not.toContain(autre.id);
  });

  it('versions de l’état : liste, téléchargement et restauration (nouvelle version)', async () => {
    await seedState(t, { fournisseurs: [{ id: 'f1' }] });
    await seedState(t, { fournisseurs: [{ id: 'f1' }, { id: 'f2' }] });
    const versions = (await a.get('/api/admin/versions')).json() as { version: number; bytes: number; items: number }[];
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(versions.map((v) => v.version)).toEqual([...versions.map((v) => v.version)].sort((x, y) => y - x));
    const [recente, precedente] = versions;
    expect(recente!.bytes).toBeGreaterThan(0);
    expect(recente!.items).toBe(0);
    const telecharge = await a.get(`/api/admin/versions/${precedente!.version}`);
    expect(telecharge.statusCode).toBe(200);
    expect(JSON.parse(telecharge.body).fournisseurs).toEqual([{ id: 'f1' }]);
    expect((await a.get('/api/admin/versions/99999')).statusCode).toBe(404);
    const r = await a.post(`/api/admin/versions/${precedente!.version}/restore`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().version).toBeGreaterThan(recente!.version);
    const etat = await t.svc.db.one<{ data: { fournisseurs: unknown[] } }>('SELECT data FROM app_state WHERE id=1');
    expect(etat!.data.fournisseurs).toEqual([{ id: 'f1' }]);
  });
});
