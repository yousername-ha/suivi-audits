import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { methodTemplate, type RiskRatings } from '@suivi/shared';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';
let t: TestApp, a: Agent, reader: Agent, contributor: Agent, smsi: string, methodId: string, riskId: string;
const root = () => `/api/grc/${smsi}`;
const action = {
  kind: 'action',
  name: 'Revue mensuelle',
  data: {
    description: 'Vérification documentée',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: '2026-10-15T09:00:00Z',
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
};
const rating = { dimensions: { severity: 'impact_2' }, likelihood: 'likelihood_2', level: null, inputs: {} };
const ratings: RiskRatings = { gross: rating, residual: rating };
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'grc_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'grc_reader', 'ro'));
  contributor = await login(t, await makeUser(t, 'grc_writer', 'rw'));
});
afterAll(async () => {
  await t.close();
});
describe('SMSI, permissions et décisions', () => {
  it('crée un SMSI privé sans rendre le patrimoine accessible aux autres comptes', async () => {
    const r = await a.post('/api/grc/smsis', { name: 'Périmètre secret', scope: 'Recette', timezone: 'Europe/Paris' });
    expect(r.statusCode, r.body).toBe(200);
    smsi = r.json().id;
    expect((await reader.get(root() + '/objects?kind=risk')).statusCode).toBe(404);
    expect((await contributor.get('/api/grc/smsis')).json().some((x: { id: string }) => x.id === smsi)).toBe(false);
    expect((await reader.get(`/api/grc/${DEFAULT_SMSI}/objects?kind=risk`)).statusCode).toBe(200);
  });
  it('publie une méthode EBIOS avec cinq ateliers, sans formule universelle', async () => {
    const definition = methodTemplate('ebios_rm');
    const p = await a.post(root() + '/methods/preview', { id: null, definition });
    expect(p.statusCode, p.body).toBe(200);
    const r = await a.post(
      root() + '/methods/publish',
      {
        id: null,
        definition,
        previewId: p.json().previewId,
        reason: 'Politique approuvée pour la recette',
        confirm: 'PUBLIER',
      },
      { 'if-match': '"0"' },
    );
    expect(r.statusCode, r.body).toBe(200);
    methodId = r.json().methodId;
    expect(r.json().definition.stages).toHaveLength(5);
  });
  it('contrôle les étapes et fige le calcul brut et résiduel', async () => {
    const r = await a.post(root() + '/objects', {
      kind: 'risk',
      name: 'Risque de recette',
      data: {
        description: 'Analyse',
        code: 'R01',
        ownerId: null,
        methodId,
        methodVersion: 1,
        domain: 'SSI',
        entity: 'Entité',
        scope: 'Périmètre',
        strategy: 'reduce',
        acceptanceReason: '',
        reviewAt: '2027-01-01',
        stages: {},
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    riskId = r.json().id;
    const intent = { ratings, rationale: 'Analyse documentée et conservée', decision: 'draft' };
    const p = await a.post(root() + `/risks/${riskId}/preview`, intent);
    expect(p.statusCode, p.body).toBe(200);
    const body = { ...intent, previewId: p.json().previewId, requestId: crypto.randomUUID(), confirm: 'ENREGISTRER' };
    const saved = await a.post(root() + `/risks/${riskId}/evaluate`, body, { 'if-match': '"1"' });
    expect(saved.statusCode, saved.body).toBe(200);
    expect((await a.post(root() + `/risks/${riskId}/evaluate`, body, { 'if-match': '"1"' })).json().id).toBe(
      saved.json().id,
    );
    expect(
      (
        await a.post(
          root() + `/risks/${riskId}/evaluate`,
          { ...body, rationale: 'Autre justification documentée' },
          { 'if-match': '"1"' },
        )
      ).statusCode,
    ).toBe(409);
    expect((await a.post(root() + `/risks/${riskId}/preview`, { ...intent, decision: 'approved' })).statusCode).toBe(
      409,
    );
    await expect(t.svc.db.q('UPDATE grc_risk_evaluations SET rationale=$1', ['Altération'])).rejects.toThrow();
  });
  it('signale l’écart avec la matrice courante sans jamais recalculer le niveau enregistré (le registre fait foi)', async () => {
    const avant = (await a.get(root() + `/risks/${riskId}/evaluations`)).json() as {
      result: unknown;
      revision: number;
    }[];
    expect((await a.get(root() + '/risks/register')).json().items[0].ecartMatrice).toBeNull();
    // Version 2 de la méthode : la case de la cotation enregistrée change de niveau.
    const v2 = methodTemplate('ebios_rm');
    if (v2.calculation.kind !== 'matrix') throw new Error('matrice attendue');
    for (const c of v2.calculation.cells)
      if (c.impact === 'impact_2' && c.likelihood === 'likelihood_2') c.level = 'high';
    const p = await a.post(root() + '/methods/preview', { id: methodId, definition: v2 });
    expect(p.statusCode, p.body).toBe(200);
    const pub = await a.post(
      root() + '/methods/publish',
      {
        id: methodId,
        definition: v2,
        previewId: p.json().previewId,
        reason: 'Matrice révisée pour la recette',
        confirm: 'PUBLIER',
      },
      { 'if-match': '"1"' },
    );
    expect(pub.statusCode, pub.body).toBe(200);
    const reg = (await a.get(root() + '/risks/register')).json().items.find((x: { id: string }) => x.id === riskId);
    expect(reg.ecartMatrice).toMatchObject({ etat: 'ecart', versionEnregistree: 1, versionCourante: 2 });
    expect(reg.ecartMatrice.courant.residuel).not.toBe(reg.ecartMatrice.enregistre.residuel);
    expect((await a.get(root() + '/risks/register?ecart=1')).json().items.map((x: { id: string }) => x.id)).toContain(
      riskId,
    );
    // Rien n'est recalculé : le niveau affiché reste celui de l'appréciation enregistrée, l'historique est inchangé.
    expect(reg.residuel).toBe(reg.ecartMatrice.enregistre.residuel);
    expect((await a.get(root() + `/risks/${riskId}/evaluations`)).json()).toEqual(avant);
  });
  it('refuse d’approuver une appréciation dont le résiduel est inacceptable quand l’option est « accepter »', async () => {
    // Méthode sans champ obligatoire : les étapes se valident sans saisie, seul le critère d'acceptabilité est en jeu.
    const modele = methodTemplate('ebios_rm');
    const definition = {
      ...modele,
      name: 'Méthode de recette sans champ obligatoire',
      fields: modele.fields.map((f) => ({ ...f, required: false })),
    };
    const p = await a.post(root() + '/methods/preview', { id: null, definition });
    expect(p.statusCode, p.body).toBe(200);
    const pub = await a.post(
      root() + '/methods/publish',
      {
        id: null,
        definition,
        previewId: p.json().previewId,
        reason: 'Politique approuvée pour la recette',
        confirm: 'PUBLIER',
      },
      { 'if-match': '"0"' },
    );
    expect(pub.statusCode, pub.body).toBe(200);
    const methodeId = pub.json().methodId as string;
    const etapes = Object.fromEntries(
      definition.stages.map((e) => [e.id, { status: 'validated', values: {}, comment: '' }]),
    );
    const r = await a.post(root() + '/objects', {
      kind: 'risk',
      name: 'Risque à accepter',
      data: {
        description: 'Analyse',
        code: 'R02',
        ownerId: null,
        methodId: methodeId,
        methodVersion: 1,
        domain: 'SSI',
        entity: 'Entité',
        scope: 'Périmètre',
        strategy: 'accept',
        acceptanceReason: 'Raison documentée',
        reviewAt: '2027-01-01',
        stages: etapes,
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    const maximum = { dimensions: { severity: 'impact_4' }, likelihood: 'likelihood_4', level: null, inputs: {} };
    const forte = await a.post(root() + `/risks/${r.json().id}/preview`, {
      ratings: { gross: maximum, residual: maximum },
      rationale: 'Analyse documentée et conservée',
      decision: 'approved',
    });
    expect(forte.statusCode, forte.body).toBe(409);
    expect(forte.body).toMatch(/acceptabilité/);
    // Un résiduel acceptable est approuvable, et un brouillon n'est jamais bloqué par ce critère.
    const brouillon = await a.post(root() + `/risks/${r.json().id}/preview`, {
      ratings: { gross: maximum, residual: maximum },
      rationale: 'Analyse documentée et conservée',
      decision: 'draft',
    });
    expect(brouillon.statusCode, brouillon.body).toBe(200);
  });
  it('projette le registre et ses méthodes, sans fuite ni copie modifiable', async () => {
    const r = await a.get(root() + '/risk-map');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().items[0].id).toBe(riskId);
    expect(r.json().items[0].assessment.result.gross.level).toBe('medium');
    expect((await reader.get(root() + '/risk-map')).statusCode).toBe(404);
  });
  it('applique le workflow, la concurrence, la justification et l’historique', async () => {
    const r = await a.post(root() + '/objects', action);
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().id;
    expect(
      (
        await a.put(
          root() + `/objects/${id}`,
          { ...action, data: { ...action.data, status: 'done' } },
          { 'if-match': '"1"' },
        )
      ).statusCode,
    ).toBe(409);
    const updated = await a.put(
      root() + `/objects/${id}`,
      { ...action, data: { ...action.data, status: 'progress' } },
      { 'if-match': '"1"' },
    );
    expect(updated.statusCode, updated.body).toBe(200);
    expect((await a.put(root() + `/objects/${id}`, action, { 'if-match': '"1"' })).statusCode).toBe(412);
    expect((await a.get(root() + `/objects/${id}/history`)).json()).toHaveLength(2);
    await expect(t.svc.db.q('DELETE FROM grc_object_versions')).rejects.toThrow();
  });
  it('génère chaque occurrence une seule fois malgré deux automates', async () => {
    const r = await a.post(root() + '/objects', {
      kind: 'task_series',
      name: 'Récurrence recette',
      data: {
        description: 'Vérifier',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: ['object:' + riskId],
        recurrence: {
          start: '2026-10-01',
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'month',
          interval: 1,
          until: null,
          count: 3,
          reminderDays: 7,
          active: true,
        },
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    await Promise.all([
      t.svc.grc.tasks.tick(new Date('2026-11-02T00:00:00Z')),
      t.svc.grc.tasks.tick(new Date('2026-11-02T00:00:00Z')),
    ]);
    const occurrences = await a.get(root() + `/series/${r.json().id}/occurrences`);
    expect(occurrences.statusCode, occurrences.body).toBe(200);
    expect(occurrences.json()).toHaveLength(2);
    const links = await a.get(root() + `/links?ref=${encodeURIComponent('object:' + riskId)}`);
    expect(links.json().filter((l: { derived: boolean }) => !l.derived)).toHaveLength(2);
    expect(links.json().filter((l: { derived: boolean }) => l.derived)).toHaveLength(1);
  });
  it('publie un référentiel organisationnel indépendant d’ISO/HDS', async () => {
    const definition = {
      name: 'PSSI recette',
      identifier: 'PSSI-QA',
      source: {
        organisation: 'Organisation',
        document: 'Politique interne',
        url: 'https://example.invalid/pssi',
        version: '1',
        date: '2026-10-10',
        license: 'Organisation',
        verifiedAt: '',
        normative: false,
        status: 'organisation',
      },
      domains: [{ id: 'ssi', label: 'Sécurité' }],
      requirements: [
        {
          id: 'P1',
          domain: 'ssi',
          title: 'Revue périodique',
          description: 'Choix organisationnel',
          applicability: 'Toutes les équipes',
          measureRefs: [],
        },
      ],
    };
    const p = await a.post(root() + '/frameworks/preview', { id: null, definition });
    expect(p.statusCode, p.body).toBe(200);
    const r = await a.post(
      root() + '/frameworks/publish',
      {
        id: null,
        definition,
        previewId: p.json().previewId,
        reason: 'Publication initiale de la politique',
        confirm: 'PUBLIER',
      },
      { 'if-match': '"0"' },
    );
    expect(r.statusCode, r.body).toBe(200);
    const f = await a.get(root() + `/frameworks/${r.json().id}/versions/1`);
    expect(f.json().definition.requirements).toHaveLength(1);
  });
  it('le planificateur attend une modification du périmètre avant de lire sa politique', async () => {
    const gate = await t.svc.db.pool.connect();
    let ticking: Promise<void> | undefined;
    try {
      await gate.query('BEGIN');
      await gate.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      ticking = t.svc.grc.tasks.tick(new Date('2026-12-02T00:00:00Z'));
      let blocked = false;
      for (let i = 0; i < 40; i++) {
        blocked = !!(
          await t.svc.db.one<{ blocked: boolean }>(
            `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR SHARE OF s%') blocked`,
          )
        )?.blocked;
        if (blocked) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(blocked).toBe(true);
      await gate.query('COMMIT');
      await ticking;
      ticking = undefined;
    } finally {
      await gate.query('ROLLBACK');
      gate.release();
      if (ticking) await ticking;
    }
  });
});
