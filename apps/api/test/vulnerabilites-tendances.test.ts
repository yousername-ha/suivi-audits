/* Module Vulnérabilités (ADR 0100, lot S2) : instantanés quotidiens, tendances et rapport de pilotage. Migration 088 sur
   base vierge ; instantané : un par jour, créneau consommé avant le calcul (pas de rejeu après un échec), module désactivé,
   purge au-delà de la rétention, corrections de la veille, nombres par périmètre et « sans périmètre », aucun nom ;
   tendances : totaux identiques pour deux personnes, périmètre illisible absent et refusé (404), « sans périmètre » réservé
   à l'administration, lecture seule ; variation sur sept jours de la vue d'ensemble ; rapport : JSON et CSV, aucun nom de
   machine ni d'adresse (textes masqués), totaux identiques pour deux personnes, périmètre illisible refusé, production
   tracée au journal sans contenu ; nombre de requêtes borné. Données entièrement fictives : noms en .invalid, adresses de
   192.0.2.0/24, contrôles et CVE fictifs ; aucun service n'est joint. */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, rssi: Agent, lecteurA: Agent, lecteurB: Agent;
let perimA: string, perimB: string, instance: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const jour = (n: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() + n * 86_400_000));
const dansJours = (n: number) => new Date(Date.now() + n * 86_400_000);
const ANCIENNE = '2026-07-18T01:05:01.000Z';
const RECENTE = new Date(Date.now() - 3_600_000).toISOString();
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000008${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-tendance-${String(n).padStart(2, '0')}.exemple.invalid`;
const adresse = (n: number) => `192.0.2.${140 + n}`;
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: nomMachine(n),
  adresse: adresse(n),
  systeme: 'Exemple Linux 9',
  premiere: ANCIENNE,
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
const constat = (plugin: string, gravite: string) => ({
  type: 'constat',
  plugin,
  nom: `Exemple Linux : contrôle de tendance fictif ${plugin}`,
  gravite,
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Update the affected packages.',
  cvss3Vecteur: null,
  cvss3Score: null,
  vpr: null,
  epss: null,
  exploitable: false,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: null,
  finSupportLe: null,
  voirAussi: null,
  cves: [`CVE-2026-9${plugin.slice(-4)}`],
  cvesTronquees: false,
});
const detection = (plugin: string, n: number, premiere: string) => ({
  type: 'detection',
  plugin,
  machine: `uuid:${uuidMachine(n)}`,
  port: 0,
  protocole: 'TCP',
  premiere,
  derniere: '2026-11-16T06:04:48.000Z',
  attenue: false,
  risqueAccepte: false,
  risqueRequalifie: false,
});
/** Machine 1 dans le périmètre A, 2 dans B, 3 sans périmètre. 970001 critique, exploitée (KEV), sur 1 et 2 : P1 ;
    970002 critique ancienne sur 1 : P2 en dépassement ; 970003 élevée récente sur 2 : P3 ; 970004 moyenne sur 3 : P4. */
const parc = () => [
  machine(1),
  machine(2),
  machine(3),
  constat('970001', 'critique'),
  constat('970002', 'critique'),
  constat('970003', 'elevee'),
  constat('970004', 'moyenne'),
  detection('970001', 1, ANCIENNE),
  detection('970001', 2, ANCIENNE),
  detection('970002', 1, ANCIENNE),
  detection('970003', 2, RECENTE),
  detection('970004', 3, RECENTE),
];
const bilan = (elements: { type: string }[]) => {
  const n = (x: string) => elements.filter((e) => e.type === x).length;
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
async function synchroniser(elements: { type: string }[]) {
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat: bilan(elements), erreur: null });
}
const constatId = async (plugin: string) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = $1', [Number(plugin)]))!
    .id;
const n = async (table: string, where = 'true', p: unknown[] = []) =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, p))!.n;
const version = async (plugin: string) =>
  ((await rssi.get(`${V}/suivis/constat/${await constatId(plugin)}`)).json() as { version: number }).version;
const etat = async (a: Agent, plugin: string, corps: unknown) =>
  a.post(`${V}/suivis/constat/${await constatId(plugin)}/etat`, corps, ifMatch(await version(plugin)));
type Mesures = Record<string, number | null>;
const mesures = async (j: string, portee: string, perimetre: string | null = null) =>
  t.svc.db.one<Mesures>(
    `SELECT p1, p2, p3, p4, exploitees, depassements, exceptions, corrigees_veille, machines, actifs
     FROM vulnerabilites_instantanes_mesures WHERE jour = $1::date AND portee = $2 AND perimetre_id IS NOT DISTINCT FROM $3::uuid`,
    [j, portee, perimetre],
  );
/** Aucun nom ni adresse de machine dans un texte (réponse, fichier, journal). */
const sansNom = (texte: string) => {
  for (const k of [1, 2, 3]) {
    expect(texte).not.toContain(nomMachine(k));
    expect(texte).not.toContain(adresse(k));
  }
  expect(texte).not.toContain('srv-tendance');
  expect(texte).not.toMatch(/192\.0\.2\./);
};
const effacerJour = (j: string) => t.svc.db.q('DELETE FROM vulnerabilites_instantanes WHERE jour = $1::date', [j]);

beforeAll(async () => {
  t = await createTestApp();
  const uAdmin = await makeUser(t, 'td_admin', 'admin');
  admin = await login(t, uAdmin);
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_td_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire','ecarts:lire'])`,
  );
  const perimetre = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'x', timezone: 'Europe/Paris' })).json().id as string;
  perimA = await perimetre('Périmètre tendances A');
  perimB = await perimetre('Périmètre tendances B');
  const u = {
    rssi: await makeUser(t, 'td_rssi', 'rssi', { rattache: false }),
    lecteurA: await makeUser(t, 'td_lecteur_a', 'r_td_lire', { rattache: false }),
    lecteurB: await makeUser(t, 'td_lecteur_b', 'r_td_lire', { rattache: false }),
  };
  await t.svc.db.q(
    `INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, true), ($2, $3, true), ($1, $4, false),
       ($2, $5, false)`,
    [perimA, perimB, u.rssi.id, u.lecteurA.id, u.lecteurB.id],
  );
  rssi = await login(t, u.rssi);
  lecteurA = await login(t, u.lecteurA);
  lecteurB = await login(t, u.lecteurB);
  const r = await admin.post('/api/integrations/instances', {
    type: 'tenable',
    nom: 'Tenable fictif tendances',
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
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit)
     VALUES ('CVE-2026-90001', '2026-11-01', 'Fictional Product Remote Code Execution', 'Produit fictif')`,
  );
  await synchroniser(parc());
  for (const [k, p] of [
    [1, perimA],
    [2, perimB],
  ] as const)
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE identifiant_source = $1', [
      `uuid:${uuidMachine(k)}`,
      p,
    ]);
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('migration 088 sur base vierge', () => {
  it('ajoute les deux tables, vides ; contraintes de portée et d’état', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '088_vulnerabilites_instantanes.sql'"))
        ?.ok,
    ).toBe(1);
    expect(await n('vulnerabilites_instantanes')).toBe(0);
    expect(await n('vulnerabilites_instantanes_mesures')).toBe(0);
    const refus = (q: string, p: unknown[] = []) => expect(t.svc.db.q(q, p)).rejects.toThrow();
    await refus("INSERT INTO vulnerabilites_instantanes (jour, etat) VALUES ('2020-01-01', 'pris')");
    await refus("INSERT INTO vulnerabilites_instantanes (jour, niveau) VALUES ('2020-01-01', 5)");
    await t.svc.db.q("INSERT INTO vulnerabilites_instantanes (jour) VALUES ('2020-01-01')");
    const m = `INSERT INTO vulnerabilites_instantanes_mesures (jour, portee, perimetre_id, p1, p2, p3, p4, exploitees,
      depassements, exceptions, corrigees_veille, machines, actifs) VALUES ('2020-01-01', $1, $2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`;
    await refus(m, ['perimetre', null]);
    await refus(m, ['global', perimA]);
    await t.svc.db.q(m, ['global', null]);
    await refus(m, ['global', null]);
    await effacerJour('2020-01-01');
    expect(await n('vulnerabilites_instantanes_mesures')).toBe(0);
  });
});

describe('instantané quotidien', () => {
  it('module désactivé : rien, et le créneau n’est pas consommé', async () => {
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      expect(await t.svc.vulnerabilites.tendances.tic()).toBeNull();
      expect(await n('vulnerabilites_instantanes')).toBe(0);
      expect([403, 409]).toContain((await lecteurA.get(`${V}/tendances`)).statusCode);
      expect([403, 409]).toContain((await lecteurA.get(`${V}/rapport?mois=2026-11`)).statusCode);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });

  it('un par jour : niveau, nombres globaux et par périmètre, « sans périmètre » à part, aucun nom', async () => {
    expect(await t.svc.vulnerabilites.tendances.tic()).toBe('pris');
    // Même jour : le tic ne fait plus rien, et un appel direct trouve le créneau pris.
    expect(await t.svc.vulnerabilites.tendances.tic()).toBeNull();
    expect(await t.svc.vulnerabilites.tendances.prendre()).toBe('deja');
    const i = await t.svc.db.one<{ etat: string; niveau: number }>(
      'SELECT etat, niveau FROM vulnerabilites_instantanes WHERE jour = $1::date',
      [jour(0)],
    );
    expect(i).toEqual({ etat: 'pris', niveau: 4 });
    expect(await n('vulnerabilites_instantanes')).toBe(1);
    expect(await mesures(jour(0), 'global')).toEqual({
      p1: 1,
      p2: 1,
      p3: 1,
      p4: 1,
      exploitees: 1,
      depassements: 2,
      exceptions: 0,
      corrigees_veille: 0,
      machines: 3,
      actifs: 0,
    });
    expect(await mesures(jour(0), 'perimetre', perimA)).toMatchObject({
      p1: 1,
      p2: 1,
      p3: 0,
      exploitees: 1,
      depassements: 2,
      machines: 1,
    });
    expect(await mesures(jour(0), 'perimetre', perimB)).toMatchObject({
      p1: 1,
      p2: 0,
      p3: 1,
      depassements: 1,
      machines: 1,
    });
    expect(await mesures(jour(0), 'aucun')).toMatchObject({ p1: 0, p4: 1, machines: 1 });
    // Les nombres de la vue d'ensemble et ceux de l'instantané sont les mêmes (même calcul global).
    const vue = (await admin.get(`${V}/vue-ensemble`)).json();
    expect(vue.tuiles.exploiteesPresentes).toBe(1);
    expect(vue.tuiles.enDepassement).toBe(2);
    const lignes = (await t.svc.db.q('SELECT * FROM vulnerabilites_instantanes_mesures')).rows;
    sansNom(JSON.stringify(lignes));
    const journal = (
      await t.svc.db.q<{ target: string; details: unknown }>(
        "SELECT target, details FROM audit_log WHERE action = 'vulnerabilites.instantane.pris'",
      )
    ).rows;
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ target: jour(0), details: { niveau: 4, perimetres: 3, purges: 0 } });
    sansNom(JSON.stringify(journal));
  });

  it('calcul en échec : créneau consommé, état « echec », pas de rejeu le même jour', async () => {
    const espion = vi
      .spyOn(t.svc.vulnerabilites.tendances, 'mesurer')
      .mockRejectedValueOnce(new Error('panne fictive du calcul'));
    try {
      expect(await t.svc.vulnerabilites.tendances.prendre(dansJours(1))).toBe('echec');
    } finally {
      espion.mockRestore();
    }
    expect(
      (
        await t.svc.db.one<{ etat: string }>('SELECT etat FROM vulnerabilites_instantanes WHERE jour = $1::date', [
          jour(1),
        ])
      )?.etat,
    ).toBe('echec');
    expect(await t.svc.vulnerabilites.tendances.prendre(dansJours(1))).toBe('deja');
    expect(await n('vulnerabilites_instantanes_mesures', 'jour = $1::date', [jour(1)])).toBe(0);
    // Un jour en échec n'est pas lu comme un instantané.
    const r = (await lecteurA.get(`${V}/tendances`)).json();
    expect(r.jours.filter((p: { mesures: unknown }) => p.mesures !== null)).toHaveLength(1);
    await effacerJour(jour(1));
  });

  it('corrections de la veille comptées par périmètre ; purge au-delà de la rétention, au même tic', async () => {
    expect((await etat(rssi, '970003', { etat: 'corrigee' })).statusCode).toBe(200);
    const ancien = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(
      new Date(Date.now() + 86_400_000 - (3 * 365 + 2) * 86_400_000),
    );
    await t.svc.db.q("INSERT INTO vulnerabilites_instantanes (jour, etat, niveau, fin) VALUES ($1, 'pris', 1, now())", [
      ancien,
    ]);
    try {
      expect(await t.svc.vulnerabilites.tendances.prendre(dansJours(1))).toBe('pris');
      expect(await n('vulnerabilites_instantanes', 'jour = $1::date', [ancien])).toBe(0);
      expect(await mesures(jour(1), 'global')).toMatchObject({ corrigees_veille: 1, p3: 0 });
      expect(await mesures(jour(1), 'perimetre', perimB)).toMatchObject({ corrigees_veille: 1, p3: 0 });
      expect((await mesures(jour(1), 'perimetre', perimA))?.corrigees_veille).toBe(0);
      const journal = await t.svc.db.one<{ details: { purges: number } }>(
        "SELECT details FROM audit_log WHERE action = 'vulnerabilites.instantane.pris' AND target = $1",
        [jour(1)],
      );
      expect(journal?.details.purges).toBe(1);
    } finally {
      await effacerJour(jour(1));
      await t.svc.db.q('DELETE FROM vulnerabilites_instantanes WHERE jour = $1::date', [ancien]);
    }
  });
});

type Tendances = {
  depuis: string | null;
  granularite: string;
  jours: { jour: string; niveau: number | null; mesures: Mesures | null; corrigees: number | null }[];
  semaines: unknown[];
  tendance: { sens: string };
  perimetres: { id: string; nom: string }[];
  sansPerimetre: boolean;
  perimetre: { id: string | null; nom: string | null; aucun: boolean };
};
const tendances = async (a: Agent, q = '') => {
  const r = await a.get(`${V}/tendances${q}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Tendances;
};

describe('tendances', () => {
  it('toute la plateforme : mêmes nombres pour deux personnes, ni machines ni actifs ; historique depuis aujourd’hui', async () => {
    const a = await tendances(lecteurA);
    const b = await tendances(lecteurB);
    expect(a.granularite).toBe('jour');
    expect(a.jours).toHaveLength(30);
    expect(a.depuis).toBe(jour(0));
    const dernier = a.jours.at(-1)!;
    expect(dernier).toMatchObject({ jour: jour(0), niveau: 4 });
    expect(dernier.mesures).toMatchObject({ p1: 1, p2: 1, machines: null, actifs: null });
    expect(a.jours[0]!.mesures).toBeNull();
    expect(b.jours).toEqual(a.jours);
    expect(b.semaines).toEqual(a.semaines);
    expect(b.tendance).toEqual(a.tendance);
    expect((await tendances(lecteurA, '?periode=91')).granularite).toBe('semaine');
  });

  it('périmètre lu : ses nombres et ses machines ; périmètre illisible : absent de la liste et refusé (404)', async () => {
    const a = await tendances(lecteurA, `?perimetre=${perimA}`);
    expect(a.perimetre).toEqual({ id: perimA, nom: 'Périmètre tendances A', aucun: false });
    expect(a.jours.at(-1)!.mesures).toMatchObject({ p1: 1, p2: 1, machines: 1 });
    expect(a.perimetres.map((p) => p.id)).toContain(perimA);
    expect(a.perimetres.map((p) => p.id)).not.toContain(perimB);
    expect(a.sansPerimetre).toBe(false);
    const refus = await lecteurA.get(`${V}/tendances?perimetre=${perimB}`);
    expect(refus.statusCode).toBe(404);
    expect((await lecteurA.get(`${V}/tendances?perimetre=00000000-0000-4000-8000-00000000dead`)).body).toBe(refus.body);
    expect((await lecteurA.get(`${V}/tendances?perimetre=aucun`)).statusCode).toBe(404);
    const aucun = await tendances(admin, '?perimetre=aucun');
    expect(aucun.jours.at(-1)!.mesures).toMatchObject({ p4: 1, machines: 1 });
    expect((await lecteurA.get(`${V}/tendances?periode=45`)).statusCode).toBe(422);
  });

  it('lecture seule : aucune écriture, aucune entrée de journal', async () => {
    const etatBase = async () => ({
      audit: (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n,
      instantanes: await n('vulnerabilites_instantanes'),
      mesures: await n('vulnerabilites_instantanes_mesures'),
    });
    const avant = await etatBase();
    await tendances(lecteurA);
    await tendances(admin, '?perimetre=aucun&periode=364');
    await admin.get(`${V}/vue-ensemble`);
    expect(await etatBase()).toEqual(avant);
  });
});

describe('vue d’ensemble : variation sur sept jours', () => {
  it('sans instantané assez ancien : aucune ; avec celui de J-7 : écarts et niveau', async () => {
    expect((await lecteurA.get(`${V}/vue-ensemble`)).json().variation).toBeNull();
    await t.svc.db.q("INSERT INTO vulnerabilites_instantanes (jour, etat, niveau, fin) VALUES ($1, 'pris', 2, now())", [
      jour(-7),
    ]);
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_instantanes_mesures (jour, portee, p1, p2, p3, p4, exploitees, depassements, exceptions,
         corrigees_veille, machines, actifs) VALUES ($1, 'global', 0, 3, 0, 0, 0, 1, 0, 0, 40, 2)`,
      [jour(-7)],
    );
    try {
      const v = (await lecteurA.get(`${V}/vue-ensemble`)).json().variation;
      expect(v.reference).toBe(jour(-7));
      expect(v.niveau).toEqual({ avant: 2, apres: 4 });
      expect(Object.fromEntries(v.lignes.map((l: { cle: string; ecart: number }) => [l.cle, l.ecart]))).toEqual({
        // Moment : P1 1, P2 1 (970002), dépassements 2 (970001 et 970002), 970003 corrigée plus haut.
        p1: 1,
        p2: -2,
        exploitees: 1,
        depassements: 1,
        exceptions: 0,
      });
      expect(JSON.stringify(v)).not.toContain('machines');
      expect((await lecteurB.get(`${V}/vue-ensemble`)).json().variation).toEqual(v);
    } finally {
      await effacerJour(jour(-7));
    }
  });
});

type Rapport = {
  etablissement: string;
  du: string;
  au: string;
  perimetre: { id: string | null; nom: string | null; aucun: boolean };
  niveau: { actuel: { niveau: number }; instantanes: number; max: number | null };
  situation: Mesures;
  critiques: { total: number; p2: number; elements: { cve: string; titre: string }[] };
  depassements: { total: number; elements: { titre: string; priorite: string }[] };
  exceptions: { compteurs: Record<string, number>; elements: { justification: string; mesure: string; par: string }[] };
  alertes: { ouvertes: number; prisesEnCompte: number; enCours: number; delai: { nombre: number } };
  sources: { connecteurs: { libelle: string }[] };
  tendances: { depuis: string | null; semaines: unknown[] };
};
const rapport = async (a: Agent, q: string) => {
  const r = await a.get(`${V}/rapport?${q}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Rapport;
};

describe('rapport de pilotage', () => {
  beforeAll(async () => {
    // Exception accordée par le RSSI sur 970002, justification qui cite une machine et son adresse (masquées au rapport).
    const echeance = jour(60);
    const r = await etat(rssi, '970002', {
      etat: 'risque_accepte',
      note: `Équipement fictif ${nomMachine(1)} (${adresse(1)}) non corrigeable.`,
      mesure: `Flux filtré vers ${nomMachine(1)} (fictif).`,
      revueLe: echeance,
    });
    expect(r.statusCode, r.body).toBe(200);
    // Alerte critique ouverte et prise en compte par le RSSI.
    await t.svc.vulnerabilites.alertes.evaluer('test');
    const alerte = await t.svc.db.one<{ id: string; version: number }>(
      "SELECT id, version FROM vulnerabilites_alertes WHERE niveau = 'critique' AND etat <> 'close'",
    );
    expect(alerte).toBeTruthy();
    const p = await rssi.post(`${V}/alertes/${alerte!.id}/prise-en-compte`, {}, ifMatch(alerte!.version));
    expect(p.statusCode, p.body).toBe(200);
  });

  it('mois en cours : sections, nombres communs à deux personnes, aucun nom de machine ni d’adresse', async () => {
    const mois = jour(0).slice(0, 7);
    const a = await rapport(lecteurA, `mois=${mois}`);
    const b = await rapport(lecteurB, `mois=${mois}`);
    expect(a).toMatchObject({ du: `${mois}-01`, au: jour(0), perimetre: { id: null, aucun: false } });
    expect(a.etablissement.length).toBeGreaterThan(0);
    expect(a.niveau.actuel.niveau).toBe(4);
    expect(a.niveau.instantanes).toBe(1);
    expect(a.situation).toMatchObject({ p1: 1, machines: null, actifs: null });
    expect(a.critiques.total).toBe(1);
    expect(a.critiques.elements[0]!.cve).toBe('CVE-2026-90001');
    expect(a.alertes).toMatchObject({ ouvertes: 1, prisesEnCompte: 1, enCours: 1, delai: { nombre: 1 } });
    expect(a.sources.connecteurs.map((c) => c.libelle)).toEqual(['Tenable Security Center n° 1']);
    for (const cle of ['niveau', 'situation', 'critiques', 'depassements', 'alertes', 'tendances'] as const)
      expect(b[cle]).toEqual(a[cle]);
    const texte = JSON.stringify(a);
    sansNom(texte);
    expect(texte).not.toContain('Tenable fictif tendances');
    expect(texte).not.toContain('tenable.exemple.invalid');
  });

  it('exceptions : justification et mesure masquées ; seulement celles des failles lues', async () => {
    const mois = jour(0).slice(0, 7);
    const a = await rapport(lecteurA, `mois=${mois}`);
    expect(a.exceptions.compteurs.en_cours).toBe(1);
    expect(a.exceptions.elements[0]!.justification).toContain('[machine]');
    expect(a.exceptions.elements[0]!.mesure).toContain('[machine]');
    expect(a.exceptions.elements[0]!.par).toBe('Nom td_rssi');
    expect((await rapport(lecteurB, `mois=${mois}`)).exceptions.elements).toEqual([]);
  });

  it('périmètre lu : ses nombres ; illisible ou « sans périmètre » sans le droit : 404 ; période invalide refusée', async () => {
    const a = await rapport(lecteurA, `du=${jour(-3)}&au=${jour(0)}&perimetre=${perimA}`);
    expect(a.perimetre).toEqual({ id: perimA, nom: 'Périmètre tendances A', aucun: false });
    expect(a.situation).toMatchObject({ p1: 1, machines: 1, exceptions: 1 });
    expect(a.depassements.elements.every((d) => !d.titre.includes('970003'))).toBe(true);
    expect((await lecteurA.get(`${V}/rapport?mois=2026-11&perimetre=${perimB}`)).statusCode).toBe(404);
    expect((await lecteurA.get(`${V}/rapport?mois=2026-11&perimetre=aucun`)).statusCode).toBe(404);
    expect((await rapport(admin, `mois=${jour(0).slice(0, 7)}&perimetre=aucun`)).situation).toMatchObject({ p4: 1 });
    expect((await lecteurA.get(`${V}/rapport`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${V}/rapport?du=${jour(5)}&au=${jour(9)}`)).statusCode).toBe(422);
  });

  it('CSV : fichier joint, mêmes tableaux, aucun nom de machine ni d’adresse', async () => {
    const r = await lecteurA.get(`${V}/rapport?mois=${jour(0).slice(0, 7)}&format=csv`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toMatch(/^attachment; filename="rapport-vulnerabilites-\d{4}-\d{2}-01-/);
    expect(r.body).toContain('"Rapport de pilotage des vulnérabilités"');
    expect(r.body).toContain('CVE-2026-90001');
    expect(r.body).toContain('[machine]');
    sansNom(r.body);
  });

  it('production tracée au journal : qui, période, portée, format, sans détail ni contenu', async () => {
    const avant = await n('audit_log', "action = 'vulnerabilites.rapport.produit'");
    await rapport(lecteurA, `du=${jour(-2)}&au=${jour(0)}&perimetre=${perimA}`);
    const lignes = (
      await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
        "SELECT username, target, details FROM audit_log WHERE action = 'vulnerabilites.rapport.produit' ORDER BY id",
      )
    ).rows;
    expect(lignes).toHaveLength(avant + 1);
    expect(lignes.at(-1)).toEqual({
      username: 'td_lecteur_a',
      target: '',
      details: { du: jour(-2), au: jour(0), perimetre: perimA, format: 'json', detail: false },
    });
    const texte = JSON.stringify(lignes);
    sansNom(texte);
    expect(texte).not.toContain('CVE-');
    expect(texte).not.toContain('fictif');
  });

  it('nombre de requêtes borné, aucune par faille', async () => {
    const espion = vi.spyOn(pg.Client.prototype, 'query');
    const compter = async (fn: () => Promise<unknown>) => {
      espion.mockClear();
      await fn();
      return espion.mock.calls.length;
    };
    try {
      await admin.get(`${V}/priorite/reglage`);
      const socle = (await compter(() => admin.get(`${V}/priorite/reglage`))) - 1;
      const lecture = (await compter(() => admin.get(`${V}/tendances?periode=364`))) - socle;
      const rapportJson = (await compter(() => admin.get(`${V}/rapport?mois=${jour(0).slice(0, 7)}`))) - socle;
      const instantane = await compter(() => t.svc.vulnerabilites.tendances.prendre(dansJours(2)));
      expect(socle).toBeGreaterThan(0);
      expect(lecture).toBeLessThanOrEqual(4);
      expect(rapportJson).toBeGreaterThan(10);
      expect(rapportJson).toBeLessThanOrEqual(48);
      expect(instantane).toBeLessThanOrEqual(34);
    } finally {
      espion.mockRestore();
      await effacerJour(jour(2));
    }
  });
});
