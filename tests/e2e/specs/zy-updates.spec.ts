/* Affichage et interactions ; les routes réelles et l'exécutant sont vérifiés par les suites API et Docker. */
import { expect, test, type Browser } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const state = (changes = {}) => ({
  installed: '3.0.0',
  available: '3.1.0',
  checkedAt: new Date().toISOString(),
  notes: 'https://github.com/yousername-ha/suivi-audits/releases/tag/v3.1.0',
  checking: false,
  checkError: false,
  ready: true,
  maintenance: false,
  id: null,
  target: null,
  status: 'idle',
  phase: 'idle',
  message: 'Publication disponible.',
  startedAt: null,
  updatedAt: new Date().toISOString(),
  ...changes,
});
async function open(browser: Browser, width = 1366) {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width, height: 900 },
  });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await page.route('**/update/status.json', (route) => route.fulfill({ json: state() }));
  await page.route('**/api/updates', (route) => route.fulfill({ json: state() }));
  return { ctx, page, problems };
}
test('mise à jour : bandeau permanent et confirmation explicite dans le style existant, mobile compris', async ({
  browser,
}) => {
  const { ctx, page, problems } = await open(browser, 390);
  const requests: unknown[] = [];
  await page.route('**/api/admin/updates/install', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { id: '00000000-0000-4000-8000-000000000001', status: 'queued' } });
  });
  try {
    await page.goto('/admin/system');
    await expect(page.locator('.update-notice')).toContainText('Version installée : 3.0.0');
    await expect(page.locator('.update-notice')).toContainText('3.1.0');
    await expect(page.locator('.update-notice').getByRole('link', { name: 'Mettre à jour' })).toBeVisible();
    const install = page.getByRole('button', { name: 'Installer la version 3.1.0' });
    await expect(install).toBeDisabled();
    await page.getByLabel('Taper METTRE À JOUR pour confirmer').fill('METTRE À JOUR');
    await install.click();
    await expect(page.getByText('Demande enregistrée.', { exact: false })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ version: '3.1.0', confirm: 'METTRE À JOUR' });
    await expect(install).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('mise à jour : pour un lecteur, information et nouveautés sans commande', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser);
  await page.route('**/api/auth/me', async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    await route.fulfill({
      json: {
        ...me,
        user: { ...me.user, roles: ['Lecteur'] },
        permissions: me.permissions.filter((p: string) => !p.startsWith('administration:')),
      },
    });
  });
  try {
    await page.goto('/');
    await expect(page.locator('.update-notice')).toBeVisible();
    await expect(page.locator('.update-notice').getByRole('link', { name: 'Nouveautés' })).toBeVisible();
    await expect(page.locator('.update-notice').getByRole('link', { name: 'Mettre à jour' })).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('mise à jour : après échec de préparation, une nouvelle confirmation crée une nouvelle demande', async ({
  browser,
}) => {
  const { ctx, page, problems } = await open(browser);
  let current = state();
  const requests: { requestId: string }[] = [];
  const jobId = '00000000-0000-4000-8000-000000000002';
  await page.route('**/api/updates', (route) => route.fulfill({ json: current }));
  await page.route('**/api/admin/updates/install', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { id: jobId, status: 'queued' } });
  });
  try {
    await page.goto('/admin/system');
    const confirm = page.getByLabel('Taper METTRE À JOUR pour confirmer');
    const install = page.getByRole('button', { name: 'Installer la version 3.1.0' });
    await confirm.fill('METTRE À JOUR');
    await install.click();
    await expect(page.getByText('Demande enregistrée.', { exact: false })).toBeVisible();
    current = state({ id: jobId, target: '3.1.0', status: 'failed', message: 'Préparation interrompue.' });
    await expect(confirm).toHaveValue('', { timeout: 20000 });
    await expect(install).toBeDisabled();
    await confirm.fill('METTRE À JOUR');
    await install.click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]!.requestId).not.toBe(requests[0]!.requestId);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('mise à jour : la maintenance rejoint automatiquement un écran ouvert puis revient après santé réelle', async ({
  browser,
}) => {
  const { ctx, page, problems } = await open(browser, 390);
  let current = state();
  await page.route('**/api/updates', (route) => route.fulfill({ json: current }));
  await page.route('**/update/status.json', (route) => route.fulfill({ json: current }));
  try {
    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: 'Documents et liens', exact: true })).toBeVisible();
    current = state({
      maintenance: true,
      status: 'running',
      phase: 'backup',
      target: '3.1.0',
      message: 'Sauvegarde de sécurité de vos données.',
      startedAt: new Date().toISOString(),
    });
    await expect(page).toHaveURL(/\/update\//);
    await expect(page.getByRole('heading', { name: 'Mise à jour en cours' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Sauvegarde de sécurité');
    await expect(page.locator('li.current')).toHaveText('Sauvegarde de sécurité');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    current = state({
      installed: '3.1.0',
      available: '3.1.0',
      status: 'success',
      phase: 'complete',
      message: 'Votre espace est prêt.',
    });
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByRole('heading', { name: 'Documents et liens', exact: true })).toBeVisible();
    await expect(page.locator('.update-notice')).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('mise à jour : panne de suivi et retour arrière sont explicites, sans succès fictif', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser);
  let offline = true;
  await page.route('**/update/status.json', (route) =>
    offline
      ? route.abort()
      : route.fulfill({
          json: state({
            status: 'rolled_back',
            phase: 'rollback',
            message: 'La version précédente a été restaurée et vérifiée.',
          }),
        }),
  );
  try {
    // Une barre oblique inverse peut être normalisée par le navigateur en URL externe.
    await page.goto('/update/?next=%2F%5Cexample.invalid%2F');
    await expect(page.getByText('Connexion momentanément interrompue.', { exact: false })).toBeVisible();
    offline = false;
    await expect(page.getByRole('heading', { name: 'La mise à jour n’a pas été installée' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Consulter le résultat dans l’application' })).toHaveAttribute(
      'href',
      '/',
    );
    await expect(page).toHaveURL(/\/update\//);
    await page.goto('/update/?next=%2Ffolder%2F..%2F%2Fexample.invalid%2F');
    const returned = page.getByRole('link', { name: 'Consulter le résultat dans l’application' });
    await expect(returned).toBeVisible();
    expect(await returned.evaluate((link) => new URL((link as HTMLAnchorElement).href).origin)).toBe(
      new URL(page.url()).origin,
    );
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
