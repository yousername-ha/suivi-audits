/* Module Vulnérabilités (ADR 0100, lot PC2) : route du parc des machines (écran « Machines », mode « Parc »). Migrations sur
   base vierge.
   - zones de rôle (front, back applicatif, base de données, rôle non indiqué), dans l'ordre du rang ;
   - marques : priorité la plus haute, zero-day (faille présente à exploitation avérée), exploitable (code d'exploitation
     sans exploitation avérée) ; les mêmes pour tout le monde (lot ALH5) ; aussi sur la liste existante ;
   - droits : seules les machines que la personne lit sont listées ou comptées ; aucun nom, aucune adresse, aucun total
     d'une machine illisible ; machine sans périmètre réservée à l'administration du module ;
   - filtres de la liste (nom, rôle, périmètre), borne par zone (250) avec totaux exacts ;
   - lecture seule : aucune écriture, aucune entrée de journal d'audit ; droit de lecture exigé, module désactivé.
   Données entièrement fictives : machines en .invalid, adresses de 192.0.2.0/24 et 198.51.100.0/24, CVE fictives ; aucun
   service n'est joint. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const URL = '/api/vulnerabilites/machines/parc';
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurB: Agent, sansDroit: Agent;
let perimA: string, perimB: string, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-${String(700000 + n).padStart(12, '0')}`;
const nomMachine = (n: number) => `srv-parc-${String(n).padStart(3, '0')}.interne.invalid`;
const adresse = (n: number) => (n === 5 ? '198.51.100.55' : `192.0.2.${n}`);
const NOMS_PERIMETRES = ['Périmètre fictif parc A', 'Périmètre fictif parc B'];
/** Machines supplémentaires de base de données (périmètre A) : au-delà de la borne de 250 par zone. */
const EXTRAS = Array.from({ length: 255 }, (_, i) => 100 + i);

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
    1 front (A) : 930001 (CVE 93001, KEV : P1, zero-day) et 930002 (élevée, exploitable selon Tenable : P2) ;
    2 back (A) : 930003 (critique, exploitable : P2) ;
    3 bdd (A) : 930004 (moyenne : P4) ;
    4 sans rôle (A) : aucune faille ;
    5 front (B) : 930001 (P1, zero-day) ;
    6 back, sans périmètre : 930003 (P2, exploitable) : administration du module seulement ;
    100 à 354 bdd (A), sans faille. */
const parc = (): Record<string, unknown>[] => [
  ...[1, 2, 3, 4, 5, 6, ...EXTRAS].map(machine),
  constat('930001', ['CVE-2026-93001'], 'elevee'),
  constat('930002', ['CVE-2026-93002'], 'elevee', true),
  constat('930003', ['CVE-2026-93003'], 'critique', true),
  constat('930004', ['CVE-2026-93004'], 'moyenne'),
  detection('930001', 1),
  detection('930002', 1),
  detection('930003', 2),
  detection('930004', 3),
  detection('930001', 5),
  detection('930003', 6),
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
async function syncTenable(elements: Record<string, unknown>[]) {
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [tenable],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  expect(job).toMatchObject({ operation: 'synchroniser' });
  for (let i = 0; i < elements.length; i += 500)
    await t.svc.integrations.lot(job.id as string, elements.slice(i, i + 500));
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat: bilanTenable(elements), erreur: null });
}

interface Tuile {
  id: string;
  nom: string | null;
  adresse: string | null;
  role: string | null;
  rang: { position: number; total: number };
  compteurs: { critique: number; exploitationAveree: number };
  marques: { priorite: string | null; exploitationAveree: boolean; exploitable: boolean };
}
interface Parc {
  zones: { zone: string; total: number; exploitationAveree: number; machines: Tuile[] }[];
  total: number;
  parZone: number;
  tronquee: boolean;
}
const lire = async (a: Agent, query = ''): Promise<Parc> => {
  const r = await a.get(`${URL}${query}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Parc;
};
const zone = (p: Parc, z: string) => p.zones.find((x) => x.zone === z)!;
const tuile = (p: Parc, n: number) => p.zones.flatMap((z) => z.machines).find((m) => m.nom === nomMachine(n));
const noms = (p: Parc) => p.zones.flatMap((z) => z.machines.map((m) => m.nom));

beforeAll(async () => {
  t = await createTestApp();
  const uAdmin = await makeUser(t, 'parc_admin', 'admin');
  admin = await login(t, uAdmin);
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES ('r_parc_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[0], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[1], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uA = await makeUser(t, 'parc_lecteur_a', 'r_parc_lire', { rattache: false });
  const uB = await makeUser(t, 'parc_lecteur_b', 'r_parc_lire', { rattache: false });
  const uSans = await makeUser(t, 'parc_sans_droit', 'rw');
  await t.svc.db.q(`INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, false), ($2, $4, false)`, [
    perimA,
    perimB,
    uA.id,
    uB.id,
  ]);
  lecteurA = await login(t, uA);
  lecteurB = await login(t, uB);
  sansDroit = await login(t, uSans);
  const r = await admin.post('/api/integrations/instances', {
    type: 'tenable',
    nom: 'Tenable fictif',
    configuration: { adresse: 'https://tenable.exemple.invalid' },
  });
  expect(r.statusCode, r.body).toBe(201);
  tenable = r.json().id as string;
  expect(
    (
      await admin.put(`/api/integrations/instances/${tenable}/secrets`, {
        accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        secretKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
      })
    ).statusCode,
  ).toBe(204);
  const a = await admin.put(
    `/api/integrations/instances/${tenable}/activation`,
    { actif: true, fluxConfirme: true },
    ifMatch(r.json().version),
  );
  expect(a.statusCode, a.body).toBe(200);
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('lot PC2 : parc des machines par zone de rôle', () => {
  it('pile vierge : quatre zones vides, dans l’ordre', async () => {
    const p = await lire(lecteurA);
    expect(p).toEqual({
      zones: ['front', 'back', 'bdd', 'aucun'].map((z) => ({ zone: z, total: 0, exploitationAveree: 0, machines: [] })),
      total: 0,
      parZone: 250,
      tronquee: false,
    });
  });

  it('droits et validation : lecture du module exigée, filtres de la liste seulement', async () => {
    expect((await sansDroit.get(URL)).statusCode).toBe(403);
    expect((await lecteurA.get(`${URL}?page=2`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${URL}?role=routeur`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${URL}?perimetre=pas-un-uuid`)).statusCode).toBe(422);
  });

  it('données : synchronisation de Tenable, rôles et périmètres', async () => {
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit)
       VALUES ('CVE-2026-93001', '2026-11-01', 'Fictional Product Remote Code Execution', 'Produit fictif')`,
    );
    await syncTenable(parc());
    const regler = (n: number, role: string | null, perimetre: string | null) =>
      t.svc.db.q('UPDATE vulnerabilites_machines SET role = $2, perimetre_id = $3 WHERE nom = $1', [
        nomMachine(n),
        role,
        perimetre,
      ]);
    await regler(1, 'front', perimA);
    await regler(2, 'back', perimA);
    await regler(3, 'bdd', perimA);
    await regler(4, null, perimA);
    await regler(5, 'front', perimB);
    await regler(6, 'back', null);
    await t.svc.db.q(`UPDATE vulnerabilites_machines SET role = 'bdd', perimetre_id = $1 WHERE nom = ANY($2::text[])`, [
      perimA,
      EXTRAS.map(nomMachine),
    ]);
  }, 60_000);

  it('marques : priorité la plus haute, zero-day (exploitation avérée), exploitable sans exploitation avérée', async () => {
    const p = await lire(admin);
    expect(tuile(p, 1)?.marques).toEqual({
      priorite: 'P1',
      exploitationAveree: true,
      exploitable: true,
      exploiteeSansCorrectif: false,
    });
    expect(tuile(p, 2)?.marques).toEqual({
      priorite: 'P2',
      exploitationAveree: false,
      exploitable: true,
      exploiteeSansCorrectif: false,
    });
    expect(tuile(p, 3)?.marques).toEqual({
      priorite: 'P4',
      exploitationAveree: false,
      exploitable: false,
      exploiteeSansCorrectif: false,
    });
    expect(tuile(p, 4)?.marques).toEqual({
      priorite: null,
      exploitationAveree: false,
      exploitable: false,
      exploiteeSansCorrectif: false,
    });
    expect(tuile(p, 5)?.marques).toEqual({
      priorite: 'P1',
      exploitationAveree: true,
      exploitable: false,
      exploiteeSansCorrectif: false,
    });
    expect(tuile(p, 6)?.marques).toEqual({
      priorite: 'P2',
      exploitationAveree: false,
      exploitable: true,
      exploiteeSansCorrectif: false,
    });
    // La marque zero-day suit le compteur d'exploitation avérée existant (définition du lot V6).
    for (const m of p.zones.flatMap((z) => z.machines))
      expect(m.marques.exploitationAveree).toBe(m.compteurs.exploitationAveree > 0);
  });

  it('zones dans l’ordre du rang, la plus critique d’abord ; totaux et zero-day par zone', async () => {
    const p = await lire(admin);
    expect(p.zones.map((z) => z.zone)).toEqual(['front', 'back', 'bdd', 'aucun']);
    expect(zone(p, 'front')).toMatchObject({ total: 2, exploitationAveree: 2 });
    expect(zone(p, 'back')).toMatchObject({ total: 2, exploitationAveree: 0 });
    expect(zone(p, 'aucun').machines.map((m) => m.nom)).toEqual([nomMachine(4)]);
    for (const z of p.zones) {
      expect(z.machines.every((m) => (m.role ?? 'aucun') === z.zone)).toBe(true);
      const positions = z.machines.map((m) => m.rang.position);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
    // Rang de la plateforme : la machine 3 (une faille moyenne) avant les machines sans faille, dans sa zone.
    expect(zone(p, 'bdd').machines[0]?.nom).toBe(nomMachine(3));
  });

  it('borne : 250 machines au plus par zone, total exact, parc signalé tronqué', async () => {
    const p = await lire(admin);
    const bdd = zone(p, 'bdd');
    expect(bdd.total).toBe(256);
    expect(bdd.machines).toHaveLength(250);
    expect(p.tronquee).toBe(true);
    expect(p.total).toBe(6 + EXTRAS.length);
    // Filtre de rôle : la borne reste par zone.
    const front = await lire(admin, '?role=front');
    expect(front.tronquee).toBe(false);
    expect(front.total).toBe(2);
  });

  it('droits : seules les machines lues ; aucun nom, aucune adresse ni aucun total d’une machine illisible', async () => {
    const a = await lecteurA.get(URL);
    expect(a.statusCode).toBe(200);
    for (const n of [5, 6]) {
      expect(a.body).not.toContain(nomMachine(n));
      expect(a.body).not.toContain(adresse(n));
    }
    expect(a.body).not.toContain(NOMS_PERIMETRES[1]);
    const pa = a.json() as Parc;
    expect(pa.total).toBe(4 + EXTRAS.length);
    expect(zone(pa, 'front')).toMatchObject({ total: 1, exploitationAveree: 1 });
    expect(zone(pa, 'back')).toMatchObject({ total: 1, exploitationAveree: 0 });

    const b = await lecteurB.get(URL);
    expect(b.statusCode).toBe(200);
    for (const n of [1, 2, 3, 4, 6, 100]) {
      expect(b.body).not.toContain(nomMachine(n));
      expect(b.body).not.toContain(adresse(n));
    }
    expect(b.body).not.toContain(NOMS_PERIMETRES[0]);
    const pb = b.json() as Parc;
    expect(pb.total).toBe(1);
    expect(pb.zones.map((z) => z.total)).toEqual([1, 0, 0, 0]);
    expect(pb.tronquee).toBe(false);
    // Rang parmi les machines lues.
    expect(tuile(pb, 5)?.rang).toMatchObject({ position: 1, total: 1 });
  });

  it('priorité et marques les mêmes pour tout le monde (lot ALH5)', async () => {
    const ad = await lire(admin);
    const a = await lire(lecteurA);
    const b = await lire(lecteurB);
    for (const n of [1, 2, 3, 4]) expect(tuile(a, n)?.marques).toEqual(tuile(ad, n)?.marques);
    expect(tuile(b, 5)?.marques).toEqual(tuile(ad, 5)?.marques);
  });

  it('filtres de la liste : nom, rôle, périmètre', async () => {
    expect(noms(await lire(lecteurA, '?q=srv-parc-002'))).toEqual([nomMachine(2)]);
    expect(noms(await lire(lecteurA, '?role=aucun'))).toEqual([nomMachine(4)]);
    expect(noms(await lire(lecteurA, `?perimetre=${perimB}`))).toEqual([]);
    // Machine sans périmètre : administration du module seulement.
    expect(noms(await lire(lecteurA, '?perimetre=aucun'))).toEqual([]);
    expect(noms(await lire(admin, '?perimetre=aucun'))).toEqual([nomMachine(6)]);
  });

  it('liste existante : chaque machine porte aussi ses marques', async () => {
    const r = await lecteurA.get('/api/vulnerabilites/machines?role=front');
    expect(r.statusCode, r.body).toBe(200);
    const page = r.json() as { elements: Tuile[] };
    expect(page.elements.map((m) => [m.nom, m.marques])).toEqual([
      [nomMachine(1), { priorite: 'P1', exploitationAveree: true, exploitable: true, exploiteeSansCorrectif: false }],
    ]);
  });

  it('lecture seule : aucune écriture, aucune entrée de journal d’audit', async () => {
    const etat = async () => ({
      audit: (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n,
      machines: (
        await t.svc.db.q<{ id: string; version: number }>('SELECT id, version FROM vulnerabilites_machines ORDER BY id')
      ).rows,
      suivis: (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_suivis'))!.n,
    });
    const avant = await etat();
    await lire(lecteurA);
    await lire(lecteurB);
    await lire(admin, '?role=bdd');
    expect(await etat()).toEqual(avant);
  });

  it('module désactivé : la route ne répond plus', async () => {
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      expect([403, 409]).toContain((await lecteurA.get(URL)).statusCode);
      expect([403, 409]).toContain((await admin.get(URL)).statusCode);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });
});
