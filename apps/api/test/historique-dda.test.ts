/* Reprise de la déclaration d'applicabilité de l'outil de suivi (clé `dda`) : écritures natives sous verrou, clauses ISO
   obligatoires, texte de référence saisi par l'utilisateur, champs inconnus conservés. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, ecartCommun, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent;
const ecartIds: string[] = [];
const etat = async () => (await admin.get('/api/suivi/etat')).json();

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'dda_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'dda_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'dda_writer', 'rw'));
  const cur = await admin.get('/api/suivi/etat');
  const s = cur.json();
  const it = (id: string, ref: string, num: string) => ({
    id,
    ref,
    num,
    title: `Mesure fictive ${num}`,
    group: 'G',
    depth: 0,
    afnor: {},
    interne: {},
  });
  s.items = [it('ISO-6.1', 'ISO', '6.1'), it('A-5.1', 'A', '5.1'), it('A-5.2', 'A', '5.2'), it('HDS-1', 'HDS', '1')];
  s.dda = {
    'A-5.1': { app: 'oui', level: 'Total', just: 'Justification fictive', inconnu: 'garder' },
    'ZZ-9': { app: 'oui' },
  };
  await seedState(t, s);
  ecartIds.push(
    (await ecartCommun(admin, { name: 'Écart fictif', classification: 'mineure', items: ['A-5.1'] })).id,
    (await ecartCommun(admin, { name: 'Autre', items: ['HDS-1'] })).id,
  );
});
afterAll(() => t.close());

describe('déclaration d’applicabilité', () => {
  it('lit les mesures du référentiel, leurs niveaux et les écarts rattachés', async () => {
    const r = await reader.get('/api/dda?reference=A');
    expect(r.statusCode).toBe(200);
    expect(r.json().mesures.map((m: { id: string }) => m.id)).toEqual(['A-5.1', 'A-5.2']);
    expect(r.json().dda['A-5.1']).toMatchObject({ app: 'oui', level: 'Total', just: 'Justification fictive' });
    expect(Object.keys(r.json().dda)).toEqual(['A-5.1']);
    expect(r.json().ecarts.map((e: { id: string }) => e.id)).toEqual([ecartIds[0]]);
    expect((await reader.get('/api/dda?reference=X')).statusCode).toBe(422);
    expect((await (await login(t, await makeUser(t, 'dda_sans', null))).get('/api/dda?reference=A')).statusCode).toBe(
      403,
    );
  });
  it('modifie une mesure de l’Annexe A : champs fournis, autres et champs inconnus conservés', async () => {
    expect((await reader.patch('/api/dda/A-5.1', { level: 'Partiel' })).statusCode).toBe(403);
    const r = await writer.patch('/api/dda/A-5.1', {
      level: 'Partiel',
      actions: 'Action fictive',
      url: 'https://exemple.test/doc',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await etat()).dda['A-5.1']).toMatchObject({
      app: 'oui',
      level: 'Partiel',
      just: 'Justification fictive',
      actions: 'Action fictive',
      inconnu: 'garder',
    });
  });
  it('crée l’entrée d’une mesure sans déclaration avec les valeurs de l’outil historique', async () => {
    expect((await writer.patch('/api/dda/A-5.2', { app: 'non', just: 'Hors périmètre' })).statusCode).toBe(200);
    expect((await etat()).dda['A-5.2']).toEqual({
      app: 'non',
      just: 'Hors périmètre',
      risk: '',
      level: '',
      actions: '',
      docs: '',
      comment: '',
    });
  });
  it('une clause ISO est obligatoire ; le texte de référence est saisi par l’utilisateur', async () => {
    expect((await writer.patch('/api/dda/ISO-6.1', { app: 'non' })).statusCode).toBe(422);
    expect((await writer.patch('/api/dda/ISO-6.1', { just: 'x' })).statusCode).toBe(422);
    const r = await writer.patch('/api/dda/ISO-6.1', {
      level: 'Total',
      comment: 'Revue fictive',
      refText: 'Texte saisi fictif',
    });
    expect(r.statusCode, r.body).toBe(200);
    const s = await etat();
    expect(s.dda['ISO-6.1']).toMatchObject({ level: 'Total', comment: 'Revue fictive' });
    expect(s.items.find((x: { id: string }) => x.id === 'ISO-6.1').refText).toBe('Texte saisi fictif');
    expect((await reader.get('/api/dda?reference=ISO')).json().mesures[0].refText).toBe('Texte saisi fictif');
  });
  it('refuse les valeurs hors liste et les mesures absentes', async () => {
    expect((await writer.patch('/api/dda/A-5.1', { level: 'Faible' })).statusCode).toBe(422);
    expect((await writer.patch('/api/dda/A-5.1', { app: 'peut-être' })).statusCode).toBe(422);
    expect((await writer.patch('/api/dda/A-9.9', { level: 'Total' })).statusCode).toBe(404);
  });
  it('journalise les modifications', async () => {
    const rows = await t.svc.db.q<{ action: string }>(
      "SELECT DISTINCT action FROM audit_log WHERE action LIKE 'dda.%'",
    );
    expect(rows.rows.map((x) => x.action)).toEqual(['dda.updated']);
  });
});
