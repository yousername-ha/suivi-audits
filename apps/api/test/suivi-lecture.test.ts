/* Lecture de l'état du suivi pour la nouvelle interface : mêmes données, mêmes droits et même ETag que l'ancienne route. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, ro: Agent;

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'lec_admin', 'admin'));
  ro = await login(t, await makeUser(t, 'lec_ro', 'ro'));
  await seedState(t, { items: [{ id: 'M-1', title: 'Mesure fictive' }], findings: [] });
});
afterAll(() => t.close());

describe('/api/suivi/etat et /api/suivi/modules', () => {
  it("renvoient l'état recomposé avec l'ETag de version, comme l'ancienne route", async () => {
    const neuf = await a.get('/api/suivi/etat');
    const ancien = await a.get('/api/suivi/etat');
    expect(neuf.statusCode).toBe(200);
    expect(neuf.headers.etag).toMatch(/^"v\d+"$/);
    expect(neuf.headers['cache-control']).toBe('no-store');
    expect(neuf.body).toBe(ancien.body);
    expect(neuf.json().items.map((i: { id: string }) => i.id)).toContain('M-1');
  });

  it('exigent une session et appliquent les droits de lecture', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/suivi/etat' })).statusCode).toBe(401);
    const lu = await ro.get('/api/suivi/etat');
    expect(lu.statusCode).toBe(200);
    expect(lu.body).toBe((await ro.get('/api/suivi/etat')).body);
  });

  it('listent les modules comme l’ancienne route', async () => {
    const neuf = await a.get('/api/suivi/modules');
    expect(neuf.statusCode).toBe(200);
    expect(neuf.json()).toEqual((await a.get('/api/suivi/modules')).json());
    expect(neuf.json().length).toBeGreaterThan(5);
  });
});
