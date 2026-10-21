/* Journal des décisions d'un écart : il reste lisible (fiche et export) après le déplacement de l'écart vers un registre dont
   le périmètre de référence est autre. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

describe('décisions après déplacement', () => {
  let t: TestApp;
  let admin: Agent;
  let A: string, C: string, ecart: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'dec_admin', 'admin'));
    const p = async (n: string) =>
      (await admin.post('/api/grc/smsis', { name: n, scope: n, timezone: 'Europe/Paris' })).json().id as string;
    [A, C] = [await p('Périmètre origine'), await p('Périmètre destination')];
    const rA = (await admin.post('/api/registres', { kind: 'ecarts', name: 'Écarts origine', referenceId: A })).json()
      .id as string;
    const rC = (
      await admin.post('/api/registres', { kind: 'ecarts', name: 'Écarts destination', referenceId: C })
    ).json().id as string;
    ecart = (
      await admin.post(`/api/grc/${A}/objects`, {
        kind: 'nonconformity',
        name: 'Écart déplacé',
        registreId: rA,
        data: { cause: 'cause' },
      })
    ).json().id;
    await t.svc.db.q(
      `INSERT INTO pilotage_decisions(smsi_id,source_ref,source_version,operation,result,performed_on,note,snapshot,request_id,intent_hash,created_by)
       VALUES ($1,$2,1,'finding_verification','ok','2026-10-01','Vérification fictive','{}',gen_random_uuid(),'h','test')`,
      [A, 'object:' + ecart],
    );
    const v = (await t.svc.db.one<{ version: number }>('SELECT version FROM grc_objects WHERE id=$1', [ecart]))!
      .version;
    const r = await admin.post(
      `/api/grc/${A}/objects/${ecart}/deplacement`,
      { registreId: rC, reason: 'Réorganisation des registres.' },
      { 'if-match': `"${v}"` },
    );
    expect(r.statusCode, r.body).toBe(200);
  });
  afterAll(async () => t.close());

  it('la fiche déplacée garde son historique de décisions', async () => {
    expect(
      (await t.svc.db.one<{ smsi_id: string }>('SELECT smsi_id FROM grc_objects WHERE id=$1', [ecart]))!.smsi_id,
    ).toBe(C);
    const r = await admin.get(`/api/grc/${C}/pilotage/history?ref=${encodeURIComponent('object:' + ecart)}`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().items.map((d: { note: string }) => d.note)).toEqual(['Vérification fictive']);
  });

  it('l’export du registre reprend aussi ces décisions', async () => {
    const r = await admin.get(`/api/grc/${C}/pilotage/export?kind=nonconformity`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().decisions.map((d: { note: string }) => d.note)).toEqual(['Vérification fictive']);
  });
});
