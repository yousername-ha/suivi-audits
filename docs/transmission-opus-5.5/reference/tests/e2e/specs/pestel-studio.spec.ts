/* Parcours du PESTEL Studio approuvé : instance isolée, droits et affectations existantes conservés. */
import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import type { EnjeuPestel, VuePestel } from '@suivi/shared';
import { csrfOf, sessionAdmin, watchPage, totp, PASSWORD } from '../helpers';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const endpoint = `/api/grc/${SOCLE}/pilotage/pestel`;
const route = `/pilotage/pestel?perimetre=${SOCLE}`;
const externes = (vue: VuePestel) => [...vue.parFacteur.flatMap((g) => g.enjeux), ...vue.nonClasses];
const payload = (vue: VuePestel) => Object.fromEntries(externes(vue).map((e) => [e.ref, e.facteur ?? '']));
const contenus = (vue: VuePestel) =>
  [...externes(vue), ...vue.internes]
    .map((e) => ({ ref: e.ref, label: e.label, nature: e.nature, description: e.description, processus: e.processus }))
    .sort((a, b) => a.ref.localeCompare(b.ref));
async function post(request: APIRequestContext, url: string, data: unknown) {
  const r = await request.post(url, { headers: { 'X-CSRF-Token': await csrfOf(request) }, data });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function restaurer(request: APIRequestContext, vue: VuePestel) {
  const r = await request.put(endpoint, {
    headers: { 'X-CSRF-Token': await csrfOf(request) },
    data: { assignments: payload(vue) },
  });
  expect(r.ok(), await r.text()).toBe(true);
  expect(await (await request.get(endpoint)).json()).toEqual(vue);
}
async function choisir(zone: Locator, label: string, option: string) {
  const input = zone.getByRole('combobox', { name: label, exact: true });
  await input.click();
  await zone.page().getByRole('option', { name: option, exact: true }).click();
}

test('PESTEL Studio : lecture, registre, recherche, processus et méthode sans écriture', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  try {
    const before: VuePestel = await (await ctx.request.get(endpoint)).json();
    const page = await ctx.newPage(),
      problems = watchPage(page),
      writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && new URL(r.url()).pathname === endpoint) writes.push(r.method());
    });
    await page.goto(route);
    await expect(page.locator('.pestel-factor-node')).toHaveCount(before.facteurs.length);
    const chiffres = page.getByRole('region', { name: 'Synthèse des enjeux', exact: true });
    await expect(chiffres.locator('b').nth(0)).toHaveText(String(externes(before).length));
    await expect(chiffres.locator('b').nth(1)).toHaveText(String(externes(before).length - before.nonClasses.length));
    await expect(chiffres.locator('b').nth(2)).toHaveText(String(before.nonClasses.length));
    await expect(chiffres.locator('b').nth(3)).toHaveText(String(before.internes.length));
    const f = before.facteurs[0]!;
    const bouton = page.locator('.pestel-factor-node').filter({ hasText: f.label });
    await bouton.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#pestel-factor-title')).toHaveText(f.label);
    await expect(bouton).toBeFocused();
    await page.reload();
    await expect(page.locator('#pestel-factor-title')).toHaveText(f.label);
    const e = externes(before)[0]!;
    await page.getByRole('button', { name: 'Registre complet', exact: true }).click();
    const registre = page.getByRole('region', { name: /^Registre complet/ });
    await expect(registre).toBeVisible();
    await expect(registre.locator('.pestel-registry-row')).toHaveCount(externes(before).length);
    await page.getByRole('searchbox', { name: 'Rechercher un enjeu', exact: true }).fill(e.label);
    await expect(registre.locator('.pestel-registry-row')).toHaveCount(1);
    await expect(registre).toContainText(e.description);
    for (const p of e.processus)
      await expect(registre.getByRole('group', { name: 'Processus concernés' })).toContainText(p);
    await page
      .getByRole('searchbox', { name: 'Rechercher un enjeu', exact: true })
      .fill('Sans correspondance fictive 914');
    await expect(registre).toContainText('Aucun enjeu ne correspond à votre recherche.');
    await page.getByRole('button', { name: 'Revenir à la vue graphique', exact: true }).click();
    await expect(registre).toBeHidden();
    await expect(page.getByRole('button', { name: 'Registre complet', exact: true })).toBeFocused();
    await page.locator('.pestel-internal-shelf > summary').click();
    await expect(page.locator('.pestel-internal-shelf article')).toHaveCount(before.internes.length);
    await expect(page.locator('.pestel-internal-shelf .mantine-Select-root')).toHaveCount(0);
    await page.locator('.pestel-methodology > summary').click();
    await expect(page.locator('.pestel-methodology p')).toContainText(
      'Le PESTEL n’est pas exigé par la norme ISO 9001:2015',
    );
    expect(await (await ctx.request.get(endpoint)).json()).toEqual(before);
    expect(writes).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('PESTEL Studio : classement persistant, retrait et échec de sauvegarde sans perte de contenu', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  const before: VuePestel = await (await ctx.request.get(endpoint)).json();
  try {
    const e: EnjeuPestel = externes(before)[0]!;
    const page = await ctx.newPage(),
      problems = watchPage(page);
    await page.goto(route + '&facteur=technologique');
    await page.getByRole('button', { name: 'Registre complet', exact: true }).click();
    const registre = page.getByRole('region', { name: /^Registre complet/ });
    const label = `Facteur de l’enjeu ${e.label} dans le registre`;
    const saved = page.waitForResponse((r) => new URL(r.url()).pathname === endpoint && r.request().method() === 'PUT');
    await choisir(registre, label, 'Technologique');
    expect((await saved).ok()).toBe(true);
    await expect
      .poll(async () => externes(await (await ctx.request.get(endpoint)).json()).find((x) => x.ref === e.ref)?.facteur)
      .toBe('technologique');
    await expect(page.locator('.pestel-focus-issue').filter({ hasText: e.label })).toBeVisible();
    await page.reload();
    await expect(page.locator('.pestel-focus-issue').filter({ hasText: e.label })).toBeVisible();
    await page.getByRole('button', { name: 'Registre complet', exact: true }).click();
    await page.route('**' + endpoint, (r) =>
      r.request().method() === 'PUT'
        ? r.fulfill({ status: 422, json: { error: 'Classement fictif refusé' } })
        : r.continue(),
    );
    const refused = page.waitForResponse(
      (r) => new URL(r.url()).pathname === endpoint && r.request().method() === 'PUT',
    );
    await choisir(registre, label, 'Économique');
    expect((await refused).status()).toBe(422);
    await expect(page.getByRole('alert')).toContainText('Classement fictif refusé');
    await expect(registre.getByRole('combobox', { name: label, exact: true })).toHaveValue('Technologique');
    await expect(registre.getByRole('combobox', { name: label, exact: true })).toBeFocused();
    await expect(page.locator('.pestel-status')).not.toContainText('Classement enregistré.');
    await page.unroute('**' + endpoint);
    const cleared = page.waitForResponse(
      (r) => new URL(r.url()).pathname === endpoint && r.request().method() === 'PUT',
    );
    await registre
      .getByRole('button', { name: `Retirer le classement de l’enjeu ${e.label} dans le registre`, exact: true })
      .click();
    expect((await cleared).ok()).toBe(true);
    await expect(registre.getByRole('combobox', { name: label, exact: true })).toBeFocused();
    await expect
      .poll(async () =>
        (await (await ctx.request.get(endpoint)).json()).nonClasses.some((x: EnjeuPestel) => x.ref === e.ref),
      )
      .toBe(true);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(contenus(await (await ctx.request.get(endpoint)).json())).toEqual(contenus(before));
    expect(problems).toEqual([]);
  } finally {
    await restaurer(ctx.request, before);
    await ctx.close();
  }
});

test('PESTEL Studio : lecteur sans commande de classement et refus serveur 403', async ({ browser }) => {
  const admin = await browser.newContext({ storageState: (await sessionAdmin(browser)).state });
  const reader = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const before: VuePestel = await (await admin.request.get(endpoint)).json(),
      suffix = Date.now().toString(36);
    const role = await post(admin.request, '/api/admin/roles', { from: 'lecteur', name: `PESTEL lecture ${suffix}` });
    expect(
      (
        await admin.request.patch('/api/admin/roles/' + role.id, {
          headers: { 'X-CSRF-Token': await csrfOf(admin.request), 'If-Match': `"${role.version}"` },
          data: { permissions: ['pilotage:lire'] },
        })
      ).ok(),
    ).toBe(true);
    const username = `lecture-pestel-${suffix}`;
    const user = await post(admin.request, '/api/admin/users', {
      username,
      displayName: 'Lecteur fictif PESTEL',
      roles: [{ roleId: role.id }],
    });
    expect(
      (await reader.request.post('/api/auth/login', { data: { username, password: user.temporaryPassword } })).ok(),
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
    const page = await reader.newPage(),
      problems = watchPage(page);
    await page.goto(route);
    await expect(page.locator('.pestel-factor-node')).toHaveCount(before.facteurs.length);
    await expect(page.locator('.pestel-assignment')).toHaveCount(0);
    await page.getByRole('button', { name: 'Registre complet', exact: true }).click();
    await expect(page.locator('.pestel-registry-row')).toHaveCount(externes(before).length);
    await expect(page.locator('.pestel-assignment')).toHaveCount(0);
    const denied = await reader.request.put(endpoint, {
      headers: { 'X-CSRF-Token': await csrfOf(reader.request) },
      data: { assignments: { [externes(before)[0]!.ref]: 'technologique' } },
    });
    expect(denied.status()).toBe(403);
    expect(await (await admin.request.get(endpoint)).json()).toEqual(before);
    expect(problems).toEqual([]);
  } finally {
    await reader.close();
    await admin.close();
  }
});

test('PESTEL Studio : nomenclature personnalisée, état vide, erreur de lecture et autre périmètre', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  try {
    const before: VuePestel = await (await ctx.request.get(endpoint)).json();
    const page = await ctx.newPage(),
      problems = watchPage(page);
    const facteurs = Array.from({ length: 7 }, (_, i) => ({
      id: `dimension-${i}`,
      label: `Dimension personnalisée ${i + 1} au libellé long`,
    }));
    let reponse: VuePestel | null = {
      ...before,
      facteurs,
      parFacteur: facteurs.map((facteur) => ({ facteur, enjeux: [] })),
      nonClasses: externes(before),
    };
    await page.route('**' + endpoint, (r) =>
      r.fulfill(reponse ? { json: reponse } : { status: 503, json: { error: 'Lecture fictive indisponible' } }),
    );
    await page.goto(route);
    await expect(page.locator('.pestel-factor-node')).toHaveCount(7);
    await expect(page.locator('.pestel-constellation-dense')).toBeVisible();
    await page.locator('.pestel-factor-node').last().click();
    await expect(page.locator('#pestel-factor-title')).toHaveText(facteurs[6]!.label);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    reponse = { facteurs: [], parFacteur: [], nonClasses: [], internes: [] };
    await page.reload();
    await expect(page.locator('.pestel-factor-node')).toHaveCount(0);
    await expect(page.locator('#pestel-factor-title')).toHaveText('Aucun facteur défini');
    await expect(page.locator('.pestel-source-empty')).toContainText('Aucun enjeu');
    reponse = null;
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Lecture fictive indisponible');
    await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeVisible();
    reponse = before;
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
    await expect(page.locator('.pestel-factor-node')).toHaveCount(before.facteurs.length);
    const scope = await post(ctx.request, '/api/grc/smsis', {
      name: 'PESTEL hors socle ' + Date.now().toString(36),
      scope: 'Recette fictive',
      timezone: 'Europe/Paris',
    });
    await page.goto('/pilotage/pestel?perimetre=' + scope.id);
    await expect(
      page.getByText('Le PESTEL s’appuie sur le contexte du pilotage commun de l’organisation.'),
    ).toBeVisible();
    await expect(page.locator('.pestel-studio')).toHaveCount(0);
    expect(await (await ctx.request.get(endpoint)).json()).toEqual(before);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
