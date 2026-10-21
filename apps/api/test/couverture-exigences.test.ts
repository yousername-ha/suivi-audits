/* Évaluation des exigences (ADR 0041, lot H3) : versions immuables, états de couverture, cohérence, droits (la validation
   métier relève de l'administration du Pilotage), concurrence optimiste et indépendance entre périmètres. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, writer: Agent, reader: Agent, parent: string, enfant: string, fw: string;
const def: FrameworkDefinition = {
  name: 'Référentiel de couverture',
  identifier: 'COUV-FICTIF',
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-18',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'd', label: 'Domaine' }],
  requirements: [
    {
      id: 'R1',
      domain: 'd',
      title: 'Première exigence fictive',
      description: 'Fictif',
      applicability: '',
      measureRefs: [],
    },
    {
      id: 'R2',
      domain: 'd',
      title: 'Deuxième exigence fictive',
      description: 'Fictif',
      applicability: '',
      measureRefs: [],
    },
  ],
};
const base = {
  applicability: 'applicable',
  implementation: 'partielle',
  reason: 'Revue de recette',
  confirm: 'EVALUER',
};
const url = (smsi: string, req = 'R1') => `/api/grc/${smsi}/exigences/${fw}/${req}/evaluations`;
const evaluer = (smsi: string, corps: Record<string, unknown>, attendue: number, agent = admin, req = 'R1') =>
  agent.post(url(smsi, req), corps, { 'if-match': `"${attendue}"` });
const detail = async (smsi: string) =>
  (await admin.get(`/api/grc/${smsi}/couverture?frameworkId=${fw}`)).json() as {
    frameworks: { etats: Record<string, number> }[];
    detail: { id: string; etat: string; sansMesure: boolean; evaluation: { version: number } | null }[];
  };

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'couv_admin', 'admin'));
  const uw = await makeUser(t, 'couv_writer', 'rw'),
    ur = await makeUser(t, 'couv_reader', 'ro');
  const p = await admin.post('/api/library/frameworks/preview', { id: null, definition: def });
  const r = await admin.post(
    '/api/library/frameworks/publish',
    { id: null, definition: def, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  fw = r.json().id;
  const creer = async (name: string, extra: Record<string, unknown> = {}) =>
    (
      await admin.post('/api/grc/smsis', { name, scope: 'Recette', nature: '', timezone: 'Europe/Paris', ...extra })
    ).json().id as string;
  parent = await creer('Parent couverture');
  enfant = await creer('Enfant couverture', { parentId: parent, inheritFrameworks: true });
  for (const smsi of [parent, enfant])
    for (const [u, write] of [
      [uw, true],
      [ur, false],
    ] as const)
      expect(
        (await admin.put(`/api/grc/${smsi}/members`, { userId: (u as { id: string }).id, write })).statusCode,
      ).toBe(204);
  for (const smsi of [parent])
    expect(
      (await admin.put(`/api/grc/${smsi}/framework-attachments/${fw}`, { version: 1, confirm: 'RATTACHER' }))
        .statusCode,
    ).toBe(200);
  // Les accès sont attribués avant la connexion des comptes (une modification d'accès referme leurs sessions).
  writer = await login(t, uw);
  reader = await login(t, ur);
});
afterAll(() => t.close());

describe('états de couverture', () => {
  it('sans évaluation : non implémenté, applicabilité à déterminer', async () => {
    const d = await detail(parent);
    expect(d.detail.map((x) => [x.id, x.etat, x.evaluation])).toEqual([
      ['R1', 'non_implemente', null],
      ['R2', 'non_implemente', null],
    ]);
    expect(d.frameworks[0]!.etats).toMatchObject({ non_implemente: 2, applicables: 2, aDeterminer: 2 });
  });
  it('progresse : partiel, implémenté, testé, puis validé métier par un administrateur du Pilotage', async () => {
    let r = await evaluer(parent, base, 0);
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ version: 1, etat: 'partiel' });
    expect((await detail(parent)).detail[0]).toMatchObject({ etat: 'partiel', sansMesure: true });
    r = await evaluer(parent, { ...base, implementation: 'complete' }, 1);
    expect(r.json().etat).toBe('implemente');
    const teste = {
      ...base,
      implementation: 'complete',
      testedAt: '2026-10-10',
      testResult: 'conforme',
      testRef: 'document:fictif:1',
    };
    r = await evaluer(parent, teste, 2);
    expect(r.json().etat).toBe('teste');
    // Le contributeur n'a pas le droit de valider : décision de pilotage.
    const refus = await evaluer(parent, { ...teste, validatedAt: '2026-10-12' }, 3, writer);
    expect(refus.statusCode, refus.body).toBe(403);
    r = await evaluer(parent, { ...teste, validatedAt: '2026-10-12', validationNote: 'Validé en revue' }, 3);
    expect(r.json()).toMatchObject({ version: 4, etat: 'valide_metier' });
    const d = await detail(parent);
    expect(d.detail[0]).toMatchObject({ etat: 'valide_metier' });
    expect(d.frameworks[0]!.etats).toMatchObject({ valide_metier: 1, non_implemente: 1 });
  });
  it('abaisser la mise en œuvre exige de retirer explicitement la validation ; on ne teste pas sans mise en œuvre', async () => {
    const ko = await evaluer(parent, { ...base, implementation: 'partielle', validatedAt: '2026-10-12' }, 4);
    expect(ko.statusCode, ko.body).toBe(422);
    const sans = await evaluer(
      parent,
      { ...base, implementation: 'aucune', testedAt: '2026-10-10', testResult: 'conforme' },
      4,
    );
    expect(sans.statusCode, sans.body).toBe(422);
    const ok = await evaluer(parent, { ...base, implementation: 'partielle' }, 4);
    expect(ok.json()).toMatchObject({ version: 5, etat: 'partiel' });
  });
  it('une exigence exclue est justifiée et sort du total applicable', async () => {
    expect((await evaluer(parent, { ...base, applicability: 'exclue' }, 0, admin, 'R2')).statusCode).toBe(422);
    const r = await evaluer(
      parent,
      { ...base, applicability: 'exclue', justification: 'Hors périmètre' },
      0,
      admin,
      'R2',
    );
    expect(r.json().etat).toBe('non_applicable');
    expect((await detail(parent)).frameworks[0]!.etats).toMatchObject({
      non_applicable: 1,
      applicables: 1,
      aDeterminer: 0,
    });
  });
});

describe('contrôles', () => {
  it('refuse une version obsolète (412), une exigence ou un référentiel inconnus (404), un corps incohérent (422)', async () => {
    expect((await evaluer(parent, base, 2)).statusCode).toBe(412);
    expect((await evaluer(parent, base, 0, admin, 'R9')).statusCode).toBe(404);
    const inconnu = await admin.post(`/api/grc/${parent}/exigences/${crypto.randomUUID()}/R1/evaluations`, base, {
      'if-match': '"0"',
    });
    expect(inconnu.statusCode).toBe(404);
    expect((await evaluer(parent, { ...base, testedAt: '2026-10-10' }, 5)).statusCode).toBe(422);
    expect((await evaluer(parent, { ...base, reason: '' }, 5)).statusCode).toBe(422);
    expect((await admin.post(url(parent), base)).statusCode).toBe(428);
  });
  it('un lecteur consulte l’historique mais n’enregistre rien', async () => {
    expect((await evaluer(parent, base, 5, reader)).statusCode).toBe(403);
    const h = await reader.get(url(parent));
    expect(h.statusCode).toBe(200);
    expect(h.json().map((e: { version: number }) => e.version)).toEqual([5, 4, 3, 2, 1]);
    expect(h.json()[3]).toMatchObject({ version: 2, etat: 'implemente' });
  });
  it('les versions sont immuables, même pour la base', async () => {
    await expect(t.svc.db.q("UPDATE grc_requirement_assessments SET reason='x' WHERE version=1")).rejects.toThrow();
    await expect(t.svc.db.q('DELETE FROM grc_requirement_assessments')).rejects.toThrow();
  });
  it('la base refuse une validation sans test conforme, hors API', async () => {
    await expect(
      t.svc.db.q(
        `INSERT INTO grc_requirement_assessments(smsi_id,framework_id,framework_version,requirement_id,version,applicability,implementation,
           validated_at,validated_by,reason,created_by) VALUES($1,$2,1,'R2',9,'applicable','complete','2026-10-12','x','motif','x')`,
        [parent, fw],
      ),
    ).rejects.toThrow(/validation_etablie/);
  });
  it('journalise chaque évaluation', async () => {
    const n = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='grc.exigence.evaluated'",
    );
    expect(n!.n).toBeGreaterThanOrEqual(6);
  });
});

describe('périmètres hiérarchiques', () => {
  it('l’enfant qui hérite du référentiel évalue ses exigences sans toucher à celles du parent', async () => {
    const avant = await detail(enfant);
    expect(avant.detail.map((x) => x.etat)).toEqual(['non_implemente', 'non_implemente']);
    const r = await evaluer(enfant, { ...base, implementation: 'complete' }, 0);
    expect(r.statusCode, r.body).toBe(201);
    expect((await detail(enfant)).detail[0]).toMatchObject({ etat: 'implemente' });
    expect((await detail(parent)).detail[0]).toMatchObject({ etat: 'partiel' });
  });
  it('un référentiel désactivé localement ne peut plus être évalué', async () => {
    await admin.put(`/api/grc/${enfant}/framework-attachments/${fw}`, { version: 1, confirm: 'RATTACHER' });
    await admin.put(`/api/grc/${enfant}/framework-attachments/${fw}/activation`, { enabled: false });
    expect((await evaluer(enfant, base, 1)).statusCode).toBe(404);
  });
});

describe('liens et réalisations : aucune évaluation automatique', () => {
  it('un écart et une action reliés à une exigence, puis l’action terminée, laissent l’évaluation et l’état inchangés', async () => {
    const exigence = `requirement:${fw}:1:R1`;
    // L'état d'exigence et l'évaluation ne dépendent que des évaluations saisies : le rattachement de mesures s'affiche à
    // côté (couverture de traçabilité), il ne change ni l'un ni l'autre.
    const lire = async () => {
      const d = (await detail(parent)).detail[0]!;
      return { etat: d.etat, evaluation: d.evaluation, historique: (await admin.get(url(parent))).json() };
    };
    const avant = await lire();
    const ecart = await admin.post(`/api/grc/${parent}/objects`, {
      kind: 'nonconformity',
      name: 'Écart sur l’exigence',
      data: { cause: 'Cause de recette', refs: [exigence] },
    });
    expect(ecart.statusCode, ecart.body).toBe(200);
    const action = await admin.post(`/api/grc/${parent}/objects`, {
      kind: 'action',
      name: 'Action sur l’exigence',
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
    expect(action.statusCode, action.body).toBe(200);
    const lien = await admin.post(`/api/grc/${parent}/links`, {
      source: 'object:' + action.json().id,
      target: exigence,
      type: 'implements',
      note: 'Met en œuvre l’exigence',
    });
    expect(lien.statusCode, lien.body).toBe(200);
    // L'action avance puis se termine : ni l'écart ni l'évaluation de l'exigence ne bougent d'eux-mêmes.
    let o = action.json();
    for (const [status, justification] of [
      ['progress', ''],
      ['done', 'Mesure vérifiée et preuve disponible'],
    ] as const) {
      const r = await admin.put(
        `/api/grc/${parent}/objects/${o.id}`,
        { kind: 'action', name: o.name, data: { ...o.data, status, justification } },
        { 'if-match': `"${o.version}"` },
      );
      expect(r.statusCode, r.body).toBe(200);
      o = r.json();
    }
    expect(await lire()).toEqual(avant);
    const ecartApres = (await admin.get(`/api/grc/${parent}/objects/${ecart.json().id}`)).json();
    expect(ecartApres.data.status ?? 'open').not.toBe('closed');
  });
});
