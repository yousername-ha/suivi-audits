/* Module Vulnérabilités (ADR 0100, lot PC1) : route de la « Vue d'ensemble » (poste de commandement). Migrations sur base
   vierge.
   - Niveau d'alerte, priorités, secteurs, tuiles et cases du radar : les mêmes pour deux personnes aux droits différents
     (principe du lot ALH5) ;
   - nombres de machines limités à ce que chacune lit, drapeau sans nombre pour le reste, fiche seulement si elle lit une
     machine ; non-fuite des noms (machines, adresses, périmètres) ;
   - bornes (cibles par case, journal), totaux toujours rendus ;
   - lecture seule : aucune écriture, aucune entrée de journal d'audit ;
   - droit de lecture exigé, module désactivé.
   Données entièrement fictives : machines en .invalid, adresses de 192.0.2.0/24, CVE fictives ; aucun service n'est joint. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const URL = '/api/vulnerabilites/vue-ensemble';
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurB: Agent, sansDroit: Agent;
let perimA: string, perimB: string, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000009${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-vue-${String(n).padStart(2, '0')}.interne.invalid`;
const adresse = (n: number) => `192.0.2.${110 + n}`;
const NOMS_PERIMETRES = ['Périmètre fictif vue A', 'Périmètre fictif vue B'];
const EMPREINTE = 'a'.repeat(64);

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
const constat = (plugin: string, cves: string[], gravite: string) => ({
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
/** 45 constats sans CVE, de gravité faible, sur la machine 2 : P4, secteur « Non classé » (au-delà de la borne par case). */
const NOMBREUX = Array.from({ length: 45 }, (_, i) => String(921000 + i));
/** Parc : 920001 (CVE 92001, KEV) sur 1 et 2 : P1 ; 920002 (CVE 92002, critique) sur 1 : P2, aussi déclarée par le produit
    « web » relié à la machine 1 ; 920003 (CVE 92003, moyenne) sur 2 : P4 ; 920004 (sans CVE, critique) sur 2 : P2. */
const parc = (): Record<string, unknown>[] => [
  machine(1),
  machine(2),
  constat('920001', ['CVE-2026-92001'], 'elevee'),
  constat('920002', ['CVE-2026-92002'], 'critique'),
  constat('920003', ['CVE-2026-92003'], 'moyenne'),
  constat('920004', [], 'critique'),
  ...NOMBREUX.map((p) => constat(p, [], 'faible')),
  detection('920001', 1),
  detection('920001', 2),
  detection('920002', 1),
  detection('920003', 2),
  detection('920004', 2),
  ...NOMBREUX.map((p) => detection(p, 2)),
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
async function syncTenable(elements: Record<string, unknown>[]) {
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [tenable],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  expect(job).toMatchObject({ operation: 'synchroniser' });
  if (elements.length) await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat: bilanTenable(elements), erreur: null });
}
const kev = (cve: string) =>
  t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit) VALUES ($1, '2026-11-01', $2, 'Produit fictif')
     ON CONFLICT (cve) DO UPDATE SET kev_ajout = EXCLUDED.kev_ajout, kev_nom = EXCLUDED.kev_nom`,
    [cve, `Fictional Product ${cve.slice(-5)} Remote Code Execution`],
  );

interface Cible {
  cle: string;
  cve: string | null;
  titre: string;
  secteur: string;
  priorite: { niveau: string };
  presences: string[];
  exploitee: boolean;
  aConfirmer: boolean;
  etat: string | null;
  machines: { lisibles: number; horsLecture: boolean };
  actifs: { lisibles: number; horsLecture: boolean };
  produitId: string | null;
  fiche: { nature: string; id: string } | null;
}
interface Vue {
  niveau: { niveau: number; libelle: string; explication: string; faits: Record<string, number> };
  tuiles: Record<string, unknown>;
  total: number;
  parPriorite: Record<string, number>;
  cases: { secteur: string; priorite: string; total: number }[];
  cibles: Cible[];
  tronquee: boolean;
  journal: Record<string, unknown>[];
}
/** Aucun nom de machine, adresse ni périmètre dans une réponse. */
const sansNom = (texte: string) => {
  for (const n of [1, 2]) {
    expect(texte).not.toContain(nomMachine(n));
    expect(texte).not.toContain(adresse(n));
  }
  expect(texte).not.toContain('srv-vue');
  for (const p of NOMS_PERIMETRES) expect(texte).not.toContain(p);
};
const vue = async (a: Agent): Promise<Vue> => {
  const r = await a.get(URL);
  expect(r.statusCode, r.body).toBe(200);
  sansNom(r.body);
  return r.json() as Vue;
};
const cible = (v: Vue, cle: string) => {
  const c = v.cibles.find((x) => x.cle === cle);
  expect(c, cle).toBeDefined();
  return c!;
};
/** Ce qui doit être identique pour tout le monde : tout, sauf les nombres lisibles et la fiche. */
const commun = (v: Vue) => ({
  niveau: v.niveau,
  tuiles: v.tuiles,
  total: v.total,
  parPriorite: v.parPriorite,
  cases: v.cases,
  tronquee: v.tronquee,
  cibles: v.cibles.map(({ machines: _m, actifs: _a, fiche: _f, ...reste }) => reste),
});

beforeAll(async () => {
  t = await createTestApp();
  const uAdmin = await makeUser(t, 'vue_admin', 'admin');
  admin = await login(t, uAdmin);
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES ('r_vue_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[0], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[1], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uA = await makeUser(t, 'vue_lecteur_a', 'r_vue_lire', { rattache: false });
  const uB = await makeUser(t, 'vue_lecteur_b', 'r_vue_lire', { rattache: false });
  const uSans = await makeUser(t, 'vue_sans_droit', 'rw');
  await t.svc.db.q(`INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, false), ($2, $4, false)`, [
    perimA,
    perimB,
    uA.id,
    uB.id,
  ]);
  lecteurA = await login(t, uA);
  lecteurB = await login(t, uB);
  sansDroit = await login(t, uSans);
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
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('lot PC1 : vue d’ensemble du module Vulnérabilités', () => {
  it('pile vierge : niveau 1 (Veille), aucune faille suivie, aucun point', async () => {
    const v = await vue(lecteurA);
    expect(v.niveau).toMatchObject({ niveau: 1, libelle: 'Veille' });
    expect(v.total).toBe(0);
    expect(v.cibles).toEqual([]);
    expect(v.cases).toEqual([]);
    expect(v.tronquee).toBe(false);
    expect(v.tuiles).toEqual({
      exploiteesPresentes: 0,
      aTraiter: { p1: 0, p2: 0 },
      aConfirmer: { failles: 0, produits: 0 },
      corrigeesCeMois: 0,
      enDepassement: 0,
    });
  });

  it('droits : lecture du module exigée', async () => {
    expect((await sansDroit.get(URL)).statusCode).toBe(403);
  });

  it('données : synchronisation de Tenable, produits surveillés, proposition à confirmer', async () => {
    await syncTenable([machine(1), machine(2)]);
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $1 WHERE nom = $2', [perimA, nomMachine(1)]);
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $1 WHERE nom = $2', [perimB, nomMachine(2)]);
    await kev('CVE-2026-92001');
    await kev('CVE-2026-92005');
    await t.svc.db.q("INSERT INTO vulnerabilites_veille_cve (cve) VALUES ('CVE-2026-92002') ON CONFLICT DO NOTHING");
    const produit = async (nom: string, famille: string) =>
      (await t.svc.db.one<{ id: string }>(
        `INSERT INTO vulnerabilites_produits (editeur, nom, version_produit, famille, criticite, created_by, updated_by)
         VALUES ('Éditeur fictif', $1, '1.0', $2, 'elevee', 'test', 'test') RETURNING id`,
        [nom, famille],
      ))!.id;
    const web = await produit('Produit fictif web', 'web');
    const reseau = await produit('Produit fictif réseau', 'reseau');
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_produits_machines (produit_id, machine_id, relie_par)
       SELECT $1, id, 'test' FROM vulnerabilites_machines WHERE nom = $2`,
      [web, nomMachine(1)],
    );
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_rapprochements
         (produit_id, cve, statut, motif, version_dans_plage, par_identifiant, empreinte_produit, empreinte_cve)
       VALUES ($1, 'CVE-2026-92002', 'rattachee', NULL, 'oui', true, $3, $3),
              ($2, 'CVE-2026-92005', 'proposee', 'nom_seulement', NULL, false, $3, $3)`,
      [web, reseau, EMPREINTE],
    );
    await syncTenable(parc());
  }, 60_000);

  it('niveau, priorités et secteurs identiques pour deux personnes aux droits différents', async () => {
    const a = await vue(lecteurA);
    const b = await vue(lecteurB);
    const ad = await vue(admin);
    expect(commun(a)).toEqual(commun(b));
    expect(commun(a)).toEqual(commun(ad));
    // Niveau 4 : CVE-2026-92001 exploitée (KEV) et présente.
    expect(a.niveau).toMatchObject({ niveau: 4, libelle: 'Maximale' });
    expect(a.niveau.explication).toMatch(/^1 faille exploitée et présente chez nous \(P1\)/);
    expect(a.niveau.faits).toMatchObject({ critiques: 1, exploiteesAConfirmer: 1 });
    // 4 failles du parc + 45 constats sans CVE + 1 proposition.
    expect(a.total).toBe(50);
    expect(a.parPriorite).toEqual({ P1: 1, P2: 3, P3: 0, P4: 46 });
    expect(a.tuiles).toEqual({
      exploiteesPresentes: 1,
      aTraiter: { p1: 1, p2: 3 },
      aConfirmer: { failles: 1, produits: 1 },
      corrigeesCeMois: 0,
      // Lot S1 : objets suivis présents en P1 et P2, détectés depuis juillet : délai dépassé.
      enDepassement: 3,
    });
    // Ordre : P1 d'abord, puis la P2 exploitée à confirmer, puis les P2 critiques.
    expect(a.cibles.slice(0, 2).map((c) => c.cle)).toEqual(['CVE-2026-92001', 'CVE-2026-92005']);
    expect(cible(a, 'CVE-2026-92001')).toMatchObject({
      secteur: 'non_classe',
      priorite: { niveau: 'P1' },
      exploitee: true,
      aConfirmer: false,
      etat: 'nouvelle',
      titre: 'Fictional Product 92001 Remote Code Execution',
    });
    expect(cible(a, 'CVE-2026-92002')).toMatchObject({
      secteur: 'web',
      priorite: { niveau: 'P2' },
      presences: ['detectee', 'declaree'],
    });
    expect(cible(a, 'CVE-2026-92005')).toMatchObject({
      secteur: 'reseau',
      priorite: { niveau: 'P2' },
      presences: ['a_confirmer'],
      aConfirmer: true,
      exploitee: true,
      etat: null,
    });
  });

  it('nombres de machines et fiche : seulement ce que la personne lit, drapeau sans nombre pour le reste', async () => {
    const a = await vue(lecteurA);
    const b = await vue(lecteurB);
    expect(cible(a, 'CVE-2026-92001').machines).toEqual({ lisibles: 1, horsLecture: true });
    expect(cible(b, 'CVE-2026-92001').machines).toEqual({ lisibles: 1, horsLecture: true });
    expect(cible(a, 'CVE-2026-92002').machines).toEqual({ lisibles: 1, horsLecture: false });
    expect(cible(b, 'CVE-2026-92002').machines).toEqual({ lisibles: 0, horsLecture: true });
    expect(cible(a, 'CVE-2026-92002').fiche).toMatchObject({ nature: 'constat' });
    expect(cible(b, 'CVE-2026-92002').fiche).toBeNull();
    // La fiche rendue s'ouvre bien pour la personne (route existante).
    const fiche = cible(a, 'CVE-2026-92002').fiche!;
    expect((await lecteurA.get(`/api/vulnerabilites/constats/${fiche.id}`)).statusCode).toBe(200);
    expect((await lecteurB.get(`/api/vulnerabilites/constats/${fiche.id}`)).statusCode).toBe(404);
    // Proposition : aucune machine, aucune fiche.
    expect(cible(a, 'CVE-2026-92005')).toMatchObject({ machines: { lisibles: 0, horsLecture: false }, fiche: null });
    // Administrateur du module : il lit tout, aucun drapeau.
    const ad = await vue(admin);
    expect(cible(ad, 'CVE-2026-92001').machines).toEqual({ lisibles: 2, horsLecture: false });
  });

  it('bornes : 40 cibles au plus par case, totaux toujours rendus', async () => {
    const v = await vue(lecteurA);
    const nonClasseP4 = v.cases.find((c) => c.secteur === 'non_classe' && c.priorite === 'P4');
    expect(nonClasseP4?.total).toBe(46);
    expect(v.cibles.filter((c) => c.secteur === 'non_classe' && c.priorite.niveau === 'P4')).toHaveLength(40);
    expect(v.tronquee).toBe(true);
    expect(v.cases.reduce((s, c) => s + c.total, 0)).toBe(v.total);
    expect(v.journal.length).toBeLessThanOrEqual(12);
  });

  it('journal : traces existantes (synchronisations, alertes), sans nom ni texte d’erreur', async () => {
    const v = await vue(lecteurB);
    expect(v.journal).toContainEqual(
      expect.objectContaining({
        nature: 'synchronisation',
        connecteur: 'tenable',
        nom: 'Tenable fictif',
        etat: 'recu',
      }),
    );
    expect(v.journal).toContainEqual(
      expect.objectContaining({ nature: 'alerte_ouverte', cve: 'CVE-2026-92001', niveau: 'critique' }),
    );
    for (const e of v.journal) expect(Object.keys(e)).not.toContain('erreur');
  });

  it('lecture seule : aucune écriture, aucune entrée de journal d’audit', async () => {
    const etat = async () => ({
      audit: (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n,
      alertes: (
        await t.svc.db.q<{ id: string; version: number }>('SELECT id, version FROM vulnerabilites_alertes ORDER BY id')
      ).rows,
      suivis: (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_suivis'))!.n,
    });
    const avant = await etat();
    await vue(lecteurA);
    await vue(lecteurB);
    await vue(admin);
    expect(await etat()).toEqual(avant);
  });

  it('corrigées ce mois : état de suivi existant', async () => {
    const c = (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = 920003'))!
      .id;
    const r = await admin.post(`/api/vulnerabilites/suivis/constat/${c}/etat`, { etat: 'corrigee' }, ifMatch(0));
    expect(r.statusCode, r.body).toBe(200);
    const v = await vue(lecteurA);
    expect(v.tuiles.corrigeesCeMois).toBe(1);
    // Faille traitée : plus suivie.
    expect(v.cibles.find((x) => x.cle === 'CVE-2026-92003')).toBeUndefined();
    expect(v.total).toBe(49);
  });

  it('module désactivé : la route ne répond plus', async () => {
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      expect([403, 409]).toContain((await lecteurA.get(URL)).statusCode);
      expect([403, 409]).toContain((await admin.get(URL)).statusCode);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });
});
