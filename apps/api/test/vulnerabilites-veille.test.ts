/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : veille sur les sources publiques. Migration 074 sur base vierge, droits
   (lire, administrer), module désactivé, flux fermé = rien d'inscrit ni de réclamé, activation par la route commune des
   flux (administrateur, validation explicite), cycle réclamation -> lots -> fin par la vraie CLI de l'exécutant,
   idempotence d'une collecte rejouée, fenêtre NVD, choix des failles notées par EPSS, avis du CERT-FR et du CERT Santé,
   recherche, planification quotidienne (créneau consommé, pas de rejeu), limites de fréquence. Données fictives ou de forme
   publique ; aucune source n'est jointe. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, REPO, type TestApp } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

const base = '/api/vulnerabilites/veille';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, rssi: Agent, contributeur: Agent, lecteur: Agent, sansRole: Agent, roleRw: Agent, roleRo: Agent;

const kev = (cve: string, extra: Record<string, unknown> = {}) => ({
  cve,
  editeur: 'Éditeur fictif',
  produit: 'Produit fictif',
  nom: 'Fictional Product Vulnerability',
  description: 'Fictional description, kept as is.',
  action: 'Apply mitigations per vendor instructions.',
  ajoutLe: '2026-11-13',
  echeance: '2026-12-04',
  rancongiciel: false,
  ...extra,
});
const nvd = (cve: string, extra: Record<string, unknown> = {}) => ({
  cve,
  publieLe: '2026-06-26T15:16:40.587Z',
  modifieLe: '2026-11-14T19:16:50.940Z',
  description: 'Fictional NVD description.',
  cvss31: { score: 9.3, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:L', gravite: 'CRITICAL' },
  cvss40: null,
  editeurs: ['editeur_cpe_fictif'],
  produits: ['produit_cpe_fictif'],
  produitsTouches: [],
  produitsTronques: false,
  ...extra,
});
const avisCertFr = (identifiant: string, extra: Record<string, unknown> = {}) => ({
  identifiant,
  nature: identifiant.includes('-ALE-') ? 'alerte' : 'avis',
  titre: `Multiples vulnérabilités dans un produit fictif (${identifiant})`,
  resume: 'Résumé fictif.',
  adresse: `https://cert.cyber.gouv.fr/${identifiant.includes('-ALE-') ? 'alerte' : 'avis'}/${identifiant}/`,
  publieLe: '2026-11-12T00:00:00.000Z',
  cves: ['CVE-2026-90001'],
  cvesLues: true,
  ...extra,
});
const bilan = (elements: number, extra: Record<string, unknown> = {}) => ({
  ok: true,
  bilan: { elements, ecartes: 0, tronque: false, detailsEchoues: 0, ...extra },
  erreur: null,
});
const n = async (table: string, where = 'true') =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
const ouvrir = () => t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
const fermer = () => t.svc.flux.changer('veille-vulnerabilites', false, SYSTEME, '127.0.0.1');
/** Une collecte de la source, réclamée, lot rangé, terminée ; renvoie son identifiant. */
async function collecte(source: string, elements: unknown[], rapport = bilan(elements.length)) {
  await t.svc.db.q(
    "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ($1, 'manuel', 'test')",
    [source],
  );
  const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
  expect(job.source).toBe(source);
  if (elements.length) await t.svc.vulnerabilites.veille.lot(job.id as string, { elements });
  await t.svc.vulnerabilites.veille.terminer(job.id as string, rapport);
  return job;
}

/** Lance « suivi <commande> » comme l'exécutant (`docker compose exec -T app suivi`), sur la base du test. */
function cli(args: string[], stdin = '') {
  return new Promise<{ code: number | null; out: string; err: string }>((resolve, reject) => {
    const enfant = spawn(
      path.join(REPO, 'apps/api/node_modules/.bin/tsx'),
      ['--conditions=source', path.join(REPO, 'apps/api/src/cli.ts'), ...args],
      {
        cwd: path.join(REPO, 'apps/api'),
        env: {
          ...process.env,
          DB_HOST: PG.host,
          DB_PORT: String(PG.port),
          DB_NAME: t.dbName,
          DB_USER: APP_ROLE,
          DB_PASSWORD: APP_ROLE_PASSWORD,
          DOC_MASTER_KEY: t.svc.cfg.masterKey,
          SECRETS_DIR: '/nonexistent',
          LOG_LEVEL: 'silent',
        },
      },
    );
    let out = '',
      err = '';
    enfant.stdout.on('data', (d) => (out += d));
    enfant.stderr.on('data', (d) => (err += d));
    enfant.on('error', reject);
    enfant.on('close', (code) => resolve({ code, out, err }));
    // Entrée trop grosse : la CLI s'arrête avant la fin de l'écriture (tuyau fermé), sans que ce soit une erreur du test.
    enfant.stdin.on('error', () => {});
    enfant.stdin.end(stdin);
  });
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'veille_admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'veille_rssi', 'rssi'));
  // Droits par défaut resserrés (ADR 0100, lot V5) : contributeur et lecteur du module par des rôles personnalisés.
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_veille_contrib', 'Veille, contribution', ARRAY['vulnerabilites:lire','vulnerabilites:modifier']),
       ('r_veille_lecteur', 'Veille, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  contributeur = await login(t, await makeUser(t, 'veille_contrib', 'r_veille_contrib'));
  lecteur = await login(t, await makeUser(t, 'veille_lecteur', 'r_veille_lecteur'));
  roleRw = await login(t, await makeUser(t, 'veille_rw', 'rw'));
  roleRo = await login(t, await makeUser(t, 'veille_ro', 'ro'));
  sansRole = await login(t, await makeUser(t, 'veille_sans_role', null));
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  for (const table of [
    'vulnerabilites_veille_collectes',
    'vulnerabilites_veille_avis',
    'vulnerabilites_veille_cve',
    'vulnerabilites_veille_sources',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.db.q("DELETE FROM flux_externes WHERE module = 'veille-vulnerabilites'");
  await t.svc.db.q('DELETE FROM backup_worker');
  t.svc.limits.veilleCollecte.reset();
});

describe('migration 074 sur base vierge', () => {
  it('crée les tables vides et borne les données en base', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '074_vulnerabilites_veille.sql'"))?.ok,
    ).toBe(1);
    for (const table of [
      'vulnerabilites_veille_sources',
      'vulnerabilites_veille_cve',
      'vulnerabilites_veille_avis',
      'vulnerabilites_veille_collectes',
    ])
      expect(await n(table)).toBe(0);
    const refus = (q: string) => expect(t.svc.db.q(q)).rejects.toThrow();
    // Sources en liste fermée ; erreur sur une ligne.
    await refus("INSERT INTO vulnerabilites_veille_sources (source) VALUES ('ailleurs')");
    await refus("INSERT INTO vulnerabilites_veille_sources (source, erreur) VALUES ('nvd', E'ligne 1\\nligne 2')");
    // Identifiants, adresses et bornes des avis et des failles.
    await refus("INSERT INTO vulnerabilites_veille_cve (cve) VALUES ('CVE-26-1')");
    await refus("INSERT INTO vulnerabilites_veille_cve (cve, epss_score) VALUES ('CVE-2026-0001', 50)");
    await refus(`INSERT INTO vulnerabilites_veille_cve (cve, description) VALUES ('CVE-2026-0001', repeat('x', 1001))`);
    await refus(
      "INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre) VALUES ('cert-fr', '10351', 'avis', 'x')",
    );
    await refus(
      "INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, adresse) VALUES ('cert-fr', 'CERTFR-2026-AVI-0001', 'avis', 'x', 'https://ailleurs.exemple.test/')",
    );
    await refus(
      "INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre) VALUES ('cert-sante', '1', 'alerte', '')",
    );
    // File : fenêtre de dates réservée à NVD ; terminé = date de fin ; erreur seulement en échec.
    await refus(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par, fenetre_debut, fenetre_fin) VALUES ('epss', 'manuel', 't', now() - interval '1 day', now())",
    );
    await refus(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par, etat, debute_le) VALUES ('nvd', 'manuel', 't', 'recu', now())",
    );
    await refus(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par, etat, termine_le, erreur) VALUES ('nvd', 'manuel', 't', 'echec', now(), NULL)",
    );
  });
});

describe('droits, module et flux', () => {
  it('lire : état, avis et failles ; sans droit, 403 ; « Collecter maintenant » demande administrer', async () => {
    for (const a of [lecteur, contributeur]) {
      expect((await a.get(`${base}/etat`)).statusCode).toBe(200);
      expect((await a.get(`${base}/avis`)).statusCode).toBe(200);
      expect((await a.get(`${base}/failles?kev=oui`)).statusCode).toBe(200);
      expect((await a.post(`${base}/collectes`, {})).statusCode).toBe(403);
    }
    for (const url of [`${base}/etat`, `${base}/avis`, `${base}/failles`])
      for (const a of [sansRole, roleRw, roleRo]) expect((await a.get(url)).statusCode).toBe(403);
    expect((await sansRole.post(`${base}/collectes`, {})).statusCode).toBe(403);
    // Administrer passe le contrôle de droit ; refus métier : flux fermé.
    const ferme = await rssi.post(`${base}/collectes`, {});
    expect(ferme.statusCode).toBe(409);
    expect(ferme.json().reason).toBe('flux_ferme');
    expect(await n('vulnerabilites_veille_collectes')).toBe(0);
  });

  it('écriture sans jeton CSRF refusée ; recherche mal formée refusée', async () => {
    expect((await admin.req('POST', `${base}/collectes`, { json: {}, csrf: false })).statusCode).toBe(403);
    expect((await lecteur.get(`${base}/failles?kev=non`)).statusCode).toBe(422);
    expect((await lecteur.get(`${base}/avis?page=0`)).statusCode).toBe(422);
    expect((await admin.post(`${base}/collectes`, { source: 'ailleurs' })).statusCode).toBe(422);
  });

  it('module désactivé : toutes les routes refusent, rien n’est réclamé, le flux ne s’ouvre pas', async () => {
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['vulnerabilites'], version = version + 1 WHERE id=1",
    );
    for (const r of [
      await admin.get(`${base}/etat`),
      await admin.get(`${base}/avis`),
      await admin.get(`${base}/failles`),
      await admin.post(`${base}/collectes`, {}),
    ]) {
      expect(r.statusCode).toBe(409);
      expect(r.json().reason).toBe('module_disabled');
    }
    const ouverture = await admin.put('/api/admin/flux-externes/veille-vulnerabilites', {
      ouvert: true,
      confirmation: true,
    });
    expect(ouverture.statusCode).toBe(409);
    expect(ouverture.json().reason).toBe('flux_module_desactive');
    expect(await t.svc.flux.ouvert('veille-vulnerabilites')).toBe(false);
    // Flux ouvert malgré tout (base modifiée à la main) : la CLI ne remet rien, la demande en file est close sans appel.
    await ouvrir();
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('nvd', 'manuel', 't')",
    );
    const claim = await cli(['veille-claim']);
    expect(claim.code, claim.err).toBe(0);
    expect(claim.out.trim()).toBe('');
    expect(await n('vulnerabilites_veille_collectes', "etat = 'echec' AND debute_le IS NULL")).toBe(1);
  });

  it('« Activer la veille » : route commune, administrateur et validation explicite ; désactiver le module referme', async () => {
    const sans = await admin.put('/api/admin/flux-externes/veille-vulnerabilites', { ouvert: true });
    expect(sans.statusCode).toBe(422);
    // Le RSSI administre le module, pas l'administration technique : il ne peut pas ouvrir le flux.
    expect(
      (await rssi.put('/api/admin/flux-externes/veille-vulnerabilites', { ouvert: true, confirmation: true }))
        .statusCode,
    ).toBe(403);
    const ok = await admin.put('/api/admin/flux-externes/veille-vulnerabilites', { ouvert: true, confirmation: true });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(await t.svc.flux.ouvert('veille-vulnerabilites')).toBe(true);
    expect((await audits('flux.externe.ouvert')).at(-1)).toMatchObject({ target: 'veille-vulnerabilites' });
    expect((await lecteur.get(`${base}/etat`)).json().flux.ouvert).toBe(true);
    const intent = { changes: [{ id: 'vulnerabilites', enabled: false }], cascade: false };
    const apercu = await admin.post('/api/admin/modules/preview', intent);
    expect(apercu.statusCode, apercu.body).toBe(200);
    const applique = await admin.put(
      '/api/admin/modules',
      { intent, previewId: apercu.json().previewId, confirm: 'VALIDER' },
      { 'if-match': `"${apercu.json().version}"` },
    );
    expect(applique.statusCode, applique.body).toBe(200);
    expect(await t.svc.flux.ouvert('veille-vulnerabilites')).toBe(false);
    // Le réactiver ne rouvre rien.
    await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
    expect(await t.svc.flux.ouvert('veille-vulnerabilites')).toBe(false);
  });

  it('flux fermé : rien n’est planifié, rien n’est réclamé, une collecte en file est close sans appel', async () => {
    // Ouvert puis refermé : l'état « fermé » décidé vaut comme l'absence de décision.
    await ouvrir();
    await fermer();
    expect(await t.svc.vulnerabilites.veille.planifier()).toEqual([]);
    expect(await n('vulnerabilites_veille_collectes')).toBe(0);
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('cisa-kev', 'manuel', 't')",
    );
    expect(await t.svc.vulnerabilites.veille.reclamer(true)).toBeNull();
    const c = (await t.svc.db.one<{ etat: string; erreur: string; debute_le: Date | null }>(
      'SELECT etat, erreur, debute_le FROM vulnerabilites_veille_collectes',
    ))!;
    expect(c).toMatchObject({ etat: 'echec', debute_le: null });
    expect(c.erreur).toMatch(/Flux fermé/);
  });
});

describe('collecte par la CLI de l’exécutant', () => {
  it('demande, réclamation, lots validés, fin ; journal sans contenu de source', async () => {
    await ouvrir();
    expect((await rssi.post(`${base}/collectes`, { source: 'cisa-kev' })).statusCode).toBe(503);
    await t.svc.backups.heartbeat(true);
    const d = await rssi.post(`${base}/collectes`, { source: 'cisa-kev' });
    expect(d.statusCode, d.body).toBe(201);
    expect(d.json()).toEqual([
      expect.objectContaining({ source: 'cisa-kev', etat: 'en_file', origine: 'manuel', demandePar: 'veille_rssi' }),
    ]);

    const claim = await cli(['veille-claim']);
    expect(claim.code, claim.err).toBe(0);
    const job = JSON.parse(claim.out);
    expect(job).toEqual({ id: d.json()[0].id, source: 'cisa-kev', parametres: {} });
    expect((await cli(['veille-claim'])).out.trim()).toBe('');

    // Lot refusé (élément mal formé, champ inattendu, taille) : code 2, rien n'est écrit.
    for (const mauvais of [
      { elements: [kev('CVE-2026-0001'), kev('CVE-2026-1')] },
      { elements: [kev('CVE-2026-0001', { action: '<script>alert(1)</script>' })] },
      { elements: [kev('CVE-2026-0001')], source: 'nvd' },
      { elements: [] },
    ]) {
      const r = await cli(['veille-lot', job.id], JSON.stringify(mauvais));
      expect(r.code, JSON.stringify(mauvais).slice(0, 80)).toBe(2);
    }
    expect(await n('vulnerabilites_veille_cve')).toBe(0);
    expect((await cli(['veille-lot', 'pas-un-uuid'], JSON.stringify({ elements: [kev('CVE-2026-0001')] }))).code).toBe(
      2,
    );
    expect((await cli(['veille-lot', job.id], '{"elements": [' + '"x",'.repeat(1_100_000) + '"x"]}')).code).toBe(2);

    const lot = await cli(
      ['veille-lot', job.id],
      JSON.stringify({ elements: [kev('CVE-2026-0001'), kev('CVE-2026-0002')] }),
    );
    expect(lot.code, lot.err).toBe(0);
    expect(JSON.parse(lot.out)).toEqual({ elements: 2, lots: 1 });
    expect((await cli(['veille-finish', job.id], JSON.stringify({ ...bilan(2), extra: 1 }))).code).toBe(2);
    const fin = await cli(['veille-finish', job.id], JSON.stringify(bilan(2)));
    expect(fin.code, fin.err).toBe(0);
    // Collecte close : ni lot ni fin de plus.
    expect((await cli(['veille-lot', job.id], JSON.stringify({ elements: [kev('CVE-2026-0003')] }))).code).toBe(1);
    expect((await cli(['veille-finish', job.id], JSON.stringify(bilan(0)))).code).toBe(1);

    const etat = (await lecteur.get(`${base}/etat`)).json();
    const s = etat.sources.find((x: { source: string }) => x.source === 'cisa-kev');
    expect(s).toMatchObject({ erreur: null, enRetard: false, hote: 'www.cisa.gov' });
    expect(s.derniereReussite).not.toBeNull();
    expect(s.derniereCollecte).toMatchObject({ etat: 'recu', elements: 2 });
    // Les autres sources, jamais collectées alors que la veille est active : signalées en retard.
    expect(etat.sources.find((x: { source: string }) => x.source === 'nvd').enRetard).toBe(true);

    const failles = (await lecteur.get(`${base}/failles?kev=oui`)).json();
    expect(failles.total).toBe(2);
    expect(failles.elements[0]).toMatchObject({
      cve: 'CVE-2026-0002',
      kev: { action: 'Apply mitigations per vendor instructions.', echeance: '2026-12-04', ajoutLe: '2026-11-13' },
    });
    const journal = JSON.stringify(
      (await t.svc.db.q("SELECT action, details FROM audit_log WHERE action LIKE 'vulnerabilites.veille.%'")).rows,
    );
    for (const a of ['collecte.demandee', 'collecte.reclamee', 'collecte.terminee']) expect(journal).toContain(a);
    expect(journal).not.toContain('Apply mitigations');
    expect((await audits('vulnerabilites.veille.collecte.terminee')).at(-1)!.details).toMatchObject({
      source: 'cisa-kev',
      etat: 'recu',
      elements: 2,
      lots: 1,
    });
  }, 120_000);

  it('une collecte rejouée met à jour sans doublon ; un bilan incohérent est consigné en échec', async () => {
    await ouvrir();
    await collecte('cisa-kev', [kev('CVE-2026-0001'), kev('CVE-2026-0002')]);
    await collecte('cisa-kev', [kev('CVE-2026-0001', { echeance: '2026-12-31' }), kev('CVE-2026-0002')]);
    expect(await n('vulnerabilites_veille_cve')).toBe(2);
    expect(
      (await t.svc.db.one<{ e: string }>(
        "SELECT kev_echeance::text AS e FROM vulnerabilites_veille_cve WHERE cve = 'CVE-2026-0001'",
      ))!.e,
    ).toBe('2026-12-31');
    // Un même identifiant deux fois dans un lot : rangé une fois.
    await collecte('nvd', [nvd('CVE-2026-0003'), nvd('CVE-2026-0003', { description: 'Second.' })]);
    expect(await n('vulnerabilites_veille_cve')).toBe(3);
    await collecte('nvd', [nvd('CVE-2026-0001')], bilan(5));
    const c = (await t.svc.db.one<{ etat: string; erreur: string }>(
      "SELECT etat, erreur FROM vulnerabilites_veille_collectes WHERE source = 'nvd' ORDER BY demande_le DESC LIMIT 1",
    ))!;
    expect(c.etat).toBe('echec');
    expect(c.erreur).toMatch(/Bilan incohérent/);
    // La source garde l'erreur ; la faille KEV a reçu en plus ses champs NVD.
    const s = (await lecteur.get(`${base}/etat`)).json().sources.find((x: { source: string }) => x.source === 'nvd');
    expect(s.erreur).toMatch(/Bilan incohérent/);
    const f = (await lecteur.get(`${base}/failles?q=CVE-2026-0001`)).json().elements[0];
    expect(f).toMatchObject({
      cve: 'CVE-2026-0001',
      cvss31: { score: 9.3, gravite: 'CRITICAL' },
      kev: { echeance: '2026-12-31' },
    });
  });

  it('fenêtre NVD : un jour la première fois, puis depuis la fin de la dernière réussie, sept jours au plus', async () => {
    await ouvrir();
    const j1 = await collecte('nvd', []);
    const p1 = j1.parametres as { depuis: string; jusqua: string };
    expect(new Date(p1.jusqua).getTime() - new Date(p1.depuis).getTime()).toBe(24 * 3_600_000);
    await t.svc.db.q(
      "UPDATE vulnerabilites_veille_sources SET fenetre_fin = now() - interval '2 hours' WHERE source = 'nvd'",
    );
    const j2 = await collecte('nvd', []);
    const p2 = j2.parametres as { depuis: string; jusqua: string };
    expect(Math.round((new Date(p2.jusqua).getTime() - new Date(p2.depuis).getTime()) / 3_600_000)).toBe(2);
    // Collecte échouée : la fenêtre n'avance pas.
    await collecte('nvd', [], { ok: false, bilan: null, erreur: 'Délai dépassé.' } as never);
    expect(
      (await t.svc.db.one<{ f: Date }>(
        "SELECT fenetre_fin AS f FROM vulnerabilites_veille_sources WHERE source = 'nvd'",
      ))!.f.toISOString(),
    ).toBe(new Date(p2.jusqua).toISOString());
    await t.svc.db.q(
      "UPDATE vulnerabilites_veille_sources SET fenetre_fin = now() - interval '30 days' WHERE source = 'nvd'",
    );
    const p3 = (await collecte('nvd', [])).parametres as { depuis: string; jusqua: string };
    expect(new Date(p3.jusqua).getTime() - new Date(p3.depuis).getTime()).toBe(7 * 24 * 3_600_000);
    expect((await audits('vulnerabilites.veille.collecte.reclamee')).at(-1)!.details).toMatchObject({ source: 'nvd' });
  });

  it('EPSS : seulement des failles connues de la veille, KEV puis avis d’abord ; un score inconnu est ignoré', async () => {
    await ouvrir();
    // Produit surveillé : jamais dans la demande (le parc n'est pas lu).
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_produits (editeur, nom, version_produit, famille, criticite, cpe, created_by, updated_by) VALUES ('Éditeur fictif', 'Produit fictif', '1.0', 'web', 'faible', 'cpe:2.3:a:editeur:produit:1.0:*:*:*:*:*:*:*', 't', 't')",
    );
    await collecte('nvd', [nvd('CVE-2026-0010')]);
    await collecte('cert-fr', [avisCertFr('CERTFR-2026-AVI-0001', { cves: ['CVE-2026-0011'] })]);
    await collecte('cisa-kev', [kev('CVE-2026-0012')]);
    const job = await collecte('epss', [
      { cve: 'CVE-2026-0012', score: 0.97, centile: 0.999, date: '2026-11-15' },
      { cve: 'CVE-2026-0099', score: 0.5, centile: 0.5, date: '2026-11-15' },
    ]);
    expect(job.parametres).toEqual({ cves: ['CVE-2026-0012', 'CVE-2026-0011', 'CVE-2026-0010'] });
    expect(JSON.stringify(job.parametres)).not.toContain('produit');
    expect(await n('vulnerabilites_veille_cve', "cve = 'CVE-2026-0099'")).toBe(0);
    const f = (await lecteur.get(`${base}/failles?q=CVE-2026-0012`)).json().elements[0];
    expect(f.epss).toEqual({ score: 0.97, centile: 0.999, date: '2026-11-15' });
    // Score lu depuis moins de vingt heures : pas redemandé.
    const p2 = await collecte('epss', []);
    expect(p2.parametres).toEqual({ cves: ['CVE-2026-0011', 'CVE-2026-0010'] });
  });

  it('avis : sans doublon, CVE gardées si l’export n’a pas été lu, avis lus remis au script, CVE citées connues', async () => {
    await ouvrir();
    await collecte('cert-fr', [
      avisCertFr('CERTFR-2026-AVI-0001'),
      avisCertFr('CERTFR-2026-ALE-001', { cves: ['CVE-2026-90002'] }),
    ]);
    const j = await collecte('cert-fr', [
      avisCertFr('CERTFR-2026-AVI-0001', { cves: [], cvesLues: false, titre: 'Titre mis à jour' }),
    ]);
    // Avis déjà lus : remis au script ; les alertes sont relues à chaque collecte.
    expect(j.parametres).toEqual({ connus: ['CERTFR-2026-AVI-0001'] });
    expect(await n('vulnerabilites_veille_avis')).toBe(2);
    const a = (await t.svc.db.one<{ titre: string; cves: string[]; cves_lues: boolean }>(
      "SELECT titre, cves, cves_lues FROM vulnerabilites_veille_avis WHERE identifiant = 'CERTFR-2026-AVI-0001'",
    ))!;
    expect(a).toEqual({ titre: 'Titre mis à jour', cves: ['CVE-2026-90001'], cves_lues: true });
    expect(
      await n('vulnerabilites_veille_cve', "cve IN ('CVE-2026-90001', 'CVE-2026-90002') AND avis_le IS NOT NULL"),
    ).toBe(2);
    await collecte('cert-sante', [
      {
        identifiant: '10351',
        nature: 'alerte',
        titre: 'Produit fictif - CVE-2026-90003',
        resume: '',
        adresse: 'https://cyberveille.esante.gouv.fr/alertes/produit-fictif-cve-2026-90003',
        publieLe: '2026-11-13T02:06:47.000Z',
        cves: ['CVE-2026-90003'],
        cvesLues: true,
      },
    ]);
    const avis = (await lecteur.get(`${base}/avis`)).json();
    expect(avis.total).toBe(3);
    expect(avis.elements.map((x: { source: string; identifiant: string }) => `${x.source}:${x.identifiant}`)).toEqual([
      'cert-sante:10351',
      'cert-fr:CERTFR-2026-AVI-0001',
      'cert-fr:CERTFR-2026-ALE-001',
    ]);
    // Une adresse hors de l'hôte de la source est refusée avec tout le lot.
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('cert-fr', 'manuel', 't')",
    );
    const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    await expect(
      t.svc.vulnerabilites.veille.lot(job.id as string, {
        elements: [avisCertFr('CERTFR-2026-AVI-0002', { adresse: 'https://ailleurs.exemple.test/avis/' })],
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await n('vulnerabilites_veille_avis', "identifiant = 'CERTFR-2026-AVI-0002'")).toBe(0);
  });
});

describe('recherche', () => {
  it('par identifiant CVE, éditeur, produit (KEV ou CPE), nom, titre d’avis ; jokers échappés ; pagination', async () => {
    await ouvrir();
    await collecte('cisa-kev', [
      kev('CVE-2026-0001', { editeur: 'Alpha Systèmes', produit: 'Passerelle', nom: 'Alpha Gateway Flaw' }),
      kev('CVE-2026-0002', { editeur: 'Beta', produit: 'Messagerie 100%' }),
    ]);
    await collecte('nvd', [nvd('CVE-2025-1234', { produits: ['serveur_web_fictif'], editeurs: ['gamma'] })]);
    await collecte('cert-fr', [
      avisCertFr('CERTFR-2026-AVI-0001', { titre: 'Vulnérabilité dans Delta Serveur', cves: ['CVE-2026-0002'] }),
    ]);
    const cves = async (q: string, kevSeul = false) =>
      (await lecteur.get(`${base}/failles?q=${encodeURIComponent(q)}${kevSeul ? '&kev=oui' : ''}`))
        .json()
        .elements.map((f: { cve: string }) => f.cve);
    expect(await cves('cve-2026-000')).toEqual(['CVE-2026-0002', 'CVE-2026-0001']);
    expect(await cves('alpha')).toEqual(['CVE-2026-0001']);
    expect(await cves('passerelle')).toEqual(['CVE-2026-0001']);
    expect(await cves('gateway flaw')).toEqual(['CVE-2026-0001']);
    expect(await cves('serveur_web')).toEqual(['CVE-2025-1234']);
    expect(await cves('GAMMA')).toEqual(['CVE-2025-1234']);
    expect(await cves('gamma', true)).toEqual([]);
    expect(await cves('100%')).toEqual(['CVE-2026-0002']);
    // Jokers saisis pris à la lettre : « _ » ne remplace pas « % ».
    expect(await cves('100_')).toEqual([]);
    const titres = async (q: string) =>
      (await lecteur.get(`${base}/avis?q=${encodeURIComponent(q)}`))
        .json()
        .elements.map((a: { identifiant: string }) => a.identifiant);
    expect(await titres('delta')).toEqual(['CERTFR-2026-AVI-0001']);
    expect(await titres('CVE-2026-0002')).toEqual(['CERTFR-2026-AVI-0001']);
    expect(await titres('AVI-0001')).toEqual(['CERTFR-2026-AVI-0001']);
    expect(await titres('epsilon')).toEqual([]);
    // Pagination : vingt-cinq par page.
    await collecte(
      'cisa-kev',
      Array.from({ length: 30 }, (_, i) => kev(`CVE-2026-${String(1000 + i)}`)),
    );
    const p1 = (await lecteur.get(`${base}/failles?kev=oui`)).json();
    const p2 = (await lecteur.get(`${base}/failles?kev=oui&page=2`)).json();
    expect([p1.total, p1.parPage, p1.elements.length, p2.elements.length]).toEqual([32, 25, 25, 7]);
  });
});

describe('planification et fréquence', () => {
  it('une collecte par source et par jour, EPSS après les autres ; créneau consommé, pas de rejeu après panne', async () => {
    await ouvrir();
    const jour = new Date('2026-11-16T09:00:00Z');
    const ids = await t.svc.vulnerabilites.veille.planifier(jour);
    expect(ids).toHaveLength(4);
    const sources = async () =>
      (
        await t.svc.db.q<{ source: string; origine: string }>(
          'SELECT source, origine FROM vulnerabilites_veille_collectes ORDER BY demande_le, source',
        )
      ).rows;
    expect((await sources()).map((s) => s.source).sort()).toEqual(['cert-fr', 'cert-sante', 'cisa-kev', 'nvd']);
    expect((await sources()).every((s) => s.origine === 'planifie')).toBe(true);
    expect(await t.svc.vulnerabilites.veille.planifier(jour)).toEqual([]);
    // Exécutant absent : les collectes expirent ; le même jour, rien n'est réinscrit (créneau déjà consommé)…
    await t.svc.db.q("UPDATE vulnerabilites_veille_collectes SET demande_le = now() - interval '31 minutes'");
    expect(await t.svc.vulnerabilites.veille.planifier(jour)).toHaveLength(1); // … sauf EPSS, maintenant que la file est vide
    expect(await n('vulnerabilites_veille_collectes', "etat = 'expire'")).toBe(4);
    expect(await n('vulnerabilites_veille_collectes', "source = 'epss'")).toBe(1);
    expect(await t.svc.vulnerabilites.veille.planifier(new Date('2026-11-16T22:00:00Z'))).toEqual([]);
    const s = (await lecteur.get(`${base}/etat`))
      .json()
      .sources.find((x: { source: string }) => x.source === 'cisa-kev');
    expect(s.erreur).toMatch(/expirée/);
    // Le lendemain (heure de Paris), une nouvelle collecte par source.
    expect(await t.svc.vulnerabilites.veille.planifier(new Date('2026-11-16T23:30:00Z'))).toHaveLength(4);
    expect((await audits('vulnerabilites.veille.collecte.demandee')).at(-1)).toMatchObject({
      username: 'planification',
    });
  });

  it('module désactivé ou flux fermé : le tic n’inscrit rien', async () => {
    expect(await t.svc.vulnerabilites.veille.planifier()).toEqual([]);
    expect(await n('vulnerabilites_veille_sources')).toBe(0);
  });

  it('« Collecter maintenant » : une source déjà en file ou demandée depuis moins de quinze minutes n’est pas redemandée ; débit limité', async () => {
    await ouvrir();
    await t.svc.backups.heartbeat(true);
    const r = await rssi.post(`${base}/collectes`, {});
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().map((c: { source: string }) => c.source)).toEqual([
      'cisa-kev',
      'nvd',
      'epss',
      'cert-fr',
      'cert-sante',
    ]);
    const encore = await rssi.post(`${base}/collectes`, { source: 'nvd' });
    expect(encore.statusCode).toBe(409);
    // Collectes terminées, mais demandées il y a moins de quinze minutes : toujours refusé.
    await t.svc.db.q("UPDATE vulnerabilites_veille_collectes SET etat = 'echec', termine_le = now(), erreur = 'x'");
    expect((await rssi.post(`${base}/collectes`, { source: 'nvd' })).statusCode).toBe(409);
    await t.svc.db.q("UPDATE vulnerabilites_veille_collectes SET demande_le = now() - interval '16 minutes'");
    expect((await rssi.post(`${base}/collectes`, { source: 'nvd' })).statusCode).toBe(201);
    // Quatre demandes par heure et par personne.
    expect((await rssi.post(`${base}/collectes`, { source: 'nvd' })).statusCode).toBe(429);
  });
});
