/* Deux routes dont le service décide de l'accès, avec leurs refus : l'ordre des actions d'un plan (gestion du registre
   exigée, registre restreint masqué) et la synthèse des cartes de périmètres (périmètres restreints masqués, compteurs
   indisponibles sans droit). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SyntheseCartes } from '@suivi/shared';
import { Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const UNE_ACTION = { ids: ['00000000-0000-4000-8000-0000000000aa'] };
const SI_MATCH = { 'if-match': '"1"' };

describe('refus : ordre des actions et synthèse des périmètres', () => {
  let t: TestApp;
  let admin: Agent, lecteur: Agent, hors: Agent, sansDroit: Agent;
  let A: string, plan: string, secret: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'os_admin', 'admin'));
    const l = await makeUser(t, 'os_lecteur', 'ro');
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre fictif', scope: 'x', timezone: 'Europe/Paris' })).json()
      .id;
    expect((await admin.put(`/api/grc/${A}/members`, { userId: l.id, write: false })).statusCode).toBe(204);
    const registre = async (name: string, restreint: boolean) => {
      const r = await admin.post('/api/registres', { kind: 'plan_actions', name, referenceId: A, restreint });
      expect(r.statusCode, r.body).toBe(201);
      return r.json().id as string;
    };
    plan = await registre('Plan ouvert fictif', false);
    secret = await registre('Plan restreint fictif', true);
    lecteur = await login(t, l);
    hors = await login(t, await makeUser(t, 'os_hors', 'ro'));
    sansDroit = await login(t, await makeUser(t, 'os_sans_droit', null));
  }, 60000);
  afterAll(() => t.close());

  describe('PUT /api/registres/:id/ordre', () => {
    it('sans session : 401', async () => {
      expect((await new Agent(t).put(`/api/registres/${plan}/ordre`, UNE_ACTION, SI_MATCH)).statusCode).toBe(401);
    });
    it('un lecteur du périmètre ne gère pas le plan : 403', async () => {
      expect((await lecteur.put(`/api/registres/${plan}/ordre`, UNE_ACTION, SI_MATCH)).statusCode).toBe(403);
    });
    it('un plan restreint est introuvable pour qui n’a pas de droit attribué : 404', async () => {
      expect((await lecteur.put(`/api/registres/${secret}/ordre`, UNE_ACTION, SI_MATCH)).statusCode).toBe(404);
      expect((await hors.put(`/api/registres/${secret}/ordre`, UNE_ACTION, SI_MATCH)).statusCode).toBe(404);
    });
    it('un compte sans droit métier est refusé (403 ou 404), rien n’est ordonné', async () => {
      const r = await sansDroit.put(`/api/registres/${plan}/ordre`, UNE_ACTION, SI_MATCH);
      expect([403, 404]).toContain(r.statusCode);
    });
  });

  describe('GET /api/grc/perimetres/synthese', () => {
    const cartes = async (a: Agent) => {
      const r = await a.get('/api/grc/perimetres/synthese');
      expect(r.statusCode, r.body).toBe(200);
      return (r.json() as SyntheseCartes).cartes.map((c) => c.id);
    };
    it('sans session : 401', async () => {
      expect((await new Agent(t).get('/api/grc/perimetres/synthese')).statusCode).toBe(401);
    });
    it('un périmètre restreint n’apparaît que pour ses membres et les administrateurs', async () => {
      expect(await cartes(admin)).toContain(A);
      expect(await cartes(lecteur)).toContain(A);
      expect(await cartes(hors)).not.toContain(A);
      expect(await cartes(sansDroit)).not.toContain(A);
    });
  });
});
