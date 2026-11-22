/* Module Vulnérabilités (ADR 0100, lot TEN-SCORES ; décision du RSSI du 22/11/2026) : criticité (ACR) et exposition (AES)
   des machines selon Tenable Security Center. Migration 100 (colonne `aes`, 0 à 1000, NULL permis) ; AES rangé et rendu
   comme l'ACR (valeur non fournie : la valeur rangée reste) ; élément hors bornes refusé ; élément sans AES (script plus
   ancien) accepté ; filtres par catégorie minimale d'ACR et d'AES sur la liste et sur le parc, avec les droits du
   périmètre (lecteur d'un seul périmètre), machine sans valeur exclue, rang inchangé ; présence d'une instance Tenable
   (route de l'état des synchronisations, lecture du module seulement) ; import Nessus sans ACR ni AES. Données entièrement
   fictives : noms en .invalid et .example.org, adresses de 192.0.2.0/24 ; aucun service n'est joint. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const I = '/api/integrations';
let t: TestApp;
let admin: Agent, lecteurA: Agent;
let perimA: string,
  perimB: string,
  nessus: string,
  tenable: string | null = null;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000000${(0xa0 + n).toString(16)}`;
const cleTenable = (n: number) => `uuid:${uuidMachine(n)}`;
/** Machine de Security Center ; `aes` absent : élément d'un script antérieur au lot. */
const machine = (n: number, acr: number | null, aes?: number | null) => ({
  type: 'machine',
  cle: cleTenable(n),
  uuid: uuidMachine(n),
  nom: `srv-score-${String(n).padStart(2, '0')}.exemple.invalid`,
  adresse: `192.0.2.${40 + n}`,
  systeme: 'Linux Kernel 5.14 on Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr,
  ...(aes === undefined ? {} : { aes }),
});

/** Synchronisation fictive de Security Center par le service (inscrite, réclamée, un lot, terminée). */
async function synchroniser(elements: Record<string, unknown>[]) {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par, etat, debute_le) VALUES ($1, 'synchroniser', 'manuel', 'test', 'en_cours', now())",
    [tenable],
  );
  const job = (await t.svc.db.one<{ id: string }>(
    "SELECT id FROM integration_executions WHERE integration_id = $1 AND etat = 'en_cours'",
    [tenable],
  ))!.id;
  await t.svc.vulnerabilites.tenable.reclamee(t.svc.db.k, job, tenable!);
  await t.svc.integrations.lot(job, elements);
  await t.svc.integrations.terminer(job, {
    ok: true,
    resultat: {
      elements: elements.length,
      pages: 1,
      constats: 0,
      detections: 0,
      machines: elements.length,
      hotes: 0,
      ecartes: 0,
      tronque: false,
      inventaire: { ok: true, erreur: null },
    },
    erreur: null,
  });
}
const placer = (n: number, perimetre: string) =>
  t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE identifiant_source = $1', [
    cleTenable(n),
    perimetre,
  ]);
const enBase = async () =>
  (
    await t.svc.db.q<{ cle: string; acr: string | null; aes: number | null }>(
      'SELECT identifiant_source AS cle, acr, aes FROM vulnerabilites_machines ORDER BY identifiant_source',
    )
  ).rows.map((r) => [r.cle.slice(-2), r.acr === null ? null : Number(r.acr), r.aes]);
type Rendue = { nom: string; acr: number | null; aes: number | null; rang: { total: number } };
const noms = (l: Rendue[]) => l.map((m) => m.nom.slice(10, 12)).sort();
async function liste(qui: Agent, filtres = '') {
  const r = await qui.get(`${V}/machines${filtres}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as { total: number; elements: Rendue[] };
}

/** Parc fictif : 1 (ACR 9, AES 700), 2 (7, 400), 3 (4, 100), 4 (aucune valeur, élément sans AES) au périmètre A ; 5 (10,
    900) au périmètre B. */
async function parcFictif() {
  await synchroniser([
    machine(1, 9, 700),
    machine(2, 7, 400),
    machine(3, 4, 100),
    machine(4, null),
    machine(5, 10, 900),
  ]);
  for (const n of [1, 2, 3, 4]) await placer(n, perimA);
  await placer(5, perimB);
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'scores_admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_sc_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])",
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const u = await makeUser(t, 'scores_lecteur_a', 'r_sc_lire', { rattache: false });
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false)', [perimA, u.id]);
  lecteurA = await login(t, u);
  // Seule instance au départ : un connecteur d'import Nessus (pas une intégration Tenable Security Center).
  const r = await admin.post(`${I}/instances`, { type: 'nessus-fichier', nom: 'Nessus fictif', configuration: {} });
  expect(r.statusCode, r.body).toBe(201);
  nessus = r.json().id as string;
  const a = await admin.put(`${I}/instances/${nessus}/activation`, { actif: true }, ifMatch(r.json().version));
  expect(a.statusCode, a.body).toBe(200);
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  for (const table of [
    'vulnerabilites_alertes',
    'vulnerabilites_suivis',
    'vulnerabilites_detections',
    'vulnerabilites_constat_cves',
    'vulnerabilites_constats',
    'vulnerabilites_machines',
    'vulnerabilites_imports',
    'vulnerabilites_synchronisations',
    'vulnerabilites_tenable_etat',
    'integration_executions',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  t.svc.limits.importNessus.reset();
  t.svc.limits.importNessusLot.reset();
});

describe('migration 100', () => {
  it('ajoute la colonne aes, entier de 0 à 1000, NULL permis', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '100_vulnerabilites_machines_aes.sql'"))
        ?.ok,
    ).toBe(1);
    const m = `INSERT INTO vulnerabilites_machines (integration_id, source, identifiant_source, vu_numero, aes)
               VALUES ($1, 'nessus-fichier', $2, 1, $3)`;
    for (const v of [1001, -1])
      await expect(t.svc.db.q(m, [nessus, `ip:192.0.2.${v > 0 ? 1 : 2}`, v])).rejects.toThrow();
    for (const [i, v] of [null, 0, 1000].entries()) await t.svc.db.q(m, [nessus, `ip:192.0.2.${10 + i}`, v]);
    expect(
      (await t.svc.db.q<{ aes: number | null }>('SELECT aes FROM vulnerabilites_machines ORDER BY aes NULLS FIRST'))
        .rows,
    ).toEqual([{ aes: null }, { aes: 0 }, { aes: 1000 }]);
  });
});

describe('instance Tenable configurée (affichage de l’ACR et de l’AES)', () => {
  it('sans instance Tenable (import Nessus seul) : aucun état de synchronisation, lu avec la seule lecture du module', async () => {
    const r = await lecteurA.get(`${V}/synchronisation`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual([]);
  });
  it('avec une instance Tenable, même inactive et sans clé : un état, lu avec la seule lecture du module', async () => {
    const r = await admin.post(`${I}/instances`, {
      type: 'tenable',
      nom: 'Tenable fictif',
      configuration: { adresse: 'https://tenable.exemple.invalid' },
    });
    expect(r.statusCode, r.body).toBe(201);
    tenable = r.json().id as string;
    const e = await lecteurA.get(`${V}/synchronisation`);
    expect(e.statusCode, e.body).toBe(200);
    expect((e.json() as { integrationId: string; nom: string }[]).map((x) => [x.integrationId, x.nom])).toEqual([
      [tenable, 'Tenable fictif'],
    ]);
    // Les filtres sont acceptés quelle que soit l'instance : sans machine, résultat vide.
    const f = await liste(lecteurA, '?acr=critique&aes=elevee');
    expect(f).toMatchObject({ total: 0, elements: [] });
  });
});

describe('rangement et rendu', () => {
  it('AES rangé et rendu comme l’ACR ; valeur absente : null, jamais 0', async () => {
    expect(tenable).not.toBeNull();
    await parcFictif();
    expect(await enBase()).toEqual([
      ['a1', 9, 700],
      ['a2', 7, 400],
      ['a3', 4, 100],
      ['a4', null, null],
      ['a5', 10, 900],
    ]);
    const tout = await liste(admin);
    expect(Object.fromEntries(tout.elements.map((m) => [m.nom.slice(10, 12), [m.acr, m.aes]]))).toEqual({
      '01': [9, 700],
      '02': [7, 400],
      '03': [4, 100],
      '04': [null, null],
      '05': [10, 900],
    });
    // Fiche d'une machine : mêmes valeurs.
    const id = (await t.svc.db.one<{ id: string }>(
      'SELECT id FROM vulnerabilites_machines WHERE identifiant_source = $1',
      [cleTenable(1)],
    ))!.id;
    const f = await lecteurA.get(`${V}/machines/${id}`);
    expect(f.statusCode, f.body).toBe(200);
    expect(f.json()).toMatchObject({ acr: 9, aes: 700 });
  });

  it('valeur non fournie à la synchronisation suivante : la valeur rangée reste (même règle que l’ACR) ; nouvelle valeur : remplacée', async () => {
    await parcFictif();
    await synchroniser([machine(1, null, null), machine(2, null), machine(3, 5, 120)]);
    expect((await enBase()).slice(0, 3)).toEqual([
      ['a1', 9, 700],
      ['a2', 7, 400],
      ['a3', 5, 120],
    ]);
  });

  it('élément hors bornes, décimal ou de mauvais type : lot refusé, rien n’est rangé', async () => {
    await synchroniser([machine(1, 9, 700)]);
    for (const aes of [1001, -1, 12.5, '650']) {
      await t.svc.db.q(
        "INSERT INTO integration_executions (integration_id, operation, origine, demande_par, etat, debute_le) VALUES ($1, 'synchroniser', 'manuel', 'test', 'en_cours', now())",
        [tenable],
      );
      const job = (await t.svc.db.one<{ id: string }>(
        "SELECT id FROM integration_executions WHERE integration_id = $1 AND etat = 'en_cours'",
        [tenable],
      ))!.id;
      await t.svc.vulnerabilites.tenable.reclamee(t.svc.db.k, job, tenable!);
      await expect(t.svc.integrations.lot(job, [{ ...machine(2, 7), aes }])).rejects.toMatchObject({ status: 422 });
      await t.svc.db.q(
        "UPDATE integration_executions SET etat = 'echec', termine_le = now(), erreur = 'Lot refusé (essai).' WHERE id = $1",
        [job],
      );
    }
    expect(await enBase()).toEqual([['a1', 9, 700]]);
  });
});

describe('filtres par catégorie minimale', () => {
  it('ACR et AES, avec les droits du périmètre ; machine sans valeur exclue ; rang inchangé', async () => {
    await parcFictif();
    // Lecteur du seul périmètre A : machines 1 à 4.
    const base = await liste(lecteurA);
    expect(noms(base.elements)).toEqual(['01', '02', '03', '04']);
    const cas: [string, string[]][] = [
      ['?acr=critique', ['01']],
      ['?acr=elevee', ['01', '02']],
      ['?acr=moyenne', ['01', '02', '03']],
      ['?aes=elevee', ['01']],
      ['?aes=moyenne', ['01', '02']],
      ['?acr=elevee&aes=elevee', ['01']],
      ['?acr=moyenne&aes=moyenne', ['01', '02']],
      ['?acr=critique&role=aucun', ['01']],
    ];
    for (const [filtres, attendu] of cas) {
      const r = await liste(lecteurA, filtres);
      expect(noms(r.elements), filtres).toEqual(attendu);
      expect(r.total, filtres).toBe(attendu.length);
      // Le rang reste calculé sur toutes les machines lisibles, avant les filtres.
      for (const m of r.elements) expect(m.rang.total, filtres).toBe(4);
    }
    // Hors du périmètre de la personne : jamais rendue, même si elle répond au filtre.
    expect(noms((await liste(admin, '?acr=critique')).elements)).toEqual(['01', '05']);
    expect(noms((await liste(admin, '?aes=elevee')).elements)).toEqual(['01', '05']);
    // Le parc applique les mêmes filtres.
    const parc = await lecteurA.get(`${V}/machines/parc?acr=elevee&aes=moyenne`);
    expect(parc.statusCode, parc.body).toBe(200);
    expect(parc.json().total).toBe(2);
    expect((await lecteurA.get(`${V}/machines/parc?aes=elevee`)).json().total).toBe(1);
    // Valeurs refusées.
    for (const q of ['?acr=faible', '?aes=critique', '?acr=9', '?aes=']) {
      expect((await lecteurA.get(`${V}/machines${q}`)).statusCode, q).toBe(422);
      expect((await lecteurA.get(`${V}/machines/parc${q}`)).statusCode, q).toBe(422);
    }
  });

  it('pagination après le filtre : le total compte toutes les machines retenues', async () => {
    const elements = Array.from({ length: 30 }, (_, i) => machine(i + 1, i < 27 ? 9 : 2, i < 27 ? 800 : 10));
    await synchroniser(elements);
    const p1 = await liste(admin, '?acr=critique&aes=elevee');
    expect(p1.total).toBe(27);
    expect(p1.elements).toHaveLength(25);
    const p2 = await liste(admin, '?acr=critique&aes=elevee&page=2');
    expect(p2.elements).toHaveLength(2);
    expect(p2.elements.every((m) => m.acr === 9 && m.aes === 800)).toBe(true);
  });
});

describe('import Nessus', () => {
  const machineNessus = {
    cle: 'ip:192.0.2.90|srv-nessus-01.example.org',
    uuid: null,
    nom: 'srv-nessus-01.example.org',
    adresse: '192.0.2.90',
    systeme: 'Fictional Linux 9',
    debut: '2026-11-18T08:00:00.000Z',
    fin: '2026-11-18T08:10:00.000Z',
  };
  const constat = {
    plugin: '930001',
    nom: 'Fictional product 930001 : invented remote flaw',
    gravite: 'critique',
    famille: 'Fictional family',
    synopsis: 'The remote host runs an invented fictional service.',
    correctif: 'Upgrade the fictional service.',
    cvss3Vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    cvss3Score: 9.8,
    vpr: 6.7,
    epss: null,
    exploitable: true,
    exploitLibelle: 'Exploits are available',
    exploiteMalware: false,
    failleLe: '2026-10-01T00:00:00.000Z',
    correctifLe: '2026-10-02T00:00:00.000Z',
    voirAussi: 'https://example.org/fictional-advisory',
    cves: ['CVE-2026-930001'],
    cvesTronquees: false,
  };
  const ecartes = {
    machinesSansIdentite: 0,
    machinesTropVolumineuses: 0,
    controlesInvalides: 0,
    controlesInformatifs: 0,
    controlesHorsGravite: 0,
    cvesInvalides: 0,
    liensRefuses: 0,
    valeursInvalides: 0,
    textesRaccourcis: 0,
  };
  it('ni ACR ni AES : null ; un champ aes dans un lot d’import est refusé', async () => {
    const d = await admin.post(`${I}/instances/${nessus}/imports`, { machines: 1, detections: 1, ecartes });
    expect(d.statusCode, d.body).toBe(201);
    const id = d.json().id as string;
    const lot = (m: Record<string, unknown>) => ({
      machines: [{ machine: m, detections: [{ plugin: '930001', port: 443, protocole: 'TCP' }] }],
      constats: [constat],
    });
    const refuse = await admin.post(`${I}/instances/${nessus}/imports/${id}/lots`, lot({ ...machineNessus, aes: 500 }));
    expect(refuse.statusCode, refuse.body).toBe(422);
    const r = await admin.post(`${I}/instances/${nessus}/imports/${id}/lots`, lot(machineNessus));
    expect(r.statusCode, r.body).toBe(200);
    expect((await admin.post(`${I}/instances/${nessus}/imports/${id}/fin`, {})).statusCode).toBe(200);
    expect(
      (await t.svc.db.q('SELECT acr, aes FROM vulnerabilites_machines WHERE integration_id = $1', [nessus])).rows,
    ).toEqual([{ acr: null, aes: null }]);
    const l = await liste(admin);
    expect(l.elements.map((m) => [m.acr, m.aes])).toEqual([[null, null]]);
    // Sans valeur : la machine ne répond à aucun filtre actif.
    expect((await liste(admin, '?acr=moyenne')).total).toBe(0);
    expect((await liste(admin, '?aes=moyenne')).total).toBe(0);
  });
});
