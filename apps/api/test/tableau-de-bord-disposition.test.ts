/* Disposition du tableau de bord (ADR 0078, lots 2a et 2b) : disposition personnelle par compte (droit
   tableau_de_bord:modifier), disposition par défaut réservée au droit « administrer » et journalisée, concurrence
   optimiste (If-Match, 412), validation (422), isolement entre comptes. Le partage est testé à part
   (tableau-de-bord-partage.test.ts). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const URL_PERSO = '/api/tableau-de-bord/disposition';
const URL_DEFAUT = '/api/admin/tableau-de-bord/disposition-par-defaut';
const D1 = {
  dalles: [
    { id: 'echeances', largeur: 12, masquee: false },
    { id: 'phare', largeur: 6, masquee: true },
  ],
};
const D2 = { dalles: [{ id: 'ecarts', largeur: 4, masquee: false }] };
const v = (n: number) => ({ 'if-match': `"${n}"` });

let t: TestApp, admin: Agent, alice: Agent, bob: Agent, lecteur: Agent;
beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'rssi', 'admin'));
  alice = await login(t, await makeUser(t, 'alice', 'rw'));
  bob = await login(t, await makeUser(t, 'bob', 'rw'));
  lecteur = await login(t, await makeUser(t, 'lecteur', 'ro'));
});
afterAll(() => t.close());

describe('disposition personnelle', () => {
  it('rien d’enregistré au départ', async () => {
    const r = await alice.get(URL_PERSO);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ personnelle: null, organisation: null, partages: [], choix: null });
  });

  it('crée avec If-Match « 0 », puis exige la version courante (428, 412)', async () => {
    expect((await alice.put(URL_PERSO, { disposition: D1 })).statusCode).toBe(428);
    const r = await alice.put(URL_PERSO, { disposition: D1 }, v(0));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe('"1"');
    expect(r.json()).toMatchObject({ disposition: D1, version: 1, modifieePar: 'alice' });
    // Une deuxième création (version périmée) est refusée sans rien changer.
    const conflit = await alice.put(URL_PERSO, { disposition: D2 }, v(0));
    expect(conflit.statusCode).toBe(412);
    expect(conflit.json()).toMatchObject({ current: { version: 1 } });
    const maj = await alice.put(URL_PERSO, { disposition: D2 }, v(1));
    expect(maj.statusCode, maj.body).toBe(200);
    expect(maj.json()).toMatchObject({ disposition: D2, version: 2 });
    expect((await alice.get(URL_PERSO)).json().personnelle).toMatchObject({ disposition: D2, version: 2 });
  });

  it('chaque compte n’a accès qu’à la sienne', async () => {
    expect((await bob.get(URL_PERSO)).json().personnelle).toBeNull();
    const r = await bob.put(URL_PERSO, { disposition: D1 }, v(0));
    expect(r.statusCode, r.body).toBe(200);
    expect((await alice.get(URL_PERSO)).json().personnelle).toMatchObject({ disposition: D2 });
    expect((await bob.get(URL_PERSO)).json().personnelle).toMatchObject({ disposition: D1, version: 1 });
  });

  it.each([
    ['une dalle inconnue', { dalles: [{ id: 'inconnue', largeur: 4, masquee: false }] }],
    ['une largeur hors liste', { dalles: [{ id: 'phare', largeur: 5, masquee: false }] }],
    [
      'une dalle en double',
      {
        dalles: [
          { id: 'phare', largeur: 6, masquee: false },
          { id: 'phare', largeur: 4, masquee: false },
        ],
      },
    ],
    ['des données en plus', { dalles: [{ id: 'phare', largeur: 6, masquee: false, valeur: 80 }] }],
  ])('refuse %s (422)', async (_, disposition) => {
    const avant = (await alice.get(URL_PERSO)).json().personnelle;
    const r = await alice.put(URL_PERSO, { disposition }, v(avant.version));
    expect(r.statusCode).toBe(422);
    expect((await alice.get(URL_PERSO)).json().personnelle).toEqual(avant);
  });

  it('revenir à la disposition par défaut supprime la sienne, sans toucher celle des autres', async () => {
    expect((await alice.del(URL_PERSO)).statusCode).toBe(204);
    expect((await alice.get(URL_PERSO)).json().personnelle).toBeNull();
    expect((await bob.get(URL_PERSO)).json().personnelle).not.toBeNull();
    // Après suppression, une nouvelle disposition repart de la version 0.
    expect((await alice.put(URL_PERSO, { disposition: D1 }, v(0))).statusCode).toBe(200);
  });

  it('sans le droit tableau_de_bord:modifier (rôle Lecteur) : lecture et retour au défaut seulement', async () => {
    expect((await lecteur.get(URL_PERSO)).statusCode).toBe(200);
    expect((await lecteur.put(URL_PERSO, { disposition: D2 }, v(0))).statusCode).toBe(403);
    // Une disposition enregistrée avant le lot 2b reste affichée et peut toujours être abandonnée.
    await t.svc.db.q(
      `INSERT INTO tableaux_de_bord (proprietaire, disposition, updated_by)
       SELECT id, '{"dalles":[]}', 'test' FROM users WHERE username = 'lecteur'`,
    );
    expect((await lecteur.get(URL_PERSO)).json().personnelle).toMatchObject({ disposition: { dalles: [] } });
    expect((await lecteur.del(URL_PERSO)).statusCode).toBe(204);
    expect((await lecteur.get(URL_PERSO)).json().personnelle).toBeNull();
  });

  it('module « Tableau de bord » désactivé : plus de modification (409), lecture inchangée', async () => {
    const etat = await t.svc.modules.state(true);
    await t.svc.db.q('UPDATE module_activation SET disabled = $1, version = version + 1 WHERE id = 1', [
      [...etat.disabled, 'tableau_de_bord'],
    ]);
    try {
      const avant = (await alice.get(URL_PERSO)).json().personnelle;
      expect((await alice.put(URL_PERSO, { disposition: D2 }, v(avant.version))).statusCode).toBe(409);
      expect((await alice.get(URL_PERSO)).statusCode).toBe(200);
    } finally {
      await t.svc.db.q('UPDATE module_activation SET disabled = $1, version = version + 1 WHERE id = 1', [
        etat.disabled,
      ]);
    }
  });

  it('refusée sans session', async () => {
    expect((await new Agent(t).get(URL_PERSO)).statusCode).toBe(401);
  });
});

describe('disposition par défaut', () => {
  it('réservée au droit « administrer »', async () => {
    expect((await alice.put(URL_DEFAUT, { disposition: D1 }, v(0))).statusCode).toBe(403);
    expect((await alice.del(URL_DEFAUT)).statusCode).toBe(403);
    expect((await alice.get(URL_PERSO)).json().organisation).toBeNull();
  });

  it('proposée à tous, sans remplacer les dispositions personnelles, et journalisée', async () => {
    const r = await admin.put(URL_DEFAUT, { disposition: D2 }, v(0));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ disposition: D2, version: 1, modifieePar: 'rssi' });
    expect((await alice.get(URL_PERSO)).json()).toMatchObject({
      personnelle: { disposition: D1 },
      organisation: { disposition: D2, version: 1 },
    });
    expect((await admin.put(URL_DEFAUT, { disposition: D1 }, v(0))).statusCode).toBe(412);
    expect((await admin.del(URL_DEFAUT)).statusCode).toBe(204);
    expect((await alice.get(URL_PERSO)).json().organisation).toBeNull();
    const audit = await t.svc.db.q<{ action: string; username: string }>(
      "SELECT action, username FROM audit_log WHERE action LIKE 'tableau_de_bord.%' ORDER BY id",
    );
    expect(audit.rows).toEqual([
      { action: 'tableau_de_bord.defaut_enregistre', username: 'rssi' },
      { action: 'tableau_de_bord.defaut_supprime', username: 'rssi' },
    ]);
  });

  it('une dalle retirée du catalogue, déjà en base, est ignorée à la lecture', async () => {
    await t.svc.db.q(
      `INSERT INTO tableaux_de_bord (proprietaire, disposition, updated_by)
       VALUES (NULL, '{"dalles":[{"id":"retiree","largeur":4,"masquee":false},{"id":"phare","largeur":12,"masquee":false}]}', 'test')`,
    );
    expect((await alice.get(URL_PERSO)).json().organisation.disposition).toEqual({
      dalles: [{ id: 'phare', largeur: 12, masquee: false }],
    });
  });

  it('suit la suppression du compte (clé étrangère)', async () => {
    const carole = await makeUser(t, 'carole', 'rw');
    const a = await login(t, carole);
    expect((await a.put(URL_PERSO, { disposition: D1 }, v(0))).statusCode).toBe(200);
    await t.svc.db.q('DELETE FROM users WHERE id = $1', [carole.id]);
    const n = await t.svc.db.one<{ n: number }>(
      'SELECT count(*)::int AS n FROM tableaux_de_bord WHERE proprietaire = $1',
      [carole.id],
    );
    expect(n!.n).toBe(0);
  });
});
