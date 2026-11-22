/* Module Vulnérabilités (ADR 0100, lot PC3) : onglet « Périmètres », de bout en bout, sans capture de référence. Lecture
   seule : le parcours n'écrit rien (ni périmètre, ni préférence, ni donnée), la pile reste dans son état initial. Il ne
   dépend d'aucune donnée de Tenable ni d'AlgoLightHouse (pile vierge : aucune machine) ni de la planification : il ne
   compte pas les cartes des périmètres créés par d'autres parcours et ne regarde que la carte « Sans périmètre »
   (administrateur du module). Menu, route de lecture, carte au clavier, adresse partageable, présentations « Par ligne »
   et « Vue globale », périmètre inconnu, accessibilité en clair et en sombre, CSP. Les cartes et tuiles avec des données,
   la mention « Exposée sur Internet » et les bornes sont couvertes par les tests de l'interface et de l'API
   (apps/web/test/vulnerabilites-perimetres.test.ts, apps/api/test/vulnerabilites-perimetres.test.ts). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

for (const [mode, scheme] of [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const)
  test(`Vulnérabilités : onglet « Périmètres », liste et détail (${mode})`, async ({ browser }) => {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'fr-FR',
      viewport: { width: 1366, height: 900 },
      colorScheme: scheme,
      storageState: (await sessionAdmin(browser)).state,
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    const axe = async () => {
      // Après un changement de page, d'onglet ou de présentation : même attente que zzzzz-accessibilite.
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    };
    try {
      // Route de lecture : carte « Sans périmètre » pour l'administrateur, détail « aucun » ; périmètre inconnu : 404.
      const r = await page.request.get('/api/vulnerabilites/machines/perimetres');
      expect(r.status()).toBe(200);
      const liste = await r.json();
      expect(Array.isArray(liste.perimetres)).toBe(true);
      expect(liste.sansPerimetre).toMatchObject({ id: null, nom: null });
      const d = await page.request.get('/api/vulnerabilites/machines/perimetres/aucun');
      expect(d.status()).toBe(200);
      expect((await d.json()).parc.zones.map((z: { zone: string }) => z.zone)).toEqual([
        'front',
        'back',
        'bdd',
        'aucun',
      ]);
      expect(
        (
          await page.request.get('/api/vulnerabilites/machines/perimetres/00000000-0000-4000-8000-00000000dead')
        ).status(),
      ).toBe(404);

      // Onglet après « Machines », liste des cartes.
      await page.goto('/vulnerabilites/perimetres');
      await expect(page.getByRole('heading', { name: 'Périmètres', level: 1 })).toBeVisible();
      const onglets = page.getByRole('navigation', { name: 'Rubriques : Vulnérabilités' });
      await expect(onglets.getByRole('link', { name: 'Périmètres', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      const liens = await onglets.getByRole('link').allTextContents();
      expect(liens.indexOf('Périmètres')).toBe(liens.indexOf('Machines') + 1);
      const sans = page.getByRole('button', { name: /^Sans périmètre : / });
      await expect(sans).toBeVisible();
      await expect(page.getByRole('list', { name: 'Périmètres, du plus critique au moins critique' })).toBeVisible();
      await axe();

      // Détail au clavier (Entrée sur la carte) : adresse partageable, présentation « Par ligne » par défaut.
      await sans.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/vulnerabilites\/perimetres\?perimetre=aucun$/);
      await expect(page.getByRole('heading', { name: 'Sans périmètre', level: 1 })).toBeVisible();
      for (const zone of ['Front', 'Back applicatif', 'Base de données', 'Rôle non indiqué'])
        await expect(page.getByRole('heading', { name: zone, level: 3, exact: true })).toBeVisible();
      await expect(page.getByText('Frontière front · back', { exact: true })).toBeVisible();
      await expect(page.getByText('Frontière back · bases', { exact: true })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Chiffres clés du périmètre' })).toContainText(
        'Machines du périmètre',
      );
      await expect(page.getByText(/aucun trait ne relie deux machines/)).toBeVisible();
      await axe();

      // « Vue globale » : toutes les machines ensemble ; l'adresse la garde, le rechargement aussi.
      await page
        .getByRole('group', { name: 'Présentation du périmètre' })
        .getByRole('button', { name: 'Vue globale', exact: true })
        .click();
      await expect(page).toHaveURL(/presentation=global/);
      await expect(page.getByRole('heading', { name: 'Machines du périmètre', level: 3 })).toBeVisible();
      await expect(page.getByText('Frontière front · back', { exact: true })).toHaveCount(0);
      await axe();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Machines du périmètre', level: 3 })).toBeVisible();

      // Retour à la liste ; périmètre inconnu : message, sans rien nommer.
      await page.getByRole('link', { name: 'Tous les périmètres', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Périmètres', level: 1 })).toBeVisible();
      await page.goto('/vulnerabilites/perimetres?perimetre=00000000-0000-4000-8000-00000000dead');
      await expect(page.getByText('Périmètre introuvable ou non accessible.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Tous les périmètres', exact: true })).toBeVisible();
      expect(problems).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
