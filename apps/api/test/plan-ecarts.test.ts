/* Plan d'action des écarts (ADR 0056) : aperçu en lecture seule, création idempotente, éligibilité recalculée par le
   serveur, droits. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent, etrangerAgent: Agent, smsi: string, fw: string;
const def: FrameworkDefinition = {
  name: 'Référentiel fictif d’écarts',
  identifier: 'ecarts-fictif',
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-25',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'd', label: 'Domaine' }],
  requirements: ['R1', 'R2', 'R3', 'R4', 'R5'].map((id) => ({
    id,
    domain: 'd',
    title: `Exigence ${id}`,
    description: '',
    applicability: '',
    measureRefs: [],
  })),
};
const evaluer = (req: string, corps: Record<string, unknown>) =>
  admin.post(
    `/api/grc/${smsi}/exigences/${fw}/${req}/evaluations`,
    { implementation: 'aucune', reason: 'Revue de recette', confirm: 'EVALUER', ...corps },
    { 'if-match': '"0"' },
  );
const apercu = async () => (await admin.get(`/api/grc/${smsi}/plan-ecarts?frameworkId=${fw}`)).json();
const creer = (ids: string[], extra: Record<string, unknown> = {}, agent = admin) =>
  agent.post(`/api/grc/${smsi}/plan-ecarts`, { frameworkId: fw, requirementIds: ids, confirm: 'CREER', ...extra });

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ecarts_admin', 'admin'));
  const membre = await makeUser(t, 'ecarts_lecteur', 'ro');
  const etranger = await login(t, await makeUser(t, 'ecarts_etranger', 'ro'));
  const p = await admin.post('/api/library/frameworks/preview', { id: null, definition: def });
  const r = await admin.post(
    '/api/library/frameworks/publish',
    { id: null, definition: def, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  fw = r.json().id;
  smsi = (
    await admin.post('/api/grc/smsis', { name: 'Service fictif', scope: 'Recette', timezone: 'Europe/Paris' })
  ).json().id;
  await admin.put(`/api/grc/${smsi}/framework-attachments/${fw}`, { version: 1, confirm: 'RATTACHER' });
  await admin.put(`/api/grc/${smsi}/members`, { userId: membre.id, write: false });
  lecteur = await login(t, membre); // après l'ajout : un changement de droits clôt les sessions ouvertes
  etrangerAgent = etranger;
  // R1 applicable non implémentée, R2 applicable partielle, R3 applicable complète, R4 exclue, R5 jamais évaluée.
  await evaluer('R1', { applicability: 'applicable' });
  await evaluer('R2', { applicability: 'applicable', implementation: 'partielle' });
  await evaluer('R3', { applicability: 'applicable', implementation: 'complete' });
  await evaluer('R4', { applicability: 'exclue', justification: 'Hors périmètre' });
});
afterAll(() => t.close());

describe('plan d’action des écarts', () => {
  it('l’aperçu ne propose que les exigences applicables non implémentées ou partielles, sans rien écrire', async () => {
    const a = await apercu();
    expect(a.ecarts).toBe(2);
    expect(a.aCreer).toBe(2);
    expect(a.horsEcart).toBe(3);
    expect(a.exigences.map((e: { id: string; etat: string }) => [e.id, e.etat])).toEqual([
      ['R1', 'non_implemente'],
      ['R2', 'partiel'],
    ]);
    expect(a.avertissements.join(' ')).toMatch(/à déterminer/);
    expect((await apercu()).aCreer).toBe(2);
  });

  it('refuse sans confirmation, sans droit de modifier et pour un référentiel non rattaché', async () => {
    expect((await creer(['R1'], { confirm: 'oui' })).statusCode).toBe(422);
    const refus = await creer(['R1'], {}, lecteur);
    expect(refus.statusCode, refus.body).toBe(403);
    expect((await creer(['R1'], {}, etrangerAgent)).statusCode).toBe(404);
    expect((await etrangerAgent.get(`/api/grc/${smsi}/plan-ecarts?frameworkId=${fw}`)).statusCode).toBe(404);
    const autre = await admin.get(`/api/grc/${smsi}/plan-ecarts?frameworkId=00000000-0000-4000-8000-000000000000`);
    expect(autre.statusCode).toBe(404);
    expect((await creer(['INCONNUE'])).statusCode).toBe(422);
  });

  it('crée une action liée par exigence en écart, ignore les autres, et rejouer n’ajoute rien', async () => {
    const r = await creer(['R1', 'R2', 'R3', 'R5'], { dueAt: '2027-03-31' });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ creees: 2, dejaCouvertes: 0, horsEcart: 2 });
    const noms = r.json().actions.map((x: { name: string }) => x.name);
    expect(noms).toEqual(['Mettre en œuvre : Exigence R1', 'Mettre en œuvre : Exigence R2']);

    const detail = (await admin.get(`/api/grc/${smsi}/couverture?frameworkId=${fw}`)).json() as {
      detail: { id: string; measures: unknown[] }[];
    };
    expect(detail.detail.find((d) => d.id === 'R1')!.measures.length).toBe(1);
    expect(detail.detail.find((d) => d.id === 'R3')!.measures.length).toBe(0);

    const rejeu = await creer(['R1', 'R2']);
    expect(rejeu.json()).toMatchObject({ creees: 0, dejaCouvertes: 2 });
    const a = await apercu();
    expect(a).toMatchObject({ ecarts: 2, dejaCouverts: 2, aCreer: 0 });
  });

  it('recalcule l’éligibilité : une exigence devenue implémentée n’est plus un écart', async () => {
    const r = await admin.post(
      `/api/grc/${smsi}/exigences/${fw}/R2/evaluations`,
      { applicability: 'applicable', implementation: 'complete', reason: 'Mise en œuvre terminée', confirm: 'EVALUER' },
      { 'if-match': '"1"' },
    );
    expect(r.statusCode, r.body).toBe(201);
    expect((await apercu()).ecarts).toBe(1);
  });

  it('journalise la création en lot', async () => {
    const journal = await t.svc.db.q<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log WHERE action='grc.plan_ecarts.created'`,
    );
    expect(journal.rows[0]!.n).toBe(1);
  });
});
