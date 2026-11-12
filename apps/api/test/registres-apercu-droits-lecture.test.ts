/* Les aperçus d'impact (déplacement, périmètres) ne nomment que les éléments et périmètres que l'appelant peut lire ;
   les autres sont comptés (ADR 0043 §6). Gestionnaire attribué sans droit de lecture. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const action = (name: string, registreId: string) => ({
  kind: 'action',
  name,
  registreId,
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

describe('aperçus d’impact et droits de lecture', () => {
  let t: TestApp;
  let admin: Agent, u: Agent;
  let A: string, C: string, D: string, rA: string, rC: string, E: string, X: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'd02_admin', 'admin'));
    const uu = await makeUser(t, 'd02_gest', null);
    const p = async (n: string) =>
      (await admin.post('/api/grc/smsis', { name: n, scope: n, timezone: 'Europe/Paris' })).json().id as string;
    A = await p('Perimetre fictif A');
    C = await p('Perimetre fictif C');
    D = await p('Perimetre fictif D secret');
    const r1 = await admin.post('/api/registres', { kind: 'plan_actions', name: 'Plan fictif A', referenceId: A });
    expect(r1.statusCode, r1.body).toBe(201);
    rA = r1.json().id;
    rC = (await admin.post('/api/registres', { kind: 'plan_actions', name: 'Plan fictif C', referenceId: C })).json()
      .id;
    const e = await admin.post(`/api/grc/${A}/objects`, action('Action fictive E', rA));
    expect(e.statusCode, e.body).toBe(200);
    E = e.json().id;
    const x = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'nonconformity',
      name: 'Objet fictif A',
      data: { cause: 'Cause fictive' },
    });
    expect(x.statusCode, x.body).toBe(200);
    X = x.json().id;
    const l = await admin.post(`/api/grc/${A}/links`, {
      source: 'object:' + E,
      target: 'object:' + X,
      type: 'treats',
      note: '',
    });
    expect(l.statusCode, l.body).toBe(200);
    // Rattache D (restreint, sans membre) à rA.
    const v = (await t.svc.db.one<{ version: number }>('SELECT version FROM registres WHERE id=$1', [rA]))!.version;
    const att = await admin.put(
      `/api/registres/${rA}/perimetres`,
      { perimetres: [A, D], reason: 'Rattachement fictif de recette.' },
      { 'if-match': `"${v}"` },
    );
    expect(att.statusCode, att.body).toBe(200);
    for (const reg of [rA, rC]) {
      const g = await admin.put(`/api/droits/registre/${reg}`, {
        subjectType: 'utilisateur',
        subjectId: uu.id,
        role: 'gestionnaire',
      });
      expect(g.statusCode, g.body).toBeLessThan(300);
    }
    u = await login(t, uu);
  });
  afterAll(async () => t.close());

  it('contrôles : vues normales masquent X et les noms de A/D', async () => {
    const gx = await u.get(`/api/grc/${A}/objects/${X}`);
    expect(gx.statusCode).toBe(404);
    const gl = await u.get(`/api/grc/${A}/links?ref=object:${E}`);
    expect([403, 404]).toContain(gl.statusCode);
    const gr = await u.get(`/api/registres/${rA}`);
    expect(gr.statusCode).toBe(200);
    expect(gr.json().perimetres).toEqual([]);
    expect(gr.json().autresPerimetres).toBe(2);
  });

  it('aperçu de déplacement : l’extrémité d’un lien illisible et le périmètre secret ne sont pas nommés', async () => {
    const r = await u.post(`/api/grc/${A}/objects/${E}/deplacement`, { registreId: rC, apercu: true });
    expect(r.statusCode, r.body).toBe(200);
    const imp = r.json().impact;
    expect(imp.liensIncompatibles).toEqual([]);
    expect(imp.liensMasques).toBe(1);
    expect(imp.depuis.perimetres).toEqual([]);
    expect(imp.depuis.autresPerimetres).toBe(2);
    expect(r.body).not.toContain('Objet fictif A');
    expect(r.body).not.toContain('Perimetre fictif D secret');
    expect(r.body).not.toContain('Perimetre fictif A');
  });

  it('le retrait des liens reste exigé quand ils sont masqués, puis le déplacement les retire', async () => {
    const v = (await t.svc.db.one<{ version: number }>('SELECT version FROM grc_objects WHERE id=$1', [E]))!.version;
    const sans = await u.post(
      `/api/grc/${A}/objects/${E}/deplacement`,
      { registreId: rC, reason: 'Déplacement fictif de recette.' },
      { 'if-match': `"${v}"` },
    );
    expect(sans.statusCode, sans.body).toBe(409);
  });

  it('aperçu de périmètres : le périmètre retiré n’est pas nommé, il est compté', async () => {
    const r = await u.put(`/api/registres/${rA}/perimetres`, { perimetres: [A], apercu: true });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().impact.retires).toEqual([]);
    expect(r.json().impact.autresPerimetres).toBe(1);
    expect(r.body).not.toContain('Perimetre fictif D secret');
  });

  it('témoin : l’administrateur voit les noms', async () => {
    const r = await admin.post(`/api/grc/${A}/objects/${E}/deplacement`, { registreId: rC, apercu: true });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().impact.liensIncompatibles).toContainEqual({
      ref: 'object:' + X,
      type: 'treats',
      nom: 'Objet fictif A',
    });
    expect(r.json().impact.liensMasques).toBe(0);
    expect(r.json().impact.depuis.perimetres.length).toBe(2);
  });
});
