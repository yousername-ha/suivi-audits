/* Clés de sécurité FIDO2 / WebAuthn (ADR 0079) avec l'authentificateur virtuel de Chromium (CDP WebAuthn, CTAP2, vérification
   de l'utilisateur activée) : enrôlement depuis Mon compte, double enrôlement refusé, connexion par clé, opération refusée
   (NotAllowedError), facteurs vus par l'administrateur, révocation. Compte fictif créé par ce test. */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { apiLogin, csrfOf, markTotpUsed, PASSWORD, sessionAdmin, totp, watchPage } from '../helpers';

const COMPTE = 'porteur-cle';

async function authentificateur(ctx: BrowserContext, page: Page) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'usb',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    verifie: (oui: boolean) => cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: oui }),
    cles: async () => (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials,
  };
}

test('clés de sécurité : enrôlement, double enrôlement refusé, connexion par clé, révocation', async ({ browser }) => {
  test.setTimeout(120_000);
  // Compte fictif préparé par l'API : mot de passe définitif et TOTP (toujours obligatoire).
  const admin = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
  });
  const cree = await admin.request.post('/api/admin/users', {
    data: { username: COMPTE, displayName: 'Porteuse de clé', roles: [{ roleId: 'contributeur' }] },
    headers: { 'x-csrf-token': await csrfOf(admin.request) },
  });
  expect(cree.status(), await cree.text()).toBe(201);
  const temp = (await cree.json()).temporaryPassword as string;

  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  const rq = ctx.request;
  await rq.post('/api/auth/login', { data: { username: COMPTE, password: temp } });
  let csrf = await csrfOf(rq);
  const begin = await (
    await rq.post('/api/account/totp/begin', { data: {}, headers: { 'x-csrf-token': csrf } })
  ).json();
  await rq.post('/api/account/totp/confirm', { data: { code: totp(begin.secret) }, headers: { 'x-csrf-token': csrf } });
  markTotpUsed(begin.secret);
  csrf = await csrfOf(rq);
  await rq.post('/api/account/password', {
    data: { current: temp, next: PASSWORD },
    headers: { 'x-csrf-token': csrf },
  });
  await apiLogin(rq, COMPTE, PASSWORD, begin.secret);

  const cle = await authentificateur(ctx, page);
  try {
    // Enrôlement depuis Mon compte : la connexion vient d'avoir lieu, l'identité est confirmée pour 5 minutes.
    await page.goto('/account');
    const carte = page.locator('.mantine-Card-root').filter({ hasText: 'Clés de sécurité (FIDO2)' });
    await expect(carte.getByText(/Identité confirmée jusqu’à/)).toBeVisible();
    await expect(carte.getByText(/Nous recommandons d’enregistrer 2 clés/)).toBeVisible();
    await carte.getByLabel('Nom de la clé').fill('Clé virtuelle');
    await carte.getByRole('button', { name: 'Ajouter une clé' }).click();
    await expect(carte.getByRole('cell', { name: 'Clé virtuelle' })).toBeVisible();
    await expect(carte.getByRole('cell', { name: 'Clé matérielle' })).toBeVisible();
    expect(await cle.cles()).toHaveLength(1);

    // Même authentificateur une seconde fois : refusé par le navigateur (excludeCredentials, InvalidStateError).
    await carte.getByLabel('Nom de la clé').fill('Doublon');
    await carte.getByRole('button', { name: 'Ajouter une clé' }).click();
    await expect(carte.getByText('Cette clé est déjà enregistrée sur votre compte.')).toBeVisible();
    expect(await cle.cles()).toHaveLength(1);

    // Connexion : mot de passe, puis « Utiliser ma clé de sécurité ».
    await page.request.post('/api/auth/logout', { headers: { 'x-csrf-token': await csrfOf(page.request) } });
    await page.goto('/login');
    await page.getByLabel('Identifiant').fill(COMPTE);
    await page.getByLabel('Mot de passe').fill(PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('heading', { name: 'Double authentification' })).toBeVisible();
    // Vérification de l'utilisateur impossible (code PIN refusé) : opération refusée, message clair, rien d'ouvert.
    await cle.verifie(false);
    await page.getByRole('button', { name: 'Utiliser ma clé de sécurité' }).click();
    await expect(page.getByRole('alert')).toContainText(/Opération annulée ou délai dépassé|vérification de la clé/);
    await cle.verifie(true);
    await page.getByRole('button', { name: 'Utiliser ma clé de sécurité' }).click();
    await expect(page.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();

    // L'administrateur voit la clé du compte.
    const pa = await admin.newPage();
    await pa.goto('/admin/users');
    await pa
      .getByRole('row', { name: new RegExp(COMPTE) })
      .getByRole('button', { name: 'Facteurs' })
      .click();
    const dlg = pa.getByRole('dialog', { name: new RegExp(`Facteurs d’authentification de ${COMPTE}`) });
    await expect(dlg.getByRole('cell', { name: 'Clé virtuelle' })).toBeVisible();
    await expect(dlg.getByText('active', { exact: true })).toBeVisible();

    // Révocation par la personne (identité confirmée par la connexion par clé).
    await page.goto('/account');
    await carte
      .getByRole('row', { name: /Clé virtuelle/ })
      .getByRole('button', { name: 'Révoquer' })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText('Clé révoquée.')).toBeVisible();
    await expect(carte.getByRole('cell', { name: 'Clé virtuelle' })).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
    await admin.close();
  }
});
