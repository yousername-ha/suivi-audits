/* Requêtes des notifications métier (conversion Kysely, ADR 0062) : comptes actifs d'un groupe et d'un rôle (désactivés
   et expirés exclus, rôle porté directement ou par un groupe), portée à l'identifiant invalide. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, groupe: string, role: string;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'nq_admin', 'admin'));
  groupe = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Groupe NQ') RETURNING id"))!.id;
  role = 'r_nq_fictif';
  await t.svc.db.q("INSERT INTO roles(id, name, permissions) VALUES ($1, 'Rôle NQ', '{}')", [role]);
  await t.svc.db.q('INSERT INTO group_roles(group_id, role_id) VALUES ($1, $2)', [groupe, role]);
  const ids: Record<string, string> = {};
  for (const nom of ['nq_actif', 'nq_desactive', 'nq_expire', 'nq_direct'])
    ids[nom] = (await makeUser(t, nom, null)).id;
  for (const nom of ['nq_actif', 'nq_desactive', 'nq_expire'])
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [ids[nom], groupe]);
  await t.svc.db.q('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [ids.nq_direct, role]);
  await t.svc.db.q('UPDATE users SET disabled=true WHERE id=$1', [ids.nq_desactive]);
  await t.svc.db.q("UPDATE users SET expires_at=now() - interval '1 day' WHERE id=$1", [ids.nq_expire]);
});
afterAll(() => t.close());

describe('notifications métier : requêtes', () => {
  it('portées : membres actifs d’un groupe et titulaires actifs d’un rôle (direct ou par groupe)', async () => {
    const r = (await admin.get('/api/admin/notifications/portees')).json() as {
      groupes: { id: string; nom: string; membres: number }[];
      roles: { id: string; nom: string; membres: number }[];
    };
    expect(r.groupes.find((g) => g.id === groupe)).toEqual({
      kind: 'groupe',
      id: groupe,
      nom: 'Groupe NQ',
      membres: 1,
    });
    expect(r.roles.find((x) => x.id === role)).toEqual({ kind: 'role', id: role, nom: 'Rôle NQ', membres: 2 });
    const noms = r.groupes.map((g) => g.nom);
    expect(noms).toEqual([...noms].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1)));
  });

  it('fiche d’une portée : nombre de membres actifs ; identifiant qui n’est pas un UUID : introuvable', async () => {
    expect((await admin.get(`/api/admin/notifications/reglages/groupe/${groupe}`)).json().membres).toBe(1);
    expect((await admin.get(`/api/admin/notifications/reglages/role/${role}`)).json().membres).toBe(2);
    expect((await admin.get('/api/admin/notifications/reglages/groupe/pas-un-uuid')).statusCode).toBe(404);
    expect((await admin.get('/api/admin/notifications/reglages/utilisateur/pas-un-uuid')).statusCode).toBe(404);
  });
});
