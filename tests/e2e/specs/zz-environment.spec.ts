import { test, expect, type Browser, type Page } from '@playwright/test';
import type { EnvironmentVersion, EnvironmentDefinition } from '../../../packages/shared/src/environment';
import { sessionAdmin, watchPage } from '../helpers';
const url = '/api/admin/environment';
async function open(browser: Browser, width = 1366) {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width, height: 900 },
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  return { ctx, page, problems };
}
async function publish(page: Page, definition: EnvironmentDefinition) {
  const current = (await (await page.request.get(url)).json()) as EnvironmentVersion;
  const me = await (await page.request.get('/api/auth/me')).json();
  const headers = { Origin: new URL(page.url()).origin, 'X-CSRF-Token': me.csrf };
  const preview = await page.request.post(`${url}/preview`, {
    headers,
    data: {
      definition,
      example: {
        impact: definition.impact[0]!.id,
        probability: definition.probability[0]!.id,
        maturity: definition.maturity[0]!.id,
      },
    },
  });
  expect(preview.ok()).toBeTruthy();
  const p = await preview.json();
  if (!p.changed) return;
  const result = await page.request.put(url, {
    headers: { ...headers, 'If-Match': `"${current.version}"` },
    data: {
      definition,
      previewId: p.previewId,
      reason: 'Recette isolée : remise de la définition initiale',
      confirm: 'PUBLIER',
    },
  });
  expect(result.ok()).toBeTruthy();
}
test('configuration : matrice réelle publiée sur mobile, historique stable et reprise explicite', async ({
  browser,
}) => {
  const { ctx, page, problems } = await open(browser, 390);
  let original: EnvironmentVersion | undefined;
  try {
    await page.goto('/admin/environment');
    await expect(page.getByRole('heading', { name: 'Configuration de l’environnement' })).toBeVisible();
    original = await (await page.request.get(url)).json();
    await page.getByLabel('Nom de la configuration', { exact: true }).fill('Recette de la matrice organisationnelle');
    await page.getByRole('tab', { name: 'Calcul et matrice', exact: true }).click();
    await page.getByRole('textbox', { name: 'Règle de calcul', exact: true }).click();
    await page.getByRole('option', { name: 'Matrice explicite', exact: true }).click();
    await page.getByLabel('Probabilité : Rare', { exact: true }).first().fill('8');
    await expect(page.getByRole('button', { name: 'Publier une nouvelle version', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Valider et simuler le brouillon' }).click();
    await expect(page.getByText(/Risque initial : 8/)).toBeVisible();
    await page.getByLabel('Motif de publication', { exact: true }).fill('Validation de la matrice de recette');
    await page.getByLabel('Saisissez PUBLIER pour confirmer', { exact: true }).fill('PUBLIER');
    await page.getByRole('button', { name: 'Publier une nouvelle version', exact: true }).click();
    await expect(page.getByText(`Version publiée : ${original!.version + 1}`, { exact: true })).toBeVisible();
    const previous = await (await page.request.get(`${url}/versions/${original!.version}`)).json();
    expect(previous).toEqual(original);
    await page.getByRole('button', { name: `Consulter la version ${original!.version}`, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(original!.definition.name);
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer la version' }).click();
    await page.getByRole('button', { name: `Préparer la définition v${original!.version}`, exact: true }).click();
    await expect(page.getByLabel('Nom de la configuration', { exact: true })).toHaveValue(original!.definition.name);
    expect((await (await page.request.get(url)).json()).version).toBe(original!.version + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(problems).toEqual([]);
  } finally {
    if (original) await publish(page, original.definition);
    await ctx.close();
  }
});
test('configuration : changement distant conserve le brouillon et impose un rechargement confirmé', async ({
  browser,
}) => {
  const { ctx, page, problems } = await open(browser);
  let original: EnvironmentVersion | undefined;
  try {
    await page.goto('/admin/environment');
    await expect(page.getByLabel('Nom de la configuration', { exact: true })).toBeVisible();
    original = await (await page.request.get(url)).json();
    await page.getByLabel('Nom de la configuration', { exact: true }).fill('Mon brouillon conservé');
    await publish(page, { ...original!.definition, name: 'Modification distante de recette' });
    await expect(page.getByText(/Une nouvelle version a été publiée ailleurs/)).toBeVisible();
    await expect(page.getByLabel('Nom de la configuration', { exact: true })).toHaveValue('Mon brouillon conservé');
    await expect(page.getByRole('button', { name: 'Publier une nouvelle version', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Recharger la version publiée' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Abandonner le brouillon', exact: true }).click();
    await expect(page.getByLabel('Nom de la configuration', { exact: true })).toHaveValue(
      'Modification distante de recette',
    );
    expect(problems).toEqual([]);
  } finally {
    if (original) await publish(page, original.definition);
    await ctx.close();
  }
});
test('configuration : consultation seule et validation d’un brouillon incohérent', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser);
  try {
    await page.goto('/admin/environment');
    await expect(page.getByLabel('Nom de la configuration', { exact: true })).toBeVisible();
    await page.getByLabel('Impact 2', { exact: true }).fill('Impact révisé');
    await page.getByLabel('Valeur', { exact: true }).nth(1).fill('0');
    await page.getByRole('button', { name: 'Valider et simuler le brouillon' }).click();
    await expect(page.getByText(/Les valeurs doivent être strictement croissantes/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publier une nouvelle version', exact: true })).toBeDisabled();
    await page.route('**/api/auth/me', async (route) => {
      const me = await (await route.fetch()).json();
      await route.fulfill({
        json: { ...me, permissions: me.permissions.filter((p: string) => p !== 'administration:administrer') },
      });
    });
    page.once('dialog', (dialog) => void dialog.accept());
    await page.reload();
    await expect(page.getByText(/Consultation seule : la publication exige/)).toBeVisible();
    await expect(page.getByLabel('Nom de la configuration', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Valider et simuler le brouillon' })).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
