/* Partage et publication des tableaux de bord (ADR 0109) : partage en lecture avec des personnes, des groupes ou des
   rôles (droit tableau_de_bord:modifier, If-Match, journalisé), annuaire sans courriel, visibilité recontrôlée à chaque
   lecture, copie d'un tableau public, suppression en cascade ; publication pour tous (droit « Publier pour tous »,
   tableau_de_bord:administrer, propriétaire seulement) et chiffres ouverts de l'auteur : liste blanche (aucune chaîne
   libre), registres restreints comptés (décision B du RSSI), auteur désactivé, rétrogradé ou supprimé, module désactivé,
   suspension journalisée une seule fois, limite de débit. Données fictives. */
import { ChiffresPublics, type TableauDetail, type TableauResume, type TableauxOut } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { LIBELLES_ECARTS } from '../src/tableau-de-bord.js';
import { Agent, createTestApp, login, makeUser, seedState, type TestApp, type TestUser } from './helpers.js';

const URL = '/api/tableaux-de-bord';
const URL_ANNUAIRE = `${URL}/annuaire`;
const D_ALICE = {
  dalles: [
    { id: 'echeances', largeur: 12, masquee: false },
    // Réglages (lot 2c) : transmis avec la disposition partagée.
    { id: 'ecarts-type', largeur: 6, masquee: false, reglages: { visualisation: 'histogramme' } },
  ],
};
const v = (n: number) => ({ 'if-match': `"${n}"` });
const INCONNU = '00000000-0000-4000-8000-000000000000';

let t: TestApp;
let uAlice: TestUser, uBob: TestUser, uCarole: TestUser, uLecteur: TestUser, uPub: TestUser, uVide: TestUser;
let admin: Agent, alice: Agent, bob: Agent, carole: Agent, lecteur: Agent, pub: Agent, vide: Agent, eve: Agent;
let groupe: string;
/** Tableau d'alice partagé (alice n'a pas le droit de publier). */
let tAlice: TableauDetail;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'rssi', 'admin'));
  uAlice = await makeUser(t, 'alice', 'rw');
  uBob = await makeUser(t, 'bob', 'rw');
  uCarole = await makeUser(t, 'carole', 'rw');
  uLecteur = await makeUser(t, 'lecteur', 'ro');
  // Détenteur du droit « Publier pour tous » (rôle RSSI) et compte sans aucun droit métier.
  uPub = await makeUser(t, 'publieur', 'rssi');
  uVide = await makeUser(t, 'sans-metier', null);
  alice = await login(t, uAlice);
  bob = await login(t, uBob);
  carole = await login(t, uCarole);
  lecteur = await login(t, uLecteur);
  pub = await login(t, uPub);
  vide = await login(t, uVide);
  groupe = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Direction') RETURNING id"))!.id;
  await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [uLecteur.id, groupe]);
});
afterAll(() => t.close());

const lire = async (a: Agent) => {
  const r = await a.get(URL);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as TableauxOut;
};
const creer = async (a: Agent, nom: string, depart: unknown = { type: 'standard' }) => {
  const r = await a.post(URL, { nom, depart });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as TableauDetail;
};
const partage = async (a: Agent, id: string) => (await a.get(`${URL}/${id}/partage`)).json();
const dispo = async (a: Agent, id: string): Promise<TableauResume | undefined> =>
  (await lire(a)).disponibles.find((x) => x.id === id);
const suspensions = async (id: string) =>
  (
    await t.svc.db.q<{ username: string; details: { raison: string } }>(
      "SELECT username, details FROM audit_log WHERE action = 'tableau_de_bord.publication_suspendue' AND target = $1 ORDER BY id",
      [id],
    )
  ).rows;
const avecModuleDesactive = async (f: () => Promise<void>) => {
  const etat = await t.svc.modules.state(true);
  await t.svc.db.q('UPDATE module_activation SET disabled = $1, version = version + 1 WHERE id = 1', [
    [...etat.disabled, 'tableau_de_bord'],
  ]);
  try {
    await f();
  } finally {
    await t.svc.db.q('UPDATE module_activation SET disabled = $1, version = version + 1 WHERE id = 1', [etat.disabled]);
  }
};

describe('annuaire des destinataires', () => {
  it('réservé au droit tableau_de_bord:modifier', async () => {
    expect((await lecteur.get(URL_ANNUAIRE)).statusCode).toBe(403);
    expect((await vide.get(URL_ANNUAIRE)).statusCode).toBe(403);
    expect((await new Agent(t).get(URL_ANNUAIRE)).statusCode).toBe(401);
  });

  it('comptes actifs sans soi ni courriel, groupes avec leurs membres actifs, rôles prédéfinis et personnalisés', async () => {
    await makeUser(t, 'parti', 'rw', { expiresAt: new Date(Date.now() - 1000) });
    await t.svc.db.q(
      "INSERT INTO roles(id, name, permissions) VALUES ('r_copil', 'Comité de pilotage (fictif)', '{}')",
    );
    const r = await alice.get(URL_ANNUAIRE);
    expect(r.statusCode, r.body).toBe(200);
    const a = r.json();
    const noms = a.utilisateurs.map((u: { identifiant: string }) => u.identifiant);
    expect(noms).toEqual(expect.arrayContaining(['bob', 'carole', 'lecteur', 'publieur']));
    expect(noms).not.toContain('alice');
    expect(noms).not.toContain('parti');
    expect(Object.keys(a.utilisateurs[0]).sort()).toEqual(['id', 'identifiant', 'nom']);
    expect(a.groupes).toEqual([{ id: groupe, nom: 'Direction', membres: 1 }]);
    expect(a.roles.map((x: { id: string }) => x.id)).toEqual(
      expect.arrayContaining(['administrateur', 'rssi', 'contributeur', 'lecteur', 'auditeur_externe', 'r_copil']),
    );
    expect(Object.keys(a.roles[0]).sort()).toEqual(['id', 'nom']);
  });
});

describe('partager son tableau', () => {
  it('réservé à son propriétaire, avec le droit tableau_de_bord:modifier (403, 404)', async () => {
    tAlice = await creer(alice, 'Tableau d’alice', { type: 'vide' });
    expect(await partage(alice, tAlice.id)).toEqual({
      destinataires: [],
      public: false,
      chiffresOuverts: false,
      version: 1,
    });
    // Invisible pour les autres, et le lecteur (sans le droit) ne partage pas le sien.
    expect((await bob.get(`${URL}/${tAlice.id}/partage`)).statusCode).toBe(404);
    expect((await bob.put(`${URL}/${tAlice.id}/partage`, { destinataires: [], public: false }, v(1))).statusCode).toBe(
      404,
    );
    expect((await alice.get(`${URL}/${INCONNU}/partage`)).statusCode).toBe(404);
    const ancien = (await t.svc.db.one<{ id: string }>(
      `INSERT INTO tableaux_de_bord (proprietaire, nom, disposition, updated_by) VALUES ($1, 'Ancien', '{"dalles":[]}', 'test') RETURNING id`,
      [uLecteur.id],
    ))!.id;
    expect((await lecteur.put(`${URL}/${ancien}/partage`, { destinataires: [], public: false }, v(1))).statusCode).toBe(
      403,
    );
  });

  it('partage avec un compte, un groupe et un rôle ; If-Match sur la version du tableau ; journalisé', async () => {
    const maj = await alice.put(`${URL}/${tAlice.id}`, { disposition: D_ALICE }, v(1));
    expect(maj.statusCode, maj.body).toBe(200);
    const corps = {
      destinataires: [
        { type: 'utilisateur', id: uBob.id },
        { type: 'groupe', id: groupe },
        { type: 'role', id: 'r_copil' },
      ],
      public: false,
    };
    expect((await alice.put(`${URL}/${tAlice.id}/partage`, corps)).statusCode).toBe(428);
    const r = await alice.put(`${URL}/${tAlice.id}/partage`, corps, v(2));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe('"3"');
    expect(r.json()).toEqual({
      version: 3,
      public: false,
      chiffresOuverts: false,
      destinataires: [
        { type: 'role', id: 'r_copil', nom: 'Comité de pilotage (fictif)' },
        { type: 'groupe', id: groupe, nom: 'Direction' },
        { type: 'utilisateur', id: uBob.id, nom: 'Nom bob' },
      ],
    });
    // Version périmée : refus sans rien changer.
    expect(
      (await alice.put(`${URL}/${tAlice.id}/partage`, { destinataires: [], public: false }, v(2))).statusCode,
    ).toBe(412);
    expect((await partage(alice, tAlice.id)).destinataires).toHaveLength(3);
    const audit = await t.svc.db.one<{ username: string; details: { ajoutes: string[]; retires: string[] } }>(
      "SELECT username, details FROM audit_log WHERE action = 'tableau_de_bord.partage_modifie' ORDER BY id DESC LIMIT 1",
    );
    expect(audit).toMatchObject({ username: 'alice', details: { retires: [], destinataires: 3 } });
    expect(audit!.details.ajoutes.sort()).toEqual(
      [`groupe:${groupe}`, `role:r_copil`, `utilisateur:${uBob.id}`].sort(),
    );
  });

  it.each([
    ['soi-même', () => ({ type: 'utilisateur', id: uAlice.id })],
    ['un compte inconnu', () => ({ type: 'utilisateur', id: INCONNU })],
    ['un compte qui n’est plus actif', () => ({ type: 'utilisateur', id: 'parti' })],
    ['un identifiant de compte mal formé', () => ({ type: 'utilisateur', id: 'pas-un-uuid' })],
    ['un groupe inconnu', () => ({ type: 'groupe', id: INCONNU })],
    ['un rôle inconnu', () => ({ type: 'role', id: 'role_inexistant' })],
  ])('refuse %s (422)', async (_, dest) => {
    const { version } = await partage(alice, tAlice.id);
    let d = dest();
    if (d.id === 'parti')
      d = { ...d, id: (await t.svc.db.one<{ id: string }>("SELECT id FROM users WHERE username = 'parti'"))!.id };
    const r = await alice.put(`${URL}/${tAlice.id}/partage`, { destinataires: [d], public: false }, v(version));
    expect(r.statusCode).toBe(422);
    expect((await partage(alice, tAlice.id)).version).toBe(version);
  });

  it('refuse un destinataire en double, un type inconnu ou un champ en trop (422)', async () => {
    const { version } = await partage(alice, tAlice.id);
    const d = { type: 'utilisateur', id: uBob.id };
    const put = (destinataires: unknown[]) =>
      alice.put(`${URL}/${tAlice.id}/partage`, { destinataires, public: false }, v(version));
    expect((await put([d, d])).statusCode).toBe(422);
    expect((await put([{ ...d, droits: 'modifier' }])).statusCode).toBe(422);
    expect((await put([{ type: 'service', id: 'x' }])).statusCode).toBe(422);
    expect((await alice.put(`${URL}/${tAlice.id}/partage`, { destinataires: [] }, v(version))).statusCode).toBe(422);
  });
});

describe('recevoir un tableau partagé', () => {
  it('le destinataire direct, le membre du groupe et le titulaire du rôle le voient, avec le nom de l’auteur ; les autres non', async () => {
    eve = await login(t, await makeUser(t, 'eve', 'r_copil'));
    for (const a of [bob, lecteur, eve]) {
      const x = await dispo(a, tAlice.id);
      expect(x).toMatchObject({
        nom: 'Tableau d’alice',
        origine: 'partage',
        auteur: 'Nom alice',
        public: false,
        chiffresOuverts: false,
        enOnglet: false,
      });
    }
    expect(await dispo(carole, tAlice.id)).toBeUndefined();
    expect(await dispo(vide, tAlice.id)).toBeUndefined();
    expect((await lire(alice)).disponibles.some((x) => x.id === tAlice.id)).toBe(false);
  });

  it('l’ajouter à ses onglets : disposition de l’auteur, en lecture seule ; puis le retirer', async () => {
    const d = await lire(bob);
    const r = await bob.put(`${URL}/onglets`, { tableaux: [...d.onglets.map((o) => o.id), tAlice.id] });
    expect(r.statusCode, r.body).toBe(200);
    const o = (r.json() as TableauxOut).onglets.find((x) => x.id === tAlice.id)!;
    expect(o).toMatchObject({ origine: 'partage', modifiable: false, disposition: D_ALICE, auteur: 'Nom alice' });
    // Le lecteur (sans le droit de modifier) peut aussi l'ajouter.
    expect((await lecteur.put(`${URL}/onglets`, { tableaux: [tAlice.id] })).statusCode).toBe(200);
    // Son propre tableau (« Ancien ») reste, à la fin.
    expect((await lire(lecteur)).onglets.map((x) => x.nom)).toEqual(['Tableau d’alice', 'Ancien']);
  });

  it('impossible d’ajouter un tableau qui ne vous est pas partagé (404)', async () => {
    expect((await carole.put(`${URL}/onglets`, { tableaux: [tAlice.id] })).statusCode).toBe(404);
    expect((await carole.put(`${URL}/onglets`, { tableaux: [INCONNU] })).statusCode).toBe(404);
  });

  it('le destinataire ne peut ni le modifier, ni le supprimer, ni le repartager (403) ; celui d’alice reste intact', async () => {
    const { version } = await partage(alice, tAlice.id);
    expect((await bob.put(`${URL}/${tAlice.id}`, { disposition: { dalles: [] } }, v(version))).statusCode).toBe(403);
    expect((await bob.del(`${URL}/${tAlice.id}`, v(version))).statusCode).toBe(403);
    expect((await bob.get(`${URL}/${tAlice.id}/partage`)).statusCode).toBe(403);
    expect(
      (await bob.put(`${URL}/${tAlice.id}/partage`, { destinataires: [], public: false }, v(version))).statusCode,
    ).toBe(403);
    expect((await lire(alice)).onglets.find((x) => x.id === tAlice.id)!.disposition).toEqual(D_ALICE);
  });

  it('partagé par une personne sans le droit de publier : ses chiffres ne sont pas ouverts (404, sans journal)', async () => {
    expect((await bob.get(`${URL}/${tAlice.id}/chiffres`)).statusCode).toBe(404);
    expect(await suspensions(tAlice.id)).toEqual([]);
  });

  it('copie : un tableau seulement partagé ne se copie pas (422)', async () => {
    const r = await bob.post(URL, { nom: 'Copie refusée', depart: { type: 'copie', tableau: tAlice.id } });
    expect(r.statusCode).toBe(422);
    expect(r.json().reason).toBe('copie_impossible');
  });

  it('un partage retiré disparaît des onglets à la lecture suivante', async () => {
    expect((await lire(lecteur)).onglets[0]!.id).toBe(tAlice.id);
    // Le lecteur quitte le groupe : plus de partage, l'onglet disparaît ; il garde son propre tableau.
    await t.svc.db.q('DELETE FROM user_groups WHERE user_id = $1', [uLecteur.id]);
    const d = await lire(lecteur);
    expect(d.onglets.map((x) => x.modele)).toEqual([null]);
    expect(d.onglets[0]!.nom).toBe('Ancien');
    expect(d.disponibles.some((x) => x.id === tAlice.id)).toBe(false);
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [uLecteur.id, groupe]);
    expect((await lire(lecteur)).onglets.map((x) => x.id)).toContain(tAlice.id);
  });

  it('retirer un destinataire est journalisé', async () => {
    const { version } = await partage(alice, tAlice.id);
    const r = await alice.put(
      `${URL}/${tAlice.id}/partage`,
      {
        destinataires: [
          { type: 'groupe', id: groupe },
          { type: 'role', id: 'r_copil' },
        ],
        public: false,
      },
      v(version),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(await dispo(bob, tAlice.id)).toBeUndefined();
    expect((await lire(bob)).onglets.some((x) => x.id === tAlice.id)).toBe(false);
    const audit = await t.svc.db.one<{ details: { ajoutes: string[]; retires: string[] } }>(
      "SELECT details FROM audit_log WHERE action = 'tableau_de_bord.partage_modifie' ORDER BY id DESC LIMIT 1",
    );
    expect(audit!.details).toMatchObject({ ajoutes: [], retires: [`utilisateur:${uBob.id}`] });
  });

  it('la suppression d’un rôle, d’un groupe ou d’un compte supprime ses partages (clés étrangères)', async () => {
    expect(await dispo(eve, tAlice.id)).toBeDefined();
    await t.svc.db.q("DELETE FROM user_roles WHERE role_id = 'r_copil'");
    await t.svc.db.q("DELETE FROM roles WHERE id = 'r_copil'");
    expect(await dispo(eve, tAlice.id)).toBeUndefined();
    expect((await partage(alice, tAlice.id)).destinataires).toEqual([{ type: 'groupe', id: groupe, nom: 'Direction' }]);
    const { version } = await partage(alice, tAlice.id);
    const g2 = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Éphémère') RETURNING id"))!.id;
    const passager = await makeUser(t, 'passager', 'rw');
    const dest = [
      { type: 'groupe', id: g2 },
      { type: 'utilisateur', id: passager.id },
    ];
    expect(
      (await alice.put(`${URL}/${tAlice.id}/partage`, { destinataires: dest, public: false }, v(version))).statusCode,
    ).toBe(200);
    await t.svc.db.q('DELETE FROM groups WHERE id = $1', [g2]);
    await t.svc.db.q('DELETE FROM users WHERE id = $1', [passager.id]);
    expect((await partage(alice, tAlice.id)).destinataires).toEqual([]);
  });

  it('supprimer le tableau supprime ses partages et ses onglets (journalisé)', async () => {
    const { version } = await partage(alice, tAlice.id);
    expect(
      (
        await alice.put(
          `${URL}/${tAlice.id}/partage`,
          { destinataires: [{ type: 'groupe', id: groupe }], public: false },
          v(version),
        )
      ).statusCode,
    ).toBe(200);
    expect((await lire(lecteur)).onglets.map((x) => x.id)).toContain(tAlice.id);
    expect((await alice.del(`${URL}/${tAlice.id}`, v(version + 1))).statusCode).toBe(204);
    expect((await lire(lecteur)).onglets.map((x) => x.id)).not.toContain(tAlice.id);
    const n = await t.svc.db.one<{ p: number; o: number }>(
      `SELECT (SELECT count(*) FROM tableaux_de_bord_partages WHERE tableau = $1)::int AS p,
              (SELECT count(*) FROM tableaux_de_bord_onglets WHERE tableau = $1)::int AS o`,
      [tAlice.id],
    );
    expect(n).toEqual({ p: 0, o: 0 });
    const audit = await t.svc.db.one<{ target: string; details: { destinataires: number } }>(
      "SELECT target, details FROM audit_log WHERE action = 'tableau_de_bord.partage_supprime' ORDER BY id DESC LIMIT 1",
    );
    expect(audit).toEqual({ target: tAlice.id, details: { destinataires: 1 } });
  });
});

describe('publication et chiffres ouverts', () => {
  let publie: TableauDetail;

  beforeAll(async () => {
    // Données à texte libre, qui ne doivent jamais sortir par les chiffres ouverts : statut d'écart inconnu, référentiel
    // inconnu, date d'audit saisie en texte, libellé d'année, plan d'audit, incident.
    const etat = (await admin.get('/api/suivi/etat')).json();
    etat.items = [
      ...(etat.items ?? []),
      { id: 'SECRET-1', ref: 'Referentiel secret', num: '1', title: 'Exigence secrete', group: '' },
    ];
    etat.nextYear = 2027;
    etat.yearLabels = { ...(etat.yearLabels ?? {}), 2027: 'Libelle annee secret' };
    etat.nextDate = 'Texte libre secret';
    etat.internalDate = 'Date interne secrete';
    etat.incidents = [
      {
        id: 'INC-2026-001',
        smsi: DEFAULT_SMSI,
        title: 'Titre incident secret',
        desc: 'Description secrete',
        kind: 'Incident de sécurité',
        status: 'En cours',
        detectedAt: '2026-10-05T10:00',
      },
      {
        id: 'INC-2026-002',
        smsi: DEFAULT_SMSI,
        title: 'Autre titre secret',
        kind: 'Incident',
        status: 'Clos',
        detectedAt: '2026-11-02T08:30',
      },
    ];
    await seedState(t, etat);
    await t.svc.db.q(
      `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by) VALUES
       ($1,'nonconformity','ecarts','Intitule ecart secret','{"status":"statut-libre-secret","dueAt":"2026-01-01","source":"Source secrete"}','test','test')`,
      [DEFAULT_SMSI],
    );
  });

  it('publier exige le droit « Publier pour tous » (403) et le propriétaire ; publication journalisée', async () => {
    const aAlice = await creer(alice, 'Essai de publication');
    const refus = await alice.put(`${URL}/${aAlice.id}/partage`, { destinataires: [], public: true }, v(1));
    expect(refus.statusCode).toBe(403);
    expect(refus.json()).toMatchObject({ reason: 'permission', permission: 'tableau_de_bord:administrer' });
    expect((await partage(alice, aAlice.id)).public).toBe(false);

    publie = await creer(admin, 'Tableau publié');
    const r = await admin.put(`${URL}/${publie.id}/partage`, { destinataires: [], public: true }, v(1));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ destinataires: [], public: true, chiffresOuverts: true, version: 2 });
    const audit = await t.svc.db.one<{ username: string; target: string; details: Record<string, unknown> }>(
      "SELECT username, target, details FROM audit_log WHERE action = 'tableau_de_bord.publie' ORDER BY id DESC LIMIT 1",
    );
    expect(audit).toMatchObject({ username: 'rssi', target: publie.id, details: { nom: 'Tableau publié' } });
    expect((audit!.details as { dalles: number }).dalles).toBeGreaterThan(0);
    // Son auteur le voit comme le sien, avec ses droits : pas de chiffres ouverts pour lui.
    expect((await lire(admin)).onglets.find((o) => o.id === publie.id)).toMatchObject({
      origine: 'mien',
      public: true,
      chiffresOuverts: false,
    });
    expect((await admin.get(`${URL}/${publie.id}/chiffres`)).statusCode).toBe(404);
  });

  it('visible de tous, compte sans droit métier compris ; chiffres en liste blanche, sans aucune chaîne libre', async () => {
    for (const a of [carole, vide, lecteur]) {
      expect(await dispo(a, publie.id)).toMatchObject({
        origine: 'public',
        auteur: 'Nom rssi',
        public: true,
        chiffresOuverts: true,
      });
    }
    const r = await vide.get(`${URL}/${publie.id}/chiffres`);
    expect(r.statusCode, r.body).toBe(200);
    const c = ChiffresPublics.parse(r.json());
    expect(r.body.toLowerCase()).not.toContain('secret');
    expect(Object.keys(r.json()).sort()).toEqual(
      [
        'genereLe',
        'prochainAudit',
        'auditInterne',
        'ecarts',
        'mesures',
        'conformite',
        'ecartsOuverts',
        'indicateurs',
        'plans',
        'actions',
        'recurrences',
        'risques',
        'continuite',
        'incidents',
      ].sort(),
    );
    expect(c.prochainAudit).toEqual({ date: '' });
    expect(c.auditInterne).toBeNull();
    const connues = (l: readonly string[]) => [...l, 'Autre'];
    expect(Object.keys(c.ecarts!.parStatut).every((k) => connues(LIBELLES_ECARTS.statut).includes(k))).toBe(true);
    expect(c.ecarts!.parStatut.Autre).toBeGreaterThanOrEqual(1);
    expect(Object.keys(c.ecarts!.parSource).every((k) => connues(LIBELLES_ECARTS.source).includes(k))).toBe(true);
    expect(Object.keys(c.ecarts!.parType).every((k) => connues(LIBELLES_ECARTS.type).includes(k))).toBe(true);
    expect(Object.keys(c.mesures!.parReferentiel).every((k) => ['ISO', 'A', 'HDS', 'Autre'].includes(k))).toBe(true);
    expect(c.mesures!.parReferentiel.Autre).toBe(1);
    expect(c.conformite!.map((x) => [x.ref, x.libelle])).toEqual([
      ['ISO', 'Clauses ISO 27001'],
      ['A', 'Annexe A'],
      ['HDS', 'HDS'],
    ]);
    expect(c.incidents).toEqual({
      total: 2,
      ouverts: 1,
      securiteOuverts: 1,
      enCours: 1,
      clos: 1,
      parMois: [
        { mois: '2026-10', n: 1 },
        { mois: '2026-11', n: 1 },
      ],
    });
    // Le compte sans droit métier n'a aucune synthèse à lui : seuls ces chiffres lui sont ouverts.
    expect((await vide.get('/api/mur/synthese')).statusCode).toBe(403);
  });

  it('registre restreint : compté dans les chiffres de l’auteur (décision B), pas dans la synthèse du lecteur', async () => {
    const rr = await admin.post('/api/registres', {
      kind: 'ecarts',
      name: 'Écarts confidentiels (fictif)',
      referenceId: DEFAULT_SMSI,
      perimetres: [],
      restreint: true,
    });
    expect(rr.statusCode, rr.body).toBe(201);
    const avantLecteur = (await carole.get('/api/mur/synthese')).json().ecarts.total;
    const avantChiffres = (await carole.get(`${URL}/${publie.id}/chiffres`)).json().ecarts.total;
    await t.svc.db.q(
      `INSERT INTO grc_objects(smsi_id,kind,module,name,data,registre_id,created_by,updated_by) VALUES
       ($1,'nonconformity','ecarts','Ecart confidentiel (fictif)','{"status":"open"}',$2,'test','test')`,
      [DEFAULT_SMSI, rr.json().id],
    );
    expect((await carole.get('/api/mur/synthese')).json().ecarts.total).toBe(avantLecteur);
    expect((await carole.get(`${URL}/${publie.id}/chiffres`)).json().ecarts.total).toBe(avantChiffres + 1);
    expect((await admin.get('/api/mur/synthese')).json().ecarts.total).toBe(avantChiffres + 1);
  });

  it('copie d’un tableau public : la disposition seule, ni partage ni publication', async () => {
    const c = await creer(carole, 'Ma copie du publié', { type: 'copie', tableau: publie.id });
    expect(c).toMatchObject({ origine: 'mien', public: false, disposition: publie.disposition });
    expect(await partage(carole, c.id)).toMatchObject({ destinataires: [], public: false });
  });

  it('partagé par un détenteur du droit de publier : chiffres ouverts à ses destinataires seulement', async () => {
    const p = await creer(pub, 'Partagé avec chiffres');
    const r = await pub.put(
      `${URL}/${p.id}/partage`,
      { destinataires: [{ type: 'utilisateur', id: uCarole.id }], public: false },
      v(1),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ public: false, chiffresOuverts: true });
    expect(await dispo(carole, p.id)).toMatchObject({ origine: 'partage', public: false, chiffresOuverts: true });
    expect((await carole.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(200);
    expect(await dispo(bob, p.id)).toBeUndefined();
    expect((await bob.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(404);
  });

  it('auteur désactivé : chiffres refusés (404), suspension journalisée une seule fois ; réactivé : de nouveau servis', async () => {
    const p = (await lire(carole)).disponibles.find((x) => x.nom === 'Partagé avec chiffres')!;
    await t.svc.db.q('UPDATE users SET disabled = true WHERE id = $1', [uPub.id]);
    try {
      expect((await carole.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(404);
      expect((await carole.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(404);
      expect(await suspensions(p.id)).toEqual([
        { username: 'système', details: expect.objectContaining({ raison: 'auteur_inactif' }) },
      ]);
      // Toujours partagé avec carole, mais vu avec ses droits.
      expect(await dispo(carole, p.id)).toMatchObject({ origine: 'partage', chiffresOuverts: false });
    } finally {
      await t.svc.db.q('UPDATE users SET disabled = false WHERE id = $1', [uPub.id]);
    }
    expect((await carole.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(200);
    // Une nouvelle suspension, après une lecture servie, est de nouveau journalisée.
    await t.svc.db.q('UPDATE users SET disabled = true WHERE id = $1', [uPub.id]);
    try {
      expect((await carole.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(404);
      expect(await suspensions(p.id)).toHaveLength(2);
    } finally {
      await t.svc.db.q('UPDATE users SET disabled = false WHERE id = $1', [uPub.id]);
    }
  });

  it('auteur rétrogradé (droit de publier retiré) : son tableau public disparaît, ses chiffres partagés sont refusés', async () => {
    const pPublic = await creer(pub, 'Public du publieur');
    expect((await pub.put(`${URL}/${pPublic.id}/partage`, { destinataires: [], public: true }, v(1))).statusCode).toBe(
      200,
    );
    expect(await dispo(bob, pPublic.id)).toMatchObject({ origine: 'public', chiffresOuverts: true });
    expect((await bob.get(`${URL}/${pPublic.id}/chiffres`)).statusCode).toBe(200);
    const pPartage = (await lire(carole)).disponibles.find((x) => x.nom === 'Partagé avec chiffres')!;
    await t.svc.db.q("UPDATE user_roles SET role_id = 'contributeur' WHERE user_id = $1", [uPub.id]);
    try {
      expect(await dispo(bob, pPublic.id)).toBeUndefined();
      expect((await bob.get(`${URL}/${pPublic.id}/chiffres`)).statusCode).toBe(404);
      expect(await suspensions(pPublic.id)).toEqual([
        { username: 'système', details: expect.objectContaining({ raison: 'droit_retire', public: true }) },
      ]);
      expect(await dispo(carole, pPartage.id)).toMatchObject({ chiffresOuverts: false });
      expect((await carole.get(`${URL}/${pPartage.id}/chiffres`)).statusCode).toBe(404);
      // Il retire lui-même la publication, sans le droit de publier.
      const { version } = await partage(pub, pPublic.id);
      expect(
        (await pub.put(`${URL}/${pPublic.id}/partage`, { destinataires: [], public: false }, v(version))).statusCode,
      ).toBe(200);
    } finally {
      await t.svc.db.q("UPDATE user_roles SET role_id = 'rssi' WHERE user_id = $1", [uPub.id]);
    }
    expect(await dispo(bob, pPublic.id)).toBeUndefined();
    const retrait = await t.svc.db.one<{ username: string }>(
      "SELECT username FROM audit_log WHERE action = 'tableau_de_bord.publication_retiree' AND target = $1",
      [pPublic.id],
    );
    expect(retrait).toEqual({ username: 'publieur' });
  });

  it('module « Tableau de bord » désactivé : chiffres refusés (404, suspension journalisée), tableaux publics masqués', async () => {
    const p = (await lire(carole)).disponibles.find((x) => x.nom === 'Partagé avec chiffres')!;
    const avant = (await suspensions(p.id)).length;
    // Lecture de nouveau servie : la suspension précédente est levée.
    expect((await carole.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(200);
    await avecModuleDesactive(async () => {
      expect((await carole.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(404);
      expect((await carole.get(`${URL}/${publie.id}/chiffres`)).statusCode).toBe(404);
      expect(await dispo(carole, publie.id)).toBeUndefined();
      expect(await dispo(carole, p.id)).toMatchObject({ chiffresOuverts: false });
    });
    const apres = await suspensions(p.id);
    expect(apres).toHaveLength(avant + 1);
    expect(apres.at(-1)!.details.raison).toBe('module_desactive');
    expect((await carole.get(`${URL}/${publie.id}/chiffres`)).statusCode).toBe(200);
  });

  it('chiffres refusés (404) : son propre tableau, un tableau proposé, un tableau inconnu ou non partagé', async () => {
    const mien = await creer(carole, 'Le mien');
    expect((await carole.get(`${URL}/${mien.id}/chiffres`)).statusCode).toBe(404);
    const global = (await lire(carole)).disponibles.find((x) => x.modele === 'global')!;
    expect((await carole.get(`${URL}/${global.id}/chiffres`)).statusCode).toBe(404);
    expect((await carole.get(`${URL}/${INCONNU}/chiffres`)).statusCode).toBe(404);
    expect((await bob.get(`${URL}/${mien.id}/chiffres`)).statusCode).toBe(404);
    expect((await new Agent(t).get(`${URL}/${publie.id}/chiffres`)).statusCode).toBe(401);
    expect(await suspensions(mien.id)).toEqual([]);
  });

  it('limite de débit sur les chiffres (429)', async () => {
    for (let i = 0; i < 60; i++) t.svc.limits.tableauChiffres(uBob.id);
    try {
      expect((await bob.get(`${URL}/${publie.id}/chiffres`)).statusCode).toBe(429);
      expect((await carole.get(`${URL}/${publie.id}/chiffres`)).statusCode).toBe(200);
    } finally {
      t.svc.limits.tableauChiffres.reset();
    }
  });

  it('auteur supprimé : ses tableaux disparaissent avec lui (clé étrangère)', async () => {
    const p = (await lire(carole)).disponibles.find((x) => x.nom === 'Partagé avec chiffres')!;
    await t.svc.db.q('DELETE FROM users WHERE id = $1', [uPub.id]);
    expect((await carole.get(`${URL}/${p.id}/chiffres`)).statusCode).toBe(404);
    expect(await dispo(carole, p.id)).toBeUndefined();
    const n = await t.svc.db.one<{ n: number }>(
      'SELECT count(*)::int AS n FROM tableaux_de_bord WHERE proprietaire = $1',
      [uPub.id],
    );
    expect(n!.n).toBe(0);
  });

  it('retirer la publication la masque aux autres (journalisé)', async () => {
    const { version } = await partage(admin, publie.id);
    const r = await admin.put(`${URL}/${publie.id}/partage`, { destinataires: [], public: false }, v(version));
    expect(r.statusCode, r.body).toBe(200);
    expect(await dispo(carole, publie.id)).toBeUndefined();
    expect((await carole.get(`${URL}/${publie.id}/chiffres`)).statusCode).toBe(404);
    expect(await suspensions(publie.id)).toHaveLength(1); // celle du module désactivé, pas celle-ci
    const audit = await t.svc.db.one<{ username: string; details: { nom: string } }>(
      "SELECT username, details FROM audit_log WHERE action = 'tableau_de_bord.publication_retiree' AND target = $1",
      [publie.id],
    );
    expect(audit).toMatchObject({ username: 'rssi', details: { nom: 'Tableau publié' } });
  });
});
