/* Le mot de passe SMTP scellé ne vaut que pour le relais saisi : changer l'hôte, le port, le mode de sécurité, le compte
   ou l'autorité de certification le supprime (il doit être ressaisi) ; les autres réglages le conservent. Fictif. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent;
const SECRET = 'Secret-SMTP-fictif-42';

const regler = async (v: Record<string, unknown>) => {
  const g = await admin.get('/api/settings/courriel');
  const r = await admin.put(
    '/api/settings/courriel',
    { ...g.json().values, ...v },
    { 'if-match': g.headers.etag as string },
  );
  expect(r.statusCode, r.body).toBe(200);
};
const defini = async () => (await admin.get('/api/settings/courriel')).json().info.motDePasseDefini as boolean;
const poser = async () =>
  expect((await admin.put('/api/settings/courriel/mot-de-passe', { password: SECRET })).statusCode).toBe(204);

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cs_admin', 'admin'));
  await regler({ hote: 'smtp.exemple.test', port: 587, securite: 'starttls', utilisateur: 'compte', actif: true });
});
afterAll(() => t.close());

describe('mot de passe SMTP lié au relais', () => {
  it('un réglage sans rapport avec le relais le conserve', async () => {
    await poser();
    await regler({ expediteur: 'expediteur@exemple.test', contactTechnique: 'contact@exemple.test' });
    expect(await defini()).toBe(true);
  });

  it.each([
    ['hote', 'autre.exemple.test'],
    ['port', 465],
    ['securite', 'smtps'],
    ['utilisateur', 'autre-compte'],
    ['autoriteCertification', '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'],
  ])('changer %s supprime le mot de passe enregistré', async (champ, valeur) => {
    await poser();
    expect(await defini()).toBe(true);
    await regler({ [champ as string]: valeur });
    expect(await defini()).toBe(false);
    const journal = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action='courriel.mot_de_passe_invalide'",
    );
    expect(journal.rows.length).toBeGreaterThan(0);
  });

  it('le mot de passe supprimé n’est plus transmis à l’exécutant', async () => {
    await poser();
    await regler({ hote: 'encore-un-autre.exemple.test' });
    const r = await t.svc.db.q("SELECT 1 FROM settings WHERE key='secret:courriel'");
    expect(r.rows.length).toBe(0);
  });
});
