import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hotp } from '../src/security/crypto.js';
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
/** Code TOTP frais pour l'administrateur : le compteur anti-rejeu est remis à zéro (réservé aux tests), puis le pas
    courant décalé de « offset » est utilisé. */
const code = async (offset = 0) => {
  await t.svc.db.q('UPDATE users SET totp_last_step=0 WHERE id=$1', [admin.id]);
  return hotp(admin.key, Math.floor(Date.now() / 30000) + offset);
};
const request = async (changes = {}) => ({
  requestId: randomUUID(),
  version: '3.1.0',
  confirm: 'METTRE À JOUR',
  code: await code(),
  ...changes,
});
const fenetre = async (f: Record<string, unknown> | null) => {
  const cur = await t.svc.settings.read('securite');
  await t.svc.db.tx((c) =>
    t.svc.settings.write(
      c,
      'securite',
      {
        ...cur.values,
        fenetreMaintenance: f ?? { active: false, jours: [1, 2, 3, 4, 5], debut: '12:00', fin: '14:00' },
      },
      cur.version,
      { username: 'test' },
    ),
  );
};
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
  await fenetre(null);
  t.svc.limits.updateMfaByUser.reset();
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
    expect((await r.post('/api/admin/updates/install', await request())).statusCode).toBe(403);
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
    expect((await a.req('POST', '/api/admin/updates/install', { json: await request(), csrf: false })).statusCode).toBe(
      403,
    );
    expect((await a.post('/api/admin/updates/install', await request({ confirm: 'OUI' }))).statusCode).toBe(422);
    expect((await a.post('/api/admin/updates/install', await request({ command: 'docker stop db' }))).statusCode).toBe(
      422,
    );
    expect(
      (await a.post('/api/admin/updates/install', await request(), { origin: 'https://evil.test' })).statusCode,
    ).toBe(403);
    expect((await a.post('/api/admin/updates/install', await request({ version: '3.1.0;id' }))).statusCode).toBe(422);
    expect((await t.svc.db.q('SELECT 1 FROM update_jobs')).rowCount).toBe(0);
  });
  it('une demande active seulement, réessai idempotent et audit transactionnel', async () => {
    const body = await request();
    // Deux codes distincts (pas courant et suivant) : selon l'ordre d'arrivée, le second est refusé par le verrou (409)
    // ou par l'anti-rejeu (401) ; dans les deux cas une seule demande est enregistrée.
    const results = await Promise.all([
      a.post('/api/admin/updates/install', body),
      a.post('/api/admin/updates/install', {
        ...body,
        requestId: randomUUID(),
        code: hotp(admin.key, Math.floor(Date.now() / 30000) + 1),
      }),
    ]);
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes[0]).toBe(202);
    expect([401, 409]).toContain(codes[1]);
    const winner = results.find((r) => r.statusCode === 202)!;
    const stored = (await t.svc.db.q('SELECT request_id FROM update_jobs')).rows[0]!;
    const same = await a.post('/api/admin/updates/install', {
      ...body,
      requestId: stored.request_id,
      code: await code(),
    });
    expect(same.statusCode).toBe(202);
    expect(same.json().id).toBe(winner.json().id);
    expect((await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='update.install.requested'")).rowCount).toBe(1);
  });
  it('refuse version changée, détection ancienne et exécutant absent', async () => {
    state({ available: '3.2.0' });
    expect((await a.post('/api/admin/updates/install', await request())).statusCode).toBe(409);
    state({ checkedAt: '2020-01-01T00:00:00Z' });
    expect((await a.post('/api/admin/updates/install', await request())).statusCode).toBe(409);
    state({ updatedAt: '2020-01-01T00:00:00Z' });
    expect((await a.post('/api/admin/updates/check')).statusCode).toBe(503);
    expect((await a.get('/api/updates')).json().ready).toBe(false);
  });
  it('revalide le rôle au moment de la prise, puis consigne le résultat', async () => {
    const r = await a.post('/api/admin/updates/install', await request());
    expect(r.statusCode).toBe(202);
    await t.svc.db.q("UPDATE user_roles SET modules=ARRAY['audit'] WHERE user_id=$1", [admin.id]);
    expect(await t.svc.updates.claim()).toBeNull();
    expect((await t.svc.db.q('SELECT status FROM update_jobs')).rows[0]?.status).toBe('failed');
    await t.svc.db.q('UPDATE user_roles SET modules=NULL WHERE user_id=$1', [admin.id]);
    const next = await a.post('/api/admin/updates/install', await request());
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
    expect((await a.put('/api/admin/modules', {})).statusCode).toBe(503);
    expect((await a.get('/healthz')).statusCode).toBe(200);
  });
  it('neutralise les intentions restaurées sans interrompre un retour arrière actif', async () => {
    const response = await a.post('/api/admin/updates/install', await request());
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

describe('mise à jour intégrée : double authentification à l’installation', () => {
  it('exige un code à six chiffres, refuse un code faux ou rejoué, et trace l’échec', async () => {
    const sans = await request();
    delete (sans as Record<string, unknown>).code;
    expect((await a.post('/api/admin/updates/install', sans)).statusCode).toBe(422);
    expect((await a.post('/api/admin/updates/install', await request({ code: '12345' }))).statusCode).toBe(422);
    const faux = await a.post('/api/admin/updates/install', await request({ code: '000000' }));
    // Un code tiré au hasard peut exceptionnellement être valide : on vérifie surtout l'absence de demande.
    if (faux.statusCode !== 202) {
      expect(faux.statusCode).toBe(401);
      expect(
        (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='update.install.mfa_failed'")).rowCount,
      ).toBeGreaterThan(0);
    }
    await t.svc.db.q('DELETE FROM update_jobs');
    // Code déjà consommé (par exemple à la connexion) : refusé.
    const rejoue = await request();
    await t.svc.db.q('UPDATE users SET totp_last_step=$2 WHERE id=$1', [admin.id, Math.floor(Date.now() / 30000) + 1]);
    expect((await a.post('/api/admin/updates/install', rejoue)).statusCode).toBe(401);
    expect((await t.svc.db.q('SELECT 1 FROM update_jobs')).rowCount).toBe(0);
  });
  it('limite les essais par compte', async () => {
    for (let i = 0; i < 5; i++) await a.post('/api/admin/updates/install', await request({ code: '999999' }));
    expect((await a.post('/api/admin/updates/install', await request())).statusCode).toBe(429);
  });
  it('un lecteur reste refusé avant toute vérification de code', async () => {
    const avant = (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='update.install.mfa_failed'")).rowCount;
    const r = await login(t, reader);
    expect((await r.post('/api/admin/updates/install', await request({ code: '000001' }))).statusCode).toBe(403);
    expect((await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='update.install.mfa_failed'")).rowCount).toBe(avant);
  });
});

describe('mise à jour intégrée : fenêtre de maintenance', () => {
  const autreCreneau = () => {
    // Créneau d'une heure commençant dans trois heures (heure de Paris) : l'instant présent est forcément dehors.
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .find((p) => p.type === 'hour')!.value;
    const h = (Number(parts) + 3) % 24;
    const hh = (x: number) => String(x % 24).padStart(2, '0') + ':00';
    return { active: true, jours: [1, 2, 3, 4, 5, 6, 7], debut: hh(h), fin: hh(h + 1) };
  };
  it('refuse l’installation hors créneau sans consommer le code, accepte dans le créneau', async () => {
    await fenetre(autreCreneau());
    const body = await request();
    const refus = await a.post('/api/admin/updates/install', body);
    expect(refus.statusCode).toBe(409);
    expect(refus.json().reason ?? refus.body).toMatch(/outside_window|fenêtre/);
    expect((await t.svc.db.q('SELECT 1 FROM update_jobs')).rowCount).toBe(0);
    // Toute la journée : le même code, non consommé, est accepté.
    await fenetre({ active: true, jours: [1, 2, 3, 4, 5, 6, 7], debut: '00:00', fin: '23:59' });
    const ok = await a.post('/api/admin/updates/install', { ...body, requestId: randomUUID() });
    expect([202, 409]).toContain(ok.statusCode);
    if (ok.statusCode === 409) expect(ok.body).toMatch(/fenêtre/); // 23:59 à Paris : seule minute exclue
  });
  it('la vérification des publications reste possible hors créneau', async () => {
    await fenetre(autreCreneau());
    expect((await a.post('/api/admin/updates/check')).statusCode).toBe(202);
  });
  it('la prise en charge refuse une demande dont le créneau s’est refermé', async () => {
    const r = await a.post('/api/admin/updates/install', await request());
    expect(r.statusCode).toBe(202);
    await fenetre(autreCreneau());
    expect(await t.svc.updates.claim()).toBeNull();
    expect((await t.svc.db.q('SELECT status FROM update_jobs')).rows[0]?.status).toBe('failed');
    expect((await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='update.install.outside_window'")).rowCount).toBe(1);
  });
  it('valide le réglage (format, jours, bornes)', async () => {
    const cur = await t.svc.settings.read('securite');
    const put = (f: unknown) =>
      a.req('PUT', '/api/settings/securite', {
        json: { ...cur.values, fenetreMaintenance: f },
        headers: { 'if-match': `"${cur.version}"` },
      });
    expect((await put({ active: true, jours: [], debut: '12:00', fin: '14:00' })).statusCode).toBe(422);
    expect((await put({ active: true, jours: [1, 1], debut: '12:00', fin: '14:00' })).statusCode).toBe(422);
    expect((await put({ active: true, jours: [8], debut: '12:00', fin: '14:00' })).statusCode).toBe(422);
    expect((await put({ active: true, jours: [1], debut: '25:00', fin: '14:00' })).statusCode).toBe(422);
    expect((await put({ active: true, jours: [1], debut: '12:00', fin: '12:00' })).statusCode).toBe(422);
  });
});

describe('mise à jour intégrée : reçus', () => {
  const recu = (id: string, changes = {}) => {
    mkdirSync(path.join(dir, 'recus-mises-a-jour'), { recursive: true });
    writeFileSync(
      path.join(dir, 'recus-mises-a-jour', `${id}.json`),
      JSON.stringify({
        format: 1,
        id,
        depuis: '3.0.0',
        vers: '3.1.0',
        statut: 'success',
        message: 'Mise à jour installée et vérifiée.',
        debut: '2026-10-26T10:00:00Z',
        fin: '2026-10-26T10:06:00Z',
        dureeSecondes: 360,
        etapes: [{ phase: 'preparing', at: '2026-10-26T10:00:00Z' }],
        images: { api: 'ghcr.io/yousername-ha/suivi-audits-api@sha256:' + 'a'.repeat(64) },
        signature: {
          verifiee: true,
          identite: 'https://github.com/yousername-ha/suivi-audits/.github/workflows/release.yml@refs/tags/v3.1.0',
          emetteur: 'https://token.actions.githubusercontent.com',
          revision: 'b'.repeat(40),
        },
        sauvegarde: { fichier: 'avant-maj-3.0.0-vers-3.1.0.tar.enc', sha256: 'c'.repeat(64) },
        controles: { avant: true, apres: true, documentsIdentiques: true },
        ...changes,
      }),
    );
  };
  it('liste et sert les reçus à l’administrateur seulement, en pièce jointe tracée', async () => {
    const id = randomUUID();
    recu(id);
    recu(randomUUID(), { images: { api: 'docker.io/autre/image:latest' } }); // non conforme : ignoré
    writeFileSync(path.join(dir, 'recus-mises-a-jour', 'pas-un-recu.json'), '{}');
    const list = await a.get('/api/admin/updates/receipts');
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([expect.objectContaining({ id, vers: '3.1.0', statut: 'success' })]);
    const one = await a.get(`/api/admin/updates/receipts/${id}`);
    expect(one.statusCode).toBe(200);
    expect(one.headers['content-disposition']).toContain('attachment');
    expect(one.json().signature.verifiee).toBe(true);
    expect(
      (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='update.receipt.downloaded' AND target=$1", [id]))
        .rowCount,
    ).toBe(1);
    expect((await a.get(`/api/admin/updates/receipts/${randomUUID()}`)).statusCode).toBe(404);
    expect((await a.get('/api/admin/updates/receipts/..%2F..%2Fsecrets')).statusCode).toBe(422);
    const r = await login(t, reader);
    expect((await r.get('/api/admin/updates/receipts')).statusCode).toBe(403);
    expect((await r.get(`/api/admin/updates/receipts/${id}`)).statusCode).toBe(403);
  });
});
