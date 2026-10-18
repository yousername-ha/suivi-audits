import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type ModuleIntent, type ModuleState } from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createTestApp, login, makeUser, REPO, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp, admin: TestUser, reader: TestUser;
let a: Agent;
const intent = (id: ModuleIntent['changes'][number]['id'], enabled: boolean, cascade = false): ModuleIntent => ({
  changes: [{ id, enabled }],
  cascade,
});
async function preview(body: ModuleIntent) {
  const r = await a.post('/api/admin/modules/preview', body);
  expect(r.statusCode).toBe(200);
  return r.json();
}
async function apply(body: ModuleIntent) {
  const p = await preview(body);
  return a.put(
    '/api/admin/modules',
    { intent: body, previewId: p.previewId, confirm: 'VALIDER' },
    { 'if-match': `"${p.version}"` },
  );
}
beforeAll(async () => {
  t = await createTestApp();
  admin = await makeUser(t, 'modules-admin', 'admin');
  reader = await makeUser(t, 'modules-reader', 'ro');
});
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  a = await login(t, admin);
});

describe('B1 configuration des modules', () => {
  it('tous actifs par défaut, registre accessible aux sessions complètes', async () => {
    const state = (await a.get('/api/modules')).json();
    expect(state.disabled).toEqual([]);
    expect(state.registry).toHaveLength(15);
    expect(state.registry.filter((m: { protected: boolean }) => m.protected)).toHaveLength(2);
    const r = await login(t, reader);
    expect((await r.get('/api/modules')).statusCode).toBe(200);
    expect((await r.post('/api/admin/modules/preview', intent('documents', false))).statusCode).toBe(403);
  });
  it('CSRF exigé et socle fondamental impossible à désactiver', async () => {
    expect(
      (await a.req('POST', '/api/admin/modules/preview', { json: intent('documents', false), csrf: false })).statusCode,
    ).toBe(403);
    const p = await preview(intent('administration', false, true));
    expect(p.blockers.length).toBeGreaterThan(0);
    expect((await apply(intent('administration', false, true))).statusCode).toBe(409);
    expect((await a.get('/api/modules')).json().disabled).toEqual([]);
    await expect(t.svc.db.q("UPDATE module_activation SET disabled=ARRAY['parametres'] WHERE id=1")).rejects.toThrow();
  });
  it('prévisualisation sans effet, dépendance obligatoire et cascade contrôlée', async () => {
    const p = await preview(intent('audit', false));
    expect(p.blockers.length).toBeGreaterThan(0);
    expect((await a.get('/api/modules')).json().disabled).toEqual([]);
    expect((await apply(intent('audit', false))).statusCode).toBe(409);
    expect((await apply(intent('audit', false, true))).statusCode).toBe(200);
    expect((await a.get('/api/modules')).json().disabled).toEqual(['audit', 'plan_audit']);
    const me = await a.me();
    expect(me.stage).toBe('ok');
    expect(me.permissions).not.toContain('audit:lire');
    expect(me.permissions).toContain('administration:administrer');
    const legacy = (await a.get('/api/legacy/state')).json();
    expect(legacy.items).toEqual([]);
    expect(legacy.plan).toEqual({});
    expect((await a.get('/api/settings/cycle')).statusCode).toBe(409);
    const references = await a.get('/api/settings/referentiels');
    expect(references.statusCode).toBe(200);
    expect(references.json().info.referentiels).toEqual([]);
    const updated = await a.put(
      '/api/settings/referentiels',
      {
        ...references.json().values,
        entityCategory: 'importante',
      },
      { 'if-match': references.headers.etag! },
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json().values.entityCategory).toBe('importante');
    expect((await a.get('/api/settings')).statusCode).toBe(200);
    expect((await apply(intent('plan_audit', true, true))).statusCode).toBe(200);
    expect((await a.me()).permissions).toContain('audit:lire');
  });
  it('conserve intégralement données, historique et rôles ; réactivation sans perte', async () => {
    const before = (await t.svc.legacy.recompose())!;
    const roles = (await t.svc.db.q('SELECT * FROM user_roles ORDER BY user_id, role_id')).rows;
    expect((await apply(intent('fournisseurs', false))).statusCode).toBe(200);
    expect((await a.get('/api/legacy/state')).json().suppliers).toEqual([]);
    expect((await t.svc.legacy.recompose())!.data).toEqual(before.data);
    expect((await t.svc.legacy.recompose())!.version).toBe(before.version);
    expect((await t.svc.db.q('SELECT * FROM user_roles ORDER BY user_id, role_id')).rows).toEqual(roles);
    expect((await a.get('/api/mur/synthese')).statusCode).toBe(200);
    expect((await apply(intent('fournisseurs', true))).statusCode).toBe(200);
    expect((await a.get('/api/legacy/state')).json().suppliers).toEqual(before.data.suppliers);
    const h = await a.get('/api/admin/modules/history');
    expect(h.statusCode).toBe(200);
    expect(h.json()[0].details.after.disabled).toEqual([]);
    await expect(t.svc.db.q("DELETE FROM audit_log WHERE action='modules.update'")).rejects.toThrow(/ajout seul/);
  });
  it('refuse les API métier désactivées et maintient les fonctions fondamentales', async () => {
    expect((await apply(intent('documents', false))).statusCode).toBe(200);
    expect((await a.get('/api/documents')).statusCode).toBe(409);
    expect((await a.get('/api/links')).statusCode).toBe(409);
    expect((await a.get('/api/auth/me')).statusCode).toBe(200);
    expect((await a.get('/api/admin/systeme')).statusCode).toBe(200);
    expect((await a.get('/api/settings/securite')).statusCode).toBe(200);
    expect((await a.get('/healthz')).statusCode).toBe(200);
    expect((await apply(intent('cartographie', false))).statusCode).toBe(200);
    expect((await a.get('/api/carto/maps')).statusCode).toBe(409);
  });
  it('refuse les versions périmées, confirmations absentes et prévisualisations modifiées', async () => {
    const body = intent('documents', false);
    const p = await preview(body);
    expect(
      (await a.put('/api/admin/modules', { intent: body, previewId: p.previewId, confirm: 'VALIDER' })).statusCode,
    ).toBe(428);
    expect(
      (
        await a.put(
          '/api/admin/modules',
          { intent: body, previewId: p.previewId, confirm: 'NON' },
          { 'if-match': `"${p.version}"` },
        )
      ).statusCode,
    ).toBe(422);
    expect(
      (
        await a.put(
          '/api/admin/modules',
          { intent: intent('ia', false), previewId: p.previewId, confirm: 'VALIDER' },
          { 'if-match': `"${p.version}"` },
        )
      ).statusCode,
    ).toBe(409);
    expect((await apply(intent('ia', false))).statusCode).toBe(200);
    expect(
      (
        await a.put(
          '/api/admin/modules',
          { intent: body, previewId: p.previewId, confirm: 'VALIDER' },
          { 'if-match': `"${p.version}"` },
        )
      ).statusCode,
    ).toBe(412);
    expect((await a.get('/api/modules')).json().disabled).toEqual(['ia']);
  });
  it('ne permet pas de réécrire un module désactivé via le JSON historique', async () => {
    const before = (await t.svc.legacy.recompose())!;
    expect((await apply(intent('fournisseurs', false))).statusCode).toBe(200);
    const visible = (await a.get('/api/legacy/state')).json();
    visible.suppliers = [{ id: 'intrusion', name: 'ne doit pas être écrit' }];
    expect((await a.put('/api/legacy/state', visible)).statusCode).toBe(409);
    expect((await t.svc.legacy.recompose())!.data).toEqual(before.data);
    // L'outil historique est en lecture seule (tous ses modules sont repris) : l'état inchangé reste accepté.
    visible.suppliers = (await a.get('/api/legacy/state')).json().suppliers;
    expect((await a.put('/api/legacy/state', visible)).statusCode).toBe(204);
    expect((await t.svc.legacy.recompose())!.data.suppliers).toEqual(before.data.suppliers);
  });
  it('refuse les simulations et imports portant sur un module désactivé', async () => {
    expect((await apply(intent('fournisseurs', false))).statusCode).toBe(200);
    const file = readFileSync(path.join(REPO, 'apps/api/seed/state.json'));
    const res = await a.req('POST', '/api/admin/import/simulate?mode=merge', { body: file });
    expect(res.statusCode).toBe(409);
    expect((await a.get('/api/modules')).json().disabled).toContain('fournisseurs');
  });
  it('sérialise une désactivation après une écriture déjà engagée, puis utilise les droits actuels', async () => {
    let release!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const write = t.svc.modules.run(true, async () => {
      await t.svc.modules.assert('documents');
      started();
      await waiting;
    });
    await entered;
    const body = intent('documents', false);
    const p = await preview(body);
    let complete = false;
    const disable = t.svc.modules.apply(body, p.version, p.previewId, admin, '127.0.0.1').then((state: ModuleState) => {
      complete = true;
      return state;
    });
    // PostgreSQL confirme que le changement attend le verrou, sans temporisation arbitraire.
    for (let i = 0; i < 100; i++) {
      const blocked = await t.svc.db.one<{ n: number }>(
        "SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND objid=727276 AND NOT granted",
      );
      if (blocked?.n) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(complete).toBe(false);
    release();
    await write;
    expect((await disable).disabled).toContain('documents');
    await expect(t.svc.modules.run(true, () => t.svc.modules.assert('documents'))).rejects.toThrow(/désactivé/);
  });
  it('adapte les menus hérités à l’exécution sans réécrire le fichier v2', async () => {
    const before = readFileSync(path.join(REPO, 'app/public/index.html'));
    expect((await apply(intent('ia', false))).statusCode).toBe(200);
    const html = await a.get('/legacy/');
    expect(html.statusCode).toBe(200);
    expect(html.body).toContain('__SUIVI_FILTER_NAV');
    expect(html.body).toContain('__SUIVI_ALLOW_PAGE');
    const cfg = JSON.parse(/window.__SUIVI=(.*?);<\/script>/.exec(html.body)![1]!);
    expect(cfg.enabled).not.toContain('ia');
    expect(cfg.enabled).toContain('audit');
    expect(cfg.emptyObjects.ai.evals).toEqual([]);
    expect(cfg.emptyObjects.ai.register).toEqual([]);
    const seed = JSON.parse(/<script type="application\/json" id="seed">([\s\S]*?)<\/script>/.exec(html.body)![1]!);
    expect(seed.ai).toEqual({});
    const stored = (await t.svc.legacy.recompose())!.data.ai;
    const visible = (await a.get('/api/legacy/state')).json();
    visible.ai = cfg.emptyObjects.ai;
    expect((await a.put('/api/legacy/state', visible)).statusCode).toBe(204);
    expect((await t.svc.legacy.recompose())!.data.ai).toEqual(stored);
    expect(readFileSync(path.join(REPO, 'app/public/index.html')).equals(before)).toBe(true);
  });
});
