/* Revues des accès reprises de l'outil de suivi (clé `accessReviews`) : ajout, saisie du mois de la dernière revue et
   état calculé. Données fictives. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage, ecrireEtat } from '../helpers';

test('Revues des accès : une revue ajoutée, son mois saisi, son état calculé', async ({ browser }) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const cur = await ctx.request.get('/api/suivi/etat');
    const s = await cur.json();
    s.suppliers = [{ id: 'SUP-901', name: 'Fournisseur fictif des revues' }];
    s.accessReviews = [];
    await ecrireEtat(ctx.request, csrf, s);

    await page.goto('/pilotage/revues-acces');
    await expect(page.getByText('Aucune revue des accès.')).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter une revue' }).click();
    await expect(page.getByText('CONTROL-1', { exact: true })).toBeVisible();
    await expect(page.getByText('Jamais réalisée').first()).toBeVisible();

    // Dernière revue il y a un an, pile : la prochaine tombe dans le mois courant (« À planifier »).
    const maintenant = new Date();
    const mois = `${maintenant.getFullYear() - 1}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
    const champ = page.getByLabel('Dernière revue de CONTROL-1');
    await champ.fill(mois);
    await champ.blur();
    await expect(page.getByText('À planifier', { exact: true }).first()).toBeVisible();

    const app = page.getByLabel('Application de CONTROL-1');
    // L'enregistrement part au blur, sans être attendu par la page : on attend sa réponse avant de recharger.
    const enregistre = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && r.url().includes('/api/revues-acces/') && r.ok(),
    );
    await app.fill('Application fictive des revues');
    await app.blur();
    await enregistre;
    await page.reload();
    await expect(page.getByLabel('Application de CONTROL-1')).toHaveValue('Application fictive des revues');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
