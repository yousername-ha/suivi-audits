/* Requêtes des documents (conversion Kysely, ADR 0062) : recherche (rattachement, catégorie, texte dans le titre, le nom
   de fichier, les rattachements et les étiquettes, jokers pris littéralement), corbeille, catégories des documents et des
   liens, téléchargement d'une version précise, modification partielle des métadonnées. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent;
const deposer = (nom: string, contenu: string, meta: object = {}) =>
  a.req('POST', '/api/documents', {
    body: Buffer.from(contenu),
    headers: { 'x-file-name': encodeURIComponent(nom), 'x-meta': encodeURIComponent(JSON.stringify(meta)) },
  });
const ids = async (qs: string) => ((await a.get(`/api/documents${qs}`)).json() as { id: string }[]).map((d) => d.id);

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'docq_admin', 'admin'));
});
afterAll(() => t.close());

describe('documents : requêtes', () => {
  it('recherche par rattachement, catégorie et texte ; corbeille à part ; catégories des documents et des liens', async () => {
    const d1 = (
      await deposer('politique-acces.txt', 'a', {
        title: 'Politique 100% accès',
        category: 'politique',
        refs: ['proc:P1'],
      })
    ).json();
    const d2 = (await deposer('charte.txt', 'b', { title: 'Charte', category: 'charte', tags: ['annexe_rh'] })).json();
    const d3 = (await deposer('procedure.txt', 'c', { title: 'Procédure', refs: ['proc:P2'] })).json();
    const tous = [d1.id, d2.id, d3.id];
    const parmi = async (qs: string) => (await ids(qs)).filter((id) => tous.includes(id)).sort();
    expect(await parmi('?ref=proc:P1')).toEqual([d1.id]);
    expect(await parmi('?category=charte')).toEqual([d2.id]);
    expect(await parmi('?q=CHARTE')).toEqual([d2.id]); // titre, sans casse
    expect(await parmi('?q=procedure.txt')).toEqual([d3.id]); // nom de fichier
    expect(await parmi('?q=proc:P2')).toEqual([d3.id]); // rattachements
    expect(await parmi('?q=annexe_rh')).toEqual([d2.id]); // étiquettes
    expect(await parmi('?q=100%25')).toEqual([d1.id]); // « % » cherché littéralement
    expect(await parmi('?q=annexe%25rh')).toEqual([]);
    await a.post('/api/links', { url: 'https://exemple.invalid/veille', title: 'Veille', category: 'veille' });
    const categories = (await a.get('/api/documents/categories')).json() as string[];
    expect(categories).toEqual([...categories].sort());
    expect(categories).toEqual(expect.arrayContaining(['charte', 'politique', 'veille']));
    expect(categories).not.toContain('');
    expect((await a.del(`/api/documents/${d3.id}`)).statusCode).toBe(204);
    expect(await parmi('')).toEqual([d1.id, d2.id].sort());
    expect(await parmi('?trash=1')).toEqual([d3.id]);
  });

  it('télécharge la version demandée, sinon la version courante', async () => {
    const d = (await deposer('versions.txt', 'version-1')).json();
    await a.req('POST', `/api/documents/${d.id}/versions`, {
      body: Buffer.from('version-2'),
      headers: { 'x-file-name': 'versions.txt' },
    });
    expect((await a.get(`/api/documents/${d.id}/download`)).rawPayload.toString()).toBe('version-2');
    expect((await a.get(`/api/documents/${d.id}/download?v=1`)).rawPayload.toString()).toBe('version-1');
    expect((await a.get(`/api/documents/${d.id}/download?v=9`)).statusCode).toBe(404);
  });

  it('modification partielle : seuls les champs fournis changent, la version est contrôlée', async () => {
    const d = (await deposer('meta.txt', 'm', { title: 'Avant', category: 'cat', tags: ['t1'] })).json();
    const r = await a.patch(`/api/documents/${d.id}`, { tags: ['t2', 't3'] }, { 'if-match': '"1"' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ title: 'Avant', category: 'cat', tags: ['t2', 't3'], version: 2 });
    expect((await a.patch(`/api/documents/${d.id}`, { title: 'Après' }, { 'if-match': '"1"' })).statusCode).toBe(412);
  });
});
