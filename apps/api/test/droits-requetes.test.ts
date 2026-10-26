/* Requêtes de l'administration des droits (conversion Kysely, ADR 0062) : modification d'un compte sans changement de
   droits, déverrouillage, mot de passe temporaire, double authentification, suppression, modifications partielles
   d'un groupe et d'un rôle (valeurs conservées), liste ordonnée des comptes. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp, admin: Agent, adminUser: TestUser;
const sessions = async (id: string) =>
  (await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM sessions WHERE user_id=$1', [id]))!.n;
const compte = async (id: string) =>
  (await t.svc.db.one<{
    version: number;
    display_name: string;
    failed_logins: number;
    locked_until: Date | null;
    must_change_password: boolean;
    totp_enabled: boolean;
    totp_secret: Buffer | null;
  }>(
    'SELECT version, display_name, failed_logins, locked_until, must_change_password, totp_enabled, totp_secret FROM users WHERE id=$1',
    [id],
  ))!;
const etag = async (url: string) => String((await admin.get(url)).headers.etag);

beforeAll(async () => {
  t = await createTestApp();
  adminUser = await makeUser(t, 'dq_admin', 'admin');
  admin = await login(t, adminUser);
});
afterAll(() => t.close());

describe('droits : requêtes', () => {
  it('modifier l’identité d’un compte incrémente la version sans couper ses sessions', async () => {
    const u = await makeUser(t, 'dq_identite', 'ro');
    await login(t, u);
    const avant = await compte(u.id);
    const r = await admin.patch(
      `/api/admin/users/${u.id}`,
      { displayName: 'Nom modifié', email: 'dq@example.invalid' },
      { 'if-match': await etag(`/api/admin/users/${u.id}`) },
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      display_name: 'Nom modifié',
      email: 'dq@example.invalid',
      version: avant.version + 1,
    });
    expect(r.headers.etag).toBe(`"${avant.version + 1}"`);
    expect(await sessions(u.id)).toBeGreaterThan(0);
  });

  it('déverrouiller remet à zéro les échecs et lève le verrou', async () => {
    const u = await makeUser(t, 'dq_verrou', 'ro');
    await t.svc.db.q("UPDATE users SET failed_logins=5, locked_until=now() + interval '1 hour' WHERE id=$1", [u.id]);
    const r = await admin.patch(
      `/api/admin/users/${u.id}`,
      { unlock: true },
      { 'if-match': await etag(`/api/admin/users/${u.id}`) },
    );
    expect(r.statusCode, r.body).toBe(200);
    const c = await compte(u.id);
    expect([c.failed_logins, c.locked_until]).toEqual([0, null]);
  });

  it('mot de passe temporaire : changement imposé, sessions coupées, version incrémentée ; 404 si inconnu', async () => {
    const u = await makeUser(t, 'dq_mdp', 'ro');
    await login(t, u);
    const avant = await compte(u.id);
    const r = await admin.post(`/api/admin/users/${u.id}/reset-password`, {});
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().temporaryPassword).toBeTruthy();
    const c = await compte(u.id);
    expect([c.must_change_password, c.version]).toEqual([true, avant.version + 1]);
    expect(await sessions(u.id)).toBe(0);
    expect(
      (await admin.post('/api/admin/users/00000000-0000-4000-8000-0000000000ee/reset-password', {})).statusCode,
    ).toBe(404);
  });

  it('réinitialiser la double authentification efface le secret et coupe les sessions ; 404 si inconnu', async () => {
    const u = await makeUser(t, 'dq_mfa', 'ro');
    await login(t, u);
    const r = await admin.post(`/api/admin/users/${u.id}/reset-mfa`, {});
    expect(r.statusCode, r.body).toBeLessThan(300);
    const c = await compte(u.id);
    expect([c.totp_enabled, c.totp_secret]).toEqual([false, null]);
    expect(await sessions(u.id)).toBe(0);
    expect((await admin.post('/api/admin/users/00000000-0000-4000-8000-0000000000ee/reset-mfa', {})).statusCode).toBe(
      404,
    );
  });

  it('supprimer un compte : une fois, puis 404 ; jamais le sien', async () => {
    const u = await makeUser(t, 'dq_suppr', 'ro');
    expect((await admin.del(`/api/admin/users/${u.id}`)).statusCode).toBeLessThan(300);
    expect((await admin.del(`/api/admin/users/${u.id}`)).statusCode).toBe(404);
    expect((await admin.del(`/api/admin/users/${adminUser.id}`)).statusCode).toBe(409);
  });

  it('modifications partielles : le groupe garde son nom, le rôle garde ses permissions', async () => {
    const g = await admin.post('/api/admin/groups', {
      name: 'Groupe DQ',
      description: 'Avant',
      roles: [],
      members: [],
    });
    expect(g.statusCode, g.body).toBe(201);
    const pg = await admin.patch(
      `/api/admin/groups/${g.json().id}`,
      { description: 'Après' },
      { 'if-match': `"${g.json().version}"` },
    );
    expect(pg.statusCode, pg.body).toBe(200);
    expect(pg.json()).toMatchObject({ name: 'Groupe DQ', description: 'Après', version: g.json().version + 1 });
    const r = await admin.post('/api/admin/roles', { from: 'lecteur', name: 'Rôle DQ' });
    expect(r.statusCode, r.body).toBe(201);
    const pr = await admin.patch(
      `/api/admin/roles/${r.json().id}`,
      { name: 'Rôle DQ renommé' },
      { 'if-match': `"${r.json().version}"` },
    );
    expect(pr.statusCode, pr.body).toBe(200);
    expect(pr.json()).toMatchObject({ name: 'Rôle DQ renommé', version: r.json().version + 1, based_on: 'lecteur' });
    expect([...pr.json().permissions].sort()).toEqual([...r.json().permissions].sort());
    expect((await admin.del(`/api/admin/roles/${r.json().id}`)).statusCode).toBeLessThan(300);
    expect((await admin.del(`/api/admin/groups/${g.json().id}`)).statusCode).toBeLessThan(300);
  });

  it('liste des comptes : ordre alphabétique sans casse, rôles et groupes agrégés', async () => {
    const liste = (await admin.get('/api/admin/users')).json() as {
      username: string;
      roles: { id: string }[];
      groups: unknown[];
      sessions: number;
    }[];
    const noms = liste.map((u) => u.username);
    expect(noms).toEqual([...noms].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1)));
    const a = liste.find((u) => u.username === 'dq_admin')!;
    expect(a.roles.map((r) => r.id)).toContain('administrateur');
    expect(Array.isArray(a.groups)).toBe(true);
    expect(a.sessions).toBeGreaterThan(0);
  });
});
