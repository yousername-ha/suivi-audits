/* La cartographie reprend les fiches du Pilotage saisies à l'écran (BUG-053) : parties intéressées, menaces, opportunités
   et enjeux des contextes. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent;
const COMMUN = '00000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'cfp_admin', 'admin'));
});
afterAll(() => t.close());

describe('objets de la carte issus des fiches du Pilotage', () => {
  it('une menace de SWOT, un enjeu de contexte et une partie intéressée saisis à l’écran sont des objets de la carte', async () => {
    const creer = async (kind: string, name: string, data: Record<string, unknown>) =>
      expect((await a.post(`/api/grc/${COMMUN}/objects`, { kind, name, data })).statusCode).toBe(200);
    await creer('swot', 'SWOT fictif de la carte', { threats: 'Menace fictive de la carte' });
    await creer('context', 'Contexte fictif de la carte', { issues: 'Externes : enjeu fictif de la carte' });
    await creer('stakeholder', 'Partie fictive de la carte', { nature: 'Externe' });
    const r = await a.get('/api/carto/objects');
    expect(r.statusCode, r.body).toBe(200);
    const objets = (r.json() as { objects: { type: string; name: string }[] }).objects;
    const externes = objets.filter((o) => o.type === 'external_issue').map((o) => o.name);
    expect(externes).toEqual(expect.arrayContaining(['Menace fictive de la carte', 'enjeu fictif de la carte']));
    expect(objets.filter((o) => o.type === 'stakeholder').map((o) => o.name)).toContain('Partie fictive de la carte');
  });
});
