/* Module Vulnérabilités (ADR 0100, lot V1) : écran « Produits surveillés » de bout en bout, sans capture de référence
   (aucune n'est approuvée sans relecture) : ajout, filtre par famille, modification, suppression, accessibilité, CSP.
   Données fictives. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Vulnérabilités : produits surveillés ajoutés, filtrés, modifiés puis supprimés', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const nom = `Produit fictif ${Date.now().toString(36)}`;
  const choisir = async (champ: string, option: string, portee = page.getByRole('main')) => {
    await portee.getByLabel(champ, { exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  try {
    await page.goto('/vulnerabilites/produits');
    await expect(page.getByRole('heading', { name: 'Produits surveillés', level: 1 })).toBeVisible();
    // Entrée du menu : Risques > Vulnérabilités, dépliée sur la page affichée.
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: 'Vulnérabilités' })).toHaveAttribute('href', '/vulnerabilites/produits');

    await page.getByRole('button', { name: 'Ajouter un produit' }).click();
    const ajout = page.getByRole('dialog', { name: 'Ajouter un produit surveillé' });
    await ajout.getByLabel('Éditeur', { exact: true }).fill('Éditeur fictif de recette');
    await ajout.getByLabel('Nom du produit', { exact: true }).fill(nom);
    await ajout.getByLabel('Version', { exact: true }).fill('1.0');
    await choisir('Famille', 'Web', ajout);
    await choisir('Criticité', 'Élevée', ajout);
    await ajout.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(ajout).toBeHidden();
    const ligne = page.getByRole('row', { name: new RegExp(nom) });
    await expect(ligne).toContainText('Élevée');
    await expect(ligne).toContainText('Saisie');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Filtre par famille, appliqué par le serveur.
    await choisir('Famille', 'Réseau');
    await expect(ligne).toHaveCount(0);
    await choisir('Famille', 'Web');
    await expect(ligne).toBeVisible();

    await ligne.getByRole('button', { name: `Modifier ${nom}` }).click();
    const edition = page.getByRole('dialog', { name: `Modifier ${nom}` });
    await choisir('Criticité', 'Faible', edition);
    await edition.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(edition).toBeHidden();
    await expect(ligne).toContainText('Faible');

    await ligne.getByRole('button', { name: `Supprimer ${nom}` }).click();
    const suppression = page.getByRole('dialog', { name: 'Supprimer un produit surveillé' });
    await suppression.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(ligne).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
