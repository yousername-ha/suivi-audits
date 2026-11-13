/* Consultation et édition du registre réel ; données fictives dans une instance isolée de recette. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';
const SOCLE = '00000000-0000-4000-8000-000000000001';
async function post(page: Page, url: string, data: unknown) {
  const response = await page.request.post(url, {
    headers: { 'X-CSRF-Token': await csrfOf(page.request), Origin: new URL(page.url()).origin },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function choisir(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('Parties : panorama historique, filtres, lecture, clavier et retour du focus sans écriture', async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1920, height: 1080 },
  });
  try {
    const page = await context.newPage(),
      problems = watchPage(page),
      writes: string[] = [];
    const endpoint = `/api/grc/${SOCLE}/pilotage/legacy/interested/PI1`;
    const before = await (await page.request.get(endpoint)).json();
    page.on('request', (r) => {
      if (!['GET', 'HEAD'].includes(r.method()) && /\/api\/(grc|suivi)\//.test(r.url())) writes.push(r.method());
    });
    await page.goto('/pilotage/parties?perimetre=' + SOCLE);
    await expect(page.locator('.pi-card')).toHaveCount(6);
    await expect(page.locator('.pi-wires > path[data-role=branch]')).toHaveCount(6);
    await expect(page.locator('.pi-wires > path[data-role=outlet]')).toHaveCount(2);
    const card = page.locator('.pi-card').filter({ hasText: 'Patients' });
    await card.focus();
    await card.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Besoins et attentes');
    await expect(dialog.locator('input, textarea')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Modifier la fiche', exact: true }).click();
    await expect(dialog.getByLabel('Intitulé', { exact: true })).toHaveValue(before.name);
    await dialog.getByLabel('Intitulé', { exact: true }).fill('Saisie abandonnée');
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(dialog).toContainText(before.name);
    await page.keyboard.press('Escape');
    await expect(card).toBeFocused();
    await page.getByRole('button', { name: 'Filtres', exact: true }).click();
    await choisir(page, 'Nature', 'Interne');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pi-card')).toHaveCount(2);
    await expect(page.locator('.pi-wires > path[data-role=outlet]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Tout effacer ×', exact: true }).click();
    await page.getByRole('button', { name: 'Rechercher une partie', exact: true }).click();
    await page.getByRole('textbox', { name: 'Rechercher une partie', exact: true }).fill('accueil de qualite');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pi-card')).toHaveCount(1);
    await expect(page.locator('.pi-card')).toContainText('Patients');
    await page.getByRole('button', { name: 'Tout effacer ×', exact: true }).click();
    await page.getByRole('button', { name: 'Vue liste compacte', exact: true }).click();
    await expect(page.locator('.pi-row')).toHaveCount(6);
    const row = page.locator('.pi-row').filter({ hasText: 'Patients' });
    await row.focus();
    await row.press('Space');
    await expect(dialog).toContainText('Patients');
    await dialog.getByRole('tab', { name: 'Liens et justificatifs', exact: true }).click();
    await expect(dialog).toContainText('Références de la fiche');
    await dialog.getByRole('tab', { name: 'Historique', exact: true }).click();
    await expect(dialog).toContainText('source historique');
    await page.keyboard.press('Escape');
    await expect(row).toBeFocused();
    expect(await (await page.request.get(endpoint)).json()).toEqual(before);
    expect(writes).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await context.close();
  }
});

test('Parties : sauvegarde native versionnée, champs conservés et périmètre isolé', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const page = await context.newPage(),
      problems = watchPage(page);
    await page.goto('/pilotage/parties');
    const p = await post(page, '/api/grc/smsis', {
      name: `Parties fictives ${Date.now()}`,
      scope: 'Recette des parties intéressées',
      timezone: 'Europe/Paris',
      entityKind: 'perimetre',
      parentId: null,
      inheritFrameworks: false,
    });
    const o = await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'stakeholder',
      name: 'Partenaire fictif de recette',
      data: {
        nature: 'Externe',
        category: 'Partenaire',
        expectations: 'Continuité des échanges',
        requirements: 'Exigence fictive',
        addressed: 'Partiel',
        treatment: 'Plan de suivi fictif',
        reviewedAt: '2026-11-01',
        contact: 'Contact fictif',
        extraDeRecette: 'Champ conservé',
      },
    });
    await page.goto('/pilotage/parties?perimetre=' + p.id);
    await expect(page.locator('.pi-card')).toHaveCount(1);
    await expect(page.locator('.pi-hub')).toContainText(p.name);
    await page.locator('.pi-card').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Exigence fictive');
    await dialog.getByRole('button', { name: 'Modifier la fiche', exact: true }).click();
    await dialog.getByLabel('Intitulé', { exact: true }).fill('Partenaire fictif mis à jour');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const after = await (await page.request.get(`/api/grc/${p.id}/objects/${o.id}`)).json();
    expect(after.version).toBe(o.version + 1);
    expect(after.data.extraDeRecette).toBe('Champ conservé');
    for (const key of [
      'nature',
      'category',
      'expectations',
      'requirements',
      'addressed',
      'treatment',
      'reviewedAt',
      'contact',
    ])
      expect(after.data[key]).toEqual(o.data[key]);
    await page.reload();
    await page.locator('.pi-card').click();
    await expect(dialog).toContainText('Partenaire fictif mis à jour');
    await dialog.getByRole('tab', { name: 'Historique', exact: true }).click();
    await expect(dialog).toContainText(`Version ${after.version}`);
    await page.keyboard.press('Escape');
    await page.goto('/pilotage/parties?perimetre=' + SOCLE);
    await expect(page.locator('.pi-card')).toHaveCount(6);
    await expect(page.locator('.pi-card').filter({ hasText: 'Partenaire fictif mis à jour' })).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await context.close();
  }
});

test('Parties : pagination réelle et défilement local de 55 acteurs', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1366, height: 768 },
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage(),
      problems = watchPage(page);
    await page.goto('/pilotage/parties');
    const p = await post(page, '/api/grc/smsis', {
      name: `Parties nombreuses fictives ${Date.now()}`,
      scope: 'Recette de pagination',
      timezone: 'Europe/Paris',
      entityKind: 'perimetre',
      parentId: null,
      inheritFrameworks: false,
    });
    for (let i = 1; i <= 55; i++)
      await post(page, `/api/grc/${p.id}/objects`, {
        kind: 'stakeholder',
        name: `Acteur fictif ${String(i).padStart(2, '0')}`,
        data: {
          nature: i % 3 ? 'Externe' : 'Interne',
          addressed: i % 2 ? 'Oui' : 'Non',
          expectations: 'Attente fictive',
        },
      });
    await page.goto('/pilotage/parties?perimetre=' + p.id);
    await expect(page.locator('.pi-card')).toHaveCount(50);
    await expect(page.locator('.pi-summary')).toContainText('sur 55');
    await page.getByRole('button', { name: 'Afficher les fiches suivantes', exact: true }).click();
    await expect(page.locator('.pi-card')).toHaveCount(55);
    await page.getByRole('button', { name: 'Vue liste compacte', exact: true }).click();
    const zone = page.getByRole('region', { name: 'Acteurs affichés', exact: true });
    await expect.poll(() => zone.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    const initialY = await page.evaluate(() => scrollY);
    await zone.hover();
    await page.mouse.wheel(0, 1000);
    await expect.poll(() => zone.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(initialY);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(problems).toEqual([]);
  } finally {
    await context.close();
  }
});
