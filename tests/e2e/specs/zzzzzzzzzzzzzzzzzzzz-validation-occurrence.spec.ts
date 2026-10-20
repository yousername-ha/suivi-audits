/* Occurrence d'une tâche récurrente : validation KO motivée, journal immuable, réouverture motivée. Données fictives.
   L'automate génère l'occurrence à sa prochaine passe (une par minute). */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}

test('Tâches récurrentes : occurrence validée KO avec compte rendu, puis rouverte avec motif', async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre récurrence ${suffixe}`,
    titre = `Contrôle récurrent ${suffixe}`;
  try {
    await page.goto('/pilotage/recurrences');
    const p = await post(page, '/api/grc/smsis', {
      name: perimetre,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    const serie = await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'task_series',
      name: titre,
      data: {
        description: 'Contrôle périodique de recette',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'month',
          interval: 1,
          until: null,
          count: 1,
          reminderDays: 7,
          active: true,
        },
      },
    });
    // L'occurrence apparaît à la prochaine passe de l'automate.
    await expect
      .poll(
        async () => (await (await page.request.get(`/api/grc/${p.id}/series/${serie.id}/occurrences`)).json()).length,
        { timeout: 150_000, intervals: [5_000] },
      )
      .toBeGreaterThan(0);

    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Liste', exact: true }).click();
    await page.getByRole('button', { name: titre, exact: true }).first().click();

    const fiche = page.getByRole('dialog');
    const panneau = fiche.getByRole('group', { name: 'Validation de l’occurrence' });
    await expect(panneau.getByText('À valider', { exact: true })).toBeVisible();
    // Un KO sans compte rendu n'est pas accepté ; avec compte rendu, il l'est.
    await panneau.getByRole('combobox', { name: 'Résultat' }).click();
    await page.getByRole('option', { name: 'Non réalisée (KO)' }).click();
    await expect(panneau.getByRole('button', { name: 'Enregistrer la validation' })).toBeDisabled();
    await panneau.getByLabel('Compte rendu').fill('Contrôle non réalisé faute de ressource.');
    await panneau.getByRole('button', { name: 'Enregistrer la validation' }).click();
    await expect(panneau.getByText('Validée', { exact: true })).toBeVisible();
    await expect(panneau.getByRole('cell', { name: 'Non réalisée (KO)' })).toBeVisible();
    // Une occurrence validée ne se valide plus : seule la réouverture motivée est proposée.
    await expect(panneau.getByRole('button', { name: 'Enregistrer la validation' })).toHaveCount(0);
    await panneau.getByLabel('Motif de la réouverture').fill('Ressource disponible, contrôle à refaire.');
    await panneau.getByRole('button', { name: 'Rouvrir l’occurrence' }).click();
    await expect(panneau.getByText('Rouverte, à valider', { exact: true })).toBeVisible();
    // Le journal garde les deux événements.
    await expect(panneau.getByRole('cell', { name: 'Réouverture' })).toBeVisible();
    await expect(panneau.getByRole('cell', { name: 'Non réalisée (KO)' })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
