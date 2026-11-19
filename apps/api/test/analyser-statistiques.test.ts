/* Statistiques du planificateur après une synchronisation (décision du RSSI du 19/11/2026) : à la fin reçue d'une
   synchronisation Tenable Security Center ou AlgoLightHouse qui a rangé des éléments, ANALYZE des seules tables réécrites par
   les lots, après la validation et par le rôle applicatif (non superutilisateur, propriétaire des tables) ; rien après une
   synchronisation vide ni après un échec ; un ANALYZE en échec est journalisé (table et code seulement) et ne change pas
   l'issue de la synchronisation. Données entièrement fictives (.invalid, .example, 192.0.2.0/24, CVE fictives). */
import type { Logger } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyserTables, type TableDb } from '../src/db/analyser.js';
import type { OperationEnLots } from '../src/integrations/index.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const SYSTEME = { username: 'test' };
const TABLES_TENABLE: TableDb[] = [
  'vulnerabilites_tenable_depots',
  'vulnerabilites_machines',
  'vulnerabilites_constats',
  'vulnerabilites_constat_cves',
  'vulnerabilites_detections',
];
const TABLES_ALH: TableDb[] = [
  'vulnerabilites_alh_perimetres',
  'vulnerabilites_alh_actifs',
  'vulnerabilites_alh_alertes',
  'vulnerabilites_alh_alerte_cves',
  'vulnerabilites_alh_services',
  'vulnerabilites_alh_service_alertes',
  'vulnerabilites_alh_technologies',
  'vulnerabilites_alh_technologie_actifs',
  'vulnerabilites_alh_technologie_cves',
];
let t: TestApp;
let admin: Agent;
let tenable: string, alh: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const UUID_MACHINE = '00000000-0000-4000-8000-0000000000a1';

const elementsTenable = (): Record<string, unknown>[] => [
  {
    type: 'machine',
    cle: `uuid:${UUID_MACHINE}`,
    uuid: UUID_MACHINE,
    nom: 'srv-exemple-01.exemple.invalid',
    adresse: '192.0.2.11',
    systeme: 'Exemple Linux 9',
    premiere: '2026-07-18T01:05:01.000Z',
    derniere: '2026-11-16T06:04:48.000Z',
    exposition: 'internal',
    acr: 4,
    depot: { id: '7', nom: 'Dépôt fictif' },
  },
  {
    type: 'constat',
    plugin: '900001',
    nom: 'Exemple Linux : contrôle fictif 900001',
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
    cves: ['CVE-2026-90001'],
    cvesTronquees: false,
  },
  {
    type: 'detection',
    plugin: '900001',
    machine: `uuid:${UUID_MACHINE}`,
    port: 0,
    protocole: 'TCP',
    premiere: '2026-07-18T01:05:01.000Z',
    derniere: '2026-11-16T06:04:48.000Z',
    attenue: false,
    risqueAccepte: false,
    risqueRequalifie: false,
  },
];
const bilanTenable = (elements: unknown[]) => {
  const n = (type: string) => elements.filter((e) => (e as { type: string }).type === type).length;
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
  };
};

const elementsAlh = (): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif' },
  {
    type: 'hote',
    id: U(11),
    perimetre: U(1),
    statut: 'monitored',
    adresse: '192.0.2.10',
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
  },
  {
    type: 'alerte',
    id: U(31),
    perimetre: U(1),
    typeAlerte: 'vulnerable_service',
    criticite: 'critical',
    statut: 'untreated',
    titre: 'Alerte fictive 31',
    verifiee: true,
    detail: true,
    cibleType: 'host',
    cibleValeur: '192.0.2.10',
    cibleHote: U(11),
    cibleDomaine: null,
    cves: ['CVE-2026-91001'],
    defauts: [],
    creeLe: '2026-11-10T10:00:00.000Z',
    majLe: '2026-11-15T10:00:00.000Z',
    termineeLe: null,
  },
  {
    type: 'technologie',
    cle: 'f5|nginx|',
    nom: 'nginx',
    editeur: 'F5',
    produit: 'nginx',
    technologie: null,
    derniere: '2026-11-16T00:00:00.000Z',
    tronquee: false,
  },
  {
    type: 'technologie_actif',
    technologie: 'f5|nginx|',
    version: '1.18.0',
    actif: U(11),
    typeActif: 'hote',
    libelle: '192.0.2.10',
    actuel: true,
  },
  {
    type: 'technologie_cve',
    technologie: 'f5|nginx|',
    version: '1.18.0',
    cve: 'CVE-2026-92001',
    titre: 'Faille fictive',
    cvss: 7.5,
    epss: 0.42,
    severite: 'high',
    preuve: true,
    exploitee: false,
    publieeLe: '2026-03-01T00:00:00.000Z',
  },
];
const bilanAlh = (elements: unknown[]) => {
  const n = (type: string) => elements.filter((e) => (e as { type: string }).type === type).length;
  return {
    elements: elements.length,
    perimetres: n('perimetre'),
    hotes: n('hote'),
    domaines: n('domaine'),
    alertes: n('alerte'),
    details: n('alerte'),
    technologies: n('technologie'),
    ecartes: 0,
    tronque: false,
  };
};

/** Analyses explicites (hors autovacuum) de chaque table, lues dans les statistiques cumulées. */
async function analyses(tables: readonly string[]): Promise<Record<string, number>> {
  const r = await t.svc.db.q<{ relname: string; n: number }>(
    'SELECT relname, analyze_count::int AS n FROM pg_stat_user_tables WHERE relname = ANY($1::text[])',
    [tables],
  );
  return Object.fromEntries(r.rows.map((x) => [x.relname, x.n]));
}

/** Une synchronisation de l'instance par le service : inscrite, réclamée, lots rangés, terminée. Rend l'exécution. */
async function synchroniser(instance: string, elements: unknown[], resultat: unknown) {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  expect(job.operation).toBe('synchroniser');
  if (elements.length) await t.svc.integrations.lot(job.id as string, elements);
  return t.svc.integrations.terminer(job.id as string, { ok: true, resultat, erreur: null });
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
  admin = await login(t, await makeUser(t, 'stats_admin', 'admin'));
  tenable = await creerInstance(
    'tenable',
    'Tenable fictif',
    { adresse: 'https://tenable.exemple.invalid' },
    { accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', secretKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0f' },
  );
  alh = await creerInstance(
    'algolighthouse',
    'AlgoLightHouse fictif',
    { adresse: 'https://espace-fictif.algolighthouse.fr' },
    { cleApi: 'cle-api-fictive-0123456789abcdef' },
  );
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  await t.svc.db.q('DELETE FROM integration_executions');
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  t.svc.limits.integrationSynchro.reset();
});

describe('ANALYZE en fin de synchronisation reçue', () => {
  it('le rôle applicatif de test n’est pas superutilisateur (les ANALYZE ci-dessous valent pour suivi_app)', async () => {
    expect(
      (await t.svc.db.one<{ s: boolean }>('SELECT rolsuper AS s FROM pg_roles WHERE rolname = current_user'))?.s,
    ).toBe(false);
  });

  it('Tenable Security Center : les tables réécrites sont analysées après une synchronisation qui écrit', async () => {
    const avant = await analyses(TABLES_TENABLE);
    const alhAvant = await analyses(TABLES_ALH);
    const elements = elementsTenable();
    const fin = await synchroniser(tenable, elements, bilanTenable(elements));
    expect(fin.etat).toBe('recu');
    const apres = await analyses(TABLES_TENABLE);
    for (const table of TABLES_TENABLE) expect(apres[table], table).toBe((avant[table] ?? 0) + 1);
    // Seules les tables du connecteur synchronisé.
    expect(await analyses(TABLES_ALH)).toEqual(alhAvant);
  });

  it('AlgoLightHouse : les tables réécrites sont analysées après une synchronisation qui écrit', async () => {
    const avant = await analyses(TABLES_ALH);
    const tenableAvant = await analyses(TABLES_TENABLE);
    const elements = elementsAlh();
    const fin = await synchroniser(alh, elements, bilanAlh(elements));
    expect(fin.etat).toBe('recu');
    const apres = await analyses(TABLES_ALH);
    for (const table of TABLES_ALH) expect(apres[table], table).toBe((avant[table] ?? 0) + 1);
    expect(await analyses(TABLES_TENABLE)).toEqual(tenableAvant);
  });

  it('rien après une synchronisation vide ni après une synchronisation en échec', async () => {
    const avant = { ...(await analyses(TABLES_TENABLE)), ...(await analyses(TABLES_ALH)) };
    expect((await synchroniser(tenable, [], bilanTenable([]))).etat).toBe('recu');
    expect((await synchroniser(alh, [], bilanAlh([]))).etat).toBe('recu');
    // Bilan incohérent (éléments annoncés et reçus différents) : la fin est un échec, rien n'est analysé.
    const elements = elementsTenable();
    expect((await synchroniser(tenable, elements, { ...bilanTenable(elements), elements: 99 })).etat).toBe('echec');
    expect({ ...(await analyses(TABLES_TENABLE)), ...(await analyses(TABLES_ALH)) }).toEqual(avant);
  });

  it('un traitement après validation en échec ne change pas l’issue de la synchronisation', async () => {
    const recepteur = t.svc.integrations.enLots['tenable:synchroniser'] as OperationEnLots;
    const origine = recepteur.apresValidation;
    const warn = vi.spyOn(t.svc.db.log, 'warn');
    recepteur.apresValidation = async () => {
      throw Object.assign(new Error('échec simulé'), { code: '57014' });
    };
    try {
      const elements = elementsTenable();
      const fin = await synchroniser(tenable, elements, bilanTenable(elements));
      expect(fin.etat).toBe('recu');
      expect(fin.erreur).toBeNull();
      expect(
        (await t.svc.db.one<{ etat: string }>('SELECT etat FROM integration_executions WHERE id = $1', [fin.id]))?.etat,
      ).toBe('recu');
      expect(warn).toHaveBeenCalledWith({ execution: fin.id, code: '57014' }, 'traitement après la fin reçue en échec');
    } finally {
      recepteur.apresValidation = origine;
      warn.mockRestore();
    }
  });
});

describe('analyserTables', () => {
  it('poursuit après une table en échec, journalise sans donnée et ne lève jamais', async () => {
    const journal = { warn: vi.fn() } as unknown as Logger & { warn: ReturnType<typeof vi.fn> };
    const avant = await analyses(['vulnerabilites_constats']);
    const n = await analyserTables(
      t.svc.db.k,
      ['table_absente_fictive' as TableDb, 'vulnerabilites_constats'],
      journal,
    );
    expect(n).toBe(1);
    expect((await analyses(['vulnerabilites_constats'])).vulnerabilites_constats).toBe(
      (avant.vulnerabilites_constats ?? 0) + 1,
    );
    expect(journal.warn).toHaveBeenCalledTimes(1);
    expect(journal.warn).toHaveBeenCalledWith(
      { table: 'table_absente_fictive', code: '42P01' },
      'statistiques non recalculées (ANALYZE)',
    );
  });
});
