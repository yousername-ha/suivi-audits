/* Adresse du site (ADR 0077) : choisie dans l'assistant, enregistrée avec le compte si elle diffère de l'adresse en service,
   changée ensuite par l'administration avec un code de double authentification ; l'exécutant la relit pour l'appliquer. */
import { finPoivre, formaterPoivreGenere, genererPoivre } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Agent,
  cleSecoursDeTest,
  createTestApp,
  login,
  makeUser,
  nextCode,
  PASSWORD,
  type TestApp,
  type TestUser,
} from './helpers.js';

const poivre = () => {
  const brut = genererPoivre();
  return { mode: 'genere', valeur: formaterPoivreGenere(brut), engagement: { coffre: true, fin: finPoivre(brut) } };
};

describe('adresse du site à l’installation', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('expose l’adresse en service, refuse une adresse invalide, enregistre une adresse différente', async () => {
    expect((await new Agent(t).get('/api/setup')).json().adresseSite).toBe('suivi.test');
    const { token } = await t.svc.auth.issueSetupToken('install', () => {});
    const corps = (adresseSite: string) => ({
      token,
      username: 'chef',
      password: PASSWORD,
      poivre: poivre(),
      cleSecours: cleSecoursDeTest(),
      adresseSite,
    });
    for (const mauvaise of ['https://suivi.example', 'suivi.example:8443', 'a..b', 'avec espace'])
      expect((await new Agent(t).post('/api/setup', corps(mauvaise))).statusCode).toBe(422);
    const ok = await new Agent(t).post('/api/setup', corps('Suivi.Example.Local'));
    expect(ok.statusCode, ok.body).toBe(201);
    expect(await t.svc.adresseSite.demandee()).toBe('suivi.example.local');
  });

  it('n’enregistre rien quand l’adresse est déjà celle en service', async () => {
    const t2 = await createTestApp();
    try {
      const { token } = await t2.svc.auth.issueSetupToken('install', () => {});
      const ok = await new Agent(t2).post('/api/setup', {
        token,
        username: 'chef',
        password: PASSWORD,
        poivre: poivre(),
        cleSecours: cleSecoursDeTest(),
        adresseSite: 'suivi.test',
      });
      expect(ok.statusCode, ok.body).toBe(201);
      expect(await t2.svc.adresseSite.demandee()).toBeNull();
    } finally {
      await t2.close();
    }
  });
});

describe('adresse du site dans l’administration', () => {
  let t: TestApp, admin: TestUser, agent: Agent;
  beforeAll(async () => {
    t = await createTestApp();
    admin = await makeUser(t, 'rssi', 'admin');
    agent = await login(t, admin);
  });
  afterAll(async () => {
    await t.close();
  });

  it('change l’adresse avec un code valide, refuse sans droit ou avec un mauvais code', async () => {
    expect((await agent.get('/api/admin/adresse-site')).json()).toMatchObject({
      actuelle: 'suivi.test',
      demandee: null,
    });
    const lecteur = await login(t, await makeUser(t, 'alice', 'rw'));
    expect(
      (await lecteur.post('/api/admin/adresse-site', { adresse: 'suivi.example.local', code: '000000' })).statusCode,
    ).toBe(403);
    expect(
      (await agent.post('/api/admin/adresse-site', { adresse: 'suivi.example.local', code: '000000' })).statusCode,
    ).toBe(401);
    const ok = await agent.post('/api/admin/adresse-site', {
      adresse: 'suivi.example.local',
      code: await nextCode(t, admin),
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ actuelle: 'suivi.test', demandee: 'suivi.example.local', demandeePar: 'rssi' });
    const audit = await t.svc.db.q("SELECT target FROM audit_log WHERE action = 'exploitation.adresse_site_demandee'");
    expect(audit.rows).toEqual([{ target: 'suivi.example.local' }]);
  });
});
