/* Module Vulnérabilités (ADR 0100, lot ALH5 ; décisions du RSSI du 17/11/2026). Migration 084 sur base vierge.
   - A : la priorité est la même pour tout le monde. Deux personnes aux droits différents voient la même priorité pour une
     alerte, une technologie, un constat et dans la veille ; aucun nom ni identifiant d'actif ou de machine illisible ne sort.
   - B : une alerte ouverte ou une technologie exposée dont l'actif mène, par une liaison CONFIRMÉE, à une machine interne
     portant une faille présente en P1 ou P2 monte d'un cran (P1 plafonné) ; jamais sur une proposition ; la carte trace le
     chemin critique après majoration ; le nom de la machine n'est montré qu'à qui la lit.
   - C : liaison en masse par motif à joker : aperçu obligatoire et borné, droits par paire, non-fuite, empreinte, versions,
     plafond, déjà reliées, une seule entrée de journal sans nom.
   Données entièrement fictives : domaines en .example et .invalid, adresses de 192.0.2.0/24 et 198.51.100.0/24, CVE
   fictives ; aucun service n'est joint. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const S = `${V}/surface`;
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurAB: Agent, editeurA: Agent, editeurSeulA: Agent;
let perimA: string, perimB: string, alh: string, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const uuidMachine = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

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
const domaine = (n: number, perim: number, nom: string, adresse: string | null = null) => ({
  type: 'domaine',
  id: U(n),
  perimetre: U(perim),
  statut: 'monitored',
  domaine: nom,
  niveau: 2,
  importManuel: false,
  adresse,
  parent: null,
  creeLe: '2026-02-01T10:11:01.000Z',
  majLe: null,
});
const alerte = (n: number, perim: number, cibleHote: number, cves: string[]) => ({
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
  cibleHote: U(cibleHote),
  cibleDomaine: null,
  cves,
  defauts: [],
  creeLe: '2026-11-10T10:00:00.000Z',
  majLe: '2026-11-15T10:00:00.000Z',
  termineeLe: null,
});
const technologie = (cle: string, nom: string) => ({
  type: 'technologie',
  cle,
  nom,
  editeur: 'Éditeur fictif',
  produit: nom,
  technologie: null,
  derniere: '2026-11-16T00:00:00.000Z',
  tronquee: false,
});
const lien = (cle: string, version: string, actif: number, libelle: string) => ({
  type: 'technologie_actif',
  technologie: cle,
  version,
  actif: U(actif),
  typeActif: 'hote',
  libelle,
  actuel: true,
});
const cveTechno = (cle: string, version: string, cve: string, extra: Record<string, unknown> = {}) => ({
  type: 'technologie_cve',
  technologie: cle,
  version,
  cve,
  titre: 'Faille fictive',
  cvss: null,
  epss: null,
  severite: null,
  preuve: false,
  exploitee: false,
  publieeLe: '2026-03-01T00:00:00.000Z',
  ...extra,
});
/** Périmètre ALH 1 (relié à A) : hôte 11 (192.0.2.10), domaines « pre-web01 », « pre-web02 », « pre-web04 »,
    « prod-web01 ». Périmètre ALH 2 (relié à B) : hôte 12 (198.51.100.20), domaine « pre-web03 ». Alertes ouvertes sur
    l'hôte 11 : 31 (CVE 95002, exploitée selon AlgoLightHouse sur l'hôte 12), 35 (CVE 95010, élevée : P3), 36 (CVE 95011,
    critique : P2), 37 (CVE 95012, KEV : P1). Technologie « logiciel-fictif » : 1.0 sur l'hôte 11 (CVE 95010), 2.0 sur
    l'hôte 12 seulement (CVE 95002, exploitée). */
const surface = (extra: Record<string, unknown>[] = []): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif 1' },
  { type: 'perimetre', id: U(2), nom: 'Périmètre ALH fictif 2' },
  hote(11, 1, '192.0.2.10'),
  hote(12, 2, '198.51.100.20'),
  domaine(41, 1, 'pre-web01.exemple-fictif.example'),
  domaine(42, 1, 'pre-web02.exemple-fictif.example'),
  domaine(43, 2, 'pre-web03.exemple-fictif.example'),
  domaine(44, 1, 'pre-web04.exemple-fictif.example'),
  domaine(45, 1, 'prod-web01.exemple-fictif.example'),
  alerte(31, 1, 11, ['CVE-2026-95002']),
  alerte(35, 1, 11, ['CVE-2026-95010']),
  alerte(36, 1, 11, ['CVE-2026-95011']),
  alerte(37, 1, 11, ['CVE-2026-95012']),
  technologie('fictif|logiciel|', 'logiciel-fictif'),
  lien('fictif|logiciel|', '1.0', 11, '192.0.2.10'),
  lien('fictif|logiciel|', '2.0', 12, '198.51.100.20'),
  cveTechno('fictif|logiciel|', '1.0', 'CVE-2026-95010'),
  cveTechno('fictif|logiciel|', '2.0', 'CVE-2026-95002', { exploitee: true, cvss: 9.8 }),
  ...extra,
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
    technologies: c('technologie'),
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
/** Machines et leur périmètre : 1 « srv-front-01 » (192.0.2.10, B), 2 « srv-pre-web01 » (A), 3 « srv-pre-web02 » (B),
    4 « srv-pre-web03 » (A), 5 et 6 « srv-pre-web04 » (A, deux machines de même nom), 7 « srv-calme » (A). */
const PARC: [number, string, string, 'A' | 'B'][] = [
  [1, 'srv-front-01.interne.invalid', '192.0.2.10', 'B'],
  [2, 'srv-pre-web01', '192.0.2.21', 'A'],
  [3, 'srv-pre-web02', '198.51.100.22', 'B'],
  [4, 'srv-pre-web03', '192.0.2.23', 'A'],
  [5, 'srv-pre-web04', '192.0.2.24', 'A'],
  [6, 'srv-pre-web04', '192.0.2.25', 'A'],
  [7, 'srv-calme.interne.invalid', '192.0.2.26', 'A'],
];
const bilanTenable = (el: Record<string, unknown>[]) => ({
  elements: el.length,
  pages: 1,
  constats: 0,
  detections: 0,
  machines: el.filter((e) => e.type === 'machine').length,
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
  expect(job).toMatchObject({ operation: 'synchroniser' });
  for (let i = 0; i < elements.length; i += 500)
    await t.svc.integrations.lot(job.id as string, elements.slice(i, i + 500));
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat, erreur: null });
}
const syncAlh = (el = surface()) => synchroniser(alh, el, bilanAlh(el));
const syncTenable = (el: Record<string, unknown>[]) => synchroniser(tenable, el, bilanTenable(el));

const machines = new Map<number, string>();
const idActif = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_actifs WHERE alh_id = $1', [U(n)]))!.id;
/** Constat présent sur une machine, avec ses CVE. */
async function constat(machineN: number, plugin: number, cves: string[], gravite = 'moyenne') {
  const c = (await t.svc.db.one<{ id: string }>(
    `INSERT INTO vulnerabilites_constats (integration_id, plugin_id, nom, gravite, exploitable, vu_numero)
     VALUES ($1, $2, $3, $4, false, 1) RETURNING id`,
    [tenable, plugin, `Contrôle fictif ${plugin}`, gravite],
  ))!.id;
  for (const cve of cves)
    await t.svc.db.q('INSERT INTO vulnerabilites_constat_cves (constat_id, cve) VALUES ($1, $2)', [c, cve]);
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_detections (constat_id, machine_id, port, protocole, vu_numero)
     SELECT $1, m.id, 443, 'TCP', m.vu_numero FROM vulnerabilites_machines m WHERE m.id = $2`,
    [c, machines.get(machineN)],
  );
  return c;
}
const veilleCve = (cve: string, champs: { kev?: boolean; gravite?: 'HIGH' | 'CRITICAL' }) =>
  t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, cvss31_gravite, cvss31_score, nvd_le)
     VALUES ($1, $2, $3, $4, CASE WHEN $3::text IS NULL THEN NULL ELSE now() END)`,
    [
      cve,
      champs.kev ? '2026-11-01' : null,
      champs.gravite ?? null,
      champs.gravite === 'CRITICAL' ? 9.8 : champs.gravite === 'HIGH' ? 7.5 : null,
    ],
  );
/** Liaison d'un actif à une machine, proposée ou confirmée, posée en base. */
async function liaison(actif: number, machineN: number, statut: 'proposee' | 'confirmee') {
  const h = 'a'.repeat(64);
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_alh_liaisons_machines
       (actif_id, machine_id, statut, motif, origine, empreinte_actif, empreinte_machine, decide_par, decide_le)
     VALUES ($1, $2, $3, CASE WHEN $3 = 'proposee' THEN 'adresse' END,
             CASE WHEN $3 = 'proposee' THEN 'proposition' ELSE 'manuelle' END, $4, $4,
             CASE WHEN $3 = 'confirmee' THEN 'test' END, CASE WHEN $3 = 'confirmee' THEN now() END)
     ON CONFLICT (actif_id, machine_id) DO UPDATE SET statut = EXCLUDED.statut, motif = EXCLUDED.motif,
       origine = EXCLUDED.origine, decide_par = EXCLUDED.decide_par, decide_le = EXCLUDED.decide_le`,
    [await idActif(actif), machines.get(machineN), statut, h],
  );
}
/** Journal d'audit en ajout seul : chaque test ne lit que ce qui a été écrit depuis son début. */
let depuis = 0;
const audits = async (prefixe: string) =>
  (
    await t.svc.db.q<{ action: string; target: string; details: Record<string, unknown> }>(
      'SELECT action, target, details FROM audit_log WHERE action LIKE $1 AND id > $2 ORDER BY id',
      [`${prefixe}%`, depuis],
    )
  ).rows;

interface PrioriteJson {
  niveau: string;
  faits: Record<string, unknown>[];
}
const alertes = async (a: Agent) =>
  new Map(
    ((await a.get(`${S}/alertes`)).json().elements as { titre: string; priorite: PrioriteJson | null }[]).map((x) => [
      x.titre,
      x.priorite,
    ]),
  );

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
  admin = await login(t, await makeUser(t, 'pc_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_pc_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_pc_modif', 'Vulnérabilités, modification', ARRAY['vulnerabilites:lire','vulnerabilites:modifier'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  // lecteurA : lit A ; lecteurAB : lit A et B ; editeurA : écrit sur A, lit B ; editeurSeulA : écrit sur A, ne lit pas B.
  const u = {
    lecteurA: await makeUser(t, 'pc_lecteur_a', 'r_pc_lire', { rattache: false }),
    lecteurAB: await makeUser(t, 'pc_lecteur_ab', 'r_pc_lire', { rattache: false }),
    editeurA: await makeUser(t, 'pc_editeur_a', 'r_pc_modif', { rattache: false }),
    editeurSeulA: await makeUser(t, 'pc_editeur_seul_a', 'r_pc_modif', { rattache: false }),
  };
  await t.svc.db.q(
    `INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES
       ($1, $3, false), ($1, $4, false), ($2, $4, false), ($1, $5, true), ($2, $5, false), ($1, $6, true)`,
    [perimA, perimB, u.lecteurA.id, u.lecteurAB.id, u.editeurA.id, u.editeurSeulA.id],
  );
  lecteurA = await login(t, u.lecteurA);
  lecteurAB = await login(t, u.lecteurAB);
  editeurA = await login(t, u.editeurA);
  editeurSeulA = await login(t, u.editeurSeulA);
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
    'vulnerabilites_suivis',
    'vulnerabilites_alh_liaisons_machines',
    'vulnerabilites_detections',
    'vulnerabilites_constat_cves',
    'vulnerabilites_constats',
    'vulnerabilites_veille_cve',
    'vulnerabilites_alh_technologie_cves',
    'vulnerabilites_alh_technologie_actifs',
    'vulnerabilites_alh_technologies',
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
  await syncAlh();
  await syncTenable(PARC.map(([n, nom, adresse]) => machine(n, nom, adresse)));
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimA]);
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(2), perimB]);
  // Aucune liaison de départ : les propositions calculées à la fin des synchronisations sont retirées.
  await t.svc.db.q('DELETE FROM vulnerabilites_alh_liaisons_machines');
  for (const [n, , , p] of PARC) {
    const id = (await t.svc.db.one<{ id: string }>(
      'SELECT id FROM vulnerabilites_machines WHERE identifiant_source = $1',
      [`uuid:${uuidMachine(n)}`],
    ))!.id;
    machines.set(n, id);
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE id = $1', [
      id,
      p === 'A' ? perimA : perimB,
    ]);
  }
  // Journal lu depuis la fin de la préparation (les synchronisations y écrivent).
  depuis = (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n;
});

describe('migration 084 sur base vierge', () => {
  it('admet l’origine « masse », et seulement les origines connues', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '084_vulnerabilites_liaisons_masse.sql'"))
        ?.ok,
    ).toBe(1);
    await liaison(41, 2, 'confirmee');
    await t.svc.db.q("UPDATE vulnerabilites_alh_liaisons_machines SET origine = 'masse'");
    await expect(t.svc.db.q("UPDATE vulnerabilites_alh_liaisons_machines SET origine = 'autre'")).rejects.toThrow();
    // Une proposition reste d'origine « proposition » (contrainte de la migration 083).
    await expect(
      t.svc.db.q(
        "UPDATE vulnerabilites_alh_liaisons_machines SET statut = 'proposee', motif = 'adresse', decide_par = NULL, decide_le = NULL",
      ),
    ).rejects.toThrow();
  });
});

describe('décision A : la priorité est la même pour tout le monde', () => {
  it('deux personnes, même priorité : alerte, fiche, technologie, constat, veille ; aucun nom illisible ne sort', async () => {
    await veilleCve('CVE-2026-95002', {});
    // Constat sur une machine de A qui porte la CVE exploitée selon AlgoLightHouse (sur l'hôte 12, périmètre B).
    const c = await constat(2, 95002, ['CVE-2026-95002']);
    for (const [a, b] of [[lecteurA, lecteurAB]] as const) {
      const pa = await alertes(a);
      const pb = await alertes(b);
      expect(pa.get('Alerte fictive 31')).toEqual({
        niveau: 'P1',
        faits: [
          { fait: 'exploitation', sources: ['alh'] },
          { fait: 'presence', presence: 'exposee' },
        ],
      });
      expect(pa).toEqual(pb);
      const id31 = (await a.get(`${S}/alertes?q=${encodeURIComponent('Alerte fictive 31')}`)).json().elements[0]
        .id as string;
      const fa = (await a.get(`${S}/alertes/${id31}`)).json();
      const fb = (await b.get(`${S}/alertes/${id31}`)).json();
      expect(fa.priorite).toEqual(fb.priorite);
      expect(fa.cvesDetail).toEqual(fb.cvesDetail);
      const ta = (await a.get(`${S}/technologies?tri=priorite`)).json().elements[0];
      const tb = (await b.get(`${S}/technologies?tri=priorite`)).json().elements[0];
      expect(ta.priorite).toEqual(tb.priorite);
      expect(ta.priorite.niveau).toBe('P1');
      // Le détail reste limité : la version 2.0 (hôte 12, périmètre B) n'est détaillée qu'à qui lit B.
      expect(ta.versions.map((v: { version: string }) => v.version)).toEqual(['1.0']);
      expect(tb.versions.map((v: { version: string }) => v.version)).toEqual(['1.0', '2.0']);
      const ca = (await a.get(`${V}/constats/${c}`)).json();
      const cb = (await b.get(`${V}/constats/${c}`)).json();
      expect(ca.priorite).toEqual(cb.priorite);
      expect(ca.priorite.niveau).toBe('P1');
      const va = (await a.get(`${V}/veille/failles?q=CVE-2026-95002`)).json().elements[0];
      const vb = (await b.get(`${V}/veille/failles?q=CVE-2026-95002`)).json().elements[0];
      expect(va.sources).toEqual(vb.sources);
      expect(va.surfaceExterne).toEqual({ actifs: 1, alertes: 1, horsLecture: true });
      expect(vb.surfaceExterne).toEqual({ actifs: 2, alertes: 1, horsLecture: false });
      // Rang des machines : la faille exploitée compte pour tout le monde.
      const ma = (await a.get(`${V}/machines/${machines.get(2)}`)).json();
      const mb = (await b.get(`${V}/machines/${machines.get(2)}`)).json();
      expect(ma.compteurs.exploitationAveree).toBe(1);
      expect(ma.compteurs).toEqual(mb.compteurs);
      // Non-fuite : rien de l'hôte 12 (adresse, identifiants) ni du périmètre B dans ce que lit la personne de A.
      const tout = JSON.stringify([
        await a.get(`${S}/alertes?tri=priorite`).then((r) => r.json()),
        fa,
        await a.get(`${S}/technologies`).then((r) => r.json()),
        await a.get(`${S}/actifs`).then((r) => r.json()),
        await a.get(`${S}/carte`).then((r) => r.json()),
        va,
        ca,
      ]);
      for (const x of ['198.51.100.20', U(12), await idActif(12), await idActif(43), 'pre-web03', 'Périmètre fictif B'])
        expect(tout, x).not.toContain(x);
    }
    // Une lecture n'écrit rien au journal.
    expect(await audits('vulnerabilites.')).toEqual([]);
  });
});

describe('décision B : une faille exposée qui mène à une machine interne vulnérable monte d’un cran', () => {
  beforeEach(async () => {
    await veilleCve('CVE-2026-95010', { gravite: 'HIGH' });
    await veilleCve('CVE-2026-95011', { gravite: 'CRITICAL' });
    await veilleCve('CVE-2026-95012', { kev: true });
    await veilleCve('CVE-2026-95090', { kev: true });
    await veilleCve('CVE-2026-95091', { gravite: 'HIGH' });
  });

  it('seulement sur liaison confirmée vers une machine vulnérable (P1 ou P2) ; P1 plafonné ; même résultat pour tous', async () => {
    // Machine 1 (périmètre B) : faille présente exploitée (KEV), P1 : vulnérable. Machine 7 (A) : faille élevée, P3.
    await constat(1, 95090, ['CVE-2026-95090']);
    await constat(7, 95091, ['CVE-2026-95091']);
    const avant = await alertes(lecteurA);
    expect([35, 36, 37].map((n) => avant.get(`Alerte fictive ${n}`)?.niveau)).toEqual(['P3', 'P2', 'P1']);
    // Proposition non confirmée : aucun effet.
    await liaison(11, 1, 'proposee');
    expect(await alertes(lecteurA)).toEqual(avant);
    // Liaison confirmée vers une machine qui n'est pas vulnérable : aucun effet.
    await liaison(11, 7, 'confirmee');
    expect(await alertes(lecteurA)).toEqual(avant);
    // Confirmée vers la machine vulnérable : un cran de plus, P1 reste P1, fait ajouté, sans nom de machine.
    await liaison(11, 1, 'confirmee');
    for (const a of [lecteurA, lecteurAB, admin]) {
      const apres = await alertes(a);
      expect(apres.get('Alerte fictive 35')).toEqual({
        niveau: 'P2',
        faits: [
          { fait: 'presence', presence: 'exposee' },
          { fait: 'gravite', gravite: 'elevee' },
          { fait: 'machine_interne_vulnerable' },
        ],
      });
      expect(apres.get('Alerte fictive 36')?.niveau).toBe('P1');
      expect(apres.get('Alerte fictive 37')).toEqual({
        niveau: 'P1',
        faits: [
          { fait: 'exploitation', sources: ['kev'] },
          { fait: 'presence', presence: 'exposee' },
          { fait: 'machine_interne_vulnerable' },
        ],
      });
    }
    // Fiche d'une alerte : ses CVE majorées comme elle.
    const id35 = (await lecteurA.get(`${S}/alertes?q=${encodeURIComponent('Alerte fictive 35')}`)).json().elements[0]
      .id as string;
    const fiche = (await lecteurA.get(`${S}/alertes/${id35}`)).json();
    expect(fiche.cvesDetail[0].priorite.niveau).toBe('P2');
    // Technologie : la version 1.0 tourne sur l'hôte 11, qui mène à la machine vulnérable ; sa CVE 95010 (P3) passe en P2.
    const techno = (await lecteurA.get(`${S}/technologies`)).json().elements[0];
    const cve95010 = techno.versions[0].cves.find((x: { cve: string }) => x.cve === 'CVE-2026-95010');
    expect(cve95010.priorite.niveau).toBe('P2');
    expect(cve95010.priorite.faits).toContainEqual({ fait: 'machine_interne_vulnerable' });
    // Carte : l'alerte 36 (P2 majorée en P1) devient un chemin d'entrée critique.
    const carte = (await lecteurA.get(`${S}/carte`)).json();
    expect(carte.alertes.find((x: { titre: string }) => x.titre === 'Alerte fictive 36').priorite).toBe('P1');
    // La machine 1 (périmètre B) n'est nommée nulle part pour la personne de A.
    const tout = JSON.stringify([await lecteurA.get(`${S}/alertes`).then((r) => r.json()), fiche, techno, carte]);
    for (const x of ['srv-front-01', machines.get(1)!]) expect(tout, x).not.toContain(x);
  });

  it('une faille close sur la machine ne compte pas ; une alerte terminée n’est pas majorée', async () => {
    const c = await constat(1, 95090, ['CVE-2026-95090']);
    await liaison(11, 1, 'confirmee');
    expect((await alertes(lecteurA)).get('Alerte fictive 35')?.niveau).toBe('P2');
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_suivis (nature, constat_id, etat) VALUES ('constat', $1, 'corrigee')",
      [c],
    );
    expect((await alertes(lecteurA)).get('Alerte fictive 35')?.niveau).toBe('P3');
    await t.svc.db.q('DELETE FROM vulnerabilites_suivis');
    await t.svc.db.q("UPDATE vulnerabilites_alh_alertes SET statut = 'completed' WHERE alh_id = $1", [U(35)]);
    const toutes = new Map(
      (
        (await lecteurA.get(`${S}/alertes?statut=toutes`)).json().elements as {
          titre: string;
          priorite: PrioriteJson;
        }[]
      ).map((x) => [x.titre, x.priorite]),
    );
    expect(toutes.get('Alerte fictive 35')?.niveau).toBe('P4');
    expect(toutes.get('Alerte fictive 35')?.faits).not.toContainEqual({ fait: 'machine_interne_vulnerable' });
  });
});

describe('décision C : liaison en masse par motif à joker', () => {
  // Motif des actifs en majuscules : la comparaison est insensible à la casse.
  const unPourUn = { mode: 'un_pour_un', motifActifs: 'PRE-*.exemple-fictif.example', motifMachines: 'srv-pre-*' };
  const apercu = (a: Agent, d: Record<string, unknown>) => a.post(`${S}/liaisons/masse/apercu`, d);
  const appliquer = (a: Agent, ap: { demande: unknown; empreinte: string; paires: Record<string, unknown>[] }) =>
    a.post(`${S}/liaisons/masse`, {
      demande: ap.demande,
      empreinte: ap.empreinte,
      paires: ap.paires.map((p) => ({
        actifId: (p.actif as { id: string }).id,
        machineId: (p.machine as { id: string }).id,
        versionLiaisons: p.versionLiaisons,
      })),
    });

  it('aperçu un pour un : paires, sans correspondance, multiples, droits par paire ; insensible à la casse', async () => {
    const r = await apercu(editeurA, unPourUn);
    expect(r.statusCode, r.body).toBe(200);
    const ap = r.json();
    // pre-web01 → srv-pre-web01 (A, A) : relié ; pre-web02 → srv-pre-web02 (B, lisible sans écriture) et pre-web03 (actif
    // de B) → srv-pre-web03 : hors des droits d'écriture ; pre-web04 → deux machines « srv-pre-web04 » : écarté.
    expect(
      ap.paires.map((p: { actif: { valeur: string }; machine: { nom: string } }) => [p.actif.valeur, p.machine.nom]),
    ).toEqual([['pre-web01.exemple-fictif.example', 'srv-pre-web01']]);
    expect(ap).toMatchObject({
      actifs: 4,
      nombreSansCorrespondance: 0,
      nombreMultiples: 1,
      nonModifiables: 2,
      dejaReliees: 0,
      plafond: 0,
      max: 200,
    });
    expect(ap.multiples).toEqual([
      { actif: expect.objectContaining({ valeur: 'pre-web04.exemple-fictif.example' }), machines: 2 },
    ]);
    expect(ap.empreinte).toMatch(/^[0-9a-f]{64}$/);
    // Rien n'est écrit par un aperçu.
    expect(
      (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_alh_liaisons_machines'))!.n,
    ).toBe(0);
    expect(await audits('vulnerabilites.surface.')).toEqual([]);
  });

  it('non-fuite : un actif ou une machine illisible n’apparaît ni dans l’aperçu ni dans les comptes', async () => {
    const ap = (await apercu(editeurSeulA, unPourUn)).json();
    // pre-web03 (actif de B) n'existe pas pour elle ; srv-pre-web02 (machine de B) non plus : pre-web02 est sans correspondance.
    expect(ap).toMatchObject({ actifs: 3, nombreSansCorrespondance: 1, nombreMultiples: 1, nonModifiables: 0 });
    expect(ap.sansCorrespondance.map((x: { valeur: string }) => x.valeur)).toEqual([
      'pre-web02.exemple-fictif.example',
    ]);
    const texte = JSON.stringify(ap);
    for (const x of ['pre-web03', 'srv-pre-web02', await idActif(43), machines.get(3)!])
      expect(texte, x).not.toContain(x);
    // Mode « tous vers une machine » vers une machine illisible : comme inconnue.
    const r = await apercu(editeurSeulA, { mode: 'tous_vers_une', motifActifs: 'pre-*', machineId: machines.get(3) });
    expect(r.statusCode).toBe(404);
  });

  it('application : seules les paires de l’aperçu, liaisons confirmées « masse », une entrée de journal sans nom', async () => {
    const ap = (await apercu(editeurA, unPourUn)).json();
    const r = await appliquer(editeurA, ap);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ reliees: 1, ecartees: 0 });
    const l = await t.svc.db.q<{
      statut: string;
      origine: string;
      decide_par: string;
      actif_id: string;
      machine_id: string;
    }>('SELECT statut, origine, decide_par, actif_id, machine_id FROM vulnerabilites_alh_liaisons_machines');
    expect(l.rows).toEqual([
      {
        statut: 'confirmee',
        origine: 'masse',
        decide_par: 'pc_editeur_a',
        actif_id: await idActif(41),
        machine_id: machines.get(2),
      },
    ]);
    const j = await audits('vulnerabilites.surface.');
    expect(j.map((x) => x.action)).toEqual(['vulnerabilites.surface.liaisons.reliees_en_masse']);
    expect(j[0]!.details).toEqual({
      mode: 'un_pour_un',
      motifActifs: 'PRE-*.exemple-fictif.example',
      motifMachines: 'srv-pre-*',
      machine: null,
      demandees: 1,
      reliees: 1,
      ecartees: 0,
    });
    const details = JSON.stringify(j[0]);
    for (const x of ['pre-web01', 'srv-pre-web01', await idActif(41), machines.get(2)!])
      expect(details, x).not.toContain(x);
    // Lue par la fiche de l'actif, comme une liaison confirmée.
    const fiche = (await editeurA.get(`${S}/actifs/${await idActif(41)}/machines`)).json();
    expect(fiche.reliees).toEqual([expect.objectContaining({ origine: 'masse', statut: 'confirmee' })]);
    // Le même aperçu rejoué : la version des liaisons de l'actif a changé, la paire est écartée et comptée.
    const rejoue = await appliquer(editeurA, ap);
    expect(rejoue.json()).toEqual({ reliees: 0, ecartees: 1 });
    // Un nouvel aperçu la dit déjà reliée.
    expect((await apercu(editeurA, unPourUn)).json()).toMatchObject({ dejaReliees: 1, paires: [] });
  });

  it('empreinte vérifiée, versions vérifiées, paire hors aperçu refusée ; droits de la route', async () => {
    const ap = (await apercu(editeurA, unPourUn)).json();
    // Paire changée (autre machine) sans nouvel aperçu : refus, rien n'est écrit.
    const triche = await appliquer(editeurA, {
      ...ap,
      paires: [{ ...ap.paires[0], machine: { id: machines.get(4) } }],
    });
    expect(triche.statusCode).toBe(422);
    // Empreinte d'une autre personne : refus.
    expect((await appliquer(editeurSeulA, ap)).statusCode).toBe(422);
    // L'actif a changé depuis l'aperçu (liaison faite à côté) : écartée et comptée.
    await t.svc.db.q('UPDATE vulnerabilites_alh_actifs SET liaisons_version = liaisons_version + 1 WHERE id = $1', [
      await idActif(41),
    ]);
    expect((await appliquer(editeurA, ap)).json()).toEqual({ reliees: 0, ecartees: 1 });
    expect(
      (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_alh_liaisons_machines'))!.n,
    ).toBe(0);
    // Lecture seule : refusé ; motif invalide ou jokers en nombre différent : 422.
    expect((await apercu(lecteurAB, unPourUn)).statusCode).toBe(403);
    expect((await apercu(editeurA, { ...unPourUn, motifMachines: 'srv-%' })).statusCode).toBe(422);
    expect((await apercu(editeurA, { ...unPourUn, motifMachines: 'srv-*-*' })).statusCode).toBe(422);
    expect((await apercu(editeurA, { ...unPourUn, motifActifs: '*' })).statusCode).toBe(422);
  });

  it('tous vers une machine ; plafond par actif ; au-delà de 200 paires, refus avec le nombre', async () => {
    const tous = { mode: 'tous_vers_une', motifActifs: 'pre-web0*.exemple-fictif.example', machineId: machines.get(7) };
    // Plafond : pre-web02 déjà relié à vingt machines.
    const parc = Array.from({ length: 20 }, (_, i) =>
      machine(100 + i, `srv-plafond-${i}.interne.invalid`, `192.0.2.${100 + i}`),
    );
    await syncTenable([...PARC.map(([n, nom, adresse]) => machine(n, nom, adresse)), ...parc]);
    await t.svc.db.q('DELETE FROM vulnerabilites_alh_liaisons_machines');
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_alh_liaisons_machines
         (actif_id, machine_id, statut, origine, empreinte_actif, empreinte_machine, decide_par, decide_le)
       SELECT $1, m.id, 'confirmee', 'manuelle', $2, $2, 'test', now() FROM vulnerabilites_machines m
       WHERE m.nom LIKE 'srv-plafond-%'`,
      [await idActif(42), 'b'.repeat(64)],
    );
    const ap = (await apercu(editeurA, tous)).json();
    // pre-web01 et pre-web04 (A) : reliés ; pre-web02 : au plafond ; pre-web03 (B, sans écriture) : hors droits.
    expect(ap.paires.map((p: { actif: { valeur: string } }) => p.actif.valeur).sort()).toEqual([
      'pre-web01.exemple-fictif.example',
      'pre-web04.exemple-fictif.example',
    ]);
    expect(ap).toMatchObject({ actifs: 4, plafond: 1, nonModifiables: 1, machine: { id: machines.get(7) } });
    expect((await appliquer(editeurA, ap)).json()).toEqual({ reliees: 2, ecartees: 0 });
    expect((await audits('vulnerabilites.surface.liaisons.reliees_en_masse'))[0]!.details).toMatchObject({
      mode: 'tous_vers_une',
      machine: machines.get(7),
      motifMachines: null,
    });
    // Borne : 201 domaines qui suivent le motif.
    const nombreux = Array.from({ length: 201 }, (_, i) => domaine(1000 + i, 1, `masse-${i}.exemple-fictif.example`));
    await syncAlh(surface(nombreux));
    await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimA]);
    const trop = await apercu(editeurA, { mode: 'tous_vers_une', motifActifs: 'masse-*', machineId: machines.get(7) });
    expect(trop.statusCode).toBe(422);
    expect(trop.body).toMatch(/201 paires/);
  });
});
