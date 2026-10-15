/* Reprise des revues des accès de l'outil de suivi (clé `accessReviews`) : création et modification natives sous
   verrou, champs inconnus conservés, rattachement au registre des fournisseurs. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent;
const etat = async () => (await admin.get('/api/legacy/state')).json();

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ra_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'ra_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'ra_writer', 'rw'));
  const cur = await admin.get('/api/legacy/state');
  const s = cur.json();
  s.suppliers = [
    { id: 'SUP-001', name: 'Fournisseur fictif B' },
    { id: 'SUP-002', name: 'Fournisseur fictif A' },
  ];
  s.accessReviews = [
    {
      id: 'CONTROL-1',
      app: 'Application fictive',
      month: '2025-09',
      freq: 12,
      supplier: '',
      inconnu: { garder: true },
    },
  ];
  expect((await admin.put('/api/legacy/state', s, { 'if-match': cur.headers.etag as string })).statusCode).toBe(204);
});
afterAll(() => t.close());

describe('revues des accès', () => {
  it('liste les revues et les fournisseurs du registre, triés', async () => {
    const r = await reader.get('/api/revues-acces');
    expect(r.statusCode).toBe(200);
    expect(r.json().revues).toEqual([
      {
        id: 'CONTROL-1',
        app: 'Application fictive',
        supplier: '',
        month: '2025-09',
        freq: 12,
        source: '',
        comment: '',
      },
    ]);
    expect(r.json().fournisseurs).toEqual(['Fournisseur fictif A', 'Fournisseur fictif B']);
    const sans = await login(t, await makeUser(t, 'ra_sans', null));
    expect((await sans.get('/api/revues-acces')).statusCode).toBe(403);
  });
  it('ajoute une revue avec les valeurs de l’outil historique et un numéro libre', async () => {
    expect((await reader.post('/api/revues-acces')).statusCode).toBe(403);
    const r = await writer.post('/api/revues-acces');
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ id: 'CONTROL-2', app: 'Nouvelle application', month: '', freq: 12 });
    const brut = (await etat()).accessReviews.find((x: { id: string }) => x.id === 'CONTROL-2');
    expect(typeof brut.createdAt).toBe('string');
  });
  it('modifie les champs fournis, conserve les autres et les champs inconnus', async () => {
    const r = await writer.patch('/api/revues-acces/CONTROL-1', {
      supplier: 'Fournisseur fictif A',
      month: '2026-03',
      comment: 'Commentaire fictif',
    });
    expect(r.statusCode, r.body).toBe(200);
    const brut = (await etat()).accessReviews[0];
    expect(brut).toMatchObject({
      supplier: 'Fournisseur fictif A',
      month: '2026-03',
      comment: 'Commentaire fictif',
      app: 'Application fictive',
      freq: 12,
      inconnu: { garder: true },
    });
  });
  it('refuse un fournisseur hors registre, un mois mal formé et une revue absente', async () => {
    expect((await writer.patch('/api/revues-acces/CONTROL-1', { supplier: 'Inconnu' })).statusCode).toBe(422);
    expect((await writer.patch('/api/revues-acces/CONTROL-1', { month: '2026-13' })).statusCode).toBe(422);
    expect((await writer.patch('/api/revues-acces/CONTROL-9', { app: 'x' })).statusCode).toBe(404);
    expect((await reader.patch('/api/revues-acces/CONTROL-1', { app: 'x' })).statusCode).toBe(403);
  });
  it('journalise les modifications', async () => {
    const rows = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action LIKE 'access-review.%'",
    );
    expect(new Set(rows.rows.map((x) => x.action))).toEqual(
      new Set(['access-review.created', 'access-review.updated']),
    );
  });
});
