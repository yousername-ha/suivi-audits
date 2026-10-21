/* Menu au clavier (R15) : familles atteignables et activables sans souris, focus visible dans les deux thèmes, menu mobile
   (390 px) ouvert et fermé au clavier avec retour du focus, aucun défilement horizontal de la page. */
import { expect, test, type Page } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

/** Le focus clavier est visible : un contour (outline) ou une ombre portée est appliqué à l'élément actif. */
async function focusVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    const contour = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
    const ombre = s.boxShadow !== 'none';
    return contour || ombre;
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`Menu : une famille s’active au clavier, focus visible, thème ${theme}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: (await sessionAdmin(browser)).state,
      ignoreHTTPSErrors: true,
      colorScheme: theme,
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    try {
      await page.goto('/');
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      const famille = nav.getByRole('link', { name: /^Risques/ }).first();
      await expect(famille).toHaveAttribute('aria-expanded', 'false');
      await famille.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(famille).toBeFocused();
      expect(await focusVisible(page)).toBe(true);
      // Entrée déplie la famille ; Tab mène à sa première destination, que Entrée ouvre.
      await page.keyboard.press('Enter');
      const destination = nav.getByRole('link', { name: 'Gestion des risques' });
      await expect(destination).toBeVisible();
      await expect(famille).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      await expect(destination).toBeFocused();
      expect(await focusVisible(page)).toBe(true);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/pilotage\/risques/);
      expect(problems).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}

test('Menu mobile (390 px) : ouverture et fermeture au clavier, focus rendu, pas de défilement horizontal', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage/synthese');
    const burger = page.getByRole('button', { name: 'Ouvrir le menu' });
    await burger.focus();
    expect(await focusVisible(page)).toBe(true);
    await page.keyboard.press('Enter');
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    // Le focus est dans le menu ouvert, et Échap le ferme en rendant le focus au bouton.
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(burger).toBeFocused();
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debordement).toBeLessThanOrEqual(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
