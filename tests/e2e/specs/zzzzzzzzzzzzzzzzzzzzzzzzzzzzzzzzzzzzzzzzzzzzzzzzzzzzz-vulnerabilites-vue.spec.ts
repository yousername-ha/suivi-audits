/* Module Vulnérabilités (ADR 0100, lot PC1) : « Vue d'ensemble », premier onglet et adresse d'accueil du module, de bout en
   bout, sans capture de référence. La pile de test n'a aucune faille (ni Tenable, ni veille, ni AlgoLightHouse) : niveau 1
   (Veille), radar vide (aucun point inventé), aucune alerte critique donc aucun bandeau ; la pile reste dans son état
   initial (lecture seule). Le radar avec des points, son clavier et ses pastilles sont couverts par les tests de l'interface
   (apps/web/test/vulnerabilites-radar.test.ts, vulnerabilites-vue-ensemble.test.ts) et un banc de rendu local. Menu,
   redirection, route de lecture, tuiles, tableau, capteurs, accessibilité en clair et en sombre, CSP. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

for (const [mode, scheme] of [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const)
  test(`Vulnérabilités : vue d’ensemble sur une pile sans faille (${mode})`, async ({ browser }) => {
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
      // Route de lecture : niveau 1, aucune faille suivie, bornes respectées.
      const r = await page.request.get('/api/vulnerabilites/vue-ensemble');
      expect(r.status()).toBe(200);
      expect(await r.json()).toMatchObject({
        niveau: { niveau: 1, libelle: 'Veille' },
        total: 0,
        cibles: [],
        cases: [],
        tronquee: false,
      });

      // Adresse d'accueil du module : redirection vers la vue d'ensemble, premier onglet, lien du menu.
      await page.goto('/vulnerabilites');
      await expect(page).toHaveURL(/\/vulnerabilites\/vue$/);
      await expect(page.getByRole('heading', { name: 'Vue d’ensemble', level: 1 })).toBeVisible();
      const onglets = page.getByRole('navigation', { name: 'Rubriques : Vulnérabilités' });
      await expect(onglets.getByRole('link').first()).toHaveText('Vue d’ensemble');
      await expect(onglets.getByRole('link', { name: 'Vue d’ensemble' })).toHaveAttribute('aria-current', 'page');
      await expect(
        page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Vulnérabilités' }),
      ).toHaveAttribute('href', '/vulnerabilites/vue');

      // Niveau d'alerte, radar vide, aucun bandeau d'alerte critique.
      const niveau = page.getByRole('region', { name: 'Niveau d’alerte' });
      await expect(niveau).toContainText('Veille');
      await expect(niveau).toContainText('à confirmer par le RSSI');
      await expect(page.getByText('Radar vide : aucune faille suivie.')).toBeVisible();
      await expect(page.getByText(/Une faille exploitée est présente chez nous/)).toHaveCount(0);
      await expect(page.getByRole('alertdialog')).toHaveCount(0);

      // Tuiles : liens vers les listes filtrées.
      const tuiles = page.getByRole('navigation', { name: 'Chiffres clés : listes filtrées' });
      await expect(tuiles.getByRole('link', { name: /Exploitées et présentes/ })).toHaveAttribute(
        'href',
        '/vulnerabilites/alertes?niveau=critique',
      );
      await expect(tuiles.getByRole('link', { name: 'P1 : 0', exact: true })).toHaveAttribute(
        'href',
        '/vulnerabilites/failles?priorite=P1',
      );

      // Tableau « Cibles par priorité » et capteurs (deux listes distinctes).
      for (const t of ['Priorité', 'Faille et produit', 'Faits', 'EPSS', 'État', 'Responsable'])
        await expect(page.locator('th', { hasText: new RegExp(`^${t}$`) })).toBeVisible();
      await expect(page.getByText('Aucune faille suivie ne correspond.')).toBeVisible();
      await page
        .getByRole('radiogroup', { name: 'Filtre des cibles' })
        .getByText('Exploitées', { exact: true })
        .click();
      await expect(page.getByText('Aucune faille suivie ne correspond.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Capteurs : sources de veille et connecteurs' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Sources de veille', level: 3 })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Connecteurs', level: 3 })).toBeVisible();

      // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

      // Tuile vers « Failles détectées » : la liste s'ouvre déjà filtrée sur la priorité.
      await tuiles.getByRole('link', { name: 'P1 : 0', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Failles détectées', level: 1 })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Priorité', exact: true })).toHaveValue('P1');
      expect(problems).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
