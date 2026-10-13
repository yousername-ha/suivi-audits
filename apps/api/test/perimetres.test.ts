/* Page « Périmètres » (ADR 0030, lot M1) : nature libre, modification avec version attendue, droit de Pilotage,
   journal d'audit et accès restreint. La nature est une simple étiquette : aucune règle de comportement n'en dépend. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, contributor: Agent, id: string;
const corps = { name: 'Qualité', scope: 'Activités du SMQ', nature: 'SMQ', timezone: 'Europe/Paris' };

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'perim_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'perim_reader', 'ro'));
  contributor = await login(t, await makeUser(t, 'perim_writer', 'rw'));
});
afterAll(async () => {
  await t.close();
});

describe('périmètres de management', () => {
  it('crée un périmètre avec une nature libre et la restitue dans la liste', async () => {
    const r = await admin.post('/api/grc/smsis', corps);
    expect(r.statusCode, r.body).toBe(200);
    id = r.json().id;
    expect(r.json().nature).toBe('SMQ');
    const liste = (await admin.get('/api/grc/smsis')).json() as { id: string; nature: string }[];
    expect(liste.find((x) => x.id === id)?.nature).toBe('SMQ');
    // Le périmètre historique n'a pas de nature : aucune nature n'est imposée au démarrage.
    expect(liste.find((x) => x.id === DEFAULT_SMSI)?.nature).toBe('');
  });

  it('accepte une nature vide ou un libellé libre, refuse un libellé trop long', async () => {
    const sans = await admin.post('/api/grc/smsis', { ...corps, name: 'Sans nature', nature: '' });
    expect(sans.statusCode, sans.body).toBe(200);
    expect(sans.json().nature).toBe('');
    const libre = await admin.post('/api/grc/smsis', { ...corps, name: 'Libre', nature: 'Système intégré HDS' });
    expect(libre.json().nature).toBe('Système intégré HDS');
    const long = await admin.post('/api/grc/smsis', { ...corps, name: 'Trop long', nature: 'x'.repeat(61) });
    expect(long.statusCode).toBe(422);
  });

  it('modifie nom, texte, nature et fuseau avec la version attendue, et la fait avancer', async () => {
    const avant = (await admin.get('/api/grc/smsis')).json().find((x: { id: string }) => x.id === id);
    const r = await admin.patch(
      `/api/grc/smsis/${id}`,
      {
        name: 'Qualité et sécurité',
        scope: 'SMI : activités partagées',
        nature: 'SMI',
        timezone: 'Europe/Paris',
        confirm: 'ENREGISTRER',
      },
      { 'if-match': `"${avant.version}"` },
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ name: 'Qualité et sécurité', nature: 'SMI', version: avant.version + 1 });
    const audit = await t.svc.db.one<{ details: { changed: string[]; previousNature: string } }>(
      "SELECT details FROM audit_log WHERE action='grc.smsi.updated' AND target=$1 ORDER BY id DESC LIMIT 1",
      [id],
    );
    expect(audit!.details.changed).toEqual(['name', 'scope', 'nature']);
    expect(audit!.details.previousNature).toBe('SMQ');
  });

  it('refuse une version périmée (412), l’absence de version (428) et une confirmation absente', async () => {
    const corpsOk = { name: 'Qualité', scope: 'x', nature: 'SMQ', timezone: 'Europe/Paris', confirm: 'ENREGISTRER' };
    expect((await admin.patch(`/api/grc/smsis/${id}`, corpsOk, { 'if-match': '"1"' })).statusCode).toBe(412);
    expect((await admin.patch(`/api/grc/smsis/${id}`, corpsOk)).statusCode).toBe(428);
    const courant = (await admin.get('/api/grc/smsis')).json().find((x: { id: string }) => x.id === id);
    const sans = { name: 'Qualité', scope: 'x', nature: 'SMQ', timezone: 'Europe/Paris' };
    expect((await admin.patch(`/api/grc/smsis/${id}`, sans, { 'if-match': `"${courant.version}"` })).statusCode).toBe(
      422,
    );
    expect(
      (
        await admin.patch(
          `/api/grc/smsis/${id}`,
          { ...corpsOk, timezone: 'Mars/Phobos' },
          { 'if-match': `"${courant.version}"` },
        )
      ).statusCode,
    ).toBe(422);
  });

  it('réserve la création et la modification au droit de Pilotage', async () => {
    const corpsOk = { ...corps, confirm: 'ENREGISTRER' };
    for (const a of [reader, contributor]) {
      expect((await a.post('/api/grc/smsis', corps)).statusCode).toBe(403);
      expect((await a.patch(`/api/grc/smsis/${DEFAULT_SMSI}`, corpsOk, { 'if-match': '"1"' })).statusCode).toBe(403);
    }
  });

  it('ne révèle pas un périmètre restreint à un compte qui n’en est pas membre', async () => {
    const r = await contributor.patch(
      `/api/grc/smsis/${id}`,
      { ...corps, confirm: 'ENREGISTRER' },
      { 'if-match': '"1"' },
    );
    expect([403, 404]).toContain(r.statusCode);
    expect((await contributor.get('/api/grc/smsis')).json().some((x: { id: string }) => x.id === id)).toBe(false);
  });
});
