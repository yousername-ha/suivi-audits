/* Style d'instance « Verre » (refonte verre, lot 1, décision du RSSI du 26/11/2026) : accepté par Paramètres > Apparence,
   transmis à tous les comptes par /api/auth/me, réversible, réservé à la permission d'écriture sur les paramètres. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp;
let A: Agent;
beforeAll(async () => {
  t = await createTestApp();
  A = await login(t, await makeUser(t, 'admin_verre', 'admin'));
});
afterAll(() => t.close());

const apparence = async () => {
  const r = await A.get('/api/settings/apparence');
  return { values: r.json().values as Record<string, unknown>, etag: r.headers.etag as string };
};

describe('style global « Verre »', () => {
  it('choisi d’un clic, lu par tous les comptes, puis rétabli', async () => {
    const lecteur = await login(t, await makeUser(t, 'lecteur_verre', 'ro'));
    let s = await apparence();
    expect(s.values.style).toBe('sage');
    const verre = await A.put('/api/settings/apparence', { ...s.values, style: 'verre' }, { 'if-match': s.etag });
    expect(verre.statusCode, verre.body).toBe(200);
    expect((await lecteur.get('/api/auth/me')).json().appearance.style).toBe('verre');
    expect((await apparence()).values.style).toBe('verre');
    // Réversible : retour au style par défaut.
    s = await apparence();
    const retour = await A.put('/api/settings/apparence', { ...s.values, style: 'sage' }, { 'if-match': s.etag });
    expect(retour.statusCode, retour.body).toBe(200);
    expect((await lecteur.get('/api/auth/me')).json().appearance.style).toBe('sage');
  });

  it('refusé sans la permission d’écriture ; une valeur voisine reste invalide', async () => {
    const lecteur = await login(t, await makeUser(t, 'lecteur_verre_2', 'ro'));
    const s = await apparence();
    const refus = await lecteur.put('/api/settings/apparence', { ...s.values, style: 'verre' }, { 'if-match': s.etag });
    expect(refus.statusCode).toBe(403);
    const invalide = await A.put('/api/settings/apparence', { ...s.values, style: 'glass' }, { 'if-match': s.etag });
    expect(invalide.statusCode).toBe(422);
    expect((await apparence()).values.style).toBe('sage');
  });
});
