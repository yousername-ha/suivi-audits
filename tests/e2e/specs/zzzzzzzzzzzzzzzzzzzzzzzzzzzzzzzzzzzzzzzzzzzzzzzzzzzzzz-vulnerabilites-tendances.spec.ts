/* Module Vulnérabilités (ADR 0100, lot S2) : tendances et rapport de pilotage de bout en bout, sans capture de référence. La
   pile de test n'a aucune faille : niveau 1, aucune faille critique, aucune exception, aucune alerte. Le tic de l'API (toutes
   les minutes) prend l'instantané du jour : il peut apparaître pendant le parcours, qui accepte donc « aucun instantané
   encore » comme « historique depuis le … » et ne compte aucun point. Le parcours ne modifie aucune donnée ; produire le
   rapport (JSON puis CSV) inscrit deux entrées au journal d'audit, en ajout seul par conception. Onglet « Tendances »
   (période, périmètre, courbes et tableaux), rapport (production, impression : ni menu ni bouton, export CSV), variation sur
   sept jours de la vue d'ensemble, accessibilité en clair et en sombre, 1366 et 390 px, CSP. Calculs, instantanés, droits et
   non-fuite : tests du paquet partagé et de l'API. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ouvrirFiltres, sessionAdmin, watchPage } from '../helpers';

const axe = async (page: Page) => {
  // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
  await page.waitForTimeout(400);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
};
/** Jour civil (AAAA-MM-JJ) d'un horodatage, heure de Paris : même calcul que le jour des instantanés (`aujourdhui`,
    apps/api/src/vulnerabilites/suivi.ts). */
const jourDeParis = (horodatage: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(horodatage));
const sansDebordement = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );

for (const [mode, scheme] of [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const)
  test(`Vulnérabilités : tendances et rapport de pilotage sur une pile sans faille (${mode})`, async ({ browser }) => {
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
      // Route de lecture : toute la plateforme, 30 points ; historique vide, ou commencé par le tic de l'API entre le jour
      // de création de la pile (première migration appliquée, heure de Paris) et le jour de la lecture (`au`, même
      // réponse) : jamais avant la pile. Comparer au jour courant échouait quand le passage franchit minuit, heure de Paris
      // (pile créée à 23 h 39, lecture à 0 h 05).
      const r = await page.request.get('/api/vulnerabilites/tendances');
      expect(r.status()).toBe(200);
      const v = (await r.json()) as {
        au: string;
        depuis: string | null;
        jours: { jour: string; niveau: number | null }[];
      };
      expect(v).toMatchObject({ periode: 30, granularite: 'jour', perimetre: { id: null, aucun: false } });
      expect(v.jours).toHaveLength(30);
      if (v.depuis !== null) {
        const systeme = await page.request.get('/api/admin/systeme');
        expect(systeme.status()).toBe(200);
        const appliquees = ((await systeme.json()) as { migrations: { applied_at: string }[] }).migrations
          .map((m) => m.applied_at)
          .sort();
        expect(appliquees.length).toBeGreaterThan(0);
        const creation = jourDeParis(appliquees[0]!);
        expect(
          creation <= v.depuis && v.depuis <= v.au,
          `historique depuis le ${v.depuis}, pile créée le ${creation}, lu le ${v.au}`,
        ).toBe(true);
        // Même réponse : aucun point avant le premier instantané.
        for (const j of v.jours) if (j.jour < v.depuis) expect(j.niveau, j.jour).toBeNull();
      }
      expect((await page.request.get('/api/vulnerabilites/tendances?periode=45')).status()).toBe(422);
      expect(
        (
          await page.request.get('/api/vulnerabilites/tendances?perimetre=00000000-0000-4000-8000-00000000dead')
        ).status(),
      ).toBe(404);

      // Onglet « Tendances ».
      await page.goto('/vulnerabilites/tendances');
      await expect(page.getByRole('heading', { name: 'Tendances', level: 1 })).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: 'Rubriques : Vulnérabilités' }).getByRole('link', { name: 'Tendances' }),
      ).toHaveAttribute('aria-current', 'page');
      await ouvrirFiltres(page, 'Période');
      await expect(page.getByRole('combobox', { name: 'Période', exact: true })).toHaveValue('30 jours, jour par jour');
      await ouvrirFiltres(page, 'Périmètre');
      await expect(page.getByRole('combobox', { name: 'Périmètre', exact: true })).toHaveValue('Toute la plateforme');
      await expect(page.getByText(/^(Historique depuis le|Aucun instantané encore)/)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Failles présentes par priorité', level: 2 })).toBeVisible();
      await expect(page.getByRole('img', { name: /^Niveau d’alerte de la plateforme, jour par jour/ })).toBeVisible();
      for (const t of ['Jour', 'Failles présentes en P1', 'Failles en dépassement de délai', 'Niveau d’alerte'])
        await expect(page.locator('th', { hasText: new RegExp(`^${t}$`) }).first()).toBeVisible();
      await expect(page.getByText(/se lisent par périmètre/)).toBeVisible();
      await expect(page.getByText(/à confirmer par le RSSI/).first()).toBeVisible();
      await axe(page);
      await ouvrirFiltres(page, 'Période');
      await page.getByRole('combobox', { name: 'Période', exact: true }).click();
      await page.getByRole('option', { name: '13 semaines', exact: true }).click();
      await expect(page.locator('th', { hasText: /^Semaine$/ }).first()).toBeVisible();
      await axe(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await sansDebordement(page);
      await axe(page);
      await page.setViewportSize({ width: 1366, height: 900 });

      // Vue d'ensemble : variation sur sept jours (aucune encore sur une pile neuve), lien vers les tendances.
      await page.goto('/vulnerabilites/vue');
      await expect(page.getByRole('heading', { name: 'Sur 7 jours', level: 2 })).toBeVisible();

      // Rapport de pilotage : production, document, impression, CSV.
      await page.goto('/vulnerabilites/rapport');
      await expect(page.getByRole('heading', { name: 'Rapport de pilotage', level: 1 })).toBeVisible();
      await ouvrirFiltres(page, 'Mois');
      await expect(page.getByRole('combobox', { name: 'Mois', exact: true })).toBeVisible();
      await axe(page);
      await page.getByRole('button', { name: 'Produire le rapport', exact: true }).click();
      const doc = page.getByRole('article', { name: 'Rapport de pilotage des vulnérabilités' });
      await expect(
        doc.getByRole('heading', { name: 'Rapport de pilotage des vulnérabilités', level: 1 }),
      ).toBeVisible();
      await expect(doc.getByText(/^Document produit par la plateforme le/)).toBeVisible();
      await expect(doc.getByText('Aucune faille présente en P1.')).toBeVisible();
      for (const t of ['CVE', 'Priorité', 'Délai cible', 'Statut', 'Mesure compensatoire', 'Semaine du'])
        await expect(doc.locator('th', { hasText: new RegExp(`^${t}$`) }).first()).toBeVisible();
      await axe(page);
      // À l'impression : ni menu, ni en-tête, ni bouton ; le document seul.
      await page.emulateMedia({ media: 'print' });
      await expect(doc).toBeVisible();
      await expect(page.getByRole('button', { name: 'Produire le rapport', exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true })).toBeHidden();
      await expect(page.locator('.shell-nav')).toBeHidden();
      await expect(page.locator('.shell-header')).toBeHidden();
      await page.emulateMedia({ media: 'screen' });
      const [fichier] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Télécharger les tableaux (CSV)', exact: true }).click(),
      ]);
      expect(fichier.suggestedFilename()).toMatch(/^rapport-vulnerabilites-\d{4}-\d{2}-01-\d{4}-\d{2}-\d{2}\.csv$/);
      await page.setViewportSize({ width: 390, height: 844 });
      await sansDebordement(page);
      await axe(page);
      expect(problems).toEqual([]);
    } finally {
      await page.emulateMedia({ media: 'screen' }).catch(() => undefined);
      await ctx.close();
    }
  });
