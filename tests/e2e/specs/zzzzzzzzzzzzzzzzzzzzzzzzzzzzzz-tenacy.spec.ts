/* Import Tenacy : un export Excel fictif (onglet « Gaps ») est simulé puis appliqué dans un périmètre ; un second import
   identique ne propose plus rien. Données fictives. */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

test('Import Tenacy : simulation, application, second import sans changement', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const perimetre = `Périmètre Tenacy ${Date.now().toString(36)}`;
  try {
    await page.goto('/admin/import');
    const r = await page.request.post('/api/grc/smsis', {
      headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
      data: { name: perimetre, scope: 'Fixture de recette', timezone: 'Europe/Paris' },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const id = (await r.json()).id as string;
    await page.reload();
    const panneau = page.getByRole('region', { name: 'Import Tenacy', exact: true });
    await panneau.getByRole('combobox', { name: 'Périmètre de destination' }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await panneau.locator('input[type=file]').setInputFiles({
      name: 'tenacy-fictif.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: readFileSync(new URL('../../fixtures/tenacy-fictif.xlsx', import.meta.url)),
    });
    await expect(panneau.getByText(/tenacy-fictif\.xlsx \(3 ligne/)).toBeVisible();
    await panneau.getByRole('button', { name: 'Simuler les écarts Tenacy', exact: true }).click();
    await expect(panneau.getByText('3 créé(s)', { exact: true })).toBeVisible();
    await expect(panneau.getByText('4 action(s) à créer', { exact: true })).toBeVisible();
    await expect(panneau.getByText('Revue des accès incomplète (fictif)')).toBeVisible();
    // Rien n'est écrit par la simulation.
    expect((await (await page.request.get(`/api/grc/${id}/objects?kind=nonconformity`)).json()).items).toHaveLength(0);
    await panneau.getByRole('button', { name: 'Appliquer les écarts Tenacy', exact: true }).click();
    await expect(page.getByText('Import Tenacy appliqué')).toBeVisible();
    const ecarts = (await (await page.request.get(`/api/grc/${id}/objects?kind=nonconformity`)).json()).items as {
      name: string;
      data: { status: string; classification: string };
    }[];
    expect(ecarts.map((e) => [e.name, e.data.status, e.data.classification]).sort()).toEqual([
      ['Plan de sauvegarde non testé (fictif)', 'open', ''],
      ['Politique de sécurité périmée (fictif)', 'closed', 'majeure'],
      ['Revue des accès incomplète (fictif)', 'progress', 'mineure'],
    ]);
    expect((await (await page.request.get(`/api/grc/${id}/objects?kind=action`)).json()).items).toHaveLength(4);
    // Second import du même fichier : rien à faire.
    await page.reload();
    await panneau.getByRole('combobox', { name: 'Périmètre de destination' }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await panneau.locator('input[type=file]').setInputFiles({
      name: 'tenacy-fictif.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: readFileSync(new URL('../../fixtures/tenacy-fictif.xlsx', import.meta.url)),
    });
    await panneau.getByRole('button', { name: 'Simuler les écarts Tenacy', exact: true }).click();
    await expect(panneau.getByText(/Rien à importer/)).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
