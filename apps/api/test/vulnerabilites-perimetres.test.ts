/* Module Vulnérabilités (ADR 0100, lot PC3) : onglet « Périmètres » (cartes par périmètre lu, détail d'un périmètre par
   ligne ou au global). Migrations sur base vierge.
   - cartes : machines lues, priorité la plus haute, failles présentes par gravité (chaque faille une fois par périmètre),
     machines zero-day et exploitables, machines sans rôle, actifs exposés rattachés ; tri du plus critique au moins
     critique ; carte « Sans périmètre » réservée à l'administration du module ;
   - détail : parc du lot PC2 restreint au périmètre (zones dans l'ordre du rang, borne de 250 par zone, totaux exacts) et
     actifs exposés reliés par une liaison CONFIRMÉE aux machines (trois nommés au plus, puis le nombre des autres actifs
     lisibles), sous les droits du lot ALH3 : rien d'un actif illisible, rien d'une proposition ;
   - droits : périmètre illisible absent de la liste et introuvable (404, comme un inconnu) ; aucun nom de périmètre, de
     machine ou d'actif illisible, aucun total de ce qui est illisible ; priorité et carte identiques pour deux personnes qui
     lisent le même périmètre (lot ALH5) ;
   - nombre de requêtes fixe ; lecture seule (aucune écriture, aucune entrée de journal) ; droit de lecture exigé, module
     désactivé.
   Données entièrement fictives : machines en .invalid, domaines en .example, adresses de 192.0.2.0/24 et 198.51.100.0/24,
   CVE fictives ; aucun service n'est joint. */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const URL = '/api/vulnerabilites/machines/perimetres';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurB: Agent, lecteurAB: Agent, sansDroit: Agent;
let perimA: string, perimB: string, perimC: string, alh: string, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(930000 + n).padStart(12, '0')}`;
const uuidMachine = (n: number) => `00000000-0000-4000-8000-${String(930000 + n).padStart(12, '0')}`;
const nomMachine = (n: number) => `srv-perim-${String(n).padStart(3, '0')}.interne.invalid`;
const adresse = (n: number) => `192.0.2.${n}`;
const NOMS = ['Périmètre fictif vue A', 'Périmètre fictif vue B', 'Périmètre fictif vue C'];
const NOMS_ALH = ['Périmètre ALH fictif un', 'Périmètre ALH fictif deux', 'Périmètre ALH fictif trois'];
/** Machines de base de données du périmètre C (administration seulement) : au-delà de la borne de 250 par zone. */
const EXTRAS = Array.from({ length: 255 }, (_, i) => 100 + i);

/* ------------------------------------------------------------------ Tenable fictif */
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: nomMachine(n),
  adresse: n < 100 ? adresse(n) : null,
  systeme: 'Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
const constat = (plugin: string, cves: string[], gravite: string, exploitable = false) => ({
  type: 'constat',
  plugin,
  nom: `Produit fictif : contrôle fictif ${plugin}`,
  gravite,
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Update the affected packages.',
  cvss3Vecteur: null,
  cvss3Score: null,
  vpr: null,
  epss: null,
  exploitable,
  exploitLibelle: exploitable ? 'Exploits are available' : null,
  failleLe: null,
  correctifLe: null,
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
/** Parc :
    A : 1 front (940001 KEV : P1 zero-day ; 940002 élevée exploitable), 7 front (940001, le même constat), 2 back (940003
        critique exploitable : P2), 3 bdd (940004 moyenne : P4), 4 sans rôle (aucune faille) ;
    B : 5 front (940001 : P1 zero-day) ;
    sans périmètre : 6 back (940003 : P2 exploitable) ;
    C : 100 à 354 bdd, sans faille. */
const parc = (): Record<string, unknown>[] => [
  ...[1, 2, 3, 4, 5, 6, 7, ...EXTRAS].map(machine),
  constat('940001', ['CVE-2026-94001'], 'elevee'),
  constat('940002', ['CVE-2026-94002'], 'elevee', true),
  constat('940003', ['CVE-2026-94003'], 'critique', true),
  constat('940004', ['CVE-2026-94004'], 'moyenne'),
  detection('940001', 1),
  detection('940002', 1),
  detection('940001', 7),
  detection('940003', 2),
  detection('940004', 3),
  detection('940001', 5),
  detection('940003', 6),
];
const bilanTenable = (el: Record<string, unknown>[]) => {
  const n = (x: string) => el.filter((e) => e.type === x).length;
  return {
    elements: el.length,
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

/* ------------------------------------------------------------------ AlgoLightHouse fictif */
const hote = (n: number, perim: number, ip: string) => ({
  type: 'hote',
  id: U(n),
  perimetre: U(perim),
  statut: 'monitored',
  adresse: ip,
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
const domaine = (n: number, perim: number, nom: string) => ({
  type: 'domaine',
  id: U(n),
  perimetre: U(perim),
  statut: 'monitored',
  domaine: nom,
  niveau: 2,
  importManuel: false,
  adresse: null,
  parent: null,
  creeLe: '2026-02-01T10:11:01.000Z',
  majLe: null,
});
/** Actifs : 11 (hôte) et 21 (domaine) du périmètre ALH 1 (relié à A) ; 12 (hôte) du périmètre ALH 2 (relié à B) ; 13
    (hôte) du périmètre ALH 3 (non relié : administration seulement). */
const VALEURS = {
  11: '198.51.100.11',
  12: '198.51.100.12',
  13: '198.51.100.13',
  21: 'portail-perim.exemple-fictif.example',
} as const;
const surface = (): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: NOMS_ALH[0] },
  { type: 'perimetre', id: U(2), nom: NOMS_ALH[1] },
  { type: 'perimetre', id: U(3), nom: NOMS_ALH[2] },
  hote(11, 1, VALEURS[11]),
  hote(12, 2, VALEURS[12]),
  hote(13, 3, VALEURS[13]),
  domaine(21, 1, VALEURS[21]),
];
const bilanAlh = (el: Record<string, unknown>[]) => {
  const c = (x: string) => el.filter((e) => e.type === x).length;
  return {
    elements: el.length,
    perimetres: c('perimetre'),
    hotes: c('hote'),
    domaines: c('domaine'),
    alertes: 0,
    details: 0,
    technologies: 0,
    ecartes: 0,
    tronque: false,
  };
};

async function synchroniser(instance: string, elements: Record<string, unknown>[], resultat: unknown) {
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  expect(job).toMatchObject({ operation: 'synchroniser' });
  for (let i = 0; i < elements.length; i += 500)
    await t.svc.integrations.lot(job.id as string, elements.slice(i, i + 500));
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat, erreur: null });
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

/* ------------------------------------------------------------------ Lecture */
interface Carte {
  id: string | null;
  nom: string | null;
  machines: number;
  priorite: string | null;
  failles: { critique: number; elevee: number; moyenne: number; faible: number };
  machinesExploitationAveree: number;
  machinesExploitables: number;
  machinesSansRole: number;
  actifsExposes: number;
}
interface Liste {
  perimetres: Carte[];
  sansPerimetre: Carte | null;
}
interface Tuile {
  id: string;
  nom: string | null;
  role: string | null;
  rang: { position: number; total: number };
  marques: { priorite: string | null; exploitationAveree: boolean; exploitable: boolean };
}
interface Detail {
  carte: Carte;
  parc: {
    zones: { zone: string; total: number; exploitationAveree: number; machines: Tuile[] }[];
    total: number;
    parZone: number;
    tronquee: boolean;
  };
  expositions: { machineId: string; actifs: { id: string; type: string; valeur: string }[]; autres: number }[];
}
const liste = async (a: Agent): Promise<Liste> => {
  const r = await a.get(URL);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Liste;
};
const detail = async (a: Agent, id: string): Promise<Detail> => {
  const r = await a.get(`${URL}/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Detail;
};
const carteDe = (l: Liste, id: string) => l.perimetres.find((c) => c.id === id);
const zone = (d: Detail, z: string) => d.parc.zones.find((x) => x.zone === z)!;
const machinesIds = new Map<number, string>();
const idMachine = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_machines WHERE identifiant_source = $1', [
    `uuid:${uuidMachine(n)}`,
  ]))!.id;
const idActif = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_actifs WHERE alh_id = $1', [U(n)]))!.id;
const exposition = (d: Detail, n: number) => d.expositions.find((e) => e.machineId === machinesIds.get(n));

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'perim_vue_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES ('r_perim_vue_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  const creer = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'x', timezone: 'Europe/Paris' })).json().id as string;
  perimA = await creer(NOMS[0]!);
  perimB = await creer(NOMS[1]!);
  perimC = await creer(NOMS[2]!);
  const uA = await makeUser(t, 'perim_vue_a', 'r_perim_vue_lire', { rattache: false });
  const uB = await makeUser(t, 'perim_vue_b', 'r_perim_vue_lire', { rattache: false });
  const uAB = await makeUser(t, 'perim_vue_ab', 'r_perim_vue_lire', { rattache: false });
  const uSans = await makeUser(t, 'perim_vue_sans_droit', 'rw');
  await t.svc.db.q(
    `INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, false), ($2, $4, false), ($1, $5, false),
       ($2, $5, false)`,
    [perimA, perimB, uA.id, uB.id, uAB.id],
  );
  lecteurA = await login(t, uA);
  lecteurB = await login(t, uB);
  lecteurAB = await login(t, uAB);
  sansDroit = await login(t, uSans);
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

describe('lot PC3 : onglet « Périmètres »', () => {
  it('pile vierge : cartes vides des périmètres lus ; « Sans périmètre » pour l’administration seulement', async () => {
    const a = await liste(lecteurA);
    expect(a).toEqual({
      perimetres: [
        {
          id: perimA,
          nom: NOMS[0],
          machines: 0,
          priorite: null,
          failles: { critique: 0, elevee: 0, moyenne: 0, faible: 0 },
          machinesExploitationAveree: 0,
          machinesExploitables: 0,
          machinesSansRole: 0,
          actifsExposes: 0,
        },
      ],
      sansPerimetre: null,
    });
    const ad = await liste(admin);
    expect(ad.sansPerimetre).toMatchObject({ id: null, nom: null, machines: 0, priorite: null });
    expect(ad.perimetres.map((c) => c.id)).toEqual(expect.arrayContaining([perimA, perimB, perimC]));
    const d = await detail(lecteurA, perimA);
    expect(d.parc.zones.map((z) => [z.zone, z.total])).toEqual([
      ['front', 0],
      ['back', 0],
      ['bdd', 0],
      ['aucun', 0],
    ]);
    expect(d.expositions).toEqual([]);
  });

  it('droits et validation : lecture du module exigée ; périmètre illisible comme un inconnu ; « aucun » réservé', async () => {
    expect((await sansDroit.get(URL)).statusCode).toBe(403);
    expect((await sansDroit.get(`${URL}/${perimA}`)).statusCode).toBe(403);
    expect((await lecteurA.get(`${URL}/pas-un-uuid`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${URL}/tous`)).statusCode).toBe(422);
    const inconnu = await lecteurA.get(`${URL}/00000000-0000-4000-8000-00000000dead`);
    const illisible = await lecteurA.get(`${URL}/${perimB}`);
    expect(inconnu.statusCode).toBe(404);
    expect(illisible.statusCode).toBe(404);
    expect(illisible.json()).toEqual(inconnu.json());
    expect(illisible.body).not.toContain(NOMS[1]);
    const aucun = await lecteurA.get(`${URL}/aucun`);
    expect(aucun.statusCode).toBe(404);
    expect(aucun.json()).toEqual(inconnu.json());
    expect((await admin.get(`${URL}/aucun`)).statusCode).toBe(200);
  });

  it('données : synchronisations de Tenable et d’AlgoLightHouse, rôles, périmètres, liaisons', async () => {
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit)
       VALUES ('CVE-2026-94001', '2026-11-01', 'Fictional Product Remote Code Execution', 'Produit fictif')`,
    );
    await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
    await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
    t.svc.limits.integrationSynchro.reset();
    await synchroniser(tenable, parc(), bilanTenable(parc()));
    await synchroniser(alh, surface(), bilanAlh(surface()));
    const regler = (n: number, role: string | null, perimetre: string | null) =>
      t.svc.db.q('UPDATE vulnerabilites_machines SET role = $2, perimetre_id = $3 WHERE nom = $1', [
        nomMachine(n),
        role,
        perimetre,
      ]);
    await regler(1, 'front', perimA);
    await regler(7, 'front', perimA);
    await regler(2, 'back', perimA);
    await regler(3, 'bdd', perimA);
    await regler(4, null, perimA);
    await regler(5, 'front', perimB);
    await regler(6, 'back', null);
    await t.svc.db.q(`UPDATE vulnerabilites_machines SET role = 'bdd', perimetre_id = $1 WHERE nom = ANY($2::text[])`, [
      perimC,
      EXTRAS.map(nomMachine),
    ]);
    await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimA]);
    await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(2), perimB]);
    for (const n of [1, 2, 3, 4, 5, 6, 7]) machinesIds.set(n, await idMachine(n));
    // Liaisons confirmées vers la machine 1 (A) : actifs 11 et 21 (A), 12 (B), 13 (non relié) ; proposition seulement
    // (jamais montrée) de l'actif 11 vers la machine 2.
    const h = 'b'.repeat(64);
    const lier = async (actif: number, n: number, statut: 'confirmee' | 'proposee') =>
      t.svc.db.q(
        `INSERT INTO vulnerabilites_alh_liaisons_machines
           (actif_id, machine_id, statut, motif, origine, empreinte_actif, empreinte_machine, decide_par, decide_le)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8)`,
        statut === 'confirmee'
          ? [await idActif(actif), machinesIds.get(n), statut, null, 'manuelle', h, 'test', new Date()]
          : [await idActif(actif), machinesIds.get(n), statut, 'adresse', 'proposition', h, null, null],
      );
    for (const actif of [11, 21, 12, 13]) await lier(actif, 1, 'confirmee');
    await lier(11, 2, 'proposee');
  }, 60_000);

  it('cartes : machines, priorité, failles par gravité comptées une fois, marques, actifs exposés rattachés', async () => {
    const l = await liste(admin);
    expect(carteDe(l, perimA)).toEqual({
      id: perimA,
      nom: NOMS[0],
      machines: 5,
      priorite: 'P1',
      // 940001 présent sur les machines 1 et 7 : une seule faille élevée de plus que 940002.
      failles: { critique: 1, elevee: 2, moyenne: 1, faible: 0 },
      machinesExploitationAveree: 2,
      machinesExploitables: 2,
      machinesSansRole: 1,
      actifsExposes: 2,
    });
    expect(carteDe(l, perimB)).toMatchObject({
      machines: 1,
      priorite: 'P1',
      failles: { critique: 0, elevee: 1, moyenne: 0, faible: 0 },
      machinesExploitationAveree: 1,
      actifsExposes: 1,
    });
    expect(carteDe(l, perimC)).toMatchObject({ machines: 255, priorite: null, actifsExposes: 0 });
    expect(l.sansPerimetre).toEqual({
      id: null,
      nom: null,
      machines: 1,
      priorite: 'P2',
      failles: { critique: 1, elevee: 0, moyenne: 0, faible: 0 },
      machinesExploitationAveree: 0,
      machinesExploitables: 1,
      machinesSansRole: 0,
      actifsExposes: 1,
    });
    // Du plus critique au moins critique : A (deux machines zero-day) avant B, puis C (sans faille) et les périmètres vides.
    const ids = l.perimetres.map((c) => c.id);
    expect(ids.slice(0, 3)).toEqual([perimA, perimB, perimC]);
  });

  it('droits : seuls les périmètres lus ; aucun nom ni total de ce qui est illisible', async () => {
    const a = await lecteurA.get(URL);
    expect(a.statusCode).toBe(200);
    expect((a.json() as Liste).perimetres.map((c) => c.id)).toEqual([perimA]);
    expect((a.json() as Liste).sansPerimetre).toBeNull();
    for (const interdit of [NOMS[1], NOMS[2], ...NOMS_ALH, ...Object.values(VALEURS)])
      expect(a.body).not.toContain(interdit);
    for (const n of [1, 5, 6, 100]) expect(a.body).not.toContain(nomMachine(n));
    const b = await liste(lecteurB);
    expect(b.perimetres.map((c) => c.id)).toEqual([perimB]);
    expect(b.sansPerimetre).toBeNull();
  });

  it('priorité et carte identiques pour deux personnes qui lisent le même périmètre (lot ALH5)', async () => {
    const ad = await liste(admin);
    const a = await liste(lecteurA);
    const ab = await liste(lecteurAB);
    expect(carteDe(a, perimA)).toEqual(carteDe(ad, perimA));
    expect(carteDe(ab, perimA)).toEqual(carteDe(ad, perimA));
    expect(carteDe(ab, perimB)).toEqual(carteDe(ad, perimB));
    expect((await detail(lecteurA, perimA)).carte).toEqual(carteDe(ad, perimA));
  });

  it('détail : la carte, les machines par zone dans l’ordre du rang, et rien d’un autre périmètre', async () => {
    const d = await detail(admin, perimA);
    expect(d.carte).toEqual(carteDe(await liste(admin), perimA));
    expect(d.parc.total).toBe(5);
    expect(d.parc.tronquee).toBe(false);
    expect(zone(d, 'front')).toMatchObject({ total: 2, exploitationAveree: 2 });
    expect(zone(d, 'back').machines.map((m) => m.nom)).toEqual([nomMachine(2)]);
    expect(zone(d, 'aucun').machines.map((m) => m.nom)).toEqual([nomMachine(4)]);
    for (const z of d.parc.zones) {
      const positions = z.machines.map((m) => m.rang.position);
      expect(positions).toEqual([...positions].sort((x, y) => x - y));
    }
    const r = await admin.get(`${URL}/${perimA}`);
    for (const n of [5, 6, 100]) expect(r.body).not.toContain(nomMachine(n));
    // Même périmètre lu par une autre personne : mêmes machines, mêmes marques (le rang reste celui de ses machines lues).
    const a = await detail(lecteurA, perimA);
    const marques = (x: Detail) =>
      x.parc.zones.flatMap((z) => z.machines.map((m) => [z.zone, m.nom, m.marques] as const)).sort();
    expect(marques(a)).toEqual(marques(d));
    // Machines sans périmètre : administration du module seulement.
    const aucun = await detail(admin, 'aucun');
    expect(aucun.carte).toEqual((await liste(admin)).sansPerimetre);
    expect(aucun.parc.zones.flatMap((z) => z.machines.map((m) => m.nom))).toEqual([nomMachine(6)]);
  });

  it('exposition : liaisons confirmées seulement, actifs lisibles seulement, trois nommés puis le nombre des autres', async () => {
    const a = await lecteurA.get(`${URL}/${perimA}`);
    const da = a.json() as Detail;
    expect(
      exposition(da, 1)
        ?.actifs.map((x) => x.valeur)
        .sort(),
    ).toEqual([VALEURS[11], VALEURS[21]].sort());
    expect(exposition(da, 1)?.autres).toBe(0);
    // Actif de B (illisible) et actif d'un périmètre ALH non relié : ni nommés, ni comptés.
    for (const interdit of [VALEURS[12], VALEURS[13], NOMS_ALH[1], NOMS_ALH[2]]) expect(a.body).not.toContain(interdit);
    // Proposition non confirmée : jamais montrée.
    expect(exposition(da, 2)).toBeUndefined();
    const ab = await detail(lecteurAB, perimA);
    expect(exposition(ab, 1)?.actifs).toHaveLength(3);
    expect(exposition(ab, 1)?.autres).toBe(0);
    const ad = await detail(admin, perimA);
    expect(exposition(ad, 1)?.actifs).toHaveLength(3);
    expect(exposition(ad, 1)?.autres).toBe(1);
    // L'actif de B relié à une machine de A n'ouvre pas cette machine à qui ne lit que B.
    const b = await lecteurB.get(`${URL}/${perimB}`);
    expect(b.body).not.toContain(nomMachine(1));
    expect((b.json() as Detail).expositions).toEqual([]);
  });

  it('borne : 250 machines au plus par zone dans le détail, total exact, parc signalé tronqué', async () => {
    const d = await detail(admin, perimC);
    expect(zone(d, 'bdd').total).toBe(255);
    expect(zone(d, 'bdd').machines).toHaveLength(250);
    expect(d.parc).toMatchObject({ total: 255, parZone: 250, tronquee: true });
    expect(d.carte.machines).toBe(255);
  });

  it('nombre de requêtes fixe : aucune par périmètre ni par machine', async () => {
    const espion = vi.spyOn(pg.Client.prototype, 'query');
    const compter = async (fn: () => Promise<unknown>) => {
      espion.mockClear();
      await fn();
      return espion.mock.calls.length;
    };
    try {
      await admin.get('/api/vulnerabilites/priorite/reglage');
      // Requêtes communes à toute route (session, droits) : celles d'une lecture d'une seule requête, moins celle-ci.
      const socle = (await compter(() => admin.get('/api/vulnerabilites/priorite/reglage'))) - 1;
      const listeAdmin = (await compter(() => admin.get(URL))) - socle;
      const detailC = (await compter(() => admin.get(`${URL}/${perimC}`))) - socle;
      const detailA = (await compter(() => admin.get(`${URL}/${perimA}`))) - socle;
      // L'espion voit bien les requêtes (sinon les bornes ci-dessous ne prouveraient rien).
      expect(socle).toBeGreaterThan(0);
      expect(listeAdmin).toBeGreaterThan(5);
      expect(listeAdmin).toBeLessThanOrEqual(16);
      expect(detailC).toBeLessThanOrEqual(17);
      expect(detailA).toBeLessThanOrEqual(17);
    } finally {
      espion.mockRestore();
    }
  });

  it('lecture seule : aucune écriture, aucune entrée de journal d’audit', async () => {
    const etat = async () => ({
      audit: (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n,
      machines: (
        await t.svc.db.q<{ id: string; version: number }>('SELECT id, version FROM vulnerabilites_machines ORDER BY id')
      ).rows,
      liaisons: (
        await t.svc.db.q<{ id: string; statut: string }>(
          'SELECT id, statut FROM vulnerabilites_alh_liaisons_machines ORDER BY id',
        )
      ).rows,
    });
    const avant = await etat();
    await liste(lecteurA);
    await liste(admin);
    await detail(lecteurA, perimA);
    await detail(admin, 'aucun');
    expect(await etat()).toEqual(avant);
  });

  it('module désactivé : les routes ne répondent plus', async () => {
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      for (const a of [lecteurA, admin]) {
        expect([403, 409]).toContain((await a.get(URL)).statusCode);
        expect([403, 409]).toContain((await a.get(`${URL}/${perimA}`)).statusCode);
      }
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });
});
