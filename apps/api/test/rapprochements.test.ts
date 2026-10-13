/* Déclarer une fois (ADR 0031, lot M3) : correspondances organisationnelles validées par une décision humaine,
   propositions de rapprochement jamais affirmées (le pilote confirme ou rejette), notification des pilotes, couverture
   commune et isolation des périmètres. Données fictives : aucun texte normatif. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp,
  a: Agent,
  reader: Agent,
  contributor: Agent,
  contributorUser: TestUser,
  fa: string,
  fb: string,
  scope: string,
  scope2: string,
  measure: string,
  measure2: string,
  map1: string,
  map2: string;
const definition = (identifier: string, ids: string[]): FrameworkDefinition => ({
  name: `Référentiel ${identifier}`,
  identifier,
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
  requirements: ids.map((id) => ({
    id,
    domain: 'gouvernance',
    title: `Exigence ${id}`,
    description: 'Fictif',
    applicability: 'Tout',
    measureRefs: [],
  })),
});
async function publier(identifier: string, ids: string[]) {
  const def = definition(identifier, ids);
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
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
}
const req = (fw: string, id: string) => ({ frameworkId: fw, version: 1, requirementId: id });
const refReq = (fw: string, id: string) => `requirement:${fw}:1:${id}`;
const body = (s: unknown, tg: unknown, type: string, coverage: number) => ({
  source: s,
  target: tg,
  type,
  justification: 'Correspondance fictive de recette, revue par le pilote',
  coverage,
  origin: 'human',
  sourceUrl: 'https://example.invalid/correspondance',
});
const attacher = (smsi: string, fw: string) =>
  a.put(`/api/grc/${smsi}/framework-attachments/${fw}`, { version: 1, confirm: 'RATTACHER' });
const lier = (smsi: string, m: string, target: string) =>
  a.post(`/api/grc/${smsi}/links`, { source: 'object:' + m, target, type: 'implements', note: 'Lien de recette' });
const proposals = async (smsi: string, status = 'pending') =>
  (await a.get(`/api/grc/${smsi}/rapprochements?status=${status}`)).json() as {
    id: string;
    status: string;
    coverage: number;
    mappingType: string;
    measure: { name: string };
    source: { requirementId: string; framework: string; title: string };
    target: { requirementId: string };
  }[];
const valider = (id: string, version: number, agent = a) =>
  agent.post(
    `/api/library/mappings/${id}/validate`,
    { note: 'Correspondance examinée par le responsable', confirm: 'VALIDER' },
    { 'if-match': `"${version}"` },
  );

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'rap_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'rap_reader', 'ro'));
  contributorUser = await makeUser(t, 'rap_writer', 'rw');
  contributor = await login(t, contributorUser);
  fa = await publier('RAP-A', ['A-1', 'A-2']);
  fb = await publier('RAP-B', ['B-1', 'B-2', 'B-3']);
  scope = (
    await a.post('/api/grc/smsis', { name: 'Périmètre S', scope: 'Recette', nature: 'SMI', timezone: 'Europe/Paris' })
  ).json().id;
  scope2 = (
    await a.post('/api/grc/smsis', { name: 'Périmètre S2', scope: 'Recette', nature: 'SMQ', timezone: 'Europe/Paris' })
  ).json().id;
  for (const s of [scope, scope2]) {
    expect((await attacher(s, fa)).statusCode).toBe(200);
    expect((await attacher(s, fb)).statusCode).toBe(200);
  }
  measure = (await a.post(`/api/grc/${scope}/objects`, { kind: 'measure', name: 'Mesure de S', data: {} })).json().id;
  measure2 = (await a.post(`/api/grc/${scope2}/objects`, { kind: 'measure', name: 'Mesure de S2', data: {} })).json()
    .id;
});
afterAll(() => t.close());

describe('correspondances organisationnelles', () => {
  it('se proposent avec le droit de modification et se valident par une décision humaine seulement', async () => {
    expect(
      (await reader.post('/api/library/mappings', body(req(fa, 'A-1'), req(fb, 'B-1'), 'equivalent', 100))).statusCode,
    ).toBe(403);
    const r = await contributor.post('/api/library/mappings', body(req(fa, 'A-1'), req(fb, 'B-1'), 'equivalent', 100));
    expect(r.statusCode, r.body).toBe(200);
    map1 = r.json().id;
    expect(r.json()).toMatchObject({ status: 'proposed', version: 1 });
    expect((await valider(map1, 1, contributor)).statusCode).toBe(403);
    expect(
      (await contributor.post('/api/library/mappings', body(req(fa, 'A-1'), req(fb, 'B-1'), 'partial', 50))).statusCode,
    ).toBe(409);
    expect(
      (await a.post('/api/library/mappings', body(req(fa, 'ABSENTE'), req(fb, 'B-1'), 'partial', 50))).statusCode,
    ).toBe(422);
    expect(
      (await a.post('/api/library/mappings', body(req(fa, 'A-1'), req(fa, 'A-1'), 'identical', 100))).statusCode,
    ).toBe(422);
  });
  it('refuse une version attendue périmée, puis valide avec un motif et un historique', async () => {
    expect((await valider(map1, 7)).statusCode).toBe(412);
    const r = await valider(map1, 1);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ status: 'validated', validatedBy: 'rap_admin', version: 2 });
    expect((await valider(map1, 2)).statusCode).toBe(409);
    const h = await t.svc.db.q<{ version: number }>(
      'SELECT version FROM lib_mapping_history WHERE mapping_id=$1 ORDER BY version',
      [map1],
    );
    expect(h.rows.map((x) => x.version)).toEqual([1, 2]);
    await expect(t.svc.db.q('DELETE FROM lib_mapping_history WHERE mapping_id=$1', [map1])).rejects.toThrow();
    expect(
      (
        await a.put(`/api/library/mappings/${map1}`, body(req(fa, 'A-1'), req(fb, 'B-1'), 'partial', 10), {
          'if-match': '"2"',
        })
      ).statusCode,
    ).toBe(409);
  });
});

describe('rapprochements proposés, jamais affirmés', () => {
  it('ne proposent rien sans lien de mesure, puis une proposition quand la mesure couvre l’exigence source', async () => {
    expect((await a.get(`/api/grc/${scope}/rapprochements/summary`)).json()).toEqual({ pending: 0 });
    const lien = await lier(scope, measure, refReq(fa, 'A-1'));
    expect(lien.statusCode, lien.body).toBe(200);
    const p = await proposals(scope);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({
      status: 'pending',
      coverage: 100,
      mappingType: 'equivalent',
      measure: { name: 'Mesure de S' },
      source: { requirementId: 'A-1', framework: 'Référentiel RAP-A' },
      target: { requirementId: 'B-1' },
    });
    expect((await a.get(`/api/grc/${scope}/rapprochements/summary`)).json()).toEqual({ pending: 1 });
  });
  it('préviennent le pilote dans « Mes rappels », sans doublon', async () => {
    const n = (await a.get('/api/grc/notifications')).json() as { kind: string; message: string; smsiId: string }[];
    const mine = n.filter((x) => x.kind === 'rapprochement' && x.smsiId === scope);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.message).toContain('Mesure de S');
    await a.post(`/api/grc/${scope}/rapprochements/sync`);
    expect(
      ((await a.get('/api/grc/notifications')).json() as { kind: string }[]).filter((x) => x.kind === 'rapprochement'),
    ).toHaveLength(1);
  });
  it('restent à part dans la vue commune : ni couverts, ni comptés comme couverture', async () => {
    const c = (await a.get(`/api/grc/${scope}/couverture?frameworkId=${fb}`)).json();
    const parId = (id: string) => c.frameworks.find((f: { frameworkId: string }) => f.frameworkId === id);
    expect(parId(fa)).toMatchObject({ requirements: 2, covered: 1, toValidate: 0, uncovered: 1 });
    expect(parId(fb)).toMatchObject({ requirements: 3, covered: 0, toValidate: 1, uncovered: 2 });
    expect(c.detail.find((r: { id: string }) => r.id === 'B-1').status).toBe('to_validate');
  });
  it('isolent les périmètres : la proposition de S n’apparaît pas dans S2', async () => {
    expect(await proposals(scope2)).toHaveLength(0);
    await lier(scope2, measure2, refReq(fa, 'A-1'));
    const p2 = await proposals(scope2);
    expect(p2).toHaveLength(1);
    expect(p2[0]!.measure.name).toBe('Mesure de S2');
    expect(await proposals(scope)).toHaveLength(1);
  });
  it('un rejet exige un motif, se conserve et ne se repropose pas', async () => {
    const [p] = await proposals(scope);
    const sans = await a.post(`/api/grc/${scope}/rapprochements/decision`, {
      ids: [p!.id],
      decision: 'reject',
      note: '',
      confirm: 'DECIDER',
    });
    expect(sans.statusCode).toBe(422);
    expect(
      (
        await reader.post(`/api/grc/${scope}/rapprochements/decision`, {
          ids: [p!.id],
          decision: 'reject',
          note: 'Hors sujet',
          confirm: 'DECIDER',
        })
      ).statusCode,
    ).toBe(403);
    const r = await a.post(`/api/grc/${scope}/rapprochements/decision`, {
      ids: [p!.id],
      decision: 'reject',
      note: 'Périmètre différent',
      confirm: 'DECIDER',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().results).toEqual([{ id: p!.id, ok: true }]);
    expect(r.json().pending).toBe(0);
    await a.post(`/api/grc/${scope}/rapprochements/sync`);
    expect(await proposals(scope)).toHaveLength(0);
    const rejetes = await proposals(scope, 'rejected');
    expect(rejetes[0]).toMatchObject({ status: 'rejected' });
    const links = (await a.get(`/api/grc/${scope}/links?ref=${encodeURIComponent('object:' + measure)}`)).json();
    expect(JSON.stringify(links)).not.toContain(refReq(fb, 'B-1'));
  });
});

describe('confirmation, sens inverse et retrait', () => {
  it('confirmer crée un lien explicite au nom du pilote et compte alors comme couverture', async () => {
    const m = await a.post('/api/library/mappings', body(req(fa, 'A-2'), req(fb, 'B-2'), 'partial', 40));
    map2 = m.json().id;
    expect((await valider(map2, 1)).statusCode).toBe(200);
    expect((await lier(scope, measure, refReq(fa, 'A-2'))).statusCode).toBe(200);
    const [p] = await proposals(scope);
    expect(p).toMatchObject({ coverage: 40, mappingType: 'partial', target: { requirementId: 'B-2' } });
    const r = await a.post(`/api/grc/${scope}/rapprochements/decision`, {
      ids: [p!.id, '00000000-0000-4000-8000-000000000000'],
      decision: 'confirm',
      note: '',
      confirm: 'DECIDER',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().results[0]).toEqual({ id: p!.id, ok: true });
    expect(r.json().results[1].ok).toBe(false);
    const links = (await a.get(`/api/grc/${scope}/links?ref=${encodeURIComponent('object:' + measure)}`)).json();
    expect(JSON.stringify(links)).toContain(refReq(fb, 'B-2'));
    const c = (await a.get(`/api/grc/${scope}/couverture`)).json();
    expect(c.frameworks.find((f: { frameworkId: string }) => f.frameworkId === fb)).toMatchObject({
      covered: 1,
      toValidate: 0,
    });
    expect((await proposals(scope, 'confirmed'))[0]).toMatchObject({ status: 'confirmed' });
    expect(
      await a
        .post(`/api/grc/${scope}/rapprochements/decision`, {
          ids: [p!.id],
          decision: 'confirm',
          note: '',
          confirm: 'DECIDER',
        })
        .then((x) => x.json().results[0].ok),
    ).toBe(false);
  });
  it('une correspondance identique ou équivalente se lit dans les deux sens, pas une partielle', async () => {
    const m = await a.post('/api/library/mappings', body(req(fa, 'A-2'), req(fb, 'B-3'), 'identical', 100));
    expect((await valider(m.json().id, 1)).statusCode).toBe(200);
    // Une autre mesure, sans lien explicite vers A-2 : B-3 (cible) propose A-2 (source) car la correspondance est identique.
    const autre = (
      await a.post(`/api/grc/${scope}/objects`, { kind: 'measure', name: 'Autre mesure de S', data: {} })
    ).json().id;
    expect((await lier(scope, autre, refReq(fb, 'B-3'))).statusCode).toBe(200);
    const sens = (await proposals(scope)).filter((x) => x.measure.name === 'Autre mesure de S');
    expect(sens.map((x) => x.target.requirementId)).toEqual(['A-2']);
    // B-2 est la cible d'une correspondance PARTIELLE A-2 → B-2 : une mesure liée à B-2 ne propose pas A-2.
    expect((await lier(scope, autre, refReq(fb, 'B-2'))).statusCode).toBe(200);
    const apres = (await proposals(scope)).filter((x) => x.measure.name === 'Autre mesure de S');
    expect(apres.map((x) => x.target.requirementId)).toEqual(['A-2']);
  });
  it('retirer un lien ou une correspondance retire les propositions en attente, jamais les décisions prises', async () => {
    const m = await a.post('/api/library/mappings', body(req(fa, 'A-1'), req(fb, 'B-3'), 'related', 20));
    expect((await valider(m.json().id, 1)).statusCode).toBe(200);
    // Correspondance « liée » (20 %) : proposée pour la mesure reliée à A-1, comme toute correspondance validée.
    const avant = await proposals(scope);
    expect(avant.find((x) => x.mappingType === 'related')).toMatchObject({
      coverage: 20,
      target: { requirementId: 'B-3' },
    });
    const withdrawn = await a.post(
      `/api/library/mappings/${map1}/withdraw`,
      { note: 'Correspondance retirée pour la recette', confirm: 'RETIRER' },
      { 'if-match': '"2"' },
    );
    expect(withdrawn.statusCode, withdrawn.body).toBe(200);
    expect((await proposals(scope, 'confirmed')).length).toBeGreaterThanOrEqual(1);
    // S2 : la proposition issue de la correspondance retirée a disparu ; seule celle de la correspondance « liée » reste.
    expect((await proposals(scope2)).map((x) => x.target.requirementId)).toEqual(['B-3']);
  });
  it('réserve la décision aux membres en écriture ayant le droit de Pilotage', async () => {
    expect((await contributor.get(`/api/grc/${scope}/rapprochements`)).statusCode).toBe(404);
    expect((await a.put(`/api/grc/${scope}/members`, { userId: contributorUser.id, write: true })).statusCode).toBe(
      204,
    );
    // Attribuer un accès ferme les sessions du compte visé : il se reconnecte.
    contributor = await login(t, contributorUser);
    expect((await contributor.get(`/api/grc/${scope}/rapprochements`)).statusCode).toBe(200);
  });
});
