/* Module Vulnérabilités (ADR 0100, lot V5) : écrans « Failles détectées » et « Machines » de bout en bout, sans capture de
   référence (aucune n'est approuvée sans relecture) : menu, bascule par faille et par machine, filtres, écran des machines,
   accessibilité, CSP. Aucun Tenable n'est joint : la pile de test n'a ni connecteur actif ni donnée synchronisée. Lot V4a :
   filtre de priorité, liste des failles déclarées, écran « Seuils de priorité ». Lot V4b : filtre « Suivi » (aucune faille à
   clore sur une pile vierge). Lot V4c : filtre « Exploitation avérée » (toutes les sources). V31 : écran « Mots à ne pas
   masquer » (ajout et retrait d'un mot, effet affiché). Lot V4d : onglet « Dépôts Tenable » de l'écran « Machines »
   (administration du module ; aucun dépôt sur une pile vierge), choix « Hérité du dépôt » de l'affectation. Lot PC2 :
   présentation « Parc » de l'écran « Machines » (quatre zones vides sur une pile vierge, murs, légende des marques, échelle
   réduite et grand écran), colonne « Priorité et marques » de la liste ; la présentation est une préférence de la personne,
   remise à sa valeur d'origine en fin de parcours, même en cas d'échec. Lot GRP-MACHINES : sans préférence mémorisée (effacée
   au départ du parcours), l'écran s'ouvre sur le « Parc » ; le parcours passe ensuite à la « Liste » pour ses contrôles. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ouvrirFiltres, csrfOf, sessionAdmin, watchPage } from '../helpers';

test('Vulnérabilités : failles détectées par faille et par machine, écran des machines', async ({ browser }) => {
  const session = await sessionAdmin(browser);
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: session.state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  // Préférences d'origine, remises en fin de parcours (lot PC2 : la présentation de « Machines » y est mémorisée).
  const preferences = await (await page.request.get('/api/account/preferences')).json();
  try {
    // Lot GRP-MACHINES : aucune présentation mémorisée au départ, pour lire celle par défaut.
    const { vulnerabilitesMachines: _memorisee, ...sansPresentation } = preferences;
    expect(
      (
        await page.request.put('/api/account/preferences', {
          data: sansPresentation,
          headers: { 'x-csrf-token': await csrfOf(page.request) },
        })
      ).status(),
    ).toBe(200);
    await page.goto('/vulnerabilites/failles');
    await expect(page.getByRole('heading', { name: 'Failles détectées', level: 1 })).toBeVisible();
    await expect(page.getByText('Aucune faille détectée ne correspond')).toBeVisible();
    await ouvrirFiltres(page, 'Exploitation avérée');
    await page.getByLabel('Exploitation avérée').check();
    await expect(page.getByText('Aucune faille détectée ne correspond')).toBeVisible();
    await ouvrirFiltres(page, 'Priorité');
    await expect(page.getByRole('combobox', { name: 'Priorité', exact: true })).toBeVisible();
    await ouvrirFiltres(page, 'Suivi');
    await expect(page.getByRole('combobox', { name: 'Suivi', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Failles déclarées/ })).toBeVisible();
    await expect(page.getByText('Aucune faille déclarée ne correspond')).toBeVisible();
    // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Par machine', exact: true }).click();
    await expect(page.getByText('Aucune machine ne correspond')).toBeVisible();

    await page.getByRole('link', { name: 'Machines', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Machines', level: 1 })).toBeVisible();
    // Lot GRP-MACHINES (décision du RSSI du 23/11/2026) : sans préférence mémorisée, la présentation « Parc » s'ouvre.
    for (const zone of ['Front', 'Back applicatif', 'Base de données', 'Rôle non indiqué'])
      await expect(page.getByRole('heading', { name: zone, level: 3, exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Affectation des machines choisies' })).toHaveCount(0);
    await page
      .getByRole('group', { name: 'Présentation des machines' })
      .getByRole('button', { name: 'Liste', exact: true })
      .click();
    await expect(page.getByRole('group', { name: 'Affectation des machines choisies' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Appliquer à 0 machine/ })).toBeDisabled();
    await expect(page.locator('th', { hasText: /^Périmètre$/ })).toBeVisible();
    // Lot V4d : « Hérité du dépôt » retire le périmètre indiqué à la main.
    await page.getByRole('combobox', { name: 'Périmètre à indiquer', exact: true }).click();
    await expect(
      page.getByRole('option', { name: 'Hérité du dépôt (retirer le périmètre indiqué à la main)', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    // Onglet « Dépôts Tenable » (administrateur) : aucun dépôt sur une pile vierge.
    await page.getByRole('tab', { name: 'Dépôts Tenable', exact: true }).click();
    await expect(page.locator('th', { hasText: /^Dépôt Tenable$/ })).toBeVisible();
    await expect(page.getByText(/Aucun dépôt Tenable/)).toBeVisible();
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.getByRole('tab', { name: 'Machines', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Affectation des machines choisies' })).toBeVisible();

    // Lot PC2 : liste avec la colonne « Priorité et marques » et la légende ; présentation « Parc », réduite puis grand écran.
    await expect(page.locator('th', { hasText: /^Priorité et marques$/ })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Légende des marques' })).toContainText('Zero-day');
    // Lot PRIO-1 : le triangle dit « exploitation avérée » ; « zero-day » est réservé aux failles sans correctif connu.
    await expect(page.getByRole('list', { name: 'Légende des marques' })).toContainText('Exploitation avérée');
    await expect(page.getByRole('list', { name: 'Légende des marques' })).toContainText('sans correctif connu');
    const presentation = page.getByRole('group', { name: 'Présentation des machines' });
    await presentation.getByRole('button', { name: 'Parc', exact: true }).click();
    for (const zone of ['Front', 'Back applicatif', 'Base de données', 'Rôle non indiqué'])
      await expect(page.getByRole('heading', { name: zone, level: 3, exact: true })).toBeVisible();
    await expect(page.getByText('Frontière front · back', { exact: true })).toBeVisible();
    await expect(page.getByText('Frontière back · bases', { exact: true })).toBeVisible();
    await expect(page.getByText('Aucune machine lue avec ce rôle.')).toHaveCount(3);
    await expect(page.getByRole('group', { name: 'Affectation des machines choisies' })).toHaveCount(0);
    // Les filtres restent.
    await expect(page.getByRole('textbox', { name: 'Rechercher', exact: true })).toBeVisible();
    await ouvrirFiltres(page, 'Rôle');
    await expect(page.getByRole('combobox', { name: 'Rôle', exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.getByRole('radiogroup', { name: 'Échelle du parc' }).getByText('Grand écran', { exact: true }).click();
    await expect(page.locator('.parc--grand')).toBeVisible();
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    // Choix mémorisé : il survit au rechargement de la page.
    await page.reload();
    await expect(page.locator('.parc--grand')).toBeVisible();
    await page.getByRole('radiogroup', { name: 'Échelle du parc' }).getByText('Réduit', { exact: true }).click();
    await expect(page.locator('.parc--reduit')).toBeVisible();
    await page
      .getByRole('group', { name: 'Présentation des machines' })
      .getByRole('button', { name: 'Liste', exact: true })
      .click();
    await expect(page.getByRole('group', { name: 'Affectation des machines choisies' })).toBeVisible();

    // Seuils de priorité : grille en clair, seuil EPSS à 50 % par défaut, réglable par l'administrateur.
    await page.goto('/vulnerabilites/priorite');
    await expect(page.getByRole('heading', { name: 'Seuils de priorité', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Seuil EPSS (en %)')).toHaveValue('50');
    // Lot S1 : l'écran porte aussi « Enregistrer les délais » ; le bouton du seuil se cherche par son nom exact.
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeEnabled();
    // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Mots à ne pas masquer (V31) : liste vide par défaut ; un mot ajouté dit son effet (aucune machine ici), puis retiré.
    await page.goto('/vulnerabilites/masque');
    await expect(page.getByRole('heading', { name: 'Mots à ne pas masquer', level: 1 })).toBeVisible();
    await expect(page.getByText('Aucun mot : le masque est strict.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Mot', exact: true }).fill('dpi');
    await expect(page.getByText(/aucun effet aujourd’hui/)).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByText('dpi', { exact: true })).toBeVisible();
    // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Retirer', exact: true }).click();
    await expect(page.getByText('Aucun mot : le masque est strict.')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await page.request.put('/api/account/preferences', {
      data: preferences,
      headers: { 'x-csrf-token': await csrfOf(page.request) },
    });
    await ctx.close();
  }
});
