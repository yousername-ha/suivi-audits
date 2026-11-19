/* Module Vulnérabilités (ADR 0100, lot ALH6) : services exposés (port, protocole, produit) des actifs de la surface externe,
   lus dans les fragments du détail d'une alerte. Rangement par instance, actif, port et protocole, liens remplacés quand le
   détail est relu, service sans alerte supprimé ; présence par les alertes ouvertes et présentes (seule une synchronisation
   complète fait disparaître) ; droits de lecture de l'actif, alertes illisibles jamais nommées ; carte, liste et fiche des
   actifs, fiche d'une alerte ; lot refusé pour un service mal formé. Données entièrement fictives : domaines en .example,
   adresses de 192.0.2.0/24 et 198.51.100.0/24. */
import type {
  ActifAlhDto,
  CarteSurfaceDto,
  FicheAlerteAlhDto,
  FicheLiaisonsActifDto,
  PageSurface,
  ServiceAlhDto,
} from '@suivi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const S = '/api/vulnerabilites/surface';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurA: Agent, sansDroit: Agent;
let perimA: string, perimB: string, alh: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const service = (port: number, protocole: 'tcp' | 'udp' | null, extra: Partial<ServiceAlhDto> = {}): ServiceAlhDto => ({
  port,
  protocole,
  nom: null,
  produit: null,
  version: null,
  editeur: null,
  cpe: null,
  statutVersion: null,
  ...extra,
});
const NGINX = service(443, 'tcp', {
  nom: 'https',
  produit: 'nginx',
  version: '1.18.0',
  editeur: 'F5',
  cpe: 'cpe:/a:f5:nginx:1.18.0',
});

const hote = (n: number, perim: number, adresse: string) => ({
  type: 'hote',
  id: U(n),
  perimetre: U(perim),
  statut: 'monitored',
  adresse,
  fai: null,
  asn: null,
  pays: null,
  mutualise: null,
  cdn: null,
  joignable: true,
  joignableLe: null,
  importManuel: false,
  creeLe: null,
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
  creeLe: null,
  majLe: null,
});
const alerte = (n: number, perim: number, extra: Record<string, unknown>) => ({
  type: 'alerte',
  id: U(n),
  perimetre: U(perim),
  typeAlerte: 'exposed_service',
  criticite: 'major',
  statut: 'untreated',
  titre: `Alerte fictive ${n}`,
  verifiee: true,
  detail: true,
  cibleType: 'host',
  cibleValeur: null,
  cibleHote: null,
  cibleDomaine: null,
  cves: [],
  defauts: [],
  services: [],
  creeLe: '2026-11-10T10:00:00.000Z',
  majLe: '2026-11-15T10:00:00.000Z',
  termineeLe: null,
  ...extra,
});
/** Périmètres ALH : 1 (relié à A), 2 (relié à B), 3 (non relié). Hôtes 11 (1), 12 (2), 13 (3) ; domaine 21 (1).
    Alertes : 31 (1) sur le domaine 21 (443/tcp nginx, et 443 sans protocole qui le rejoint) ; 32 (1) sur l'hôte 12 (22/tcp) ;
    33 (2) sur l'hôte 12 (22/tcp OpenSSH, 8443 sans protocole) ; 36 (3) sur l'hôte 13 (3389/tcp) ; 37 (2) sur l'hôte 11 du
    périmètre 1 (80/tcp) ; 38 (1) sur l'hôte 11, sans service ; 39 (1) sur un hôte inconnu de la cartographie (25/tcp). */
const surface = (): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif 1' },
  { type: 'perimetre', id: U(2), nom: 'Périmètre ALH fictif 2' },
  { type: 'perimetre', id: U(3), nom: 'Périmètre ALH fictif 3' },
  hote(11, 1, '192.0.2.10'),
  hote(12, 2, '198.51.100.20'),
  hote(13, 3, '198.51.100.30'),
  domaine(21, 1, 'portail-patients-tres-long.exemple-fictif.example', '192.0.2.10'),
  alerte(31, 1, {
    criticite: 'critical',
    cibleType: 'domain',
    cibleValeur: 'portail-patients-tres-long.exemple-fictif.example',
    cibleDomaine: U(21),
    services: [NGINX, service(8443, null, { produit: 'nginx', statutVersion: 'eol' })],
  }),
  alerte(32, 1, { cibleHote: U(12), services: [service(22, 'tcp', { nom: 'ssh' })] }),
  alerte(33, 2, {
    cibleHote: U(12),
    services: [service(22, 'tcp', { produit: 'OpenSSH', version: '9.6' }), service(8443, null)],
  }),
  alerte(36, 3, { cibleHote: U(13), services: [service(3389, 'tcp', { nom: 'ms-wbt-server' })] }),
  alerte(37, 2, { cibleHote: U(11), services: [service(80, 'tcp', { nom: 'http' })] }),
  alerte(38, 1, { cibleHote: U(11) }),
  alerte(39, 1, { cibleHote: U(99), services: [service(25, 'tcp', { nom: 'smtp' })] }),
];
const bilan = (el: Record<string, unknown>[], tronque = false) => {
  const c = (x: string) => el.filter((e) => e.type === x).length;
  return {
    elements: el.length,
    perimetres: c('perimetre'),
    hotes: c('hote'),
    domaines: c('domaine'),
    alertes: c('alerte'),
    details: el.filter((e) => e.type === 'alerte' && e.detail).length,
    technologies: 0,
    ecartes: 0,
    tronque,
  };
};

async function synchroniser(elements: Record<string, unknown>[], tronque = false) {
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [alh],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  await t.svc.integrations.lot(job.id as string, elements);
  await t.svc.integrations.terminer(job.id as string, { ok: true, resultat: bilan(elements, tronque), erreur: null });
}
const idActif = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_actifs WHERE alh_id = $1', [U(n)]))!.id;
const idAlerte = async (n: number) =>
  (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_alh_alertes WHERE alh_id = $1', [U(n)]))!.id;
const lire = async <T>(a: Agent, url: string): Promise<T> => {
  const r = await a.get(url);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as T;
};
const ports = (l: ServiceAlhDto[]) => l.map((s) => `${s.port}/${s.protocole ?? '?'}`);
const carteDe = async (a: Agent) => {
  const c = await lire<CarteSurfaceDto>(a, `${S}/carte`);
  const ids = new Map(await Promise.all([11, 12, 13, 21].map(async (n) => [await idActif(n), n] as const)));
  return new Map(c.actifs.map((x) => [ids.get(x.id)!, x]));
};
const rangees = async () =>
  (
    await t.svc.db.q<{ port: number; protocole: string | null; alertes: number }>(
      `SELECT s.port, s.protocole, (SELECT count(*)::int FROM vulnerabilites_alh_service_alertes sa
         WHERE sa.service_id = s.id) AS alertes
       FROM vulnerabilites_alh_services s ORDER BY s.port, s.protocole NULLS LAST, s.actif_id`,
    )
  ).rows.map((r) => `${r.port}/${r.protocole ?? '?'}:${r.alertes}`);

async function creerInstance() {
  const r = await admin.post('/api/integrations/instances', {
    type: 'algolighthouse',
    nom: 'AlgoLightHouse fictif',
    configuration: { adresse: 'https://espace-fictif.algolighthouse.fr' },
  });
  expect(r.statusCode, r.body).toBe(201);
  const id = r.json().id as string;
  expect(
    (await admin.put(`/api/integrations/instances/${id}/secrets`, { cleApi: 'cle-api-fictive-0123456789abcdef' }))
      .statusCode,
  ).toBe(204);
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
  admin = await login(t, await makeUser(t, 'sv_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_sv_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_sv_rien', 'Sans droit sur les vulnérabilités', ARRAY[]::text[])`,
  );
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const u = {
    lecteurA: await makeUser(t, 'sv_lecteur_a', 'r_sv_lire', { rattache: false }),
    sansDroit: await makeUser(t, 'sv_sans_droit', 'r_sv_rien', { rattache: false }),
  };
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false), ($1, $3, false)', [
    perimA,
    u.lecteurA.id,
    u.sansDroit.id,
  ]);
  lecteurA = await login(t, u.lecteurA);
  sansDroit = await login(t, u.sansDroit);
  alh = await creerInstance();
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  for (const table of [
    'vulnerabilites_alh_service_alertes',
    'vulnerabilites_alh_services',
    'vulnerabilites_alh_liaisons_machines',
    'vulnerabilites_alh_alerte_cves',
    'vulnerabilites_alh_alertes',
    'vulnerabilites_alh_actifs',
    'vulnerabilites_alh_perimetres',
    'vulnerabilites_alh_synchronisations',
    'vulnerabilites_alh_etat',
    'integration_executions',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  t.svc.limits.integrationSynchro.reset();
  await synchroniser(surface());
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimA]);
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(2), perimB]);
});

describe('services exposés : rangement', () => {
  it('un service par actif, port et protocole, relié aux alertes qui le portent ; actif inconnu : rien', async () => {
    // 443/tcp (31), 8443 sans protocole sur le domaine 21 (31) et sur l'hôte 12 (33) ; 22/tcp sur l'hôte 12 (32 et 33) ;
    // 80/tcp (37) ; 3389/tcp (36). Le 25/tcp de l'alerte 39 (hôte inconnu) n'est pas rangé.
    expect(await rangees()).toEqual(['22/tcp:2', '80/tcp:1', '443/tcp:1', '3389/tcp:1', '8443/?:1', '8443/?:1']);
    const r = await t.svc.db.one<Record<string, unknown>>(
      'SELECT nom, produit, version, editeur, cpe, statut_version FROM vulnerabilites_alh_services WHERE port = 22',
    );
    // Les champs connus se complètent d'une alerte à l'autre.
    expect(r).toEqual({
      nom: 'ssh',
      produit: 'OpenSSH',
      version: '9.6',
      editeur: null,
      cpe: null,
      statut_version: null,
    });
  });

  it('détail relu : liens de l’alerte remplacés, service sans alerte supprimé ; détail non relu : liens gardés', async () => {
    const el = surface().map((e) =>
      e.id === U(33)
        ? { ...e, services: [] }
        : e.id === U(36)
          ? { ...e, detail: false, services: [], cibleType: null, cibleHote: null }
          : e,
    );
    await synchroniser(el);
    expect(await rangees()).toEqual(['22/tcp:1', '80/tcp:1', '443/tcp:1', '3389/tcp:1', '8443/?:1']);
  });

  it('lot refusé pour un service mal formé (bannière, port hors bornes, protocole inconnu) : rien n’est rangé', async () => {
    for (const mauvais of [
      { ...NGINX, banner: 'SSH-2.0-fictif' },
      { ...NGINX, port: 70000 },
      { ...NGINX, protocole: 'sctp' },
      { ...NGINX, nom: 'a\u0000b' },
    ]) {
      await t.svc.db.q(
        "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
        [alh],
      );
      const job = (await t.svc.integrations.reclamer(true))!;
      await expect(
        t.svc.integrations.lot(job.id as string, [alerte(40, 1, { cibleHote: U(11), services: [mauvais] })]),
      ).rejects.toThrow(/Élément 1/);
      await t.svc.integrations.terminer(job.id as string, { ok: false, resultat: null, erreur: 'refusé' });
    }
    expect(await rangees()).toEqual(['22/tcp:2', '80/tcp:1', '443/tcp:1', '3389/tcp:1', '8443/?:1', '8443/?:1']);
  });
});

describe('services exposés : présence', () => {
  it('alerte terminée ou absente d’une synchronisation complète : le service disparaît ; synchronisation incomplète : il reste', async () => {
    expect(ports((await carteDe(admin)).get(12)!.services)).toEqual(['22/tcp', '8443/?']);
    // Synchronisation incomplète sans les alertes 32 et 33 : rien ne disparaît.
    const sans = surface().filter((e) => e.id !== U(32) && e.id !== U(33));
    await synchroniser(sans, true);
    expect(ports((await carteDe(admin)).get(12)!.services)).toEqual(['22/tcp', '8443/?']);
    // Synchronisation complète : les alertes 32 et 33 ne sont plus présentes, leurs services ne sont plus rendus.
    await synchroniser(sans);
    expect((await carteDe(admin)).get(12)!.services).toEqual([]);
    // Alerte 31 terminée chez l'éditeur : ses services ne sont plus rendus.
    await synchroniser(sans.map((e) => (e.id === U(31) ? { ...e, statut: 'completed' } : e)));
    expect((await carteDe(admin)).get(21)).toMatchObject({ services: [], nombreServices: 0 });
  });
});

describe('services exposés : lecture sous les droits de l’actif', () => {
  it('carte : services de chaque actif lisible, fusionnés et triés ; périmètre illisible : rien', async () => {
    const tout = await carteDe(admin);
    expect(tout.get(21)!.services).toEqual([NGINX, service(8443, null, { produit: 'nginx', statutVersion: 'eol' })]);
    expect(tout.get(21)!.nombreServices).toBe(2);
    expect(ports(tout.get(13)!.services)).toEqual(['3389/tcp']);
    expect(ports(tout.get(11)!.services)).toEqual(['80/tcp']);
    const a = await carteDe(lecteurA);
    expect([...a.keys()].sort()).toEqual([11, 21]);
    // L'hôte 11 (A) se lit : son service porté par l'alerte 37 (B, illisible) est rendu, sans l'alerte.
    expect(ports(a.get(11)!.services)).toEqual(['80/tcp']);
    const texte = JSON.stringify(await lire<CarteSurfaceDto>(lecteurA, `${S}/carte`));
    // Ports ancrés sur leur champ : « 22 » ou « 3389 » en texte brut peuvent se trouver dans un identifiant tiré au hasard.
    expect(texte).not.toMatch(/"port":(22|3389)\b|OpenSSH|Alerte fictive 37|198\.51\.100/);
  });

  it('liste et fiche d’un actif : services, et seules les alertes lisibles qui les portent', async () => {
    const page = await lire<PageSurface<ActifAlhDto>>(lecteurA, `${S}/actifs`);
    const h11 = page.elements.find((x) => x.valeur === '192.0.2.10')!;
    expect(h11).toMatchObject({ services: [service(80, 'tcp', { nom: 'http' })], nombreServices: 1 });
    const fiche = await lire<FicheLiaisonsActifDto>(lecteurA, `${S}/actifs/${await idActif(11)}/machines`);
    expect(fiche.services).toEqual([{ ...service(80, 'tcp', { nom: 'http' }), alertes: [] }]);
    const ficheAdmin = await lire<FicheLiaisonsActifDto>(admin, `${S}/actifs/${await idActif(12)}/machines`);
    expect(ficheAdmin.services.map((s) => [s.port, s.alertes.map((a) => a.titre)])).toEqual([
      [22, ['Alerte fictive 32', 'Alerte fictive 33']],
      [8443, ['Alerte fictive 33']],
    ]);
    expect(ficheAdmin.services[0]).toMatchObject({ nom: 'ssh', produit: 'OpenSSH', version: '9.6' });
    // Actif d'un périmètre illisible : 404, comme avant.
    expect((await lecteurA.get(`${S}/actifs/${await idActif(12)}/machines`)).statusCode).toBe(404);
  });

  it('fiche d’une alerte : ses services, sur son actif lisible ; alerte sans service ou actif inconnu : aucun', async () => {
    const f31 = await lire<FicheAlerteAlhDto>(lecteurA, `${S}/alertes/${await idAlerte(31)}`);
    expect(f31.services).toEqual([NGINX, service(8443, null, { produit: 'nginx', statutVersion: 'eol' })]);
    expect((await lire<FicheAlerteAlhDto>(lecteurA, `${S}/alertes/${await idAlerte(38)}`)).services).toEqual([]);
    expect((await lire<FicheAlerteAlhDto>(lecteurA, `${S}/alertes/${await idAlerte(39)}`)).services).toEqual([]);
    // Alerte lisible (périmètre A) sur un actif illisible (hôte 12, B) : ses services ne sont pas rendus.
    expect((await lire<FicheAlerteAlhDto>(lecteurA, `${S}/alertes/${await idAlerte(32)}`)).services).toEqual([]);
    expect((await lecteurA.get(`${S}/alertes/${await idAlerte(37)}`)).statusCode).toBe(404);
    expect((await lire<FicheAlerteAlhDto>(admin, `${S}/alertes/${await idAlerte(36)}`)).services).toEqual([
      service(3389, 'tcp', { nom: 'ms-wbt-server' }),
    ]);
  });

  it('lecture seule et droit du module exigé', async () => {
    const compte = async () =>
      (await t.svc.db.one<{ journal: number; services: number }>(
        `SELECT (SELECT count(*)::int FROM audit_log) AS journal,
                (SELECT count(*)::int FROM vulnerabilites_alh_services) AS services`,
      ))!;
    const avant = await compte();
    await lire(admin, `${S}/carte`);
    await lire(lecteurA, `${S}/actifs`);
    expect(await compte()).toEqual(avant);
    for (const url of [`${S}/carte`, `${S}/actifs`, `${S}/actifs/${await idActif(11)}/machines`])
      expect((await sansDroit.get(url)).statusCode, url).toBe(403);
  });
});
