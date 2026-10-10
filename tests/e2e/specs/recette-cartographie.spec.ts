/* Recette de la cartographie (docs/cartographie/RECETTE.md, CARTO-01 à CARTO-14) sur la pile Docker : 20 parcours,
   captures 390 / 1920 / 3840 px, aucune violation de CSP, lecture seule réelle. Données FICTIVES
   (tests/fixtures/carto-donnees.json). Exécutés après parcours.spec.ts (compte administrateur) ; l'état legacy est
   rétabli à la fin pour les fichiers suivants. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { apiLogin, csrfOf, markTotpUsed, PASSWORD, sessionAdmin, totp, watchPage } from '../helpers';

test.describe.configure({ mode: 'serial' });

const DONNEES = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../fixtures/carto-donnees.json'), 'utf8'),
) as Record<string, unknown>;
delete DONNEES._commentaire;

interface Session {
  page: Page;
  req: APIRequestContext;
  problems: string[];
  csrf: string;
  close: () => Promise<void>;
}
let admin: Session;
let etatInitial: Record<string, unknown>;
/** Comptes de recette (secrets TOTP), conservés entre deux exécutions sur la même pile. */
const COMPTES = path.join(os.tmpdir(), 'suivi-e2e-carto.json');
const comptes: Record<string, { secret: string }> = existsSync(COMPTES)
  ? JSON.parse(readFileSync(COMPTES, 'utf8'))
  : {};

async function ouvrir(
  browser: Browser,
  username: string,
  secret: string,
  w = 1920,
  h = 1080,
  admin?: Awaited<ReturnType<typeof sessionAdmin>>,
): Promise<Session> {
  const ctx = await browser.newContext({
    ...(admin ? { storageState: admin.state } : {}),
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    viewport: { width: w, height: h },
    colorScheme: 'light',
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  // Le serveur refuse le rejeu d'un pas TOTP déjà accepté (par exemple lors d'une exécution précédente) :
  // on attend alors la fenêtre suivante.
  if (admin) return { page, req: page.request, problems, csrf: admin.csrf, close: () => ctx.close() };
  const csrf = await apiLogin(page.request, username, PASSWORD, secret).catch(async () => {
    await page.waitForTimeout(31_000);
    // Nouvel essai unique (chaque connexion compte dans la limite par adresse : 20 par quart d'heure).
    return apiLogin(page.request, username, PASSWORD, secret);
  });
  return { page, req: page.request, problems, csrf, close: () => ctx.close() };
}

/** Compte créé par l'administrateur puis préparé (mot de passe personnel, TOTP) par l'API. */
async function creerCompte(browser: Browser, username: string, roleId: string) {
  if (comptes[username]) return;
  const r = await admin.req.post('/api/admin/users', {
    data: { username, displayName: `Compte ${username}`, roles: [{ roleId }] },
    headers: { 'x-csrf-token': admin.csrf },
  });
  expect(r.status(), await r.text()).toBe(201);
  const temp = (await r.json()).temporaryPassword as string;
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const rq = ctx.request;
  await rq.post('/api/auth/login', { data: { username, password: temp } });
  let csrf = await csrfOf(rq);
  const begin = await (
    await rq.post('/api/account/totp/begin', { data: {}, headers: { 'x-csrf-token': csrf } })
  ).json();
  await rq.post('/api/account/totp/confirm', { data: { code: totp(begin.secret) }, headers: { 'x-csrf-token': csrf } });
  markTotpUsed(begin.secret);
  csrf = await csrfOf(rq);
  await rq.post('/api/account/password', {
    data: { current: temp, next: PASSWORD },
    headers: { 'x-csrf-token': csrf },
  });
  await ctx.close();
  comptes[username] = { secret: begin.secret as string };
  writeFileSync(COMPTES, JSON.stringify(comptes), { mode: 0o600 });
}

async function etatLegacy(req: APIRequestContext) {
  const r = await req.get('/api/legacy/state');
  return { data: (await r.json()) as Record<string, unknown>, etag: r.headers()['etag'] ?? '' };
}
async function ecrireLegacy(s: Session, patch: (d: Record<string, unknown>) => void) {
  const cur = await etatLegacy(s.req);
  patch(cur.data);
  const r = await s.req.put('/api/legacy/state', {
    data: cur.data,
    headers: { 'x-csrf-token': s.csrf, 'if-match': cur.etag },
  });
  expect(r.status(), await r.text()).toBe(204);
}
async function supprimerCartes(s: Session) {
  const cartes = (await (await s.req.get('/api/carto/maps')).json()) as { id: string }[];
  for (const c of cartes)
    expect((await s.req.delete(`/api/carto/maps/${c.id}`, { headers: { 'x-csrf-token': s.csrf } })).status()).toBe(204);
}
async function carte(s: Session, view: 'context' | 'process') {
  const cartes = (await (await s.req.get('/api/carto/maps')).json()) as {
    id: string;
    view: string;
    version: number;
    layout: {
      nodes: Record<string, { x: number; y: number; w: number; h: number; label: string }>;
      edges: unknown[];
      hide: Record<string, number>;
    };
  }[];
  return cartes.find((c) => c.view === view)!;
}
type Box = { x: number; y: number; width: number; height: number };
const svg = (p: Page) => p.locator('svg.carte-svg');
const noeud = (p: Page, ref: string) => p.locator(`g.noeud[data-n="${ref}"]`);

/** Glisse un nœud de (dx, dy) pixels d'écran. */
async function glisser(p: Page, ref: string, dx: number, dy: number) {
  const b = (await noeud(p, ref).locator('rect').first().boundingBox())!;
  const x = b.x + Math.min(30, b.width / 2),
    y = b.y + Math.min(20, b.height / 2);
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await p.mouse.move(x + dx, y + dy, { steps: 4 });
  await p.mouse.up();
}
/** Facteur de zoom courant (transform du groupe principal). */
async function zoom(p: Page) {
  const t = (await svg(p).locator(':scope > g').first().getAttribute('transform')) ?? '';
  return Number(/scale\(([\d.]+)\)/.exec(t)?.[1] ?? 1);
}
async function generer(p: Page, vue: 'contexte' | 'processus') {
  await p.goto(`/cartographie/${vue}`);
  await p.getByRole('button', { name: 'Générer la carte' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Générer', exact: true }).click();
  await expect(p.getByText('Modifications non enregistrées')).toBeVisible();
}
async function enregistrer(p: Page) {
  await p.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(p.getByText('Carte enregistrée.')).toBeVisible();
  await expect(p.getByText('Modifications non enregistrées')).toBeHidden();
}

test.beforeAll(async ({ browser }) => {
  admin = await ouvrir(browser, '', '', 1920, 1080, await sessionAdmin(browser));
  etatInitial = (await etatLegacy(admin.req)).data;
  await ecrireLegacy(admin, (d) => Object.assign(d, structuredClone(DONNEES)));
  await supprimerCartes(admin);
  await creerCompte(browser, 'contrib-carto', 'contributeur');
  // Rôle personnalisé : cartographie et pilotage, sans les fournisseurs.
  const roles = (await (await admin.req.get('/api/admin/roles')).json()) as { id: string; name: string }[];
  let roleId = roles.find((x) => x.name === 'Carto sans fournisseurs')?.id;
  if (!roleId) {
    const role = await admin.req.post('/api/admin/roles', {
      data: { from: 'lecteur', name: 'Carto sans fournisseurs' },
      headers: { 'x-csrf-token': admin.csrf },
    });
    expect(role.status(), await role.text()).toBe(201);
    const r = await role.json();
    const patch = await admin.req.patch(`/api/admin/roles/${r.id}`, {
      data: { permissions: ['cartographie:lire', 'pilotage:lire', 'conformite:lire'] },
      headers: { 'x-csrf-token': admin.csrf, 'if-match': `"${r.version}"` },
    });
    expect(patch.status(), await patch.text()).toBe(200);
    roleId = r.id as string;
  }
  await creerCompte(browser, 'sans-fournisseurs', roleId!);
});

test.afterAll(async () => {
  await lecteur?.close();
  if (!admin) return;
  // Les présences des comptes de recette expirent (45 s au plus) avant les fichiers suivants : leurs captures
  // (tableau de bord, liste des personnes en ligne) ne doivent pas dépendre de ce fichier.
  await expect
    .poll(
      async () =>
        ((await (await admin.req.get('/api/presence')).json()) as { username: string }[]).filter((x) =>
          ['sans-fournisseurs', 'contrib-carto'].includes(x.username),
        ).length,
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBe(0);
  await supprimerCartes(admin);
  await ecrireLegacy(admin, (d) => {
    for (const k of Object.keys(d)) if (k !== 'maps') delete d[k];
    Object.assign(d, etatInitial);
    delete d.maps;
  });
  await admin.close();
});

let lecteur: Session;
test('1. lecteur sans carte : état vide, aucun bouton Générer ni Modifier (CARTO-01)', async ({ browser }) => {
  // Lecteur de la cartographie (rôle personnalisé dérivé de Lecteur, sans les fournisseurs : voir aussi le parcours 17).
  lecteur = await ouvrir(browser, 'sans-fournisseurs', comptes['sans-fournisseurs']!.secret);
  const s = lecteur;
  await s.page.goto('/cartographie/contexte');
  await expect(s.page.getByRole('heading', { name: 'Aucune carte de contexte' })).toBeVisible();
  await expect(s.page.getByRole('button', { name: /Générer/ })).toHaveCount(0);
  await expect(s.page.getByRole('button', { name: 'Modifier la disposition' })).toHaveCount(0);
  await expect(s.page.getByText('Lecture seule')).toBeVisible();
  expect(s.problems).toEqual([]);
});

test('2. le RSSI génère la vue contexte : SMSI dans le périmètre, PI à gauche, fournisseurs à droite (CARTO-05, 06)', async () => {
  const p = admin.page;
  await generer(p, 'contexte');
  for (const ref of ['isms', 'scope', 'band:ext', 'band:int', 'zone:out', 'pi:PI-001', 'sup:SUP-101'])
    await expect(noeud(p, ref)).toHaveCount(1);
  const pos = async (ref: string) => (await noeud(p, ref).locator('rect').first().boundingBox())!;
  const [isms, scope, pi, sup, ext, int] = (await Promise.all(
    ['isms', 'scope', 'pi:PI-001', 'sup:SUP-101', 'band:ext', 'band:int'].map(pos),
  )) as [Box, Box, Box, Box, Box, Box];
  expect(isms.x).toBeGreaterThan(scope.x);
  expect(isms.x + isms.width).toBeLessThan(scope.x + scope.width);
  expect(pi.x + pi.width).toBeLessThanOrEqual(scope.x + 1);
  expect(sup.x).toBeGreaterThanOrEqual(scope.x + scope.width - 1);
  expect(ext.y).toBeLessThan(scope.y);
  expect(int.y).toBeGreaterThan(scope.y + scope.height - 1);
  await p.screenshot({ path: 'test-results/carto-contexte.png' });
  await enregistrer(p);
  expect(admin.problems).toEqual([]);
});

test('3. vue processus : 3 bandes, sous-processus dans le parent, propositions à valider (CARTO-05)', async () => {
  const p = admin.page;
  await generer(p, 'processus');
  for (const ref of ['lane:pil', 'lane:rea', 'lane:sup']) await expect(noeud(p, ref)).toHaveCount(1);
  const parent = (await noeud(p, 'process:PRS-001').locator('rect').first().boundingBox())!;
  const enfant = (await noeud(p, 'process:PRS-001.1').locator('rect').first().boundingBox())!;
  expect(enfant.x).toBeGreaterThan(parent.x);
  expect(enfant.x + enfant.width).toBeLessThan(parent.x + parent.width);
  // Propositions (flux et liens support / pilotage) : dessinées, marquées « à valider » en édition.
  expect(await p.locator('g.lien.c-proposition').count()).toBeGreaterThan(3);
  await p.getByRole('button', { name: 'Modifier la disposition' }).click();
  await expect(p.locator('g.lien text', { hasText: '?' }).first()).toBeVisible();
  await p.screenshot({ path: 'test-results/carto-processus.png' });
  await enregistrer(p);
  await p.getByRole('button', { name: 'Terminer l’édition' }).click();
  expect(admin.problems).toEqual([]);
});

/** Clique au milieu d'un lien (point du tracé, converti en coordonnées d'écran). */
async function cliquerLien(p: Page, key: string) {
  const pt = await p.evaluate((k) => {
    const path = document.querySelector<SVGPathElement>(`g.lien[data-e="${CSS.escape(k)}"] path.lien-trait`)!;
    const q = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
    return { x: q.x, y: q.y };
  }, key);
  await p.mouse.click(pt.x, pt.y);
}
async function objets(s: Session) {
  return (
    (await (await s.req.get('/api/carto/objects')).json()) as { objects: { ref: string; type: string; name: string }[] }
  ).objects;
}
/** Flux temps réel connecté (sinon un changement fait juste après l'ouverture de la page serait manqué). */
async function enLigne(p: Page) {
  await expect(p.locator('.live-badge')).toHaveText('En direct');
  await expect(p.locator('g.noeud').first()).toBeAttached();
}
async function editer(p: Page) {
  await p.getByRole('button', { name: 'Modifier la disposition' }).click();
  await expect(p.getByRole('button', { name: 'Terminer l’édition' })).toBeVisible();
}

test('4. déplacer le SMSI de 60 × 40, enregistrer, recharger : position conservée ; le zoom ne change rien (CARTO-03, 06, 07)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  const avant = (await carte(admin, 'context')).layout.nodes.isms!;
  await editer(p);
  const k = await zoom(p);
  await glisser(p, 'isms', 60 * k, 40 * k);
  await enregistrer(p);
  const apres = (await carte(admin, 'context')).layout.nodes.isms!;
  expect(Math.abs(apres.x - avant.x - 60)).toBeLessThanOrEqual(1);
  expect(Math.abs(apres.y - avant.y - 40)).toBeLessThanOrEqual(1);
  await p.reload();
  await p.getByRole('button', { name: 'Zoom avant' }).click();
  await p.getByRole('button', { name: 'Zoom avant' }).click();
  // Panoramique sur le fond du canevas : aucune modification de la carte.
  const box = (await svg(p).boundingBox())!;
  await p.mouse.move(box.x + 10, box.y + box.height - 10);
  await p.mouse.down();
  await p.mouse.move(box.x + 120, box.y + box.height - 60, { steps: 5 });
  await p.mouse.up();
  await expect(p.getByText('Modifications non enregistrées')).toBeHidden();
  expect((await carte(admin, 'context')).layout.nodes.isms).toEqual(apres);
  expect(admin.problems).toEqual([]);
});

test('5. déplacer le cadre « Périmètre » : tout son contenu suit (CARTO-07)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  const avant = (await carte(admin, 'context')).layout.nodes;
  await editer(p);
  const k = await zoom(p);
  await glisser(p, 'scope', 100 * k, 50 * k);
  await enregistrer(p);
  const apres = (await carte(admin, 'context')).layout.nodes;
  const d = (r: string) => [apres[r]!.x - avant[r]!.x, apres[r]!.y - avant[r]!.y];
  const [dx, dy] = d('scope');
  expect(Math.abs(dx! - 100)).toBeLessThanOrEqual(1);
  for (const r of ['isms', 'process:PRR-001', 'process:PRS-001']) expect(d(r)).toEqual([dx, dy]);
  expect(d('pi:PI-001')).toEqual([0, 0]);
  expect(admin.problems).toEqual([]);
});

test('6. renommer un processus dans son module : nouveau nom, même position, sans enregistrer (CARTO-02, 08)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  await enLigne(p);
  const pos = (await carte(admin, 'context')).layout.nodes['process:PRR-001'];
  await ecrireLegacy(admin, (d) => {
    const pr = (d.processes as { id: string; name: string }[]).find((x) => x.id === 'PRR-001')!;
    pr.name = 'Concevoir les projets numériques';
  });
  await expect(noeud(p, 'process:PRR-001')).toContainText('Concevoir les projets numériques');
  await expect(p.getByText('Modifications non enregistrées')).toBeHidden();
  expect((await carte(admin, 'context')).layout.nodes['process:PRR-001']).toEqual(pos);
  expect(admin.problems).toEqual([]);
});

test('7. supprimer une partie intéressée : « Objet indisponible », puis « Retirer de la carte » (CARTO-08)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  await enLigne(p);
  await ecrireLegacy(admin, (d) => {
    d.interested = (d.interested as { id: string }[]).filter((x) => x.id !== 'PI-004');
  });
  await expect(noeud(p, 'pi:PI-004')).toContainText('Objet indisponible');
  const bandeau = p.getByRole('alert').filter({ hasText: '1 objet indisponible' });
  await expect(bandeau).toBeVisible();
  await bandeau.getByRole('button', { name: 'Retirer de la carte' }).click();
  await expect(noeud(p, 'pi:PI-004')).toHaveCount(0);
  await enregistrer(p);
  expect(admin.problems).toEqual([]);
});

test('8. créer une partie intéressée : bandeau, « Choisir et ajouter », placée sans chevauchement (CARTO-08, 09)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  await enLigne(p);
  await ecrireLegacy(admin, (d) => {
    (d.interested as object[]).push({ id: 'PI-005', name: 'Prestataire de formation (fictif)', type: 'Externe' });
  });
  const bandeau = p.getByRole('alert').filter({ hasText: '1 nouvel objet' });
  await expect(bandeau).toBeVisible();
  await bandeau.getByRole('button', { name: 'Choisir et ajouter' }).click();
  const dlg = p.getByRole('dialog', { name: 'Ajouter depuis la plateforme' });
  await dlg.getByLabel('Prestataire de formation (fictif)').check();
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(noeud(p, 'pi:PI-005')).toHaveCount(1);
  await enregistrer(p);
  const nodes = (await carte(admin, 'context')).layout.nodes;
  const n = nodes['pi:PI-005']!;
  for (const [r, m] of Object.entries(nodes)) {
    if (r === 'pi:PI-005' || ['scope', 'band:ext', 'band:int', 'zone:out'].includes(r)) continue;
    expect(n.x < m.x + m.w && n.x + n.w > m.x && n.y < m.y + m.h && n.y + n.h > m.y, `chevauche ${r}`).toBe(false);
  }
  expect(admin.problems).toEqual([]);
});

test('9. relier deux processus, Suppr, Ctrl+Z, Ctrl+Y : l’objet métier existe toujours (CARTO-07)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/processus');
  await editer(p);
  const avant = await p.locator('g.lien[data-e^="m:"]').count();
  await p.getByRole('button', { name: 'Relier' }).click();
  await noeud(p, 'process:PRR-001')
    .locator('rect')
    .first()
    .click({ position: { x: 20, y: 20 } });
  await noeud(p, 'process:PRS-002')
    .locator('rect')
    .first()
    .click({ position: { x: 20, y: 20 } });
  const dlg = p.getByRole('dialog', { name: 'Nouvelle relation' });
  await dlg.getByLabel('Type de relation').click();
  await p.getByRole('option', { name: 'Dépendance' }).click();
  await dlg.getByRole('button', { name: 'Créer la relation' }).click();
  await expect(p.locator('g.lien[data-e^="m:"]')).toHaveCount(avant + 1);
  await noeud(p, 'process:PRS-002')
    .locator('rect')
    .first()
    .click({ position: { x: 20, y: 20 } });
  await p.keyboard.press('Delete');
  await expect(noeud(p, 'process:PRS-002')).toHaveCount(0);
  await p.keyboard.press('Control+z');
  await expect(noeud(p, 'process:PRS-002')).toHaveCount(1);
  await p.keyboard.press('Control+y');
  await expect(noeud(p, 'process:PRS-002')).toHaveCount(0);
  expect((await objets(admin)).some((o) => o.ref === 'process:PRS-002')).toBe(true);
  await enregistrer(p);
  expect((await carte(admin, 'process')).layout.nodes['process:PRS-002']).toBeUndefined();
  expect(admin.problems).toEqual([]);
});

test('10. masquer une relation métier, valider une proposition (CARTO-07)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  await editer(p);
  const cle = 'd:pi:PI-001>scope:interacts_with';
  await cliquerLien(p, cle);
  await p.getByRole('button', { name: 'Masquer sur cette carte' }).click();
  await expect(p.locator(`g.lien[data-e="${cle}"]`)).toHaveCount(0);
  await enregistrer(p);
  expect((await carte(admin, 'context')).layout.hide).toHaveProperty([cle], 1);
  // Vue processus : une proposition validée devient une relation graphique.
  await p.goto('/cartographie/processus');
  await editer(p);
  const prop = p.locator('g.lien.c-proposition').first();
  const key = (await prop.getAttribute('data-e'))!;
  await cliquerLien(p, key);
  await p.getByRole('button', { name: 'Valider la proposition' }).click();
  await expect(p.locator(`g.lien[data-e="${key}"]`)).not.toHaveClass(/c-proposition/);
  await enregistrer(p);
  const e = (await carte(admin, 'process')).layout.edges.find((x) => 'm:' + (x as { id: string }).id === key);
  expect(e).not.toHaveProperty('gen');
  expect(admin.problems).toEqual([]);
});

test('11. deux sessions : présence affichée, la seconde reçoit 412 et choisit « Écraser » (CARTO-04, 07)', async ({
  browser,
}) => {
  const p = admin.page;
  const c = await ouvrir(browser, 'contrib-carto', comptes['contrib-carto']!.secret);
  try {
    await p.goto('/cartographie/contexte');
    await c.page.goto('/cartographie/contexte');
    await editer(p);
    await editer(c.page);
    await expect(p.getByText('Compte contrib-carto modifie la carte')).toBeVisible();
    // Les deux modifient ; la seconde enregistre après la première.
    await glisser(p, 'pi:PI-002', 30, 0);
    await expect(p.getByText('Modifications non enregistrées')).toBeVisible();
    await glisser(c.page, 'pi:PI-001', 30, 0);
    await enregistrer(c.page);
    await p.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    const dlg = p.getByRole('dialog', { name: 'Carte modifiée entre-temps' });
    await expect(dlg).toContainText('modifiée par contrib-carto');
    // Une notification d'un enregistrement précédent peut encore être visible : attendre la réponse
    // de cet écrasement avant de consulter son audit, écrit avant la réponse du serveur.
    const ecrasement = p.waitForResponse(
      (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname.startsWith('/api/carto/maps/'),
    );
    await dlg.getByRole('button', { name: 'Écraser' }).click();
    expect((await ecrasement).status()).toBe(200);
    await expect(dlg).toBeHidden();
    await expect(p.getByText('Carte enregistrée.')).toBeVisible();
    const audit = (await (await admin.req.get('/api/admin/audit?q=carto.map_overwrite')).json()) as {
      action: string;
    }[];
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.every((e) => e.action === 'carto.map_overwrite')).toBe(true);
    // En quittant la carte, la présence est retirée.
    await c.page.getByRole('link', { name: 'Accueil' }).click();
    await expect(p.getByText('Compte contrib-carto modifie la carte')).toBeHidden();
    expect(c.problems).toEqual([]);
  } finally {
    // Contexte fermé même en cas d'échec : sinon sa présence reste active pour les fichiers suivants.
    await c.close();
  }
  expect(admin.problems).toEqual([]);
});

test('12. versions : « Revue de direction », modification, restauration exacte, 21e version (CARTO-11)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  const reference = (await carte(admin, 'context')).layout;
  await p.getByRole('button', { name: 'Versions', exact: true }).click();
  let dlg = p.getByRole('dialog', { name: 'Versions de la carte' });
  await dlg.getByLabel('Nouvelle version').fill('Revue de direction');
  await dlg.getByRole('button', { name: 'Enregistrer une version' }).click();
  await expect(p.getByText('Version enregistrée.')).toBeVisible();
  await dlg.getByRole('button', { name: 'Fermer' }).click();
  await editer(p);
  await glisser(p, 'isms', 80, 0);
  await enregistrer(p);
  expect((await carte(admin, 'context')).layout).not.toEqual(reference);
  await p.getByRole('button', { name: 'Versions', exact: true }).click();
  dlg = p.getByRole('dialog', { name: 'Versions de la carte' });
  await dlg.getByLabel('Revue de direction').check();
  await dlg.getByRole('button', { name: 'Restaurer la version' }).click();
  await expect(p.getByText('Version restaurée')).toBeVisible();
  expect((await carte(admin, 'context')).layout).toEqual(reference);
  // 20 versions au plus : la 21e supprime la plus ancienne.
  const id = (await carte(admin, 'context')).id;
  for (let i = 1; i <= 20; i++)
    await admin.req.post(`/api/carto/maps/${id}/versions`, {
      data: { label: `Version ${i}` },
      headers: { 'x-csrf-token': admin.csrf },
    });
  const versions = (await (await admin.req.get(`/api/carto/maps/${id}/versions`)).json()) as { label: string }[];
  expect(versions).toHaveLength(20);
  expect(versions.map((v) => v.label)).not.toContain('Revue de direction');
  expect(admin.problems).toEqual([]);
});

test('13. nature d’un enjeu modifiée, disposition automatique : il change de bande (CARTO-12)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  const enjeu = (await objets(admin)).find((o) => o.type === 'external_issue' && /Menace cyber/.test(o.name))!;
  const bande = (await carte(admin, 'context')).layout.nodes['band:int']!;
  await editer(p);
  await noeud(p, enjeu.ref)
    .locator('rect')
    .first()
    .click({ position: { x: 10, y: 10 } });
  await p.getByRole('textbox', { name: 'Nature de l’enjeu' }).click();
  await p.getByRole('option', { name: 'Enjeu interne' }).click();
  await expect(p.getByText('Nature de l’enjeu mise à jour')).toBeVisible();
  await p.getByRole('button', { name: 'Disposition automatique' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Recalculer' }).click();
  await enregistrer(p);
  const nodes = (await carte(admin, 'context')).layout.nodes;
  const n = nodes[enjeu.ref]!,
    b = nodes['band:int']!;
  expect(n.y).toBeGreaterThanOrEqual(b.y);
  expect(n.y + n.h).toBeLessThanOrEqual(b.y + b.h);
  expect(b.y).toBeGreaterThanOrEqual(bande.y - 1000);
  expect(admin.problems).toEqual([]);
});

test('14. recherche « achat », Entrée : 1 résultat, centré, sélectionné, le reste atténué (CARTO-06)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  const q = p.getByRole('textbox', { name: 'Rechercher un objet sur la carte' });
  await q.fill('achat');
  await expect(p.getByText('1 résultat', { exact: true })).toBeVisible();
  await q.press('Enter');
  await expect(noeud(p, 'process:PRS-001')).toHaveAttribute('aria-pressed', 'true');
  await expect(noeud(p, 'isms')).toHaveClass(/c-attenue/);
  await expect(noeud(p, 'process:PRS-001')).not.toHaveClass(/c-attenue/);
  // Centré : le milieu de l'objet est proche du milieu du canevas.
  const c = (await svg(p).boundingBox())!,
    n = (await noeud(p, 'process:PRS-001').locator('rect').first().boundingBox())!;
  expect(Math.abs(n.x + n.width / 2 - (c.x + c.width / 2))).toBeLessThan(40);
  await expect(p.getByText('Modifications non enregistrées')).toBeHidden();
  expect(admin.problems).toEqual([]);
});

test('15. filtre HDS désactivé, préréglage « Parties intéressées » : atténuation sans déplacement (CARTO-06)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  await expect(noeud(p, 'isms')).toHaveCount(1);
  const tous = await p.locator('g.noeud').count();
  const isms = await noeud(p, 'isms').locator('rect').first().boundingBox();
  // Chaque bascule est enregistrée dans les préférences : on attend son effet avant la suivante.
  const basculer = async (nom: string, etat: boolean) => {
    const sw = p.getByRole('switch', { name: nom });
    if ((await sw.isChecked()) === etat) return;
    const enregistre = p.waitForResponse(
      (r) => r.url().endsWith('/api/account/preferences') && r.request().method() === 'PUT',
    );
    await sw.click({ force: true });
    await enregistre;
    await expect(sw).toBeChecked({ checked: etat });
  };
  await basculer('HDS', true);
  await basculer('ISO 27001', true);
  await expect(p.locator('g.noeud')).toHaveCount(tous);
  await basculer('HDS', false);
  // Aucun objet du jeu de recette ne relève du seul HDS : rien n'est masqué.
  await expect(p.locator('g.noeud')).toHaveCount(tous);
  await basculer('ISO 27001', false);
  // Sans aucun référentiel, seuls restent le SMSI, le périmètre et les cadres.
  await expect(noeud(p, 'pi:PI-001')).toHaveCount(0);
  await basculer('ISO 27001', true);
  await basculer('HDS', true);
  await p.reload();
  await expect(p.getByRole('switch', { name: 'HDS' })).toBeChecked();
  await expect(p.getByRole('switch', { name: 'ISO 27001' })).toBeChecked();
  await p.getByRole('button', { name: 'Parties intéressées' }).click();
  await expect(noeud(p, 'process:PRR-001')).toHaveClass(/c-attenue/);
  await expect(noeud(p, 'pi:PI-001')).not.toHaveClass(/c-attenue/);
  expect(await noeud(p, 'isms').locator('rect').first().boundingBox()).toEqual(isms);
  await p.getByRole('button', { name: 'Globale' }).click();
  expect(admin.problems).toEqual([]);
});

test('16. exports PNG, SVG, PDF, JSON : fichiers lisibles avec titre et légende ; journal d’audit (CARTO-13)', async () => {
  const p = admin.page;
  await p.goto('/cartographie/contexte');
  const fichiers: Record<string, Buffer> = {};
  for (const [libelle, ext] of [
    ['Image PNG (haute définition)', 'png'],
    ['SVG (vectoriel, modifiable)', 'svg'],
    ['PDF A3 paysage', 'pdf'],
    ['Disposition de la carte (JSON)', 'json'],
  ] as const) {
    await p.getByRole('button', { name: 'Exporter' }).click();
    const dl = p.waitForEvent('download');
    // Le téléchargement est local ; son événement peut précéder la requête d'audit asynchrone.
    const logged = p.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/carto/exports' &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON().format === ext,
    );
    await p.getByRole('menuitem', { name: libelle }).click();
    const d = await dl;
    expect((await logged).ok()).toBe(true);
    expect(d.suggestedFilename()).toMatch(new RegExp(`^Cartographie_contexte_\\d{8}-\\d{4}\\.${ext}$`));
    fichiers[ext] = readFileSync((await d.path())!);
  }
  expect(fichiers.png!.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(fichiers.pdf!.subarray(0, 8).toString()).toBe('%PDF-1.4');
  expect(fichiers.pdf!.toString('latin1')).toContain('/Title (Cartographie du contexte SMSI)');
  const svgTexte = fichiers.svg!.toString();
  expect(svgTexte).toContain('Cartographie du contexte SMSI');
  expect(svgTexte).toContain('Partie intéressée, fournisseur');
  expect(svgTexte).not.toMatch(/style=|class=/);
  expect(JSON.parse(fichiers.json!.toString())).toMatchObject({ type: 'smsi-map-layout', view: 'context' });
  const audit = (await (await admin.req.get('/api/admin/audit?q=carto.export')).json()) as {
    details: { format: string };
  }[];
  expect(
    audit
      .slice(0, 4)
      .map((a) => a.details.format)
      .sort(),
  ).toEqual(['json', 'pdf', 'png', 'svg']);
  expect(admin.problems).toEqual([]);
});

test('17. rôle sans fournisseurs:lire : fournisseurs absents de l’API, boîtes « Objet non accessible » (CARTO-01)', async () => {
  const p = lecteur.page;
  expect((await objets(lecteur)).some((o) => o.ref.startsWith('sup:'))).toBe(false);
  await p.goto('/cartographie/contexte');
  await expect(noeud(p, 'sup:SUP-101')).toContainText('Objet non accessible');
  await expect(p.getByText('Certains objets ne sont pas affichés')).toBeVisible();
  // Lecture seule réelle : aucune poignée, aucun bouton d'édition, écriture refusée par le serveur.
  await expect(p.getByRole('button', { name: 'Modifier la disposition' })).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'Enregistrer', exact: true })).toHaveCount(0);
  const m = await carte(lecteur, 'context');
  const r = await lecteur.req.put(`/api/carto/maps/${m.id}`, {
    data: { layout: m.layout },
    headers: { 'x-csrf-token': lecteur.csrf, 'if-match': `"${m.version}"` },
  });
  expect(r.status()).toBe(403);
  expect(lecteur.problems).toEqual([]);
});

test('18. import legacy avec S.maps : module reconnu, cartes identiques, /legacy en lecture seule, export identique (CARTO-14)', async () => {
  const exp = await admin.req.get('/api/admin/export/legacy');
  const env = await exp.json();
  const maps = structuredClone(env.data.maps);
  maps.process.updatedAt = '2026-10-08T09:00:00.000Z';
  const fichier = Buffer.from(JSON.stringify({ ...env.data, maps }));
  const sim = await admin.req.post('/api/admin/import/simulate?mode=merge', {
    data: fichier,
    headers: { 'x-csrf-token': admin.csrf, 'content-type': 'application/octet-stream', 'x-file-name': 'cartes.json' },
  });
  expect(sim.status(), await sim.text()).toBe(200);
  const rapport = (await sim.json()).report;
  expect(rapport.affected).toContain('maps');
  const sha = (await sim.json()).sha256 as string;
  const app = await admin.req.post(`/api/admin/import/apply?mode=merge&sha256=${sha}`, {
    data: fichier,
    headers: { 'x-csrf-token': admin.csrf, 'content-type': 'application/octet-stream', 'x-file-name': 'cartes.json' },
  });
  expect(app.status(), await app.text()).toBe(201);
  const retour = await (await admin.req.get('/api/admin/export/legacy')).json();
  expect(retour.data.maps).toEqual(maps);
  // /legacy : une modification de la cartographie est refusée (module repris).
  const st = await etatLegacy(admin.req);
  st.data.maps = { ...(st.data.maps as object), issueKind: { 'issue:abc': 'int' } };
  const ko = await admin.req.put('/api/legacy/state', {
    data: st.data,
    headers: { 'x-csrf-token': admin.csrf, 'if-match': st.etag },
  });
  expect(ko.status()).toBe(409);
  expect((await ko.json()).modules).toEqual(['maps']);
  expect(admin.problems).toEqual([]);
});

for (const [w, h] of [
  [390, 844],
  [1920, 1080],
  [3840, 2160],
] as const)
  for (const mode of ['clair', 'sombre'] as const)
    test(`19. écran ${w} px, mode ${mode} : pas de défilement horizontal, capture de référence (CARTO-06)`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({
        ignoreHTTPSErrors: true,
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        viewport: { width: w, height: h },
        colorScheme: mode === 'clair' ? 'light' : 'dark',
        reducedMotion: 'reduce',
        storageState: await admin.page.context().storageState(),
      });
      const page = await ctx.newPage();
      const problems = watchPage(page);
      await page.goto('/cartographie/contexte');
      await expect(noeud(page, 'isms')).toHaveCount(1);
      await page.getByRole('button', { name: 'Ajuster à l’écran' }).click();
      if (w < 900) {
        // Téléphone : la fiche s'ouvre en feuille basse.
        await noeud(page, 'isms')
          .locator('rect')
          .first()
          .click({ position: { x: 20, y: 20 } });
        const fiche = page.locator('.carte-inspecteur');
        await expect(fiche).toBeVisible();
        const b = (await fiche.boundingBox())!;
        expect(Math.round(b.y + b.height)).toBe(h);
        expect(Math.round(b.width)).toBe(w);
        await page.getByRole('button', { name: 'Fermer la fiche' }).click();
      }
      await page.mouse.move(0, h - 1);
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await expect(page).toHaveScreenshot(`carte-contexte-${w}-${mode}.png`, {
        animations: 'disabled',
        caret: 'hide',
        mask: [
          page.locator('.live-badge'),
          page.locator('.app-version'),
          page.locator('.carte-pied'),
          page.locator('.carte-presence'),
          page.locator('.mantine-Notifications-root'),
        ],
        maxDiffPixelRatio: 0.01,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(problems).toEqual([]);
      await ctx.close();
    });

test('20. 400 objets : confirmation au-delà de 80, refus au-delà de 400, glisser fluide (CARTO-05, 06)', async () => {
  const p = admin.page;
  const processus = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `PX-${String(i + 1).padStart(3, '0')}`,
      name: `Processus fictif ${i + 1}`,
      family: ['Management', 'Réalisation', 'Support'][i % 3],
    }));
  await p.goto('/cartographie/processus');
  await enLigne(p);
  await ecrireLegacy(admin, (d) => {
    d.processes = processus(405);
  });
  await p.goto('/cartographie/processus');
  await p.getByRole('button', { name: 'Générer…' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Générer', exact: true }).click();
  await expect(p.getByText(/Plus de 400 objets \(405\)/)).toBeVisible();
  await ecrireLegacy(admin, (d) => {
    d.processes = processus(120);
  });
  await expect(p.getByRole('dialog')).toBeVisible();
  await p.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();
  await p.reload();
  await p.getByRole('button', { name: 'Générer…' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Générer', exact: true }).click();
  await expect(p.getByText('La carte comportera 120 objets')).toBeVisible();
  await p.getByRole('button', { name: 'Générer quand même' }).click();
  await expect(p.locator('g.noeud[data-n^="process:PX-"]')).toHaveCount(120);
  await editer(p);
  const debut = Date.now();
  await glisser(p, 'process:PX-002', 40, 30);
  expect(Date.now() - debut, 'glisser fluide').toBeLessThan(3000);
  await expect(p.getByText('Modifications non enregistrées')).toBeVisible();
  expect(admin.problems).toEqual([]);
});
