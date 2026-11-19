/* Module Vulnérabilités (ADR 0100, point 15 ; lot R1) : barre de recherche globale. Migrations sur base vierge.
   - CVE détectée (nombres de machines lisibles seulement, drapeau sans nombre pour le reste), CVE de la veille non détectée,
     CVE vue par AlgoLightHouse seulement, identifiant CVE inconnu (champ dédié, aucun appel sortant) ;
   - machines par adresse IP (préfixe), par nom (casse ignorée) ; actifs exposés par adresse IP et nom de domaine ;
   - applications : produit surveillé et ses machines reliées lisibles, technologie et ses actifs lisibles, contrôle de
     Tenable par son nom ;
   - cloisonnement entre deux personnes de périmètres différents (aucun nom ni adresse de l'autre périmètre) ;
   - échappement de `%` et `_`, bornes de la saisie et des groupes ; lecture seule (aucune entrée de journal) ; la liste
     « Machines » suit la même règle de correspondance.
   Données entièrement fictives : domaines example.org, adresses de 192.0.2.0/24, 198.51.100.0/24 et 203.0.113.0/24, CVE
   fictives ; aucun service n'est joint. */
import { etatCveRecherche, RechercheGlobaleReponse, type RechercheGlobaleDto } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const R = `${V}/recherche`;
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurB: Agent, sansDroit: Agent;
let perimA: string, perimB: string, tenable: string, alh: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const uuidMachine = (n: number) => `00000000-0000-4000-8000-${String(950000 + n).padStart(12, '0')}`;
const nomMachine = (n: number) => `srv-recherche-${n}.example.org`;
const ipMachine = (n: number) => `192.0.2.${40 + n}`;
const NOMS_PERIMETRES = ['Périmètre fictif recherche A', 'Périmètre fictif recherche B'];

/* ------------------------------------------------------------------ Tenable fictif */
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: nomMachine(n),
  adresse: ipMachine(n),
  systeme: n === 2 ? 'Exemple BSD 14' : 'Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
const constat = (plugin: string, nom: string, cves: string[]) => ({
  type: 'constat',
  plugin,
  nom,
  gravite: 'critique',
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Upgrade to a fixed version.',
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
  port: 443,
  protocole: 'TCP',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  attenue: false,
  risqueAccepte: false,
  risqueRequalifie: false,
});
/** Machines 1 (A), 2 (B), 3 (sans périmètre). 950001 (CVE 95001) sur 1 et 2 ; 950002 (CVE 95002) sur 2 seulement. */
const parc = (): Record<string, unknown>[] => [
  ...[1, 2, 3].map(machine),
  constat('950001', 'Serveur applicatif fictif 9.0.x < 9.0.99 Multiple Vulnerabilities', ['CVE-2026-95001']),
  constat('950002', 'Composant fictif réservé B < 2.0', ['CVE-2026-95002']),
  detection('950001', 1),
  detection('950001', 2),
  detection('950002', 2),
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
const domaine = (n: number, perim: number, nom: string, adresse: string) => ({
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
/** Périmètre ALH 1 (relié à A) : hôte 11, domaine 13, alerte 31 (CVE 95004), technologie « Frontal fictif » sur l'hôte
    11 (CVE 95005). Périmètre ALH 2 (relié à B) : hôte 12. */
const surface = (): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif 1' },
  { type: 'perimetre', id: U(2), nom: 'Périmètre ALH fictif 2' },
  hote(11, 1, '198.51.100.11'),
  hote(12, 2, '198.51.100.12'),
  domaine(13, 1, 'portail-recherche.example.org', '203.0.113.13'),
  alerte(31, 1, 11, ['CVE-2026-95004']),
  {
    type: 'technologie',
    cle: 'frontal-fictif',
    nom: 'Frontal fictif',
    editeur: 'Editeur fictif',
    produit: 'Frontal fictif',
    technologie: null,
    derniere: '2026-11-16T00:00:00.000Z',
    tronquee: false,
  },
  {
    type: 'technologie_actif',
    technologie: 'frontal-fictif',
    version: '1.0',
    actif: U(11),
    typeActif: 'hote',
    libelle: '198.51.100.11',
    actuel: true,
  },
  {
    type: 'technologie_cve',
    technologie: 'frontal-fictif',
    version: '1.0',
    cve: 'CVE-2026-95005',
    titre: 'Faille fictive',
    cvss: 7.5,
    epss: 0.42,
    severite: 'high',
    preuve: false,
    exploitee: false,
    publieeLe: '2026-03-01T00:00:00.000Z',
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
    technologies: c('technologie'),
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

const chercher = async (a: Agent, q: string): Promise<RechercheGlobaleDto> => {
  const r = await a.get(`${R}?q=${encodeURIComponent(q)}`);
  expect(r.statusCode, r.body).toBe(200);
  return RechercheGlobaleReponse.parse(r.json());
};
const cvesDe = (r: RechercheGlobaleDto) => r.cves.elements.map((x) => x.cve);
/** Rien de la machine 2, de l'hôte 12 ni du périmètre B dans une réponse lue par une personne du périmètre A. */
const sansRienDeB = (r: unknown) => {
  const texte = JSON.stringify(r);
  for (const x of [nomMachine(2), ipMachine(2), nomMachine(3), ipMachine(3), '198.51.100.12', NOMS_PERIMETRES[1]!])
    expect(texte).not.toContain(x);
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'recherche_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES ('r_recherche_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[0], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[1], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uA = await makeUser(t, 'recherche_lecteur_a', 'r_recherche_lire', { rattache: false });
  const uB = await makeUser(t, 'recherche_lecteur_b', 'r_recherche_lire', { rattache: false });
  await t.svc.db.q(`INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $3, false), ($2, $4, false)`, [
    perimA,
    perimB,
    uA.id,
    uB.id,
  ]);
  lecteurA = await login(t, uA);
  lecteurB = await login(t, uB);
  sansDroit = await login(t, await makeUser(t, 'recherche_sans_droit', 'rw'));
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

  // Veille locale posée en base (données fictives) : 95001 (détectée), 95002 (détectée sur B seulement), 95003 (connue,
  // non détectée), deux descriptions pour l'échappement des jokers, et dix CVE 9510x pour la borne des groupes.
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_cve (cve, description, editeurs, produits, cvss31_score, cvss31_gravite, publie_le)
     VALUES ('CVE-2026-95001', 'Fictional flaw in a fictional application server.', ARRAY['editeur_recherche'],
             ARRAY['serveur_applicatif_fictif'], 9.8, 'CRITICAL', '2026-06-01'),
            ('CVE-2026-95002', 'Fictional flaw reserved to perimeter B.', ARRAY['editeur_recherche'],
             ARRAY['composant_reserve'], 7.5, 'HIGH', '2026-06-02'),
            ('CVE-2026-95003', 'Fictional flaw in widget_fictif, never detected.', ARRAY['editeur_widget'],
             ARRAY['widget_fictif'], 5.3, 'MEDIUM', '2026-06-03'),
            ('CVE-2026-95006', 'Fictional discount of 50% in a billing module.', ARRAY['editeur_jokers'],
             ARRAY['module_fictif'], NULL, NULL, '2026-06-04'),
            ('CVE-2026-95007', 'Fictional discount of 500 units in a billing module (widgetXfictif).',
             ARRAY['editeur_jokers'], ARRAY['module_fictif'], NULL, NULL, '2026-06-05')`,
  );
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_cve (cve, description, publie_le)
     SELECT 'CVE-2026-9510' || n, 'Fictional bulk flaw ' || n, '2026-05-01'::date + n FROM generate_series(0, 9) n`,
  );
  await t.svc.db.q(
    `UPDATE vulnerabilites_veille_cve SET kev_ajout = '2026-11-01', kev_nom = 'Fictional Application Server RCE',
       kev_editeur = 'Editeur fictif', kev_produit = 'Serveur applicatif fictif' WHERE cve = 'CVE-2026-95001'`,
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

  // Produit surveillé fictif relié aux machines 1 (A) et 2 (B).
  const p = await admin.post(`${V}/produits`, {
    editeur: 'Editeur fictif',
    nom: 'Gestionnaire de parc fictif',
    versionProduit: '10.1.2',
    famille: 'applications_metier',
    criticite: 'moyenne',
  });
  expect(p.statusCode, p.body).toBe(201);
  const admins = await t.svc.db.one<{ id: string }>(`SELECT id FROM users WHERE username = 'recherche_admin'`);
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_produits_machines (produit_id, machine_id, relie_par)
     SELECT $1, id, $2 FROM vulnerabilites_machines WHERE nom = ANY($3)`,
    [p.json().id, admins!.id, [nomMachine(1), nomMachine(2)]],
  );
}, 90_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('lot R1 : barre de recherche globale', () => {
  it('droits et bornes : lecture du module exigée ; saisie de 2 à 200 caractères après rognage', async () => {
    expect((await sansDroit.get(`${R}?q=srv`)).statusCode).toBe(403);
    expect((await lecteurA.get(R)).statusCode).toBe(422);
    expect((await lecteurA.get(`${R}?q=a`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${R}?q=${encodeURIComponent('  a  ')}`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${R}?q=${'x'.repeat(201)}`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${R}?q=xy&page=2`)).statusCode).toBe(422);
    const long = await chercher(lecteurA, 'x'.repeat(200));
    expect(long.q).toHaveLength(200);
    expect((await chercher(lecteurA, '  srv-recherche-1  ')).q).toBe('srv-recherche-1');
  });

  it('CVE détectée : machines lisibles seulement, drapeau sans nombre pour le reste', async () => {
    const a = await chercher(admin, 'CVE-2026-95001');
    expect(a.cves.total).toBe(1);
    expect(a.cves.elements[0]).toMatchObject({
      cve: 'CVE-2026-95001',
      veille: true,
      kev: true,
      resume: 'Fictional Application Server RCE',
      gravite: 'CRITICAL',
      score: 9.8,
      machines: 2,
      machinesDeclarees: 0,
      actifs: 0,
      horsLecture: false,
      fiche: true,
    });
    expect(a.cveInconnue).toBeNull();
    const la = await chercher(lecteurA, 'cve-2026-95001');
    expect(la.cves.elements[0]).toMatchObject({ machines: 1, horsLecture: true });
    expect(etatCveRecherche(la.cves.elements[0]!).libelle).toBe('Détectée sur 1 machine, et hors de vos périmètres');
    // Une CVE détectée seulement chez B : trouvée par A (nombres communs de la veille), sans nombre ni nom.
    const b = await chercher(lecteurA, 'CVE-2026-95002');
    expect(b.cves.elements[0]).toMatchObject({ machines: 0, actifs: 0, horsLecture: true });
    expect(etatCveRecherche(b.cves.elements[0]!).etat).toBe('hors_lecture');
    sansRienDeB(b);
    expect((await chercher(lecteurB, 'CVE-2026-95002')).cves.elements[0]).toMatchObject({
      machines: 1,
      horsLecture: false,
    });
  });

  it('CVE de la veille non détectée : trouvable par identifiant et par texte, fiche ouvrable', async () => {
    const r = await chercher(lecteurA, 'CVE-2026-95003');
    expect(r.cves.elements).toHaveLength(1);
    expect(r.cves.elements[0]).toMatchObject({
      veille: true,
      machines: 0,
      machinesDeclarees: 0,
      actifs: 0,
      horsLecture: false,
      fiche: true,
      gravite: 'MEDIUM',
    });
    expect(etatCveRecherche(r.cves.elements[0]!).libelle).toBe('Non détectée sur le parc');
    expect(r.cveInconnue).toBeNull();
    // Par produit de NVD (tiret bas lu comme une espace) et par description.
    expect(cvesDe(await chercher(lecteurA, 'widget fictif'))).toContain('CVE-2026-95003');
    expect(cvesDe(await chercher(lecteurA, 'never detected'))).toEqual(['CVE-2026-95003']);
    // La fiche annoncée s'ouvre bien.
    expect((await lecteurA.get(`${V}/fiches/cve/CVE-2026-95003`)).statusCode).toBe(200);
  });

  it('CVE vue par AlgoLightHouse seulement : actifs lisibles comptés, hors de la veille', async () => {
    const a = await chercher(lecteurA, 'CVE-2026-95004');
    expect(a.cves.elements[0]).toMatchObject({
      veille: false,
      actifs: 1,
      machines: 0,
      horsLecture: false,
      fiche: true,
    });
    expect(a.cveInconnue).toBeNull();
    const b = await chercher(lecteurB, 'CVE-2026-95004');
    expect(b.cves.elements[0]).toMatchObject({ actifs: 0, horsLecture: true });
    expect((await chercher(lecteurA, 'CVE-2026-95005')).cves.elements[0]).toMatchObject({ actifs: 1, veille: false });
  });

  it('identifiant CVE inconnu : champ dédié, aucun résultat, aucun appel sortant', async () => {
    const r = await chercher(lecteurA, 'cve-2026-99999');
    expect(r.cveInconnue).toEqual({ cve: 'CVE-2026-99999' });
    expect(r.cves).toEqual({ elements: [], total: 0 });
    // Un début d'identifiant n'est pas un identifiant : pas de mention « inconnue ».
    expect((await chercher(lecteurA, 'CVE-2026-999')).cveInconnue).toBeNull();
    // Rien n'a été demandé à l'exécutant (aucune collecte inscrite).
    const n = await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_veille_collectes');
    expect(n!.n).toBe(0);
  });

  it('groupes bornés à 8, total exact ; CVE présentes sur une machine lisible en tête', async () => {
    const r = await chercher(admin, 'CVE-2026-951');
    expect(r.cves.total).toBe(10);
    expect(r.cves.elements).toHaveLength(8);
    // Identifiant bien formé absent, alors que d'autres CVE commencent par lui : signalé quand même.
    const debut = await chercher(admin, 'CVE-2026-9510');
    expect(debut.cves.total).toBe(10);
    expect(debut.cveInconnue).toEqual({ cve: 'CVE-2026-9510' });
    const p = await chercher(admin, 'CVE-2026-950');
    expect(p.cves.total).toBe(7);
    expect(p.cves.elements[0]!.cve).toBe('CVE-2026-95002');
    expect(cvesDe(p).slice(0, 2).sort()).toEqual(['CVE-2026-95001', 'CVE-2026-95002']);
    // Un début d'identifiant ne cherche ni produit, ni technologie, ni contrôle.
    expect(p.produits.total + p.technologies.total + p.controles.total).toBe(0);
  });

  it('machines internes par adresse IP (préfixe ou exacte) et par nom (casse ignorée), selon les périmètres', async () => {
    const a = await chercher(admin, '192.0.2.4');
    expect(a.machines.total).toBe(3);
    const la = await chercher(lecteurA, '192.0.2.4');
    expect(la.machines.total).toBe(1);
    expect(la.machines.elements[0]).toMatchObject({
      nom: nomMachine(1),
      adresse: ipMachine(1),
      perimetreNom: NOMS_PERIMETRES[0],
    });
    sansRienDeB(la);
    expect((await chercher(lecteurA, ipMachine(1))).machines.total).toBe(1);
    expect((await chercher(lecteurA, '0.2.41')).machines.total).toBe(0);
    const nom = await chercher(admin, 'SRV-RECHERCHE-2');
    expect(nom.machines.elements.map((m) => m.nom)).toEqual([nomMachine(2)]);
    expect((await chercher(lecteurA, 'SRV-RECHERCHE-2')).machines.total).toBe(0);
    expect((await chercher(lecteurB, 'bsd')).machines.elements.map((m) => m.nom)).toEqual([nomMachine(2)]);
    // Correspondance exacte en tête.
    const exact = await chercher(admin, nomMachine(3));
    expect(exact.machines.elements[0]!.nom).toBe(nomMachine(3));
  });

  it('la liste « Machines » suit la même règle (adresse IP, casse ignorée)', async () => {
    const r = await lecteurA.get(`${V}/machines?q=${encodeURIComponent('192.0.2.4')}`);
    expect(r.statusCode).toBe(200);
    expect(r.json().total).toBe(1);
    expect((await admin.get(`${V}/machines?q=SRV-RECHERCHE`)).json().total).toBe(3);
  });

  it('actifs exposés par adresse IP et par nom de domaine, selon les périmètres', async () => {
    expect((await chercher(admin, '198.51.100.1')).actifs.total).toBe(2);
    const la = await chercher(lecteurA, '198.51.100.1');
    expect(la.actifs.elements.map((x) => x.valeur)).toEqual(['198.51.100.11']);
    sansRienDeB(la);
    const d = await chercher(lecteurA, 'portail-recherche');
    expect(d.actifs.elements[0]).toMatchObject({ type: 'domaine', valeur: 'portail-recherche.example.org' });
    expect((await chercher(lecteurA, '203.0.113.13')).actifs.total).toBe(1);
    expect((await chercher(lecteurB, 'portail-recherche')).actifs.total).toBe(0);
  });

  it('applications : produit surveillé, technologie, contrôle de Tenable, avec leurs porteurs lisibles', async () => {
    const a = await chercher(admin, 'gestionnaire de parc');
    expect(a.produits.total).toBe(1);
    expect(a.produits.elements[0]).toMatchObject({ versionProduit: '10.1.2', machines: 2 });
    const la = await chercher(lecteurA, 'Gestionnaire de parc fictif 10.1');
    expect(la.produits.elements[0]).toMatchObject({
      machines: 1,
      porteurs: [{ type: 'machine', libelle: nomMachine(1) }],
    });
    sansRienDeB(la);
    const tech = await chercher(lecteurA, 'frontal');
    expect(tech.technologies.elements[0]).toMatchObject({
      nom: 'Frontal fictif',
      actifs: 1,
      porteurs: [{ type: 'hote', id: null, libelle: '198.51.100.11' }],
    });
    expect((await chercher(lecteurB, 'frontal')).technologies.total).toBe(0);
    const c = await chercher(lecteurA, 'serveur applicatif fictif');
    expect(c.controles.elements[0]).toMatchObject({ pluginId: 950001, machines: 1 });
    expect((await chercher(lecteurA, 'réservé B')).controles.total).toBe(0);
    expect((await chercher(lecteurB, 'réservé B')).controles.total).toBe(1);
  });

  it('jokers échappés : « % » et « _ » sont cherchés tels quels', async () => {
    expect(cvesDe(await chercher(lecteurA, '50%'))).toEqual(['CVE-2026-95006']);
    expect(cvesDe(await chercher(lecteurA, 't_f'))).toEqual(['CVE-2026-95003']);
    expect((await chercher(lecteurA, '%%')).cves.total).toBe(0);
    expect((await chercher(lecteurA, '__')).machines.total).toBe(0);
    expect((await chercher(lecteurA, '\\%')).cves.total).toBe(0);
  });

  it('lecture seule : aucune entrée de journal, aucune écriture', async () => {
    const avant = (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n;
    await chercher(admin, 'CVE-2026-95001');
    await chercher(lecteurA, '192.0.2.41');
    const apres = (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n;
    expect(apres).toBe(avant);
  });

  it('module désactivé : la route ne répond plus', async () => {
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      expect([403, 409]).toContain((await lecteurA.get(`${R}?q=srv`)).statusCode);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });
});
