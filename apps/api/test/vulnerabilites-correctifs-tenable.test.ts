/* Module Vulnérabilités (ADR 0100, lot QF-TEN) : correctifs regroupés de Tenable (vue `sumremediation`). Migration 102 sur
   base vierge et contraintes ; élément revalidé par l'API (champ hors liste, identifiant mal formé, contrôle en double :
   lot refusé) ; rangement sans doublon, rattachement aux seuls constats rangés de l'instance, contrôles remplacés à la
   synchronisation suivante ; seuls les correctifs de la dernière synchronisation reçue en entier sont montrés (rien n'est
   supprimé) ; fiche d'un constat et d'une CVE : rubrique « Correctif recommandé par Tenable », machines comptées selon les
   droits, absente sans correctif (une seule lecture de plus par fiche, par construction). Données entièrement fictives : noms en .invalid,
   adresses de 192.0.2.0/24, identifiants de CVE fictifs ; aucun service n'est joint. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent;
let perimA: string, instance: string;

const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000000${(0xa0 + n).toString(16)}`;
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: `srv-qften-${String(n).padStart(2, '0')}.exemple.invalid`,
  adresse: `192.0.2.${60 + n}`,
  systeme: 'Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
const constat = (plugin: string, cves: string[]) => ({
  type: 'constat',
  plugin,
  nom: `Exemple Linux : contrôle fictif ${plugin}`,
  gravite: 'critique',
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: `Update the affected packages (${plugin}).`,
  cvss3Vecteur: null,
  cvss3Score: 9.1,
  vpr: 5,
  epss: 0.0056,
  exploitable: false,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: '2026-07-14T12:00:00.000Z',
  finSupportLe: null,
  voirAussi: null,
  cves,
  cvesTronquees: false,
});
const detection = (plugin: string, n: number) => ({
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
});
const correctif = (identifiant: string, plugins: string[], extra: Record<string, unknown> = {}) => ({
  type: 'correctif',
  identifiant,
  solution: `Apply the fictitious cumulative update ${identifiant}.`,
  plugins,
  machines: 40,
  cves: 7,
  detections: 90,
  vpr: 6.7,
  cvss3Score: 8.8,
  epss: 0.125,
  ...extra,
});
const CVE = 'CVE-2026-91001';
/** Deux machines (1 dans le périmètre A, 2 sans périmètre) ; 910001 (CVE) sur 1 et 2, 910002 sur 2. */
const parc = () => [
  machine(1),
  machine(2),
  constat('910001', [CVE]),
  constat('910002', []),
  detection('910001', 1),
  detection('910001', 2),
  detection('910002', 2),
];
const bilan = (elements: unknown[]) => {
  const n = (x: string) => elements.filter((e) => (e as { type: string }).type === x).length;
  return {
    elements: elements.length,
    pages: 1,
    constats: n('constat'),
    detections: n('detection'),
    machines: n('machine'),
    hotes: 0,
    ecartes: 0,
    tronque: false,
    inventaire: { ok: true, erreur: null },
  };
};
async function reclamer() {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  return (await t.svc.integrations.reclamer(true))!.id as string;
}
async function synchroniser(elements: unknown[]) {
  const id = await reclamer();
  for (let i = 0; i < elements.length; i += 500) await t.svc.integrations.lot(id, elements.slice(i, i + 500));
  await t.svc.integrations.terminer(id, { ok: true, resultat: bilan(elements), erreur: null });
  return id;
}
const n = async (table: string, where = 'true') =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`))!.n;
const idConstat = async (plugin: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = $1', [plugin]))!.id;
type Regroupe = { identifiant: string; solution: string; controles: number; cves: number | null };
const regroupes = async (a: Agent, nature: 'constat' | 'cve', id: string) => {
  const r = await a.get(`${V}/fiches/${nature}/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json().recommandations.tenableRegroupes as (Regroupe & {
    machinesLues: number;
    machinesHorsLecture: boolean;
  })[];
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'qften_admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_qften_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])",
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uA = await makeUser(t, 'qften_lecteur_a', 'r_qften_lire', { rattache: false });
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false)', [perimA, uA.id]);
  lecteurA = await login(t, uA);
  const r = await admin.post('/api/integrations/instances', {
    type: 'tenable',
    nom: 'Tenable fictif',
    configuration: { adresse: 'https://tenable.exemple.invalid' },
  });
  instance = r.json().id as string;
  await admin.put(`/api/integrations/instances/${instance}/secrets`, {
    accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    secretKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
  });
  const a = await admin.put(
    `/api/integrations/instances/${instance}/activation`,
    { actif: true, fluxConfirme: true },
    { 'if-match': `"${r.json().version}"` },
  );
  expect(a.statusCode, a.body).toBe(200);
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  for (const table of [
    'vulnerabilites_tenable_correctif_constats',
    'vulnerabilites_tenable_correctifs',
    'vulnerabilites_detections',
    'vulnerabilites_constat_cves',
    'vulnerabilites_constats',
    'vulnerabilites_machines',
    'vulnerabilites_synchronisations',
    'vulnerabilites_tenable_etat',
    'integration_executions',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  t.svc.limits.integrationSynchro.reset();
});

describe('migration 102 sur base vierge', () => {
  it('crée les tables et borne les données en base', async () => {
    expect(
      (
        await t.svc.db.one(
          "SELECT 1 AS ok FROM schema_migrations WHERE name = '102_vulnerabilites_correctifs_tenable.sql'",
        )
      )?.ok,
    ).toBe(1);
    await synchroniser(parc());
    const insere = (champs: string) =>
      t.svc.db.q(
        `INSERT INTO vulnerabilites_tenable_correctifs (integration_id, solution_id, solution, vu_numero, machines, epss_score)
         VALUES ($1, ${champs})`,
        [instance],
      );
    await expect(insere("'SC 1; DROP', 'x', 1, null, null")).rejects.toThrow();
    await expect(insere(`'SC-1', '${'x'.repeat(2001)}', 1, null, null`)).rejects.toThrow();
    await expect(insere("'SC-1', 'x', 1, -1, null")).rejects.toThrow();
    await expect(insere("'SC-1', 'x', 1, null, 2")).rejects.toThrow();
    await expect(
      t.svc.db.q('UPDATE vulnerabilites_tenable_etat SET correctifs_numero = numero + 1 WHERE integration_id = $1', [
        instance,
      ]),
    ).rejects.toThrow();
  });
});

describe('rangement des correctifs regroupés', () => {
  it('éléments revalidés : champ hors liste, identifiant mal formé, contrôle en double ou absent refusent le lot', async () => {
    const id = await reclamer();
    await t.svc.integrations.lot(id, parc());
    for (const mauvais of [
      { ...correctif('SC-91001', ['910001']), remediationList: 'srv-qften-01.exemple.invalid' },
      correctif('SC 91001; DROP', ['910001']),
      correctif('SC-91001', ['910001', '910001']),
      correctif('SC-91001', []),
      correctif('SC-91001', ['910001'], { solution: '<b>texte</b>' }),
      correctif('SC-91001', ['910001'], { epss: 12.5 }),
    ])
      await expect(t.svc.integrations.lot(id, [mauvais])).rejects.toMatchObject({ status: 422 });
    expect(await n('vulnerabilites_tenable_correctifs')).toBe(0);
  });

  it('rattachés aux seuls constats rangés ; rejoués sans doublon, contrôles remplacés ; montrés après une fin acceptée', async () => {
    // Correctifs dans un lot à part, après les constats ; 919999 n'est pas un constat rangé.
    const id = await reclamer();
    await t.svc.integrations.lot(id, parc());
    const els = [correctif('SC-91001', ['910001', '910002', '919999']), correctif('SC-91002', ['910002'])];
    await t.svc.integrations.lot(id, els);
    expect(await n('vulnerabilites_tenable_correctifs')).toBe(2);
    expect(await n('vulnerabilites_tenable_correctif_constats')).toBe(3);
    // Avant la fin : rien n'est montré.
    expect(await regroupes(admin, 'constat', await idConstat(910001))).toEqual([]);
    await t.svc.integrations.terminer(id, { ok: true, resultat: bilan([...parc(), ...els]), erreur: null });
    const ligne = await t.svc.db.one<Record<string, unknown>>(
      "SELECT solution, machines, cves, detections, vpr_score, cvss3_score, epss_score FROM vulnerabilites_tenable_correctifs WHERE solution_id = 'SC-91001'",
    );
    expect(ligne).toEqual({
      solution: 'Apply the fictitious cumulative update SC-91001.',
      machines: 40,
      cves: 7,
      detections: 90,
      vpr_score: '6.7',
      cvss3_score: '8.8',
      epss_score: '0.12500',
    });
    expect((await regroupes(admin, 'constat', await idConstat(910001))).map((c) => c.identifiant)).toEqual([
      'SC-91001',
    ]);
    expect((await regroupes(admin, 'constat', await idConstat(910002))).map((c) => c.identifiant)).toEqual([
      'SC-91001',
      'SC-91002',
    ]);
    // Synchronisation suivante : SC-91001 ne corrige plus que 910001, SC-91002 n'est plus rapporté (gardé, plus montré).
    await synchroniser([...parc(), correctif('SC-91001', ['910001'])]);
    expect(await n('vulnerabilites_tenable_correctifs')).toBe(2);
    // SC-91001 : son seul contrôle restant ; SC-91002 garde ses liens (non supprimé), mais n'est plus montré.
    expect(
      await n(
        'vulnerabilites_tenable_correctif_constats l JOIN vulnerabilites_tenable_correctifs c ON c.id = l.correctif_id',
        "c.solution_id = 'SC-91001'",
      ),
    ).toBe(1);
    expect(await n('vulnerabilites_tenable_correctif_constats')).toBe(2);
    expect(await regroupes(admin, 'constat', await idConstat(910002))).toEqual([]);
    // Une synchronisation sans correctif (lecture échouée ou incomplète côté script) garde les derniers montrés.
    await synchroniser(parc());
    expect((await regroupes(admin, 'constat', await idConstat(910001))).map((c) => c.identifiant)).toEqual([
      'SC-91001',
    ]);
    // Journal : nombres seulement, aucun texte de correctif.
    const { rows } = await t.svc.db.q<{ details: unknown }>(
      "SELECT details FROM audit_log WHERE action = 'vulnerabilites.synchronisation.terminee'",
    );
    expect(JSON.stringify(rows)).not.toContain('cumulative update');
  });
});

describe('fiche : « Correctif recommandé par Tenable »', () => {
  it('constat et CVE ; machines comptées selon les droits ; absente sans correctif', async () => {
    await synchroniser([...parc(), correctif('SC-91001', ['910001', '910002'])]);
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE identifiant_source = $1', [
      `uuid:${uuidMachine(1)}`,
      perimA,
    ]);
    const c1 = await idConstat(910001);
    const attendu = {
      identifiant: 'SC-91001',
      solution: 'Apply the fictitious cumulative update SC-91001.',
      controles: 2,
      cves: 7,
    };
    // Administrateur : les deux machines ; la personne du périmètre A : la sienne, et le drapeau pour l'autre.
    expect(await regroupes(admin, 'constat', c1)).toEqual([
      { ...attendu, machinesLues: 2, machinesHorsLecture: false },
    ]);
    expect(await regroupes(lecteurA, 'constat', c1)).toEqual([
      { ...attendu, machinesLues: 1, machinesHorsLecture: true },
    ]);
    expect(await regroupes(lecteurA, 'cve', CVE)).toEqual([{ ...attendu, machinesLues: 1, machinesHorsLecture: true }]);
    // Ni nom ni adresse de machine, ni le nombre de machines de Tenable (40).
    const brut = (await lecteurA.get(`${V}/fiches/cve/${CVE}`)).body;
    expect(brut).not.toMatch(/srv-qften|192\.0\.2\.6|"machines":40/);
    // Constat que la personne ne lit pas : 404 comme avant.
    expect((await lecteurA.get(`${V}/fiches/constat/${await idConstat(910002)}`)).statusCode).toBe(404);
    // Sans correctif regroupé : liste vide (aucune rubrique).
    await synchroniser([...parc(), correctif('SC-91003', ['910002'])]);
    expect(await regroupes(admin, 'constat', c1)).toEqual([]);
    expect(await regroupes(admin, 'cve', CVE)).toEqual([]);
  });
});
