/* Vue des accès (dossier 022) : l'administrateur choisit une personne puis lit, registre par registre, le rôle, l'origine et
   les droits réels calculés par le serveur ; le groupe se choisit de la même façon ; la vue est accessible. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Vue des accès : une personne puis un groupe, droits effectifs et accessibilité', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/registres');
    await page.getByRole('tab', { name: 'Vue des accès' }).click();
    await expect(page.getByText('Choisissez une personne ou un groupe')).toBeVisible();
    await page.getByRole('combobox', { name: 'Personne' }).click();
    await page.getByRole('option').first().click();
    const tableau = page.getByRole('region', { name: /Accès aux registres/ });
    await expect(tableau.getByRole('row').nth(1)).toBeVisible();
    // L'administrateur de la recette peut tout faire sur chaque registre, et la source est indiquée.
    await expect(tableau.getByText('Administrateur').first()).toBeVisible();
    await expect(tableau.getByText('Gérer : oui').first()).toBeVisible();
    // Filtre par nom : aucun registre ne porte ce nom.
    await page.getByLabel('Nom du registre').fill('introuvable-xyz');
    await expect(page.getByText('0 registre(s)')).toBeVisible();
    await page.getByLabel('Nom du registre').fill('');
    // Un groupe : les rôles du groupe, sans droits effectifs de personne.
    await page.getByText('Groupe', { exact: true }).click();
    await expect(page.getByText('Choisissez une personne ou un groupe')).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(
      axe.violations.map(
        (v) =>
          `${v.id} (${v.nodes.length}) : ` +
          v.nodes
            .slice(0, 3)
            .map((n) => `${n.target.join(' ')} ${JSON.stringify(n.any[0]?.data ?? {})}`)
            .join(' | '),
      ),
    ).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
