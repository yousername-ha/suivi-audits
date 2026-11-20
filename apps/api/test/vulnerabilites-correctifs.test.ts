/* Module Vulnérabilités (ADR 0100, lot S3) : regroupement par correctif, fin de support, état du correctif. Migrations sur
   base vierge.
   - regroupement par texte de solution de Tenable (espaces réduits, aucun autre rapprochement), groupe « sans correctif »
     en dernier, tri par gain (priorité, puis nombre de failles corrigées) ;
   - droits et non-fuite : priorité, nombres de failles et de CVE, marques et délais les mêmes pour deux personnes ; machines
     nommées et comptées selon les droits, drapeau sans nombre pour les autres ; détail d'un groupe sans nom illisible ;
   - état du correctif : « disponible » (date de Tenable), « aucun correctif connu » (CERT Santé « Non »), « non renseigné » ;
   - fin de support : date `seolDate` passée (une date à venir n'en est pas une), filtres des constats, des machines et du
     parc, fiche d'une machine, fiche illustrée, vue d'ensemble, rapport ;
   - nombre de requêtes fixe ; lecture seule (aucune écriture, aucune entrée de journal) ; droit de lecture exigé, module
     désactivé.
   Données entièrement fictives : machines en .invalid, adresses de 192.0.2.0/24, CVE fictives ; aucun service n'est joint. */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const URL = `${V}/correctifs`;
let t: TestApp;
let admin: Agent, lecteurA: Agent, lecteurB: Agent, sansDroit: Agent;
let perimA: string, perimB: string, tenable: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const uuidMachine = (n: number) => `00000000-0000-4000-8000-${String(940000 + n).padStart(12, '0')}`;
const nomMachine = (n: number) => `srv-corr-${String(n).padStart(2, '0')}.interne.invalid`;
const adresse = (n: number) => `192.0.2.${100 + n}`;
const NOMS_PERIMETRES = ['Périmètre fictif correctifs A', 'Périmètre fictif correctifs B'];
/** Mois du rapport : le mois courant, fuseau de l'organisation. */
const MOIS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()).slice(0, 7);
const MAJ_WEB = 'Upgrade to Exemple Web 2.0 or later (fictif).';
const PATCH = 'Apply the fictional vendor patch (fictif).';
const MIGRER = 'Migrate to a supported release (fictif).';

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
const constat = (plugin: string, cves: string[], gravite: string, x: Record<string, unknown> = {}) => ({
  type: 'constat',
  plugin,
  nom: `Produit fictif : contrôle fictif ${plugin}`,
  gravite,
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: MAJ_WEB,
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
  ...x,
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
/** Parc : machines 1, 2, 3 (périmètre A) ; 4, 5 (périmètre B) ; 6 (sans périmètre).
    MAJ_WEB : 940001 (CVE 94001, KEV, correctif publié selon Tenable : P1, sur 1 et 4), 940002 (élevée, exploitable, sur 2),
              940003 (même texte, moyenne, sur 1 ; le script de l'exécutant rend déjà le texte sur une ligne) ;
    PATCH   : 940004 (CVE 94004, KEV ; CERT Santé « Un correctif existe : Non » : P1 sans correctif connu, sur 5) ;
    MIGRER  : 940007 (moyenne, fin de support annoncée en 2030, sur 2) ;
    sans solution : 940005 (sans CVE, critique, fin de support passée : sur 3 et 6). */
const parc = (): Record<string, unknown>[] => [
  ...[1, 2, 3, 4, 5, 6].map(machine),
  constat('940001', ['CVE-2026-94001'], 'elevee', { correctifLe: '2026-10-02T00:00:00.000Z' }),
  constat('940002', ['CVE-2026-94002'], 'elevee', { exploitable: true, exploitLibelle: 'Exploits are available' }),
  constat('940003', ['CVE-2026-94003', 'CVE-2026-94001'], 'moyenne', {}),
  constat('940004', ['CVE-2026-94004'], 'elevee', { correctif: PATCH }),
  constat('940005', [], 'critique', { correctif: null, finSupportLe: '2025-01-01T00:00:00.000Z' }),
  constat('940007', [], 'moyenne', { correctif: MIGRER, finSupportLe: '2030-01-01T00:00:00.000Z' }),
  detection('940001', 1),
  detection('940001', 4),
  detection('940002', 2),
  detection('940003', 1),
  detection('940004', 5),
  detection('940005', 3),
  detection('940005', 6),
  detection('940007', 2),
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
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat: bilanTenable(elements), erreur: null });
}

interface Groupe {
  cle: string;
  solution: string | null;
  failles: number;
  cves: number;
  machines: { lisibles: number; horsLecture: boolean };
  priorite: string;
  exploitees: number;
  exploiteesSansCorrectif: number;
  exploitables: number;
  finDeSupport: number;
  delai: { etat: string };
  correctif: Record<string, number>;
  sourcesCorrectif: string[];
}
interface Liste {
  misesAJour: number;
  failles: number;
  sansCorrectif: number;
  groupes: Groupe[];
  total: number;
  tronquee: boolean;
}
interface Detail {
  groupe: Groupe;
  failles: {
    plugin: string;
    priorite: string;
    lisible: boolean;
    correctif: { etat: string; sources: { source: string }[] };
    situation: string | null;
    finDeSupport: boolean;
  }[];
  machines: { nom: string | null; finDeSupport: boolean }[];
  machinesTronquees: boolean;
}
const lister = async (a: Agent, query = ''): Promise<Liste> => {
  const r = await a.get(`${URL}${query}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Liste;
};
const groupe = (l: Liste, solution: string | null) => l.groupes.find((g) => g.solution === solution)!;
/** Ce qui doit être commun à tout le monde (lot ALH5) : tout, sauf les machines. */
const commun = ({ machines: _, ...g }: Groupe) => g;

beforeAll(async () => {
  t = await createTestApp();
  const uAdmin = await makeUser(t, 'corr_admin', 'admin');
  admin = await login(t, uAdmin);
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES ('r_corr_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[0], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: NOMS_PERIMETRES[1], scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uA = await makeUser(t, 'corr_lecteur_a', 'r_corr_lire', { rattache: false });
  const uB = await makeUser(t, 'corr_lecteur_b', 'r_corr_lire', { rattache: false });
  const uSans = await makeUser(t, 'corr_sans_droit', 'rw');
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

describe('lot S3 : regroupement par correctif, fin de support, état du correctif', () => {
  it('pile vierge : aucune mise à jour', async () => {
    expect(await lister(lecteurA)).toMatchObject({
      misesAJour: 0,
      failles: 0,
      sansCorrectif: 0,
      groupes: [],
      total: 0,
    });
  });

  it('droits et validation : lecture du module exigée ; clé contrôlée ; groupe inconnu : 404', async () => {
    expect((await sansDroit.get(URL)).statusCode).toBe(403);
    expect((await sansDroit.get(`${URL}/aucun`)).statusCode).toBe(403);
    expect((await lecteurA.get(`${URL}/pas-une-cle`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${URL}?page=2`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${URL}?priorite=P9`)).statusCode).toBe(422);
    expect((await lecteurA.get(`${URL}/0123456789abcdef`)).statusCode).toBe(404);
  });

  it('données : synchronisation de Tenable, veille (KEV, CERT Santé), périmètres', async () => {
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit)
       VALUES ('CVE-2026-94001', '2026-11-01', 'Fictional Web Remote Code Execution', 'Produit fictif'),
              ('CVE-2026-94004', '2026-11-05', 'Fictional Patchless Remote Code Execution', 'Produit fictif')`,
    );
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, publie_le, cves, cves_lues, produit,
         fiche_lue_le, fiche_titre, fiche_correctif)
       VALUES ('cert-sante', '940004', 'alerte', 'Produit fictif - CVE-2026-94004', '2026-11-06T08:00:00Z',
               ARRAY['CVE-2026-94004'], true, 'Produit fictif', now(), 'Fiche fictive', 'non')`,
    );
    await syncTenable(parc());
    const regler = (n: number, perimetre: string | null) =>
      t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE nom = $1', [nomMachine(n), perimetre]);
    for (const n of [1, 2, 3]) await regler(n, perimA);
    for (const n of [4, 5]) await regler(n, perimB);
  }, 60_000);

  it('regroupement par texte de solution, tri par gain, groupe sans correctif en dernier', async () => {
    const l = await lister(admin);
    expect(l.groupes.map((g) => g.solution)).toEqual([MAJ_WEB, PATCH, MIGRER, null]);
    expect(l).toMatchObject({ misesAJour: 3, failles: 5, sansCorrectif: 1, total: 4, tronquee: false });
    expect(groupe(l, MAJ_WEB)).toMatchObject({
      failles: 3,
      cves: 3,
      priorite: 'P1',
      exploitees: 2,
      exploiteesSansCorrectif: 0,
      exploitables: 1,
      finDeSupport: 0,
      machines: { lisibles: 3, horsLecture: false },
    });
    expect(groupe(l, PATCH)).toMatchObject({ failles: 1, priorite: 'P1', exploitees: 1, exploiteesSansCorrectif: 1 });
    expect(groupe(l, MIGRER)).toMatchObject({ failles: 1, finDeSupport: 0 });
    // Lot PRIO-1 (décision du RSSI du 20/11/2026) : 940005 est lui-même le contrôle de fin de support : il ne monte pas.
    expect(groupe(l, null)).toMatchObject({ cle: 'aucun', failles: 1, finDeSupport: 1, priorite: 'P2' });
    // Recherche dans le texte, filtre de priorité ; l'en-tête reste celui de toutes les mises à jour.
    expect((await lister(admin, '?q=patch')).groupes.map((g) => g.solution)).toEqual([PATCH]);
    expect((await lister(admin, '?priorite=P1')).groupes.map((g) => g.solution)).toEqual([MAJ_WEB, PATCH]);
    expect((await lister(admin, '?q=patch')).misesAJour).toBe(3);
  });

  it('état du correctif : disponible (Tenable), aucun connu (CERT Santé « Non »), non renseigné ; source citée', async () => {
    const l = await lister(admin);
    expect(groupe(l, MAJ_WEB).correctif).toEqual({ disponible: 1, aucun_connu: 0, non_renseigne: 2 });
    expect(groupe(l, MAJ_WEB).sourcesCorrectif).toEqual(['tenable']);
    expect(groupe(l, PATCH).correctif).toEqual({ disponible: 0, aucun_connu: 1, non_renseigne: 0 });
    expect(groupe(l, PATCH).sourcesCorrectif).toEqual(['cert-sante']);
    const d = (await admin.get(`${URL}/${groupe(l, PATCH).cle}`)).json() as Detail;
    expect(d.failles).toEqual([
      expect.objectContaining({
        plugin: '940004',
        situation: 'sans_correctif',
        correctif: { etat: 'aucun_connu', sources: [{ source: 'cert-sante', valeur: 'aucun', le: null }] },
      }),
    ]);
    const w = (await admin.get(`${URL}/${groupe(l, MAJ_WEB).cle}`)).json() as Detail;
    expect(w.failles.find((f) => f.plugin === '940001')).toMatchObject({
      situation: 'corrigible',
      correctif: { etat: 'disponible', sources: [{ source: 'tenable' }] },
    });
    // « Non renseigné » n'est jamais « aucun correctif » : la faille exploitable sans date reste non renseignée.
    expect(w.failles.find((f) => f.plugin === '940002')).toMatchObject({
      situation: null,
      correctif: { etat: 'non_renseigne', sources: [] },
    });
  });

  it('droits : priorité et nombres de failles les mêmes pour deux personnes ; machines lues seulement, sans fuite', async () => {
    const ad = await lister(admin);
    const a = await lister(lecteurA);
    const b = await lister(lecteurB);
    for (const l of [a, b]) {
      expect(l.groupes.map(commun)).toEqual(ad.groupes.map(commun));
      expect(l.misesAJour).toBe(ad.misesAJour);
      expect(l.failles).toBe(ad.failles);
    }
    expect(groupe(a, MAJ_WEB).machines).toEqual({ lisibles: 2, horsLecture: true });
    expect(groupe(b, MAJ_WEB).machines).toEqual({ lisibles: 1, horsLecture: true });
    expect(groupe(a, PATCH).machines).toEqual({ lisibles: 0, horsLecture: true });
    expect(groupe(b, PATCH).machines).toEqual({ lisibles: 1, horsLecture: false });

    const r = await lecteurA.get(`${URL}/${groupe(a, PATCH).cle}`);
    expect(r.statusCode).toBe(200);
    for (const n of [4, 5, 6]) {
      expect(r.body).not.toContain(nomMachine(n));
      expect(r.body).not.toContain(adresse(n));
    }
    expect(r.body).not.toContain(NOMS_PERIMETRES[1]);
    const d = r.json() as Detail;
    expect(d.machines).toEqual([]);
    // La faille est montrée par son contrôle (comme la vue d'ensemble), sans lien vers sa fiche.
    expect(d.failles.map((f) => [f.plugin, f.lisible])).toEqual([['940004', false]]);
    expect(
      (
        await lecteurA.get(
          `${V}/constats/${
            (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = 940004'))!.id
          }`,
        )
      ).statusCode,
    ).toBe(404);

    const w = (await lecteurA.get(`${URL}/${groupe(a, MAJ_WEB).cle}`)).json() as Detail;
    expect(w.machines.map((m) => m.nom)).toEqual([nomMachine(1), nomMachine(2)]);
    const liste = await lecteurA.get(URL);
    for (const n of [4, 5, 6]) expect(liste.body).not.toContain(nomMachine(n));
  });

  it('fin de support : date passée seulement ; filtres des constats, des machines et du parc', async () => {
    const c = await lecteurA.get(`${V}/constats?finSupport=oui&etat=tous`);
    expect(c.statusCode, c.body).toBe(200);
    expect((c.json() as { elements: { plugin: string; finDeSupport: boolean }[] }).elements).toEqual([
      expect.objectContaining({ plugin: '940005', finDeSupport: true }),
    ]);
    const tous = (await lecteurA.get(`${V}/constats?etat=tous`)).json() as {
      elements: { plugin: string; finDeSupport: boolean; finSupportLe: string | null }[];
    };
    // Une date à venir est une fin de support annoncée, pas atteinte.
    expect(tous.elements.find((x) => x.plugin === '940007')).toMatchObject({
      finDeSupport: false,
      finSupportLe: '2030-01-01T00:00:00.000Z',
    });
    const noms = async (a: Agent, url: string) =>
      ((await a.get(url)).json() as { elements: { nom: string }[] }).elements.map((m) => m.nom);
    expect(await noms(lecteurA, `${V}/machines?finSupport=oui`)).toEqual([nomMachine(3)]);
    expect((await noms(admin, `${V}/machines?finSupport=oui`)).sort()).toEqual([nomMachine(3), nomMachine(6)]);
    expect(await noms(lecteurB, `${V}/machines?finSupport=oui`)).toEqual([]);
    const parc = (await lecteurA.get(`${V}/machines/parc?finSupport=oui`)).json() as {
      total: number;
      zones: { machines: { nom: string; finDeSupport: boolean; finsDeSupport: { nom: string; le: string }[] }[] }[];
    };
    expect(parc.total).toBe(1);
    const m3 = parc.zones.flatMap((z) => z.machines)[0]!;
    expect(m3).toMatchObject({
      nom: nomMachine(3),
      finDeSupport: true,
      finsDeSupport: [{ nom: 'Produit fictif : contrôle fictif 940005', le: '2025-01-01T00:00:00.000Z' }],
    });
    expect((await lecteurA.get(`${V}/machines/parc?finSupport=non`)).statusCode).toBe(422);
  });

  it('marques des machines : précision « sans correctif connu » à côté du zero-day, la même pour tout le monde', async () => {
    const tuiles = async (a: Agent) =>
      (
        (await a.get(`${V}/machines/parc`)).json() as {
          zones: { machines: { nom: string; marques: Record<string, unknown> }[] }[];
        }
      ).zones.flatMap((z) => z.machines);
    const ad = await tuiles(admin);
    const b = await tuiles(lecteurB);
    const m5 = ad.find((m) => m.nom === nomMachine(5))!;
    expect(m5.marques).toEqual({
      priorite: 'P1',
      exploitationAveree: true,
      exploitable: false,
      exploiteeSansCorrectif: true,
    });
    expect(b.find((m) => m.nom === nomMachine(5))!.marques).toEqual(m5.marques);
    // Machine 1 : exploitée, correctif disponible : marque zero-day sans la précision.
    expect(ad.find((m) => m.nom === nomMachine(1))!.marques).toMatchObject({
      exploitationAveree: true,
      exploiteeSansCorrectif: false,
    });
  });

  it('fiche illustrée : état du correctif et sa source, précision, fin de support', async () => {
    const id = async (p: number) =>
      (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = $1', [p]))!.id;
    const fiche = async (a: Agent, nature: string, x: string) => {
      const r = await a.get(`${V}/fiches/${nature}/${x}`);
      expect(r.statusCode, r.body).toBe(200);
      return r.json() as Record<string, unknown>;
    };
    expect(await fiche(lecteurA, 'constat', await id(940005))).toMatchObject({
      finSupport: { etat: 'atteinte', le: '2025-01-01T00:00:00.000Z', source: 'tenable' },
      correctif: { etat: 'non_renseigne', sources: [] },
      situationExploitation: null,
    });
    expect(await fiche(lecteurA, 'constat', await id(940001))).toMatchObject({
      correctif: { etat: 'disponible', sources: [{ source: 'tenable', le: '2026-10-02T00:00:00.000Z' }] },
      situationExploitation: 'corrigible',
      finSupport: null,
      marques: { zeroDay: true },
    });
    expect(await fiche(lecteurB, 'constat', await id(940004))).toMatchObject({
      correctif: { etat: 'aucun_connu' },
      situationExploitation: 'sans_correctif',
      marques: { zeroDay: true },
    });
    // CVE de la veille : Tenable parle s'il cite la CVE dans un contrôle qui porte une date de correctif.
    expect(await fiche(lecteurB, 'cve', 'CVE-2026-94001')).toMatchObject({ correctif: { etat: 'disponible' } });
    expect(await fiche(lecteurA, 'cve', 'CVE-2026-94004')).toMatchObject({
      correctif: { etat: 'aucun_connu' },
      situationExploitation: 'sans_correctif',
    });
  });

  it('vue d’ensemble : précision des failles exploitées (commune) et fin de support (machines lues)', async () => {
    const tuiles = async (a: Agent) => {
      const r = await a.get(`${V}/vue-ensemble`);
      expect(r.statusCode, r.body).toBe(200);
      return (r.json() as { tuiles: Record<string, unknown> }).tuiles;
    };
    const ad = await tuiles(admin);
    const a = await tuiles(lecteurA);
    expect(ad).toMatchObject({
      exploiteesPresentes: 2,
      exploiteesSansCorrectif: 1,
      exploiteesCorrectifNonRenseigne: 0,
    });
    expect(a).toMatchObject({ exploiteesSansCorrectif: 1, exploiteesCorrectifNonRenseigne: 0 });
    expect(ad.finDeSupport).toEqual({
      constats: 1,
      machines: { lisibles: 2, horsLecture: false },
      services: { lisibles: 0, horsLecture: false },
    });
    expect(a.finDeSupport).toEqual({
      constats: 1,
      machines: { lisibles: 1, horsLecture: true },
      services: { lisibles: 0, horsLecture: false },
    });
  });

  it('rapport de pilotage : failles critiques présentes depuis le plus longtemps d’abord (décision du RSSI du 20/11/2026)', async () => {
    const ordre = async () =>
      (
        (await admin.get(`${V}/rapport?mois=${MOIS}`)).json() as { critiques: { elements: { cve: string }[] } }
      ).critiques.elements.map((f) => f.cve);
    const dater = (plugin: string, le: string | null) =>
      t.svc.db.q(
        `UPDATE vulnerabilites_detections d SET premiere_detection = coalesce($2::timestamptz, d.premiere_detection)
           FROM vulnerabilites_constats c WHERE c.id = d.constat_id AND c.plugin_id = $1::int RETURNING d.id`,
        [plugin, le],
      );
    const avant = await t.svc.db.q<{ id: string; premiere_detection: Date }>(
      `SELECT d.id, d.premiere_detection FROM vulnerabilites_detections d
         JOIN vulnerabilites_constats c ON c.id = d.constat_id WHERE c.plugin_id IN (940001, 940003, 940004)`,
    );
    try {
      // La faille du contrôle 940004 devient la plus ancienne : elle passe en tête.
      expect((await dater('940004', '2020-01-01T00:00:00Z')).rows.length).toBeGreaterThan(0);
      expect(await ordre()).toEqual(['CVE-2026-94004', 'CVE-2026-94001']);
      // Puis celle du contrôle 940001 devient plus ancienne encore : l'ordre s'inverse.
      expect((await dater('940001', '2019-01-01T00:00:00Z')).rows.length).toBeGreaterThan(0);
      expect(await ordre()).toEqual(['CVE-2026-94001', 'CVE-2026-94004']);
    } finally {
      for (const d of avant.rows)
        await t.svc.db.q('UPDATE vulnerabilites_detections SET premiere_detection = $2 WHERE id = $1', [
          d.id,
          d.premiere_detection,
        ]);
    }
  });

  it('rapport de pilotage : état du correctif des failles critiques et section « fin de support »', async () => {
    const r = await admin.get(`${V}/rapport?mois=${MOIS}`);
    expect(r.statusCode, r.body).toBe(200);
    const rapport = r.json() as {
      critiques: { elements: { cve: string; correctif: { etat: string } }[] };
      finDeSupport: { total: number; elements: { titre: string; machines: number | null; etat: string }[] };
    };
    expect(Object.fromEntries(rapport.critiques.elements.map((f) => [f.cve, f.correctif.etat]))).toEqual({
      'CVE-2026-94001': 'disponible',
      'CVE-2026-94004': 'aucun_connu',
    });
    // Toute la plateforme : aucun total de machines.
    expect(rapport.finDeSupport).toEqual({
      total: 1,
      elements: [
        {
          titre: 'Produit fictif : contrôle fictif 940005',
          finSupportLe: '2025-01-01T00:00:00.000Z',
          machines: null,
          etat: 'nouvelle',
        },
      ],
    });
    const p = (await lecteurA.get(`${V}/rapport?mois=${MOIS}&perimetre=${perimA}`)).json() as typeof rapport;
    expect(p.finDeSupport.elements[0]).toMatchObject({ machines: 1 });
    const csv = await admin.get(`${V}/rapport?mois=${MOIS}&format=csv`);
    expect(csv.body).toContain('Contrôles de Tenable en fin de support : 1');
    expect(csv.body).toContain('Aucun correctif connu (CERT Santé');
    for (const n of [1, 2, 3, 4, 5, 6]) expect(csv.body).not.toContain(nomMachine(n));
  });

  it('nombre de requêtes fixe, aucune par faille ni par correctif', async () => {
    const espion = vi.spyOn(pg.Client.prototype, 'query');
    const compter = async (fn: () => Promise<unknown>) => {
      espion.mockClear();
      await fn();
      return espion.mock.calls.length;
    };
    try {
      await admin.get(`${V}/priorite/reglage`);
      const socle = (await compter(() => admin.get(`${V}/priorite/reglage`))) - 1;
      const liste = (await compter(() => admin.get(URL))) - socle;
      const detail = (await compter(() => admin.get(`${URL}/aucun`))) - socle;
      expect(socle).toBeGreaterThan(0);
      expect(liste).toBeGreaterThan(3);
      expect(liste).toBeLessThanOrEqual(7);
      expect(detail).toBeLessThanOrEqual(8);
    } finally {
      espion.mockRestore();
    }
  });

  it('lecture seule : aucune écriture, aucune entrée de journal d’audit', async () => {
    const etat = async () => ({
      audit: (await t.svc.db.one<{ n: number }>('SELECT coalesce(max(id), 0)::int AS n FROM audit_log'))!.n,
      suivis: (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_suivis'))!.n,
      machines: (
        await t.svc.db.q<{ id: string; version: number }>('SELECT id, version FROM vulnerabilites_machines ORDER BY id')
      ).rows,
    });
    const avant = await etat();
    const l = await lister(lecteurA);
    for (const g of l.groupes) await lecteurA.get(`${URL}/${g.cle}`);
    await lister(admin, '?priorite=P1');
    expect(await etat()).toEqual(avant);
  });

  it('module désactivé : les routes ne répondent plus', async () => {
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      expect([403, 409]).toContain((await lecteurA.get(URL)).statusCode);
      expect([403, 409]).toContain((await admin.get(`${URL}/aucun`)).statusCode);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });
});
