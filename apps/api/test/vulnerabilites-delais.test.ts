/* Module Vulnérabilités (ADR 0100, lot S1) : délais de correction et exceptions à échéance. Migration 087 sur base vierge ;
   délais réglés avec les seuils de priorité (administrer, If-Match, journal, saisie partielle) ; âge, échéance et état de
   délai dans les listes (filtre « en dépassement », tri par échéance), les mêmes pour deux personnes ; tuile « En
   dépassement » ; exceptions réservées au rôle RSSI (403 sinon, administrateur compris), justification, mesure
   compensatoire et échéance obligatoires (douze mois au plus) ; rappel, expiration, retour à l'état d'avant, délai reparti,
   historique et journal sans nom ; résumés notifiés sans nom ; exception ancienne sans échéance ; mesure des corrections ;
   non-fuite des exceptions des failles illisibles ; module désactivé. Données entièrement fictives : noms en .invalid,
   adresses de 192.0.2.0/24, contrôles et CVE fictifs ; aucun service n'est joint. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, rssi: Agent, editeurA: Agent, lecteurA: Agent, lecteurB: Agent;
let perimA: string, perimB: string, instance: string;
const ids: Record<string, string> = {};

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const jour = (n: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() + n * 86_400_000));
const ANCIENNE = '2026-07-18T01:05:01.000Z';
const RECENTE = new Date(Date.now() - 3_600_000).toISOString();
const MESURE = 'Mesure compensatoire fictive : flux filtré.';
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000007${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-delai-${String(n).padStart(2, '0')}.exemple.invalid`;
const adresse = (n: number) => `192.0.2.${120 + n}`;
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
  nom: `Exemple Linux : contrôle de délai fictif ${plugin}`,
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
  cves: [`CVE-2026-8${plugin.slice(-4)}`],
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
/** Machine 1 dans le périmètre A, 2 dans B. 960001 critique ancienne (P2, en dépassement) ; 960002 élevée récente (P3, dans
    les délais) ; 960003 moyenne ancienne (P4, sans délai) ; 960004 critique ancienne sur la machine 2 seulement. */
const parc = () => [
  machine(1),
  machine(2),
  constat('960001', 'critique'),
  constat('960002', 'elevee'),
  constat('960003', 'moyenne'),
  constat('960004', 'critique'),
  detection('960001', 1, ANCIENNE),
  detection('960002', 1, RECENTE),
  detection('960003', 1, ANCIENNE),
  detection('960004', 2, ANCIENNE),
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
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; details: Record<string, unknown> }>(
      'SELECT username, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
const notifications = async (kind: string) =>
  (
    await t.svc.db.q<{ user_id: string; title: string; message: string; due_key: string }>(
      'SELECT user_id, title, message, due_key FROM grc_notifications WHERE kind = $1 ORDER BY created_at, user_id',
      [kind],
    )
  ).rows;
/** Aucun nom ni adresse de machine, ni CVE, dans un texte (notification, journal). */
const sansNom = (texte: string) => {
  for (const k of [1, 2]) {
    expect(texte).not.toContain(nomMachine(k));
    expect(texte).not.toContain(adresse(k));
  }
  expect(texte).not.toContain('srv-delai');
  expect(texte).not.toContain('CVE-2026-8');
};
type Delai = {
  etat: string;
  priorite: string;
  echeance: string | null;
  premiere: string | null;
  depuis: string | null;
};
type Ligne = { plugin: string; delai: Delai; suivi: { etat: string; exceptionStatut: string | null; version: number } };
const constats = async (a: Agent, q = '') => {
  const r = await a.get(`${V}/constats${q}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json().elements as Ligne[];
};
const ligne = async (a: Agent, plugin: string, q = '?etat=tous') =>
  (await constats(a, q)).find((c) => c.plugin === plugin)!;
const version = async (plugin: string) =>
  ((await rssi.get(`${V}/suivis/constat/${await constatId(plugin)}`)).json() as { version: number }).version;
const etat = async (a: Agent, plugin: string, corps: unknown) =>
  a.post(`${V}/suivis/constat/${await constatId(plugin)}/etat`, corps, ifMatch(await version(plugin)));
const exception = (echeance: string, note = 'Équipement fictif non corrigeable.') => ({
  etat: 'risque_accepte',
  note,
  mesure: MESURE,
  revueLe: echeance,
});
type VueDelais = {
  exceptions: {
    objetId: string;
    statut: string;
    justification: string | null;
    mesure: string | null;
    par: string | null;
  }[];
  compteurs: Record<string, number>;
  mesures: {
    total: { nombre: number; dansLesDelais: number; taux: number | null };
    parPriorite: { priorite: string; nombre: number }[];
  };
  nonMesurees: number;
  peutDeciderException: boolean;
};
const delais = async (a: Agent, q = '') => {
  const r = await a.get(`${V}/delais${q}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as VueDelais;
};

beforeAll(async () => {
  t = await createTestApp();
  const uAdmin = await makeUser(t, 'dl_admin', 'admin');
  admin = await login(t, uAdmin);
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_dl_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire','ecarts:lire']),
       ('r_dl_modif', 'Vulnérabilités, modification', ARRAY['vulnerabilites:lire','vulnerabilites:modifier','ecarts:lire'])`,
  );
  const perimetre = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'x', timezone: 'Europe/Paris' })).json().id as string;
  perimA = await perimetre('Périmètre délais A');
  perimB = await perimetre('Périmètre délais B');
  const u = {
    rssi: await makeUser(t, 'dl_rssi', 'rssi', { rattache: false }),
    editeurA: await makeUser(t, 'dl_editeur_a', 'r_dl_modif', { rattache: false }),
    lecteurA: await makeUser(t, 'dl_lecteur_a', 'r_dl_lire', { rattache: false }),
    lecteurB: await makeUser(t, 'dl_lecteur_b', 'r_dl_lire', { rattache: false }),
  };
  ids.admin = uAdmin.id;
  for (const [k, v] of Object.entries(u)) ids[k] = v.id;
  await t.svc.db.q(
    `INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, true), ($2, $3, true), ($1, $4, true),
       ($1, $5, false), ($2, $6, false)`,
    [perimA, perimB, u.rssi.id, u.editeurA.id, u.lecteurA.id, u.lecteurB.id],
  );
  rssi = await login(t, u.rssi);
  editeurA = await login(t, u.editeurA);
  lecteurA = await login(t, u.lecteurA);
  lecteurB = await login(t, u.lecteurB);
  const r = await admin.post('/api/integrations/instances', {
    type: 'tenable',
    nom: 'Tenable fictif délais',
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

describe('migration 087 sur base vierge', () => {
  it('ajoute les colonnes, la table des dépassements, l’événement « expiration » et deux types de notification', async () => {
    expect(
      (
        await t.svc.db.one(
          "SELECT 1 AS ok FROM schema_migrations WHERE name = '087_vulnerabilites_delais_exceptions.sql'",
        )
      )?.ok,
    ).toBe(1);
    expect(await n('vulnerabilites_depassements')).toBe(0);
    const c = await constatId('960003');
    const refus = (q: string, p: unknown[] = []) => expect(t.svc.db.q(q, p)).rejects.toThrow();
    // Les champs d'une exception sont vides hors risque accepté ; mesure bornée.
    await refus(
      "INSERT INTO vulnerabilites_suivis (nature, constat_id, etat, exception_mesure) VALUES ('constat', $1, 'en_cours', 'x')",
      [c],
    );
    await refus(
      "INSERT INTO vulnerabilites_suivis (nature, constat_id, etat, revue_le, exception_mesure) VALUES ('constat', $1, 'risque_accepte', '2027-01-01', '')",
      [c],
    );
    await refus(
      "INSERT INTO vulnerabilites_depassements (nature, objet_id, priorite, echeance) VALUES ('x', $1, 'P1', now())",
      [c],
    );
    // L'historique admet l'expiration, reste en ajout seul.
    const fictif = '00000000-0000-4000-8000-0000000007ff';
    const h = await t.svc.db.one<{ id: string }>(
      `INSERT INTO vulnerabilites_suivi_historique (nature, objet_id, evenement, etat_avant, etat_apres, auteur)
       VALUES ('constat', $1, 'expiration', 'risque_accepte', 'a_traiter', 'test') RETURNING id`,
      [fictif],
    );
    await expect(
      t.svc.db.q("UPDATE vulnerabilites_suivi_historique SET mesure = 'x' WHERE id = $1", [h!.id]),
    ).rejects.toThrow(/ajout seul/);
    await refus(
      `INSERT INTO grc_notifications (smsi_id, object_id, user_id, kind, due_key, title, message)
       VALUES (NULL, NULL, $1, 'vulnerabilites_inconnu', 'x', 'x', 'x')`,
      [ids.admin],
    );
  });
});

describe('délais réglés avec les seuils de priorité', () => {
  it('valeurs par défaut ; administrer, If-Match, journal ; saisie partielle ; bornes', async () => {
    const url = `${V}/priorite/reglage`;
    const lu = (await lecteurA.get(url)).json();
    expect(lu.values.delais).toEqual({
      P1: { duree: 48, unite: 'heures' },
      P2: { duree: 15, unite: 'jours' },
      P3: { duree: 90, unite: 'jours' },
      P4: null,
    });
    const delais = { ...lu.values.delais, P3: { duree: 60, unite: 'jours' } };
    expect((await editeurA.put(url, { delais }, ifMatch(lu.version))).statusCode).toBe(403);
    expect((await admin.put(url, { delais })).statusCode).toBe(428);
    expect(
      (await admin.put(url, { delais: { ...delais, P2: { duree: 0, unite: 'jours' } } }, ifMatch(0))).statusCode,
    ).toBe(422);
    expect(
      (await admin.put(url, { delais: { ...delais, P2: { duree: 366, unite: 'jours' } } }, ifMatch(0))).statusCode,
    ).toBe(422);
    expect((await admin.put(url, {}, ifMatch(0))).statusCode).toBe(422);
    const ok = await admin.put(url, { delais }, ifMatch(lu.version));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().values).toEqual({ seuilEpss: 0.5, delais });
    expect((await admin.put(url, { delais }, ifMatch(lu.version))).statusCode).toBe(412);
    expect((await audits('vulnerabilites.priorite.reglage_modifie')).at(-1)?.details).toMatchObject({
      apres: { delais: { P3: { duree: 60, unite: 'jours' } } },
    });
    // Retour aux valeurs par défaut pour la suite.
    const remis = await admin.put(url, { delais: lu.values.delais }, ifMatch(ok.json().version));
    expect(remis.statusCode, remis.body).toBe(200);
  });
});

describe('âge, échéance et état dans les listes', () => {
  it('états calculés ; filtre « en dépassement » ; tri par échéance ; les mêmes pour deux personnes', async () => {
    const l1 = await ligne(lecteurA, '960001');
    expect(l1.delai).toMatchObject({ etat: 'en_depassement', priorite: 'P2', premiere: ANCIENNE, depuis: ANCIENNE });
    expect(l1.delai.echeance).toBe(new Date(Date.parse(ANCIENNE) + 15 * 86_400_000).toISOString());
    expect((await ligne(lecteurA, '960002')).delai).toMatchObject({ etat: 'dans_les_delais', priorite: 'P3' });
    expect((await ligne(lecteurA, '960003')).delai).toMatchObject({
      etat: 'sans_delai',
      priorite: 'P4',
      echeance: null,
    });
    // Même délai pour deux personnes qui lisent la faille.
    expect((await ligne(rssi, '960001')).delai).toEqual(l1.delai);
    // Filtre : seules les failles lisibles, en dépassement.
    expect((await constats(lecteurA, '?delai=en_depassement')).map((c) => c.plugin)).toEqual(['960001']);
    expect((await constats(rssi, '?delai=en_depassement')).map((c) => c.plugin).sort()).toEqual(['960001', '960004']);
    expect((await lecteurA.get(`${V}/constats?delai=inconnu`)).statusCode).toBe(422);
    // Tri par échéance : la plus proche d'abord, sans délai à la fin.
    expect((await constats(lecteurA, '?tri=echeance')).map((c) => c.plugin)).toEqual(['960001', '960002', '960003']);
    // Tuile « En dépassement » de la vue d'ensemble : la même pour tout le monde.
    const v1 = (await lecteurA.get(`${V}/vue-ensemble`)).json();
    const v2 = (await lecteurB.get(`${V}/vue-ensemble`)).json();
    expect(v1.tuiles.enDepassement).toBe(2);
    expect(v2.tuiles.enDepassement).toBe(2);
    // Fiche illustrée : le délai du constat.
    const f = (await lecteurA.get(`${V}/fiches/constat/${await constatId('960001')}`)).json();
    expect(f.delai).toEqual(l1.delai);
    expect(f.exception).toBeNull();
  });

  it('dépassements signalés : un résumé par évaluation, sans nom, aux lecteurs du module ; pas de second signal', async () => {
    const b = await t.svc.vulnerabilites.delais.evaluer();
    expect(b).toMatchObject({ enDepassement: 2, nouveaux: 2, expirees: 0 });
    const notes = await notifications('vulnerabilites_delais');
    expect(new Set(notes.map((x) => x.user_id))).toEqual(
      new Set([ids.admin, ids.rssi, ids.editeurA, ids.lecteurA, ids.lecteurB]),
    );
    expect(new Set(notes.map((x) => x.title))).toEqual(new Set(['Vulnérabilités : 2 failles en dépassement de délai']));
    for (const x of notes) sansNom(`${x.title} ${x.message}`);
    expect(await n('vulnerabilites_depassements')).toBe(2);
    expect(await t.svc.vulnerabilites.delais.evaluer()).toMatchObject({ nouveaux: 0, notifiees: 0 });
    expect(await notifications('vulnerabilites_delais')).toHaveLength(notes.length);
    // Journal : nombres seulement.
    const j = await audits('vulnerabilites.delais.evalues');
    expect(j.at(-1)?.details).toEqual({ enDepassement: 2, nouveaux: 2, sortis: 0 });
    for (const x of j) sansNom(JSON.stringify(x));
    // « Mes rappels » : lien vers la liste filtrée.
    const rappels = (await editeurA.get('/api/grc/notifications')).json() as { kind: string; lien?: string }[];
    expect(rappels.find((x) => x.kind === 'vulnerabilites_delais')?.lien).toBe(
      '/vulnerabilites/failles?delai=en_depassement',
    );
  });
});

describe('exceptions', () => {
  it('réservées au rôle RSSI ; justification, mesure et échéance obligatoires, douze mois au plus', async () => {
    expect((await etat(editeurA, '960001', { etat: 'en_cours' })).statusCode).toBe(200);
    for (const a of [editeurA, admin]) {
      const r = await etat(a, '960001', exception(jour(30)));
      expect(r.statusCode).toBe(403);
      expect(r.json().error).toBe('Seul le RSSI peut accorder, prolonger ou lever une exception (risque accepté).');
    }
    expect((await etat(rssi, '960001', { etat: 'risque_accepte', note: 'x', revueLe: jour(30) })).statusCode).toBe(422);
    expect((await etat(rssi, '960001', { etat: 'risque_accepte', note: 'x', mesure: MESURE })).statusCode).toBe(422);
    expect((await etat(rssi, '960001', exception(jour(400)))).statusCode).toBe(422);
    expect((await etat(rssi, '960001', exception(jour(-1)))).statusCode).toBe(422);
    const r = await etat(rssi, '960001', exception(jour(60)));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      etat: 'risque_accepte',
      revueLe: jour(60),
      exceptionStatut: 'en_cours',
      peutDeciderException: true,
      exception: { statut: 'en_cours', echeance: jour(60), mesure: MESURE, par: 'Nom dl_rssi' },
    });
    expect((await editeurA.get(`${V}/suivis/constat/${await constatId('960001')}`)).json().peutDeciderException).toBe(
      false,
    );
    // Sous exception : plus en dépassement, ni dans la tuile.
    expect((await ligne(lecteurA, '960001')).delai.etat).toBe('sous_exception');
    expect((await lecteurA.get(`${V}/vue-ensemble`)).json().tuiles.enDepassement).toBe(1);
    expect((await t.svc.vulnerabilites.delais.evaluer())?.enDepassement).toBe(1);
  });

  it('onglet « Délais et exceptions » : exceptions des seules failles lues, mesures communes', async () => {
    const a = await delais(lecteurA);
    expect(a.exceptions).toHaveLength(1);
    expect(a.exceptions[0]).toMatchObject({
      objetId: await constatId('960001'),
      statut: 'en_cours',
      justification: 'Équipement fictif non corrigeable.',
      mesure: MESURE,
      par: 'Nom dl_rssi',
    });
    expect(a.peutDeciderException).toBe(false);
    // Le lecteur du périmètre B ne lit pas la machine touchée : rien de l'exception.
    const b = await delais(lecteurB);
    expect(b.exceptions).toEqual([]);
    expect(JSON.stringify(b)).not.toContain('Équipement fictif');
    expect(b.mesures).toEqual(a.mesures);
    expect((await delais(rssi)).peutDeciderException).toBe(true);
    expect((await lecteurA.get(`${V}/delais?periode=12`)).statusCode).toBe(422);
  });

  it('rappel avant l’échéance : une fois par exception, résumé sans nom', async () => {
    expect((await etat(rssi, '960004', exception(jour(10)))).statusCode).toBe(200);
    expect((await ligne(rssi, '960004')).suivi.exceptionStatut).toBe('bientot_echue');
    const b = await t.svc.vulnerabilites.delais.evaluer();
    expect(b).toMatchObject({ rappels: 1, expirees: 0 });
    const notes = await notifications('vulnerabilites_exceptions');
    expect(new Set(notes.map((x) => x.title))).toEqual(
      new Set(['Vulnérabilités : 1 exception à échéance sous 14 jours']),
    );
    for (const x of notes) sansNom(`${x.title} ${x.message}`);
    expect((await t.svc.vulnerabilites.delais.evaluer())?.rappels).toBe(0);
    expect(await notifications('vulnerabilites_exceptions')).toHaveLength(notes.length);
    for (const x of await audits('vulnerabilites.exceptions.rappel')) sansNom(JSON.stringify(x));
  });

  it('expiration : retour à l’état d’avant, délai reparti, historique, journal et résumé sans nom', async () => {
    const id = await constatId('960001');
    await t.svc.db.q('UPDATE vulnerabilites_suivis SET revue_le = $2 WHERE constat_id = $1', [id, jour(-1)]);
    expect((await ligne(lecteurA, '960001')).suivi.exceptionStatut).toBe('echue');
    const avant = (await notifications('vulnerabilites_exceptions')).length;
    const b = await t.svc.vulnerabilites.delais.evaluer();
    expect(b).toMatchObject({ expirees: 1 });
    const s = (await rssi.get(`${V}/suivis/constat/${id}`)).json();
    expect(s).toMatchObject({ etat: 'en_cours', revueLe: null, exception: null });
    expect(s.historique[0]).toMatchObject({
      evenement: 'expiration',
      etatAvant: 'risque_accepte',
      etatApres: 'en_cours',
      auteur: 'système',
      revueLe: jour(-1),
    });
    // Le délai repart de l'expiration : la faille n'est plus en dépassement.
    const l = await ligne(lecteurA, '960001');
    expect(l.delai.etat).toBe('dans_les_delais');
    expect(Date.parse(l.delai.depuis!)).toBeGreaterThan(Date.now() - 60_000);
    expect(l.delai.premiere).toBe(ANCIENNE);
    const notes = (await notifications('vulnerabilites_exceptions')).slice(avant);
    expect(new Set(notes.map((x) => x.title))).toEqual(new Set(['Vulnérabilités : 1 exception échue']));
    const j = await audits('vulnerabilites.exceptions.echues');
    expect(j).toHaveLength(1);
    expect(j[0]!.details).toMatchObject({ nombre: 1, objets: [{ nature: 'constat', objet: id }] });
    for (const x of j) sansNom(JSON.stringify(x));
    // L'onglet garde l'exception échue, avec sa justification.
    const v = await delais(lecteurA);
    expect(v.exceptions.find((x) => x.objetId === id)).toMatchObject({
      statut: 'echue',
      justification: 'Équipement fictif non corrigeable.',
      mesure: MESURE,
    });
    expect(v.compteurs.echue).toBe(1);
  });

  it('exception enregistrée avant le lot, sans échéance : reste valide, signalée « à compléter »', async () => {
    const id = await constatId('960003');
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_suivis (nature, constat_id, etat, version) VALUES ('constat', $1, 'risque_accepte', 1)",
      [id],
    );
    await t.svc.vulnerabilites.delais.evaluer();
    expect((await ligne(lecteurA, '960003')).suivi).toMatchObject({
      etat: 'risque_accepte',
      exceptionStatut: 'sans_echeance',
    });
    expect((await delais(lecteurA)).exceptions.find((x) => x.objetId === id)?.statut).toBe('sans_echeance');
  });
});

describe('mesure des corrections', () => {
  it('priorité et délai relevés à la décision « corrigée » ; moyenne, médiane, part dans les délais', async () => {
    const avant = await delais(lecteurA, '?periode=30');
    expect(avant.mesures.total.nombre).toBe(0);
    expect((await etat(editeurA, '960002', { etat: 'corrigee' })).statusCode).toBe(200);
    const h = await t.svc.db.one<{ priorite: string; delai_echeance: Date | null }>(
      `SELECT priorite, delai_echeance FROM vulnerabilites_suivi_historique
       WHERE objet_id = $1 AND etat_apres = 'corrigee'`,
      [await constatId('960002')],
    );
    expect(h?.priorite).toBe('P3');
    expect(h?.delai_echeance).not.toBeNull();
    const a = await delais(lecteurA, '?periode=30');
    expect(a.mesures.total).toMatchObject({ nombre: 1, dansLesDelais: 1, taux: 1 });
    expect(a.mesures.parPriorite.find((x) => x.priorite === 'P3')?.nombre).toBe(1);
    expect((await delais(lecteurB, '?periode=30')).mesures).toEqual(a.mesures);
  });
});

describe('module désactivé', () => {
  it('rien n’est évalué ni notifié ; la route est fermée', async () => {
    const notes = await n('grc_notifications');
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      await t.svc.db.q('UPDATE vulnerabilites_suivis SET revue_le = $1 WHERE etat = $2 AND revue_le IS NOT NULL', [
        jour(-1),
        'risque_accepte',
      ]);
      expect(await t.svc.vulnerabilites.delais.evaluer()).toBeNull();
      expect(await n('vulnerabilites_suivis', "etat = 'risque_accepte' AND revue_le IS NOT NULL")).toBe(1);
      expect(await n('grc_notifications')).toBe(notes);
      expect([403, 409]).toContain((await lecteurA.get(`${V}/delais`)).statusCode);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });
});
