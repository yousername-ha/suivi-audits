/* Administration en deux pages à cartes (« Plateforme » et « Configuration système ») : entrées de menu, cartes, détail dans
   une fenêtre centrée, retour à la page de cartes, anciennes adresses toujours valables. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Administration : deux pages à cartes, détail en fenêtre centrée, anciennes adresses valables', async ({
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
    await page.goto('/');
    const menu = page.getByRole('navigation');
    await expect(menu.getByRole('link', { name: 'Plateforme', exact: true })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Configuration système', exact: true })).toBeVisible();

    // Page « Plateforme » : une carte par domaine, avec son résumé.
    await menu.getByRole('link', { name: 'Plateforme', exact: true }).click();
    await expect(page).toHaveURL(/\/plateforme$/);
    await expect(page.getByRole('heading', { name: 'Plateforme', level: 1 })).toBeVisible();
    for (const titre of [
      'Général',
      'Utilisateurs',
      'Groupes',
      'Fonctions',
      'Rôles et droits',
      'Apparence',
      'Import et export',
    ])
      await expect(page.getByRole('heading', { name: titre, level: 2 })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Le détail s'ouvre dans une fenêtre centrée ; Échap ramène à la page de cartes.
    await page.getByRole('link', { name: /^Utilisateurs/ }).click();
    await expect(page).toHaveURL(/\/plateforme\/utilisateurs$/);
    const fenetre = page.getByRole('dialog', { name: 'Utilisateurs' });
    await expect(fenetre).toBeVisible();
    await expect(fenetre.getByRole('button', { name: /Créer un compte|Nouveau/ }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fenetre).toBeHidden();
    await expect(page).toHaveURL(/\/plateforme$/);

    // Page « Configuration système ».
    await menu.getByRole('link', { name: 'Configuration système', exact: true }).click();
    await expect(page).toHaveURL(/\/systeme$/);
    for (const titre of [
      'Sauvegardes et restauration',
      'Mises à jour et versions',
      'Sécurité',
      'Sessions actives',
      'Journal d’audit',
      'Modules',
      'Détails techniques',
    ])
      await expect(page.getByRole('heading', { name: titre, level: 2 })).toBeVisible();
    await page.getByRole('link', { name: /^Journal d’audit/ }).click();
    await expect(page.getByRole('dialog', { name: 'Journal d’audit' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/systeme$/);

    // Les anciennes adresses restent valables.
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Administration', level: 1 })).toBeVisible();
    await page.goto('/parametres/general');
    await expect(page.getByRole('heading', { name: 'Paramètres', level: 1 })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
