/* Assistant d'installation, étape « Flux vers l'extérieur » (ADR 0097, lot 3). Comme les données de démonstration, la demande
   est mémorisée à la création du compte administrateur par l'installation, puis proposée à ce seul compte une fois sa session
   complète (second facteur enrôlé) ; la terminer ou la passer la consomme et l'inscrit au journal. Ces routes n'ouvrent aucun
   flux : l'étape ouvre par les gestes du lot 1 (même droit, même validation, même journal). Pas pour un administrateur de
   secours. Données fictives. */
import { FLUX_MODULES } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { hotp } from '../src/security/crypto.js';
import {
  Agent,
  cleSecoursDeTest,
  createTestApp,
  login,
  makeUser,
  PASSWORD,
  poivreDeTest,
  type TestApp,
} from './helpers.js';

const url = '/api/installation/flux-externes';

const installer = async () => {
  const t = await createTestApp({ PUBLIC_URL: 'https://suivi.test' }, { poivre: false });
  const { token } = await t.svc.auth.issueSetupToken('cli', () => {});
  const a = new Agent(t);
  const r = await a.post('/api/setup', {
    token,
    username: 'chef',
    password: PASSWORD,
    poivre: poivreDeTest(),
    cleSecours: cleSecoursDeTest(),
  });
  expect(r.statusCode, r.body).toBe(201);
  return { t, a };
};
/** Enrôlement du second facteur du compte créé : la session devient complète. */
const enroler = async (t: TestApp, a: Agent, username = 'chef') => {
  await a.me();
  const e = await a.post('/api/account/totp/begin', {});
  expect(e.statusCode, e.body).toBe(200);
  const u = (await t.svc.db.one<{ id: string; totp_pending: Buffer }>(
    'SELECT id, totp_pending FROM users WHERE username=$1',
    [username],
  ))!;
  const cle = t.svc.vault.openSmall(u.totp_pending, 'totp:' + u.id);
  await a.me();
  const c = await a.post('/api/account/totp/confirm', { code: hotp(cle, Math.floor(Date.now() / 30000)) });
  expect(c.statusCode, c.body).toBe(200);
  await a.me();
};
const journal = (t: TestApp) =>
  t.svc.db.q<{ username: string; details: { ouverts: string[]; fermes: string[] } }>(
    "SELECT username, details FROM audit_log WHERE action='setup.flux_questions_vues' ORDER BY id",
  );

describe('installation : étape « Flux vers l’extérieur »', () => {
  it('proposée au seul compte créé, après son second facteur ; passée, elle n’est plus reposée et rien n’est ouvert', async () => {
    const { t, a } = await installer();
    try {
      // Avant l'enrôlement du second facteur, la session n'est pas complète : rien n'est lisible.
      expect((await a.get(url)).statusCode).not.toBe(200);
      await enroler(t, a);
      expect((await a.get(url)).json()).toEqual({ aProposer: true });
      // Un autre administrateur ne la voit pas ; un contributeur n'a pas accès.
      const autre = await login(t, await makeUser(t, 'autre_admin', 'admin'));
      expect((await autre.get(url)).json()).toEqual({ aProposer: false });
      const contributeur = await login(t, await makeUser(t, 'contributeur_flux', 'rw'));
      expect((await contributeur.get(url)).statusCode).toBe(403);
      expect((await contributeur.post(url + '/vues', {})).statusCode).toBe(403);
      // Un autre administrateur qui la clôt ne consomme pas celle du compte créé.
      expect((await autre.post(url + '/vues', {})).json()).toEqual({ aProposer: false });
      expect((await a.get(url)).json()).toEqual({ aProposer: true });
      expect((await journal(t)).rowCount).toBe(0);
      // Corps strict ; jeton CSRF exigé.
      expect((await a.post(url + '/vues', { ouvrir: ['antivirus'] })).statusCode).toBe(422);
      expect((await a.req('POST', url + '/vues', { json: {}, csrf: false })).statusCode).toBe(403);

      const r = await a.post(url + '/vues', {});
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json()).toEqual({ aProposer: false });
      expect((await a.get(url)).json()).toEqual({ aProposer: false });
      const j = await journal(t);
      expect(j.rows).toEqual([{ username: 'chef', details: { ouverts: [], fermes: [...FLUX_MODULES] } }]);
      for (const m of FLUX_MODULES) expect(await t.svc.flux.ouvert(m)).toBe(false);
      // Rejouée, la clôture n'écrit plus rien.
      expect((await a.post(url + '/vues', {})).statusCode).toBe(200);
      expect((await journal(t)).rowCount).toBe(1);
    } finally {
      await t.close();
    }
  }, 60_000);

  it('« Activer » passe par le geste du lot 1 (validation exigée) ; la clôture inscrit les flux ouverts', async () => {
    const { t, a } = await installer();
    try {
      await enroler(t, a);
      // Sans validation, la route commune refuse ; avec, elle ouvre et l'inscrit au journal.
      expect((await a.put('/api/admin/flux-externes/antivirus', { ouvert: true })).statusCode).toBe(422);
      const o = await a.put('/api/admin/flux-externes/antivirus', { ouvert: true, confirmation: true });
      expect(o.statusCode, o.body).toBe(200);
      // L'assistant ne s'ouvre pas par la route commune : son activation passe par ses réglages.
      expect(
        (await a.put('/api/admin/flux-externes/assistant', { ouvert: true, confirmation: true })).json().reason,
      ).toBe('flux_par_module');
      await a.post(url + '/vues', {});
      expect((await journal(t)).rows[0]!.details).toEqual({
        ouverts: ['antivirus'],
        fermes: FLUX_MODULES.filter((m) => m !== 'antivirus'),
      });
      expect(
        (await t.svc.db.one<{ n: number }>(
          "SELECT count(*)::int AS n FROM audit_log WHERE action='flux.externe.ouvert' AND target='antivirus' AND username='chef'",
        ))!.n,
      ).toBe(1);
    } finally {
      await t.close();
    }
  }, 60_000);

  it('un administrateur de secours, créé sur une installation en service, ne reçoit pas l’étape', async () => {
    const { t, a } = await installer();
    try {
      await enroler(t, a);
      const { token } = await t.svc.auth.issueSetupToken('recovery', () => {});
      const secours = new Agent(t);
      const r = await secours.post('/api/setup', { token, username: 'secours', password: PASSWORD });
      expect(r.statusCode, r.body).toBe(201);
      await enroler(t, secours, 'secours');
      expect((await secours.get(url)).json()).toEqual({ aProposer: false });
      // La demande du compte créé par l'installation reste intacte.
      expect((await a.get(url)).json()).toEqual({ aProposer: true });
    } finally {
      await t.close();
    }
  }, 60_000);
});
