/* route() : `access` en liste de permissions d'un même module, dont l'une suffit (ADR 0110 : la veille réglementaire se lit
   avec `veille_reglementaire:lire` OU le droit réservé `veille_reglementaire:dpo`). Garde : une seule des permissions
   suffit, aucune → 403 qui nomme la première, module désactivé → 409 ; liste mêlant deux modules refusée à
   l'enregistrement ; documentation OpenAPI (`x-access`) qui donne la liste. */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpenApi, registerRoutes, route } from '../src/http/route.js';
import type { Services } from '../src/services.js';
import { createTestApp, login, makeUser, type TestApp } from './helpers.js';

let t: TestApp;
const url = '/api/veille-reglementaire/synthese';

beforeAll(async () => {
  t = await createTestApp();
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_alt_lire', 'Lecture seule du module', ARRAY['veille_reglementaire:lire']),
       ('r_alt_dpo', 'Droit DPO seul', ARRAY['veille_reglementaire:dpo']),
       ('r_alt_autre', 'Autre module', ARRAY['vulnerabilites:lire','veille_reglementaire:modifier'])`,
  );
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('route() : permissions alternatives', () => {
  it('l’une des permissions suffit ; aucune : 403 qui nomme la première ; module désactivé : 409', async () => {
    const lire = await login(t, await makeUser(t, 'alt_lire', 'r_alt_lire'));
    const dpo = await login(t, await makeUser(t, 'alt_dpo', 'r_alt_dpo'));
    const autre = await login(t, await makeUser(t, 'alt_autre', 'r_alt_autre'));
    expect((await lire.get(url)).statusCode).toBe(200);
    expect((await dpo.get(url)).statusCode).toBe(200);
    const refus = await autre.get(url);
    expect(refus.statusCode).toBe(403);
    expect(refus.json().permission).toBe('veille_reglementaire:lire');
    await t.svc.db.q("UPDATE module_activation SET disabled='{veille_reglementaire}', version=version+1 WHERE id=1");
    expect((await dpo.get(url)).statusCode).toBe(409);
    await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  });

  it('une liste qui mêle deux modules est refusée à l’enregistrement', () => {
    const def = route({
      method: 'GET',
      url: '/api/essai',
      summary: 'essai',
      tags: [],
      access: ['veille_reglementaire:lire', 'vulnerabilites:lire'],
      handler: async () => ({}),
    });
    expect(() => registerRoutes({} as FastifyInstance, {} as Services, [def])).toThrow(/même module/);
  });

  it('OpenAPI : `x-access` donne la liste des permissions alternatives', () => {
    const doc = buildOpenApi(
      [
        route({
          method: 'GET',
          url: '/api/essai',
          summary: 'essai',
          tags: [],
          access: ['veille_reglementaire:lire', 'veille_reglementaire:dpo'],
          handler: async () => ({}),
        }),
      ],
      { title: 'essai', version: '0' },
    );
    expect((doc.paths['/api/essai'] as Record<string, Record<string, unknown>>).get!['x-access']).toEqual([
      'veille_reglementaire:lire',
      'veille_reglementaire:dpo',
    ]);
  });
});
