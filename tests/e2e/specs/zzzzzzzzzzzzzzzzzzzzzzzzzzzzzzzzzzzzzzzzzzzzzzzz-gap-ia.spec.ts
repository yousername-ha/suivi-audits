/* GAP IA ISO 27001 / HDS (ADR 0064) : questionnaire par cas d'usage réel (les questions d'un cas n'apparaissent que s'il est
   choisi), points pré-évalués sur des faits, plan d'action créé. Données fictives créées par ce test. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('GAP IA : questions par cas d’usage, points pré-évalués, plan d’action', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const nom = 'Usage de l’IA fictif ' + Date.now();
  try {
    await page.goto('/pilotage/gap-applications');
    await page.getByRole('button', { name: 'Nouveau GAP IA' }).click();
    const guide = page.getByRole('dialog', { name: 'Nouveau GAP IA' });
    await expect(guide).toBeVisible();

    // Aucune question de cas d'usage avant d'en avoir choisi un.
    await expect(guide.getByText('Quels comptes les agents utilisent-ils')).toHaveCount(0);
    await guide.getByRole('button', { name: 'Outils d’IA grand public utilisés par les agents' }).click();
    const comptes = guide.getByRole('group', { name: /Quels comptes les agents utilisent-ils/ });
    await expect(comptes).toBeVisible();
    await comptes.getByRole('button', { name: 'Comptes personnels', exact: true }).click();
    await guide
      .getByRole('group', { name: /filtrés ou supervisés/ })
      .getByRole('button', { name: 'Non', exact: true })
      .click();

    // Un cas décoché fait disparaître ses questions.
    await guide.getByRole('button', { name: 'Code généré par IA' }).click();
    await expect(guide.getByRole('group', { name: /relecture et les tests de sécurité/ })).toBeVisible();
    await guide.getByRole('button', { name: 'Code généré par IA' }).click();
    await expect(guide.getByRole('group', { name: /relecture et les tests de sécurité/ })).toHaveCount(0);

    const intitule = guide.getByLabel('Intitulé du GAP');
    await intitule.fill(nom);
    await intitule.blur();
    await guide.getByRole('button', { name: 'Générer le GAP' }).click();

    // La fiche s'ouvre : points propres au GAP IA (pas de socle d'application), écarts pré-évalués.
    const fiche = page.getByRole('dialog').filter({ hasText: nom });
    await expect(fiche).toBeVisible();
    await expect(fiche.getByText('Maîtrise de l’IA', { exact: true })).toBeVisible();
    await expect(
      fiche.getByText('Empêcher la saisie de données sensibles dans les outils d’IA grand public'),
    ).toBeVisible();
    await expect(fiche.getByText('Inclure l’application dans le domaine d’application du SMSI')).toHaveCount(0);
    await expect(fiche.getByText('Non conforme').first()).toBeVisible();
    // Les fenêtres n'ont pas de bouton « Fermer » : Échap les ferme.
    await page.keyboard.press('Escape');
    await expect(fiche).toHaveCount(0);

    // Dans la liste, le GAP est repéré comme GAP IA.
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await expect(ligne).toContainText('GAP IA');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
