/* Pilotage SMSI (lot U2, FCT-019, FCT-028, FCT-030, FCT-038) : données de l'outil de suivi présentées dans le Pilotage
   sans copie — DdA, objectifs par processus, plans historiques et graphiques de la synthèse. Données de la fixture
   anonymisée importée par le parcours « import legacy ». */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Pilotage : DdA historique, objectifs par processus, plans et graphiques de la synthèse', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage');
    // Les fiches de pilotage du périmètre de l'instance sont relues depuis l'outil de suivi.
    await page.evaluate(() => sessionStorage.setItem('pilotage-scope', '00000000-0000-4000-8000-000000000001'));
    const etat = await (await page.request.get('/api/legacy/state')).json();

    // Synthèse : graphiques issus des mêmes calculs que le tableau de bord.
    await page.goto('/pilotage/synthese');
    await expect(page.getByRole('img', { name: /^Indicateurs/ })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Légende : Indicateurs' })).toBeVisible();

    // Applicabilité : exigences de la DdA historique, sans copie.
    const dda = await (
      await page.request.get('/api/grc/00000000-0000-4000-8000-000000000001/pilotage/legacy/dda')
    ).json();
    expect(dda.total).toBeGreaterThan(0);
    await page.goto('/pilotage/applicabilite');
    await expect(page.getByText(dda.items[0].name).first()).toBeVisible();

    // Objectifs : vues « Par processus » et « Vue compacte ».
    await page.goto('/pilotage/objectifs');
    await expect(page.getByRole('tab', { name: 'Par processus' })).toBeVisible();
    if ((etat.objectives ?? []).length) {
      await page.getByRole('tab', { name: 'Vue compacte' }).click();
      const compacte = page.getByRole('region', { name: 'Objectifs, vue compacte' });
      for (const o of etat.objectives) await expect(compacte).toContainText(o.id);
    }

    // Audits internes et exercices : programme et plan de l'outil de suivi, modifiables ici (clé `plans`).
    await page.goto('/pilotage/audits');
    await expect(page.getByText("Programme d'audit interne", { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Planifier dans l’outil historique' })).toHaveCount(0);
    await page.goto('/pilotage/exercices');
    await expect(page.getByText('Plan d’exercices PRA et crise', { exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
