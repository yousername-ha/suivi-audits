/* Jours de fond derrière les tâches (018-09) : les jours fériés d'un calendrier de plateforme s'affichent derrière les barres
   de la Timeline, par une bascule propre à chaque famille ; masquer le fond ne change rien aux actions. Données fictives. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

const JOUR = 86_400_000;

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.fetch(path, {
    method: 'POST',
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

test('Jours fériés en fond : bascule séparée, Timeline et Calendrier, actions inchangées', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage');
    const suffixe = String(Date.now());
    const maintenant = Date.now();
    const annee = new Date(maintenant).getUTCFullYear();
    const calendrier = await post(page, '/api/calendriers-plateforme', {
      name: 'Fériés de recette ' + suffixe,
      kind: 'feries',
    });
    await post(page, `/api/calendriers-plateforme/${calendrier.id}/feries`, { year: annee, apercu: false });
    const p = await post(page, '/api/grc/smsis', {
      name: 'Périmètre fond ' + suffixe,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    // Une action qui couvre toute l'année : la Timeline contient donc des jours fériés.
    await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'action',
      name: 'Action sur l’année ' + suffixe,
      data: {
        description: 'Action de recette',
        status: 'todo',
        ownerId: null,
        startAt: new Date(Date.UTC(annee, 0, 2)).toISOString(),
        dueAt: new Date(Date.UTC(annee, 11, 30)).toISOString(),
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
    expect(maintenant).toBeGreaterThan(JOUR);

    await page.goto('/pilotage/actions');
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: 'Périmètre fond ' + suffixe, exact: true }).click();
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Timeline', exact: true }).click();
    const frise = page.getByRole('region', { name: /Timeline des actions/ });
    await expect(frise).toBeVisible();
    const bandes = frise.locator('[data-fond="feries"]');
    await expect(bandes).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Jours fériés en fond' }).click();
    await expect(page.getByRole('checkbox', { name: 'Jours fériés en fond' })).toBeChecked();
    await expect(bandes.first()).toBeAttached();
    expect(await bandes.count()).toBeGreaterThanOrEqual(8);
    await expect(page.getByTestId('timeline-fond')).toContainText('férié');
    // L'autre famille reste indépendante : aucune bande « autres ».
    await expect(frise.locator('[data-fond="autres"]')).toHaveCount(0);

    // Masquer le fond ne change rien aux actions : la même action reste placée et ouvrable.
    await page.getByRole('checkbox', { name: 'Jours fériés en fond' }).click();
    await expect(page.getByRole('checkbox', { name: 'Jours fériés en fond' })).not.toBeChecked();
    await expect(bandes).toHaveCount(0);
    await expect(frise.getByRole('button', { name: new RegExp('Action sur l’année ' + suffixe) })).toBeVisible();

    // Calendrier : le jour férié est écrit en toutes lettres dans la case du jour, pas seulement coloré.
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Calendrier', exact: true }).click();
    await page.getByLabel('Mois').fill(`${annee}-12`);
    await page.getByRole('checkbox', { name: 'Jours fériés en fond' }).click();
    await expect(page.getByRole('checkbox', { name: 'Jours fériés en fond' })).toBeChecked();
    await expect(page.getByText(/Férié : /).first()).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
