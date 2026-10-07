/* Captures de référence (charte graphique) : pages Paramètres et Administration, à 1440, 768 et 390 px de large,
   en mode clair et en mode sombre, comparées à chaque PR. Exécutées dans le conteneur Playwright officiel
   (tests/e2e/run-in-container.sh) : polices et rendu identiques en local et en CI. */
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { apiLogin, loadAdmin, PASSWORD, watchPage } from '../helpers';

test.describe.configure({ mode: 'serial' });

const PAGES = [
  { nom: 'parametres', url: '/parametres/general', titre: 'Paramètres', contenu: 'Nom de l’application' },
  { nom: 'administration', url: '/admin/roles', titre: 'Administration', contenu: 'Lecteur et liens' },
] as const;
const LARGEURS = [
  [1440, 900],
  [768, 1024],
  [390, 844],
] as const;
const MODES = [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const;

let state: Awaited<ReturnType<BrowserContext['storageState']>>;

async function context(browser: Browser, width: number, height: number, scheme: 'light' | 'dark') {
  return browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    viewport: { width, height },
    colorScheme: scheme,
    reducedMotion: 'reduce',
    storageState: state,
  });
}

test.beforeAll(async ({ browser }) => {
  // Une seule connexion (double authentification) ; la session est ensuite réutilisée par toutes les captures.
  const admin = loadAdmin();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  await apiLogin(ctx.request, admin.username, PASSWORD, admin.secret);
  state = await ctx.storageState();
  await ctx.close();
});

for (const p of PAGES)
  for (const [w, h] of LARGEURS)
    for (const [mode, scheme] of MODES)
      test(`capture : ${p.nom} à ${w} px, mode ${mode}`, async ({ browser }) => {
        const ctx = await context(browser, w, h, scheme);
        const page = await ctx.newPage();
        const problems = watchPage(page);
        await page.goto(p.url);
        await expect(page.getByRole('heading', { name: p.titre, level: 1 })).toBeVisible();
        // Le flux temps réel reste ouvert (pas d'état « réseau au repos ») : on attend le contenu et les polices.
        await expect(page.getByText(p.contenu).first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${p.nom}-${w}-${mode}.png`, {
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          // Éléments variables d'une exécution à l'autre : présence, état du temps réel, version, notifications.
          mask: [
            page.locator('.presence-bar'),
            page.locator('.live-badge'),
            page.locator('.app-version'),
            page.locator('.mantine-Notifications-root'),
          ],
          maxDiffPixelRatio: 0.01,
        });
        // Aucun défilement horizontal de la page.
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(problems).toEqual([]);
        await ctx.close();
      });
