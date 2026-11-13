/* Sélecteur de références (BUG-060) : une mesure de la déclaration d'applicabilité se désigne par sa référence. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent;
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'src_admin', 'admin'));
  await seedState(t, {
    items: [
      { id: 'A-8.13', ref: 'A', num: '8.13', title: 'Sauvegarde des informations', afnor: {}, interne: {} },
      { id: 'HDS-12', ref: 'HDS', num: '12', title: 'Sauvegarde HDS', afnor: {}, interne: {} },
    ],
  });
});
afterAll(() => t.close());

describe('références proposées', () => {
  it('les mesures portent leur référence, sans doublon', async () => {
    const r = await a.get('/api/grc/00000000-0000-4000-8000-000000000001/sources?search=Sauvegarde');
    expect(r.statusCode, r.body).toBe(200);
    const noms = (r.json().items as { ref: string; name: string }[]).filter((x) => x.ref.startsWith('legacy:items:'));
    expect(noms.map((x) => x.name).sort()).toEqual(['A.8.13 · Sauvegarde des informations', 'HDS 12 · Sauvegarde HDS']);
    const refs = (r.json().items as { ref: string }[]).map((x) => x.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });
});
