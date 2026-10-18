/* Exports Excel par rubrique : page « Exports Excel », téléchargement classique et pro, archive Excel bien formée. */
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Exports Excel : un groupe en classique et en pro, export complet', async ({ browser }) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true, acceptDownloads: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  await page.goto('/exports');
  await expect(page.getByRole('heading', { name: 'Exports Excel', exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('heading', { name: 'Registre des écarts' })
      .or(page.getByRole('heading', { name: 'Écarts et actions' })),
  ).toBeVisible();

  const telecharger = async (nom: string) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: nom }).click()]);
    const chemin = await dl.path();
    const buf = fs.readFileSync(chemin);
    // Archive ZIP (« PK ») dont la première entrée est [Content_Types].xml.
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    expect(buf.subarray(30, 30 + 19).toString()).toBe('[Content_Types].xml');
    return dl.suggestedFilename();
  };
  expect(await telecharger('Excel classique : Écarts et actions')).toMatch(/^export-ec-std-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(await telecharger('Excel pro : Écarts et actions')).toMatch(/^export-ec-pro-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(await telecharger('Excel pro : export complet')).toMatch(/^export-all-pro-/);
  expect(problems).toEqual([]);
  await ctx.close();
});
