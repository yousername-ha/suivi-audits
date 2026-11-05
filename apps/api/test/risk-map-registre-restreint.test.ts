/* La carte des risques, son graphe et le rapport de comité n'exposent pas les éléments d'un registre restreint à
   qui n'a pas de droit attribué sur ce registre (ADR 0043). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { methodTemplate } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

describe('carte des risques et registre restreint', () => {
  let t: TestApp, admin: Agent, lecteur: Agent, A: string, lecteurId: string;
  let riskId: string, treatId: string, actionId: string, restreint: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'rm_admin', 'admin'));
    const l = await makeUser(t, 'rm_lecteur', 'ro');
    lecteurId = l.id;
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre fictif', scope: 'X', timezone: 'Europe/Paris' })).json()
      .id;
    expect((await admin.put(`/api/grc/${A}/members`, { userId: l.id, write: false })).statusCode).toBeLessThan(300);
    lecteur = await login(t, l);
    const definition = methodTemplate('custom');
    const p = await admin.post(`/api/grc/${A}/methods/preview`, { id: null, definition });
    const pub = await admin.post(
      `/api/grc/${A}/methods/publish`,
      {
        id: null,
        definition,
        previewId: p.json().previewId,
        reason: 'Politique fictive de recette',
        confirm: 'PUBLIER',
      },
      { 'if-match': '"0"' },
    );
    expect(pub.statusCode, pub.body).toBe(200);
    const r = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'risk',
      name: 'Risque fictif',
      data: {
        description: 'x',
        code: 'R1',
        ownerId: null,
        methodId: pub.json().methodId,
        methodVersion: 1,
        domain: 'information',
        entity: 'E',
        scope: 'S',
        strategy: 'reduce',
        acceptanceReason: '',
        reviewAt: '2027-01-01',
        stages: {},
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    riskId = r.json().id;
    const tr = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'treatment',
      name: 'Traitement fictif',
      data: { description: '' },
    });
    expect(tr.statusCode, tr.body).toBe(200);
    treatId = tr.json().id;
    const ln = await admin.post(`/api/grc/${A}/links`, {
      source: 'object:' + treatId,
      target: 'object:' + riskId,
      type: 'related_to',
      note: '',
    });
    expect(ln.statusCode, ln.body).toBeLessThan(300);
    restreint = (
      await admin.post('/api/registres', {
        kind: 'plan_actions',
        name: 'Plan restreint fictif',
        referenceId: A,
        perimetres: [],
        restreint: true,
      })
    ).json().id;
    const ac = await admin.post(`/api/grc/${A}/treatments/${treatId}/action`, {
      name: 'Action restreinte fictive',
      dueAt: null,
      ownerId: null,
      registreId: restreint,
    });
    expect(ac.statusCode, ac.body).toBe(200);
    actionId = ac.json().id;
  });
  afterAll(() => t.close());

  type Carte = { nodes: { ref: string; name: string }[]; edges: { source_ref: string; target_ref: string }[] };
  const carte = async (a: Agent, query = '') => {
    const r = await a.get(`/api/grc/${A}/risk-map${query}`);
    expect(r.statusCode, r.body).toBe(200);
    return r.json() as Carte;
  };
  const contient = (m: Carte) =>
    m.nodes.some((n) => n.ref === 'object:' + actionId) ||
    m.edges.some((e) => e.source_ref === 'object:' + actionId || e.target_ref === 'object:' + actionId);

  it('témoins : l’élément est introuvable en direct et absent des listes pour le lecteur', async () => {
    expect((await lecteur.get(`/api/grc/${A}/objects/${actionId}`)).statusCode).toBe(404);
    const liste = (await lecteur.get(`/api/grc/${A}/objects?kind=action`)).json();
    expect((liste.items as { id: string }[]).some((x) => x.id === actionId)).toBe(false);
  });

  it('le graphe de la carte ne contient ni nœud ni arête de l’élément restreint, et le risque reste visible', async () => {
    const m = await carte(lecteur);
    expect(contient(m)).toBe(false);
    expect(m.nodes.some((n) => n.ref === 'object:' + riskId)).toBe(true);
    expect(m.nodes.some((n) => n.ref === 'object:' + treatId)).toBe(true);
    expect(JSON.stringify(m)).not.toContain('Action restreinte fictive');
  });

  it('la traversée par relatedRef ne franchit pas l’élément restreint', async () => {
    const m = await carte(lecteur, `?relatedRef=${encodeURIComponent('object:' + treatId)}`);
    expect(contient(m)).toBe(false);
    expect(JSON.stringify(m)).not.toContain('Action restreinte fictive');
  });

  it('l’administrateur voit toujours l’élément restreint', async () => {
    expect(contient(await carte(admin))).toBe(true);
  });

  it('le rapport de comité ne le divulgue pas au lecteur', async () => {
    const r = await lecteur.get(`/api/grc/${A}/report`);
    if (r.statusCode === 200) expect(r.body).not.toContain('Action restreinte fictive');
    else expect([403, 404]).toContain(r.statusCode);
    const adm = await admin.get(`/api/grc/${A}/report`);
    expect(adm.statusCode, adm.body).toBe(200);
  });

  it('après attribution du rôle lecteur sur le registre, l’élément apparaît', async () => {
    const g = await admin.put(`/api/droits/registre/${restreint}`, {
      subjectType: 'utilisateur',
      subjectId: lecteurId,
      role: 'lecteur',
    });
    expect(g.statusCode, g.body).toBeLessThan(300);
    expect(contient(await carte(lecteur))).toBe(true);
  });
});
