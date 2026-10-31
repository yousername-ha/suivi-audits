/* Ordre du menu : une famille se glisse à la souris à une autre place, sans ouvrir de page ; l'ordre est enregistré dans
   les préférences (rechargement), se modifie au clavier (Alt + flèche) en gardant le focus, et se rétablit depuis
   Mon compte. Les adresses et les droits ne changent pas. */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

const familles = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Navigation principale' })
    .locator('.nav-famille')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-famille')));

async function glisser(page: Page, source: Locator, cible: Locator) {
  const a = (await source.boundingBox())!;
  const b = (await cible.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('Menu : ordre des familles choisi au glisser et au clavier, enregistré, rétabli', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/account');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    const documents = nav.getByRole('link', { name: /^Documents(\s|$)/ }).first();
    const organisation = nav.getByRole('link', { name: /^Organisation(\s|$)/ }).first();
    await expect(documents).toBeVisible();
    expect((await familles(page))[0]).toBe('organisation');

    // Glisser « Documents » sur « Organisation » : Documents passe en tête, aucune page n'est ouverte.
    const enregistre = page.waitForResponse(
      (r) => r.url().endsWith('/api/account/preferences') && r.request().method() === 'PUT',
    );
    await glisser(page, documents, organisation);
    expect((await enregistre).ok()).toBe(true);
    expect((await familles(page)).slice(0, 2)).toEqual(['documents', 'organisation']);
    await expect(page).toHaveURL(/\/account$/);

    // L'ordre est enregistré : il revient après rechargement.
    await page.reload();
    await expect(documents).toBeVisible();
    expect((await familles(page)).slice(0, 2)).toEqual(['documents', 'organisation']);

    // Au clavier : Alt + flèche bas fait descendre la famille d'un rang, le focus reste sur elle.
    await documents.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(async () => (await familles(page)).slice(0, 2)).toEqual(['organisation', 'documents']);
    await expect(documents).toBeFocused();

    // Mon compte : « Rétablir l'ordre par défaut ».
    await page.getByRole('button', { name: 'Rétablir l’ordre par défaut' }).click();
    await expect.poll(async () => (await familles(page))[1]).toBe('pilotage');
    await expect(page.getByRole('button', { name: 'Rétablir l’ordre par défaut' })).toBeDisabled();
    expect(problems).toEqual([]);
  } finally {
    // Les autres tests partagent la session de l'administrateur : l'ordre par défaut est rétabli dans tous les cas.
    const prefs = await (await page.request.get('/api/account/preferences')).json();
    if (prefs.menu) {
      delete prefs.menu;
      await page.request.put('/api/account/preferences', {
        headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
        data: prefs,
      });
    }
    await ctx.close();
  }
});
