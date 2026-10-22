/* Processus en cartes (Organisation) : création d'un processus et d'un sous-processus, classement par type du registre,
   rattachement et détachement d'un objectif, présence du processus dans la cartographie. Données fictives. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

test('Processus : cartes par type, sous-processus, rattachement d’un objectif, cartographie', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36);
  const racine = `Accueil ${suffixe}`,
    enfant = `Admission ${suffixe}`,
    objectif = `Réduire les délais ${suffixe}`;
  try {
    await page.goto('/pilotage/contexte');
    const socle = '00000000-0000-4000-8000-000000000001';
    const r = await page.request.post(`/api/grc/${socle}/pilotage/objectifs/objectives`, {
      headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
      data: { name: objectif },
    });
    expect(r.ok(), await r.text()).toBe(true);

    // Menu : l'onglet « Processus » est dans Organisation.
    await page.getByRole('link', { name: 'Processus', exact: true }).click();
    await expect(page).toHaveURL(/\/pilotage\/processus-cartes$/);
    await expect(page.getByRole('heading', { name: 'Processus', level: 1 })).toBeVisible();

    // Création d'un processus classé dans un type du registre.
    await page.getByRole('button', { name: 'Nouveau processus' }).click();
    const creation = page.getByRole('dialog', { name: 'Nouveau processus' });
    await creation.getByLabel('Nom du processus').fill(racine);
    await creation.getByLabel('Type de processus').click();
    await page.getByRole('option', { name: 'Réalisation' }).click();
    await creation.getByRole('button', { name: 'Créer' }).click();
    const fiche = page.getByRole('dialog', { name: new RegExp(racine) });
    await expect(fiche).toBeVisible();

    // Rattachement d'un objectif, puis détachement.
    await fiche.getByRole('combobox', { name: 'Rattacher : Objectifs' }).click();
    await page.getByRole('option', { name: objectif }).click();
    await expect(fiche.getByText(objectif).first()).toBeVisible();
    await fiche.getByRole('button', { name: `Détacher ${objectif}` }).click();
    await expect(fiche.getByRole('button', { name: `Détacher ${objectif}` })).toBeHidden();
    await fiche.getByRole('combobox', { name: 'Rattacher : Objectifs' }).click();
    await page.getByRole('option', { name: objectif }).click();
    await expect(fiche.getByRole('button', { name: `Détacher ${objectif}` })).toBeVisible();
    await page.keyboard.press('Escape');

    // Sous-processus : il s'affiche dans la carte de son parent.
    await page.getByRole('button', { name: 'Nouveau processus' }).click();
    const sous = page.getByRole('dialog', { name: 'Nouveau processus' });
    await sous.getByLabel('Nom du processus').fill(enfant);
    await sous.getByLabel('Processus parent (pour un sous-processus)').click();
    await page.getByRole('option', { name: new RegExp(racine) }).click();
    await sous.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByRole('dialog', { name: new RegExp(enfant) })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const section = page.getByRole('region', { name: 'Réalisation' });
    const carte = section.locator('.carte-processus', { hasText: racine });
    await expect(carte).toBeVisible();
    await expect(carte.getByText('Objectifs 1')).toBeVisible();
    await carte.getByRole('button', { name: /Afficher les sous-processus \(1\)/ }).click();
    await expect(carte.getByText(enfant)).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Réciprocité : le processus créé ici figure dans la cartographie.
    const objets = (await (await page.request.get('/api/carto/objects')).json()) as { objects: { name: string }[] };
    expect(objets.objects.map((o) => o.name)).toEqual(expect.arrayContaining([racine, enfant]));
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Cartographie : un type de processus ajouté dans la Plateforme devient une bande de la vue processus', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1920, height: 1080 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36);
  const type = `Conformité ${suffixe}`,
    nom = `Veille réglementaire ${suffixe}`;
  try {
    await page.goto('/pilotage/contexte');
    const entetes = { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) };
    const t = await page.request.post('/api/types-processus', {
      headers: entetes,
      data: { label: type, tint: 'orange' },
    });
    expect(t.ok(), await t.text()).toBe(true);
    const code = ((await t.json()) as { code: string }).code;
    const socle = '00000000-0000-4000-8000-000000000001';
    const p = await page.request.post(`/api/grc/${socle}/pilotage/objectifs/processes`, {
      headers: entetes,
      data: { name: nom, family: code },
    });
    expect(p.ok(), await p.text()).toBe(true);

    await page.goto('/cartographie/processus');
    await page.getByRole('button', { name: 'Générer depuis la plateforme' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Générer', exact: true }).click();
    await expect(page.getByText('Modifications non enregistrées')).toBeVisible();
    // Une bande par type du registre : les trois d'origine et le nouveau, avec le processus dedans.
    await expect(page.locator('g.noeud[data-n^="lane:"]')).toHaveCount(4);
    await expect(page.locator('g.noeud[data-n^="lane:"]', { hasText: type })).toHaveCount(1);
    await expect(page.locator('g.noeud', { hasText: nom }).first()).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
