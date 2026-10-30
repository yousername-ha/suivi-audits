/* Reprise du registre des incidents, de la cellule de crise et de l'alerte CRRC → incident de l'outil de suivi : écritures
   natives sous verrou, droits croisés (écarts, pilotage, incidents), champs inconnus conservés. Données fictives. */
import { schema15Problems } from '@suivi/shared/legacy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent, sansEcarts: Agent;
const etat = async () => (await admin.get('/api/suivi/etat')).json();
let incident = '';

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'inc_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'inc_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'inc_writer', 'rw'));
  sansEcarts = await login(t, await makeUser(t, 'inc_sans_ecarts', null, { modules: ['incidents', 'crrc'] }));
  const cur = await admin.get('/api/suivi/etat');
  const s = cur.json();
  s.entityCategory = 'essentielle';
  s.items = [
    { id: 'A-5.27', ref: 'A', num: '5.27', title: 'Exigence fictive', group: 'G', depth: 0, afnor: {}, interne: {} },
  ];
  s.suppliers = [
    { id: 'SUP-1', name: 'Fournisseur critique fictif', critical: 'Oui' },
    { id: 'SUP-2', name: 'Fournisseur ordinaire fictif', critical: 'Non' },
  ];
  s.findings = [];
  s.plans = [{ id: 'EXO-1', type: 'exo', title: 'Exercice fictif', status: 'Planifié', inconnu: 'garder' }];
  s.incidents = [
    { id: 'INC-2026-001', title: 'Existant fictif', kind: 'Incident', status: 'Nouveau', inconnu: { x: 1 } },
  ];
  s.crisis = {
    scenarios: [{ id: 'SCN-1', title: 'Scénario fictif', items: [{ phase: 'Alerte', t: 'Alerter', owner: '' }] }],
  };
  s.crrc = {
    establishments: [{ id: 'E1', name: 'Établissement fictif', status: 'Actif' }],
    resources: [{ id: 'R1', est: 'E1', name: 'NAS fictif', tech: 's3' }],
    alerts: [
      {
        id: 'ALR-1',
        date: '2026-10-12T03:00',
        severity: 'Haute',
        est: 'E1',
        res: 'R1',
        message: 'Échec fictif',
        status: 'Ouverte',
      },
    ],
  };
  await seedState(t, s);
});
afterAll(() => t.close());

describe('registre des incidents', () => {
  it('liste les incidents et la catégorie d’entité, selon le droit de lecture', async () => {
    const r = await reader.get('/api/incidents');
    expect(r.statusCode).toBe(200);
    expect(r.json().categorieEntite).toBe('essentielle');
    expect(r.json().incidents[0]).toMatchObject({ id: 'INC-2026-001', cat: 'Autre', answers: {} });
    expect((await (await login(t, await makeUser(t, 'inc_sans', null))).get('/api/incidents')).statusCode).toBe(403);
  });
  it('qualifie un signalement côté serveur d’après les réponses', async () => {
    expect((await reader.post('/api/incidents', { title: 'x' })).statusCode).toBe(403);
    const r = await writer.post('/api/incidents', {
      title: 'Courriel suspect',
      reporter: 'Comptabilité',
      answers: { cia: 'oui', dcp: 'oui' },
    });
    expect(r.statusCode, r.body).toBe(201);
    incident = r.json().id;
    expect(incident).toMatch(/^INC-\d{4}-00[12]$/);
    expect(r.json()).toMatchObject({
      kind: 'Incident de sécurité',
      status: 'Qualifié',
      answers: { cia: 'oui', dcp: 'oui' },
    });
    const direct = await writer.post('/api/incidents', {});
    expect(direct.json()).toMatchObject({ kind: 'Incident', status: 'Nouveau' });
    expect((await writer.post('/api/incidents', { answers: { cia: 'peut-être' } })).statusCode).toBe(422);
  });
  it('modifie un incident, renseigne la résolution et conserve les champs inconnus', async () => {
    const r = await writer.patch('/api/incidents/INC-2026-001', {
      status: 'Résolu',
      impact: 'Moyen',
      urgency: 'Faible',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const brut = (await etat()).incidents.find((x: { id: string }) => x.id === 'INC-2026-001');
    expect(brut).toMatchObject({ title: 'Existant fictif', inconnu: { x: 1 }, impact: 'Moyen' });
    expect((await writer.patch('/api/incidents/INC-2026-001', { status: 'Autre' })).statusCode).toBe(422);
    expect((await writer.patch('/api/incidents/INC-9', { title: 'x' })).statusCode).toBe(404);
  });
  it('marque une obligation comme traitée puis non traitée', async () => {
    const a = await writer.put(`/api/incidents/${incident}/obligations/1`, { traitee: true });
    expect(a.statusCode, a.body).toBe(200);
    expect(Object.keys(a.json().notified)).toEqual(['1']);
    const b = await writer.put(`/api/incidents/${incident}/obligations/1`, { traitee: false });
    expect(b.json().notified).toEqual({});
  });
  it('crée l’action du registre des écarts, avec le droit des écarts', async () => {
    expect((await sansEcarts.post(`/api/incidents/${incident}/action`)).statusCode).toBe(403);
    const r = await writer.post(`/api/incidents/${incident}/action`);
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().findingId).toBe('INC-AC-01');
    const s = await etat();
    expect(s.findings[0]).toMatchObject({ id: 'INC-AC-01', type: 'PP', status: 'Ouvert', items: ['A-5.27'] });
    expect((await writer.post(`/api/incidents/${incident}/action`)).statusCode).toBe(409);
    expect((await reader.get('/api/incidents')).json().ecarts).toEqual({ 'INC-AC-01': 'Ouvert' });
  });
  it('ouvre une fiche depuis une alerte CRRC, avec le droit des incidents', async () => {
    const r = await writer.post('/api/crrc/alertes/ALR-1/incident');
    expect(r.statusCode, r.body).toBe(201);
    const s = await etat();
    const inc = s.incidents.find((x: { id: string }) => x.id === r.json().incident);
    expect(inc).toMatchObject({
      title: 'Sauvegarde : Échec fictif (Établissement fictif)',
      desc: 'Alerte ALR-1 du 12/10/2026 03:00 sur NAS fictif.',
      kind: 'Incident',
      cat: 'Indisponibilité de service',
      status: 'Qualifié',
      reporter: 'Gestion CRRC',
    });
    expect(s.crrc.alerts[0]).toMatchObject({ incident: r.json().incident, status: 'En cours' });
    expect((await writer.post('/api/crrc/alertes/ALR-1/incident')).statusCode).toBe(409);
  });
  it('tient la chronologie du RETEX : ajout, tri, modification, retrait, droits et champs inconnus conservés', async () => {
    const url = '/api/incidents/INC-2026-001/retex';
    const ev = { ts: '2026-10-12T09:00', type: 'Analyse', titre: 'Analyse fictive', gravite: 'Élevée' };
    expect((await reader.post(url, ev)).statusCode).toBe(403);
    expect((await writer.post(url, { ...ev, titre: '' })).statusCode).toBe(422);
    expect((await writer.post(url, { ...ev, ts: '2026-02-30T09:00' })).statusCode).toBe(422);
    expect((await writer.post('/api/incidents/INC-9/retex', ev)).statusCode).toBe(404);
    const a = await writer.post(url, ev);
    expect(a.statusCode, a.body).toBe(201);
    const b = await writer.post(url, { ts: '2026-10-12T08:45', type: 'Détection', titre: 'Alerte fictive' });
    expect(b.json().timeline.map((e: { id: string }) => e.id)).toEqual(['EV-002', 'EV-001']);
    expect(b.json().timeline[0]).toMatchObject({ titre: 'Alerte fictive', description: '', gravite: '' });
    const s = await etat();
    const brut = s.incidents.find((x: { id: string }) => x.id === 'INC-2026-001');
    brut.timeline[0].inconnu = 'garder';
    await seedState(t, s);
    const m = await writer.patch(`${url}/EV-001`, { titre: 'Analyse corrigée', gravite: '' });
    expect(m.statusCode, m.body).toBe(200);
    expect(m.json().timeline[1]).toMatchObject({ id: 'EV-001', titre: 'Analyse corrigée', gravite: '' });
    const apres = (await etat()).incidents.find((x: { id: string }) => x.id === 'INC-2026-001');
    expect(apres.timeline[0]).toMatchObject({ inconnu: 'garder', type: 'Analyse' });
    expect(apres).toMatchObject({ inconnu: { x: 1 } });
    expect((await writer.patch(`${url}/EV-404`, { titre: 'x' })).statusCode).toBe(404);
    expect((await writer.patch(`${url}/EV-001`, { type: 'Inconnu' })).statusCode).toBe(422);
    expect((await reader.del(`${url}/EV-002`)).statusCode).toBe(403);
    const d = await writer.del(`${url}/EV-002`);
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json().timeline.map((e: { id: string }) => e.id)).toEqual(['EV-001']);
    expect((await writer.del(`${url}/EV-002`)).statusCode).toBe(404);
    const c = await writer.post(url, { ts: '2026-10-12T10:00', type: 'Confinement', titre: 'Isolement fictif' });
    expect(c.json().timeline.map((e: { id: string }) => e.id)).toEqual(['EV-001', 'EV-003']);
  });
  it('supprime un incident', async () => {
    expect((await admin.del(`/api/incidents/${incident}`)).statusCode).toBe(200);
    expect((await admin.del(`/api/incidents/${incident}`)).statusCode).toBe(404);
  });
});

describe('cellule de crise', () => {
  let cellule = '';
  it('lit les cellules, exercices planifiés et fournisseurs critiques', async () => {
    const r = await reader.get('/api/crise');
    expect(r.statusCode).toBe(200);
    expect(r.json().exercices).toEqual([{ id: 'EXO-1', title: 'Exercice fictif' }]);
    expect(r.json().fournisseursCritiques).toEqual(['Fournisseur critique fictif']);
  });
  it('ouvre une cellule avec sa première entrée et refuse un scénario ou exercice inconnu', async () => {
    expect((await reader.post('/api/crise/cellules', {})).statusCode).toBe(403);
    expect((await writer.post('/api/crise/cellules', { scenario: 'X' })).statusCode).toBe(404);
    expect((await writer.post('/api/crise/cellules', { plan: 'X' })).statusCode).toBe(422);
    const r = await writer.post('/api/crise/cellules', { scenario: 'SCN-1', plan: 'EXO-1' });
    expect(r.statusCode, r.body).toBe(201);
    cellule = r.json().id;
    const c = (await etat()).crisis.cells[0];
    expect(c).toMatchObject({
      title: 'Exercice de crise',
      mode: 'Exercice',
      status: 'Active',
      scenario: 'SCN-1',
      plan: 'EXO-1',
    });
    expect(c.log[0].text).toBe('Ouverture de la cellule (exercice).');
  });
  it('tient la main courante, les échéances et la check-list', async () => {
    expect(
      (
        await writer.post(`/api/crise/cellules/${cellule}/entrees`, {
          type: 'Décision',
          author: 'Pilote',
          text: 'Isoler le serveur',
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await writer.post(`/api/crise/cellules/${cellule}/entrees`, { type: 'Autre', author: '', text: 'x' }))
        .statusCode,
    ).toBe(422);
    expect(
      (await writer.post(`/api/crise/cellules/${cellule}/echeances`, { label: 'Notification CNIL (RGPD)', heures: 72 }))
        .statusCode,
    ).toBe(201);
    const ok = await writer.put(`/api/crise/cellules/${cellule}/checklist/0`, { fait: true, author: 'Pilote' });
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await writer.put(`/api/crise/cellules/${cellule}/checklist/5`, { fait: true })).statusCode).toBe(404);
    let c = (await etat()).crisis.cells[0];
    expect(c.checks['0']).toMatchObject({ done: true });
    expect(c.log.map((l: { type: string }) => l.type)).toEqual(['Information', 'Décision', 'Action']);
    expect(c.log[2].text).toBe('Check-list : Alerter — fait.');
    // Identifiants « CL- » du schéma 15 : l'import « Remplacer un module » de cet état les exige.
    expect(c.log.map((l: { id: string }) => l.id)).toEqual(['CL-001', 'CL-002', 'CL-003']);
    expect(schema15Problems(await etat())).toEqual([]);
    expect(Date.parse(c.deadlines[0].due) - Date.parse(c.start)).toBe(72 * 3600e3);
    expect((await writer.put(`/api/crise/cellules/${cellule}/checklist/0`, { fait: false })).statusCode).toBe(200);
    expect((await admin.del(`/api/crise/cellules/${cellule}/echeances/0`)).statusCode).toBe(200);
    c = (await etat()).crisis.cells[0];
    expect(c.checks).toEqual({});
    expect(c.deadlines).toEqual([]);
  });
  it('bascule en crise réelle puis clôture : l’exercice planifié lié est réalisé, droit du pilotage requis', async () => {
    const m = await writer.post(`/api/crise/cellules/${cellule}/mode`, { author: 'Pilote' });
    expect(m.json().mode).toBe('Réel');
    expect((await writer.post(`/api/crise/cellules/${cellule}/mode`, {})).json().mode).toBe('Exercice');
    const restreint = await login(t, await makeUser(t, 'inc_incidents_seul', null, { modules: ['incidents'] }));
    expect((await restreint.post(`/api/crise/cellules/${cellule}/cloture`, {})).statusCode).toBe(403);
    const r = await writer.post(`/api/crise/cellules/${cellule}/cloture`, { author: 'Pilote' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().plan).toBe('EXO-1');
    const s = await etat();
    expect(s.crisis.cells[0]).toMatchObject({ status: 'Clôturée' });
    expect(s.crisis.cells[0].end).toBeTruthy();
    expect(s.plans[0]).toMatchObject({ status: 'Réalisé', inconnu: 'garder' });
    expect(s.plans[0].done).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.plans[0].retex).toMatch(/^Main courante : \d+ entrées, durée /);
    expect(
      (await writer.post(`/api/crise/cellules/${cellule}/entrees`, { type: 'Information', author: '', text: 'x' }))
        .statusCode,
    ).toBe(409);
  });
  it('gère les contacts (dont l’import des fournisseurs critiques) et les scénarios', async () => {
    const c = await writer.post('/api/crise/contacts');
    expect(c.statusCode).toBe(201);
    expect(
      (await writer.patch('/api/crise/contacts/0', { name: 'Contact fictif', key: true, phone: '01 02 03 04 05' }))
        .statusCode,
    ).toBe(200);
    expect((await writer.patch('/api/crise/contacts/9', { name: 'x' })).statusCode).toBe(404);
    expect((await writer.post('/api/crise/contacts/fournisseurs')).json().ajoutes).toBe(1);
    expect((await writer.post('/api/crise/contacts/fournisseurs')).json().ajoutes).toBe(0);
    expect((await etat()).crisis.contacts.map((x: { org: string }) => x.org)).toEqual([
      '',
      'Fournisseur critique fictif',
    ]);
    expect((await admin.del('/api/crise/contacts/0')).statusCode).toBe(200);
    const sc = await writer.post('/api/crise/scenarios');
    const id = sc.json().id;
    expect(
      (await writer.patch(`/api/crise/scenarios/${id}`, { title: 'Panne fictive', ref: 'PRA-1' })).statusCode,
    ).toBe(200);
    expect((await writer.post(`/api/crise/scenarios/${id}/actions`)).statusCode).toBe(201);
    expect(
      (await writer.patch(`/api/crise/scenarios/${id}/actions/0`, { phase: 'Mobilisation', t: 'Réunir la cellule' }))
        .statusCode,
    ).toBe(200);
    expect((await writer.patch(`/api/crise/scenarios/${id}/actions/0`, { phase: 'Autre' })).statusCode).toBe(422);
    const s = (await etat()).crisis.scenarios.find((x: { id: string }) => x.id === id);
    expect(s).toMatchObject({
      title: 'Panne fictive',
      items: [{ phase: 'Mobilisation', t: 'Réunir la cellule', owner: '' }],
    });
    expect((await admin.del(`/api/crise/scenarios/${id}/actions/0`)).statusCode).toBe(200);
    expect((await admin.del(`/api/crise/scenarios/${id}`)).statusCode).toBe(200);
    expect((await admin.del(`/api/crise/scenarios/${id}`)).statusCode).toBe(404);
  });
  it('numérote à la prochaine écriture les entrées de main courante écrites sans identifiant', async () => {
    const s = await etat();
    const sans = (text: string) => ({ ts: '2026-10-12T08:00:00.000Z', type: 'Information', author: '', text });
    s.crisis.cells = [
      ...s.crisis.cells,
      {
        id: 'CEL-ANCIENNE',
        title: 'Cellule fictive antérieure au correctif',
        mode: 'Exercice',
        start: '2026-10-12T08:00:00.000Z',
        status: 'Active',
        log: [sans('Première'), { id: 'CL-007', ...sans('Déjà numérotée') }, sans('Troisième')],
      },
    ];
    await seedState(t, s);
    expect(schema15Problems(await etat())).not.toEqual([]);
    const r = await writer.post('/api/crise/cellules/CEL-ANCIENNE/entrees', {
      type: 'Décision',
      author: 'Pilote',
      text: 'Nouvelle',
    });
    expect(r.statusCode, r.body).toBe(201);
    const apres = await etat();
    const c = apres.crisis.cells.find((x: { id: string }) => x.id === 'CEL-ANCIENNE');
    expect(c.log.map((l: { id: string; text: string }) => [l.id, l.text])).toEqual([
      ['CL-008', 'Première'],
      ['CL-007', 'Déjà numérotée'],
      ['CL-009', 'Troisième'],
      ['CL-010', 'Nouvelle'],
    ]);
    // Les identifiants déjà attribués ne changent pas.
    expect(apres.crisis.cells[0].log.map((l: { id: string }) => l.id).slice(0, 3)).toEqual([
      'CL-001',
      'CL-002',
      'CL-003',
    ]);
    expect(schema15Problems(apres)).toEqual([]);
  });
  it('journalise les modifications', async () => {
    const rows = await t.svc.db.q<{ action: string }>(
      "SELECT DISTINCT action FROM audit_log WHERE action LIKE 'crisis.%' OR action LIKE 'incident.%'",
    );
    const a = new Set(rows.rows.map((x) => x.action));
    for (const n of [
      'incident.created',
      'incident.action-created',
      'incident.retex-added',
      'incident.retex-updated',
      'incident.retex-deleted',
      'crisis.cell-opened',
      'crisis.cell-closed',
      'crisis.checklist',
      'crisis.contacts-imported',
    ])
      expect(a.has(n), n).toBe(true);
  });
});
