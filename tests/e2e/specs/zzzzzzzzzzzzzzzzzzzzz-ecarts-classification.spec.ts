/* Écarts : classification affichée dans la liste, lien de récidive et fiche modifiable. Données fictives. */
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

test('Écarts : classification et récidive visibles dans la liste', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre écarts ${suffixe}`,
    premier = `Constat initial ${suffixe}`,
    second = `Constat récidive ${suffixe}`;
  try {
    await page.goto('/pilotage/amelioration');
    const p = await post(page, '/api/grc/smsis', {
      name: perimetre,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    const initial = await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'nonconformity',
      name: premier,
      data: { cause: 'Cause de recette', classification: 'majeure' },
    });
    await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'nonconformity',
      name: second,
      data: { cause: 'Cause de recette', classification: 'mineure', recidiveRef: 'object:' + initial.id },
    });
    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    const ligneInitiale = page.getByRole('row', { name: new RegExp(premier) });
    await expect(ligneInitiale.getByText('Non-conformité majeure', { exact: true })).toBeVisible();
    const ligneRecidive = page.getByRole('row', { name: new RegExp(second) });
    await expect(ligneRecidive.getByText('Non-conformité mineure', { exact: true })).toBeVisible();
    await expect(ligneRecidive.getByText('Récidive', { exact: true })).toBeVisible();
    // La fiche propose les trois nouveaux champs.
    await ligneRecidive.getByRole('button', { name: 'Ouvrir', exact: true }).click();
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByRole('combobox', { name: 'Classification' })).toBeVisible();
    await expect(fiche.getByText('Audit d’origine')).toBeVisible();
    await expect(fiche.getByText('Constat précédent (récidive)')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
