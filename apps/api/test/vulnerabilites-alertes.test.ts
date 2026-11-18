/* Module Vulnérabilités (ADR 0100, lots V6 et V6b) : alertes décidées par la plateforme. Migration 086 sur base vierge.
   - Déclenchement à la fin d'une synchronisation de Tenable, d'une collecte de la veille et d'une synchronisation
     d'AlgoLightHouse : alerte critique (P1, faille exploitée présente) ; alerte simple seulement pour une faille P2
     exploitable ET exposée directement sur Internet (décision du RSSI du 18/11/2026) ; rien pour une P2 interne seulement
     ou non exploitable, ni pour P3 et P4.
   - Une seule alerte par faille (CVE, ou constat sans CVE), mise à jour sans rejeu, montée notifiée une fois, clôture
     automatique avec son motif (faille traitée, plus présente, sous le seuil : alerte simple devenue hors règle).
   - Notifications : une par alerte critique ; un seul résumé par évaluation pour les alertes simples, aucun quand il n'y
     en a pas, aucune notification individuelle d'alerte simple.
   - Prise en compte par alerte, réservée au rôle « RSSI » (direct ou par un groupe) : 403 pour la lecture, le droit de
     modifier et l'administrateur ; If-Match, journal, fenêtre retirée pour tout le monde.
   - Lecture seule ; nombres limités à ce que la personne lit ; non-fuite des noms (machines, adresses, périmètres,
     domaines) dans l'API, la notification et le courriel.
   - Module désactivé : rien n'est créé ni affiché ; une évaluation en échec ne fait pas échouer la synchronisation.
   Données entièrement fictives : machines en .invalid, adresses de 192.0.2.0/24, CVE fictives ; aucun service n'est joint. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Agent, createTestApp, login, makeUser, ouvrirFlux, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const A = `${V}/alertes`;
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurB: Agent, editeurA: Agent, sansDroit: Agent, rssi: Agent, rssiGroupe: Agent;
const ids: Record<string, string> = {};
let perimA: string, perimB: string, tenable: string, alh: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000007${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-alerte-${String(n).padStart(2, '0')}.interne.invalid`;
const adresse = (n: number) => `192.0.2.${70 + n}`;
const NOMS_PERIMETRES = ['Périmètre fictif alertes A', 'Périmètre fictif alertes B'];
const DOMAINE = 'expose-fictif.exemple.example';
const ADRESSE_EXPOSEE = '192.0.2.150';

/* ------------------------------------------------------------------ Tenable fictif */
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
  exploitLibelle: null,
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
/** Parc : machine 1 (A), 2 (B). 910001 (CVE 91001, KEV) sur 1 et 2 : P1 ; 910002 (CVE 91002, critique, non exploitable)
    sur 1 : P2 ; 910003 (CVE 91003, moyenne) sur 2 : P4 ; 910004 (sans CVE, critique) sur 2 : P2 ; 910007 et 910008 (CVE
    91007 et 91008, critiques, exploitables selon Tenable) sur 1 : P2 exploitables, internes tant qu'AlgoLightHouse ne les
    expose pas. */
const parc = (sans: string[] = []): Record<string, unknown>[] =>
  [
    machine(1),
    machine(2),
    constat('910001', ['CVE-2026-91001'], 'elevee'),
    constat('910002', ['CVE-2026-91002'], 'critique'),
    constat('910003', ['CVE-2026-91003'], 'moyenne'),
    constat('910004', [], 'critique'),
    constat('910007', ['CVE-2026-91007'], 'critique', true),
    constat('910008', ['CVE-2026-91008'], 'critique', true),
    detection('910001', 1),
    detection('910001', 2),
    detection('910002', 1),
    detection('910003', 2),
    detection('910004', 2),
    detection('910007', 1),
    detection('910008', 1),
  ].filter((e) => !sans.includes(String((e as { plugin?: string }).plugin)));

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
const syncTenable = (el: Record<string, unknown>[]) => synchroniser(tenable, el, bilanTenable(el));

/* ------------------------------------------------------------------ AlgoLightHouse fictif */
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const surface = (cves: string[]): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif' },
  {
    type: 'hote',
    id: U(11),
    perimetre: U(1),
    statut: 'monitored',
    adresse: ADRESSE_EXPOSEE,
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
    type: 'domaine',
    id: U(41),
    perimetre: U(1),
    statut: 'monitored',
    domaine: DOMAINE,
    niveau: 2,
    importManuel: false,
    adresse: ADRESSE_EXPOSEE,
    parent: null,
    creeLe: '2026-02-01T10:11:01.000Z',
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
    cves,
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

/* ------------------------------------------------------------------ Outils */
const kev = (cve: string) =>
  t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit) VALUES ($1, '2026-11-01', $2, 'Produit fictif')
     ON CONFLICT (cve) DO UPDATE SET kev_ajout = EXCLUDED.kev_ajout, kev_nom = EXCLUDED.kev_nom, kev_produit = EXCLUDED.kev_produit`,
    [cve, `Fictional Product ${cve.slice(-5)} Remote Code Execution`],
  );
interface AlerteJson {
  id: string;
  cle: string;
  cve: string | null;
  niveau: string;
  etat: string;
  version: number;
  titre: string;
  produit: string | null;
  presences: string[];
  priorite: { niveau: string };
  exploitation: { source: string }[];
  machines: { lisibles: number; horsLecture: boolean };
  actifs: { lisibles: number; horsLecture: boolean };
  priseEnCompte: { par: string; le: string } | null;
  cloture: { motif: string } | null;
  notifiee: boolean;
}
const enBase = async () =>
  (
    await t.svc.db.q<{ cle: string; niveau: string; etat: string; version: number; motif_cloture: string | null }>(
      'SELECT cle, niveau, etat, version, motif_cloture FROM vulnerabilites_alertes ORDER BY ouverte_le, cle',
    )
  ).rows;
const alerteDe = async (cle: string, etat = "etat <> 'close'") =>
  (await t.svc.db.one<{ id: string; version: number }>(
    `SELECT id, version FROM vulnerabilites_alertes WHERE cle = $1 AND ${etat} ORDER BY ouverte_le DESC LIMIT 1`,
    [cle],
  ))!;
const notifications = async (kind: string, cleDue?: string) =>
  (
    await t.svc.db.q<{ user_id: string; title: string; message: string; due_key: string }>(
      `SELECT user_id, title, message, due_key FROM grc_notifications WHERE kind = $1 AND ($2::text IS NULL OR due_key = $2)
       ORDER BY created_at, user_id`,
      [kind, cleDue ?? null],
    )
  ).rows;
/** Comptes actifs qui lisent le module (destinataires des notifications). */
const lecteursDuModule = () => [ids.admin, ids.lecteurA, ids.lecteurB, ids.editeurA, ids.rssi, ids.rssiGroupe].sort();
let depuis = 0;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 AND id > $2 ORDER BY id',
      [action, depuis],
    )
  ).rows;
const marquer = async () => {
  depuis = (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n;
};
/** Aucun nom de machine, adresse, périmètre ni domaine dans un texte rendu ou envoyé. */
const sansNom = (texte: string) => {
  for (const n of [1, 2]) {
    expect(texte).not.toContain(nomMachine(n));
    expect(texte).not.toContain(adresse(n));
  }
  expect(texte).not.toContain('srv-alerte');
  for (const p of NOMS_PERIMETRES) expect(texte).not.toContain(p);
  expect(texte).not.toContain(DOMAINE);
  expect(texte).not.toContain(ADRESSE_EXPOSEE);
  expect(texte).not.toContain('Périmètre ALH fictif');
};
const fenetre = async (a: Agent) => {
  const r = await a.get(`${A}/fenetre`);
  expect(r.statusCode, r.body).toBe(200);
  sansNom(r.body);
  return r.json() as { alertes: AlerteJson[]; total: number; enCours: number; peutPrendreEnCompte: boolean };
};
const liste = async (a: Agent, q = '') => {
  const r = await a.get(`${A}${q}`);
  expect(r.statusCode, r.body).toBe(200);
  sansNom(r.body);
  return r.json().elements as AlerteJson[];
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
  await ouvrirFlux(t, 'courriel');
  await t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
  const uAdmin = await makeUser(t, 'al_admin', 'admin');
  admin = await login(t, uAdmin);
  ids.admin = uAdmin.id;
  // Les lecteurs lisent aussi un module métier : « Mes rappels » (/api/grc/notifications) est réservé à qui en lit un.
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_al_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire','ecarts:lire']),
       ('r_al_modif', 'Vulnérabilités, modification', ARRAY['vulnerabilites:lire','vulnerabilites:modifier'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[0], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[1], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const u = {
    lecteurA: await makeUser(t, 'al_lecteur_a', 'r_al_lire', { rattache: false }),
    lecteurB: await makeUser(t, 'al_lecteur_b', 'r_al_lire', { rattache: false }),
    editeurA: await makeUser(t, 'al_editeur_a', 'r_al_modif', { rattache: false }),
    sansDroit: await makeUser(t, 'al_sans_droit', 'rw'),
    // Rôle prédéfini « RSSI » : directement, ou par un groupe (décision B du 18/11/2026).
    rssi: await makeUser(t, 'al_rssi', 'rssi', { rattache: false }),
    rssiGroupe: await makeUser(t, 'al_rssi_groupe', null, { rattache: false }),
  };
  const groupe = (await t.svc.db.one<{ id: string }>(
    "INSERT INTO groups(name) VALUES ('Groupe fictif RSSI') RETURNING id",
  ))!.id;
  await t.svc.db.q("INSERT INTO group_roles(group_id, role_id) VALUES ($1, 'rssi')", [groupe]);
  await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [u.rssiGroupe.id, groupe]);
  await t.svc.db.q(
    `INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, false), ($2, $4, false), ($1, $5, true)`,
    [perimA, perimB, u.lecteurA.id, u.lecteurB.id, u.editeurA.id],
  );
  for (const [k, x] of Object.entries(u)) {
    ids[k] = x.id;
    await t.svc.db.q('UPDATE users SET email = $2 WHERE id = $1', [x.id, `${x.username}@exemple.test`]);
  }
  lecteurA = await login(t, u.lecteurA);
  lecteurB = await login(t, u.lecteurB);
  editeurA = await login(t, u.editeurA);
  sansDroit = await login(t, u.sansDroit);
  rssi = await login(t, u.rssi);
  rssiGroupe = await login(t, u.rssiGroupe);
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
  // Machines d'abord, rangées dans leur périmètre, puis faits.
  await syncTenable([machine(1), machine(2)]);
  await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $1 WHERE nom = $2', [perimA, nomMachine(1)]);
  await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $1 WHERE nom = $2', [perimB, nomMachine(2)]);
  await kev('CVE-2026-91001');
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('lots V6 et V6b : alertes décidées par la plateforme', () => {
  it('fin de synchronisation de Tenable : critique pour P1 ; rien pour une P2 interne seulement, ni pour P3 et P4', async () => {
    await marquer();
    expect(await enBase()).toEqual([]);
    await syncTenable(parc());
    // 91002 (P2 non exploitable), 91007 et 91008 (P2 exploitables) et le constat sans CVE (P2) ne sont présents que sur
    // des machines internes : aucune alerte simple (décision du RSSI du 18/11/2026).
    expect((await enBase()).map((l) => [l.cle, l.niveau, l.etat])).toEqual([['CVE-2026-91001', 'critique', 'ouverte']]);
    const ouvertes = await audits('vulnerabilites.alerte.ouverte');
    expect(ouvertes).toHaveLength(1);
    for (const a of ouvertes) {
      expect(a.username).toBe('système');
      expect(a.details.declencheur).toBe('synchronisation-tenable');
      sansNom(JSON.stringify(a));
    }
    // Notifications : une par personne qui lit le module, aucune pour qui ne le lit pas.
    const critique = await alerteDe('CVE-2026-91001');
    const notes = await notifications('vulnerabilites_alerte_critique', `${critique.id}:critique`);
    expect(notes.map((n) => n.user_id).sort()).toEqual(lecteursDuModule());
    for (const n of notes) {
      expect(n.title).toBe('Alerte critique : CVE-2026-91001 (Produit fictif)');
      sansNom(n.title + n.message);
    }
    // Aucune alerte simple : aucun résumé (n vaut 0), aucune notification individuelle.
    expect(await notifications('vulnerabilites_alerte')).toEqual([]);
    expect(
      (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM grc_notifications WHERE user_id = $1', [
        ids.sansDroit,
      ]))!.n,
    ).toBe(0);
  });

  it('une seule alerte par faille : une synchronisation identique ne rejoue rien', async () => {
    await marquer();
    const avant = await enBase();
    const notes = (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM grc_notifications'))!.n;
    await syncTenable(parc());
    expect(await enBase()).toEqual(avant);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM grc_notifications'))!.n).toBe(notes);
    expect(await audits('vulnerabilites.alerte.ouverte')).toEqual([]);
    expect(await audits('vulnerabilites.alertes.evaluees')).toEqual([]);
  });

  it('lecture : priorité et faits pour tous, nombres limités à ce que la personne lit, aucun nom', async () => {
    const a = await fenetre(lecteurA);
    expect(a.total).toBe(1);
    expect(a.enCours).toBe(1);
    expect(a.peutPrendreEnCompte).toBe(false);
    expect(a.alertes[0]).toMatchObject({
      cve: 'CVE-2026-91001',
      niveau: 'critique',
      etat: 'ouverte',
      titre: 'Fictional Product 91001 Remote Code Execution',
      produit: 'Produit fictif',
      presences: ['detectee'],
      priorite: { niveau: 'P1' },
      exploitation: [{ source: 'kev' }],
      machines: { lisibles: 1, horsLecture: true },
      actifs: { lisibles: 0, horsLecture: false },
      notifiee: true,
    });
    expect((await fenetre(lecteurB)).alertes[0]!.machines).toEqual({ lisibles: 1, horsLecture: true });
    expect((await fenetre(admin)).alertes[0]!.machines).toEqual({ lisibles: 2, horsLecture: false });
    // Prise en compte : rôle RSSI seulement (direct ou par un groupe) ; ni le droit de modifier, ni l'administrateur.
    expect((await fenetre(editeurA)).peutPrendreEnCompte).toBe(false);
    expect((await fenetre(admin)).peutPrendreEnCompte).toBe(false);
    expect((await fenetre(rssi)).peutPrendreEnCompte).toBe(true);
    expect((await fenetre(rssiGroupe)).peutPrendreEnCompte).toBe(true);
    // Liste : critiques en tête ; filtre par niveau ; fiche avec ETag ; la liste dit aussi qui peut prendre en compte.
    const l = await liste(lecteurA);
    expect(l.map((x) => x.niveau)).toEqual(['critique']);
    expect((await liste(lecteurA, '?niveau=simple')).length).toBe(0);
    expect((await lecteurA.get(A)).json().peutPrendreEnCompte).toBe(false);
    expect((await editeurA.get(A)).json().peutPrendreEnCompte).toBe(false);
    expect((await rssi.get(A)).json().peutPrendreEnCompte).toBe(true);
    expect((await lecteurA.get(`${A}?etat=inconnu`)).statusCode).toBe(422);
    const f = await lecteurA.get(`${A}/${l[0]!.id}`);
    expect(f.statusCode).toBe(200);
    expect(f.headers.etag).toBe(`"${l[0]!.version}"`);
    sansNom(f.body);
    expect((await lecteurA.get(`${A}/00000000-0000-4000-8000-000000000999`)).statusCode).toBe(404);
    // Sans le droit de lire le module : refus.
    expect((await sansDroit.get(`${A}/fenetre`)).statusCode).toBe(403);
    expect((await sansDroit.get(A)).statusCode).toBe(403);
    // Rappels : la notification mène à la fiche de l'alerte, sans nom.
    const rappels = (await lecteurA.get('/api/grc/notifications')).json() as { kind: string; lien?: string }[];
    const vuln = rappels.filter((r) => r.kind === 'vulnerabilites_alerte_critique');
    expect(vuln).toHaveLength(1);
    expect(vuln[0]!.lien).toBe(`/vulnerabilites/alertes?alerte=${l[0]!.id}`);
    sansNom(JSON.stringify(rappels));
  });

  it('prise en compte : rôle RSSI seulement (403 sinon, administrateur compris), If-Match, journal, fenêtre retirée', async () => {
    await marquer();
    const c = await alerteDe('CVE-2026-91001');
    const url = `${A}/${c.id}/prise-en-compte`;
    for (const autre of [lecteurA, editeurA, admin]) {
      const r = await autre.post(url, {}, ifMatch(c.version));
      expect(r.statusCode, r.body).toBe(403);
      expect(r.json().error).toBe('Seul le RSSI peut prendre en compte une alerte.');
    }
    expect((await sansDroit.post(url, {}, ifMatch(c.version))).statusCode).toBe(403);
    expect((await alerteDe('CVE-2026-91001')).version).toBe(c.version);
    expect(await audits('vulnerabilites.alerte.prise_en_compte')).toEqual([]);
    expect((await rssi.post(url, {})).statusCode).toBe(428);
    expect((await rssi.post(url, {}, ifMatch(c.version + 5))).statusCode).toBe(412);
    const r = await rssi.post(url, {}, ifMatch(c.version));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ etat: 'prise_en_compte', priseEnCompte: { par: 'Nom al_rssi' } });
    expect(r.headers.etag).toBe(`"${c.version + 1}"`);
    const j = await audits('vulnerabilites.alerte.prise_en_compte');
    expect(j).toEqual([
      {
        username: 'al_rssi',
        target: c.id,
        details: { cle: 'CVE-2026-91001', niveau: 'critique', version: c.version + 1 },
      },
    ]);
    for (const a of [admin, lecteurA, lecteurB, editeurA, rssi, rssiGroupe]) {
      const f = await fenetre(a);
      expect(f.alertes).toEqual([]);
      expect(f.total).toBe(0);
      expect(f.enCours).toBe(1);
    }
    // Le RSSI tenu par un groupe : même droit (ici, l'alerte est déjà prise en compte).
    expect((await rssiGroupe.post(url, {}, ifMatch(c.version + 1))).statusCode).toBe(409);
    expect((await rssi.post(url, {}, ifMatch(c.version + 1))).statusCode).toBe(409);
    // Une synchronisation identique ne la rouvre pas.
    await syncTenable(parc());
    expect((await alerteDe('CVE-2026-91001')).version).toBe(c.version + 1);
    expect((await fenetre(admin)).alertes).toEqual([]);
  });

  it('exposition directe sur Internet : alerte simple pour une P2 exploitable et exposée ; un seul résumé notifié', async () => {
    await marquer();
    // L'actif exposé porte 91002 (P2, non exploitable), 91007 et 91008 (P2, exploitables selon Tenable).
    const el = surface(['CVE-2026-91002', 'CVE-2026-91007', 'CVE-2026-91008']);
    await synchroniser(alh, el, bilanAlh(el));
    const ouvertes = (await enBase()).filter((l) => l.etat !== 'close');
    expect(ouvertes.map((l) => [l.cle, l.niveau]).sort()).toEqual([
      ['CVE-2026-91001', 'critique'],
      ['CVE-2026-91007', 'simple'],
      ['CVE-2026-91008', 'simple'],
    ]);
    const simple = (await liste(lecteurA, '?niveau=simple')).find((x) => x.cve === 'CVE-2026-91007')!;
    expect(simple).toMatchObject({
      niveau: 'simple',
      priorite: { niveau: 'P2' },
      presences: ['detectee', 'exposee'],
      notifiee: true,
    });
    // Un seul résumé par personne pour cette évaluation, aucune notification individuelle d'alerte simple.
    const resumes = await notifications('vulnerabilites_alerte');
    expect(resumes.map((n) => n.user_id).sort()).toEqual(lecteursDuModule());
    expect(new Set(resumes.map((n) => n.due_key)).size).toBe(1);
    for (const n of resumes) {
      expect(n.due_key).toMatch(/^resume:[0-9a-f-]{36}$/);
      expect(n.title).toBe('Vulnérabilités : 2 nouvelles alertes');
      expect(n.title + n.message).not.toContain('CVE-');
      sansNom(n.title + n.message);
    }
    expect(
      (await t.svc.db.one<{ n: number }>(
        "SELECT count(*)::int AS n FROM grc_notifications WHERE kind LIKE 'vulnerabilites_%' AND due_key LIKE '%:simple'",
      ))!.n,
    ).toBe(0);
    // Rappels : le résumé mène à l'onglet « Alertes » filtré sur les alertes simples ouvertes.
    const rappels = (await lecteurA.get('/api/grc/notifications')).json() as { kind: string; lien?: string }[];
    const r = rappels.filter((x) => x.kind === 'vulnerabilites_alerte');
    expect(r).toHaveLength(1);
    expect(r[0]!.lien).toBe('/vulnerabilites/alertes?niveau=simple&etat=ouverte');
    sansNom(JSON.stringify(rappels));
    // Même synchronisation : ni nouvelle alerte, ni nouveau résumé.
    await synchroniser(alh, el, bilanAlh(el));
    expect(await notifications('vulnerabilites_alerte')).toHaveLength(resumes.length);
  });

  it('fin de collecte de la veille : une alerte simple devient critique, notifiée une fois', async () => {
    await marquer();
    const s = await alerteDe('CVE-2026-91007');
    const resumes = (await notifications('vulnerabilites_alerte')).length;
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('cisa-kev', 'manuel', 'test')",
    );
    const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    const element = {
      cve: 'CVE-2026-91007',
      editeur: 'Éditeur fictif',
      produit: 'Produit fictif',
      nom: 'Fictional Product Vulnerability',
      description: 'Fictional description, kept as is.',
      action: 'Apply mitigations per vendor instructions.',
      ajoutLe: '2026-11-13',
      echeance: '2026-12-04',
      rancongiciel: false,
    };
    await t.svc.vulnerabilites.veille.lot(job.id as string, { elements: [element] });
    await t.svc.vulnerabilites.veille.terminer(job.id as string, {
      ok: true,
      bilan: { elements: 1, ecartes: 0, tronque: false, detailsEchoues: 0 },
      erreur: null,
    });
    const apres = await alerteDe('CVE-2026-91007');
    expect(apres.id).toBe(s.id);
    const ligne = (await enBase()).find((l) => l.cle === 'CVE-2026-91007')!;
    expect(ligne).toMatchObject({ niveau: 'critique', etat: 'ouverte' });
    const niveau = await audits('vulnerabilites.alerte.niveau');
    expect(niveau).toHaveLength(1);
    expect(niveau[0]!.details).toMatchObject({ avant: 'simple', apres: 'critique', declencheur: 'collecte-cisa-kev' });
    expect((await notifications('vulnerabilites_alerte_critique', `${s.id}:critique`)).length).toBe(6);
    expect(await notifications('vulnerabilites_alerte')).toHaveLength(resumes);
    const f = await fenetre(lecteurA);
    expect(f.alertes.map((a) => a.cve)).toEqual(['CVE-2026-91007']);
    expect(f.enCours).toBe(2);
    // Collecte suivante, mêmes faits : rien de rejoué.
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('cisa-kev', 'manuel', 'test')",
    );
    const job2 = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    await t.svc.vulnerabilites.veille.lot(job2.id as string, { elements: [element] });
    await t.svc.vulnerabilites.veille.terminer(job2.id as string, {
      ok: true,
      bilan: { elements: 1, ecartes: 0, tronque: false, detailsEchoues: 0 },
      erreur: null,
    });
    expect((await notifications('vulnerabilites_alerte_critique', `${s.id}:critique`)).length).toBe(6);
    expect(await audits('vulnerabilites.alerte.niveau')).toHaveLength(1);
  });

  it('clôture automatique avec son motif : faille traitée, alerte simple devenue hors règle, faille disparue', async () => {
    await marquer();
    const notes = (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM grc_notifications'))!.n;
    const c1 = (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = 910001'))!
      .id;
    const s = await admin.get(`${V}/suivis/constat/${c1}`);
    const r = await admin.post(
      `${V}/suivis/constat/${c1}/etat`,
      { etat: 'corrigee', note: '' },
      { 'if-match': s.headers.etag as string },
    );
    expect(r.statusCode, r.body).toBe(200);
    expect((await enBase()).find((l) => l.cle === 'CVE-2026-91001')).toMatchObject({
      etat: 'close',
      motif_cloture: 'traitee',
    });
    // 91008 n'est plus exposée (encore présente en P2 exploitable sur la machine interne) : l'alerte simple se clôt, sous
    // le seuil (décision du RSSI du 18/11/2026).
    const sans8 = surface(['CVE-2026-91002', 'CVE-2026-91007']);
    await synchroniser(alh, sans8, bilanAlh(sans8));
    expect((await enBase()).find((l) => l.cle === 'CVE-2026-91008')).toMatchObject({
      niveau: 'simple',
      etat: 'close',
      motif_cloture: 'sous_le_seuil',
    });
    // 91007 n'est plus exposée ni détectée : la faille n'est plus présente.
    const vide = surface([]);
    await synchroniser(alh, vide, bilanAlh(vide));
    expect((await enBase()).find((l) => l.cle === 'CVE-2026-91007')).toMatchObject({ etat: 'ouverte' });
    await syncTenable(parc(['910007']));
    expect((await enBase()).find((l) => l.cle === 'CVE-2026-91007')).toMatchObject({
      etat: 'close',
      motif_cloture: 'plus_presente',
    });
    const closes = await audits('vulnerabilites.alerte.close');
    expect(closes.map((x) => [x.details.cle, x.details.motif])).toEqual([
      ['CVE-2026-91001', 'traitee'],
      ['CVE-2026-91008', 'sous_le_seuil'],
      ['CVE-2026-91007', 'plus_presente'],
    ]);
    // Une clôture ne notifie personne.
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM grc_notifications'))!.n).toBe(notes);
    const l = await liste(lecteurA, '?etat=close');
    expect(l.map((x) => [x.cve, x.cloture?.motif])).toEqual(
      expect.arrayContaining([
        ['CVE-2026-91001', 'traitee'],
        ['CVE-2026-91008', 'sous_le_seuil'],
        ['CVE-2026-91007', 'plus_presente'],
      ]),
    );
    // Close : plus rien n'est compté ni prenable en compte.
    const close = l.find((x) => x.cve === 'CVE-2026-91007')!;
    expect(close.machines).toEqual({ lisibles: 0, horsLecture: false });
    expect((await rssi.post(`${A}/${close.id}/prise-en-compte`, {}, ifMatch(close.version))).statusCode).toBe(409);
    expect((await fenetre(admin)).enCours).toBe(0);
    // La faille revient : une nouvelle alerte, la précédente reste close. 91008, interne seulement : aucune alerte.
    await syncTenable(parc());
    const toutes = (await enBase()).filter((x) => x.cle === 'CVE-2026-91007');
    expect(toutes.map((x) => x.etat)).toEqual(['close', 'ouverte']);
    expect((await enBase()).filter((x) => x.cle === 'CVE-2026-91008').map((x) => x.etat)).toEqual(['close']);
  });

  it('exposition sur Internet (AlgoLightHouse) : présence exposée, nombres lisibles, aucun domaine ni adresse', async () => {
    await marquer();
    await kev('CVE-2026-91005');
    const el = surface(['CVE-2026-91005']);
    await synchroniser(alh, el, bilanAlh(el));
    const a = (await liste(lecteurA)).find((x) => x.cve === 'CVE-2026-91005')!;
    expect(a).toMatchObject({
      niveau: 'critique',
      presences: ['exposee'],
      priorite: { niveau: 'P1' },
      machines: { lisibles: 0, horsLecture: false },
      // Périmètre ALH non relié : lisible avec administrer seulement ; le lecteur sait seulement qu'il y en a.
      actifs: { lisibles: 0, horsLecture: true },
    });
    expect((await liste(admin)).find((x) => x.cve === 'CVE-2026-91005')!.actifs).toEqual({
      lisibles: 1,
      horsLecture: false,
    });
    expect((await audits('vulnerabilites.alerte.ouverte'))[0]!.details.declencheur).toBe(
      'synchronisation-algolighthouse',
    );
  });

  it('majoration du lot ALH5 : une faille exposée P2 non exploitable n’alerte pas ; menant à une machine vulnérable, elle devient critique', async () => {
    await marquer();
    // CVE critique selon NVD, sans exploitation ni code d'exploitation connu : exposée, P2, non exploitable : aucune alerte.
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_cve (cve, cvss31_gravite, cvss31_score, nvd_le) VALUES ('CVE-2026-91006', 'CRITICAL', 9.8, now())`,
    );
    const el = surface(['CVE-2026-91005', 'CVE-2026-91006']);
    await synchroniser(alh, el, bilanAlh(el));
    expect((await enBase()).some((l) => l.cle === 'CVE-2026-91006')).toBe(false);
    // Liaison confirmée de l'hôte exposé vers la machine 1, qui porte une faille présente en P1 : un cran de plus.
    const actif = (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_actifs WHERE alh_id = $1', [
      U(11),
    ]))!.id;
    const m1 = (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_machines WHERE nom = $1', [
      nomMachine(1),
    ]))!.id;
    const fiche = await admin.get(`${V}/surface/actifs/${actif}/machines`);
    expect(fiche.statusCode, fiche.body).toBe(200);
    const r = await admin.post(
      `${V}/surface/actifs/${actif}/machines`,
      { machineId: m1, note: '' },
      { 'if-match': fiche.headers.etag as string },
    );
    expect(r.statusCode, r.body).toBe(200);
    const a = (await liste(admin)).find((x) => x.cve === 'CVE-2026-91006')!;
    expect(a).toMatchObject({ niveau: 'critique', priorite: { niveau: 'P1' }, presences: ['exposee'] });
    expect(JSON.stringify(a)).toContain('machine_interne_vulnerable');
    const ouvertes = await audits('vulnerabilites.alerte.ouverte');
    expect(ouvertes.map((x) => [x.details.cle, x.details.niveau, x.details.declencheur])).toEqual([
      ['CVE-2026-91006', 'critique', 'liaison-manuelle'],
    ]);
  });

  it('courriel : niveau, CVE, produit et lien pour une critique ; nombre et lien filtré pour le résumé', async () => {
    const g = await admin.get('/api/settings/courriel');
    expect(
      (
        await admin.put(
          '/api/settings/courriel',
          { ...g.json().values, actif: true, hote: 'smtp.exemple.test', port: 587, expediteur: 'suivi@exemple.test' },
          { 'if-match': g.headers.etag as string },
        )
      ).statusCode,
    ).toBe(200);
    const url = '/api/admin/notifications/reglages/role/r_al_lire';
    const r0 = await admin.get(url);
    const r = await admin.put(
      url,
      {
        changements: [
          { type: 'vulnerabilites_alerte_critique', canal: 'courriel', valeur: true },
          { type: 'vulnerabilites_alerte', canal: 'courriel', valeur: true },
        ],
      },
      { 'if-match': (r0.headers.etag as string | undefined) ?? '"0"' },
    );
    expect(r.statusCode, r.body).toBe(200);
    await kev('CVE-2026-91003');
    await syncTenable(parc());
    const nouvelle = await alerteDe('CVE-2026-91003');
    const courriels = async (cle: string) =>
      (
        await t.svc.db.q<{ user_id: string; subject: string; body: string }>(
          `SELECT j.user_id, j.subject, j.body FROM courriel_jobs j JOIN grc_notifications n ON n.id = j.notification_id
           WHERE n.due_key = $1 ORDER BY j.user_id`,
          [cle],
        )
      ).rows;
    const jobs = await courriels(`${nouvelle.id}:critique`);
    // Rôle « lecture » : les deux lecteurs ; les autres n'ont pas choisi le courriel.
    expect(jobs.map((j) => j.user_id).sort()).toEqual([ids.lecteurA, ids.lecteurB].sort());
    for (const j of jobs) {
      expect(j.subject).toContain('Vulnérabilités : alerte critique');
      expect(j.body).toContain('CVE-2026-91003');
      expect(j.body).toContain('Produit fictif');
      expect(j.body).toContain('https://suivi.test/vulnerabilites/alertes');
      sansNom(j.subject + j.body);
    }
    // 91008 de nouveau exposée (P2, exploitable selon Tenable) : une alerte simple, un résumé, sans CVE ni nom.
    const el = surface(['CVE-2026-91005', 'CVE-2026-91006', 'CVE-2026-91008']);
    await synchroniser(alh, el, bilanAlh(el));
    const resume = (await notifications('vulnerabilites_alerte')).at(-1)!;
    expect(resume.title).toBe('Vulnérabilités : 1 nouvelle alerte');
    const jobsResume = await courriels(resume.due_key);
    expect(jobsResume.map((j) => j.user_id).sort()).toEqual([ids.lecteurA, ids.lecteurB].sort());
    for (const j of jobsResume) {
      expect(j.subject).toContain('Vulnérabilités : alerte');
      expect(j.body).toContain('Vulnérabilités : 1 nouvelle alerte');
      expect(j.body).toContain('https://suivi.test/vulnerabilites/alertes?niveau=simple&etat=ouverte');
      expect(j.body).not.toContain('CVE-');
      sansNom(j.subject + j.body);
    }
  });

  it('une évaluation en échec ne fait pas échouer la synchronisation', async () => {
    await marquer();
    const espion = vi
      .spyOn(t.svc.vulnerabilites.alertes as unknown as { calculer: () => Promise<unknown> }, 'calculer')
      .mockRejectedValueOnce(new Error('panne fictive'));
    await kev('CVE-2026-91010');
    const el = [...parc(), constat('910010', ['CVE-2026-91010'], 'faible'), detection('910010', 1)];
    await syncTenable(el);
    expect(espion).toHaveBeenCalledTimes(1);
    espion.mockRestore();
    const s = await t.svc.db.one<{ complete: boolean }>(
      'SELECT complete FROM vulnerabilites_synchronisations ORDER BY numero DESC LIMIT 1',
    );
    expect(s!.complete).toBe(true);
    expect((await enBase()).some((l) => l.cle === 'CVE-2026-91010')).toBe(false);
    // L'évaluation suivante rattrape.
    await syncTenable(el);
    expect((await enBase()).some((l) => l.cle === 'CVE-2026-91010' && l.niveau === 'critique')).toBe(true);
  });

  it('module désactivé : rien n’est créé, rien n’est affiché, aucune notification', async () => {
    const avant = await enBase();
    const notes = (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM grc_notifications'))!.n;
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      await kev('CVE-2026-91011');
      expect(await t.svc.vulnerabilites.alertes.evaluer('essai')).toBeNull();
      await t.svc.db.q(
        `INSERT INTO vulnerabilites_constats (integration_id, plugin_id, nom, gravite, exploitable, vu_numero)
         VALUES ($1, 910011, 'Contrôle fictif', 'faible', false, 999)`,
        [tenable],
      );
      expect(await t.svc.vulnerabilites.alertes.evaluer('essai')).toBeNull();
      expect(await enBase()).toEqual(avant);
      expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM grc_notifications'))!.n).toBe(notes);
      expect([403, 409]).toContain((await admin.get(`${A}/fenetre`)).statusCode);
      expect([403, 409]).toContain((await lecteurA.get(A)).statusCode);
      // L'administrateur garde ses rappels, sans ceux du module désactivé (le lecteur, sans autre module, n'en a plus).
      const r = await admin.get('/api/grc/notifications');
      expect(r.statusCode, r.body).toBe(200);
      expect((r.json() as { kind: string }[]).filter((x) => x.kind.startsWith('vulnerabilites_'))).toEqual([]);
      expect(
        (await t.svc.db.one<{ n: number }>(
          "SELECT count(*)::int AS n FROM grc_notifications WHERE user_id = $1 AND kind LIKE 'vulnerabilites_%'",
          [ids.admin],
        ))!.n,
      ).toBeGreaterThan(0);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });

  it('base : une seule alerte ouverte par faille, clé contrôlée, états cohérents', async () => {
    const refus = async (texte: string, p: unknown[] = []) => {
      await expect(t.svc.db.q(texte, p)).rejects.toThrow();
    };
    const faits = JSON.stringify({ priorite: { niveau: 'P1', faits: [] } });
    await refus(
      `INSERT INTO vulnerabilites_alertes (cle, cve, niveau, priorite, titre, faits, empreinte, critique_le)
       VALUES ('CVE-2026-91001', 'CVE-2026-91001', 'critique', 'P1', 'x', $1, 'e', now()),
              ('CVE-2026-91001', 'CVE-2026-91001', 'critique', 'P1', 'x', $1, 'e', now())`,
      [faits],
    );
    await refus(
      `INSERT INTO vulnerabilites_alertes (cle, niveau, priorite, titre, faits, empreinte)
       VALUES ('srv-alerte-01', 'simple', 'P2', 'x', $1, 'e')`,
      [faits],
    );
    await refus(
      `INSERT INTO vulnerabilites_alertes (cle, cve, niveau, priorite, titre, faits, empreinte, etat)
       VALUES ('CVE-2026-99999', 'CVE-2026-99999', 'simple', 'P2', 'x', $1, 'e', 'prise_en_compte')`,
      [faits],
    );
    await refus(
      `INSERT INTO vulnerabilites_alertes (cle, cve, niveau, priorite, titre, faits, empreinte)
       VALUES ('CVE-2026-99998', 'CVE-2026-99998', 'critique', 'P1', 'x', $1, 'e')`,
      [faits],
    );
  });
});
