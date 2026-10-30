/* Partage du tableau de bord (ADR 0078, lot 2b) : partage en lecture avec des comptes ou des groupes (droit
   tableau_de_bord:modifier, journalisé), annuaire sans courriel, choix du tableau affiché, visibilité recontrôlée à chaque
   lecture, copie comme le sien, suppression en cascade. Le partage ne transmet que la disposition. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

const URL_PERSO = '/api/tableau-de-bord/disposition';
const URL_PARTAGE = '/api/tableau-de-bord/partage';
const URL_CHOIX = '/api/tableau-de-bord/choix';
const URL_ANNUAIRE = '/api/tableau-de-bord/annuaire';
const D_ALICE = {
  dalles: [
    { id: 'echeances', largeur: 12, masquee: false },
    // Réglages (lot 2c) : transmis avec la disposition partagée.
    { id: 'ecarts-type', largeur: 6, masquee: false, reglages: { visualisation: 'histogramme' } },
  ],
};
const D_BOB = { dalles: [{ id: 'ecarts', largeur: 4, masquee: false }] };
const v = (n: number) => ({ 'if-match': `"${n}"` });

let t: TestApp;
let uAlice: TestUser, uBob: TestUser, uCarole: TestUser, uLecteur: TestUser;
let alice: Agent, bob: Agent, carole: Agent, lecteur: Agent;
let groupe: string;

beforeAll(async () => {
  t = await createTestApp();
  uAlice = await makeUser(t, 'alice', 'rw');
  uBob = await makeUser(t, 'bob', 'rw');
  uCarole = await makeUser(t, 'carole', 'rw');
  uLecteur = await makeUser(t, 'lecteur', 'ro');
  alice = await login(t, uAlice);
  bob = await login(t, uBob);
  carole = await login(t, uCarole);
  lecteur = await login(t, uLecteur);
  groupe = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Direction') RETURNING id"))!.id;
  await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [uLecteur.id, groupe]);
});
afterAll(() => t.close());

const dispositions = async (a: Agent) => (await a.get(URL_PERSO)).json();

describe('annuaire des destinataires', () => {
  it('réservé au droit tableau_de_bord:modifier', async () => {
    expect((await lecteur.get(URL_ANNUAIRE)).statusCode).toBe(403);
    expect((await new Agent(t).get(URL_ANNUAIRE)).statusCode).toBe(401);
  });

  it('comptes actifs sans soi ni courriel, et groupes avec leur nombre de membres actifs', async () => {
    await makeUser(t, 'parti', 'rw', { expiresAt: new Date(Date.now() - 1000) });
    const r = await alice.get(URL_ANNUAIRE);
    expect(r.statusCode, r.body).toBe(200);
    const a = r.json();
    const noms = a.utilisateurs.map((u: { identifiant: string }) => u.identifiant);
    expect(noms).toEqual(expect.arrayContaining(['bob', 'carole', 'lecteur']));
    expect(noms).not.toContain('alice');
    expect(noms).not.toContain('parti');
    expect(Object.keys(a.utilisateurs[0]).sort()).toEqual(['id', 'identifiant', 'nom']);
    expect(a.groupes).toEqual([{ id: groupe, nom: 'Direction', membres: 1 }]);
  });
});

describe('partager son tableau', () => {
  it('exige un tableau enregistré (409) et le droit (403)', async () => {
    expect((await alice.get(URL_PARTAGE)).json()).toEqual({ destinataires: [], version: 0 });
    const r = await alice.put(URL_PARTAGE, { destinataires: [{ type: 'utilisateur', id: uBob.id }] }, v(0));
    expect(r.statusCode).toBe(409);
    expect((await lecteur.put(URL_PARTAGE, { destinataires: [] }, v(0))).statusCode).toBe(403);
  });

  it('partage avec un compte et un groupe, If-Match sur la version du tableau, journalisé', async () => {
    expect((await alice.put(URL_PERSO, { disposition: D_ALICE }, v(0))).statusCode).toBe(200);
    const corps = {
      destinataires: [
        { type: 'utilisateur', id: uBob.id },
        { type: 'groupe', id: groupe },
      ],
    };
    expect((await alice.put(URL_PARTAGE, corps)).statusCode).toBe(428);
    const r = await alice.put(URL_PARTAGE, corps, v(1));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe('"2"');
    expect(r.json()).toEqual({
      version: 2,
      destinataires: [
        { type: 'groupe', id: groupe, nom: 'Direction' },
        { type: 'utilisateur', id: uBob.id, nom: 'Nom bob' },
      ],
    });
    // Version périmée : refus sans rien changer.
    expect((await alice.put(URL_PARTAGE, { destinataires: [] }, v(1))).statusCode).toBe(412);
    expect((await alice.get(URL_PARTAGE)).json().destinataires).toHaveLength(2);
    const audit = await t.svc.db.one<{ username: string; details: { ajoutes: string[]; retires: string[] } }>(
      "SELECT username, details FROM audit_log WHERE action = 'tableau_de_bord.partage_modifie' ORDER BY id DESC LIMIT 1",
    );
    expect(audit).toMatchObject({ username: 'alice', details: { retires: [] } });
    expect(audit!.details.ajoutes.sort()).toEqual([`groupe:${groupe}`, `utilisateur:${uBob.id}`].sort());
  });

  it.each([
    ['soi-même', () => ({ type: 'utilisateur', id: uAlice.id })],
    ['un compte inconnu', () => ({ type: 'utilisateur', id: '00000000-0000-4000-8000-000000000000' })],
    ['un groupe inconnu', () => ({ type: 'groupe', id: '00000000-0000-4000-8000-000000000000' })],
  ])('refuse %s (422)', async (_, dest) => {
    const { version } = (await alice.get(URL_PARTAGE)).json();
    const r = await alice.put(URL_PARTAGE, { destinataires: [dest()] }, v(version));
    expect(r.statusCode).toBe(422);
    expect((await alice.get(URL_PARTAGE)).json().version).toBe(version);
  });

  it('refuse un destinataire en double ou un champ en trop (422)', async () => {
    const { version } = (await alice.get(URL_PARTAGE)).json();
    const d = { type: 'utilisateur', id: uBob.id };
    expect((await alice.put(URL_PARTAGE, { destinataires: [d, d] }, v(version))).statusCode).toBe(422);
    expect(
      (await alice.put(URL_PARTAGE, { destinataires: [{ ...d, droits: 'modifier' }] }, v(version))).statusCode,
    ).toBe(422);
  });
});

describe('recevoir un tableau partagé', () => {
  it('le destinataire direct et le membre du groupe le voient, avec le nom de l’auteur ; les autres non', async () => {
    for (const a of [bob, lecteur]) {
      const d = await dispositions(a);
      expect(d.partages).toHaveLength(1);
      expect(d.partages[0]).toMatchObject({ auteur: 'Nom alice', disposition: D_ALICE });
      expect(d.choix).toBeNull();
    }
    expect((await dispositions(carole)).partages).toEqual([]);
    expect((await dispositions(alice)).partages).toEqual([]);
  });

  it('choisir le tableau partagé, puis revenir au choix automatique', async () => {
    const id = (await dispositions(bob)).partages[0].id;
    const r = await bob.put(URL_CHOIX, { tableau: id });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().choix).toBe(id);
    expect((await dispositions(bob)).choix).toBe(id);
    expect((await bob.put(URL_CHOIX, { tableau: null })).json().choix).toBeNull();
    // Le lecteur (sans le droit de modifier) peut aussi choisir ce qu'il affiche.
    expect((await lecteur.put(URL_CHOIX, { tableau: id })).statusCode).toBe(200);
  });

  it('impossible de choisir un tableau qui ne vous est pas partagé (404)', async () => {
    const id = (await dispositions(bob)).partages[0].id;
    expect((await carole.put(URL_CHOIX, { tableau: id })).statusCode).toBe(404);
    expect((await carole.put(URL_CHOIX, { tableau: '00000000-0000-4000-8000-000000000000' })).statusCode).toBe(404);
  });

  it('le destinataire ne peut ni modifier ni repartager le tableau reçu', async () => {
    const { version } = (await bob.get(URL_PARTAGE)).json();
    expect(version).toBe(0);
    // Ses routes ne touchent que son propre tableau : celui d'alice reste intact.
    expect((await bob.put(URL_PERSO, { disposition: D_BOB }, v(0))).statusCode).toBe(200);
    expect((await dispositions(alice)).personnelle.disposition).toEqual(D_ALICE);
  });

  it('copier comme le sien : sa disposition devient celle reçue et s’affiche (choix réinitialisé)', async () => {
    const recu = (await dispositions(bob)).partages[0];
    await bob.put(URL_CHOIX, { tableau: recu.id });
    const moi = (await dispositions(bob)).personnelle;
    const r = await bob.put(URL_PERSO, { disposition: recu.disposition }, v(moi.version));
    expect(r.statusCode, r.body).toBe(200);
    const d = await dispositions(bob);
    expect(d.personnelle.disposition).toEqual(D_ALICE);
    expect(d.choix).toBeNull();
  });

  it('un partage retiré disparaît et ramène au choix automatique', async () => {
    const id = (await dispositions(lecteur)).partages[0].id;
    expect((await dispositions(lecteur)).choix).toBe(id);
    // Le lecteur quitte le groupe : plus de partage, son choix est ignoré.
    await t.svc.db.q('DELETE FROM user_groups WHERE user_id = $1', [uLecteur.id]);
    const d = await dispositions(lecteur);
    expect(d.partages).toEqual([]);
    expect(d.choix).toBeNull();
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [uLecteur.id, groupe]);
  });

  it('retirer un destinataire est journalisé', async () => {
    const { version } = (await alice.get(URL_PARTAGE)).json();
    const r = await alice.put(URL_PARTAGE, { destinataires: [{ type: 'groupe', id: groupe }] }, v(version));
    expect(r.statusCode, r.body).toBe(200);
    expect((await dispositions(bob)).partages).toEqual([]);
    const audit = await t.svc.db.one<{ details: { ajoutes: string[]; retires: string[] } }>(
      "SELECT details FROM audit_log WHERE action = 'tableau_de_bord.partage_modifie' ORDER BY id DESC LIMIT 1",
    );
    expect(audit!.details).toMatchObject({ ajoutes: [], retires: [`utilisateur:${uBob.id}`] });
  });

  it('revenir au défaut supprime le tableau et ses partages (journalisé)', async () => {
    expect((await dispositions(lecteur)).partages).toHaveLength(1);
    expect((await alice.del(URL_PERSO)).statusCode).toBe(204);
    expect((await dispositions(lecteur)).partages).toEqual([]);
    const n = await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM tableaux_de_bord_partages');
    expect(n!.n).toBe(0);
    const audit = await t.svc.db.one<{ details: { destinataires: number } }>(
      "SELECT details FROM audit_log WHERE action = 'tableau_de_bord.partage_supprime' ORDER BY id DESC LIMIT 1",
    );
    expect(audit!.details.destinataires).toBe(1);
  });

  it('la suppression d’un groupe ou d’un compte supprime ses partages (clés étrangères)', async () => {
    expect((await alice.put(URL_PERSO, { disposition: D_ALICE }, v(0))).statusCode).toBe(200);
    const { version } = (await alice.get(URL_PARTAGE)).json();
    const g2 = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Éphémère') RETURNING id"))!.id;
    const dest = [
      { type: 'groupe', id: g2 },
      { type: 'utilisateur', id: uCarole.id },
    ];
    expect((await alice.put(URL_PARTAGE, { destinataires: dest }, v(version))).statusCode).toBe(200);
    await t.svc.db.q('DELETE FROM groups WHERE id = $1', [g2]);
    await t.svc.db.q('DELETE FROM users WHERE id = $1', [uCarole.id]);
    expect((await alice.get(URL_PARTAGE)).json().destinataires).toEqual([]);
  });
});
