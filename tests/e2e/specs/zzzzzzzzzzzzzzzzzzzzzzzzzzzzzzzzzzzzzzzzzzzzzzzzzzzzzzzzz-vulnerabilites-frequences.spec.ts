/* Module Vulnérabilités (ADR 0100, lot F1) : fréquence de synchronisation réglable, de bout en bout, sans capture de
   référence (aucune n'est approuvée sans relecture). Écran « Veille » : fréquence d'une source changée par la liste
   déroulante puis relue, NVD sans « toutes les heures » et son avertissement relié au champ, EPSS fixe ; carte
   « Intégrations » de la Plateforme : avertissement d'un connecteur affiché AVANT tout enregistrement (rien n'est créé) ;
   accessibilité en clair et en sombre. Le flux de la veille n'est pas ouvert : aucune source réelle n'est jointe, et aucune
   assertion ne dépend d'une collecte (le tic de l'API passe chaque minute). La fréquence changée est remise à sa valeur par
   défaut dans `finally`. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const KEV = 'Fréquence de la source Catalogue des failles exploitées (KEV)';
const NVD = 'Fréquence de la source Base nationale des vulnérabilités (NVD)';

/** Remet la fréquence de KEV à sa valeur par défaut (deux heures), par l'API, avec la version lue. */
async function remettreKev(page: Page, csrf: string) {
  const etat = (await (await page.request.get('/api/vulnerabilites/veille/etat')).json()) as {
    sources: { source: string; frequenceHeures: number; version: number }[];
  };
  const kev = etat.sources.find((s) => s.source === 'cisa-kev')!;
  if (kev.frequenceHeures === 2) return;
  const r = await page.request.put('/api/vulnerabilites/veille/sources/cisa-kev/frequence', {
    data: { frequenceHeures: 2 },
    headers: { 'x-csrf-token': csrf, 'if-match': `"${kev.version}"` },
  });
  expect(r.status(), await r.text()).toBe(200);
}

for (const [mode, scheme, largeur] of [
  ['clair', 'light', 1366],
  ['sombre', 'dark', 390],
] as const)
  test(`Fréquences (lot F1) : veille réglée par source, avertissement d’un connecteur avant d’enregistrer (${mode}, ${largeur} px)`, async ({
    browser,
  }) => {
    const admin = await sessionAdmin(browser);
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'fr-FR',
      colorScheme: scheme,
      viewport: { width: largeur, height: 900 },
      storageState: admin.state,
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    try {
      // Veille : fréquence par source, avertissement de NVD, EPSS fixe, prochaine collecte (veille fermée : aucune).
      await page.goto('/vulnerabilites/veille');
      await expect(page.getByRole('heading', { name: 'Veille', level: 1 })).toBeVisible();
      const sources = page.getByRole('region', { name: 'Sources de la veille' });
      await expect(sources.getByRole('cell', { name: 'Fréquence', exact: true })).toBeVisible();
      const kev = sources.getByRole('combobox', { name: KEV, exact: true });
      await expect(kev).toHaveValue('2');
      const nvd = sources.getByRole('combobox', { name: NVD, exact: true });
      await expect(nvd.locator('option')).toHaveText([
        'Toutes les 2 heures',
        'Toutes les 4 heures',
        'Toutes les 12 heures',
        'Une fois par jour',
      ]);
      await expect(nvd).toHaveAccessibleDescription(/NVD demande de ne pas être lu automatiquement/);
      await expect(sources.getByRole('combobox', { name: /EPSS/ })).toHaveCount(0);
      await expect(sources).toContainText('Une fois par jour (fixe)');
      await expect(sources).toContainText('Les scores EPSS ne sont publiés qu’une fois par jour');
      await expect(sources).toContainText('aucune (veille désactivée)');

      await kev.selectOption('4');
      await expect(page.getByText('Catalogue des failles exploitées (KEV) : toutes les 4 heures.')).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole('region', { name: 'Sources de la veille' }).getByRole('combobox', { name: KEV, exact: true }),
      ).toHaveValue('4');
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

      // Carte « Intégrations » : avertissement dès le choix, avant d'enregistrer ; rien n'est créé.
      await page.goto('/plateforme/integrations');
      await expect(page.getByRole('dialog', { name: 'Intégrations', exact: true })).toBeVisible();
      await page
        .getByRole('region', { name: 'Tenable Security Center' })
        .getByRole('button', { name: 'Ajouter une instance' })
        .click();
      const ajout = page.getByRole('dialog', { name: 'Ajouter : Tenable Security Center' });
      const frequence = ajout.getByRole('combobox', {
        name: 'Fréquence de la synchronisation automatique',
        exact: true,
      });
      await expect(frequence).toHaveValue('24');
      await expect(ajout.getByText('Attention :')).toHaveCount(0);
      await frequence.selectOption('6');
      await expect(ajout.getByText(/charge supplémentaire sur Security Center/)).toBeVisible();
      await expect(frequence).toHaveAccessibleDescription(/Attention : En dessous de 24 heures/);
      // Avertissement, pas blocage : le bouton reste actif.
      await expect(ajout.getByRole('button', { name: 'Créer l’instance' })).toBeEnabled();
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
      await frequence.selectOption('168');
      await expect(ajout.getByText(/charge supplémentaire sur Security Center/)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(ajout).toBeHidden();
      expect(problems).toEqual([]);
    } finally {
      try {
        await remettreKev(page, admin.csrf);
      } catch {
        // Le ménage ne masque pas l'échec d'origine.
      }
      await ctx.close();
    }
  });
