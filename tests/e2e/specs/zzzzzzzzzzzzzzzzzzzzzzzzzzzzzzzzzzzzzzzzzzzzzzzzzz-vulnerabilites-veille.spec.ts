/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : écran « Veille » de bout en bout, sans capture de référence (aucune
   n'est approuvée sans relecture) : état des sources, fenêtre de validation du flux (destinations, ce qui sort), recherche,
   accessibilité, CSP. Le flux n'est jamais ouvert ici : la fenêtre est annulée, pour qu'aucune source réelle ne soit jointe
   depuis la pile de test. Lot V4c : état de la lecture des fiches du CERT Santé. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Vulnérabilités : écran « Veille », sources, validation du flux annulée, recherche', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/vulnerabilites/veille');
    await expect(page.getByRole('heading', { name: 'Veille', level: 1 })).toBeVisible();
    const sources = page.getByRole('region', { name: 'Sources de la veille' });
    for (const hote of [
      'www.cisa.gov',
      'services.nvd.nist.gov',
      'api.first.org',
      'cert.cyber.gouv.fr',
      'cyberveille.esante.gouv.fr',
    ])
      await expect(sources).toContainText(hote);
    await expect(page.getByText('Aucune source n’est lue')).toBeVisible();
    // Lot V4c : état de la lecture des fiches du CERT Santé, aucune lue sur une pile vierge.
    await expect(page.getByText(/Fiches du CERT Santé .* 0 fiche lue, aucune à lire\./)).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Validation du flux : destinations et ce qui sort ; « Confirmer » exige la case ; annulée, rien n'est ouvert.
    await page.getByRole('button', { name: 'Activer la veille' }).click();
    const fenetre = page.getByRole('dialog', { name: /Veille sur les vulnérabilités/ });
    await expect(fenetre).toContainText('cyberveille.esante.gouv.fr');
    await expect(fenetre).toContainText('Aucune donnée métier');
    await expect(fenetre.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
    await fenetre.getByRole('button', { name: 'Annuler' }).click();
    await expect(fenetre).toBeHidden();
    const flux = (await (await page.request.get('/api/admin/flux-externes')).json()) as {
      modules: { module: string; ouvert: boolean }[];
    };
    expect(flux.modules.find((m) => m.module === 'veille-vulnerabilites')?.ouvert).toBe(false);
    await expect(page.getByRole('button', { name: 'Collecter maintenant' })).toHaveCount(0);

    // Recherche : aucune donnée collectée sur la pile de test.
    await page.getByLabel('Rechercher', { exact: true }).fill('CVE-2026-0001');
    await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(page.getByText('Aucune faille connue ne correspond à la recherche.')).toBeVisible();
    await expect(page.getByText('Aucune alerte ni aucun avis à afficher.')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
