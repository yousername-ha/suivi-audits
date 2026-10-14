/* Configuration GRC (ADR 0038) : catalogue vide, adoption du modèle de pertinence, création et publication d'une échelle
   dans l'interface, matrice complète, même contenu sous Gestion des risques → Configuration des analyses. Données fictives. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

test('Configuration GRC : modèle adopté, échelle créée et publiée, mêmes éléments côté analyses', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/parametres');
    await page
      .getByRole('navigation', { name: 'Sections des paramètres' })
      .getByRole('link', { name: 'Configuration GRC' })
      .click();
    await expect(page.getByRole('heading', { name: 'Configuration GRC' })).toBeVisible();
    await expect(page.getByText('Le catalogue est vide à l’installation')).toBeVisible();

    // Modèle de pertinence : adopté à la demande, jamais livré par défaut.
    await page.getByRole('tab', { name: 'Modèles' }).click();
    await expect(page.getByText('À valider', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adopter ce modèle' }).click();
    await expect(page.getByText('Aucune différence de niveaux').or(page.getByText('Fermer la fiche'))).toBeVisible();
    await page.getByRole('tab', { name: 'Échelles' }).click();
    await expect(page.getByRole('region', { name: 'Échelles' }).locator('tbody tr')).toHaveCount(3);

    // La matrice adoptée est complète (9 résultats) et épinglée à ses trois échelles.
    await page.getByRole('tab', { name: 'Matrices' }).click();
    await page.getByRole('button', { name: 'Ouvrir' }).first().click();
    await expect(page.getByText('grille complète')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Grille de la matrice' }).getByRole('textbox')).toHaveCount(9);
    await page.screenshot({ path: 'test-results/cfg-grc-matrice.png', fullPage: true });

    // Échelle créée dans l'interface : 4 niveaux libellés, sans aucune valeur numérique.
    await page.getByRole('tab', { name: 'Échelles' }).click();
    await page.getByRole('button', { name: 'Nouvel élément : échelle' }).click();
    const nouveau = page.getByRole('dialog');
    await nouveau.getByRole('textbox', { name: 'Nom', exact: true }).fill('Gravité fictive de recette');
    await nouveau.getByRole('textbox', { name: 'Catégorie', exact: true }).click();
    await page.getByRole('option', { name: 'Gravité', exact: true }).click();
    const niveaux = nouveau.getByRole('textbox', { name: /Libellés des niveaux/ });
    for (const n of ['Mineure', 'Significative', 'Grave', 'Critique']) {
      await niveaux.fill(n);
      await niveaux.press('Enter');
    }
    await nouveau.getByRole('button', { name: 'Créer le brouillon' }).click();
    await expect(page.getByRole('button', { name: 'Fermer la fiche' })).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Description du niveau' })
      .first()
      .fill('Gêne passagère sans conséquence durable.');
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await page.getByRole('button', { name: 'Simuler et publier' }).click();
    const publier = page.getByRole('dialog');
    await publier.getByRole('textbox', { name: 'Motif de la publication' }).fill('Échelle de la recette');
    await publier.getByRole('textbox', { name: /saisissez PUBLIER/ }).fill('PUBLIER');
    await publier.getByRole('button', { name: /Publier la version 1/ }).click();
    await expect(page.getByText('Version 1').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/cfg-grc-echelle.png', fullPage: true });

    // Mêmes éléments sous Gestion des risques → Configuration des analyses.
    await page.goto('/pilotage/configuration-analyses');
    await expect(page.getByRole('heading', { name: 'Configuration des analyses' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Échelles' }).getByText('Gravité fictive de recette')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

async function choisir(page: Page, champ: string, option: string) {
  const dialogue = page.getByRole('dialog');
  await dialogue.getByRole('textbox', { name: champ, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('Atelier 2 : étude liée à la matrice du catalogue, pertinence proposée puis retenue', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    // Périmètre privé de recette (préparation par l'API) ; la matrice a été adoptée par le test précédent.
    await page.goto('/pilotage');
    const s = await (
      await page.request.post('/api/grc/smsis', {
        headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
        data: { name: 'QA-Pertinence-' + Date.now(), scope: 'Fixture privée de recette', timezone: 'Europe/Paris' },
      })
    ).json();
    await page.goto('/pilotage/etudes');
    await page.getByRole('textbox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: s.name, exact: true }).click();
    await page.getByRole('button', { name: 'Nouvelle étude' }).click();
    let d = page.getByRole('dialog');
    await d.getByRole('textbox', { name: 'Intitulé', exact: true }).fill('Étude fictive de pertinence');
    await choisir(
      page,
      'Matrice de pertinence des couples source de risque / objectif visé',
      'Niveau de pertinence (ressources × motivation) (matrice_pertinence_sr_ov)',
    );
    await expect(d.getByRole('textbox', { name: 'Version épinglée' })).toHaveValue('Version 1 (courante)');
    await d.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(d).toHaveCount(0);
    await page.getByRole('button', { name: 'Ouvrir l’étude' }).click();

    // Atelier 2 : les niveaux se choisissent sur les échelles de la matrice ; la pertinence est proposée.
    await page.getByRole('tab', { name: /^2\./ }).click();
    await page.getByRole('button', { name: 'Ajouter : Couple source de risque / objectif visé' }).click();
    d = page.getByRole('dialog');
    await d.getByRole('textbox', { name: 'Intitulé', exact: true }).fill('Couple fictif');
    await choisir(page, 'Ressources', '++');
    await choisir(page, 'Motivation', '++');
    await expect(d.getByRole('status')).toContainText('Moyenne');
    await d.getByRole('button', { name: 'Retenir la proposition' }).click();
    await expect(d.getByRole('textbox', { name: 'Pertinence retenue' })).toHaveValue('Moyenne');
    await d.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(d).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
