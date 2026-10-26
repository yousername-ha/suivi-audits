/* Requêtes du catalogue de configuration (conversion Kysely, ADR 0062) : unicité d'un identifiant par type et par
   périmètre (l'organisation comptant comme un périmètre), filtre par périmètre, historique des versions et compteur de
   variantes. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, A: string, B: string;
const base = '/api/config-grc';
const echelle = (name: string) => ({
  name,
  category: 'severity',
  nature: 'qualitative',
  levels: ['n1', 'n2', 'n3'].map((id) => ({ id, label: id.toUpperCase(), description: 'Niveau ' + id })),
});
const creer = (key: string, extra: Record<string, unknown> = {}) =>
  admin.post(`${base}/items`, { kind: 'scale', key, definition: echelle('Échelle ' + key), ...extra });
const publier = async (id: string, reason = 'Publication de contrôle') => {
  const p = (await admin.post(`${base}/items/${id}/preview`)).json();
  const etag = (await admin.get(`${base}/items/${id}`)).headers.etag as string;
  const r = await admin.post(
    `${base}/items/${id}/publish`,
    { previewId: p.previewId, reason, confirm: 'PUBLIER' },
    { 'if-match': etag },
  );
  expect(r.statusCode, r.body).toBe(200);
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cfgq_admin', 'admin'));
  A = (await admin.post('/api/grc/smsis', { name: 'Périmètre CFG-A', scope: 'A', timezone: 'Europe/Paris' })).json().id;
  B = (await admin.post('/api/grc/smsis', { name: 'Périmètre CFG-B', scope: 'B', timezone: 'Europe/Paris' })).json().id;
});
afterAll(() => t.close());

describe('catalogue de configuration : requêtes', () => {
  it('un identifiant est unique par type dans l’organisation et dans chaque périmètre', async () => {
    expect((await creer('cle_partagee')).statusCode).toBe(201);
    expect((await creer('cle_partagee')).statusCode).toBe(409);
    expect((await creer('cle_partagee', { scope: 'smsi', smsiId: A })).statusCode).toBe(201);
    expect((await creer('cle_partagee', { scope: 'smsi', smsiId: A })).statusCode).toBe(409);
    expect((await creer('cle_partagee', { scope: 'smsi', smsiId: B })).statusCode).toBe(201);
  });

  it('filtre par périmètre : éléments de l’organisation et du périmètre, jamais ceux d’un autre', async () => {
    const items = (await admin.get(`${base}/items?smsi=${A}&kind=scale`)).json() as {
      key: string;
      scope: string;
      smsiId: string | null;
    }[];
    const partagees = items.filter((i) => i.key === 'cle_partagee');
    expect(partagees.map((i) => i.smsiId ?? 'organisation').sort()).toEqual([A, 'organisation'].sort());
  });

  it('historique des versions (de la plus récente), compteur de variantes et d’usages', async () => {
    const id = (await creer('cle_historique')).json().id as string;
    await publier(id, 'Première publication');
    const etag = (await admin.get(`${base}/items/${id}`)).headers.etag as string;
    expect(
      (await admin.put(`${base}/items/${id}/draft`, { definition: echelle('Échelle révisée') }, { 'if-match': etag }))
        .statusCode,
    ).toBe(200);
    await publier(id, 'Seconde publication');
    const detail = (await admin.get(`${base}/items/${id}`)).json();
    expect(detail.versions.map((v: { version: number; reason: string }) => [v.version, v.reason])).toEqual([
      [2, 'Seconde publication'],
      [1, 'Première publication'],
    ]);
    expect(detail).toMatchObject({ currentVersion: 2, usages: 0, name: 'Échelle révisée' });
    const d = await admin.post(`${base}/items/${id}/derive`, { key: 'cle_variante', scope: 'instance' });
    expect(d.statusCode, d.body).toBeLessThan(300);
    expect(
      (await admin.post(`${base}/items/${id}/derive`, { key: 'cle_variante', scope: 'instance' })).statusCode,
    ).toBe(409);
    const ligne = ((await admin.get(`${base}/items?kind=scale`)).json() as { id: string; derivedCount: number }[]).find(
      (i) => i.id === id,
    )!;
    expect(ligne.derivedCount).toBe(1);
  });
});
