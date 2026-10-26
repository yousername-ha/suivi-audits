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

  it('corbeille : suppression, restauration et purge selon les droits (supprimer, administrer)', async () => {
    const d = (await upload(a, 'corbeille.txt', Buffer.from('x'))).json();
    // Contributeur : lire et modifier, pas supprimer.
    expect((await a.del(`/api/documents/${d.id}`)).statusCode).toBe(403);
    const rssi = await login(t, await makeUser(t, 'rssi-docs', 'rssi'));
    expect((await rssi.del(`/api/documents/${d.id}`)).statusCode).toBe(204);
    expect((await a.post(`/api/documents/${d.id}/restore`)).statusCode).toBe(403);
    expect((await rssi.post(`/api/documents/${d.id}/restore`)).statusCode).toBe(204);
    expect((await rssi.del(`/api/documents/${d.id}`)).statusCode).toBe(204);
    expect((await b.del(`/api/documents/${d.id}?purge=1`)).statusCode).toBe(204);
  });

  it('purge : un document cité comme preuve reste dans la corbeille, un document non cité se purge', async () => {
    const d = (await upload(a, 'preuve-citee.txt', Buffer.from('preuve'))).json();
    const preuve = await b.post('/api/grc/00000000-0000-4000-8000-000000000001/objects', {
      kind: 'evidence',
      name: 'Preuve citant le document',
      data: { source: 'Document partagé', documentRefs: [`document:${d.id}:1`], refs: [] },
    });
    expect(preuve.statusCode, preuve.body).toBe(200);
    const rssi = await login(t, await makeUser(t, 'rssi-purge', 'rssi'));
    expect((await rssi.del(`/api/documents/${d.id}`)).statusCode).toBe(204);
    const refus = await b.del(`/api/documents/${d.id}?purge=1`);
    expect(refus.statusCode, refus.body).toBe(409);
    expect(refus.json().error).toMatch(/cité comme preuve \(1 fiche/);
    // Le document est toujours dans la corbeille et se restaure.
    expect((await rssi.post(`/api/documents/${d.id}/restore`)).statusCode).toBe(204);
    expect((await rssi.del(`/api/documents/${d.id}`)).statusCode).toBe(204);
    // Sans citation, la purge reste possible.
    const libre = (await upload(a, 'non-cite.txt', Buffer.from('libre'))).json();
    expect((await rssi.del(`/api/documents/${libre.id}`)).statusCode).toBe(204);
    expect((await b.del(`/api/documents/${libre.id}?purge=1`)).statusCode).toBe(204);
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

  it('liens : recherche par rattachement, catégorie et texte (jokers échappés), suppression logique', async () => {
    const mk = (body: Record<string, unknown>) => a.post('/api/links', body).then((r) => r.json());
    const l1 = await mk({
      url: 'https://exemple.invalid/r1',
      title: 'Rapport 100% sûr',
      category: 'veille',
      refs: ['proc:P1'],
      tags: ['anssi'],
    });
    const l2 = await mk({
      url: 'https://exemple.invalid/r2',
      title: 'Autre',
      category: 'norme',
      refs: ['proc:P2'],
      description: 'note_interne',
    });
    const l3 = await mk({
      url: 'https://exemple.invalid/r3',
      title: 'Troisième',
      category: 'veille',
      tags: ['iso27001'],
    });
    const ids = async (qs: string) =>
      ((await a.get(`/api/links${qs}`)).json() as { id: string }[])
        .map((l) => l.id)
        .filter((id) => [l1.id, l2.id, l3.id].includes(id))
        .sort();
    expect(await ids('?ref=proc:P1')).toEqual([l1.id]);
    expect(await ids('?category=veille')).toEqual([l1.id, l3.id].sort());
    expect(await ids('?q=ISO27')).toEqual([l3.id]); // étiquettes, insensible à la casse
    expect(await ids('?q=proc:P2')).toEqual([l2.id]); // rattachements
    expect(await ids('?q=100%25')).toEqual([l1.id]); // « % » cherché littéralement
    expect(await ids('?q=note_int')).toEqual([l2.id]);
    expect(await ids('?q=note%25int')).toEqual([]); // un joker saisi ne s'étend pas
    expect(await ids('?category=veille&q=troisi')).toEqual([l3.id]);
    // Ordre : le plus récemment modifié d'abord.
    await a.patch(`/api/links/${l1.id}`, { title: 'Rapport révisé' }, { 'if-match': '1' });
    const tous = ((await a.get('/api/links?category=veille')).json() as { id: string }[]).map((l) => l.id);
    expect(tous.indexOf(l1.id)).toBeLessThan(tous.indexOf(l3.id));
    expect((await b.req('DELETE', `/api/links/${l2.id}`)).statusCode).toBe(204);
    expect(await ids('?ref=proc:P2')).toEqual([]);
    expect((await a.req('DELETE', `/api/links/${l1.id}`)).statusCode).toBe(403); // rédacteur : pas de suppression
    expect((await b.req('DELETE', `/api/links/${l2.id}`)).statusCode).toBe(404);
    expect((await a.patch(`/api/links/${l2.id}`, { title: 'x' }, { 'if-match': '2' })).statusCode).toBe(404);
  });

  it('refuse une adresse de lien invalide', async () => {
    const r = await a.post('/api/links', { url: 'javascript:alert(1)' });
    expect(r.statusCode).toBe(422);
  });
});
