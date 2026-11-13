/* Parcours de la matrice approuvée. Base isolée, données fictives ; les lectures ne réécrivent aucune analyse. */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage, totp, PASSWORD } from '../helpers';
import type { GrcObject } from '@suivi/shared';

const SOCLE = '00000000-0000-4000-8000-000000000001';
async function choisir(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function post(request: APIRequestContext, url: string, data: unknown) {
  const response = await request.post(url, { headers: { 'X-CSRF-Token': await csrfOf(request) }, data });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

test('SWOT Studio : lecture historique, agrandissement, processus, registre et historique sans écriture', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  try {
    const url = `/api/grc/${SOCLE}/pilotage/legacy/swots/SW1`;
    const before = await (await ctx.request.get(url)).json();
    const page = await ctx.newPage(),
      problems = watchPage(page),
      writes: string[] = [];
    page.on('request', (r) => {
      if (!['GET', 'HEAD'].includes(r.method()) && new URL(r.url()).pathname.startsWith('/api/grc/'))
        writes.push(r.method());
    });
    await page.goto('/pilotage/swot?processus=legacy:processes:PR2&analyse=legacy:swots:SW1');
    await expect(page.locator('.swot-sector')).toHaveCount(4);
    await expect(page.locator('.swot-hero-identity h2')).toHaveText('Accueil et prise en charge des patients');
    await expect(page.locator('.swot-sector[data-key=S]')).toContainText('Équipe stable');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Agrandir Forces', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Équipe stable');
    await expect(page.getByRole('dialog')).toContainText('PR2');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Agrandir Forces', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Voir le processus PR2', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Accueil et prise en charge des patients');
    await page.getByRole('button', { name: 'Revenir à la matrice', exact: true }).click();
    await page.getByRole('button', { name: 'Ouvrir la fiche', exact: true }).click();
    await expect(page.getByRole('dialog').getByLabel('Forces', { exact: true })).toHaveValue(
      String(before.data.strengths),
    );
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.getByRole('button', { name: 'Parcourir le registre', exact: true }).click();
    const registry = page.getByRole('region', { name: 'Registre complet des analyses SWOT', exact: true });
    await expect(registry).toBeVisible();
    await registry.getByLabel('Rechercher', { exact: true }).fill('SW1');
    await expect(registry.locator('tbody tr')).toHaveCount(1);
    await registry.getByRole('button', { name: 'Filtres', exact: true }).click();
    await choisir(page, 'Origine', 'Existant (outil de suivi)');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/orig=existant/);
    await page.reload();
    await expect(registry).toBeVisible();
    await expect(registry.getByLabel('Rechercher', { exact: true })).toHaveValue('SW1');
    await page.getByRole('button', { name: 'Décisions et réalisations', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('SW1');
    await page.getByRole('button', { name: 'Fermer l’historique', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await (await ctx.request.get(url)).json()).toEqual(before);
    expect(writes).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('SWOT Studio : processus natif, liens transverses, choix de l’analyse et édition existante conservés', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  try {
    const suffix = Date.now().toString(36);
    const scope = await post(ctx.request, '/api/grc/smsis', {
      name: `Recette SWOT Studio ${suffix}`,
      scope: 'Données fictives de recette SWOT',
      timezone: 'Europe/Paris',
    });
    const base = `/api/grc/${scope.id}`;
    const process: GrcObject = await post(ctx.request, base + '/objects', {
      kind: 'process',
      name: `Accueil fictif ${suffix}`,
      data: {
        mission: 'Accueillir les patients fictifs',
        description: 'Processus fictif de recette',
        ownerId: null,
        refs: [],
      },
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    await page.goto(`/pilotage/swot?perimetre=${scope.id}`);
    await expect(page.getByRole('button', { name: 'Nouvelle analyse', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Nouvelle analyse', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Intitulé', { exact: true }).fill(`SWOT fictif ${suffix}`);
    await dialog.getByLabel('Forces', { exact: true }).fill('Équipe stable\nCompétences');
    await dialog.getByLabel('Faiblesses', { exact: true }).fill('Charge de travail');
    await dialog.getByLabel('Opportunités', { exact: true }).fill('Partenariat');
    await dialog.getByLabel('Menaces', { exact: true }).fill('Exigences externes');
    const saved = page.waitForResponse(
      (r) => new URL(r.url()).pathname === base + '/objects' && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    const creation = await saved;
    expect(creation.ok(), await creation.text()).toBe(true);
    const object: GrcObject = await creation.json();
    await expect(dialog).toHaveCount(0);
    const other: GrcObject = await post(ctx.request, base + '/objects', {
      kind: 'swot',
      name: `Autre analyse ${suffix}`,
      data: {
        strengths: '',
        weaknesses: '',
        opportunities: '',
        threats: '',
        description: 'Analyse vide fictive',
        ownerId: null,
        refs: [],
      },
    });
    await post(ctx.request, base + '/links', {
      source: `object:${object.id}`,
      target: `object:${process.id}`,
      type: 'related_to',
      note: 'Lien fictif de recette',
    });
    // Le deuxième sens du lien doit également être pris en compte.
    await post(ctx.request, base + '/links', {
      target: `object:${other.id}`,
      source: `object:${process.id}`,
      type: 'related_to',
      note: 'Autre sens du lien fictif',
    });
    await page.goto(`/pilotage/swot?perimetre=${scope.id}&processus=object:${process.id}&analyse=object:${object.id}`);
    await expect(page.locator('.swot-sector')).toHaveCount(4);
    await expect(page.locator('.swot-hero-identity h2')).toHaveText(process.name);
    await expect(page.locator('.swot-sector[data-key=S] li')).toHaveCount(2);
    await choisir(page, 'Analyse affichée', other.name);
    await expect(page.locator('.swot-sector[data-key=S] .swot-sector-count b')).toHaveText('0');
    await choisir(page, 'Analyse affichée', object.name);
    await page.getByRole('button', { name: 'Agrandir Forces', exact: true }).click();
    await page.getByRole('button', { name: 'Ouvrir la fiche SWOT', exact: true }).click();
    await expect(dialog).toHaveCount(1);
    await dialog.getByLabel('Forces', { exact: true }).fill('Équipe stable\nCompétences\nRenfort');
    const updated = page.waitForResponse(
      (r) => new URL(r.url()).pathname === base + '/objects/' + object.id && r.request().method() === 'PUT',
    );
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    expect((await updated).ok()).toBe(true);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.swot-sector[data-key=S] li')).toHaveCount(3);
    const after: GrcObject = await (await ctx.request.get(base + '/objects/' + object.id)).json();
    expect(after.version).toBe(object.version + 1);
    expect(after.data.weaknesses).toBe(object.data.weaknesses);
    expect(after.data.opportunities).toBe(object.data.opportunities);
    expect(after.data.threats).toBe(object.data.threats);
    expect(await (await ctx.request.get(base + '/objects/' + process.id)).json()).toEqual(process);
    await page.reload();
    await expect(page.locator('.swot-sector[data-key=S] li')).toHaveCount(3);
    await page.getByRole('button', { name: 'Parcourir le registre', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Registre complet des analyses SWOT', exact: true }).locator('tbody tr'),
    ).toHaveCount(2);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('SWOT Studio : lecture seule, fiche non modifiable et refus serveur 403', async ({ browser }) => {
  const admin = await browser.newContext({ storageState: (await sessionAdmin(browser)).state });
  const reader = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const suffix = Date.now().toString(36);
    const role = await post(admin.request, '/api/admin/roles', { from: 'lecteur', name: `Lecture SWOT ${suffix}` });
    expect(
      (
        await admin.request.patch('/api/admin/roles/' + role.id, {
          headers: { 'X-CSRF-Token': await csrfOf(admin.request), 'If-Match': `"${role.version}"` },
          data: { permissions: ['pilotage:lire'] },
        })
      ).ok(),
    ).toBe(true);
    const username = `lecture-swot-${suffix}`;
    const user = await post(admin.request, '/api/admin/users', {
      username,
      displayName: 'Lecteur fictif SWOT',
      roles: [{ roleId: role.id }],
    });
    expect(
      (
        await reader.request.post('/api/auth/login', {
          data: { username, password: user.temporaryPassword },
        })
      ).ok(),
    ).toBe(true);
    let csrf = await csrfOf(reader.request);
    const begin = await reader.request.post('/api/account/totp/begin', { headers: { 'X-CSRF-Token': csrf }, data: {} });
    expect(begin.ok()).toBe(true);
    expect(
      (
        await reader.request.post('/api/account/totp/confirm', {
          headers: { 'X-CSRF-Token': csrf },
          data: { code: totp((await begin.json()).secret) },
        })
      ).ok(),
    ).toBe(true);
    csrf = await csrfOf(reader.request);
    expect(
      (
        await reader.request.post('/api/account/password', {
          headers: { 'X-CSRF-Token': csrf },
          data: { current: user.temporaryPassword, next: PASSWORD },
        })
      ).ok(),
    ).toBe(true);
    const url = `/api/grc/${SOCLE}/pilotage/legacy/swots/SW1`,
      before = await (await admin.request.get(url)).json();
    const page = await reader.newPage(),
      problems = watchPage(page);
    await page.goto('/pilotage/swot?processus=legacy:processes:PR2&analyse=legacy:swots:SW1');
    await expect(page.locator('.swot-sector')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Nouvelle analyse', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Agrandir Forces', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Équipe stable');
    await page.getByRole('button', { name: 'Ouvrir la fiche SWOT', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Cette fiche est consultable en lecture seule.');
    await expect(dialog.getByLabel('Forces', { exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Enregistrer', exact: true })).toHaveCount(0);
    const forbidden = await reader.request.put(url, {
      headers: { 'X-CSRF-Token': await csrfOf(reader.request), 'If-Match': `"${before.version}"` },
      data: { name: before.name, sourceSha: before.data.sourceSha, data: before.data },
    });
    expect(forbidden.status()).toBe(403);
    expect(await (await admin.request.get(url)).json()).toEqual(before);
    expect(problems).toEqual([]);
  } finally {
    await reader.close();
    await admin.close();
  }
});
