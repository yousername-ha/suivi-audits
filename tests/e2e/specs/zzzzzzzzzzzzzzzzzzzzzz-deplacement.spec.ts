/* Registres : éléments filtrés par périmètre et registres, puis déplacement d'une action vers un autre registre avec
   aperçu de l'impact et motif. Données fictives. */
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
const perimetre = (nom: string) => ({
  name: nom,
  nature: 'SMSI',
  scope: 'Fixture de recette',
  timezone: 'Europe/Paris',
  parentId: null,
  entityKind: 'perimetre',
  inheritFrameworks: false,
});

test('Registres : liste filtrée par périmètre et registres, puis déplacement d’une action avec aperçu', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    nomA = `Périmètre dépl. A ${suffixe}`,
    nomB = `Périmètre dépl. B ${suffixe}`,
    titre = `Action à déplacer ${suffixe}`;
  try {
    await page.goto('/registres');
    const a = await post(page, '/api/grc/smsis', perimetre(nomA));
    const b = await post(page, '/api/grc/smsis', perimetre(nomB));
    const r1 = await post(page, '/api/registres', {
      kind: 'plan_actions',
      name: `Plan A ${suffixe}`,
      referenceId: a.id,
      perimetres: [],
    });
    await post(page, '/api/registres', {
      kind: 'plan_actions',
      name: `Plan B ${suffixe}`,
      referenceId: b.id,
      perimetres: [],
    });
    await post(page, `/api/grc/${a.id}/objects`, {
      kind: 'action',
      name: titre,
      registreId: r1.id,
      data: {
        description: 'Action de recette',
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

    // Éléments par périmètre : l'action apparaît sous son périmètre, avec son registre.
    await page.reload();
    await page.getByRole('tab', { name: 'Éléments par périmètre' }).click();
    await page.getByRole('combobox', { name: 'Périmètre', exact: true }).click();
    await page.getByRole('option', { name: nomA, exact: true }).click();
    const tableau = page.getByRole('region', { name: /Éléments des registres du périmètre/ });
    await expect(tableau.getByRole('row', { name: new RegExp(titre) })).toBeVisible();
    await expect(tableau.getByRole('link', { name: `Plan A ${suffixe}` })).toBeVisible();

    // Déplacement depuis la fiche de l'action.
    await page.goto('/pilotage/actions');
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: nomA, exact: true }).click();
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Liste', exact: true }).click();
    await page.getByRole('button', { name: titre, exact: true }).first().click();
    const fiche = page.getByRole('dialog');
    const panneau = fiche.getByRole('group', { name: 'Déplacer vers un autre registre' });
    await panneau.getByRole('combobox', { name: 'Registre cible' }).click();
    await page.getByRole('option', { name: `Plan B ${suffixe}`, exact: true }).click();
    await panneau.getByRole('button', { name: 'Prévisualiser l’impact' }).click();
    await expect(panneau.getByText('Impact du déplacement')).toBeVisible();
    await expect(panneau.getByText(/Le périmètre de référence change/)).toBeVisible();
    const confirmer = panneau.getByRole('button', { name: 'Confirmer le déplacement' });
    await expect(confirmer).toBeDisabled();
    await panneau.getByLabel('Motif du déplacement').fill('Action rattachée au plan du périmètre B.');
    await confirmer.click();

    // L'action se retrouve sous le périmètre B, plus sous A.
    await expect
      .poll(async () => {
        const r = await page.request.get(`/api/registres/elements?perimetre=${b.id}`);
        return (await r.json()).items.map((o: { name: string }) => o.name);
      })
      .toContain(titre);
    const sousA = await (await page.request.get(`/api/registres/elements?perimetre=${a.id}`)).json();
    expect(sousA.items.map((o: { name: string }) => o.name)).not.toContain(titre);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
