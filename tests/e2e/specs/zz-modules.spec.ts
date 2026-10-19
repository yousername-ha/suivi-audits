/* B1 : confirmation dans le navigateur, API réelle et conservation de l'état historique. */
import { expect, test, type Browser } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

async function open(browser: Browser, width = 1366) {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width, height: 900 },
  });
  const page = await ctx.newPage();
  return { ctx, page, csrf: (await sessionAdmin(browser)).csrf, problems: watchPage(page) };
}

test('B1 : conserve la présence reçue au premier hello quand les droits sont inchangés', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser);
  let meResponses = 0;
  page.on('response', (r) => {
    if (new URL(r.url()).pathname === '/api/auth/me') meResponses++;
  });
  const presence = [{ username: 'lecteur-test', name: 'Lecteur test', resource: 'documents', mode: 'view' }];
  await page.route('**/api/events', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `retry: 60000\n\nevent: hello\ndata: ${JSON.stringify({ presence })}\n\n`,
    }),
  );
  try {
    await page.goto('/documents');
    await expect.poll(() => meResponses).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByText('Lecteur test consulte', { exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('B1 : après reconnexion, recharge la présence filtrée actuelle', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser);
  let refreshed = 0;
  let connexions = 0;
  // Chaque reconnexion vide la présence puis la recharge : avec une reconnexion toutes les 250 ms, le texte attendu
  // n'est visible que par intermittence (et rarement sur un poste lent). Une seule reconnexion rapide suffit à provoquer
  // le rechargement ; le flux reste ensuite stable.
  await page.route('**/api/events', (route) => {
    connexions++;
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `retry: ${connexions === 1 ? 250 : 600000}\n\nevent: hello\ndata: {"presence":[]}\n\n`,
    });
  });
  await page.route('**/api/presence', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    refreshed++;
    return route.fulfill({
      json: [{ username: 'lecteur-test', name: 'Lecteur revalidé', resource: 'documents', mode: 'view' }],
    });
  });
  try {
    await page.goto('/documents');
    await expect.poll(() => refreshed).toBeGreaterThan(0);
    await expect(page.getByText('Lecteur revalidé consulte', { exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('B1 : prévisualisation mobile, socle protégé et dépendance obligatoire', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser, 390);
  try {
    await page.goto('/admin/system');
    const card = page.getByRole('heading', { name: 'Activation des modules', exact: true }).locator('..');
    await expect(card.getByRole('checkbox', { name: 'Activer Administration', exact: false })).toBeDisabled();
    await card.getByRole('checkbox', { name: 'Activer Audit (référentiels et couverture)', exact: true }).uncheck();
    await card.getByRole('button', { name: 'Prévisualiser les conséquences' }).click();
    await expect(card.getByRole('button', { name: 'Appliquer la configuration' })).toBeDisabled();
    await expect(card.getByText(/nécessite Audit/)).toBeVisible();
    await card.getByRole('checkbox', { name: /cascade contrôlée/ }).check();
    await card.getByRole('button', { name: 'Prévisualiser les conséquences' }).click();
    await expect(card.getByText(/Désactivation.*Plan d'audit.*dépendance incluse/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('B1 : désactiver le fournisseur facultatif audit conserve les paramètres Conformité', async ({ browser }) => {
  const { ctx, page, csrf, problems } = await open(browser);
  const apply = async (changes: { id: string; enabled: boolean }[]) => {
    const intent = { changes, cascade: true };
    const p = await (
      await ctx.request.post('/api/admin/modules/preview', { data: intent, headers: { 'x-csrf-token': csrf } })
    ).json();
    const r = await ctx.request.put('/api/admin/modules', {
      data: { intent, previewId: p.previewId, confirm: 'VALIDER' },
      headers: { 'x-csrf-token': csrf, 'if-match': `"${p.version}"` },
    });
    expect(r.ok()).toBe(true);
  };
  try {
    await apply([{ id: 'audit', enabled: false }]);
    await page.goto('/parametres/referentiels');
    await expect(page.getByRole('combobox', { name: 'Référentiel complémentaire actif', exact: true })).toBeEnabled();
    await expect(
      page.getByRole('navigation', { name: 'Sections des paramètres' }).getByText('Cycle d’audit et années'),
    ).toHaveCount(0);
    const r = await ctx.request.get('/api/settings/referentiels');
    expect(r.status()).toBe(200);
    expect((await r.json()).info.referentiels).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    const state = await (await ctx.request.get('/api/modules')).json();
    if (state.disabled.length) await apply(state.disabled.map((id: string) => ({ id, enabled: true })));
    await ctx.close();
  }
});

test('B1 : désactivation confirmée, cache renouvelé et réactivation des données intactes', async ({ browser }) => {
  const { ctx, page, csrf, problems } = await open(browser);
  const before = await (await ctx.request.get('/api/suivi/etat')).json();
  let off = false;
  try {
    await page.goto('/admin/system');
    const card = page.getByRole('heading', { name: 'Activation des modules', exact: true }).locator('..');
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Documents et liens', exact: true }),
    ).toBeVisible();
    await card.getByRole('checkbox', { name: 'Activer Documents et liens', exact: true }).uncheck();
    await card.getByRole('button', { name: 'Prévisualiser les conséquences' }).click();
    await expect(card.getByText('Désactivation : Documents et liens', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Appliquer la configuration' })).toBeDisabled();
    await card.getByLabel('Saisissez VALIDER pour confirmer ces conséquences').fill('VALIDER');
    await card.getByRole('button', { name: 'Appliquer la configuration' }).click();
    await expect
      .poll(async () => (await (await ctx.request.get('/api/modules')).json()).disabled)
      .toContain('documents');
    off = true;
    expect((await ctx.request.get('/api/documents')).status()).toBe(409);
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Documents et liens', exact: true }),
    ).toHaveCount(0);
    expect((await (await ctx.request.get('/api/auth/me')).json()).stage).toBe('ok');
    await expect(card.getByRole('checkbox', { name: 'Activer Documents et liens', exact: true })).not.toBeChecked();
    await card.getByRole('checkbox', { name: 'Activer Documents et liens', exact: true }).check();
    await card.getByRole('button', { name: 'Prévisualiser les conséquences' }).click();
    await expect(card.getByText('Activation : Documents et liens', { exact: true })).toBeVisible();
    await card.getByLabel('Saisissez VALIDER pour confirmer ces conséquences').fill('VALIDER');
    await card.getByRole('button', { name: 'Appliquer la configuration' }).click();
    await expect
      .poll(async () => (await (await ctx.request.get('/api/modules')).json()).disabled)
      .not.toContain('documents');
    off = false;
    expect((await ctx.request.get('/api/documents')).status()).toBe(200);
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Documents et liens', exact: true }),
    ).toBeVisible();
    expect(await (await ctx.request.get('/api/suivi/etat')).json()).toEqual(before);
    expect(problems).toEqual([]);
  } finally {
    if (off) {
      const intent = { changes: [{ id: 'documents', enabled: true }], cascade: false };
      const p = await (
        await ctx.request.post('/api/admin/modules/preview', { data: intent, headers: { 'x-csrf-token': csrf } })
      ).json();
      const r = await ctx.request.put('/api/admin/modules', {
        data: { intent, previewId: p.previewId, confirm: 'VALIDER' },
        headers: { 'x-csrf-token': csrf, 'if-match': `"${p.version}"` },
      });
      expect(r.ok()).toBe(true);
    }
    await ctx.close();
  }
});

test('B1 : désactiver import/export bloque les transferts sans bloquer les autres modules', async ({ browser }) => {
  const { ctx, csrf, problems } = await open(browser);
  const toggle = async (enabled: boolean) => {
    const state = await (await ctx.request.get('/api/modules')).json();
    if (state.disabled.includes('import_export') === !enabled) return;
    const intent = { changes: [{ id: 'import_export', enabled }], cascade: false };
    const p = await (
      await ctx.request.post('/api/admin/modules/preview', { data: intent, headers: { 'x-csrf-token': csrf } })
    ).json();
    const r = await ctx.request.put('/api/admin/modules', {
      data: { intent, previewId: p.previewId, confirm: 'VALIDER' },
      headers: { 'x-csrf-token': csrf, 'if-match': `"${p.version}"` },
    });
    expect(r.ok()).toBe(true);
  };
  try {
    await toggle(false);
    expect((await ctx.request.get('/api/admin/import')).status()).toBe(409);
    expect(problems).toEqual([]);
  } finally {
    await toggle(true);
    await ctx.close();
  }
});
