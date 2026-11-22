/* Module Vulnérabilités (ADR 0100, lot S1) : délais de correction et exceptions de bout en bout, sans capture de référence. La
   pile de test n'a aucune faille (ni Tenable, ni veille, ni AlgoLightHouse) : aucune faille en dépassement, aucune exception,
   aucune correction mesurée. Le parcours ne modifie rien (aucun enregistrement : la saisie refusée des délais n'est pas
   envoyée) et ne dépend d'aucun état qui change seul (l'évaluation des délais au tic de l'API ne trouve rien à évaluer) ; la
   pile reste dans son état initial. Le compte d'installation tient le rôle Administrateur, pas le rôle RSSI : il ne peut
   accorder aucune exception. Onglet « Délais et exceptions », filtres de « Failles détectées » repris de l'adresse (lien de la
   tuile et du résumé notifié), tuile « En dépassement », délais dans « Seuils de priorité », accessibilité en clair et en
   sombre, CSP. Calculs, expiration, rappels et notifications : tests du paquet partagé et de l'API. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ouvrirFiltres, sessionAdmin, watchPage } from '../helpers';

for (const [mode, scheme] of [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const)
  test(`Vulnérabilités : délais de correction et exceptions sur une pile sans faille (${mode})`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'fr-FR',
      viewport: { width: 1366, height: 900 },
      colorScheme: scheme,
      storageState: (await sessionAdmin(browser)).state,
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    try {
      // Route de lecture : délais par défaut, aucune exception, aucune correction ; l'administrateur n'est pas le RSSI.
      const r = await page.request.get('/api/vulnerabilites/delais?periode=90');
      expect(r.status()).toBe(200);
      expect(await r.json()).toMatchObject({
        delais: {
          P1: { duree: 48, unite: 'heures' },
          P2: { duree: 15, unite: 'jours' },
          P3: { duree: 90, unite: 'jours' },
          P4: null,
        },
        exceptions: [],
        nonMesurees: 0,
        peutDeciderException: false,
        mesures: { total: { nombre: 0, taux: null } },
      });
      expect((await page.request.get('/api/vulnerabilites/delais?periode=12')).status()).toBe(422);

      // Onglet « Délais et exceptions ».
      await page.goto('/vulnerabilites/delais');
      await expect(page.getByRole('heading', { name: 'Délais et exceptions', level: 1 })).toBeVisible();
      await expect(
        page
          .getByRole('navigation', { name: 'Rubriques : Vulnérabilités' })
          .getByRole('link', { name: 'Délais et exceptions' }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(page.getByText('48 heures')).toBeVisible();
      for (const t of ['Failles corrigées', 'Délai moyen', 'Délai médian', 'Part dans les délais'])
        await expect(page.locator('th', { hasText: new RegExp(`^${t}$`) })).toBeVisible();
      for (const t of ['Faille', 'Statut', 'Accordée par', 'Justification', 'Mesure compensatoire'])
        await expect(page.locator('th', { hasText: new RegExp(`^${t}$`) })).toBeVisible();
      await expect(page.getByText('Aucune exception, parmi les failles que vous pouvez lire.')).toBeVisible();
      await expect(page.getByText(/Seul le RSSI peut accorder, prolonger ou lever une exception/)).toBeVisible();
      await expect(page.getByText(/Vous ne tenez pas le rôle RSSI/)).toBeVisible();
      // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
      await ouvrirFiltres(page, 'Période');
      await page.getByRole('combobox', { name: 'Période', exact: true }).click();
      await page.getByRole('option', { name: '12 derniers mois', exact: true }).click();
      await ouvrirFiltres(page, 'Période');
      await expect(page.getByRole('combobox', { name: 'Période', exact: true })).toHaveValue('12 derniers mois');
      await ouvrirFiltres(page, 'Statut de l’exception');
      await page.getByRole('combobox', { name: 'Statut de l’exception', exact: true }).click();
      await page.getByRole('option', { name: 'Sans échéance, à compléter', exact: true }).click();
      await expect(page.getByText('Aucune exception, parmi les failles que vous pouvez lire.')).toBeVisible();

      // Failles détectées : filtres « Délai » et tri repris de l'adresse (lien de la tuile et du résumé notifié).
      await page.goto('/vulnerabilites/failles?delai=en_depassement&tri=echeance');
      await expect(page.getByRole('heading', { name: 'Failles détectées', level: 1 })).toBeVisible();
      await ouvrirFiltres(page, 'Délai');
      await expect(page.getByRole('combobox', { name: 'Délai', exact: true })).toHaveValue('En dépassement');
      await ouvrirFiltres(page, 'Trier par');
      await expect(page.getByRole('combobox', { name: 'Trier par', exact: true })).toHaveValue(
        'Échéance de correction',
      );
      await expect(page.locator('th', { hasText: /^Délai$/ }).first()).toBeVisible();
      await expect(page.getByText('Aucune faille détectée ne correspond')).toBeVisible();
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

      // Vue d'ensemble : tuile « En dépassement », vers la liste filtrée.
      await page.goto('/vulnerabilites/vue');
      const tuiles = page.getByRole('navigation', { name: 'Chiffres clés : listes filtrées' });
      await expect(tuiles.getByRole('link', { name: /En dépassement/ })).toHaveAttribute(
        'href',
        '/vulnerabilites/failles?delai=en_depassement&tri=echeance',
      );
      await expect(tuiles.getByRole('link', { name: /En dépassement/ })).toContainText('00');

      // Seuils de priorité : délais par défaut ; une durée hors bornes est refusée avant tout envoi.
      await page.goto('/vulnerabilites/priorite');
      await expect(page.getByRole('heading', { name: 'Délais de correction', level: 2 })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Unité du délai P1', exact: true })).toHaveValue('Heures');
      await expect(page.getByRole('textbox', { name: 'Durée du délai P1', exact: true })).toHaveValue('48');
      await expect(page.getByRole('combobox', { name: 'Unité du délai P4', exact: true })).toHaveValue('Aucun délai');
      await expect(page.getByRole('textbox', { name: 'Durée du délai P4', exact: true })).toBeDisabled();
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
      const p2 = page.getByRole('textbox', { name: 'Durée du délai P2', exact: true });
      await p2.fill('366');
      await expect(page.getByText('P2 : durée entière de 1 à 365 jours.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Enregistrer les délais', exact: true })).toBeDisabled();
      await p2.fill('15');
      await expect(page.getByRole('button', { name: 'Enregistrer les délais', exact: true })).toBeEnabled();
      expect(problems).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
