import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';
import { certificateInfo } from '../src/certificates.js';
let t: TestApp, a: Agent, reader: Agent, dir: string;
const hash = 'a'.repeat(64),
  archiveId = 'b'.repeat(64);
const archive = {
  id: archiveId,
  name: 'suivi-audits-fictif.tar.age',
  sha256: hash,
  size: 1024,
  modifiedAt: new Date().toISOString(),
  encrypted: true,
  integrity: true,
};
const host = (changes: Record<string, unknown> = {}) => ({
  seenAt: new Date().toISOString(),
  backupReady: true,
  restoreReady: true,
  tlsManaged: true,
  tlsMode: 'env',
  destination: 'fictif',
  message: 'Prêt',
  archives: [archive],
  certificate: null,
  jobs: [],
  ...changes,
});
const publish = (changes: Record<string, unknown> = {}) =>
  writeFileSync(path.join(dir, 'exploitation/etat.json'), JSON.stringify(host(changes)));
const request = (changes: Record<string, unknown> = {}) =>
  a.post('/api/admin/exploitation/operations', {
    requestId: randomUUID(),
    kind: 'verify',
    archiveId,
    sha256: hash,
    ...changes,
  });
let pem: string, key: string;
beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'suivi-operations-'));
  mkdirSync(path.join(dir, 'exploitation'));
  t = await createTestApp({ ETAT_DIR: dir });
  a = await login(t, await makeUser(t, 'operation-admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id,name,permissions) VALUES ('operation_reader','Lecture exploitation',ARRAY['administration:lire'])",
  );
  reader = await login(t, await makeUser(t, 'operation-reader', 'operation_reader'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      path.join(dir, 'key.pem'),
      '-out',
      path.join(dir, 'cert.pem'),
      '-days',
      '2',
      '-subj',
      '/CN=suivi.test',
      '-addext',
      'subjectAltName=DNS:suivi.test',
    ],
    { stdio: 'ignore' },
  );
  pem = readFileSync(path.join(dir, 'cert.pem'), 'utf8');
  key = readFileSync(path.join(dir, 'key.pem'), 'utf8');
});
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await t.svc.db.q('DELETE FROM operation_receipts');
  await t.svc.db.q('DELETE FROM operation_jobs');
  await t.svc.db.q('DELETE FROM backup_jobs');
  await t.svc.db.q(
    'UPDATE backup_policy SET enabled=false,hour_utc=2,minute_utc=15,days=ARRAY[1,2,3,4,5,6,7],retention_days=90,version=1',
  );
  publish();
});
const verified = () => ({
  id: randomUUID(),
  requestId: randomUUID(),
  kind: 'verify',
  status: 'reussie',
  requestedBy: 'operation-admin',
  createdAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  version: 3,
  phase: 'verifiee',
  message: 'Contrôlée',
  archiveId,
  sha256: hash,
});
describe('Lot A : pilotage opérationnel', () => {
  it('observe un certificat SAN-only sans sujet textuel, comme celui de Caddy', () => {
    const file = path.join(dir, 'sans-sujet.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-new',
        '-key',
        path.join(dir, 'key.pem'),
        '-out',
        file,
        '-days',
        '2',
        '-subj',
        '/',
        '-addext',
        'subjectAltName=DNS:suivi.test',
      ],
      { stdio: 'ignore' },
    );
    const cert = certificateInfo(readFileSync(file, 'utf8'), 'suivi.test', key);
    expect(cert.subject).toBe('');
    expect(cert.hostMatches).toBe(true);
    expect(cert.keyMatches).toBe(true);
  });
  it('exige authentification, droits de lecture/écriture et CSRF', async () => {
    expect((await new Agent(t).get('/api/admin/exploitation')).statusCode).toBe(401);
    expect((await reader.get('/api/admin/exploitation')).statusCode).toBe(200);
    expect(
      (
        await reader.post('/api/admin/exploitation/operations', {
          requestId: randomUUID(),
          kind: 'verify',
          archiveId,
          sha256: hash,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await a.req('POST', '/api/admin/exploitation/operations', {
          json: { requestId: randomUUID(), kind: 'verify', archiveId, sha256: hash },
          csrf: false,
        })
      ).statusCode,
    ).toBe(403);
  });
  it('refuse commandes, chemins et confirmation destructive incorrecte', async () => {
    expect((await request({ path: '/tmp/archive' })).statusCode).toBe(422);
    expect((await request({ kind: 'restore', confirmation: 'oui' })).statusCode).toBe(422);
  });
  it('refuse exécutant absent, périmé ou daté dans le futur', async () => {
    for (const seenAt of ['2000-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z']) {
      publish({ seenAt });
      expect((await request()).statusCode).toBe(503);
    }
    rmSync(path.join(dir, 'exploitation/etat.json'));
    expect((await request()).statusCode).toBe(503);
  });
  it('refuse archive absente, hash modifié et intégrité incohérente', async () => {
    expect((await request({ sha256: 'c'.repeat(64) })).statusCode).toBe(409);
    publish({ archives: [{ ...archive, integrity: false }] });
    expect((await request()).statusCode).toBe(409);
  });
  it('exige vérification préalable de la même empreinte et chiffrement pour restaurer', async () => {
    expect((await request({ kind: 'restore', confirmation: 'RESTAURER' })).statusCode).toBe(409);
    publish({ jobs: [verified()], archives: [{ ...archive, encrypted: false }] });
    expect((await request({ kind: 'restore', confirmation: 'RESTAURER' })).statusCode).toBe(422);
    publish({ jobs: [{ ...verified(), sha256: 'c'.repeat(64) }] });
    expect((await request({ kind: 'restore', confirmation: 'RESTAURER' })).statusCode).toBe(409);
    publish({ jobs: [verified()] });
    expect((await request({ kind: 'restore', confirmation: 'RESTAURER' })).statusCode).toBe(202);
  });
  it('réessais idempotents, auteur et paramètres protégés', async () => {
    const id = randomUUID();
    const first = await request({ requestId: id });
    expect(first.statusCode).toBe(202);
    expect((await request({ requestId: id })).json().id).toBe(first.json().id);
    expect((await request({ requestId: id, sha256: 'c'.repeat(64) })).statusCode).toBe(409);
    const other = await login(t, await makeUser(t, 'autre-' + randomUUID().slice(0, 8), 'admin'));
    expect(
      (
        await other.post('/api/admin/exploitation/operations', {
          requestId: id,
          kind: 'verify',
          archiveId,
          sha256: hash,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await t.svc.db.one<{ n: number }>(
        "SELECT count(*)::int AS n FROM audit_log WHERE action='operation.verify.request' AND target=$1",
        [first.json().id],
      ))!.n,
    ).toBe(1);
  });
  it('deux demandes concurrentes produisent une seule tâche', async () => {
    const rs = await Promise.all([request(), request()]);
    expect(rs.map((r) => r.statusCode).sort()).toEqual([202, 409]);
  });
  it('exclusion partagée avec sauvegardes et blocage pendant intervention', async () => {
    await t.svc.backups.heartbeat(true);
    const r = await request();
    expect(r.statusCode).toBe(202);
    expect((await a.post('/api/admin/sauvegardes', { requestId: randomUUID() })).statusCode).toBe(409);
    await t.svc.db.q('DELETE FROM operation_jobs');
    expect((await a.post('/api/admin/sauvegardes', { requestId: randomUUID() })).statusCode).toBe(202);
    expect((await request()).statusCode).toBe(409);
    await t.svc.db.q('DELETE FROM backup_jobs');
    publish({ jobs: [{ ...verified(), status: 'intervention' }] });
    expect((await request()).statusCode).toBe(409);
  });
  it('annulation versionnée, refus après prise en charge et aucun secret persistant', async () => {
    const r = (await request()).json();
    expect((await a.post(`/api/admin/exploitation/operations/${r.id}/annuler`, {})).statusCode).toBe(428);
    expect(
      (await a.post(`/api/admin/exploitation/operations/${r.id}/annuler`, {}, { 'if-match': '"999"' })).statusCode,
    ).toBe(412);
    expect(
      (await a.post(`/api/admin/exploitation/operations/${r.id}/annuler`, {}, { 'if-match': '"1"' })).json().status,
    ).toBe('annulee');
    expect(
      (await a.post(`/api/admin/exploitation/operations/${r.id}/annuler`, {}, { 'if-match': '"2"' })).statusCode,
    ).toBe(409);
  });
  it('un créneau en conflit est consigné une fois et ne bloque pas l’opération active', async () => {
    await request();
    const id = randomUUID();
    expect((await t.svc.backups.schedule(id)).status).toBe('echec');
    expect((await t.svc.backups.schedule(id)).status).toBe('echec');
    expect((await t.svc.operations.claim())!.kind).toBe('verify');
    expect(
      (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM backup_jobs WHERE request_id=$1', [id]))!.n,
    ).toBe(1);
  });
  it('la prise en charge ne rejoue jamais une demande interrompue', async () => {
    await request();
    expect((await t.svc.operations.claim())!.kind).toBe('verify');
    expect(await t.svc.operations.claim()).toBeNull();
    expect((await t.svc.db.one<{ status: string }>('SELECT status FROM operation_jobs'))!.status).toBe('echec');
  });
  it('politique bornée, versionnée et auditée ; configuration indépendante de la disponibilité', async () => {
    const p = { enabled: true, hourUtc: 23, minuteUtc: 59, days: [1, 7], retentionDays: 36500 };
    expect((await a.put('/api/admin/exploitation/politique', p)).statusCode).toBe(428);
    expect(
      (await a.put('/api/admin/exploitation/politique', { ...p, days: [1, 1] }, { 'if-match': '"1"' })).statusCode,
    ).toBe(422);
    expect(
      (await a.put('/api/admin/exploitation/politique', { ...p, retentionDays: 0 }, { 'if-match': '"1"' })).statusCode,
    ).toBe(422);
    const r = await a.put('/api/admin/exploitation/politique', p, { 'if-match': '"1"' });
    expect(r.statusCode).toBe(200);
    expect(r.json().version).toBe(2);
    expect((await a.put('/api/admin/exploitation/politique', p, { 'if-match': '"1"' })).statusCode).toBe(412);
    expect((await reader.put('/api/admin/exploitation/politique', p, { 'if-match': '"2"' })).statusCode).toBe(403);
  });
  it('TLS absent/externe interdit les changements', async () => {
    publish({ tlsManaged: false });
    expect(
      (await request({ kind: 'tls_reset', confirmation: 'REVENIR', archiveId: undefined, sha256: undefined }))
        .statusCode,
    ).toBe(409);
    publish({ tlsMode: 'external' });
    expect(
      (await request({ kind: 'tls_reset', confirmation: 'REVENIR', archiveId: undefined, sha256: undefined }))
        .statusCode,
    ).toBe(409);
  });
  it('autorité interne et ACME : réglages validés, transmis à l’exécutant, aucun secret', async () => {
    publish();
    const url = '/api/admin/exploitation/operations';
    for (const bad of [
      { kind: 'tls_internal', confirmation: 'OUI' },
      { kind: 'tls_acme', email: 'pas-un-courriel', confirmation: 'APPLIQUER' },
      { kind: 'tls_acme', email: 'rssi@exemple.fr -e X=1', confirmation: 'APPLIQUER' },
      { kind: 'tls_acme', email: 'rssi@exemple.fr', directory: 'http://acme.exemple.fr/d', confirmation: 'APPLIQUER' },
      { kind: 'tls_acme', email: 'rssi@exemple.fr', directory: 'https://a.fr/x y;rm', confirmation: 'APPLIQUER' },
      { kind: 'tls_acme', email: 'rssi@exemple.fr', confirmation: 'APPLIQUER', extra: 1 },
    ])
      expect((await a.post(url, { requestId: randomUUID(), ...bad })).statusCode).toBe(422);
    const termine = async (id: string, kind: string) => {
      publish({ jobs: [{ ...verified(), id, kind, archiveId: null, sha256: null, status: 'reussie' }] });
      await t.svc.operations.synchronize();
    };
    const interne = await a.post(url, { requestId: randomUUID(), kind: 'tls_internal', confirmation: 'APPLIQUER' });
    expect(interne.statusCode).toBe(202);
    const jobInterne = await t.svc.operations.claim();
    expect(jobInterne!.payload).toEqual({ mode: 'interne' });
    expect(jobInterne).not.toHaveProperty('privateKey');
    await termine(interne.json().id, 'tls_internal');
    const acme = await a.post(url, {
      requestId: randomUUID(),
      kind: 'tls_acme',
      email: 'rssi@exemple.fr',
      confirmation: 'APPLIQUER',
    });
    expect(acme.statusCode).toBe(202);
    const jobAcme = await t.svc.operations.claim();
    expect(jobAcme!.payload).toEqual({
      mode: 'acme',
      email: 'rssi@exemple.fr',
      directory: 'https://acme-v02.api.letsencrypt.org/directory',
    });
    expect(jobAcme).not.toHaveProperty('privateKey');
    await termine(acme.json().id, 'tls_acme');
    expect((await a.get('/api/admin/audit')).body).toContain('operation.tls_acme.request');
    publish({ tlsMode: 'acme', acme: { email: 'rssi@exemple.fr', directory: 'https://a.fr/d' } });
    expect((await a.get('/api/admin/exploitation')).json().host.tlsMode).toBe('acme');
    publish({ tlsMode: 'external' });
    expect(
      (await a.post(url, { requestId: randomUUID(), kind: 'tls_internal', confirmation: 'APPLIQUER' })).statusCode,
    ).toBe(409);
    publish();
  });
  it('clé TLS scellée, jamais dans sorties/audit, et détruite après achèvement', async () => {
    const response = await a.post('/api/admin/exploitation/operations', {
      requestId: randomUUID(),
      kind: 'tls_install',
      certificate: pem,
      privateKey: key,
    });
    expect(response.statusCode).toBe(202);
    expect(response.body).not.toContain('PRIVATE KEY');
    const row = (await t.svc.db.one<{ id: string; secret: Buffer }>('SELECT id,secret FROM operation_jobs'))!;
    expect(row.secret.toString()).not.toContain('PRIVATE KEY');
    expect((await t.svc.operations.claim())!.privateKey).toBe(key);
    expect((await a.get('/api/admin/exploitation')).body).not.toContain('PRIVATE KEY');
    expect((await a.get('/api/admin/audit')).body).not.toContain('PRIVATE KEY');
    publish({
      jobs: [{ ...verified(), id: row.id, kind: 'tls_install', archiveId: null, sha256: null, status: 'echec' }],
    });
    await t.svc.operations.synchronize();
    expect(
      (await t.svc.db.one<{ secret: Buffer | null }>('SELECT secret FROM operation_jobs WHERE id=$1', [row.id]))!
        .secret,
    ).toBeNull();
  });
  it('refuse mauvais hôte, clé différente, PEM invalide et clé chiffrée sans mot de passe', async () => {
    const bad = path.join(dir, 'other.pem');
    execFileSync('openssl', ['genpkey', '-algorithm', 'ED25519', '-out', bad], { stdio: 'ignore' });
    for (const privateKey of ['INVALIDE', readFileSync(bad, 'utf8')])
      expect(
        (
          await a.post('/api/admin/exploitation/operations', {
            requestId: randomUUID(),
            kind: 'tls_install',
            certificate: pem,
            privateKey,
          })
        ).statusCode,
      ).toBe(422);
    const other = path.join(dir, 'wrong.crt');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-key',
        path.join(dir, 'key.pem'),
        '-out',
        other,
        '-days',
        '2',
        '-subj',
        '/CN=autre.test',
        '-addext',
        'subjectAltName=DNS:autre.test',
      ],
      { stdio: 'ignore' },
    );
    expect(
      (
        await a.post('/api/admin/exploitation/operations', {
          requestId: randomUUID(),
          kind: 'tls_install',
          certificate: readFileSync(other, 'utf8'),
          privateKey: key,
        })
      ).statusCode,
    ).toBe(422);
  });
  it('aperçu d’un certificat : contrôles détaillés en lecture seule, rien de conservé, clé jamais restituée', async () => {
    const avant = (await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM operation_jobs'))!.n;
    const ok = await a.post('/api/admin/exploitation/tls/apercu', { certificate: pem, privateKey: key });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, certificat: { alternatifs: ['DNS:suivi.test'] } });
    expect(ok.json().controles.map((c: { id: string; ok: boolean }) => [c.id, c.ok])).toEqual([
      ['format', true],
      ['validite', true],
      ['chaine', true],
      ['hote', true],
      ['cle', true],
    ]);
    // Aucune opération créée, aucune clé dans la réponse ni dans le journal.
    expect(ok.body).not.toContain('PRIVATE KEY');
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM operation_jobs'))!.n).toBe(avant);
    expect((await a.get('/api/admin/audit')).body).not.toContain('PRIVATE KEY');
    // Un certificat qui ne couvre pas l'hôte, une clé différente, un fichier qui n'est pas un PEM : chaque contrôle le dit.
    const autreCle = path.join(dir, 'autre-cle.pem');
    execFileSync('openssl', ['genpkey', '-algorithm', 'ED25519', '-out', autreCle], { stdio: 'ignore' });
    const mauvaiseCle = await a.post('/api/admin/exploitation/tls/apercu', {
      certificate: pem,
      privateKey: readFileSync(autreCle, 'utf8'),
    });
    expect(mauvaiseCle.json().ok).toBe(false);
    expect(mauvaiseCle.json().controles.find((c: { id: string }) => c.id === 'cle')).toMatchObject({ ok: false });
    const illisible = await a.post('/api/admin/exploitation/tls/apercu', { certificate: 'x'.repeat(200) });
    expect(illisible.json()).toMatchObject({ ok: false, certificat: null });
    expect(illisible.json().controles[0]).toMatchObject({ id: 'format', ok: false });
    // Réservé à l'administration (la lecture seule n'y a pas accès).
    expect((await reader.post('/api/admin/exploitation/tls/apercu', { certificate: pem })).statusCode).toBe(403);
  });
  it('TLS : certificat expiré et clé chiffrée refusés avant insertion', async () => {
    const encrypted = path.join(dir, 'encrypted.key');
    execFileSync(
      'openssl',
      [
        'pkey',
        '-in',
        path.join(dir, 'key.pem'),
        '-aes-256-cbc',
        '-passout',
        'pass:mot-de-passe-fictif',
        '-out',
        encrypted,
      ],
      { stdio: 'ignore' },
    );
    const expired = path.join(dir, 'expired.crt');
    const config = path.join(dir, 'expired.conf'),
      csr = path.join(dir, 'expired.csr');
    mkdirSync(path.join(dir, 'ca'), { recursive: true });
    writeFileSync(path.join(dir, 'ca/index'), '');
    writeFileSync(path.join(dir, 'ca/serial'), '01\n');
    writeFileSync(
      config,
      `[ca]
default_ca=local
[local]
database=${dir}/ca/index
serial=${dir}/ca/serial
new_certs_dir=${dir}/ca
certificate=${dir}/cert.pem
private_key=${dir}/key.pem
default_md=sha256
policy=subject
x509_extensions=server
[subject]
commonName=supplied
[server]
subjectAltName=DNS:suivi.test
`,
    );
    execFileSync(
      'openssl',
      ['req', '-new', '-key', path.join(dir, 'key.pem'), '-out', csr, '-subj', '/CN=suivi.test'],
      { stdio: 'ignore' },
    );
    execFileSync(
      'openssl',
      [
        'ca',
        '-batch',
        '-selfsign',
        '-notext',
        '-config',
        config,
        '-in',
        csr,
        '-out',
        expired,
        '-startdate',
        '20200101000000Z',
        '-enddate',
        '20200102000000Z',
      ],
      { stdio: 'ignore' },
    );

    for (const pair of [
      { certificate: pem, privateKey: readFileSync(encrypted, 'utf8') },
      { certificate: readFileSync(expired, 'utf8'), privateKey: key },
    ])
      expect(
        (await a.post('/api/admin/exploitation/operations', { requestId: randomUUID(), kind: 'tls_install', ...pair }))
          .statusCode,
      ).toBe(422);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM operation_jobs'))!.n).toBe(0);
  });
  it('TLS : annulation efface la clé et réessai avec un autre certificat refuse le même UUID', async () => {
    const requestId = randomUUID();
    const body = { requestId, kind: 'tls_install', certificate: pem, privateKey: key };
    const first = await a.post('/api/admin/exploitation/operations', body);
    expect(first.statusCode).toBe(202);
    expect((await a.post('/api/admin/exploitation/operations', body)).json().id).toBe(first.json().id);
    const other = path.join(dir, 'renewed.crt');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-key',
        path.join(dir, 'key.pem'),
        '-out',
        other,
        '-days',
        '3',
        '-subj',
        '/CN=suivi.test',
        '-addext',
        'subjectAltName=DNS:suivi.test',
      ],
      { stdio: 'ignore' },
    );
    expect(
      (await a.post('/api/admin/exploitation/operations', { ...body, certificate: readFileSync(other, 'utf8') }))
        .statusCode,
    ).toBe(409);
    const cancel = await a.post(
      `/api/admin/exploitation/operations/${first.json().id}/annuler`,
      {},
      { 'if-match': '"1"' },
    );
    expect(cancel.statusCode).toBe(200);
    expect(
      (await t.svc.db.one<{ secret: Buffer | null }>('SELECT secret FROM operation_jobs WHERE id=$1', [
        first.json().id,
      ]))!.secret,
    ).toBeNull();
  });
  it('journal hôte consultable après disparition de la demande en base ; audit réconcilié une fois', async () => {
    const r = (await request()).json();
    await t.svc.db.q('DELETE FROM operation_jobs');
    const j = { ...verified(), id: r.id, requestId: r.requestId };
    publish({ jobs: [j] });
    expect((await a.get('/api/admin/exploitation')).json().jobs[0].id).toBe(r.id);
    await t.svc.operations.synchronize();
    await t.svc.operations.synchronize();
    expect(
      (await t.svc.db.one<{ n: number }>(
        "SELECT count(*)::int AS n FROM audit_log WHERE action='operation.verify.reussie' AND target=$1",
        [r.id],
      ))!.n,
    ).toBe(1);
    expect((await request({ requestId: r.requestId })).json().id).toBe(r.id);
  });
  it('neutralise les anciennes files restaurées ; conserve les demandes nouvelles', async () => {
    await request();
    await t.svc.db.q("UPDATE operation_jobs SET created_at='2000-01-01'::timestamptz");
    await t.svc.db.q("INSERT INTO backup_jobs(request_id,requested_by,created_at) VALUES ($1,'fictif','2000-01-01')", [
      randomUUID(),
    ]);
    await t.svc.operations.synchronize('2020-01-01T00:00:00.000Z');
    expect((await t.svc.db.one<{ status: string }>('SELECT status FROM backup_jobs'))!.status).toBe('echec');
    expect((await t.svc.db.one<{ status: string }>('SELECT status FROM operation_jobs'))!.status).toBe('echec');
    expect((await request()).statusCode).toBe(202);
    await t.svc.operations.synchronize('2020-01-01T00:00:00.000Z');
    expect(
      (await t.svc.db.one<{ n: number }>("SELECT count(*)::int AS n FROM operation_jobs WHERE status='en_attente'"))!.n,
    ).toBe(1);
  });
});
