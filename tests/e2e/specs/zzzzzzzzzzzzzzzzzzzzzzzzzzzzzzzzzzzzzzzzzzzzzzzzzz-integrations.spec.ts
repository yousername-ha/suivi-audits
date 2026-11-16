/* Module Intégrations (ADR 0076), socle des connecteurs réseau : rubrique « Intégrations » de bout en bout, sans capture de
   référence (aucune n'est approuvée sans relecture) : instance Tenable créée, clés en écriture seule (« défini »), activation
   qui ouvre le flux après validation explicite (ADR 0097), désactivation qui le referme, accessibilité, CSP. Aucun appel
   n'est lancé vers un outil : l'adresse et les clés sont fictives. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Intégrations : connecteur Tenable créé, clés enregistrées sans être réaffichées, flux ouvert puis refermé', async ({
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
  const nom = `Tenable fictif ${Date.now().toString(36)}`;
  const cle = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const fluxTenable = async () =>
    (
      (await (await page.request.get('/api/admin/flux-externes')).json()) as {
        modules: { module: string; ouvert: boolean }[];
      }
    ).modules.find((m) => m.module === 'tenable')!.ouvert;
  try {
    await page.goto('/integrations');
    await expect(page.getByRole('heading', { name: 'Intégrations', level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: 'Intégrations' })).toHaveAttribute('href', '/integrations');

    await page
      .getByRole('region', { name: 'Tenable Security Center' })
      .getByRole('button', { name: 'Ajouter une instance' })
      .click();
    const ajout = page.getByRole('dialog', { name: 'Ajouter : Tenable Security Center' });
    await ajout.getByLabel('Nom', { exact: true }).fill(nom);
    // Port réglable (décision du RSSI du 16/11/2026) : rappelé dans la fenêtre de validation du flux.
    await ajout.getByLabel('Adresse du service', { exact: true }).fill('https://tenable.exemple.test:8443');
    await ajout.getByRole('button', { name: 'Créer l’instance' }).click();
    const config = page.getByRole('dialog', { name: `Configurer ${nom}` });
    await config.getByLabel(/^Clé d’accès/).fill(cle);
    await config.getByLabel(/^Clé secrète/).fill(cle.split('').reverse().join(''));
    await config.getByRole('button', { name: 'Enregistrer les secrets' }).click();
    await expect(config.getByLabel('Clé d’accès (défini)')).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(cle);
    await page.keyboard.press('Escape');
    await expect(config).toBeHidden();

    const tuile = page.getByRole('region', { name: nom });
    await expect(tuile).toContainText('Clé d’accès : Défini');
    await expect(tuile).toContainText('Clé secrète : Défini');
    await tuile.getByRole('button', { name: 'Activer', exact: true }).click();
    const validation = page.getByRole('dialog', { name: 'Activer « Tenable Security Center » : ouvrir son flux' });
    await expect(validation).toContainText('clés d’API');
    await expect(validation).toContainText(`Port réglé pour « ${nom} » : TCP 8443.`);
    await expect(validation.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
    await validation
      .getByLabel(
        'J’ai pris connaissance des destinations, des ports et des données qui sortent, et j’autorise ce flux.',
      )
      .check();
    await validation.getByRole('button', { name: 'Confirmer' }).click();
    await expect(tuile.getByRole('button', { name: 'Désactiver', exact: true })).toBeVisible();
    // Synchronisation des failles (ADR 0100, lot V5) : filtre de gravité et bouton, sans lancer d'appel.
    await expect(tuile).toContainText('Critique, Élevée');
    await expect(tuile.getByRole('button', { name: 'Synchroniser maintenant' })).toBeVisible();
    expect(await fluxTenable()).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await tuile.getByRole('button', { name: 'Désactiver', exact: true }).click();
    await expect(tuile.getByRole('button', { name: 'Activer', exact: true })).toBeVisible();
    expect(await fluxTenable()).toBe(false);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
