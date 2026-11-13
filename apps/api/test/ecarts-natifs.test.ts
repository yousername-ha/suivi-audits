/* Constats de l'état du suivi : projection en lecture seule des écarts natifs du périmètre commun (plus de stockage
   historique). Le module Audit, le tableau de bord et les exports lisent cette projection. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ecartNatifVersFinding } from '../src/historique/ecarts-natifs.js';
import { createTestApp, ecartCommun, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

const COMMUN = '00000000-0000-4000-8000-000000000001';
let t: TestApp, admin: Agent;
const findings = async () => (await admin.get('/api/suivi/etat')).json().findings as Record<string, unknown>[];

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ecn_admin', 'admin'));
  await seedState(t, {
    v: 1,
    years: [2026],
    items: [{ id: 'A-5.1', ref: 'A', num: '5.1', title: 'Politiques', afnor: {}, interne: {} }],
  });
});
afterAll(() => t.close());

describe('écarts natifs vus comme constats', () => {
  it('projette type, source, mesures, statut et échéance d’un écart du périmètre commun', async () => {
    expect(await findings()).toEqual([]);
    const e = await ecartCommun(admin, {
      name: 'Écart de surveillance',
      source: 'AFNOR',
      classification: 'majeure',
      items: ['A-5.1'],
      dueAt: '2026-12-31',
    });
    const [f] = await findings();
    expect(f).toMatchObject({
      id: e.id,
      source: 'AFNOR',
      type: 'NC maj',
      status: 'Ouvert',
      text: 'Écart de surveillance',
      items: ['A-5.1'],
      due: '2026-12-31',
      findingType: 'nonconformity',
    });
    expect(f!.year).toBe(new Date().getFullYear());
  });

  it('un écart clos est un constat « Clos » ; une observation reste une remarque', async () => {
    const clos = await ecartCommun(admin, { name: 'Écart clos', classification: 'mineure' });
    await t.svc.db.q(`UPDATE grc_objects SET data=jsonb_set(data,'{status}',$2::jsonb) WHERE id=$1`, [
      clos.id,
      JSON.stringify('closed'),
    ]);
    await ecartCommun(admin, { name: 'Observation', findingType: 'observation' });
    const liste = await findings();
    expect(liste.find((f) => f.id === clos.id)).toMatchObject({ status: 'Clos', type: 'NC min', source: 'Interne' });
    expect(liste.find((f) => f.text === 'Observation')).toMatchObject({ type: 'Remarque', status: 'Ouvert' });
  });

  it('ne projette ni les écarts d’un autre périmètre, ni ceux d’un registre restreint, ni les archivés', async () => {
    const avant = (await findings()).length;
    const autre = (
      await admin.post('/api/grc/smsis', { name: 'Autre périmètre', scope: 'x', timezone: 'Europe/Paris' })
    ).json().id as string;
    await admin.post(`/api/grc/${autre}/objects`, { kind: 'nonconformity', name: 'Ailleurs', data: {} });
    const reg = (
      await admin.post('/api/registres', {
        kind: 'ecarts',
        name: 'Écarts secrets',
        referenceId: COMMUN,
        restreint: true,
      })
    ).json().id as string;
    await admin.post(`/api/grc/${COMMUN}/objects`, {
      kind: 'nonconformity',
      name: 'Secret',
      registreId: reg,
      data: {},
    });
    const archive = await ecartCommun(admin, { name: 'À archiver' });
    await t.svc.db.q('UPDATE grc_objects SET archived=true WHERE id=$1', [archive.id]);
    const noms = (await findings()).map((f) => f.text);
    expect(noms).not.toEqual(expect.arrayContaining(['Ailleurs']));
    expect(noms).not.toContain('Secret');
    expect(noms).not.toContain('À archiver');
    expect(noms).toHaveLength(avant);
  });

  it('est en lecture seule : un enregistrement de l’état n’écrit rien et n’efface rien', async () => {
    const avant = await findings();
    const etat = (await admin.get('/api/suivi/etat')).json();
    etat.findings = [{ id: 'X-1', text: 'Imposé', status: 'Ouvert', items: [] }];
    await seedState(t, etat);
    expect(await findings()).toEqual(avant);
  });
});

describe('rattachement d’un écart à une mesure (BUG-041)', () => {
  const ligne = (refs: string[]) => ({
    id: '11111111-1111-4111-8111-111111111111',
    legacy_id: 'FOU-01',
    name: 'Écart fictif',
    data: { refs, status: 'open' },
    created_at: new Date('2026-11-13T10:00:00Z'),
  });
  const FW = '22222222-2222-4222-8222-222222222222';
  it('reprend la mesure d’une exigence du référentiel appliqué, comme celle d’une référence historique, sans doublon', () => {
    expect(ecartNatifVersFinding(ligne([`requirement:${FW}:3:A-5.24`]))).toMatchObject({ items: ['A-5.24'] });
    expect(
      ecartNatifVersFinding(ligne(['legacy:items:A-5.24', `requirement:${FW}:3:A-5.24`, `requirement:${FW}:3:A-8.13`])),
    ).toMatchObject({ items: ['A-5.24', 'A-8.13'] });
    expect(ecartNatifVersFinding(ligne([`object:${FW}`]))).toMatchObject({ items: [] });
  });
});
