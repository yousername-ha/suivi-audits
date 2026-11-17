/* Module Vulnérabilités (ADR 0100, lot ALH1) : surface externe lue dans AlgoLightHouse. Migration 080 sur base vierge,
   récepteur propre au type (Tenable et AlgoLightHouse cohabitent), cycle réclamation -> lots -> fin par la vraie CLI de
   l'exécutant, mandataire de l'établissement remis pour AlgoLightHouse et jamais pour Tenable, synchronisation rejouée sans
   doublon, alerte relue sans détail qui garde ses CVE, élément disparu gardé mais plus listé, synchronisation incomplète qui
   ne fait rien disparaître, champs hors liste blanche refusés, lecture par périmètre (périmètre ALH non relié réservé à
   l'administration du module, technologie lue par ses actifs), liaison des périmètres (administrer, If-Match, écriture sur
   les périmètres, journal sans adresse ni domaine), planification quotidienne, flux fermé, module désactivé. Données
   entièrement fictives : domaines en .example, adresses de 192.0.2.0/24 et 198.51.100.0/24, CVE fictives ; aucun service
   n'est joint. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, REPO, type TestApp } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

const S = '/api/vulnerabilites/surface';
const CLE_ALH = 'cle-api-fictive-0123456789abcdef';
const MOT_DE_PASSE_MANDATAIRE = 'Mdp-mandataire-fictif-73';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, rssi: Agent, roleRw: Agent, lecteurA: Agent, respA: Agent, respSans: Agent;
let perimA: string, perimB: string, instance: string, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const perimetre = (n: number, nom: string) => ({ type: 'perimetre', id: U(n), nom });
const hote = (n: number, perim: number | null, adresse: string, extra: Record<string, unknown> = {}) => ({
  type: 'hote',
  id: U(n),
  perimetre: perim === null ? null : U(perim),
  statut: 'monitored',
  adresse,
  fai: 'FAI fictif',
  asn: '64500',
  pays: 'FR',
  mutualise: false,
  cdn: false,
  joignable: true,
  joignableLe: '2026-11-16T07:00:00.000Z',
  importManuel: false,
  creeLe: '2026-06-10T14:00:00.000Z',
  majLe: null,
  ...extra,
});
const domaine = (n: number, perim: number | null, nom: string) => ({
  type: 'domaine',
  id: U(n),
  perimetre: perim === null ? null : U(perim),
  statut: 'monitored',
  domaine: nom,
  niveau: 2,
  importManuel: false,
  adresse: '192.0.2.10',
  parent: null,
  creeLe: '2026-02-01T10:11:01.000Z',
  majLe: null,
});
const alerte = (n: number, perim: number | null, extra: Record<string, unknown> = {}) => ({
  type: 'alerte',
  id: U(n),
  perimetre: perim === null ? null : U(perim),
  typeAlerte: 'vulnerable_service',
  criticite: 'critical',
  statut: 'untreated',
  titre: `Alerte fictive ${n}`,
  verifiee: true,
  detail: true,
  cibleType: 'host',
  cibleValeur: '192.0.2.10',
  cibleHote: U(11),
  cibleDomaine: null,
  cves: ['CVE-2026-91001', 'CVE-2026-91002'],
  creeLe: '2026-11-10T10:00:00.000Z',
  majLe: '2026-11-15T10:00:00.000Z',
  termineeLe: null,
  ...extra,
});
const technologie = (cle: string, nom: string) => ({
  type: 'technologie',
  cle,
  nom,
  editeur: 'F5',
  produit: nom,
  technologie: null,
  derniere: '2026-11-16T00:00:00.000Z',
  tronquee: false,
});
const lien = (cle: string, version: string, actif: number, typeActif: string, libelle: string, actuel = true) => ({
  type: 'technologie_actif',
  technologie: cle,
  version,
  actif: U(actif),
  typeActif,
  libelle,
  actuel,
});
const cveTechno = (cle: string, version: string, cve: string, extra: Record<string, unknown> = {}) => ({
  type: 'technologie_cve',
  technologie: cle,
  version,
  cve,
  titre: 'Faille fictive',
  cvss: 7.5,
  epss: 0.42,
  severite: 'high',
  preuve: true,
  exploitee: false,
  publieeLe: '2026-03-01T00:00:00.000Z',
  ...extra,
});
/** Espace fictif : périmètres ALH 1 (relié à A dans les tests de droits) et 2 (non relié par défaut) ; hôte 11 dans 1, hôte
    12 dans 2 ; domaine 21 dans 1 ; alertes 31 (1, critique), 32 (2, majeure, typosquatting), 33 (1, terminée) ;
    technologie nginx 1.18.0 sur l'hôte 11 (CVE 92001) et 1.20.0 sur l'hôte 12 seulement (CVE 92002, exploitée). */
const espace = (): Record<string, unknown>[] => [
  perimetre(1, 'Périmètre ALH fictif 1'),
  perimetre(2, 'Périmètre ALH fictif 2'),
  hote(11, 1, '192.0.2.10'),
  hote(12, 2, '198.51.100.20'),
  domaine(21, 1, 'www.exemple-fictif.example'),
  alerte(31, 1),
  alerte(32, 2, {
    typeAlerte: 'typosquatting',
    criticite: 'major',
    cibleType: 'domain',
    cibleValeur: 'exemple-fictif.example',
    cibleHote: null,
    cibleDomaine: null,
    cves: [],
  }),
  alerte(33, 1, { statut: 'completed', termineeLe: '2026-10-02T10:00:00.000Z', cves: [] }),
  technologie('f5|nginx|', 'nginx'),
  lien('f5|nginx|', '1.18.0', 11, 'hote', '192.0.2.10'),
  lien('f5|nginx|', '1.18.0', 21, 'domaine', 'www.exemple-fictif.example'),
  lien('f5|nginx|', '1.20.0', 12, 'hote', '198.51.100.20'),
  lien('f5|nginx|', '', 21, 'domaine', 'www.exemple-fictif.example', false),
  cveTechno('f5|nginx|', '1.18.0', 'CVE-2026-92001'),
  cveTechno('f5|nginx|', '1.20.0', 'CVE-2026-92002', { exploitee: true, cvss: 9.8 }),
];
const bilan = (elements: unknown[], extra: Record<string, unknown> = {}) => {
  const c = (t_: string) => elements.filter((e) => (e as { type: string }).type === t_).length;
  return {
    elements: elements.length,
    perimetres: c('perimetre'),
    hotes: c('hote'),
    domaines: c('domaine'),
    alertes: c('alerte'),
    details: elements.filter(
      (e) => (e as { type: string; detail?: boolean }).type === 'alerte' && (e as { detail: boolean }).detail,
    ).length,
    technologies: c('technologie'),
    ecartes: 0,
    tronque: false,
    ...extra,
  };
};
const n = async (table: string, where = 'true') =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;

/** Une synchronisation complète par le service : inscrite, réclamée, lots rangés, terminée. */
async function synchroniser(elements: unknown[], rapport?: unknown, lot = 500) {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  expect(job).toMatchObject({ type: 'algolighthouse', operation: 'synchroniser' });
  for (let i = 0; i < elements.length; i += lot)
    await t.svc.integrations.lot(job.id as string, elements.slice(i, i + lot));
  await t.svc.integrations.terminer(job.id as string, rapport ?? { ok: true, resultat: bilan(elements), erreur: null });
  return job.id as string;
}
const lierEnBase = (alh: number, perimetreId: string | null) =>
  t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(alh), perimetreId]);
const ligneAlh = async (alh: number) =>
  (await t.svc.db.one<{ id: string; version: number }>(
    'SELECT id, version FROM vulnerabilites_alh_perimetres WHERE alh_id = $1',
    [U(alh)],
  ))!;

/** Lance « suivi <commande> » comme l'exécutant, sur la base du test. */
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
    enfant.stdin.on('error', () => {});
    enfant.stdin.end(stdin);
  });
}

async function creerInstance(type: string, nom: string, configuration: Record<string, unknown>, secrets: object) {
  const r = await admin.post('/api/integrations/instances', { type, nom, configuration });
  expect(r.statusCode, r.body).toBe(201);
  const id = r.json().id as string;
  expect((await admin.put(`/api/integrations/instances/${id}/secrets`, secrets)).statusCode).toBe(204);
  const a = await admin.put(
    `/api/integrations/instances/${id}/activation`,
    { actif: true, fluxConfirme: true },
    ifMatch(r.json().version),
  );
  expect(a.statusCode, a.body).toBe(200);
  return id;
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'alh_admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'alh_rssi', 'rssi'));
  roleRw = await login(t, await makeUser(t, 'alh_rw', 'rw'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_alh_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_alh_adm', 'Vulnérabilités, administration', ARRAY['vulnerabilites:lire','vulnerabilites:modifier','vulnerabilites:administrer'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uLecteurA = await makeUser(t, 'alh_lecteur_a', 'r_alh_lire', { rattache: false });
  const uRespA = await makeUser(t, 'alh_resp_a', 'r_alh_adm', { rattache: false });
  const uRespSans = await makeUser(t, 'alh_resp_sans', 'r_alh_adm', { rattache: false });
  await t.svc.db.q(
    'INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false), ($1, $3, true), ($4, $3, false)',
    [perimA, uLecteurA.id, uRespA.id, perimB],
  );
  lecteurA = await login(t, uLecteurA);
  respA = await login(t, uRespA);
  respSans = await login(t, uRespSans);
  instance = await creerInstance(
    'algolighthouse',
    'AlgoLightHouse fictif',
    { adresse: 'https://espace-fictif.algolighthouse.fr' },
    { cleApi: CLE_ALH },
  );
  tenable = await creerInstance(
    'tenable',
    'Tenable fictif',
    { adresse: 'https://tenable.exemple.invalid' },
    { accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', secretKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0f' },
  );
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  for (const table of [
    'vulnerabilites_alh_technologie_cves',
    'vulnerabilites_alh_technologie_actifs',
    'vulnerabilites_alh_technologies',
    'vulnerabilites_alh_alerte_cves',
    'vulnerabilites_alh_alertes',
    'vulnerabilites_alh_actifs',
    'vulnerabilites_alh_perimetres',
    'vulnerabilites_alh_synchronisations',
    'vulnerabilites_alh_etat',
    'vulnerabilites_synchronisations',
    'vulnerabilites_tenable_etat',
    'integration_executions',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  t.svc.limits.integrationSynchro.reset();
});

describe('migration 080 sur base vierge', () => {
  it('crée les tables et borne les données en base', async () => {
    expect(
      (
        await t.svc.db.one(
          "SELECT 1 AS ok FROM schema_migrations WHERE name = '080_vulnerabilites_surface_externe.sql'",
        )
      )?.ok,
    ).toBe(1);
    const refus = (q: string, p: unknown[] = []) => expect(t.svc.db.q(q, p)).rejects.toThrow();
    const a = `INSERT INTO vulnerabilites_alh_alertes (integration_id, alh_id, statut, titre, vu_numero, type, criticite)
               VALUES ($1, $2, $3, $4, 1, $5, $6)`;
    await refus(a, [instance, U(1), 'ouverte', 'x', null, null]);
    await refus(a, [instance, U(1), 'untreated', 'x\ny', null, null]);
    await refus(a, [instance, U(1), 'untreated', 'x', 'phishing', null]);
    await refus(a, [instance, U(1), 'untreated', 'x', null, 'high']);
    const x = `INSERT INTO vulnerabilites_alh_actifs (integration_id, type, alh_id, valeur, vu_numero, niveau) VALUES ($1, $2, $3, $4, 1, $5)`;
    await refus(x, [instance, 'service', U(1), '192.0.2.1', null]);
    await refus(x, [instance, 'domaine', U(1), 'Majuscules.example', null]);
    await refus(x, [instance, 'hote', U(1), '192.0.2.1', 2]);
    await refus(
      `INSERT INTO vulnerabilites_alh_technologie_cves (technologie_id, version, cve, epss) VALUES (gen_random_uuid(), '', 'CVE-2026-1', 0.5)`,
    );
  });
});

describe('réception par lots', () => {
  it('un récepteur par type : Tenable et AlgoLightHouse cohabitent, chacun range dans ses tables', async () => {
    await synchroniser(espace());
    expect(await n('vulnerabilites_alh_alertes')).toBe(3);
    expect(await n('vulnerabilites_alh_actifs')).toBe(3);
    expect(await n('vulnerabilites_alh_technologie_actifs')).toBe(4);
    expect(await n('vulnerabilites_alh_alerte_cves')).toBe(2);
    expect(await n('vulnerabilites_synchronisations')).toBe(0);
    // Une synchronisation de Tenable est reçue par le récepteur de Tenable : ses éléments sont refusés par celui d'ALH.
    await t.svc.db.q(
      "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
      [tenable],
    );
    const job = (await t.svc.integrations.reclamer(true))!;
    expect(job.type).toBe('tenable');
    expect(await n('vulnerabilites_synchronisations')).toBe(1);
    await expect(t.svc.integrations.lot(job.id as string, [perimetre(1, 'x')])).rejects.toMatchObject({ status: 422 });
  });

  it('rejouée : sans doublon ; une alerte relue sans détail garde sa cible et ses CVE ; une technologie relue remplace ses liens', async () => {
    await synchroniser(espace());
    const sansDetail = espace().map((e) =>
      e.type === 'alerte'
        ? { ...e, detail: false, cves: [], cibleType: null, cibleValeur: null, typeAlerte: null, statut: 'in-progress' }
        : e,
    );
    await synchroniser(
      sansDetail.filter((e) => !(e.type === 'technologie_actif' && e.version === '1.20.0')),
      undefined,
      4,
    );
    expect(await n('vulnerabilites_alh_alertes')).toBe(3);
    const a = (await t.svc.db.one<{ type: string; statut: string; cible_valeur: string; detail: boolean }>(
      'SELECT type, statut, cible_valeur, detail FROM vulnerabilites_alh_alertes WHERE alh_id = $1',
      [U(31)],
    ))!;
    expect(a).toEqual({ type: 'vulnerable_service', statut: 'in-progress', cible_valeur: '192.0.2.10', detail: true });
    expect(await n('vulnerabilites_alh_alerte_cves')).toBe(2);
    expect(await n('vulnerabilites_alh_technologie_actifs')).toBe(3);
    expect(await n('vulnerabilites_alh_perimetres')).toBe(2);
  });

  it('élément hors liste blanche, champ sensible ou lien vers une technologie inconnue : tout le lot est refusé', async () => {
    const refuse = async (elements: unknown[], motif: RegExp) => {
      await t.svc.db.q(
        "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
        [instance],
      );
      const job = (await t.svc.integrations.reclamer(true))!;
      await expect(t.svc.integrations.lot(job.id as string, elements)).rejects.toThrow(motif);
      await t.svc.integrations.terminer(job.id as string, { ok: false, resultat: null, erreur: 'Lot refusé.' });
    };
    await refuse([perimetre(1, 'ok'), { ...alerte(31, 1), note: '<p>texte</p>' }], /Élément 2 du lot refusé/);
    await refuse([{ ...alerte(31, 1), sensitive_data: { x: 1 } }], /Élément 1/);
    await refuse([alerte(31, 1, { detail: false })], /Élément 1/);
    await refuse([alerte(31, 1, { titre: 'Titre <script>' })], /Élément 1/);
    await refuse([hote(11, 1, '192.0.2.10, 192.0.2.11')], /Élément 1/);
    await refuse([lien('inconnue', '1', 11, 'hote', '192.0.2.10')], /technologie inconnue/);
    expect(await n('vulnerabilites_alh_alertes')).toBe(0);
    expect(await n('vulnerabilites_alh_perimetres')).toBe(0);
  });

  it('disparu d’une synchronisation complète : gardé mais plus listé ; une synchronisation incomplète ne fait rien disparaître', async () => {
    await synchroniser(espace());
    const sauf31 = espace().filter((e) => e.id !== U(31));
    await synchroniser(sauf31, { ok: true, resultat: bilan(sauf31, { tronque: true }), erreur: null });
    let ids = (await rssi.get(`${S}/alertes?statut=toutes`)).json().elements.map((a: { titre: string }) => a.titre);
    expect(ids).toContain('Alerte fictive 31');
    await synchroniser(sauf31);
    ids = (await rssi.get(`${S}/alertes?statut=toutes`)).json().elements.map((a: { titre: string }) => a.titre);
    expect(ids).not.toContain('Alerte fictive 31');
    expect(await n('vulnerabilites_alh_alertes')).toBe(3);
    // Bilan incohérent : la synchronisation échoue et ne fait pas foi.
    const id = await synchroniser(espace(), { ok: true, resultat: bilan(espace(), { elements: 99 }), erreur: null });
    const e = (await t.svc.db.one<{ etat: string; erreur: string }>(
      'SELECT etat, erreur FROM integration_executions WHERE id = $1',
      [id],
    ))!;
    expect(e).toMatchObject({ etat: 'echec' });
    expect(e.erreur).toMatch(/Bilan incohérent/);
  });
});

describe('lecture par périmètre', () => {
  it('périmètre ALH non relié : visible de l’administration du module seulement', async () => {
    await synchroniser(espace());
    for (const url of [`${S}/alertes`, `${S}/actifs`, `${S}/technologies`])
      expect((await lecteurA.get(url)).json().total, url).toBe(0);
    const r = await respSans.get(`${S}/alertes`);
    expect(r.statusCode).toBe(200);
    expect(r.json().elements.map((a: { titre: string }) => a.titre)).toEqual([
      'Alerte fictive 31',
      'Alerte fictive 32',
    ]);
    expect(r.json().elements[0]).toMatchObject({
      type: 'vulnerable_service',
      criticite: 'critical',
      statut: 'untreated',
      cible: { type: 'host', valeur: '192.0.2.10' },
      cves: ['CVE-2026-91001', 'CVE-2026-91002'],
      perimetreAlh: 'Périmètre ALH fictif 1',
      perimetreNom: null,
    });
    // Le nombre de périmètres non reliés n'est donné qu'avec administrer.
    expect((await respSans.get(`${S}/etat`)).json()[0].perimetresNonRelies).toBe(2);
    expect((await lecteurA.get(`${S}/etat`)).json()[0].perimetresNonRelies).toBeNull();
  });

  it('périmètre relié : hérite du périmètre de la plateforme ; une technologie se lit par ses actifs', async () => {
    await synchroniser(espace());
    await lierEnBase(1, perimA);
    await lierEnBase(2, perimB);
    const alertes = (await lecteurA.get(`${S}/alertes`)).json();
    expect(alertes.elements.map((a: { titre: string }) => a.titre)).toEqual(['Alerte fictive 31']);
    expect(alertes.elements[0].perimetreNom).toBe('Périmètre fictif A');
    expect((await lecteurA.get(`${S}/alertes?statut=toutes`)).json().total).toBe(2);
    expect((await lecteurA.get(`${S}/alertes?statut=completed`)).json().total).toBe(1);
    expect((await lecteurA.get(`${S}/alertes?q=cve-2026-91002`)).json().total).toBe(1);
    expect((await lecteurA.get(`${S}/alertes?type=typosquatting`)).json().total).toBe(0);
    const actifs = (await lecteurA.get(`${S}/actifs`)).json();
    expect(actifs.elements.map((x: { valeur: string }) => x.valeur)).toEqual([
      '192.0.2.10',
      'www.exemple-fictif.example',
    ]);
    expect(actifs.elements[0]).toMatchObject({ type: 'hote', alertesOuvertes: 1, technologies: 1, pays: 'FR' });
    expect((await lecteurA.get(`${S}/actifs?type=domaine`)).json().total).toBe(1);
    // nginx : seule la version 1.18.0 tourne sur un actif lisible ; la CVE exploitée de 1.20.0 (hôte du périmètre B) ne
    // sort ni dans la liste ni dans les compteurs.
    const techno = (await lecteurA.get(`${S}/technologies`)).json();
    expect(techno.total).toBe(1);
    expect(techno.elements[0]).toMatchObject({ nom: 'nginx', nombreCves: 1, exploitees: 0, preuves: 1, cvssMax: 7.5 });
    expect(techno.elements[0].versions).toEqual([
      {
        version: '1.18.0',
        actifs: [
          { type: 'domaine', libelle: 'www.exemple-fictif.example' },
          { type: 'hote', libelle: '192.0.2.10' },
        ],
        cves: [expect.objectContaining({ cve: 'CVE-2026-92001', epss: 0.42, cvss: 7.5, exploitee: false })],
      },
    ]);
    expect(JSON.stringify(techno)).not.toContain('CVE-2026-92002');
    expect(JSON.stringify(techno)).not.toContain('198.51.100.20');
    expect((await lecteurA.get(`${S}/technologies?exploitee=oui`)).json().total).toBe(0);
    expect((await lecteurA.get(`${S}/technologies?q=CVE-2026-92002`)).json().total).toBe(0);
    // Avec les deux périmètres, la CVE exploitée apparaît.
    const tout = (await admin.get(`${S}/technologies?exploitee=oui`)).json();
    expect(tout.elements[0]).toMatchObject({ exploitees: 1, cvssMax: 9.8 });
  });

  it('droits par défaut : contributeur refusé ; liste des périmètres ALH réservée à administrer', async () => {
    await synchroniser(espace());
    for (const url of [`${S}/alertes`, `${S}/actifs`, `${S}/technologies`, `${S}/etat`, `${S}/perimetres`])
      expect((await roleRw.get(url)).statusCode, url).toBe(403);
    expect((await lecteurA.get(`${S}/perimetres`)).statusCode).toBe(403);
    expect((await rssi.get(`${S}/perimetres`)).statusCode).toBe(200);
    const p = (await respA.get(`${S}/perimetres`)).json();
    expect(p.map((x: { nom: string }) => x.nom)).toEqual(['Périmètre ALH fictif 1', 'Périmètre ALH fictif 2']);
    expect(p[0]).toMatchObject({ perimetreId: null, present: true, alertes: 2, actifs: 2, version: 1 });
  });
});

describe('liaison des périmètres ALH', () => {
  it('administrer, If-Match, écriture sur le périmètre visé ; journal sans adresse ni domaine', async () => {
    await synchroniser(espace());
    const l = await ligneAlh(1);
    expect(
      (await lecteurA.put(`${S}/perimetres/${l.id}`, { perimetreId: perimA }, ifMatch(l.version))).statusCode,
    ).toBe(403);
    expect((await respA.put(`${S}/perimetres/${l.id}`, { perimetreId: perimA })).statusCode).toBe(428);
    expect((await respA.put(`${S}/perimetres/${l.id}`, { perimetreId: perimA }, ifMatch(9))).statusCode).toBe(412);
    // Lecture seule sur B : la liaison vers B est refusée.
    const b = await respA.put(`${S}/perimetres/${l.id}`, { perimetreId: perimB }, ifMatch(l.version));
    expect(b.statusCode).toBe(403);
    // Sans accès au périmètre visé : il est introuvable pour cette personne (même règle que les machines de Tenable).
    const sans = await respSans.put(`${S}/perimetres/${l.id}`, { perimetreId: perimA }, ifMatch(l.version));
    expect(sans.statusCode).toBe(422);
    expect(sans.json().error).toMatch(/introuvable ou non accessible/);
    const r = await respA.put(`${S}/perimetres/${l.id}`, { perimetreId: perimA }, ifMatch(l.version));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe('"2"');
    expect(r.json()).toMatchObject({ perimetreId: perimA, perimetreNom: 'Périmètre fictif A', version: 2 });
    expect((await lecteurA.get(`${S}/alertes`)).json().total).toBe(1);
    // Une synchronisation ne touche pas la liaison.
    await synchroniser(espace());
    expect((await ligneAlh(1)).version).toBe(2);
    expect((await lecteurA.get(`${S}/alertes`)).json().total).toBe(1);
    // Délier : retour à l'administration du module seule.
    const d = await respA.put(`${S}/perimetres/${l.id}`, { perimetreId: null }, ifMatch(2));
    expect(d.statusCode, d.body).toBe(200);
    expect((await lecteurA.get(`${S}/alertes`)).json().total).toBe(0);
    expect((await respA.put(`${S}/perimetres/${l.id}`, { perimetreId: U(999) }, ifMatch(3))).statusCode).toBe(422);
    const journal = [
      ...(await audits('vulnerabilites.surface.perimetre.relie')),
      ...(await audits('vulnerabilites.surface.perimetre.delie')),
      ...(await audits('vulnerabilites.surface.synchronisation.terminee')),
    ];
    expect(journal.length).toBeGreaterThanOrEqual(4);
    const texte = JSON.stringify(journal);
    for (const interdit of ['192.0.2.10', '198.51.100.20', 'exemple-fictif.example', 'Alerte fictive', CLE_ALH])
      expect(texte).not.toContain(interdit);
  });
});

describe('exécutant, mandataire, planification', () => {
  it('CLI : AlgoLightHouse reçoit le mandataire actif, Tenable jamais ; lots et fin par la CLI', async () => {
    const lu = await t.svc.mandataire.lire();
    await t.svc.mandataire.ecrire(
      {
        actif: true,
        adresse: 'http://mandataire.exemple.invalid:3128',
        identifiant: 'compte-fictif',
        autoriteCertification: '',
      },
      lu.version,
      SYSTEME,
      '127.0.0.1',
    );
    await t.svc.mandataire.definirMotDePasse(MOT_DE_PASSE_MANDATAIRE, SYSTEME, '127.0.0.1');
    try {
      const d = await rssi.post(`/api/integrations/instances/${instance}/synchroniser`);
      expect(d.statusCode, d.body).toBe(201);
      const claim = await cli(['integrations-claim']);
      expect(claim.code, claim.err).toBe(0);
      const job = JSON.parse(claim.out);
      expect(job).toMatchObject({
        id: d.json().id,
        type: 'algolighthouse',
        operation: 'synchroniser',
        secrets: { cleApi: CLE_ALH },
        mandataire: {
          hote: 'mandataire.exemple.invalid',
          port: 3128,
          identifiant: 'compte-fictif',
          motDePasse: MOT_DE_PASSE_MANDATAIRE,
        },
      });
      const elements = espace();
      const lot = await cli(['integrations-lot', job.id], JSON.stringify({ elements }));
      expect(lot.code, lot.err).toBe(0);
      expect(JSON.parse(lot.out)).toEqual({ elements: elements.length, lots: 1 });
      const fin = await cli(
        ['integrations-finish', job.id],
        JSON.stringify({ ok: true, resultat: bilan(elements), erreur: null }),
      );
      expect(fin.code, fin.err).toBe(0);
      expect((await rssi.get(`${S}/etat`)).json()[0]).toMatchObject({
        derniere: { etat: 'recu', bilan: { alertes: 3, technologies: 1 } },
      });
      // Tenable : jamais de mandataire.
      t.svc.limits.integrationSynchro.reset();
      expect((await rssi.post(`/api/integrations/instances/${tenable}/tester`)).statusCode).toBe(201);
      const claimT = await cli(['integrations-claim']);
      expect(JSON.parse(claimT.out).type).toBe('tenable');
      expect(claimT.out).not.toContain('mandataire');
      expect(claimT.out).not.toContain(MOT_DE_PASSE_MANDATAIRE);
      // Mot de passe jamais au journal.
      const j = await t.svc.db.q<{ details: unknown }>('SELECT details FROM audit_log');
      expect(JSON.stringify(j.rows)).not.toContain(MOT_DE_PASSE_MANDATAIRE);
    } finally {
      const apres = await t.svc.mandataire.lire();
      await t.svc.mandataire.ecrire(
        { actif: false, adresse: '', identifiant: '', autoriteCertification: '' },
        apres.version,
        SYSTEME,
        '127.0.0.1',
      );
    }
  });

  it('une synchronisation par jour ; flux fermé : rien ; module désactivé : routes refusées', async () => {
    const jour = new Date('2026-11-17T08:00:00Z');
    expect(await t.svc.vulnerabilites.surfaceExterne.planifier(jour)).toHaveLength(1);
    await t.svc.db.q("UPDATE integration_executions SET etat = 'expire', termine_le = now(), erreur = 'x'");
    expect(await t.svc.vulnerabilites.surfaceExterne.planifier(jour)).toEqual([]);
    expect(await t.svc.vulnerabilites.surfaceExterne.planifier(new Date('2026-11-18T08:00:00Z'))).toHaveLength(1);
    await t.svc.db.q('DELETE FROM integration_executions');
    await t.svc.flux.changer('algolighthouse', false, SYSTEME, '127.0.0.1');
    expect(await t.svc.vulnerabilites.surfaceExterne.planifier(new Date('2026-11-19T08:00:00Z'))).toEqual([]);
    expect((await rssi.post(`/api/integrations/instances/${instance}/synchroniser`)).json().reason).toBe('flux_ferme');
    await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['vulnerabilites'], version = version + 1 WHERE id=1",
    );
    for (const r of [await admin.get(`${S}/alertes`), await admin.get(`${S}/perimetres`)]) {
      expect(r.statusCode).toBe(409);
      expect(r.json()).toMatchObject({ reason: 'module_disabled', module: 'vulnerabilites' });
    }
  });
});
