/* Lignes complètes, commandes indépendantes, liste défilante et validation depuis les repères. Données fictives. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), `Fixture de recette : ${r.status()}`).toBe(true);
  return r.json();
}
async function perimetre(page: Page) {
  return post(page, '/api/grc/smsis', {
    name: `Recette lignes ${Date.now()}`,
    scope: 'Données fictives de recette',
    timezone: 'Europe/Paris',
    parentId: null,
    entityKind: 'perimetre',
    inheritFrameworks: false,
  });
}
const task = (name: string) => ({
  kind: 'action',
  name,
  data: {
    description: 'Action fictive à vérifier',
    status: 'todo',
    ownerId: null,
    startAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
});

test('Contexte : toute la ligne ouvre la lecture ; commandes, sélection, clavier et défilement restent indépendants', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await ctx.newPage(),
    errors = watchPage(page);
  try {
    await page.goto('/pilotage/contexte');
    const p = await perimetre(page);
    for (let i = 1; i <= 24; i++)
      await post(page, `/api/grc/${p.id}/objects`, {
        kind: 'context',
        name: `Contexte de recette ${String(i).padStart(2, '0')}`,
        data: { description: 'Présentation de recette fictive' },
      });
    await page.goto('/pilotage/contexte?perimetre=' + p.id);
    const row = page.locator('tr[data-fiche-titre="Afficher Contexte de recette 01"]');
    await expect(row).toBeVisible();
    const zone = page.getByRole('region', { name: 'Fiches du registre', exact: true });
    await expect.poll(() => zone.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    const header = await page.locator('.page-header').boundingBox();
    const pageY = await page.evaluate(() => window.scrollY);
    await zone.hover();
    await page.mouse.wheel(0, 550);
    await expect.poll(() => zone.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    // Tolérance sous le pixel pour les arrondis CSS ; le défilement de la page reste strictement inchangé.
    expect(Math.abs((await page.locator('.page-header').boundingBox())!.y - header!.y)).toBeLessThan(0.5);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageY);
    await zone.evaluate((e) => (e.scrollTop = 0));
    await row.locator('td').nth(2).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Contexte de recette 01');
    await expect(dialog.locator('input,textarea')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(row).toBeFocused();
    await row.getByRole('button', { name: /Autres actions/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await page.keyboard.press('Escape');
    await row
      .locator('td')
      .nth(1)
      .click({ modifiers: ['Control'] });
    await expect(dialog).toHaveCount(0);
    await row
      .locator('td')
      .first()
      .evaluate((e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(range);
      });
    await row.locator('td').nth(1).dispatchEvent('click', { button: 0 });
    await expect(dialog).toHaveCount(0);
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    for (const key of ['Enter', 'Space']) {
      await row.focus();
      await row.press(key);
      await expect(dialog).toContainText('Contexte de recette 01');
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 390, height: 900 });
    const card = page.locator('[data-fiche-ouvrable]:visible').filter({ hasText: 'Contexte de recette 01' });
    await card.getByText('Contexte de recette 01', { exact: true }).click();
    await expect(dialog).toContainText('Contexte de recette 01');
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Fiches des autres menus et anciennes adresses Budget / CRRC', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state });
  const page = await ctx.newPage(),
    errors = watchPage(page);
  try {
    await page.goto('/pilotage/parties');
    const p = await perimetre(page);
    for (const [section, kind] of [
      ['parties', 'stakeholder'],
      ['responsabilites', 'governance'],
      ['bia', 'bia'],
      ['continuité', 'continuity_plan'],
      ['preuves', 'evidence'],
      ['controles', 'control'],
      ['audits', 'audit'],
      ['revues', 'management_review'],
    ]) {
      const nom = 'Fiche fictive ' + kind;
      await post(page, `/api/grc/${p.id}/objects`, { kind, name: nom, data: {} });
      await page.goto(`/pilotage/${section === 'continuité' ? 'continuite' : section}?perimetre=${p.id}`);
      const row = page.locator('tr[data-fiche-ouvrable]').filter({ hasText: nom });
      await row.locator('td').nth(2).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByLabel('Intitulé', { exact: true })).toHaveValue(nom);
      await page.keyboard.press('Escape');
    }
    for (const section of ['investissements', 'crrc-ensemble', 'crrc-restaurations', 'crrc-rapports']) {
      await page.goto('/pilotage/' + section);
      await expect(page).toHaveURL(/\/pilotage\/synthese$/);
    }
    await expect(page.locator('nav').getByText('Budget', { exact: true })).toHaveCount(0);
    await expect(page.locator('nav').getByText(/CRRC/)).toHaveCount(0);
    await page.goto('/exports');
    await expect(page.getByText('Gestion CRRC', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Plan d’investissement', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Timeline des actions : le repère ouvre une petite fenêtre OK / KO, preuve, commentaire et historique réel', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state });
  const page = await ctx.newPage(),
    errors = watchPage(page);
  try {
    await page.goto('/pilotage/actions');
    const p = await perimetre(page);
    const o = await post(page, `/api/grc/${p.id}/objects`, task('Action à contrôler depuis le repère'));
    const preuve = await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'evidence',
      name: 'Preuve fictive du contrôle',
      data: {},
    });
    await page.goto(`/pilotage/actions?perimetre=${p.id}`);
    await page.locator('.task-ribbon').click();
    const dialog = page.getByRole('dialog', { name: 'Résultat de réalisation', exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.locator('.task-inline-detail')).toHaveCount(0);
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(700);
    await dialog.getByRole('combobox', { name: 'Résultat', exact: true }).click();
    await page.getByRole('option', { name: 'KO', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Enregistrer la validation' })).toBeDisabled();
    await dialog
      .getByLabel('Commentaire', { exact: true })
      .fill('Vérification fictive non satisfaisante, reprise nécessaire.');
    await dialog.getByRole('combobox', { name: 'Preuve', exact: true }).click();
    await page.getByRole('option', { name: /Preuve fictive du contrôle/ }).click();
    await expect(dialog.getByRole('combobox', { name: 'Preuve', exact: true })).toHaveValue(
      'Preuve fictive du contrôle',
    );
    await dialog.getByRole('button', { name: 'Enregistrer la validation' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.task-ribbon')).toHaveAttribute('data-tone', 'red');
    const journal = await (await page.request.get(`/api/grc/${p.id}/objects/${o.id}/validations`)).json();
    expect(journal.items).toHaveLength(1);
    expect(journal.items[0]).toMatchObject({ result: 'ko', proofRef: `object:${preuve.id}` });
    await page.reload();
    await page.locator('.task-ribbon').click();
    await expect(dialog.getByRole('group', { name: 'Dernier résultat enregistré' })).toContainText('KO');
    await expect(dialog).toContainText('Vérification fictive non satisfaisante');
    await expect(dialog.getByRole('button', { name: 'Enregistrer la validation' })).toHaveCount(0);
    await dialog.getByLabel('Motif de la réouverture').fill('Nouvelle réalisation fictive autorisée');
    await dialog.getByRole('button', { name: 'Rouvrir l’action', exact: true }).click();
    await expect(dialog.getByRole('combobox', { name: 'Résultat', exact: true })).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Résultat', exact: true }).click();
    await page.getByRole('option', { name: 'OK', exact: true }).click();
    await dialog.getByRole('button', { name: 'Enregistrer la validation' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.task-ribbon')).toHaveAttribute('data-tone', 'teal');
    const apres = await (await page.request.get(`/api/grc/${p.id}/objects/${o.id}/validations`)).json();
    expect(apres.items.map((x: { kind: string }) => x.kind)).toEqual(['validation', 'reouverture', 'validation']);
    // Le clic sur le fond de ligne continue d'ouvrir la fiche complète.
    await page.locator('.task-timeline-row .task-lane').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).toContainText('Nom de la fiche');
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Listes spécifiques : DdA, fournisseurs, indicateurs et éléments des registres', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state });
  const page = await ctx.newPage(),
    errors = watchPage(page);
  try {
    await page.goto('/pilotage/dda-annexe-a');
    const mesure = page.locator('.dda-row').first();
    await expect(mesure).toBeVisible();
    await mesure.getByRole('combobox', { name: /Applicabilité/ }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await mesure.locator('td').nth(3).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    const nom = 'Fournisseur fictif clic ligne ' + Date.now();
    await post(page, '/api/suppliers', { name: nom });
    await page.goto('/pilotage/fournisseurs');
    const fournisseur = page.locator('tr[data-fiche-ouvrable]').filter({ hasText: nom });
    await fournisseur.getByRole('combobox', { name: `SSO de ${nom}`, exact: true }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await fournisseur.locator('td').first().click();
    await expect(page.getByRole('dialog')).toContainText(nom);
    await page.keyboard.press('Escape');
    await page.goto('/pilotage/objectifs?perimetre=00000000-0000-4000-8000-000000000001');
    const indicateur = page.locator('tr[data-fiche-ouvrable][data-etat]').first();
    await expect(indicateur).toBeVisible();
    await indicateur.locator('td').nth(1).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    const p = await perimetre(page);
    const o = await post(page, `/api/grc/${p.id}/objects`, task('Élément fictif du registre'));
    await page.goto('/registres/' + o.registreId);
    await page.locator('tr[data-fiche-titre="Afficher Élément fictif du registre"]').locator('td').nth(2).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/pilotage/actions');
    expect(new URL(page.url()).searchParams.get('perimetre')).toBe(p.id);
    await expect(page.getByRole('dialog').getByLabel('Nom de la fiche')).toHaveValue(o.name);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Tâches récurrentes : le losange ouvre la validation compacte et actualise le résultat', async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state });
  const page = await ctx.newPage(),
    errors = watchPage(page);
  try {
    await page.goto('/pilotage/recurrences');
    const p = await perimetre(page);
    const s = await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'task_series',
      name: 'Contrôle récurrent depuis le repère',
      data: {
        description: 'Série fictive de recette',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'day',
          interval: 1,
          until: null,
          count: 2,
          reminderDays: 7,
          active: true,
        },
      },
    });
    await expect
      .poll(async () => (await (await page.request.get(`/api/grc/${p.id}/series/${s.id}/occurrences`)).json()).length, {
        timeout: 150000,
        intervals: [3000],
      })
      .toBe(2);
    await page.goto(`/pilotage/recurrences?perimetre=${p.id}&tserie=${s.id}`);
    const point = page.locator('.task-occurrence').first();
    await point.focus();
    await point.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Résultat de réalisation', exact: true });
    await expect(dialog).toContainText('Validation de l’occurrence');
    await dialog.getByLabel('Commentaire', { exact: true }).fill('Contrôle fictif réalisé avec succès.');
    await dialog.getByRole('button', { name: 'Enregistrer la validation' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(point).toHaveAttribute('data-tone', 'teal');
    await expect(point).toBeFocused();
    await point.click();
    await expect(dialog).toContainText('Contrôle fictif réalisé avec succès.');
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});
