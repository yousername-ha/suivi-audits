/* Rattachement d'un périmètre (010-02) : profondeur maximale par l'API, parent inaccessible indiscernable d'un parent
   inconnu (aucune fuite d'existence), identifiant de fournisseur refusé comme parent (010-03). Données fictives. */
import { PROFONDEUR_MAX_PERIMETRES } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, rssiA: Agent, rssiB: Agent;
const corps = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  scope: 'Recette',
  nature: '',
  timezone: 'Europe/Paris',
  ...extra,
});

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ctl_admin', 'admin'));
  rssiA = await login(t, await makeUser(t, 'ctl_rssi_a', 'rssi'));
  rssiB = await login(t, await makeUser(t, 'ctl_rssi_b', 'rssi'));
});
afterAll(() => t.close());

describe('contrôles de rattachement', () => {
  it('refuse un niveau au-delà de la profondeur maximale, sans rien créer', async () => {
    let parent: string | null = null;
    let crees = 0;
    for (let i = 0; i < PROFONDEUR_MAX_PERIMETRES + 2; i++) {
      const r = await admin.post('/api/grc/smsis', corps(`Niveau ${i + 1}`, { parentId: parent }));
      if (r.statusCode !== 200) {
        expect(r.statusCode).toBe(422);
        expect(r.json().error).toMatch(/limitée à/);
        break;
      }
      parent = r.json().id as string;
      crees++;
    }
    expect(crees).toBe(PROFONDEUR_MAX_PERIMETRES);
    const noms = (await admin.get('/api/grc/smsis')).json().map((x: { name: string }) => x.name);
    expect(noms).not.toContain(`Niveau ${PROFONDEUR_MAX_PERIMETRES + 1}`);
  });

  it('un parent inaccessible reçoit la réponse d’un parent inconnu et rien n’est créé', async () => {
    const prive = (await rssiA.post('/api/grc/smsis', corps('Périmètre privé de A'))).json().id as string;
    // B ne voit pas le périmètre de A.
    expect((await rssiB.get('/api/grc/smsis')).json().some((x: { id: string }) => x.id === prive)).toBe(false);
    const inaccessible = await rssiB.post('/api/grc/smsis', corps('Enfant intrus', { parentId: prive }));
    const inconnu = await rssiB.post(
      '/api/grc/smsis',
      corps('Enfant orphelin', { parentId: '00000000-0000-4000-8000-0000000000ff' }),
    );
    expect(inaccessible.statusCode).toBe(inconnu.statusCode);
    expect(inaccessible.statusCode).toBe(422);
    expect(inaccessible.json().error).toBe(inconnu.json().error);
    expect((await admin.get('/api/grc/smsis')).json().some((x: { name: string }) => x.name === 'Enfant intrus')).toBe(
      false,
    );
  });

  it('un fournisseur n’est jamais un parent : l’identifiant n’est pas celui d’un périmètre', async () => {
    const r = await admin.post('/api/grc/smsis', corps('Sous un fournisseur', { parentId: 'SUP-0001' }));
    expect(r.statusCode).toBe(422);
  });
});
