/* Requêtes du pilotage (conversion Kysely, ADR 0062) : journal des décisions d'une fiche paginé par date (50 par page,
   plus récent d'abord), colonnes renvoyées. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, smsi: string, ref: string;

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'pq_admin', 'admin'));
  smsi = (await a.post('/api/grc/smsis', { name: 'Périmètre PQ', scope: 'PQ', timezone: 'Europe/Paris' })).json().id;
  const o = await a.post(`/api/grc/${smsi}/objects`, { kind: 'control', name: 'Contrôle PQ', data: {} });
  expect(o.statusCode, o.body).toBe(200);
  ref = 'object:' + o.json().id;
  // 55 décisions fictives, une par minute : le journal est immuable, on l'alimente directement.
  for (let i = 0; i < 55; i++)
    await t.svc.db.q(
      `INSERT INTO pilotage_decisions(smsi_id,source_ref,source_version,operation,step,result,performed_on,note,refs,snapshot,
         generated_refs,request_id,intent_hash,created_by,terms,created_at)
       VALUES($1,$2,1,'control_execution','','pass','2026-10-01',$3,'[]','{}','[]',gen_random_uuid(),'x','recette','{}',
         timestamptz '2026-10-01 08:00:00+00' + make_interval(mins => $4))`,
      [smsi, ref, `Décision ${i}`, i],
    );
});
afterAll(() => t.close());

describe('pilotage : requêtes', () => {
  it('journal paginé : 50 plus récentes, puis la suite avant la dernière date reçue', async () => {
    const p1 = (await a.get(`/api/grc/${smsi}/pilotage/history?ref=${encodeURIComponent(ref)}`)).json();
    expect(p1.items).toHaveLength(50);
    expect(p1.items[0]).toMatchObject({
      note: 'Décision 54',
      sourceRef: ref,
      sourceVersion: 1,
      operation: 'control_execution',
      result: 'pass',
      date: '2026-10-01',
      createdBy: 'recette',
    });
    expect(p1.nextBefore).toBe(p1.items[49].createdAt);
    const p2 = (
      await a.get(
        `/api/grc/${smsi}/pilotage/history?ref=${encodeURIComponent(ref)}&before=${encodeURIComponent(p1.nextBefore)}`,
      )
    ).json();
    expect(p2.items.map((d: { note: string }) => d.note)).toEqual([4, 3, 2, 1, 0].map((i) => `Décision ${i}`));
    expect(p2.nextBefore).toBeNull();
  });
});
