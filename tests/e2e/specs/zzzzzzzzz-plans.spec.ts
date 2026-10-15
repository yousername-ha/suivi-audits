/* Plans du SMSI repris de l'outil de suivi (clé `plans`) : plan de formation, calendrier, planning annuel (SVG, décalage
   au clavier), exercice et action du registre des écarts. Données fictives. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Plans : action de formation créée, calendrier, planning décalé au clavier, exercice vers le registre des écarts', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const annee = new Date().getFullYear(),
    suffixe = Date.now().toString(36),
    titre = `Accueil des arrivants ${suffixe}`;
  try {
    // Plan de formation : ajout, saisie, enregistrement.
    await page.goto('/pilotage/plans-formation');
    await expect(page.getByText('Plan de formation', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByText(/^PL-FOR-\d{3}/).first()).toBeVisible();
    await fiche.getByRole('textbox', { name: 'Intitulé de l’action' }).fill(titre);
    await fiche.getByLabel('Date prévue').fill(`${annee}-03-10`);
    await fiche.getByLabel('Responsable').fill('Responsable fictif');
    await fiche.getByLabel('Participants prévus').fill('12');
    await fiche.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(fiche.getByText('Modifications enregistrées.')).toBeVisible();
    await fiche.getByRole('button', { name: 'Fermer' }).click();
    const liste = page.getByRole('region', { name: 'Plan de formation' });
    await expect(liste.getByText(titre)).toBeVisible();
    await expect(liste.getByText(`Planifié`).or(liste.getByText('En retard')).first()).toBeVisible();

    // Calendrier : l'action est placée dans son mois, une pastille ouvre la fiche.
    await page.goto('/pilotage/plans-calendrier');
    const calendrier = page.getByRole('region', { name: `Calendrier des plans ${annee}` });
    await calendrier.getByRole('button', { name: new RegExp(titre) }).click();
    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Intitulé de l’action' })).toHaveValue(titre);
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();

    // Planning annuel : la barre se décale d'un jour avec la flèche droite.
    await page.goto('/pilotage/plans-planning');
    const svg = page.getByRole('group', { name: `Planning des plans ${annee}` });
    const barre = svg.getByRole('button', { name: new RegExp(titre) });
    await barre.focus();
    const decale = page.waitForResponse((r) => /\/api\/plans\/PL-FOR-\d+\/decalage$/.test(r.url()) && r.ok());
    await barre.press('ArrowRight');
    await decale;
    await barre.press('Enter');
    await expect(page.getByRole('dialog').getByLabel('Date prévue')).toHaveValue(`${annee}-03-11`);
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
    await page.screenshot({ path: 'test-results/plans-planning.png', fullPage: true });

    // Exercice : fiche, puis action créée dans le registre des écarts.
    await page.goto('/pilotage/exercices');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const exo = page.getByRole('dialog');
    await exo.getByRole('textbox', { name: 'Intitulé de l’action' }).fill(`Exercice fictif ${suffixe}`);
    await exo.getByRole('textbox', { name: 'Retour d’expérience (RETEX)' }).fill('Retour fictif de recette');
    await exo.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(exo.getByText('Modifications enregistrées.')).toBeVisible();
    await exo.getByRole('button', { name: 'Créer une action dans le registre des écarts' }).click();
    await expect(exo.getByText(/Action EXO-\d+ créée dans le registre des écarts\./)).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
