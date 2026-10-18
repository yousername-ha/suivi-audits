/* Reprise de la gestion CRRC de l'outil de suivi (clé `crrc`) : contrats, ressources, sauvegardes, restaurations,
   alertes et offres natifs sous verrou, champs inconnus conservés. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent;
const etat = async () => (await admin.get('/api/legacy/state')).json();
let est = '',
  res = '';

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cr_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'cr_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'cr_writer', 'rw'));
  const cur = await admin.get('/api/legacy/state');
  const s = cur.json();
  s.crrc = {
    inconnuRacine: 'garder',
    establishments: [
      { id: 'CRRC-001-AAA', name: 'Établissement fictif', finess: '140000001', status: 'Actif', inconnu: 1 },
    ],
    resources: [{ id: 'RES-1', est: 'CRRC-001-AAA', name: 'NAS fictif', tech: 's3' }],
    runs: [{ id: 'RUN-1', res: 'RES-1', date: '2026-10-01T02:00', type: 'Complète', status: 'Réussie', volumeGb: 10 }],
  };
  await seedState(t, s);
});
afterAll(() => t.close());

describe('gestion CRRC', () => {
  it('lit l’état normalisé avec l’offre de sauvegarde, selon le droit de lecture', async () => {
    const r = await reader.get('/api/crrc');
    expect(r.statusCode).toBe(200);
    const e = r.json().etat;
    expect(e.offers.map((o: { id: string }) => o.id)).toEqual(['backup']);
    expect(e.establishments[0]).toMatchObject({ id: 'CRRC-001-AAA', retentionDays: 0, offers: ['backup'] });
    expect(e.runs[0]).toMatchObject({ volumeGb: 10 });
    const sans = await login(t, await makeUser(t, 'cr_sans', null));
    expect((await sans.get('/api/crrc')).statusCode).toBe(403);
  });
  it('crée un contrat avec les valeurs de l’outil historique et matérialise l’offre de sauvegarde', async () => {
    expect((await reader.post('/api/crrc/etablissements')).statusCode).toBe(403);
    const r = await writer.post('/api/crrc/etablissements');
    expect(r.statusCode, r.body).toBe(201);
    est = r.json().id;
    expect(est).toMatch(/^CRRC-002-[0-9A-Z]{3}$/);
    const s = await etat();
    expect(s.crrc.inconnuRacine).toBe('garder');
    expect(s.crrc.offers.map((o: { id: string }) => o.id)).toEqual(['backup']);
    expect(s.crrc.establishments[0]).toMatchObject({
      id: est,
      name: 'Nouvel établissement',
      status: 'À compléter',
      retentionDays: 90,
      scopes: { s3: true },
      offers: ['backup'],
    });
  });
  it('modifie un contrat : champs fournis, périmètres fusionnés, champs inconnus conservés', async () => {
    const r = await writer.patch('/api/crrc/etablissements/CRRC-001-AAA', {
      status: 'À renouveler',
      capacityGb: 512,
      scopes: { m365: true },
      renewal: '2027-03-01',
    });
    expect(r.statusCode, r.body).toBe(200);
    const e = (await etat()).crrc.establishments.find((x: { id: string }) => x.id === 'CRRC-001-AAA');
    expect(e).toMatchObject({ name: 'Établissement fictif', status: 'À renouveler', capacityGb: 512, inconnu: 1 });
    expect(e.scopes).toEqual({ m365: true });
    expect((await writer.patch('/api/crrc/etablissements/CRRC-001-AAA', { scopes: { s3: true } })).statusCode).toBe(
      200,
    );
    expect((await etat()).crrc.establishments.find((x: { id: string }) => x.id === 'CRRC-001-AAA').scopes).toEqual({
      m365: true,
      s3: true,
    });
    expect((await writer.patch('/api/crrc/etablissements/CRRC-001-AAA', { status: 'Autre' })).statusCode).toBe(422);
    expect((await writer.patch('/api/crrc/etablissements/CRRC-999', { name: 'x' })).statusCode).toBe(404);
  });
  it('gère ressources, sauvegardes, restaurations et alertes', async () => {
    const r = await writer.post('/api/crrc/ressources', { est, tech: 'windows' });
    expect(r.statusCode, r.body).toBe(201);
    res = r.json().id;
    expect((await writer.post('/api/crrc/ressources', { est: 'inconnu' })).statusCode).toBe(404);
    expect(
      (await writer.patch(`/api/crrc/ressources/${res}`, { name: 'Serveur fictif', freq: 'Mensuelle' })).statusCode,
    ).toBe(200);
    const run = await writer.post(`/api/crrc/ressources/${res}/sauvegardes`, {
      date: '2026-10-12T02:00',
      type: 'Incrémentale',
      status: 'Alerte',
      volumeGb: 1.5,
      durationMin: 12,
    });
    expect(run.statusCode, run.body).toBe(201);
    expect(
      (
        await writer.post(`/api/crrc/ressources/${res}/sauvegardes`, {
          date: '12/10/2026',
          type: 'Complète',
          status: 'Réussie',
          volumeGb: 1,
          durationMin: 1,
        })
      ).statusCode,
    ).toBe(422);
    const rst = await writer.post('/api/crrc/restaurations', {
      res,
      point: '2026-10-12T02:00',
      scope: '',
      type: 'Test de restauration',
      owner: 'Pilote',
      dest: 'Emplacement d’origine',
      path: '',
      conflict: 'Ne pas écraser',
    });
    expect(rst.statusCode, rst.body).toBe(201);
    expect(
      (await writer.patch(`/api/crrc/restaurations/${rst.json().id}`, { status: 'Réussie', duration: '10 min' }))
        .statusCode,
    ).toBe(200);
    const al = await writer.post('/api/crrc/alertes', { severity: 'Haute', res, message: 'Sauvegarde en alerte' });
    expect(al.statusCode, al.body).toBe(201);
    expect((await writer.patch(`/api/crrc/alertes/${al.json().id}`, { status: 'Résolue' })).statusCode).toBe(200);
    const c = (await etat()).crrc;
    expect(c.restores[0]).toMatchObject({ est, res, scope: 'Intégralité', status: 'Réussie', duration: '10 min' });
    expect(c.alerts[0]).toMatchObject({ est, res, status: 'Résolue', severity: 'Haute' });
    expect(c.alerts[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(c.runs.filter((x: { res: string }) => x.res === res)).toHaveLength(1);
  });
  it('supprime une sauvegarde, une ressource (avec ses sauvegardes) et un contrat (ressources conservées)', async () => {
    const c0 = (await etat()).crrc;
    const runId = c0.runs.find((x: { res: string }) => x.res === res).id;
    expect((await writer.del(`/api/crrc/sauvegardes/${runId}`)).statusCode).toBe(200);
    await writer.post(`/api/crrc/ressources/${res}/sauvegardes`, {
      date: '2026-10-13T02:00',
      type: 'Complète',
      status: 'Réussie',
      volumeGb: 1,
      durationMin: 1,
    });
    expect((await writer.del(`/api/crrc/ressources/${res}`)).statusCode).toBe(200);
    expect((await etat()).crrc.runs.map((x: { res: string }) => x.res)).toEqual(['RES-1']);
    expect((await writer.del('/api/crrc/etablissements/CRRC-001-AAA')).statusCode).toBe(200);
    expect((await etat()).crrc.resources.map((x: { id: string }) => x.id)).toEqual(['RES-1']);
  });
  it('gère les offres : la sauvegarde ne se supprime pas', async () => {
    const o = await writer.post('/api/crrc/offres');
    expect(o.statusCode, o.body).toBe(201);
    expect(
      (await writer.patch(`/api/crrc/offres/${o.json().id}`, { name: 'Offre fictive', status: 'Disponible' }))
        .statusCode,
    ).toBe(200);
    expect((await writer.patch('/api/crrc/offres/backup', { partner: 'Opérateur fictif' })).statusCode).toBe(200);
    expect((await writer.del('/api/crrc/offres/backup')).statusCode).toBe(422);
    expect((await writer.del(`/api/crrc/offres/${o.json().id}`)).statusCode).toBe(200);
    const backup = (await etat()).crrc.offers.find((x: { id: string }) => x.id === 'backup');
    expect(backup.partner).toBe('Opérateur fictif');
    expect(backup.perimeters).toHaveLength(5);
  });
  it('journalise les modifications', async () => {
    const rows = await t.svc.db.q<{ action: string }>(
      "SELECT DISTINCT action FROM audit_log WHERE action LIKE 'crrc.%'",
    );
    const a = new Set(rows.rows.map((x) => x.action));
    for (const n of [
      'establishment.created',
      'establishment.updated',
      'resource.created',
      'run.created',
      'restore.created',
      'alert.updated',
      'offer.deleted',
    ])
      expect(a.has(`crrc.${n}`), n).toBe(true);
  });
});
