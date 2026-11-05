/* Sur HTTPS, seul le cookie préfixé (__Host-) est lu : le nom non préfixé n'est jamais accepté, pour la session
   comme pour l'écran mural. En HTTP local (développement), le nom non préfixé reste émis et lu. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, ORIGIN, type Agent, type TestApp } from './helpers.js';

const HTTPS = { 'x-forwarded-proto': 'https', host: 'suivi.test' };
const HTTP = { host: 'suivi.test' };

describe('cookie de session sur HTTPS', () => {
  let t: TestApp;
  let tokA = '';
  let tokB = '';
  let admin: Agent;
  beforeAll(async () => {
    t = await createTestApp({ COOKIE_SECURE: 'auto', TRUST_PROXY: '1' });
    const a = await login(t, await makeUser(t, 'cookie_a', 'rw'));
    const b = await login(t, await makeUser(t, 'cookie_b', 'rw'));
    admin = await login(t, await makeUser(t, 'cookie_admin', 'admin'));
    tokA = a.cookies.get('__Host-suivi_sid') ?? '';
    tokB = b.cookies.get('__Host-suivi_sid') ?? '';
    expect(tokA).not.toBe('');
    expect(tokB).not.toBe('');
  }, 60000);
  afterAll(async () => t?.close());

  const me = async (headers: Record<string, string>, cookie?: string) => {
    const r = await t.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { ...headers, ...(cookie !== undefined ? { cookie } : {}) },
    });
    const j = r.json() as { stage: string; user: { username: string } | null };
    return { stage: j.stage, user: j.user?.username ?? null };
  };

  it('témoin : le cookie préfixé charge la session sur HTTPS', async () => {
    expect(await me(HTTPS, `__Host-suivi_sid=${tokA}`)).toEqual({ stage: 'ok', user: 'cookie_a' });
  });

  it('HTTPS : le cookie non préfixé est ignoré, seul ou combiné', async () => {
    expect((await me(HTTPS, `suivi_sid=${tokA}`)).stage).toBe('anon');
    expect((await me(HTTPS, `__Host-suivi_sid=; suivi_sid=${tokA}`)).stage).toBe('anon');
    // Le cookie préfixé l'emporte toujours : le non préfixé n'est jamais consulté.
    expect(await me(HTTPS, `__Host-suivi_sid=${tokB}; suivi_sid=${tokA}`)).toEqual({ stage: 'ok', user: 'cookie_b' });
    const p = await t.app.inject({
      method: 'GET',
      url: '/api/account/preferences',
      headers: { ...HTTPS, cookie: `suivi_sid=${tokA}` },
    });
    expect(p.statusCode).toBe(401);
  });

  it('HTTP (développement local) : le cookie non préfixé reste lu', async () => {
    expect(await me(HTTP, `suivi_sid=${tokA}`)).toEqual({ stage: 'ok', user: 'cookie_a' });
  });

  it('écran mural : le cookie non préfixé est ignoré sur HTTPS', async () => {
    const c = await admin.post('/api/admin/murs', { nom: 'Salle fictive', jours: 30 });
    expect(c.statusCode).toBe(201);
    const { code } = c.json() as { code: string };
    const act = await t.app.inject({
      method: 'POST',
      url: '/api/mur/activer',
      headers: { ...HTTPS, origin: ORIGIN, 'content-type': 'application/json' },
      payload: { code },
    });
    expect(act.statusCode, act.body).toBe(200);
    const sc = act.headers['set-cookie'];
    const entete = (Array.isArray(sc) ? sc : [String(sc)])[0] ?? '';
    const jeton = /^__Host-suivi_mur=([^;]+)/.exec(entete)?.[1] ?? '';
    expect(jeton).not.toBe('');
    const lire = async (cookie: string) =>
      (await t.app.inject({ method: 'GET', url: '/api/mur/synthese', headers: { ...HTTPS, cookie } })).statusCode;
    expect(await lire(`__Host-suivi_mur=${jeton}`)).toBe(200);
    expect(await lire(`suivi_mur=${jeton}`)).toBe(401);
  });
});
