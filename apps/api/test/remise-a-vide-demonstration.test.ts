/* Régénérer la démonstration depuis l'écran (décision du RSSI du 23/11/2026, addendum de l'ADR 0065) : effacement des
   données de travail puis chargement du jeu de démonstration fictif, avec les garde-fous de la remise à vide (interrupteur,
   phrase propre, code de double authentification, sauvegarde récente, administrateurs seulement). Base propre à ce fichier. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REMISE_A_VIDE_PHRASES } from '@suivi/shared';
import { controleRelations } from '../src/controle-relations.js';
import { chargerJeuDeTest } from '../src/jeu-de-test.js';
import { hotp } from '../src/security/crypto.js';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp, admin: TestUser, lecteur: TestUser, a: Agent;
const code = async () => {
  await t.svc.db.q('UPDATE users SET totp_last_step=0 WHERE id=$1', [admin.id]);
  return hotp(admin.key, Math.floor(Date.now() / 30000));
};
const compte = async (table: string) =>
  Number((await t.svc.db.one<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`))!.n);
const sauvegardeRecente = async () => {
  await t.svc.db.q('DELETE FROM backup_jobs');
  await t.svc.db.q(
    `INSERT INTO backup_jobs(request_id, status, requested_by, finished_at) VALUES ($1,'reussie','test', now() - interval '1 minute')`,
    [randomUUID()],
  );
};
const autoriser = async (v: boolean) =>
  t.svc.remiseAVide.definirAutorisation(v, { id: admin.id, username: admin.username }, '127.0.0.1');
const demande = async (changes: Record<string, unknown> = {}) => ({
  requestId: randomUUID(),
  portee: 'travail',
  demonstration: true,
  confirm: REMISE_A_VIDE_PHRASES.demonstration,
  code: await code(),
  ...changes,
});
const audit = async (action: string) =>
  (await t.svc.db.q('SELECT 1 FROM audit_log WHERE action=$1', [action])).rowCount ?? 0;

beforeAll(async () => {
  t = await createTestApp();
  admin = await makeUser(t, 'demo-admin', 'admin');
  lecteur = await makeUser(t, 'demo-lecteur', 'ro');
});
afterAll(() => t.close());
beforeEach(async () => {
  t.svc.limits.updateMfaByUser.reset();
  await autoriser(false);
  await t.svc.db.q('DELETE FROM backup_jobs');
  await t.svc.db.q('DELETE FROM operation_jobs');
  a = await login(t, admin);
});

describe('remise à vide : régénérer la démonstration', () => {
  it('garde les garde-fous de la remise à vide et a sa propre phrase', async () => {
    // Réservée aux administrateurs.
    expect((await (await login(t, lecteur)).post('/api/admin/remise-a-vide', await demande())).statusCode).toBe(403);
    // Interrupteur coupé : refus avant tout contrôle du code.
    expect((await a.post('/api/admin/remise-a-vide', await demande())).statusCode).toBe(403);
    await autoriser(true);
    // Sans sauvegarde récente : refus.
    const sans = await a.post('/api/admin/remise-a-vide', await demande());
    expect(sans.statusCode).toBe(409);
    expect(sans.json().reason).toBe('sauvegarde_requise');
    await sauvegardeRecente();
    // La phrase des données de travail ne vaut pas pour la démonstration, et inversement.
    expect(
      (await a.post('/api/admin/remise-a-vide', await demande({ confirm: REMISE_A_VIDE_PHRASES.travail }))).statusCode,
    ).toBe(422);
    expect((await a.post('/api/admin/remise-a-vide', await demande({ demonstration: undefined }))).statusCode).toBe(
      422,
    );
    // Phrase tapée en caractères décomposés (certains claviers et téléphones) : acceptée, le refus vient du code faux.
    expect(
      (
        await a.post(
          '/api/admin/remise-a-vide',
          await demande({ confirm: ` ${REMISE_A_VIDE_PHRASES.demonstration.normalize('NFD')} `, code: '000000' }),
        )
      ).statusCode,
    ).toBe(401);
    t.svc.limits.updateMfaByUser.reset();
    // Code faux : refusé et tracé.
    expect((await a.post('/api/admin/remise-a-vide', await demande({ code: '000000' }))).statusCode).toBe(401);
    // Jamais avec la portée « tout » : les comptes seraient effacés avant le chargement.
    const tout = await a.post('/api/admin/remise-a-vide', await demande({ portee: 'tout' }));
    expect(tout.statusCode).toBeGreaterThanOrEqual(400);
    expect(tout.statusCode).toBeLessThan(500);
    expect(await compte('users')).toBeGreaterThan(0);
    expect(await audit('remise_a_vide.executee')).toBe(0);
    expect(await audit('remise_a_vide.demonstration_chargee')).toBe(0);
  });

  it('efface les données de travail puis recharge le jeu fictif, au nom de l’administrateur, tracé au journal', async () => {
    await autoriser(true);
    await sauvegardeRecente();
    // Base déjà remplie : le chargement seul y est refusé ; la régénération ne réussit que parce qu'elle efface d'abord.
    await chargerJeuDeTest(t.svc, t.app, admin.username, { publicUrl: 'https://suivi.test' });
    await expect(chargerJeuDeTest(t.svc, t.app, admin.username, { publicUrl: 'https://suivi.test' })).rejects.toThrow(
      /déjà des données de pilotage/,
    );
    const r = await a.post('/api/admin/remise-a-vide', await demande());
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ portee: 'travail', jeton: false, demonstration: 'chargee' });
    expect(await compte('grc_objects')).toBeGreaterThan(0);
    // Comptes gardés, session toujours valable ; les relations du jeu sont cohérentes.
    expect((await a.get('/api/auth/me')).json()).toMatchObject({ stage: 'ok' });
    expect((await controleRelations(t.svc)).ok).toBe(true);
    expect(await audit('remise_a_vide.executee')).toBe(1);
    expect(await audit('remise_a_vide.demonstration_chargee')).toBe(1);
    // L'état affiché par l'écran annonce la phrase de la démonstration.
    expect((await a.get('/api/admin/remise-a-vide')).json().phrases.demonstration).toBe(
      REMISE_A_VIDE_PHRASES.demonstration,
    );
  }, 180_000);
});
