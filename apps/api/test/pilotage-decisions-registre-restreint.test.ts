/* L'historique des décisions de pilotage et l'export du registre filtrent, à la lecture, ce que les décisions citent :
   une action d'un registre restreint illisible pour le lecteur n'y laisse ni identifiant ni nom (ADR 0043). Fictif. */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const base = `/api/grc/${DEFAULT_SMSI}`;

describe('décisions de pilotage et registre restreint', () => {
  let t: TestApp, admin: Agent, lecteur: Agent, exporteur: Agent;
  let document = '',
    ecart = '',
    actionOuverte = '',
    actionRestreinte = '',
    restreint = '',
    lecteurId = '';
  const NOM_RESTREINT = 'Action confidentielle fictive';

  const decide = async (ref: string, operation: string, result: string, version: number, extra = {}) =>
    admin.post(
      base + '/pilotage/decisions',
      {
        ref,
        decision: {
          operation,
          result,
          date: '2026-10-10',
          note: 'Justification détaillée de la recette métier',
          refs: [document],
          requestId: crypto.randomUUID(),
          step: '',
          createFinding: false,
          createAction: false,
          confirm: 'ENREGISTRER',
          ...extra,
        },
      },
      { 'if-match': `"${version}"` },
    );

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'pd_admin', 'admin'));
    const l = await makeUser(t, 'pd_lecteur', 'ro');
    lecteurId = l.id;
    lecteur = await login(t, l);
    exporteur = await login(t, await makeUser(t, 'pd_exporteur', 'rssi'));
    const doc = await admin.req('POST', '/api/documents', {
      body: Buffer.from('Justificatif de recette'),
      headers: {
        'x-file-name': 'preuve.txt',
        'x-meta': encodeURIComponent(JSON.stringify({ title: 'Justificatif fictif' })),
      },
    });
    expect(doc.statusCode, doc.body).toBe(201);
    document = 'document:' + doc.json().id + ':1';
    restreint = (
      await admin.post('/api/registres', {
        kind: 'plan_actions',
        name: 'Plan restreint fictif',
        referenceId: DEFAULT_SMSI,
        perimetres: [],
        restreint: true,
      })
    ).json().id;
    const c = await admin.post(base + '/objects', {
      kind: 'control',
      name: 'Contrôle fictif',
      data: {
        objective: 'Vérifier',
        scope: 'Recette',
        method: 'Comparer les pièces',
        criteria: 'Aucune perte',
        dueAt: '2026-10-10',
        refs: [],
      },
    });
    expect(c.statusCode, c.body).toBe(200);
    const r = await decide('object:' + c.json().id, 'control_execution', 'fail', 1, {
      createFinding: true,
      createAction: true,
    });
    expect(r.statusCode, r.body).toBe(200);
    [ecart, actionOuverte] = r.json().generatedRefs as string[];
    // Une seconde action, d'un registre restreint, liée à l'écart.
    const ac = await admin.post(`${base}/objects`, {
      kind: 'action',
      name: NOM_RESTREINT,
      registreId: restreint,
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
    expect(ac.statusCode, ac.body).toBe(200);
    actionRestreinte = 'object:' + ac.json().id;
    const ln = await admin.post(`${base}/links`, {
      source: actionRestreinte,
      target: ecart,
      type: 'treats',
      note: '',
    });
    expect(ln.statusCode, ln.body).toBeLessThan(300);
    const lire = async () => (await admin.get(base + '/objects/' + ecart!.slice(7))).json();
    let f = await lire();
    f = (
      await admin.put(
        base + '/objects/' + f.id,
        { kind: 'nonconformity', name: f.name, data: { ...f.data, cause: 'Cause identifiée par analyse détaillée' } },
        { 'if-match': `"${f.version}"` },
      )
    ).json();
    expect((await decide(ecart, 'effectiveness', 'effective', f.version)).statusCode).toBe(200);
    f = await lire();
    const ok = await decide(ecart, 'close', 'completed', f.version, {
      openLinksReason: 'Actions reprises au plan annuel, clôture décidée en revue de direction.',
    });
    expect(ok.statusCode, ok.body).toBe(200);
  });
  afterAll(() => t.close());

  it('témoin : l’action restreinte est introuvable pour le lecteur, et l’administrateur voit tout', async () => {
    expect((await lecteur.get(`${base}/objects/${actionRestreinte.slice(7)}`)).statusCode).toBe(404);
    const h = await admin.get(`${base}/pilotage/history?ref=${encodeURIComponent(ecart)}`);
    expect(h.statusCode, h.body).toBe(200);
    expect(h.body).toContain(actionRestreinte);
    expect(h.body).toContain(NOM_RESTREINT);
  });

  it('historique : le lecteur ne reçoit ni identifiant ni nom de l’action restreinte, seulement un compteur', async () => {
    const h = await lecteur.get(`${base}/pilotage/history?ref=${encodeURIComponent(ecart)}`);
    expect(h.statusCode, h.body).toBe(200);
    expect(h.body).not.toContain(actionRestreinte.slice(7));
    expect(h.body).not.toContain(NOM_RESTREINT);
    const cloture = (h.json().items as { operation: string; terms: { openLinks?: Record<string, unknown> } }[]).find(
      (i) => i.operation === 'close',
    )!;
    expect(cloture.terms.openLinks!.actionsMasquees).toBe(1);
    expect(JSON.stringify(cloture.terms.openLinks!.actions)).toContain(actionOuverte);
  });

  it('export du registre : même filtre', async () => {
    const r = await exporteur.get(`${base}/pilotage/export?kind=nonconformity`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.body).toContain(ecart.slice(7));
    expect(r.body).not.toContain(actionRestreinte.slice(7));
    expect(r.body).not.toContain(NOM_RESTREINT);
  });

  it('après attribution du rôle lecteur sur le registre, l’action réapparaît', async () => {
    const g = await admin.put(`/api/droits/registre/${restreint}`, {
      subjectType: 'utilisateur',
      subjectId: lecteurId,
      role: 'lecteur',
    });
    expect(g.statusCode, g.body).toBeLessThan(300);
    const h = await lecteur.get(`${base}/pilotage/history?ref=${encodeURIComponent(ecart)}`);
    expect(h.body).toContain(actionRestreinte);
    expect(h.body).toContain(NOM_RESTREINT);
  });
});
