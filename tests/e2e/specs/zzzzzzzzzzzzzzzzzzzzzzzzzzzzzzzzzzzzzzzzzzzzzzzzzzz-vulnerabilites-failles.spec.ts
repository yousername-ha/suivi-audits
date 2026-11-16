/* Module Vulnérabilités (ADR 0100, lot V5) : écrans « Failles détectées » et « Machines » de bout en bout, sans capture de
   référence (aucune n'est approuvée sans relecture) : menu, bascule par faille et par machine, filtres, écran des machines,
   accessibilité, CSP. Aucun Tenable n'est joint : la pile de test n'a ni connecteur actif ni donnée synchronisée. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Vulnérabilités : failles détectées par faille et par machine, écran des machines', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/vulnerabilites/failles');
    await expect(page.getByRole('heading', { name: 'Failles détectées', level: 1 })).toBeVisible();
    await expect(page.getByText('Aucune faille détectée ne correspond')).toBeVisible();
    await page.getByLabel('Exploitées (KEV)').check();
    await expect(page.getByText('Aucune faille détectée ne correspond')).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.getByText('Par machine', { exact: true }).click();
    await expect(page.getByText('Aucune machine ne correspond')).toBeVisible();

    await page.getByRole('link', { name: 'Machines', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Machines', level: 1 })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Affectation des machines choisies' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Appliquer à 0 machine/ })).toBeDisabled();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
