/* Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026) : groupes de machines.
   - migration 105 sur base vierge : tables vides, contraintes, machine supprimée retirée de ses groupes (le groupe reste),
     groupe supprimé avec ses membres ;
   - droits : lecture avec `vulnerabilites:lire`, écritures avec `vulnerabilites:modifier` (403 sinon), CSRF, module
     désactivé ; fournisseur rattaché, changé ou retiré avec, en plus, `fournisseurs:lire` (403), fournisseur présent au
     registre (422) ; fournisseur supprimé ensuite : groupe gardé, marqué « supprimé » ;
   - cloisonnement par périmètre : dans un groupe, seules les machines lues sont nommées et comptées, drapeau hors lecture
     sans nombre ; idem dans la route du fournisseur (failles critiques ouvertes sur les seules machines lues) ;
   - filtre « Groupe » (un groupe, « Sans groupe ») de la liste et du parc, une requête de plus au plus ;
   - If-Match périmé (412) et absent (428) ; journal d'audit de chaque écriture, sans nom ni adresse de machine.
   Données entièrement fictives : machines en .invalid, adresses de 192.0.2.0/24, CVE fictives, fournisseurs fictifs ;
   aucun service n'est joint. */
import {
  BilanMembresGroupe,
  GroupeMachines,
  GroupesDuFournisseur,
  ListeGroupesMachines,
  PageMachinesGroupe,
} from '@suivi/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const G = `${V}/groupes`;
let t: TestApp;
let admin: Agent, gestA: Agent, gestSansF: Agent, lecteurA: Agent, lecteurSansF: Agent, sansDroit: Agent;
let perimA: string, perimB: string, tenable: string;
let fournisseur: string, fournisseurEphemere: string;
const id = new Map<number, string>();

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-${String(940000 + n).padStart(12, '0')}`;
const nomMachine = (n: number) => `srv-grp-${String(n).padStart(2, '0')}.interne.invalid`;
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: nomMachine(n),
  adresse: `192.0.2.${100 + n}`,
  systeme: 'Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: n === 1 ? 9 : 4,
});
const constat = (plugin: string, gravite: string) => ({
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
  exploitable: false,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: null,
  finSupportLe: null,
  voirAussi: null,
  cves: [`CVE-2026-${plugin.slice(1)}`],
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
/** Parc : 1 (A, critique 941001 et 941004), 2 (A, critique 941002 et moyenne 941005), 3 (B, critique 941003), 4 (sans
    périmètre : administration du module), 5 (A, aucune faille), 6 (A, aucune faille). */
const PARC = [
  ...[1, 2, 3, 4, 5, 6].map(machine),
  constat('941001', 'critique'),
  constat('941002', 'critique'),
  constat('941003', 'critique'),
  constat('941004', 'critique'),
  constat('941005', 'moyenne'),
  detection('941001', 1),
  detection('941004', 1),
  detection('941002', 2),
  detection('941005', 2),
  detection('941003', 3),
];
async function syncTenable(elements: Record<string, unknown>[]) {
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [tenable],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  const n = (x: string) => elements.filter((e) => e.type === x).length;
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, {
    ok: true,
    resultat: {
      elements: elements.length,
      pages: 1,
      constats: n('constat'),
      detections: n('detection'),
      machines: n('machine'),
      hotes: 0,
      ecartes: 0,
      tronque: false,
      inventaire: { ok: true, erreur: null },
    },
    erreur: null,
  });
}
const audits = async (action: string, target: string) =>
  (
    await t.svc.db.q<{ username: string; details: Record<string, unknown> }>(
      'SELECT username, details FROM audit_log WHERE action = $1 AND target = $2 ORDER BY id',
      [action, target],
    )
  ).rows;
const creer = async (a: Agent, corps: Record<string, unknown>) => {
  const r = await a.post(G, corps);
  expect(r.statusCode, r.body).toBe(201);
  return GroupeMachines.parse(r.json());
};
const lireGroupe = async (a: Agent, g: string) => {
  const r = await a.get(`${G}/${g}`);
  expect(r.statusCode, r.body).toBe(200);
  return GroupeMachines.parse(r.json());
};
const nomsListe = async (a: Agent, query: string) => {
  const r = await a.get(`${V}/machines${query}`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { elements: { nom: string }[] }).elements.map((m) => m.nom).sort();
};
const nomsParc = async (a: Agent, query: string) => {
  const r = await a.get(`${V}/machines/parc${query}`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { zones: { machines: { nom: string }[] }[] }).zones
    .flatMap((z) => z.machines.map((m) => m.nom))
    .sort();
};
const membres = async (a: Agent, g: string, version: number, corps: Record<string, unknown>) =>
  a.post(`${G}/${g}/machines`, corps, ifMatch(version));

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'grp_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_grp_gest', 'Groupes, gestion', ARRAY['vulnerabilites:lire','vulnerabilites:modifier','vulnerabilites:supprimer','fournisseurs:lire']),
       ('r_grp_gest_sf', 'Groupes, gestion sans fournisseurs', ARRAY['vulnerabilites:lire','vulnerabilites:modifier']),
       ('r_grp_lire', 'Groupes, lecture', ARRAY['vulnerabilites:lire','fournisseurs:lire']),
       ('r_grp_lire_sf', 'Groupes, lecture sans fournisseurs', ARRAY['vulnerabilites:lire'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif groupes A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif groupes B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const comptes: [string, string][] = [
    ['grp_gest_a', 'r_grp_gest'],
    ['grp_gest_sf', 'r_grp_gest_sf'],
    ['grp_lecteur_a', 'r_grp_lire'],
    ['grp_lecteur_sf', 'r_grp_lire_sf'],
  ];
  const agents: Agent[] = [];
  for (const [nom, role] of comptes) {
    const u = await makeUser(t, nom, role, { rattache: false });
    await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false)', [perimA, u.id]);
    agents.push(await login(t, u));
  }
  [gestA, gestSansF, lecteurA, lecteurSansF] = agents as [Agent, Agent, Agent, Agent];
  sansDroit = await login(t, await makeUser(t, 'grp_sans_droit', 'rw'));
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
  await syncTenable(PARC);
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const m = (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_machines WHERE nom = $1', [
      nomMachine(n),
    ]))!;
    id.set(n, m.id);
  }
  for (const n of [1, 2, 5, 6])
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE id = $1', [id.get(n), perimA]);
  await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE id = $1', [id.get(3), perimB]);
  const f1 = await admin.post('/api/suppliers', { name: 'Fournisseur fictif infogérant' });
  expect(f1.statusCode, f1.body).toBe(200);
  fournisseur = f1.json().id as string;
  const f2 = await admin.post('/api/suppliers', { name: 'Fournisseur fictif éphémère' });
  expect(f2.statusCode, f2.body).toBe(200);
  fournisseurEphemere = f2.json().id as string;
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('migration 105', () => {
  it('tables vides au départ ; contraintes du nom, de la description et de la référence du fournisseur', async () => {
    expect(
      (
        await t.svc.db.one(
          "SELECT 1 AS ok FROM schema_migrations WHERE name = '105_vulnerabilites_groupes_machines.sql'",
        )
      )?.ok,
    ).toBe(1);
    for (const table of ['vulnerabilites_groupes', 'vulnerabilites_groupe_machines'])
      expect((await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`))!.n).toBe(0);
    const ins = (nom: string, description = '', ref: string | null = null) =>
      t.svc.db.q(
        `INSERT INTO vulnerabilites_groupes (nom, description, fournisseur_ref, created_by, updated_by)
         VALUES ($1, $2, $3, 'test', 'test')`,
        [nom, description, ref],
      );
    for (const [nom, description, ref] of [
      ['', '', null],
      [' Espace', '', null],
      ['x'.repeat(121), '', null],
      ['Ligne\u0007', '', null],
      ['Description longue', 'd'.repeat(1001), null],
      ['Référence', '', 'SUP-001'],
      ['Référence espace', '', 'legacy:suppliers:SUP 001'],
      ['Référence vide', '', 'legacy:suppliers:'],
    ] as const)
      await expect(ins(nom, description, ref)).rejects.toThrow();
    await ins('Groupe SQL fictif', 'Sur\ndeux lignes', 'legacy:suppliers:SUP-001');
    await expect(ins('groupe sql FICTIF')).rejects.toThrow(/vulnerabilites_groupes_nom/);
    await t.svc.db.q('DELETE FROM vulnerabilites_groupes');
  });

  it('machine supprimée : retirée de ses groupes, le groupe reste ; groupe supprimé : ses membres partent', async () => {
    const m = (await t.svc.db.one<{ id: string }>(
      `INSERT INTO vulnerabilites_machines (integration_id, source, identifiant_source, nom, vu_numero, perimetre_id)
         VALUES ($1, 'tenable', 'ip:192.0.2.250', 'srv-grp-ephemere.interne.invalid', 1, $2) RETURNING id`,
      [tenable, perimA],
    ))!.id;
    const g = await creer(gestA, { nom: 'Groupe fictif éphémère', machineIds: [m, id.get(5)] });
    expect(g.machinesLues).toBe(2);
    await t.svc.db.q('DELETE FROM vulnerabilites_machines WHERE id = $1', [m]);
    const apres = await lireGroupe(gestA, g.id);
    expect(apres).toMatchObject({ id: g.id, machinesLues: 1, horsLecture: false });
    await t.svc.db.q('DELETE FROM vulnerabilites_groupes WHERE id = $1', [g.id]);
    expect(
      (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_groupe_machines'))!.n,
    ).toBe(0);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_machines'))!.n).toBe(6);
  });
});

describe('droits', () => {
  it('lecture avec vulnerabilites:lire, écritures avec vulnerabilites:modifier, suppression avec vulnerabilites:supprimer, CSRF, module désactivé', async () => {
    expect((await sansDroit.get(G)).statusCode).toBe(403);
    expect((await sansDroit.get(`${V}/fournisseurs/${fournisseur}/groupes`)).statusCode).toBe(403);
    expect((await lecteurA.get(G)).statusCode).toBe(200);
    expect((await lecteurA.post(G, { nom: 'Refusé' })).statusCode).toBe(403);
    expect((await sansDroit.post(G, { nom: 'Refusé' })).statusCode).toBe(403);
    expect((await gestA.req('POST', G, { json: { nom: 'Sans jeton' }, csrf: false })).statusCode).toBe(403);
    const g = await creer(gestA, { nom: 'Groupe fictif des droits' });
    expect((await lecteurA.patch(`${G}/${g.id}`, { nom: 'Autre' }, ifMatch(1))).statusCode).toBe(403);
    expect((await lecteurA.del(`${G}/${g.id}`, ifMatch(1))).statusCode).toBe(403);
    // Supprimer un groupe exige `vulnerabilites:supprimer` (ADR 0068) ; modifier ses machines reste à `vulnerabilites:modifier`.
    expect((await gestSansF.del(`${G}/${g.id}`, ifMatch(1))).statusCode).toBe(403);
    expect((await membres(lecteurA, g.id, 1, { ajouter: [id.get(1)] })).statusCode).toBe(403);
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['vulnerabilites'], version = version + 1 WHERE id = 1",
    );
    try {
      expect((await gestA.get(G)).statusCode).toBe(409);
      expect((await gestA.post(G, { nom: 'Module coupé' })).statusCode).toBe(409);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
    expect((await gestA.del(`${G}/${g.id}`, ifMatch(1))).statusCode).toBe(204);
  });
});

describe('création, modification, suppression', () => {
  it('création : nom unique à la casse près, machines lues seulement, journal sans nom de machine', async () => {
    const g = await creer(gestA, {
      nom: '  Applications fictives  ',
      description: 'Serveurs de l’application fictive.',
      fournisseurRef: `legacy:suppliers:${fournisseur}`,
      machineIds: [id.get(1), id.get(2)],
    });
    expect(g).toMatchObject({
      nom: 'Applications fictives',
      description: 'Serveurs de l’application fictive.',
      fournisseur: {
        id: fournisseur,
        ref: `legacy:suppliers:${fournisseur}`,
        nom: 'Fournisseur fictif infogérant',
        etat: 'present',
      },
      machinesLues: 2,
      horsLecture: false,
      version: 1,
      createdBy: 'grp_gest_a',
    });
    const [cree] = await audits('vulnerabilites.groupe.cree', g.id);
    expect(cree).toMatchObject({ username: 'grp_gest_a' });
    expect(cree!.details).toEqual({
      nom: 'Applications fictives',
      description: 'Serveurs de l’application fictive.',
      fournisseurRef: `legacy:suppliers:${fournisseur}`,
      machines: [id.get(1), id.get(2)],
      version: 1,
    });
    expect(JSON.stringify(cree!.details)).not.toContain('srv-grp');
    expect((await gestA.post(G, { nom: 'APPLICATIONS FICTIVES' })).statusCode).toBe(409);
    // Machine du périmètre B (non lue) ou inconnue : refusée comme inconnue, rien n'est créé.
    for (const m of [id.get(3), '00000000-0000-4000-8000-0000000000ff']) {
      const r = await gestA.post(G, { nom: 'Groupe refusé', machineIds: [m] });
      expect(r.statusCode, r.body).toBe(404);
    }
    expect((await gestA.post(G, { nom: '' })).statusCode).toBe(422);
    expect((await gestA.post(G, { nom: 'x'.repeat(121) })).statusCode).toBe(422);
    expect((await gestA.post(G, { nom: 'Doublon', machineIds: [id.get(1), id.get(1)] })).statusCode).toBe(422);
    expect(ListeGroupesMachines.parse((await gestA.get(G)).json()).map((x) => x.nom)).toContain(
      'Applications fictives',
    );
  });

  it('fournisseur : fournisseurs:lire exigé pour le rattacher, le changer ou le retirer ; inexistant refusé', async () => {
    const ref = `legacy:suppliers:${fournisseur}`;
    expect((await gestSansF.post(G, { nom: 'Sans droit fournisseur', fournisseurRef: ref })).statusCode).toBe(403);
    expect(
      (await admin.post(G, { nom: 'Fournisseur inconnu', fournisseurRef: 'legacy:suppliers:SUP-999' })).statusCode,
    ).toBe(422);
    expect((await admin.post(G, { nom: 'Référence invalide', fournisseurRef: 'SUP-001' })).statusCode).toBe(422);
    const g = await creer(gestA, { nom: 'Groupe fictif du fournisseur', fournisseurRef: ref });
    // Sans le droit de lire les fournisseurs : le reste du groupe se modifie, le fournisseur reste et se lit par son nom.
    const r = await gestSansF.patch(
      `${G}/${g.id}`,
      { description: 'Décrit sans le droit des fournisseurs.' },
      ifMatch(1),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      version: 2,
      fournisseur: { id: fournisseur, nom: 'Fournisseur fictif infogérant' },
    });
    expect((await gestSansF.patch(`${G}/${g.id}`, { fournisseurRef: null }, ifMatch(2))).statusCode).toBe(403);
    expect(
      (await gestSansF.patch(`${G}/${g.id}`, { fournisseurRef: `legacy:suppliers:${fournisseurEphemere}` }, ifMatch(2)))
        .statusCode,
    ).toBe(403);
    // Même fournisseur renvoyé : rien ne change, aucun droit de plus n'est demandé.
    const meme = await gestSansF.patch(`${G}/${g.id}`, { fournisseurRef: ref }, ifMatch(2));
    expect(meme.statusCode, meme.body).toBe(200);
    expect(meme.json().version).toBe(2);
    expect(
      (await gestA.patch(`${G}/${g.id}`, { fournisseurRef: 'legacy:suppliers:SUP-999' }, ifMatch(2))).statusCode,
    ).toBe(422);
    const retire = await gestA.patch(`${G}/${g.id}`, { fournisseurRef: null }, ifMatch(2));
    expect(retire.statusCode, retire.body).toBe(200);
    expect(retire.json()).toMatchObject({ fournisseur: null, version: 3 });
    const [modif] = (await audits('vulnerabilites.groupe.modifie', g.id)).slice(-1);
    expect(modif!.details).toMatchObject({
      champs: ['fournisseurRef'],
      avant: { fournisseurRef: ref },
      apres: { fournisseurRef: null },
      version: 3,
    });
    // Le module « fournisseurs » coupé retire le droit : plus de rattachement possible.
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['fournisseurs'], version = version + 1 WHERE id = 1",
    );
    try {
      expect((await admin.patch(`${G}/${g.id}`, { fournisseurRef: ref }, ifMatch(3))).statusCode).toBe(403);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });

  it('fournisseur supprimé ensuite : le groupe reste valide, marqué « supprimé », toujours modifiable', async () => {
    const g = await creer(gestA, {
      nom: 'Groupe fictif orphelin',
      fournisseurRef: `legacy:suppliers:${fournisseurEphemere}`,
    });
    // Suppression du fournisseur dans le registre de l'organisation (tenu par l'état historique).
    await t.svc.db.q('DELETE FROM suivi_fournisseurs WHERE id = $1', [fournisseurEphemere]);
    const lu = await lireGroupe(lecteurSansF, g.id);
    expect(lu.fournisseur).toEqual({
      id: fournisseurEphemere,
      ref: `legacy:suppliers:${fournisseurEphemere}`,
      nom: null,
      etat: 'supprime',
    });
    const liste = ListeGroupesMachines.parse((await lecteurSansF.get(G)).json());
    expect(liste.find((x) => x.id === g.id)?.fournisseur?.etat).toBe('supprime');
    const r = await gestSansF.patch(`${G}/${g.id}`, { nom: 'Groupe fictif orphelin renommé' }, ifMatch(1));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ nom: 'Groupe fictif orphelin renommé', fournisseur: { etat: 'supprime' } });
    expect((await gestA.get(`${V}/fournisseurs/${fournisseurEphemere}/groupes`)).statusCode).toBe(404);
  });

  it('If-Match : absent (428), périmé (412, version courante rendue) ; suppression journalisée, machines gardées', async () => {
    const g = await creer(gestA, { nom: 'Groupe fictif des versions', machineIds: [id.get(5)] });
    expect((await gestA.patch(`${G}/${g.id}`, { nom: 'Sans version' })).statusCode).toBe(428);
    expect((await gestA.patch(`${G}/${g.id}`, { nom: 'Version 2' }, ifMatch(1))).statusCode).toBe(200);
    const perime = await gestA.patch(`${G}/${g.id}`, { nom: 'Version périmée' }, ifMatch(1));
    expect(perime.statusCode).toBe(412);
    expect(perime.json()).toMatchObject({ reason: 'conflict', current: { version: 2 } });
    expect((await membres(gestA, g.id, 1, { ajouter: [id.get(6)] })).statusCode).toBe(412);
    expect((await gestA.del(`${G}/${g.id}`)).statusCode).toBe(428);
    expect((await gestA.del(`${G}/${g.id}`, ifMatch(1))).statusCode).toBe(412);
    expect((await gestA.del(`${G}/${g.id}`, ifMatch(2))).statusCode).toBe(204);
    expect((await gestA.get(`${G}/${g.id}`)).statusCode).toBe(404);
    const [suppr] = await audits('vulnerabilites.groupe.supprime', g.id);
    expect(suppr).toMatchObject({ username: 'grp_gest_a', details: { nom: 'Version 2', machines: 1, version: 2 } });
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_machines'))!.n).toBe(6);
  });
});

describe('membres et cloisonnement par périmètre', () => {
  let g: GroupeMachines;
  it('ajout et retrait en lot, tout ou rien, machines lues seulement ; version et journal', async () => {
    g = await creer(gestA, { nom: 'Groupe fictif cloisonné', fournisseurRef: `legacy:suppliers:${fournisseur}` });
    const r = await membres(gestA, g.id, 1, { ajouter: [id.get(1), id.get(2), id.get(5)] });
    expect(r.statusCode, r.body).toBe(200);
    const b = BilanMembresGroupe.parse(r.json());
    expect(b).toMatchObject({ ajoutees: 3, retirees: 0, groupe: { machinesLues: 3, version: 2 } });
    expect(r.headers.etag).toBe('"2"');
    // Déjà membres : rien ne change, la version reste.
    const deja = BilanMembresGroupe.parse((await membres(gestA, g.id, 2, { ajouter: [id.get(1)] })).json());
    expect(deja).toMatchObject({ ajoutees: 0, retirees: 0, groupe: { version: 2 } });
    // Une machine non lue dans le lot : tout est refusé.
    expect((await membres(gestA, g.id, 2, { ajouter: [id.get(6), id.get(3)] })).statusCode).toBe(404);
    expect((await lireGroupe(gestA, g.id)).machinesLues).toBe(3);
    expect((await membres(gestA, g.id, 2, { ajouter: [id.get(6)], retirer: [id.get(6)] })).statusCode).toBe(422);
    expect((await membres(gestA, g.id, 2, {})).statusCode).toBe(422);
    const lot = BilanMembresGroupe.parse(
      (await membres(gestA, g.id, 2, { ajouter: [id.get(6)], retirer: [id.get(5)] })).json(),
    );
    expect(lot).toMatchObject({ ajoutees: 1, retirees: 1, groupe: { machinesLues: 3, version: 3 } });
    const journal = await audits('vulnerabilites.groupe.machines', g.id);
    expect(journal.map((x) => x.details)).toEqual([
      { ajoutees: [id.get(1), id.get(2), id.get(5)].sort(), retirees: [], version: 2 },
      { ajoutees: [id.get(6)], retirees: [id.get(5)], version: 3 },
    ]);
    expect(JSON.stringify(journal)).not.toMatch(/srv-grp|192\.0\.2/);
    // L'administration ajoute les machines 3 (périmètre B) et 4 (sans périmètre), hors de la lecture du périmètre A.
    const adm = BilanMembresGroupe.parse((await membres(admin, g.id, 3, { ajouter: [id.get(3), id.get(4)] })).json());
    expect(adm.groupe).toMatchObject({ machinesLues: 5, horsLecture: false, version: 4 });
  });

  it('lecture : machines lues seulement, drapeau hors lecture sans nombre', async () => {
    const lu = await lireGroupe(lecteurA, g.id);
    expect(lu).toMatchObject({ machinesLues: 3, horsLecture: true });
    expect(await lireGroupe(admin, g.id)).toMatchObject({ machinesLues: 5, horsLecture: false });
    const r = await lecteurA.get(`${G}/${g.id}/machines`);
    expect(r.statusCode, r.body).toBe(200);
    const p = PageMachinesGroupe.parse(r.json());
    // Machines lues du périmètre A (membres ou non) : 1, 2, 5, 6 ; ni 3 ni 4.
    expect(p.total).toBe(4);
    expect(p.elements.map((m) => [m.nom, m.membre])).toEqual([
      [nomMachine(1), true],
      [nomMachine(2), true],
      [nomMachine(5), false],
      [nomMachine(6), true],
    ]);
    expect(p.identifiants).toEqual([1, 2, 5, 6].map((n) => id.get(n)));
    expect(p.identifiantsTronques).toBe(false);
    expect(r.body).not.toContain(nomMachine(3));
    expect(r.body).not.toContain(nomMachine(4));
    expect(r.body).not.toContain(id.get(3));
    expect(PageMachinesGroupe.parse((await lecteurA.get(`${G}/${g.id}/machines?membres=oui`)).json()).total).toBe(3);
    expect(
      PageMachinesGroupe.parse((await lecteurA.get(`${G}/${g.id}/machines?membres=non`)).json()).elements.map(
        (m) => m.nom,
      ),
    ).toEqual([nomMachine(5)]);
    // Recherche par nom (partiel) ou adresse IP (début).
    const parNom = PageMachinesGroupe.parse((await lecteurA.get(`${G}/${g.id}/machines?q=GRP-02`)).json());
    expect(parNom.elements.map((m) => m.nom)).toEqual([nomMachine(2)]);
    const parIp = PageMachinesGroupe.parse((await lecteurA.get(`${G}/${g.id}/machines?q=192.0.2.10`)).json());
    expect(parIp.total).toBe(4);
    expect(PageMachinesGroupe.parse((await lecteurA.get(`${G}/${g.id}/machines?q=0.2.101`)).json()).total).toBe(0);
    // La machine 3 (illisible) ne peut pas être retirée par le lecteur du périmètre A.
    expect((await membres(gestA, g.id, 4, { retirer: [id.get(3)] })).statusCode).toBe(404);
    // Suppression refusée tant que le groupe compte des machines hors de la lecture de la personne.
    expect((await gestA.del(`${G}/${g.id}`, ifMatch(4))).statusCode).toBe(409);
    expect((await gestA.get(`${G}/${g.id}`)).statusCode).toBe(200);
  });

  it('autres groupes d’une machine (« aussi dans ») : noms des seuls autres groupes', async () => {
    const autre = await creer(gestA, { nom: 'Autre groupe fictif', machineIds: [id.get(1)] });
    const p = PageMachinesGroupe.parse((await lecteurA.get(`${G}/${g.id}/machines?q=grp-01`)).json());
    expect(p.elements[0]!.autresGroupes.map((x) => x.nom)).toEqual(['Applications fictives', 'Autre groupe fictif']);
    const q = PageMachinesGroupe.parse((await lecteurA.get(`${G}/${autre.id}/machines?q=grp-01`)).json());
    expect(q.elements[0]!.autresGroupes.map((x) => x.nom)).toEqual([
      'Applications fictives',
      'Groupe fictif cloisonné',
    ]);
    expect((await gestA.del(`${G}/${autre.id}`, ifMatch(1))).statusCode).toBe(204);
  });

  it('filtre « Groupe » de la liste et du parc : un groupe, « Sans groupe », droits du périmètre', async () => {
    const dans = [1, 2, 6].map(nomMachine).sort();
    expect(await nomsListe(lecteurA, `?groupe=${g.id}`)).toEqual(dans);
    expect(await nomsParc(lecteurA, `?groupe=${g.id}`)).toEqual(dans);
    expect(await nomsListe(admin, `?groupe=${g.id}`)).toEqual([1, 2, 3, 4, 6].map(nomMachine).sort());
    // « Sans groupe » : 1 et 2 sont aussi dans « Applications fictives » ; 5 n'est dans aucun groupe.
    expect(await nomsListe(lecteurA, '?groupe=aucun')).toEqual([nomMachine(5)]);
    expect(await nomsParc(lecteurA, '?groupe=aucun')).toEqual([nomMachine(5)]);
    expect(await nomsListe(admin, '?groupe=aucun')).toEqual([nomMachine(5)]);
    // Combiné aux autres filtres (ACR critique : la machine 1 seule).
    expect(await nomsListe(lecteurA, `?groupe=${g.id}&acr=critique`)).toEqual([nomMachine(1)]);
    // Groupe inconnu : aucune machine ; identifiant mal formé refusé.
    expect(await nomsListe(lecteurA, '?groupe=00000000-0000-4000-8000-0000000000ff')).toEqual([]);
    expect((await lecteurA.get(`${V}/machines?groupe=inconnu`)).statusCode).toBe(422);
    // Le rang reste calculé sur toutes les machines lues.
    const r = (await lecteurA.get(`${V}/machines?groupe=${g.id}`)).json() as {
      elements: { rang: { total: number } }[];
    };
    expect(r.elements[0]!.rang.total).toBe(4);
  });

  it('filtre par groupe : une requête de plus au plus, même combiné aux filtres d’ACR et d’AES', async () => {
    const espion = vi.spyOn(pg.Client.prototype, 'query');
    const compter = async (url: string) => {
      espion.mockClear();
      expect((await lecteurA.get(url)).statusCode).toBe(200);
      return espion.mock.calls.length;
    };
    try {
      await compter(`${V}/machines`);
      for (const base of [`${V}/machines`, `${V}/machines/parc`]) {
        const sans = await compter(base);
        expect(sans).toBeGreaterThan(3);
        expect(await compter(`${base}?groupe=${g.id}`)).toBeLessThanOrEqual(sans + 1);
        expect(await compter(`${base}?groupe=aucun`)).toBeLessThanOrEqual(sans + 1);
        const acr = await compter(`${base}?acr=critique&aes=elevee`);
        expect(await compter(`${base}?acr=critique&aes=elevee&groupe=${g.id}`)).toBeLessThanOrEqual(acr);
      }
      // Liste des groupes : nombre de requêtes fixe, quel que soit le nombre de groupes.
      const un = await compter(G);
      const autres = [];
      for (const n of [1, 2, 3])
        autres.push(await creer(admin, { nom: `Groupe fictif compté ${n}`, machineIds: [id.get(n)] }));
      expect(await compter(G)).toBe(un);
      for (const x of autres) await admin.del(`${G}/${x.id}`, ifMatch(1));
    } finally {
      espion.mockRestore();
    }
  });

  it('groupes du fournisseur : machines lues, hors lecture, failles critiques ouvertes des seules machines lues', async () => {
    const url = `${V}/fournisseurs/${fournisseur}/groupes`;
    expect((await lecteurSansF.get(url)).statusCode).toBe(403);
    expect((await gestSansF.get(url)).statusCode).toBe(403);
    expect((await lecteurA.get(`${V}/fournisseurs/SUP-999/groupes`)).statusCode).toBe(404);
    const lire = async (a: Agent) => {
      const r = await a.get(url);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.body).not.toMatch(/srv-grp|192\.0\.2/);
      return GroupesDuFournisseur.parse(r.json());
    };
    const parNom = (x: GroupesDuFournisseur) => Object.fromEntries(x.groupes.map((y) => [y.nom, y]));
    const lu = parNom(await lire(lecteurA));
    // Cloisonné : 1, 2, 6 lues (critiques 941001, 941004, 941002) ; 3 (941003) et 4 hors lecture.
    expect(lu['Groupe fictif cloisonné']).toMatchObject({
      machinesLues: 3,
      horsLecture: true,
      faillesCritiquesOuvertes: 3,
    });
    expect(lu['Applications fictives']).toMatchObject({
      machinesLues: 2,
      horsLecture: false,
      faillesCritiquesOuvertes: 3,
    });
    expect(Object.keys(lu).sort()).toEqual(['Applications fictives', 'Groupe fictif cloisonné']);
    expect(parNom(await lire(admin))['Groupe fictif cloisonné']).toMatchObject({
      machinesLues: 5,
      horsLecture: false,
      faillesCritiquesOuvertes: 4,
    });
    // Confidentialité : une machine hors lecture (3, faille critique 941003) ne change ni le nombre de machines ni celui des
    // failles critiques lus par le lecteur du périmètre A.
    const autre = await creer(admin, {
      nom: 'Groupe fictif sans lecture',
      fournisseurRef: `legacy:suppliers:${fournisseur}`,
      machineIds: [id.get(5)],
    });
    const avant = parNom(await lire(lecteurA))['Groupe fictif sans lecture'];
    expect(avant).toMatchObject({ machinesLues: 1, horsLecture: false, faillesCritiquesOuvertes: 0 });
    await membres(admin, autre.id, 1, { ajouter: [id.get(3)] });
    expect(parNom(await lire(lecteurA))['Groupe fictif sans lecture']).toMatchObject({
      machinesLues: 1,
      horsLecture: true,
      faillesCritiquesOuvertes: 0,
    });
    expect(parNom(await lire(admin))['Groupe fictif sans lecture']).toMatchObject({ faillesCritiquesOuvertes: 1 });
    // « Ouverte » : une faille corrigée (état de suivi) ne compte plus.
    const c = (await t.svc.db.one<{ id: string }>("SELECT id FROM vulnerabilites_constats WHERE plugin_id = '941004'"))!
      .id;
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_suivis (nature, constat_id, etat) VALUES ('constat', $1, 'corrigee')",
      [c],
    );
    try {
      expect(parNom(await lire(lecteurA))['Applications fictives']!.faillesCritiquesOuvertes).toBe(2);
    } finally {
      await t.svc.db.q('DELETE FROM vulnerabilites_suivis WHERE constat_id = $1', [c]);
    }
    await membres(admin, autre.id, 2, { retirer: [id.get(3)] });
    expect(parNom(await lire(lecteurA))['Groupe fictif sans lecture']).toEqual(avant);
  });

  it('suppression par qui lit toutes les machines du groupe ; les machines restent', async () => {
    const v = (await lireGroupe(admin, g.id)).version;
    expect((await admin.del(`${G}/${g.id}`, ifMatch(v))).statusCode).toBe(204);
    const [suppr] = await audits('vulnerabilites.groupe.supprime', g.id);
    expect(suppr!.details).toMatchObject({ nom: 'Groupe fictif cloisonné', machines: 5 });
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_machines'))!.n).toBe(6);
  });
});
