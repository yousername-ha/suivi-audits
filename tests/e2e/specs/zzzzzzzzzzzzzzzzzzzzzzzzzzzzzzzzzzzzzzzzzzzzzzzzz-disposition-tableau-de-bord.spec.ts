/* Disposition du tableau de bord de l'accueil (ADR 0078, lots 2a à 2c ; tableau unique, ADR 0108 ; tableaux multiples,
   ADR 0109) : créer un tableau depuis la disposition standard, déplacer une dalle au clavier et au glisser, changer sa
   largeur et sa hauteur, la masquer puis la rajouter depuis le catalogue, ajouter une dalle classique et une copie d'une
   carte, changer une visualisation, enregistrer (la disposition survit au rechargement), puis supprimer le tableau : le
   premier favori, Global, montre la disposition de la vue analytique. Puis partager un tableau avec un compte Lecteur,
   qui l'affiche depuis la liste de ses tableaux (⌄), l'ajoute à ses favoris et l'affiche sans pouvoir le modifier. Les
   tableaux créés sont supprimés à la fin. */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { creerEcartCommun, csrfOf, markTotpUsed, PASSWORD, sessionAdmin, totp, watchPage } from '../helpers';

/** Identifiants des dalles affichées, dans l'ordre de la grille (mode modification). */
const ordreEdition = (page: Page) =>
  page.locator('.tdb-grille > [data-dalle]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.dalle));
/** Titres des dalles affichées, dans l'ordre de la grille (mode lecture). */
const ordreLecture = (page: Page) =>
  page.locator('.tdb-grille > section').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

/** Barre des favoris de l'accueil (onglets des tableaux de bord). */
const favoris = (page: Page) => page.getByRole('tablist', { name: 'Mes favoris' });
/** Bouton déroulant ⌄ de la liste de tous ses tableaux de bord. */
const boutonListe = (page: Page) => page.getByRole('button', { name: 'Mes tableaux de bord', exact: true });

/** Crée un tableau depuis la disposition standard par le bouton « + » ; il s'ouvre en modification. */
async function creerTableau(page: Page, nom: string) {
  await page.getByRole('button', { name: 'Créer un tableau de bord', exact: true }).click();
  const fenetre = page.getByRole('dialog', { name: 'Créer un tableau de bord' });
  await fenetre.getByLabel('Nom').fill(nom);
  await fenetre.getByRole('radio', { name: /Disposition standard/ }).click();
  await fenetre.getByRole('button', { name: 'Créer et modifier' }).click();
  await expect(page.getByRole('region', { name: 'Modifier la disposition du tableau de bord' })).toBeVisible();
}

/** Nettoyage : supprime les tableaux du compte, favoris ou non (liste complète, puis version lue par GET /:id pour
    l'If-Match). */
async function supprimerMesTableaux(rq: APIRequestContext, csrf: string) {
  const r = await rq.get('/api/tableaux-de-bord');
  if (!r.ok()) return;
  const { disponibles } = (await r.json()) as { disponibles: { id: string; origine: string }[] };
  for (const t of disponibles.filter((o) => o.origine === 'mien')) {
    const d = await rq.get(`/api/tableaux-de-bord/${t.id}`);
    if (!d.ok()) continue;
    const { version } = (await d.json()) as { version: number };
    await rq.delete(`/api/tableaux-de-bord/${t.id}`, {
      headers: { 'x-csrf-token': csrf, 'if-match': `"${version}"` },
    });
  }
}

test('disposition du tableau de bord : créer, clavier, glisser, largeur, masquer, enregistrer, supprimer', async ({
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
    // Premier favori d'un compte : Global, la disposition de la vue analytique (ADR 0109).
    await expect(favoris(page).getByRole('tab', { name: /^Global/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.tdb-grille > section').first()).toBeVisible();
    const standard = await ordreLecture(page);
    expect(standard.length).toBeGreaterThanOrEqual(3);

    await creerTableau(page, 'Recette disposition');
    const depart = await ordreEdition(page);
    // Disposition standard : celle de la vue analytique, bandeau en tête (ADR 0108).
    expect(depart[0]).toBe('bandeau');

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

    // Glisser : le bandeau, pris par sa poignée, est déposé sur la carte « Plan d’action ».
    const avantGlisser = await ordreEdition(page);
    const phare = page.locator('[data-dalle="bandeau"] .tdb-poignee').boundingBox();
    const cible = page.locator('[data-dalle="plan-action"]').boundingBox();
    const [a, b] = await Promise.all([phare, cible]);
    await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
    await page.mouse.down();
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 12 });
    await page.mouse.up();
    const apresGlisser = await ordreEdition(page);
    expect(apresGlisser).not.toEqual(avantGlisser);
    expect(apresGlisser.indexOf('bandeau')).toBeGreaterThan(avantGlisser.indexOf('bandeau'));

    // Largeur, puis masquer et rajouter depuis le catalogue.
    await page.getByLabel('Largeur de « Plan d’action »').selectOption('12');
    await expect(page.locator('[data-dalle="plan-action"]')).toHaveClass(/tdb-l12/);

    // Largeur au glisser (lot 2d) : le bord droit tiré jusqu'au milieu de la dalle l'aimante sur « la moitié », annoncée ;
    // au clavier, deux flèches à droite la rendent à toute la largeur.
    const echeances = page.locator('[data-dalle="plan-action"]');
    const annonceEdition = page
      .getByRole('region', { name: 'Modifier la disposition du tableau de bord' })
      .locator('[aria-live="polite"]');
    const bord = echeances.getByRole('button', { name: /^Redimensionner « Plan d’action »/ });
    await bord.scrollIntoViewIfNeeded();
    const [zoneBord, zoneCase] = await Promise.all([bord.boundingBox(), echeances.boundingBox()]);
    await page.mouse.move(zoneBord!.x + zoneBord!.width / 2, zoneBord!.y + zoneBord!.height / 2);
    await page.mouse.down();
    await page.mouse.move(zoneCase!.x + zoneCase!.width / 2, zoneBord!.y + zoneBord!.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(echeances).toHaveClass(/tdb-l6/);
    await expect(annonceEdition).toHaveText(/« Plan d’action » : position \d+ sur \d+, la moitié\./);
    await bord.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(echeances).toHaveClass(/tdb-l12/);
    await expect(annonceEdition).toHaveText('« Plan d’action » : toute la largeur.');
    // Hauteur (ADR 0108) : la liste puis le bord bas au clavier.
    await page.getByLabel('Hauteur de « Plan d’action »').selectOption('8');
    await expect(echeances).toHaveClass(/tdb-h8/);
    await echeances.getByRole('button', { name: /^Redimensionner en hauteur « Plan d’action »/ }).focus();
    await page.keyboard.press('ArrowUp');
    await expect(echeances).toHaveClass(/tdb-h6/);
    await expect(annonceEdition).toHaveText('« Plan d’action » : une rangée et demie.');
    await page.getByRole('button', { name: 'Masquer « Audits & constats »', exact: true }).click();
    await expect(page.locator('[data-dalle="constats"]')).toHaveCount(0);
    // Catalogue : la carte masquée revient ; une dalle classique s'ajoute ; une carte affichée s'ajoute en copie.
    await page.getByRole('button', { name: '+ Ajouter une dalle' }).click();
    const catalogue = page.getByRole('dialog', { name: 'Ajouter une dalle' });
    await catalogue.getByRole('button', { name: 'Ajouter « Audits & constats »', exact: true }).click();
    await expect(page.locator('[data-dalle="constats"]')).toHaveCount(1);
    await catalogue.getByRole('button', { name: 'Ajouter « Écarts par statut »', exact: true }).click();
    await catalogue.getByRole('button', { name: 'Ajouter encore « Bandeau ISO 27001 / HDS »', exact: true }).click();
    await expect(page.locator('[data-cle="bandeau~2"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(catalogue).toHaveCount(0);
    await page.getByRole('button', { name: 'Masquer « Audits & constats »', exact: true }).click();

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

    // Mode lecture : ordre enregistré, « Audits & constats » masquée, taille appliquée, copie du bandeau présente ;
    // identique après rechargement.
    const verifier = async () => {
      // Les dalles arrivent avec la synthèse, après le titre de la page : on attend leur affichage avant de les compter.
      await expect(page.locator('.tdb-grille > section')).toHaveCount(voulu.length);
      expect((await ordreLecture(page)).length).toBe(voulu.length);
      await expect(page.locator('.tdb-grille > section[aria-label="Audits & constats"]')).toHaveCount(0);
      await expect(page.locator('.tdb-grille > section[aria-label="Plan d’action"]')).toHaveClass(/tdb-l12/);
      await expect(page.locator('.tdb-grille > section[aria-label="Plan d’action"]')).toHaveClass(/tdb-h6/);
      await expect(page.locator('.tdb-grille > section[aria-label="Bandeau ISO 27001 / HDS"]')).toHaveCount(2);
      await expect(page.locator('.tdb-grille > section[aria-label="Écarts par statut"] .graph-anneau')).toHaveCount(1);
    };
    await verifier();
    // Après rechargement, le premier favori (Global) s'ouvre ; le tableau créé est le dernier favori.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
    await favoris(page)
      .getByRole('tab', { name: /^Recette disposition/ })
      .click();
    await verifier();

    // Suppression du tableau : retour au premier favori, la disposition de la vue analytique.
    await page.getByRole('button', { name: 'Modifier la disposition' }).click();
    await page.getByRole('button', { name: 'Supprimer ce tableau' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(favoris(page).getByRole('tab', { name: /^Recette disposition/ })).toHaveCount(0);
    await expect(page.locator('.tdb-grille > section[aria-label="Audits & constats"]')).toHaveCount(1);
    expect(await ordreLecture(page)).toEqual(standard);
    expect(problems).toEqual([]);
  } finally {
    // Nettoyage si le test s'arrête avant la fin : les tableaux du compte d'administration sont supprimés.
    await supprimerMesTableaux(ctx.request, session.csrf);
    await ctx.close();
  }
});

test('partage du tableau de bord : un compte Lecteur l’affiche depuis sa liste, l’ajoute à ses favoris, sans le modifier', async ({
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
    // L'administrateur crée un tableau (le bandeau, en tête de la disposition standard, passe en dernier), puis le
    // partage au Lecteur.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
    await creerTableau(page, 'Recette partage');
    const poignee = page.locator('[data-dalle="bandeau"] .tdb-poignee');
    await poignee.focus();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: 'Partager' })).toBeVisible();
    const voulu = await ordreLecture(page);
    expect(voulu.at(-1)).toBe('Bandeau ISO 27001 / HDS');

    await page.getByRole('button', { name: 'Partager' }).click();
    const zone = page.getByRole('region', { name: 'Partager mon tableau de bord' });
    await zone.getByRole('combobox', { name: 'Partager avec' }).click();
    await zone.getByRole('combobox', { name: 'Partager avec' }).fill('Lecture du');
    await zone.getByRole('option', { name: /Lecture du tableau/ }).click();
    await zone.getByRole('button', { name: 'Enregistrer le partage' }).click();
    await expect(zone).toHaveCount(0);
    const { disponibles } = (await (await rq.get('/api/tableaux-de-bord')).json()) as {
      disponibles: { id: string; nom: string; origine: string }[];
    };
    const tableau = disponibles.find((o) => o.origine === 'mien' && o.nom === 'Recette partage')!;
    const partage = await (await rq.get(`/api/tableaux-de-bord/${tableau.id}/partage`)).json();
    expect(partage.destinataires).toEqual([expect.objectContaining({ type: 'utilisateur', id: lecteurId })]);

    // Le Lecteur (session déjà ouverte par l'enrôlement : une connexion de moins dans la limite par adresse) : pas de
    // bouton de modification ni de création ; il affiche le tableau reçu depuis la liste de ses tableaux (⌄), hors
    // favoris, puis l'ajoute à ses favoris ; il suit l'ordre de l'administrateur (bandeau en dernier).
    const lecteur = lc;
    try {
      expect((await (await lecteur.request.get('/api/auth/me')).json()).stage).toBe('ok');
      const lp = await lecteur.newPage();
      const problemesLecteur = watchPage(lp);
      await lp.goto('/');
      await expect(lp.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
      await expect(lp.getByRole('button', { name: 'Modifier la disposition' })).toHaveCount(0);
      await expect(lp.getByRole('button', { name: 'Partager' })).toHaveCount(0);
      await expect(boutonListe(lp)).toBeVisible();
      await expect(lp.getByRole('button', { name: 'Créer un tableau de bord', exact: true })).toHaveCount(0);
      // Affiché depuis la liste, hors favoris : disposition de l'administrateur, son nom et son descriptif en haut, aucun
      // favori sélectionné ni retrait des favoris.
      await boutonListe(lp).click();
      const liste = lp.getByRole('list', { name: 'Mes tableaux de bord' });
      await liste.getByRole('button', { name: /^Recette partage/ }).click();
      await expect.poll(async () => (await ordreLecture(lp)).at(-1)).toBe('Bandeau ISO 27001 / HDS');
      await expect(lp.getByRole('note').filter({ hasText: 'Tableau partagé par' })).toBeVisible();
      await expect(lp.getByRole('heading', { level: 2, name: 'Recette partage', exact: true })).toBeVisible();
      await expect(lp.getByText(/^Tableau partagé de .+, en lecture seule$/)).toBeVisible();
      await expect(favoris(lp).getByRole('tab', { name: /^Recette partage/ })).toHaveCount(0);
      await expect(favoris(lp).getByRole('tab', { selected: true })).toHaveCount(0);
      await expect(lp.getByRole('button', { name: 'Retirer de mes favoris' })).toHaveCount(0);
      // Ajouté aux favoris : il prend un onglet, sélectionné, et peut en être retiré.
      await boutonListe(lp).click();
      await liste.getByRole('button', { name: 'Ajouter « Recette partage » aux favoris' }).click();
      await expect(liste.getByRole('button', { name: 'Retirer « Recette partage » des favoris' })).toBeVisible();
      await boutonListe(lp).click();
      await expect(liste).toBeHidden();
      await expect(favoris(lp).getByRole('tab', { name: /^Recette partage/ })).toHaveAttribute('aria-selected', 'true');
      await expect(lp.getByRole('heading', { level: 2, name: 'Recette partage', exact: true })).toHaveCount(0);
      await expect(lp.getByRole('button', { name: 'Retirer de mes favoris' })).toBeVisible();
      await expect.poll(async () => (await ordreLecture(lp)).at(-1)).toBe('Bandeau ISO 27001 / HDS');
      await expect(lp.getByRole('button', { name: 'Modifier la disposition' })).toHaveCount(0);
      await lp.reload();
      await expect(lp.getByRole('heading', { level: 1, name: /^Bonjour/ })).toBeVisible();
      await favoris(lp)
        .getByRole('tab', { name: /^Recette partage/ })
        .click();
      await expect.poll(async () => (await ordreLecture(lp)).at(-1)).toBe('Bandeau ISO 27001 / HDS');
      // Sans le droit, il ne peut ni le copier ni créer de tableau (le serveur refuse aussi).
      await expect(lp.getByRole('button', { name: 'Copier comme mon tableau' })).toHaveCount(0);
      const refus = await lecteur.request.post('/api/tableaux-de-bord', {
        data: { nom: 'Refus', depart: { type: 'vide' } },
        headers: { 'x-csrf-token': await csrfOf(lecteur.request) },
      });
      expect(refus.status()).toBe(403);
      expect(problemesLecteur).toEqual([]);
    } finally {
      await lecteur.close();
    }
    expect(problems).toEqual([]);
  } finally {
    // Nettoyage : les tableaux et leurs partages disparaissent, le compte Lecteur est supprimé.
    await supprimerMesTableaux(rq, session.csrf);
    await rq.delete(`/api/admin/users/${lecteurId}`, { headers: entete });
    await lc.close();
    await ctx.close();
  }
});
