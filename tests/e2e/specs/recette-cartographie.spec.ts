/* Recette de la cartographie (docs/cartographie/RECETTE.md, CARTO-01 à CARTO-19) sur la pile Docker : 32 parcours,
   captures 390 / 1920 / 3840 px, aucune violation de CSP, lecture seule réelle. Données FICTIVES
   (tests/fixtures/carto-donnees.json). Exécutés après parcours.spec.ts (compte administrateur) ; l'état legacy est
   rétabli à la fin pour les fichiers suivants. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { apiLogin, csrfOf, ecrireEtat, markTotpUsed, PASSWORD, sessionAdmin, totp, watchPage } from '../helpers';

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
  const r = await req.get('/api/suivi/etat');
  return { data: (await r.json()) as Record<string, unknown>, etag: r.headers()['etag'] ?? '' };
}
async function ecrireLegacy(s: Session, patch: (d: Record<string, unknown>) => void) {
  const cur = await etatLegacy(s.req);
  patch(cur.data);
  await ecrireEtat(s.req, s.csrf, cur.data);
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
  await p.getByRole('button', { name: 'Générer depuis la plateforme' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Générer', exact: true }).click();
  await expect(p.getByText('Modifications non enregistrées')).toBeVisible();
}
async function enregistrer(p: Page) {
  await p.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(p.getByText('Carte enregistrée.').last()).toBeVisible();
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
    await c.page.getByRole('link', { name: 'Tableau de bord', exact: true }).click();
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
  await p.getByRole('combobox', { name: 'Nature de l’enjeu' }).click();
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

/* ---------------------------------------------------------------- Construire de zéro (CARTO-15 à CARTO-19) */
let bat: Session;
/** Centre (écran) d'un point de la zone du canevas, en fraction de sa taille. */
async function pointCanevas(p: Page, fx: number, fy: number) {
  const b = (await svg(p).boundingBox())!;
  return { x: Math.round(b.x + b.width * fx), y: Math.round(b.y + b.height * fy) };
}
async function centreNoeud(p: Page, ref: string) {
  const b = (await noeud(p, ref).locator('rect').first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
/** Point à viser sur un objet : centre de sa partie visible. Une grande boîte peut déborder de la zone du canevas
    (panneau latéral, bandeau « nouvel objet ») ou de la fenêtre ; un point hors de la zone n'appartient pas à la carte. */
async function pointVisible(p: Page, ref: string) {
  const b = (await noeud(p, ref).locator('rect').first().boundingBox())!;
  // La zone de la carte (et non le svg, qui peut la déborder) bornée par la fenêtre.
  const z = (await p.locator('.carte-zone').first().boundingBox())!;
  const f = p.viewportSize()!;
  const x1 = Math.max(b.x, z.x, 0),
    y1 = Math.max(b.y, z.y, 0),
    x2 = Math.min(b.x + b.width, z.x + z.width, f.width),
    y2 = Math.min(b.y + b.height, z.y + z.height, f.height);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}
/** Glisse un élément de la palette jusqu'à un point de l'écran. */
async function deposer(p: Page, item: string, cible: { x: number; y: number }) {
  const b = (await p.locator(`[data-palette="${item}"]`).boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2 + 10, { steps: 3 });
  await p.mouse.move(cible.x, cible.y, { steps: 8 });
  await expect(p.locator('.carte-fantome')).toBeVisible();
  await p.mouse.up();
}
async function menuSur(p: Page, pt: { x: number; y: number }) {
  await p.mouse.click(pt.x, pt.y, { button: 'right' });
  const m = p.getByRole('menu', { name: 'Actions sur la carte' });
  await expect(m).toBeVisible();
  return m;
}
async function creer(p: Page, titre: string, nom: string) {
  const d = p.getByRole('dialog', { name: titre });
  await expect(d).toBeVisible();
  await d.getByRole('textbox', { name: /^(Nom|Libellé)/ }).fill(nom);
  return d;
}
const refsDe = async (p: Page, prefixe: string) =>
  p.locator(`g.noeud[data-n^="${prefixe}"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-n')!));

test('21. installation vide : « Construire la carte », SMSI dans le périmètre, palette (CARTO-19)', async () => {
  // Nouvel onglet : l'onglet principal porte une carte modifiée non enregistrée (parcours 20).
  const page = await admin.page.context().newPage();
  bat = { ...admin, page, problems: watchPage(page) };
  await ecrireLegacy(admin, (d) => {
    Object.assign(d, { processes: [], interested: [], suppliers: [], appGaps: [], objectives: [], swots: [] });
    d.scope = {};
  });
  await supprimerCartes(admin);
  const p = bat.page;
  await p.goto('/cartographie/contexte');
  await expect(p.getByRole('heading', { name: 'Aucune carte de contexte' })).toBeVisible();
  await expect(p.getByRole('button', { name: 'Générer depuis la plateforme' })).toBeVisible();
  await p.getByRole('button', { name: 'Construire la carte' }).click();
  await expect(noeud(p, 'isms')).toHaveCount(1);
  await expect(noeud(p, 'scope')).toHaveCount(1);
  await expect(p.getByRole('region', { name: 'Palette : construire la carte' })).toBeVisible();
  await expect(p.getByRole('button', { name: 'Terminer l’édition' })).toBeVisible();
  expect(bat.problems).toEqual([]);
});

test('22. glisser « Partie intéressée » sur la carte : créée dans son module, placée au point de dépôt (CARTO-15, 17)', async () => {
  const p = bat.page;
  const cible = await pointCanevas(p, 0.18, 0.5);
  await deposer(p, 'stakeholder', cible);
  await (
    await creer(p, 'Créer : Partie intéressée', 'Autorité de contrôle (fictive)')
  )
    .getByRole('button', {
      name: 'Créer',
      exact: true,
    })
    .click();
  await expect(p.getByText('« Autorité de contrôle (fictive) » est enregistré dans la plateforme')).toBeVisible();
  await expect.poll(() => refsDe(p, 'pi:')).toHaveLength(1);
  const [ref] = await refsDe(p, 'pi:');
  const c = await centreNoeud(p, ref!);
  expect(Math.abs(c.x - cible.x)).toBeLessThan(40);
  expect(Math.abs(c.y - cible.y)).toBeLessThan(40);
  const pi = ((await etatLegacy(admin.req)).data.interested as { id: string; name: string; type: string }[])[0]!;
  expect(pi).toMatchObject({ name: 'Autorité de contrôle (fictive)', type: 'Externe' });
  expect('pi:' + pi.id).toBe(ref);
  expect(bat.problems).toEqual([]);
});

test('23. clic droit sur le fond > Créer ici > Fournisseur : créé et placé sans chevauchement (CARTO-15, 16)', async () => {
  const p = bat.page;
  // La fiche de l'objet créé au parcours 22 est ouverte en haut à droite : Échap la ferme.
  await p.keyboard.press('Escape');
  await expect(p.locator('.carte-inspecteur')).toHaveCount(0);
  const cible = await pointCanevas(p, 0.82, 0.5);
  const m = await menuSur(p, cible);
  await m.getByRole('menuitem', { name: 'Fournisseur' }).click();
  const d = await creer(p, 'Créer : Fournisseur', 'Hébergeur fictif');
  await d.getByRole('switch', { name: 'Hébergeur HDS' }).check();
  await d.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect.poll(() => refsDe(p, 'sup:')).toHaveLength(1);
  const [ref] = await refsDe(p, 'sup:');
  const c = await centreNoeud(p, ref!);
  expect(Math.abs(c.x - cible.x)).toBeLessThan(60);
  expect(((await objets(admin)).find((o) => o.ref === ref) as { hds?: boolean }).hds).toBe(true);
  expect(bat.problems).toEqual([]);
});

test('24. vue processus : processus créé dans la bande Réalisation, sous-processus avec son parent (CARTO-15, 17)', async () => {
  const p = bat.page;
  await p.getByRole('button', { name: 'Vue processus' }).click();
  await p.getByRole('button', { name: 'Construire la carte' }).click();
  for (const ref of ['lane:pil', 'lane:rea', 'lane:sup']) await expect(noeud(p, ref)).toHaveCount(1);
  await p.getByRole('button', { name: 'Ajuster à l’écran' }).click();
  const rea = (await noeud(p, 'lane:rea').locator('rect').first().boundingBox())!;
  const m = await menuSur(p, { x: rea.x + rea.width * 0.3, y: rea.y + rea.height * 0.6 });
  await m.getByRole('menuitem', { name: 'Processus', exact: true }).click();
  const d = await creer(p, 'Créer : Processus', 'Réaliser les services (fictif)');
  await expect(d.getByRole('combobox', { name: 'Famille' })).toHaveValue('Réalisation');
  await d.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(noeud(p, 'process:PR1')).toHaveCount(1);
  const b = (await noeud(p, 'process:PR1').locator('rect').first().boundingBox())!;
  expect(b.y).toBeGreaterThan(rea.y);
  expect(b.y + b.height).toBeLessThan(rea.y + rea.height + 2);
  await deposer(p, 'subprocess', await pointVisible(p, 'process:PR1'));
  const d2 = p.getByRole('dialog', { name: 'Créer : Sous-processus' });
  await expect(d2.getByRole('combobox', { name: 'Processus parent' })).toHaveValue(/^PR1 — /);
  await expect(d2.getByRole('textbox', { name: 'Code' })).toHaveAttribute('placeholder', 'PR1.1');
  await d2.getByRole('textbox', { name: 'Nom' }).fill('Étape fictive');
  await d2.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(noeud(p, 'process:PR1.1')).toHaveCount(1);
  expect((await objets(admin)).find((o) => o.ref === 'process:PR1.1')).toMatchObject({ type: 'subprocess' });
  await enregistrer(p);
  expect(bat.problems).toEqual([]);
});

test('25. enjeu externe créé sur la carte : bande externe, réglages de la carte (CARTO-15, 19)', async () => {
  const p = bat.page;
  await p.getByRole('button', { name: 'Vue contexte' }).click();
  // Le test précédent laisse la vue processus à l'écran : on attend que la carte contexte la remplace avant de viser
  // un point du canevas, sinon le clic droit peut tomber pendant le changement de vue.
  await expect(noeud(p, 'lane:rea')).toHaveCount(0);
  await expect(noeud(p, 'isms')).toHaveCount(1);
  const m = await menuSur(p, await pointCanevas(p, 0.5, 0.12));
  await m.getByRole('menuitem', { name: 'Enjeu', exact: true }).click();
  await (
    await creer(p, 'Créer : Enjeu', 'Menace fictive (carte)')
  )
    .getByRole('button', {
      name: 'Créer',
      exact: true,
    })
    .click();
  await expect.poll(() => refsDe(p, 'issue:')).toHaveLength(1);
  const o = (await objets(admin)).find((x) => x.name === 'Menace fictive (carte)') as unknown as {
    type: string;
    src: { k: string }[];
  };
  expect(o).toMatchObject({ type: 'external_issue', src: [{ k: 'map' }] });
  expect(bat.problems).toEqual([]);
});

test('26. Ctrl+Z après une création : la boîte quitte la carte, l’objet reste dans la plateforme (CARTO-15)', async () => {
  const p = bat.page;
  const [ref] = await refsDe(p, 'issue:');
  await svg(p).focus();
  await p.keyboard.press('Control+z');
  await expect(noeud(p, ref!)).toHaveCount(0);
  expect((await objets(admin)).some((o) => o.ref === ref)).toBe(true);
  await p.keyboard.press('Control+y');
  await expect(noeud(p, ref!)).toHaveCount(1);
  expect(bat.problems).toEqual([]);
});

test('27. note et cadre : grouper deux objets dans un cadre qui les emporte ; conservés à l’enregistrement (CARTO-16, 19)', async () => {
  const p = bat.page;
  const m = await menuSur(p, await pointCanevas(p, 0.3, 0.8));
  await m.getByRole('menuitem', { name: 'Note', exact: true }).click();
  const d = p.getByRole('dialog', { name: 'Ajouter une note' });
  await d.getByRole('textbox', { name: 'Texte' }).fill('À vérifier avec le RSSI (fictif)');
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect.poll(() => refsDe(p, 'note:')).toHaveLength(1);
  // Sélection multiple (Maj+clic) puis « Grouper dans un cadre » au clic droit.
  const [pi] = await refsDe(p, 'pi:');
  const [sup] = await refsDe(p, 'sup:');
  await p.keyboard.press('Escape');
  // La fiche flottante s'ouvre en haut à droite, au-dessus du fournisseur : on sélectionne d'abord celui-ci, et le
  // clic droit vise la partie intéressée, à gauche.
  await noeud(p, sup!)
    .locator('rect')
    .first()
    .click({ position: { x: 8, y: 8 } });
  await noeud(p, pi!)
    .locator('rect')
    .first()
    .click({ position: { x: 8, y: 8 }, modifiers: ['Shift'] });
  await expect(p.getByRole('heading', { name: '2 objets sélectionnés' })).toBeVisible();
  const menu = await menuSur(p, await pointVisible(p, pi!));
  await menu.getByRole('menuitem', { name: 'Grouper dans un cadre' }).click();
  await expect.poll(() => refsDe(p, 'frame:')).toHaveLength(1);
  const [cadre] = await refsDe(p, 'frame:');
  // Le cadre emporte son contenu : chaque objet se déplace exactement comme le cadre (mesure relative, indépendante
  // du zoom et des bandeaux au-dessus de la carte).
  const position = async () => Promise.all([cadre!, pi!, sup!].map((r) => centreNoeud(p, r)));
  const avant = await position();
  const fb = (await noeud(p, cadre!).locator('rect').first().boundingBox())!;
  await p.mouse.move(fb.x + 30, fb.y + 12);
  await p.mouse.down();
  await p.mouse.move(fb.x + 60, fb.y + 52, { steps: 5 });
  await p.mouse.up();
  // Mesure relative attendue stable, pas instantanée : le rendu des objets du cadre suit celui du cadre quelques
  // images plus tard (sous charge, 6 px de retard relevés juste après le relâchement). Mêmes seuils qu'avant (15 px de
  // déplacement, 1,5 px d'écart entre le cadre et chaque objet), évalués jusqu'à stabilisation (10 s au plus).
  const mesures = async () => {
    const apres = await position();
    const delta = apres.map((a, i) => ({ x: a.x - avant[i]!.x, y: a.y - avant[i]!.y }));
    const ecart = Math.max(
      ...delta.slice(1).flatMap((d) => [Math.abs(d.x - delta[0]!.x), Math.abs(d.y - delta[0]!.y)]),
    );
    return { deplacement: Math.hypot(delta[0]!.x, delta[0]!.y), ecart };
  };
  await expect.poll(async () => (await mesures()).deplacement, { message: 'le cadre a bougé' }).toBeGreaterThan(15);
  await expect
    .poll(async () => (await mesures()).ecart, { message: 'les objets du cadre suivent le cadre' })
    .toBeLessThan(1.5);
  await enregistrer(p);
  const l = (await carte(admin, 'context')).layout as unknown as { free: Record<string, { text: string }> };
  expect(
    Object.values(l.free)
      .map((f) => f.text)
      .sort(),
  ).toEqual(['Groupe', 'À vérifier avec le RSSI (fictif)']);
  await p.reload();
  await expect.poll(() => refsDe(p, 'note:')).toHaveLength(1);
  expect(bat.problems).toEqual([]);
});

test('28. renommer par double-clic : confirmation, nom changé dans la plateforme, position conservée (CARTO-18)', async () => {
  const p = bat.page;
  const [ref] = await refsDe(p, 'pi:');
  await editer(p);
  const avant = await centreNoeud(p, ref!);
  await noeud(p, ref!)
    .locator('rect')
    .first()
    .dblclick({ position: { x: 10, y: 10 } });
  const d = p.getByRole('dialog', { name: 'Renommer' });
  await expect(d.getByText('Le nom change partout dans la plateforme')).toBeVisible();
  await d.getByRole('textbox', { name: 'Nouveau nom' }).fill('Autorité de contrôle renommée (fictive)');
  await d.getByRole('button', { name: 'Renommer' }).click();
  await expect(noeud(p, ref!)).toHaveAttribute('aria-label', /Autorité de contrôle renommée \(fictive\)/);
  expect(await centreNoeud(p, ref!)).toEqual(avant);
  const pi = ((await etatLegacy(admin.req)).data.interested as { name: string }[])[0]!;
  expect(pi.name).toBe('Autorité de contrôle renommée (fictive)');
  expect(bat.problems).toEqual([]);
});

test('30. appui long (tactile) et Maj+F10 (clavier) : même menu, navigable, fermé par Échap (CARTO-16)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1280, height: 900 },
    hasTouch: true,
    storageState: await admin.page.context().storageState(),
  });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await page.goto('/cartographie/contexte');
  await expect(noeud(page, 'isms')).toHaveCount(1);
  // La carte s'ouvre sur sa dernière vue : on l'ajuste à l'écran pour que la boîte du SMSI soit à portée du doigt.
  await page.getByRole('button', { name: 'Ajuster à l’écran' }).click();
  await expect
    .poll(async () => {
      const b = await noeud(page, 'isms').locator('rect').first().boundingBox();
      return !!b && b.x + 8 < 1280 && b.y + 8 < 900;
    })
    .toBe(true);
  const c = await pointVisible(page, 'isms');
  const cible = noeud(page, 'isms').locator('rect').first();
  await cible.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    pointerId: 7,
    isPrimary: true,
    button: 0,
    clientX: c.x,
    clientY: c.y,
    bubbles: true,
  });
  const menu = page.getByRole('menu', { name: 'Actions sur la carte' });
  await expect(menu).toBeVisible({ timeout: 3000 });
  await cible.dispatchEvent('pointerup', {
    pointerType: 'touch',
    pointerId: 7,
    clientX: c.x,
    clientY: c.y,
    bubbles: true,
  });
  await expect(menu.getByRole('menuitem', { name: 'Ouvrir la fiche' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  // Clavier : sélection, puis Maj+F10.
  await cible.click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  expect(problems).toEqual([]);
  await ctx.close();
});

test('31. trois objets sélectionnés : aligner à gauche, répartir ; Ctrl+Z annule en un pas (CARTO-16)', async () => {
  const p = bat.page;
  await p.goto('/cartographie/contexte');
  await editer(p);
  // De droite à gauche : la fiche flottante (en haut à droite) ne recouvre jamais l'objet suivant à cliquer.
  const refs = [...(await refsDe(p, 'sup:')), 'isms', ...(await refsDe(p, 'pi:'))];
  const avant = (await carte(admin, 'context')).layout.nodes;
  await noeud(p, refs[0]!)
    .locator('rect')
    .first()
    .click({ position: { x: 8, y: 8 } });
  for (const r of refs.slice(1))
    await noeud(p, r)
      .locator('rect')
      .first()
      .click({ position: { x: 8, y: 8 }, modifiers: ['Shift'] });
  await expect(p.getByRole('heading', { name: '3 objets sélectionnés' })).toBeVisible();
  await p.getByRole('button', { name: 'Aligner à gauche' }).click();
  // Positions relues jusqu'au rendu suivant : la mesure immédiate après le clic peut précéder le nouveau rendu.
  await expect
    .poll(async () => {
      const xs = await Promise.all(refs.map(async (r) => (await noeud(p, r).locator('rect').first().boundingBox())!.x));
      return Math.max(...xs) - Math.min(...xs);
    })
    .toBeLessThan(1.5);
  await p.getByRole('button', { name: 'Répartir verticalement' }).click();
  await svg(p).focus();
  await p.keyboard.press('Control+z');
  await p.keyboard.press('Control+z');
  await enregistrer(p).catch(() => {});
  const apres = (await carte(admin, 'context')).layout.nodes;
  for (const r of refs) expect(apres[r]!.x).toBe(avant[r]!.x);
  expect(bat.problems).toEqual([]);
});

test('32. lecteur : clic droit limité à la consultation, aucune palette (CARTO-16)', async () => {
  const p = lecteur.page;
  await p.goto('/cartographie/contexte');
  await expect(noeud(p, 'isms')).toHaveCount(1);
  await expect(p.getByRole('region', { name: 'Palette : construire la carte' })).toHaveCount(0);
  const m = await menuSur(p, await pointVisible(p, 'isms'));
  await expect(m.getByRole('menuitem')).toHaveText(['Ouvrir la fiche', 'Copier le nom']);
  await p.keyboard.press('Escape');
  const fond = await menuSur(p, await pointCanevas(p, 0.005, 0.01));
  await expect(fond.getByRole('menuitem')).toHaveText(['Ajuster l’affichage']);
  await p.keyboard.press('Escape');
  expect(lecteur.problems).toEqual([]);
  await bat.page.close();
});

/** Droits du rôle « Carto sans fournisseurs » : modifier un rôle coupe les sessions de ses comptes. */
async function droitsLecteur(perms: string[]) {
  const roles = (await (await admin.req.get('/api/admin/roles')).json()) as {
    id: string;
    name: string;
    version: number;
  }[];
  const r = roles.find((x) => x.name === 'Carto sans fournisseurs')!;
  const patch = await admin.req.patch(`/api/admin/roles/${r.id}`, {
    data: { permissions: perms },
    headers: { 'x-csrf-token': admin.csrf, 'if-match': `"${r.version}"` },
  });
  expect(patch.status(), await patch.text()).toBe(200);
}

// Exécuté en dernier : il élargit puis rétablit le rôle du lecteur (sans créer de compte, pour ne pas changer les
// captures des fichiers suivants).
test('29. sans fournisseurs:modifier : « Fournisseur » absent de la palette, grisé dans le menu ; API 403 (CARTO-15, 16)', async ({
  browser,
}) => {
  await lecteur.close();
  await droitsLecteur([
    'cartographie:lire',
    'cartographie:modifier',
    'pilotage:lire',
    'pilotage:modifier',
    'conformite:lire',
  ]);
  const s = await ouvrir(browser, 'sans-fournisseurs', comptes['sans-fournisseurs']!.secret);
  try {
    const p = s.page;
    await p.goto('/cartographie/contexte');
    await editer(p);
    await expect(p.locator('[data-palette="stakeholder"]')).toHaveCount(1);
    await expect(p.locator('[data-palette="supplier"]')).toHaveCount(0);
    const m = await menuSur(p, await pointCanevas(p, 0.1, 0.5));
    await expect(m.getByRole('menuitem', { name: /Fournisseur/ })).toBeDisabled();
    await p.keyboard.press('Escape');
    await expect(m).toHaveCount(0);
    const r = await s.req.post('/api/carto/objects', {
      data: { type: 'supplier', name: 'Refusé (fictif)' },
      headers: { 'x-csrf-token': s.csrf },
    });
    expect(r.status()).toBe(403);
    expect(s.problems).toEqual([]);
  } finally {
    await s.close();
    await droitsLecteur(['cartographie:lire', 'pilotage:lire', 'conformite:lire']);
  }
});
