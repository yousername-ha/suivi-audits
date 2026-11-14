/* Déclaration d'applicabilité par périmètre (BUG-062, ISO/IEC 27001:2022, 6.1.3 d) : le périmètre commun garde celle de l'outil
   de suivi, chaque autre périmètre a la sienne ; une décision prise dans l'un ne change pas l'autre. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

const COMMUN = '00000000-0000-4000-8000-000000000001';
let t: TestApp, admin: Agent, autre: Agent, sous: string, ferme: string;
const it_ = (id: string, ref: string, num: string) => ({ id, ref, num, title: `Mesure ${id}`, afnor: {}, interne: {} });

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ddp_admin', 'admin'));
  await seedState(t, { items: [it_('A-5.1', 'A', '5.1'), it_('A-5.2', 'A', '5.2'), it_('ISO-6.1', 'ISO', '6.1')] });
  sous = (
    await admin.post('/api/grc/smsis', { name: 'Sous-périmètre DdA', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id;
  ferme = (await admin.post('/api/grc/smsis', { name: 'Périmètre fermé', scope: 'x', timezone: 'Europe/Paris' })).json()
    .id;
  autre = await login(t, await makeUser(t, 'ddp_autre', 'rw'));
});
afterAll(() => t.close());

describe('déclaration d’applicabilité par périmètre', () => {
  it('une décision prise sous un périmètre ne modifie pas celle du périmètre commun, et inversement', async () => {
    const r = await admin.patch(`/api/dda/A-5.1?smsi=${sous}`, {
      app: 'oui',
      level: 'Partiel',
      just: 'Décision du sous-périmètre',
    });
    expect(r.statusCode, r.body).toBe(200);
    const enfant = (await admin.get(`/api/dda?reference=A&smsi=${sous}`)).json();
    expect(enfant.dda['A-5.1']).toMatchObject({ app: 'oui', level: 'Partiel' });
    expect(enfant.dda['A-5.2']).toBeUndefined();
    const commun = (await admin.get('/api/dda?reference=A')).json();
    expect(commun.dda['A-5.1']).toBeUndefined();
    expect((await admin.patch('/api/dda/A-5.2', { app: 'non', just: 'Décision commune' })).statusCode).toBe(200);
    const enfantApres = (await admin.get(`/api/dda?reference=A&smsi=${sous}`)).json();
    expect(enfantApres.dda['A-5.2']).toBeUndefined();
    expect(enfantApres.mesures.map((m: { id: string }) => m.id)).toEqual(['A-5.1', 'A-5.2']);
  });
  it('mêmes règles qu’au périmètre commun : niveau après applicabilité, clauses ISO obligatoires', async () => {
    const sansDecision = await admin.patch(`/api/dda/A-5.2?smsi=${sous}`, { level: 'Total' });
    expect(sansDecision.statusCode, sansDecision.body).toBe(422);
    expect((await admin.patch(`/api/dda/ISO-6.1?smsi=${sous}`, { app: 'non' })).statusCode).toBe(422);
    expect((await admin.patch(`/api/dda/ISO-6.1?smsi=${sous}`, { level: 'Total' })).statusCode).toBe(200);
    expect((await admin.patch(`/api/dda/A-9.9?smsi=${sous}`, { app: 'oui' })).statusCode).toBe(404);
  });
  it('un périmètre inaccessible est refusé en lecture et en écriture (404)', async () => {
    // « autre » est rattaché au périmètre commun seulement (rattachement par défaut des comptes de test).
    expect((await autre.get(`/api/dda?reference=A&smsi=${ferme}`)).statusCode).toBe(404);
    expect((await autre.patch(`/api/dda/A-5.1?smsi=${ferme}`, { app: 'oui' })).statusCode).toBe(404);
    expect((await autre.get(`/api/dda?reference=A&smsi=${COMMUN}`)).statusCode).toBe(200);
  });
});
