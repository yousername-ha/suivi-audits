/* Courriel (décision 1) : configuration SMTP, mot de passe en écriture seule, message de test dont l'échec est expliqué.
   L'API n'envoie rien elle-même (pas de sortie réseau) : la demande passe par l'exécutant d'exploitation du serveur. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Courriel : configuration, mot de passe scellé, test réel dont l’échec est expliqué', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 1000 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/systeme');
    await page.getByRole('link', { name: /^Courriel/ }).click();
    const fenetre = page.getByRole('dialog', { name: 'Courriel' });
    await expect(fenetre).toBeVisible();
    await expect(fenetre.getByText('L’exécutant d’exploitation envoie les courriels')).toBeVisible();

    await fenetre.getByLabel('Activer l’envoi de courriels').check({ force: true });
    await fenetre.getByLabel('Serveur SMTP (nom d’hôte)').fill('smtp.invalid');
    await fenetre.getByLabel('Compte (laisser vide pour un relais sans authentification)').fill('compte-test');
    await fenetre.getByLabel('Adresse d’expédition').fill('suivi@exemple.test');
    await fenetre.getByLabel('Contact technique', { exact: true }).fill('technique@exemple.test');
    await fenetre.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText('Courriel : enregistré.')).toBeVisible();

    await fenetre.getByLabel('Mot de passe', { exact: true }).fill('mot-de-passe-de-recette');
    await fenetre.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
    await expect(fenetre.getByText('Un mot de passe est enregistré')).toBeVisible();
    await expect(fenetre.getByLabel('Nouveau mot de passe')).toHaveValue('');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // L'API n'envoie rien elle-même : la demande va à l'exécutant du serveur. Selon la pile, il est absent (refus clair) ou
    // présent (demande prise en charge) ; dans les deux cas l'interface le dit, sans annoncer de faux succès.
    await fenetre.getByRole('button', { name: 'Envoyer un message de test' }).click();
    await expect(fenetre).toContainText(/n’est pas disponible|Demande envoyée/);
    await expect(fenetre).not.toContainText('mot-de-passe-de-recette');
    await expect(fenetre.getByText('Message accepté par le serveur')).toHaveCount(0);

    // Retour à l'état initial : envoi désactivé, mot de passe supprimé.
    await fenetre.getByRole('button', { name: 'Supprimer' }).click();
    await expect(fenetre.getByText('Aucun mot de passe enregistré.')).toBeVisible();
    await fenetre.getByLabel('Activer l’envoi de courriels').uncheck({ force: true });
    await fenetre.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText('Courriel : enregistré.').first()).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
