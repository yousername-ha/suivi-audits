/* Registre partagé entre deux périmètres : ses actions apparaissent aussi sous le second périmètre (une fois, signalées),
   la fiche indique le registre et les périmètres hérités (aucun sélecteur de périmètre), et la création propose le choix du
   registre d'accueil. Données fictives. */
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
const donnees = {
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
};

test('Registre partagé : actions visibles sous le second périmètre, fiche avec registre et périmètres hérités, choix du registre', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    nomA = `Périmètre A partagé ${suffixe}`,
    nomB = `Périmètre B partagé ${suffixe}`,
    nomPlan = `Plan commun ${suffixe}`,
    nomAction = `Action du plan commun ${suffixe}`,
    nomCreee = `Action créée dans le plan ${suffixe}`;
  try {
    await page.goto('/registres');
    const a = await post(page, '/api/grc/smsis', perimetre(nomA));
    const b = await post(page, '/api/grc/smsis', perimetre(nomB));
    const plan = await post(page, '/api/registres', {
      kind: 'plan_actions',
      name: nomPlan,
      referenceId: a.id,
      perimetres: [b.id],
    });
    await post(page, `/api/grc/${a.id}/objects`, {
      kind: 'action',
      name: nomAction,
      data: donnees,
      registreId: plan.id,
    });

    // Sous le second périmètre : l'action est là, signalée, et sa fiche nomme le registre et les périmètres hérités.
    await page.goto('/pilotage/actions');
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: nomB, exact: true }).click();
    await page.getByRole('combobox', { name: 'Vue synchronisée', exact: true }).click();
    await page.getByRole('option', { name: 'Liste', exact: true }).click();
    await page.getByRole('button', { name: nomAction, exact: true }).click();
    const fiche = page.getByRole('dialog');
    const registre = fiche.getByTestId('registre-de-l-element');
    await expect(registre).toContainText(nomPlan);
    await expect(registre).toContainText(nomA);
    await expect(registre).toContainText(nomB);
    await expect(fiche.getByRole('combobox', { name: /Périmètre/ })).toHaveCount(0);
    await fiche
      .getByRole('button', { name: 'Fermer la fiche' })
      .first()
      .click()
      .catch(() => page.keyboard.press('Escape'));

    // Sous le périmètre de référence : choix du registre d'accueil à la création.
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: nomA, exact: true }).click();
    await page.getByRole('button', { name: 'Ajouter une action', exact: true }).click();
    const creation = page.getByRole('dialog');
    await creation.getByLabel('Nom de la fiche', { exact: true }).fill(nomCreee);
    await creation.getByRole('combobox', { name: /Plan d’actions d’accueil/ }).click();
    await page.getByRole('option', { name: nomPlan, exact: true }).click();
    await creation.getByRole('button', { name: 'Enregistrer la fiche', exact: true }).click();
    await expect(creation).toHaveCount(0);
    const dansLePlan = await (await page.request.get(`/api/registres/${plan.id}/elements`)).json();
    expect(dansLePlan.items.map((o: { name: string }) => o.name)).toContain(nomCreee);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
