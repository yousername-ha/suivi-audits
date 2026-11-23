/* Performance du module Vulnérabilités (lot PERF, défauts PERF-01 à PERF-04 du banc du 19/11/2026), sur le modèle de
   performance.test.ts (TEST-043) : 1 000 machines réparties sur 6 dépôts reliés à 6 périmètres (plus des machines à
   périmètre propre et sans périmètre), 5 000 constats, 50 000 détections présentes, insérés en base puis ANALYZE ; un
   compte RSSI non administrateur membre de 3 périmètres (dont un parent : pyramide), et l'administrateur. Pour chacun :
   liste des constats, liste des machines, fiche d'une machine, vue d'ensemble, recherche d'une CVE. Budgets de CI
   (exécuteur partagé) : p95 sous 800 ms pour les listes et la fiche, sous 1 500 ms pour la recherche et la vue d'ensemble ;
   les objectifs du serveur réel (500 ms et 1,5 s) restent ceux du RSSI. Le budget de la vue d'ensemble, porté à 2 400 ms le
   20/11/2026 (1 692 ms au p95 en CI pour le RSSI non administrateur, calcul global non réécrit), est revenu à 1 500 ms avec le
   lot PERF-04 (calcul global ensembliste, ordre fixé par la décision du RSSI du 20/11/2026) : 305 à 439 ms au p95 sur le
   poste de mesure (761 à 797 ms avant), soit moins de 900 ms sur un exécuteur deux fois plus lent. Les
   totaux sont comparés à une requête de
   référence indépendante (sans les fragments SQL du module) : une optimisation qui changerait les droits fait échouer le
   test. Données entièrement fictives. Si PERF_OUT est défini, les mesures sont écrites en JSON à côté
   (même nom suffixé « -vulnerabilites », pour ne pas écraser celles de performance.test.ts).
   PERF-13 (banc du 21/11/2026 sur la version 7.5.0) : le jeu porte désormais une veille chargée (10 000 avis du CERT-FR et
   du CERT Santé, 1 à 6 CVE citées, la moitié présentes sur le parc). Sans avis, la lecture des faits des avis ne coûtait
   rien et le défaut était invisible : avant le correctif, ce même jeu donne 2,7 à 3,7 s pour les constats, les machines,
   la vue d'ensemble et la lecture des faits seule (126 ms après).
   Étalonnage des seuils (lot ROBUSTESSE-TESTS, décision du RSSI du 23/11/2026). Pourquoi : sur un exécuteur de CI lent,
   toutes les mesures doublent (constats au p95 : 749 à 846 ms, contre 400 à 440 ms sur un exécuteur normal) et le seuil absolu de
   800 ms échouait sans défaut (PR 361, 364, 366 et 369). Comment : avant chaque requête mesurée, une passe d'étalonnage
   (etalonner) fait un travail fixe, indépendant du code du module, sur la même base et dans le même processus : partie base,
   un agrégat des 50 000 détections joint aux constats avec comptage distinct, lu par le pool de l'application ; partie
   processus, construction, copie JSON, regroupement et tri de 30 000 lignes. Les routes mesurées partagent leur temps entre
   les deux (temps processeur du processus Node, mesuré le 23/11/2026 : 50 à 60 % pour les listes, 93 % pour la vue
   d'ensemble, 15 % pour la fiche et la recherche). Intercalée, la passe voit la même charge de la machine que la requête qui
   la suit. Une passe courte (30 ms) suivait mal une machine chargée (facteur 1,1 à 1,8 pour des routes 1,5 à 3 fois plus
   lentes) ; la passe retenue (90 ms au repos) suit : sous 4 boucles de calcul dans PostgreSQL, facteur 1,6 à 2,0 pour des
   médianes 1,7 à 2,1 fois plus lentes ; sous 4 calculs Node parallèles, facteur 1,2 à 3,1 pour des médianes 1,3 à 3,3 fois
   plus lentes (mesures du 23/11/2026 sur le poste de développement).
   Facteur de la machine = médiane des 15 passes de la série / ETALON_REFERENCE_MS ; seuil effectif = seuil × min(2,5,
   max(1, facteur)) : sur une machine aussi rapide qu'un exécuteur normal (facteur ≤ 1), l'exigence reste exactement 800 ms
   et 1 500 ms ; au-delà d'un facteur 2,5, le seuil ne croît plus (2 000 ms et 3 750 ms au plus) et une machine
   pathologiquement lente échoue encore. Le p95 sur 15 requêtes (la plus lente) est conservé, sans médiane de séries : les
   échecs constatés venaient d'un ralentissement d'ensemble, que le facteur compense, pas d'une requête isolée. Valeur de référence : 100 ms, soit la médiane des passes mesurée le 23/11/2026 sur le poste de
   développement au repos (85 à 94 ms ; 4 processeurs, Node 24, PostgreSQL 16) multipliée par 1,14, rapport entre les
   constats de l'administrateur au p95 sur un exécuteur de CI normal (400 à 440 ms) et sur ce poste (326 à 404 ms). Chaque
   mesure porte dans la sortie et dans PERF_OUT la médiane des passes (base et processus), le facteur et le seuil effectif :
   la référence se réajuste sur la médiane des exécutions de CI normales. La lecture des faits (médiane sous 300 ms) n'est
   pas étalonnée. */
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';
import { lireFaitsCve } from '../src/vulnerabilites/sources.js';

const V = '/api/vulnerabilites';
const MACHINES = 1000;
const CONSTATS = 5000;
const REPETITIONS = 15;
/** Veille chargée (PERF-13, banc du 21/11/2026) : sans avis, la lecture des faits des avis ne coûte rien et le défaut est invisible. */
const AVIS = 10000;
const SEUIL_FAITS_MS = 300;
const SEUIL_LISTE_MS = 800;
const SEUIL_SYNTHESE_MS = 1500;
/** Étalonnage (voir l'en-tête) : durée médiane d'une passe sur un exécuteur de CI normal, et plafond du facteur. */
const ETALON_REFERENCE_MS = 100;
const ETALON_PLAFOND = 2.5;
const INSTANCE = '0c0c0c0c-0000-4000-8000-000000000001';

let t: TestApp, admin: Agent, rssi: Agent, uRssi: TestUser;
const perim: string[] = [];
const mesures: Record<string, unknown>[] = [];

const percentile = (valeurs: number[], p: number) => {
  const tri = [...valeurs].sort((x, y) => x - y);
  return tri[Math.min(tri.length - 1, Math.ceil((p / 100) * tri.length) - 1)]!;
};

/* Passe d'étalonnage (voir l'en-tête) : travail fixe, indépendant du code du module ; la partie processus imite des lignes
   de machines et de constats (identifiants, noms, gravités, CVE). */
const GRAVITES = ['critique', 'elevee', 'moyenne', 'faible'];
const LIGNES_ETALON = 30_000;
function travailProcessus(): number {
  const lignes = Array.from({ length: LIGNES_ETALON }, (_, i) => ({
    id: `m-${i}`,
    nom: `srv-${String(i).padStart(5, '0')}.exemple.invalid`,
    gravite: GRAVITES[i % 4]!,
    score: ((i * 37) % 100) / 10,
    cves: [`CVE-2099-${10000 + (i % 10000)}`, `CVE-2099-${10000 + ((i * 7) % 10000)}`],
  }));
  const copie = JSON.parse(JSON.stringify(lignes)) as typeof lignes;
  const parGravite = new Map<string, Set<string>>();
  for (const l of copie)
    for (const c of l.cves) (parGravite.get(l.gravite) ?? parGravite.set(l.gravite, new Set()).get(l.gravite)!).add(c);
  copie.sort((x, y) => y.score - x.score || (x.nom < y.nom ? -1 : 1));
  return copie.length + parGravite.size;
}
/** Une passe d'étalonnage : durées de la partie base et de la partie processus (ms). */
async function etalonner(): Promise<{ base: number; processus: number }> {
  const debut = performance.now();
  const r = await t.svc.db.q<{ gravite: string; n: number; machines: number }>(
    `SELECT c.gravite, count(*)::int AS n, count(DISTINCT d.machine_id)::int AS machines
     FROM vulnerabilites_detections d JOIN vulnerabilites_constats c ON c.id = d.constat_id GROUP BY c.gravite`,
  );
  const milieu = performance.now();
  expect(r.rows).toHaveLength(4);
  expect(travailProcessus()).toBe(LIGNES_ETALON + 4);
  return { base: milieu - debut, processus: performance.now() - milieu };
}
const mediane = (valeurs: number[]) => percentile(valeurs, 50);
const dixieme = (x: number) => Math.round(x * 10) / 10;

async function mesurer(nom: string, a: Agent, chemin: string, seuilMs: number, attendu: (corps: never) => void) {
  const durees: number[] = [];
  const etalons: { base: number; processus: number }[] = [];
  await a.get(chemin); // échauffement (plans, caches)
  for (let i = 0; i < REPETITIONS; i++) {
    // Passe d'étalonnage intercalée : elle voit la même charge de la machine que la requête qui la suit.
    etalons.push(await etalonner());
    const debut = performance.now();
    const r = await a.get(chemin);
    durees.push(performance.now() - debut);
    expect(r.statusCode, `${nom} : ${r.body.slice(0, 200)}`).toBe(200);
    if (i === 0) attendu(r.json() as never);
  }
  const etalonMediane = mediane(etalons.map((e) => e.base + e.processus));
  const facteur = etalonMediane / ETALON_REFERENCE_MS;
  const m = {
    nom,
    chemin,
    repetitions: REPETITIONS,
    medianeMs: Math.round(mediane(durees)),
    p95Ms: Math.round(percentile(durees, 95)),
    maxMs: Math.round(Math.max(...durees)),
    etalonMedianeMs: dixieme(etalonMediane),
    etalonBaseMs: dixieme(mediane(etalons.map((e) => e.base))),
    etalonProcessusMs: dixieme(mediane(etalons.map((e) => e.processus))),
    facteur: Math.round(facteur * 100) / 100,
    seuilBaseMs: seuilMs,
    seuilMs: Math.round(seuilMs * Math.min(ETALON_PLAFOND, Math.max(1, facteur))),
  };
  mesures.push(m);
  return m;
}
/** Le p95 sous le seuil effectif : seuil × facteur de la machine, jamais moins que le seuil, au plus × ETALON_PLAFOND. */
const sousLeSeuil = (m: Awaited<ReturnType<typeof mesurer>>) =>
  expect(
    m.p95Ms,
    `${m.nom} : p95 ${m.p95Ms} ms, seuil effectif ${m.seuilMs} ms (${m.seuilBaseMs} ms × facteur ${m.facteur}, plafond ${ETALON_PLAFOND})`,
  ).toBeLessThan(m.seuilMs);

/** Référence indépendante : machines lisibles d'un compte, écrite sans les fragments du module (périmètre propre, sinon
    celui du dépôt ; périmètres où le compte est membre et leurs descendants ; sans périmètre : administration du module,
    que le RSSI et l'administrateur ont). */
const machinesLisibles = (tous: boolean) => `
  WITH RECURSIVE acces(id) AS (
    SELECT smsi_id FROM grc_members WHERE user_id = $1
    UNION SELECT s.id FROM grc_smsis s JOIN acces a ON s.parent_id = a.id),
  effectif AS (
    SELECT m.id, coalesce(m.perimetre_id, td.perimetre_id) AS perimetre FROM vulnerabilites_machines m
    LEFT JOIN vulnerabilites_tenable_depots td ON td.id = m.depot_id)
  SELECT id FROM effectif WHERE ${tous ? 'true' : 'perimetre IS NULL OR perimetre IN (SELECT id FROM acces)'}`;
async function reference(u: TestUser | null) {
  const lisibles = machinesLisibles(u === null);
  const p = [u?.id ?? '00000000-0000-4000-8000-000000000000'];
  const machines = (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM (${lisibles}) x`, p))!.n;
  // Jeu sans suivi et sans détection absente : la liste par défaut compte les constats présents sur une machine lisible.
  const constats = (await t.svc.db.one<{ n: number }>(
    `SELECT count(DISTINCT d.constat_id)::int AS n FROM vulnerabilites_detections d WHERE d.machine_id IN (${lisibles})`,
    p,
  ))!.n;
  return { machines, constats };
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'perf_vuln_admin', 'admin'));
  for (let i = 1; i <= 8; i++)
    perim.push(
      (
        await admin.post('/api/grc/smsis', {
          name: `Périmètre fictif ${i}`,
          scope: 'Recette de performance',
          timezone: 'Europe/Paris',
        })
      ).json().id as string,
    );
  // Pyramide : le périmètre 8 est un enfant du périmètre 3.
  await t.svc.db.q('UPDATE grc_smsis SET parent_id = $1 WHERE id = $2', [perim[2], perim[7]]);
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  uRssi = await makeUser(t, 'perf_vuln_rssi', 'rssi', { rattache: false });
  await t.svc.db.q(
    'INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $4, true), ($2, $4, false), ($3, $4, true)',
    [perim[0], perim[2], perim[4], uRssi.id],
  );
  rssi = await login(t, uRssi);
  const p = (i: number) => `'${perim[i - 1]}'::uuid`;
  await t.svc.db.q(`
    CREATE FUNCTION pg_temp.u(x text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
      SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 15))::uuid FROM md5(x) h $$;
    INSERT INTO integrations (id, type, nom, actif, created_by, updated_by)
      VALUES ('${INSTANCE}', 'tenable', 'Tenable fictif de performance', true, 'recette', 'recette');
    INSERT INTO vulnerabilites_tenable_etat (integration_id, numero, numero_complet) VALUES ('${INSTANCE}', 1, 1);
    INSERT INTO vulnerabilites_tenable_depots (id, integration_id, depot_tenable, nom, perimetre_id, vu_numero)
      SELECT pg_temp.u('depot' || d), '${INSTANCE}', d, 'Dépôt fictif ' || d,
             (ARRAY[${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, ${p(6)}])[d], 1
      FROM generate_series(1, 6) d;
    -- 1 sur 12 : périmètre propre (7, 8 ou 2) ; 1 sur 25 : sans dépôt.
    INSERT INTO vulnerabilites_machines (id, integration_id, identifiant_source, nom, adresse, role, perimetre_id, depot_id,
      vu_numero)
      SELECT pg_temp.u('m' || i), '${INSTANCE}', 'uuid:' || pg_temp.u('m' || i)::text,
             'srv-' || lpad(i::text, 4, '0') || '.exemple.invalid', '198.18.' || (i / 256) || '.' || (i % 256),
             (ARRAY['front', 'back', 'bdd', NULL])[1 + i % 4],
             CASE WHEN i % 12 = 1 THEN (ARRAY[${p(7)}, ${p(8)}, ${p(2)}])[1 + (i / 12) % 3] END,
             CASE WHEN i % 25 <> 0 THEN pg_temp.u('depot' || (1 + i % 6)) END, 1
      FROM generate_series(1, ${MACHINES}) i;
    INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, cvss31_score, cvss31_gravite)
      SELECT 'CVE-2099-' || n, CASE WHEN n % 20 = 0 THEN date '2099-02-01' END, (n % 100)::numeric / 10,
             (ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])[1 + n % 4]
      FROM generate_series(10000, 19999) n;
    -- Veille chargée (PERF-13) : ${AVIS} avis du CERT-FR et du CERT Santé, 1 à 6 CVE citées chacun, la moitié présentes sur
    -- le parc (CVE-2099-…), l'autre non (CVE-2098-…).
    INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, publie_le, cves, cves_lues)
      SELECT CASE WHEN i <= ${AVIS} / 2 THEN 'cert-fr' ELSE 'cert-sante' END,
             CASE WHEN i <= ${AVIS} / 2 THEN 'CERTFR-209' || ((i - 1) / 1000) || '-AVI-' || (1000 + (i - 1) % 1000)
                  ELSE i::text END,
             CASE WHEN i % 10 = 0 THEN 'alerte' ELSE 'avis' END, 'Avis fictif ' || i,
             timestamptz '2099-01-01' + (i || ' minutes')::interval,
             ARRAY(SELECT (CASE WHEN i % 4 < 2 THEN 'CVE-2099-' ELSE 'CVE-2098-' END) || (10000 + (i * 7 + n * 13) % 10000)
                   FROM generate_series(1, 1 + i % 6) n), true
      FROM generate_series(1, ${AVIS}) i;
    INSERT INTO vulnerabilites_constats (id, integration_id, plugin_id, nom, gravite, exploitable, fin_support_le, vu_numero)
      SELECT pg_temp.u('c' || j), '${INSTANCE}', 100000 + j, 'Exemple Linux : contrôle fictif ' || j,
             (ARRAY['critique', 'elevee', 'moyenne', 'faible'])[1 + j % 4], j % 9 = 0,
             CASE WHEN j % 50 = 0 THEN timestamptz '2025-06-01' END, 1
      FROM generate_series(1, ${CONSTATS}) j;
    INSERT INTO vulnerabilites_constat_cves (constat_id, cve)
      SELECT pg_temp.u('c' || j), 'CVE-2099-' || (10000 + (j * 2 + n) % 10000)
      FROM generate_series(1, ${CONSTATS}) j, generate_series(0, 1) n WHERE j % 25 <> 0;
    -- 50 000 détections présentes : 200 sur chacune des 200 premières machines (80 %), 12,5 en moyenne sur les autres.
    INSERT INTO vulnerabilites_detections (constat_id, machine_id, port, protocole, premiere_detection, derniere_detection,
      vu_numero)
      SELECT pg_temp.u('c' || (1 + (k * 4999 + i * 37) % ${CONSTATS})), pg_temp.u('m' || i), 0, 'TCP',
             timestamptz '2026-02-01', timestamptz '2026-11-15', 1
      FROM generate_series(1, ${MACHINES}) i, generate_series(0, 199) k
      WHERE i <= 200 OR k < (12 + i % 2);
    ANALYZE;`);
  const n = await t.svc.db.one<{ m: number; d: number }>(
    'SELECT (SELECT count(*) FROM vulnerabilites_machines)::int AS m, (SELECT count(*) FROM vulnerabilites_detections)::int AS d',
  );
  expect(n).toEqual({ m: MACHINES, d: 40_000 + 800 * 12 + 400 });
  for (let i = 0; i < 5; i++) await etalonner(); // échauffement de l'étalonnage (compilation, plans, caches)
}, 120_000);
afterAll(async () => {
  if (process.env.PERF_OUT) {
    const sortie = process.env.PERF_OUT.replace(/(\.json)?$/, '-vulnerabilites.json');
    fs.mkdirSync(sortie.replace(/[^/]+$/, '') || '.', { recursive: true });
    fs.writeFileSync(
      sortie,
      JSON.stringify(
        {
          date: new Date().toISOString(),
          machines: MACHINES,
          constats: CONSTATS,
          etalonnage: { referenceMs: ETALON_REFERENCE_MS, plafond: ETALON_PLAFOND },
          mesures,
        },
        null,
        2,
      ) + '\n',
    );
  }
  console.info(
    `Performance du module Vulnérabilités (ms ; étalonnage de référence ${ETALON_REFERENCE_MS} ms, plafond ${ETALON_PLAFOND})\n` +
      mesures
        .map(
          (m) =>
            `${String(m.nom).padEnd(40)} p50 ${m.medianeMs}  p95 ${m.p95Ms}  max ${m.maxMs}` +
            (m.facteur === undefined
              ? ''
              : `  étalon ${m.etalonMedianeMs} (base ${m.etalonBaseMs}, processus ${m.etalonProcessusMs})` +
                `  facteur ${m.facteur}  seuil ${m.seuilMs}`),
        )
        .join('\n'),
  );
  if (t) await t.close();
});

const comptes: [string, () => Agent, () => TestUser | null][] = [
  ['administrateur', () => admin, () => null],
  ['RSSI non administrateur (3 périmètres)', () => rssi, () => uRssi],
];
describe.each(comptes)(`module Vulnérabilités, %s`, (nom, agent, compte) => {
  it(`constats, machines et fiche : p95 sous ${SEUIL_LISTE_MS} ms × facteur de la machine, totaux de la référence`, async () => {
    const ref = await reference(compte());
    expect(ref.machines).toBeGreaterThan(0);
    if (compte()) expect(ref.machines).toBeLessThan(MACHINES);
    const constats = await mesurer(
      `constats (${nom})`,
      agent(),
      `${V}/constats`,
      SEUIL_LISTE_MS,
      (c: { total: number }) => expect(c.total).toBe(ref.constats),
    );
    const machines = await mesurer(
      `machines (${nom})`,
      agent(),
      `${V}/machines`,
      SEUIL_LISTE_MS,
      (c: { total: number }) => expect(c.total).toBe(ref.machines),
    );
    // Machine la plus touchée parmi celles du périmètre 3 (lisible par les deux comptes) : son rang porte le total lisible.
    const id = (await t.svc.db.one<{ id: string }>(
      "SELECT id FROM vulnerabilites_machines WHERE nom = 'srv-0002.exemple.invalid'",
    ))!.id;
    const fiche = await mesurer(
      `fiche machine (${nom})`,
      agent(),
      `${V}/machines/${id}`,
      SEUIL_LISTE_MS,
      (c: { id: string; rang: { total: number } }) => {
        expect(c.id).toBe(id);
        expect(c.rang.total).toBe(ref.machines);
      },
    );
    sousLeSeuil(constats);
    sousLeSeuil(machines);
    sousLeSeuil(fiche);
  }, 120_000);

  it(`vue d’ensemble et recherche d’une CVE : p95 sous ${SEUIL_SYNTHESE_MS} ms × facteur de la machine`, async () => {
    const vue = await mesurer(
      `vue d’ensemble (${nom})`,
      agent(),
      `${V}/vue-ensemble`,
      SEUIL_SYNTHESE_MS,
      (c: { total: number }) => expect(c.total).toBeGreaterThan(0),
    );
    const cves = (await t.svc.db.one<{ n: number }>(
      "SELECT count(DISTINCT cve)::int AS n FROM vulnerabilites_veille_cve WHERE cve LIKE 'CVE-2099-1000%'",
    ))!.n;
    const recherche = await mesurer(
      `recherche CVE (${nom})`,
      agent(),
      `${V}/recherche?q=CVE-2099-1000`,
      SEUIL_SYNTHESE_MS,
      (c: { cves: { total: number } }) => expect(c.cves.total).toBe(cves),
    );
    sousLeSeuil(vue);
    sousLeSeuil(recherche);
  }, 120_000);
});

/* PERF-13 (banc du 21/11/2026) : la lecture des faits des avis, appelée par chaque calcul de priorité, ne doit pas croître
   comme (nombre d'avis) × (nombre de CVE demandées). Résultat comparé à une requête de référence indépendante. */
describe('lecture des faits des CVE, veille chargée (PERF-13)', () => {
  it(`toutes les CVE des constats : médiane sous ${SEUIL_FAITS_MS} ms, mêmes avis que la référence`, async () => {
    const { rows: demandees } = await t.svc.db.q<{ cve: string }>(
      'SELECT DISTINCT cve FROM vulnerabilites_constat_cves ORDER BY cve',
    );
    const cves = demandees.map((r) => r.cve);
    expect(cves.length).toBeGreaterThan(9000);
    // Référence : couples (avis, CVE citée) parmi les CVE demandées, sans le code du module.
    const reference = new Map(
      (
        await t.svc.db.q<{ cve: string; n: number }>(
          `SELECT c.cve, count(*)::int AS n FROM vulnerabilites_veille_avis a, unnest(a.cves) AS c(cve)
           WHERE c.cve IN (SELECT cve FROM vulnerabilites_constat_cves) GROUP BY c.cve`,
        )
      ).rows.map((r) => [r.cve, r.n]),
    );
    expect(reference.size).toBeGreaterThan(5000);
    await lireFaitsCve(t.svc.db.k, cves); // échauffement
    const durees: number[] = [];
    let faits = new Map<string, { avis: unknown[] }>();
    for (let i = 0; i < 5; i++) {
      const debut = performance.now();
      faits = await lireFaitsCve(t.svc.db.k, cves);
      durees.push(performance.now() - debut);
    }
    const lus = new Map([...faits].filter(([, f]) => f.avis.length > 0).map(([cve, f]) => [cve, f.avis.length]));
    expect(lus).toEqual(reference);
    const m = {
      nom: 'faits des CVE (toutes)',
      medianeMs: Math.round(percentile(durees, 50)),
      p95Ms: Math.round(percentile(durees, 95)),
      maxMs: Math.round(Math.max(...durees)),
    };
    mesures.push(m);
    expect(m.medianeMs).toBeLessThan(SEUIL_FAITS_MS);
  }, 120_000);

  it('une seule CVE : mêmes avis que la référence (lecture par l’index des CVE citées)', async () => {
    const une = await t.svc.db.one<{ cve: string; n: number }>(
      `SELECT c.cve, count(*)::int AS n FROM vulnerabilites_veille_avis a, unnest(a.cves) AS c(cve)
       WHERE c.cve LIKE 'CVE-2099-%' GROUP BY c.cve ORDER BY count(*) DESC, c.cve LIMIT 1`,
    );
    expect(une!.n).toBeGreaterThan(0);
    const faits = await lireFaitsCve(t.svc.db.k, [une!.cve]);
    expect(faits.get(une!.cve)?.avis.length).toBe(une!.n);
  });
});
