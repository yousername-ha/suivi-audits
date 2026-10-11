import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp, admin: TestUser, reader: TestUser, a: Agent;
const dir = mkdtempSync(path.join(os.tmpdir(), 'suivi-updates-'));
const state = (changes = {}) => {
  mkdirSync(path.join(dir, 'updates'), { recursive: true });
  writeFileSync(
    path.join(dir, 'updates/status.json'),
    JSON.stringify({
      installed: '3.0.0',
      available: '3.1.0',
      checkedAt: new Date().toISOString(),
      notes: 'https://github.com/yousername-ha/suivi-audits/releases/tag/v3.1.0',
      checking: false,
      checkError: false,
      ready: true,
      maintenance: false,
      id: null,
      target: null,
      status: 'idle',
      phase: 'idle',
      message: 'Disponible',
      startedAt: null,
      updatedAt: new Date().toISOString(),
      ...changes,
    }),
  );
};
const request = (changes = {}) => ({ requestId: randomUUID(), version: '3.1.0', confirm: 'METTRE À JOUR', ...changes });
beforeAll(async () => {
  t = await createTestApp({ ETAT_DIR: dir, APP_VERSION: '3.0.0' });
  admin = await makeUser(t, 'update-admin', 'admin');
  reader = await makeUser(t, 'update-reader', 'ro');
});
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await t.svc.db.q('DELETE FROM update_jobs');
  state();
  a = await login(t, admin);
});

describe('mise à jour intégrée : frontière de privilèges', () => {
  it('informe tout compte complet, sans exposer la configuration du serveur', async () => {
    const r = await login(t, reader);
    const response = await r.get('/api/updates');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ installed: '3.0.0', available: '3.1.0' });
    expect(response.body).not.toMatch(/DATA_DIR|backup-pass|docker.sock/);
    expect((await r.post('/api/admin/updates/check')).statusCode).toBe(403);
    expect((await r.post('/api/admin/updates/install', request())).statusCode).toBe(403);
  });
  it('une permission personnalisée ne remplace pas le rôle système administrateur', async () => {
    await t.svc.db.q(
      "INSERT INTO roles(id,name,permissions) VALUES ('update_manager','Gestionnaire',ARRAY['administration:lire','administration:administrer']::text[])",
    );
    const user = await makeUser(t, 'update_manager', 'update_manager');
    const agent = await login(t, user);
    expect((await agent.post('/api/admin/updates/check')).statusCode).toBe(403);
  });
  it('exige CSRF, confirmation exacte, origine et schéma fermé', async () => {
    expect((await a.req('POST', '/api/admin/updates/install', { json: request(), csrf: false })).statusCode).toBe(403);
    expect((await a.post('/api/admin/updates/install', request({ confirm: 'OUI' }))).statusCode).toBe(422);
    expect((await a.post('/api/admin/updates/install', request({ command: 'docker stop db' }))).statusCode).toBe(422);
    expect((await a.post('/api/admin/updates/install', request(), { origin: 'https://evil.test' })).statusCode).toBe(
      403,
    );
    expect((await a.post('/api/admin/updates/install', request({ version: '3.1.0;id' }))).statusCode).toBe(422);
    expect((await t.svc.db.q('SELECT 1 FROM update_jobs')).rowCount).toBe(0);
  });
  it('une demande active seulement, réessai idempotent et audit transactionnel', async () => {
    const body = request();
    const results = await Promise.all([
      a.post('/api/admin/updates/install', body),
      a.post('/api/admin/updates/install', request()),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([202, 409]);
    const winner = results.find((r) => r.statusCode === 202)!;
    const stored = (await t.svc.db.q('SELECT request_id FROM update_jobs')).rows[0]!;
    const same = await a.post('/api/admin/updates/install', { ...body, requestId: stored.request_id });
    expect(same.statusCode).toBe(202);
    expect(same.json().id).toBe(winner.json().id);
    expect((await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='update.install.requested'")).rowCount).toBe(1);
  });
  it('refuse version changée, détection ancienne et exécutant absent', async () => {
    state({ available: '3.2.0' });
    expect((await a.post('/api/admin/updates/install', request())).statusCode).toBe(409);
    state({ checkedAt: '2020-01-01T00:00:00Z' });
    expect((await a.post('/api/admin/updates/install', request())).statusCode).toBe(409);
    state({ updatedAt: '2020-01-01T00:00:00Z' });
    expect((await a.post('/api/admin/updates/check')).statusCode).toBe(503);
    expect((await a.get('/api/updates')).json().ready).toBe(false);
  });
  it('revalide le rôle au moment de la prise, puis consigne le résultat', async () => {
    const r = await a.post('/api/admin/updates/install', request());
    expect(r.statusCode).toBe(202);
    await t.svc.db.q("UPDATE user_roles SET modules=ARRAY['audit'] WHERE user_id=$1", [admin.id]);
    expect(await t.svc.updates.claim()).toBeNull();
    expect((await t.svc.db.q('SELECT status FROM update_jobs')).rows[0]?.status).toBe('failed');
    await t.svc.db.q('UPDATE user_roles SET modules=NULL WHERE user_id=$1', [admin.id]);
    const next = await a.post('/api/admin/updates/install', request());
    const claim = await t.svc.updates.claim();
    expect(claim).toMatchObject({ id: next.json().id, kind: 'install', target: '3.1.0' });
    await t.svc.updates.finish(claim!.id, 'success');
    expect((await t.svc.db.q('SELECT status FROM update_jobs WHERE id=$1', [claim!.id])).rows[0]?.status).toBe(
      'success',
    );
  });
  it('protège aussi les mutations via l’API interne pendant la maintenance', async () => {
    state({ maintenance: true, status: 'running', phase: 'backup' });
    expect((await a.post('/api/admin/updates/check')).statusCode).toBe(503);
    expect((await a.put('/api/legacy/state', {})).statusCode).toBe(503);
    expect((await a.get('/healthz')).statusCode).toBe(200);
  });
  it('neutralise les intentions restaurées sans interrompre un retour arrière actif', async () => {
    const response = await a.post('/api/admin/updates/install', request());
    const id = response.json().id;
    await t.svc.updates.claim();
    mkdirSync(path.join(dir, 'sauvegardes'), { recursive: true });
    writeFileSync(
      path.join(dir, 'sauvegardes/derniere-restauration.json'),
      JSON.stringify({ date: new Date(Date.now() + 1000).toISOString() }),
    );
    state({ maintenance: true, id, status: 'running' });
    await t.svc.updates.synchronize();
    expect((await t.svc.db.q('SELECT status FROM update_jobs WHERE id=$1', [id])).rows[0]?.status).toBe('running');
    state();
    await t.svc.updates.synchronize();
    expect((await t.svc.db.q('SELECT status FROM update_jobs WHERE id=$1', [id])).rows[0]?.status).toBe('failed');
    expect(
      (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='update.neutralized' AND target=$1", [id])).rowCount,
    ).toBe(1);
  });
});
