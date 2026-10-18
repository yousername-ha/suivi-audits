/* Reprise du plan d'investissement de l'outil de suivi (clé `invest`) : création, modification, suppression et année de
   référence natives sous verrou, champs inconnus conservés. Données fictives. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ecrireInvest } from '../src/historique/tables/invest.js';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent;
const etat = async () => (await admin.get('/api/suivi/etat')).json();

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'inv_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'inv_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'inv_writer', 'rw'));
  const cur = await admin.get('/api/suivi/etat');
  const s = cur.json();
  s.suppliers = [{ id: 'SUP-001', name: 'Fournisseur fictif' }];
  await seedState(t, s);
  // Le module est repris dans des tables (ADR 0040) : l'amorçage passe par la correspondance, pas par /legacy.
  await t.svc.db.tx((c) =>
    ecrireInvest(c, {
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
    }),
  );
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

const amorcer = () =>
  t.svc.db.tx((c) =>
    ecrireInvest(c, {
      baseYear: 2026,
      inconnuRacine: 'garder',
      lines: [{ id: 'INV-001', company: 'Société fictive', n0: 1000, status: 'Validé', inconnu: { x: 1 } }],
    }),
  );

describe('investissements en tables (ADR 0040)', () => {
  beforeEach(amorcer);
  it('range les lignes dans des tables et plus dans app_state, champs inconnus compris', async () => {
    const ligne = await t.svc.db.one<{ id: string; company: string; extra: { inconnu?: unknown } }>(
      "SELECT id, company, extra FROM invest_lines WHERE id='INV-001'",
    );
    expect(ligne).toMatchObject({ id: 'INV-001', company: 'Société fictive', extra: { inconnu: { x: 1 } } });
    const creee = await writer.post('/api/investissements/lignes');
    expect(creee.statusCode, creee.body).toBe(201);
    const n = await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM invest_lines');
    expect(n!.n).toBeGreaterThanOrEqual(2);
    const brut = await t.svc.db.one<{ present: boolean }>(
      "SELECT data ? 'invest' AS present FROM app_state WHERE id=1",
    );
    expect(brut!.present).toBe(false);
  });
  it('l’état du suivi recompose la forme historique depuis les tables', async () => {
    const cur = await admin.get('/api/suivi/etat');
    const s = cur.json();
    expect(s.invest.baseYear).toBe(2026);
    expect(s.invest.inconnuRacine).toBe('garder');
    expect(s.invest.lines.find((l: { id: string }) => l.id === 'INV-001').inconnu).toEqual({ x: 1 });
  });
  it('conserve une entrée non objet et l’ordre des lignes au aller-retour', async () => {
    await t.svc.db.tx((c) =>
      ecrireInvest(c, { baseYear: 2027, lines: [{ id: 'B' }, 'texte brut', { id: 'A', n0: '12' }, 7] }),
    );
    const etat = (await admin.get('/api/suivi/etat')).json();
    expect(etat.invest.baseYear).toBe(2027);
    expect(etat.invest.lines[1]).toBe('texte brut');
    expect(etat.invest.lines[3]).toBe(7);
    expect(etat.invest.lines.map((l: unknown) => (typeof l === 'object' ? (l as { id: string }).id : l))).toEqual([
      'B',
      'texte brut',
      'A',
      7,
    ]);
    expect(etat.invest.lines[2].n0).toBe(12);
    // Un module vidé disparaît de l'état.
    await t.svc.db.tx((c) => ecrireInvest(c, undefined));
    expect((await admin.get('/api/suivi/etat')).json().invest).toBeUndefined();
  });
});
