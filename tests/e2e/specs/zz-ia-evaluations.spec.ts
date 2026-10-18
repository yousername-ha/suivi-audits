import { test, expect, type Page } from '@playwright/test';
import { ecrireEtat, sessionAdmin, watchPage } from '../helpers';
async function changeSource(page: Page, id: string, source: Record<string, unknown> | null) {
  const r = await page.request.get('/api/suivi/etat');
  const state = await r.json();
  const me = await (await page.request.get('/api/auth/me')).json();
  const evals = (state.ai?.evals ?? []).filter((e: { id: string }) => e.id !== id);
  if (source) evals.push(source);
  await ecrireEtat(page.request, me.csrf, { ...state, ai: { ...state.ai, evals } });
}
test('IA : décision mobile réelle, instantané conservé après modification et retrait de la source', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 900 },
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const id = `QA-IA-${Date.now()}`,
    source = {
      id,
      domain: 'Recette isolée',
      scenario: 'Décision IA de recette',
      app: 'Applicable',
      c: 5,
      i: 3,
      a: 2,
      prob: 4,
      maturity: 1,
      effort: 3,
      dscp: 'Oui',
      custom: { preuve: 'champ source inconnu conservé' },
    };
  try {
    await page.goto('/ia/evaluations');
    await changeSource(page, id, source);
    await page.getByLabel('Rechercher un scénario', { exact: true }).fill(id);
    await page.getByRole('button', { name: `Consulter ${id}`, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nouvelle réévaluation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer la décision', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Simuler la réévaluation', exact: true }).click();
    await expect(page.getByText(/Prévisualisation · source et configuration/)).toBeVisible();
    await page.getByLabel('Motif de la décision', { exact: true }).fill('Décision explicite pour la recette isolée');
    await page.getByLabel('Saisissez ENREGISTRER pour confirmer', { exact: true }).fill('ENREGISTRER');
    await page.getByRole('button', { name: 'Enregistrer la décision', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Consulter l’instantané de la décision 1', exact: true }),
    ).toBeVisible();
    const history = await (await page.request.get(`/api/ia/evaluations/${id}/history`)).json();
    expect(history.items).toHaveLength(1);
    expect(history.items[0].sourceSnapshot).toEqual(source);
    await changeSource(page, id, { ...source, scenario: 'Source modifiée' });
    await expect(page.getByText(/La source a changé depuis la dernière décision/)).toBeVisible();
    await page.getByRole('button', { name: 'Consulter l’instantané de la décision 1', exact: true }).click();
    await expect(page.getByLabel('Source conservée', { exact: true })).toHaveValue(/Décision IA de recette/);
    await expect(page.getByLabel('Source conservée', { exact: true })).toHaveValue(/champ source inconnu conservé/);
    await page.getByRole('button', { name: 'Fermer l’instantané' }).click();
    await changeSource(page, id, null);
    await expect(page.getByText(/La source a été retirée/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nouvelle réévaluation' })).toHaveCount(0);
    expect(await (await page.request.get(`/api/ia/evaluations/${id}/history`)).json()).toEqual(history);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter l’historique complet (JSON)', exact: true }).click();
    expect((await download).suggestedFilename()).toBe('evaluations-ia.json');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(problems).toEqual([]);
  } finally {
    await changeSource(page, id, null);
    await ctx.close();
  }
});
test('IA : un écran en lecture seule conserve la consultation et masque toutes les commandes', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const id = `QA-IA-read-${Date.now()}`;
  try {
    await page.goto('/ia/evaluations');
    await changeSource(page, id, { id, domain: 'Recette', scenario: 'Lecture seule', app: 'Applicable' });
    await page.route('**/api/auth/me', async (route) => {
      const me = await (await route.fetch()).json();
      await route.fulfill({
        json: { ...me, permissions: me.permissions.filter((p: string) => !['ia:modifier', 'ia:exporter'].includes(p)) },
      });
    });
    await page.reload();
    await page.getByLabel('Rechercher un scénario', { exact: true }).fill(id);
    await page.getByRole('button', { name: `Consulter ${id}`, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Historique des décisions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simuler la réévaluation', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enregistrer la décision', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exporter l’historique complet (JSON)', exact: true })).toHaveCount(
      0,
    );
    expect(problems).toEqual([]);
  } finally {
    await page.unroute('**/api/auth/me');
    await changeSource(page, id, null);
    await ctx.close();
  }
});
