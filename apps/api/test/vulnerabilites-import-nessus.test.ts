/* Module Vulnérabilités (ADR 0100, lot N1) : import d'un scan Nessus par le connecteur « nessus-fichier » de la carte
   « Intégrations ». Migration 093 ; type sans adresse, sans clé, sans flux ; import nominal en trois temps (début, lots de
   machines entières, fin) ; second import où une faille a disparu sur une machine présente (elle disparaît) et où une
   machine est absente du fichier (inchangée) ; gravité hors configuration refusée côté serveur ; champ en trop refusé ;
   droits (lecteur des intégrations sans administration : 403) ; cloisonnement avec une instance Tenable Security Center ;
   alerte critique ouverte après un import qui apporte une faille exploitée ; import interrompu qui dit ce qui est rangé ;
   journal sans nom de machine, sans adresse, sans nom de fichier. Lot N2 : contrôle « exploité par un logiciel malveillant »
   (exploitation avérée selon Tenable : priorité, alerte, filtre « Exploitation avérée », compteurs ; valeur hors norme
   refusée ; sans le champ, priorité inchangée) ; limite de trente imports commencés par heure ; suppression d'une instance
   d'import et de tout ce qu'elle a importé (aperçu, If-Match, droits, autre type refusé, alertes closes, journal sans nom,
   cloisonnement avec Security Center). Données entièrement fictives : noms srv-fictif-…
   .example.org, adresses de 192.0.2.0/24 et 198.51.100.0/24, CVE fictives CVE-2026-9xxxx ; aucun service n'est joint. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const I = '/api/integrations';
let t: TestApp;
let admin: Agent, lecteurIntegrations: Agent, lanceur: Agent;
let nessus: string, nessusVersion: number, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const nom = (n: number) => `srv-fictif-${String(n).padStart(2, '0')}.example.org`;
const adresse = (n: number) => `192.0.2.${20 + n}`;
const cle = (n: number) => `ip:${adresse(n)}|${nom(n)}`;
const ECARTS = {
  machinesSansIdentite: 1,
  machinesTropVolumineuses: 0,
  controlesInvalides: 0,
  controlesInformatifs: 7,
  controlesHorsGravite: 3,
  cvesInvalides: 1,
  liensRefuses: 0,
  valeursInvalides: 0,
  textesRaccourcis: 0,
};
const machine = (n: number) => ({
  cle: cle(n),
  uuid: null,
  nom: nom(n),
  adresse: adresse(n),
  systeme: 'Fictional Linux 9',
  debut: '2026-11-18T08:00:00.000Z',
  fin: '2026-11-18T08:10:00.000Z',
});
const constat = (plugin: string, extra: Record<string, unknown> = {}) => ({
  plugin,
  nom: `Fictional product ${plugin} : invented remote flaw`,
  gravite: 'critique',
  famille: 'Fictional family',
  synopsis: 'The remote host runs an invented fictional service.',
  correctif: 'Upgrade the fictional service.',
  cvss3Vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  cvss3Score: 9.8,
  vpr: 6.7,
  epss: null,
  exploitable: true,
  exploitLibelle: 'Exploits are available',
  exploiteMalware: false,
  failleLe: '2026-10-01T00:00:00.000Z',
  correctifLe: '2026-10-02T00:00:00.000Z',
  voirAussi: 'https://example.org/fictional-advisory',
  cves: [`CVE-2026-9${plugin.slice(-4)}`],
  cvesTronquees: false,
  ...extra,
});
const sansMalware = <T extends { exploiteMalware?: boolean }>(c: T): Omit<T, 'exploiteMalware'> => {
  const copie = { ...c };
  delete copie.exploiteMalware;
  return copie;
};
const det = (plugin: string, port = 443) => ({ plugin, port, protocole: 'TCP' });
/** Lot : machines (numéro -> contrôles) et les contrôles qu'elles portent. */
const lot = (machines: Record<number, string[]>, constats: Record<string, Record<string, unknown>> = {}) => {
  const plugins = [...new Set(Object.values(machines).flat())];
  return {
    machines: Object.entries(machines).map(([k, p]) => ({
      machine: machine(Number(k)),
      detections: p.map((x) => det(x)),
    })),
    constats: plugins.map((p) => constat(p, constats[p])),
  };
};
/** Identifiant interne d'un constat, par son numéro de contrôle. */
const constatId = async (plugin: string) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = $1', [Number(plugin)]))!
    .id;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;

/** Présence des détections par machine (nom) et contrôle, pour une instance. */
const presences = async (instance: string) =>
  (
    await t.svc.db.q<{ nom: string; plugin: number; present: boolean }>(
      `SELECT m.nom, c.plugin_id AS plugin, d.vu_numero >= coalesce(e.numero_complet, 0) AS present
       FROM vulnerabilites_detections d JOIN vulnerabilites_machines m ON m.id = d.machine_id
       JOIN vulnerabilites_constats c ON c.id = d.constat_id
       LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
       WHERE m.integration_id = $1 ORDER BY m.nom, c.plugin_id`,
      [instance],
    )
  ).rows;

/** Import complet par les routes : début, lots, fin. Rend l'identifiant de l'exécution et le bilan. */
async function importer(lots: ReturnType<typeof lot>[], ecartes = ECARTS, qui = admin, instance = nessus) {
  const machines = lots.reduce((s, l) => s + l.machines.length, 0);
  const detections = lots.reduce((s, l) => s + l.machines.reduce((x, m) => x + m.detections.length, 0), 0);
  const d = await qui.post(`${I}/instances/${instance}/imports`, { machines, detections, ecartes });
  expect(d.statusCode, d.body).toBe(201);
  const id = d.json().id as string;
  for (const l of lots) {
    const r = await qui.post(`${I}/instances/${instance}/imports/${id}/lots`, l);
    expect(r.statusCode, r.body).toBe(200);
  }
  const f = await qui.post(`${I}/instances/${instance}/imports/${id}/fin`, {});
  expect(f.statusCode, f.body).toBe(200);
  return { id, bilan: f.json() };
}

/** Synchronisation fictive de Tenable Security Center : la machine 1 (même clé qu'un import) avec un contrôle propre. */
async function synchroniserTenable() {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par, etat, debute_le) VALUES ($1, 'synchroniser', 'manuel', 'test', 'en_cours', now()) RETURNING id",
    [tenable],
  );
  const job = (await t.svc.db.one<{ id: string }>('SELECT id FROM integration_executions WHERE integration_id = $1', [
    tenable,
  ]))!.id;
  await t.svc.vulnerabilites.tenable.reclamee(t.svc.db.k, job, tenable);
  const elements = [
    {
      type: 'machine',
      cle: cle(1),
      uuid: null,
      nom: nom(1),
      adresse: adresse(1),
      systeme: null,
      premiere: null,
      derniere: null,
      exposition: null,
      acr: null,
    },
    // Un constat de Security Center n'a pas le champ propre à l'import (lot N2).
    { type: 'constat', ...sansMalware(constat('920001')), finSupportLe: null },
    {
      type: 'detection',
      plugin: '920001',
      machine: cle(1),
      port: 22,
      protocole: 'TCP',
      premiere: null,
      derniere: null,
      attenue: false,
      risqueAccepte: false,
      risqueRequalifie: false,
    },
  ];
  await t.svc.integrations.lot(job, elements);
  await t.svc.integrations.terminer(job, {
    ok: true,
    resultat: {
      elements: 3,
      pages: 1,
      constats: 1,
      detections: 1,
      machines: 1,
      hotes: 0,
      ecartes: 0,
      tronque: false,
      inventaire: { ok: true, erreur: null },
    },
    erreur: null,
  });
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'nessus_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_ns_lire', 'Intégrations, lecture', ARRAY['integrations:lire','vulnerabilites:lire']),
       ('r_ns_lancer', 'Intégrations, lancement', ARRAY['integrations:lire','integrations:modifier','vulnerabilites:lire','vulnerabilites:administrer'])`,
  );
  lecteurIntegrations = await login(t, await makeUser(t, 'nessus_lecteur', 'r_ns_lire'));
  lanceur = await login(t, await makeUser(t, 'nessus_lanceur', 'r_ns_lancer'));
  const r = await admin.post(`${I}/instances`, {
    type: 'nessus-fichier',
    nom: 'Nessus fictif',
    configuration: {},
  });
  expect(r.statusCode, r.body).toBe(201);
  nessus = r.json().id as string;
  const a = await admin.put(`${I}/instances/${nessus}/activation`, { actif: true }, ifMatch(r.json().version));
  expect(a.statusCode, a.body).toBe(200);
  nessusVersion = a.json().version as number;
  const tn = await admin.post(`${I}/instances`, {
    type: 'tenable',
    nom: 'Tenable fictif',
    configuration: { adresse: 'https://tenable.example.org' },
  });
  tenable = tn.json().id as string;
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  for (const table of [
    'vulnerabilites_alertes',
    'vulnerabilites_suivis',
    'vulnerabilites_detections',
    'vulnerabilites_constat_cves',
    'vulnerabilites_constats',
    'vulnerabilites_machines',
    'vulnerabilites_imports',
    'vulnerabilites_synchronisations',
    'vulnerabilites_tenable_etat',
    'integration_executions',
    'vulnerabilites_veille_cve',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  t.svc.limits.importNessus.reset();
  t.svc.limits.importNessusLot.reset();
});

describe('migration 093 et catalogue', () => {
  it('élargit la source des machines, crée le journal des imports ; type sans adresse, sans clé, sans flux', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '093_vulnerabilites_import_nessus.sql'"))
        ?.ok,
    ).toBe(1);
    const m = `INSERT INTO vulnerabilites_machines (integration_id, source, identifiant_source, vu_numero) VALUES ($1, $2, 'ip:192.0.2.1', 1)`;
    await expect(t.svc.db.q(m, [nessus, 'autre'])).rejects.toThrow(/vulnerabilites_machines_source_check/);
    await t.svc.db.q(m, [nessus, 'nessus-fichier']);
    // Aucune fréquence pour ce type (contrôle de la migration 090, inchangé).
    await expect(t.svc.db.q('UPDATE integrations SET frequence_heures = 24 WHERE id = $1', [nessus])).rejects.toThrow(
      /integrations_frequence/,
    );
    const cat = (await admin.get(`${I}/catalogue`)).json() as { id: string; flux: unknown; secrets: unknown[] }[];
    expect(cat.find((x) => x.id === 'nessus-fichier')).toMatchObject({ flux: null, secrets: [], pointsAcces: [] });
    const i = (await admin.get(`${I}/instances/${nessus}`)).json();
    expect(i).toMatchObject({ type: 'nessus-fichier', actif: true, frequenceHeures: null, secrets: {} });
    expect(i.configuration).toEqual({ gravites: ['critique', 'elevee'] });
    // Aucun flux pour ce type ; ni test de connexion ni synchronisation.
    expect((await admin.get(`${I}/etat`)).json().flux.map((f: { type: string }) => f.type)).toEqual([
      'tenable',
      'algolighthouse',
    ]);
    expect((await admin.post(`${I}/instances/${nessus}/tester`)).statusCode).toBe(422);
    expect((await admin.post(`${I}/instances/${nessus}/synchroniser`)).statusCode).toBe(422);
    // Une fréquence ou une adresse sont refusées.
    expect(
      (await admin.patch(`${I}/instances/${nessus}`, { frequenceHeures: 24 }, ifMatch(nessusVersion))).statusCode,
    ).toBe(422);
    expect(
      (
        await admin.patch(
          `${I}/instances/${nessus}`,
          { configuration: { gravites: ['critique'], adresse: 'https://x.example.org' } },
          ifMatch(nessusVersion),
        )
      ).statusCode,
    ).toBe(422);
  });
});

describe('import nominal, puis disparition par machine scannée', () => {
  it('range machines et failles comme Tenable, marquées de leur source ; le second import fait disparaître la faille absente d’une machine scannée et laisse intacte la machine absente du fichier', async () => {
    const premier = await importer([lot({ 1: ['910001', '910002'], 2: ['910001'] }), lot({ 3: ['910003'] })]);
    expect(premier.bilan).toEqual({
      machinesAnnoncees: 3,
      machines: 3,
      constats: 3,
      detections: 4,
      disparues: 0,
      lots: 2,
      ecartes: ECARTS,
      gravites: ['critique', 'elevee'],
    });
    const x = (await admin.get(`${I}/instances/${nessus}/executions`)).json();
    expect(x[0]).toMatchObject({
      operation: 'importer',
      etat: 'recu',
      demandePar: 'nessus_admin',
      resultat: premier.bilan,
    });
    // Écrans du module : machines et failles marquées de leur source.
    const machines = (await admin.get('/api/vulnerabilites/machines')).json().elements as {
      nom: string;
      source: string;
      integration: { nom: string; type: string };
      compteurs: { critique: number };
    }[];
    expect(machines.map((m) => m.nom).sort()).toEqual([nom(1), nom(2), nom(3)]);
    for (const m of machines) {
      expect(m.source).toBe('nessus-fichier');
      expect(m.integration).toMatchObject({ nom: 'Nessus fictif', type: 'nessus-fichier' });
    }
    const constats = (await admin.get('/api/vulnerabilites/constats?etat=tous')).json().elements as {
      plugin: string;
      machines: number;
      integration: { type: string };
    }[];
    expect(constats.map((c) => [c.plugin, c.machines, c.integration.type]).sort()).toEqual([
      ['910001', 2, 'nessus-fichier'],
      ['910002', 1, 'nessus-fichier'],
      ['910003', 1, 'nessus-fichier'],
    ]);
    // Second import : la machine 1 n'a plus 910002 ; la machine 3 n'est pas dans le fichier.
    const second = await importer([lot({ 1: ['910001'], 2: ['910001'] })]);
    expect(second.bilan).toMatchObject({ machines: 2, constats: 1, detections: 2, disparues: 1, lots: 1 });
    expect(await presences(nessus)).toEqual([
      { nom: nom(1), plugin: 910001, present: true },
      { nom: nom(1), plugin: 910002, present: false },
      { nom: nom(2), plugin: 910001, present: true },
      { nom: nom(3), plugin: 910003, present: true },
    ]);
    // Rien n'est supprimé ; la faille disparue est proposée « corrigée, à confirmer » (suivi, comme après une
    // synchronisation complète).
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_detections'))!.n).toBe(4);
    const suivi = await t.svc.db.one<{ proposition: string }>(
      `SELECT s.proposition FROM vulnerabilites_suivis s JOIN vulnerabilites_constats c ON c.id = s.constat_id
       WHERE c.plugin_id = 910002`,
    );
    expect(suivi?.proposition).toBe('a_confirmer');
    const etat = (await admin.get('/api/vulnerabilites/imports/etat')).json();
    expect(etat).toHaveLength(1);
    expect(etat[0]).toMatchObject({ nom: 'Nessus fictif', derniere: { etat: 'recu', bilan: { machines: 2 } } });
  });
});

describe('revalidation par le serveur', () => {
  it('gravité hors configuration, champ en trop, contrôle orphelin, machine incohérente : lot refusé, rien n’est rangé', async () => {
    const d = await admin.post(`${I}/instances/${nessus}/imports`, { machines: 2, detections: 2, ecartes: ECARTS });
    expect(d.statusCode, d.body).toBe(201);
    expect(d.json().gravites).toEqual(['critique', 'elevee']);
    const url = `${I}/instances/${nessus}/imports/${d.json().id}/lots`;
    const moyenne = await admin.post(url, lot({ 1: ['910001'] }, { '910001': { gravite: 'moyenne' } }));
    expect(moyenne.statusCode).toBe(422);
    expect(moyenne.json().error).toContain('hors des gravités retenues');
    const info = await admin.post(url, lot({ 1: ['910001'] }, { '910001': { gravite: 'info' } }));
    expect(info.statusCode).toBe(422);
    const enTrop = lot({ 1: ['910001'] });
    expect((await admin.post(url, { ...enTrop, fichier: 'scan.nessus' })).statusCode).toBe(422);
    expect(
      (await admin.post(url, { ...enTrop, constats: [{ ...enTrop.constats[0], pluginOutput: 'x' }] })).statusCode,
    ).toBe(422);
    expect(
      (
        await admin.post(url, {
          ...enTrop,
          machines: [{ ...enTrop.machines[0], machine: { ...enTrop.machines[0]!.machine, description: 'x' } }],
        })
      ).statusCode,
    ).toBe(422);
    expect((await admin.post(url, { ...enTrop, constats: [...enTrop.constats, constat('910009')] })).statusCode).toBe(
      422,
    );
    expect(
      (
        await admin.post(url, {
          ...enTrop,
          machines: [{ ...enTrop.machines[0], machine: { ...enTrop.machines[0]!.machine, cle: cle(5) } }],
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (await admin.post(url, { ...enTrop, constats: [constat('910001', { cves: ['CVE-26-1'] })] })).statusCode,
    ).toBe(422);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_machines'))!.n).toBe(0);
    // Plus de machines que l'import n'en annonçait : refusé.
    expect((await admin.post(url, lot({ 1: ['910001'], 2: ['910001'], 3: ['910001'] }))).statusCode).toBe(422);
    // Gravités élargies dans la configuration : valables pour l'import suivant seulement (fixées au début).
    const avant = (await admin.get(`${I}/instances/${nessus}`)).json();
    const p = await admin.patch(
      `${I}/instances/${nessus}`,
      { configuration: { gravites: ['critique', 'elevee', 'moyenne'] } },
      ifMatch(avant.version),
    );
    expect(p.statusCode, p.body).toBe(200);
    expect((await admin.post(url, lot({ 1: ['910001'] }, { '910001': { gravite: 'moyenne' } }))).statusCode).toBe(422);
    // Fin d'un import incomplet : en échec, avec ce qui est rangé.
    expect((await admin.post(url, lot({ 1: ['910001'] }))).statusCode).toBe(200);
    const f = await admin.post(`${I}/instances/${nessus}/imports/${d.json().id}/fin`, {});
    expect(f.json()).toMatchObject({ machinesAnnoncees: 2, machines: 1, lots: 1 });
    const x = (await admin.get(`${I}/instances/${nessus}/executions`)).json()[0];
    expect(x.etat).toBe('echec');
    expect(x.erreur).toBe(
      'Import interrompu. 1 machine importée sur 2 ; les machines importées le restent, réimportez le fichier pour les autres.',
    );
    // Import déjà terminé : plus aucun lot.
    expect((await admin.post(url, lot({ 2: ['910001'] }))).statusCode).toBe(409);
    await admin.patch(
      `${I}/instances/${nessus}`,
      { configuration: { gravites: ['critique', 'elevee'] } },
      ifMatch(p.json().version),
    );
  });

  it('un import à la fois par instance ; seule la personne qui l’a commencé le poursuit ; un import abandonné est clos', async () => {
    const d = await admin.post(`${I}/instances/${nessus}/imports`, { machines: 1, detections: 1, ecartes: ECARTS });
    expect(d.statusCode).toBe(201);
    expect(
      (await admin.post(`${I}/instances/${nessus}/imports`, { machines: 1, detections: 1, ecartes: ECARTS }))
        .statusCode,
    ).toBe(409);
    const autre = await login(t, await makeUser(t, 'nessus_admin_b', 'admin'));
    expect(
      (await autre.post(`${I}/instances/${nessus}/imports/${d.json().id}/lots`, lot({ 1: ['910001'] }))).statusCode,
    ).toBe(409);
    await t.svc.db.q("UPDATE vulnerabilites_imports SET maj_le = now() - interval '31 minutes'");
    expect(await t.svc.vulnerabilites.importNessus.tic()).toBe(1);
    const x = (await admin.get(`${I}/instances/${nessus}/executions`)).json()[0];
    expect(x).toMatchObject({ etat: 'echec' });
    expect(x.erreur).toContain('Import abandonné : aucun lot reçu depuis trente minutes. 0 machine importée sur 1');
  });

  it('instance inactive, autre type, module Vulnérabilités désactivé : refusé', async () => {
    const corps = { machines: 1, detections: 1, ecartes: ECARTS };
    expect((await admin.post(`${I}/instances/${tenable}/imports`, corps)).statusCode).toBe(422);
    const i = (await admin.get(`${I}/instances/${nessus}`)).json();
    const off = await admin.put(`${I}/instances/${nessus}/activation`, { actif: false }, ifMatch(i.version));
    expect(off.statusCode).toBe(200);
    expect((await admin.post(`${I}/instances/${nessus}/imports`, corps)).statusCode).toBe(409);
    const on = await admin.put(`${I}/instances/${nessus}/activation`, { actif: true }, ifMatch(off.json().version));
    expect(on.statusCode).toBe(200);
    await t.svc.db.q("UPDATE module_activation SET disabled='{vulnerabilites}', version=version+1 WHERE id=1");
    const desactive = await admin.post(`${I}/instances/${nessus}/imports`, corps);
    expect(desactive.statusCode).toBe(409);
    expect(desactive.json().error).toBe('Ce module est désactivé.');
  });
});

describe('droits', () => {
  it('lecteur des intégrations sans administration, ou qui lance sans administrer : 403 ; il lit les exécutions', async () => {
    const corps = { machines: 1, detections: 1, ecartes: ECARTS };
    for (const qui of [lecteurIntegrations, lanceur]) {
      expect((await qui.post(`${I}/instances/${nessus}/imports`, corps)).statusCode).toBe(403);
      expect((await qui.get(`${I}/instances/${nessus}/executions`)).statusCode).toBe(200);
    }
    const { id } = await importer([lot({ 1: ['910001'] })]);
    for (const qui of [lecteurIntegrations, lanceur]) {
      expect((await qui.post(`${I}/instances/${nessus}/imports/${id}/lots`, lot({ 1: ['910001'] }))).statusCode).toBe(
        403,
      );
      expect((await qui.post(`${I}/instances/${nessus}/imports/${id}/fin`, {})).statusCode).toBe(403);
    }
    // État des imports dans le module : lecture du module.
    expect((await lecteurIntegrations.get('/api/vulnerabilites/imports/etat')).statusCode).toBe(200);
  });
});

describe('cloisonnement avec Security Center', () => {
  it('une machine vue par Tenable et par un import apparaît deux fois ; un import ne fait rien disparaître chez Tenable', async () => {
    await synchroniserTenable();
    await importer([lot({ 1: ['910001'] })]);
    await importer([lot({ 1: ['910002'] })]);
    const machines = (await admin.get('/api/vulnerabilites/machines')).json().elements as {
      nom: string;
      source: string;
    }[];
    expect(machines.map((m) => [m.nom, m.source]).sort()).toEqual([
      [nom(1), 'nessus-fichier'],
      [nom(1), 'tenable'],
    ]);
    expect(await presences(tenable)).toEqual([{ nom: nom(1), plugin: 920001, present: true }]);
    expect(await presences(nessus)).toEqual([
      { nom: nom(1), plugin: 910001, present: false },
      { nom: nom(1), plugin: 910002, present: true },
    ]);
    // Les constats restent propres à leur instance.
    const parInstance = await t.svc.db.q<{ integration_id: string; n: number }>(
      'SELECT integration_id, count(*)::int AS n FROM vulnerabilites_constats GROUP BY integration_id',
    );
    expect(Object.fromEntries(parInstance.rows.map((r) => [r.integration_id, r.n]))).toEqual({
      [tenable]: 1,
      [nessus]: 2,
    });
    // L'état de Security Center ne liste pas l'instance d'import, et inversement.
    expect(
      ((await admin.get('/api/vulnerabilites/synchronisation')).json() as { integrationId: string }[]).map(
        (e) => e.integrationId,
      ),
    ).toEqual([tenable]);
    expect(
      ((await admin.get('/api/vulnerabilites/imports/etat')).json() as { integrationId: string }[]).map(
        (e) => e.integrationId,
      ),
    ).toEqual([nessus]);
  });
});

describe('alertes et journal', () => {
  it('un import qui apporte une faille exploitée (catalogue KEV) ouvre son alerte critique ; le journal ne nomme ni machine, ni adresse, ni fichier', async () => {
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit)
       VALUES ('CVE-2026-90001', '2026-11-01', 'Fictional Product Remote Code Execution', 'Produit fictif')`,
    );
    await importer([lot({ 4: ['930001'] }, { '930001': { cves: ['CVE-2026-90001'] } })]);
    const alertes = await t.svc.db.q<{ cle: string; niveau: string; etat: string }>(
      'SELECT cle, niveau, etat FROM vulnerabilites_alertes ORDER BY cle',
    );
    expect(alertes.rows).toEqual([{ cle: 'CVE-2026-90001', niveau: 'critique', etat: 'ouverte' }]);
    const evaluees = await audits('vulnerabilites.alertes.evaluees');
    expect(evaluees.at(-1)!.details.declencheur).toBe('import-nessus');
    const journal = JSON.stringify([
      ...(await audits('integration.import.debute')),
      ...(await audits('vulnerabilites.import.lot')),
      ...(await audits('integration.import.termine')),
    ]);
    expect(journal.length).toBeGreaterThan(100);
    for (const interdit of [nom(4), adresse(4), 'srv-fictif', '192.0.2.', '.nessus', 'example.org'])
      expect(journal.includes(interdit), interdit).toBe(false);
    const lotAudit = (await audits('vulnerabilites.import.lot')).at(-1)!;
    expect(lotAudit.username).toBe('nessus_admin');
    expect(lotAudit.details).toMatchObject({
      integration: nessus,
      machines: 1,
      constats: 1,
      detections: 1,
      disparues: 0,
    });
  });

  it('limite de débit (lot N2) : trente imports de fichiers commencés par heure et par personne, puis 429 explicite', async () => {
    t.svc.limits.importNessus.reset();
    const corps = { machines: 1, detections: 1, ecartes: ECARTS };
    const codes: number[] = [];
    let dernier = '';
    for (let i = 0; i < 31; i++) {
      const r = await admin.post(`${I}/instances/${nessus}/imports`, corps);
      codes.push(r.statusCode);
      dernier = r.json().error as string;
    }
    // Le premier commence, les vingt-neuf suivants butent sur l'import en cours, le trente et unième sur la limite.
    expect(codes).toEqual([201, ...Array<number>(29).fill(409), 429]);
    expect(dernier).toBe('Trop d’imports de fichiers commencés (30 par heure). Réessayez dans une heure.');
    // La limite est propre à chaque personne.
    const autre = await login(t, await makeUser(t, 'nessus_admin_limite', 'admin'));
    expect((await autre.post(`${I}/instances/${nessus}/imports`, corps)).statusCode).toBe(409);
  });
});

describe('lot N2 : contrôle exploité par un logiciel malveillant (selon Tenable)', () => {
  interface Constat {
    plugin: string;
    exploiteMalware: boolean;
    priorite: { niveau: string; faits: unknown[] };
    sources: { exploitation: { source: string; le: string | null }[] };
  }
  const constats = async (q = '') =>
    ((await admin.get(`/api/vulnerabilites/constats?etat=tous${q}`)).json().elements as Constat[]).sort((a, b) =>
      a.plugin.localeCompare(b.plugin),
    );

  it('exploitation avérée : P1, faits et source, filtre « Exploitation avérée », rang et marques de la machine, alerte critique', async () => {
    await importer([
      lot({ 1: ['940001', '940002'], 2: ['940002'] }, { '940001': { gravite: 'elevee', exploiteMalware: true } }),
    ]);
    const [malware, sans] = await constats();
    expect(malware).toMatchObject({
      plugin: '940001',
      exploiteMalware: true,
      priorite: {
        niveau: 'P1',
        faits: [
          { fait: 'exploitation', sources: ['tenable'] },
          { fait: 'presence', presence: 'detectee' },
        ],
      },
      sources: { exploitation: [{ source: 'tenable', le: null }] },
    });
    // Sans le champ : la priorité d'avant (critique et présente : P2), aucune exploitation avérée.
    expect(sans).toMatchObject({
      plugin: '940002',
      exploiteMalware: false,
      priorite: {
        niveau: 'P2',
        faits: [
          { fait: 'presence', presence: 'detectee' },
          { fait: 'gravite', gravite: 'critique' },
        ],
      },
      sources: { exploitation: [] },
    });
    expect((await constats('&exploite=oui')).map((c) => c.plugin)).toEqual(['940001']);
    expect((await constats('&priorite=P1')).map((c) => c.plugin)).toEqual(['940001']);
    // Fiche du constat et fiche illustrée : même priorité, marque zero-day.
    const fiche = (await admin.get(`/api/vulnerabilites/constats/${await constatId('940001')}`)).json();
    expect(fiche).toMatchObject({ exploiteMalware: true, priorite: { niveau: 'P1' } });
    // Machines : compteur d'exploitation avérée, rang et marque zero-day ; la machine 2 n'en porte pas.
    const machines = (await admin.get('/api/vulnerabilites/machines')).json().elements as {
      nom: string;
      compteurs: { exploitationAveree: number };
      marques: { priorite: string; exploitationAveree: boolean };
      rang: { position: number };
    }[];
    const m1 = machines.find((m) => m.nom === nom(1))!;
    const m2 = machines.find((m) => m.nom === nom(2))!;
    expect(m1).toMatchObject({
      compteurs: { exploitationAveree: 1 },
      marques: { priorite: 'P1', exploitationAveree: true },
    });
    expect(m2).toMatchObject({
      compteurs: { exploitationAveree: 0 },
      marques: { priorite: 'P2', exploitationAveree: false },
    });
    expect(m1.rang.position).toBeLessThan(m2.rang.position);
    // Alerte critique ouverte pour la CVE du contrôle, avec la source de l'exploitation ; pas d'alerte critique pour l'autre.
    const alertes = await t.svc.db.q<{ cle: string; niveau: string; etat: string; faits: { exploitation: unknown[] } }>(
      'SELECT cle, niveau, etat, faits FROM vulnerabilites_alertes ORDER BY cle',
    );
    expect(alertes.rows.find((a) => a.cle === 'CVE-2026-90001')).toMatchObject({
      niveau: 'critique',
      etat: 'ouverte',
      faits: { exploitation: [{ source: 'tenable', le: null }] },
    });
    expect(alertes.rows.find((a) => a.cle === 'CVE-2026-90002')?.niveau).not.toBe('critique');
    // Vue d'ensemble : la faille compte comme exploitée.
    const vue = (await admin.get('/api/vulnerabilites/vue-ensemble')).json() as {
      cibles: { cve: string | null; exploitee: boolean }[];
    };
    expect(vue.cibles.find((c) => c.cve === 'CVE-2026-90001')?.exploitee).toBe(true);
    expect(vue.cibles.find((c) => c.cve === 'CVE-2026-90002')?.exploitee).toBe(false);

    // Un import suivant sans le champ : le constat redevient ce qu'il était, l'exploitation avérée disparaît.
    await importer([lot({ 1: ['940001', '940002'], 2: ['940002'] }, { '940001': { gravite: 'elevee' } })]);
    const [apres] = await constats();
    expect(apres).toMatchObject({ exploiteMalware: false, sources: { exploitation: [] } });
    expect(apres!.priorite.niveau).toBe('P2');
    expect(await constats('&exploite=oui')).toEqual([]);
  });

  it('valeur hors norme ou champ absent : lot refusé, rien n’est rangé', async () => {
    const d = await admin.post(`${I}/instances/${nessus}/imports`, { machines: 1, detections: 1, ecartes: ECARTS });
    expect(d.statusCode, d.body).toBe(201);
    const url = `${I}/instances/${nessus}/imports/${d.json().id}/lots`;
    for (const v of ['true', 1, null, 'oui']) {
      const r = await admin.post(url, lot({ 1: ['940001'] }, { '940001': { exploiteMalware: v } }));
      expect(r.statusCode, String(v)).toBe(422);
    }
    const sans = lot({ 1: ['940001'] });
    expect((await admin.post(url, { ...sans, constats: [sansMalware(sans.constats[0]!)] })).statusCode).toBe(422);
    expect(
      (await admin.post(url, { ...sans, constats: [{ ...sans.constats[0], exploited_by_malware: 'true' }] }))
        .statusCode,
    ).toBe(422);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_constats'))!.n).toBe(0);
    await admin.post(`${I}/instances/${nessus}/imports/${d.json().id}/fin`, {});
  });

  it('Security Center : ses constats ne portent jamais le fait (colonne à false), priorité inchangée', async () => {
    await synchroniserTenable();
    const c = (await constats()).find((x) => x.plugin === '920001')!;
    expect(c).toMatchObject({ exploiteMalware: false, sources: { exploitation: [] } });
    expect(c.priorite.niveau).toBe('P2');
  });
});

describe('lot N2 : suppression d’une instance d’import et de tout ce qu’elle a importé', () => {
  async function creerInstance(n: string) {
    const r = await admin.post(`${I}/instances`, { type: 'nessus-fichier', nom: n, configuration: {} });
    expect(r.statusCode, r.body).toBe(201);
    const a = await admin.put(`${I}/instances/${r.json().id}/activation`, { actif: true }, ifMatch(r.json().version));
    expect(a.statusCode, a.body).toBe(200);
    return { id: r.json().id as string, version: a.json().version as number };
  }

  it('aperçu chiffré, If-Match, effacement en cascade, alertes closes, journal sans nom ; Security Center intact', async () => {
    await synchroniserTenable();
    const tenableAvant = await presences(tenable);
    const x = await creerInstance('Nessus à supprimer');
    await importer(
      [
        lot(
          { 1: ['950001'], 2: ['950001', '950002'] },
          { '950001': { exploiteMalware: true, cves: ['CVE-2026-95001'] }, '950002': { cves: ['CVE-2026-95002'] } },
        ),
      ],
      ECARTS,
      admin,
      x.id,
    );
    const constatIds = (
      await t.svc.db.q<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE integration_id = $1', [x.id])
    ).rows.map((r) => r.id);
    // Un dépassement de délai signalé (sans clé étrangère) part avec son constat.
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_depassements (nature, objet_id, priorite, echeance) VALUES ('constat', $1, 'P1', now())",
      [constatIds[0]],
    );
    const alerte = await t.svc.db.one<{ etat: string }>(
      "SELECT etat FROM vulnerabilites_alertes WHERE cle = 'CVE-2026-95001'",
    );
    expect(alerte?.etat).toBe('ouverte');

    const apercu = await admin.get(`${I}/instances/${x.id}/suppression`);
    expect(apercu.statusCode, apercu.body).toBe(200);
    expect(apercu.json()).toEqual({ machines: 2, failles: 2, detections: 3, imports: 1 });
    // If-Match exigé, version à jour exigée.
    expect((await admin.del(`${I}/instances/${x.id}`)).statusCode).toBe(428);
    expect((await admin.del(`${I}/instances/${x.id}`, ifMatch(x.version + 5))).statusCode).toBe(412);
    const r = await admin.del(`${I}/instances/${x.id}`, ifMatch(x.version));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ machines: 2, failles: 2, detections: 3, imports: 1 });

    expect((await admin.get(`${I}/instances/${x.id}`)).statusCode).toBe(404);
    for (const [table, colonne] of [
      ['vulnerabilites_machines', 'integration_id'],
      ['vulnerabilites_constats', 'integration_id'],
      ['vulnerabilites_imports', 'integration_id'],
      ['integration_executions', 'integration_id'],
      ['vulnerabilites_tenable_etat', 'integration_id'],
    ] as const)
      expect(
        (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${colonne} = $1`, [x.id]))!.n,
        table,
      ).toBe(0);
    for (const table of ['vulnerabilites_constat_cves', 'vulnerabilites_detections', 'vulnerabilites_suivis'])
      expect(
        (await t.svc.db.one<{ n: number }>(
          `SELECT count(*)::int AS n FROM ${table} WHERE constat_id = ANY($1::uuid[])`,
          [constatIds],
        ))!.n,
        table,
      ).toBe(0);
    expect(
      (await t.svc.db.one<{ n: number }>(
        'SELECT count(*)::int AS n FROM vulnerabilites_depassements WHERE objet_id = ANY($1::uuid[])',
        [constatIds],
      ))!.n,
    ).toBe(0);
    // Alerte réévaluée dans la même transaction : close, sa seule présence venait de l'import.
    expect(
      await t.svc.db.one<{ etat: string; motif_cloture: string }>(
        "SELECT etat, motif_cloture FROM vulnerabilites_alertes WHERE cle = 'CVE-2026-95001'",
      ),
    ).toEqual({ etat: 'close', motif_cloture: 'plus_presente' });
    expect((await audits('vulnerabilites.alertes.evaluees')).at(-1)!.details.declencheur).toBe(
      'suppression-import-nessus',
    );
    // Security Center : rien ne disparaît.
    expect(await presences(tenable)).toEqual(tenableAvant);
    expect((await admin.get(`${I}/instances/${tenable}`)).statusCode).toBe(200);
    // Journal : qui, type et nombres ; ni nom de machine, ni adresse, ni nom de l'instance.
    const journal = (await audits('integration.supprimee')).at(-1)!;
    expect(journal).toMatchObject({
      username: 'nessus_admin',
      target: x.id,
      details: { type: 'nessus-fichier', machines: 2, failles: 2, detections: 3, imports: 1 },
    });
    const texte = JSON.stringify(journal);
    for (const interdit of [nom(1), nom(2), adresse(1), '192.0.2.', 'example.org', 'Nessus à supprimer'])
      expect(texte.includes(interdit), interdit).toBe(false);
  });

  it('droits : lecteur et lanceur sans administration, 403 ; autre type de connecteur : refus net ; import en cours : 409', async () => {
    const x = await creerInstance('Nessus droits');
    for (const qui of [lecteurIntegrations, lanceur]) {
      expect((await qui.get(`${I}/instances/${x.id}/suppression`)).statusCode).toBe(403);
      expect((await qui.del(`${I}/instances/${x.id}`, ifMatch(x.version))).statusCode).toBe(403);
    }
    const tn = (await admin.get(`${I}/instances/${tenable}`)).json();
    const refus = await admin.del(`${I}/instances/${tenable}`, ifMatch(tn.version));
    expect(refus.statusCode).toBe(422);
    expect(refus.json().error).toContain('Seul un connecteur « Nessus, import de fichier » se supprime');
    expect((await admin.get(`${I}/instances/${tenable}/suppression`)).statusCode).toBe(422);
    expect((await admin.get(`${I}/instances/${tenable}`)).statusCode).toBe(200);
    // Import commencé et non terminé : la suppression attend sa fin.
    const d = await admin.post(`${I}/instances/${x.id}/imports`, { machines: 1, detections: 1, ecartes: ECARTS });
    expect(d.statusCode).toBe(201);
    expect((await admin.del(`${I}/instances/${x.id}`, ifMatch(x.version))).statusCode).toBe(409);
    await admin.post(`${I}/instances/${x.id}/imports/${d.json().id}/fin`, {});
    expect((await admin.del(`${I}/instances/${x.id}`, ifMatch(x.version))).statusCode).toBe(200);
    // Instance inconnue : 404.
    expect((await admin.del(`${I}/instances/${x.id}`, ifMatch(x.version))).statusCode).toBe(404);
  });
});
