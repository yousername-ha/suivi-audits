/* Requêtes isolées des routes (conversion Kysely, ADR 0062) : comptes proposés comme membres d'un périmètre, historique des
   publications d'un référentiel du périmètre, liste des écrans muraux, préférences d'affichage. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, scope: string;
const definition = (n: number): FrameworkDefinition => ({
  name: 'Référentiel fictif',
  identifier: 'FIN-FICTIF',
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: String(n),
    date: '2026-10-27',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
  requirements: [
    {
      id: `R${n}`,
      domain: 'gouvernance',
      title: 'Exigence fictive',
      description: 'Fictif',
      applicability: 'Tout',
      measureRefs: [],
    },
  ],
});

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'fin_admin', 'admin'));
  scope = (
    await a.post('/api/grc/smsis', { name: 'Périmètre finitions', scope: 'Recette', timezone: 'Europe/Paris' })
  ).json().id;
});
afterAll(() => t.close());

describe('requêtes des routes', () => {
  it('comptes actifs proposés comme membres, triés', async () => {
    await makeUser(t, 'fin_b', 'lecteur');
    await makeUser(t, 'fin_a', 'lecteur', { expiresAt: new Date(Date.now() + 86400e3) });
    const off = await makeUser(t, 'fin_off', 'lecteur');
    await t.svc.db.q('UPDATE users SET disabled=true WHERE id=$1', [off.id]);
    const echu = await makeUser(t, 'fin_echu', 'lecteur');
    await t.svc.db.q("UPDATE users SET expires_at=now() - interval '1 minute' WHERE id=$1", [echu.id]);
    const r = await a.get(`/api/grc/${scope}/member-candidates`);
    expect(r.statusCode, r.body).toBe(200);
    const liste = r.json() as { id: string; username: string; displayName: string }[];
    const noms = liste.map((u) => u.username).filter((n) => n.startsWith('fin_'));
    expect(noms).toEqual(['fin_a', 'fin_admin', 'fin_b']);
    expect(Object.keys(liste[0]!).sort()).toEqual(['displayName', 'id', 'username']);
    expect(liste.find((u) => u.username === 'fin_b')!.displayName).toBe('Nom fin_b');
  });

  it('historique des publications d’un référentiel, du plus récent au plus ancien', async () => {
    let id: string | null = null;
    for (const n of [1, 2]) {
      const p = await a.post(`/api/grc/${scope}/frameworks/preview`, { id, definition: definition(n) });
      const r = await a.post(
        `/api/grc/${scope}/frameworks/publish`,
        {
          id,
          definition: definition(n),
          previewId: p.json().previewId,
          reason: `Publication ${n}`,
          confirm: 'PUBLIER',
        },
        { 'if-match': `"${n - 1}"` },
      );
      expect(r.statusCode, r.body).toBe(200);
      id = r.json().id;
    }
    const h = (await a.get(`/api/grc/${scope}/frameworks/${id}/history`)).json() as Record<string, unknown>[];
    expect(h.map((x) => [x.version, x.reason, x.createdBy])).toEqual([
      [2, 'Publication 2', 'fin_admin'],
      [1, 'Publication 1', 'fin_admin'],
    ]);
    expect(Object.keys(h[0]!).sort()).toEqual(['createdAt', 'createdBy', 'definition', 'reason', 'version']);
    expect((h[0]!.definition as FrameworkDefinition).requirements[0]!.id).toBe('R2');
  });

  it('écrans muraux : actifs d’abord, puis du plus récent au plus ancien', async () => {
    const ids: string[] = [];
    for (const nom of ['Mur 1', 'Mur 2', 'Mur 3'])
      ids.push((await t.svc.walls.create(nom, ['audit'], 7, 'fin_admin')).id);
    await t.svc.walls.revoke(ids[2]!, 'fin_admin');
    const murs = (await a.get('/api/admin/murs')).json() as { id: string; name: string; revoked_at: string | null }[];
    expect(murs.map((m) => m.name)).toEqual(['Mur 2', 'Mur 1', 'Mur 3']);
    expect(murs[2]!.revoked_at).not.toBeNull();
  });

  it('préférences d’affichage enregistrées telles quelles', async () => {
    const p = (await a.get('/api/account/preferences')).json() as Record<string, unknown>;
    const r = await a.put('/api/account/preferences', p);
    expect(r.statusCode, r.body).toBe(200);
    const enBase = await t.svc.db.one<{ preferences: unknown }>(
      "SELECT preferences FROM users WHERE username='fin_admin'",
    );
    expect(enBase!.preferences).toEqual(p);
  });
});
