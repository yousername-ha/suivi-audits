/* Reprise du plan d'investissement de l'outil de suivi (clé `invest`) : création, modification, suppression et année de
   référence natives sous verrou, champs inconnus conservés. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent;
const etat = async () => (await admin.get('/api/legacy/state')).json();

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'inv_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'inv_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'inv_writer', 'rw'));
  const cur = await admin.get('/api/legacy/state');
  const s = cur.json();
  s.suppliers = [{ id: 'SUP-001', name: 'Fournisseur fictif' }];
  s.invest = {
    baseYear: 2026,
    inconnuRacine: 'garder',
    lines: [
      {
        id: 'INV-001',
        company: 'Société fictive',
        type: 'EDR',
        n0: 1000,
        n1: 500,
        status: 'Validé',
        inconnu: { x: 1 },
      },
    ],
  };
  expect((await admin.put('/api/legacy/state', s, { 'if-match': cur.headers.etag as string })).statusCode).toBe(204);
});
afterAll(() => t.close());

describe('investissements', () => {
  it('liste les lignes avec les valeurs par défaut et les fournisseurs', async () => {
    const r = await reader.get('/api/investissements');
    expect(r.statusCode).toBe(200);
    expect(r.json().anneeN).toBe(2026);
    expect(r.json().lignes[0]).toMatchObject({ id: 'INV-001', n2: 0, nature: 'Abonnement', notice: 60, supplier: '' });
    expect(r.json().fournisseurs).toEqual([{ id: 'SUP-001', name: 'Fournisseur fictif' }]);
    const sans = await login(t, await makeUser(t, 'inv_sans', null));
    expect((await sans.get('/api/investissements')).statusCode).toBe(403);
  });
  it('ajoute une ligne avec les valeurs de l’outil historique et un numéro libre', async () => {
    expect((await reader.post('/api/investissements/lignes')).statusCode).toBe(403);
    const r = await writer.post('/api/investissements/lignes');
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ id: 'INV-002', status: 'À qualifier', nature: 'Abonnement', notice: 60 });
  });
  it('modifie les champs fournis, conserve les autres, les champs inconnus et l’état voisin', async () => {
    const r = await writer.patch('/api/investissements/lignes/INV-001', {
      n2: 250.5,
      status: 'En place',
      renewal: '2027-01-31',
      supplier: 'SUP-001',
    });
    expect(r.statusCode, r.body).toBe(200);
    const s = await etat();
    expect(s.invest.inconnuRacine).toBe('garder');
    expect(s.invest.lines[0]).toMatchObject({
      company: 'Société fictive',
      n0: 1000,
      n2: 250.5,
      status: 'En place',
      renewal: '2027-01-31',
      supplier: 'SUP-001',
      inconnu: { x: 1 },
    });
  });
  it('refuse un statut inconnu, un fournisseur hors registre, une date mal formée et une ligne absente', async () => {
    expect((await writer.patch('/api/investissements/lignes/INV-001', { status: 'Autre' })).statusCode).toBe(422);
    expect((await writer.patch('/api/investissements/lignes/INV-001', { supplier: 'X' })).statusCode).toBe(422);
    expect((await writer.patch('/api/investissements/lignes/INV-001', { renewal: '31/01/2027' })).statusCode).toBe(422);
    expect((await writer.patch('/api/investissements/lignes/INV-099', { company: 'x' })).statusCode).toBe(404);
    expect((await reader.patch('/api/investissements/lignes/INV-001', { company: 'x' })).statusCode).toBe(403);
  });
  it('change l’année de référence et supprime une ligne', async () => {
    expect((await writer.put('/api/investissements/annee', { baseYear: 2027 })).statusCode).toBe(200);
    expect((await writer.put('/api/investissements/annee', { baseYear: 1 })).statusCode).toBe(422);
    expect((await writer.del('/api/investissements/lignes/INV-002')).statusCode).toBe(200);
    expect((await writer.del('/api/investissements/lignes/INV-002')).statusCode).toBe(404);
    const s = await etat();
    expect(s.invest.baseYear).toBe(2027);
    expect(s.invest.lines.map((l: { id: string }) => l.id)).toEqual(['INV-001']);
  });
  it('journalise les modifications', async () => {
    const rows = await t.svc.db.q<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'invest.%'");
    expect(new Set(rows.rows.map((x) => x.action))).toEqual(
      new Set(['invest.created', 'invest.updated', 'invest.deleted', 'invest.year']),
    );
  });
});
