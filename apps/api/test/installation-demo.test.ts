/* Installation initiale : option « données de démonstration ». Par défaut rien n'est chargé (les données de départ restent
   vides) ; demandée, la démonstration (établissement fictif, ISO 27001 / HDS / EBIOS RM) est mémorisée à la création du
   compte administrateur et chargée une seule fois, à la fin de l'enrôlement de son second facteur ; un échec du chargement
   ne bloque jamais l'installation. */
import { describe, expect, it } from 'vitest';
import { hotp } from '../src/security/crypto.js';
import { Agent, createTestApp, PASSWORD, poivreDeTest, type TestApp } from './helpers.js';

const installer = async (corps: Record<string, unknown>, avant?: (t: TestApp) => void) => {
  const t = await createTestApp({ PUBLIC_URL: 'https://suivi.test' });
  avant?.(t);
  const { token } = await t.svc.auth.issueSetupToken('cli', () => {});
  const a = new Agent(t);
  const r = await a.post('/api/setup', {
    token,
    username: 'chef',
    password: PASSWORD,
    poivre: poivreDeTest(),
    ...corps,
  });
  return { t, a, r };
};
/** Enrôlement du second facteur du compte qui vient d'être créé (retourne la réponse de la confirmation). */
const enroler = async (t: TestApp, a: Agent) => {
  await a.me();
  const e = await a.post('/api/account/totp/begin', {});
  expect(e.statusCode, e.body).toBe(200);
  const u = (await t.svc.db.one<{ id: string; totp_pending: Buffer }>(
    "SELECT id, totp_pending FROM users WHERE username='chef'",
  ))!;
  const cle = t.svc.vault.openSmall(u.totp_pending, 'totp:' + u.id);
  await a.me();
  return a.post('/api/account/totp/confirm', { code: hotp(cle, Math.floor(Date.now() / 30000)) });
};
const compter = async (t: TestApp, kind: string) =>
  (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM grc_objects WHERE kind=$1', [kind]))!.n;

describe('installation : données de démonstration', () => {
  it('sans demande, aucune donnée n’est chargée', async () => {
    const { t, a, r } = await installer({});
    try {
      expect(r.statusCode, r.body).toBe(201);
      expect(r.json().demo).toBeUndefined();
      const c = await enroler(t, a);
      expect(c.statusCode, c.body).toBe(200);
      expect(c.json().demo).toBeUndefined();
      expect(await compter(t, 'risk_study')).toBe(0);
    } finally {
      await t.close();
    }
  });

  it('demandée : en attente à la création du compte, chargée à la fin de l’enrôlement du second facteur', async () => {
    const { t, a, r } = await installer({ demo: true, orgName: 'Organisation de test' });
    try {
      expect(r.statusCode, r.body).toBe(201);
      expect(r.json().demo).toBe('en_attente');
      expect(await compter(t, 'risk_study')).toBe(0);
      expect(t.svc.settings.get('general').orgName).toBe('Organisation de test');
      const c = await enroler(t, a);
      expect(c.statusCode, c.body).toBe(200);
      expect(c.json().demo).toBe('ok');
      expect(await compter(t, 'risk_study')).toBe(1);
      expect(await compter(t, 'strategic_scenario')).toBe(4);
      expect(await compter(t, 'operational_scenario')).toBe(4);
      expect(await compter(t, 'treatment')).toBe(5);
      const fw = await t.svc.db.q<{ identifier: string }>('SELECT identifier FROM lib_frameworks ORDER BY identifier');
      expect(fw.rows.map((x) => x.identifier)).toEqual(['hds', 'iso-27001-2022']);
      expect(
        (await t.svc.db.one<{ n: number }>(
          "SELECT count(*)::int AS n FROM audit_log WHERE action='setup.demo_loaded'",
        ))!.n,
      ).toBe(1);
      // La demande est consommée : elle ne se rejoue pas.
      expect((await t.svc.db.q("SELECT 1 FROM settings WHERE key='demo_en_attente'")).rowCount).toBe(0);
    } finally {
      await t.close();
    }
  }, 180_000);

  it('un échec du chargement ne bloque pas l’installation et se lit au journal', async () => {
    const { t, a, r } = await installer({ demo: true }, (t2) => {
      t2.svc.grc.library.adoptStandard = () => Promise.reject(new Error('panne simulée'));
    });
    try {
      expect(r.statusCode, r.body).toBe(201);
      const c = await enroler(t, a);
      expect(c.statusCode, c.body).toBe(200);
      expect(c.json().demo).toBe('echec');
      expect(
        (await t.svc.db.one<{ n: number }>(
          "SELECT count(*)::int AS n FROM audit_log WHERE action='setup.demo_failed'",
        ))!.n,
      ).toBe(1);
      expect((await t.svc.db.q("SELECT 1 FROM settings WHERE key='demo_en_attente'")).rowCount).toBe(0);
    } finally {
      await t.close();
    }
  }, 120_000);
});
