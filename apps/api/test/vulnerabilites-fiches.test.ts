/* Module Vulnérabilités (ADR 0100, point 19 ; lot PC4) : fiche illustrée d'une faille. Migrations sur base vierge.
   - vecteurs publiés rendus par source (NVD v3.1 et v4.0, Tenable v3), règle des sources pour celui qui parle ; constat sans
     vecteur : aucun vecteur ;
   - recommandations par source, telles quelles : correctif de Tenable, action exigée du catalogue KEV, versions touchées selon
     NVD, avis du CERT-FR, défauts et résolutions de l'éditeur d'AlgoLightHouse (alertes lisibles seulement) ;
   - en-tête : priorité et marques les mêmes pour tous, alerte ouverte de la plateforme ;
   - droits et non-fuite : nombres de machines et d'actifs lus seulement, drapeau sans nombre pour le reste ; aucun nom de
     machine, d'adresse ni de périmètre ; constat, faille déclarée et alerte illisibles : 404 comme un inconnu ;
   - lecture seule : aucune écriture, aucune entrée de journal ; droit de lecture exigé, module désactivé.
   Données entièrement fictives : machines en .invalid, adresses de 192.0.2.0/24 et 198.51.100.0/24, CVE fictives ; aucun
   service n'est joint. */
import { vecteurRetenu, type FicheFailleDto } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const F = `${V}/fiches`;
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurB: Agent, sansDroit: Agent;
let perimA: string, perimB: string, tenable: string, alh: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const uuidMachine = (n: number) => `00000000-0000-4000-8000-${String(940000 + n).padStart(12, '0')}`;
const nomMachine = (n: number) => `srv-fiche-${n}.interne.invalid`;
const NOMS_PERIMETRES = ['Périmètre fictif fiche A', 'Périmètre fictif fiche B'];
const V31_RESEAU = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
const V31_LOCAL = 'CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H';
const V40 = 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N';
const TENABLE_LOCAL = 'AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H';
const CORRECTIF = 'Upgrade to version 8.3.29 or later.';
const DEFAUT = {
  nom: 'Outdated component',
  description: 'Fictional description of the outdated component.',
  resolutions: [{ nom: 'Update the component', description: null, facilite: 'Quick Win', gain: 'Strong' }],
};

/* ------------------------------------------------------------------ Tenable fictif */
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: nomMachine(n),
  adresse: `192.0.2.${40 + n}`,
  systeme: 'Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
const constat = (
  plugin: string,
  cves: string[],
  vecteur: string | null,
  score: number | null,
  gravite = 'critique',
) => ({
  type: 'constat',
  plugin,
  nom: `Produit fictif : contrôle fictif ${plugin}`,
  gravite,
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: CORRECTIF,
  cvss3Vecteur: vecteur,
  cvss3Score: score,
  vpr: null,
  epss: null,
  exploitable: false,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: '2026-11-02T00:00:00.000Z',
  finSupportLe: null,
  voirAussi: null,
  cves,
  cvesTronquees: false,
});
const detection = (plugin: string, n: number) => ({
  type: 'detection',
  plugin,
  machine: `uuid:${uuidMachine(n)}`,
  port: 443,
  protocole: 'TCP',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  attenue: false,
  risqueAccepte: false,
  risqueRequalifie: false,
});
/** Parc : machine 1 (A), 2 (B), 3 (sans périmètre).
    940001 : CVE 94001 (NVD v3.1 réseau, KEV) sur 1 et 2, vecteur de Tenable identique : P1, zero-day ;
    940002 : CVE 94002 (NVD v3.1 local, 6,7) sur 1, vecteur de Tenable différent (7,8) : Tenable parle ;
    940003 : CVE 94003 (NVD v4.0 seulement) sur 1 ;
    940004 : sans CVE ni vecteur, sur 1 et 3. */
const parc = (): Record<string, unknown>[] => [
  ...[1, 2, 3].map(machine),
  constat('940001', ['CVE-2026-94001'], 'AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 9.8),
  constat('940002', ['CVE-2026-94002'], TENABLE_LOCAL, 7.8, 'elevee'),
  constat('940003', ['CVE-2026-94003'], null, null),
  constat('940004', [], null, null, 'elevee'),
  detection('940001', 1),
  detection('940001', 2),
  detection('940002', 1),
  detection('940003', 1),
  detection('940004', 1),
  detection('940004', 3),
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
const alerte = (n: number, perim: number, cibleHote: number, cves: string[], defauts: unknown[]) => ({
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
  defauts,
  creeLe: '2026-11-10T10:00:00.000Z',
  majLe: '2026-11-15T10:00:00.000Z',
  termineeLe: null,
});
/** Périmètre ALH 1 (relié à A) : hôte 11, alerte 31 (CVE 94001, défauts). Périmètre ALH 2 (relié à B) : hôte 12, alerte 32
    (CVE 94001, défauts). */
const surface = (): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif 1' },
  { type: 'perimetre', id: U(2), nom: 'Périmètre ALH fictif 2' },
  hote(11, 1, '198.51.100.11'),
  hote(12, 2, '198.51.100.12'),
  alerte(31, 1, 11, ['CVE-2026-94001'], [DEFAUT]),
  alerte(32, 2, 12, ['CVE-2026-94001'], [{ ...DEFAUT, nom: 'Défaut réservé au périmètre B' }]),
];
const bilanAlh = (el: Record<string, unknown>[]) => {
  const c = (x: string) => el.filter((e) => e.type === x).length;
  return {
    elements: el.length,
    perimetres: c('perimetre'),
    hotes: c('hote'),
    domaines: 0,
    alertes: c('alerte'),
    details: c('alerte'),
    technologies: 0,
    ecartes: 0,
    tronque: false,
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
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat, erreur: null });
}
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

const constatId = async (plugin: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = $1', [plugin]))!.id;
const lire = async (a: Agent, nature: string, id: string): Promise<FicheFailleDto> => {
  const r = await a.get(`${F}/${nature}/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as FicheFailleDto;
};
/** Aucun nom de machine, aucune adresse, aucun nom de périmètre, aucun nom de dépôt dans la réponse. */
const sansNom = (x: unknown) => {
  const texte = JSON.stringify(x);
  for (const n of [1, 2, 3]) {
    expect(texte).not.toContain(nomMachine(n));
    expect(texte).not.toContain(`192.0.2.${40 + n}`);
  }
  for (const p of NOMS_PERIMETRES) expect(texte).not.toContain(p);
  expect(texte).not.toContain('198.51.100.');
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'fiche_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES ('r_fiche_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[0], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[1], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uA = await makeUser(t, 'fiche_lecteur_a', 'r_fiche_lire', { rattache: false });
  const uB = await makeUser(t, 'fiche_lecteur_b', 'r_fiche_lire', { rattache: false });
  await t.svc.db.q(`INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, false), ($2, $4, false)`, [
    perimA,
    perimB,
    uA.id,
    uB.id,
  ]);
  lecteurA = await login(t, uA);
  lecteurB = await login(t, uB);
  sansDroit = await login(t, await makeUser(t, 'fiche_sans_droit', 'rw'));
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

  // Veille : NVD par un lot (vecteurs validés par l'API), puis le catalogue KEV et un avis du CERT-FR posés en base.
  await t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
  await t.svc.db.q(
    "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('nvd', 'manuel', 'test')",
  );
  const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
  const nvd = (cve: string, cvss31: unknown, cvss40: unknown, produitsTouches: unknown[] = []) => ({
    cve,
    publieLe: '2026-06-26T15:16:40.587Z',
    modifieLe: '2026-11-14T19:16:50.940Z',
    description: 'Fictional NVD description.',
    cvss31,
    cvss40,
    editeurs: ['editeur_fiche'],
    produits: ['produit_fiche'],
    produitsTouches,
    produitsTronques: false,
  });
  const plage = {
    partie: 'a',
    editeur: 'editeur_fiche',
    produit: 'produit_fiche',
    version: null,
    debutInclus: '1.0',
    debutExclus: null,
    finInclus: null,
    finExclus: '2.0',
    vulnerable: true,
  };
  await t.svc.vulnerabilites.veille.lot(job.id as string, {
    elements: [
      nvd('CVE-2026-94001', { score: 9.8, vecteur: V31_RESEAU, gravite: 'CRITICAL' }, null, [plage]),
      nvd('CVE-2026-94002', { score: 6.7, vecteur: V31_LOCAL, gravite: 'MEDIUM' }, null),
      nvd('CVE-2026-94003', null, { score: 9.3, vecteur: V40, gravite: 'CRITICAL' }),
      nvd('CVE-2026-94005', { score: 7.5, vecteur: V31_RESEAU, gravite: 'HIGH' }, null, [plage]),
    ],
  });
  await t.svc.vulnerabilites.veille.terminer(job.id as string, {
    ok: true,
    bilan: { elements: 4, ecartes: 0, tronque: false, detailsEchoues: 0 },
    erreur: null,
  });
  await t.svc.db.q(
    `UPDATE vulnerabilites_veille_cve SET kev_ajout = '2026-11-01', kev_echeance = '2026-12-03',
       kev_editeur = 'Editeur fictif', kev_produit = 'Produit fictif', kev_nom = 'Fictional Product RCE',
       kev_action = 'Apply mitigations per vendor instructions or discontinue use of the product.'
     WHERE cve = 'CVE-2026-94001'`,
  );
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, adresse, publie_le, cves, cves_lues)
     VALUES ('cert-fr', 'CERTFR-2026-ALE-900', 'alerte', 'Vulnérabilité fictive dans un produit fictif',
             'https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-900/', '2026-11-12T08:00:00Z', ARRAY['CVE-2026-94001'], true)`,
  );

  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
  t.svc.limits.integrationSynchro.reset();
  const el = parc();
  await synchroniser(tenable, el, bilanTenable(el));
  const s = surface();
  await synchroniser(alh, s, bilanAlh(s));
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimA]);
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(2), perimB]);
  const regler = (n: number, perimetre: string | null) =>
    t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE nom = $1', [nomMachine(n), perimetre]);
  await regler(1, perimA);
  await regler(2, perimB);
  await regler(3, null);
  // Alertes de la plateforme : réévaluées sur les faits complets (KEV et détection de CVE-2026-94001 : P1, critique).
  await t.svc.vulnerabilites.alertes.evaluer('test');
}, 90_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('lot PC4 : fiche illustrée d’une faille', () => {
  it('droits et validation : lecture du module exigée ; nature et identifiant contrôlés', async () => {
    const id = await constatId(940001);
    expect((await sansDroit.get(`${F}/constat/${id}`)).statusCode).toBe(403);
    expect((await lecteurA.get(`${F}/machine/${id}`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${F}/constat/CVE-2026-94001`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${F}/cve/${id}`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${F}/cve/CVE-2026-99999`)).statusCode).toBe(404);
    expect((await lecteurA.get(`${F}/constat/00000000-0000-4000-8000-000000000001`)).statusCode).toBe(404);
    expect((await lecteurA.get(`${F}/alerte-alh/00000000-0000-4000-8000-000000000001`)).statusCode).toBe(404);
  });

  it('constat : vecteurs de NVD et de Tenable, recommandations par source, en-tête et alerte ouverte', async () => {
    const f = await lire(lecteurA, 'constat', await constatId(940001));
    expect(f.nature).toBe('constat');
    expect(f.cves).toEqual(['CVE-2026-94001']);
    expect(f.composant).toBe('Editeur fictif Produit fictif');
    expect(f.priorite?.niveau).toBe('P1');
    expect(f.marques).toEqual({ zeroDay: true, exploitable: false });
    expect(f.alerte).toMatchObject({ niveau: 'critique', priorite: 'P1' });
    expect(f.vecteurs).toEqual([
      { source: 'tenable', cve: null, brut: 'AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', score: 9.8 },
      { source: 'nvd', cve: 'CVE-2026-94001', brut: V31_RESEAU, score: 9.8 },
    ]);
    // À score égal, NVD parle (règle des sources).
    expect(vecteurRetenu(f.vecteurs).retenu?.publie.source).toBe('nvd');
    expect(f.recommandations.tenable).toEqual({ correctif: CORRECTIF, publieLe: '2026-11-02T00:00:00.000Z' });
    expect(f.recommandations.kev).toEqual([
      {
        cve: 'CVE-2026-94001',
        action: 'Apply mitigations per vendor instructions or discontinue use of the product.',
        echeance: '2026-12-03',
      },
    ]);
    expect(f.recommandations.versionsNvd).toEqual([
      {
        cve: 'CVE-2026-94001',
        editeur: 'editeur_fiche',
        produit: 'produit_fiche',
        version: null,
        debutInclus: '1.0',
        debutExclus: null,
        finInclus: null,
        finExclus: '2.0',
      },
    ]);
    expect(f.recommandations.avis).toEqual([
      expect.objectContaining({
        source: 'cert-fr',
        identifiant: 'CERTFR-2026-ALE-900',
        nature: 'alerte',
        adresse: 'https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-900/',
      }),
    ]);
    // Recommandations de l'éditeur d'AlgoLightHouse : seulement l'alerte que la personne lit (périmètre ALH relié à A).
    expect(f.recommandations.alh).toEqual([expect.objectContaining({ titre: 'Alerte fictive 31', defauts: [DEFAUT] })]);
    expect(JSON.stringify(f)).not.toContain('Défaut réservé au périmètre B');
    expect(f.recommandations.alhTronquees).toBe(false);
  });

  it('règle des sources : le vecteur au score le plus sévère parle, les autres sont gardés', async () => {
    const f = await lire(admin, 'constat', await constatId(940002));
    expect(f.vecteurs.map((v) => [v.source, v.brut, v.score])).toEqual([
      ['tenable', TENABLE_LOCAL, 7.8],
      ['nvd', V31_LOCAL, 6.7],
    ]);
    const r = vecteurRetenu(f.vecteurs);
    expect(r.retenu?.publie.source).toBe('tenable');
    expect(r.autres.map((x) => x.publie.source)).toEqual(['nvd']);
    expect(f.recommandations.alh).toEqual([]);
  });

  it('CVSS v4.0 seul (NVD) ; constat sans CVE ni vecteur : aucun vecteur, aucune recommandation inventée', async () => {
    const v4 = await lire(admin, 'constat', await constatId(940003));
    expect(v4.vecteurs).toEqual([{ source: 'nvd', cve: 'CVE-2026-94003', brut: V40, score: 9.3 }]);
    const sans = await lire(admin, 'constat', await constatId(940004));
    expect(sans.vecteurs).toEqual([]);
    expect(sans.cves).toEqual([]);
    expect(sans.composant).toBe('Produit fictif : contrôle fictif 940004');
    expect(sans.recommandations).toEqual({
      tenable: { correctif: CORRECTIF, publieLe: '2026-11-02T00:00:00.000Z' },
      kev: [],
      kevTronque: false,
      versionsNvd: [],
      versionsNvdTronquees: false,
      certSante: null,
      avis: [],
      avisTronques: false,
      alh: [],
      alhTronquees: false,
    });
  });

  it('non-fuite : nombres lus seulement, drapeau sans nombre ; priorité la même pour tous ; aucun nom', async () => {
    const id = await constatId(940001);
    const a = await lire(lecteurA, 'constat', id);
    const b = await lire(lecteurB, 'constat', id);
    const ad = await lire(admin, 'constat', id);
    expect(a.presence).toEqual({ machines: 1, actifs: 1, horsLecture: true });
    expect(b.presence).toEqual({ machines: 1, actifs: 1, horsLecture: true });
    expect(ad.presence).toEqual({ machines: 2, actifs: 2, horsLecture: false });
    expect(b.priorite).toEqual(a.priorite);
    expect(ad.priorite).toEqual(a.priorite);
    expect(b.marques).toEqual(a.marques);
    expect(b.recommandations.alh).toEqual([
      expect.objectContaining({
        titre: 'Alerte fictive 32',
        defauts: [{ ...DEFAUT, nom: 'Défaut réservé au périmètre B' }],
      }),
    ]);
    for (const x of [a, b, ad]) sansNom(x);
    // Constat sur la seule machine 1 (A) : illisible pour B, même réponse qu'un inconnu.
    const r = await lecteurB.get(`${F}/constat/${await constatId(940002)}`);
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe('Faille introuvable ou non accessible.');
    expect((await lecteurB.get(`${F}/constat/00000000-0000-4000-8000-000000000001`)).json()).toEqual(r.json());
    // Constat sans CVE vu aussi sur une machine sans périmètre (3) : drapeau pour A, pas pour l'administration.
    expect((await lire(lecteurA, 'constat', await constatId(940004))).presence).toEqual({
      machines: 1,
      actifs: 0,
      horsLecture: true,
    });
    expect((await lire(admin, 'constat', await constatId(940004))).presence).toEqual({
      machines: 2,
      actifs: 0,
      horsLecture: false,
    });
  });

  it('CVE de la veille : mêmes faits pour tous, machines et actifs lus, recommandations de la veille', async () => {
    const a = await lire(lecteurA, 'cve', 'CVE-2026-94001');
    const b = await lire(lecteurB, 'cve', 'CVE-2026-94001');
    expect(a.priorite?.niveau).toBe('P1');
    expect(b.priorite).toEqual(a.priorite);
    expect(a.marques).toEqual({ zeroDay: true, exploitable: false });
    expect(a.presence).toEqual({ machines: 1, actifs: 1, horsLecture: true });
    expect(a.alerte).toEqual(b.alerte);
    expect(a.recommandations.tenable).toBeNull();
    expect(a.recommandations.kev).toHaveLength(1);
    expect(a.vecteurs).toEqual([{ source: 'nvd', cve: 'CVE-2026-94001', brut: V31_RESEAU, score: 9.8 }]);
    sansNom(a);
    sansNom(b);
    // CVE connue de la veille seulement : pas présente, pas de marque, aucune machine.
    const seule = await lire(lecteurA, 'cve', 'CVE-2026-94005');
    expect(seule.priorite?.niveau).not.toBe('P1');
    expect(seule.marques).toEqual({ zeroDay: false, exploitable: false });
    expect(seule.presence).toEqual({ machines: 0, actifs: 0, horsLecture: false });
    expect(seule.alerte).toBeNull();
  });

  it('faille déclarée : produit surveillé relié à une machine, versions touchées selon NVD', async () => {
    const p = await admin.post(`${V}/produits`, {
      editeur: 'Éditeur fiche',
      nom: 'Produit fiche',
      versionProduit: '1.5',
      cpe: 'cpe:2.3:a:editeur_fiche:produit_fiche:*:*:*:*:*:*:*:*',
      famille: 'applications_metier',
      criticite: 'elevee',
    });
    expect(p.statusCode, p.body).toBe(201);
    const m1 = (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_machines WHERE nom = $1', [
      nomMachine(1),
    ]))!.id;
    const l = await admin.post(`${V}/produits/${p.json().id}/machines`, { machineId: m1 }, ifMatch(p.json().version));
    expect(l.statusCode, l.body).toBe(200);
    const liste = (await lecteurA.get(`${V}/declarees`)).json().elements as { rapprochementId: string; cve: string }[];
    const d = liste.find((x) => x.cve === 'CVE-2026-94005');
    expect(d).toBeDefined();
    const f = await lire(lecteurA, 'declaree', d!.rapprochementId);
    expect(f.composant).toBe('Éditeur fiche Produit fiche 1.5');
    expect(f.presence).toEqual({ machines: 1, actifs: 0, horsLecture: false });
    expect(f.vecteurs).toEqual([{ source: 'nvd', cve: 'CVE-2026-94005', brut: V31_RESEAU, score: 7.5 }]);
    expect(f.recommandations.versionsNvd.map((v) => v.finExclus)).toEqual(['2.0']);
    expect(f.recommandations.tenable).toBeNull();
    sansNom(f);
    expect((await lecteurB.get(`${F}/declaree/${d!.rapprochementId}`)).statusCode).toBe(404);
  });

  it('alerte d’AlgoLightHouse : ses défauts, l’actif visé, illisible hors du périmètre', async () => {
    const id = (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_alertes WHERE alh_id = $1', [
      U(31),
    ]))!.id;
    const f = await lire(lecteurA, 'alerte-alh', id);
    expect(f.nature).toBe('alerte-alh');
    expect(f.recommandations.alh).toEqual([{ alerteId: id, titre: 'Alerte fictive 31', defauts: [DEFAUT] }]);
    expect(f.presence).toEqual({ machines: null, actifs: 1, horsLecture: false });
    expect(f.marques).toEqual({ zeroDay: true, exploitable: false });
    expect(f.vecteurs.map((v) => v.brut)).toEqual([V31_RESEAU]);
    expect(f.recommandations.kev).toHaveLength(1);
    expect((await lecteurB.get(`${F}/alerte-alh/${id}`)).statusCode).toBe(404);
  });

  it('lecture seule : aucune écriture, aucune entrée de journal d’audit', async () => {
    const etat = async () => ({
      audit: (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n,
      alertes: (await t.svc.db.q('SELECT id, version FROM vulnerabilites_alertes ORDER BY id')).rows,
      suivis: (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_suivis'))!.n,
      machines: (await t.svc.db.q('SELECT id, version FROM vulnerabilites_machines ORDER BY id')).rows,
    });
    const avant = await etat();
    await lire(lecteurA, 'constat', await constatId(940001));
    await lire(lecteurA, 'cve', 'CVE-2026-94001');
    await lire(admin, 'constat', await constatId(940004));
    expect(await etat()).toEqual(avant);
  });

  it('module désactivé : la route ne répond plus', async () => {
    const id = await constatId(940001);
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      expect([403, 409]).toContain((await lecteurA.get(`${F}/constat/${id}`)).statusCode);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });
});
