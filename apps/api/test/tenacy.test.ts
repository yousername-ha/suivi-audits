/* Import Tenacy : simulation sans écriture, application exacte, mise à jour, écarts clos, actions liées, droits.
   Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { empreinteTenacy } from '../src/tenacy.js';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

const ENTETE = [
  'Id',
  'Name FR',
  'Description FR',
  'Recommandation FR',
  'Perimeter',
  'Measure',
  'Status',
  'Resolution status',
  'Deadline',
  'Manager',
  'Group',
  'Criticality',
  'Requirements',
  'Actions',
];
const ligne = (o: Record<string, string>) => ENTETE.map((h) => o[h] ?? '');
const LIGNES = [
  ENTETE,
  ligne({
    Id: '25-DHA-001',
    'Name FR': 'Revue des accès incomplète',
    'Description FR': "Description de l'écart : la revue ne couvre pas tous les outils.",
    'Recommandation FR': 'Compléter la revue :\n- Inventorier les outils\n- Planifier la revue',
    Status: 'IN_PROGRESS',
    Deadline: '31/12/2030',
    Manager: 'tenacy_pilote',
    Group: 'NCMin',
    Criticality: 'Haute',
    Requirements: 'ISO-01-22 4, DDA-NES 9.9',
  }),
  ligne({
    Id: 'INT-002',
    'Name FR': 'Sauvegarde non testée',
    Status: 'TO_BE_CONFIRMED',
    Group: 'PP',
    Manager: 'Inconnu Fictif',
  }),
  ligne({
    Id: 'INT-003',
    'Name FR': 'Politique périmée',
    'Recommandation FR': 'Mettre à jour la politique',
    Status: 'CLOSE',
    Group: 'NCMaj',
  }),
];

describe('import Tenacy', () => {
  let t: TestApp;
  let admin: Agent, lecteur: Agent;
  let P: string;
  const corps = (lignes: unknown[][] = LIGNES) => ({ perimetre: P, lignes });
  const ecarts = async () =>
    (await admin.get(`/api/grc/${P}/objects?kind=nonconformity`)).json().items as {
      id: string;
      name: string;
      data: Record<string, unknown>;
    }[];

  beforeAll(async () => {
    t = await createTestApp();
    await makeUser(t, 'tenacy_pilote', 'rw');
    admin = await login(t, await makeUser(t, 'tenacy_admin', 'admin'));
    lecteur = await login(t, await makeUser(t, 'tenacy_lecteur', 'ro'));
    P = (await admin.post('/api/grc/smsis', { name: 'Périmètre Tenacy', scope: 'x', timezone: 'Europe/Paris' })).json()
      .id;
  });
  afterAll(async () => t.close());

  it('la simulation ne modifie rien et décrit ce qui sera fait', async () => {
    const r = await admin.post('/api/admin/import/tenacy/simulate', corps());
    expect(r.statusCode).toBe(200);
    const rap = r.json();
    expect(rap.totaux).toMatchObject({ lignes: 3, crees: 3, miseAJour: 0, actionsACreer: 3 });
    expect(rap.empreinte).toBe(empreinteTenacy(corps() as never));
    expect(rap.lignes[0]).toMatchObject({
      id: '25-DHA-001',
      resultat: 'cree',
      actionsACreer: 2,
      mesures: [],
      mesuresInconnues: ['ISO-4', 'A-9.9'],
    });
    expect(rap.lignes[1].piloteRattache).toBe(false);
    expect(rap.avertissements.join(' ')).toMatch(/pilote/);
    expect(await ecarts()).toHaveLength(0);
  });

  it('refuse sans le droit d’import et des lignes différentes de celles simulées', async () => {
    expect((await lecteur.post('/api/admin/import/tenacy/simulate', corps())).statusCode).toBe(403);
    const sim = (await admin.post('/api/admin/import/tenacy/simulate', corps())).json();
    const autres = LIGNES.map((l) => l.slice());
    autres[1]![1] = 'Autre intitulé';
    const r = await admin.post('/api/admin/import/tenacy/apply', { ...corps(autres), empreinte: sim.empreinte });
    expect(r.statusCode).toBe(409);
    expect(await ecarts()).toHaveLength(0);
  });

  it('crée les écarts natifs, leurs actions liées et conserve les clos', async () => {
    const sim = (await admin.post('/api/admin/import/tenacy/simulate', corps())).json();
    const r = await admin.post('/api/admin/import/tenacy/apply', { ...corps(), empreinte: sim.empreinte });
    expect(r.statusCode, r.body).toBe(201);
    const liste = await ecarts();
    expect(liste).toHaveLength(3);
    const a = liste.find((e) => e.data.tenacy && (e.data.tenacy as { id: string }).id === '25-DHA-001')!;
    expect(a.data).toMatchObject({
      classification: 'mineure',
      findingType: 'nonconformity',
      source: 'AFNOR',
      origin: 'audit',
      status: 'progress',
      dueAt: '2030-12-31',
      priority: 'high',
    });
    expect(a.data.refs).toEqual([]);
    expect((a.data.tenacy as { mesures: string[] }).mesures).toEqual(['ISO-4', 'A-9.9']);
    expect(String(a.data.description)).toContain('Recommandation : Compléter la revue');
    const b = liste.find((e) => e.name === 'Sauvegarde non testée')!;
    expect(b.data).toMatchObject({ findingType: 'opportunity', status: 'open' });
    const c = liste.find((e) => e.name === 'Politique périmée')!;
    expect(c.data).toMatchObject({ status: 'closed', classification: 'majeure' });
    expect(String(c.data.closureNote)).toMatch(/Tenacy/);
    const actions = (await admin.get(`/api/grc/${P}/objects?kind=action`)).json().items as {
      name: string;
      data: { status: string };
    }[];
    expect(actions.map((x) => x.name).sort()).toEqual([
      'Inventorier les outils',
      'Mettre à jour la politique',
      'Planifier la revue',
    ]);
    expect(actions.find((x) => x.name === 'Mettre à jour la politique')!.data.status).toBe('done');
  });

  it('un second import identique ne change rien, une modification Tenacy met l’écart à jour', async () => {
    const sim = (await admin.post('/api/admin/import/tenacy/simulate', corps())).json();
    expect(sim.totaux).toMatchObject({ crees: 0, miseAJour: 0, inchanges: 2, closConserves: 1, actionsACreer: 0 });
    const modif = LIGNES.map((l) => l.slice());
    modif[1]![ENTETE.indexOf('Group')] = 'NCMaj';
    modif[1]![ENTETE.indexOf('Recommandation FR')] += '\n- Documenter la revue';
    modif[2]![ENTETE.indexOf('Status')] = 'CLOSED';
    const s2 = (await admin.post('/api/admin/import/tenacy/simulate', corps(modif))).json();
    expect(s2.totaux).toMatchObject({ crees: 0, miseAJour: 2, actionsACreer: 1 });
    expect(s2.lignes[0].changements).toContain('classification');
    const r = await admin.post('/api/admin/import/tenacy/apply', { ...corps(modif), empreinte: s2.empreinte });
    expect(r.statusCode).toBe(201);
    const liste = await ecarts();
    expect(liste).toHaveLength(3);
    expect(liste.find((e) => e.name === 'Revue des accès incomplète')!.data.classification).toBe('majeure');
    expect(liste.find((e) => e.name === 'Sauvegarde non testée')!.data.status).toBe('closed');
    const actions = (await admin.get(`/api/grc/${P}/objects?kind=action`)).json().items as unknown[];
    expect(actions).toHaveLength(4);
  });

  it('dans le périmètre commun, les mesures reconnues de l’outil de suivi sont rattachées', async () => {
    const commun = '00000000-0000-4000-8000-000000000001';
    await seedState(t, { items: [{ id: 'ISO-4', ref: 'ISO', num: '4', title: 'Contexte', afnor: {}, interne: {} }] });
    const lignes = [ENTETE, ligne({ Id: 'COM-001', 'Name FR': 'Écart commun', Requirements: 'ISO-01-22 4' })];
    const sim = (await admin.post('/api/admin/import/tenacy/simulate', { perimetre: commun, lignes })).json();
    expect(sim.lignes[0].mesures).toEqual(['ISO-4']);
    const r = await admin.post('/api/admin/import/tenacy/apply', {
      perimetre: commun,
      lignes,
      empreinte: sim.empreinte,
    });
    expect(r.statusCode, r.body).toBe(201);
    const o = (
      (await admin.get(`/api/grc/${commun}/objects?kind=nonconformity`)).json().items as {
        name: string;
        data: { refs: string[] };
      }[]
    ).find((e) => e.name === 'Écart commun')!;
    expect(o.data.refs).toEqual(['legacy:items:ISO-4']);
  });

  it('refuse un onglet sans colonne Id et signale un onglet vide', async () => {
    const r = await admin.post('/api/admin/import/tenacy/simulate', corps([['Nom'], ['x']]));
    expect(r.json().erreurs[0].message).toMatch(/Id/);
    const ap = await admin.post('/api/admin/import/tenacy/apply', {
      ...corps([['Nom'], ['x']]),
      empreinte: r.json().empreinte,
    });
    expect(ap.statusCode).toBe(422);
    expect(
      (await admin.post('/api/admin/import/tenacy/simulate', corps([ENTETE]))).json().avertissements.join(' '),
    ).toMatch(/aucun écart/);
  });
});
