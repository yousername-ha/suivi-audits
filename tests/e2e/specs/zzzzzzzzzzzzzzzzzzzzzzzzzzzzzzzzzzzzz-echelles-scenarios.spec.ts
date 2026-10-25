/* Ateliers 3 et 4 d'une étude EBIOS RM : échelle de vraisemblance épinglée par l'étude, niveau retenu choisi sur cette échelle
   (jamais sur l'ancienne), libellé publié affiché dans la synthèse de l'atelier. Préparation par l'API, données fictives. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

test('Atelier 4 : vraisemblance du scénario choisie sur l’échelle épinglée par l’étude', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36);
  try {
    await page.goto('/pilotage');
    const entetes = async () => ({
      Origin: new URL(page.url()).origin,
      'X-CSRF-Token': await csrfOf(page.request),
    });
    const post = async (url: string, data: unknown, headers: Record<string, string> = {}) => {
      const r = await page.request.post(url, { headers: { ...(await entetes()), ...headers }, data });
      expect(r.status(), url + ' ' + (await r.text())).toBeLessThan(300);
      return r.json();
    };
    const echelle = await post('/api/config-grc/items', {
      kind: 'scale',
      key: `vraisemblance_scenarios_${suffixe}`,
      definition: {
        name: `Vraisemblance E2E ${suffixe}`,
        category: 'likelihood',
        nature: 'qualitative',
        levels: ['rare', 'possible', 'frequent'].map((id) => ({
          id,
          label: 'Niveau ' + id,
          description: 'Niveau ' + id,
        })),
      },
    });
    const apercu = await post(`/api/config-grc/items/${echelle.id}/preview`, {});
    const etag = (await page.request.get(`/api/config-grc/items/${echelle.id}`)).headers()['etag']!;
    await post(
      `/api/config-grc/items/${echelle.id}/publish`,
      { previewId: apercu.previewId, reason: 'Échelle de recette', confirm: 'PUBLIER' },
      { 'If-Match': etag },
    );
    const perimetre = await post('/api/grc/smsis', {
      name: `QA-Scénarios-${suffixe}`,
      scope: 'Fixture privée de recette',
      timezone: 'Europe/Paris',
    });
    const etude = await post(`/api/grc/${perimetre.id}/objects`, {
      kind: 'risk_study',
      name: 'Étude fictive des scénarios',
      data: { objective: 'Recette', configuration: { likelihoodScale: { item: echelle.id, version: 1 } } },
    });
    await post(`/api/grc/${perimetre.id}/objects`, {
      kind: 'operational_scenario',
      name: 'Scénario fictif',
      data: { studyRef: 'object:' + etude.id, likelihoodLevel: 'frequent' },
    });

    await page.goto('/pilotage/etudes');
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre.name, exact: true }).click();
    await page.getByRole('button', { name: 'Ouvrir l’étude' }).click();
    await page.getByRole('tab', { name: /^4\./ }).click();
    const ligne = page.getByRole('row', { name: /Scénario fictif/ });
    await expect(ligne).toContainText('Vraisemblance « Niveau frequent » (échelle publiée)');

    // La fiche propose l'échelle épinglée, pas l'ancien champ à quatre niveaux.
    await ligne.getByRole('button', { name: 'Ouvrir' }).click();
    const d = page.getByRole('dialog');
    const champ = d.getByRole('combobox', {
      name: `Vraisemblance du scénario (échelle « Vraisemblance E2E ${suffixe} »)`,
    });
    await expect(champ).toHaveValue('Niveau frequent');
    await expect(d.getByRole('combobox', { name: 'Vraisemblance', exact: true })).toHaveCount(0);
    await champ.click();
    await page.getByRole('option', { name: 'Niveau rare', exact: true }).click();
    await d.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(d).toHaveCount(0);
    await expect(ligne).toContainText('Vraisemblance « Niveau rare » (échelle publiée)');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
