/* Analyser un service et plan d'action des écarts (ADR 0056) : l'assistant crée un périmètre enfant qualifié, la
   couverture s'évalue, puis le plan d'action des écarts se crée en une fois et se rejoue sans doublon. Données fictives
   créées par ce test. */
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

const identifiant = 'e2e-ecarts-' + Date.now();
const definition = {
  name: 'Référentiel fictif des écarts ' + Date.now(),
  identifier: identifiant,
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-25',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'd', label: 'Domaine' }],
  requirements: ['R1', 'R2', 'R3'].map((id) => ({
    id,
    domain: 'd',
    title: `Exigence ${id}`,
    description: '',
    applicability: '',
    measureRefs: [],
  })),
};

test('Analyser un service : périmètre enfant qualifié, évaluation, plan d’action des écarts rejouable', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage');
    const apercu = await appel(page, 'POST', '/api/library/frameworks/preview', { id: null, definition });
    const fw = await appel(
      page,
      'POST',
      '/api/library/frameworks/publish',
      {
        id: null,
        definition,
        previewId: apercu.previewId,
        reason: 'Publication fictive de recette',
        confirm: 'PUBLIER',
      },
      0,
    );
    const nom = 'Service fictif ' + Date.now();

    await page.goto('/pilotage/analyser-service');
    const assistant = page.getByTestId('analyser-service');
    await assistant.getByLabel('Nom du service').fill(nom);
    await assistant.getByLabel('Description').fill('Application interne fictive de recette.');
    await assistant.getByRole('button', { name: 'Suivant' }).click();
    await assistant.getByRole('button', { name: 'Créer le service' }).click();
    await expect(assistant).toContainText(`Service « ${nom} » créé`);
    await assistant.getByRole('button', { name: 'Rattacher les référentiels cochés' }).click();
    await expect(assistant).toContainText('Ouvrez la Couverture du service');

    const service = (
      (await (await page.request.get('/api/grc/smsis')).json()) as { id: string; name: string; scope: string }[]
    ).find((s) => s.name === nom)!;
    expect(service.scope).toContain('Qualification : Données de santé : à préciser');
    await appel(page, 'PUT', `/api/grc/${service.id}/framework-attachments/${fw.id}`, {
      version: 1,
      confirm: 'RATTACHER',
    });
    const evaluer = (req: string, corps: Record<string, unknown>) =>
      appel(
        page,
        'POST',
        `/api/grc/${service.id}/exigences/${fw.id}/${req}/evaluations`,
        { implementation: 'aucune', reason: 'Revue de recette', confirm: 'EVALUER', ...corps },
        0,
      );
    await evaluer('R1', { applicability: 'applicable' });
    await evaluer('R2', { applicability: 'applicable', implementation: 'partielle' });
    await evaluer('R3', { applicability: 'exclue', justification: 'Hors du service' });

    await assistant.getByRole('button', { name: 'Ouvrir la couverture du service' }).click();
    await expect(page).toHaveURL(/\/pilotage\/couverture/);
    await page.getByRole('combobox', { name: 'Détail par exigence' }).click();
    await page.getByRole('option', { name: definition.name }).click();
    await page.getByRole('button', { name: 'Créer le plan d’action des écarts' }).click();
    const plan = page.getByTestId('plan-ecarts');
    await expect(plan).toContainText('2 écart(s)');
    await expect(plan).toContainText('2 action(s) seraient créées');
    const creer = plan.getByRole('button', { name: 'Créer les actions' });
    await expect(creer).toBeDisabled();
    await plan.getByLabel('Confirmation').fill('CREER');
    await creer.click();
    await expect(plan).toContainText('2 action(s) créée(s)');
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();

    // Rejeu : plus rien à créer, et les deux exigences affichent leur mesure reliée.
    await page.getByRole('button', { name: 'Créer le plan d’action des écarts' }).click();
    await expect(page.getByTestId('plan-ecarts')).toContainText('0 action(s) seraient créées');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
