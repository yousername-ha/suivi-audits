import crypto from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';
let t: TestApp,
  a: Agent,
  reader: Agent,
  writer: Agent,
  document: string,
  proof: string,
  control: string,
  finding: string,
  linkedAction: string,
  journey: string;
const base = `/api/grc/${DEFAULT_SMSI}`;
const clean = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([k]) => !['legacy', 'sourceSha', 'ownerLabel'].includes(k)));
async function decide(
  ref: string,
  operation: string,
  result: string,
  version: number,
  extra: Record<string, unknown> = {},
  agent = a,
) {
  return agent.post(
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
}
/** Le constat généré par le contrôle est un écart natif du périmètre commun. */
async function ecart() {
  return (await a.get(base + '/objects/' + finding.slice('object:'.length))).json();
}
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'pilotage_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'pilotage_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'pilotage_writer', 'rw'));
  const doc = await a.req('POST', '/api/documents', {
    body: Buffer.from('Justificatif de recette'),
    headers: {
      'x-file-name': 'preuve.txt',
      'x-meta': encodeURIComponent(JSON.stringify({ title: 'Justificatif partagé' })),
    },
  });
  expect(doc.statusCode, doc.body).toBe(201);
  document = 'document:' + doc.json().id + ':1';
});
afterAll(async () => t.close());
describe('Pilotage multi-référentiels G/H/K et début E', () => {
  it('utilise le périmètre commun automatiquement, conserve les permissions et les versions physiques', async () => {
    const list = await a.get('/api/grc/smsis');
    expect(list.json()[0].id).toBe(DEFAULT_SMSI);
    expect(list.json()[0].name).toBe('Pilotage de l’organisation');
    const r = await a.post(base + '/objects', {
      kind: 'evidence',
      name: 'Preuve examinée',
      data: { source: 'Document partagé', documentRefs: [document], refs: [] },
    });
    expect(r.statusCode, r.body).toBe(200);
    proof = r.json().id;
    expect((await decide('object:' + proof, 'proof_review', 'accepted', 1, {}, reader)).statusCode).toBe(403);
    expect(
      (await decide('object:' + proof, 'proof_review', 'accepted', 1, { refs: [document.replace(/:1$/, ':99')] }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await a.post(base + '/objects', {
          kind: 'evidence',
          name: 'Validation falsifiée',
          data: { status: 'validated' },
        })
      ).statusCode,
    ).toBe(422);
  });
  it('enregistre un examen idempotent et immuable de la version exacte sans copier le document', async () => {
    const requestId = crypto.randomUUID();
    const r = await decide('object:' + proof, 'proof_review', 'accepted', 1, { requestId });
    expect(r.statusCode, r.body).toBe(200);
    const retry = await decide('object:' + proof, 'proof_review', 'accepted', 1, { requestId });
    expect(retry.statusCode, retry.body).toBe(200);
    expect(retry.json().id).toBe(r.json().id);
    expect((await decide('object:' + proof, 'proof_review', 'rejected', 1, { requestId })).statusCode).toBe(409);
    expect((await a.get(base + '/objects/' + proof)).json().data.documentRefs).toEqual([document]);
    const newVersion = await a.req('POST', '/api/documents/' + document.split(':')[1] + '/versions', {
      body: Buffer.from('Justificatif corrigé'),
      headers: { 'x-file-name': 'preuve.txt' },
    });
    expect(newVersion.statusCode).toBe(201);
    const exact = await decide('object:' + proof, 'proof_review', 'accepted', 2, {
      refs: [document.replace(/:1$/, ':2')],
    });
    expect(exact.statusCode, exact.body).toBe(200);
    const history = (await a.get(base + '/pilotage/history?ref=object:' + proof)).json().items;
    expect(history.map((h: { refs: string[] }) => h.refs[0])).toEqual([document.replace(/:1$/, ':2'), document]);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM document_versions'))!.n).toBe(2);
    const inbound = await a.get(base + '/links?ref=' + encodeURIComponent(document));
    expect(inbound.json().some((r: { other: { ref: string } }) => r.other.ref === 'object:' + proof)).toBe(true);
    await expect(t.svc.db.q('UPDATE pilotage_decisions SET note=$1', ['altéré'])).rejects.toThrow();
    await expect(t.svc.db.q('DELETE FROM pilotage_decisions')).rejects.toThrow();
  });
  it('réalise un contrôle et génère un constat dans le registre des écarts ainsi qu’une action liée, une seule fois', async () => {
    const c = await a.post(base + '/objects', {
      kind: 'control',
      name: 'Contrôle de conservation',
      data: {
        objective: 'Vérifier la conservation',
        scope: 'Recette',
        method: 'Comparer les pièces',
        criteria: 'Aucune perte',
        dueAt: '2026-10-10',
        refs: [document],
      },
    });
    expect(c.statusCode, c.body).toBe(200);
    control = c.json().id;
    const r = await decide('object:' + control, 'control_execution', 'fail', 1, {
      createFinding: true,
      createAction: true,
    });
    expect(r.statusCode, r.body).toBe(200);
    [finding, linkedAction] = r.json().generatedRefs;
    expect(finding).toMatch(/^object:/);
    expect(linkedAction).toMatch(/^object:/);
    expect((await ecart()).kind).toBe('nonconformity');
    expect(
      (await a.get(base + '/links?ref=' + encodeURIComponent(finding)))
        .json()
        .some((l: { other: { ref: string } }) => l.other.ref === linkedAction),
    ).toBe(true);
    expect((await decide('object:' + control, 'control_execution', 'fail', 1)).statusCode).toBe(412);
  });
  it('planifie un contrôle avec le moteur de récurrences et empêche une deuxième série', async () => {
    const recurrence = {
      start: '2026-10-01',
      time: '09:00',
      timezone: 'Europe/Paris',
      unit: 'month',
      interval: 1,
      until: null,
      count: 3,
      reminderDays: 7,
      active: true,
    };
    const r = await a.post(base + '/pilotage/controls/' + control + '/schedule', { recurrence }, { 'if-match': '"2"' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data.refs).toEqual(['object:' + control]);
    expect(
      (await a.post(base + '/pilotage/controls/' + control + '/schedule', { recurrence }, { 'if-match': '"3"' }))
        .statusCode,
    ).toBe(409);
  });
  it('garde la clôture, les causes, la vérification d’efficacité et les tâches réellement réalisées', async () => {
    let f = await ecart();
    expect((await decide(finding, 'close', 'completed', f.version)).statusCode).toBe(409);
    const updated = await a.put(
      base + '/objects/' + f.id,
      { kind: 'nonconformity', name: f.name, data: { ...f.data, cause: 'Cause identifiée par analyse détaillée' } },
      { 'if-match': `"${f.version}"` },
    );
    expect(updated.statusCode, updated.body).toBe(200);
    f = updated.json();
    const effect = await decide(finding, 'effectiveness', 'effective', f.version);
    expect(effect.statusCode, effect.body).toBe(200);
    f = await ecart();
    expect((await decide(finding, 'close', 'completed', f.version)).statusCode).toBe(409);
    const action = (await a.get(base + '/objects/' + linkedAction.slice(7))).json();
    const progress = await a.put(
      base + '/objects/' + action.id,
      { kind: 'action', name: action.name, data: { ...action.data, status: 'progress' } },
      { 'if-match': `"${action.version}"` },
    );
    expect(progress.statusCode, progress.body).toBe(200);
    const closed = await a.put(
      base + '/objects/' + action.id,
      {
        kind: 'action',
        name: action.name,
        data: { ...action.data, status: 'done', justification: 'Travail réalisé et pièces vérifiées' },
      },
      { 'if-match': `"${progress.json().version}"` },
    );
    expect(closed.statusCode, closed.body).toBe(200);
    // Terminer l'action ne clôt pas l'écart : il reste ouvert, avec les mêmes causes et la même vérification (017-07).
    const apresAction = await ecart();
    expect(apresAction.data.status).not.toBe('closed');
    expect(apresAction.version).toBe(f.version);
    const done = await decide(finding, 'close', 'completed', f.version);
    expect(done.statusCode, done.body).toBe(200);
    expect((await ecart()).data.status).toBe('closed');
    const report = await a.get(base + '/pilotage/improvement-indicators');
    expect(report.statusCode).toBe(200);
    expect(report.json().closed).toBeGreaterThan(0);
  });
  it('clôture avec liens ouverts : refusée sans motif écrit, acceptée avec un motif tracé, réinitialisé à la réouverture (décision 7)', async () => {
    const c = await a.post(base + '/objects', {
      kind: 'control',
      name: 'Contrôle à clôture dérogatoire',
      data: {
        objective: 'Vérifier',
        scope: 'Recette',
        method: 'Comparer les pièces',
        criteria: 'Aucune perte',
        dueAt: '2026-10-10',
        refs: [document],
      },
    });
    expect(c.statusCode, c.body).toBe(200);
    const r = await decide('object:' + c.json().id, 'control_execution', 'fail', 1, {
      createFinding: true,
      createAction: true,
    });
    expect(r.statusCode, r.body).toBe(200);
    const [ecart2, action2] = r.json().generatedRefs as string[];
    const lire = async () => (await a.get(base + '/objects/' + ecart2!.slice(7))).json();
    let f = await lire();
    f = (
      await a.put(
        base + '/objects/' + f.id,
        { kind: 'nonconformity', name: f.name, data: { ...f.data, cause: 'Cause identifiée par analyse détaillée' } },
        { 'if-match': `"${f.version}"` },
      )
    ).json();
    expect((await decide(ecart2!, 'effectiveness', 'effective', f.version)).statusCode).toBe(200);
    f = await lire();
    // Sans motif : refus explicite, qui dit ce qui reste ouvert.
    const refus = await decide(ecart2!, 'close', 'completed', f.version);
    expect(refus.statusCode).toBe(409);
    expect(refus.json().error).toContain('Des liens restent ouverts (1 action(s) liée(s) non terminée(s)');
    // Un motif trop court n'est pas un motif écrit.
    expect((await decide(ecart2!, 'close', 'completed', f.version, { openLinksReason: 'court' })).statusCode).toBe(422);
    expect((await lire()).data.status).not.toBe('closed');
    // Avec un motif écrit : la clôture est prononcée, le motif et ce qui restait ouvert sont conservés.
    const motif = 'Action reprise au plan annuel, clôture décidée en revue de direction.';
    const ok = await decide(ecart2!, 'close', 'completed', f.version, { openLinksReason: motif });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().terms.openLinks).toMatchObject({ reason: motif, tasks: 0 });
    expect(ok.json().terms.openLinks.actions).toEqual([{ ref: action2, name: expect.any(String) }]);
    f = await lire();
    expect(f.data).toMatchObject({ status: 'closed', closureOpenLinksReason: motif });
    // L'action liée reste ouverte et suivie : la clôture ne la termine pas.
    expect((await a.get(base + '/objects/' + action2!.slice(7))).json().data.status).not.toBe('done');
    const audit = (await a.get('/api/admin/audit')).body;
    expect(audit).toContain('closedWithOpenLinks');
    // Ce champ ne s'écrit pas à la main.
    expect(
      (
        await a.put(
          base + '/objects/' + f.id,
          { kind: 'nonconformity', name: f.name, data: { ...f.data, closureOpenLinksReason: 'Forcé' } },
          { 'if-match': `"${f.version}"` },
        )
      ).statusCode,
    ).toBeGreaterThanOrEqual(400);
    // La réouverture efface le motif sur la fiche ; la décision d'origine reste au journal.
    const rouvert = await decide(ecart2!, 'reopen', 'completed', f.version, {
      note: 'Réouverture : l’action liée n’est toujours pas terminée.',
    });
    expect(rouvert.statusCode, rouvert.body).toBe(200);
    expect((await lire()).data.closureOpenLinksReason).toBe('');
  });
  it('rouvrir l’action liée ne rouvre pas un écart clos : la clôture reste intacte (017-07)', async () => {
    const f = await ecart();
    expect(f.data.status).toBe('closed');
    const avantEvaluations = (await t.svc.db.one<{ n: string }>(
      'SELECT count(*)::text AS n FROM grc_requirement_assessments',
    ))!.n;
    const action = (await a.get(base + '/objects/' + linkedAction.slice(7))).json();
    const rouverte = await a.put(
      base + '/objects/' + action.id,
      { kind: 'action', name: action.name, data: { ...action.data, status: 'progress' } },
      { 'if-match': `"${action.version}"` },
    );
    expect(rouverte.statusCode, rouverte.body).toBe(200);
    const apres = await ecart();
    expect(apres.data.status).toBe('closed');
    expect(apres.version).toBe(f.version);
    // Aucune évaluation d'exigence n'est écrite ni modifiée par la réouverture d'une action.
    const evaluations = async () =>
      (await t.svc.db.one<{ n: string }>('SELECT count(*)::text AS n FROM grc_requirement_assessments'))!.n;
    expect(await evaluations()).toBe(avantEvaluations);
  });
  it('rouvre un constat clos avec un motif tracé : l’efficacité est à revérifier, aucune réouverture silencieuse', async () => {
    let f = await ecart();
    expect(f.data.status).toBe('closed');
    // La modification ordinaire d'un constat clos reste refusée ; seule la décision de réouverture le rouvre.
    const direct = await a.put(
      base + '/objects/' + f.id,
      { kind: 'nonconformity', name: f.name, data: { ...f.data, status: 'open' } },
      { 'if-match': `"${f.version}"` },
    );
    expect(direct.statusCode).toBeGreaterThanOrEqual(400);
    const court = await decide(finding, 'reopen', 'completed', f.version, { note: 'court' });
    expect(court.statusCode).toBe(422);
    const rouvert = await decide(finding, 'reopen', 'completed', f.version, {
      note: 'Récidive constatée lors de l’audit de surveillance.',
    });
    expect(rouvert.statusCode, rouvert.body).toBe(200);
    expect(rouvert.json().operation).toBe('reopen');
    f = await ecart();
    expect(f.data.status).toBe('open');
    expect(f.data.effectiveness).toBe('pending');
    // Le motif est au journal des décisions, la clôture d'origine aussi (journal immuable).
    const journal = (await a.get(base + '/pilotage/history?ref=' + encodeURIComponent(finding)))
      .json()
      .items.map((d: { operation: string }) => d.operation);
    expect(journal).toEqual(expect.arrayContaining(['close', 'reopen']));
    // Fermer de nouveau exige une nouvelle vérification d'efficacité ; on ne rouvre pas un constat déjà ouvert.
    expect((await decide(finding, 'close', 'completed', f.version)).statusCode).toBe(409);
    expect((await decide(finding, 'reopen', 'completed', f.version)).statusCode).toBe(409);
  });
  it('préserve les champs extra, les rôles sans ID, et les historiques de valeurs', async () => {
    await t.svc.db.tx(async (c) => {
      const state = await t.svc.legacy.recompose(c);
      const saved = await t.svc.legacy.nativeWrite(
        c,
        {
          ...state!.data,
          roles: [{ name: 'Pilote qualité', holder: 'Alice', resp: 'Organisation', extra: { keep: true } }],
          indicators: [
            {
              id: 'IND-QA',
              name: 'Indicateur de qualité',
              values: [{ date: '2026-09-01', v: 2, note: 'Valeur précédente', hist: 'ancien' }],
              target: 5,
              extra: 'à garder',
            },
          ],
        },
        { id: '', username: 'recette' },
        state!.version,
      );
      expect(saved.conflict).toBe(false);
    });
    const role = (await a.get(base + '/pilotage/legacy/roles')).json().items[0];
    expect(role.id).toBe('legacy:roles:@0');
    const refs = (await a.get(base + '/sources?search=Pilote')).json().items;
    expect(refs.some((r: { ref: string }) => r.ref === 'legacy:roles:@0')).toBe(true);
    const r = await a.put(
      base + '/pilotage/legacy/roles/%400',
      {
        name: role.name,
        sourceSha: role.data.sourceSha,
        data: { ...clean(role.data), responsibilities: 'Nouvelle responsabilité' },
      },
      { 'if-match': `"${role.version}"` },
    );
    expect(r.statusCode, r.body).toBe(200);
    const indicator = (await a.get(base + '/pilotage/legacy/indicators')).json().items[0];
    const i = await a.put(
      base + '/pilotage/legacy/indicators/IND-QA',
      {
        name: indicator.name,
        sourceSha: indicator.data.sourceSha,
        data: { ...clean(indicator.data), value: 3, measuredAt: '2026-10-10' },
      },
      { 'if-match': `"${indicator.version}"` },
    );
    expect(i.statusCode, i.body).toBe(200);
    const state = await t.svc.legacy.recompose();
    const roles = state!.data.roles as { extra: unknown; id?: string }[];
    expect(roles[0]!.extra).toEqual({ keep: true });
    expect(roles[0]!.id).toBeUndefined();
    const indicators = state!.data.indicators as { values: { v: number }[]; extra: string }[];
    expect(indicators[0]!.values.map((v) => v.v)).toEqual([2, 3]);
    expect(indicators[0]!.extra).toBe('à garder');
  });
  it('reprend un parcours qualité sur les objets communs, garde les prérequis et l’historique', async () => {
    const r = await a.post(base + '/objects', {
      kind: 'journey',
      name: 'Démarche qualité',
      data: {
        organisation: 'Organisation de recette',
        scope: 'Service qualité',
        goals: 'Piloter ISO 9001',
        approach: 'quality',
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    journey = r.json().id;
    expect((await decide('object:' + journey, 'step_validation', 'completed', 1, { step: 'scope' })).statusCode).toBe(
      409,
    );
    expect(
      (await decide('object:' + journey, 'step_validation', 'completed', 1, { step: 'context' }, writer)).statusCode,
    ).toBe(403);
    const done = await decide('object:' + journey, 'step_validation', 'completed', 1, { step: 'context' });
    expect(done.statusCode, done.body).toBe(200);
    const progress = (await a.get(base + '/pilotage/journeys/' + journey)).json();
    expect(progress.steps[0].state).toBe('completed');
    expect(progress.steps).toHaveLength(11);
    expect(progress.object.version).toBe(1);
    expect(progress.note).toMatch(/sans attestation/);
    const change = await a.put(
      base + '/objects/' + journey,
      { kind: 'journey', name: 'Démarche qualité étendue', data: { ...r.json().data, scope: 'Périmètre modifié' } },
      { 'if-match': '"1"' },
    );
    expect(change.statusCode).toBe(200);
    const reset = (await a.get(base + '/pilotage/journeys/' + journey)).json();
    expect(reset.steps[0].state).toBe('todo');
    expect(reset.history).toHaveLength(1);
  });
  it('valide BIA et plan de reprise avec impacts temporels, références et limites cohérentes', async () => {
    expect(
      (
        await a.post(base + '/objects', {
          kind: 'bia',
          name: 'Reprise incohérente',
          data: { maxInterruptionHours: 4, recoveryHours: 8 },
        })
      ).statusCode,
    ).toBe(422);
    const r = await a.post(base + '/objects', {
      kind: 'bia',
      name: 'Activité de recette',
      data: {
        activity: 'Service métier',
        scenario: 'Indisponibilité',
        minimumService: 'Accueil minimal',
        maxInterruptionHours: 24,
        recoveryHours: 4,
        dataLossHours: 1,
        impacts: [
          {
            hours: 4,
            business: 'Service dégradé',
            financial: 'Coût limité',
            legal: 'Délais',
            reputation: 'Réclamations',
          },
        ],
        refs: [document],
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await decide('object:' + r.json().id, 'approval', 'accepted', 1, {}, writer)).statusCode).toBe(403);
    const approved = await decide('object:' + r.json().id, 'approval', 'accepted', 1);
    expect(approved.statusCode, approved.body).toBe(200);
    const plan = await a.post(base + '/objects', {
      kind: 'continuity_plan',
      name: 'PRA métier',
      data: {
        planType: 'pra',
        scope: 'Service métier',
        trigger: 'Indisponibilité supérieure à 4h',
        strategy: 'Restaurer',
        procedures: 'Étapes vérifiées',
        roles: 'Pilote et suppléant',
        returnToNormal: 'Vérifier les résultats',
        refs: ['object:' + r.json().id],
      },
    });
    expect(plan.statusCode, plan.body).toBe(200);
    expect((await decide('object:' + plan.json().id, 'approval', 'accepted', 1)).statusCode).toBe(200);
    expect((await a.get(base + '/pilotage/export?kind=bia')).json().objects[0].name).toBe('Activité de recette');
    expect(
      (
        await a.post(base + '/objects', {
          kind: 'continuity_exercise',
          name: 'Exercice incomplet',
          data: { status: 'done', performedAt: '2026-10-10', result: 'success', lessons: '' },
        })
      ).statusCode,
    ).toBe(422);
    const exercise = (
      await a.post(base + '/objects', {
        kind: 'continuity_exercise',
        name: 'Exercice métier',
        data: {
          status: 'done',
          performedAt: '2026-10-10',
          result: 'partial',
          scenario: 'Indisponibilité',
          lessons: 'Améliorer la procédure de secours',
          refs: ['object:' + plan.json().id],
        },
      })
    ).json();
    const improve = await decide('object:' + exercise.id, 'action_create', 'completed', exercise.version, {
      createAction: true,
    });
    expect(improve.statusCode, improve.body).toBe(200);
    expect(improve.json().generatedRefs[0]).toMatch(/^object:/);
    expect((await reader.get(base + '/pilotage/export?kind=bia')).statusCode).toBe(403);
  });
  it('refuse de falsifier une réalisation ou une validation par une édition générique', async () => {
    for (const [kind, data] of [
      ['control', { result: 'pass', performedAt: '2026-10-10' }],
      ['management_review', { status: 'validated' }],
      ['nonconformity', { effectiveness: 'effective' }],
    ] as const) {
      expect((await a.post(base + '/objects', { kind, name: 'Tentative de contournement', data })).statusCode).toBe(
        422,
      );
    }
    const o = (
      await a.post(base + '/objects', {
        kind: 'nonconformity',
        name: 'Constat natif',
        data: { cause: 'Cause test', refs: [document] },
      })
    ).json();
    expect((await decide('object:' + o.id, 'effectiveness', 'effective', o.version)).statusCode).toBe(200);
    expect((await decide('object:' + o.id, 'close', 'completed', 2)).statusCode).toBe(200);
    expect(
      (
        await a.put(
          base + '/objects/' + o.id,
          { kind: o.kind, name: o.name, data: { cause: 'Réouverture contournée', status: 'open' } },
          { 'if-match': '"3"' },
        )
      ).statusCode,
    ).toBe(409);
  });
  it('classe un constat, le relie à son constat précédent (récidive) et refuse les liens invalides', async () => {
    const creer = (data: Record<string, unknown>) =>
      a.post(base + '/objects', {
        kind: 'nonconformity',
        name: 'Constat classé',
        data: { cause: 'Cause test', ...data },
      });
    const premier = await creer({ classification: 'majeure' });
    expect(premier.statusCode, premier.body).toBe(200);
    expect(premier.json().data.classification).toBe('majeure');
    expect((await creer({ classification: 'grave' })).statusCode).toBe(422);
    // La récidive pointe vers un constat ; l'audit d'origine doit être un audit, pas une autre fiche.
    const recidive = await creer({ classification: 'mineure', recidiveRef: 'object:' + premier.json().id });
    expect(recidive.statusCode, recidive.body).toBe(200);
    expect(recidive.json().data.recidiveRef).toBe('object:' + premier.json().id);
    // La récidive se lit des deux côtés : le constat précédent voit son entrant (021-01, 021-07).
    const liensDuPremier = (
      await a.get(base + '/links?ref=' + encodeURIComponent('object:' + premier.json().id))
    ).json();
    expect(
      liensDuPremier.some(
        (l: { sens: string; other: { ref: string } }) =>
          l.sens === 'entrant' && l.other.ref === 'object:' + recidive.json().id,
      ),
    ).toBe(true);
    expect((await creer({ auditRef: linkedAction })).statusCode).toBe(422);
    expect((await creer({ recidiveRef: linkedAction })).statusCode).toBe(422);
    // Un constat ne peut pas être la récidive de lui-même.
    const soi = await a.put(
      base + '/objects/' + premier.json().id,
      {
        kind: 'nonconformity',
        name: 'Constat classé',
        data: { ...premier.json().data, recidiveRef: 'object:' + premier.json().id },
      },
      { 'if-match': `"${premier.json().version}"` },
    );
    expect(soi.statusCode).toBe(422);
  });
  it('agrège 10 000 constats sans charger leurs fiches et annonce la limite de causes', async () => {
    const isolated = (
      await a.post('/api/grc/smsis', {
        name: 'Grand registre d’amélioration',
        scope: 'Recette volume',
        timezone: 'Europe/Paris',
      })
    ).json().id;
    await t.svc.db.q(
      `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by,created_at) SELECT $1,'nonconformity','ecarts','Constat '||n,jsonb_build_object('status','closed','effectiveness','effective','closedAt','2026-10-03','cause','Cause '||(n%2000)),'fixture','fixture','2026-10-01T12:00:00Z'::timestamptz FROM generate_series(1,10000) n`,
      [isolated],
    );
    const report = (await a.get('/api/grc/' + isolated + '/pilotage/improvement-indicators')).json();
    expect(report.findings).toBe(10000);
    expect(report.closed).toBe(10000);
    expect(report.durationSamples).toBe(10000);
    expect(report.meanDays).toBe(2);
    expect(report.repeatedCauses).toHaveLength(1000);
    expect(report.causesTruncated).toBe(true);
  });
  it('respecte les périmètres privés et refuse la modification historique depuis un autre périmètre', async () => {
    const scope = (
      await a.post('/api/grc/smsis', { name: 'Périmètre isolé', scope: 'Recette', timezone: 'Europe/Paris' })
    ).json();
    expect((await reader.get(`/api/grc/${scope.id}/pilotage/improvement-indicators`)).statusCode).toBe(404);
    expect((await a.get(`/api/grc/${scope.id}/pilotage/legacy/findings`)).statusCode).toBe(404);
  });
});
