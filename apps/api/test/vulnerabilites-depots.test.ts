/* Module Vulnérabilités (ADR 0100, lot V4d) : périmètre des machines Tenable relié par dépôt (décision du RSSI du
   17/11/2026). Migration 082 sur base vierge ; dépôts rangés par la synchronisation (nom mis à jour, sans doublon, liaison
   jamais touchée, machine rapportée sans dépôt qui garde le sien) ; liste et liaison réservées à l'administration du module,
   If-Match, écriture sur le périmètre actuel et visé, journal sans nom de machine ni de dépôt ; héritage du périmètre du
   dépôt pour toutes les lectures (listes, fiches, failles par machine, compteurs, filtres) ; exception indiquée à la main
   qui prime ; retour à l'hérité et ses garde-fous ; périmètre du dépôt non montré à qui ne le lit pas ; masque de
   l'assistant : un nom ne sort jamais, un repère pour une machine lisible par héritage, « [machine] » sinon. Données
   entièrement fictives : noms en .invalid, adresses de 192.0.2.0/24, CVE fictives ; aucun service n'est joint. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, sessionUser, type TestApp, type TestUser } from './helpers.js';

const V = '/api/vulnerabilites';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurB: Agent, editeurA: Agent, respVuln: Agent, respA: Agent;
let uLecteurA: TestUser;
let perimA: string, perimB: string, instance: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000004${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-depot-${String(n).padStart(2, '0')}.exemple.invalid`;
const adresse = (n: number) => `192.0.2.${120 + n}`;
const NORD = { id: '11', nom: 'Dépôt fictif Nord' };
const SUD = { id: '12', nom: 'Dépôt fictif Sud' };
const machine = (n: number, depot: { id: string; nom: string } | null | undefined) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: nomMachine(n),
  adresse: adresse(n),
  systeme: 'Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
  ...(depot === undefined ? {} : { depot }),
});
const constat = (plugin: string) => ({
  type: 'constat',
  plugin,
  nom: `Exemple Linux : contrôle fictif ${plugin}`,
  gravite: 'critique',
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Update the affected packages.',
  cvss3Vecteur: null,
  cvss3Score: 9.1,
  vpr: 5,
  epss: 0.01,
  exploitable: false,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: null,
  finSupportLe: null,
  voirAussi: null,
  cves: ['CVE-2026-94001'],
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
/** Parc fictif : machines 1 et 2 dans le dépôt Nord, 3 dans le dépôt Sud, 4 sans dépôt connu ; un contrôle sur les quatre. */
const parc = (): Record<string, unknown>[] => [
  machine(1, NORD),
  machine(2, NORD),
  machine(3, SUD),
  machine(4, null),
  constat('940001'),
  ...[1, 2, 3, 4].map((k) => detection('940001', k)),
];
const bilan = (elements: unknown[]) => {
  const n = (x: string) => elements.filter((e) => (e as { type: string }).type === x).length;
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
async function synchroniser(elements: unknown[]) {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat: bilan(elements), erreur: null });
}
const n = async (table: string, where = 'true') =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`))!.n;
const machineId = async (k: number) =>
  (await t.svc.db.one<{ id: string; version: number }>(
    'SELECT id, version FROM vulnerabilites_machines WHERE identifiant_source = $1',
    [`uuid:${uuidMachine(k)}`],
  ))!;
interface Depot {
  id: string;
  nom: string;
  version: number;
  perimetreId: string | null;
  machines: number;
  exceptions: number;
}
const depot = async (nom: string): Promise<Depot> =>
  ((await admin.get(`${V}/depots`)).json() as Depot[]).find((d) => d.nom === nom)!;
const relier = async (qui: Agent, nom: string, perimetreId: string | null) => {
  const d = await depot(nom);
  return qui.put(`${V}/depots/${d.id}`, { perimetreId }, ifMatch(d.version));
};
interface Ligne {
  nom: string;
  perimetreId: string | null;
  perimetreNom: string | null;
  perimetreOrigine: string | null;
  depot: { nom: string; perimetreId: string | null; perimetreNom: string | null } | null;
}
const lignes = async (a: Agent, q = ''): Promise<Ligne[]> => (await a.get(`${V}/machines${q}`)).json().elements;
const noms = async (a: Agent, q = '') => (await lignes(a, q)).map((m) => m.nom).sort();
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'depot_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_dp_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_dp_modif', 'Vulnérabilités, modification', ARRAY['vulnerabilites:lire','vulnerabilites:modifier']),
       ('r_dp_adm', 'Vulnérabilités, administration', ARRAY['vulnerabilites:lire','vulnerabilites:modifier','vulnerabilites:administrer'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  uLecteurA = await makeUser(t, 'depot_lecteur_a', 'r_dp_lire', { rattache: false });
  const uLecteurB = await makeUser(t, 'depot_lecteur_b', 'r_dp_lire', { rattache: false });
  const uEditeurA = await makeUser(t, 'depot_editeur_a', 'r_dp_modif', { rattache: false });
  const uResp = await makeUser(t, 'depot_resp', 'r_dp_adm', { rattache: false });
  const uRespA = await makeUser(t, 'depot_resp_a', 'r_dp_adm', { rattache: false });
  await t.svc.db.q(
    `INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES
       ($1, $3, false), ($2, $4, false), ($1, $5, true), ($2, $5, false), ($1, $6, true)`,
    [perimA, perimB, uLecteurA.id, uLecteurB.id, uEditeurA.id, uRespA.id],
  );
  lecteurA = await login(t, uLecteurA);
  lecteurB = await login(t, uLecteurB);
  editeurA = await login(t, uEditeurA);
  respVuln = await login(t, uResp);
  respA = await login(t, uRespA);
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
    'vulnerabilites_assistant_reperes',
    'assistant_conversations',
    'vulnerabilites_detections',
    'vulnerabilites_constat_cves',
    'vulnerabilites_constats',
    'vulnerabilites_machines',
    'vulnerabilites_tenable_depots',
    'vulnerabilites_synchronisations',
    'vulnerabilites_tenable_etat',
    'integration_executions',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  await synchroniser(parc());
});

describe('migration 082 sur base vierge', () => {
  it('crée la table des dépôts et la colonne du dépôt d’une machine, bornées en base', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '082_vulnerabilites_tenable_depots.sql'"))
        ?.ok,
    ).toBe(1);
    const refus = (q: string, p: unknown[]) => expect(t.svc.db.q(q, p)).rejects.toThrow();
    const d = `INSERT INTO vulnerabilites_tenable_depots (integration_id, depot_tenable, nom, vu_numero) VALUES ($1, $2, $3, 1)`;
    await refus(d, [instance, 0, 'Dépôt fictif']);
    await refus(d, [instance, 5, '']);
    await refus(d, [instance, 5, 'Dépôt\nfictif']);
    await refus(d, [instance, Number(NORD.id), 'Doublon']);
    // Un dépôt supprimé laisse ses machines sans dépôt, sans les supprimer.
    await t.svc.db.q('DELETE FROM vulnerabilites_tenable_depots WHERE depot_tenable = $1', [Number(SUD.id)]);
    expect(await n('vulnerabilites_machines')).toBe(4);
    expect(await n('vulnerabilites_machines', 'depot_id IS NULL')).toBe(2);
  });
});

describe('dépôts rangés par la synchronisation', () => {
  it('sans doublon, nom mis à jour, liaison et machines jamais touchées ; machine sans dépôt rapporté : le sien gardé', async () => {
    expect(await n('vulnerabilites_tenable_depots')).toBe(2);
    expect(await n('vulnerabilites_machines', 'depot_id IS NOT NULL')).toBe(3);
    expect((await relier(admin, NORD.nom, perimA)).statusCode).toBe(200);
    const m1 = await machineId(1);
    const avant = await depot(NORD.nom);
    // Nom changé dans Tenable ; machine 2 rapportée sans dépôt (inventaire ou forme inattendue) ; machine 3 sans le champ.
    const renomme = { id: NORD.id, nom: 'Dépôt fictif Nord renommé' };
    await synchroniser([machine(1, renomme), machine(2, null), machine(3, undefined), ...parc().slice(3)]);
    expect(await n('vulnerabilites_tenable_depots')).toBe(2);
    const apres = await depot('Dépôt fictif Nord renommé');
    expect(apres).toMatchObject({ id: avant.id, perimetreId: perimA, version: avant.version, machines: 2 });
    expect(await machineId(1)).toEqual(m1);
    expect(await noms(lecteurA)).toEqual([nomMachine(1), nomMachine(2)]);
    expect((await depot(SUD.nom)).machines).toBe(1);
    // Machine qui change de dépôt dans Tenable : elle suit son nouveau dépôt.
    await synchroniser([machine(2, SUD), ...parc().slice(4)]);
    expect((await depot(SUD.nom)).machines).toBe(2);
    expect(await noms(lecteurA)).toEqual([nomMachine(1)]);
  });
});

describe('liste et liaison des dépôts', () => {
  it('administration du module seulement ; If-Match ; écriture sur le périmètre actuel et visé ; journal sans nom', async () => {
    const dejaRelies = (await audits('vulnerabilites.depot.relie')).length;
    const dejaDelies = (await audits('vulnerabilites.depot.delie')).length;
    for (const a of [lecteurA, editeurA]) expect((await a.get(`${V}/depots`)).statusCode).toBe(403);
    const liste = (await respVuln.get(`${V}/depots`)).json() as Depot[];
    expect(liste.map((d) => [d.nom, d.machines, d.perimetreId])).toEqual([
      [NORD.nom, 2, null],
      [SUD.nom, 1, null],
    ]);
    expect(liste[0]).toMatchObject({ depotTenable: 11, present: true, exceptions: 0 });
    const nord = await depot(NORD.nom);
    const url = `${V}/depots/${nord.id}`;
    expect((await editeurA.put(url, { perimetreId: perimA }, ifMatch(nord.version))).statusCode).toBe(403);
    expect((await respA.put(url, { perimetreId: perimA })).statusCode).toBe(428);
    expect((await respA.put(url, { perimetreId: perimA }, ifMatch(nord.version + 3))).statusCode).toBe(412);
    expect((await respA.put(url, { perimetreId: 'x' }, ifMatch(nord.version))).statusCode).toBe(422);
    // Périmètre visé non accessible : comme un périmètre inconnu.
    expect((await respVuln.put(url, { perimetreId: perimA }, ifMatch(nord.version))).statusCode).toBe(422);
    expect(
      (await respA.put(url, { perimetreId: '00000000-0000-4000-8000-0000000000ff' }, ifMatch(nord.version))).statusCode,
    ).toBe(422);
    const ok = await respA.put(url, { perimetreId: perimA }, ifMatch(nord.version));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({
      perimetreId: perimA,
      perimetreNom: 'Périmètre fictif A',
      majPar: 'depot_resp_a',
    });
    expect(ok.headers.etag).toBe(`"${nord.version + 1}"`);
    // Vers B, où il n'écrit pas : refusé ; délier depuis A, où il écrit : admis.
    expect((await respA.put(url, { perimetreId: perimB }, ifMatch(nord.version + 1))).statusCode).toBe(422);
    expect((await admin.put(url, { perimetreId: perimB }, ifMatch(nord.version + 1))).statusCode).toBe(200);
    // Lié à B, où il n'a aucun accès : ni délier ni relier ailleurs.
    expect((await respA.put(url, { perimetreId: null }, ifMatch(nord.version + 2))).statusCode).toBe(404);
    expect((await respA.put(url, { perimetreId: perimA }, ifMatch(nord.version + 2))).statusCode).toBe(404);
    expect((await depot(NORD.nom)).perimetreId).toBe(perimB);
    expect((await admin.put(url, { perimetreId: null }, ifMatch(nord.version + 2))).statusCode).toBe(200);
    const relies = (await audits('vulnerabilites.depot.relie')).slice(dejaRelies);
    expect(relies.map((a) => a.username)).toEqual(['depot_resp_a', 'depot_admin']);
    expect(relies[0]).toMatchObject({ target: nord.id });
    expect(relies[0]!.details).toEqual({
      integration: instance,
      avant: { perimetreId: null },
      apres: { perimetreId: perimA },
      machinesHeritieres: 2,
      version: nord.version + 1,
    });
    expect((await audits('vulnerabilites.depot.delie')).length - dejaDelies).toBe(1);
    const journal = JSON.stringify(
      (await t.svc.db.q("SELECT details FROM audit_log WHERE action LIKE 'vulnerabilites.%'")).rows,
    );
    expect(journal).not.toMatch(/srv-depot|192\.0\.2\.|Dépôt fictif/);
  });
});

describe('périmètre hérité du dépôt', () => {
  it('droits de lecture avant et après la liaison : listes, fiches, compteurs, filtres', async () => {
    // Avant : aucune machine n'a de périmètre ; seule l'administration du module les lit.
    expect(await noms(lecteurA)).toEqual([]);
    expect((await lecteurA.get(`${V}/constats`)).json().total).toBe(0);
    expect((await noms(respVuln)).length).toBe(4);
    expect((await relier(admin, NORD.nom, perimA)).statusCode).toBe(200);
    // Après : les machines du dépôt Nord se lisent par A ; l'administration du module ne lit plus que les autres.
    const vues = await lignes(lecteurA);
    expect(vues.map((m) => [m.nom, m.perimetreNom, m.perimetreOrigine])).toEqual([
      [nomMachine(1), 'Périmètre fictif A', 'depot'],
      [nomMachine(2), 'Périmètre fictif A', 'depot'],
    ]);
    expect(vues[0]!.depot).toMatchObject({ nom: NORD.nom, perimetreId: perimA, perimetreNom: 'Périmètre fictif A' });
    expect(await noms(respVuln)).toEqual([nomMachine(3), nomMachine(4)]);
    expect(await noms(lecteurA, `?perimetre=${perimA}`)).toEqual([nomMachine(1), nomMachine(2)]);
    expect(await noms(respVuln, '?perimetre=aucun')).toEqual([nomMachine(3), nomMachine(4)]);
    // Fiche d'une machine, fiche et compteurs d'un constat : mêmes droits.
    const m1 = await machineId(1);
    const m3 = await machineId(3);
    expect((await lecteurA.get(`${V}/machines/${m1.id}`)).json()).toMatchObject({ perimetreId: perimA });
    expect((await lecteurA.get(`${V}/machines/${m3.id}`)).statusCode).toBe(404);
    const c = (await lecteurA.get(`${V}/constats`)).json().elements[0];
    expect(c.machines).toBe(2);
    const fiche = (await lecteurA.get(`${V}/constats/${c.id}`)).json();
    expect(fiche.parRole.aucun.map((m: { nom: string; perimetreId: string }) => [m.nom, m.perimetreId])).toEqual([
      [nomMachine(1), perimA],
      [nomMachine(2), perimA],
    ]);
    // Délier : retour à l'administration du module seulement.
    expect((await relier(admin, NORD.nom, null)).statusCode).toBe(200);
    expect(await noms(lecteurA)).toEqual([]);
    expect((await noms(respVuln)).length).toBe(4);
  });

  it('exception indiquée à la main qui prime ; retour à l’hérité et ses garde-fous', async () => {
    expect((await relier(admin, NORD.nom, perimA)).statusCode).toBe(200);
    // Exception : la machine 2 est indiquée à la main dans B.
    const m2 = await machineId(2);
    const r = await admin.patch(`${V}/machines/${m2.id}`, { perimetreId: perimB }, ifMatch(m2.version));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ perimetreId: perimB, perimetreOrigine: 'machine', depot: { nom: NORD.nom } });
    expect(await noms(lecteurA)).toEqual([nomMachine(1)]);
    expect(await noms(lecteurB)).toEqual([nomMachine(2)]);
    // Qui lit B sans lire A ne voit pas le périmètre du dépôt.
    expect((await lignes(lecteurB))[0]!.depot).toEqual({
      id: (await depot(NORD.nom)).id,
      nom: NORD.nom,
      perimetreId: null,
      perimetreNom: null,
    });
    expect(await depot(NORD.nom)).toMatchObject({ machines: 2, exceptions: 1 });
    // Relier le dépôt ailleurs ne touche pas l'exception.
    expect((await relier(admin, NORD.nom, perimB)).statusCode).toBe(200);
    expect((await relier(admin, NORD.nom, perimA)).statusCode).toBe(200);
    expect(await noms(lecteurB)).toEqual([nomMachine(2)]);
    // Retour à l'hérité : écriture exigée sur le périmètre actuel (B, en lecture seule pour l'éditeur de A).
    const v2 = (await machineId(2)).version;
    expect((await editeurA.patch(`${V}/machines/${m2.id}`, { perimetreId: null }, ifMatch(v2))).statusCode).toBe(403);
    const retour = await admin.patch(`${V}/machines/${m2.id}`, { perimetreId: null }, ifMatch(v2));
    expect(retour.statusCode, retour.body).toBe(200);
    expect(retour.json()).toMatchObject({ perimetreId: perimA, perimetreOrigine: 'depot' });
    expect(await noms(lecteurA)).toEqual([nomMachine(1), nomMachine(2)]);
    // Machine héritée : l'éditeur de A la modifie (écriture sur le périmètre effectif), l'indique à la main dans A, puis
    // revient à l'hérité (même périmètre : admis sans administrer).
    const m1 = await machineId(1);
    const role = await editeurA.patch(`${V}/machines/${m1.id}`, { role: 'front' }, ifMatch(m1.version));
    expect(role.statusCode, role.body).toBe(200);
    const main = await editeurA.patch(`${V}/machines/${m1.id}`, { perimetreId: perimA }, ifMatch(m1.version + 1));
    expect(main.json()).toMatchObject({ perimetreId: perimA, perimetreOrigine: 'machine', role: 'front' });
    const herite = await editeurA.patch(`${V}/machines/${m1.id}`, { perimetreId: null }, ifMatch(m1.version + 2));
    expect(herite.statusCode, herite.body).toBe(200);
    expect(herite.json()).toMatchObject({ perimetreId: perimA, perimetreOrigine: 'depot' });
    // Dépôt non relié : retirer le périmètre indiqué à la main demande administrer (la machine n'aurait plus de périmètre).
    const m3 = await machineId(3);
    expect((await admin.patch(`${V}/machines/${m3.id}`, { perimetreId: perimA }, ifMatch(m3.version))).statusCode).toBe(
      200,
    );
    const refus = await editeurA.patch(`${V}/machines/${m3.id}`, { perimetreId: null }, ifMatch(m3.version + 1));
    expect(refus.statusCode).toBe(403);
    expect(refus.json().error ?? refus.body).toMatch(/administrer/);
    // Retour à un dépôt relié à B : écriture exigée sur B.
    expect((await relier(admin, SUD.nom, perimB)).statusCode).toBe(200);
    expect(
      (await editeurA.patch(`${V}/machines/${m3.id}`, { perimetreId: null }, ifMatch(m3.version + 1))).statusCode,
    ).toBe(403);
    // En masse : même règle, tout ou rien.
    const [x1, x3] = [await machineId(1), await machineId(3)];
    expect(
      (await editeurA.post(`${V}/machines/affectation`, { machines: [x1, x3], perimetreId: null })).statusCode,
    ).toBe(403);
    expect((await admin.post(`${V}/machines/affectation`, { machines: [x1, x3], perimetreId: null })).statusCode).toBe(
      200,
    );
    expect((await lignes(lecteurB)).map((m) => [m.nom, m.perimetreOrigine])).toEqual([[nomMachine(3), 'depot']]);
    // Le journal d'une affectation garde le périmètre indiqué à la main, sans nom.
    const journal = JSON.stringify(
      (await t.svc.db.q("SELECT details FROM audit_log WHERE action LIKE 'vulnerabilites.%'")).rows,
    );
    expect(journal).not.toMatch(/srv-depot|192\.0\.2\.|Dépôt fictif/);
  });

  it('assistant : un nom ne sort jamais ; repère pour une machine lisible par héritage, « [machine] » sinon', async () => {
    const profil = (await t.svc.db.one<{ id: string }>('SELECT id FROM assistant_profils ORDER BY id LIMIT 1'))!.id;
    const conv = (await t.svc.db.one<{ id: string }>(
      'INSERT INTO assistant_conversations (user_id, profil) VALUES ($1, $2) RETURNING id',
      [uLecteurA.id, profil],
    ))!.id;
    const user = await sessionUser(t, uLecteurA);
    const texte = `Corriger ${nomMachine(1)} puis ${nomMachine(3)}.`;
    const avant = await (await t.svc.assistant.vulnerabilites!.masque(user, conv))(texte);
    expect(avant).toBe('Corriger [machine] puis [machine].');
    expect((await relier(admin, NORD.nom, perimA)).statusCode).toBe(200);
    const apres = await (await t.svc.assistant.vulnerabilites!.masque(user, conv))(texte);
    expect(apres).not.toContain('srv-depot');
    expect(apres).not.toContain('Corriger [machine] puis');
    expect(apres).toMatch(/ puis \[machine\]\.$/);
    // La résolution d'un repère suit les mêmes droits : lisible après la liaison, plus après la déliaison.
    const repere = apres.slice('Corriger '.length, apres.indexOf(' puis'));
    expect((await t.svc.assistant.vulnerabilites!.resolveur(user, conv))(repere)).toEqual({ machine: nomMachine(1) });
    expect((await relier(admin, NORD.nom, null)).statusCode).toBe(200);
    expect((await t.svc.assistant.vulnerabilites!.resolveur(user, conv))(repere)).toBe('non_lisible');
    // En ronde (sans conversation), aucune machine n'a de repère.
    expect(await (await t.svc.assistant.vulnerabilites!.masque(user, null))(texte)).toBe(
      'Corriger [machine] puis [machine].',
    );
  });
});
