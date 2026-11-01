/* Contexte : consultation sans formulaire ni écriture, modification explicite et droits d'un lecteur réel.
   Toutes les fiches et tous les comptes créés sont fictifs, sur la pile de recette. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { csrfOf, PASSWORD, sessionAdmin, totp, watchPage } from '../helpers';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const base = `/api/grc/${SOCLE}/objects`;
async function contexte(req: APIRequestContext, name: string) {
  const response = await req.post(base, {
    headers: { 'x-csrf-token': await csrfOf(req) },
    data: {
      kind: 'context',
      name,
      data: {
        description: 'Contexte fictif de recette.',
        organisation: 'Organisation de démonstration',
        scope: 'Accueil et services numériques',
        interfaces: 'Hébergeur fictif, éditeur (dossiers, imagerie), partenaire fictif',
        issues: 'Évolution de la réglementation\nDisponibilité des services',
        exclusions: '',
        refs: [],
      },
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<{ id: string; version: number }>;
}

test('Contexte : afficher, agrandir, annuler et enregistrer une modification explicite', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const name = `Contexte présentation ${Date.now().toString(36)}`;
    const object = await contexte(ctx.request, name);
    const before = await (await ctx.request.get(`${base}/${object.id}`)).json();
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET' && /\/api\/grc\/.*\/(objects|links)(\/|\?|$)/.test(request.url()))
        writes.push(request.method());
    });
    await page.goto(`/pilotage/contexte?ouvrir=${object.id}`);
    let view = page.getByRole('dialog', { name: 'Périmètre et contexte', exact: true });
    await expect(view.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(view.getByRole('textbox')).toHaveCount(0);
    await expect(view.getByRole('combobox')).toHaveCount(0);
    await expect(view.getByRole('region', { name: /Exclusions et justification/ })).toContainText('Non renseigné');
    await expect(view.getByRole('region', { name: /Enjeux internes et externes/ }).getByRole('listitem')).toHaveText([
      'Évolution de la réglementation',
      'Disponibilité des services',
    ]);
    await expect(view.getByRole('region', { name: /Interfaces et dépendances/ }).getByRole('listitem')).toHaveText([
      'Hébergeur fictif',
      'éditeur (dossiers, imagerie)',
      'partenaire fictif',
    ]);
    await view.getByRole('button', { name: 'Agrandir', exact: true }).click();
    await expect(view).toHaveAttribute('data-full-screen', 'true');
    await view.getByRole('button', { name: 'Réduire', exact: true }).click();
    for (const tab of ['Liens et justificatifs', 'Historique']) {
      await view.getByRole('tab', { name: tab, exact: true }).click();
      await expect(view.getByRole('tabpanel', { name: tab, exact: true })).toBeVisible();
      await expect(view.getByRole('textbox')).toHaveCount(0);
      await expect(view.getByRole('combobox')).toHaveCount(0);
    }
    expect(writes).toEqual([]);
    expect((await (await ctx.request.get(`${base}/${object.id}`)).json()).version).toBe(before.version);

    await view.getByRole('button', { name: 'Modifier', exact: true }).click();
    let edit = page.getByRole('dialog', { name: 'Modifier — Périmètre et contexte', exact: true });
    await expect(edit.getByLabel('Intitulé', { exact: true })).toHaveValue(name);
    // Une fiche longue défile depuis le voile extérieur, jamais dans son corps ou ses onglets.
    await page.setViewportSize({ width: 390, height: 844 });
    const voile = page.locator('.mantine-Modal-inner');
    await edit.getByLabel('Intitulé', { exact: true }).hover();
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => voile.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    for (const zone of [edit, edit.locator('.mantine-Modal-body'), edit.locator('.mantine-Tabs-root')])
      expect(await zone.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2);
    await edit.getByRole('button', { name: 'Annuler', exact: true }).scrollIntoViewIfNeeded();
    await expect(edit.getByRole('button', { name: 'Annuler', exact: true })).toBeInViewport();
    await edit.getByLabel('Organisation', { exact: true }).fill('Brouillon à annuler');
    await edit.getByRole('button', { name: 'Annuler', exact: true }).click();
    view = page.getByRole('dialog', { name: 'Périmètre et contexte', exact: true });
    await expect(view.getByText('Organisation de démonstration', { exact: true })).toBeVisible();
    expect(writes).toEqual([]);
    await view.getByRole('button', { name: 'Modifier', exact: true }).click();
    edit = page.getByRole('dialog', { name: 'Modifier — Périmètre et contexte', exact: true });
    await expect(edit.getByLabel('Organisation', { exact: true })).toHaveValue('Organisation de démonstration');
    await edit.getByLabel('Organisation', { exact: true }).fill('Organisation mise à jour');
    await edit.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const after = await (await ctx.request.get(`${base}/${object.id}`)).json();
    expect(after.data.organisation).toBe('Organisation mise à jour');
    expect(after.data.interfaces).toBe('Hébergeur fictif, éditeur (dossiers, imagerie), partenaire fictif');
    expect(after.version).toBeGreaterThan(before.version);
    expect(writes).toEqual(['PUT']);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Afficher', exact: true })
      .click();
    view = page.getByRole('dialog', { name: 'Périmètre et contexte', exact: true });
    await expect(view.getByText('Organisation mise à jour', { exact: true })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await view.getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.getByRole('button', { name: 'Ajouter périmètre et contexte', exact: true }).click();
    const creation = page.getByRole('dialog', { name: 'Ajouter — Périmètre et contexte', exact: true });
    await expect(creation.getByLabel('Intitulé', { exact: true })).toHaveValue('');
    await expect(creation.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
    await creation.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes).toEqual(['PUT']);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Contexte : un lecteur consulte sur mobile sans commandes de modification', async ({ browser }) => {
  const admin = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: admin.state, ignoreHTTPSErrors: true });
  const reader = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  try {
    const suffix = Date.now().toString(36),
      name = `Contexte auditeur ${suffix}`;
    const object = await contexte(ctx.request, name);
    const roleResponse = await ctx.request.post('/api/admin/roles', {
      headers: { 'x-csrf-token': admin.csrf },
      data: { from: 'lecteur', name: `Lecture contexte ${suffix}` },
    });
    expect(roleResponse.status()).toBe(201);
    const role = await roleResponse.json();
    const permissions = await ctx.request.patch(`/api/admin/roles/${role.id}`, {
      headers: { 'x-csrf-token': admin.csrf, 'if-match': `"${role.version}"` },
      data: { permissions: ['pilotage:lire'] },
    });
    expect(permissions.status()).toBe(200);
    const username = `contexte-lecteur-${suffix}`;
    const userResponse = await ctx.request.post('/api/admin/users', {
      headers: { 'x-csrf-token': admin.csrf },
      data: { username, displayName: 'Lecteur fictif du contexte', roles: [{ roleId: role.id }] },
    });
    expect(userResponse.status()).toBe(201);
    const temporary = (await userResponse.json()).temporaryPassword as string;
    expect((await reader.request.post('/api/auth/login', { data: { username, password: temporary } })).ok()).toBe(true);
    let csrf = await csrfOf(reader.request);
    const begin = await reader.request.post('/api/account/totp/begin', { data: {}, headers: { 'x-csrf-token': csrf } });
    expect(begin.ok()).toBe(true);
    const secret = (await begin.json()).secret as string;
    expect(
      (
        await reader.request.post('/api/account/totp/confirm', {
          data: { code: totp(secret) },
          headers: { 'x-csrf-token': csrf },
        })
      ).ok(),
    ).toBe(true);
    csrf = await csrfOf(reader.request);
    expect(
      (
        await reader.request.post('/api/account/password', {
          data: { current: temporary, next: PASSWORD },
          headers: { 'x-csrf-token': csrf },
        })
      ).ok(),
    ).toBe(true);
    expect((await (await reader.request.get('/api/auth/me')).json()).stage).toBe('ok');
    const page = await reader.newPage(),
      problems = watchPage(page);
    await page.goto(`/pilotage/contexte?ouvrir=${object.id}`);
    const view = page.getByRole('dialog', { name: 'Périmètre et contexte', exact: true });
    await expect(view.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(view.getByRole('button', { name: 'Modifier', exact: true })).toHaveCount(0);
    for (const tab of ['Présentation', 'Liens et justificatifs', 'Historique']) {
      await view.getByRole('tab', { name: tab, exact: true }).click();
      await expect(view.getByRole('textbox')).toHaveCount(0);
      await expect(view.getByRole('combobox')).toHaveCount(0);
      await expect(view.getByRole('button', { name: /Enregistrer|Retirer/ })).toHaveCount(0);
    }
    await expect(view.getByText('Version 1', { exact: true })).toBeVisible();
    await expect(view.getByRole('alert')).toHaveCount(0);
    const denied = await reader.request.put(`${base}/${object.id}`, {
      headers: { 'x-csrf-token': csrf, 'if-match': `"${object.version}"` },
      data: { kind: 'context', name, data: { organisation: 'Modification refusée' } },
    });
    expect(denied.status()).toBe(403);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await view.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await reader.close();
    await ctx.close();
  }
});
