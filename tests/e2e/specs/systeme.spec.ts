/* Administration > Système (EXPL-05) : version, dernière sauvegarde, emplacement et espace disque des données,
   historique des mises à jour. Lecture seule : aucun bouton de mise à jour. Exécuté après parcours.spec.ts. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('administration > système : exploitation en lecture seule', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await page.goto('/admin/system');
  await expect(page.getByRole('heading', { name: 'Version', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dernière sauvegarde', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Données du serveur', level: 2 })).toBeVisible();
  await expect(page.getByText('/srv/suivi-audits/donnees')).toBeVisible();
  await expect(page.getByText(/% libres/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historique des mises à jour', level: 2 })).toBeVisible();
  // Aucune mise à jour ne se lance depuis le navigateur.
  await expect(page.getByRole('button', { name: /mettre à jour|installer/i })).toHaveCount(0);
  const v = await (await ctx.request.get('/api/version')).json();
  expect(v.schemaLegacy).toEqual({ min: 14, max: 15 });
  await page.screenshot({ path: test.info().outputPath('systeme.png'), fullPage: true });
  expect(problems).toEqual([]);
  await ctx.close();
});
