/* Module Vulnérabilités (ADR 0100, point 10 ; lot V4b) : suivi d'une faille. Migration 077 sur base vierge ; historique en
   ajout seul ; états, transitions et notes obligatoires, If-Match ; droits (sans le droit, constat touchant une machine non
   lisible, périmètre de l'action non inscriptible, module des actions désactivé, sans droit du module des actions) ;
   création d'une action du registre sous l'identité de la personne, mention de l'origine, aucun nom ni adresse de machine
   dans l'action ni au journal ; relier et délier une action ; passage « nouvelle » -> « à traiter » ; la clôture d'une
   action ne change pas l'état ; proposition « corrigée » après une synchronisation complète seulement, confirmation, refus,
   réapparition ; faille déclarée qui n'est plus rattachée ; exclusion des compteurs et du rang ; date de revue dépassée.
   Données entièrement fictives : noms en .invalid, adresses de 192.0.2.0/24, CVE et contrôles fictifs ; aucun service
   n'est joint. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const SYSTEME = { username: 'test' };
const CLE_ACCES = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CLE_SECRETE = 'f0e1d2c3b4a5968778695a4b3c2d1e0f';
const CPE = 'cpe:2.3:a:editeur_suivi:produit_suivi:*:*:*:*:*:*:*:*';
let t: TestApp;
let admin: Agent, editeurA: Agent, lecteurA: Agent, sansActions: Agent, editeurAB: Agent;
let perimA: string, perimB: string, perimC: string, instance: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000005${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-suivi-${String(n).padStart(2, '0')}.exemple.invalid`;
const adresse = (n: number) => `192.0.2.${60 + n}`;
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
const constat = (plugin: string, extra: Record<string, unknown> = {}) => ({
  type: 'constat',
  plugin,
  nom: `Exemple Linux : contrôle fictif ${plugin}`,
  gravite: 'critique',
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Update the affected packages.',
  cvss3Vecteur: 'AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H',
  cvss3Score: 9.1,
  vpr: 5,
  epss: 0.0056,
  exploitable: false,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: null,
  finSupportLe: null,
  voirAussi: null,
  cves: [`CVE-2026-9${plugin.slice(-4)}`],
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
const bilan = (elements: unknown[], extra: Record<string, unknown> = {}) => {
  const n = (t_: string) => elements.filter((e) => (e as { type: string }).type === t_).length;
  return {
    elements: elements.length,
    pages: 1,
    constats: n('constat'),
    detections: n('detection'),
    machines: n('machine'),
    hotes: n('hote'),
    ecartes: 0,
    tronque: false,
    inventaire: { ok: true, erreur: null },
    ...extra,
  };
};
/** Parc fictif : machines 1 et 3 dans le périmètre A, 2 dans B. 950001 sur 1 et 3 ; 950002 sur 1 et 2 ; 950003 sur 3. */
const parc = (sans: string[] = []): Record<string, unknown>[] =>
  [
    machine(1),
    machine(2),
    machine(3),
    constat('950001'),
    constat('950002', { gravite: 'elevee' }),
    constat('950003', { gravite: 'moyenne' }),
    detection('950001', 1),
    detection('950001', 3),
    detection('950002', 1),
    detection('950002', 2),
    detection('950003', 3),
  ].filter((e) => !sans.includes(String((e as { plugin?: string }).plugin)));
const n = async (table: string, where = 'true', p: unknown[] = []) =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, p))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
/** Aucun nom ni adresse de machine dans un texte (action, journal). */
const sansMachine = (texte: string) => {
  for (const k of [1, 2, 3]) {
    expect(texte).not.toContain(nomMachine(k));
    expect(texte).not.toContain(adresse(k));
    expect(texte).not.toContain('srv-suivi');
  }
};

/** Une synchronisation par le service : inscrite, réclamée, lots rangés, terminée. */
async function synchroniser(elements: unknown[], extra: Record<string, unknown> = {}) {
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  expect(job.operation).toBe('synchroniser');
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat: bilan(elements, extra), erreur: null });
}
const constatId = async (plugin: string) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = $1', [Number(plugin)]))!
    .id;
type Suivi = {
  etat: string;
  proposition: string;
  version: number;
  present: boolean;
  revueLe: string | null;
  revueDepassee: boolean;
  peutDecider: boolean;
  motifRefus: string | null;
  historique: { evenement: string; etatAvant: string | null; etatApres: string; note: string; auteur: string }[];
  actions: (
    { lisible: true; id: string; statut: string; statutLibelle: string; terminee: boolean } | { lisible: false }
  )[];
  preremplissage: { titre: string; description: string };
};
const suivi = async (a: Agent, nature: string, id: string): Promise<Suivi> => {
  const r = await a.get(`${V}/suivis/${nature}/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  expect(r.headers.etag).toBe(`"${r.json().version}"`);
  return r.json() as Suivi;
};
const etat = (a: Agent, nature: string, id: string, corps: unknown, version: number) =>
  a.post(`${V}/suivis/${nature}/${id}/etat`, corps, ifMatch(version));
const plugins = async (a: Agent, q = '') =>
  ((await a.get(`${V}/constats${q}`)).json().elements as { plugin: string }[]).map((c) => c.plugin).sort();
const actionCorps = (perimetreId: string, extra: Record<string, unknown> = {}) => ({
  perimetreId,
  titre: 'Corriger le contrôle fictif',
  description: 'Description fictive.',
  echeance: null,
  ...extra,
});

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'suivi_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_sv_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire','ecarts:lire']),
       ('r_sv_modif', 'Vulnérabilités et actions', ARRAY['vulnerabilites:lire','vulnerabilites:modifier','ecarts:lire','ecarts:modifier']),
       ('r_sv_seul', 'Vulnérabilités seules', ARRAY['vulnerabilites:lire','vulnerabilites:modifier'])`,
  );
  const perimetre = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'x', timezone: 'Europe/Paris' })).json().id as string;
  perimA = await perimetre('Périmètre fictif A');
  perimB = await perimetre('Périmètre fictif B');
  perimC = await perimetre('Périmètre fictif C');
  const uEditeurA = await makeUser(t, 'suivi_editeur_a', 'r_sv_modif', { rattache: false });
  const uLecteurA = await makeUser(t, 'suivi_lecteur_a', 'r_sv_lire', { rattache: false });
  const uSans = await makeUser(t, 'suivi_sans_actions', 'r_sv_seul', { rattache: false });
  const uEditeurAB = await makeUser(t, 'suivi_editeur_ab', 'r_sv_modif', { rattache: false });
  await t.svc.db.q(
    `INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, true), ($1, $4, false), ($1, $5, true),
       ($1, $6, true), ($2, $6, false)`,
    [perimA, perimB, uEditeurA.id, uLecteurA.id, uSans.id, uEditeurAB.id],
  );
  editeurA = await login(t, uEditeurA);
  lecteurA = await login(t, uLecteurA);
  sansActions = await login(t, uSans);
  editeurAB = await login(t, uEditeurAB);
  const r = await admin.post('/api/integrations/instances', {
    type: 'tenable',
    nom: 'Tenable fictif',
    configuration: { adresse: 'https://tenable.exemple.invalid' },
  });
  instance = r.json().id as string;
  await admin.put(`/api/integrations/instances/${instance}/secrets`, { accessKey: CLE_ACCES, secretKey: CLE_SECRETE });
  const a = await admin.put(
    `/api/integrations/instances/${instance}/activation`,
    { actif: true, fluxConfirme: true },
    ifMatch(r.json().version),
  );
  expect(a.statusCode, a.body).toBe(200);
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await synchroniser(parc());
  const placer = (k: number, p: string) =>
    t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE identifiant_source = $1', [
      `uuid:${uuidMachine(k)}`,
      p,
    ]);
  await placer(1, perimA);
  await placer(2, perimB);
  await placer(3, perimA);
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('migration 077 sur base vierge', () => {
  it('crée les tables, borne les données et garde l’historique en ajout seul', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '077_vulnerabilites_suivi.sql'"))?.ok,
    ).toBe(1);
    for (const table of ['vulnerabilites_suivis', 'vulnerabilites_suivi_historique', 'vulnerabilites_suivi_actions'])
      expect(await n(table)).toBe(0);
    const c = await constatId('950003');
    const refus = (q: string, p: unknown[] = []) => expect(t.svc.db.q(q, p)).rejects.toThrow();
    // Nature et objet cohérents ; date de revue réservée au risque accepté ; « corrigée » sans proposition en attente.
    await refus("INSERT INTO vulnerabilites_suivis (nature, rapprochement_id) VALUES ('constat', NULL)");
    await refus("INSERT INTO vulnerabilites_suivis (nature, constat_id, etat) VALUES ('constat', $1, 'inconnu')", [c]);
    await refus(
      "INSERT INTO vulnerabilites_suivis (nature, constat_id, etat, revue_le) VALUES ('constat', $1, 'en_cours', '2027-01-01')",
      [c],
    );
    await refus(
      "INSERT INTO vulnerabilites_suivis (nature, constat_id, etat, proposition) VALUES ('constat', $1, 'corrigee', 'a_confirmer')",
      [c],
    );
    const h = `INSERT INTO vulnerabilites_suivi_historique (nature, objet_id, evenement, etat_avant, etat_apres, note, auteur)
               VALUES ('constat', $1, $2, 'nouvelle', $3, $4, 'test') RETURNING id`;
    await refus(h, [c, 'changement', 'risque_accepte', '  ']);
    await refus(h, [c, 'refus', 'nouvelle', '']);
    // Objet fictif : l'historique n'a pas de clé étrangère (il survit à l'objet).
    const fictif = '00000000-0000-4000-8000-0000000000ff';
    const id = (await t.svc.db.one<{ id: string }>(h, [fictif, 'changement', 'en_cours', '']))!.id;
    await expect(
      t.svc.db.q("UPDATE vulnerabilites_suivi_historique SET note = 'x' WHERE id = $1", [id]),
    ).rejects.toThrow(/ajout seul/);
    await expect(t.svc.db.q('DELETE FROM vulnerabilites_suivi_historique WHERE id = $1', [id])).rejects.toThrow(
      /ajout seul/,
    );
    await expect(t.svc.db.q('TRUNCATE vulnerabilites_suivi_historique')).rejects.toThrow(/ajout seul/);
    // La ligne d'essai reste : seule la remise à vide efface l'historique.
    expect(await n('vulnerabilites_suivi_historique', 'objet_id = $1', [fictif])).toBe(1);
  });
});

describe('états, transitions et notes', () => {
  it('nouvelle par défaut ; changement avec If-Match ; notes obligatoires ; date de revue ; historique', async () => {
    const id = await constatId('950001');
    const s0 = await suivi(editeurA, 'constat', id);
    expect(s0).toMatchObject({ etat: 'nouvelle', proposition: 'aucune', version: 0, present: true, peutDecider: true });
    expect(s0.historique).toEqual([]);
    // Préremplissage : nom du contrôle, correctif de Tenable en anglais tel quel, aucun nom de machine.
    expect(s0.preremplissage.titre).toBe('Corriger : Exemple Linux : contrôle fictif 950001');
    expect(s0.preremplissage.description).toContain('Update the affected packages.');
    sansMachine(JSON.stringify(s0.preremplissage));
    // If-Match absent : 428 ; périmé : 412.
    expect((await editeurA.post(`${V}/suivis/constat/${id}/etat`, { etat: 'a_traiter' })).statusCode).toBe(428);
    expect((await etat(editeurA, 'constat', id, { etat: 'a_traiter' }, 3)).statusCode).toBe(412);
    const r1 = await etat(editeurA, 'constat', id, { etat: 'a_traiter', note: 'Pris en charge.' }, 0);
    expect(r1.statusCode, r1.body).toBe(200);
    expect(r1.json()).toMatchObject({ etat: 'a_traiter', version: 1 });
    // « nouvelle » ne se choisit pas ; même état refusé.
    expect((await etat(editeurA, 'constat', id, { etat: 'nouvelle' }, 1)).statusCode).toBe(422);
    expect((await etat(editeurA, 'constat', id, { etat: 'a_traiter' }, 1)).statusCode).toBe(409);
    // Note obligatoire : risque accepté, non concernée (une note blanche ne compte pas).
    expect((await etat(editeurA, 'constat', id, { etat: 'risque_accepte' }, 1)).statusCode).toBe(422);
    expect((await etat(editeurA, 'constat', id, { etat: 'non_concernee', note: '   ' }, 1)).statusCode).toBe(422);
    // Date de revue : seulement pour un risque accepté, jamais passée.
    expect((await etat(editeurA, 'constat', id, { etat: 'en_cours', revueLe: '2099-01-01' }, 1)).statusCode).toBe(422);
    expect(
      (await etat(editeurA, 'constat', id, { etat: 'risque_accepte', note: 'Accepté.', revueLe: '2020-01-01' }, 1))
        .statusCode,
    ).toBe(422);
    const r2 = await etat(
      editeurA,
      'constat',
      id,
      { etat: 'risque_accepte', note: 'Risque accepté par le comité fictif.', revueLe: '2099-06-30' },
      1,
    );
    expect(r2.statusCode, r2.body).toBe(200);
    expect(r2.json()).toMatchObject({
      etat: 'risque_accepte',
      revueLe: '2099-06-30',
      revueDepassee: false,
      version: 2,
    });
    // Renouveler l'acceptation (même état) est admis ; quitter le risque accepté efface la date de revue.
    expect(
      (await etat(editeurA, 'constat', id, { etat: 'risque_accepte', note: 'Renouvelé.', revueLe: '2099-12-31' }, 2))
        .statusCode,
    ).toBe(200);
    const r3 = await etat(editeurA, 'constat', id, { etat: 'en_cours' }, 3);
    expect(r3.json()).toMatchObject({ etat: 'en_cours', revueLe: null, version: 4 });
    const s = await suivi(admin, 'constat', id);
    expect(s.historique.map((h) => [h.evenement, h.etatAvant, h.etatApres, h.auteur])).toEqual([
      ['changement', 'risque_accepte', 'en_cours', 'suivi_editeur_a'],
      ['changement', 'risque_accepte', 'risque_accepte', 'suivi_editeur_a'],
      ['changement', 'a_traiter', 'risque_accepte', 'suivi_editeur_a'],
      ['changement', 'nouvelle', 'a_traiter', 'suivi_editeur_a'],
    ]);
    expect(s.historique[2]!.note).toBe('Risque accepté par le comité fictif.');
    // Journal : identifiants et états seulement, ni note ni machine.
    const j = await audits('vulnerabilites.suivi.etat_modifie');
    expect(j).toHaveLength(4);
    expect(j[0]).toMatchObject({ username: 'suivi_editeur_a', details: { nature: 'constat', objet: id } });
    for (const x of j) {
      expect(JSON.stringify(x)).not.toContain('comité');
      sansMachine(JSON.stringify(x));
    }
    await etat(editeurA, 'constat', id, { etat: 'a_traiter' }, 4);
  });
});

describe('droits', () => {
  it('sans le droit de modifier : lecture seule ; constat touchant une machine non lisible : refus explicite', async () => {
    const id1 = await constatId('950001');
    const v = (await suivi(lecteurA, 'constat', id1)).version;
    expect((await suivi(lecteurA, 'constat', id1)).peutDecider).toBe(false);
    expect((await etat(lecteurA, 'constat', id1, { etat: 'en_cours' }, v)).statusCode).toBe(403);
    // 950002 touche la machine 2 (périmètre B), que l'éditeur de A ne lit pas : il voit le constat, sans décider.
    const id2 = await constatId('950002');
    const s = await suivi(editeurA, 'constat', id2);
    expect(s.peutDecider).toBe(false);
    expect(s.motifRefus).toMatch(/machines que vous ne pouvez pas lire/);
    const r = await etat(editeurA, 'constat', id2, { etat: 'en_cours' }, 0);
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/machines que vous ne pouvez pas lire/);
    expect(
      (await editeurA.post(`${V}/suivis/constat/${id2}/actions`, actionCorps(perimA), ifMatch(0))).statusCode,
    ).toBe(403);
    // L'éditeur qui lit A et B décide.
    expect((await suivi(editeurAB, 'constat', id2)).peutDecider).toBe(true);
    // Un objet inconnu, ou sans aucune machine lisible : 404.
    const sansDroit = await login(t, await makeUser(t, 'suivi_sans_perimetre', 'r_sv_modif', { rattache: false }));
    expect((await sansDroit.get(`${V}/suivis/constat/${id1}`)).statusCode).toBe(404);
    expect((await admin.get(`${V}/suivis/constat/00000000-0000-4000-8000-000000000000`)).statusCode).toBe(404);
    expect((await admin.get(`${V}/suivis/inconnue/${id1}`)).statusCode).toBe(422);
    expect(await n('vulnerabilites_suivis', 'constat_id = $1', [id2])).toBe(0);
  });
});

describe('actions du registre', () => {
  it('création sous l’identité de la personne, mention de l’origine, sans nom de machine ; nouvelle -> à traiter', async () => {
    const id = await constatId('950003');
    const s0 = await suivi(editeurA, 'constat', id);
    expect(s0.etat).toBe('nouvelle');
    const avant = await n('grc_objects', "kind = 'action'");
    const r = await editeurA.post(
      `${V}/suivis/constat/${id}/actions`,
      actionCorps(perimA, {
        titre: s0.preremplissage.titre,
        description: s0.preremplissage.description,
        echeance: '2099-03-31',
      }),
      ifMatch(0),
    );
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ etat: 'a_traiter', version: 1, nombreActions: 1 });
    expect(r.json().historique[0]).toMatchObject({
      evenement: 'action',
      etatAvant: 'nouvelle',
      etatApres: 'a_traiter',
    });
    expect(await n('grc_objects', "kind = 'action'")).toBe(avant + 1);
    const a = (await t.svc.db.one<{
      id: string;
      smsi_id: string;
      name: string;
      data: Record<string, unknown>;
      created_by: string;
    }>(
      `SELECT o.id, o.smsi_id, o.name, o.data, o.created_by FROM grc_objects o
       JOIN vulnerabilites_suivi_actions sa ON sa.action_id = o.id
       JOIN vulnerabilites_suivis s ON s.id = sa.suivi_id WHERE s.constat_id = $1`,
      [id],
    ))!;
    expect(a.created_by).toBe('suivi_editeur_a');
    expect(a.smsi_id).toBe(perimA);
    expect(a.data.justification).toBe(
      'Créée depuis le module Vulnérabilités (contrôle n° 950003 de Tenable Security Center).',
    );
    expect(a.data.status).toBe('todo');
    expect(a.data.dueAt).toBe('2099-03-31T12:00:00.000Z');
    sansMachine(JSON.stringify(a));
    // Journal du registre et du module : sous l'identité de la personne, sans nom ni adresse de machine.
    const g = (await audits('grc.object.created')).filter((x) => x.target === a.id);
    expect(g).toHaveLength(1);
    expect(g[0]!.username).toBe('suivi_editeur_a');
    const j = await audits('vulnerabilites.suivi.action_creee');
    expect(j.at(-1)).toMatchObject({
      username: 'suivi_editeur_a',
      details: { nature: 'constat', objet: id, action: a.id, perimetre: perimA, avant: 'nouvelle', apres: 'a_traiter' },
    });
    for (const x of j) sansMachine(JSON.stringify(x));
    // L'action liée est affichée avec son état ; un lecteur des vulnérabilités sans droit sur les actions n'en voit rien.
    const s = await suivi(editeurA, 'constat', id);
    expect(s.actions).toEqual([
      expect.objectContaining({ lisible: true, id: a.id, statut: 'todo', statutLibelle: 'À faire' }),
    ]);
    const aveugle = await login(t, await makeUser(t, 'suivi_aveugle', 'r_sv_seul', { rattache: false }));
    await t.svc.db.q(
      'INSERT INTO grc_members(smsi_id, user_id, can_write) SELECT $1, id, false FROM users WHERE username = $2',
      [perimA, 'suivi_aveugle'],
    );
    expect((await suivi(aveugle, 'constat', id)).actions).toEqual([{ lisible: false, relieLe: expect.any(String) }]);
  });

  it('sans ces droits, rien n’est créé : périmètre non inscriptible, sans droit des actions, module désactivé', async () => {
    const id = await constatId('950001');
    const v = (await suivi(editeurAB, 'constat', id)).version;
    const avant = await n('grc_objects', "kind = 'action'");
    // Périmètre B lisible mais pas inscriptible ; périmètre C inaccessible.
    expect(
      (await editeurAB.post(`${V}/suivis/constat/${id}/actions`, actionCorps(perimB), ifMatch(v))).statusCode,
    ).toBe(403);
    expect(
      (await editeurAB.post(`${V}/suivis/constat/${id}/actions`, actionCorps(perimC), ifMatch(v))).statusCode,
    ).toBe(404);
    // Droit de modifier les vulnérabilités sans droit du module des actions.
    expect(
      (await sansActions.post(`${V}/suivis/constat/${id}/actions`, actionCorps(perimA), ifMatch(v))).statusCode,
    ).toBe(403);
    // Module des actions désactivé.
    await t.svc.db.q("UPDATE module_activation SET disabled='{ecarts}', version=version+1 WHERE id=1");
    try {
      const r = await editeurA.post(`${V}/suivis/constat/${id}/actions`, actionCorps(perimA), ifMatch(v));
      expect(r.statusCode).toBe(409);
      expect(r.json().reason).toBe('module_disabled');
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
    }
    expect(await n('grc_objects', "kind = 'action'")).toBe(avant);
    expect((await suivi(admin, 'constat', id)).version).toBe(v);
  });

  it('relier une action lisible, refuser une action non lisible, délier ; la clôture de l’action ne change rien', async () => {
    const id = await constatId('950002');
    const creer = async (smsi: string, name: string) => {
      const r = await admin.post(`/api/grc/${smsi}/objects`, {
        kind: 'action',
        name,
        data: {
          description: '',
          status: 'todo',
          ownerId: null,
          startAt: null,
          dueAt: null,
          priority: 'normal',
          category: 'action',
          justification: '',
          reminderDays: 7,
          dependencies: [],
        },
      });
      expect(r.statusCode, r.body).toBe(200);
      return r.json() as { id: string; version: number; name: string; data: Record<string, unknown> };
    };
    const lisibleA = await creer(perimA, 'Action fictive existante');
    const horsC = await creer(perimC, 'Action fictive inaccessible');
    expect((await suivi(editeurAB, 'constat', id)).etat).toBe('nouvelle');
    expect(
      (await editeurAB.post(`${V}/suivis/constat/${id}/liens`, { actionId: horsC.id }, ifMatch(0))).statusCode,
    ).toBe(404);
    const r = await editeurAB.post(`${V}/suivis/constat/${id}/liens`, { actionId: lisibleA.id }, ifMatch(0));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ etat: 'a_traiter', version: 1, nombreActions: 1 });
    expect(r.json().historique[0]).toMatchObject({
      evenement: 'action',
      etatAvant: 'nouvelle',
      etatApres: 'a_traiter',
    });
    expect(
      (await editeurAB.post(`${V}/suivis/constat/${id}/liens`, { actionId: lisibleA.id }, ifMatch(1))).statusCode,
    ).toBe(409);
    // Clôture de l'action dans le registre : l'état de la faille ne change pas, l'action liée se dit terminée.
    const enCours = await admin.put(
      `/api/grc/${perimA}/objects/${lisibleA.id}`,
      { kind: 'action', name: lisibleA.name, data: { ...lisibleA.data, status: 'progress' } },
      ifMatch(lisibleA.version),
    );
    expect(enCours.statusCode, enCours.body).toBe(200);
    const fini = await admin.put(
      `/api/grc/${perimA}/objects/${lisibleA.id}`,
      {
        kind: 'action',
        name: lisibleA.name,
        data: { ...lisibleA.data, status: 'done', justification: 'Correctif fictif appliqué.' },
      },
      ifMatch(enCours.json().version),
    );
    expect(fini.statusCode, fini.body).toBe(200);
    const s = await suivi(editeurAB, 'constat', id);
    expect(s.etat).toBe('a_traiter');
    expect(s.actions[0]).toMatchObject({ lisible: true, statut: 'done', terminee: true });
    // Délier : l'état reste ; une action non liée : 404.
    const d = await editeurAB.del(`${V}/suivis/constat/${id}/liens/${lisibleA.id}`, ifMatch(s.version));
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json()).toMatchObject({ etat: 'a_traiter', nombreActions: 0, version: s.version + 1 });
    expect(
      (await editeurAB.del(`${V}/suivis/constat/${id}/liens/${lisibleA.id}`, ifMatch(s.version + 1))).statusCode,
    ).toBe(404);
    const j = [
      ...(await audits('vulnerabilites.suivi.action_reliee')),
      ...(await audits('vulnerabilites.suivi.action_deliee')),
    ];
    expect(j).toHaveLength(2);
    for (const x of j) sansMachine(JSON.stringify(x));
  });
});

describe('proposition « corrigée »', () => {
  it('après une synchronisation complète seulement ; liste « à clore » ; refus avec note ; confirmation ; réapparition', async () => {
    const id = await constatId('950003');
    const v0 = (await suivi(admin, 'constat', id)).version;
    // Synchronisation incomplète sans 950003 : rien n'est proposé.
    await synchroniser(parc(['950003']), { tronque: true });
    expect((await suivi(admin, 'constat', id)).proposition).toBe('aucune');
    expect(await plugins(admin)).toContain('950003');
    // Synchronisation complète sans 950003 : proposition, par le système.
    await synchroniser(parc(['950003']));
    const s1 = await suivi(admin, 'constat', id);
    expect(s1).toMatchObject({ etat: 'a_traiter', proposition: 'a_confirmer', present: false, version: v0 + 1 });
    expect(s1.historique[0]).toMatchObject({ evenement: 'proposition', etatAvant: 'a_traiter', auteur: 'système' });
    expect(await plugins(admin)).not.toContain('950003');
    const aClore = (await admin.get(`${V}/constats?etat=a_clore`)).json().elements as {
      plugin: string;
      present: boolean;
      machines: number;
      suivi: { proposition: string };
    }[];
    expect(aClore.map((c) => c.plugin)).toEqual(['950003']);
    expect(aClore[0]).toMatchObject({ present: false, machines: 1, suivi: { proposition: 'a_confirmer' } });
    // Le lecteur du périmètre A la voit encore (machine où il a été vu en dernier) ; la fiche reste ouverte.
    expect(await plugins(lecteurA, '?etat=a_clore')).toEqual(['950003']);
    const parRole = (await lecteurA.get(`${V}/constats/${id}`)).json().parRole as Record<string, unknown[]>;
    expect(Object.values(parRole).flat()).toHaveLength(1);
    // Une deuxième synchronisation complète ne repropose rien.
    await synchroniser(parc(['950003']));
    expect((await suivi(admin, 'constat', id)).version).toBe(v0 + 1);
    // Refus : note obligatoire ; l'état reste ; la faille revient dans la liste par défaut.
    expect((await editeurA.post(`${V}/suivis/constat/${id}/refus`, { note: ' ' }, ifMatch(v0 + 1))).statusCode).toBe(
      422,
    );
    const refus = await editeurA.post(
      `${V}/suivis/constat/${id}/refus`,
      { note: 'Correctif non déployé.' },
      ifMatch(v0 + 1),
    );
    expect(refus.statusCode, refus.body).toBe(200);
    expect(refus.json()).toMatchObject({ etat: 'a_traiter', proposition: 'refusee' });
    expect(refus.json().historique[0]).toMatchObject({ evenement: 'refus', note: 'Correctif non déployé.' });
    expect(await plugins(admin)).toContain('950003');
    expect((await editeurA.post(`${V}/suivis/constat/${id}/refus`, { note: 'x' }, ifMatch(v0 + 2))).statusCode).toBe(
      409,
    );
    // Réapparition après un refus : la proposition refusée s'efface, sans changer l'état.
    await synchroniser(parc());
    expect(await suivi(admin, 'constat', id)).toMatchObject({ etat: 'a_traiter', proposition: 'aucune' });
    // Disparition, nouvelle proposition, confirmée par une personne.
    await synchroniser(parc(['950003']));
    const s2 = await suivi(admin, 'constat', id);
    expect(s2.proposition).toBe('a_confirmer');
    const ok = await etat(editeurA, 'constat', id, { etat: 'corrigee', note: 'Confirmé.' }, s2.version);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ etat: 'corrigee', proposition: 'aucune' });
    expect(await plugins(admin, '?etat=a_clore')).toEqual([]);
    expect(await plugins(admin, '?etat=corrigee')).toEqual(['950003']);
    expect(await plugins(admin)).not.toContain('950003');
    // Réapparition : « à traiter », entrée « réapparue » du système.
    await synchroniser(parc());
    const s3 = await suivi(admin, 'constat', id);
    expect(s3).toMatchObject({ etat: 'a_traiter', proposition: 'aucune', present: true });
    expect(s3.historique[0]).toMatchObject({
      evenement: 'reapparition',
      etatAvant: 'corrigee',
      etatApres: 'a_traiter',
      auteur: 'système',
    });
    expect(await plugins(admin)).toContain('950003');
    const j = await audits('vulnerabilites.suivi.synchronisation');
    expect(j.length).toBeGreaterThanOrEqual(3);
    for (const x of j) sansMachine(JSON.stringify(x));
  });

  it('« corrigée » décidée alors que Tenable rapporte encore la faille : rien n’est remis tant qu’elle n’a pas disparu', async () => {
    const id = await constatId('950001');
    const v = (await suivi(admin, 'constat', id)).version;
    expect((await etat(admin, 'constat', id, { etat: 'corrigee' }, v)).statusCode).toBe(200);
    await synchroniser(parc());
    expect((await suivi(admin, 'constat', id)).etat).toBe('corrigee');
    expect(
      ((await admin.get(`${V}/constats?etat=corrigee`)).json().elements as { plugin: string; present: boolean }[]).find(
        (c) => c.plugin === '950001',
      ),
    ).toMatchObject({ present: true });
    await etat(admin, 'constat', id, { etat: 'a_traiter' }, v + 1);
  });
});

describe('compteurs, rang et date de revue', () => {
  it('une faille close sort des compteurs et du rang ; la priorité reste ; date de revue dépassée signalée', async () => {
    const m3 = async () =>
      (await admin.get(`${V}/machines?q=srv-suivi-03`)).json().elements[0] as {
        compteurs: { critique: number; moyenne: number };
        rang: { position: number };
      };
    const avant = await m3();
    expect(avant.compteurs).toMatchObject({ critique: 1, moyenne: 1 });
    const id = await constatId('950001');
    const v = (await suivi(admin, 'constat', id)).version;
    const r = await etat(admin, 'constat', id, { etat: 'non_concernee', note: 'Service fictif arrêté.' }, v);
    expect(r.statusCode, r.body).toBe(200);
    expect((await m3()).compteurs).toMatchObject({ critique: 0, moyenne: 1 });
    expect(await plugins(admin)).not.toContain('950001');
    const nc = (await admin.get(`${V}/constats?etat=non_concernee`)).json().elements as {
      plugin: string;
      priorite: { niveau: string };
    }[];
    expect(nc.find((c) => c.plugin === '950001')?.priorite.niveau).toBe('P2');
    expect((await admin.get(`${V}/constats?etat=tous`)).json().total).toBe(3);
    // Risque accepté avec une date de revue passée (écrite en base, l'API refusant une date passée) : signal calculé.
    const r2 = await etat(
      admin,
      'constat',
      id,
      { etat: 'risque_accepte', note: 'Accepté.', revueLe: '2099-01-01' },
      v + 1,
    );
    expect(r2.statusCode, r2.body).toBe(200);
    await t.svc.db.q("UPDATE vulnerabilites_suivis SET revue_le = '2020-01-01' WHERE constat_id = $1", [id]);
    const ra = (
      (await admin.get(`${V}/constats?etat=risque_accepte`)).json().elements as {
        plugin: string;
        suivi: { revueDepassee: boolean; etat: string };
      }[]
    ).find((c) => c.plugin === '950001');
    expect(ra?.suivi).toMatchObject({ etat: 'risque_accepte', revueDepassee: true });
    expect(await suivi(admin, 'constat', id)).toMatchObject({ etat: 'risque_accepte', revueDepassee: true });
  });
});

describe('faille déclarée', () => {
  it('plus rattachée après un changement de version : proposée « corrigée », puis réapparue', async () => {
    await t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('nvd', 'manuel', 'test')",
    );
    const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    const element = {
      cve: 'CVE-2026-95101',
      publieLe: '2026-06-26T15:16:40.587Z',
      modifieLe: '2026-11-14T19:16:50.940Z',
      description: 'Fictional NVD description.',
      cvss31: { score: 9.8, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', gravite: 'CRITICAL' },
      cvss40: null,
      editeurs: ['editeur_suivi'],
      produits: ['produit_suivi'],
      produitsTouches: [
        {
          partie: 'a',
          editeur: 'editeur_suivi',
          produit: 'produit_suivi',
          version: null,
          debutInclus: null,
          debutExclus: null,
          finInclus: null,
          finExclus: '2.0',
          vulnerable: true,
        },
      ],
      produitsTronques: false,
    };
    await t.svc.vulnerabilites.veille.lot(job.id as string, { elements: [element] });
    await t.svc.vulnerabilites.veille.terminer(job.id as string, {
      ok: true,
      bilan: { elements: 1, ecartes: 0, tronque: false, detailsEchoues: 0 },
      erreur: null,
    });
    const p = await admin.post(`${V}/produits`, {
      editeur: 'Éditeur suivi',
      nom: 'Produit suivi',
      versionProduit: '1.5',
      cpe: CPE,
      famille: 'applications_metier',
      criticite: 'elevee',
    });
    expect(p.statusCode, p.body).toBe(201);
    const m3 = (await t.svc.db.one<{ id: string }>(
      'SELECT id FROM vulnerabilites_machines WHERE identifiant_source = $1',
      [`uuid:${uuidMachine(3)}`],
    ))!.id;
    const l = await admin.post(`${V}/produits/${p.json().id}/machines`, { machineId: m3 }, ifMatch(p.json().version));
    expect(l.statusCode, l.body).toBe(200);
    const liste = (await editeurA.get(`${V}/declarees`)).json().elements as {
      rapprochementId: string;
      cve: string;
      present: boolean;
      suivi: { etat: string };
    }[];
    expect(liste.map((x) => x.cve)).toEqual(['CVE-2026-95101']);
    const rid = liste[0]!.rapprochementId;
    expect(liste[0]).toMatchObject({ present: true, suivi: { etat: 'nouvelle' } });
    const fiche = (await editeurA.get(`${V}/declarees/${rid}`)).json();
    expect(fiche).toMatchObject({ cve: 'CVE-2026-95101', description: 'Fictional NVD description.' });
    expect(fiche.machinesReliees).toHaveLength(1);
    const s0 = await suivi(editeurA, 'declaree', rid);
    expect(s0.preremplissage.titre).toBe('Corriger CVE-2026-95101 : Éditeur suivi Produit suivi 1.5');
    sansMachine(JSON.stringify(s0.preremplissage));
    // Action créée depuis la faille déclarée : mention de la CVE, pas de machine.
    const a = await editeurA.post(`${V}/suivis/declaree/${rid}/actions`, actionCorps(perimA), ifMatch(0));
    expect(a.statusCode, a.body).toBe(201);
    expect(a.json().etat).toBe('a_traiter');
    const action = (await t.svc.db.one<{ data: Record<string, unknown> }>(
      `SELECT o.data FROM grc_objects o JOIN vulnerabilites_suivi_actions sa ON sa.action_id = o.id
       JOIN vulnerabilites_suivis s ON s.id = sa.suivi_id WHERE s.rapprochement_id = $1`,
      [rid],
    ))!;
    expect(action.data.justification).toBe('Créée depuis le module Vulnérabilités (faille déclarée CVE-2026-95101).');
    // Version du produit changée, hors plage : le rapprochement est écarté, la faille proposée « corrigée ».
    const ver = (await admin.get(`${V}/produits/${p.json().id}`)).json().version as number;
    const maj = await admin.patch(`${V}/produits/${p.json().id}`, { versionProduit: '2.1' }, ifMatch(ver));
    expect(maj.statusCode, maj.body).toBe(200);
    const s1 = await suivi(editeurA, 'declaree', rid);
    expect(s1).toMatchObject({ etat: 'a_traiter', proposition: 'a_confirmer', present: false });
    expect(s1.historique[0]).toMatchObject({ evenement: 'proposition', auteur: 'système' });
    expect((await editeurA.get(`${V}/declarees`)).json().total).toBe(0);
    expect(
      ((await editeurA.get(`${V}/declarees?etat=a_clore`)).json().elements as { cve: string; present: boolean }[]).map(
        (x) => [x.cve, x.present],
      ),
    ).toEqual([['CVE-2026-95101', false]]);
    // Confirmée, puis la version revient dans la plage : réapparue, « à traiter ».
    expect((await etat(editeurA, 'declaree', rid, { etat: 'corrigee' }, s1.version)).statusCode).toBe(200);
    const ver2 = (await admin.get(`${V}/produits/${p.json().id}`)).json().version as number;
    expect(
      (await admin.patch(`${V}/produits/${p.json().id}`, { versionProduit: '1.6' }, ifMatch(ver2))).statusCode,
    ).toBe(200);
    const s2 = await suivi(editeurA, 'declaree', rid);
    expect(s2).toMatchObject({ etat: 'a_traiter', present: true });
    expect(s2.historique[0]).toMatchObject({ evenement: 'reapparition', auteur: 'système' });
    // Une faille déclarée close sort des compteurs de la machine.
    const compte = async () =>
      ((await admin.get(`${V}/machines?q=srv-suivi-03`)).json().elements[0] as { compteurs: { declarees: number } })
        .compteurs.declarees;
    expect(await compte()).toBe(1);
    expect(
      (await etat(editeurA, 'declaree', rid, { etat: 'non_concernee', note: 'Module fictif désactivé.' }, s2.version))
        .statusCode,
    ).toBe(200);
    expect(await compte()).toBe(0);
    const j = await audits('vulnerabilites.suivi.rapprochement');
    expect(j.map((x) => x.details)).toEqual([
      { propositions: 1, retraits: 0, reapparitions: 0 },
      { propositions: 0, retraits: 0, reapparitions: 1 },
    ]);
  });
});
