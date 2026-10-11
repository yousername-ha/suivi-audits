/* A3/A4/A5/A6 : après le parcours d'installation, données fictives et sessions isolées.
   Aucun renouvellement de capture de référence pour masquer un écart. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('A4 : une déconnexion confirmée ferme la session et les deux onglets', async ({ browser }) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const first = await ctx.newPage();
  const second = await ctx.newPage();
  const firstProblems = watchPage(first);
  const secondProblems = watchPage(second);
  await first.goto('/documents');
  await second.goto('/');
  await expect(second.getByRole('button', { name: 'Déconnexion' })).toBeVisible();
  await first.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(first.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible();
  expect((await ctx.request.get('/api/documents')).status()).toBe(401);
  expect((await ctx.cookies()).filter((c) => c.name.includes('suivi_sid'))).toHaveLength(0);
  await first.goto('/documents');
  await expect(first).toHaveURL(/\/login/);
  expect([...firstProblems, ...secondProblems]).toEqual([]);
  await ctx.close();
});

test('A4 : un échec réseau affiche une erreur et permet de réessayer', async ({ browser }) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.route('**/api/auth/logout', (route) => route.abort());
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page.getByText('Serveur injoignable. Vérifiez la connexion réseau.')).toBeVisible();
  expect((await (await ctx.request.get('/api/auth/me')).json()).stage).toBe('ok');
  await expect(page.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
  await page.unroute('**/api/auth/logout');
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible();
  await ctx.close();
});

for (const width of [390, 768, 1440])
  test(`A3 : connexion sans bandeau d’étapes à ${width} px`, async ({ browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const problems = watchPage(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible();
    await expect(page.getByLabel('Étapes de connexion')).toHaveCount(0);
    await expect(page.getByLabel('Identifiant')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(problems).toEqual([]);
    await ctx.close();
  });

test('A5 : le guide est consultable et sa recherche filtre les articles', async ({ browser }) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Guide d’utilisation' }).click();
  await expect(page.getByRole('heading', { name: 'Guide d’utilisation', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fournisseurs', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Incidents et PCA/PRA', exact: true })).toBeVisible();
  await page.getByLabel('Rechercher dans le guide').fill('cartographie');
  await expect(page.getByRole('heading', { name: 'Cartographie et fiche de sélection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comptes, groupes et rôles' })).toHaveCount(0);
  await page.getByLabel('Rechercher dans le guide').fill('aucun-article-zzzz');
  await expect(page.getByRole('status')).toHaveText('Aucun article ne correspond à votre recherche.');
  expect(problems).toEqual([]);
  await ctx.close();
});

test('A6 : le panneau droit se rétracte puis se rouvre avec Infos', async ({ browser }) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({
    storageState: state,
    ignoreHTTPSErrors: true,
    viewport: { width: 3840, height: 2160 },
  });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await page.goto('/cartographie/contexte');
  await expect(
    page.locator('.carte-grille').or(page.getByRole('heading', { name: 'Aucune carte de contexte' })),
  ).toBeVisible();
  if (await page.getByRole('heading', { name: 'Aucune carte de contexte' }).isVisible()) {
    await page.getByRole('button', { name: 'Générer depuis la plateforme', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Générer', exact: true }).click();
  }
  await expect(page.locator('.carte-grille')).toBeVisible();
  await expect(page.locator('.carte-inspecteur-fixe')).toHaveCount(0);
  const before = (await page.locator('.carte-canevas').boundingBox())!.width;
  await page.getByRole('button', { name: 'Infos', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Fiche de la sélection' })).toBeVisible();
  expect((await page.locator('.carte-canevas').boundingBox())!.width).toBeLessThan(before);
  await page
    .locator('.carte-inspecteur-fixe')
    .getByRole('button', { name: /Fermer/ })
    .click();
  await expect(page.locator('.carte-inspecteur-fixe')).toHaveCount(0);
  expect((await page.locator('.carte-canevas').boundingBox())!.width).toBeGreaterThan(before - 1);
  const node = page.locator('g.noeud[data-n]').first();
  await node.click();
  await expect(page.locator('.carte-inspecteur-fixe')).toBeVisible();
  expect(problems).toEqual([]);
  await ctx.close();
});
