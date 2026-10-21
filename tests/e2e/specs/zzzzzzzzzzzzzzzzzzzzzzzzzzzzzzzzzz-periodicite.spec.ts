/* Périodicité d'une série (dossier 018) : préréglage lisible, aperçu des prochaines échéances, périodicité personnalisée
   et enregistrement dans la série. Données fictives. */
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

test('Série récurrente : périodicité prédéfinie, aperçu des échéances, personnalisée, enregistrement', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre périodicité ${suffixe}`,
    titre = `Série périodique ${suffixe}`;
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
    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await page.getByRole('button', { name: 'Ajouter une tâche récurrente' }).click();

    const fiche = page.getByRole('dialog');
    await fiche.getByLabel('Nom de la fiche').fill(titre);
    const periodicite = fiche.getByRole('combobox', { name: 'Périodicité' });
    await expect(periodicite).toHaveValue('Mensuel');
    const apercu = fiche.getByTestId('apercu-echeances');
    const echeances = async () => (await apercu.getByRole('listitem').allTextContents()).map((t) => t.slice(0, 10));
    // Écart en jours entre la première et la deuxième échéance affichées (dd/mm/yyyy).
    const jours = (a: string, b: string) => {
      const date = (x: string) => Date.UTC(+x.slice(6), +x.slice(3, 5) - 1, +x.slice(0, 2));
      return Math.round((date(b) - date(a)) / 86_400_000);
    };
    await expect(apercu.getByRole('listitem')).toHaveCount(5);
    let [a, b] = await echeances();
    expect(jours(a!, b!)).toBeGreaterThanOrEqual(28);
    expect(jours(a!, b!)).toBeLessThanOrEqual(31);

    await periodicite.click();
    await page.getByRole('option', { name: 'Trimestriel', exact: true }).click();
    [a, b] = await echeances();
    expect(jours(a!, b!)).toBeGreaterThanOrEqual(89);
    expect(jours(a!, b!)).toBeLessThanOrEqual(92);

    await periodicite.click();
    await page.getByRole('option', { name: 'Personnalisée', exact: true }).click();
    await fiche.getByLabel('Tous les', { exact: true }).fill('10');
    await fiche.getByRole('combobox', { name: 'Unité' }).click();
    await page.getByRole('option', { name: 'jour(s)', exact: true }).click();
    await expect(apercu.getByRole('listitem')).toHaveCount(5);
    [a, b] = await echeances();
    expect(jours(a!, b!)).toBe(10);

    await fiche.getByRole('button', { name: 'Enregistrer la fiche' }).click();
    await expect(fiche).toHaveCount(0);
    const objets = (await (await page.request.get(`/api/grc/${p.id}/objects?kind=task_series`)).json()) as {
      items: { name: string; data: { recurrence: { unit: string; interval: number } } }[];
    };
    const serie = objets.items.find((o) => o.name === titre);
    expect(serie?.data.recurrence).toMatchObject({ unit: 'day', interval: 10 });
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
