/* Bibliothèque partagée des sources de risque (décision 10) : une source sans étude se choisit dans une étude, par
   référence ; sa modification ultérieure est signalée sur le couple, qui se marque comme relu. Périmètre privé de recette,
   données fictives créées par l'API. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function appel(page: Page, method: 'POST' | 'PUT', path: string, data: unknown, version?: number) {
  const headers: Record<string, string> = {
    Origin: new URL(page.url()).origin,
    'X-CSRF-Token': await csrfOf(page.request),
  };
  if (version !== undefined) headers['If-Match'] = `"${version}"`;
  const r = await page.request.fetch(path, { method, headers, data });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

async function choisirPerimetre(page: Page, nom: string) {
  const selecteur = page.getByRole('combobox', { name: 'Périmètre affiché', exact: true });
  await expect(async () => {
    await selecteur.click();
    await page.getByRole('option', { name: nom, exact: true }).click({ timeout: 3000 });
    await expect(selecteur).toHaveValue(nom, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
}

test('Bibliothèque de sources : choix par référence, dérive signalée, couple relu', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage');
    const s = await appel(page, 'POST', '/api/grc/smsis', {
      name: 'QA-Bibliotheque-' + Date.now(),
      scope: 'Fixture privée de recette',
      timezone: 'Europe/Paris',
    });
    const obj = async (kind: string, name: string, data: Record<string, unknown>) =>
      (await appel(page, 'POST', `/api/grc/${s.id}/objects`, { kind, name, data })) as {
        id: string;
        version: number;
        data: Record<string, unknown>;
      };
    await obj('risk_study', 'Étude de la bibliothèque', { objective: 'Service fictif' });
    const source = await obj('risk_source', 'Source partagée fictive', {
      category: 'Criminel organisé',
      motive: 'Gain financier',
      targetObjective: 'Chiffrer les données',
    });

    await page.goto('/pilotage/etudes');
    await choisirPerimetre(page, s.name);
    const bibliotheque = page.getByRole('region', { name: 'Bibliothèque de sources de risque' });
    await expect(bibliotheque).toContainText('Source partagée fictive');
    await expect(bibliotheque).toContainText('Pas encore utilisée');

    await page.getByRole('button', { name: 'Ouvrir l’étude' }).click();
    await page.getByRole('tab', { name: /2\. / }).click();
    await page.getByRole('button', { name: 'Choisir une source dans la bibliothèque' }).click();
    const choix = page.getByRole('dialog', { name: 'Choisir une source dans la bibliothèque' });
    await choix.getByRole('combobox', { name: 'Source de risque' }).click();
    await page.getByRole('option', { name: 'Source partagée fictive (Criminel organisé)', exact: true }).click();
    await expect(choix).toContainText('Objectif visé proposé : Chiffrer les données');
    await choix.getByRole('button', { name: 'Créer le couple' }).click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('textbox', { name: 'Intitulé', exact: true }).fill('Couple issu du catalogue');
    await fiche.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(fiche).toHaveCount(0);
    // La source est lue par référence : elle apparaît dans l'atelier, marquée « Bibliothèque ».
    const ligne = page.getByRole('row').filter({ hasText: 'Bibliothèque' });
    await expect(ligne).toHaveCount(1);
    await expect(ligne).toContainText('Source partagée fictive');
    const couple = (await (await page.request.get(`/api/grc/${s.id}/objects?kind=sr_ov`)).json()).items[0];
    expect(couple.data.sourceRef).toBe('object:' + source.id);
    expect(couple.data.sourceVersion).toBe(1);
    expect(couple.data.objective).toBe('Chiffrer les données');

    // La source évolue : la dérive est signalée sur le couple, sans rien changer en silence.
    await appel(
      page,
      'PUT',
      `/api/grc/${s.id}/objects/${source.id}`,
      { kind: 'risk_source', name: 'Source partagée fictive', data: { ...source.data, motive: 'Gain et revente' } },
      source.version,
    );
    await page.reload();
    await choisirPerimetre(page, s.name);
    await expect(page.getByRole('region', { name: 'Bibliothèque de sources de risque' })).toContainText(
      '1 couple(s) dans 1 étude(s)',
    );
    await page.getByRole('button', { name: 'Ouvrir l’étude' }).click();
    await page.getByRole('tab', { name: /2\. / }).click();
    await expect(page.getByText('Source modifiée depuis le choix (version 2)')).toBeVisible();
    await page.getByRole('button', { name: 'Marquer comme relue' }).click();
    await expect(page.getByText('Source modifiée depuis le choix')).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
