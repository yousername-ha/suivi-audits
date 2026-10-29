/* Clé de secours des sauvegardes (ADR 0077) : obligatoire à l'installation, enregistrée avec le compte, seule la clé publique
   est acceptée ; remplacement par l'administration avec le code de double authentification ; lecture par l'exécutant. */
import { encoderClePrivee, finPoivre, formaterPoivreGenere, genererPoivre } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Agent,
  CLE_SECOURS_TEST,
  createTestApp,
  login,
  makeUser,
  nextCode,
  PASSWORD,
  type TestApp,
  type TestUser,
} from './helpers.js';

const AUTRE_CLE = 'age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p';
const poivre = () => {
  const brut = genererPoivre();
  return { mode: 'genere', valeur: formaterPoivreGenere(brut), engagement: { coffre: true, fin: finPoivre(brut) } };
};

describe('clé de secours à l’installation', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('est exigée, refuse une clé privée ou mal formée, puis est enregistrée avec le compte', async () => {
    const etat = await new Agent(t).get('/api/setup');
    expect(etat.json()).toMatchObject({ needed: true, cleSecoursDefinie: false });
    const { token } = await t.svc.auth.issueSetupToken('install', () => {});
    const corps = (extra: Record<string, unknown>) => ({
      token,
      username: 'chef',
      password: PASSWORD,
      poivre: poivre(),
      ...extra,
    });
    const sans = await new Agent(t).post('/api/setup', corps({}));
    expect(sans.statusCode).toBe(422);
    expect(sans.json().reason).toBe('cle_secours_requise');
    const privee = encoderClePrivee(new Uint8Array(32).fill(7));
    for (const publique of [privee, 'age1abc', `${CLE_SECOURS_TEST.slice(0, -1)}q`])
      expect(
        (await new Agent(t).post('/api/setup', corps({ cleSecours: { publique, coffre: true } }))).statusCode,
      ).toBe(422);
    expect(
      (await new Agent(t).post('/api/setup', corps({ cleSecours: { publique: CLE_SECOURS_TEST, coffre: false } })))
        .statusCode,
    ).toBe(422);
    // Les refus n'ont pas consommé le jeton.
    const ok = await new Agent(t).post(
      '/api/setup',
      corps({ cleSecours: { publique: CLE_SECOURS_TEST, coffre: true } }),
    );
    expect(ok.statusCode, ok.body).toBe(201);
    expect(await t.svc.cleSecours.publiques()).toEqual([CLE_SECOURS_TEST]);
    expect((await new Agent(t).get('/api/setup')).json().cleSecoursDefinie).toBe(true);
    const audit = await t.svc.db.q("SELECT details FROM audit_log WHERE action = 'sauvegarde.cle_secours_definie'");
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows)).toContain(CLE_SECOURS_TEST.slice(-8));
  });
});

describe('clé de secours dans l’administration', () => {
  let t: TestApp, admin: TestUser, agent: Agent;
  beforeAll(async () => {
    t = await createTestApp();
    admin = await makeUser(t, 'rssi', 'admin');
    agent = await login(t, admin);
  });
  afterAll(async () => {
    await t.close();
  });

  it('signale l’absence de clé : sauvegardes impossibles', async () => {
    const r = await agent.get('/api/admin/sauvegardes/cle-secours');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ publique: null, serveur: [], sauvegardesPossibles: false });
  });

  it('définit puis remplace la clé avec un code valide, refuse sans droit ou avec un mauvais code', async () => {
    const lecteur = await login(t, await makeUser(t, 'alice', 'rw'));
    const corps = async (publique: string, code?: string) => ({
      cleSecours: { publique, coffre: true },
      code: code ?? (await nextCode(t, admin)),
    });
    expect(
      (await lecteur.post('/api/admin/sauvegardes/cle-secours', await corps(CLE_SECOURS_TEST, '000000'))).statusCode,
    ).toBe(403);
    const faux = await agent.post('/api/admin/sauvegardes/cle-secours', await corps(CLE_SECOURS_TEST, '000000'));
    expect(faux.statusCode).toBe(401);
    expect(await t.svc.cleSecours.publiques()).toEqual([]);
    const ok = await agent.post('/api/admin/sauvegardes/cle-secours', await corps(CLE_SECOURS_TEST));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ publique: CLE_SECOURS_TEST, definiPar: 'rssi' });
    const remplace = await agent.post('/api/admin/sauvegardes/cle-secours', await corps(AUTRE_CLE));
    expect(remplace.statusCode, remplace.body).toBe(200);
    expect(await t.svc.cleSecours.publiques()).toEqual([AUTRE_CLE]);
    const audit = await t.svc.db.q<{ details: { remplace: string | null } }>(
      "SELECT details FROM audit_log WHERE action = 'sauvegarde.cle_secours_definie' ORDER BY id",
    );
    expect(audit.rows.map((r) => r.details.remplace)).toEqual([null, CLE_SECOURS_TEST.slice(-8)]);
  });

  it('limite les tentatives à cinq par heure et par compte', async () => {
    t.svc.limits.cleSecoursByUser.reset();
    t.svc.limits.updateMfaByUser.reset();
    for (let i = 0; i < 5; i++)
      await agent.post('/api/admin/sauvegardes/cle-secours', {
        cleSecours: { publique: AUTRE_CLE, coffre: true },
        code: '000000',
      });
    t.svc.limits.updateMfaByUser.reset();
    const r = await agent.post('/api/admin/sauvegardes/cle-secours', {
      cleSecours: { publique: AUTRE_CLE, coffre: true },
      code: await nextCode(t, admin),
    });
    expect(r.statusCode).toBe(429);
  });
});
