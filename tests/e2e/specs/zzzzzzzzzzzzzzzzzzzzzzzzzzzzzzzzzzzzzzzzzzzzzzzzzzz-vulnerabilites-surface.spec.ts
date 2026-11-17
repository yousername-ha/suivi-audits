/* Module Vulnérabilités (ADR 0100, lot ALH1) : connecteur AlgoLightHouse et écran « Surface externe » de bout en bout, sans
   capture de référence (aucune n'est approuvée sans relecture) : instance créée à l'adresse fictive d'un espace chez
   l'éditeur, clé en écriture seule (« défini »), activation qui ouvre son propre flux après validation explicite
   (ADR 0097), écran avec ses onglets (alertes, actifs, technologies, périmètres), accessibilité, CSP, puis désactivation qui
   referme le flux. Aucun appel n'est lancé vers l'éditeur : l'adresse et la clé sont fictives, aucune synchronisation n'est
   demandée. Lot ALH2 : colonne « Priorité » et tri par priorité des alertes et des technologies (sans données, la fiche
   d'une alerte et ses recommandations sont couvertes par les tests de l'interface et de l'API). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Surface externe : connecteur AlgoLightHouse créé et activé, onglets de l’écran, flux refermé', async ({
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
  const nom = `AlgoLightHouse fictif ${Date.now().toString(36)}`;
  const cle = 'cle-api-fictive-0123456789abcdef';
  const fluxAlh = async () =>
    (
      (await (await page.request.get('/api/admin/flux-externes')).json()) as {
        modules: { module: string; ouvert: boolean }[];
      }
    ).modules.find((m) => m.module === 'algolighthouse')?.ouvert ?? false;
  const accessible = async () => {
    // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  };
  try {
    await page.goto('/integrations');
    await expect(page.getByRole('heading', { name: 'Intégrations', level: 1 })).toBeVisible();
    await page
      .getByRole('region', { name: 'AlgoLightHouse', exact: true })
      .getByRole('button', { name: 'Ajouter une instance' })
      .click();
    const ajout = page.getByRole('dialog', { name: 'Ajouter : AlgoLightHouse' });
    await ajout.getByRole('textbox', { name: 'Nom', exact: true }).fill(nom);
    // Ni autorité de certification propre ni gravités : seuls l'adresse de l'espace et le délai se règlent.
    await expect(ajout.getByRole('textbox', { name: 'Autorité de certification (facultatif)' })).toHaveCount(0);
    await ajout.getByRole('textbox', { name: 'Adresse du service', exact: true }).fill('https://tenable.exemple.test');
    await ajout.getByRole('button', { name: 'Créer l’instance' }).click();
    await expect(ajout.getByRole('alert')).toContainText('algolighthouse.fr');
    await ajout
      .getByRole('textbox', { name: 'Adresse du service', exact: true })
      .fill('https://espace-fictif.algolighthouse.fr');
    await ajout.getByRole('button', { name: 'Créer l’instance' }).click();
    const config = page.getByRole('dialog', { name: `Configurer ${nom}` });
    await config.getByLabel(/^Clé d’API/).fill(cle);
    await config.getByRole('button', { name: 'Enregistrer les secrets' }).click();
    await expect(config.getByLabel('Clé d’API (défini)')).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(cle);
    await page.keyboard.press('Escape');
    await expect(config).toBeHidden();

    const tuile = page.getByRole('region', { name: nom });
    await expect(tuile).toContainText('Clé d’API : Défini');
    await tuile.getByRole('button', { name: 'Activer', exact: true }).click();
    const validation = page.getByRole('dialog', { name: 'Activer « AlgoLightHouse » : ouvrir son flux' });
    await expect(validation).toContainText('espace.algolighthouse.fr');
    await validation
      .getByLabel(
        'J’ai pris connaissance des destinations, des ports et des données qui sortent, et j’autorise ce flux.',
      )
      .check();
    await validation.getByRole('button', { name: 'Confirmer' }).click();
    await expect(tuile.getByRole('button', { name: 'Désactiver', exact: true })).toBeVisible();
    await expect(tuile).toContainText('Surface externe');
    await expect(tuile.getByRole('button', { name: 'Synchroniser maintenant' })).toBeVisible();
    expect(await fluxAlh()).toBe(true);

    await page.goto('/vulnerabilites/surface-externe');
    await expect(page.getByRole('heading', { name: 'Surface externe', level: 1 })).toBeVisible();
    await expect(page.getByText(nom, { exact: true })).toBeVisible();
    await expect(page.getByText('Jamais synchronisé').first()).toBeVisible();
    await expect(page.getByText('Aucune alerte ne correspond')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Criticité', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Statut chez l’éditeur', exact: true })).toBeVisible();
    await expect(page.locator('th', { hasText: /^Priorité$/ }).first()).toBeVisible();
    const triAlertes = page.getByRole('combobox', { name: 'Trier les alertes par', exact: true });
    await expect(triAlertes).toHaveValue('Criticité de l’éditeur');
    await triAlertes.click();
    await page.getByRole('option', { name: 'Priorité calculée', exact: true }).click();
    await expect(triAlertes).toHaveValue('Priorité calculée');
    await expect(page.getByText('Aucune alerte ne correspond')).toBeVisible();
    await page.getByRole('textbox', { name: 'Rechercher une alerte', exact: true }).fill('CVE-2026-91001');
    await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(page.getByText('Aucune alerte ne correspond')).toBeVisible();
    await accessible();
    await page.getByRole('tab', { name: 'Actifs', exact: true }).click();
    await expect(page.getByText('Aucun actif ne correspond')).toBeVisible();
    await page.getByRole('tab', { name: 'Technologies', exact: true }).click();
    await expect(page.getByText('Aucune technologie ne correspond')).toBeVisible();
    const triTechnologies = page.getByRole('combobox', { name: 'Trier les technologies par', exact: true });
    await triTechnologies.click();
    await page.getByRole('option', { name: 'Priorité calculée', exact: true }).click();
    await expect(triTechnologies).toHaveValue('Priorité calculée');
    await expect(page.getByText('Aucune technologie ne correspond')).toBeVisible();
    await accessible();
    await page.getByRole('tab', { name: 'Périmètres', exact: true }).click();
    await expect(page.getByText(/Aucun périmètre AlgoLightHouse/)).toBeVisible();
    await accessible();

    await page.goto('/integrations');
    await page.getByRole('region', { name: nom }).getByRole('button', { name: 'Désactiver', exact: true }).click();
    await expect(
      page.getByRole('region', { name: nom }).getByRole('button', { name: 'Activer', exact: true }),
    ).toBeVisible();
    expect(await fluxAlh()).toBe(false);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
