/* Liens transverses (lot U4, ADR 0028) : catalogue des relations contrôlé par le serveur, sens lisible des deux côtés,
   objets archivés signalés et fermés aux nouveaux liens, données de l'outil de suivi réservées au périmètre commun,
   responsables proposés limités aux comptes autorisés. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, smsi: string;
const ids: Record<string, string> = {};
const root = () => `/api/grc/${smsi}`;
const ref = (k: string) => 'object:' + ids[k];
const lier = (source: string, target: string, type: string) =>
  a.post(root() + '/links', { source, target, type, note: 'Lien de recette' });

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'liens_admin', 'admin'));
  await makeUser(t, 'liens_lecteur', 'ro');
  // Compte limité aux documents : il ne peut pas consulter le pilotage.
  await makeUser(t, 'liens_documents', 'ro', { modules: ['documents'] });
  const r = await a.post('/api/grc/smsis', { name: 'Périmètre liens', scope: 'Recette U4', timezone: 'Europe/Paris' });
  expect(r.statusCode, r.body).toBe(200);
  smsi = r.json().id;
  for (const [cle, kind, name] of [
    ['vm', 'business_asset', 'Valeur métier fictive'],
    ['bs', 'support_asset', 'Serveur fictif'],
    ['bs2', 'support_asset', 'Poste fictif'],
  ] as const) {
    const o = await a.post(root() + '/objects', { kind, name, data: {} });
    expect(o.statusCode, o.body).toBe(200);
    ids[cle] = o.json().id;
  }
});
afterAll(() => t.close());

describe('catalogue des relations', () => {
  it('relation prévue acceptée et lisible dans les deux sens', async () => {
    const r = await lier(ref('bs'), ref('vm'), 'supports');
    expect(r.statusCode, r.body).toBe(200);
    const depuisBien = (await a.get(root() + '/links?ref=' + encodeURIComponent(ref('bs')))).json();
    expect(depuisBien).toContainEqual(
      expect.objectContaining({
        type: 'supports',
        sens: 'sortant',
        other: expect.objectContaining({ name: 'Valeur métier fictive' }),
      }),
    );
    const depuisValeur = (await a.get(root() + '/links?ref=' + encodeURIComponent(ref('vm')))).json();
    expect(depuisValeur).toContainEqual(expect.objectContaining({ type: 'supports', sens: 'entrant' }));
  });

  it('relation non prévue pour la paire refusée ; « Lié à » reste possible', async () => {
    const r = await lier(ref('vm'), ref('bs'), 'treats');
    expect(r.statusCode).toBe(422);
    expect(r.json().message ?? r.body).toMatch(/non prévue/);
    expect((await lier(ref('vm'), ref('bs'), 'related_to')).statusCode).toBe(200);
  });

  it('données de l’outil de suivi refusées hors du périmètre commun', async () => {
    const r = await lier(ref('bs'), 'legacy:processes:P1', 'supports');
    expect(r.statusCode).toBe(422);
  });

  it('objet archivé : signalé dans les liens existants, fermé aux nouveaux liens', async () => {
    expect((await lier(ref('bs2'), ref('vm'), 'supports')).statusCode).toBe(200);
    const fiche = (await a.get(root() + '/objects/' + ids.bs2)).json();
    const del = await a.del(root() + '/objects/' + ids.bs2, { 'if-match': `"${fiche.version}"` });
    expect(del.statusCode, del.body).toBeLessThan(300);
    const liens = (await a.get(root() + '/links?ref=' + encodeURIComponent(ref('vm')))).json();
    expect(liens).toContainEqual(
      expect.objectContaining({ other: expect.objectContaining({ ref: ref('bs2'), archived: true }) }),
    );
    expect((await lier(ref('bs'), ref('bs2'), 'related_to')).statusCode).toBe(422);
  });
});

describe('responsables proposés', () => {
  it('seuls les comptes qui peuvent consulter le pilotage sont proposés', async () => {
    const r = await a.get(`/api/grc/00000000-0000-4000-8000-000000000001/owners`);
    expect(r.statusCode, r.body).toBe(200);
    const noms = r.json().map((u: { username: string }) => u.username);
    expect(noms).toContain('liens_admin');
    expect(noms).toContain('liens_lecteur');
    expect(noms).not.toContain('liens_documents');
  });
});
