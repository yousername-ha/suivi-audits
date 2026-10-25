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
    // L'écran de mise à jour s'ouvre tout de suite, sans attendre la prise en charge de la demande par le service.
    await expect(page).toHaveURL(/\/update\/\?.*demande=00000000-0000-4000-8000-000000000001/);
    await expect(page.getByRole('heading', { name: 'Mise à jour en cours' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Demande enregistrée.');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ version: '3.1.0', confirm: 'METTRE À JOUR' });
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
  const jobId = '00000000-0000-4000-8000-000000000002';
  let current = state();
  const requests: { requestId: string }[] = [];
  await page.route('**/api/updates', (route) => route.fulfill({ json: current }));
  await page.route('**/update/status.json', (route) => route.fulfill({ json: current }));
  await page.route('**/api/admin/updates/install', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { id: jobId, status: 'queued' } });
  });
  try {
    await page.goto('/admin/system');
    await page.getByLabel('Taper METTRE À JOUR pour confirmer').fill('METTRE À JOUR');
    await page.getByRole('button', { name: 'Installer la version 3.1.0' }).click();
    // Attente de la prise en charge, puis le service signale l'échec de la préparation.
    await expect(page.getByRole('heading', { name: 'Mise à jour en cours' })).toBeVisible();
    current = state({ id: jobId, target: '3.1.0', status: 'failed', message: 'Préparation interrompue.' });
    await expect(page.getByRole('heading', { name: 'La mise à jour n’a pas été installée' })).toBeVisible();
    await page.getByRole('link', { name: 'Consulter le résultat dans l’application' }).click();
    await expect(page).toHaveURL(/\/systeme\/mises-a-jour$/);
    const confirm = page.getByLabel('Taper METTRE À JOUR pour confirmer');
    await expect(confirm).toHaveValue('');
    await confirm.fill('METTRE À JOUR');
    await page.getByRole('button', { name: 'Installer la version 3.1.0' }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]!.requestId).not.toBe(requests[0]!.requestId);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('mise à jour : la vérification montre qu’elle est en cours puis annonce le résultat', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser);
  let current = state({ checkedAt: '2026-10-01T08:00:00.000Z', available: null, message: '' });
  await page.route('**/api/updates', (route) => route.fulfill({ json: current }));
  await page.route('**/api/admin/updates/check', async (route) => {
    current = state({ checking: true, phase: 'checking', status: 'running', checkedAt: current.checkedAt });
    await route.fulfill({ status: 202, json: { id: '00000000-0000-4000-8000-000000000003', status: 'queued' } });
    setTimeout(() => {
      current = state({ available: '3.1.0', checkedAt: new Date().toISOString() });
    }, 2500);
  });
  try {
    await page.goto('/systeme/mises-a-jour');
    const verifier = page.getByRole('button', { name: 'Vérifier les mises à jour' });
    await verifier.click();
    await expect(page.getByText('Vérification des nouvelles versions en cours…')).toBeVisible();
    await expect(verifier).toBeDisabled();
    await expect(page.getByText('Une nouvelle version est disponible : 3.1.0.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Vérification des nouvelles versions en cours…')).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('mise à jour : l’écran de maintenance ouvert après confirmation attend la prise en charge sans revenir à l’application', async ({
  browser,
}) => {
  const { ctx, page, problems } = await open(browser, 390);
  const jobId = '00000000-0000-4000-8000-000000000004';
  let current = state({ status: 'success', phase: 'complete', id: '00000000-0000-4000-8000-000000000009' });
  await page.route('**/update/status.json', (route) => route.fulfill({ json: current }));
  try {
    await page.goto(`/update/?next=%2Fdocuments&demande=${jobId}`);
    await expect(page.getByRole('heading', { name: 'Mise à jour en cours' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Demande enregistrée.');
    await page.waitForTimeout(6000);
    await expect(page).toHaveURL(/\/update\//);
    current = state({
      id: jobId,
      target: '3.1.0',
      maintenance: true,
      status: 'running',
      phase: 'backup',
      message: 'Sauvegarde de sécurité de vos données.',
      startedAt: new Date().toISOString(),
    });
    await expect(page.getByRole('status')).toContainText('Sauvegarde de sécurité', { timeout: 10000 });
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
