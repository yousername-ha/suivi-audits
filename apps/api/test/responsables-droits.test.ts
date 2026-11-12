/* L'annuaire des responsables proposables (personnes, groupes, fonctions) n'est servi qu'à qui peut désigner un responsable
   dans le périmètre : droit de modification d'un module métier, ou rôle de contributeur sur un registre du périmètre.
   Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const url = `/api/grc/${DEFAULT_SMSI}/responsables`;

describe('annuaire des responsables', () => {
  let t: TestApp, admin: Agent, contributeur: Agent, lecteur: Agent, sansRole: Agent, delegue: Agent;
  let delegueId = '';

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'rd_admin', 'admin'));
    contributeur = await login(t, await makeUser(t, 'rd_contrib', 'rw'));
    lecteur = await login(t, await makeUser(t, 'rd_lecteur', 'ro'));
    sansRole = await login(t, await makeUser(t, 'rd_sans', null));
    await t.svc.db.q(
      "INSERT INTO roles(id,name,permissions) VALUES ('r_documents','Documents seuls',ARRAY['documents:lire'])",
    );
    delegue = await login(t, await makeUser(t, 'rd_documents', 'r_documents'));
    const dUser = await t.svc.db.one<{ id: string }>("SELECT id FROM users WHERE username='rd_documents'");
    delegueId = dUser!.id;
  });
  afterAll(() => t.close());

  it('un contributeur de module et l’administrateur reçoivent l’annuaire', async () => {
    for (const a of [admin, contributeur]) {
      const r = await a.get(url);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().utilisateurs.length).toBeGreaterThan(0);
    }
  });

  it('sans droit de modification ni rôle de registre : refusé (lecteur, compte sans rôle, documents seuls)', async () => {
    for (const a of [lecteur, sansRole, delegue]) expect((await a.get(url)).statusCode).toBe(403);
  });

  it('un contributeur désigné sur un registre du périmètre reçoit l’annuaire', async () => {
    const reg = await admin.post('/api/registres', {
      kind: 'plan_actions',
      name: 'Plan délégué fictif',
      referenceId: DEFAULT_SMSI,
      perimetres: [],
    });
    expect(reg.statusCode, reg.body).toBe(201);
    const g = await admin.put(`/api/droits/registre/${reg.json().id}`, {
      subjectType: 'utilisateur',
      subjectId: delegueId,
      role: 'contributeur',
    });
    expect(g.statusCode, g.body).toBeLessThan(300);
    const r = await delegue.get(url);
    expect(r.statusCode, r.body).toBe(200);
  });
});
