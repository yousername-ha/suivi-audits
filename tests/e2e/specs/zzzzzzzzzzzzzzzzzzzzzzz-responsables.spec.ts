/* Responsables : une fonction créée en administration est désignée responsable d'une action, puis relue dans la liste.
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

test('Responsable : fonction créée en administration, désignée sur une action', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    fonction = `Fonction recette ${suffixe}`,
    titre = `Action fonction ${suffixe}`;
  try {
    await page.goto('/admin/fonctions');
    await page.getByRole('button', { name: 'Nouvelle fonction' }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByRole('textbox', { name: /^Nom/ }).fill(fonction);
    await dialogue.getByRole('textbox', { name: 'Description' }).fill('Fonction fictive de recette');
    await dialogue.getByRole('textbox', { name: 'Titulaires' }).click();
    await page.getByRole('option').first().click();
    await page.keyboard.press('Escape');
    await dialogue.getByRole('button', { name: 'Créer' }).click();
    const ligne = page.getByRole('row', { name: new RegExp(fonction) });
    await expect(ligne).toBeVisible();

    const perimetre = await post(page, '/api/grc/smsis', {
      name: `Périmètre resp. ${suffixe}`,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    await post(page, `/api/grc/${perimetre.id}/objects`, {
      kind: 'action',
      name: titre,
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

    await page.goto('/pilotage/actions');
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: `Périmètre resp. ${suffixe}`, exact: true }).click();
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Liste', exact: true }).click();
    await page.getByRole('button', { name: titre, exact: true }).first().click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('combobox', { name: 'Responsable' }).click();
    await page.getByRole('option', { name: new RegExp(`^${fonction}`) }).click();
    await fiche.getByRole('button', { name: 'Enregistrer la fiche' }).click();
    await expect(page.getByRole('row', { name: new RegExp(titre) }).getByText(`Fonction ${fonction}`)).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
