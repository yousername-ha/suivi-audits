/* Calendriers de plateforme (décision 4) : création d'un calendrier de jours fériés, aperçu puis ajout des onze jours légaux
   d'une année, rejeu sans doublon, historique de la mise à jour, accessibilité de la fenêtre. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Calendriers : jours fériés générés après aperçu, rejeu sans doublon, historique', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const nom = `Fériés ${Date.now().toString(36)}`;
  try {
    await page.goto('/plateforme');
    await page.getByRole('link', { name: /^Calendriers/ }).click();
    const fenetre = page.getByRole('dialog', { name: 'Calendriers' });
    await expect(fenetre).toBeVisible();
    await fenetre.getByRole('button', { name: 'Nouveau calendrier' }).click();
    const creation = page.getByRole('dialog', { name: 'Nouveau calendrier' });
    await creation.getByLabel('Nom').fill(nom);
    await creation.getByRole('button', { name: 'Créer' }).click();
    const ligne = fenetre.getByRole('row', { name: new RegExp(nom) });
    await expect(ligne).toBeVisible();
    await expect(ligne.getByText('À mettre à jour')).toBeVisible();

    await ligne.getByRole('button', { name: 'Mettre à jour' }).click();
    const maj = page.getByRole('dialog', { name: new RegExp(`Mettre à jour « ${nom} »`) });
    await maj.getByLabel('Année').first().fill('2027');
    await maj.getByRole('button', { name: 'Prévisualiser', exact: true }).click();
    await expect(maj.getByRole('region', { name: 'Aperçu de la mise à jour' })).toContainText('11 jour(s) à ajouter');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await maj.getByRole('button', { name: 'Ajouter ces jours' }).click();
    await expect(page.getByText('11 jour(s) ajouté(s).')).toBeVisible();

    // Rejouer le même aperçu : plus rien à ajouter.
    await maj.getByRole('button', { name: 'Prévisualiser', exact: true }).click();
    await expect(maj.getByRole('region', { name: 'Aperçu de la mise à jour' })).toContainText('0 jour(s) à ajouter');
    await expect(maj.getByRole('button', { name: 'Ajouter ces jours' })).toBeDisabled();
    await page.getByRole('button', { name: 'Fermer la mise à jour' }).click();

    await expect(ligne).toContainText('2027 (11 j)');
    await ligne.getByRole('button', { name: 'Historique' }).click();
    const histo = page.getByRole('dialog', { name: new RegExp(`Historique de « ${nom} »`) });
    await expect(histo.getByRole('cell', { name: 'Jours fériés générés' })).toBeVisible();
    await expect(histo).toContainText('Calcul légal');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
