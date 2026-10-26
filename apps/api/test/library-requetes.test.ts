/* Requêtes de la bibliothèque (conversion Kysely, ADR 0062) : liste et ses colonnes calculées, changement de version
   rattachée, activation d'un référentiel non rattaché, détachement refusé par une fiche qui cite une exigence.
   Données fictives : aucun texte normatif. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, scope: string, libId: string;
const definition = (identifier: string): FrameworkDefinition => ({
  name: `Référentiel ${identifier}`,
  identifier,
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-26',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
  requirements: [
    {
      id: 'R1',
      domain: 'gouvernance',
      title: 'Exigence fictive 1',
      description: 'Fictif',
      applicability: 'Tout',
      measureRefs: [],
    },
    {
      id: 'R2',
      domain: 'gouvernance',
      title: 'Exigence fictive 2',
      description: 'Fictif',
      applicability: 'Tout',
      measureRefs: [],
    },
  ],
});
async function publier(def: unknown, id: string | null, expected: number) {
  const p = await a.post('/api/library/frameworks/preview', { id, definition: def });
  expect(p.statusCode, p.body).toBe(200);
  const r = await a.post(
    '/api/library/frameworks/publish',
    {
      id,
      definition: def,
      previewId: p.json().previewId,
      reason: 'Publication fictive de recette',
      confirm: 'PUBLIER',
    },
    { 'if-match': `"${expected}"` },
  );
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as { id: string; version: number };
}
const rattacher = (version: number) =>
  a.put(`/api/grc/${scope}/framework-attachments/${libId}`, { version, confirm: 'RATTACHER' });

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'libq_admin', 'admin'));
  scope = (
    await a.post('/api/grc/smsis', { name: 'Périmètre bibliothèque', scope: 'Recette', timezone: 'Europe/Paris' })
  ).json().id;
  libId = (await publier(definition('LIBQ-FICTIF'), null, 0)).id;
  await publier(definition('LIBQ-FICTIF'), libId, 1);
});
afterAll(() => t.close());

describe('bibliothèque : requêtes', () => {
  it('liste : version courante, exigences, périmètres rattachés, verrouillage et source', async () => {
    const f = ((await a.get('/api/library/frameworks')).json() as Record<string, unknown>[]).find(
      (x) => x.id === libId,
    )!;
    expect(f).toMatchObject({
      identifier: 'LIBQ-FICTIF',
      version: 2,
      requirements: 2,
      scopes: 0,
      locked: true,
      derivedFrom: null,
      source: { organisation: 'Organisation fictive', status: 'organisation' },
    });
    expect(Number.isNaN(Date.parse(String(f.updatedAt)))).toBe(false);
  });

  it('changer la version rattachée met à jour le rattachement sans doublon et la journalise', async () => {
    expect((await rattacher(1)).statusCode).toBe(200);
    const r = await rattacher(2);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toHaveLength(1);
    expect(r.json()[0]).toMatchObject({ frameworkId: libId, version: 2, latestVersion: 2, inherited: false });
    const journal = await t.svc.db.one<{ details: { previousVersion: number | null } }>(
      "SELECT details FROM audit_log WHERE action='library.framework.attached' AND target=$1 ORDER BY id DESC LIMIT 1",
      [scope],
    );
    expect(journal!.details.previousVersion).toBe(1);
  });

  it('activer ou détacher un référentiel non rattaché : 404', async () => {
    const autre = (await publier(definition('LIBQ-NON-RATTACHE'), null, 0)).id;
    expect(
      (await a.put(`/api/grc/${scope}/framework-attachments/${autre}/activation`, { enabled: false })).statusCode,
    ).toBe(404);
    expect((await a.del(`/api/grc/${scope}/framework-attachments/${autre}`)).statusCode).toBe(404);
  });

  it('détachement refusé tant qu’une fiche cite une exigence du référentiel', async () => {
    const o = await t.svc.db.one<{ id: string }>(
      `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by)
       VALUES($1,'measure','pilotage','Mesure citant une exigence',$2,'recette','recette') RETURNING id`,
      [scope, JSON.stringify({ note: `requirement:${libId}:2:R1` })],
    );
    const refus = await a.del(`/api/grc/${scope}/framework-attachments/${libId}`);
    expect(refus.statusCode, refus.body).toBe(409);
    expect(refus.body).toMatch(/0 lien\(s\), 1 objet\(s\)/);
    await t.svc.db.q('UPDATE grc_objects SET archived=true WHERE id=$1', [o!.id]);
    expect((await a.del(`/api/grc/${scope}/framework-attachments/${libId}`)).statusCode).toBe(200);
  });
});
