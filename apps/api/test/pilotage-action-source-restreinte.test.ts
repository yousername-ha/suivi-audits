/* Une action générée par une décision de pilotage sur une fiche d'un registre restreint n'atterrit pas dans le plan
   ouvert par défaut avec le titre de la fiche : le plan d'accueil est choisi par l'auteur. Données fictives. */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const base = `/api/grc/${DEFAULT_SMSI}`;
const NOM_FICHE = 'Écart confidentiel fictif';

describe('action dérivée d’une fiche de registre restreint', () => {
  let t: TestApp, admin: Agent, lecteur: Agent;
  let document = '',
    ecartRestreint = '',
    ecartOuvert = '',
    planRestreint = '';

  const decide = async (ref: string, version: number, extra: Record<string, unknown> = {}) =>
    admin.post(
      base + '/pilotage/decisions',
      {
        ref,
        decision: {
          operation: 'action_create',
          result: 'completed',
          date: '2026-10-10',
          note: 'Justification détaillée de la recette métier',
          refs: [document],
          requestId: crypto.randomUUID(),
          step: '',
          createFinding: false,
          createAction: true,
          confirm: 'ENREGISTRER',
          ...extra,
        },
      },
      { 'if-match': `"${version}"` },
    );
  const ecart = async (name: string, registreId?: string) => {
    const r = await admin.post(base + '/objects', {
      kind: 'nonconformity',
      name,
      ...(registreId ? { registreId } : {}),
      data: { cause: 'Cause fictive' },
    });
    expect(r.statusCode, r.body).toBe(200);
    return r.json() as { id: string; version: number };
  };

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'pa_admin', 'admin'));
    lecteur = await login(t, await makeUser(t, 'pa_lecteur', 'ro'));
    const doc = await admin.req('POST', '/api/documents', {
      body: Buffer.from('Justificatif de recette'),
      headers: {
        'x-file-name': 'preuve.txt',
        'x-meta': encodeURIComponent(JSON.stringify({ title: 'Justificatif fictif' })),
      },
    });
    expect(doc.statusCode, doc.body).toBe(201);
    document = 'document:' + doc.json().id + ':1';
    const registre = async (kind: string, name: string, restreint: boolean) => {
      const r = await admin.post('/api/registres', {
        kind,
        name,
        referenceId: DEFAULT_SMSI,
        perimetres: [],
        restreint,
      });
      expect(r.statusCode, r.body).toBe(201);
      return r.json().id as string;
    };
    const ecartsRestreints = await registre('ecarts', 'Écarts restreints fictifs', true);
    planRestreint = await registre('plan_actions', 'Plan restreint fictif', true);
    const e = await ecart(NOM_FICHE, ecartsRestreints);
    ecartRestreint = 'object:' + e.id;
    ecartOuvert = 'object:' + (await ecart('Écart ordinaire fictif')).id;
  });
  afterAll(() => t.close());

  const version = async (ref: string) =>
    ((await admin.get(base + '/objects/' + ref.slice(7))).json() as { version: number }).version;

  it('sans plan d’accueil, la décision est refusée et rien n’est créé', async () => {
    const avant = (await admin.get(base + '/objects?kind=action')).json().items.length;
    const r = await decide(ecartRestreint, await version(ecartRestreint));
    expect(r.statusCode, r.body).toBe(422);
    expect((await admin.get(base + '/objects?kind=action')).json().items.length).toBe(avant);
  });

  it('avec un plan d’accueil restreint, l’action y est créée et reste masquée au lecteur', async () => {
    const r = await decide(ecartRestreint, await version(ecartRestreint), { registreId: planRestreint });
    expect(r.statusCode, r.body).toBe(200);
    const action = (r.json().generatedRefs as string[])[0]!;
    const dto = (await admin.get(base + '/objects/' + action.slice(7))).json();
    expect(dto.registreId).toBe(planRestreint);
    expect((await lecteur.get(base + '/objects/' + action.slice(7))).statusCode).toBe(404);
    const liste = (await lecteur.get(base + '/objects?kind=action')).json().items as { name: string }[];
    expect(liste.some((x) => x.name.includes(NOM_FICHE))).toBe(false);
  });

  it('témoin : une fiche ordinaire garde le plan par défaut', async () => {
    const r = await decide(ecartOuvert, await version(ecartOuvert));
    expect(r.statusCode, r.body).toBe(200);
    const action = (r.json().generatedRefs as string[])[0]!;
    const dto = (await admin.get(base + '/objects/' + action.slice(7))).json();
    expect(dto.registreId).not.toBe(planRestreint);
    expect((await lecteur.get(base + '/objects/' + action.slice(7))).statusCode).toBe(200);
  });
});
