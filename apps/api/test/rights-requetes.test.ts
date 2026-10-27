/* Requêtes des droits effectifs et des écrans muraux (conversion Kysely, ADR 0062) : attributions directes et par groupe,
   décompte des administrateurs permanents, garde-fou du rôle Auditeur externe, comptes concernés par un rôle,
   instantané pour le journal d'audit, échéances d'un écran mural. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertScopedRoles, loadGrants, permanentAdminCount, rightsSnapshot, usersOfRole } from '../src/rights.js';
import { createTestApp, makeUser, type TestApp } from './helpers.js';

let t: TestApp;
const q = (sql: string, p: unknown[] = []) => t.svc.db.q(sql, p);

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('droits effectifs', () => {
  it('lit les attributions, compte les administrateurs permanents et produit l’instantané', async () => {
    const pool = t.svc.db.pool;
    const base = await permanentAdminCount(pool);
    // Administrateur direct permanent : compté.
    const adm = await makeUser(t, 'dr_admin', 'administrateur');
    expect(await permanentAdminCount(pool)).toBe(base + 1);
    // Administrateur avec échéance, ou désactivé : non comptés.
    await makeUser(t, 'dr_admin_tmp', 'administrateur', { expiresAt: new Date(Date.now() + 86400e3) });
    const off = await makeUser(t, 'dr_admin_off', 'administrateur');
    await q('UPDATE users SET disabled=true WHERE id=$1', [off.id]);
    expect(await permanentAdminCount(pool)).toBe(base + 1);
    // Rôle personnalisé portant administration:administrer, limité à d'autres modules : non compté ; sans limite : compté.
    await q(
      `INSERT INTO roles(id,name,permissions) VALUES('dr_role_admin','Rôle admin fictif','{administration:administrer,audit:lire}')`,
    );
    const lim = await makeUser(t, 'dr_lim', 'dr_role_admin', { modules: ['audit'] });
    expect(await permanentAdminCount(pool)).toBe(base + 1);
    await q(`UPDATE user_roles SET modules='{audit,administration}' WHERE user_id=$1`, [lim.id]);
    expect(await permanentAdminCount(pool)).toBe(base + 2);
    // Par un groupe : compté.
    const g = (await t.svc.db.one<{ id: string }>(`INSERT INTO groups(name) VALUES('Groupe fictif B') RETURNING id`))!
      .id;
    const g2 = (await t.svc.db.one<{ id: string }>(`INSERT INTO groups(name) VALUES('Groupe fictif A') RETURNING id`))!
      .id;
    await q(`INSERT INTO group_roles(group_id,role_id) VALUES($1,'dr_role_admin')`, [g]);
    const viaGroupe = await makeUser(t, 'dr_groupe', null);
    await q('INSERT INTO user_groups(user_id,group_id) VALUES($1,$2),($1,$3)', [viaGroupe.id, g, g2]);
    expect(await permanentAdminCount(pool)).toBe(base + 3);

    // Attributions : directe (avec portée) et héritée du groupe (portée ignorée).
    await q(`INSERT INTO user_roles(user_id,role_id,modules) VALUES($1,'lecteur','{documents}')`, [viaGroupe.id]);
    const grants = (await loadGrants(pool, viaGroupe.id)).sort((a, b) => a.roleId.localeCompare(b.roleId));
    expect(grants).toHaveLength(2);
    expect(grants.find((x) => x.roleId === 'dr_role_admin')).toMatchObject({
      roleName: 'Rôle admin fictif',
      permissions: ['administration:administrer', 'audit:lire'],
      modules: null,
      via: { kind: 'group', groupId: g, groupName: 'Groupe fictif B' },
    });
    expect(grants.find((x) => x.roleId === 'lecteur')).toMatchObject({
      modules: ['documents'],
      via: { kind: 'direct' },
    });
    expect(await loadGrants(pool, adm.id)).toMatchObject([{ roleId: 'administrateur', via: { kind: 'direct' } }]);

    // Comptes concernés par un rôle : directs et par groupe, sans doublon.
    await q(`INSERT INTO user_roles(user_id,role_id) VALUES($1,'dr_role_admin')`, [viaGroupe.id]);
    expect((await usersOfRole(pool, 'dr_role_admin')).sort()).toEqual([lim.id, viaGroupe.id].sort());

    // Instantané : rôles triés avec portée, groupes triés, comptes triés sans casse.
    const snap = await rightsSnapshot(pool, [viaGroupe.id, adm.id, lim.id]);
    expect(Object.keys(snap)).toEqual(['dr_admin', 'dr_groupe', 'dr_lim']);
    expect(snap.dr_groupe).toEqual({
      roles: ['dr_role_admin', 'lecteur[documents]'],
      groups: ['Groupe fictif A', 'Groupe fictif B'],
      expires: null,
      disabled: false,
    });
    expect(snap.dr_lim).toMatchObject({ roles: ['dr_role_admin[audit,administration]'], groups: [] });
    expect(await rightsSnapshot(pool, [])).toEqual({});
  });

  it('exige une échéance et des modules pour l’Auditeur externe', async () => {
    const pool = t.svc.db.pool;
    const sans = await makeUser(t, 'dr_aud1', 'auditeur_externe', { modules: ['audit'] });
    await expect(assertScopedRoles(pool, [sans.id])).rejects.toThrow(/date d’expiration est obligatoire/);
    const vide = await makeUser(t, 'dr_aud2', 'auditeur_externe', {
      modules: [],
      expiresAt: new Date(Date.now() + 86400e3),
    });
    await expect(assertScopedRoles(pool, [vide.id])).rejects.toThrow(/choisissez les modules/);
    const ok = await makeUser(t, 'dr_aud3', 'auditeur_externe', {
      modules: ['audit'],
      expiresAt: new Date(Date.now() + 86400e3),
    });
    await expect(assertScopedRoles(pool, [ok.id])).resolves.toBeUndefined();
    await expect(assertScopedRoles(pool, [])).resolves.toBeUndefined();
  });
});

describe('écrans muraux', () => {
  it('fixe les échéances d’activation (24 h) et de validité (jours demandés)', async () => {
    const { id, code } = await t.svc.walls.create('Écran fictif', ['audit'], 7, 'dr_admin');
    expect(code.length).toBeGreaterThan(20);
    const r = await t.svc.db.one<{ act: number; exp: number; modules: string[]; created_by: string }>(
      `SELECT extract(epoch FROM activation_expires - now())::int AS act, extract(epoch FROM expires_at - now())::int AS exp,
              modules, created_by FROM wall_screens WHERE id=$1`,
      [id],
    );
    expect(Math.abs(r!.act - 86400)).toBeLessThan(60);
    expect(Math.abs(r!.exp - 7 * 86400)).toBeLessThan(60);
    expect(r).toMatchObject({ modules: ['audit'], created_by: 'dr_admin' });
    expect(await t.svc.walls.revoke(id, 'dr_admin')).toBe('Écran fictif');
    expect(await t.svc.walls.revoke(id, 'dr_admin')).toBeNull();
  });
});
