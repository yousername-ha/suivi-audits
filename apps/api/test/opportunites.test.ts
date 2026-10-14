/* Opportunité (ISO 9001:2015, 6.1.1 b et 6.1.2) : objet du registre commun, plus léger que le risque. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, ro: Agent;
const racine = `/api/grc/${DEFAULT_SMSI}`;
const donnees = (extra = {}) => ({
  description: 'Nouveau marché accessible grâce à la certification',
  ownerId: null,
  refs: [],
  source: 'Enjeu externe : demande des clients',
  benefit: 'Accès à des appels d’offres',
  status: 'identified',
  decision: '',
  reviewAt: '2027-03-01',
  dueAt: '',
  ...extra,
});
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'opp_admin', 'admin'));
  ro = await login(t, await makeUser(t, 'opp_ro', 'ro'));
});
afterAll(() => t.close());

describe('opportunités', () => {
  it('crée, relit et modifie une opportunité du périmètre commun', async () => {
    const r = await a.post(`${racine}/objects`, {
      kind: 'opportunity',
      name: 'Marché des établissements',
      data: donnees(),
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      kind: 'opportunity',
      data: { status: 'identified', benefit: 'Accès à des appels d’offres' },
    });
    const liste = (await a.get(`${racine}/objects?kind=opportunity`)).json();
    expect(liste.items).toHaveLength(1);
    const maj = await a.put(
      `${racine}/objects/${r.json().id}`,
      {
        kind: 'opportunity',
        name: 'Marché des établissements',
        data: donnees({ status: 'evaluated', decision: 'À poursuivre au prochain semestre' }),
      },
      { 'if-match': `"${r.json().version}"` },
    );
    expect(maj.statusCode, maj.body).toBe(200);
    expect(maj.json().data.status).toBe('evaluated');
  });
  it('refuse un état inconnu et une date impossible, et la lecture seule', async () => {
    expect(
      (await a.post(`${racine}/objects`, { kind: 'opportunity', name: 'x', data: donnees({ status: 'inconnu' }) }))
        .statusCode,
    ).toBe(422);
    expect(
      (await a.post(`${racine}/objects`, { kind: 'opportunity', name: 'x', data: donnees({ reviewAt: '2027-02-30' }) }))
        .statusCode,
    ).toBe(422);
    expect((await ro.post(`${racine}/objects`, { kind: 'opportunity', name: 'y', data: donnees() })).statusCode).toBe(
      403,
    );
  });
  it('se rattache à un processus par un lien « lié à »', async () => {
    const p = (await a.post(`${racine}/pilotage/objectifs/processes`, { name: 'Commercial' })).json();
    const o = (await a.post(`${racine}/objects`, { kind: 'opportunity', name: 'Lien', data: donnees() })).json();
    const l = await a.post(`${racine}/links`, {
      source: 'object:' + o.id,
      target: p.ref,
      type: 'related_to',
      note: 'Processus concerné',
    });
    expect(l.statusCode, l.body).toBe(200);
  });
});
