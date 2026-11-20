/* Tableaux de bord multiples (ADR 0109) : tableaux de chaque personne (droit tableau_de_bord:modifier, au plus 20, nom
   unique), favoris ordonnés (barre des favoris, table des onglets : au plus 5 ; ses tableaux peuvent en sortir et restent
   dans la liste `disponibles` ; une création, favoris pleins, reste hors favoris), lecture d'un tableau favori ou non
   (GET /:id), tableaux proposés d'office (modifiables par l'administrateur seulement, journalisés, retour au modèle),
   concurrence optimiste (If-Match, 428, 412), validation (422), isolement entre comptes, lecture tolérante. Partage,
   publication et chiffres ouverts : tableau-de-bord-partage.test.ts. Données fictives. */
import { DEFS_MODELES, dispositionDe, dispositionStandard, type TableauDetail, type TableauxOut } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

const URL = '/api/tableaux-de-bord';
const D1 = {
  dalles: [
    { id: 'echeances', largeur: 12, masquee: false },
    { id: 'phare', largeur: 6, masquee: true },
  ],
};
const D2 = { dalles: [{ id: 'ecarts', largeur: 4, masquee: false }] };
const v = (n: number) => ({ 'if-match': `"${n}"` });
const INCONNU = '00000000-0000-4000-8000-000000000000';

let t: TestApp;
let uLecteur: TestUser;
let admin: Agent, alice: Agent, bob: Agent, lecteur: Agent, rssi: Agent;
beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'rssi', 'admin'));
  alice = await login(t, await makeUser(t, 'alice', 'rw'));
  bob = await login(t, await makeUser(t, 'bob', 'rw'));
  uLecteur = await makeUser(t, 'lecteur', 'ro');
  lecteur = await login(t, uLecteur);
  rssi = await login(t, await makeUser(t, 'responsable', 'rssi'));
});
afterAll(() => t.close());

const lire = async (a: Agent) => {
  const r = await a.get(URL);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as TableauxOut;
};
const creer = async (a: Agent, nom: string, depart: unknown = { type: 'vide' }) => {
  const r = await a.post(URL, { nom, depart });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as TableauDetail;
};
/** Un de ses favoris (barre des favoris). */
const onglet = async (a: Agent, nom: string) => (await lire(a)).onglets.find((o) => o.nom === nom)!;
/** Un tableau qu'elle voit, favori ou non : trouvé dans la liste, lu par GET /:id. */
const tableau = async (a: Agent, nom: string) => {
  const x = (await lire(a)).disponibles.find((o) => o.nom === nom);
  expect(x, nom).toBeDefined();
  const r = await a.get(`${URL}/${x!.id}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as TableauDetail;
};
const modele = async (a: Agent, m: string) => (await lire(a)).disponibles.find((x) => x.modele === m);

describe('lecture des tableaux de bord', () => {
  it('un compte neuf démarre avec l’onglet Global seul, tableau proposé en lecture seule', async () => {
    const d = await lire(alice);
    expect(d.onglets).toHaveLength(1);
    expect(d.onglets[0]).toMatchObject({
      nom: 'Global',
      origine: 'propose',
      modele: 'global',
      auteur: null,
      public: false,
      restreint: false,
      chiffresOuverts: false,
      disponible: true,
      enOnglet: true,
      modifiable: false,
      version: 1,
    });
    expect(d.onglets[0]!.disposition).toEqual(DEFS_MODELES.global.disposition());
    // Tableaux proposés à tout le monde ; Vulnérabilités et Suivi réglementaire visent le rôle RSSI.
    expect(d.disponibles.map((x) => [x.modele, x.enOnglet])).toEqual([
      ['global', true],
      ['suivi-smsi', false],
    ]);
    expect(d.droits).toEqual({ creer: true, publier: false, modeles: false });
  });

  it('un compte sans aucun droit métier lit ses onglets (garde « connecté »)', async () => {
    const vide = await login(t, await makeUser(t, 'sans-metier', null));
    const d = await lire(vide);
    expect(d.onglets.map((o) => o.modele)).toEqual(['global']);
    expect(d.droits).toEqual({ creer: false, publier: false, modeles: false });
    expect((await vide.post(URL, { nom: 'Essai', depart: { type: 'vide' } })).statusCode).toBe(403);
  });

  it('droits de l’administrateur et du RSSI', async () => {
    expect((await lire(admin)).droits).toEqual({ creer: true, publier: true, modeles: true });
    expect((await lire(rssi)).droits).toEqual({ creer: true, publier: true, modeles: false });
  });

  it('refusée sans session (401)', async () => {
    const anonyme = new Agent(t);
    expect((await anonyme.get('/api/tableaux-de-bord')).statusCode).toBe(401);
    expect((await anonyme.get(`/api/tableaux-de-bord/${INCONNU}/partage`)).statusCode).toBe(401);
    expect((await anonyme.get(`/api/tableaux-de-bord/${INCONNU}/chiffres`)).statusCode).toBe(401);
  });
});

describe('créer ses tableaux', () => {
  it('vide ou standard ; réponse 201 avec sa version ; il devient le dernier onglet', async () => {
    const r = await alice.post(URL, { nom: 'Suivi des écarts', depart: { type: 'vide' } });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.headers.etag).toBe('"1"');
    expect(r.json()).toMatchObject({
      nom: 'Suivi des écarts',
      origine: 'mien',
      auteur: 'Nom alice',
      modele: null,
      public: false,
      chiffresOuverts: false,
      modifiable: true,
      enOnglet: true,
      version: 1,
    });
    expect(r.json().disposition).toEqual(dispositionDe([]));
    const s = await creer(alice, 'Vue standard', { type: 'standard' });
    expect(s.disposition).toEqual(dispositionStandard());
    expect((await lire(alice)).onglets.map((o) => o.nom)).toEqual(['Global', 'Suivi des écarts', 'Vue standard']);
  });

  it('copie de la disposition d’un de ses tableaux (rien d’autre) ; un tableau proposé ou invisible ne se copie pas', async () => {
    const src = await onglet(alice, 'Suivi des écarts');
    const maj = await alice.put(`${URL}/${src.id}`, { disposition: D1 }, v(src.version));
    expect(maj.statusCode, maj.body).toBe(200);
    const c = await creer(alice, 'Copie', { type: 'copie', tableau: src.id });
    expect(c).toMatchObject({ disposition: D1, version: 1, public: false });
    expect(c.id).not.toBe(src.id);
    const global = await modele(alice, 'global');
    expect((await alice.post(URL, { nom: 'X', depart: { type: 'copie', tableau: global!.id } })).statusCode).toBe(422);
    const deBob = await creer(bob, 'Tableau de bob');
    expect((await alice.post(URL, { nom: 'X', depart: { type: 'copie', tableau: deBob.id } })).statusCode).toBe(404);
    expect((await alice.post(URL, { nom: 'X', depart: { type: 'copie', tableau: INCONNU } })).statusCode).toBe(404);
  });

  it('nom unique parmi ses tableaux, sans tenir compte de la casse (422) ; un autre compte peut le reprendre', async () => {
    const r = await alice.post(URL, { nom: 'SUIVI DES écarts', depart: { type: 'vide' } });
    expect(r.statusCode).toBe(422);
    expect(r.json().reason).toBe('nom_pris');
    await creer(bob, 'Suivi des écarts');
  });

  it.each([
    ['un nom vide', { nom: '  ', depart: { type: 'vide' } }],
    ['un nom trop long', { nom: 'x'.repeat(61), depart: { type: 'vide' } }],
    ['un départ inconnu', { nom: 'Essai', depart: { type: 'modele' } }],
    ['une copie sans tableau', { nom: 'Essai', depart: { type: 'copie' } }],
    ['un champ en trop', { nom: 'Essai', depart: { type: 'vide' }, public: true }],
  ])('refuse %s (422)', async (_, corps) => {
    const avant = (await lire(alice)).onglets.length;
    expect((await alice.post(URL, corps)).statusCode).toBe(422);
    expect((await lire(alice)).onglets).toHaveLength(avant);
  });

  it('refusée sans jeton CSRF', async () => {
    const r = await alice.req('POST', URL, { json: { nom: 'Sans jeton', depart: { type: 'vide' } }, csrf: false });
    expect(r.statusCode).toBe(403);
  });

  it('au plus 20 tableaux par compte (422)', async () => {
    const dora = await login(t, await makeUser(t, 'dora', 'rw'));
    for (let i = 1; i <= 20; i++) await creer(dora, `Tableau ${i}`);
    const r = await dora.post(URL, { nom: 'Tableau 21', depart: { type: 'vide' } });
    expect(r.statusCode).toBe(422);
    expect(r.json().reason).toBe('trop_de_tableaux');
    const d = await lire(dora);
    expect(d.disponibles.filter((x) => x.origine === 'mien')).toHaveLength(20);
    // Les quatre premiers ont rejoint ses favoris, derrière Global ; les suivants sont dans la liste.
    expect(d.onglets.map((o) => o.nom)).toEqual(['Global', 'Tableau 1', 'Tableau 2', 'Tableau 3', 'Tableau 4']);
  });
});

describe('modifier ses tableaux', () => {
  it('exige If-Match (428), refuse une version périmée sans rien changer (412)', async () => {
    const o = await onglet(alice, 'Vue standard');
    expect((await alice.put(`${URL}/${o.id}`, { disposition: D2 })).statusCode).toBe(428);
    const r = await alice.put(`${URL}/${o.id}`, { disposition: D2 }, v(o.version));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe(`"${o.version + 1}"`);
    expect(r.json()).toMatchObject({ disposition: D2, version: o.version + 1 });
    const conflit = await alice.put(`${URL}/${o.id}`, { disposition: D1 }, v(o.version));
    expect(conflit.statusCode).toBe(412);
    expect(conflit.json()).toMatchObject({ current: { version: o.version + 1, updated_by: 'alice' } });
    expect((await onglet(alice, 'Vue standard')).disposition).toEqual(D2);
  });

  it('renommer : nom unique (422), changer la casse de son propre nom est permis', async () => {
    const o = await onglet(alice, 'Vue standard');
    expect((await alice.put(`${URL}/${o.id}`, { nom: 'copie' }, v(o.version))).statusCode).toBe(422);
    const r = await alice.put(`${URL}/${o.id}`, { nom: 'VUE standard' }, v(o.version));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ nom: 'VUE standard', disposition: D2 });
    expect((await alice.put(`${URL}/${o.id}`, { nom: 'Vue standard' }, v(o.version + 1))).statusCode).toBe(200);
  });

  it.each([
    ['une dalle inconnue', { disposition: { dalles: [{ id: 'inconnue', largeur: 4, masquee: false }] } }],
    ['une largeur hors liste', { disposition: { dalles: [{ id: 'phare', largeur: 5, masquee: false }] } }],
    [
      'une dalle en double',
      {
        disposition: {
          dalles: [
            { id: 'phare', largeur: 6, masquee: false },
            { id: 'phare', largeur: 4, masquee: false },
          ],
        },
      },
    ],
    ['des données en plus', { disposition: { dalles: [{ id: 'phare', largeur: 6, masquee: false, valeur: 80 }] } }],
    ['rien à modifier', {}],
    ['un champ en trop', { nom: 'Autre nom', public: true }],
  ])('refuse %s (422)', async (_, corps) => {
    const avant = await onglet(alice, 'Vue standard');
    const r = await alice.put(`${URL}/${avant.id}`, corps, v(avant.version));
    expect(r.statusCode).toBe(422);
    expect(await onglet(alice, 'Vue standard')).toEqual(avant);
  });

  it('réglages des dalles enregistrés avec la disposition, refusés hors de ce que la dalle accepte', async () => {
    const avant = await onglet(alice, 'Vue standard');
    const avecReglages = {
      dalles: [
        { id: 'phare', largeur: 6, masquee: false, reglages: { seuils: { orange: 50, vert: 90 } } },
        { id: 'ecarts-statut', largeur: 4, masquee: false, reglages: { visualisation: 'anneau' } },
        { id: 'indicateurs', largeur: 3, masquee: false, reglages: { cible: 75, visualisation: 'chiffre' } },
      ],
    };
    const r = await alice.put(`${URL}/${avant.id}`, { disposition: avecReglages }, v(avant.version));
    expect(r.statusCode, r.body).toBe(200);
    expect((await onglet(alice, 'Vue standard')).disposition).toEqual(avecReglages);
    const version = r.json().version;
    for (const reglages of [
      { cible: 80 },
      { visualisation: 'histogramme' },
      { seuils: { orange: 90, vert: 50 } },
      { seuilsJours: { orange: 10, vert: 20 }, couleur: 'rouge' },
    ]) {
      const refus = await alice.put(
        `${URL}/${avant.id}`,
        { disposition: { dalles: [{ id: 'phare', largeur: 6, masquee: false, reglages }] } },
        v(version),
      );
      expect(refus.statusCode, JSON.stringify(reglages)).toBe(422);
    }
    expect((await onglet(alice, 'Vue standard')).version).toBe(version);
  });

  it('chaque compte ne touche qu’à ses tableaux : celui d’un autre est introuvable (404)', async () => {
    const deBob = (await lire(bob)).onglets.find((o) => o.nom === 'Tableau de bob')!;
    expect((await alice.put(`${URL}/${deBob.id}`, { disposition: D1 }, v(deBob.version))).statusCode).toBe(404);
    expect((await alice.del(`${URL}/${deBob.id}`, v(deBob.version))).statusCode).toBe(404);
    expect((await alice.put(`${URL}/${INCONNU}`, { disposition: D1 }, v(1))).statusCode).toBe(404);
    expect((await lire(bob)).onglets.find((o) => o.id === deBob.id)).toEqual(deBob);
  });
});

describe('supprimer ses tableaux', () => {
  it('If-Match obligatoire ; supprime le sien sans toucher ceux des autres ; il sort de ses onglets', async () => {
    const o = await onglet(alice, 'Copie');
    expect((await alice.del(`${URL}/${o.id}`)).statusCode).toBe(428);
    expect((await alice.del(`${URL}/${o.id}`, v(o.version + 1))).statusCode).toBe(412);
    expect((await alice.del(`${URL}/${o.id}`, v(o.version))).statusCode).toBe(204);
    expect((await lire(alice)).onglets.map((x) => x.nom)).toEqual(['Global', 'Suivi des écarts', 'Vue standard']);
    expect((await lire(bob)).onglets.map((x) => x.nom)).toContain('Tableau de bob');
    // Un nom libéré se réutilise.
    await creer(alice, 'Copie');
  });

  it('sans le droit tableau_de_bord:modifier (rôle Lecteur) : lecture, onglets et suppression de ses tableaux seulement', async () => {
    expect((await lecteur.get(URL)).statusCode).toBe(200);
    expect((await lecteur.post(URL, { nom: 'Essai', depart: { type: 'vide' } })).statusCode).toBe(403);
    // Un tableau enregistré avant le retrait du droit reste dans sa liste (hors favoris), en lecture seule, et peut
    // toujours être supprimé.
    await t.svc.db.q(
      `INSERT INTO tableaux_de_bord (proprietaire, nom, disposition, updated_by) VALUES ($1, 'Ancien', '{"dalles":[]}', 'test')`,
      [uLecteur.id],
    );
    const o = await tableau(lecteur, 'Ancien');
    expect(o).toMatchObject({ origine: 'mien', modifiable: false, enOnglet: false, disposition: { dalles: [] } });
    expect((await lecteur.put(`${URL}/${o.id}`, { disposition: D2 }, v(o.version))).statusCode).toBe(403);
    expect((await lecteur.get(`${URL}/${o.id}/partage`)).statusCode).toBe(403);
    expect((await lecteur.del(`${URL}/${o.id}`, v(o.version))).statusCode).toBe(204);
    const apres = await lire(lecteur);
    expect(apres.onglets.map((x) => x.modele)).toEqual(['global']);
    expect(apres.disponibles.some((x) => x.id === o.id)).toBe(false);
    expect((await lecteur.get(`${URL}/${o.id}`)).statusCode).toBe(404);
  });

  it('module « Tableau de bord » désactivé : plus de création ni de modification (409), lecture inchangée', async () => {
    const etat = await t.svc.modules.state(true);
    await t.svc.db.q('UPDATE module_activation SET disabled = $1, version = version + 1 WHERE id = 1', [
      [...etat.disabled, 'tableau_de_bord'],
    ]);
    try {
      const o = await onglet(alice, 'Vue standard');
      expect((await alice.put(`${URL}/${o.id}`, { disposition: D1 }, v(o.version))).statusCode).toBe(409);
      expect((await alice.post(URL, { nom: 'Pendant', depart: { type: 'vide' } })).statusCode).toBe(409);
      const d = await lire(alice);
      expect(d.onglets.map((x) => x.nom)).toContain('Vue standard');
      expect(d.droits).toEqual({ creer: false, publier: false, modeles: false });
      expect(d.onglets.every((x) => !x.modifiable)).toBe(true);
    } finally {
      await t.svc.db.q('UPDATE module_activation SET disabled = $1, version = version + 1 WHERE id = 1', [
        etat.disabled,
      ]);
    }
  });
});

describe('favoris (onglets)', () => {
  it('ordre retenu pour chaque personne ; un tableau proposé s’ajoute et se retire ; ses tableaux peuvent sortir des favoris et restent dans la liste', async () => {
    const d = await lire(alice);
    const [global, ecarts, standard, copie] = ['Global', 'Suivi des écarts', 'Vue standard', 'Copie'].map(
      (n) => d.onglets.find((o) => o.nom === n)!.id,
    );
    const smsi = d.disponibles.find((x) => x.modele === 'suivi-smsi')!.id;
    let r = await alice.put(`${URL}/onglets`, { tableaux: [copie, smsi, global, ecarts, standard] });
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json() as TableauxOut).onglets.map((o) => o.nom)).toEqual([
      'Copie',
      'Suivi SMSI',
      'Global',
      'Suivi des écarts',
      'Vue standard',
    ]);
    expect((await lire(alice)).disponibles.find((x) => x.id === smsi)!.enOnglet).toBe(true);
    // Une liste sans ses propres tableaux : ils sortent des favoris (rien n'est rajouté d'office) et restent dans la
    // liste, en tête (les siens, puis les proposés).
    r = await alice.put(`${URL}/onglets`, { tableaux: [smsi] });
    expect(r.statusCode, r.body).toBe(200);
    const apres = r.json() as TableauxOut;
    expect(apres.onglets.map((o) => o.nom)).toEqual(['Suivi SMSI']);
    expect(apres.disponibles.map((x) => [x.nom, x.origine, x.enOnglet])).toEqual([
      ['Copie', 'mien', false],
      ['Suivi des écarts', 'mien', false],
      ['Vue standard', 'mien', false],
      ['Global', 'propose', false],
      ['Suivi SMSI', 'propose', true],
    ]);
    expect((await lire(alice)).onglets.map((o) => o.nom)).toEqual(['Suivi SMSI']);
    // L'ordre d'une personne ne change pas celui d'une autre.
    expect((await lire(bob)).onglets.map((o) => o.nom)).toEqual(['Global', 'Tableau de bob', 'Suivi des écarts']);
  });

  it('sans aucun onglet, le tableau Global revient ; un compte sans droit range aussi ses onglets', async () => {
    const vide = await login(t, await makeUser(t, 'sans-tableau', 'ro'));
    expect((await vide.put(`${URL}/onglets`, { tableaux: [] })).statusCode).toBe(200);
    expect((await lire(vide)).onglets.map((o) => o.modele)).toEqual(['global']);
    const smsi = (await modele(vide, 'suivi-smsi'))!.id;
    const r = await vide.put(`${URL}/onglets`, { tableaux: [smsi] });
    expect(r.statusCode, r.body).toBe(200);
    expect((await lire(vide)).onglets.map((o) => o.modele)).toEqual(['suivi-smsi']);
  });

  it('refuse un tableau invisible ou inconnu (404), un doublon (422), un tableau proposé « Bientôt » (422)', async () => {
    const d = await lire(alice);
    const ids = d.onglets.map((o) => o.id);
    const deBob = (await lire(bob)).onglets.find((o) => o.nom === 'Tableau de bob')!.id;
    expect((await alice.put(`${URL}/onglets`, { tableaux: [...ids, deBob] })).statusCode).toBe(404);
    expect((await alice.put(`${URL}/onglets`, { tableaux: [...ids, INCONNU] })).statusCode).toBe(404);
    expect((await alice.put(`${URL}/onglets`, { tableaux: [...ids, ids[0]] })).statusCode).toBe(422);
    expect((await alice.put(`${URL}/onglets`, { tableaux: ['pas-un-identifiant'] })).statusCode).toBe(422);
    const vuln = (await modele(rssi, 'vulnerabilites'))!;
    expect(vuln).toMatchObject({ disponible: false, restreint: true });
    expect((await rssi.put(`${URL}/onglets`, { tableaux: [vuln.id] })).statusCode).toBe(422);
    expect((await lire(alice)).onglets.map((o) => o.id)).toEqual(ids);
  });

  it('au plus 5 favoris (422 à 6) ; création acceptée quand les favoris sont pleins : le nouveau tableau reste hors favoris, dans la liste', async () => {
    const u = await makeUser(t, 'emile', 'rw');
    const emile = await login(t, u);
    // Global d'office, puis ses quatre premiers tableaux : les favoris sont pleins.
    for (let i = 1; i <= 4; i++) expect((await creer(emile, `Mien ${i}`)).enOnglet).toBe(true);
    const pleins = ['Global', 'Mien 1', 'Mien 2', 'Mien 3', 'Mien 4'];
    expect((await lire(emile)).onglets.map((o) => o.nom)).toEqual(pleins);
    // Création non refusée (201) : hors favoris, mais dans la liste, et modifiable.
    const cinq = await creer(emile, 'Mien 5');
    expect(cinq).toMatchObject({ origine: 'mien', enOnglet: false, modifiable: true });
    let d = await lire(emile);
    expect(d.onglets.map((o) => o.nom)).toEqual(pleins);
    expect(d.disponibles.find((x) => x.id === cinq.id)).toMatchObject({
      nom: 'Mien 5',
      origine: 'mien',
      enOnglet: false,
    });
    // Deux tableaux d'une autre personne partagés avec lui.
    const recus = new Map(
      (
        await t.svc.db.q<{ id: string; nom: string }>(
          `INSERT INTO tableaux_de_bord (proprietaire, nom, disposition, updated_by)
           SELECT u.id, 'Reçu ' || g, '{"dalles":[]}', 'test' FROM users u, generate_series(1, 2) g
            WHERE u.username = 'bob' RETURNING id, nom`,
        )
      ).rows.map((r) => [r.nom, r.id]),
    );
    const [recu1, recu2] = [recus.get('Reçu 1')!, recus.get('Reçu 2')!];
    await t.svc.db.q(
      `INSERT INTO tableaux_de_bord_partages (tableau, utilisateur, created_by) SELECT unnest($1::uuid[]), $2, 'test'`,
      [[recu1, recu2], u.id],
    );
    const global = d.onglets[0]!.id;
    const miens = d.disponibles.filter((x) => x.origine === 'mien').map((x) => x.id);
    expect(miens).toHaveLength(5);
    // Six favoris : refusé par le contrat (422), sans rien changer.
    expect((await emile.put(`${URL}/onglets`, { tableaux: [...miens, recu1] })).statusCode).toBe(422);
    expect((await emile.put(`${URL}/onglets`, { tableaux: [global, ...miens] })).statusCode).toBe(422);
    expect((await lire(emile)).onglets.map((o) => o.nom)).toEqual(pleins);
    // Cinq, toutes origines mêlées, dans l'ordre voulu : accepté ; les autres restent dans la liste, hors favoris.
    const r = await emile.put(`${URL}/onglets`, { tableaux: [recu2, cinq.id, global, miens[0], recu1] });
    expect(r.statusCode, r.body).toBe(200);
    d = r.json() as TableauxOut;
    expect(d.onglets.map((o) => o.nom)).toEqual(['Reçu 2', 'Mien 5', 'Global', 'Mien 1', 'Reçu 1']);
    expect(d.disponibles.filter((x) => !x.enOnglet).map((x) => x.nom)).toEqual([
      'Mien 2',
      'Mien 3',
      'Mien 4',
      'Suivi SMSI',
    ]);
    // Pleins de nouveau : une création reste hors favoris ; une place libérée, la suivante y entre, en dernier.
    expect((await creer(emile, 'Mien 6')).enOnglet).toBe(false);
    expect((await emile.put(`${URL}/onglets`, { tableaux: [recu2, cinq.id, global, miens[0]] })).statusCode).toBe(200);
    expect((await creer(emile, 'Mien 7')).enOnglet).toBe(true);
    expect((await lire(emile)).onglets.map((o) => o.nom)).toEqual(['Reçu 2', 'Mien 5', 'Global', 'Mien 1', 'Mien 7']);
    // Plus de cinq lignes en base (écrites hors de l'API) : seules les cinq premières sont lues, et une création n'y
    // ajoute rien.
    await t.svc.db.q('DELETE FROM tableaux_de_bord_onglets WHERE utilisateur = $1', [u.id]);
    await t.svc.db.q(
      `INSERT INTO tableaux_de_bord_onglets (utilisateur, tableau, rang)
       SELECT $1, id, (row_number() OVER (ORDER BY nom))::int FROM tableaux_de_bord WHERE proprietaire = $1`,
      [u.id],
    );
    expect((await lire(emile)).onglets.map((o) => o.nom)).toEqual(['Mien 1', 'Mien 2', 'Mien 3', 'Mien 4', 'Mien 5']);
    expect((await creer(emile, 'Mien 8')).enOnglet).toBe(false);
    expect((await lire(emile)).onglets).toHaveLength(5);
  });
});

describe('lire un tableau, favori ou non (GET /:id)', () => {
  it('le sien hors favoris : détail complet, modifiable, identique à celui de la barre des favoris ; la lecture ne change pas les favoris', async () => {
    const avant = await lire(alice);
    const favoris = avant.onglets.map((o) => o.id);
    const x = avant.disponibles.find((o) => o.nom === 'Vue standard')!;
    expect(x).toMatchObject({ origine: 'mien', enOnglet: false });
    const r = await alice.get(`${URL}/${x.id}`);
    expect(r.statusCode, r.body).toBe(200);
    const detail = r.json() as TableauDetail;
    expect(Object.keys(detail).sort()).toEqual([...Object.keys(x), 'disposition', 'version', 'modifiable'].sort());
    expect(detail).toMatchObject({ ...x, auteur: 'Nom alice', modifiable: true });
    expect(detail.version).toBeGreaterThan(1);
    expect((await lire(alice)).onglets.map((o) => o.id)).toEqual(favoris);
    // Mis en favori, il s'y lit à l'identique.
    expect((await alice.put(`${URL}/onglets`, { tableaux: [...favoris, x.id] })).statusCode).toBe(200);
    expect(await onglet(alice, 'Vue standard')).toEqual({ ...detail, enOnglet: true });
    expect((await alice.get(`${URL}/${x.id}`)).json()).toEqual({ ...detail, enOnglet: true });
    expect((await alice.put(`${URL}/onglets`, { tableaux: favoris })).statusCode).toBe(200);
  });

  it('un tableau proposé : lecture seule pour un contributeur, modifiable pour l’administrateur ; hors de son public, introuvable (404)', async () => {
    const g = (await modele(alice, 'global'))!;
    const r = await alice.get(`${URL}/${g.id}`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      ...g,
      origine: 'propose',
      auteur: null,
      modifiable: false,
      disposition: DEFS_MODELES.global.disposition(),
    });
    expect((await admin.get(`${URL}/${g.id}`)).json()).toMatchObject({ origine: 'propose', modifiable: true });
    // Vulnérabilités vise le rôle RSSI : introuvable pour le contributeur, « Bientôt » pour le RSSI.
    const vuln = (await modele(rssi, 'vulnerabilites'))!;
    expect((await alice.get(`${URL}/${vuln.id}`)).statusCode).toBe(404);
    expect((await rssi.get(`${URL}/${vuln.id}`)).json()).toMatchObject({
      ...vuln,
      disponible: false,
      restreint: true,
      modifiable: false,
    });
  });

  it('refus : le tableau d’un autre non partagé ou inconnu (404, même réponse), un identifiant mal formé (422), sans session (401)', async () => {
    const deBob = (await lire(bob)).onglets.find((o) => o.nom === 'Tableau de bob')!;
    const autre = await alice.get(`${URL}/${deBob.id}`);
    expect(autre.statusCode).toBe(404);
    const inconnu = await alice.get(`${URL}/${INCONNU}`);
    expect(inconnu.statusCode).toBe(404);
    expect(autre.json()).toEqual(inconnu.json());
    expect((await lecteur.get(`${URL}/${deBob.id}`)).statusCode).toBe(404);
    expect((await alice.get(`${URL}/pas-un-identifiant`)).statusCode).toBe(422);
    const anonyme = new Agent(t);
    expect((await anonyme.get(`${URL}/${deBob.id}`)).statusCode).toBe(401);
    expect((await anonyme.get(`${URL}/${INCONNU}`)).statusCode).toBe(401);
    // Son propriétaire, lui, le lit tel qu'en favori.
    expect((await bob.get(`${URL}/${deBob.id}`)).json()).toEqual(deBob);
  });
});

describe('tableaux proposés d’office', () => {
  it('lecture seule pour tous : modifier, rétablir ou partager un tableau proposé exige administration:administrer', async () => {
    const g = (await modele(alice, 'global'))!;
    expect((await alice.put(`${URL}/${g.id}`, { disposition: D1 }, v(1))).statusCode).toBe(403);
    expect((await alice.del(`${URL}/${g.id}`, v(1))).statusCode).toBe(403);
    expect((await alice.get(`${URL}/${g.id}/partage`)).statusCode).toBe(403);
    expect((await rssi.put(`${URL}/${g.id}`, { disposition: D1 }, v(1))).statusCode).toBe(403);
    // Un tableau proposé hors de son public est introuvable.
    const vuln = (await modele(admin, 'vulnerabilites'))!;
    expect((await alice.put(`${URL}/${vuln.id}`, { disposition: D1 }, v(1))).statusCode).toBe(404);
    expect((await modele(alice, 'global'))!).toEqual(g);
  });

  it('l’administrateur modifie la disposition pour tous (journalisé), sans toucher les tableaux personnels, puis revient au modèle', async () => {
    const g = (await lire(admin)).disponibles.find((x) => x.modele === 'global')!;
    const personnel = (await tableau(alice, 'Vue standard')).disposition;
    const r = await admin.put(`${URL}/${g.id}`, { disposition: D2 }, v(1));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      nom: 'Global',
      disposition: D2,
      version: 2,
      modifiable: true,
      origine: 'propose',
    });
    expect((await admin.put(`${URL}/${g.id}`, { disposition: D1 }, v(1))).statusCode).toBe(412);
    const vu = (await lire(bob)).onglets.find((o) => o.modele === 'global')!;
    expect(vu).toMatchObject({ disposition: D2, version: 2, modifiable: false });
    expect((await tableau(alice, 'Vue standard')).disposition).toEqual(personnel);
    // Retour au modèle : la disposition décrite dans le code revient pour tout le monde.
    expect((await admin.del(`${URL}/${g.id}`, v(1))).statusCode).toBe(412);
    expect((await admin.del(`${URL}/${g.id}`, v(2))).statusCode).toBe(204);
    expect((await lire(bob)).onglets.find((o) => o.modele === 'global')).toMatchObject({
      disposition: DEFS_MODELES.global.disposition(),
      version: 3,
    });
    const audit = await t.svc.db.q<{ action: string; username: string; details: { modele: string } }>(
      "SELECT action, username, details FROM audit_log WHERE action LIKE 'tableau_de_bord.modele%' ORDER BY id",
    );
    expect(audit.rows).toEqual([
      {
        action: 'tableau_de_bord.modele_modifie',
        username: 'rssi',
        details: expect.objectContaining({ modele: 'global', version: 2, dalles: 1 }),
      },
      { action: 'tableau_de_bord.modele_retabli', username: 'rssi', details: { modele: 'global' } },
    ]);
  });

  it('public visé : rôles du modèle par défaut, lignes de partage de l’administrateur sinon ; un tableau proposé ne se publie pas (422)', async () => {
    const smsi = (await lire(admin)).disponibles.find((x) => x.modele === 'suivi-smsi')!;
    const p = await admin.get(`${URL}/${smsi.id}/partage`);
    expect(p.statusCode, p.body).toBe(200);
    expect(p.json()).toEqual({ destinataires: [], public: false, chiffresOuverts: false, version: 1 });
    expect(
      (await admin.put(`${URL}/${smsi.id}/partage`, { destinataires: [], public: true }, v(p.json().version)))
        .statusCode,
    ).toBe(422);
    const r = await admin.put(
      `${URL}/${smsi.id}/partage`,
      { destinataires: [{ type: 'role', id: 'rssi' }], public: false },
      v(p.json().version),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().destinataires).toEqual([{ type: 'role', id: 'rssi', nom: 'RSSI' }]);
    // Restreint : le RSSI le voit (cadenas), le contributeur ne le voit plus, même s'il l'avait en favori.
    expect(await modele(rssi, 'suivi-smsi')).toMatchObject({ restreint: true });
    expect(await modele(alice, 'suivi-smsi')).toBeUndefined();
    expect((await lire(alice)).onglets.map((o) => o.modele)).not.toContain('suivi-smsi');
    expect((await alice.get(`${URL}/${smsi.id}`)).statusCode).toBe(404);
    // Sans ligne de partage : de nouveau tout le monde.
    expect(
      (await admin.put(`${URL}/${smsi.id}/partage`, { destinataires: [], public: false }, v(r.json().version)))
        .statusCode,
    ).toBe(200);
    expect(await modele(alice, 'suivi-smsi')).toMatchObject({ restreint: false });
  });

  it('Vulnérabilités : rôle RSSI seulement, « Bientôt » ; l’administrateur les voit tous pour les gérer', async () => {
    expect(await modele(rssi, 'vulnerabilites')).toMatchObject({ disponible: false, restreint: true, auteur: null });
    expect(await modele(alice, 'vulnerabilites')).toBeUndefined();
    expect((await lire(admin)).disponibles.map((x) => x.modele)).toEqual([
      'global',
      'suivi-smsi',
      'vulnerabilites',
      'suivi-reglementaire',
    ]);
  });

  it('recréés depuis le code s’ils manquent (après une remise à vide, par exemple)', async () => {
    const avant = (await lire(bob)).disponibles.filter((x) => x.origine === 'propose').map((x) => x.id);
    await t.svc.db.q('DELETE FROM tableaux_de_bord WHERE proprietaire IS NULL');
    const d = await lire(bob);
    // Ses favoris gardent ses propres tableaux ; le tableau Global recréé reste dans la liste, avec Suivi SMSI.
    expect(d.onglets.length).toBeGreaterThan(0);
    expect(d.onglets.every((o) => o.origine === 'mien')).toBe(true);
    expect(d.disponibles.filter((x) => x.origine !== 'mien').map((x) => x.modele)).toEqual(['global', 'suivi-smsi']);
    expect(d.disponibles.some((x) => avant.includes(x.id))).toBe(false);
    const global = d.disponibles.find((x) => x.modele === 'global')!;
    expect((await admin.get(`${URL}/${global.id}/partage`)).json().version).toBe(1);
  });

  it('lecture tolérante : une dalle retirée du catalogue, déjà en base, est ignorée', async () => {
    const o = await tableau(alice, 'Suivi des écarts');
    await t.svc.db.q(
      `UPDATE tableaux_de_bord SET disposition = '{"dalles":[{"id":"retiree","largeur":4,"masquee":false},{"id":"phare","largeur":12,"masquee":false}]}' WHERE id = $1`,
      [o.id],
    );
    const lue = { dalles: [{ id: 'phare', largeur: 12, masquee: false }] };
    // Lu hors favoris (GET /:id), puis dans la barre des favoris.
    expect((await tableau(alice, 'Suivi des écarts')).disposition).toEqual(lue);
    expect((await alice.put(`${URL}/onglets`, { tableaux: [o.id] })).statusCode).toBe(200);
    expect((await onglet(alice, 'Suivi des écarts')).disposition).toEqual(lue);
    // Une ancienne disposition par défaut (ADR 0078, sans propriétaire ni modèle) n'est plus lue.
    await t.svc.db.q(
      `INSERT INTO tableaux_de_bord (proprietaire, disposition, updated_by) VALUES (NULL, '{"dalles":[]}', 'test')`,
    );
    expect((await lire(alice)).disponibles.filter((x) => x.origine !== 'mien').map((x) => x.modele)).toEqual([
      'global',
      'suivi-smsi',
    ]);
  });

  it('suit la suppression du compte (clé étrangère) : tableaux et onglets', async () => {
    const carole = await makeUser(t, 'carole', 'rw');
    const a = await login(t, carole);
    await creer(a, 'Éphémère');
    await t.svc.db.q('DELETE FROM users WHERE id = $1', [carole.id]);
    const n = await t.svc.db.one<{ t: number; o: number }>(
      `SELECT (SELECT count(*) FROM tableaux_de_bord WHERE proprietaire = $1)::int AS t,
              (SELECT count(*) FROM tableaux_de_bord_onglets WHERE utilisateur = $1)::int AS o`,
      [carole.id],
    );
    expect(n).toEqual({ t: 0, o: 0 });
  });
});
