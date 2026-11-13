/* Navigation et bibliothèque intégrées, API exclusivement FICTIVE et interceptée. */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bibliothequeFixture } from './bibliotheque-fixture';
test('navigation unique et couverture intégrée ; ancienne route redirigée sans réouvrir une ancienne fiche', async ({
  page,
}) => {
  const f = await bibliothequeFixture(page);
  await expect(page.locator('.onglets-rubriques')).toHaveCount(0);
  await expect(
    page.locator('.shell-nav').getByRole('link', { name: 'Bibliothèque de référentiels', exact: true }),
  ).toBeVisible();
  await page.goto(
    new URL(
      '/pilotage/couverture?perimetre=' + f.scopes[0].id + '&ouvrir=ancienne-fiche',
      process.env.E2E_UI_URL ?? 'http://127.0.0.1:5212',
    ).href,
  );
  await expect(page).toHaveURL(/\/pilotage\/bibliotheque\?perimetre=/);
  expect(new URL(page.url()).searchParams.has('ouvrir')).toBe(false);
  await expect(page.locator('.bb-record')).toHaveCount(2);
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
});
test('scope sans rattachement conserve le catalogue et ne présente pas de zéros fictifs', async ({ page }) => {
  const f = await bibliothequeFixture(page);
  const before = await page.locator('.bb-catalogue-stats').allTextContents();
  await page.getByRole('combobox', { name: 'Périmètre de la couverture' }).click();
  await page.getByRole('option', { name: f.scopes[1].name, exact: true }).click();
  await expect(page.locator('.bb-bar')).toHaveCount(0);
  expect(await page.locator('.bb-catalogue-stats').allTextContents()).toEqual(before);
  await expect(page.locator('.bb-record').first()).toContainText('n’est pas rattaché et actif');
  expect(f.writes).toEqual([]);
});
test('recherche discrète, clic et clavier, détail borné, commandes de catalogue indépendantes', async ({ page }) => {
  const f = await bibliothequeFixture(page);
  await page.getByRole('button', { name: 'Rechercher un référentiel', exact: true }).click();
  await page.getByRole('searchbox').fill('hds');
  await page.getByRole('searchbox').press('Escape');
  await expect(page.locator('.bb-record')).toHaveCount(1);
  await expect(page.locator('.bb-criteria')).toContainText('hds');
  await page.getByRole('button', { name: 'Effacer la recherche ×' }).click();
  const row = page.locator('.bb-record').first();
  await row.focus();
  await row.press('Enter');
  const dialog = page.getByRole('dialog', { name: f.catalogue[0].name, exact: true });
  await expect(dialog.getByRole('row')).toHaveCount(127);
  await page.keyboard.press('Escape');
  await expect(row).toBeFocused();
  await row.getByRole('button', { name: /Consulter les exigences/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Exigence de démonstration');
  await expect(page.getByRole('dialog').getByRole('button', { name: /Évaluer/ })).toHaveCount(0);
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
});
test('évaluation existante, version et If-Match préservés, erreur conservant la saisie', async ({ page }) => {
  const f = await bibliothequeFixture(page);
  await page.locator('.bb-record').first().getByRole('button', { name: 'Voir la couverture' }).click();
  await page.getByRole('button', { name: 'Évaluer l’exigence DEMO-1', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Évaluation de l’exigence DEMO-1', exact: true });
  await d.getByRole('combobox', { name: 'Applicabilité', exact: true }).click();
  await page.getByRole('option', { name: 'Applicable', exact: true }).click();
  await d.getByRole('combobox', { name: 'Mise en œuvre', exact: true }).click();
  await page.getByRole('option', { name: 'Complète', exact: true }).click();
  await d.getByRole('textbox', { name: 'Motif de cette version' }).fill('Évaluation de recette');
  f.state.fail = true;
  await d.getByRole('button', { name: 'Enregistrer une nouvelle version' }).click();
  await expect(d.getByRole('alert')).toContainText('Échec de recette');
  await expect(d.getByRole('textbox', { name: 'Motif de cette version' })).toHaveValue('Évaluation de recette');
  await d.getByRole('button', { name: 'Enregistrer une nouvelle version' }).click();
  await expect(d).toHaveCount(0);
  expect(f.writes.at(-1)?.ifMatch).toBe('"0"');
  expect(f.writes.at(-1)?.body).toMatchObject({
    implementation: 'complete',
    confirm: 'EVALUER',
    reason: 'Évaluation de recette',
  });
  expect(f.errors).toEqual([]);
});
test('bibliothèque lecteur et historique sans écriture', async ({ page }) => {
  const f = await bibliothequeFixture(page, { readonly: true });
  await expect(page.getByRole('button', { name: 'Importer un référentiel', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Autres actions pour/ })).toHaveCount(0);
  await page.locator('.bb-record').first().getByRole('button', { name: 'Voir la couverture' }).click();
  await page.getByRole('button', { name: 'Consulter l’exigence DEMO-1', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Évaluation de l’exigence DEMO-1' })).toContainText(
    'Historique des versions',
  );
  await expect(page.getByRole('button', { name: 'Enregistrer une nouvelle version' })).toHaveCount(0);
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
});
test('catalogue ou couverture indisponible : erreur visible, pas de faux résultat vide', async ({ page }) => {
  await bibliothequeFixture(page, { unavailable: true });
  await expect(page.getByRole('alert')).toContainText('Bibliothèque indisponible');
  await expect(page.locator('.bb-catalogue-title')).toContainText('Catalogue non chargé');
  await page.unrouteAll({ behavior: 'wait' });
  const f = await bibliothequeFixture(page, { coverageError: true });
  await expect(page.getByRole('alert')).toContainText('Couverture indisponible');
  await expect(page.locator('.bb-bar')).toHaveCount(0);
  await expect(page.locator('.bb-record').first()).toContainText('les états ne sont pas connus');
  expect(f.errors).toEqual([]);
});
test('dimensions PC, défilement local et accessibilité clair/sombre', async ({ page }) => {
  const f = await bibliothequeFixture(page);
  for (const [width, height] of [
    [1024, 768],
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width, height });
    const g = await page.locator('.bb-scroll').evaluate((e) => ({
      w: e.clientWidth,
      sw: e.scrollWidth,
      h: e.clientHeight,
      page: document.documentElement.scrollWidth,
    }));
    expect(g.sw).toBeLessThanOrEqual(g.w);
    expect(g.page).toBeLessThanOrEqual(width);
    expect(g.h).toBeGreaterThan(180);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => (document.documentElement.dataset.mantineColorScheme = t), theme);
    for (const detail of [false, true]) {
      if (detail) await page.locator('.bb-record').first().getByRole('button', { name: 'Voir la couverture' }).click();
      const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(a.violations).toEqual([]);
      if (detail) await page.keyboard.press('Escape');
    }
  }
  const warning = page.locator('.bb-warning-clauses').first();
  await expect(warning).toContainText('clauses obligatoires pas encore conformes');
  await expect(warning).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(warning).toHaveCSS('animation-name', 'bs-warning-breathe');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(warning).toHaveCSS('animation-name', 'none');
  expect(f.errors).toEqual([]);
});

test('copie et import conservent leurs dialogues et requêtes existants', async ({ page }) => {
  const f = await bibliothequeFixture(page);
  await page
    .locator('.bb-record')
    .first()
    .getByRole('button', { name: /Autres actions pour/ })
    .click();
  await page.getByRole('menuitem', { name: 'Créer une copie personnalisable', exact: true }).click();
  const copie = page.getByRole('dialog', { name: /Créer une copie de/ });
  await copie.getByLabel('Nom de la copie').fill('Copie de recette');
  await copie.getByRole('button', { name: 'Créer la copie', exact: true }).click();
  await expect(copie).toHaveCount(0);
  await expect(page.locator('.bb-record')).toHaveCount(3);
  expect(f.writes[0]?.body).toEqual({ name: 'Copie de recette' });
  await page.getByRole('button', { name: 'Importer un référentiel', exact: true }).click();
  const imp = page.getByRole('dialog', { name: 'Importer un référentiel dans la bibliothèque', exact: true });
  await imp.getByRole('button', { name: 'Insérer un exemple fictif' }).click();
  await imp.getByRole('button', { name: 'Simuler la publication' }).click();
  await imp.getByRole('textbox', { name: 'Motif de la publication' }).fill('Import fictif de recette');
  await imp.getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(imp).toHaveCount(0);
  await expect(page.locator('.bb-record')).toHaveCount(4);
  expect(f.writes.at(-1)?.body).toMatchObject({
    previewId: 'preview-demo',
    reason: 'Import fictif de recette',
    confirm: 'PUBLIER',
  });
  expect(f.errors).toEqual([]);
});
