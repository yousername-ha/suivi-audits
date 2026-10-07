import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp;
let admin: TestUser, rw: TestUser, ro: TestUser;
let a: Agent, b: Agent;

const PDF = Buffer.from('%PDF-1.4\n% test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const upload = (ag: Agent, name: string, buf: Buffer, meta: object = {}) =>
  ag.req('POST', '/api/documents', {
    body: buf,
    headers: { 'x-file-name': encodeURIComponent(name), 'x-meta': encodeURIComponent(JSON.stringify(meta)) },
  });

beforeAll(async () => {
  t = await createTestApp();
  admin = await makeUser(t, 'admin', 'admin');
  rw = await makeUser(t, 'redacteur', 'rw');
  ro = await makeUser(t, 'lecteur', 'ro');
  a = await login(t, rw);
  b = await login(t, admin);
});
afterAll(() => t.close());

describe('documents : dépôt, chiffrement, intégrité', () => {
  it('dépose, chiffre en base et restitue à l’identique', async () => {
    const r = await upload(a, 'Politique de sécurité.pdf', PDF, {
      refs: 'A.5.1, ISO-4.1',
      classification: 'restreint',
    });
    expect(r.statusCode).toBe(201);
    const d = r.json();
    expect(d).toMatchObject({
      title: 'Politique de sécurité',
      refs: ['A.5.1', 'ISO-4.1'],
      classification: 'restreint',
      version: 1,
      current_version: 1,
    });
    expect(r.headers.etag).toBe('"1"');
    const raw = await t.svc.db.one<{ content: Buffer }>('SELECT content FROM document_versions WHERE document_id=$1', [
      d.id,
    ]);
    expect(raw!.content.includes(Buffer.from('%PDF'))).toBe(false);
    const dl = await (await login(t, ro)).get(`/api/documents/${d.id}/download`);
    expect(dl.statusCode).toBe(200);
    expect(dl.rawPayload.equals(PDF)).toBe(true);
    expect(dl.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(dl.headers['content-disposition']).toMatch(/^attachment/);
  });

  it('refuse les macros, les types non autorisés et les signatures incohérentes', async () => {
    expect((await upload(a, 'macro.docm', Buffer.from('PK\x03\x04'))).json().error).toMatch(/macros/);
    expect((await upload(a, 'script.exe', Buffer.from('MZ'))).json().error).toMatch(/non autorisé/);
    expect((await upload(a, 'faux.pdf', Buffer.from('pas un pdf'))).json().error).toMatch(/ne correspond pas/);
  });

  it('détecte une altération du contenu chiffré', async () => {
    const d = (await upload(a, 'integrite.txt', Buffer.from('contenu'))).json();
    await t.svc.db.q("UPDATE document_versions SET sha256 = repeat('0', 64) WHERE document_id=$1", [d.id]);
    expect((await a.get(`/api/documents/${d.id}/download`)).statusCode).toBe(500);
  });

  it('corbeille : restauration par un rédacteur, purge réservée aux administrateurs', async () => {
    const d = (await upload(a, 'corbeille.txt', Buffer.from('x'))).json();
    expect((await a.del(`/api/documents/${d.id}`)).statusCode).toBe(204);
    expect((await a.del(`/api/documents/${d.id}?purge=1`)).statusCode).toBe(403);
    expect((await a.post(`/api/documents/${d.id}/restore`)).statusCode).toBe(204);
    expect((await a.del(`/api/documents/${d.id}`)).statusCode).toBe(204);
    expect((await b.del(`/api/documents/${d.id}?purge=1`)).statusCode).toBe(204);
  });

  it('nouvelle version : incrémente la version du document', async () => {
    const d = (await upload(a, 'v.txt', Buffer.from('v1'))).json();
    const r = await a.req('POST', `/api/documents/${d.id}/versions`, {
      body: Buffer.from('v2'),
      headers: { 'x-file-name': 'v.txt', 'x-comment': 'mise%20%C3%A0%20jour' },
    });
    expect(r.json()).toEqual({ version: 2, documentVersion: 2 });
    const full = (await a.get(`/api/documents/${d.id}`)).json();
    expect(full.versions.map((v: { version: number; comment: string }) => [v.version, v.comment])).toEqual([
      [2, 'mise à jour'],
      [1, ''],
    ]);
  });
});

describe('concurrence par enregistrement (If-Match)', () => {
  it('exige If-Match pour modifier', async () => {
    const d = (await upload(a, 'c0.txt', Buffer.from('x'))).json();
    const r = await a.patch(`/api/documents/${d.id}`, { title: 'sans version' });
    expect(r.statusCode).toBe(428);
  });

  it('412 seulement si le même enregistrement a changé, avec sa version courante', async () => {
    const d1 = (await upload(a, 'c1.txt', Buffer.from('x'))).json();
    const d2 = (await upload(a, 'c2.txt', Buffer.from('x'))).json();
    // Deux utilisateurs ouvrent d1 (version 1).
    const ok = await a.patch(`/api/documents/${d1.id}`, { title: 'modifié par a' }, { 'if-match': '"1"' });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers.etag).toBe('"2"');
    // b modifie un AUTRE document avec sa version : aucun conflit.
    expect(
      (await b.patch(`/api/documents/${d2.id}`, { title: 'modifié par b' }, { 'if-match': '"1"' })).statusCode,
    ).toBe(200);
    // b modifie d1 avec la version périmée : 412 et version courante renvoyée.
    const ko = await b.patch(`/api/documents/${d1.id}`, { title: 'écrasement' }, { 'if-match': '"1"' });
    expect(ko.statusCode).toBe(412);
    expect(ko.json().current).toMatchObject({ id: d1.id, version: 2, title: 'modifié par a', updated_by: 'redacteur' });
    expect(ko.json().error).toMatch(/modifié par redacteur/);
    // Avec la version courante, la modification passe.
    expect(
      (await b.patch(`/api/documents/${d1.id}`, { title: 'après rechargement' }, { 'if-match': '"2"' })).statusCode,
    ).toBe(200);
  });

  it('liens : même contrôle', async () => {
    const l = (await a.post('/api/links', { url: 'https://exemple.invalid/a', title: 'A' })).json();
    expect(l.version).toBe(1);
    expect((await a.patch(`/api/links/${l.id}`, { title: 'A1' }, { 'if-match': '1' })).json().version).toBe(2);
    const ko = await b.patch(`/api/links/${l.id}`, { title: 'B' }, { 'if-match': '1' });
    expect(ko.statusCode).toBe(412);
    expect(ko.json().current).toMatchObject({ title: 'A1', version: 2 });
  });

  it('comptes : même contrôle côté administration', async () => {
    const u = await makeUser(t, 'cible', 'ro');
    const v = (await b.get(`/api/admin/users/${u.id}`)).headers.etag as string;
    expect((await b.patch(`/api/admin/users/${u.id}`, { displayName: 'Un' }, { 'if-match': v })).statusCode).toBe(200);
    expect((await b.patch(`/api/admin/users/${u.id}`, { displayName: 'Deux' }, { 'if-match': v })).statusCode).toBe(
      412,
    );
  });

  it('refuse une adresse de lien invalide', async () => {
    const r = await a.post('/api/links', { url: 'javascript:alert(1)' });
    expect(r.statusCode).toBe(422);
  });
});
