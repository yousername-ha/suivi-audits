/* Module Vulnérabilités (ADR 0100, lot ALH3 ; décision du RSSI du 17/11/2026) : actif exposé sur Internet (AlgoLightHouse)
   relié à la ou aux machines internes (Tenable). Migration 083 sur base vierge ; propositions calculées à la fin des
   synchronisations d'AlgoLightHouse et de Tenable, par adresse (hôte, domaine qui résout vers l'adresse) et par nom (nom
   complet, nom court), sans rien relier d'office ; rejet non reproposé à données égales, reproposé quand elles changent ;
   confirmation qui tient ; liaison à la main, multiple et bornée ; déliaison ; droits croisés (lire l'actif ET la machine,
   écrire sur les deux périmètres), non-fuite d'une machine ou d'un actif illisible (ni nommé ni compté, ni proposé),
   If-Match, journal sans nom de machine, domaine ni adresse. Données entièrement fictives : domaines en .example et
   .invalid, adresses de 192.0.2.0/24 et 198.51.100.0/24 ; aucun service n'est joint. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const S = `${V}/surface`;
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteur: Agent, editeurAB: Agent, editeurA: Agent, lecteurSeulA: Agent, lecteurSeul: Agent;
let perimA: string, perimB: string, alh: string, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000005${(0xa0 + n).toString(16)}`;

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
const domaine = (n: number, perim: number, nom: string, adresse: string | null) => ({
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
/** Périmètre ALH 1 (relié à A) : hôte 11 (192.0.2.10), domaines 21 (résout vers 192.0.2.10), 22 (nom complet d'une
    machine), 23 (nom court d'une machine). Périmètre ALH 2 (relié à B) : hôte 12 (198.51.100.20). */
const surface = (resolution21 = '192.0.2.10'): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif 1' },
  { type: 'perimetre', id: U(2), nom: 'Périmètre ALH fictif 2' },
  hote(11, 1, '192.0.2.10'),
  hote(12, 2, '198.51.100.20'),
  domaine(21, 1, 'www.exemple-fictif.example', resolution21),
  domaine(22, 1, 'srv-web.exemple-fictif.example', '198.51.100.50'),
  domaine(23, 1, 'appli.exemple-fictif.example', '198.51.100.60'),
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
/** Machines : 1 (192.0.2.10, périmètre A), 2 (nom complet du domaine 22, périmètre B), 3 (nom court « appli », A),
    4 (sans critère, A), 5 (198.51.100.20, B). */
const parc = (nom1 = 'srv-front-01.interne.invalid'): Record<string, unknown>[] => [
  machine(1, nom1, '192.0.2.10'),
  machine(2, 'srv-web.exemple-fictif.example', '192.0.2.30'),
  machine(3, 'appli.interne.invalid', '192.0.2.31'),
  machine(4, 'srv-isole.interne.invalid', '192.0.2.32'),
  machine(5, 'srv-cache.interne.invalid', '198.51.100.20'),
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
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat, erreur: null });
}
const syncAlh = (el = surface()) => synchroniser(alh, el, bilanAlh(el));
const syncTenable = (el = parc()) => synchroniser(tenable, el, bilanTenable(el));

const idMachine = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_machines WHERE identifiant_source = $1', [
    `uuid:${uuidMachine(n)}`,
  ]))!.id;
const idActif = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_actifs WHERE alh_id = $1', [U(n)]))!.id;
const liaisons = async () =>
  (
    await t.svc.db.q<{ actif: string; machine: string; statut: string; motif: string | null; origine: string }>(
      `SELECT x.alh_id AS actif, m.identifiant_source AS machine, l.statut, l.motif, l.origine
       FROM vulnerabilites_alh_liaisons_machines l
       JOIN vulnerabilites_alh_actifs x ON x.id = l.actif_id JOIN vulnerabilites_machines m ON m.id = l.machine_id
       ORDER BY x.alh_id, m.identifiant_source`,
    )
  ).rows.map((r) => ({
    ...r,
    actif: Number(r.actif.slice(-3)),
    machine: Number.parseInt(r.machine.slice(-2), 16) - 0xa0,
  }));
interface Fiche {
  versionLiaisons: number;
  reliees: { id: string; machine: { id: string; nom: string | null } }[];
  propositions: { id: string; motif: string; machine: { id: string; nom: string | null } }[];
  rejetees: { id: string; machine: { id: string } }[];
  autresMachines: boolean;
}
const fiche = async (a: Agent, actif: number): Promise<Fiche> => {
  const r = await a.get(`${S}/actifs/${await idActif(actif)}/machines`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Fiche;
};
const proposition = async (actif: number, machine: number) =>
  (await fiche(admin, actif)).propositions.find((p) => p.machine.id === machinesIds.get(machine))!;
const machinesIds = new Map<number, string>();
/** Journal d'audit en ajout seul : chaque test ne lit que ce qui a été écrit depuis son début. */
let depuis = 0;
const audits = async (prefixe: string) =>
  (
    await t.svc.db.q<{ action: string; target: string; details: Record<string, unknown> }>(
      'SELECT action, target, details FROM audit_log WHERE action LIKE $1 AND id > $2 ORDER BY id',
      [`${prefixe}%`, depuis],
    )
  ).rows;

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
  admin = await login(t, await makeUser(t, 'lm_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_lm_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_lm_modif', 'Vulnérabilités, modification', ARRAY['vulnerabilites:lire','vulnerabilites:modifier'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  // lecteur : lit A et B, sans droit de modifier le module ; editeurAB : écrit sur A et B ; editeurA : écrit sur A, lit B ;
  // lecteurSeulA : modifie le module, écrit sur A, ne lit pas B ; lecteurSeul : lit A seulement.
  const u = {
    lecteur: await makeUser(t, 'lm_lecteur', 'r_lm_lire', { rattache: false }),
    editeurAB: await makeUser(t, 'lm_editeur_ab', 'r_lm_modif', { rattache: false }),
    editeurA: await makeUser(t, 'lm_editeur_a', 'r_lm_modif', { rattache: false }),
    lecteurSeulA: await makeUser(t, 'lm_seul_a', 'r_lm_modif', { rattache: false }),
    lecteurSeul: await makeUser(t, 'lm_lecteur_seul_a', 'r_lm_lire', { rattache: false }),
  };
  await t.svc.db.q(
    `INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES
       ($1, $3, false), ($2, $3, false), ($1, $4, true), ($2, $4, true), ($1, $5, true), ($2, $5, false),
       ($1, $6, true), ($1, $7, false)`,
    [perimA, perimB, u.lecteur.id, u.editeurAB.id, u.editeurA.id, u.lecteurSeulA.id, u.lecteurSeul.id],
  );
  lecteur = await login(t, u.lecteur);
  editeurAB = await login(t, u.editeurAB);
  editeurA = await login(t, u.editeurA);
  lecteurSeulA = await login(t, u.lecteurSeulA);
  lecteurSeul = await login(t, u.lecteurSeul);
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
    'vulnerabilites_alh_liaisons_machines',
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
  depuis = (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n;
  await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  t.svc.limits.integrationSynchro.reset();
  await syncAlh();
  await syncTenable();
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimA]);
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(2), perimB]);
  for (const [n, p] of [
    [1, perimA],
    [2, perimB],
    [3, perimA],
    [4, perimA],
    [5, perimB],
  ] as const) {
    machinesIds.set(n, await idMachine(n));
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE id = $1', [machinesIds.get(n), p]);
  }
});

describe('migration 083 sur base vierge', () => {
  it('crée la table des liaisons et la version des liaisons d’un actif, bornées en base', async () => {
    expect(
      (
        await t.svc.db.one(
          "SELECT 1 AS ok FROM schema_migrations WHERE name = '083_vulnerabilites_surface_machines.sql'",
        )
      )?.ok,
    ).toBe(1);
    const a = await idActif(11);
    const m = machinesIds.get(4)!;
    const h = 'a'.repeat(64);
    const q = `INSERT INTO vulnerabilites_alh_liaisons_machines
      (actif_id, machine_id, statut, motif, origine, empreinte_actif, empreinte_machine, decide_par, decide_le)
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8)`;
    const refus = (p: unknown[]) => expect(t.svc.db.q(q, [a, m, ...p])).rejects.toThrow();
    await refus(['rattachee', 'adresse', 'proposition', h, null, null]);
    await refus(['proposee', null, 'proposition', h, null, null]);
    await refus(['proposee', 'adresse', 'manuelle', h, null, null]);
    await refus(['confirmee', null, 'manuelle', h, null, null]);
    await refus(['proposee', 'adresse', 'proposition', 'x', null, null]);
    await refus(['proposee', 'port', 'proposition', h, null, null]);
    expect(
      (await t.svc.db.one<{ v: number }>('SELECT liaisons_version AS v FROM vulnerabilites_alh_actifs WHERE id = $1', [
        a,
      ]))!.v,
    ).toBe(1);
  });
});

describe('propositions de la plateforme', () => {
  it('par adresse et par nom, après les deux synchronisations ; rien n’est relié d’office', async () => {
    expect(await liaisons()).toEqual([
      { actif: 11, machine: 1, statut: 'proposee', motif: 'adresse', origine: 'proposition' },
      { actif: 12, machine: 5, statut: 'proposee', motif: 'adresse', origine: 'proposition' },
      { actif: 21, machine: 1, statut: 'proposee', motif: 'adresse', origine: 'proposition' },
      { actif: 22, machine: 2, statut: 'proposee', motif: 'nom_complet', origine: 'proposition' },
      { actif: 23, machine: 3, statut: 'proposee', motif: 'nom_court', origine: 'proposition' },
    ]);
    const r = await audits('vulnerabilites.surface.liaisons.recalculees');
    expect(r.length).toBeGreaterThan(0);
    expect(r.at(-1)!.details).toMatchObject({ statuts: { proposee: 5 } });
    // Rejouée à l'identique, aucune synchronisation ne change rien.
    await syncAlh();
    await syncTenable();
    expect((await liaisons()).every((l) => l.statut === 'proposee')).toBe(true);
    expect(
      await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_alh_liaisons_machines'),
    ).toEqual({
      n: 5,
    });
  });

  it('un rejet n’est pas reproposé à données égales, il l’est quand elles changent ; un critère perdu retire', async () => {
    const p = await proposition(11, 1);
    const v = (await fiche(admin, 11)).versionLiaisons;
    const r = await editeurAB.post(
      `${S}/liaisons/${p.id}/decision`,
      { decision: 'rejeter', note: 'Répartiteur' },
      ifMatch(v),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().rejetees).toHaveLength(1);
    await syncAlh();
    await syncTenable();
    expect((await liaisons()).find((l) => l.actif === 11)).toMatchObject({ statut: 'rejetee' });
    // Le nom de la machine change : la donnée n'est plus la même, la proposition revient.
    await syncTenable(parc('srv-front-02.interne.invalid'));
    expect((await liaisons()).find((l) => l.actif === 11)).toMatchObject({ statut: 'proposee', motif: 'adresse' });
    // Le domaine 21 ne résout plus vers la machine 1 : sa proposition est retirée.
    await syncAlh(surface('198.51.100.99'));
    expect((await liaisons()).find((l) => l.actif === 21)).toMatchObject({ statut: 'retiree' });
    expect((await fiche(admin, 21)).propositions).toEqual([]);
  });

  it('une confirmation tient, quelles que soient les synchronisations suivantes', async () => {
    const p = await proposition(21, 1);
    const r = await editeurAB.post(
      `${S}/liaisons/${p.id}/decision`,
      { decision: 'confirmer' },
      ifMatch((await fiche(admin, 21)).versionLiaisons),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().reliees.map((x: { machine: { nom: string } }) => x.machine.nom)).toEqual([
      'srv-front-01.interne.invalid',
    ]);
    await syncAlh(surface('198.51.100.99'));
    expect((await liaisons()).find((l) => l.actif === 21)).toMatchObject({ statut: 'confirmee', motif: 'adresse' });
    const actifs = (await admin.get(`${S}/actifs?liaison=reliee`)).json().elements as {
      valeur: string;
      machinesInternes: { reliees: { nom: string }[]; nombreReliees: number };
    }[];
    expect(actifs.map((a) => a.valeur)).toEqual(['www.exemple-fictif.example']);
    expect(actifs[0]!.machinesInternes).toMatchObject({
      nombreReliees: 1,
      reliees: [{ nom: 'srv-front-01.interne.invalid' }],
    });
    const proposees = (await admin.get(`${S}/actifs?liaison=proposee`)).json().elements as { valeur: string }[];
    expect(proposees.map((a) => a.valeur).sort()).toEqual([
      '192.0.2.10',
      '198.51.100.20',
      'appli.exemple-fictif.example',
      'srv-web.exemple-fictif.example',
    ]);
    // Machine : « exposée sur Internet par … ».
    const m = (await admin.get(`${V}/machines/${machinesIds.get(1)}/surface`)).json();
    expect(m).toMatchObject({
      autresActifs: false,
      actifs: [{ valeur: 'www.exemple-fictif.example', type: 'domaine' }],
    });
  });
});

describe('liaison à la main', () => {
  it('relier plusieurs machines (répartiteur), délier, liste des propositions ; liaison bornée', async () => {
    const actif = await idActif(11);
    let v = (await fiche(admin, 11)).versionLiaisons;
    let r = await editeurA.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(4) }, ifMatch(v));
    expect(r.statusCode, r.body).toBe(200);
    // La proposition par adresse vers la machine 1 est confirmée en la reliant à la main.
    r = await editeurA.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(1) }, ifMatch(v + 1));
    expect(r.statusCode, r.body).toBe(200);
    const f = r.json() as Fiche;
    expect(f.reliees.map((x) => x.machine.nom)).toEqual(['srv-front-01.interne.invalid', 'srv-isole.interne.invalid']);
    expect(f.propositions).toEqual([]);
    expect(await liaisons()).toEqual(
      expect.arrayContaining([
        { actif: 11, machine: 1, statut: 'confirmee', motif: 'adresse', origine: 'proposition' },
        { actif: 11, machine: 4, statut: 'confirmee', motif: null, origine: 'manuelle' },
      ]),
    );
    v = f.versionLiaisons;
    expect(
      (await editeurA.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(4) }, ifMatch(v))).statusCode,
    ).toBe(409);
    // Délier : la liaison devient « rejetée », pas reproposée à données égales.
    const lien = f.reliees.find((x) => x.machine.nom === 'srv-front-01.interne.invalid')!;
    r = await editeurA.post(`${S}/liaisons/${lien.id}/deliaison`, { note: 'Ancienne adresse' }, ifMatch(v));
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json() as Fiche).reliees.map((x) => x.machine.nom)).toEqual(['srv-isole.interne.invalid']);
    await syncTenable();
    expect((await liaisons()).find((l) => l.actif === 11 && l.machine === 1)).toMatchObject({ statut: 'rejetee' });
    // Liste des propositions : actif et machine lisibles.
    const page = (await admin.get(`${S}/liaisons`)).json();
    expect(page.total).toBe(4);
    expect(page.elements.map((x: { actif: { valeur: string } }) => x.actif.valeur)).toEqual([
      'appli.exemple-fictif.example',
      'srv-web.exemple-fictif.example',
      'www.exemple-fictif.example',
      '198.51.100.20',
    ]);
    expect(page.elements[0]).toMatchObject({
      statut: 'proposee',
      motif: 'nom_court',
      machine: { nom: 'appli.interne.invalid' },
    });
    // Borne : vingt machines au plus par actif.
    for (let i = 0; i < 19; i++)
      await t.svc.db.q(
        `WITH m AS (INSERT INTO vulnerabilites_machines (integration_id, identifiant_source, nom, adresse, perimetre_id, vu_numero)
           VALUES ($1, $2, $3, $4, $5, 1) RETURNING id)
         INSERT INTO vulnerabilites_alh_liaisons_machines
           (actif_id, machine_id, statut, origine, empreinte_actif, empreinte_machine, decide_par, decide_le)
         SELECT $6, m.id, 'confirmee', 'manuelle', $7, $7, 'test', now() FROM m`,
        [
          tenable,
          `ip:192.0.2.${200 + i}`,
          `srv-borne-${i}.interne.invalid`,
          `192.0.2.${200 + i}`,
          perimA,
          actif,
          'b'.repeat(64),
        ],
      );
    v = (await fiche(admin, 11)).versionLiaisons;
    r = await editeurA.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(3) }, ifMatch(v));
    expect(r.statusCode).toBe(409);
    expect(r.json().error ?? r.json().message).toMatch(/nombre maximal/);
    const journal = await audits('vulnerabilites.surface.liaison.');
    expect(journal.map((x) => x.action)).toEqual([
      'vulnerabilites.surface.liaison.reliee',
      'vulnerabilites.surface.liaison.reliee',
      'vulnerabilites.surface.liaison.deliee',
    ]);
    expect(journal[1]!.details).toMatchObject({
      actif,
      machine: machinesIds.get(1),
      origine: 'proposition',
      avant: 'proposee',
    });
  });

  it('If-Match exigé et à jour ; une décision sur une proposition déjà tranchée est refusée', async () => {
    const actif = await idActif(23);
    const v = (await fiche(admin, 23)).versionLiaisons;
    expect((await editeurA.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(4) })).statusCode).toBe(
      428,
    );
    expect(
      (await editeurA.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(4) }, ifMatch(v + 7)))
        .statusCode,
    ).toBe(412);
    const p = await proposition(23, 3);
    expect(
      (await editeurA.post(`${S}/liaisons/${p.id}/decision`, { decision: 'rejeter' }, ifMatch(v))).statusCode,
    ).toBe(200);
    expect(
      (await editeurA.post(`${S}/liaisons/${p.id}/decision`, { decision: 'confirmer' }, ifMatch(v))).statusCode,
    ).toBe(412);
    expect(
      (await editeurA.post(`${S}/liaisons/${p.id}/decision`, { decision: 'confirmer' }, ifMatch(v + 1))).statusCode,
    ).toBe(409);
    expect(
      (await editeurA.post(`${S}/liaisons/${p.id}/decision`, { decision: 'garder' }, ifMatch(v + 1))).statusCode,
    ).toBe(422);
  });
});

describe('droits croisés et non-fuite', () => {
  it('une proposition vers une machine illisible ne se voit d’aucune façon', async () => {
    // lecteurSeul lit A seulement : le domaine 22 (périmètre A) est proposé avec la machine 2 (périmètre B).
    const f = await fiche(lecteurSeul, 22);
    expect(f).toMatchObject({ reliees: [], propositions: [], rejetees: [], autresMachines: false });
    const liste = (await lecteurSeul.get(`${S}/actifs`)).json().elements as {
      valeur: string;
      machinesInternes: { propositions: number; autresMachines: boolean };
    }[];
    expect(liste.find((a) => a.valeur === 'srv-web.exemple-fictif.example')!.machinesInternes).toEqual({
      reliees: [],
      nombreReliees: 0,
      propositions: 0,
      autresMachines: false,
    });
    expect(JSON.stringify(liste)).not.toContain('srv-web.exemple-fictif.example"},');
    const page = (await lecteurSeul.get(`${S}/liaisons`)).json();
    expect(page.elements.map((x: { machine: { nom: string } }) => x.machine.nom).sort()).toEqual([
      'appli.interne.invalid',
      'srv-front-01.interne.invalid',
      'srv-front-01.interne.invalid',
    ]);
    expect(JSON.stringify(page)).not.toMatch(/198\.51\.100\.20|srv-cache|192\.0\.2\.30/);
    expect(
      (await lecteurSeul.get(`${S}/actifs?liaison=a_relier`)).json().elements.map((a: { valeur: string }) => a.valeur),
    ).toEqual(['srv-web.exemple-fictif.example']);
    // L'actif 12 (périmètre B) n'est pas lisible : sa fiche est introuvable.
    expect((await lecteurSeul.get(`${S}/actifs/${await idActif(12)}/machines`)).statusCode).toBe(404);
  });

  it('une liaison confirmée vers une machine illisible n’est ni nommée ni comptée, seulement signalée', async () => {
    const p = await proposition(22, 2);
    const r = await editeurAB.post(
      `${S}/liaisons/${p.id}/decision`,
      { decision: 'confirmer' },
      ifMatch((await fiche(admin, 22)).versionLiaisons),
    );
    expect(r.statusCode, r.body).toBe(200);
    const f = await fiche(lecteurSeul, 22);
    expect(f).toMatchObject({ reliees: [], autresMachines: true });
    expect(JSON.stringify(f)).not.toMatch(/srv-web\.exemple-fictif\.example|192\.0\.2\.30/);
    const ligne = ((await lecteurSeul.get(`${S}/actifs?liaison=reliee`)).json().elements as unknown[]).length;
    expect(ligne).toBe(0);
    // Côté machine : qui lit la machine mais pas l'actif apprend seulement qu'un actif illisible y mène.
    await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimB]);
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE id = $1', [
      machinesIds.get(2),
      perimA,
    ]);
    const m = (await lecteurSeul.get(`${V}/machines/${machinesIds.get(2)}/surface`)).json();
    expect(m).toEqual({ actifs: [], autresActifs: true });
    // Machine illisible : introuvable.
    expect((await lecteurSeul.get(`${V}/machines/${machinesIds.get(5)}/surface`)).statusCode).toBe(404);
  });

  it('écrire exige le droit de modifier, l’écriture sur le périmètre de l’actif et sur celui de la machine', async () => {
    const actif = await idActif(11);
    const v = (await fiche(admin, 11)).versionLiaisons;
    // Lecteur de A et B, sans droit de modifier le module : refusé par la route.
    expect(
      (await lecteur.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(4) }, ifMatch(v))).statusCode,
    ).toBe(403);
    // editeurA écrit sur A et lit seulement B : la machine 5 (B) est lisible mais pas modifiable.
    let r = await editeurA.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(5) }, ifMatch(v));
    expect(r.statusCode).toBe(403);
    // lecteurSeulA ne lit pas B : la machine 5 répond comme une machine inconnue.
    r = await lecteurSeulA.post(`${S}/actifs/${actif}/machines`, { machineId: machinesIds.get(5) }, ifMatch(v));
    const inconnue = await lecteurSeulA.post(
      `${S}/actifs/${actif}/machines`,
      { machineId: '00000000-0000-4000-8000-00000000ffff' },
      ifMatch(v),
    );
    expect([r.statusCode, inconnue.statusCode]).toEqual([404, 404]);
    expect(r.json()).toEqual(inconnue.json());
    // Actif du périmètre B (lu seulement) : décision refusée à editeurA ; proposition introuvable pour lecteurSeulA.
    const p12 = await proposition(12, 5);
    const v12 = (await fiche(admin, 12)).versionLiaisons;
    expect(
      (await editeurA.post(`${S}/liaisons/${p12.id}/decision`, { decision: 'confirmer' }, ifMatch(v12))).statusCode,
    ).toBe(403);
    const cache = await lecteurSeulA.post(`${S}/liaisons/${p12.id}/decision`, { decision: 'confirmer' }, ifMatch(v12));
    const absente = await lecteurSeulA.post(
      `${S}/liaisons/00000000-0000-4000-8000-00000000ffff/decision`,
      { decision: 'confirmer' },
      ifMatch(v12),
    );
    expect([cache.statusCode, absente.statusCode]).toEqual([404, 404]);
    expect(cache.json()).toEqual(absente.json());
    // Une proposition dont l'actif est lisible mais la machine non : introuvable aussi.
    const p22 = await proposition(22, 2);
    expect(
      (
        await lecteurSeulA.post(
          `${S}/liaisons/${p22.id}/decision`,
          { decision: 'rejeter' },
          ifMatch((await fiche(admin, 22)).versionLiaisons),
        )
      ).statusCode,
    ).toBe(404);
    expect(await liaisons()).toEqual(
      expect.arrayContaining([expect.objectContaining({ actif: 12, statut: 'proposee' })]),
    );
    // editeurAB écrit sur les deux : accepté.
    expect(
      (await editeurAB.post(`${S}/liaisons/${p12.id}/decision`, { decision: 'confirmer' }, ifMatch(v12))).statusCode,
    ).toBe(200);
  });

  it('le journal ne porte ni nom de machine, ni domaine, ni adresse, ni la note', async () => {
    const p = await proposition(21, 1);
    await editeurAB.post(
      `${S}/liaisons/${p.id}/decision`,
      { decision: 'confirmer', note: 'Vu avec srv-front-01 et 192.0.2.10' },
      ifMatch((await fiche(admin, 21)).versionLiaisons),
    );
    const f = await fiche(admin, 21);
    await editeurAB.post(
      `${S}/liaisons/${f.reliees[0]!.id}/deliaison`,
      { note: 'www.exemple-fictif.example' },
      ifMatch(f.versionLiaisons),
    );
    await editeurAB.post(
      `${S}/actifs/${await idActif(23)}/machines`,
      { machineId: machinesIds.get(4) },
      ifMatch((await fiche(admin, 23)).versionLiaisons),
    );
    const journal = await audits('vulnerabilites.surface.liaison');
    expect(journal.map((x) => x.action)).toEqual(
      expect.arrayContaining([
        'vulnerabilites.surface.liaison.confirmee',
        'vulnerabilites.surface.liaison.deliee',
        'vulnerabilites.surface.liaison.reliee',
      ]),
    );
    const texte = JSON.stringify(journal);
    expect(texte).not.toMatch(/srv-|interne\.invalid|exemple-fictif|192\.0\.2\.|198\.51\.100\.|Vu avec/);
    // La note reste sur la liaison, lisible dans la fiche.
    expect((await fiche(admin, 21)).rejetees[0]).toMatchObject({ note: 'www.exemple-fictif.example' });
  });

  it('module désactivé : routes refusées', async () => {
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['vulnerabilites'], version = version + 1 WHERE id=1",
    );
    for (const r of [
      await admin.get(`${S}/liaisons`),
      await admin.get(`${V}/machines/${machinesIds.get(1)}/surface`),
      await admin.post(`${S}/liaisons/00000000-0000-4000-8000-00000000ffff/deliaison`, {}, ifMatch(1)),
    ]) {
      expect(r.statusCode).toBe(409);
      expect(r.json()).toMatchObject({ reason: 'module_disabled', module: 'vulnerabilites' });
    }
  });
});
