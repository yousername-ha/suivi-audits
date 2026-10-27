/* Conservation (décision 2) : durées réglables par catégorie, aperçu de ce qui serait candidat à une purge, jamais de
   suppression automatique. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent;
const PDF = Buffer.from('%PDF-1.4\n% test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const SMSI = '00000000-0000-4000-8000-000000000001';
const upload = (name: string) =>
  admin.req('POST', '/api/documents', {
    body: PDF,
    headers: { 'x-file-name': encodeURIComponent(name), 'x-meta': encodeURIComponent('{}') },
  });
const lireSection = async () => {
  const r = await admin.get('/api/settings/conservation');
  return { ...r.json(), etag: r.headers.etag as string };
};
const regler = async (valeurs: Record<string, number | null>) => {
  const s = await lireSection();
  const r = await admin.put('/api/settings/conservation', { ...s.values, ...valeurs }, { 'if-match': s.etag });
  expect(r.statusCode, r.body).toBe(200);
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cons_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'cons_ro', 'ro'));
});
afterAll(() => t.close());

describe('conservation', () => {
  it('par défaut, aucune durée : conservation sans limite et aucune purge automatique', async () => {
    const s = await lireSection();
    expect(s.values).toEqual({ documentsCorbeilleJours: null, rappelsLusJours: null, elementsArchivesJours: null });
    const a = (await admin.get('/api/settings/conservation/apercu')).json();
    expect(a.automaticPurge).toBe(false);
    expect(a.categories.map((c: { id: string }) => c.id)).toEqual([
      'documents_corbeille',
      'rappels_lus',
      'elements_archives',
    ]);
    expect(a.categories.every((c: { candidates: number | null }) => c.candidates === null)).toBe(true);
    // Aucune durée réglée : rien n'est évalué, donc aucun motif d'exclusion à expliquer.
    expect(a.categories.every((c: { exclusions: unknown[] }) => c.exclusions.length === 0)).toBe(true);
  });

  it('refuse une durée hors bornes ou non entière, et un lecteur sans droit sur les paramètres ne lit ni ne modifie', async () => {
    const s = await lireSection();
    for (const v of [0, -5, 4000, 1.5])
      expect(
        (await admin.put('/api/settings/conservation', { ...s.values, rappelsLusJours: v }, { 'if-match': s.etag }))
          .statusCode,
      ).toBe(422);
    expect(
      (await lecteur.put('/api/settings/conservation', { ...s.values, rappelsLusJours: 30 }, { 'if-match': s.etag }))
        .statusCode,
    ).toBe(403);
    expect((await lecteur.get('/api/settings/conservation/apercu')).statusCode).toBe(403);
  });

  it('mesure les documents de la corbeille plus anciens que la durée, hors documents cités comme preuve, sans rien supprimer', async () => {
    const ancien = (await upload('ancien.txt')).json();
    const cite = (await upload('cite.txt')).json();
    const recent = (await upload('recent.txt')).json();
    const preuve = await admin.post(`/api/grc/${SMSI}/objects`, {
      kind: 'evidence',
      name: 'Preuve citant le document',
      data: { source: 'Document partagé', documentRefs: [`document:${cite.id}:1`], refs: [] },
    });
    expect(preuve.statusCode, preuve.body).toBe(200);
    for (const d of [ancien, cite, recent]) expect((await admin.del(`/api/documents/${d.id}`)).statusCode).toBe(204);
    await t.svc.db.q(`UPDATE documents SET deleted_at = now() - interval '200 days' WHERE id = ANY($1)`, [
      [ancien.id, cite.id],
    ]);
    await regler({ documentsCorbeilleJours: 90 });
    const apercu = (await admin.get('/api/settings/conservation/apercu')).json();
    const docs = apercu.categories.find((c: { id: string }) => c.id === 'documents_corbeille');
    expect(docs).toMatchObject({ days: 90, candidates: 2, protectedCount: 1 });
    // Motifs d'exclusion : le document cité comme preuve est protégé, celui supprimé aujourd'hui est trop récent.
    expect(docs.exclusions).toEqual([
      { motif: expect.stringContaining('Cités comme preuve'), count: 1 },
      { motif: 'Dans la corbeille depuis moins de 90 jours', count: 1 },
    ]);
    expect(new Date(docs.oldest).getTime()).toBeLessThan(Date.now() - 150 * 86400000);
    // Aucune suppression : les trois documents sont toujours en base.
    const restants = await t.svc.db.q<{ n: number }>('SELECT count(*)::int n FROM documents WHERE id = ANY($1)', [
      [ancien.id, cite.id, recent.id],
    ]);
    expect(restants.rows[0]!.n).toBe(3);
    await regler({ documentsCorbeilleJours: 365 });
    const large = (await admin.get('/api/settings/conservation/apercu')).json();
    expect(large.categories[0]).toMatchObject({ days: 365, candidates: 0 });
  });

  it('mesure les rappels lus et les éléments archivés selon leur ancienneté', async () => {
    const o = await admin.post(`/api/grc/${SMSI}/objects`, {
      kind: 'action',
      name: 'Action à archiver',
      data: {
        description: '',
        status: 'todo',
        ownerId: null,
        startAt: null,
        dueAt: null,
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
    expect(o.statusCode, o.body).toBe(200);
    expect(
      (
        await admin.req('DELETE', `/api/grc/${SMSI}/objects/${o.json().id}`, {
          headers: { 'if-match': `"${o.json().version}"` },
        })
      ).statusCode,
    ).toBeLessThan(300);
    await t.svc.db.q(`UPDATE grc_objects SET updated_at = now() - interval '400 days' WHERE id = $1`, [o.json().id]);
    await regler({ elementsArchivesJours: 365, rappelsLusJours: 30 });
    const c = (await admin.get('/api/settings/conservation/apercu')).json().categories;
    expect(c.find((x: { id: string }) => x.id === 'elements_archives')).toMatchObject({ days: 365, candidates: 1 });
    expect(c.find((x: { id: string }) => x.id === 'rappels_lus')).toMatchObject({ days: 30, candidates: 0 });
    expect(c.find((x: { id: string }) => x.id === 'elements_archives').exclusions).toEqual([
      { motif: 'Archivés depuis moins de 365 jours', count: 0 },
    ]);
    expect(c.find((x: { id: string }) => x.id === 'rappels_lus').exclusions).toEqual([
      { motif: expect.stringContaining('Pas encore lus'), count: expect.any(Number) },
      { motif: 'Lus depuis moins de 30 jours', count: expect.any(Number) },
    ]);
    const reste = await t.svc.db.q<{ n: number }>('SELECT count(*)::int n FROM grc_objects WHERE id=$1', [o.json().id]);
    expect(reste.rows[0]!.n).toBe(1);
  });
});
