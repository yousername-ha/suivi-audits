/* Reprise des applications à intégrer au périmètre (clé `appGaps`) : liste de contrôle, états, plan d'action, questionnaire
   guidé, lecture et écriture natives sous verrou, sans copie. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent;
const etat = async () => (await admin.get('/api/legacy/state')).json();
const poser = async (m: (s: Record<string, unknown>) => void) => {
  const cur = await admin.get('/api/legacy/state');
  const s = cur.json();
  m(s);
  expect((await admin.put('/api/legacy/state', s, { 'if-match': cur.headers.etag as string })).statusCode).toBe(204);
};
const item = (id: string, ref: string, num: string) => ({
  id,
  ref,
  num,
  title: `Exigence fictive ${id}`,
  group: 'G',
  depth: 0,
  afnor: {},
  interne: {},
});

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'gap_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'gap_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'gap_writer', 'rw'));
  await poser((s) => {
    s.items = [
      item('ISO-4.3', 'ISO', '4.3'),
      item('A-5.9', 'A', '5.9'),
      item('A-5.12', 'A', '5.12'),
      item('A-8.24', 'A', '8.24'),
      item('HDS-04', 'HDS', '04'),
    ];
    s.dda = { 'A-5.12': { app: 'non' } };
    s.findings = [];
    s.suppliers = [{ id: 'SUP01', name: 'Fournisseur fictif' }];
    s.ai = { register: [], evals: [], plan: [], policies: [] };
    s.appGaps = [];
  });
});
afterAll(() => t.close());

describe('lecture et création', () => {
  it('liste vide au départ, exigences, exclusions de la DdA et registre IA', async () => {
    const v = (await reader.get('/api/gap')).json();
    expect(v.apps).toEqual([]);
    expect(v.fournisseurs).toEqual([{ id: 'SUP01', name: 'Fournisseur fictif' }]);
    expect(v.exigences.find((e: { id: string }) => e.id === 'A-5.9')).toMatchObject({ code: 'A.5.9' });
    expect(v.exclues).toEqual(['A-5.12']);
    const sans = await login(t, await makeUser(t, 'gap_sans', null));
    expect((await sans.get('/api/gap')).statusCode).toBe(403);
  });
  it('ajoute une application avec les valeurs de l’outil historique', async () => {
    expect((await reader.post('/api/gap')).statusCode).toBe(403);
    const r = await writer.post('/api/gap');
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({
      id: 'APP01',
      name: 'Nouvelle application',
      status: 'À étudier',
      dscp: 'À qualifier',
      lines: {},
      custom: [],
    });
  });
});

describe('analyse d’écart', () => {
  it('modifie l’application ; refuse un statut inconnu et un fournisseur absent', async () => {
    const r = await writer.patch('/api/gap/APP01', {
      name: 'Application fictive',
      supplier: 'SUP01',
      dscp: 'Non',
      cloud: 'Non',
      owner: 'Pilote fictif',
      target: '2027-01-15',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await writer.patch('/api/gap/APP01', { status: 'Autre' })).statusCode).toBe(422);
    expect((await writer.patch('/api/gap/APP01', { supplier: 'SUP99' })).statusCode).toBe(422);
    expect((await writer.patch('/api/gap/APP99', { name: 'x' })).statusCode).toBe(404);
    expect((await reader.patch('/api/gap/APP01', { name: 'x' })).statusCode).toBe(403);
  });
  it('enregistre état, constat, pilote et échéance d’un point ; refuse un point absent', async () => {
    const r = await writer.patch('/api/gap/APP01/points/G03', {
      st: 'Partiel',
      comment: 'Constat fictif',
      owner: 'Pilote fictif',
      due: '2026-12-01',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().lines.G03).toMatchObject({ st: 'Partiel', comment: 'Constat fictif' });
    expect((await writer.patch('/api/gap/APP01/points/G02', { st: 'Conforme' })).statusCode).toBe(404); // point HDS masqué (DSCP = Non)
    expect((await writer.patch('/api/gap/APP01/points/G03', { st: 'Autre' })).statusCode).toBe(422);
  });
  it('ajoute puis retire un point personnalisé ; références normalisées et connues seulement', async () => {
    const r = await writer.post('/api/gap/APP01/points', {
      t: 'Point ajouté fictif',
      refs: 'A.8.24 ; EXI 4 ; A.9.9 ; n’importe quoi',
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().custom).toMatchObject([{ id: 'C1', t: 'Point ajouté fictif', refs: ['A-8.24', 'HDS-04'] }]);
    expect((await writer.del('/api/gap/APP01/points/G03')).statusCode).toBe(404); // le socle ne se retire pas
    expect((await writer.patch('/api/gap/APP01/points/C1', { st: 'Non conforme' })).statusCode).toBe(200);
    expect((await writer.del('/api/gap/APP01/points/C1')).statusCode).toBe(200);
    expect((await writer.get('/api/gap')).json().apps[0].custom).toEqual([]);
  });
  it('crée l’action du registre des écarts pour un point partiel, une seule fois', async () => {
    expect((await writer.post('/api/gap/APP01/points/G05/action')).statusCode).toBe(409); // « À évaluer »
    const r = await writer.post('/api/gap/APP01/points/G03/action');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().ecart).toBe('GAP-01');
    const f = (await etat()).findings.find((x: { id: string }) => x.id === 'GAP-01');
    expect(f).toMatchObject({
      source: 'GAP',
      type: 'Remarque',
      status: 'Ouvert',
      owner: 'Pilote fictif',
      due: '2026-12-01',
      items: ['ISO-6.1.2'],
    });
    expect((await writer.post('/api/gap/APP01/points/G03/action')).statusCode).toBe(409);
  });
  it('supprime l’application sans toucher aux autres clés', async () => {
    const r = await writer.post('/api/gap');
    const id = r.json().id;
    expect(id).toBe('APP02');
    expect((await writer.del(`/api/gap/${id}`)).statusCode).toBe(200);
    expect((await writer.del(`/api/gap/${id}`)).statusCode).toBe(404);
    expect((await etat()).items).toHaveLength(5);
  });
});

describe('questionnaire guidé', () => {
  it('crée l’application pré-évaluée, le plan d’action, le fournisseur et l’usage du registre IA', async () => {
    const corps = {
      name: 'Service fictif guidé',
      supplierNew: 'Nouveau fournisseur fictif',
      owner: 'Pilote fictif',
      target: '2027-03-01',
      desc: 'Description fictive',
      answers: {
        type: 'SaaS (hébergé par l’éditeur)',
        dscp: 'Oui',
        dcp: 'Oui',
        loc: 'Hors Union européenne',
        certs: ['ISO 27001'],
        mfa: 'Disponible, non activée',
        sso: 'Disponible et activée',
        ia: 'Oui',
        crit: 'Critique : arrêt de moins de 4 h tolérable',
      },
    };
    expect((await reader.post('/api/gap/guide', corps)).statusCode).toBe(403);
    expect((await writer.post('/api/gap/guide', { ...corps, name: '' })).statusCode).toBe(422);
    const r = await writer.post('/api/gap/guide', corps);
    expect(r.statusCode, r.body).toBe(201);
    const j = r.json();
    expect(j.app).toMatchObject({ id: 'APP02', status: 'En cours', dscp: 'Oui', cloud: 'Oui', supplier: 'SUP02' });
    expect(j.app.lines.G10.st).toBe('Partiel');
    expect(j.app.lines.G25.st).toBe('Non conforme');
    expect(j).toMatchObject({ plan: 'GAP-02', fournisseur: 'SUP02', ia: 'EXT-IA-01' });
    const s = await etat();
    const plan = s.findings.find((x: { id: string }) => x.id === 'GAP-02');
    expect(plan.tasks.length).toBeGreaterThan(10);
    expect(plan.tasks.every((k: { done: boolean }) => k.done === false)).toBe(true);
    expect(s.suppliers.find((x: { id: string }) => x.id === 'SUP02')).toMatchObject({
      name: 'Nouveau fournisseur fictif',
      saas: true,
      critical: 'Oui',
      hds: 'Oui',
      controls: [],
    });
    expect(s.ai.register[0]).toMatchObject({
      id: 'EXT-IA-01',
      aiPresence: 'Oui',
      usecase: 'Service fictif guidé',
      authz: 'En qualification',
    });
    expect(s.appGaps.find((x: { id: string }) => x.id === 'APP02').profile.at).toBeTruthy();
  });
  it('un changement d’état met à jour la tâche du plan d’action', async () => {
    const avant = (await etat()).findings.find((x: { id: string }) => x.id === 'GAP-02');
    const tache = avant.tasks.find((k: { t: string }) => k.t.startsWith('Sauvegarder les données'));
    expect(tache.done).toBe(false);
    expect((await writer.patch('/api/gap/APP02/points/G13', { st: 'Conforme' })).statusCode).toBe(200);
    const apres = (await etat()).findings.find((x: { id: string }) => x.id === 'GAP-02');
    expect(apres.tasks.find((k: { t: string }) => k.t.startsWith('Sauvegarder les données')).done).toBe(true);
    expect((await writer.patch('/api/gap/APP02/points/G13', { st: 'Partiel' })).statusCode).toBe(200);
    expect(
      (await etat()).findings
        .find((x: { id: string }) => x.id === 'GAP-02')
        .tasks.find((k: { t: string }) => k.t.startsWith('Sauvegarder les données')).done,
    ).toBe(false);
  });
  it('sans registre IA : il est initialisé vide puis l’usage y est inscrit', async () => {
    await poser((s) => {
      delete s.ai;
    });
    const r = await writer.post('/api/gap/guide', {
      name: 'Service fictif sans registre',
      answers: { ia: 'Oui' },
      mkPlan: false,
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ plan: null, ia: 'EXT-IA-01' });
    const ai = (await etat()).ai;
    expect(ai).toMatchObject({ evals: [], plan: [], policies: [] });
    expect(ai.register).toHaveLength(1);
  });
  it('journalise les modifications', async () => {
    const rows = await t.svc.db.q<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'gap.%'");
    const a = new Set(rows.rows.map((x) => x.action));
    for (const x of [
      'gap.created',
      'gap.updated',
      'gap.line-updated',
      'gap.point-created',
      'gap.point-deleted',
      'gap.finding-created',
      'gap.deleted',
      'gap.guided',
    ])
      expect(a.has(x), x).toBe(true);
  });
});
