/* Module Vulnérabilités (ADR 0100, lot V4a) : rapprochement par version (V21), produit relié à la main aux machines (V20),
   priorité calculée par la plateforme et rang d'une machine. Migration 076 sur base vierge ; produits touchés de NVD reçus
   par la veille et remplacés à chaque collecte ; version obligatoire ; rapprochement rattaché d'office, écarté, proposé
   (nom seulement, aucune plage publiée, version non comparable, liste tronquée) ; rejet non reproposé à données égales ;
   confirmation remise en jeu au changement de version ; recalcul après une collecte NVD ; décisions (droits, If-Match,
   journal) ; suggestions d'identifiant tirées des données rangées ; lien produit-machine et droits du périmètre ; mention
   « déclaré » et dédoublonnage avec une détection de Tenable ; priorité et seuil réglé ; rang (ordre, faits, machines non
   lisibles exclues). Données entièrement fictives : noms en .invalid, adresses de 192.0.2.0/24, CVE fictives ; aucun
   service n'est joint. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

/** Délais de correction par défaut (lot S1), rangés avec le seuil EPSS. */
const DELAIS = {
  P1: { duree: 48, unite: 'heures' },
  P2: { duree: 15, unite: 'jours' },
  P3: { duree: 90, unite: 'jours' },
  P4: null,
};

const V = '/api/vulnerabilites';
const SYSTEME = { username: 'test' };
const CPE_GF = 'cpe:2.3:a:editeur_fictif:gestionnaire_fictif:*:*:*:*:*:*:*:*';
let t: TestApp;
let admin: Agent, rssi: Agent, lecteurA: Agent, editeurA: Agent;
let perimA: string, perimB: string, instance: string;
let m1: string, m2: string, m3: string;
let p1: { id: string; version: number }, p2: { id: string; version: number };

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const touche = (extra: Record<string, unknown> = {}) => ({
  partie: 'a',
  editeur: 'editeur_fictif',
  produit: 'gestionnaire_fictif',
  version: null,
  debutInclus: null,
  debutExclus: null,
  finInclus: null,
  finExclus: null,
  vulnerable: true,
  ...extra,
});
const nvd = (cve: string, touches: unknown[], extra: Record<string, unknown> = {}) => ({
  cve,
  publieLe: '2026-06-26T15:16:40.587Z',
  modifieLe: '2026-11-14T19:16:50.940Z',
  description: 'Fictional NVD description.',
  cvss31: { score: 9.3, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:L', gravite: 'CRITICAL' },
  cvss40: null,
  editeurs: ['editeur_fictif'],
  produits: ['gestionnaire_fictif'],
  produitsTouches: touches,
  produitsTronques: false,
  ...extra,
});
/** Jeu NVD de référence : sept CVE fictives autour du « gestionnaire fictif ». */
const jeu = (fin91001 = '10.1.5', extra91003: Record<string, unknown> = {}) => [
  nvd('CVE-2026-91001', [touche({ finExclus: fin91001 })]),
  nvd('CVE-2026-91002', [touche({ debutInclus: '10.2.0', finExclus: '10.4.0' })], {
    cvss31: { score: 7.5, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N', gravite: 'HIGH' },
  }),
  nvd('CVE-2026-91003', [touche(extra91003)]),
  nvd('CVE-2026-91004', [touche({ finExclus: '10.1.5-rc1' })]),
  nvd('CVE-2026-91005', [touche({ finExclus: '9.0' })], { produitsTronques: true }),
  nvd('CVE-2026-91006', [touche({ editeur: 'autre_editeur', produit: 'autre_produit', finExclus: '99' })]),
  nvd('CVE-2026-91007', [touche({ finExclus: '10.1.5', vulnerable: false })]),
];
const kev = (cve: string) => ({
  cve,
  editeur: 'Éditeur fictif',
  produit: 'Gestionnaire fictif',
  nom: 'Faille fictive',
  description: 'Fictional description.',
  action: 'Apply updates.',
  ajoutLe: '2026-11-13',
  echeance: '2026-12-04',
  rancongiciel: false,
});
const bilan = (elements: number) => ({
  ok: true,
  bilan: { elements, ecartes: 0, tronque: false, detailsEchoues: 0 },
  erreur: null,
});
const n = async (table: string, where = 'true', p: unknown[] = []) =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, p))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
/** Une collecte de la source par le service (réclamée, lot rangé, terminée) : comme l'exécutant. */
async function collecte(source: string, elements: unknown[]) {
  await t.svc.db.q(
    "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ($1, 'manuel', 'test')",
    [source],
  );
  const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
  expect(job.source).toBe(source);
  if (elements.length) await t.svc.vulnerabilites.veille.lot(job.id as string, { elements });
  await t.svc.vulnerabilites.veille.terminer(job.id as string, bilan(elements.length));
}
type Rapp = { id: string; cve: string; statut: string; motif: string | null; versionDansPlage: string | null };
const fiche = async (a: Agent, id: string) => {
  const r = await a.get(`${V}/produits/${id}/fiche`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as {
    produit: { version: number; suivi: { rattachees: number; aDecider: number } };
    machines: { id: string; nom: string }[];
    compteurs: Record<string, number>;
    rapprochements: (Rapp & { version: number; priorite: { niveau: string; faits: unknown[] }; note: string })[];
  };
};
const statuts = async (id: string) =>
  Object.fromEntries((await fiche(admin, id)).rapprochements.map((r) => [r.cve, r.statut]));
const rapp = async (id: string, cve: string) => (await fiche(admin, id)).rapprochements.find((r) => r.cve === cve)!;
const versionProduit = async (id: string) => (await admin.get(`${V}/produits/${id}`)).json().version as number;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'rapp_admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'rapp_rssi', 'rssi'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_rp_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_rp_modif', 'Vulnérabilités, modification', ARRAY['vulnerabilites:lire','vulnerabilites:modifier'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uLecteurA = await makeUser(t, 'rapp_lecteur_a', 'r_rp_lire', { rattache: false });
  const uEditeurA = await makeUser(t, 'rapp_editeur_a', 'r_rp_modif', { rattache: false });
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false), ($1, $3, true)', [
    perimA,
    uLecteurA.id,
    uEditeurA.id,
  ]);
  lecteurA = await login(t, uLecteurA);
  editeurA = await login(t, uEditeurA);
  // Instance Tenable fictive (aucun appel) et trois machines : m1 front (A), m2 base de données (B), m3 sans périmètre.
  instance = (await t.svc.db.one<{ id: string }>(
    "INSERT INTO integrations (type, nom, created_by, updated_by) VALUES ('tenable', 'Tenable fictif', 'test', 'test') RETURNING id",
  ))!.id;
  await t.svc.db.q(
    'INSERT INTO vulnerabilites_tenable_etat (integration_id, numero, numero_complet) VALUES ($1, 1, 1)',
    [instance],
  );
  const machine = async (k: number, role: string | null, perimetre: string | null) =>
    (await t.svc.db.one<{ id: string }>(
      `INSERT INTO vulnerabilites_machines (integration_id, identifiant_source, nom, adresse, role, perimetre_id, vu_numero)
       VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING id`,
      [instance, `ip:192.0.2.${20 + k}`, `srv-rapp-${k}.exemple.invalid`, `192.0.2.${20 + k}`, role, perimetre],
    ))!.id;
  m1 = await machine(1, 'front', perimA);
  m2 = await machine(2, 'bdd', perimB);
  m3 = await machine(3, null, null);
  await t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('migration 076 sur base vierge', () => {
  it('crée les tables vides et borne les données en base', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '076_vulnerabilites_rapprochement.sql'"))
        ?.ok,
    ).toBe(1);
    for (const table of [
      'vulnerabilites_veille_cve_produits',
      'vulnerabilites_produits_machines',
      'vulnerabilites_rapprochements',
    ])
      expect(await n(table)).toBe(0);
    await t.svc.db.q("INSERT INTO vulnerabilites_veille_cve (cve) VALUES ('CVE-2026-99999')");
    const tp = `INSERT INTO vulnerabilites_veille_cve_produits (cve, rang, partie, editeur, produit, editeur_norm, produit_norm,
      debut_inclus, debut_exclus, vulnerable) VALUES ('CVE-2026-99999', $1, $2, 'e', 'p', 'e', 'p', $3, $4, true)`;
    await expect(t.svc.db.q(tp, [0, 'a', '1.0', '1.1'])).rejects.toThrow();
    await expect(t.svc.db.q(tp, [0, 'x', null, null])).rejects.toThrow();
    await expect(t.svc.db.q(tp, [20, 'a', null, null])).rejects.toThrow();
    await t.svc.db.q(tp, [0, 'a', '1.0', null]);
    const pid = (await t.svc.db.one<{ id: string }>(
      `INSERT INTO vulnerabilites_produits (editeur, nom, version_produit, famille, criticite, created_by, updated_by)
       VALUES ('E', 'P', '1', 'web', 'faible', 't', 't') RETURNING id`,
    ))!.id;
    const h = 'a'.repeat(64);
    const rp = `INSERT INTO vulnerabilites_rapprochements (produit_id, cve, statut, motif, par_identifiant, empreinte_produit,
      empreinte_cve, decide_par, decide_le, version_decidee) VALUES ($1, 'CVE-2026-99999', $2, $3, false, $4, $4, $5, $6, $7)`;
    await expect(t.svc.db.q(rp, [pid, 'inconnu', null, h, null, null, null])).rejects.toThrow();
    await expect(t.svc.db.q(rp, [pid, 'proposee', null, h, null, null, null])).rejects.toThrow();
    await expect(t.svc.db.q(rp, [pid, 'confirmee', 'sans_plage', h, null, null, null])).rejects.toThrow();
    await expect(t.svc.db.q(rp, [pid, 'rattachee', null, 'xyz', null, null, null])).rejects.toThrow();
    await expect(t.svc.db.q(rp, [pid, 'confirmee', null, h, 'x', new Date(), null])).rejects.toThrow();
    await t.svc.db.q(rp, [pid, 'confirmee', null, h, 'x', new Date(), '1']);
    await t.svc.db.q('DELETE FROM vulnerabilites_produits WHERE id = $1', [pid]);
    expect(await n('vulnerabilites_rapprochements')).toBe(0);
    await t.svc.db.q("DELETE FROM vulnerabilites_veille_cve WHERE cve = 'CVE-2026-99999'");
    expect(await n('vulnerabilites_veille_cve_produits')).toBe(0);
  });
});

describe('version obligatoire (V21)', () => {
  it('création et modification refusent une version absente ou vide', async () => {
    const corps = { editeur: 'Éditeur fictif', nom: 'Produit sans version', famille: 'web', criticite: 'faible' };
    expect((await admin.post(`${V}/produits`, corps)).statusCode).toBe(422);
    expect((await admin.post(`${V}/produits`, { ...corps, versionProduit: '   ' })).statusCode).toBe(422);
    const ok = await admin.post(`${V}/produits`, { ...corps, versionProduit: '2.0' });
    expect(ok.statusCode, ok.body).toBe(201);
    expect(ok.json().suivi).toEqual({ rattachees: 0, aDecider: 0 });
    const r = await admin.patch(`${V}/produits/${ok.json().id}`, { versionProduit: '' }, ifMatch(ok.json().version));
    expect(r.statusCode).toBe(422);
    await admin.del(`${V}/produits/${ok.json().id}`, ifMatch(ok.json().version));
  });
});

describe('veille NVD : produits touchés et leur plage', () => {
  it('rangés par CVE dans l’ordre reçu, remplacés à chaque collecte ; une forme incohérente fait refuser le lot', async () => {
    // Produit tampon, sans rapport avec ceux des tests suivants.
    const tampon = (extra: Record<string, unknown>) =>
      touche({ editeur: 'editeur_tampon', produit: 'Produit-Tampon', ...extra });
    await collecte('nvd', [
      nvd('CVE-2026-92001', [tampon({ debutInclus: '1.0', finExclus: '1.4' }), tampon({ version: '2.0' })], {
        produitsTronques: true,
      }),
    ]);
    const lignes = (
      await t.svc.db.q<{ rang: number; version: string | null; debut_inclus: string | null; produit_norm: string }>(
        "SELECT rang, version, debut_inclus, produit_norm FROM vulnerabilites_veille_cve_produits WHERE cve = 'CVE-2026-92001' ORDER BY rang",
      )
    ).rows;
    expect(lignes).toEqual([
      { rang: 0, version: null, debut_inclus: '1.0', produit_norm: 'produit_tampon' },
      { rang: 1, version: '2.0', debut_inclus: null, produit_norm: 'produit_tampon' },
    ]);
    expect(
      (await t.svc.db.one<{ t: boolean }>(
        "SELECT produits_tronques AS t FROM vulnerabilites_veille_cve WHERE cve = 'CVE-2026-92001'",
      ))!.t,
    ).toBe(true);
    await collecte('nvd', [nvd('CVE-2026-92001', [tampon({ finInclus: '3.0' })])]);
    expect(await n('vulnerabilites_veille_cve_produits', "cve = 'CVE-2026-92001'")).toBe(1);
    expect(
      (await t.svc.db.one<{ t: boolean }>(
        "SELECT produits_tronques AS t FROM vulnerabilites_veille_cve WHERE cve = 'CVE-2026-92001'",
      ))!.t,
    ).toBe(false);
    // Deux bornes de début, partie inconnue, plus de vingt produits : tout le lot est refusé.
    for (const mauvais of [
      nvd('CVE-2026-92002', [touche({ debutInclus: '1', debutExclus: '1' })]),
      nvd('CVE-2026-92002', [touche({ partie: 'x' })]),
      nvd('CVE-2026-92002', [touche({ finExclus: '<script>' })]),
      nvd(
        'CVE-2026-92002',
        Array.from({ length: 21 }, (_, i) => touche({ version: `1.${i}` })),
      ),
    ]) {
      await t.svc.db.q(
        "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('nvd', 'manuel', 'test')",
      );
      const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
      await expect(t.svc.vulnerabilites.veille.lot(job.id as string, { elements: [mauvais] })).rejects.toThrow(
        /refusé/,
      );
      await t.svc.vulnerabilites.veille.terminer(job.id as string, { ok: false, bilan: null, erreur: 'Lot refusé.' });
    }
    expect(await n('vulnerabilites_veille_cve', "cve = 'CVE-2026-92002'")).toBe(0);
  });
});

describe('rapprochement par version (point 8, V21)', () => {
  it('à la création : rattachée d’office, écartée, proposée pour chaque motif ; ni CVE sans rapport ni condition de plateforme', async () => {
    await collecte('nvd', jeu());
    const r1 = await rssi.post(`${V}/produits`, {
      editeur: 'Éditeur fictif',
      nom: 'Gestionnaire fictif',
      versionProduit: '10.1.2',
      cpe: CPE_GF,
      famille: 'applications_metier',
      criticite: 'elevee',
    });
    expect(r1.statusCode, r1.body).toBe(201);
    p1 = r1.json();
    expect(r1.json().suivi).toEqual({ rattachees: 1, aDecider: 3 });
    const f = await fiche(admin, p1.id);
    const par = Object.fromEntries(f.rapprochements.map((r) => [r.cve, r]));
    expect(Object.keys(par).sort()).toEqual([
      'CVE-2026-91001',
      'CVE-2026-91002',
      'CVE-2026-91003',
      'CVE-2026-91004',
      'CVE-2026-91005',
    ]);
    expect(par['CVE-2026-91001']).toMatchObject({ statut: 'rattachee', motif: null });
    expect(par['CVE-2026-91002']).toMatchObject({ statut: 'ecartee', motif: null });
    expect(par['CVE-2026-91003']).toMatchObject({
      statut: 'proposee',
      motif: 'sans_plage',
      versionDansPlage: 'inconnu',
    });
    expect(par['CVE-2026-91004']).toMatchObject({
      statut: 'proposee',
      motif: 'non_comparable',
      versionDansPlage: 'inconnu',
    });
    expect(par['CVE-2026-91005']).toMatchObject({
      statut: 'proposee',
      motif: 'donnees_tronquees',
      versionDansPlage: 'non',
    });
    expect(f.compteurs).toEqual({ rattachee: 1, ecartee: 1, proposee: 3, confirmee: 0, rejetee: 0 });
    // À décider d'abord ; plages affichées ; priorité de la CVE rattachée (critique, déclarée) : P2.
    expect(f.rapprochements[0]!.statut).toBe('proposee');
    expect(par['CVE-2026-91001']!.priorite.niveau).toBe('P2');
    expect((par['CVE-2026-91001'] as unknown as { plages: unknown[] }).plages).toEqual([
      {
        editeur: 'editeur_fictif',
        produit: 'gestionnaire_fictif',
        version: null,
        debutInclus: null,
        debutExclus: null,
        finInclus: null,
        finExclus: '10.1.5',
      },
    ]);
    const recalcul = (await audits('vulnerabilites.rapprochement.recalcule')).at(-1)!;
    expect(recalcul).toMatchObject({ username: 'rapprochement automatique', target: p1.id });
    expect(recalcul.details).toMatchObject({ changements: 5, parIdentifiant: true });
  });

  it('par nom seulement (sans identifiant CPE) : toujours proposé, avec la position de la version', async () => {
    const r2 = await rssi.post(`${V}/produits`, {
      editeur: 'Éditeur  Fictif',
      nom: 'Gestionnaire-Fictif',
      versionProduit: '10.3.0',
      famille: 'applications_metier',
      criticite: 'moyenne',
    });
    expect(r2.statusCode, r2.body).toBe(201);
    p2 = r2.json();
    const f = await fiche(admin, p2.id);
    const par = Object.fromEntries(f.rapprochements.map((r) => [r.cve, r]));
    expect(Object.values(par).every((r) => r.statut === 'proposee' && r.motif === 'nom_seulement')).toBe(true);
    expect(Object.fromEntries(Object.values(par).map((r) => [r.cve, r.versionDansPlage]))).toEqual({
      'CVE-2026-91001': 'non',
      'CVE-2026-91002': 'oui',
      'CVE-2026-91003': 'inconnu',
      'CVE-2026-91004': 'inconnu',
      'CVE-2026-91005': 'non',
    });
  });

  it('décision : droit de modifier, If-Match, une seule fois, note et journal', async () => {
    const r = await rapp(p2.id, 'CVE-2026-91001');
    const url = `${V}/rapprochements/${r.id}/decision`;
    expect((await lecteurA.post(url, { decision: 'rejeter' }, ifMatch(r.version))).statusCode).toBe(403);
    expect((await admin.post(url, { decision: 'rejeter' })).statusCode).toBe(428);
    expect((await admin.post(url, { decision: 'rejeter' }, ifMatch(r.version + 5))).statusCode).toBe(412);
    expect((await admin.post(url, { decision: 'annuler' }, ifMatch(r.version))).statusCode).toBe(422);
    const rejet = await editeurA.post(
      url,
      { decision: 'rejeter', note: 'Produit homonyme fictif.' },
      ifMatch(r.version),
    );
    expect(rejet.statusCode, rejet.body).toBe(200);
    expect(rejet.json()).toMatchObject({ statut: 'rejetee', version: r.version + 1 });
    expect((await editeurA.post(url, { decision: 'confirmer' }, ifMatch(r.version + 1))).statusCode).toBe(409);
    const c = await rapp(p2.id, 'CVE-2026-91002');
    expect(
      (await editeurA.post(`${V}/rapprochements/${c.id}/decision`, { decision: 'confirmer' }, ifMatch(c.version)))
        .statusCode,
    ).toBe(200);
    const apres = await rapp(p2.id, 'CVE-2026-91001');
    expect(apres).toMatchObject({ statut: 'rejetee', note: 'Produit homonyme fictif.' });
    expect((await audits('vulnerabilites.rapprochement.rejete')).at(-1)).toMatchObject({
      username: 'rapp_editeur_a',
      target: r.id,
      details: { produit: p2.id, cve: 'CVE-2026-91001', motif: 'nom_seulement', versionProduit: '10.3.0' },
    });
    expect((await audits('vulnerabilites.rapprochement.confirme')).at(-1)).toMatchObject({ target: c.id });
    expect((await admin.get(`${V}/produits/${p2.id}`)).json().suivi).toEqual({ rattachees: 1, aDecider: 3 });
  });

  it('collecte NVD rejouée à données égales : rejet non reproposé, confirmation gardée ; données changées : rejet reproposé', async () => {
    await collecte('nvd', jeu());
    expect(await statuts(p2.id)).toMatchObject({ 'CVE-2026-91001': 'rejetee', 'CVE-2026-91002': 'confirmee' });
    // Les données de la CVE 91001 changent (borne de fin) : le rejet est remis à décider ; la confirmation tient.
    await collecte('nvd', jeu('10.1.6', { finExclus: '11.0' }));
    const s = await statuts(p2.id);
    expect(s['CVE-2026-91001']).toBe('proposee');
    expect(s['CVE-2026-91002']).toBe('confirmee');
    const r = await rapp(p2.id, 'CVE-2026-91001');
    expect(r.note).toBe('');
    // Produit à identifiant : la CVE 91003 a maintenant une plage qui contient 10.1.2, elle est rattachée d'office.
    expect((await statuts(p1.id))['CVE-2026-91003']).toBe('rattachee');
  });

  it('confirmation remise en jeu au changement de version ; rejet reproposé au changement du produit', async () => {
    const r = await rapp(p2.id, 'CVE-2026-91003');
    await editeurA.post(`${V}/rapprochements/${r.id}/decision`, { decision: 'rejeter' }, ifMatch(r.version));
    const rp = await admin.patch(
      `${V}/produits/${p2.id}`,
      { versionProduit: '10.3.1' },
      ifMatch(await versionProduit(p2.id)),
    );
    expect(rp.statusCode, rp.body).toBe(200);
    const s = await statuts(p2.id);
    // Par nom seulement, la règle d'office ne tranche jamais : tout redevient à décider.
    expect(s['CVE-2026-91002']).toBe('proposee');
    expect(s['CVE-2026-91003']).toBe('proposee');
    // Un changement qui ne touche ni la version ni les noms (criticité) ne remet rien en jeu.
    const c = await rapp(p2.id, 'CVE-2026-91002');
    await editeurA.post(`${V}/rapprochements/${c.id}/decision`, { decision: 'confirmer' }, ifMatch(c.version));
    await admin.patch(`${V}/produits/${p2.id}`, { criticite: 'faible' }, ifMatch(await versionProduit(p2.id)));
    expect((await statuts(p2.id))['CVE-2026-91002']).toBe('confirmee');
    // Produit à identifiant : confirmer une proposition, puis changer la version ; la règle d'office tranche désormais.
    const p = await rapp(p1.id, 'CVE-2026-91004');
    await editeurA.post(`${V}/rapprochements/${p.id}/decision`, { decision: 'confirmer' }, ifMatch(p.version));
    await admin.patch(`${V}/produits/${p1.id}`, { versionProduit: '10.2.1' }, ifMatch(await versionProduit(p1.id)));
    const s1 = await statuts(p1.id);
    expect(s1['CVE-2026-91001']).toBe('ecartee');
    expect(s1['CVE-2026-91002']).toBe('rattachee');
    expect(s1['CVE-2026-91004']).toBe('proposee');
    // Retour à 10.1.2 : la confirmation n'est pas restaurée (elle valait pour la version décidée).
    await admin.patch(`${V}/produits/${p1.id}`, { versionProduit: '10.1.2' }, ifMatch(await versionProduit(p1.id)));
    expect((await statuts(p1.id))['CVE-2026-91004']).toBe('proposee');
  });

  it('identifiant changé : les correspondances disparues sont retirées, puis reviennent', async () => {
    await admin.patch(
      `${V}/produits/${p1.id}`,
      { cpe: 'cpe:2.3:a:autre_editeur:autre_produit:*:*:*:*:*:*:*:*' },
      ifMatch(await versionProduit(p1.id)),
    );
    const s = await statuts(p1.id);
    expect(s).toEqual({ 'CVE-2026-91006': 'rattachee' });
    expect(await n('vulnerabilites_rapprochements', "produit_id = $1 AND statut = 'retiree'", [p1.id])).toBe(5);
    await admin.patch(`${V}/produits/${p1.id}`, { cpe: CPE_GF }, ifMatch(await versionProduit(p1.id)));
    expect((await statuts(p1.id))['CVE-2026-91001']).toBe('rattachee');
  });

  it('suggestions d’identifiant : couples connus de la veille, aucun appel, droit de modifier', async () => {
    const r = await editeurA.get(`${V}/identites-cpe?nom=${encodeURIComponent('Gestionnaire')}&editeur=Editeur`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()[0]).toEqual({
      partie: 'a',
      editeur: 'editeur_fictif',
      produit: 'gestionnaire_fictif',
      cpe: CPE_GF,
      cves: 5,
    });
    expect((await editeurA.get(`${V}/identites-cpe?nom=inexistant_fictif`)).json()).toEqual([]);
    expect((await lecteurA.get(`${V}/identites-cpe?nom=Gestionnaire`)).statusCode).toBe(403);
    expect((await editeurA.get(`${V}/identites-cpe?nom=x`)).statusCode).toBe(422);
  });
});

describe('produit relié aux machines (V20) et droits du périmètre', () => {
  it('relier : modifier et machine lisible exigés, If-Match, déjà reliée refusée, journal sans nom ni adresse', async () => {
    const url = `${V}/produits/${p1.id}/machines`;
    let v = await versionProduit(p1.id);
    expect((await lecteurA.post(url, { machineId: m1 }, ifMatch(v))).statusCode).toBe(403);
    expect((await editeurA.post(url, { machineId: m1 })).statusCode).toBe(428);
    expect((await editeurA.post(url, { machineId: m1 }, ifMatch(v + 3))).statusCode).toBe(412);
    // m2 (autre périmètre) et m3 (sans périmètre) : comme des machines inconnues.
    for (const m of [m2, m3, '00000000-0000-4000-8000-000000000999'])
      expect((await editeurA.post(url, { machineId: m }, ifMatch(v))).statusCode).toBe(404);
    const ok = await editeurA.post(url, { machineId: m1 }, ifMatch(v));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().version).toBe(v + 1);
    v = ok.json().version;
    expect((await editeurA.post(url, { machineId: m1 }, ifMatch(v))).statusCode).toBe(409);
    expect((await admin.post(url, { machineId: m3 }, ifMatch(v))).statusCode).toBe(200);
    expect((await admin.post(url, { machineId: m2 }, ifMatch(v + 1))).statusCode).toBe(200);
    const journal = await audits('vulnerabilites.produit.machine_reliee');
    expect(journal.at(0)).toMatchObject({ target: p1.id, details: { machine: m1 } });
    expect(JSON.stringify(journal)).not.toMatch(/srv-rapp|192\.0\.2/);
  });

  it('fiche et machine : seules les machines lisibles sont montrées ; délier', async () => {
    expect((await fiche(lecteurA, p1.id)).machines.map((m) => m.id)).toEqual([m1]);
    expect((await fiche(admin, p1.id)).machines.map((m) => m.id).sort()).toEqual([m1, m2, m3].sort());
    const produits = await lecteurA.get(`${V}/machines/${m1}/produits`);
    expect(produits.statusCode).toBe(200);
    expect(produits.json()).toEqual([
      expect.objectContaining({ id: p1.id, versionProduit: '10.1.2', cvesRattachees: 2 }),
    ]);
    expect((await lecteurA.get(`${V}/machines/${m2}/produits`)).statusCode).toBe(404);
    const v = await versionProduit(p1.id);
    expect((await editeurA.del(`${V}/produits/${p1.id}/machines/${m2}`, ifMatch(v))).statusCode).toBe(404);
    expect((await admin.del(`${V}/produits/${p1.id}/machines/${m2}`, ifMatch(v))).statusCode).toBe(200);
    expect((await admin.del(`${V}/produits/${p1.id}/machines/${m2}`, ifMatch(v + 1))).statusCode).toBe(404);
    expect((await audits('vulnerabilites.produit.machine_deliee')).at(-1)).toMatchObject({
      target: p1.id,
      details: { machine: m2 },
    });
  });
});

describe('mention « déclaré », priorité et rang', () => {
  /** Constat fictif détecté sur une machine (synchronisation complète n° 1). */
  async function detecter(plugin: number, machine: string, cves: string[], extra: Record<string, unknown> = {}) {
    const o = { gravite: 'moyenne', exploitable: false, epss: null as number | null, ...extra };
    const c = (await t.svc.db.one<{ id: string }>(
      `INSERT INTO vulnerabilites_constats (integration_id, plugin_id, nom, gravite, exploitable, epss_score, vu_numero)
       VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING id`,
      [instance, plugin, `Contrôle fictif ${plugin}`, o.gravite, o.exploitable, o.epss],
    ))!.id;
    for (const cve of cves)
      await t.svc.db.q('INSERT INTO vulnerabilites_constat_cves (constat_id, cve) VALUES ($1, $2)', [c, cve]);
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_detections (constat_id, machine_id, port, protocole, vu_numero) VALUES ($1, $2, 0, 'TCP', 1)",
      [c, machine],
    );
    return c;
  }

  it('une CVE rattachée apparaît « déclarée » sur les machines reliées, une seule fois, et pas là où Tenable la détecte', async () => {
    // p1 relié à m1 et m3 ; CVE rattachées : 91001 (critique), 91003 (critique), 91004 confirmée puis remise à décider.
    const lecture = await admin.get(`${V}/declarees`);
    expect(lecture.statusCode, lecture.body).toBe(200);
    const par = Object.fromEntries(
      (
        lecture.json().elements as { cve: string; machines: number; statut: string; priorite: { niveau: string } }[]
      ).map((x) => [x.cve, x]),
    );
    expect(Object.keys(par).sort()).toEqual(['CVE-2026-91001', 'CVE-2026-91003']);
    expect(par['CVE-2026-91001']).toMatchObject({ machines: 2, statut: 'rattachee' });
    // Tenable détecte 91001 sur m1 : la CVE n'y est plus « déclarée ».
    await detecter(910001, m1, ['CVE-2026-91001'], { gravite: 'critique' });
    const apres = (await admin.get(`${V}/declarees?q=CVE-2026-91001`)).json();
    expect(apres.elements).toHaveLength(1);
    expect(apres.elements[0].machines).toBe(1);
    // Lecteur du périmètre A : m3 (sans périmètre) n'est pas lisible, m1 détecte déjà 91001.
    expect((await lecteurA.get(`${V}/declarees?q=CVE-2026-91001`)).json().total).toBe(0);
    expect((await lecteurA.get(`${V}/declarees?q=gestionnaire`)).json().elements.map((x: Rapp) => x.cve)).toEqual([
      'CVE-2026-91003',
    ]);
    // Compteurs de m1 : 91001 comptée une fois (détectée), 91003 déclarée (critique).
    const machine = (await admin.get(`${V}/machines/${m1}`)).json();
    expect(machine.compteurs).toMatchObject({ critique: 2, declarees: 1, exploitationAveree: 0 });
    expect((await admin.get(`${V}/machines/${m3}`)).json().compteurs).toMatchObject({ critique: 2, declarees: 2 });
  });

  it('priorité : grille appliquée aux constats et aux failles déclarées, faits rendus, filtre', async () => {
    // KEV sur 91003 (déclarée sur m1 et m3) ; alerte CERT-FR sur 91001 (détectée sur m1).
    await collecte('cisa-kev', [kev('CVE-2026-91003')]);
    await collecte('cert-fr', [
      {
        identifiant: 'CERTFR-2026-ALE-0042',
        nature: 'alerte',
        titre: 'Alerte fictive',
        resume: 'Résumé fictif.',
        adresse: 'https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-0042/',
        publieLe: '2026-11-12T00:00:00.000Z',
        cves: ['CVE-2026-91001'],
        cvesLues: true,
      },
    ]);
    // 91003 (KEV) déclarée sur m1 et m3 ; 91001 (alerte CERT-FR) encore déclarée sur m3, où Tenable ne la détecte pas.
    const declaree = (await admin.get(`${V}/declarees?priorite=P1`)).json();
    expect(declaree.elements.map((x: Rapp) => x.cve)).toEqual(['CVE-2026-91003', 'CVE-2026-91001']);
    expect(declaree.elements[0].priorite).toEqual({
      niveau: 'P1',
      faits: [
        { fait: 'exploitation', sources: ['kev'] },
        { fait: 'presence', presence: 'declaree' },
      ],
    });
    expect(declaree.elements[1].priorite.faits[0]).toEqual({ fait: 'exploitation', sources: ['cert-fr'] });
    expect(declaree.elements[1]).toMatchObject({ kev: false, alerteCertFr: true, machines: 1 });
    const constats = (await admin.get(`${V}/constats?priorite=P1`)).json();
    expect(constats.total).toBe(1);
    expect(constats.elements[0]).toMatchObject({
      plugin: '910001',
      alerteCertFr: true,
      priorite: {
        niveau: 'P1',
        faits: [
          { fait: 'exploitation', sources: ['cert-fr'] },
          { fait: 'presence', presence: 'detectee' },
        ],
      },
    });
    // Constat moyen sans CVE (non maintenu) sur m2 : classé sur sa gravité et sa présence.
    await detecter(910002, m2, [], { gravite: 'moyenne', epss: 0.3 });
    const p4 = (await admin.get(`${V}/constats?priorite=P4`)).json();
    expect(p4.elements.map((x: { plugin: string }) => x.plugin)).toEqual(['910002']);
    expect(p4.elements[0].priorite.faits).toEqual([
      { fait: 'presence', presence: 'detectee' },
      { fait: 'gravite', gravite: 'moyenne' },
    ]);
    // Liste complète rangée par priorité ; rejouable à l'identique.
    const tous = (await admin.get(`${V}/constats`)).json();
    expect(tous.elements.map((x: { priorite: { niveau: string } }) => x.priorite.niveau)).toEqual(['P1', 'P4']);
    expect((await admin.get(`${V}/constats`)).json()).toEqual(tous);
    expect((await admin.get(`${V}/constats?priorite=P5`)).statusCode).toBe(422);
  });

  it('seuil EPSS réglable : administrer, If-Match, journal ; le réglage change la priorité', async () => {
    const url = `${V}/priorite/reglage`;
    const lu = await lecteurA.get(url);
    expect(lu.statusCode).toBe(200);
    // Lot S1 : les délais cibles de correction sont rangés avec le seuil (valeurs par défaut du code).
    expect(lu.json()).toEqual({ values: { seuilEpss: 0.5, delais: DELAIS }, version: 0 });
    expect((await editeurA.put(url, { seuilEpss: 0.25 }, ifMatch(0))).statusCode).toBe(403);
    expect((await rssi.put(url, { seuilEpss: 0.25 })).statusCode).toBe(428);
    expect((await rssi.put(url, { seuilEpss: 0 }, ifMatch(0))).statusCode).toBe(422);
    expect((await rssi.put(url, { seuilEpss: 0.25, autre: 1 }, ifMatch(0))).statusCode).toBe(422);
    const ok = await rssi.put(url, { seuilEpss: 0.25 }, ifMatch(0));
    expect(ok.statusCode, ok.body).toBe(200);
    // Une saisie du seul seuil garde les délais.
    expect(ok.json()).toEqual({ values: { seuilEpss: 0.25, delais: DELAIS }, version: 1 });
    expect((await rssi.put(url, { seuilEpss: 0.3 }, ifMatch(0))).statusCode).toBe(412);
    expect((await audits('vulnerabilites.priorite.reglage_modifie')).at(-1)).toMatchObject({
      username: 'rapp_rssi',
      details: { avant: { seuilEpss: 0.5, delais: DELAIS }, apres: { seuilEpss: 0.25, delais: DELAIS }, version: 1 },
    });
    const c = (await admin.get(`${V}/constats?q=910002`)).json().elements[0];
    expect(c.priorite).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'detectee' },
        { fait: 'epss', score: 0.3, seuil: 0.25 },
      ],
    });
  });

  it('rang : exploitation avérée, puis rôle, puis critiques et élevées ; faits rendus ; machines non lisibles exclues', async () => {
    const liste = (await admin.get(`${V}/machines`)).json();
    // m1 (front) et m3 (sans rôle) portent une exploitation avérée ; m2 (base de données) aucune.
    expect(liste.elements.map((m: { id: string }) => m.id)).toEqual([m1, m3, m2]);
    expect(liste.elements[0].rang).toEqual({
      position: 1,
      total: 3,
      faits: [
        { fait: 'exploitation', nombre: 2 },
        { fait: 'role', role: 'front' },
        { fait: 'critiques', nombre: 2 },
        { fait: 'elevees', nombre: 0 },
      ],
    });
    expect(liste.elements[2].rang.position).toBe(3);
    // Filtre : le rang reste calculé sur toutes les machines lisibles.
    const filtre = (await admin.get(`${V}/machines?role=bdd`)).json();
    expect(filtre.elements[0].rang.position).toBe(3);
    // Lecteur du périmètre A : une seule machine lisible, rangée première sur une.
    const a = (await lecteurA.get(`${V}/machines`)).json();
    expect(a.elements.map((m: { id: string }) => m.id)).toEqual([m1]);
    expect(a.elements[0].rang).toMatchObject({ position: 1, total: 1 });
    expect((await lecteurA.get(`${V}/machines/${m2}`)).statusCode).toBe(404);
  });
});
