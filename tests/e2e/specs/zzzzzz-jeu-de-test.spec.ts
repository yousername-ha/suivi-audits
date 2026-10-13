/* Évaluation de la plateforme sur le jeu de données de test fictif (`suivi jeu-de-test`). Ce scénario ne tourne que sur une
   pile dédiée où le jeu a été chargé (E2E_JEU_DE_TEST=1) : la suite complète, elle, part de données vides. Il parcourt les
   écrans repris ou ajoutés par le lot « finalisation » et enregistre une capture de chacun (E2E_CAPTURES_DIR). */
import { expect, test, type Page } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test.skip(!process.env.E2E_JEU_DE_TEST, 'Pile avec jeu de données de test requise (E2E_JEU_DE_TEST=1).');
const DIR = process.env.E2E_CAPTURES_DIR || '/tmp/captures';
const capture = (page: Page, nom: string) => page.screenshot({ path: `${DIR}/${nom}.png`, fullPage: true });

test('jeu de test : menu, objectifs, fournisseurs, PESTEL, boîtes, carte des risques, revue et standards', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    // Menu : pastilles collées aux libellés, rouges quand un indicateur est mauvais ; une seule section dépliée.
    await page.goto('/pilotage/synthese');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.locator('[data-alerte="rouge"]').first()).toBeVisible();
    const objectifs = nav
      .getByRole('link', { name: /^Objectifs et indicateurs/ })
      .or(nav.getByText(/^Objectifs et indicateurs/));
    await expect(nav.locator('.nav-pastille[data-alerte="rouge"]').first()).toHaveAccessibleName(
      /non atteint|échéance/,
    );
    await capture(page, '01-menu-pastilles');
    await nav.getByText('Objectifs et indicateurs', { exact: true }).click();
    await nav.getByText('Fournisseurs', { exact: true }).first().click();
    const ouvertes = nav.locator('.pilotage-nav-group [data-expanded="true"]');
    await expect(nav.locator('.pilotage-nav-group .mantine-NavLink-children').filter({ visible: true })).toHaveCount(1);
    void objectifs;
    void ouvertes;

    // Objectifs : trois vues de l'ancienne interface, fiches, boîtes.
    await page.goto('/pilotage/processus');
    await expect(page.getByText('Processus de management')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvrir le processus PR2', exact: true })).toBeVisible();
    await capture(page, '02-processus');
    await page.getByRole('tab', { name: 'Par objectif' }).click();
    await expect(page.getByText('Maîtriser les accès aux systèmes').first()).toBeVisible();
    await capture(page, '03-par-objectif');
    await page.getByRole('tab', { name: 'Vue compacte' }).click();
    await expect(page.getByRole('button', { name: 'Ouvrir l’indicateur IND1', exact: true })).toBeVisible();
    await capture(page, '04-vue-compacte');
    await page.getByRole('tab', { name: 'Boîtes de pilotage' }).click();
    await expect(page.getByLabel('Boîte du processus PR4')).toContainText('Actions ouvertes : 2');
    await capture(page, '05-boites');
    await page.getByRole('button', { name: 'Ouvrir l’indicateur IND2', exact: true }).first().click();
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByLabel('Quand surveiller')).toBeVisible();
    await expect(fiche.getByText('Surveillance et mesure (ISO 9001:2015, 9.1.1)')).toBeVisible();
    await capture(page, '06-fiche-indicateur');
    await fiche.getByRole('button', { name: 'Fermer', exact: true }).click();
    // Filtre d'état des indicateurs.
    await page.getByRole('button', { name: 'Filtres', exact: true }).click();
    await page.getByRole('tab', { name: 'Non atteints' }).click();
    await page.keyboard.press('Escape');

    // Fournisseurs : colonnes de l'outil historique, filtres, fiche.
    await page.goto('/pilotage/fournisseurs');
    for (const colonne of [
      'Fournisseur ou application',
      'Type',
      'SSO',
      'MFA',
      'Critique',
      'Hébergeur HDS',
      'Certificats',
      'Contrôles',
      'Prochain',
    ])
      await expect(page.getByRole('columnheader', { name: colonne, exact: true })).toBeVisible();
    await expect(page.getByText('SaaS avec MFA')).toBeVisible();
    await capture(page, '07-fournisseurs');
    await page.getByRole('button', { name: 'Filtres', exact: true }).click();
    await page.getByRole('textbox', { name: 'Situation' }).click();
    await page.getByRole('option', { name: 'Sans MFA', exact: true }).click();
    await expect(page.getByText('Logiciel de dossiers fictif')).toBeVisible();
    await expect(page.getByText('Hébergeur de données fictif')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Fiche du fournisseur Logiciel de dossiers fictif/ }).click();
    await expect(page.getByRole('dialog').getByText('MFA non activée.')).toBeVisible();
    await capture(page, '08-fiche-fournisseur');
    await page.keyboard.press('Escape');

    // Contexte : PESTEL, parties intéressées, opportunités.
    await page.goto('/pilotage/pestel');
    await expect(page.getByText('Le PESTEL n’est pas exigé par la norme ISO 9001:2015')).toBeVisible();
    await expect(page.getByLabel('Enjeux internes')).toBeVisible();
    await capture(page, '09-pestel');
    await page.goto('/pilotage/parties');
    await expect(page.getByLabel('Synthèse des parties intéressées')).toContainText('non revues depuis un an');
    await capture(page, '10-parties-interessees');
    await page.goto('/pilotage/opportunites');
    await expect(page.getByText('Ouverture à la téléconsultation')).toBeVisible();
    await capture(page, '11-opportunites');

    // Séries proposées sans fréquence, revue de direction préparée, audits.
    await page.goto('/pilotage/recurrences');
    await expect(page.getByLabel('Séries proposées')).toContainText('Aucune n’est créée d’office');
    await capture(page, '12-series-proposees');
    await page.goto('/pilotage/revues');
    await page.getByRole('button', { name: /Statut des actions décidées lors des revues précédentes/ }).click();
    await expect(page.getByText(/Revue du .* : 1 action décidée/)).toBeVisible();
    await capture(page, '13-revue-entrees');

    // Cartographie des risques : la carte reste dans son cadre (plus d'écran gris).
    await page.goto('/pilotage/carte');
    await expect(page.locator('.grc-risk-canvas .carte-zone')).toBeVisible();
    const cadre = (await page.locator('.grc-risk-canvas').boundingBox())!;
    const zone = (await page.locator('.grc-risk-canvas .carte-zone').boundingBox())!;
    expect(zone.width).toBeLessThanOrEqual(cadre.width + 1);
    expect(zone.height).toBeLessThanOrEqual(cadre.height + 1);
    await capture(page, '14-carte-des-risques');

    // Cartographie du SMSI : calque santé.
    await page.goto('/cartographie');
    await expect(page.getByText('Calques')).toBeVisible();
    await page.getByLabel('Santé des indicateurs').check({ force: true });
    await capture(page, '15-cartographie-sante');

    // Bibliothèque : standards d'emblée, sans alerte rouge.
    await page.goto('/pilotage/bibliotheque');
    await expect(page.getByText('Référentiel fictif de démonstration')).toBeVisible();
    await expect(page.getByText('Version source verrouillée').first()).toBeVisible();
    await capture(page, '16-bibliotheque');

    // Tableau de bord et état du pilotage après le jeu de test.
    await page.goto('/');
    await capture(page, '17-tableau-de-bord');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
