/* Requêtes de l'authentification (conversion Kysely, ADR 0062) : identifiant sans casse, verrou existant conservé après
   un échec, sessions inactives ou expirées refusées puis purgées, fermeture des autres sessions. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, PASSWORD, type TestApp } from './helpers.js';

let t: TestApp;
const sessions = async (id: string) =>
  (await t.svc.db.q<{ id_hash: Buffer }>('SELECT id_hash FROM sessions WHERE user_id=$1 ORDER BY created_at', [id]))
    .rows;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('authentification : requêtes', () => {
  it('l’identifiant est comparé sans casse', async () => {
    await makeUser(t, 'aq_casse', 'ro');
    const r = await t.svc.auth.checkLogin('AQ_Casse', PASSWORD);
    expect(r.ok).toBe(true);
    expect(r.user?.username).toBe('aq_casse');
  });

  it('un échec sous le seuil incrémente le compteur sans effacer un verrou passé', async () => {
    const u = await makeUser(t, 'aq_verrou', 'ro');
    const passe = new Date('2026-01-01T00:00:00Z');
    await t.svc.db.q('UPDATE users SET failed_logins=0, locked_until=$2 WHERE id=$1', [u.id, passe]);
    const r = await t.svc.auth.checkLogin('aq_verrou', 'mauvais-mot-de-passe');
    expect(r).toMatchObject({ ok: false, reason: 'bad_password' });
    const v = await t.svc.db.one<{ failed_logins: number; locked_until: Date }>(
      'SELECT failed_logins, locked_until FROM users WHERE id=$1',
      [u.id],
    );
    expect(v!.failed_logins).toBe(1);
    expect(v!.locked_until.toISOString()).toBe(passe.toISOString());
  });

  it('session inactive ou expirée : refusée, puis purgée ; les autres sessions se ferment sauf la courante', async () => {
    const u = await makeUser(t, 'aq_sessions', 'ro');
    for (let i = 0; i < 3; i++) await login(t, u);
    const [s1, s2, s3] = await sessions(u.id);
    expect(await t.svc.auth.loadByHash(s1!.id_hash, false)).not.toBeNull();
    await t.svc.db.q("UPDATE sessions SET last_seen_at = now() - interval '30 days' WHERE id_hash=$1", [s1!.id_hash]);
    await t.svc.db.q("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE id_hash=$1", [s2!.id_hash]);
    expect(await t.svc.auth.loadByHash(s1!.id_hash, false)).toBeNull();
    expect(await t.svc.auth.loadByHash(s2!.id_hash, false)).toBeNull();
    await t.svc.auth.purgeExpired();
    expect((await sessions(u.id)).map((s) => s.id_hash.toString('hex'))).toEqual([s3!.id_hash.toString('hex')]);
    await login(t, u);
    await t.svc.auth.destroyUserSessions(u.id, s3!.id_hash);
    expect((await sessions(u.id)).map((s) => s.id_hash.toString('hex'))).toEqual([s3!.id_hash.toString('hex')]);
    await t.svc.auth.destroyUserSessions(u.id);
    expect(await sessions(u.id)).toEqual([]);
  });
});
