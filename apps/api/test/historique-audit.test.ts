/* Reprise de la gestion de l'audit de l'outil de suivi : couverture du cycle, préparation, cycle, organisation de
   l'audit (jours, créneaux, personnes), lecture et écriture natives sous verrou, sans copie. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent, seulAudit: Agent;
const etat = async () => (await admin.get('/api/legacy/state')).json();
const vue = async (a: Agent = admin) => (await a.get('/api/audit-suivi')).json();
const item = (id: string, ref: string, num: string, extra = {}) => ({
  id,
  ref,
  num,
  title: `Exigence fictive ${id}`,
  group: ref === 'A' ? 'A-5' : ref === 'HDS' ? 'HDS' : 'ISO-4',
  depth: 0,
  afnor: {},
  interne: {},
  ...extra,
});

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'aud_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'aud_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'aud_writer', 'rw'));
  seulAudit = await login(t, await makeUser(t, 'aud_seul', 'ro', { modules: ['audit'] }));
  const cur = await admin.get('/api/legacy/state');
  const s = cur.json();
  Object.assign(s, {
    years: [2025, 2026],
    yearLabels: { '2025': 'Surveillance fictive' },
    nextYear: 2026,
    groups: [{ id: 'A-5', ref: 'A', num: '5', title: 'Organisationnelles' }],
    items: [
      item('A-5.1', 'A', '5.1', { notes: 'à conserver', inconnu: { garder: true } }),
      item('A-5.2', 'A', '5.2'),
      item('ISO-4.1', 'ISO', '4.1'),
      item('HDS-01', 'HDS', '01'),
    ],
    findings: [
      {
        id: 'F01',
        source: 'AFNOR',
        year: 2025,
        type: 'NC min',
        status: 'Ouvert',
        text: 'Écart fictif',
        items: ['A-5.1'],
      },
    ],
  });
  delete s.plan;
  expect((await admin.put('/api/legacy/state', s, { 'if-match': cur.headers.etag as string })).statusCode).toBe(204);
});
afterAll(() => t.close());

describe('lecture', () => {
  it('expose exigences, écarts, cycle et organisation vide', async () => {
    const v = await vue(reader);
    expect(v.years).toEqual([2025, 2026]);
    expect(v.nextYear).toBe(2026);
    expect(v.yearLabels).toEqual({ '2025': 'Surveillance fictive' });
    expect(v.items.map((i: { id: string }) => i.id)).toEqual(['A-5.1', 'A-5.2', 'ISO-4.1', 'HDS-01']);
    expect(v.findings[0]).toMatchObject({ id: 'F01', type: 'NC min', items: ['A-5.1'] });
    expect(v.plan).toMatchObject({ status: 'Projet', days: [], slots: [], people: [] });
  });
  it('ne montre l’organisation qu’avec le droit du plan d’audit', async () => {
    expect((await vue(seulAudit)).plan).toBeNull();
    const sans = await login(t, await makeUser(t, 'aud_sans', null));
    expect((await sans.get('/api/audit-suivi')).statusCode).toBe(403);
  });
});

describe('couverture, préparation et cycle', () => {
  it('fait passer une exigence de vide à prévue puis auditée, sans toucher aux champs inconnus', async () => {
    const corps = (valeur: string, id = 'A-5.1', year = 2026) => ({ id, source: 'afnor', year, valeur });
    expect((await reader.post('/api/audit-suivi/couverture', corps('P'))).statusCode).toBe(403);
    expect((await writer.post('/api/audit-suivi/couverture', corps('P'))).statusCode).toBe(200);
    expect((await vue()).items[0].afnor).toEqual({ '2026': 'P' });
    expect((await writer.post('/api/audit-suivi/couverture', corps('X'))).statusCode).toBe(200);
    expect((await vue()).items[0].afnor).toEqual({ '2026': 'X' });
    await writer.post('/api/audit-suivi/couverture', { ...corps('X'), source: 'interne' });
    expect((await vue()).items[0].interne).toEqual({ '2026': 'X' });
    expect((await writer.post('/api/audit-suivi/couverture', corps(''))).statusCode).toBe(200);
    expect((await vue()).items[0].afnor).toEqual({});
    const brut = (await etat()).items[0];
    expect(brut).toMatchObject({ notes: 'à conserver', inconnu: { garder: true } });
    expect((await writer.post('/api/audit-suivi/couverture', corps('P', 'A-5.1', 2031))).statusCode).toBe(422);
    expect((await writer.post('/api/audit-suivi/couverture', corps('P', 'A-9.9'))).statusCode).toBe(404);
    expect((await writer.post('/api/audit-suivi/couverture', corps('Z'))).statusCode).toBe(422);
  });
  it('enregistre l’avancement de la préparation', async () => {
    expect((await writer.post('/api/audit-suivi/preparation', { id: 'A-5.2', valeur: 'pret' })).statusCode).toBe(200);
    expect((await vue()).items[1].prep).toBe('pret');
    expect((await writer.post('/api/audit-suivi/preparation', { id: 'A-5.2', valeur: 'fait' })).statusCode).toBe(422);
  });
  it('règle le cycle : années ajoutées jamais retirées, prochain audit dans le cycle, dates et libellés', async () => {
    const r = await writer.patch('/api/audit-suivi/cycle', {
      years: [2025, 2026, 2027],
      nextYear: 2027,
      nextDate: '2027-03-15',
      internalDate: '2027-01-20',
      closeDeadline: '',
      yearLabels: { '2027': 'Renouvellement fictif' },
    });
    expect(r.statusCode, r.body).toBe(200);
    const v = await vue();
    expect(v).toMatchObject({
      years: [2025, 2026, 2027],
      nextYear: 2027,
      nextDate: '2027-03-15',
      internalDate: '2027-01-20',
    });
    expect(v.yearLabels).toEqual({ '2025': 'Surveillance fictive', '2027': 'Renouvellement fictif' });
    expect((await writer.patch('/api/audit-suivi/cycle', { years: [2026, 2027] })).statusCode).toBe(422);
    expect((await writer.patch('/api/audit-suivi/cycle', { nextYear: 2040 })).statusCode).toBe(422);
    expect((await writer.patch('/api/audit-suivi/cycle', { nextDate: '15/03/2027' })).statusCode).toBe(422);
    expect((await reader.patch('/api/audit-suivi/cycle', { nextYear: 2026 })).statusCode).toBe(403);
  });
});

describe('organisation de l’audit', () => {
  let jour1: string, jour2: string, creneau: string, personne: string;
  it('ajoute des jours : libellé « Jour n » et jour ouvré suivant', async () => {
    expect((await reader.post('/api/audit-suivi/plan/jours', {})).statusCode).toBe(403);
    const a = await writer.post('/api/audit-suivi/plan/jours', { date: '2027-03-12' });
    expect(a.statusCode, a.body).toBe(201);
    jour1 = a.json().id;
    expect(a.json()).toMatchObject({ label: 'Jour 1', date: '2027-03-12' });
    const b = await writer.post('/api/audit-suivi/plan/jours', {});
    jour2 = b.json().id;
    expect(b.json()).toMatchObject({ label: 'Jour 2', date: '2027-03-15' });
  });
  it('la date du premier jour fixe la date de l’audit si elle est absente', async () => {
    await writer.patch('/api/audit-suivi/cycle', { nextDate: '' });
    await writer.patch(`/api/audit-suivi/plan/jours/${jour1}`, { date: '2027-03-11' });
    expect((await vue()).nextDate).toBe('2027-03-11');
    expect((await writer.patch('/api/audit-suivi/plan/jours/inconnu', { label: 'x' })).statusCode).toBe(404);
  });
  it('ajoute un créneau à la suite du dernier du jour, puis le complète', async () => {
    const a = await writer.post('/api/audit-suivi/plan/creneaux', { day: jour1 });
    expect(a.statusCode, a.body).toBe(201);
    creneau = a.json().id;
    expect(a.json()).toMatchObject({ start: '09:00', end: '10:00', type: 'audit', title: 'Nouveau créneau' });
    expect((await writer.post('/api/audit-suivi/plan/creneaux', { day: jour1 })).json()).toMatchObject({
      start: '10:00',
      end: '11:00',
    });
    expect((await writer.post('/api/audit-suivi/plan/creneaux', { day: 'inconnu' })).statusCode).toBe(422);
    const p = await writer.post('/api/audit-suivi/plan/personnes', { name: 'Personne fictive', role: 'Pilote fictif' });
    expect(p.statusCode).toBe(201);
    personne = p.json().id;
    const r = await writer.patch(`/api/audit-suivi/plan/creneaux/${creneau}`, {
      title: 'Entretien fictif',
      type: 'visite',
      place: 'Salle fictive',
      requirements: ['A-5.1', 'HDS-01'],
      people: [personne],
      proofs: [{ t: 'Preuve fictive', done: true }],
      questions: ['Question fictive ?'],
    });
    expect(r.statusCode, r.body).toBe(200);
    const s = (await vue()).plan.slots.find((x: { id: string }) => x.id === creneau);
    expect(s).toMatchObject({
      title: 'Entretien fictif',
      items: ['A-5.1', 'HDS-01'],
      people: [personne],
      proofs: [{ t: 'Preuve fictive', done: true }],
    });
    expect(
      (await writer.patch(`/api/audit-suivi/plan/creneaux/${creneau}`, { requirements: ['A-9.9'] })).statusCode,
    ).toBe(422);
    expect((await writer.patch(`/api/audit-suivi/plan/creneaux/${creneau}`, { people: ['absent'] })).statusCode).toBe(
      422,
    );
    expect((await writer.patch(`/api/audit-suivi/plan/creneaux/${creneau}`, { start: '25:00' })).statusCode).toBe(422);
    expect((await writer.patch(`/api/audit-suivi/plan/creneaux/${creneau}`, { end: '08:00' })).statusCode).toBe(422);
  });
  it('un début tardif repousse la fin d’une heure ; un créneau se déplace d’un jour à l’autre', async () => {
    const r = await writer.patch(`/api/audit-suivi/plan/creneaux/${creneau}`, { start: '15:30' });
    expect(r.json()).toMatchObject({ start: '15:30', end: '16:30' });
    expect((await writer.patch(`/api/audit-suivi/plan/creneaux/${creneau}`, { day: jour2 })).json().day).toBe(jour2);
  });
  it('refuse de supprimer un jour qui porte des créneaux, renumérote les jours restants', async () => {
    expect((await writer.del(`/api/audit-suivi/plan/jours/${jour2}`)).statusCode).toBe(409);
    await writer.patch(`/api/audit-suivi/plan/creneaux/${creneau}`, { day: jour1 });
    expect((await writer.del(`/api/audit-suivi/plan/jours/${jour2}`)).statusCode).toBe(200);
    expect((await vue()).plan.days.map((d: { label: string }) => d.label)).toEqual(['Jour 1']);
  });
  it('retirer une personne la retire de tous ses créneaux', async () => {
    expect((await writer.del(`/api/audit-suivi/plan/personnes/${personne}`)).statusCode).toBe(200);
    const s = (await vue()).plan.slots.find((x: { id: string }) => x.id === creneau);
    expect(s.people).toEqual([]);
    expect((await writer.del(`/api/audit-suivi/plan/personnes/${personne}`)).statusCode).toBe(404);
  });
  it('état et note du plan, suppression d’un créneau', async () => {
    expect(
      (await writer.patch('/api/audit-suivi/plan', { status: 'Plan validé', note: 'Note fictive' })).statusCode,
    ).toBe(200);
    expect((await vue()).plan).toMatchObject({ status: 'Plan validé', note: 'Note fictive' });
    expect((await writer.patch('/api/audit-suivi/plan', { status: 'Autre' })).statusCode).toBe(422);
    expect((await writer.patch('/api/audit-suivi/plan', {})).statusCode).toBe(422);
    expect((await writer.del(`/api/audit-suivi/plan/creneaux/${creneau}`)).statusCode).toBe(200);
    expect((await writer.del(`/api/audit-suivi/plan/creneaux/${creneau}`)).statusCode).toBe(404);
  });
});

describe('journal', () => {
  it('journalise chaque modification', async () => {
    const rows = await t.svc.db.q<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'audit.%'");
    const a = new Set(rows.rows.map((r) => r.action));
    for (const x of [
      'audit.coverage.updated',
      'audit.preparation.updated',
      'audit.cycle.updated',
      'audit.plan.updated',
      'audit.plan.day-created',
      'audit.plan.slot-created',
      'audit.plan.person-created',
    ])
      expect(a.has(x), x).toBe(true);
  });
});
