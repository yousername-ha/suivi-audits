/* Contexte de retour (R06) : de l'écart à son audit d'origine puis retour à la liste, périmètre conservé ; Timeline avec sa
   période affichée (R07). Données fictives. */
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

test('Écart → audit d’origine → retour à la liste ; Timeline avec période affichée', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre contexte ${suffixe}`,
    nomAudit = `Audit d’origine ${suffixe}`,
    nomEcart = `Écart contextuel ${suffixe}`;
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
    const audit = await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'audit',
      name: nomAudit,
      data: { scope: 'Périmètre fictif', method: '', criteria: '' },
    });
    await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'nonconformity',
      name: nomEcart,
      data: { cause: 'Cause de recette', auditRef: `object:${audit.id}` },
    });
    await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'action',
      name: `Action datée ${suffixe}`,
      data: {
        description: '',
        status: 'todo',
        ownerId: null,
        startAt: null,
        dueAt: new Date(Date.now() + 40 * 86_400_000).toISOString(),
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
    // Un filtre saisi dans la liste fait partie du contexte : il est retrouvé au retour.
    await page.getByRole('textbox', { name: 'Rechercher', exact: true }).fill('contextuel');
    await expect(page).toHaveURL(/[?&]q=contextuel/);
    await page.getByRole('button', { name: `Autres actions pour ${nomEcart}` }).click();
    await page.getByRole('menuitem', { name: 'Voir l’audit d’origine' }).click();
    await expect(page).toHaveURL(/\/pilotage\/audits/);
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByRole('textbox', { name: 'Intitulé' })).toHaveValue(nomAudit);
    await page.keyboard.press('Escape');
    await expect(fiche).toBeHidden();
    await page.getByRole('link', { name: 'Retour à la page précédente' }).click();
    await expect(page).toHaveURL(/\/pilotage\/amelioration/);
    await expect(page.getByRole('textbox', { name: 'Rechercher', exact: true })).toHaveValue('contextuel');
    // Le périmètre choisi est conservé : l'écart est toujours dans la liste.
    await expect(page.getByText(nomEcart, { exact: true }).first()).toBeVisible();

    // Timeline : la période affichée est annoncée.
    await page.goto('/pilotage/actions');
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Timeline', exact: true }).click();
    await expect(page.getByText(/Période affichée : du /)).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
