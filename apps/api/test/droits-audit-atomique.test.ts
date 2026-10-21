/* Traçabilité des droits (022-05, 022-06) : le journal d'une modification de comptes, groupes ou rôles est écrit dans la
   même transaction que la modification (aucune modification sans trace) ; un 412 protège groupes et rôles. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

let t: TestApp;
let admin: TestUser;
let A: Agent;

beforeAll(async () => {
  t = await createTestApp();
  admin = await makeUser(t, 'admin', 'admin');
  A = await login(t, admin);
});
afterAll(() => t.close());

/** Fait échouer l'écriture du journal pour l'action donnée, puis rétablit le comportement normal. */
async function sansJournal<T>(action: string, f: () => Promise<T>): Promise<T> {
  const original = t.svc.db.audit.bind(t.svc.db);
  const espion = vi.spyOn(t.svc.db, 'audit').mockImplementation(async (who, ip, a, target, details, c) => {
    if (a === action && c) throw new Error('journal indisponible');
    return original(who, ip, a, target, details, c);
  });
  try {
    return await f();
  } finally {
    espion.mockRestore();
  }
}

describe('le journal des droits est atomique', () => {
  it('rôle : sans trace possible, ni création, ni modification, ni suppression', async () => {
    const r = await sansJournal('admin.role_create', () =>
      A.post('/api/admin/roles', { from: 'lecteur', name: 'Rôle sans trace' }),
    );
    expect(r.statusCode).toBe(500);
    expect(await t.svc.db.one("SELECT 1 FROM roles WHERE name = 'Rôle sans trace'")).toBeFalsy();

    const role = (await A.post('/api/admin/roles', { from: 'lecteur', name: 'Rôle tracé' })).json();
    const modif = await sansJournal('admin.role_update', () =>
      A.patch(`/api/admin/roles/${role.id}`, { description: 'x' }, { 'if-match': `"${role.version}"` }),
    );
    expect(modif.statusCode).toBe(500);
    expect((await t.svc.db.one<{ version: number }>('SELECT version FROM roles WHERE id=$1', [role.id]))!.version).toBe(
      role.version,
    );
    const suppr = await sansJournal('admin.role_delete', () => A.del(`/api/admin/roles/${role.id}`));
    expect(suppr.statusCode).toBe(500);
    expect(await t.svc.db.one('SELECT 1 FROM roles WHERE id=$1', [role.id])).toBeTruthy();
    // Sans panne, la même suppression réussit et laisse sa trace.
    expect((await A.del(`/api/admin/roles/${role.id}`)).statusCode).toBeLessThan(300);
    expect(
      await t.svc.db.one("SELECT 1 FROM audit_log WHERE action='admin.role_delete' AND target='Rôle tracé'"),
    ).toBeTruthy();
  });

  it('groupe et compte : même garantie', async () => {
    const g = await sansJournal('admin.group_create', () =>
      A.post('/api/admin/groups', { name: 'Groupe sans trace', roles: [], members: [] }),
    );
    expect(g.statusCode).toBe(500);
    expect(await t.svc.db.one("SELECT 1 FROM groups WHERE name = 'Groupe sans trace'")).toBeFalsy();

    const u = await sansJournal('admin.user_create', () =>
      A.post('/api/admin/users', { username: 'sans-trace', roles: [{ roleId: 'lecteur' }], groups: [] }),
    );
    expect(u.statusCode).toBe(500);
    expect(await t.svc.db.one("SELECT 1 FROM users WHERE username = 'sans-trace'")).toBeFalsy();

    const cible = await makeUser(t, 'cible', 'lecteur');
    const v = (await t.svc.db.one<{ version: number }>('SELECT version FROM users WHERE id=$1', [cible.id]))!.version;
    const modif = await sansJournal('admin.user_update', () =>
      A.patch(`/api/admin/users/${cible.id}`, { disabled: true }, { 'if-match': `"${v}"` }),
    );
    expect(modif.statusCode).toBe(500);
    expect(
      (await t.svc.db.one<{ disabled: boolean }>('SELECT disabled FROM users WHERE id=$1', [cible.id]))!.disabled,
    ).toBe(false);
  });
});

describe('concurrence sur les droits (412)', () => {
  it('groupe et rôle : une version périmée est refusée sans modification', async () => {
    const g = (await A.post('/api/admin/groups', { name: 'Groupe versionné', roles: [], members: [] })).json();
    const maj = await A.patch(`/api/admin/groups/${g.id}`, { description: 'a' }, { 'if-match': `"${g.version}"` });
    expect(maj.statusCode).toBe(200);
    const perime = await A.patch(`/api/admin/groups/${g.id}`, { description: 'b' }, { 'if-match': `"${g.version}"` });
    expect(perime.statusCode).toBe(412);
    expect(
      (await t.svc.db.one<{ description: string }>('SELECT description FROM groups WHERE id=$1', [g.id]))!.description,
    ).toBe('a');
    expect((await A.patch(`/api/admin/groups/${g.id}`, { description: 'c' })).statusCode).toBe(428);

    const role = (await A.post('/api/admin/roles', { from: 'lecteur', name: 'Rôle versionné' })).json();
    const ok = await A.patch(`/api/admin/roles/${role.id}`, { description: 'a' }, { 'if-match': `"${role.version}"` });
    expect(ok.statusCode).toBe(200);
    const ancien = await A.patch(
      `/api/admin/roles/${role.id}`,
      { description: 'b' },
      { 'if-match': `"${role.version}"` },
    );
    expect(ancien.statusCode).toBe(412);
    expect((await A.patch(`/api/admin/roles/${role.id}`, { description: 'c' })).statusCode).toBe(428);
  });
});
