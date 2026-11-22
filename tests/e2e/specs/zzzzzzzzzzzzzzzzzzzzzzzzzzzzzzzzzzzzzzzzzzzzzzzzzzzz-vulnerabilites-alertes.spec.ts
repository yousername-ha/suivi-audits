/* Module Vulnérabilités (ADR 0100, lots V6 et V6b) : onglet « Alertes » de bout en bout, sans capture de référence. La pile de test
   n'a aucune faille présente (ni Tenable, ni veille, ni AlgoLightHouse) : aucune alerte n'existe, la fenêtre d'alerte
   critique ne s'affiche donc sur aucune page (elle ne doit jamais gêner les autres parcours) et ce parcours n'en crée
   aucune ; la pile reste dans son état initial. Contenu et boutons de la fenêtre : tests de l'interface
   (apps/web/test/vulnerabilites-alertes.test.ts) et rendu vérifié sur un banc local. Menu, filtres (dont ceux repris du lien
   du résumé des notifications), accessibilité, CSP. Le compte d'installation tient le rôle Administrateur, pas le rôle RSSI :
   il ne peut prendre aucune alerte en compte (lot V6b, décision B du 18/11/2026). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ouvrirFiltres, sessionAdmin, watchPage } from '../helpers';

test('Vulnérabilités : onglet « Alertes », aucune fenêtre d’alerte critique sur une pile sans faille', async ({
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
  try {
    // Fenêtre : rien à prendre en compte, aucune alerte critique en cours ; l'administrateur n'est pas le RSSI.
    const f = await page.request.get('/api/vulnerabilites/alertes/fenetre');
    expect(f.status()).toBe(200);
    expect(await f.json()).toMatchObject({ alertes: [], total: 0, enCours: 0, peutPrendreEnCompte: false });
    const l = await page.request.get('/api/vulnerabilites/alertes');
    expect(l.status()).toBe(200);
    expect(await l.json()).toMatchObject({ elements: [], total: 0, peutPrendreEnCompte: false });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    await page.goto('/vulnerabilites/alertes');
    await expect(page.getByRole('heading', { name: 'Alertes', level: 1 })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Rubriques : Vulnérabilités' }).getByRole('link', { name: 'Alertes' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('th', { hasText: /^Niveau$/ })).toBeVisible();
    await expect(page.locator('th', { hasText: /^Faille$/ })).toBeVisible();
    await expect(page.locator('th', { hasText: /^Priorité$/ })).toBeVisible();
    await expect(page.locator('th', { hasText: /^Présence$/ })).toBeVisible();
    await expect(page.locator('th', { hasText: /^État$/ })).toBeVisible();
    await expect(page.getByText('Aucune alerte ne correspond.')).toBeVisible();
    // L'explication de la page est repliée dans son aide depuis la refonte du 22/11/2026.
    await page.getByText('À propos de cette page', { exact: true }).click();
    await expect(page.getByText(/Seul le RSSI peut prendre en compte une alerte\./)).toBeVisible();
    // Aucun rappel d'alerte critique dans l'en-tête du module, aucune fenêtre.
    await expect(page.getByText(/alertes? critiques? en cours/)).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Filtres : état et niveau.
    await ouvrirFiltres(page, 'État');
    await page.getByRole('combobox', { name: 'État', exact: true }).click();
    await page.getByRole('option', { name: 'Toutes', exact: true }).click();
    await ouvrirFiltres(page, 'Niveau');
    await page.getByRole('combobox', { name: 'Niveau', exact: true }).click();
    await page.getByRole('option', { name: 'Alerte critique', exact: true }).click();
    await expect(page.getByText('Aucune alerte ne correspond.')).toBeVisible();
    await expect(page.getByText('0 alerte', { exact: true })).toBeVisible();

    // Lien du résumé des notifications : onglet filtré sur les alertes simples ouvertes.
    await page.goto('/vulnerabilites/alertes?niveau=simple&etat=ouverte');
    await expect(page.getByRole('heading', { name: 'Alertes', level: 1 })).toBeVisible();
    await ouvrirFiltres(page, 'État');
    await expect(page.getByRole('combobox', { name: 'État', exact: true })).toHaveValue('Ouvertes');
    await ouvrirFiltres(page, 'Niveau');
    await expect(page.getByRole('combobox', { name: 'Niveau', exact: true })).toHaveValue('Alerte');
    await expect(page.getByText('Aucune alerte ne correspond.')).toBeVisible();

    // Fiche demandée par un lien de notification vers une alerte inconnue : erreur, sans fenêtre.
    await page.goto('/vulnerabilites/alertes?alerte=00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('dialog', { name: 'Alerte' })).toBeVisible();
    await expect(page.getByText('Alerte introuvable.')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer la fiche' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
