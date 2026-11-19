/* Module Intégrations (ADR 0076), socle des connecteurs réseau : carte « Intégrations » de la page Plateforme de bout en bout
   (addendum du 19/11/2026 : plus de rubrique au menu Pilotage, l'ancienne adresse /integrations ouvre la carte), sans capture
   de référence (aucune n'est approuvée sans relecture) : instance Tenable créée, clés en écriture seule (« défini »),
   activation qui ouvre le flux après validation explicite (ADR 0097), désactivation qui le referme, accessibilité, CSP. Lot
   I1 : dans les écrans du module Vulnérabilités, l'état en lecture seule et le lien « Configurer l'intégration », visible
   seulement avec le droit d'administrer les intégrations (décision du RSSI du 19/11/2026, lot F1 : un compte qui lit sans
   administrer voit l'état et la carte, pas le lien) ; aucun bouton de test ni de synchronisation. Aucun appel n'est lancé vers
   un outil : l'adresse et les clés sont fictives. Aucune assertion ne dépend de l'état d'une synchronisation (le tic de l'API
   en inscrit chaque jour). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { preparerCompte, sessionAdmin, sessionCompte, watchPage } from '../helpers';

/** Écrans du module Vulnérabilités qui exploitent une intégration. */
const OUTILS = [
  { url: '/vulnerabilites/failles', titre: 'Failles détectées' },
  { url: '/vulnerabilites/surface-externe', titre: 'Surface externe' },
  { url: '/vulnerabilites/vue', titre: 'Vue d’ensemble' },
] as const;
const LIEN = 'Configurer l’intégration';

/** Aucun réglage de connecteur dans l'écran : ni test, ni synchronisation, ni clé. */
async function sansReglage(page: Page) {
  await expect(
    page.getByRole('button', { name: /Synchroniser|Tester la connexion|Ajouter une instance|secrets|Configurer/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel(/^Clé (d’API|d’accès|secrète)/)).toHaveCount(0);
}

test('Intégrations : connecteur Tenable créé, clés enregistrées sans être réaffichées, flux ouvert puis refermé', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const nom = `Tenable fictif ${Date.now().toString(36)}`;
  const cle = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const fluxTenable = async () =>
    (
      (await (await page.request.get('/api/admin/flux-externes')).json()) as {
        modules: { module: string; ouvert: boolean }[];
      }
    ).modules.find((m) => m.module === 'tenable')!.ouvert;
  try {
    // Ancienne adresse : elle ouvre la carte de la page Plateforme ; plus aucune entrée « Intégrations » au menu.
    await page.goto('/integrations');
    await expect(page).toHaveURL(/\/plateforme\/integrations$/);
    const carte = page.getByRole('dialog', { name: 'Intégrations', exact: true });
    await expect(carte).toBeVisible();
    // Titre de la fenêtre non répété dans la carte (ergonomie, lot 2).
    await expect(carte.getByRole('heading', { name: 'Intégrations', exact: true })).toHaveCount(1);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: 'Intégrations', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Plateforme', exact: true })).toBeVisible();

    await page
      .getByRole('region', { name: 'Tenable Security Center' })
      .getByRole('button', { name: 'Ajouter une instance' })
      .click();
    const ajout = page.getByRole('dialog', { name: 'Ajouter : Tenable Security Center' });
    await ajout.getByRole('textbox', { name: 'Nom', exact: true }).fill(nom);
    // Port réglable (décision du RSSI du 16/11/2026) : rappelé dans la fenêtre de validation du flux.
    await ajout
      .getByRole('textbox', { name: 'Adresse du service', exact: true })
      .fill('https://tenable.exemple.test:8443');
    await ajout.getByRole('button', { name: 'Créer l’instance' }).click();
    const config = page.getByRole('dialog', { name: `Configurer ${nom}` });
    await config.getByLabel(/^Clé d’accès/).fill(cle);
    await config.getByLabel(/^Clé secrète/).fill(cle.split('').reverse().join(''));
    await config.getByRole('button', { name: 'Enregistrer les secrets' }).click();
    await expect(config.getByLabel('Clé d’accès (défini)')).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(cle);
    await page.keyboard.press('Escape');
    await expect(config).toBeHidden();
    // Échap ferme la fenêtre de configuration, pas la carte qui la contient (sa fermeture ramènerait à /plateforme).
    await expect(carte).toBeVisible();
    await expect(page).toHaveURL(/\/plateforme\/integrations$/);

    const tuile = page.getByRole('region', { name: nom });
    await expect(tuile).toContainText('Clé d’accès : Défini');
    await expect(tuile).toContainText('Clé secrète : Défini');
    await tuile.getByRole('button', { name: 'Activer', exact: true }).click();
    const validation = page.getByRole('dialog', { name: 'Activer « Tenable Security Center » : ouvrir son flux' });
    await expect(validation).toContainText('clés d’API');
    await expect(validation).toContainText(`Port réglé pour « ${nom} » : TCP 8443.`);
    await expect(validation.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
    await validation
      .getByLabel(
        'J’ai pris connaissance des destinations, des ports et des données qui sortent, et j’autorise ce flux.',
      )
      .check();
    await validation.getByRole('button', { name: 'Confirmer' }).click();
    await expect(tuile.getByRole('button', { name: 'Désactiver', exact: true })).toBeVisible();
    // Synchronisation des failles (ADR 0100, lot V5) : filtre de gravité et bouton, sans lancer d'appel.
    await expect(tuile).toContainText('Critique, Élevée');
    await expect(tuile.getByRole('button', { name: 'Synchroniser maintenant' })).toBeVisible();
    await expect(tuile.getByRole('button', { name: 'Tester la connexion' })).toBeVisible();
    expect(await fluxTenable()).toBe(true);
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await tuile.getByRole('button', { name: 'Désactiver', exact: true }).click();
    await expect(tuile.getByRole('button', { name: 'Activer', exact: true })).toBeVisible();
    expect(await fluxTenable()).toBe(false);
    // Sans fenêtre au-dessus, Échap ferme la carte et ramène à la page Plateforme.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/plateforme$/);
    await expect(carte).toBeHidden();
    expect(problems).toEqual([]);
  } finally {
    // Un échec en cours de route ne doit pas laisser l'instance active ni le flux ouvert.
    try {
      await page.goto('/plateforme/integrations');
      const desactiver = page
        .getByRole('region', { name: nom })
        .getByRole('button', { name: 'Désactiver', exact: true });
      if (await desactiver.isVisible({ timeout: 3000 }).catch(() => false)) await desactiver.click();
    } catch {
      // Le ménage ne masque pas l'échec d'origine.
    }
    await ctx.close();
  }
});

test('Intégrations, lot I1 : les outils du module Vulnérabilités montrent l’état et le lien, sans aucun réglage', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    for (const o of OUTILS) {
      await page.goto(o.url);
      await expect(page.getByRole('heading', { name: o.titre, level: 1 })).toBeVisible();
      const lien = page.getByRole('link', { name: LIEN, exact: true });
      await expect(lien).toBeVisible();
      await expect(lien).toHaveAttribute('href', '/plateforme/integrations');
      await sansReglage(page);
    }
    // Le lien ouvre la carte de la page Plateforme.
    await page.goto('/vulnerabilites/failles');
    await page.getByRole('link', { name: LIEN, exact: true }).click();
    await expect(page).toHaveURL(/\/plateforme\/integrations$/);
    await expect(page.getByRole('dialog', { name: 'Intégrations', exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

/** Compte fictif créé par l'administrateur, avec un rôle personnalisé aux droits donnés (rôle réutilisé s'il existe). */
async function compteAvecDroits(
  browser: Browser,
  nomRole: string,
  prefixe: string,
  permissions: string[],
): Promise<{ username: string; secret: string }> {
  const admin = await sessionAdmin(browser);
  const adm = await browser.newContext({ ignoreHTTPSErrors: true, storageState: admin.state });
  const rq = adm.request;
  const username = `${prefixe}-${Date.now().toString(36)}`;
  try {
    const roles = (await (await rq.get('/api/admin/roles')).json()) as { id: string; name: string }[];
    let roleId = roles.find((x) => x.name === nomRole)?.id;
    if (!roleId) {
      const role = await rq.post('/api/admin/roles', {
        data: { from: 'lecteur', name: nomRole },
        headers: { 'x-csrf-token': admin.csrf },
      });
      expect(role.status(), await role.text()).toBe(201);
      const r = await role.json();
      const patch = await rq.patch(`/api/admin/roles/${r.id}`, {
        data: { permissions },
        headers: { 'x-csrf-token': admin.csrf, 'if-match': `"${r.version}"` },
      });
      expect(patch.status(), await patch.text()).toBe(200);
      roleId = r.id as string;
    }
    const u = await rq.post('/api/admin/users', {
      data: { username, displayName: `Compte ${username}`, roles: [{ roleId }] },
      headers: { 'x-csrf-token': admin.csrf },
    });
    expect(u.status(), await u.text()).toBe(201);
    const temp = (await u.json()).temporaryPassword as string;
    const c = await browser.newContext({ ignoreHTTPSErrors: true });
    const secret = (await preparerCompte(c, username, temp)).secret;
    await c.close();
    return { username, secret };
  } finally {
    await adm.close();
  }
}

test('Intégrations, lot I1 : sans le droit de lire les intégrations, ni carte ni lien', async ({ browser }) => {
  const { username, secret } = await compteAvecDroits(
    browser,
    'Lecture des vulnérabilités sans intégrations (e2e)',
    'vuln-sans-integ',
    ['vulnerabilites:lire'],
  );
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionCompte(browser, username, secret)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    for (const o of OUTILS) {
      await page.goto(o.url);
      await expect(page.getByRole('heading', { name: o.titre, level: 1 })).toBeVisible();
      await expect(page.getByRole('link', { name: LIEN, exact: true })).toHaveCount(0);
      await sansReglage(page);
    }
    // Ni carte ni entrée « Plateforme » : l'ancienne adresse et la nouvelle ne montrent rien des intégrations.
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Plateforme' }),
    ).toHaveCount(0);
    for (const url of ['/integrations', '/plateforme/integrations']) {
      await page.goto(url);
      await expect(page).not.toHaveURL(/\/plateforme/);
      await expect(page.getByRole('dialog', { name: 'Intégrations', exact: true })).toHaveCount(0);
    }
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Intégrations, lot F1 : lire les intégrations sans les administrer montre l’état et la carte, pas le lien', async ({
  browser,
}) => {
  const { username, secret } = await compteAvecDroits(
    browser,
    'Lecture des vulnérabilités et des intégrations (e2e)',
    'vuln-integ-lecture',
    ['vulnerabilites:lire', 'integrations:lire'],
  );
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionCompte(browser, username, secret)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    for (const o of OUTILS.filter((x) => x.url !== '/vulnerabilites/vue')) {
      await page.goto(o.url);
      await expect(page.getByRole('heading', { name: o.titre, level: 1 })).toBeVisible();
      // L'état se lit (section en lecture seule), le lien n'apparaît pas.
      await expect(page.getByRole('region', { name: /^État de l’intégration / })).toBeVisible();
      await expect(page.getByRole('link', { name: LIEN, exact: true })).toHaveCount(0);
      await sansReglage(page);
    }
    await page.goto('/vulnerabilites/vue');
    await expect(page.getByRole('heading', { name: 'Vue d’ensemble', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: LIEN, exact: true })).toHaveCount(0);
    // La carte de la Plateforme garde son droit de lecture.
    await page.goto('/plateforme/integrations');
    await expect(page.getByRole('dialog', { name: 'Intégrations', exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
