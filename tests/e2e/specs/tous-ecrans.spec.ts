/* Adaptation à tous les écrans (9 quater) : captures de référence du tableau de bord, d'une liste avec sa fiche,
   de l'administration et des Paramètres, du téléphone (390 px) au 55 pouces 4K (3840 px), en mode clair et sombre ;
   largeur exploitée sur les très grands écrans ; aucun défilement horizontal ; écran mural (activation, révocation).
   Exécutés après parcours.spec.ts (ordre alphabétique des fichiers, un seul worker). */
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

test.describe.configure({ mode: 'serial' });

const LARGEURS = [
  [390, 844],
  [768, 1024],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
] as const;
const MODES = [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const;

let state: Awaited<ReturnType<BrowserContext['storageState']>>;
let docId = '';

async function context(browser: Browser, width: number, height: number, scheme: 'light' | 'dark', session = true) {
  return browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    viewport: { width, height },
    colorScheme: scheme,
    reducedMotion: 'reduce',
    ...(session ? { storageState: state } : {}),
  });
}

test.beforeAll(async ({ browser }) => {
  const session = await sessionAdmin(browser);
  state = session.state;
  const csrf = session.csrf;
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, storageState: state });

  // Données fictives figées : échéances loin dans le passé ou l'avenir, pour que les captures ne dépendent pas
  // de la date du jour.
  const cur = await ctx.request.get('/api/legacy/state');
  const data = await cur.json();
  data.findings = (data.findings as Record<string, unknown>[]).map((f, i) => ({
    ...f,
    due: i === 0 ? '2020-06-30' : '2099-12-31',
  }));
  const put = await ctx.request.put('/api/legacy/state', {
    data,
    headers: { 'x-csrf-token': csrf, 'if-match': cur.headers()['etag'] ?? '' },
  });
  expect(put.status(), await put.text()).toBe(204);

  // Document fictif au contenu fixe (empreinte stable), ouvert dans la vue « liste avec fiche ».
  const up = await ctx.request.post('/api/documents', {
    data: Buffer.from('Politique de sécurité fictive — document de test.\n'),
    headers: {
      'x-csrf-token': csrf,
      'content-type': 'application/octet-stream',
      'x-file-name': encodeURIComponent('politique-fictive.txt'),
      'x-meta': encodeURIComponent(
        JSON.stringify({ title: 'Politique fictive (capture)', category: 'Politiques', refs: ['A.5.1'] }),
      ),
    },
  });
  expect(up.status(), await up.text()).toBe(201);
  docId = (await up.json()).id;
  await ctx.close();
});

const PAGES = [
  { nom: 'tableau-de-bord', url: () => '/', titre: /^Bonjour/, contenu: /^Prochaines échéances$/ },
  {
    nom: 'liste-fiche',
    url: () => `/documents/${docId}`,
    titre: 'Documents et liens',
    contenu: 'Télécharger',
  },
  { nom: 'administration', url: () => '/admin/roles', titre: 'Administration', contenu: 'Lecteur et liens' },
  { nom: 'parametres', url: () => '/parametres/general', titre: 'Paramètres', contenu: 'Nom de l’application' },
] as const;

async function pret(page: Page, titre: string | RegExp, contenu: string | RegExp) {
  await expect(page.getByRole('heading', { name: titre, level: 1 })).toBeVisible();
  // Le flux temps réel reste ouvert (pas d'état « réseau au repos ») : on attend le contenu et les polices.
  await expect(page.getByText(contenu).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300); // fin des transitions (tiroir, menus)
}

const sansDefilementHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const p of PAGES)
  for (const [w, h] of LARGEURS)
    for (const [mode, scheme] of MODES)
      test(`écran ${w} px, mode ${mode} : ${p.nom}`, async ({ browser }) => {
        const ctx = await context(browser, w, h, scheme);
        const page = await ctx.newPage();
        const problems = watchPage(page);
        await page.goto(p.url());
        await pret(page, p.titre, p.contenu);
        await expect(page).toHaveScreenshot(`ecrans-${p.nom}-${w}-${mode}.png`, {
          animations: 'disabled',
          caret: 'hide',
          // Éléments variables d'une exécution à l'autre : présence, temps réel, version, notifications, dates.
          mask: [
            page.locator('.presence-bar'),
            page.locator('.presence-liste'),
            page.locator('.live-badge'),
            page.locator('.app-version'),
            page.locator('.horodatage'),
            page.locator('.mantine-Notifications-root'),
          ],
          maxDiffPixelRatio: 0.01,
        });
        expect(await sansDefilementHorizontal(page), 'défilement horizontal').toBe(true);
        expect(problems).toEqual([]);
        await ctx.close();
      });

/* Très grands écrans : le tableau de bord occupe la largeur (au plus 35 % de largeur inutilisée). */
for (const [w, h] of [
  [2560, 1440],
  [3840, 2160],
] as const)
  test(`tableau de bord à ${w} px : largeur exploitée`, async ({ browser }) => {
    const ctx = await context(browser, w, h, 'light');
    const page = await ctx.newPage();
    await page.goto('/');
    await pret(page, /^Bonjour/, /^Prochaines échéances$/);
    const r = await page.evaluate(() => {
      const cartes = Array.from(document.querySelectorAll('.grille-cartes > *')).map((e) => e.getBoundingClientRect());
      const gauche = Math.min(...cartes.map((c) => c.left));
      const droite = Math.max(...cartes.map((c) => c.right));
      const colonnes = new Set(cartes.map((c) => Math.round(c.left))).size;
      return { utilise: (droite - gauche) / window.innerWidth, colonnes };
    });
    expect(r.utilise, `largeur utilisée : ${Math.round(r.utilise * 100)} %`).toBeGreaterThanOrEqual(0.65);
    expect(r.colonnes).toBeGreaterThanOrEqual(4);
    await ctx.close();
  });

/* Téléphone : aucune page principale ne défile horizontalement. */
test('téléphone (390 px) : aucun défilement horizontal', async ({ browser }) => {
  const ctx = await context(browser, 390, 844, 'light');
  const page = await ctx.newPage();
  for (const url of [
    '/',
    '/documents',
    `/documents/${docId}`,
    '/account',
    '/parametres/general',
    '/admin/users',
    '/mur',
  ]) {
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    expect(await sansDefilementHorizontal(page), url).toBe(true);
  }
  await ctx.close();
});

/* Préférences : taille d'affichage enregistrée sur le serveur et appliquée sur un autre appareil. */
test('préférences d’affichage : enregistrées sur le serveur, appliquées partout', async ({ browser }) => {
  const a = await context(browser, 1366, 768, 'light');
  const page = await a.newPage();
  await page.goto('/account');
  await page.getByRole('textbox', { name: 'Taille d’affichage' }).click();
  await page.getByRole('option', { name: '130 %' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-taille', '130');
  await a.close();
  const b = await context(browser, 1920, 1080, 'dark');
  const autre = await b.newPage();
  await autre.goto('/');
  await expect(autre.locator('html')).toHaveAttribute('data-taille', '130');
  // Remise à la valeur par défaut (les captures suivantes n'en dépendent pas).
  const csrf = await csrfOf(autre.request);
  const r = await autre.request.put('/api/account/preferences', {
    data: { taille: 'auto', densite: 'organisation', theme: 'organisation', colonnes: {} },
    headers: { 'x-csrf-token': csrf },
  });
  expect(r.ok()).toBe(true);
  await b.close();
});

/* Écran mural : activation par lien à usage unique, affichage plein écran sans menu, révocation. */
test('écran mural : activation, affichage, révocation', async ({ browser }) => {
  const admin = await context(browser, 1366, 768, 'light');
  const csrf = await csrfOf(admin.request);
  const c = await admin.request.post('/api/admin/murs', {
    data: { nom: 'Salle de réunion (test)', jours: 30 },
    headers: { 'x-csrf-token': csrf },
  });
  expect(c.status(), await c.text()).toBe(201);
  const { id, code } = await c.json();

  const ecran = await context(browser, 3840, 2160, 'dark', false);
  const page = await ecran.newPage();
  const problems = watchPage(page);
  await page.goto(`/mur/activer#${code}`);
  await expect(page.getByRole('main', { name: 'Écran mural' })).toBeVisible();
  await expect(page.getByText('Écran « Salle de réunion (test) »', { exact: false })).toBeVisible();
  // Aucun menu ni action de modification.
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Enregistrer|Supprimer|Modifier/ })).toHaveCount(0);
  // Le code ne reste pas dans l'adresse.
  expect(page.url()).not.toContain(code);
  // Rotation : la vue change toute seule.
  await page.goto('/mur?rotation=15&vues=synthese,echeances');
  await expect(page.getByRole('heading', { level: 1, name: /Synthèse/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /Échéances/ })).toBeVisible({ timeout: 25_000 });

  const del = await admin.request.delete(`/api/admin/murs/${id}`, { headers: { 'x-csrf-token': csrf } });
  expect(del.status()).toBe(204);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Écran non autorisé' })).toBeVisible();
  // Un lien déjà utilisé ne fonctionne plus.
  await page.goto(`/mur/activer#${code}`);
  await expect(page.getByRole('heading', { name: 'Activation impossible' })).toBeVisible();
  expect(problems).toEqual([]);
  await ecran.close();
  await admin.close();
});
