/* Module Vulnérabilités (ADR 0100), lot V1 : registre des produits surveillés, au niveau de l'organisation. Droits refusés
   sans le droit, module désactivé, CSRF, If-Match périmé, doublon à la casse près, fournisseur lié, responsable, journal
   d'audit, migration sur base vierge. Données fictives. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

const URL_PRODUITS = '/api/vulnerabilites/produits';
let t: TestApp, admin: Agent, rssi: Agent, contributeur: Agent, lecteur: Agent, sansRole: Agent, seulVuln: Agent;
let roleRw: Agent, roleRo: Agent;
let contributeurUser: TestUser;

const produit = (extra: Record<string, unknown> = {}) => ({
  editeur: 'Éditeur fictif',
  nom: 'Produit fictif',
  versionProduit: '8.3',
  famille: 'web',
  criticite: 'elevee',
  ...extra,
});
const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const audits = async (action: string, target: string) =>
  (
    await t.svc.db.q<{ username: string; details: Record<string, unknown> }>(
      'SELECT username, details FROM audit_log WHERE action = $1 AND target = $2 ORDER BY id',
      [action, target],
    )
  ).rows;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'vuln_admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'vuln_rssi', 'rssi'));
  // Droits par défaut resserrés (ADR 0100, lot V5) : le module n'est plus un module métier ; contributeur et lecteur
  // prédéfinis n'en ont aucun droit. Les rôles « contributeur » et « lecteur » du module sont donc des rôles personnalisés.
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_vuln_contrib', 'Vulnérabilités, contribution', ARRAY['vulnerabilites:lire','vulnerabilites:modifier','fournisseurs:lire']),
       ('r_vuln_lecteur', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  contributeurUser = await makeUser(t, 'vuln_contributeur', 'r_vuln_contrib');
  contributeur = await login(t, contributeurUser);
  lecteur = await login(t, await makeUser(t, 'vuln_lecteur', 'r_vuln_lecteur'));
  roleRw = await login(t, await makeUser(t, 'vuln_rw', 'rw'));
  roleRo = await login(t, await makeUser(t, 'vuln_ro', 'ro'));
  sansRole = await login(t, await makeUser(t, 'vuln_sans_role', null));
  // Rôle personnalisé : tous les droits du module, aucun sur les fournisseurs.
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_vuln', 'Vulnérabilités seules', ARRAY['vulnerabilites:lire','vulnerabilites:modifier','vulnerabilites:supprimer'])",
  );
  seulVuln = await login(t, await makeUser(t, 'vuln_seul', 'r_vuln'));
});
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  await t.svc.db.q('DELETE FROM vulnerabilites_produits');
});

describe('migration 072 sur base vierge', () => {
  it('crée la table vide, admet le module dans la contrainte et refuse un module inconnu', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '072_vulnerabilites_produits.sql'"))?.ok,
    ).toBe(1);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_produits'))!.n).toBe(0);
    await t.svc.db.q("UPDATE module_activation SET disabled = ARRAY['vulnerabilites'] WHERE id = 1");
    await expect(
      t.svc.db.q("UPDATE module_activation SET disabled = ARRAY['vulnerabilites_inconnu'] WHERE id = 1"),
    ).rejects.toThrow();
    // Contraintes de la table : famille, criticité et origine en liste fermée ; doublon à la casse près.
    const ins = (famille: string, criticite: string, origine = 'saisie', nom = 'Produit SQL') =>
      t.svc.db.q(
        `INSERT INTO vulnerabilites_produits (editeur, nom, famille, criticite, origine, created_by, updated_by)
         VALUES ('Éditeur SQL', $1, $2, $3, $4, 'test', 'test')`,
        [nom, famille, criticite, origine],
      );
    await expect(ins('autre', 'faible')).rejects.toThrow();
    await expect(ins('web', 'critique')).rejects.toThrow();
    await expect(ins('web', 'faible', 'manuel')).rejects.toThrow();
    await ins('web', 'faible', 'tenable');
    await expect(ins('reseau', 'moyenne', 'saisie', 'PRODUIT sql')).rejects.toThrow(/vulnerabilites_produits_doublon/);
  });
});

describe('produits surveillés : droits et module', () => {
  it('droits par défaut resserrés : administrateur et RSSI seulement ; contributeur et lecteur prédéfinis refusés', async () => {
    for (const a of [roleRw, roleRo]) {
      expect((await a.get(URL_PRODUITS)).statusCode).toBe(403);
      expect((await a.post(URL_PRODUITS, produit())).statusCode).toBe(403);
      expect((await a.get('/api/vulnerabilites/responsables')).statusCode).toBe(403);
      expect((await a.me()).permissions.some((x) => x.startsWith('vulnerabilites:'))).toBe(false);
    }
    const r = await rssi.post(URL_PRODUITS, produit());
    expect(r.statusCode).toBe(201);
    expect((await rssi.get(URL_PRODUITS)).statusCode).toBe(200);
    expect((await admin.get(URL_PRODUITS)).statusCode).toBe(200);
    // Un rôle personnalisé peut accorder le module ; il n'ouvre pas pour autant les routes communes « métier ».
    expect((await lecteur.get(URL_PRODUITS)).statusCode).toBe(200);
    expect((await lecteur.get('/api/grc/smsis')).statusCode).toBe(403);
  });

  it('lecture : lecteur oui ; sans rôle, refus 403 sur chaque route', async () => {
    expect((await lecteur.get(URL_PRODUITS)).statusCode).toBe(200);
    const fictif = `${URL_PRODUITS}/00000000-0000-4000-8000-000000000000`;
    expect((await sansRole.get(URL_PRODUITS)).statusCode).toBe(403);
    expect((await sansRole.get(fictif)).statusCode).toBe(403);
    expect((await sansRole.post(URL_PRODUITS, produit())).statusCode).toBe(403);
    expect((await sansRole.patch(fictif, { criticite: 'faible' }, ifMatch(1))).statusCode).toBe(403);
    expect((await sansRole.del(fictif, ifMatch(1))).statusCode).toBe(403);
    expect((await sansRole.get('/api/vulnerabilites/responsables')).statusCode).toBe(403);
  });

  it('écriture : lecteur refusé ; contributeur crée et modifie mais ne supprime pas', async () => {
    expect((await lecteur.post(URL_PRODUITS, produit())).statusCode).toBe(403);
    expect((await lecteur.get('/api/vulnerabilites/responsables')).statusCode).toBe(403);
    const r = await contributeur.post(URL_PRODUITS, produit());
    expect(r.statusCode).toBe(201);
    const p = r.json();
    expect((await lecteur.patch(`${URL_PRODUITS}/${p.id}`, { criticite: 'faible' }, ifMatch(1))).statusCode).toBe(403);
    expect((await lecteur.del(`${URL_PRODUITS}/${p.id}`, ifMatch(1))).statusCode).toBe(403);
    const m = await contributeur.patch(`${URL_PRODUITS}/${p.id}`, { criticite: 'faible' }, ifMatch(p.version));
    expect(m.statusCode).toBe(200);
    expect((await contributeur.del(`${URL_PRODUITS}/${p.id}`, ifMatch(m.json().version))).statusCode).toBe(403);
    expect((await admin.del(`${URL_PRODUITS}/${p.id}`, ifMatch(m.json().version))).statusCode).toBe(204);
    expect((await contributeur.get('/api/vulnerabilites/responsables')).statusCode).toBe(200);
  });

  it('module désactivé : toutes les routes répondent 409 et les droits disparaissent de la session', async () => {
    const p = (await admin.post(URL_PRODUITS, produit())).json();
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['vulnerabilites'], version = version + 1 WHERE id = 1",
    );
    for (const r of [
      await admin.get(URL_PRODUITS),
      await admin.get(`${URL_PRODUITS}/${p.id}`),
      await admin.post(URL_PRODUITS, produit({ nom: 'Autre produit fictif' })),
      await admin.patch(`${URL_PRODUITS}/${p.id}`, { criticite: 'faible' }, ifMatch(p.version)),
      await admin.del(`${URL_PRODUITS}/${p.id}`, ifMatch(p.version)),
      await admin.get('/api/vulnerabilites/responsables'),
    ]) {
      expect(r.statusCode).toBe(409);
      expect(r.json()).toMatchObject({ reason: 'module_disabled', module: 'vulnerabilites' });
    }
    expect((await admin.me()).permissions.some((x) => x.startsWith('vulnerabilites:'))).toBe(false);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_produits'))!.n).toBe(1);
  });

  it('CSRF et origine exigés sur les écritures', async () => {
    expect((await admin.req('POST', URL_PRODUITS, { json: produit(), csrf: false })).statusCode).toBe(403);
    const ailleurs = new Agent(t, 'https://ailleurs.invalid');
    ailleurs.cookies = new Map(admin.cookies);
    ailleurs.csrf = admin.csrf;
    expect((await ailleurs.post(URL_PRODUITS, produit())).statusCode).toBe(403);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_produits'))!.n).toBe(0);
  });
});

describe('produits surveillés : registre', () => {
  it('création, lecture avec ETag, filtre par famille, origine « saisie » et audit sans secret', async () => {
    const r = await admin.post(
      URL_PRODUITS,
      produit({ cpe: 'cpe:2.3:a:editeur_fictif:produit_fictif:8.3:*:*:*:*:*:*:*' }),
    );
    expect(r.statusCode).toBe(201);
    const p = r.json();
    expect(p).toMatchObject({
      editeur: 'Éditeur fictif',
      nom: 'Produit fictif',
      versionProduit: '8.3',
      famille: 'web',
      criticite: 'elevee',
      origine: 'saisie',
      fournisseurId: null,
      responsable: null,
      version: 1,
      createdBy: 'vuln_admin',
    });
    const lu = await lecteur.get(`${URL_PRODUITS}/${p.id}`);
    expect(lu.statusCode).toBe(200);
    expect(lu.headers.etag).toBe('"1"');
    await admin.post(
      URL_PRODUITS,
      produit({ editeur: 'Autre éditeur fictif', nom: 'Pare-feu fictif', famille: 'reseau' }),
    );
    expect((await lecteur.get(URL_PRODUITS)).json()).toHaveLength(2);
    const reseau = (await lecteur.get(`${URL_PRODUITS}?famille=reseau`)).json();
    expect(reseau.map((x: { nom: string }) => x.nom)).toEqual(['Pare-feu fictif']);
    expect((await lecteur.get(`${URL_PRODUITS}?famille=inconnue`)).statusCode).toBe(422);
    expect((await admin.get(`${URL_PRODUITS}/00000000-0000-4000-8000-000000000000`)).statusCode).toBe(404);
    const [audit] = await audits('vulnerabilites.produit.cree', p.id);
    expect(audit).toMatchObject({ username: 'vuln_admin' });
    expect(audit!.details).toMatchObject({ editeur: 'Éditeur fictif', nom: 'Produit fictif', origine: 'saisie' });
    // Le client ne choisit pas l'origine.
    expect((await admin.post(URL_PRODUITS, produit({ nom: 'Autre', origine: 'tenable' }))).statusCode).toBe(422);
  });

  it('doublon refusé à la casse près, à la création comme à la modification', async () => {
    const p = (await admin.post(URL_PRODUITS, produit())).json();
    const doublon = await contributeur.post(
      URL_PRODUITS,
      produit({ editeur: 'ÉDITEUR FICTIF', nom: 'produit fictif', famille: 'systemes' }),
    );
    expect(doublon.statusCode).toBe(409);
    expect(doublon.json().error).toMatch(/déjà surveillé/);
    // Même produit, autre version : accepté ; le ramener sur la version existante : refusé.
    const autre = (await contributeur.post(URL_PRODUITS, produit({ versionProduit: '8.4' }))).json();
    const m = await contributeur.patch(
      `${URL_PRODUITS}/${autre.id}`,
      { versionProduit: '8.3' },
      ifMatch(autre.version),
    );
    expect(m.statusCode).toBe(409);
    expect(m.json().error).toMatch(/déjà surveillé/);
    // Changer la casse de sa propre fiche n'est pas un doublon.
    const casse = await admin.patch(`${URL_PRODUITS}/${p.id}`, { nom: 'PRODUIT FICTIF' }, ifMatch(p.version));
    expect(casse.statusCode).toBe(200);
    expect(casse.json().nom).toBe('PRODUIT FICTIF');
  });

  it('If-Match : absent 428, périmé 412 avec la version courante, juste : version incrémentée et audit', async () => {
    const p = (await admin.post(URL_PRODUITS, produit())).json();
    const url = `${URL_PRODUITS}/${p.id}`;
    expect((await admin.patch(url, { criticite: 'faible' })).statusCode).toBe(428);
    expect((await admin.del(url)).statusCode).toBe(428);
    const ok = await contributeur.patch(url, { criticite: 'faible', famille: 'messagerie' }, ifMatch(1));
    expect(ok.statusCode).toBe(200);
    expect(ok.headers.etag).toBe('"2"');
    expect(ok.json()).toMatchObject({
      criticite: 'faible',
      famille: 'messagerie',
      version: 2,
      updatedBy: 'vuln_contributeur',
    });
    const perime = await admin.patch(url, { criticite: 'moyenne' }, ifMatch(1));
    expect(perime.statusCode).toBe(412);
    expect(perime.json().current).toMatchObject({ version: 2, criticite: 'faible' });
    expect((await admin.del(url, ifMatch(1))).statusCode).toBe(412);
    expect((await admin.get(url)).json().criticite).toBe('faible');
    const [audit] = await audits('vulnerabilites.produit.modifie', p.id);
    expect(audit!.details).toMatchObject({
      champs: ['criticite', 'famille'],
      avant: { criticite: 'elevee', famille: 'web' },
      apres: { criticite: 'faible', famille: 'messagerie' },
      version: 2,
    });
    expect((await admin.del(url, ifMatch(2))).statusCode).toBe(204);
    expect((await admin.get(url)).statusCode).toBe(404);
    const [suppr] = await audits('vulnerabilites.produit.supprime', p.id);
    expect(suppr).toMatchObject({ username: 'vuln_admin' });
    expect(suppr!.details).toMatchObject({ nom: 'Produit fictif', version: 2 });
  });

  it('fournisseur lié : présent au registre et lisible par la personne, sinon refusé', async () => {
    const s = await admin.post('/api/suppliers', { name: 'Fournisseur fictif de recette' });
    expect(s.statusCode).toBe(200);
    const fournisseurId = s.json().id as string;
    expect((await admin.post(URL_PRODUITS, produit({ fournisseurId: 'SUP-999' }))).statusCode).toBe(422);
    const ok = await contributeur.post(URL_PRODUITS, produit({ fournisseurId }));
    expect(ok.statusCode).toBe(201);
    expect(ok.json().fournisseurId).toBe(fournisseurId);
    // Sans droit de lecture des fournisseurs : pas de nouveau lien, mais la fiche liée reste modifiable.
    const refus = await seulVuln.post(URL_PRODUITS, produit({ nom: 'Autre produit fictif', fournisseurId }));
    expect(refus.statusCode).toBe(422);
    const garde = await seulVuln.patch(`${URL_PRODUITS}/${ok.json().id}`, { criticite: 'faible' }, ifMatch(1));
    expect(garde.statusCode).toBe(200);
    expect(garde.json().fournisseurId).toBe(fournisseurId);
    // Module « fournisseurs » désactivé : le lien n'est plus vérifiable, il est refusé.
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['fournisseurs'], version = version + 1 WHERE id = 1",
    );
    expect((await admin.post(URL_PRODUITS, produit({ nom: 'Troisième', fournisseurId }))).statusCode).toBe(422);
  });

  it('responsable : personne active, groupe ou fonction qui compte du monde ; libellé rendu', async () => {
    const annuaire = (await contributeur.get('/api/vulnerabilites/responsables')).json();
    expect(annuaire.utilisateurs.map((u: { username: string }) => u.username)).toContain('vuln_contributeur');
    const p = await contributeur.post(
      URL_PRODUITS,
      produit({ responsable: { type: 'utilisateur', id: contributeurUser.id } }),
    );
    expect(p.statusCode).toBe(201);
    expect(p.json()).toMatchObject({
      responsable: { type: 'utilisateur', id: contributeurUser.id },
      responsableLibelle: 'Nom vuln_contributeur',
    });
    const inconnu = '00000000-0000-4000-8000-0000000000ff';
    for (const type of ['utilisateur', 'groupe', 'fonction'])
      expect(
        (await contributeur.post(URL_PRODUITS, produit({ nom: `Produit ${type}`, responsable: { type, id: inconnu } })))
          .statusCode,
      ).toBe(422);
    const vide = await admin.post('/api/admin/groups', { name: 'Groupe vide fictif', roles: [], members: [] });
    expect(vide.statusCode).toBe(201);
    const r = await contributeur.post(
      URL_PRODUITS,
      produit({ nom: 'Produit du groupe', responsable: { type: 'groupe', id: vide.json().id } }),
    );
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toMatch(/aucune personne active/);
    const plein = await admin.post('/api/admin/groups', {
      name: 'Équipe systèmes fictive',
      roles: [],
      members: [contributeurUser.id],
    });
    const g = await contributeur.post(
      URL_PRODUITS,
      produit({ nom: 'Produit du groupe', responsable: { type: 'groupe', id: plein.json().id } }),
    );
    expect(g.statusCode).toBe(201);
    expect(g.json().responsableLibelle).toBe('Équipe systèmes fictive');
    const liste = (await lecteur.get(URL_PRODUITS)).json();
    expect(liste.map((x: { responsableLibelle: string | null }) => x.responsableLibelle).sort()).toEqual([
      'Nom vuln_contributeur',
      'Équipe systèmes fictive',
    ]);
    // Retirer le responsable.
    const sans = await contributeur.patch(`${URL_PRODUITS}/${g.json().id}`, { responsable: null }, ifMatch(1));
    expect(sans.json()).toMatchObject({ responsable: null, responsableLibelle: null });
  });
});
