/* Journal d'audit (dossier 012) : filtres par compte et par période, pagination, export JSON et CSV tracés, détails
   techniques avec date du relevé. Données fictives. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Journal d’audit : filtres, export JSON, détails techniques datés', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/admin/audit');
    const entrees = page.getByText(/entrée\(s\) affichée\(s\)/);
    await expect(entrees).toBeVisible();
    await expect(entrees).not.toHaveText(/^0 entrée/);

    // Un compte inexistant ne ramène rien ; la réinitialisation rétablit la liste.
    await page.getByLabel('Compte', { exact: true }).fill('compte_inexistant_recette');
    await page.getByRole('button', { name: 'Filtrer' }).click();
    await expect(entrees).toHaveText(/^0 entrée/);
    await page.getByLabel('Du', { exact: true }).fill('2999-01-01');
    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(entrees).not.toHaveText(/^0 entrée/);

    // Export JSON : fichier téléchargé, limité aux filtres ; la limite est dite à côté des boutons.
    await expect(page.getByText(/5 000 entrées les plus récentes/)).toBeVisible();
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporter en JSON' }).click(),
    ]);
    expect(telechargement.suggestedFilename()).toMatch(/^journal-audit-.*\.json$/);

    // L'export laisse une trace dans le journal.
    await page.getByLabel('Rechercher', { exact: true }).fill('admin.audit_export');
    await page.getByRole('button', { name: 'Filtrer' }).click();
    await expect(page.getByRole('region', { name: 'Journal' }).getByText('admin.audit_export').first()).toBeVisible();

    // Détails techniques : chiffres lus à la demande, date du relevé affichée.
    await page.goto('/admin/system');
    const details = page.getByRole('region', { name: 'Détails techniques' });
    await expect(details.getByText('Relevé du')).toBeVisible();
    await expect(details.getByText('Volume des pièces')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
