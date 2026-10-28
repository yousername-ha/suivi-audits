import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';
let t: TestApp;
let a: Agent;
let reader: Agent;
let dir: string;
beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'suivi-backup-'));
  mkdirSync(path.join(dir, 'sauvegardes', 'jobs'), { recursive: true });
  t = await createTestApp({ ETAT_DIR: dir });
  a = await login(t, await makeUser(t, 'backup-admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id,name,permissions) VALUES ('backup_reader','Lecture exploitation',ARRAY['administration:lire'])",
  );
  reader = await login(t, await makeUser(t, 'backup_reader', 'backup_reader'));
});
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await t.svc.db.q('DELETE FROM backup_jobs');
  await t.svc.db.q('DELETE FROM backup_worker');
});
const request = (id = randomUUID()) => a.post('/api/admin/sauvegardes', { requestId: id });
const prepare = async () => {
  await t.svc.backups.heartbeat(true);
  return (await request()).json();
};
const report = (id: string, changes: Record<string, unknown> = {}) =>
  writeFileSync(
    path.join(dir, 'sauvegardes', 'jobs', `${id}.json`),
    JSON.stringify({
      jobId: id,
      resultat: 'reussie',
      fichier: '/srv/backups/suivi-audits-fictif.tar.age',
      tailleOctets: 1024,
      dureeSecondes: 12,
      chiffree: true,
      sha256: 'a'.repeat(64),
      integriteVerifiee: true,
      ...changes,
    }),
  );
describe('A1a sauvegardes', () => {
  it('exige session complète, droits distincts de lecture et administration, et CSRF', async () => {
    expect((await new Agent(t).get('/api/admin/sauvegardes')).statusCode).toBe(401);
    expect((await reader.get('/api/admin/sauvegardes')).statusCode).toBe(200);
    expect((await reader.post('/api/admin/sauvegardes', { requestId: randomUUID() })).statusCode).toBe(403);
    expect(
      (await a.post('/api/admin/sauvegardes', { requestId: randomUUID() }, { 'x-csrf-token': 'incorrect' })).statusCode,
    ).toBe(403);
    expect((await t.svc.backups.list()).jobs).toHaveLength(0);
  });
  it('refuse les commandes et chemins fournis par le navigateur', async () => {
    expect(
      (await a.post('/api/admin/sauvegardes', { requestId: randomUUID(), command: 'shell', destination: '/tmp' }))
        .statusCode,
    ).toBe(422);
  });
  it('refuse un exécutant absent, non prêt ou périmé', async () => {
    expect((await request()).statusCode).toBe(503);
    await t.svc.backups.heartbeat(false);
    expect((await request()).statusCode).toBe(503);
    await t.svc.backups.heartbeat(true);
    await t.svc.db.q("UPDATE backup_worker SET seen_at=now()-interval '3 minutes'");
    expect((await request()).statusCode).toBe(503);
    expect((await t.svc.backups.list()).worker.available).toBe(false);
  });
  it('rend un double clic idempotent sans doubler le job ni son audit', async () => {
    await t.svc.backups.heartbeat(true);
    const id = randomUUID();
    const responses = await Promise.all([request(id), request(id)]);
    expect(responses.map((r) => r.statusCode)).toEqual([202, 202]);
    expect(responses[0]!.json().id).toBe(responses[1]!.json().id);
    const audit = await t.svc.db.one<{ n: string }>(
      "SELECT count(*) AS n FROM audit_log WHERE action='backup.request' AND target=$1",
      [responses[0]!.json().id],
    );
    expect(Number(audit!.n)).toBe(1);
    expect((await t.svc.backups.list()).jobs).toHaveLength(1);
  });
  it('sérialise des demandes distinctes concurrentes', async () => {
    await t.svc.backups.heartbeat(true);
    const responses = await Promise.all([request(), request()]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([202, 409]);
  });
  it('annule seulement une demande en attente, avec version attendue', async () => {
    const job = await prepare();
    const url = `/api/admin/sauvegardes/${job.id}/annuler`;
    expect((await a.post(url)).statusCode).toBe(428);
    expect((await a.post(url, {}, { 'if-match': '"9"' })).statusCode).toBe(412);
    expect((await a.post(url, {}, { 'if-match': '"1"' })).json().status).toBe('annulee');
    expect(await t.svc.backups.claim()).toBeNull();
  });
  it('une prise en charge invalide l’annulation et ne relance pas une interruption', async () => {
    const job = await prepare();
    expect(await t.svc.backups.claim()).toBe(job.id);
    expect((await a.post(`/api/admin/sauvegardes/${job.id}/annuler`, {}, { 'if-match': '"1"' })).statusCode).toBe(412);
    expect((await a.post(`/api/admin/sauvegardes/${job.id}/annuler`, {}, { 'if-match': '"2"' })).statusCode).toBe(409);
    expect(await t.svc.backups.claim()).toBeNull();
    expect((await t.svc.backups.list()).jobs[0]?.status).toBe('echec');
  });
  it('accepte un rapport chiffré contrôlé et retire les chemins/éléments non autorisés', async () => {
    const job = await prepare();
    await t.svc.backups.claim();
    report(job.id, { password: 'secret-fictif', secretPath: '/root/key' });
    expect((await t.svc.backups.finish(job.id, 0)).status).toBe('reussie');
    const body = (await a.get('/api/admin/sauvegardes')).body;
    expect(body).toContain('suivi-audits-fictif.tar.age');
    expect(body).not.toContain('/srv/backups');
    expect(body).not.toContain('secret-fictif');
    expect(body).not.toContain('/root/key');
    await expect(t.svc.backups.finish(job.id, 0)).rejects.toThrow('pas en cours');
  });
  it.each([{ jobId: randomUUID() }, { chiffree: false }, { integriteVerifiee: false }, { sha256: 'incorrect' }])(
    'ne déclare jamais un rapport incohérent réussi : %j',
    async (bad) => {
      const job = await prepare();
      await t.svc.backups.claim();
      report(job.id, bad);
      expect((await t.svc.backups.finish(job.id, 0)).status).toBe('echec');
    },
  );
  it('signale un échec système ou un rapport absent sans afficher le journal brut', async () => {
    const job = await prepare();
    await t.svc.backups.claim();
    expect((await t.svc.backups.finish(job.id, 7)).message).toBe('Exécutant en échec (code 7).');
    const next = await prepare();
    await t.svc.backups.claim();
    expect((await t.svc.backups.finish(next.id, 0)).status).toBe('echec');
  });
  it('l’échec d’écriture de l’audit annule la demande dans la même transaction', async () => {
    await t.svc.backups.heartbeat(true);
    const fail = vi.spyOn(t.svc.db, 'audit').mockRejectedValueOnce(new Error('Audit indisponible'));
    try {
      await expect(t.svc.backups.request(randomUUID(), { username: 'backup-admin' }, '127.0.0.1')).rejects.toThrow(
        'Audit indisponible',
      );
    } finally {
      fail.mockRestore();
    }
    expect((await t.svc.backups.list()).jobs).toHaveLength(0);
  });
});
