/* Processus Studio sur le registre réel : lecture, édition et erreurs ; instance de recette fictive. */
import { expect, test, type Page } from '@playwright/test';
import type { ProcessusCartes } from '@suivi/shared';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';
const SOCLE = '00000000-0000-4000-8000-000000000001',
  endpoint = `/api/grc/${SOCLE}/pilotage/processus-cartes`;
async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { 'X-CSRF-Token': await csrfOf(page.request), Origin: new URL(page.url()).origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}

test('Processus Studio : consultation, filtres, liste et retour clavier sans mutation', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  try {
    const page = await ctx.newPage(),
      problems = watchPage(page),
      writes: string[] = [];
    const before: ProcessusCartes = await (await page.request.get(endpoint)).json();
    page.on('request', (r) => {
      if (!['GET', 'HEAD'].includes(r.method()) && /\/api\/(grc|suivi)\//.test(r.url())) writes.push(r.method());
    });
    await page.goto('/pilotage/processus-cartes');
    await expect(page.locator('.pr-module')).toBeVisible();
    const card = page.locator('.pr-card[data-id=PR2]'),
      open = card.locator('.pr-card-open');
    await card.getByRole('button', { name: /Déplier/ }).click();
    await expect(card).toContainText(before.processus.find((p) => p.id === 'PR2')!.purpose);
    await open.focus();
    await open.press('Enter');
    const read = page.getByRole('dialog', { name: 'Processus · Consultation', exact: true });
    await expect(read).toContainText('Accueil et prise en charge des patients');
    await expect(read.locator('input,textarea,select')).toHaveCount(0);
    await read.getByRole('button', { name: 'SWOT 1', exact: true }).click();
    await expect(read).toContainText('SWOT SW1');
    await read.getByRole('button', { name: 'Modifier le processus', exact: true }).click();
    const edit = page.getByRole('dialog');
    await edit.getByLabel('Nom du processus', { exact: true }).fill('Saisie abandonnée');
    await edit.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(read).toContainText('Accueil et prise en charge des patients');
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
    await page.getByRole('button', { name: 'Rechercher un processus', exact: true }).click();
    await page.getByRole('textbox', { name: 'Rechercher un processus', exact: true }).fill('systemes');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pr-card')).toHaveCount(1);
    await expect(page.locator('.pr-card')).toContainText('Systèmes d’information');
    await page.getByRole('button', { name: 'Tout effacer', exact: true }).click();
    await page.getByRole('button', { name: 'Filtres', exact: true }).click();
    await page.getByRole('combobox', { name: 'Type de processus', exact: true }).click();
    await page.getByRole('option', { name: 'Support', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.pr-card')).toHaveCount(
      before.processus.filter((p) => p.family === 'Support' && !p.parent).length,
    );
    await page.getByRole('button', { name: 'Tout effacer', exact: true }).click();
    await page.getByRole('button', { name: 'Vue liste compacte', exact: true }).click();
    await expect(page.locator('.pr-row')).toHaveCount(before.processus.length);
    const row = page.locator('.pr-row[data-id=PR2]');
    await row.focus();
    await row.press('Space');
    await expect(read).toContainText('Accueil et prise en charge');
    await page.keyboard.press('Escape');
    await expect(row).toBeFocused();
    expect(await (await page.request.get(endpoint)).json()).toEqual(before);
    expect(writes).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Processus Studio : modification persistante, erreur conservée et enfant retrouvé sans son parent', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1366, height: 900 },
  });
  try {
    const page = await ctx.newPage(),
      problems = watchPage(page);
    await page.goto('/pilotage/processus-cartes');
    const token = Date.now().toString(36);
    const parent = await post(page, `/api/grc/${SOCLE}/pilotage/objectifs/processes`, {
      name: 'Parent fictif ' + token,
      family: 'Support',
      owner: 'Pilote fictif',
    });
    const child = await post(page, `/api/grc/${SOCLE}/pilotage/objectifs/processes`, {
      name: 'Enfant fictif ' + token,
      family: 'Support',
      parent: parent.id,
      owner: 'Référent fictif',
    });
    await page.reload();
    await expect(page.locator(`.pr-card[data-id="${parent.id}"]`)).toBeVisible();
    await page.getByRole('button', { name: 'Rechercher un processus', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Rechercher un processus', exact: true })
      .fill(child.name ?? 'Enfant fictif ' + token);
    await page.keyboard.press('Escape');
    await expect(page.locator('.pr-card')).toHaveCount(1);
    await expect(page.locator('.pr-card')).toContainText('Enfant fictif ' + token);
    await page.locator('.pr-card-open').click();
    await page.getByRole('button', { name: 'Modifier le processus', exact: true }).click();
    const edit = page.getByRole('dialog');
    await edit.getByLabel('Finalité', { exact: true }).fill('Finalité fictive revue pour la recette.');
    const url = `**/api/grc/${SOCLE}/pilotage/objectifs/processes/${child.id}`;
    await page.route(url, async (route) => {
      if (route.request().method() === 'PATCH')
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Indisponibilité de recette simulée' }),
        });
      else await route.continue();
    });
    await edit.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(edit.getByRole('alert')).toContainText('Indisponibilité de recette simulée');
    await expect(edit.getByLabel('Finalité', { exact: true })).toHaveValue('Finalité fictive revue pour la recette.');
    await page.unroute(url);
    const before: ProcessusCartes = await (await page.request.get(endpoint)).json();
    await edit.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    const read = page.getByRole('dialog', { name: 'Processus · Consultation', exact: true });
    await expect(read).toContainText('Finalité fictive revue pour la recette.');
    const after: ProcessusCartes = await (await page.request.get(endpoint)).json();
    const original = before.processus.find((p) => p.id === child.id)!,
      saved = after.processus.find((p) => p.id === child.id)!;
    expect(saved.purpose).toBe('Finalité fictive revue pour la recette.');
    expect(saved.parent).toBe(parent.id);
    expect(saved.owner).toBe(original.owner);
    expect(saved.rattaches).toEqual(original.rattaches);
    expect(after.processus.filter((p) => p.id !== child.id)).toEqual(before.processus.filter((p) => p.id !== child.id));
    await page.reload();
    await page.getByRole('button', { name: 'Rechercher un processus', exact: true }).click();
    await page.getByRole('textbox', { name: 'Rechercher un processus', exact: true }).fill('Enfant fictif ' + token);
    await page.keyboard.press('Escape');
    await page.locator('.pr-card-open').click();
    await expect(read).toContainText('Finalité fictive revue pour la recette.');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
