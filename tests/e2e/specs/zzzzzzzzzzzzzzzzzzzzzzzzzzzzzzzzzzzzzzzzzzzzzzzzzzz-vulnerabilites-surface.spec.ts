/* Module Vulnérabilités (ADR 0100, lot ALH1) : connecteur AlgoLightHouse et écran « Surface externe » de bout en bout, sans
   capture de référence (aucune n'est approuvée sans relecture) : instance créée à l'adresse fictive d'un espace chez
   l'éditeur, clé en écriture seule (« défini »), activation qui ouvre son propre flux après validation explicite
   (ADR 0097), écran avec ses onglets (alertes, actifs, technologies, périmètres), accessibilité, CSP, puis désactivation qui
   referme le flux. Aucun appel n'est lancé vers l'éditeur : l'adresse et la clé sont fictives, aucune synchronisation n'est
   demandée. Lot ALH2 : colonne « Priorité » et tri par priorité des alertes et des technologies (sans données, la fiche
   d'une alerte et ses recommandations sont couvertes par les tests de l'interface et de l'API). Lot ALH3 : colonne et
   filtre « Machine interne » de l'onglet des actifs (sans données, la fiche d'un actif, ses propositions et la liaison à la
   main sont couvertes par les tests de l'interface et de l'API). Lot ALH4 : onglet « Carte » affiché en premier, vide sur une
   pile vierge (le dessin, les filtres, le repli et le chemin critique sont couverts par les tests de l'interface et de
   l'API). Lot ALH5 : fenêtre « Relier en masse » de l'onglet des actifs (motifs, mode, aperçu vide sur une pile vierge,
   motif refusé par le serveur) ; rien n'est écrit, la pile reste dans son état initial (la liaison elle-même, les droits
   par paire et la majoration sont couverts par les tests de l'API). Lot ALH6 : colonne « Services connus » de l'onglet des
   actifs et limite « seuls les services portés par une alerte sont connus » (sans données ; la colonne « Service » de la
   carte, les fiches et le rangement sont couverts par les tests de l'interface et de l'API). Lot I1 : le connecteur se
   configure dans la carte « Intégrations » de la page Plateforme ; l'écran n'en montre que l'état et le lien. Lot SI2 :
   la carte vide dit qu'elle se remplit aussi par un import Silène ; le parcours de la carte à deux sources (regroupement
   par adresse IP, filtre par nom, présentation empilée) est dans la spec de l'import Silène, qui a des données. */
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
    // Le connecteur se configure dans la carte « Intégrations » de la page Plateforme (ADR 0076, addendum du 19/11/2026).
    await page.goto('/plateforme/integrations');
    await expect(page.getByRole('dialog', { name: 'Intégrations', exact: true })).toBeVisible();
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
    // Lot I1 : l'écran ne montre que l'état et le lien vers la carte ; aucun bouton de test ni de synchronisation.
    await expect(page.getByRole('link', { name: 'Configurer l’intégration', exact: true })).toHaveAttribute(
      'href',
      '/plateforme/integrations',
    );
    await expect(page.getByRole('button', { name: /Synchroniser|Tester la connexion/ })).toHaveCount(0);
    // La planification de l'API (toutes les minutes) peut inscrire la synchronisation du jour entre l'activation et cette
    // lecture : l'état est alors « Synchronisation en cours », ou en échec si un exécutant l'a déjà prise.
    await expect(
      page.getByText(/Jamais synchronisé|Synchronisation en cours|Dernière synchronisation en échec/).first(),
    ).toBeVisible();
    // Lot ALH4 : l'onglet « Carte » s'affiche en premier ; sans données, la carte se dit vide.
    await expect(page.getByRole('tab', { name: 'Carte', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/la carte est vide/)).toBeVisible();
    await expect(page.getByText(/la carte est vide/)).toContainText('ou un import de rapport Silène');
    await accessible();
    await page.getByRole('tab', { name: 'Alertes', exact: true }).click();
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
    await expect(page.locator('th', { hasText: /^Machine interne$/ })).toBeVisible();
    await expect(page.locator('th', { hasText: /^Services connus$/ })).toBeVisible();
    await expect(page.getByText(/Seuls les services portés par une alerte sont connus/)).toBeVisible();
    const filtreMachine = page.getByRole('combobox', { name: 'Machine interne', exact: true });
    await filtreMachine.click();
    await page.getByRole('option', { name: 'Proposée, à décider', exact: true }).click();
    await expect(filtreMachine).toHaveValue('Proposée, à décider');
    await expect(page.getByText('Aucun actif ne correspond')).toBeVisible();
    await accessible();
    // Lot ALH5 : « Relier en masse » ; un aperçu n'écrit rien.
    await page.getByRole('button', { name: 'Relier en masse', exact: true }).click();
    const masse = page.getByRole('dialog', { name: 'Relier en masse les actifs exposés aux machines internes' });
    await expect(masse.getByRole('combobox', { name: 'Mode', exact: true })).toHaveValue(
      'Un pour un (même partie couverte par le joker)',
    );
    await masse.getByRole('textbox', { name: 'Motif des actifs', exact: true }).fill('pre-*.exemple.example');
    await masse.getByRole('textbox', { name: 'Motif des machines', exact: true }).fill('srv-pre-*');
    await masse.getByRole('button', { name: 'Voir l’aperçu', exact: true }).click();
    await expect(masse.getByText('0 actif correspond au motif : 0 paire à relier.')).toBeVisible();
    await expect(masse.getByRole('button', { name: 'Relier 0 paire', exact: true })).toBeDisabled();
    await accessible();
    // Un métacaractère autre que « * » est refusé par le serveur.
    await masse.getByRole('textbox', { name: 'Motif des machines', exact: true }).fill('srv-pre-*%');
    await masse.getByRole('button', { name: 'Voir l’aperçu', exact: true }).click();
    await expect(masse.getByRole('alert')).toBeVisible();
    // Mode « tous vers une machine » : sélecteur de machine dans la fenêtre.
    await masse.getByRole('combobox', { name: 'Mode', exact: true }).click();
    await page.getByRole('option', { name: 'Tous vers une machine', exact: true }).click();
    await expect(masse.getByRole('combobox', { name: 'Machine interne', exact: true })).toBeVisible();
    await masse.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
    await expect(masse).toBeHidden();
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

    await page.goto('/plateforme/integrations');
    await page.getByRole('region', { name: nom }).getByRole('button', { name: 'Désactiver', exact: true }).click();
    await expect(
      page.getByRole('region', { name: nom }).getByRole('button', { name: 'Activer', exact: true }),
    ).toBeVisible();
    expect(await fluxAlh()).toBe(false);
    expect(problems).toEqual([]);
  } finally {
    // Un échec en cours de route ne doit pas laisser l'instance active ni le flux ouvert : un nouvel essai partirait d'un
    // flux déjà validé, sans fenêtre de validation.
    try {
      await page.goto('/plateforme/integrations');
      const desactiver = page
        .getByRole('region', { name: nom })
        .getByRole('button', { name: 'Désactiver', exact: true });
      if (await desactiver.isVisible({ timeout: 3000 }).catch(() => false)) {
        await desactiver.click();
        await expect(
          page.getByRole('region', { name: nom }).getByRole('button', { name: 'Activer', exact: true }),
        ).toBeVisible();
      }
    } catch {
      // Le ménage ne masque pas l'échec d'origine.
    }
    await ctx.close();
  }
});
