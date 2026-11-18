/* Module Vulnérabilités (ADR 0100, lot ALH4) : route de la carte « Lignes d'approche » de la surface externe. Graphe déjà
   filtré par les droits : actifs lisibles et présents (périmètre ALH relié visible, sinon administrer), domaine parent rendu
   seulement s'il est lui aussi lisible, alertes ouvertes lisibles avec leur priorité (P1 par une exploitation avérée),
   actif visé seulement s'il est rendu, machines reliées lisibles (une machine illisible n'est qu'un drapeau, une proposition
   vers elle ne compte pas) ; bornes et troncature signalée ; rien n'est écrit ; droit et module contrôlés. Données
   entièrement fictives : domaines en .example et .invalid, adresses de 192.0.2.0/24 et 198.51.100.0/24 ; aucun service
   n'est joint. */
import { type CarteSurfaceDto, CARTE_SURFACE_BORNES } from '@suivi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const S = '/api/vulnerabilites/surface';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent, sansDroit: Agent;
let perimA: string, perimB: string, alh: string, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000006${(0xa0 + n).toString(16)}`;

/* ------------------------------------------------------------------ AlgoLightHouse fictif */
const hote = (n: number, perim: number, adresse: string) => ({
  type: 'hote',
  id: U(n),
  perimetre: U(perim),
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
});
const domaine = (n: number, perim: number, nom: string, adresse: string | null, parent: number | null) => ({
  type: 'domaine',
  id: U(n),
  perimetre: U(perim),
  statut: 'monitored',
  domaine: nom,
  niveau: parent ? 3 : 2,
  importManuel: false,
  adresse,
  parent: parent ? U(parent) : null,
  creeLe: '2026-02-01T10:11:01.000Z',
  majLe: null,
});
const alerte = (n: number, perim: number, extra: Record<string, unknown>) => ({
  type: 'alerte',
  id: U(n),
  perimetre: U(perim),
  typeAlerte: 'vulnerable_service',
  criticite: 'major',
  statut: 'untreated',
  titre: `Alerte fictive ${n}`,
  verifiee: true,
  detail: true,
  cibleType: 'host',
  cibleValeur: null,
  cibleHote: null,
  cibleDomaine: null,
  cves: [],
  defauts: [],
  creeLe: '2026-11-10T10:00:00.000Z',
  majLe: '2026-11-15T10:00:00.000Z',
  termineeLe: null,
  ...extra,
});
/** Périmètres ALH : 1 (relié à A), 2 (relié à B), 3 (non relié). Domaine racine 20 (1), sous-domaines 21 (1, résout vers
    l'hôte 11), 24 (2) et 25 (1, enfant de 24) ; hôtes 11 (1), 12 (2), 13 (3). */
const surface = (): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif 1' },
  { type: 'perimetre', id: U(2), nom: 'Périmètre ALH fictif 2' },
  { type: 'perimetre', id: U(3), nom: 'Périmètre ALH fictif 3' },
  hote(11, 1, '192.0.2.10'),
  hote(12, 2, '198.51.100.20'),
  hote(13, 3, '198.51.100.30'),
  domaine(20, 1, 'exemple-fictif.example', '192.0.2.1', null),
  domaine(21, 1, 'www.exemple-fictif.example', '192.0.2.10', 20),
  domaine(24, 2, 'b.exemple-fictif.example', '198.51.100.40', 20),
  domaine(25, 1, 'sous.b.exemple-fictif.example', '198.51.100.41', 24),
  alerte(31, 1, {
    criticite: 'critical',
    cibleType: 'domain',
    cibleValeur: 'www.exemple-fictif.example',
    cibleDomaine: U(21),
    cves: ['CVE-2026-91002'],
  }),
  alerte(32, 1, { criticite: 'minor', cibleValeur: '198.51.100.20', cibleHote: U(12) }),
  alerte(33, 2, { cibleValeur: '198.51.100.20', cibleHote: U(12) }),
  alerte(34, 1, {
    typeAlerte: 'typosquatting',
    criticite: 'important',
    cibleType: 'domain',
    cibleValeur: 'exemp1e-fictif.example',
  }),
  alerte(35, 1, { statut: 'completed', cibleValeur: '192.0.2.10', cibleHote: U(11) }),
  alerte(36, 3, { cibleValeur: '198.51.100.30', cibleHote: U(13) }),
];
const bilanAlh = (el: Record<string, unknown>[]) => {
  const c = (x: string) => el.filter((e) => e.type === x).length;
  return {
    elements: el.length,
    perimetres: c('perimetre'),
    hotes: c('hote'),
    domaines: c('domaine'),
    alertes: c('alerte'),
    details: c('alerte'),
    technologies: 0,
    ecartes: 0,
    tronque: false,
  };
};

/* ------------------------------------------------------------------ Tenable fictif */
const machine = (n: number, nom: string, adresse: string) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom,
  adresse,
  systeme: 'Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
/** Machines : 1 (192.0.2.10, périmètre A), 4 (sans critère, A), 5 (198.51.100.20, B). */
const parc = (): Record<string, unknown>[] => [
  machine(1, 'srv-front-01.interne.invalid', '192.0.2.10'),
  machine(4, 'srv-isole.interne.invalid', '192.0.2.32'),
  machine(5, 'srv-cache.interne.invalid', '198.51.100.20'),
];
const bilanTenable = (el: Record<string, unknown>[]) => ({
  elements: el.length,
  pages: 1,
  constats: 0,
  detections: 0,
  machines: el.length,
  hotes: 0,
  ecartes: 0,
  tronque: false,
  inventaire: { ok: true, erreur: null },
});

async function synchroniser(instance: string, elements: Record<string, unknown>[], resultat: unknown) {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat, erreur: null });
}
const idActif = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_actifs WHERE alh_id = $1', [U(n)]))!.id;
const idAlerte = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_alertes WHERE alh_id = $1', [U(n)]))!.id;
const idMachine = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_machines WHERE identifiant_source = $1', [
    `uuid:${uuidMachine(n)}`,
  ]))!.id;
const carte = async (a: Agent): Promise<CarteSurfaceDto> => {
  const r = await a.get(`${S}/carte`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as CarteSurfaceDto;
};

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
  admin = await login(t, await makeUser(t, 'cs_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_cs_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_cs_rien', 'Sans droit sur les vulnérabilités', ARRAY[]::text[])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  // lecteurA : lit A seulement ; sansDroit : lit A, sans le droit de lire le module.
  const u = {
    lecteurA: await makeUser(t, 'cs_lecteur_a', 'r_cs_lire', { rattache: false }),
    sansDroit: await makeUser(t, 'cs_sans_droit', 'r_cs_rien', { rattache: false }),
  };
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false), ($1, $3, false)', [
    perimA,
    u.lecteurA.id,
    u.sansDroit.id,
  ]);
  lecteurA = await login(t, u.lecteurA);
  sansDroit = await login(t, u.sansDroit);
  alh = await creerInstance(
    'algolighthouse',
    'AlgoLightHouse fictif',
    { adresse: 'https://espace-fictif.algolighthouse.fr' },
    { cleApi: 'cle-api-fictive-0123456789abcdef' },
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
    'vulnerabilites_veille_cve',
    'vulnerabilites_alh_liaisons_machines',
    'vulnerabilites_alh_alerte_cves',
    'vulnerabilites_alh_alertes',
    'vulnerabilites_alh_actifs',
    'vulnerabilites_alh_perimetres',
    'vulnerabilites_alh_synchronisations',
    'vulnerabilites_alh_etat',
    'vulnerabilites_machines',
    'vulnerabilites_synchronisations',
    'vulnerabilites_tenable_etat',
    'integration_executions',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  t.svc.limits.integrationSynchro.reset();
  const el = surface();
  await synchroniser(alh, el, bilanAlh(el));
  await synchroniser(tenable, parc(), bilanTenable(parc()));
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimA]);
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(2), perimB]);
  for (const [n, p] of [
    [1, perimA],
    [4, perimA],
    [5, perimB],
  ] as const)
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE id = $1', [await idMachine(n), p]);
  // CVE de l'alerte 31 au catalogue KEV : exploitation avérée, P1 pour une alerte ouverte.
  await t.svc.db.q("INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout) VALUES ('CVE-2026-91002', '2026-11-01')");
  // Liaisons : www (21) confirmée vers la machine 1 (A) et vers la machine 5 (B) ; proposition 20 → machine 5 (B).
  const h = 'a'.repeat(64);
  await t.svc.db.q(
    "UPDATE vulnerabilites_alh_liaisons_machines SET statut = 'confirmee', decide_par = 'test', decide_le = now() WHERE actif_id = $1 AND machine_id = $2",
    [await idActif(21), await idMachine(1)],
  );
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_alh_liaisons_machines
       (actif_id, machine_id, statut, motif, origine, empreinte_actif, empreinte_machine, decide_par, decide_le)
     VALUES ($1, $2, 'confirmee', NULL, 'manuelle', $5, $5, 'test', now()),
            ($3, $4, 'proposee', 'nom_court', 'proposition', $5, $5, NULL, NULL)`,
    [await idActif(21), await idMachine(5), await idActif(20), await idMachine(5), h],
  );
});

describe('carte « Lignes d’approche » : graphe filtré par les droits', () => {
  it('administration du module : tout ce qui est présent, domaine parent, priorité, machines reliées', async () => {
    const c = await carte(admin);
    const ids = new Map(
      await Promise.all([11, 12, 13, 20, 21, 24, 25].map(async (n) => [await idActif(n), n] as const)),
    );
    expect(c.actifs.map((a) => ids.get(a.id)).sort()).toEqual([11, 12, 13, 20, 21, 24, 25]);
    // Les actifs qui portent une alerte ouverte lisible d'abord.
    expect(c.actifs.slice(0, 3).map((a) => ids.get(a.id))).toEqual([21, 12, 13]);
    const de = (n: number) => c.actifs.find((a) => ids.get(a.id) === n)!;
    expect(de(21).parentId).toBe(await idActif(20));
    expect(de(25).parentId).toBe(await idActif(24));
    expect(de(20).parentId).toBeNull();
    expect(de(21).machines.map((m) => m.nom)).toEqual(['srv-cache.interne.invalid', 'srv-front-01.interne.invalid']);
    expect(de(21)).toMatchObject({ autresMachines: false, propositions: 0, perimetreNom: 'Périmètre fictif A' });
    expect(de(20).propositions).toBe(1);
    expect(de(11).propositions).toBe(1);
    // Alertes ouvertes seulement (la 35 est terminée), la plus grave d'abord.
    const alertes = new Map(c.alertes.map((a) => [a.id, a]));
    expect(c.alertes).toHaveLength(5);
    expect(alertes.has(await idAlerte(35))).toBe(false);
    expect(c.alertes[0]).toMatchObject({
      id: await idAlerte(31),
      criticite: 'critical',
      priorite: 'P1',
      cves: ['CVE-2026-91002'],
      actifId: await idActif(21),
    });
    expect(alertes.get(await idAlerte(32))).toMatchObject({ actifId: await idActif(12), priorite: null });
    expect(alertes.get(await idAlerte(34))).toMatchObject({ type: 'typosquatting', actifId: null });
    expect(c).toMatchObject({ tronquee: false, totaux: { actifs: 7, alertes: 5 } });
  });

  it('lecteur d’un seul périmètre : rien d’un périmètre illisible, parent illisible effacé, machine illisible jamais nommée', async () => {
    const c = await carte(lecteurA);
    const ids = new Map(
      await Promise.all([11, 12, 13, 20, 21, 24, 25].map(async (n) => [await idActif(n), n] as const)),
    );
    expect(c.actifs.map((a) => ids.get(a.id)).sort()).toEqual([11, 20, 21, 25]);
    const de = (n: number) => c.actifs.find((a) => ids.get(a.id) === n)!;
    // Le parent de 25 (24, périmètre B) n'est pas lisible : aucun lien vers lui.
    expect(de(25).parentId).toBeNull();
    expect(de(21).parentId).toBe(await idActif(20));
    // Machine 5 (B) : liaison confirmée signalée sans nom ; proposition vers elle sans trace.
    expect(de(21).machines.map((m) => m.nom)).toEqual(['srv-front-01.interne.invalid']);
    expect(de(21).autresMachines).toBe(true);
    expect(de(20)).toMatchObject({ propositions: 0, autresMachines: false, machines: [] });
    expect(de(11).propositions).toBe(1);
    // Alertes : du périmètre A seulement ; une alerte lisible qui vise un actif illisible n'en désigne aucun.
    const attendues = await Promise.all([31, 32, 34].map(idAlerte));
    expect(c.alertes.map((a) => a.id).sort()).toEqual([...attendues].sort());
    expect(c.alertes.find((a) => a.id === attendues[1])!.actifId).toBeNull();
    expect(c.alertes.find((a) => a.id === attendues[0])!.priorite).toBe('P1');
    const texte = JSON.stringify(c);
    expect(texte).not.toMatch(/srv-cache|"b\.exemple-fictif|198\.51\.100\.30|Périmètre ALH fictif [23]/);
    expect(c.totaux).toEqual({ actifs: 4, alertes: 3 });
  });

  it('bornée : au-delà, les premiers actifs (en alerte d’abord) et la troncature signalée', async () => {
    const bornes = CARTE_SURFACE_BORNES as { actifs: number; alertes: number };
    const avant = { ...bornes };
    bornes.actifs = 2;
    bornes.alertes = 1;
    try {
      const c = await carte(admin);
      expect(c.actifs.map((a) => a.id)).toEqual([await idActif(21), await idActif(12)]);
      expect(c.alertes.map((a) => a.id)).toEqual([await idAlerte(31)]);
      expect(c).toMatchObject({ tronquee: true, totaux: { actifs: 7, alertes: 5 } });
    } finally {
      Object.assign(bornes, avant);
    }
  });

  it('lecture seule : aucune écriture ni aucune entrée de journal', async () => {
    const compte = async () =>
      (await t.svc.db.one<{ journal: number; liaisons: string }>(
        `SELECT (SELECT count(*)::int FROM audit_log) AS journal,
                  (SELECT string_agg(statut || calcule_le::text, ',' ORDER BY id) FROM vulnerabilites_alh_liaisons_machines) AS liaisons`,
      ))!;
    const avant = await compte();
    await carte(admin);
    await carte(lecteurA);
    expect(await compte()).toEqual(avant);
  });

  it('droit de lire le module exigé ; module désactivé : refusé', async () => {
    expect((await sansDroit.get(`${S}/carte`)).statusCode).toBe(403);
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['vulnerabilites'], version = version + 1 WHERE id=1",
    );
    const r = await admin.get(`${S}/carte`);
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ reason: 'module_disabled', module: 'vulnerabilites' });
  });
});
