/* Disposition du tableau de bord de l'accueil (ADR 0078, lot 2a) : déplacer une dalle au clavier et au glisser,
   changer sa largeur, la masquer puis la réafficher, enregistrer (la disposition survit au rechargement), puis revenir à
   la disposition par défaut. Le compte d'administration reprend ensuite la disposition standard. */
import { expect, test, type Page } from '@playwright/test';
import { creerEcartCommun, sessionAdmin, watchPage } from '../helpers';

/** Identifiants des dalles affichées, dans l'ordre de la grille (mode modification). */
const ordreEdition = (page: Page) =>
  page.locator('.tdb-grille > [data-dalle]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.dalle));
/** Titres des dalles affichées, dans l'ordre de la grille (mode lecture). */
const ordreLecture = (page: Page) =>
  page.locator('.tdb-grille > section').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

test('disposition du tableau de bord : clavier, glisser, largeur, masquer, enregistrer, revenir au défaut', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const session = await sessionAdmin(browser);
  const ctx = await browser.newContext({
    storageState: session.state,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  // Au moins un écart : les dalles « Écarts » s'affichent, en plus de la carte phare et des échéances.
  await creerEcartCommun(ctx.request, session.csrf, { name: 'Écart de la recette de disposition' });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
    const standard = await ordreLecture(page);
    expect(standard.length).toBeGreaterThanOrEqual(3);

    await page.getByRole('button', { name: 'Modifier la disposition' }).click();
    await expect(page.getByRole('region', { name: 'Modifier la disposition du tableau de bord' })).toBeVisible();
    const depart = await ordreEdition(page);
    expect(depart[0]).toBe('phare');

    // Clavier : la deuxième dalle passe en tête, annoncée « position 1 ».
    const deuxieme = depart[1]!;
    const poignee2 = page.locator(`[data-dalle="${deuxieme}"] .tdb-poignee`);
    await poignee2.focus();
    await page.keyboard.press('ArrowLeft');
    expect((await ordreEdition(page))[0]).toBe(deuxieme);
    await expect(page.locator('[aria-live="polite"]')).toHaveText(/position 1 sur \d+/);
    await expect(poignee2).toBeFocused();
    await page.keyboard.press('End');
    expect((await ordreEdition(page)).at(-1)).toBe(deuxieme);

    // Glisser : la carte phare, prise par sa poignée, est déposée sur la dalle « Prochaines échéances ».
    const avantGlisser = await ordreEdition(page);
    const phare = page.locator('[data-dalle="phare"] .tdb-poignee').boundingBox();
    const cible = page.locator('[data-dalle="echeances"]').boundingBox();
    const [a, b] = await Promise.all([phare, cible]);
    await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
    await page.mouse.down();
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 12 });
    await page.mouse.up();
    const apresGlisser = await ordreEdition(page);
    expect(apresGlisser).not.toEqual(avantGlisser);
    expect(apresGlisser.indexOf('phare')).toBeGreaterThan(avantGlisser.indexOf('phare'));

    // Largeur, puis masquer et réafficher.
    await page.getByLabel('Largeur de « Prochaines échéances »').selectOption('12');
    await expect(page.locator('[data-dalle="echeances"]')).toHaveClass(/tdb-l12/);
    await page.getByRole('button', { name: 'Masquer « Écarts »', exact: true }).click();
    await expect(page.locator('[data-dalle="ecarts"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Afficher « Écarts »' }).click();
    await expect(page.locator('[data-dalle="ecarts"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Masquer « Écarts »', exact: true }).click();

    const voulu = await ordreEdition(page);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: 'Modifier la disposition' })).toBeVisible();

    // Mode lecture : ordre enregistré, « Écarts » masquée, largeur appliquée ; identique après rechargement.
    const verifier = async () => {
      expect((await ordreLecture(page)).length).toBe(voulu.length);
      await expect(page.locator('.tdb-grille > section[aria-label="Écarts"]')).toHaveCount(0);
      await expect(page.locator('.tdb-grille > section[aria-label="Prochaines échéances"]')).toHaveClass(/tdb-l12/);
    };
    await verifier();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
    await verifier();

    // Retour à la disposition par défaut : l'ordre et les largeurs standard reviennent.
    await page.getByRole('button', { name: 'Modifier la disposition' }).click();
    await page.getByRole('button', { name: 'Revenir à la disposition par défaut' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByRole('button', { name: 'Modifier la disposition' })).toBeVisible();
    await expect(page.locator('.tdb-grille > section[aria-label="Écarts"]')).toHaveCount(1);
    expect(await ordreLecture(page)).toEqual(standard);
    expect(problems).toEqual([]);
  } finally {
    // Nettoyage si le test s'arrête avant la fin : le compte d'administration reprend la disposition standard.
    await ctx.request.delete('/api/tableau-de-bord/disposition', { headers: { 'X-CSRF-Token': session.csrf } });
    await ctx.close();
  }
});
