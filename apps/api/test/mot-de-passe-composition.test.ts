/* Composition des mots de passe de compte (ADR 0075) côté serveur : changement de mot de passe et installation refusent la
   répétition, la suite et les noms interdits, avec un message par critère ; un mot de passe conforme est accepté. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

let t: TestApp, a: Agent;
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'compo-admin', 'admin'));
});
afterAll(() => t.close());
beforeEach(() => t.svc.limits.motDePasseByUser.reset());

const changer = (next: string) => a.post('/api/account/password', { current: PASSWORD, next });

describe('changement de mot de passe', () => {
  it.each([
    ['Zq8-xxxx-Lm5-Hjk!', /identiques à la suite/],
    ['Zq8-abcde-Lm5-Hj!', /suite de plus de 4/],
    ['Zq8-azerty-Lm5-Hj!', /suite de plus de 4/],
    ['Zq8-compo-admin-Lm5!', /identifiant/],
  ])('refuse %s', async (mdp, motif) => {
    const r = await changer(mdp);
    expect(r.statusCode, r.body).toBe(422);
    expect(r.json().error).toMatch(motif);
    expect(r.body).not.toContain(mdp);
  });
  it('refuse le nom de l’application et celui de l’organisation enregistrés dans les paramètres', async () => {
    const general = t.svc.settings.get('general');
    for (const nom of [general.appName, general.orgName]) {
      const r = await changer(`Zq8-${nom}-Lm5!`);
      expect(r.statusCode, r.body).toBe(422);
      expect(r.json().error).toMatch(/nom de l'application ou de l'organisation/);
    }
  });
  it('accepte un mot de passe conforme', async () => {
    const r = await changer('Bonjour-Zq8-Rt3-Lm5!');
    expect(r.statusCode, r.body).toBe(200);
  });
});

describe('installation initiale', () => {
  it('refuse un mot de passe qui contient l’identifiant, une suite ou le nom d’organisation saisi, sans consommer le jeton', async () => {
    const t2 = await createTestApp({}, { poivre: false });
    try {
      const { token } = await t2.svc.auth.issueSetupToken('cli', () => {});
      const poivre = poivreDeTest();
      const tenter = (password: string) =>
        new Agent(t2).post('/api/setup', { token, username: 'chef', password, poivre, cleSecours: cleSecoursDeTest() });
      const r1 = await tenter('Zq8-chef-Lm5-Hjk-9!');
      expect(r1.statusCode, r1.body).toBe(422);
      expect(r1.json().error).toMatch(/identifiant/);
      const r2 = await tenter('Zq8-12345-Lm5-Hjk!');
      expect(r2.statusCode, r2.body).toBe(422);
      expect(r2.json().error).toMatch(/suite de plus de 4/);
      // Le nom d'organisation saisi dans le même formulaire est refusé aussi, avant d'être enregistré.
      const r3 = await new Agent(t2).post('/api/setup', {
        token,
        username: 'chef',
        password: 'Zq8-Clinique-Lm5!',
        orgName: 'Clinique',
        poivre,
        cleSecours: cleSecoursDeTest(),
      });
      expect(r3.statusCode, r3.body).toBe(422);
      expect(r3.json().error).toMatch(/nom de l'application ou de l'organisation/);
      expect((await tenter(PASSWORD)).statusCode).toBe(201);
    } finally {
      await t2.close();
    }
  });
});
