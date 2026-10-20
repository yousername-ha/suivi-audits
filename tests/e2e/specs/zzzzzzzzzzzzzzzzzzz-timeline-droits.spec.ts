/* Actions d'un registre : vue Timeline (barre début → échéance) et droits attribués sur l'élément. Données fictives. */
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

test('Actions : Timeline avec barre datée, puis droit de contributeur attribué sur l’élément', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre timeline ${suffixe}`,
    titre = `Action frise ${suffixe}`;
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
    const debut = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const fin = new Date(Date.now() + 40 * 86_400_000).toISOString();
    await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'action',
      name: titre,
      data: {
        description: 'Action de recette',
        status: 'todo',
        ownerId: null,
        startAt: debut,
        dueAt: fin,
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();

    // Timeline : la barre de l'action est présente, atteignable au clavier et ouvre la fiche.
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Timeline', exact: true }).click();
    const frise = page.getByRole('region', { name: /Timeline des actions/ });
    await expect(frise).toBeVisible();
    const barre = frise.getByRole('button', { name: titre });
    await expect(barre).toBeVisible();
    await barre.focus();
    await barre.press('Enter');

    // Fiche : l'accès de l'élément est affiché et les droits s'y attribuent.
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByText('Droits sur cet élément')).toBeVisible();
    await fiche.getByRole('combobox', { name: 'Utilisateur ou groupe' }).click();
    await page.getByRole('option').first().click();
    await fiche.getByRole('button', { name: 'Attribuer' }).click();
    await expect(
      fiche.getByRole('region', { name: /Droits attribués sur l’élément/ }).getByText('Contributeur'),
    ).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
