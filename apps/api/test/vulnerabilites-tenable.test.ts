/* Module Vulnérabilités (ADR 0100, lot V5) : failles et machines lues dans Tenable Security Center. Migration 075 sur base
   vierge, droits par défaut resserrés, module désactivé, flux fermé, cycle réclamation -> lots -> fin par la vraie CLI de
   l'exécutant, synchronisation rejouée sans doublon, détection disparue gardée mais plus comptée, synchronisation
   interrompue ou incomplète qui ne fait rien disparaître, inventaire en échec toléré, score EPSS entre 0 et 1, constat sans
   CVE (non maintenu), jointure avec le catalogue KEV de la veille, lecture par périmètre (machines sans périmètre réservées
   à l'administration du module), compteurs limités aux machines lisibles, affectation unitaire et en masse, journal sans
   nom ni adresse de machine, planification quotidienne et « Synchroniser maintenant ». Données entièrement fictives : noms
   en .invalid, adresses de 192.0.2.0/24, identifiants de CVE fictifs ; aucun service n'est joint. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, REPO, type TestApp, type TestUser } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

const V = '/api/vulnerabilites';
const CLE_ACCES = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CLE_SECRETE = 'f0e1d2c3b4a5968778695a4b3c2d1e0f';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, rssi: Agent, roleRw: Agent, roleRo: Agent, sansRole: Agent;
let lecteurA: Agent, editeurA: Agent, respVuln: Agent;
let uLecteurA: TestUser, uEditeurA: TestUser;
let perimA: string, perimB: string, instance: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000000${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-exemple-${String(n).padStart(2, '0')}.exemple.invalid`;
const adresse = (n: number) => `192.0.2.${10 + n}`;
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: nomMachine(n),
  adresse: adresse(n),
  systeme: 'Linux Kernel 5.14 on Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
const constat = (plugin: string, extra: Record<string, unknown> = {}) => ({
  type: 'constat',
  plugin,
  nom: `Exemple Linux : contrôle fictif ${plugin}`,
  gravite: 'critique',
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Update the affected packages.',
  cvss3Vecteur: 'AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H',
  cvss3Score: 9.1,
  vpr: 5,
  epss: 0.0056,
  exploitable: true,
  exploitLibelle: 'Exploits are available',
  failleLe: '2026-07-14T12:00:00.000Z',
  correctifLe: '2026-07-14T12:00:00.000Z',
  finSupportLe: null,
  voirAussi: 'https://example.org/advisory',
  cves: ['CVE-2026-90001', 'CVE-2026-90002'],
  cvesTronquees: false,
  ...extra,
});
const detection = (plugin: string, n: number, extra: Record<string, unknown> = {}) => ({
  type: 'detection',
  plugin,
  machine: `uuid:${uuidMachine(n)}`,
  port: 0,
  protocole: 'TCP',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  attenue: false,
  risqueAccepte: false,
  risqueRequalifie: false,
  ...extra,
});
const bilan = (elements: unknown[], extra: Record<string, unknown> = {}) => {
  const n = (t_: string) => elements.filter((e) => (e as { type: string }).type === t_).length;
  return {
    elements: elements.length,
    pages: 1,
    constats: n('constat'),
    detections: n('detection'),
    machines: n('machine'),
    hotes: n('hote'),
    ecartes: 0,
    tronque: false,
    inventaire: { ok: true, erreur: null },
    ...extra,
  };
};
/** Parc fictif : trois machines (1, 2, 3), deux contrôles. 900001 sur 1 et 2 ; 900002 (sans CVE) sur 3. */
const parc = (): Record<string, unknown>[] => [
  machine(1),
  machine(2),
  machine(3),
  constat('900001'),
  constat('900002', { cves: [], gravite: 'elevee', finSupportLe: '2025-01-01T00:00:00.000Z', exploitable: false }),
  detection('900001', 1),
  detection('900001', 2),
  detection('900002', 3),
];
const n = async (table: string, where = 'true') =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;

/** Une synchronisation complète par le service : inscrite, réclamée, lots rangés, terminée. Renvoie son identifiant. */
async function synchroniser(elements: unknown[], rapport?: unknown, lot = 500) {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  expect(job.operation).toBe('synchroniser');
  for (let i = 0; i < elements.length; i += lot)
    await t.svc.integrations.lot(job.id as string, elements.slice(i, i + lot));
  await t.svc.integrations.terminer(job.id as string, rapport ?? { ok: true, resultat: bilan(elements), erreur: null });
  return job.id as string;
}
const machineId = async (k: number) =>
  (await t.svc.db.one<{ id: string; version: number }>(
    'SELECT id, version FROM vulnerabilites_machines WHERE identifiant_source = $1',
    [`uuid:${uuidMachine(k)}`],
  ))!;
const placer = (k: number, perimetre: string | null) =>
  t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE identifiant_source = $1', [
    `uuid:${uuidMachine(k)}`,
    perimetre,
  ]);

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
    enfant.stdin.on('error', () => {});
    enfant.stdin.end(stdin);
  });
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'tenable_admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'tenable_rssi', 'rssi'));
  roleRw = await login(t, await makeUser(t, 'tenable_rw', 'rw'));
  roleRo = await login(t, await makeUser(t, 'tenable_ro', 'ro'));
  sansRole = await login(t, await makeUser(t, 'tenable_sans_role', null));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_tn_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_tn_modif', 'Vulnérabilités, modification', ARRAY['vulnerabilites:lire','vulnerabilites:modifier']),
       ('r_tn_adm', 'Vulnérabilités, administration', ARRAY['vulnerabilites:lire','vulnerabilites:modifier','vulnerabilites:administrer'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  uLecteurA = await makeUser(t, 'tenable_lecteur_a', 'r_tn_lire', { rattache: false });
  uEditeurA = await makeUser(t, 'tenable_editeur_a', 'r_tn_modif', { rattache: false });
  const uResp = await makeUser(t, 'tenable_resp', 'r_tn_adm', { rattache: false });
  await t.svc.db.q(
    'INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, false), ($1, $4, true), ($2, $4, false)',
    [perimA, perimB, uLecteurA.id, uEditeurA.id],
  );
  lecteurA = await login(t, uLecteurA);
  editeurA = await login(t, uEditeurA);
  respVuln = await login(t, uResp);
  // Instance Tenable active, clés enregistrées, flux ouvert.
  const r = await admin.post('/api/integrations/instances', {
    type: 'tenable',
    nom: 'Tenable fictif',
    configuration: { adresse: 'https://tenable.exemple.invalid' },
  });
  instance = r.json().id as string;
  await admin.put(`/api/integrations/instances/${instance}/secrets`, { accessKey: CLE_ACCES, secretKey: CLE_SECRETE });
  const a = await admin.put(
    `/api/integrations/instances/${instance}/activation`,
    { actif: true, fluxConfirme: true },
    ifMatch(r.json().version),
  );
  expect(a.statusCode, a.body).toBe(200);
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  for (const table of [
    'vulnerabilites_detections',
    'vulnerabilites_constat_cves',
    'vulnerabilites_constats',
    'vulnerabilites_machines',
    'vulnerabilites_synchronisations',
    'vulnerabilites_tenable_etat',
    'integration_executions',
    'vulnerabilites_veille_cve',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  t.svc.limits.integrationSynchro.reset();
});

describe('migration 075 sur base vierge', () => {
  it('crée les tables et borne les données en base', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '075_vulnerabilites_tenable.sql'"))?.ok,
    ).toBe(1);
    for (const table of [
      'vulnerabilites_machines',
      'vulnerabilites_constats',
      'vulnerabilites_constat_cves',
      'vulnerabilites_detections',
      'vulnerabilites_tenable_etat',
      'vulnerabilites_synchronisations',
    ])
      expect(await n(table)).toBe(0);
    const refus = (q: string, p: unknown[] = []) => expect(t.svc.db.q(q, p)).rejects.toThrow();
    const m = `INSERT INTO vulnerabilites_machines (integration_id, identifiant_source, vu_numero, role, nom) VALUES ($1, $2, 1, $3, $4)`;
    await refus(m, [instance, 'nimporte', null, null]);
    await refus(m, [instance, 'ip:192.0.2.1', 'proxy', null]);
    await refus(m, [instance, 'ip:192.0.2.1', null, 'NOM<script>']);
    const c = `INSERT INTO vulnerabilites_constats (integration_id, plugin_id, nom, gravite, exploitable, vu_numero, epss_score, voir_aussi)
               VALUES ($1, 1, 'x', $2, false, 1, $3, $4)`;
    await refus(c, [instance, 'info', null, null]);
    await refus(c, [instance, 'critique', 56, null]);
    await refus(c, [instance, 'critique', null, 'http://example.org/']);
    await refus(c, [instance, 'critique', null, 'https://example.org/"x']);
  });
});

describe('droits, module et flux', () => {
  it('droits par défaut resserrés : administrateur et RSSI ; contributeur et lecteur prédéfinis refusés', async () => {
    await synchroniser(parc());
    for (const url of [`${V}/constats`, `${V}/machines`, `${V}/synchronisation`])
      for (const a of [roleRw, roleRo, sansRole]) expect((await a.get(url)).statusCode, url).toBe(403);
    for (const a of [admin, rssi]) expect((await a.get(`${V}/constats`)).statusCode).toBe(200);
    expect((await lecteurA.get(`${V}/machines`)).statusCode).toBe(200);
    const m = await machineId(1);
    expect((await lecteurA.patch(`${V}/machines/${m.id}`, { role: 'front' }, ifMatch(m.version))).statusCode).toBe(403);
    expect((await lecteurA.post(`${V}/machines/affectation`, { machines: [m], role: 'front' })).statusCode).toBe(403);
    expect((await lecteurA.get(`${V}/perimetres`)).statusCode).toBe(403);
    // « Synchroniser maintenant » relève du module Intégrations.
    for (const a of [roleRw, lecteurA])
      expect((await a.post(`/api/integrations/instances/${instance}/synchroniser`)).statusCode).toBe(403);
  });

  it('module Vulnérabilités désactivé : routes refusées, rien n’est inscrit ni réclamé', async () => {
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['vulnerabilites'], version = version + 1 WHERE id=1",
    );
    for (const r of [
      await admin.get(`${V}/constats`),
      await admin.get(`${V}/machines`),
      await admin.get(`${V}/synchronisation`),
      await admin.post(`/api/integrations/instances/${instance}/synchroniser`),
    ]) {
      expect(r.statusCode).toBe(409);
      expect(r.json()).toMatchObject({ reason: 'module_disabled', module: 'vulnerabilites' });
    }
    expect(await n('integration_executions')).toBe(0);
    // Une synchronisation en file est close sans appel ; un test de connexion reste réclamable.
    await t.svc.db.q(
      "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'planifie', 't')",
      [instance],
    );
    const claim = await cli(['integrations-claim']);
    expect(claim.code, claim.err).toBe(0);
    expect(claim.out.trim()).toBe('');
    const e = (await t.svc.db.one<{ etat: string; erreur: string }>(
      'SELECT etat, erreur FROM integration_executions',
    ))!;
    expect(e.etat).toBe('echec');
    expect(e.erreur).toMatch(/Module destinataire désactivé/);
    expect(await n('vulnerabilites_synchronisations')).toBe(0);
  });

  it('flux fermé : rien n’est planifié, rien n’est réclamé', async () => {
    await t.svc.flux.changer('tenable', false, SYSTEME, '127.0.0.1');
    expect(await t.svc.vulnerabilites.tenable.planifier()).toEqual([]);
    expect(await n('integration_executions')).toBe(0);
    expect((await rssi.post(`/api/integrations/instances/${instance}/synchroniser`)).json().reason).toBe('flux_ferme');
    await t.svc.db.q(
      "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 't')",
      [instance],
    );
    expect(await t.svc.integrations.reclamer(true)).toBeNull();
    expect(await n('integration_executions', "etat = 'echec'")).toBe(1);
  });
});

describe('synchronisation par la CLI de l’exécutant', () => {
  it('réclamation, lots validés (un élément refusé : tout le lot), fin ; journal sans nom ni adresse', async () => {
    const d = await rssi.post(`/api/integrations/instances/${instance}/synchroniser`);
    expect(d.statusCode, d.body).toBe(201);
    expect(d.json()).toMatchObject({ operation: 'synchroniser', origine: 'manuel', etat: 'en_file' });
    const claim = await cli(['integrations-claim']);
    expect(claim.code, claim.err).toBe(0);
    const job = JSON.parse(claim.out);
    expect(job).toMatchObject({
      id: d.json().id,
      type: 'tenable',
      operation: 'synchroniser',
      configuration: { gravites: ['critique', 'elevee'] },
    });
    const elements = parc();
    for (const mauvais of [
      { elements: [machine(1), { ...constat('900001'), pluginText: 'texte de sortie fictif' }] },
      { elements: [constat('900001', { epss: 56 })] },
      { elements: [detection('900099', 1)] },
      { elements: [] },
      { elements: [machine(1)], autre: 1 },
    ]) {
      const r = await cli(['integrations-lot', job.id], JSON.stringify(mauvais));
      expect(r.code, JSON.stringify(mauvais).slice(0, 80)).toBe(2);
    }
    expect(await n('vulnerabilites_machines')).toBe(0);
    expect(await n('vulnerabilites_constats')).toBe(0);
    const l1 = await cli(['integrations-lot', job.id], JSON.stringify({ elements: elements.slice(0, 5) }));
    expect(l1.code, l1.err).toBe(0);
    expect(JSON.parse(l1.out)).toEqual({ elements: 5, lots: 1 });
    const l2 = await cli(['integrations-lot', job.id], JSON.stringify({ elements: elements.slice(5) }));
    expect(JSON.parse(l2.out)).toEqual({ elements: 8, lots: 2 });
    const fin = await cli(
      ['integrations-finish', job.id],
      JSON.stringify({ ok: true, resultat: bilan(elements), erreur: null }),
    );
    expect(fin.code, fin.err).toBe(0);
    expect((await cli(['integrations-lot', job.id], JSON.stringify({ elements: [machine(4)] }))).code).toBe(1);
    const ex = (await admin.get(`/api/integrations/executions/${job.id}`)).json();
    expect(ex).toMatchObject({ etat: 'recu', resultat: { constats: 2, detections: 3, machines: 3, elements: 8 } });
    expect((await audits('vulnerabilites.synchronisation.terminee')).at(-1)!.details).toMatchObject({
      integration: instance,
      numero: 1,
      lots: 2,
      complete: true,
      etat: 'recu',
    });
    const etat = (await rssi.get(`${V}/synchronisation`)).json();
    expect(etat).toEqual([
      expect.objectContaining({
        integrationId: instance,
        gravites: ['critique', 'elevee'],
        derniere: expect.objectContaining({ etat: 'recu', bilan: expect.objectContaining({ constats: 2 }) }),
        inventaire: expect.objectContaining({ ok: true }),
      }),
    ]);
    expect(etat[0].derniereCompleteLe).not.toBeNull();
    // Journal : identifiants et nombres seulement, jamais un nom ni une adresse de machine.
    const journal = JSON.stringify((await t.svc.db.q('SELECT action, target, details FROM audit_log')).rows);
    expect(journal).not.toMatch(/srv-exemple|poste-0|192\.0\.2\./);
    expect(journal).not.toContain(CLE_SECRETE);
  }, 120_000);

  it('une synchronisation rejouée met à jour sans doublon ; une détection disparue est gardée mais plus comptée', async () => {
    await synchroniser(parc());
    await synchroniser(parc(), undefined, 3);
    expect([
      await n('vulnerabilites_machines'),
      await n('vulnerabilites_constats'),
      await n('vulnerabilites_constat_cves'),
      await n('vulnerabilites_detections'),
    ]).toEqual([3, 2, 2, 3]);
    const avant = (await admin.get(`${V}/constats?q=900001`)).json().elements[0];
    expect(avant.machines).toBe(2);
    // Troisième synchronisation, complète : 900001 n'est plus vu sur la machine 2.
    const sans2 = parc().filter((e) => !(e.type === 'detection' && e.machine === `uuid:${uuidMachine(2)}`));
    await synchroniser(sans2);
    expect(await n('vulnerabilites_detections')).toBe(3);
    expect((await admin.get(`${V}/constats?q=900001`)).json().elements[0].machines).toBe(1);
    const m2 = (await admin.get(`${V}/machines?q=srv-exemple-02`)).json().elements[0];
    expect(m2.compteurs).toMatchObject({ critique: 0, elevee: 0 });
    // Le contrôle 900002 disparaît partout : il n'est plus listé, mais il reste en base.
    await synchroniser(sans2.filter((e) => e.plugin !== '900002'));
    expect(await n('vulnerabilites_constats')).toBe(2);
    expect((await admin.get(`${V}/constats`)).json().total).toBe(1);
  });

  it('synchronisation interrompue, incomplète ou incohérente : rien ne disparaît', async () => {
    await synchroniser(parc());
    const machine1Seule = [machine(1), constat('900001'), detection('900001', 1)];
    // Interrompue : un lot reçu, puis échec.
    await synchroniser(machine1Seule, { ok: false, resultat: null, erreur: 'Délai dépassé.' });
    // Incomplète : une borne atteinte (tronque).
    await synchroniser(machine1Seule, { ok: true, resultat: bilan(machine1Seule, { tronque: true }), erreur: null });
    // Incohérente : moins d'éléments reçus qu'annoncés.
    const id = await synchroniser(machine1Seule, {
      ok: true,
      resultat: { ...bilan(machine1Seule), elements: 9 },
      erreur: null,
    });
    const ex = (await admin.get(`/api/integrations/executions/${id}`)).json();
    expect(ex.etat).toBe('echec');
    expect(ex.erreur).toMatch(/Bilan incohérent/);
    const l = (await admin.get(`${V}/constats`)).json();
    expect(l.total).toBe(2);
    expect(l.elements.find((c: { plugin: string }) => c.plugin === '900001').machines).toBe(2);
    expect(await n('vulnerabilites_synchronisations', 'complete')).toBe(1);
    expect((await audits('vulnerabilites.synchronisation.terminee')).slice(-4).map((a) => a.details.complete)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('inventaire en échec toléré ; inventaire réussi : machine connue complétée, machine nouvelle ajoutée', async () => {
    const id = await synchroniser(parc(), {
      ok: true,
      resultat: bilan(parc(), {
        inventaire: { ok: false, erreur: 'Inventaire des machines indisponible : code 403.' },
      }),
      erreur: null,
    });
    expect((await admin.get(`/api/integrations/executions/${id}`)).json().etat).toBe('recu');
    expect((await admin.get(`${V}/synchronisation`)).json()[0].inventaire).toMatchObject({
      ok: false,
      erreur: 'Inventaire des machines indisponible : code 403.',
    });
    expect(await n('vulnerabilites_synchronisations', 'complete')).toBe(1);
    const hotes = [
      {
        type: 'hote',
        uuid: uuidMachine(1),
        tenableUuid: null,
        nom: null,
        adresse: null,
        systeme: 'Exemple OS 2',
        premiere: null,
        derniere: null,
      },
      {
        type: 'hote',
        uuid: '00000000-0000-4000-8000-000000000101',
        tenableUuid: null,
        nom: 'poste-01.exemple.invalid',
        adresse: '192.0.2.101',
        systeme: 'Exemple OS 1',
        premiere: null,
        derniere: null,
      },
    ];
    await synchroniser([...parc(), ...hotes]);
    expect(await n('vulnerabilites_machines')).toBe(4);
    expect(
      (await t.svc.db.one<{ systeme: string; nom: string }>(
        'SELECT systeme, nom FROM vulnerabilites_machines WHERE identifiant_source = $1',
        [`uuid:${uuidMachine(1)}`],
      ))!,
    ).toEqual({ systeme: 'Exemple OS 2', nom: nomMachine(1) });
    expect((await admin.get(`${V}/synchronisation`)).json()[0].inventaire.ok).toBe(true);
  });
});

describe('lecture : constats, EPSS, KEV, non maintenu, recherche', () => {
  it('score EPSS entre 0 et 1, constat sans CVE signalé non maintenu, filtres et recherche', async () => {
    await synchroniser(parc());
    const tous = (await admin.get(`${V}/constats`)).json();
    expect(tous.total).toBe(2);
    const c1 = tous.elements.find((c: { plugin: string }) => c.plugin === '900001');
    expect(c1).toMatchObject({ epss: 0.0056, cvss3Score: 9.1, exploitable: true, exploite: false, nonMaintenu: false });
    expect(c1.cves).toEqual(['CVE-2026-90002', 'CVE-2026-90001']);
    const c2 = tous.elements.find((c: { plugin: string }) => c.plugin === '900002');
    expect(c2).toMatchObject({ nonMaintenu: true, nombreCves: 0, finSupportLe: '2025-01-01T00:00:00.000Z' });
    const plugins = async (q: string) =>
      (await admin.get(`${V}/constats?${q}`)).json().elements.map((c: { plugin: string }) => c.plugin);
    expect(await plugins('nonMaintenu=oui')).toEqual(['900002']);
    expect(await plugins('exploitable=oui')).toEqual(['900001']);
    expect(await plugins('gravite=elevee')).toEqual(['900002']);
    expect(await plugins('q=cve-2026-9000')).toEqual(['900001']);
    expect(await plugins('q=900002')).toEqual(['900002']);
    expect(await plugins('q=contr%C3%B4le%20fictif%20900001')).toEqual(['900001']);
    expect(await plugins('q=100%25')).toEqual([]);
    expect((await admin.get(`${V}/constats?gravite=info`)).statusCode).toBe(422);
    // Exploitée : une CVE du constat figure au catalogue KEV de la veille (jointure en lecture).
    expect(await plugins('exploite=oui')).toEqual([]);
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_editeur, kev_produit) VALUES ('CVE-2026-90002', '2026-11-13', 'Éditeur fictif', 'Produit fictif')",
    );
    expect(await plugins('exploite=oui')).toEqual(['900001']);
    const fiche = (await admin.get(`${V}/constats/${c1.id}`)).json();
    expect(fiche).toMatchObject({
      exploite: true,
      correctif: 'Update the affected packages.',
      cvss3Vecteur: 'AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H',
      voirAussi: 'https://example.org/advisory',
      integration: { id: instance, nom: 'Tenable fictif' },
    });
    expect(fiche.cvesDetail).toEqual([
      { cve: 'CVE-2026-90002', kev: true },
      { cve: 'CVE-2026-90001', kev: false },
    ]);
    expect(fiche.parRole.aucun.map((m: { nom: string }) => m.nom)).toEqual([nomMachine(1), nomMachine(2)]);
    const m = (await admin.get(`${V}/machines?q=srv-exemple-01`)).json().elements[0];
    // Lot V4a : failles déclarées (aucune ici) et exploitation avérée (le constat cite une CVE du catalogue KEV).
    expect(m.compteurs).toEqual({
      critique: 1,
      elevee: 0,
      moyenne: 0,
      faible: 0,
      exploites: 1,
      exploitables: 1,
      declarees: 0,
      exploitationAveree: 1,
    });
  });
});

describe('lecture par périmètre et affectation', () => {
  it('une machine se lit par son périmètre ; sans périmètre, avec administrer seulement ; compteurs limités', async () => {
    await synchroniser(parc());
    await placer(1, perimA);
    await placer(2, perimB);
    // Machine 3 : sans périmètre.
    const noms = async (a: Agent) => (await a.get(`${V}/machines`)).json().elements.map((m: { nom: string }) => m.nom);
    expect(await noms(lecteurA)).toEqual([nomMachine(1)]);
    expect(await noms(editeurA)).toEqual([nomMachine(1), nomMachine(2)]);
    expect(await noms(respVuln)).toEqual([nomMachine(3)]);
    expect(await noms(admin)).toEqual([nomMachine(1), nomMachine(2), nomMachine(3)]);
    // Compteurs d'un constat : seules les machines lisibles ; sans machine lisible, le constat n'est ni listé ni ouvert.
    const vue = (await lecteurA.get(`${V}/constats`)).json();
    expect(vue.elements.map((c: { plugin: string; machines: number }) => [c.plugin, c.machines])).toEqual([
      ['900001', 1],
    ]);
    const c2 = (await admin.get(`${V}/constats?q=900002`)).json().elements[0].id;
    expect((await lecteurA.get(`${V}/constats/${c2}`)).statusCode).toBe(404);
    expect((await respVuln.get(`${V}/constats/${c2}`)).statusCode).toBe(200);
    const c1 = vue.elements[0].id;
    const fiche = (await lecteurA.get(`${V}/constats/${c1}`)).json();
    expect(fiche.machines).toBe(1);
    expect(fiche.parRole.aucun.map((m: { perimetreNom: string }) => m.perimetreNom)).toEqual(['Périmètre fictif A']);
    expect((await lecteurA.get(`${V}/machines`)).json().sansRole).toBe(1);
    expect((await lecteurA.get(`${V}/machines?perimetre=aucun`)).json().total).toBe(0);
    expect((await respVuln.get(`${V}/machines?perimetre=aucun`)).json().total).toBe(1);
    // Machine illisible : introuvable.
    const m3 = await machineId(3);
    expect((await lecteurA.get(`${V}/machines/${m3.id}`)).statusCode).toBe(404);
  });

  it('affectation unitaire : If-Match, écriture sur le périmètre actuel et visé, retrait réservé à administrer', async () => {
    await synchroniser(parc());
    await placer(1, perimA);
    await placer(2, perimB);
    const m1 = await machineId(1);
    const url = `${V}/machines/${m1.id}`;
    expect((await editeurA.patch(url, { role: 'front' })).statusCode).toBe(428);
    const ok = await editeurA.patch(url, { role: 'front' }, ifMatch(m1.version));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ role: 'front', perimetreId: perimA, version: m1.version + 1 });
    expect(ok.headers.etag).toBe(`"${m1.version + 1}"`);
    expect((await editeurA.patch(url, { role: 'back' }, ifMatch(m1.version))).statusCode).toBe(412);
    const v = m1.version + 1;
    // Vers B (lecture seule pour lui) : refusé ; vers un périmètre inconnu : refusé ; retirer le périmètre : administrer.
    expect((await editeurA.patch(url, { perimetreId: perimB }, ifMatch(v))).statusCode).toBe(403);
    expect(
      (await editeurA.patch(url, { perimetreId: '00000000-0000-4000-8000-0000000000ff' }, ifMatch(v))).statusCode,
    ).toBe(422);
    expect((await editeurA.patch(url, { perimetreId: null }, ifMatch(v))).statusCode).toBe(403);
    // Machine de B : lisible mais pas modifiable par lui.
    const m2 = await machineId(2);
    expect((await editeurA.patch(`${V}/machines/${m2.id}`, { role: 'bdd' }, ifMatch(m2.version))).statusCode).toBe(403);
    // Machine sans périmètre : introuvable pour lui ; l'administration du module la rattache à un périmètre où elle écrit.
    const m3 = await machineId(3);
    expect((await editeurA.patch(`${V}/machines/${m3.id}`, { role: 'bdd' }, ifMatch(m3.version))).statusCode).toBe(404);
    // Périmètre visé inaccessible : même réponse qu'un périmètre inconnu.
    expect(
      (await respVuln.patch(`${V}/machines/${m3.id}`, { perimetreId: perimA }, ifMatch(m3.version))).statusCode,
    ).toBe(422);
    const rattachee = await admin.patch(
      `${V}/machines/${m3.id}`,
      { perimetreId: perimA, role: 'bdd' },
      ifMatch(m3.version),
    );
    expect(rattachee.statusCode, rattachee.body).toBe(200);
    expect(rattachee.json()).toMatchObject({ perimetreId: perimA, perimetreNom: 'Périmètre fictif A', role: 'bdd' });
    expect((await lecteurA.get(`${V}/machines`)).json().total).toBe(2);
    const [audit] = await audits('vulnerabilites.machine.modifiee');
    expect(audit).toMatchObject({ username: 'tenable_editeur_a', target: m1.id });
    expect(audit!.details).toEqual({
      avant: { role: null, perimetreId: perimA },
      apres: { role: 'front', perimetreId: perimA },
      version: v,
    });
    // Le périmètre proposé : ceux où la personne écrit.
    expect((await editeurA.get(`${V}/perimetres`)).json().map((p: { nom: string }) => p.nom)).toEqual([
      'Périmètre fictif A',
    ]);
  });

  it('affectation en masse : tout ou rien, versions vérifiées, journal sans nom ni adresse', async () => {
    await synchroniser(parc());
    await placer(1, perimA);
    await placer(2, perimA);
    await placer(3, perimB);
    const [m1, m2, m3] = [await machineId(1), await machineId(2), await machineId(3)];
    const corps = (machines: unknown[]) => ({ machines, role: 'back' });
    // Une version périmée : rien n'est écrit.
    const perime = await editeurA.post(`${V}/machines/affectation`, corps([m1, { ...m2, version: m2.version + 5 }]));
    expect(perime.statusCode).toBe(412);
    expect(perime.json().current).toEqual([{ id: m2.id, version: m2.version }]);
    expect(await n('vulnerabilites_machines', 'role IS NOT NULL')).toBe(0);
    // Une machine en lecture seule (B) : tout est refusé.
    expect((await editeurA.post(`${V}/machines/affectation`, corps([m1, m3]))).statusCode).toBe(403);
    expect(await n('vulnerabilites_machines', 'role IS NOT NULL')).toBe(0);
    const ok = await editeurA.post(`${V}/machines/affectation`, corps([m1, m2]));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toEqual({ machines: 2 });
    expect(await n('vulnerabilites_machines', "role = 'back'")).toBe(2);
    expect((await editeurA.get(`${V}/machines?role=back`)).json().total).toBe(2);
    const [audit] = await audits('vulnerabilites.machines.affectees');
    expect(audit!.details).toEqual({ machines: [m1.id, m2.id].sort(), nombre: 2, role: 'back' });
    const journal = JSON.stringify(
      (await t.svc.db.q("SELECT details FROM audit_log WHERE action LIKE 'vulnerabilites.%'")).rows,
    );
    expect(journal).not.toMatch(/srv-exemple|poste-0|192\.0\.2\./);
  });
});

describe('planification et « Synchroniser maintenant »', () => {
  it('une synchronisation par jour et par instance ; créneau consommé, pas de rejeu après panne', async () => {
    const jour = new Date('2026-11-16T09:00:00Z');
    expect(await t.svc.vulnerabilites.tenable.planifier(jour)).toHaveLength(1);
    expect(await t.svc.vulnerabilites.tenable.planifier(jour)).toEqual([]);
    const e = (await t.svc.db.one<{ origine: string; demande_par: string; operation: string }>(
      'SELECT origine, demande_par, operation FROM integration_executions',
    ))!;
    expect(e).toEqual({ origine: 'planifie', demande_par: 'planification', operation: 'synchroniser' });
    // Exécutant absent : la demande expire ; le même jour, rien n'est réinscrit.
    await t.svc.db.q("UPDATE integration_executions SET demande_le = now() - interval '61 minutes'");
    expect(await t.svc.vulnerabilites.tenable.planifier(new Date('2026-11-16T22:00:00Z'))).toEqual([]);
    expect(await n('integration_executions', "etat = 'expire'")).toBe(1);
    // Le lendemain (heure de Paris), une nouvelle.
    expect(await t.svc.vulnerabilites.tenable.planifier(new Date('2026-11-16T23:30:00Z'))).toHaveLength(1);
    // Instance désactivée ou sans clés : rien.
    await t.svc.db.q('UPDATE integrations SET actif = false');
    expect(await t.svc.vulnerabilites.tenable.planifier(new Date('2026-11-18T09:00:00Z'))).toEqual([]);
    await t.svc.db.q('UPDATE integrations SET actif = true');
  });

  it('« Synchroniser maintenant » : exécutant exigé, une à la fois, pas deux fois en quinze minutes, débit limité', async () => {
    await t.svc.db.q('DELETE FROM backup_worker');
    expect((await rssi.post(`/api/integrations/instances/${instance}/synchroniser`)).statusCode).toBe(503);
    await t.svc.backups.heartbeat(true);
    expect((await rssi.post(`/api/integrations/instances/${instance}/synchroniser`)).statusCode).toBe(201);
    expect((await rssi.post(`/api/integrations/instances/${instance}/synchroniser`)).statusCode).toBe(409);
    await t.svc.db.q("UPDATE integration_executions SET etat = 'echec', termine_le = now(), erreur = 'x'");
    const r = await rssi.post(`/api/integrations/instances/${instance}/synchroniser`);
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/quinze minutes/);
    await t.svc.db.q("UPDATE integration_executions SET demande_le = now() - interval '16 minutes'");
    expect((await rssi.post(`/api/integrations/instances/${instance}/synchroniser`)).statusCode).toBe(201);
    expect((await audits('integration.execution.demandee')).at(-1)!.details).toMatchObject({
      operation: 'synchroniser',
      origine: 'manuel',
    });
    for (let i = 0; i < 6; i++) await rssi.post(`/api/integrations/instances/${instance}/synchroniser`);
    expect((await rssi.post(`/api/integrations/instances/${instance}/synchroniser`)).statusCode).toBe(429);
  });
});

describe('port réglable de Tenable (décision du RSSI du 16/11/2026)', () => {
  it('port explicite admis et transmis à l’exécutant ; le changer efface les clés ; hors bornes refusé', async () => {
    const i = (await admin.get(`/api/integrations/instances/${instance}`)).json();
    const r = await admin.patch(
      `/api/integrations/instances/${instance}`,
      { configuration: { ...i.configuration, adresse: 'https://tenable.exemple.invalid:8443' } },
      ifMatch(i.version),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().configuration.adresse).toBe('https://tenable.exemple.invalid:8443');
    expect(r.json().secrets).toEqual({ accessKey: false, secretKey: false });
    expect((await audits('integration.secrets_invalides')).at(-1)).toMatchObject({ target: instance });
    for (const adresse of [
      'https://tenable.exemple.invalid:0',
      'https://tenable.exemple.invalid:65536',
      'https://tenable.exemple.invalid:abc',
    ])
      expect(
        (
          await admin.patch(
            `/api/integrations/instances/${instance}`,
            { configuration: { ...i.configuration, adresse } },
            ifMatch(r.json().version),
          )
        ).statusCode,
        adresse,
      ).toBe(422);
    await admin.put(`/api/integrations/instances/${instance}/secrets`, {
      accessKey: CLE_ACCES,
      secretKey: CLE_SECRETE,
    });
    expect((await rssi.post(`/api/integrations/instances/${instance}/tester`)).statusCode).toBe(201);
    const job = (await t.svc.integrations.reclamer(true))!;
    expect((job.configuration as { adresse: string }).adresse).toBe('https://tenable.exemple.invalid:8443');
    await t.svc.integrations.terminer(job.id as string, { ok: false, resultat: null, erreur: 'Délai dépassé.' });
  });
});
