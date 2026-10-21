/* Écran des tâches (dossiers 017 et 018) : filtre par registre et filtres conservés dans l'adresse (retour, rechargement).
   Données fictives. */
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
const action = (name: string, registreId: string) => ({
  kind: 'action',
  name,
  registreId,
  data: {
    description: '',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: null,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
});

test('Tâches : filtre par registre, conservé après rechargement', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre filtres ${suffixe}`,
    planA = `Plan A ${suffixe}`,
    planB = `Plan B ${suffixe}`;
  try {
    await page.goto('/pilotage/actions');
    const p = await post(page, '/api/grc/smsis', {
      name: perimetre,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    const a = await post(page, '/api/registres', { kind: 'plan_actions', name: planA, referenceId: p.id });
    const b = await post(page, '/api/registres', { kind: 'plan_actions', name: planB, referenceId: p.id });
    await post(page, `/api/grc/${p.id}/objects`, action(`Action du plan A ${suffixe}`, a.id));
    await post(page, `/api/grc/${p.id}/objects`, action(`Action du plan B ${suffixe}`, b.id));

    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Liste', exact: true }).click();
    await expect(page.getByRole('button', { name: `Action du plan A ${suffixe}` }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: `Action du plan B ${suffixe}` }).first()).toBeVisible();

    await page.getByRole('combobox', { name: 'Registre', exact: true }).click();
    await page.getByRole('option', { name: planA, exact: true }).click();
    await expect(page.getByRole('button', { name: `Action du plan B ${suffixe}` })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Action du plan A ${suffixe}` }).first()).toBeVisible();
    await expect(page).toHaveURL(/treg=/);

    // Le filtre est dans l'adresse : il survit au rechargement.
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Registre', exact: true })).toHaveValue(planA);
    await expect(page.getByRole('button', { name: `Action du plan A ${suffixe}` }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: `Action du plan B ${suffixe}` })).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
