/* Fournisseurs de l'organisation (ADR 0032, lot M4) : registre historique sans copie, critères définis par l'organisme
   (aucun fourni), évaluations immuables indépendantes des périmètres, rattachement à plusieurs périmètres. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp,
  a: Agent,
  reader: Agent,
  contributor: Agent,
  outsider: Agent,
  outsiderUser: TestUser,
  scopeA: string,
  scopeB: string,
  restricted: string,
  fw: string,
  supplier: string,
  crit1: { id: string; version: number },
  crit2: { id: string; version: number };
const REQ = () => `requirement:${fw}:1:SUP-REQ-1`;
const evalBody = (items: { criterionId: string; meets: boolean | null; result?: string }[], extra = {}) => ({
  evaluatedAt: '2026-10-01',
  conclusion: 'Évaluation fictive de recette',
  nextReviewAt: null,
  items,
  confirm: 'ENREGISTRER',
  ...extra,
});
const critBody = (label: string, extra = {}) => ({
  label,
  description: 'Critère fictif de recette',
  purposes: ['evaluation'],
  requirementRefs: [],
  reason: 'Définition fictive de recette',
  ...extra,
});

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'sup_admin', 'admin'));
  const readerUser = await makeUser(t, 'sup_reader', 'ro'),
    writerUser = await makeUser(t, 'sup_writer', 'rw');
  outsiderUser = await makeUser(t, 'sup_outsider', 'rw');
  const def: FrameworkDefinition = {
    name: 'Référentiel fournisseurs fictif',
    identifier: 'SUP-FW',
    source: {
      organisation: 'Organisation fictive',
      document: 'Document de recette',
      url: 'https://example.invalid/recette',
      version: '1',
      date: '2026-10-13',
      license: 'Données fictives de test',
      verifiedAt: '',
      normative: false,
      status: 'organisation',
    },
    domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
    requirements: [
      {
        id: 'SUP-REQ-1',
        domain: 'gouvernance',
        title: 'Exigence fictive',
        description: 'Fictif',
        applicability: 'Tout',
        measureRefs: [],
      },
    ],
  };
  const p = await a.post('/api/library/frameworks/preview', { id: null, definition: def });
  const r = await a.post(
    '/api/library/frameworks/publish',
    {
      id: null,
      definition: def,
      previewId: p.json().previewId,
      reason: 'Publication fictive de recette',
      confirm: 'PUBLIER',
    },
    { 'if-match': '"0"' },
  );
  fw = r.json().id;
  const mk = async (name: string, extra = {}) =>
    (await a.post('/api/grc/smsis', { name, scope: 'Recette', timezone: 'Europe/Paris', ...extra })).json()
      .id as string;
  scopeA = await mk('Périmètre fournisseurs A');
  scopeB = await mk('Périmètre fournisseurs B');
  restricted = await mk('Périmètre fournisseurs restreint');
  // Un périmètre est restreint à sa création : on y donne l'accès (la désignation ferme les sessions de la personne).
  for (const s of [scopeA, scopeB]) {
    expect((await a.put(`/api/grc/${s}/members`, { userId: writerUser.id, write: true })).statusCode).toBe(204);
    expect((await a.put(`/api/grc/${s}/members`, { userId: readerUser.id, write: false })).statusCode).toBe(204);
  }
  reader = await login(t, readerUser);
  contributor = await login(t, writerUser);
  outsider = await login(t, outsiderUser);
});
afterAll(() => t.close());

describe('registre et critères', () => {
  it('ne fournit ni fournisseur ni critère au départ', async () => {
    expect((await reader.get('/api/suppliers')).json()).toEqual([]);
    expect((await reader.get('/api/suppliers/criteria')).json()).toEqual([]);
  });
  it('crée un fournisseur dans le registre historique, sans doublon de nom', async () => {
    expect((await reader.post('/api/suppliers', { name: 'Fournisseur fictif' })).statusCode).toBe(403);
    const before = (await a.get('/api/legacy/state')).json();
    const r = await contributor.post('/api/suppliers', { name: 'Fournisseur fictif' });
    expect(r.statusCode, r.body).toBe(200);
    supplier = r.json().id;
    expect(supplier).toBe('SUP-001');
    expect((await contributor.post('/api/suppliers', { name: 'fournisseur FICTIF' })).statusCode).toBe(409);
    const after = (await a.get('/api/legacy/state')).json();
    expect(after.suppliers.map((s: { id: string }) => s.id)).toEqual(['SUP-001']);
    expect(after.items).toEqual(before.items);
  });
  it('réserve la définition des critères au droit d’administration', async () => {
    expect((await contributor.post('/api/suppliers/criteria', critBody('Critère refusé'))).statusCode).toBe(403);
    const r1 = await a.post('/api/suppliers/criteria', critBody('Maîtrise de la sous-traitance'));
    expect(r1.statusCode, r1.body).toBe(200);
    crit1 = r1.json();
    const r2 = await a.post(
      '/api/suppliers/criteria',
      critBody('Mesures de sécurité', { purposes: ['selection', 'surveillance'], requirementRefs: [REQ()] }),
    );
    expect(r2.statusCode, r2.body).toBe(200);
    crit2 = r2.json();
    expect(crit2).toMatchObject({ purposes: ['selection', 'surveillance'], requirementRefs: [REQ()], version: 1 });
    expect((await a.post('/api/suppliers/criteria', critBody('MAÎTRISE de la sous-traitance'))).statusCode).toBe(409);
  });
  it('refuse une exigence absente de la bibliothèque et un usage inconnu', async () => {
    const absente = `requirement:${fw}:1:INCONNUE`;
    expect(
      (await a.post('/api/suppliers/criteria', critBody('Exigence absente', { requirementRefs: [absente] })))
        .statusCode,
    ).toBe(422);
    const version = `requirement:${fw}:9:SUP-REQ-1`;
    expect(
      (await a.post('/api/suppliers/criteria', critBody('Version absente', { requirementRefs: [version] }))).statusCode,
    ).toBe(404);
    expect(
      (await a.post('/api/suppliers/criteria', critBody('Usage inconnu', { purposes: ['note'] }))).statusCode,
    ).toBe(422);
  });
});

describe('évaluations immuables, sans périmètre', () => {
  let first: { id: string; items: unknown[] };
  it('enregistre une évaluation avec le libellé et la version du critère figés', async () => {
    expect(
      (await reader.post(`/api/suppliers/${supplier}/evaluations`, evalBody([{ criterionId: crit1.id, meets: true }])))
        .statusCode,
    ).toBe(403);
    const r = await contributor.post(
      `/api/suppliers/${supplier}/evaluations`,
      evalBody([
        { criterionId: crit1.id, meets: true, result: 'Contrat examiné' },
        { criterionId: crit2.id, meets: null },
      ]),
    );
    expect(r.statusCode, r.body).toBe(200);
    first = r.json();
    expect(first).toMatchObject({
      supplierName: 'Fournisseur fictif',
      items: expect.any(Array),
      evaluator: 'sup_writer',
    });
    expect(first.items).toHaveLength(2);
    const l = (await reader.get('/api/suppliers')).json()[0];
    expect(l.current).toMatchObject({ id: first.id, items: 2, meets: 1, notMeets: 0, notAssessed: 1 });
  });
  it('conserve l’ancienne évaluation intacte quand le critère change, puis la plus récente devient courante', async () => {
    const upd = await a.put(
      `/api/suppliers/criteria/${crit1.id}`,
      critBody('Maîtrise de la sous-traitance (révisé)', { reason: 'Libellé précisé' }),
      { 'if-match': '"1"' },
    );
    expect(upd.statusCode, upd.body).toBe(200);
    expect(upd.json().version).toBe(2);
    expect(
      (await a.put(`/api/suppliers/criteria/${crit1.id}`, critBody('Périmé'), { 'if-match': '"1"' })).statusCode,
    ).toBe(412);
    const hist = (await reader.get(`/api/suppliers/${supplier}/evaluations`)).json();
    expect(hist[0].items.find((i: { criterionId: string }) => i.criterionId === crit1.id)).toMatchObject({
      criterionLabel: 'Maîtrise de la sous-traitance',
      criterionVersion: 1,
    });
    const second = await a.post(
      `/api/suppliers/${supplier}/evaluations`,
      evalBody([{ criterionId: crit1.id, meets: false, result: 'Écart relevé' }], {
        evaluatedAt: '2026-10-10',
        nextReviewAt: '2020-01-01',
      }),
    );
    expect(second.statusCode).toBe(422);
    const ok = await a.post(
      `/api/suppliers/${supplier}/evaluations`,
      evalBody([{ criterionId: crit1.id, meets: false, result: 'Écart relevé' }], { evaluatedAt: '2026-10-10' }),
    );
    expect(ok.statusCode, ok.body).toBe(200);
    const h2 = (await reader.get(`/api/suppliers/${supplier}/evaluations`)).json();
    expect(h2.map((e: { id: string }) => e.id)).toEqual([ok.json().id, first.id]);
    expect((await reader.get('/api/suppliers')).json()[0].current.id).toBe(ok.json().id);
  });
  it('refuse les évaluations incohérentes', async () => {
    const post = (b: unknown, id = supplier) => a.post(`/api/suppliers/${id}/evaluations`, b);
    expect((await post(evalBody([{ criterionId: crit1.id, meets: true }]), 'SUP-404')).statusCode).toBe(404);
    expect(
      (await post(evalBody([{ criterionId: crit1.id, meets: true }], { evaluatedAt: '2999-01-01' }))).statusCode,
    ).toBe(422);
    expect((await post(evalBody([]))).statusCode).toBe(422);
    expect(
      (
        await post(
          evalBody([
            { criterionId: crit1.id, meets: true },
            { criterionId: crit1.id, meets: false },
          ]),
        )
      ).statusCode,
    ).toBe(422);
    expect((await post({ ...evalBody([{ criterionId: crit1.id, meets: true }]), confirm: 'OK' })).statusCode).toBe(422);
  });
  it('est immuable en base et refuse un critère retiré', async () => {
    await expect(t.svc.db.q('UPDATE sup_evaluations SET conclusion=$1', ['modifiée'])).rejects.toThrow();
    await expect(t.svc.db.q('DELETE FROM sup_evaluation_items')).rejects.toThrow();
    await expect(t.svc.db.q('DELETE FROM sup_criterion_history')).rejects.toThrow();
    const arch = await a.post(
      `/api/suppliers/criteria/${crit2.id}/archive`,
      { reason: 'Critère remplacé', confirm: 'RETIRER' },
      { 'if-match': '"1"' },
    );
    expect(arch.statusCode, arch.body).toBe(200);
    expect(arch.json().archived).toBe(true);
    expect((await a.get('/api/suppliers/criteria')).json().map((k: { id: string }) => k.id)).toEqual([crit1.id]);
    expect((await a.get('/api/suppliers/criteria?archived=true')).json()).toHaveLength(2);
    const r = await a.post(
      `/api/suppliers/${supplier}/evaluations`,
      evalBody([{ criterionId: crit2.id, meets: true }]),
    );
    expect(r.statusCode).toBe(422);
  });
});

describe('rattachement aux périmètres', () => {
  it('rattache le même fournisseur à deux périmètres sans copier l’évaluation', async () => {
    expect((await reader.put(`/api/grc/${scopeA}/suppliers/${supplier}`)).statusCode).toBe(403);
    expect((await contributor.put(`/api/grc/${scopeA}/suppliers/${supplier}`)).statusCode).toBe(200);
    expect((await contributor.put(`/api/grc/${scopeA}/suppliers/${supplier}`)).statusCode).toBe(409);
    expect((await contributor.put(`/api/grc/${scopeB}/suppliers/${supplier}`)).statusCode).toBe(200);
    expect((await contributor.put(`/api/grc/${scopeB}/suppliers/SUP-404`)).statusCode).toBe(404);
    const [la, lb] = await Promise.all(
      [scopeA, scopeB].map(async (s) => (await reader.get(`/api/grc/${s}/suppliers`)).json()),
    );
    expect(la.suppliers[0].current).toEqual(lb.suppliers[0].current);
    expect(la.summary).toEqual({ attached: 1, evaluated: 1, notEvaluated: 0, toReview: 0 });
    expect((await reader.get('/api/suppliers')).json()[0].scopes.sort()).toEqual([scopeA, scopeB].sort());
    expect((await t.svc.db.one<{ n: string }>('SELECT count(*)::text n FROM sup_evaluations'))!.n).toBe('2');
  });
  it('signale à réévaluer quand la date prévue est dépassée, dans tous les périmètres', async () => {
    const r = await a.post(
      `/api/suppliers/${supplier}/evaluations`,
      evalBody([{ criterionId: crit1.id, meets: true }], { evaluatedAt: '2025-01-01', nextReviewAt: '2025-06-01' }),
    );
    expect(r.statusCode, r.body).toBe(200);
    // La date d'évaluation la plus récente reste l'évaluation courante : 2026-10-10.
    const l = (await reader.get(`/api/grc/${scopeA}/suppliers`)).json();
    expect(l.summary.toReview).toBe(0);
    const late = await a.post(
      `/api/suppliers/${supplier}/evaluations`,
      evalBody([{ criterionId: crit1.id, meets: true }], { evaluatedAt: '2026-10-11', nextReviewAt: '2026-10-12' }),
    );
    expect(late.statusCode, late.body).toBe(200);
    for (const s of [scopeA, scopeB])
      expect((await reader.get(`/api/grc/${s}/suppliers`)).json().summary).toMatchObject({ toReview: 1 });
  });
  it('retire le rattachement sans toucher au fournisseur ni aux évaluations', async () => {
    expect((await contributor.del(`/api/grc/${scopeB}/suppliers/${supplier}`)).statusCode).toBe(204);
    expect((await contributor.del(`/api/grc/${scopeB}/suppliers/${supplier}`)).statusCode).toBe(404);
    expect((await reader.get(`/api/grc/${scopeB}/suppliers`)).json().suppliers).toEqual([]);
    expect((await reader.get(`/api/grc/${scopeA}/suppliers`)).json().suppliers).toHaveLength(1);
    expect((await reader.get(`/api/suppliers/${supplier}/evaluations`)).json().length).toBeGreaterThan(0);
    expect((await reader.get('/api/suppliers')).json()).toHaveLength(1);
  });
  it('respecte l’accès aux périmètres restreints', async () => {
    expect((await outsider.put(`/api/grc/${restricted}/suppliers/${supplier}`)).statusCode).toBe(404);
    expect((await outsider.get(`/api/grc/${restricted}/suppliers`)).statusCode).toBe(404);
    expect((await a.put(`/api/grc/${restricted}/suppliers/${supplier}`)).statusCode).toBe(200);
    const visible = (await outsider.get('/api/suppliers')).json()[0].scopes;
    expect(visible).not.toContain(restricted);
    expect((await a.get('/api/suppliers')).json()[0].scopes).toContain(restricted);
    expect(outsiderUser.id).toBeTruthy();
  });
});

describe('suite donnée à une évaluation, dans un périmètre choisi', () => {
  let evaluationId: string;
  const ref = () => `legacy:suppliers:${supplier}`;
  const suite = (
    smsi: string,
    extra: Record<string, unknown>,
    agent = contributor,
    id = evaluationId,
    sup = supplier,
  ) => agent.post(`/api/suppliers/${sup}/evaluations/${id}/follow-up`, { smsi, ...extra });
  beforeAll(async () => {
    evaluationId = (await reader.get(`/api/suppliers/${supplier}/evaluations`)).json()[0].id;
  });
  it('crée une action liée au fournisseur sans rattacher l’évaluation au périmètre', async () => {
    const r = await suite(scopeA, { kind: 'action', name: 'Traiter l’écart relevé', dueAt: '2026-12-01' });
    expect(r.statusCode, r.body).toBe(200);
    const links = (await contributor.get(`/api/grc/${scopeA}/links?ref=${encodeURIComponent(ref())}`)).json();
    expect(links.map((l: { source_ref: string }) => l.source_ref)).toContain('object:' + r.json().id);
    const o = (await contributor.get(`/api/grc/${scopeA}/objects/${r.json().id}`)).json();
    expect(o.data.description).toContain(evaluationId);
    expect(o.data.dueAt).toBe('2026-12-01T12:00:00.000Z');
    expect((await t.svc.db.one<{ n: string }>('SELECT count(*)::text n FROM sup_evaluations'))!.n).toBe('4');
  });
  it('crée une série de réévaluation qui référence le fournisseur, sans fréquence par défaut', async () => {
    expect((await suite(scopeB, { kind: 'task_series', name: 'Réévaluer le fournisseur' })).statusCode).toBe(422);
    const r = await suite(scopeB, {
      kind: 'task_series',
      name: 'Réévaluer le fournisseur',
      start: '2026-11-01',
      interval: 6,
      unit: 'month',
    });
    expect(r.statusCode, r.body).toBe(200);
    const o = (await contributor.get(`/api/grc/${scopeB}/objects/${r.json().id}`)).json();
    expect(o.data.refs).toEqual([ref()]);
    expect(o.data.recurrence).toMatchObject({ unit: 'month', interval: 6, start: '2026-11-01', active: true });
  });
  it('refuse les cas invalides ou non autorisés', async () => {
    expect((await suite(scopeA, { kind: 'action', name: 'Trop tôt', dueAt: '2020-01-01' })).statusCode).toBe(422);
    expect(
      (await suite(scopeA, { kind: 'action', name: 'Évaluation inconnue' }, contributor, crypto.randomUUID()))
        .statusCode,
    ).toBe(404);
    const other = (await a.post('/api/suppliers', { name: 'Autre fournisseur fictif' })).json().id;
    expect(
      (await suite(scopeA, { kind: 'action', name: 'Mauvais fournisseur' }, contributor, evaluationId, other))
        .statusCode,
    ).toBe(404);
    expect((await suite(scopeA, { kind: 'action', name: 'Lecture seule' }, reader)).statusCode).toBe(403);
    expect((await suite(restricted, { kind: 'action', name: 'Hors accès' }, outsider)).statusCode).toBe(404);
    expect((await suite(scopeA, { kind: 'action', name: 'x' })).statusCode).toBe(422);
  });
  it('autorise le lien manuel vers un fournisseur depuis un périmètre non commun, pas vers une fiche historique', async () => {
    const m = (
      await a.post(`/api/grc/${scopeA}/objects`, { kind: 'measure', name: 'Mesure fournisseur', data: {} })
    ).json().id;
    expect(
      (
        await a.post(`/api/grc/${scopeA}/links`, {
          source: 'object:' + m,
          target: ref(),
          type: 'related_to',
          note: 'Lien manuel',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await a.post(`/api/grc/${scopeA}/links`, {
          source: 'object:' + m,
          target: 'legacy:findings:F-1',
          type: 'related_to',
          note: '',
        })
      ).statusCode,
    ).toBe(422);
  });
});
