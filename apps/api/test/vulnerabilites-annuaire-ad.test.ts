/* Module Vulnérabilités (ADR 0100, lot AD-1) : import du rapport de l'Active Directory (service ADS de l'ANSSI, collecte
   ORADAD) et page « Active Directory ». Migration 099 ; noms d'un point par une route à part, avec la lecture du module
   (droit « Analyste », décision du RSSI du 20/11/2026 ; la page ne rend jamais de nom ; sans accès au module : 403) ;
   consultation des noms tracée au journal sans les noms ; purge des noms au troisième import (deux derniers seulement) ; suppression d'un import (If-Match) ; limite horaire partagée avec les
   imports Nessus et Silène ; charge utile hors liste blanche refusée ; aucun nom dans le journal d'audit ni dans la
   recherche du module. Données entièrement fictives (comptes « compte-fictif-NN », domaine exemple.invalid). */
import { ADS_BORNES, ALL_PERMISSIONS } from '@suivi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const A = '/api/vulnerabilites/annuaire';
let t: TestApp;
let admin: Agent, lecteur: Agent, sansModule: Agent, rssi: Agent;
let depuis = '0';

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const ECARTS = {
  nomsAuDela: 0,
  nomsIllisibles: 1,
  identifiantsSeuls: 1,
  nomsRaccourcis: 0,
  nomsEnDouble: 0,
  titresRaccourcis: 0,
};
type Nom = { nom: string; nature: string };
const point = (identifiant: string, type: 1 | 2 | 3, niveau: number, noms: Nom[], objets = noms.length) => ({
  identifiant,
  reference: identifiant.replace(/^[a-z]+[1-5]_/, ''),
  type,
  niveau,
  titre: `Point de contrôle fictif ${identifiant}`,
  objets,
  noms,
});
const u = (n: string): Nom => ({ nom: n, nature: 'utilisateur' });
const rapport = (note: number, date: string) => ({
  date,
  note,
  progression: [
    { niveau: 1, conformes: 10, total: 12, pourcentage: null },
    { niveau: 2, conformes: null, total: null, pourcentage: 62.5 },
  ],
  conformes: 120,
});
const corps = (note: number, date: string, points: unknown[]) => ({
  rapport: rapport(note, date),
  points,
  ecartes: ECARTS,
});

/** Trois imports successifs du même annuaire fictif. */
const PREMIER = [
  point('vuln1_fictif_admins', 3, 1, [u('compte-fictif-01'), u('compte-fictif-02')]),
  point('warn3_fictif_inactifs', 2, 3, [u('compte-fictif-03')], 5),
];
const SECOND = [
  // compte-fictif-02 corrigé, compte-fictif-04 apparu ; le second point est corrigé ; un point apparaît.
  point('vuln1_fictif_admins', 3, 1, [u('compte-fictif-01'), u('compte-fictif-04')], 3),
  point('info2_fictif_gpo', 1, 2, [
    { nom: 'gpo-fictive-01', nature: 'gpo' },
    { nom: 'srv-fictif-01$', nature: 'ordinateur' },
  ]),
];
const TROISIEME = [point('vuln1_fictif_admins', 3, 1, [u('compte-fictif-01')])];
const TOUS_LES_NOMS = ['compte-fictif-0', 'gpo-fictive-01', 'srv-fictif-01'];

const importer = async (note: number, date: string, points: unknown[], qui: Agent = admin) => {
  const r = await qui.post(`${A}/imports`, corps(note, date, points));
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; numero: number; points: number; objets: number; noms: number; nomsPurges: number };
};
const audits = async (prefixe: string) =>
  (
    await t.svc.db.q<{ username: string; action: string; target: string; details: Record<string, unknown> }>(
      "SELECT username, action, target, details FROM audit_log WHERE action LIKE $1 || '%' AND id > $2::bigint ORDER BY id",
      [prefixe, depuis],
    )
  ).rows;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ad_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_ad_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_ad_autre', 'Audit, lecture', ARRAY['audit:lire'])`,
  );
  lecteur = await login(t, await makeUser(t, 'ad_lecteur', 'r_ad_lire'));
  sansModule = await login(t, await makeUser(t, 'ad_sans_module', 'r_ad_autre'));
  rssi = await login(t, await makeUser(t, 'ad_rssi', 'rssi'));
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  await t.svc.db.q('DELETE FROM vulnerabilites_ad_imports');
  // Journal d'audit en ajout seul : chaque test ne lit que les entrées écrites depuis son début.
  depuis = (await t.svc.db.one<{ n: string }>('SELECT coalesce(max(id), 0)::text AS n FROM audit_log'))!.n;
  t.svc.limits.importNessus.reset();
});

describe('migration 099, aucun droit nouveau', () => {
  it('tables créées ; contraintes : ni SID, ni chemin LDAP, ni « domaine\\nom », nature et type fermés', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '099_vulnerabilites_annuaire_ad.sql'"))
        ?.ok,
    ).toBe(1);
    const { id } = await importer(3, '2026-11-01', PREMIER);
    const p = (await t.svc.db.one<{ id: string }>(
      'SELECT id FROM vulnerabilites_ad_points WHERE import_id = $1 LIMIT 1',
      [id],
    ))!.id;
    const ins = (nom: string, nature = 'utilisateur') =>
      t.svc.db.q('INSERT INTO vulnerabilites_ad_objets (point_id, rang, nom, nature) VALUES ($1, 150, $2, $3)', [
        p,
        nom,
        nature,
      ]);
    await expect(ins('S-1-5-21-1000-2000-3000-1104')).rejects.toThrow(/check/);
    await expect(ins('CN=compte-fictif-09,OU=Comptes,DC=exemple,DC=invalid')).rejects.toThrow(/check/);
    await expect(ins('EXEMPLE\\compte-fictif-09')).rejects.toThrow(/check/);
    await expect(ins('x'.repeat(65))).rejects.toThrow(/check/);
    await expect(ins('compte-fictif-09', 'mot_de_passe')).rejects.toThrow(/check/);
    await expect(t.svc.db.q('UPDATE vulnerabilites_ad_points SET type = 4 WHERE import_id = $1', [id])).rejects.toThrow(
      /check/,
    );
  });

  it('aucun droit à part pour les noms : ils relèvent de la lecture du module (droit « Analyste »)', () => {
    expect(ALL_PERMISSIONS.some((p) => p.includes('annuaire'))).toBe(false);
    expect(ALL_PERMISSIONS).toContain('vulnerabilites:lire');
  });
});

describe('lecture en nombres, noms par une route à part', () => {
  it('la page ne rend que des nombres ; les noms d’un point se lisent avec la lecture du module, à part', async () => {
    await importer(3, '2026-11-01', PREMIER);
    await importer(4, '2026-11-15', SECOND);
    for (const qui of [lecteur, rssi, admin]) {
      const r = await qui.get(A);
      expect(r.statusCode, r.body).toBe(200);
      // Aucun nom, pour personne : la réponse de la page ne les contient jamais.
      for (const n of TOUS_LES_NOMS) expect(r.body.includes(n), n).toBe(false);
    }
    const page = (await lecteur.get(A)).json();
    expect(page).not.toHaveProperty('peutLireNoms');
    expect(page.courant).toMatchObject({ numero: 2, note: 4, dateRapport: '2026-11-15', points: 2, objets: 5 });
    expect(page.precedent).toMatchObject({ numero: 1, note: 3 });
    expect(page.courant.progression).toEqual(rapport(4, '2026-11-15').progression);
    expect(page.points).toEqual([
      expect.objectContaining({ identifiant: 'vuln1_fictif_admins', objets: 3, objetsAvant: 2, apparu: false }),
      expect.objectContaining({ identifiant: 'info2_fictif_gpo', type: 1, niveau: 2, objetsAvant: null, apparu: true }),
    ]);
    expect(page.corriges).toEqual([expect.objectContaining({ identifiant: 'warn3_fictif_inactifs', objets: 5 })]);

    // Sans accès au module : 403 sur la page et sur les noms, et rien des noms dans la réponse.
    for (const url of [A, `${A}/points/vuln1_fictif_admins/noms`]) {
      const refus = await sansModule.get(url);
      expect(refus.statusCode, url).toBe(403);
      for (const n of TOUS_LES_NOMS) expect(refus.body.includes(n), n).toBe(false);
    }
    // Module désactivé : refusé aussi.
    await t.svc.db.q("UPDATE module_activation SET disabled='{vulnerabilites}', version=version+1 WHERE id=1");
    expect((await lecteur.get(`${A}/points/vuln1_fictif_admins/noms`)).statusCode).toBe(409);
    await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");

    // Lecteur du module : noms du dernier import, apparus et corrigés depuis le précédent.
    const r = await lecteur.get(`${A}/points/vuln1_fictif_admins/noms`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({
      identifiant: 'vuln1_fictif_admins',
      titre: 'Point de contrôle fictif vuln1_fictif_admins',
      numero: 2,
      noms: [u('compte-fictif-01'), u('compte-fictif-04')],
      sansNom: 1,
      comparaison: { numero: 1, apparus: [u('compte-fictif-04')], corriges: [u('compte-fictif-02')], complete: false },
    });
    // Point corrigé : ses noms d'avant, tous « corrigés ».
    const c = (await rssi.get(`${A}/points/warn3_fictif_inactifs/noms`)).json();
    expect(c).toMatchObject({ noms: [], sansNom: 0, comparaison: { corriges: [u('compte-fictif-03')], apparus: [] } });
    expect((await lecteur.get(`${A}/points/vuln9_inconnu/noms`)).statusCode).toBe(404);
  });

  it('chaque consultation des noms est tracée (qui, quel point), sans aucun nom', async () => {
    await importer(3, '2026-11-01', PREMIER);
    await lecteur.get(`${A}/points/vuln1_fictif_admins/noms`);
    await rssi.get(`${A}/points/warn3_fictif_inactifs/noms`);
    const j = await audits('vulnerabilites.annuaire.noms.consultes');
    expect(j.map((x) => [x.username, x.details.point])).toEqual([
      ['ad_lecteur', 'vuln1_fictif_admins'],
      ['ad_rssi', 'warn3_fictif_inactifs'],
    ]);
    expect(j[0]!.details).toMatchObject({ numero: 1, noms: 2 });
    const texte = JSON.stringify(await audits('vulnerabilites.annuaire.'));
    for (const n of TOUS_LES_NOMS) expect(texte.includes(n), n).toBe(false);
  });
});

describe('conservation limitée, suppression, limite', () => {
  it('troisième import : les noms du premier sont effacés, ses nombres restent', async () => {
    const un = await importer(3, '2026-11-01', PREMIER);
    expect(un.nomsPurges).toBe(0);
    await importer(4, '2026-11-15', SECOND);
    const trois = await importer(5, '2026-11-20', TROISIEME);
    expect(trois).toMatchObject({ numero: 3, points: 1, objets: 1, noms: 1, nomsPurges: 1 });
    const { rows } = await t.svc.db.q<{ numero: number; noms_conserves: boolean; noms: number; points: number }>(
      `SELECT i.numero, i.noms_conserves, i.points,
              (SELECT count(*)::int FROM vulnerabilites_ad_objets o JOIN vulnerabilites_ad_points p ON p.id = o.point_id
                WHERE p.import_id = i.id) AS noms
         FROM vulnerabilites_ad_imports i ORDER BY numero`,
    );
    expect(rows).toEqual([
      { numero: 1, noms_conserves: false, points: 2, noms: 0 },
      { numero: 2, noms_conserves: true, points: 2, noms: 4 },
      { numero: 3, noms_conserves: true, points: 1, noms: 1 },
    ]);
    const page = (await admin.get(A)).json();
    expect(page.historique.map((h: { note: number; nomsConserves: boolean }) => [h.note, h.nomsConserves])).toEqual([
      [5, true],
      [4, true],
      [3, false],
    ]);
    expect(page.points[0]).toMatchObject({ identifiant: 'vuln1_fictif_admins', objets: 1, objetsAvant: 3 });
    expect((await admin.get(`${A}/points/vuln1_fictif_admins/noms`)).json().comparaison).toMatchObject({
      numero: 2,
      corriges: [u('compte-fictif-04')],
      apparus: [],
    });
  });

  it('suppression d’un import (administrer, If-Match) : noms et nombres effacés ; journal en nombres', async () => {
    await importer(3, '2026-11-01', PREMIER);
    const deux = await importer(4, '2026-11-15', SECOND);
    expect((await lecteur.del(`${A}/imports/${deux.id}`, ifMatch(1))).statusCode).toBe(403);
    expect((await admin.del(`${A}/imports/${deux.id}`)).statusCode).toBe(428);
    expect((await admin.del(`${A}/imports/${deux.id}`, ifMatch(2))).statusCode).toBe(412);
    const d = await admin.del(`${A}/imports/${deux.id}`, ifMatch(1));
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json()).toEqual({ points: 2, noms: 4 });
    expect(
      (await t.svc.db.one<{ n: number }>(
        'SELECT count(*)::int AS n FROM vulnerabilites_ad_points WHERE import_id = $1',
        [deux.id],
      ))!.n,
    ).toBe(0);
    const page = (await admin.get(A)).json();
    expect(page.courant).toMatchObject({ numero: 1 });
    expect(page.precedent).toBeNull();
    expect((await admin.del(`${A}/imports/${deux.id}`, ifMatch(1))).statusCode).toBe(404);
    const j = await audits('vulnerabilites.annuaire.import.supprime');
    expect(j).toHaveLength(1);
    expect(j[0]!.details).toEqual({ numero: 2, points: 2, objets: 5, noms: 4 });
  });

  it('import réservé à l’administration du module ; limite horaire partagée avec Nessus et Silène', async () => {
    expect((await lecteur.post(`${A}/imports`, corps(3, '2026-11-01', PREMIER))).statusCode).toBe(403);
    const id = (await t.svc.db.one<{ id: string }>("SELECT id FROM users WHERE username = 'ad_admin'"))!.id;
    for (let i = 0; i < ADS_BORNES.importsParHeure; i++) t.svc.limits.importNessus(id);
    const r = await admin.post(`${A}/imports`, corps(3, '2026-11-01', PREMIER));
    expect(r.statusCode).toBe(429);
    expect(r.json().error).toBe('Trop d’imports de fichiers commencés (30 par heure). Réessayez dans une heure.');
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_ad_imports'))!.n).toBe(0);
  });
});

describe('liste blanche revalidée par l’API', () => {
  it('champ en trop, SID, chemin LDAP, borne dépassée, type hors liste : 422, rien n’est rangé', async () => {
    const refuse = async (b: unknown) => {
      const r = await admin.post(`${A}/imports`, b);
      expect(r.statusCode, r.body).toBe(422);
      for (const n of TOUS_LES_NOMS) expect(r.body.includes(n), n).toBe(false);
    };
    await refuse({ ...corps(3, '2026-11-01', PREMIER), domaine: 'exemple.invalid' });
    await refuse(corps(3, '2026-11-01', [{ ...PREMIER[0], motDePasse: 'interdit' }]));
    await refuse(
      corps(3, '2026-11-01', [
        point('vuln1_x', 3, 1, [{ nom: 'compte-fictif-01', nature: 'utilisateur', sid: 'S-1-5' } as Nom]),
      ]),
    );
    await refuse(corps(3, '2026-11-01', [point('vuln1_x', 3, 1, [u('S-1-5-21-1000-2000-3000-1104')])]));
    await refuse(corps(3, '2026-11-01', [point('vuln1_x', 3, 1, [u('CN=compte-fictif-01,DC=exemple,DC=invalid')])]));
    await refuse(corps(3, '2026-11-01', [point('vuln1_x', 3, 1, [u('EXEMPLE\\compte-fictif-01')])]));
    await refuse(corps(3, '2026-11-01', [point('vuln1_x', 4 as 3, 1, [])]));
    await refuse(corps(6, '2026-11-01', []));
    await refuse(corps(3, '2026-11-01', [point('vuln1_x', 3, 1, [u('compte-fictif-01')], 0)]));
    const trop = Array.from({ length: ADS_BORNES.nomsParPoint + 1 }, (_, i) => u(`compte-fictif-${i}`));
    await refuse(corps(3, '2026-11-01', [point('vuln1_x', 3, 1, trop)]));
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_ad_imports'))!.n).toBe(0);
  });
});

describe('aucun nom hors de la page', () => {
  it('ni le journal d’audit ni la recherche du module ne contiennent un nom d’objet', async () => {
    await importer(3, '2026-11-01', PREMIER);
    await importer(4, '2026-11-15', SECOND);
    await admin.get(`${A}/points/vuln1_fictif_admins/noms`);
    const { rows } = await t.svc.db.q<{ texte: string }>('SELECT details::text || target AS texte FROM audit_log');
    const journal = rows.map((r) => r.texte).join('\n');
    for (const n of TOUS_LES_NOMS) expect(journal.includes(n), n).toBe(false);
    for (const q of ['compte-fictif-01', 'compte-fictif', 'gpo-fictive-01', 'srv-fictif-01']) {
      const r = await admin.get(`/api/vulnerabilites/recherche?q=${encodeURIComponent(q)}`);
      expect(r.statusCode, r.body).toBe(200);
      // La réponse rappelle la saisie (« q ») ; aucun résultat ne doit porter un nom de l'annuaire.
      const { q: saisie, ...resultats } = r.json() as { q: string } & Record<string, unknown>;
      expect(saisie).toBe(q);
      const texte = JSON.stringify(resultats);
      for (const n of TOUS_LES_NOMS) expect(texte.includes(n), `${q} → ${n}`).toBe(false);
      for (const g of ['cves', 'machines', 'actifs', 'produits', 'technologies', 'controles'])
        expect(JSON.stringify(resultats[g]).includes('fictif'), `${q} → ${g}`).toBe(false);
    }
  });
});
