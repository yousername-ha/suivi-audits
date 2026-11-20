/* Module Vulnérabilités (ADR 0100, lot PRIO-1 ; décisions du RSSI des 19 et 20/11/2026), sur PostgreSQL. Migration 097 sur
   base vierge.
   - Fin de support : une faille présente sur une machine en fin de support (contrôle présent dont la date de fin de support
     de Tenable est passée) gagne un cran (P3 → P2, P2 → P1, P4 → P3 ; P1 reste P1), avec le fait cité ; même priorité dans
     la liste, la fiche illustrée, les marques des machines et les alertes ; une machine voisine n'est pas touchée.
   - Rançongiciels (catalogue KEV) : fait visible (sources, priorité), niveau inchangé.
   - Kit d'exploitation selon Tenable (colonne de la migration 097) : rangé avec « exploitable » (filtre, priorité P2 d'une
     faille élevée), jamais une exploitation avérée ; sans exposition sur Internet, aucune alerte.
   - P1 sous exception : l'alerte critique reste ouverte, marquée « risque accepté », sans nouvelle notification ; à la fin
     de l'exception (échue), la marque tombe et l'alerte reste critique.
   - Cartes d'avis : « présente sur le parc » et « exposée sur Internet » par CVE citée, en une lecture pour la page.
   - Fréquences : « En retard » après trois périodes ; journaux purgés au-delà de 90 jours (dernières lignes, files et
     imports gardés).
   Données entièrement fictives : machines en .invalid, adresses de 192.0.2.0/24, CVE fictives ; aucun service n'est joint. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, ouvrirFlux, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteur: Agent;
let tenable: string, alh: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000009${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-prio-${String(n).padStart(2, '0')}.interne.invalid`;
const adresse = (n: number) => `192.0.2.${110 + n}`;

const machine = (n: number) => ({
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
});
const constat = (plugin: string, cves: string[], gravite: string, extra: Record<string, unknown> = {}) => ({
  type: 'constat',
  plugin,
  nom: `Produit fictif : contrôle fictif ${plugin}`,
  gravite,
  famille: 'Misc.',
  synopsis: null,
  correctif: null,
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
  cves,
  cvesTronquees: false,
  ...extra,
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
/** Machine 1 : en fin de support (970009, système plus maintenu, faible). Machine 2 : maintenue.
    970001 (CVE 97001, critique) sur 1 : P2 → P1 ; 970002 (CVE 97002, critique) sur 2 : P2 ;
    970003 (CVE 97003, élevée) sur 1 : P3 → P2 ; 970004 (CVE 97004, KEV et rançongiciels) sur 1 : P1 reste P1 ;
    970005 (CVE 97005, KEV) sur 2 : P1 (exception) ; 970006 (CVE 97006, élevée, kit Metasploit seul) sur 2 : P2 ;
    970009 (sans CVE, critique, fin de support passée) sur 1 : le contrôle de fin de support lui-même ne monte pas, P2
    (décision du RSSI du 20/11/2026) ; 970010 (CVE 97010, moyenne) sur 1 : P4 → P3. */
const parc = (): Record<string, unknown>[] => [
  machine(1),
  machine(2),
  constat('970001', ['CVE-2026-97001'], 'critique'),
  constat('970002', ['CVE-2026-97002'], 'critique'),
  constat('970003', ['CVE-2026-97003'], 'elevee'),
  constat('970004', ['CVE-2026-97004'], 'moyenne'),
  constat('970005', ['CVE-2026-97005'], 'moyenne'),
  constat('970006', ['CVE-2026-97006'], 'elevee', { kitsExploitation: ['metasploit'] }),
  constat('970009', [], 'critique', { finSupportLe: '2025-01-01T00:00:00.000Z' }),
  constat('970010', ['CVE-2026-97010'], 'moyenne'),
  detection('970001', 1),
  detection('970002', 2),
  detection('970003', 1),
  detection('970004', 1),
  detection('970005', 2),
  detection('970006', 2),
  detection('970009', 1),
  detection('970010', 1),
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
async function synchroniser(instance: string, elements: Record<string, unknown>[], resultat: unknown) {
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  expect(job).toMatchObject({ operation: 'synchroniser' });
  if (elements.length) await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat, erreur: null });
}

/* ------------------------------------------------------------------ AlgoLightHouse fictif : CVE 97002 exposée */
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const surface = (): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif PRIO' },
  {
    type: 'hote',
    id: U(11),
    perimetre: U(1),
    statut: 'monitored',
    adresse: '192.0.2.190',
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
    titre: 'Alerte fictive exposée',
    verifiee: true,
    detail: true,
    cibleType: 'host',
    cibleValeur: null,
    cibleHote: U(11),
    cibleDomaine: null,
    cves: ['CVE-2026-97002'],
    defauts: [],
    creeLe: '2026-11-10T10:00:00.000Z',
    majLe: '2026-11-15T10:00:00.000Z',
    termineeLe: null,
  },
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

interface ConstatJson {
  id: string;
  plugin: string;
  priorite: { niveau: string; faits: { fait: string }[] };
  sources: { exploitation: { source: string }[]; exploitable: { source: string }[]; rancongiciel?: boolean };
  kitsExploitation: string[];
  surMachineFinSupport: boolean;
  finDeSupport: boolean;
}
const constats = async (q = '') => {
  const r = await admin.get(`${V}/constats${q}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json().elements as ConstatJson[];
};
const parPlugin = async (q = '') => new Map((await constats(q)).map((c) => [c.plugin, c]));
const constatId = async (plugin: string) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = $1::int', [plugin]))!
    .id;
const alertes = async () =>
  (
    await t.svc.db.q<{ cle: string; niveau: string; etat: string; faits: { risqueAccepte?: boolean } }>(
      "SELECT cle, niveau, etat, faits FROM vulnerabilites_alertes WHERE etat <> 'close' ORDER BY cle",
    )
  ).rows;
const notificationsCritiques = async () =>
  (await t.svc.db.one<{ n: number }>(
    "SELECT count(*)::int AS n FROM grc_notifications WHERE kind = 'vulnerabilites_alerte_critique'",
  ))!.n;

beforeAll(async () => {
  t = await createTestApp();
  await ouvrirFlux(t, 'courriel');
  await t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
  admin = await login(t, await makeUser(t, 'prio_admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_prio_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])",
  );
  lecteur = await login(t, await makeUser(t, 'prio_lecteur', 'r_prio_lire', { rattache: false }));
  tenable = await creerInstance(
    'tenable',
    'Tenable fictif PRIO',
    { adresse: 'https://tenable-prio.exemple.invalid' },
    { accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', secretKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0f' },
  );
  alh = await creerInstance(
    'algolighthouse',
    'AlgoLightHouse fictif PRIO',
    { adresse: 'https://espace-prio.algolighthouse.fr' },
    { cleApi: 'cle-api-fictive-0123456789abcdef' },
  );
  for (const cve of ['CVE-2026-97004', 'CVE-2026-97005'])
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit, kev_rancongiciel)
       VALUES ($1, '2026-11-01', $2, 'Produit fictif', $3)`,
      [cve, `Fictional Product ${cve.slice(-5)} Remote Code Execution`, cve === 'CVE-2026-97004'],
    );
  const el = parc();
  await synchroniser(tenable, el, bilanTenable(el));
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('lot PRIO-1 : fin de support, un cran de plus', () => {
  it('liste des failles : P2 → P1, P3 → P2, P4 → P3 sur la machine en fin de support, P1 reste P1, fait cité', async () => {
    const c = await parPlugin();
    const niveau = (p: string) => c.get(p)!.priorite.niveau;
    const fds = (p: string) => c.get(p)!.priorite.faits.some((f) => f.fait === 'fin_de_support');
    expect([niveau('970001'), niveau('970003'), niveau('970010'), niveau('970004')]).toEqual(['P1', 'P2', 'P3', 'P1']);
    for (const p of ['970001', '970003', '970010', '970004']) {
      expect(fds(p), p).toBe(true);
      expect(c.get(p)!.surMachineFinSupport, p).toBe(true);
    }
    // Décision du RSSI du 20/11/2026 : le contrôle de fin de support lui-même (critique) ne monte pas : P2 de la grille.
    expect(niveau('970009')).toBe('P2');
    expect(fds('970009')).toBe(false);
    expect(c.get('970009')!.surMachineFinSupport).toBe(false);
    // P1 reste P1 : l'exploitation, puis la mention des rançongiciels, puis la présence, puis la fin de support.
    expect(c.get('970004')!.priorite.faits.map((f) => f.fait)).toEqual([
      'exploitation',
      'rancongiciel',
      'presence',
      'fin_de_support',
    ]);
    // La machine voisine, maintenue, n'est pas touchée.
    expect([niveau('970002'), niveau('970005')]).toEqual(['P2', 'P1']);
    for (const p of ['970002', '970005', '970006']) {
      expect(fds(p), p).toBe(false);
      expect(c.get(p)!.surMachineFinSupport, p).toBe(false);
    }
    expect(c.get('970009')!.finDeSupport).toBe(true);
    expect(c.get('970001')!.finDeSupport).toBe(false);
  });

  it('même priorité dans la fiche illustrée d’une CVE, la fiche du constat et les marques des machines', async () => {
    // Fiche illustrée du constat : la priorité de la liste.
    const fc = await admin.get(`${V}/fiches/constat/${await constatId('970001')}`);
    expect(fc.statusCode, fc.body).toBe(200);
    expect(fc.json().priorite).toMatchObject({ niveau: 'P1' });
    expect(fc.json().priorite.faits.map((x: { fait: string }) => x.fait)).toContain('fin_de_support');
    // Fiche d'une CVE : faits de la CVE seulement (CVE inconnue de la veille, gravité non publiée : P4), un cran de plus.
    const f = await admin.get(`${V}/fiches/cve/CVE-2026-97001`);
    expect(f.statusCode, f.body).toBe(200);
    expect(f.json().priorite).toMatchObject({ niveau: 'P3' });
    expect(f.json().priorite.faits.map((x: { fait: string }) => x.fait)).toEqual([
      'presence',
      'gravite',
      'fin_de_support',
    ]);
    // Une CVE de la machine maintenue : aucun cran de plus.
    const g = await admin.get(`${V}/fiches/cve/CVE-2026-97002`);
    expect(g.json().priorite.faits.map((x: { fait: string }) => x.fait)).not.toContain('fin_de_support');
    const fiche = (await admin.get(`${V}/constats/${await constatId('970003')}`)).json() as ConstatJson;
    expect(fiche.priorite.niveau).toBe('P2');
    const machines = (await admin.get(`${V}/machines`)).json().elements as {
      nom: string;
      finDeSupport: boolean;
      marques: { priorite: string | null };
    }[];
    const m = new Map(machines.map((x) => [x.nom, x]));
    expect(m.get(nomMachine(1))).toMatchObject({ finDeSupport: true, marques: { priorite: 'P1' } });
    expect(m.get(nomMachine(2))).toMatchObject({ finDeSupport: false, marques: { priorite: 'P1' } });
  });

  it('alertes : la P2 montée en P1 ouvre une alerte critique ; la P2 interne de la machine maintenue n’en ouvre pas', async () => {
    const a = new Map((await alertes()).map((x) => [x.cle, x]));
    expect(a.get('CVE-2026-97001')).toMatchObject({ niveau: 'critique' });
    expect(a.has('CVE-2026-97002')).toBe(false);
    expect(a.has('CVE-2026-97003')).toBe(false);
    // Le contrôle de fin de support lui-même (critique, sans CVE) reste en P2 : aucune alerte critique pour lui.
    expect([...a.keys()].some((k) => k.startsWith('constat:'))).toBe(false);
  });

  it('rançongiciels : à priorité égale, en tête de la liste des failles et des cibles de la vue d’ensemble', async () => {
    // Trois P1 : 970004 (rançongiciels), 970001 (fin de support, critique), 970005 (KEV). La mention passe avant la
    // gravité : 970004 (moyenne) devant 970001 (critique).
    const p1 = (await constats()).filter((c) => c.priorite.niveau === 'P1').map((c) => c.plugin);
    expect(p1[0]).toBe('970004');
    expect(p1.indexOf('970004')).toBeLessThan(p1.indexOf('970001'));
    const v = await admin.get(`${V}/vue-ensemble`);
    expect(v.statusCode, v.body).toBe(200);
    const cibles = (v.json().cibles as { cve: string | null; priorite: { niveau: string } }[])
      .filter((x) => x.priorite.niveau === 'P1')
      .map((x) => x.cve);
    expect(cibles[0]).toBe('CVE-2026-97004');
    // Le niveau, lui, ne change pas : une P2 reste après toutes les P1.
    const niveaux = (v.json().cibles as { priorite: { niveau: string } }[]).map((x) => x.priorite.niveau);
    expect(niveaux.indexOf('P2')).toBeGreaterThan(niveaux.lastIndexOf('P1'));
  });
});

describe('lot PRIO-1 : rançongiciels et kit d’exploitation', () => {
  it('rançongiciels : fait des sources rendu, niveau inchangé ; absent quand le catalogue ne le dit pas', async () => {
    const c = await parPlugin();
    expect(c.get('970004')!.sources.rancongiciel).toBe(true);
    expect(c.get('970005')!.sources.rancongiciel).toBeUndefined();
    expect(c.get('970005')!.priorite.faits.map((f) => f.fait)).toEqual(['exploitation', 'presence']);
  });

  it('kit d’exploitation : rangé, « exploitable » (filtre, P2 d’une élevée), jamais une exploitation avérée', async () => {
    const enBase = await t.svc.db.one<{ kits: string[] }>(
      'SELECT kits_exploitation AS kits FROM vulnerabilites_constats WHERE plugin_id = 970006',
    );
    expect(enBase!.kits).toEqual(['metasploit']);
    const c = (await parPlugin()).get('970006')!;
    expect(c.kitsExploitation).toEqual(['metasploit']);
    expect(c.sources.exploitable.map((x) => x.source)).toEqual(['tenable-kit']);
    expect(c.sources.exploitation).toEqual([]);
    expect(c.priorite.niveau).toBe('P2');
    expect([...(await parPlugin('?exploitable=oui')).keys()]).toContain('970006');
    expect([...(await parPlugin('?exploite=oui')).keys()]).not.toContain('970006');
    // Sans exposition sur Internet, aucune alerte (règle des alertes P2 exposées).
    expect((await alertes()).map((x) => x.cle)).not.toContain('CVE-2026-97006');
    // La contrainte de la migration 097 refuse un nom hors liste.
    await expect(
      t.svc.db.q("UPDATE vulnerabilites_constats SET kits_exploitation = '{autre}' WHERE plugin_id = 970006"),
    ).rejects.toThrow(/kits_exploitation/);
  });
});

describe('lot PRIO-1 : P1 sous exception, alerte gardée', () => {
  it('l’alerte critique reste ouverte, marquée « risque accepté », sans nouvelle notification', async () => {
    const id = await constatId('970005');
    expect(new Map((await alertes()).map((x) => [x.cle, x])).get('CVE-2026-97005')).toMatchObject({
      niveau: 'critique',
    });
    const notes = await notificationsCritiques();
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_suivis (nature, constat_id, etat, revue_le, exception_mesure)
       VALUES ('constat', $1, 'risque_accepte', '2027-06-01', 'Mesure compensatoire fictive')`,
      [id],
    );
    await t.svc.vulnerabilites.alertes.evaluer('test');
    const a = new Map((await alertes()).map((x) => [x.cle, x])).get('CVE-2026-97005')!;
    expect(a).toMatchObject({ niveau: 'critique', etat: 'ouverte' });
    expect(a.faits.risqueAccepte).toBe(true);
    expect(await notificationsCritiques()).toBe(notes);
    // Lecture : la marque et les machines de l'exception sont rendues.
    const r = await admin.get(`${V}/alertes?etat=actives`);
    const dto = (r.json().elements as { cve: string; risqueAccepte: boolean; machines: { lisibles: number } }[]).find(
      (x) => x.cve === 'CVE-2026-97005',
    )!;
    expect(dto).toMatchObject({ risqueAccepte: true, machines: { lisibles: 1 } });
    const autre = (r.json().elements as { cve: string; risqueAccepte: boolean }[]).find(
      (x) => x.cve === 'CVE-2026-97001',
    )!;
    expect(autre.risqueAccepte).toBe(false);
    // La liste des failles, elle, ne la montre plus parmi celles à traiter (état de suivi inchangé).
    expect([...(await parPlugin()).keys()]).not.toContain('970005');
  });

  it('une P2 sous exception n’est pas gardée ; à l’échéance de l’exception, la marque tombe et l’alerte reste critique', async () => {
    // P2 sous exception : aucune alerte (comme avant).
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_suivis (nature, constat_id, etat, revue_le, exception_mesure)
       VALUES ('constat', $1, 'risque_accepte', '2027-06-01', 'Mesure compensatoire fictive')`,
      [await constatId('970002')],
    );
    await t.svc.vulnerabilites.alertes.evaluer('test');
    expect((await alertes()).map((x) => x.cle)).not.toContain('CVE-2026-97002');
    // Exception échue : la plateforme la clôt (état d'avant, « à traiter ») et réévalue.
    const notes = await notificationsCritiques();
    await t.svc.db.q("UPDATE vulnerabilites_suivis SET revue_le = '2026-01-01' WHERE constat_id = $1", [
      await constatId('970005'),
    ]);
    const bilan = await t.svc.vulnerabilites.delais.evaluer(new Date());
    expect(bilan?.expirees).toBeGreaterThan(0);
    const a = new Map((await alertes()).map((x) => [x.cle, x])).get('CVE-2026-97005')!;
    expect(a).toMatchObject({ niveau: 'critique', etat: 'ouverte' });
    expect(a.faits.risqueAccepte).toBeUndefined();
    expect(await notificationsCritiques()).toBe(notes);
  });
});

describe('lot PRIO-1 : cartes d’avis de la veille', () => {
  it('« présente sur le parc » et « exposée sur Internet » par CVE citée, en une lecture pour la page', async () => {
    await synchroniser(alh, surface(), bilanAlh(surface()));
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, publie_le, cves)
       VALUES ('cert-fr', 'CERTFR-2026-AVI-9701', 'avis', 'Avis fictif PRIO', now(),
               ARRAY['CVE-2026-97001', 'CVE-2026-97002', 'CVE-2026-97099']),
              ('cert-fr', 'CERTFR-2026-AVI-9702', 'avis', 'Avis fictif sans rapport', now() - interval '1 day',
               ARRAY['CVE-2026-97098'])`,
    );
    const r = await lecteur.get(`${V}/veille/avis`);
    expect(r.statusCode, r.body).toBe(200);
    const parId = new Map(
      (r.json().elements as { identifiant: string; parc: { presentes: string[]; exposees: string[] } }[]).map((a) => [
        a.identifiant,
        a.parc,
      ]),
    );
    expect(parId.get('CERTFR-2026-AVI-9701')).toEqual({
      presentes: ['CVE-2026-97001', 'CVE-2026-97002'],
      exposees: ['CVE-2026-97002'],
    });
    expect(parId.get('CERTFR-2026-AVI-9702')).toEqual({ presentes: [], exposees: [] });
    // Aucun nom de machine, d'adresse ni de périmètre dans la réponse.
    for (const n of [1, 2]) {
      expect(r.body).not.toContain(nomMachine(n));
      expect(r.body).not.toContain(adresse(n));
    }
    expect(r.body).not.toContain('192.0.2.190');
    expect(r.body).not.toContain('Périmètre ALH fictif PRIO');
  });
});

describe('lot PRIO-1 : fréquences', () => {
  it('« En retard » après trois périodes sans collecte réussie, et non après 36 heures fixes', async () => {
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_sources (source, frequence_heures, derniere_reussite) VALUES
         ('cisa-kev', 2, now() - interval '5 hours'),
         ('cert-fr', 2, now() - interval '7 hours'),
         ('epss', NULL, now() - interval '48 hours')
       ON CONFLICT (source) DO UPDATE SET frequence_heures = EXCLUDED.frequence_heures,
         derniere_reussite = EXCLUDED.derniere_reussite`,
    );
    const etat = (await admin.get(`${V}/veille/etat`)).json() as { sources: { source: string; enRetard: boolean }[] };
    const retard = new Map(etat.sources.map((s) => [s.source, s.enRetard]));
    expect(retard.get('cisa-kev')).toBe(false);
    expect(retard.get('cert-fr')).toBe(true);
    // EPSS (une fois par jour) : trois jours ; 48 heures ne suffisent plus à le dire en retard.
    expect(retard.get('epss')).toBe(false);
  });

  it('journaux purgés au-delà de 90 jours : dernières lignes, files en cours et imports gardés ; journal sans nom', async () => {
    const vieux = "now() - interval '120 days'";
    await t.svc.db.q('DELETE FROM vulnerabilites_veille_collectes');
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_collectes (source, origine, etat, demande_par, demande_le, debute_le, termine_le) VALUES
         ('cisa-kev', 'planifie', 'recu', 'test', ${vieux}, ${vieux}, ${vieux}),
         ('cisa-kev', 'planifie', 'recu', 'test', now() - interval '100 days', now() - interval '100 days', now() - interval '100 days'),
         ('cisa-kev', 'planifie', 'recu', 'test', now() - interval '10 days', now() - interval '10 days', now() - interval '10 days'),
         ('cert-fr', 'planifie', 'recu', 'test', ${vieux}, ${vieux}, ${vieux}),
         ('nvd', 'planifie', 'en_file', 'test', ${vieux}, NULL, NULL),
         ('nvd', 'planifie', 'recu', 'test', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day')`,
    );
    const avant = (await t.svc.db.one<{ n: number }>(
      `SELECT count(*)::int AS n FROM integration_executions WHERE integration_id = $1`,
      [tenable],
    ))!.n;
    await t.svc.db.q(
      `INSERT INTO integration_executions (integration_id, operation, origine, etat, demande_par, demande_le, debute_le, termine_le, resultat)
       VALUES ($1, 'synchroniser', 'planifie', 'recu', 'test', ${vieux}, ${vieux}, ${vieux}, '{}'),
              ($1, 'tester', 'manuel', 'recu', 'test', ${vieux}, ${vieux}, ${vieux}, '{}')`,
      [tenable],
    );
    const bilan = await t.svc.vulnerabilites.purgeJournaux.purger();
    // Collectes : la plus ancienne de KEV et celle de 100 jours partent ; la dernière de KEV, la seule du CERT-FR (même
    // vieille), la file NVD en attente et la dernière NVD restent.
    expect(bilan.collectes).toBe(2);
    expect(
      (
        await t.svc.db.q<{ source: string; etat: string }>(
          'SELECT source, etat FROM vulnerabilites_veille_collectes ORDER BY source, demande_le',
        )
      ).rows,
    ).toEqual([
      { source: 'cert-fr', etat: 'recu' },
      { source: 'cisa-kev', etat: 'recu' },
      { source: 'nvd', etat: 'en_file' },
      { source: 'nvd', etat: 'recu' },
    ]);
    // Exécutions : la vieille synchronisation part (une plus récente existe) ; le seul test de connexion reste.
    expect(bilan.executions).toBe(1);
    expect(
      (await t.svc.db.one<{ n: number }>(
        `SELECT count(*)::int AS n FROM integration_executions WHERE integration_id = $1`,
        [tenable],
      ))!.n,
    ).toBe(avant + 1);
    const journal = await t.svc.db.q<{ details: Record<string, unknown>; target: string }>(
      "SELECT details, target FROM audit_log WHERE action = 'vulnerabilites.journaux.purges' ORDER BY id DESC LIMIT 1",
    );
    expect(journal.rows[0]).toEqual({ details: { collectes: 2, executions: 1 }, target: '' });
    // Rien à purger : aucune entrée de plus au journal.
    expect(await t.svc.vulnerabilites.purgeJournaux.purger()).toEqual({ collectes: 0, executions: 0 });
    expect(
      (await t.svc.db.one<{ n: number }>(
        "SELECT count(*)::int AS n FROM audit_log WHERE action = 'vulnerabilites.journaux.purges'",
      ))!.n,
    ).toBe(1);
    // Au tic, au plus une fois par heure.
    const t0 = new Date();
    expect(await t.svc.vulnerabilites.purgeJournaux.tic(t0)).not.toBeNull();
    expect(await t.svc.vulnerabilites.purgeJournaux.tic(new Date(t0.getTime() + 60_000))).toBeNull();
  });
});
