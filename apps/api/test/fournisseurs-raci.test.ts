/* Matrice RACI des fournisseurs (ADR 0113 ; décision du RSSI du 23/11/2026, migration 106) : droits (sans droit, lecteur,
   contributeur, administrateur), fournisseur inconnu, If-Match (428 sans, 412 périmé), bornes et forme (API et base),
   règle « un A, au moins un R » signalée sans bloquer, journal d'audit réduit aux comptes, matrice d'un fournisseur retiré
   (contrôle des relations, identifiant réattribué), remise à vide. Données fictives. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REMISE_A_VIDE_PHRASES, matriceRaciModele } from '@suivi/shared';
import { controleRelations } from '../src/controle-relations.js';
import { TABLES_TRAVAIL, tablesAVider } from '../src/remise-a-vide.js';
import { hotp } from '../src/security/crypto.js';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp, admin: Agent, adminUser: TestUser, lecteur: Agent, contributeur: Agent, sansDroit: Agent;
let fournisseur: string, autre: string;
const url = (id: string) => `/api/suppliers/${id}/raci`;
const im = (v: number | string) => ({ 'if-match': `"${v}"` });
const modele = () => matriceRaciModele();
const lignesAudit = async (action: string) =>
  (
    await t.svc.db.q<{ target: string; details: Record<string, unknown> }>(
      'SELECT target, details FROM audit_log WHERE action=$1 ORDER BY id',
      [action],
    )
  ).rows;

beforeAll(async () => {
  t = await createTestApp();
  adminUser = await makeUser(t, 'raci_admin', 'admin');
  admin = await login(t, adminUser);
  lecteur = await login(t, await makeUser(t, 'raci_lecteur', 'ro'));
  contributeur = await login(t, await makeUser(t, 'raci_contributeur', 'rw'));
  // Rôle personnalisé sans aucun droit sur les fournisseurs.
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_raci_sans', 'Sans fournisseurs', '{pilotage:lire,audit:lire}')",
  );
  sansDroit = await login(t, await makeUser(t, 'raci_sans_droit', 'r_raci_sans'));
  fournisseur = (await admin.post('/api/suppliers', { name: 'Hébergeur RACI fictif' })).json().id;
  autre = (await admin.post('/api/suppliers', { name: 'Éditeur RACI fictif' })).json().id;
});
afterAll(() => t.close());

describe('lecture et création', () => {
  it('matrice absente tant qu’on ne l’a pas créée', async () => {
    const r = await lecteur.get(url(fournisseur));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ matrice: null, controle: [] });
    expect(r.headers.etag).toBeUndefined();
  });
  it('404 pour un fournisseur absent du registre', async () => {
    expect((await lecteur.get(url('SUP-999'))).statusCode).toBe(404);
    expect((await contributeur.put(url('SUP-999'), modele(), im(0))).statusCode).toBe(404);
    expect(await t.svc.db.one("SELECT 1 FROM fournisseurs_raci WHERE fournisseur_id='SUP-999'")).toBeFalsy();
  });
  it('refuse sans droit de lecture, et l’écriture au lecteur', async () => {
    for (const r of [
      await sansDroit.get(url(fournisseur)),
      await sansDroit.put(url(fournisseur), modele(), im(0)),
      await sansDroit.del(url(fournisseur), im(1)),
      await lecteur.put(url(fournisseur), modele(), im(0)),
      await lecteur.del(url(fournisseur), im(1)),
    ])
      expect(r.statusCode, r.body).toBe(403);
  });
  it('exige le jeton CSRF', async () => {
    const r = await contributeur.req('PUT', url(fournisseur), { json: modele(), headers: im(0), csrf: false });
    expect(r.statusCode).toBe(403);
  });
  it('exige If-Match (428) ; à la création, seule la version « 0 » est admise (412)', async () => {
    expect((await contributeur.put(url(fournisseur), modele())).statusCode).toBe(428);
    expect((await contributeur.put(url(fournisseur), modele(), im(1))).statusCode).toBe(412);
  });
  it('crée la matrice à partir du modèle (contributeur) : version 1, ETag, règle signalée sans bloquer', async () => {
    const r = await contributeur.put(url(fournisseur), modele(), im(0));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe('"1"');
    const { matrice, controle } = r.json();
    expect(matrice).toMatchObject({
      fournisseurId: fournisseur,
      version: 1,
      misAJourPar: 'raci_contributeur',
      activites: modele().activites,
      acteurs: modele().acteurs,
      cases: [],
    });
    // Sept activités vides : toutes à revoir, l'enregistrement est fait.
    expect(controle).toHaveLength(7);
    expect(controle.every((c: { ecarts: string[] }) => c.ecarts.join() === 'aucun_a,aucun_r')).toBe(true);
    // Une seconde création (If-Match « 0 ») est un conflit, avec la version courante.
    const deux = await admin.put(url(fournisseur), modele(), im(0));
    expect(deux.statusCode).toBe(412);
    expect(deux.json().current.version).toBe(1);
    const lu = await lecteur.get(url(fournisseur));
    expect(lu.headers.etag).toBe('"1"');
    expect(lu.json().matrice.version).toBe(1);
  });
});

describe('enregistrement', () => {
  it('remplace la matrice (If-Match), garde l’ordre, et rend le contrôle de chaque activité', async () => {
    const m = modele();
    const corps = {
      activites: [m.activites[1]!, m.activites[0]!, { id: 'activite-1', libelle: '  Revue\tfictive  ' }],
      acteurs: [...m.acteurs, { id: 'acteur-1', libelle: 'Délégué fictif' }],
      cases: [
        { activite: 'sauvegardes', acteur: 'fournisseur', lettre: 'R' },
        { activite: 'sauvegardes', acteur: 'dsi', lettre: 'A' },
        { activite: 'correctifs', acteur: 'rssi', lettre: 'A' },
        { activite: 'correctifs', acteur: 'dsi', lettre: 'A' },
        { activite: 'activite-1', acteur: 'acteur-1', lettre: 'I' },
      ],
    };
    const r = await contributeur.put(url(fournisseur), corps, im(1));
    expect(r.statusCode, r.body).toBe(200);
    const { matrice, controle } = r.json();
    expect(matrice.version).toBe(2);
    expect(matrice.activites.map((a: { id: string }) => a.id)).toEqual(['sauvegardes', 'correctifs', 'activite-1']);
    expect(matrice.activites[2].libelle).toBe('Revue fictive');
    expect(controle.map((c: { activite: string; ecarts: string[] }) => [c.activite, c.ecarts])).toEqual([
      ['sauvegardes', []],
      ['correctifs', ['plusieurs_a', 'aucun_r']],
      ['activite-1', ['aucun_a', 'aucun_r']],
    ]);
  });
  it('version périmée : 412 avec la version courante, rien n’est écrit', async () => {
    const r = await admin.put(url(fournisseur), modele(), im(1));
    expect(r.statusCode).toBe(412);
    expect(r.json().current).toMatchObject({ version: 2 });
    expect((await lecteur.get(url(fournisseur))).json().matrice.version).toBe(2);
  });
  it('contrôle les bornes et la forme (422) : 60 activités, 15 acteurs, libellés, lettres, références, champs', async () => {
    const m = modele();
    const activites = Array.from({ length: 61 }, (_, i) => ({ id: `a-${i}`, libelle: `Activité fictive ${i}` }));
    const acteurs = Array.from({ length: 16 }, (_, i) => ({ id: `f-${i}`, libelle: `Fonction fictive ${i}` }));
    const cas = [
      { ...m, activites },
      { ...m, acteurs },
      { ...m, activites: [{ id: 'x', libelle: 'x'.repeat(201) }] },
      { ...m, activites: [{ id: 'x', libelle: '\u0000\u0007' }] },
      { ...m, activites: [{ id: 'X Y', libelle: 'Mauvais identifiant' }] },
      { ...m, acteurs: [{ id: 'fournisseur', libelle: 'Réservé' }] },
      { ...m, cases: [{ activite: 'correctifs', acteur: 'rssi', lettre: 'X' }] },
      { ...m, cases: [{ activite: 'inconnue', acteur: 'rssi', lettre: 'R' }] },
      { ...m, cases: [{ activite: 'correctifs', acteur: 'inconnu', lettre: 'R' }] },
      {
        ...m,
        cases: [
          { activite: 'correctifs', acteur: 'rssi', lettre: 'R' },
          { activite: 'correctifs', acteur: 'rssi', lettre: 'A' },
        ],
      },
      { ...m, note: 'champ inconnu' },
      { activites: m.activites },
    ];
    for (const corps of cas) {
      const r = await contributeur.put(url(fournisseur), corps, im(2));
      expect(r.statusCode, JSON.stringify(corps).slice(0, 120)).toBe(422);
    }
    // Aux bornes exactes : accepté.
    const juste = await contributeur.put(
      url(autre),
      { activites: activites.slice(0, 60), acteurs: acteurs.slice(0, 15), cases: [] },
      im(0),
    );
    expect(juste.statusCode, juste.body).toBe(200);
    expect((await lecteur.get(url(fournisseur))).json().matrice.version).toBe(2);
  });
  it('la base refuse aussi une forme invalide (contraintes de la migration 106)', async () => {
    const inserer = (activites: unknown, acteurs: unknown = [], cases: unknown = []) =>
      t.svc.db.q(
        'INSERT INTO fournisseurs_raci(fournisseur_id, activites, acteurs, cases, mise_a_jour_par) VALUES ($1,$2,$3,$4,$5)',
        ['SUP-TEST', JSON.stringify(activites), JSON.stringify(acteurs), JSON.stringify(cases), 'test'],
      );
    await expect(inserer({})).rejects.toThrow();
    await expect(inserer([{ id: 'a', libelle: 'Libellé\u0007fictif' }])).rejects.toThrow();
    await expect(inserer([{ id: 'a', libelle: '' }])).rejects.toThrow();
    await expect(inserer([{ id: 'A', libelle: 'Majuscule' }])).rejects.toThrow();
    await expect(inserer(Array.from({ length: 61 }, (_, i) => ({ id: `a-${i}`, libelle: 'x' })))).rejects.toThrow();
    await expect(
      inserer(
        [],
        Array.from({ length: 16 }, (_, i) => ({ id: `f-${i}`, libelle: 'x' })),
      ),
    ).rejects.toThrow();
    await expect(inserer([], [], [{ activite: 'a', acteur: 'b', lettre: 'Z' }])).rejects.toThrow();
    expect(await t.svc.db.one("SELECT 1 FROM fournisseurs_raci WHERE fournisseur_id='SUP-TEST'")).toBeFalsy();
  });
  it('journalise le fournisseur et les nombres de lignes et de colonnes, rien d’autre', async () => {
    const crees = await lignesAudit('supplier.raci.created');
    expect(crees).toEqual([
      { target: `legacy:suppliers:${fournisseur}`, details: { lignes: 7, colonnes: 4 } },
      { target: `legacy:suppliers:${autre}`, details: { lignes: 60, colonnes: 16 } },
    ]);
    expect(await lignesAudit('supplier.raci.updated')).toEqual([
      { target: `legacy:suppliers:${fournisseur}`, details: { lignes: 3, colonnes: 5 } },
    ]);
    const tout = JSON.stringify(await t.svc.db.q("SELECT details FROM audit_log WHERE action LIKE 'supplier.raci.%'"));
    expect(tout).not.toContain('Revue fictive');
    expect(tout).not.toContain('Délégué fictif');
  });
});

describe('suppression', () => {
  it('exige le droit « supprimer » (le contributeur ne l’a pas), If-Match et la version courante', async () => {
    expect((await contributeur.del(url(fournisseur), im(2))).statusCode).toBe(403);
    expect((await admin.del(url(fournisseur))).statusCode).toBe(428);
    expect((await admin.del(url(fournisseur), im(1))).statusCode).toBe(412);
    const r = await admin.del(url(fournisseur), im(2));
    expect(r.statusCode, r.body).toBe(204);
    expect((await lecteur.get(url(fournisseur))).json()).toEqual({ matrice: null, controle: [] });
    expect((await admin.del(url(fournisseur), im(2))).statusCode).toBe(404);
    expect(await lignesAudit('supplier.raci.deleted')).toEqual([
      { target: `legacy:suppliers:${fournisseur}`, details: { lignes: 3, colonnes: 5 } },
    ]);
    // Recréée ensuite à partir du modèle : version 1.
    expect((await contributeur.put(url(fournisseur), modele(), im(0))).json().matrice.version).toBe(1);
  });
});

describe('fournisseur retiré du registre', () => {
  it('matrice ignorée (404), signalée par le contrôle des relations, effacée si l’identifiant est réattribué', async () => {
    expect((await lecteur.get(url(autre))).json().matrice.version).toBe(1);
    await t.svc.db.tx(async (c) => {
      await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
      const st = (await t.svc.legacy.recompose(c))!;
      const restants = (st.data.suppliers as { id: string }[]).filter((s) => s.id !== autre);
      await t.svc.legacy.nativeWrite(c, { ...st.data, suppliers: restants }, { username: 'test' } as never, st.version);
    }, 'test');
    expect((await lecteur.get(url(autre))).statusCode).toBe(404);
    expect((await contributeur.put(url(autre), modele(), im(1))).statusCode).toBe(404);
    const relations = await controleRelations(t.svc);
    expect(relations.ok).toBe(false);
    expect(relations.controles.flatMap((c) => c.anomalies)).toContain(
      `matrice RACI : fournisseur absent du registre ${autre}`,
    );
    // Le dernier identifiant est réattribué au fournisseur suivant : la matrice de l'ancien ne lui passe pas.
    const nouveau = await admin.post('/api/suppliers', { name: 'Nouveau fournisseur fictif' });
    expect(nouveau.json().id).toBe(autre);
    expect((await lecteur.get(url(autre))).json()).toEqual({ matrice: null, controle: [] });
    expect(await lignesAudit('supplier.raci.orphan_deleted')).toEqual([
      { target: `legacy:suppliers:${autre}`, details: { lignes: 60, colonnes: 16 } },
    ]);
    expect((await controleRelations(t.svc)).ok).toBe(true);
  });
  it('une matrice orpheline se supprime avec le droit « supprimer »', async () => {
    await t.svc.db.q(
      `INSERT INTO fournisseurs_raci(fournisseur_id, activites, acteurs, cases, mise_a_jour_par)
       VALUES ('SUP-ORPHELIN', '[]', '[]', '[]', 'test')`,
    );
    expect((await lecteur.get(url('SUP-ORPHELIN'))).statusCode).toBe(404);
    expect((await admin.del(url('SUP-ORPHELIN'), im(1))).statusCode).toBe(204);
    expect(await t.svc.db.one("SELECT 1 FROM fournisseurs_raci WHERE fournisseur_id='SUP-ORPHELIN'")).toBeFalsy();
  });
});

describe('remise à vide', () => {
  it('classe la table avec les données de travail, effacée par les deux portées', () => {
    expect(TABLES_TRAVAIL).toContain('fournisseurs_raci');
    expect(tablesAVider('travail')).toContain('fournisseurs_raci');
    expect(tablesAVider('tout')).toContain('fournisseurs_raci');
  });
  it('la portée « travail » efface les matrices', async () => {
    expect(Number((await t.svc.db.one<{ n: string }>('SELECT count(*)::text AS n FROM fournisseurs_raci'))!.n)).toBe(1);
    await t.svc.remiseAVide.definirAutorisation(true, { id: adminUser.id, username: adminUser.username }, '127.0.0.1');
    await t.svc.db.q('DELETE FROM backup_jobs');
    await t.svc.db.q(
      "INSERT INTO backup_jobs(request_id, status, requested_by, finished_at) VALUES ($1,'reussie','test', now() - interval '1 minute')",
      [randomUUID()],
    );
    t.svc.limits.updateMfaByUser.reset();
    await t.svc.db.q('UPDATE users SET totp_last_step=0 WHERE id=$1', [adminUser.id]);
    const a = await login(t, adminUser);
    await t.svc.db.q('UPDATE users SET totp_last_step=0 WHERE id=$1', [adminUser.id]);
    const r = await a.post('/api/admin/remise-a-vide', {
      requestId: randomUUID(),
      portee: 'travail',
      confirm: REMISE_A_VIDE_PHRASES.travail,
      code: hotp(adminUser.key, Math.floor(Date.now() / 30000)),
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(Number((await t.svc.db.one<{ n: string }>('SELECT count(*)::text AS n FROM fournisseurs_raci'))!.n)).toBe(0);
  }, 60_000);
});
