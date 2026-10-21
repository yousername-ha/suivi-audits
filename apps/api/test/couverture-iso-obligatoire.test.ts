/* Exigences obligatoires de l'ISO/IEC 27001 (clauses 4 à 10) : jamais excluables ; les mesures de l'Annexe A le sont par
   la déclaration d'applicabilité. Une exigence dont l'applicabilité n'est pas tranchée est signalée « à déterminer ». */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, smsi: string, fw: string;
const def: FrameworkDefinition = {
  name: 'ISO fictif',
  identifier: 'iso-27001-fictif',
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-21',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [
    { id: 'clause_6', label: 'Clause 6 — Planification' },
    { id: 'annexe_a_5', label: 'Annexe A 5' },
  ],
  requirements: [
    { id: 'C6', domain: 'clause_6', title: '6.1 — Actions', description: '', applicability: '', measureRefs: [] },
    { id: 'A5', domain: 'annexe_a_5', title: '5.1 — Politiques', description: '', applicability: '', measureRefs: [] },
  ],
};
const evaluer = (req: string, corps: Record<string, unknown>, attendue = 0) =>
  admin.post(
    `/api/grc/${smsi}/exigences/${fw}/${req}/evaluations`,
    { implementation: 'partielle', reason: 'Revue de recette', confirm: 'EVALUER', ...corps },
    { 'if-match': `"${attendue}"` },
  );
const couverture = async () =>
  (await admin.get(`/api/grc/${smsi}/couverture?frameworkId=${fw}`)).json() as {
    frameworks: { etats: Record<string, number> }[];
    detail: { id: string; obligatoire: boolean; etat: string; exclusionIllicite: boolean }[];
  };

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'iso_admin', 'admin'));
  const p = await admin.post('/api/library/frameworks/preview', { id: null, definition: def });
  const r = await admin.post(
    '/api/library/frameworks/publish',
    { id: null, definition: def, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  fw = r.json().id;
  smsi = (
    await admin.post('/api/grc/smsis', {
      name: 'Périmètre ISO',
      scope: 'Recette',
      nature: '',
      timezone: 'Europe/Paris',
    })
  ).json().id;
  expect(
    (await admin.put(`/api/grc/${smsi}/framework-attachments/${fw}`, { version: 1, confirm: 'RATTACHER' })).statusCode,
  ).toBe(200);
});
afterAll(() => t.close());

describe('clauses 4 à 10 de l’ISO/IEC 27001', () => {
  it('une clause est obligatoire : applicabilité acquise, jamais « à déterminer »', async () => {
    const d = await couverture();
    expect(d.detail.map((x) => [x.id, x.obligatoire])).toEqual([
      ['C6', true],
      ['A5', false],
    ]);
    // Seule la mesure de l'Annexe A reste à trancher.
    expect(d.frameworks[0]!.etats).toMatchObject({ applicables: 2, aDeterminer: 1 });
  });
  it('refuse l’exclusion d’une clause, même justifiée', async () => {
    const r = await evaluer('C6', { applicability: 'exclue', justification: 'Hors périmètre' });
    expect(r.statusCode, r.body).toBe(422);
    expect(r.body).toMatch(/obligatoire/);
  });
  it('accepte l’exclusion justifiée d’une mesure de l’Annexe A, qui sort du total applicable', async () => {
    const r = await evaluer('A5', { applicability: 'exclue', justification: 'Hors périmètre' });
    expect(r.statusCode, r.body).toBe(201);
    expect((await couverture()).frameworks[0]!.etats).toMatchObject({
      non_applicable: 1,
      applicables: 1,
      aDeterminer: 0,
    });
  });
  it('une mesure de l’Annexe A déclarée applicable n’est plus à déterminer', async () => {
    const r = await evaluer('A5', { applicability: 'applicable' }, 1);
    expect(r.statusCode, r.body).toBe(201);
    expect((await couverture()).frameworks[0]!.etats).toMatchObject({ applicables: 2, aDeterminer: 0 });
  });
  it('une clause est « pas encore conforme » jusqu’à une mise en œuvre complète et un test conforme', async () => {
    expect((await couverture()).frameworks[0]!.etats).toMatchObject({ obligatoiresNonConformes: 1 });
    const partielle = await evaluer('C6', { applicability: 'applicable' });
    expect(partielle.statusCode, partielle.body).toBe(201);
    expect((await couverture()).frameworks[0]!.etats).toMatchObject({ obligatoiresNonConformes: 1 });
    const conforme = await evaluer(
      'C6',
      {
        applicability: 'applicable',
        implementation: 'complete',
        testedAt: '2026-10-20',
        testResult: 'conforme',
        testRef: 'document:fictif:1',
      },
      1,
    );
    expect(conforme.statusCode, conforme.body).toBe(201);
    expect((await couverture()).frameworks[0]!.etats).toMatchObject({ obligatoiresNonConformes: 0, teste: 1 });
  });
});
