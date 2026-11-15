/* Courriel (décision 1) : configuration SMTP, mot de passe en écriture seule, message de test dont l'échec est expliqué.
   L'API n'envoie rien elle-même (pas de sortie réseau) : la demande passe par l'exécutant d'exploitation du serveur. Le flux
   « Courriel » est fermé par défaut (ADR 0097) : la page le dit ; activer l'envoi l'ouvre après validation explicite (case à
   cocher), le désactiver le referme. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

test('Courriel : configuration, mot de passe scellé, test réel dont l’échec est expliqué', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 1000 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const fluxOuvert = async () =>
    (
      (await (await ctx.request.get('/api/admin/flux-externes')).json()) as {
        modules: { module: string; ouvert: boolean }[];
      }
    ).modules.find((m) => m.module === 'courriel')!.ouvert;
  /** Fermeture de secours, par la route commune (la fermeture y est toujours admise). */
  const fermer = async () =>
    ctx.request.put('/api/admin/flux-externes/courriel', {
      headers: { 'X-CSRF-Token': await csrfOf(ctx.request) },
      data: { ouvert: false, confirmation: true },
    });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/systeme');
    await page.getByRole('link', { name: /^Courriel/ }).click();
    const fenetre = page.getByRole('dialog', { name: 'Courriel' });
    await expect(fenetre).toBeVisible();
    await expect(fenetre.getByText('L’exécutant d’exploitation envoie les courriels')).toBeVisible();
    // Flux fermé par défaut : la page le dit et renvoie à la carte qui l'ouvre.
    await expect(fenetre.getByText('Flux « Courriel (SMTP/SMTPS) » fermé')).toBeVisible();
    await expect(fenetre.getByRole('link', { name: 'Résumé des flux vers l’extérieur' })).toBeVisible();

    await fenetre.getByLabel('Activer l’envoi de courriels').check({ force: true });
    await fenetre.getByLabel('Serveur SMTP (nom d’hôte)').fill('smtp.invalid');
    await fenetre.getByLabel('Compte (laisser vide pour un relais sans authentification)').fill('compte-test');
    await fenetre.getByLabel('Adresse d’expédition').fill('suivi@exemple.test');
    await fenetre.getByLabel('Contact technique', { exact: true }).fill('technique@exemple.test');
    await fenetre.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    // Activer l'envoi ouvre le flux : la fenêtre de validation détaille ce qui sort ; « Confirmer » exige la case cochée.
    const validation = page.getByRole('dialog', { name: 'Activer « Courriel (SMTP/SMTPS) » : ouvrir son flux' });
    await expect(validation).toBeVisible();
    await expect(validation.getByText('Destinations et ports')).toBeVisible();
    await expect(validation.getByText('Ce qui sort du serveur')).toBeVisible();
    const confirmer = validation.getByRole('button', { name: 'Confirmer' });
    await expect(confirmer).toBeDisabled();
    await validation.getByRole('checkbox').check({ force: true });
    await confirmer.click();
    await expect(page.getByText('Courriel : enregistré.')).toBeVisible();
    expect(await fluxOuvert()).toBe(true);

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
    // Désactiver l'envoi a refermé le flux.
    await expect.poll(fluxOuvert).toBe(false);
    expect(problems).toEqual([]);
  } finally {
    await fermer().catch(() => undefined);
    await ctx.close();
  }
});
