/* Disposition du tableau de bord de l'accueil (ADR 0078, lots 2a à 2c) : déplacer une dalle au clavier et au glisser,
   changer sa largeur, la masquer puis la réafficher, changer sa visualisation, enregistrer (la disposition survit au rechargement), puis revenir à
   la disposition par défaut. Puis partager sa disposition avec un compte Lecteur, qui l'affiche sans pouvoir la
   modifier. Le compte d'administration reprend ensuite la disposition standard. */
import { expect, test, type Page } from '@playwright/test';
import { creerEcartCommun, csrfOf, markTotpUsed, PASSWORD, sessionAdmin, totp, watchPage } from '../helpers';

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
    // Annonce de la zone d'édition (le menu a sa propre zone d'annonce).
    await expect(
      page.getByRole('region', { name: 'Modifier la disposition du tableau de bord' }).locator('[aria-live="polite"]'),
    ).toHaveText(/position 1 sur \d+/);
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

    // Réglages (lot 2c) : « Écarts par statut » passe en anneau, aperçu immédiat.
    const statut = page.locator('[data-dalle="ecarts-statut"]');
    await expect(statut.locator('.graph-anneau')).toHaveCount(0);
    await page.getByRole('button', { name: 'Réglages de « Écarts par statut »' }).click();
    await page
      .getByRole('group', { name: 'Réglages de « Écarts par statut »' })
      .getByLabel('Visualisation')
      .selectOption({ label: 'Anneau' });
    await expect(statut.locator('.graph-anneau')).toHaveCount(1);

    const voulu = await ordreEdition(page);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: 'Modifier la disposition' })).toBeVisible();

    // Mode lecture : ordre enregistré, « Écarts » masquée, largeur appliquée ; identique après rechargement.
    const verifier = async () => {
      expect((await ordreLecture(page)).length).toBe(voulu.length);
      await expect(page.locator('.tdb-grille > section[aria-label="Écarts"]')).toHaveCount(0);
      await expect(page.locator('.tdb-grille > section[aria-label="Prochaines échéances"]')).toHaveClass(/tdb-l12/);
      await expect(page.locator('.tdb-grille > section[aria-label="Écarts par statut"] .graph-anneau')).toHaveCount(1);
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

test('partage du tableau de bord : un compte Lecteur reçoit la disposition et l’affiche, sans la modifier', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const session = await sessionAdmin(browser);
  const ctx = await browser.newContext({
    storageState: session.state,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const rq = ctx.request;
  const entete = { 'x-csrf-token': session.csrf };
  // Compte Lecteur (sans le droit tableau_de_bord:modifier), double authentification enrôlée par l'API.
  const username = 'lecteur-tdb';
  const cree = await rq.post('/api/admin/users', {
    data: { username, displayName: 'Lecture du tableau', roles: [{ roleId: 'lecteur' }] },
    headers: entete,
  });
  expect(cree.status(), await cree.text()).toBe(201);
  const { id: lecteurId, temporaryPassword } = (await cree.json()) as { id: string; temporaryPassword: string };
  const lc = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  await lc.request.post('/api/auth/login', { data: { username, password: temporaryPassword } });
  let csrf = await csrfOf(lc.request);
  const begin = await (
    await lc.request.post('/api/account/totp/begin', { data: {}, headers: { 'x-csrf-token': csrf } })
  ).json();
  await lc.request.post('/api/account/totp/confirm', {
    data: { code: totp(begin.secret) },
    headers: { 'x-csrf-token': csrf },
  });
  markTotpUsed(begin.secret);
  csrf = await csrfOf(lc.request);
  const mdp = await lc.request.post('/api/account/password', {
    data: { current: temporaryPassword, next: PASSWORD },
    headers: { 'x-csrf-token': csrf },
  });
  expect(mdp.ok(), await mdp.text()).toBe(true);

  const page = await ctx.newPage();
  const problems = watchPage(page);
  try {
    // L'administrateur enregistre une disposition (« Prochaines échéances » en tête), puis la partage au Lecteur.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
    await page.getByRole('button', { name: 'Modifier la disposition' }).click();
    const poignee = page.locator('[data-dalle="echeances"] .tdb-poignee');
    await poignee.focus();
    await page.keyboard.press('Home');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: 'Partager' })).toBeVisible();
    const voulu = await ordreLecture(page);
    expect(voulu[0]).toBe('Prochaines échéances');

    await page.getByRole('button', { name: 'Partager' }).click();
    const zone = page.getByRole('region', { name: 'Partager mon tableau de bord' });
    await zone.getByRole('combobox', { name: 'Partager avec' }).click();
    await zone.getByRole('combobox', { name: 'Partager avec' }).fill('Lecture du');
    await zone.getByRole('option', { name: /Lecture du tableau/ }).click();
    await zone.getByRole('button', { name: 'Enregistrer le partage' }).click();
    await expect(zone).toHaveCount(0);
    const partage = await (await rq.get('/api/tableau-de-bord/partage')).json();
    expect(partage.destinataires).toEqual([expect.objectContaining({ type: 'utilisateur', id: lecteurId })]);

    // Le Lecteur (session déjà ouverte par l'enrôlement : une connexion de moins dans la limite par adresse) : pas de
    // bouton de modification ; il choisit le tableau reçu, qui suit l'ordre de l'administrateur.
    const lecteur = lc;
    try {
      expect((await (await lecteur.request.get('/api/auth/me')).json()).stage).toBe('ok');
      const lp = await lecteur.newPage();
      const problemesLecteur = watchPage(lp);
      await lp.goto('/');
      await expect(lp.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
      await expect(lp.getByRole('button', { name: 'Modifier la disposition' })).toHaveCount(0);
      await expect(lp.getByRole('button', { name: 'Partager' })).toHaveCount(0);
      const choix = lp.getByLabel('Tableau affiché');
      await expect(choix).toBeVisible();
      const recu = lp.locator('select.mantine-NativeSelect-input option', { hasText: /^Tableau de bord de / });
      await choix.selectOption({ label: (await recu.first().textContent())! });
      await expect.poll(async () => (await ordreLecture(lp))[0]).toBe('Prochaines échéances');
      await lp.reload();
      await expect(lp.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
      await expect(lp.getByLabel('Tableau affiché')).toHaveValue(/.+/);
      await expect.poll(async () => (await ordreLecture(lp))[0]).toBe('Prochaines échéances');
      // Sans le droit, il ne peut pas en faire sa disposition (le serveur refuse aussi).
      await expect(lp.getByRole('button', { name: 'Copier comme mon tableau' })).toHaveCount(0);
      const refus = await lecteur.request.put('/api/tableau-de-bord/disposition', {
        data: { disposition: { dalles: [] } },
        headers: { 'x-csrf-token': await csrfOf(lecteur.request), 'if-match': '"0"' },
      });
      expect(refus.status()).toBe(403);
      expect(problemesLecteur).toEqual([]);
    } finally {
      await lecteur.close();
    }
    expect(problems).toEqual([]);
  } finally {
    // Nettoyage : la disposition et ses partages disparaissent, le compte Lecteur est supprimé.
    await rq.delete('/api/tableau-de-bord/disposition', { headers: entete });
    await rq.delete(`/api/admin/users/${lecteurId}`, { headers: entete });
    await lc.close();
    await ctx.close();
  }
});
