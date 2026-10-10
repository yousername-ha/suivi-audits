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

test('sauvegarde chiffrée réelle depuis le menu, sans cron supplémentaire', async ({ browser }) => {
  test.skip(process.env.E2E_BACKUP_AUTO !== '1', 'Nécessite la pile Compose complète avec son exécutant automatique.');
  test.setTimeout(120000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/admin/system');
    await expect(page.getByRole('button', { name: 'Demander une sauvegarde', exact: true })).toBeEnabled({
      timeout: 60000,
    });
    const before = await (await page.request.get('/api/legacy/state')).json();
    await page.getByRole('button', { name: 'Demander une sauvegarde', exact: true }).click();
    const requested = page.waitForResponse(
      (r) => r.url().endsWith('/api/admin/sauvegardes') && r.request().method() === 'POST',
    );
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
    const response = await requested;
    expect(response.status()).toBe(202);
    const job = await response.json();
    await expect
      .poll(
        async () => {
          const state = await (await page.request.get('/api/admin/sauvegardes')).json();
          return state.jobs.find((j: { id: string }) => j.id === job.id)?.status;
        },
        { timeout: 60000, intervals: [1000] },
      )
      .toBe('reussie');
    const state = await (await page.request.get('/api/admin/sauvegardes')).json();
    const report = state.jobs.find((j: { id: string }) => j.id === job.id).report;
    expect(report.chiffree).toBe(true);
    expect(report.integriteVerifiee).toBe(true);
    expect(report.fichier).toMatch(/\.tar\.enc$/);
    expect(report.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.tailleOctets).toBeGreaterThan(0);
    expect(await (await page.request.get('/api/legacy/state')).json()).toEqual(before);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
