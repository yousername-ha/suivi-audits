/* Politique métier (configuration publiée et versionnée) : lecture courante avec ETag, historique, version précise,
   publication contrôlée (If-Match, prévisualisation, absence de changement), journal et notification. Données fictives. */
import { businessDefaults } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent;
const base = '/api/admin/business-policy';

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'bp_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'bp_lecteur', 'ro'));
});
afterAll(() => t.close());

const publier = async (definition: unknown, version: number, reason = 'Publication de recette') => {
  const p = await admin.post(`${base}/preview`, { definition });
  return admin.put(
    base,
    { definition, previewId: p.json().previewId, reason, confirm: 'PUBLIER' },
    { 'if-match': `"${version}"` },
  );
};

describe('politique métier publiée', () => {
  it('lit la version courante (ETag), une version précise et l’historique ; version inconnue = 404', async () => {
    const r = await admin.get(base);
    expect(r.statusCode).toBe(200);
    expect(r.headers.etag).toBe('"1"');
    expect(r.json()).toMatchObject({ version: 1, createdBy: 'système', definition: businessDefaults() });
    expect(r.json().createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect((await admin.get(`${base}/versions/1`)).json()).toEqual(r.json());
    expect((await admin.get(`${base}/versions/99`)).statusCode).toBe(404);
    const h = (await admin.get(`${base}/history`)).json();
    expect(h).toEqual([
      { version: 1, reason: expect.any(String), createdAt: r.json().createdAt, createdBy: 'système' },
    ]);
    expect((await lecteur.post(`${base}/preview`, { definition: businessDefaults() })).statusCode).toBe(403);
  });

  it('publie une nouvelle version : contrôles 412 et 422, journal, notification, historique décroissant', async () => {
    const d = businessDefaults();
    // Aucun changement : refusé.
    expect((await publier(d, 1)).statusCode).toBe(422);
    d.name = 'Nomenclature révisée';
    // Version attendue périmée : 412 avec la version courante.
    const perime = await publier(d, 0);
    expect(perime.statusCode).toBe(412);
    expect(perime.json().current.version).toBe(1);
    // Prévisualisation d'une autre définition : refusée.
    const p = await admin.post(`${base}/preview`, { definition: d });
    expect(p.json()).toMatchObject({ version: 1, changed: true });
    const autre = { ...d, name: 'Autre' };
    expect(
      (
        await admin.put(
          base,
          { definition: autre, previewId: p.json().previewId, reason: 'Essai décalé', confirm: 'PUBLIER' },
          { 'if-match': '"1"' },
        )
      ).statusCode,
    ).toBe(422);
    const ok = await publier(d, 1, 'Révision des libellés');
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.headers.etag).toBe('"2"');
    expect(ok.json()).toMatchObject({ version: 2, createdBy: 'bp_admin', reason: 'Révision des libellés' });
    expect(ok.json().definition.name).toBe('Nomenclature révisée');
    expect((await admin.get(`${base}/versions/1`)).json().definition.name).toBe(businessDefaults().name);
    expect(((await admin.get(`${base}/history`)).json() as { version: number }[]).map((x) => x.version)).toEqual([
      2, 1,
    ]);
    const audit = await t.svc.db.q<{ target: string; details: { previousVersion: number } }>(
      "SELECT target, details FROM audit_log WHERE action='business.policy.publish'",
    );
    expect(audit.rows).toEqual([
      expect.objectContaining({ target: '2', details: expect.objectContaining({ previousVersion: 1 }) }),
    ]);
    // Réinitialisation idempotente : ne remplace pas la version publiée.
    await t.svc.businessPolicies.initialize();
    expect((await admin.get(base)).json().version).toBe(2);
  });
});
