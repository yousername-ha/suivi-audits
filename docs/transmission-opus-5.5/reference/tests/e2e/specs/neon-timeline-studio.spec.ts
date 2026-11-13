/* Recette Studio : dates et périodicités réelles, accessibilité des commandes, pause et mode de test isolé. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), `Création de la fixture : ${r.status()}`).toBe(true);
  return r.json();
}
test('Timeline Studio : Auto suit la série et conserve une série annuelle en pause sans inventer d’occurrence', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage/recurrences');
    const scope = await post(page, '/api/grc/smsis', {
      name: 'Périodicités Studio ' + Date.now(),
      nature: 'SMSI',
      scope: 'Données fictives de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    const series: { id: string; label: string }[] = [];
    for (const [unit, label] of [
      ['day', 'Journalier'],
      ['week', 'Hebdomadaire'],
      ['month', 'Mensuel'],
      ['year', 'Annuel'],
    ]) {
      const s = await post(page, `/api/grc/${scope.id}/objects`, {
        kind: 'task_series',
        name: 'Série ' + label,
        data: {
          description: 'Recette de périodicité',
          ownerId: null,
          category: 'action',
          priority: 'normal',
          refs: [],
          recurrence: {
            start: new Date().toISOString().slice(0, 10),
            time: '09:00',
            timezone: 'Europe/Paris',
            unit,
            interval: 1,
            until: null,
            count: 2,
            reminderDays: 7,
            active: false,
          },
        },
      });
      series.push({ id: s.id, label: label! });
    }
    await page.goto('/pilotage/recurrences?perimetre=' + scope.id);
    await expect(page.locator('.timeline-studio')).toBeVisible();
    for (const s of series) {
      await page.getByLabel('Série à suivre', { exact: true }).selectOption(s.id);
      await expect(page.locator('.task-scale-context strong')).toHaveText('Auto · ' + s.label);
      await page.reload();
      await expect(page.locator('.task-scale-context strong')).toHaveText('Auto · ' + s.label);
      await expect(page.locator('.task-empty')).toContainText('en pause');
      await expect(page.locator('.task-occurrence')).toHaveCount(0);
    }
    for (const label of ['Journalier', 'Hebdomadaire', 'Mensuel', 'Annuel']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.task-scale-context strong')).toHaveText(label);
    }
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Timeline Studio : orange animé plus visible, pause, clavier et réduction des mouvements', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    reducedMotion: 'no-preference',
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage/actions');
    const scope = await post(page, '/api/grc/smsis', {
      name: 'Animation Studio ' + Date.now(),
      nature: 'SMSI',
      scope: 'Fixture fictive',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    await post(page, `/api/grc/${scope.id}/objects`, {
      kind: 'action',
      name: 'Action en attente animée',
      data: {
        description: 'Aucun déplacement des dates',
        status: 'todo',
        ownerId: null,
        startAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
    await page.goto('/pilotage/actions?perimetre=' + scope.id);
    const ribbon = page.locator('.task-ribbon');
    await expect(ribbon).toBeVisible();
    const line = ribbon.locator('.task-ribbon-line');
    expect(await line.evaluate((e) => getComputedStyle(e).animationName)).toBe('task-pending-halo');
    const position = await ribbon.boundingBox();
    await page.waitForTimeout(350);
    expect(await ribbon.boundingBox()).toEqual(position);
    await page.getByRole('button', { name: /Mettre les animations en pause/ }).click();
    expect(await line.evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('paused');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await line.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
    await ribbon.focus();
    await ribbon.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Résultat de réalisation' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Résultat', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('.task-identity').click();
    await expect(page.locator('.task-inline-detail')).toContainText('Aucun déplacement des dates');
    await page.getByRole('button', { name: 'Ouvrir la fiche ↗', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Docker interfaces : un navigateur neuf arrive directement dans l’application', async ({ browser }) => {
  test.skip(process.env.E2E_UI_TEST !== '1', 'Parcours réservé au profil docker-compose.ui-test.yml.');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto('/login');
    await expect(page).toHaveURL(new URL('/', page.url()).href);
    await expect(page.getByText('Test interfaces · données fictives', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Déconnexion', exact: true })).toHaveCount(0);
    const me = await (await page.request.get('/api/auth/me')).json();
    expect(me.stage).toBe('ok');
  } finally {
    await ctx.close();
  }
});
