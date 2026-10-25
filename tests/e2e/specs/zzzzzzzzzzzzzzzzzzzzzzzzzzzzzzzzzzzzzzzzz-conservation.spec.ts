/* Conservation (décision 2) : régler une durée n'efface rien ; l'aperçu décrit ce qui serait candidat à une purge. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Conservation : durée enregistrée, aperçu sans suppression, retour à la conservation sans limite', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/plateforme');
    await page.getByRole('link', { name: /^Conservation/ }).click();
    const fenetre = page.getByRole('dialog', { name: 'Conservation' });
    await expect(fenetre).toBeVisible();
    await expect(fenetre.getByText('Aucune suppression automatique').first()).toBeVisible();
    const apercu = fenetre.getByRole('region', { name: 'Aperçu de conservation' });
    await expect(apercu.getByRole('row', { name: /Documents dans la corbeille/ })).toContainText('Sans limite');

    await fenetre.getByLabel('Documents dans la corbeille : limiter la durée').check({ force: true });
    await fenetre.getByLabel('Documents dans la corbeille : durée en jours').fill('30');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(apercu.getByRole('row', { name: /Documents dans la corbeille/ })).toContainText('30 jours');

    // Retour à la conservation sans limite.
    await fenetre.getByLabel('Documents dans la corbeille : limiter la durée').uncheck({ force: true });
    await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(apercu.getByRole('row', { name: /Documents dans la corbeille/ })).toContainText('Sans limite');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
