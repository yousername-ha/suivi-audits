/* Déplacer un élément n'accorde pas à un contributeur de module une autorité d'attribution qu'il n'avait pas et ne rend pas
   l'élément restreint (ADR 0043, ADR 0067 §1/§3) : le rôle de gestionnaire donné automatiquement au créateur d'un registre ne
   suffit pas pour cela. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const action = (name: string) => ({
  kind: 'action',
  name,
  data: {
    description: '',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: null,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
});

describe('déplacement vers un registre créé par le demandeur', () => {
  let t: TestApp;
  let admin: Agent, contrib: Agent, rssi: Agent, tiers: Agent;
  let A: string, contribId: string, tiersId: string, E: string;
  const version = async (id: string) =>
    (await t.svc.db.one<{ version: number }>('SELECT version FROM grc_objects WHERE id=$1', [id]))!.version;
  const deplacer = async (a: Agent, objet: string, registreId: string) =>
    a.post(
      `/api/grc/${A}/objects/${objet}/deplacement`,
      { registreId, reason: 'Réorganisation fictive du plan.' },
      { 'if-match': `"${await version(objet)}"` },
    );
  const nouveauPlan = async (a: Agent, nom: string, restreint: boolean) =>
    (
      await a.post('/api/registres', {
        kind: 'plan_actions',
        name: nom,
        description: '',
        referenceId: A,
        perimetres: [],
        restreint,
      })
    ).json().id as string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'da_admin', 'admin'));
    const c = await makeUser(t, 'da_contrib', 'rw');
    contribId = c.id;
    const r = await makeUser(t, 'da_rssi', 'rssi');
    const ti = await makeUser(t, 'da_tiers', null);
    tiersId = ti.id;
    A = (
      await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'A', timezone: 'Europe/Paris' })
    ).json().id;
    for (const id of [contribId, r.id])
      expect((await admin.put(`/api/grc/${A}/members`, { userId: id, write: true })).statusCode).toBe(204);
    contrib = await login(t, c);
    rssi = await login(t, r);
    tiers = await login(t, ti);
    E = (await admin.post(`/api/grc/${A}/objects`, action('Action fictive créée par l’administrateur'))).json().id;
  });
  afterAll(async () => t.close());

  it('un contributeur ne déplace pas l’action d’autrui vers un registre restreint qu’il vient de créer', async () => {
    const perso = await nouveauPlan(contrib, 'Plan restreint personnel', true);
    const apercu = await contrib.post(`/api/grc/${A}/objects/${E}/deplacement`, { registreId: perso, apercu: true });
    expect(apercu.statusCode, apercu.body).toBe(403);
    const dep = await deplacer(contrib, E, perso);
    expect(dep.statusCode, dep.body).toBe(403);
    const ligne = await t.svc.db.one<{ registre_id: string }>('SELECT registre_id FROM grc_objects WHERE id=$1', [E]);
    expect(ligne!.registre_id).not.toBe(perso);
    // L'élément reste visible de qui le voyait.
    expect((await rssi.get(`/api/grc/${A}/objects/${E}`)).statusCode).toBe(200);
    expect((await tiers.get(`/api/grc/${A}/objects/${E}`)).statusCode).not.toBe(200);
  });

  it('ni vers un registre non restreint dont il n’est que le créateur (autorité d’attribution acquise par le déplacement)', async () => {
    const ouvert = await nouveauPlan(contrib, 'Plan ouvert personnel', false);
    const dep = await deplacer(contrib, E, ouvert);
    expect(dep.statusCode, dep.body).toBe(403);
  });

  it('témoin : un déplacement ordinaire entre deux plans ouverts gérés par le module reste permis', async () => {
    const plan = await nouveauPlan(admin, 'Plan ouvert géré par le module', false);
    const dep = await deplacer(contrib, E, plan);
    expect(dep.statusCode, dep.body).toBe(200);
  });

  it('témoin : l’administrateur, ou un gestionnaire dont le rôle a été attribué, déplace vers un registre restreint', async () => {
    const restreint = await nouveauPlan(admin, 'Plan restreint administré', true);
    const g = await admin.put(`/api/droits/registre/${restreint}`, {
      subjectType: 'utilisateur',
      subjectId: contribId,
      role: 'gestionnaire',
    });
    expect(g.statusCode, g.body).toBeLessThan(300);
    const dep = await deplacer(contrib, E, restreint);
    expect(dep.statusCode, dep.body).toBe(200);
    expect((await deplacer(admin, E, await nouveauPlan(admin, 'Autre plan restreint', true))).statusCode).toBe(200);
    expect(tiersId).toBeTruthy();
  });
});
