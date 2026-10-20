/* Plan d'actions conteneur (dates, statut, ordre des actions) ; écart créé depuis un audit. La récidive (qui exige un
   constat clos, donc causes et preuves de vérification) est couverte par `pilotage.test.ts`.
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
const perimetre = (nom: string) => ({
  name: nom,
  nature: 'SMSI',
  scope: 'Fixture de recette',
  timezone: 'Europe/Paris',
  parentId: null,
  entityKind: 'perimetre',
  inheritFrameworks: false,
});
const action = (nom: string) => ({
  kind: 'action',
  name: nom,
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

test('Plan d’actions : dates, statut, responsable et ordre des actions', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    nomPlan = `Plan conteneur ${suffixe}`;
  try {
    await page.goto('/registres');
    const p = await post(page, '/api/grc/smsis', perimetre(`Périmètre plan ${suffixe}`));
    const plan = await post(page, '/api/registres', {
      kind: 'plan_actions',
      name: nomPlan,
      referenceId: p.id,
      perimetres: [],
    });
    const a1 = await post(page, `/api/grc/${p.id}/objects`, { ...action(`Première ${suffixe}`), registreId: plan.id });
    const a2 = await post(page, `/api/grc/${p.id}/objects`, { ...action(`Seconde ${suffixe}`), registreId: plan.id });

    await page.goto(`/registres/${plan.id}`);
    await page.getByRole('tab', { name: 'Paramètres' }).click();
    await page.getByLabel('Début du plan').fill('2026-01-01');
    await page.getByLabel('Fin du plan').fill('2026-12-31');
    await page.getByRole('combobox', { name: 'Statut du plan' }).click();
    await page.getByRole('option', { name: 'En cours', exact: true }).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(
      page.getByRole('group', { name: 'Plan d’actions' }).getByText(/du 01\/01\/2026 au 31\/12\/2026/),
    ).toBeVisible();
    await expect(page.getByText('En cours', { exact: true }).first()).toBeVisible();

    await page.getByRole('tab', { name: /Éléments/ }).click();
    await page.getByRole('button', { name: `Monter Seconde ${suffixe}` }).click();
    await expect
      .poll(async () => {
        const r = await page.request.get(`/api/registres/${plan.id}/elements`);
        return (await r.json()).items.map((o: { id: string }) => o.id);
      })
      .toEqual([a2.id, a1.id]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Écart créé depuis un audit : l’audit d’origine est prérempli et validé par le serveur', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    nomPerimetre = `Périmètre écart ${suffixe}`,
    nomAudit = `Audit interne ${suffixe}`,
    nomEcart = `Écart de l’audit ${suffixe}`;
  try {
    await page.goto('/registres');
    const p = await post(page, '/api/grc/smsis', perimetre(nomPerimetre));
    const audit = await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'audit',
      name: nomAudit,
      data: { scope: 'Périmètre fictif', method: '', criteria: '' },
    });

    await page.goto('/pilotage/audits');
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: nomPerimetre, exact: true }).click();
    await page.getByRole('button', { name: `Autres actions pour ${nomAudit}` }).click();
    await page.getByRole('menuitem', { name: 'Constater un écart pour cet audit' }).click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('textbox', { name: 'Intitulé' }).fill(nomEcart);
    await fiche.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(fiche).toBeHidden();
    await expect
      .poll(async () => {
        const r = await page.request.get(`/api/grc/${p.id}/objects?kind=nonconformity`);
        const items = (await r.json()).items as { name: string; data: { auditRef?: string } }[];
        return items.find((o) => o.name === nomEcart)?.data.auditRef;
      })
      .toBe(`object:${audit.id}`);

    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
