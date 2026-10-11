/* Affichage : préférences par personne, écrans muraux (création, activation, portée, révocation), synthèse. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

let t: TestApp;
let A: Agent;
beforeAll(async () => {
  t = await createTestApp();
  A = await login(t, await makeUser(t, 'admin', 'admin'));
});
afterAll(() => t.close());

describe('préférences d’affichage', () => {
  it('valeurs par défaut, enregistrement, présence dans la session', async () => {
    expect((await A.get('/api/account/preferences')).json()).toEqual({
      taille: 'auto',
      densite: 'organisation',
      theme: 'organisation',
      colonnes: {},
      cartographie: {},
    });
    const p = {
      taille: '130',
      densite: 'compacte',
      theme: 'sombre',
      colonnes: { documents: ['titre', 'modifie'] },
      cartographie: { vue: 'process', referentiels: ['HDS'], viewport: { context: { x: 10, y: 20, k: 0.5 } } },
    };
    expect((await A.put('/api/account/preferences', p)).statusCode).toBe(200);
    expect((await A.get('/api/auth/me')).json().preferences).toEqual(p);
    expect((await A.put('/api/account/preferences', { ...p, taille: '400' })).statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('tableau de bord unifié (UI-02)', () => {
  it('graphiques repris de l’outil historique et compteurs du Pilotage, selon les droits', async () => {
    const avant = (await A.get('/api/mur/synthese')).json();
    expect(avant.conformite.map((c: { ref: string }) => c.ref)).toEqual(['ISO', 'A', 'HDS']);
    expect(avant.indicateurs).toMatchObject({ total: expect.any(Number) });
    expect(avant.plans.annee).toBe(new Date().getFullYear());
    expect(avant.ecartsOuverts).toMatchObject({ ouverts: expect.any(Number) });
    const base = avant.pilotage;
    expect(base).toMatchObject({ constatsOuverts: expect.any(Number), risques: expect.any(Number) });

    const ids = (
      await t.svc.db.q<{ id: string }>(
        `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by) VALUES
         ($1,'nonconformity','ecarts','Constat ouvert (fictif)','{"status":"open"}','test','test'),
         ($1,'nonconformity','ecarts','Constat clos (fictif)','{"status":"closed"}','test','test'),
         ($1,'risk','pilotage','Risque fictif','{}','test','test') RETURNING id`,
        [DEFAULT_SMSI],
      )
    ).rows.map((r) => r.id);
    try {
      const apres = (await A.get('/api/mur/synthese')).json().pilotage;
      expect(apres.constatsOuverts).toBe(base.constatsOuverts + 1);
      expect(apres.risques).toBe(base.risques + 1);
      expect(apres.risquesSansDecision).toBe(base.risquesSansDecision + 1);
    } finally {
      await t.svc.db.q('DELETE FROM grc_objects WHERE id = ANY($1)', [ids]);
    }
  });
});

describe('écrans muraux', () => {
  it('création, activation à usage unique, accès limité à la vue /mur, révocation', async () => {
    const c = await A.post('/api/admin/murs', { nom: 'Salle COPIL', jours: 30 });
    expect(c.statusCode).toBe(201);
    const { id, code, lien } = c.json();
    expect(lien).toBe(`https://suivi.test/mur/activer#${code}`);

    const ecran = new Agent(t);
    expect((await ecran.get('/api/mur/synthese')).statusCode).toBe(401);
    const act = await ecran.post('/api/mur/activer', { code });
    expect(act.statusCode).toBe(200);
    expect(act.json().nom).toBe('Salle COPIL');
    expect([...ecran.cookies.keys()]).toContain('__Host-suivi_mur');
    // Code à usage unique.
    expect((await new Agent(t).post('/api/mur/activer', { code })).statusCode).toBe(401);

    const s = await ecran.get('/api/mur/synthese');
    expect(s.statusCode).toBe(200);
    expect(s.json().ecran).toBe('Salle COPIL');
    expect(s.json().mesures.total).toBeGreaterThan(90);
    // Rien d'autre que la vue /mur.
    for (const url of ['/api/legacy/state', '/api/documents', '/api/admin/users', '/api/settings'])
      expect((await ecran.get(url)).statusCode, url).toBe(401);
    expect((await ecran.get('/api/auth/me')).json().stage).toBe('anon');

    expect((await A.del(`/api/admin/murs/${id}`)).statusCode).toBe(204);
    expect((await ecran.get('/api/mur/synthese')).statusCode).toBe(401);
    const log = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action LIKE '%wall%' ORDER BY id",
    );
    expect(log.rows.map((r) => r.action)).toEqual([
      'admin.wall_create',
      'wall.activated',
      'wall.activation_failed',
      'admin.wall_revoke',
    ]);
  });

  it('portée : seuls les modules choisis sont visibles', async () => {
    const { code } = (await A.post('/api/admin/murs', { nom: 'Écarts seulement', modules: ['ecarts'] })).json();
    const ecran = new Agent(t);
    await ecran.post('/api/mur/activer', { code });
    const s = (await ecran.get('/api/mur/synthese')).json();
    expect(s.ecarts).not.toBeNull();
    expect(s.mesures).toBeNull();
    expect(s.prochainAudit).toBeNull();
    // Tableau de bord unifié (UI-02) : seuls les compteurs des écarts, rien sur les risques, la DdA ou les plans.
    expect(s.ecartsOuverts).not.toBeNull();
    expect(s.pilotage).toEqual({
      constatsOuverts: expect.any(Number),
      risques: null,
      risquesSansDecision: null,
      actionsEnRetard: expect.any(Number),
    });
    expect([s.conformite, s.indicateurs, s.plans]).toEqual([null, null, null]);
  });

  it('une personne avec une lecture métier peut ouvrir /mur ; sans droit métier, refus', async () => {
    const l = await login(t, await makeUser(t, 'lecteur-mur', 'lecteur'));
    const r = await l.get('/api/mur/synthese');
    expect(r.statusCode).toBe(200);
    expect(r.json().ecran).toBeNull();
    const n = await login(t, await makeUser(t, 'sans-droit-mur', null));
    expect((await n.get('/api/mur/synthese')).statusCode).toBe(403);
  });

  it('activation : limitation des tentatives', async () => {
    const a = new Agent(t);
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await a.post('/api/mur/activer', { code: 'x'.repeat(32) })).statusCode);
    expect(codes).toContain(429);
  });
});
