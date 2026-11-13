/* Une seule source de l'applicabilité (BUG-063) : à défaut d'évaluation enregistrée, la couverture d'un référentiel reprend la
   décision de la déclaration d'applicabilité portant le même identifiant d'exigence. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, smsi: string, fw: string;
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

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cdda_admin', 'admin'));
  const p = await admin.post('/api/library/frameworks/preview', { id: null, definition: def });
  const r = await admin.post(
    '/api/library/frameworks/publish',
    { id: null, definition: def, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  fw = r.json().id;
  smsi = (await admin.post('/api/grc/smsis', { name: 'Périmètre DdA', scope: 'x', timezone: 'Europe/Paris' })).json()
    .id;
  const att = await admin.put(`/api/grc/${smsi}/framework-attachments/${fw}`, {
    version: 1,
    statut: 'applique',
    confirm: 'RATTACHER',
  });
  expect(att.statusCode, att.body).toBe(200);
  const etat = (await admin.get('/api/suivi/etat')).json();
  etat.dda = {
    R1: { app: 'oui', level: 'Total', just: 'Décision fictive' },
    R2: { app: 'non', just: 'Hors périmètre fictif' },
  };
  await seedState(t, etat);
});
afterAll(() => t.close());

describe('couverture et déclaration d’applicabilité', () => {
  it('reprend l’applicabilité et le niveau de la DdA pour les exigences non évaluées', async () => {
    const r = await admin.get(`/api/grc/${smsi}/couverture?frameworkId=${fw}`);
    expect(r.statusCode, r.body).toBe(200);
    const detail = r.json().detail as { id: string; etat: string }[];
    expect(detail.find((d) => d.id === 'R1')!.etat).toBe('implemente');
    expect(detail.find((d) => d.id === 'R2')!.etat).toBe('non_applicable');
    expect(r.json().frameworks[0].etats).toMatchObject({ aDeterminer: 0 });
  });
});
