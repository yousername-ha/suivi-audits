/* Messages de validation en français, qui nomment le champ (BUG-057). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent;
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'val_admin', 'admin'));
});
afterAll(() => t.close());

describe('erreurs de validation', () => {
  it('une valeur refusée est décrite en français avec le libellé du champ, sans code technique', async () => {
    const r = await a.post('/api/grc/00000000-0000-4000-8000-000000000001/objects', {
      kind: 'treatment',
      name: 'Traitement fictif',
      data: { strategy: 'inconnue' },
    });
    expect(r.statusCode, r.body).toBe(422);
    const message = r.json().error as string;
    expect(message).toMatch(/Stratégie/);
    expect(message).not.toMatch(/expected|Invalid|"reduce"/);
  });
});
