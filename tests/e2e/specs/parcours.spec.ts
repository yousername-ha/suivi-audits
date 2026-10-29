/* Parcours complet sur une installation neuve : installation, double authentification, documents, import legacy,
   temps réel entre deux navigateurs. Les tests s'enchaînent (état partagé : la pile n'est installée qu'une fois). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  apiLogin,
  csrfOf,
  freshTotp,
  markTotpUsed,
  PASSWORD,
  loadAdmin,
  saveAdmin,
  sessionAdmin,
  setupToken,
  totp,
  watchPage,
} from '../helpers';

test.describe.configure({ mode: 'serial' });

const ADMIN = 'rssi';
let adminSecret = '';
const fixture = path.resolve(import.meta.dirname, '../../fixtures/legacy-fixture.json');

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  return { ctx, page, problems: watchPage(page) };
}

async function loginUI(page: Page, username: string, password: string, secret: string) {
  await page.goto('/login');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Double authentification' })).toBeVisible();
  // Code jamais utilisé (anti-rejeu : un code déjà accepté est refusé).
  await page.getByLabel('Chiffre 1 sur 6').click();
  await page.keyboard.type(await freshTotp(secret));
  await expect(page.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
}

test('installation : jeton, création de l’administrateur, activation de la double authentification', async ({
  browser,
}) => {
  const { page, problems } = await newPage(browser);
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);
  // Étape 1 : poivre des mots de passe, à enregistrer au coffre-fort (ADR 0072). La continuation exige la case et la fin recopiée.
  await expect(page.getByRole('heading', { name: 'Poivre des mots de passe' })).toBeVisible();
  const poivre = (await page.getByTestId('poivre-genere').textContent())!.trim();
  expect(poivre).toMatch(/^([A-Z2-7]{4}-){12}[A-Z2-7]{4}$/);
  const continuer = page.getByRole('button', { name: 'Continuer' });
  await expect(continuer).toBeDisabled();
  await page.getByLabel('Les 8 derniers caractères du poivre').fill('ZZZZZZZZ');
  await expect(page.getByText('Ne correspond pas à la fin du poivre.')).toBeVisible();
  await page.getByLabel('Les 8 derniers caractères du poivre').fill(poivre.replace(/-/g, '').slice(-8).toLowerCase());
  await expect(continuer).toBeDisabled();
  await page.getByLabel('J’ai enregistré ce poivre dans le coffre-fort de l’organisation').check();
  await expect(continuer).toBeEnabled();
  await continuer.click();
  // Étape 2 : clé de secours des sauvegardes, générée par le navigateur (ADR 0077) ; seule la clé publique part au serveur.
  await expect(page.getByRole('heading', { name: 'Clé de secours des sauvegardes' })).toBeVisible();
  await expect(page.getByText('Étape 2 sur 3')).toBeVisible();
  const suite = page.getByRole('button', { name: 'Continuer' });
  await expect(suite).toBeDisabled();
  await page.getByRole('button', { name: 'Générer la clé de secours' }).click();
  const privee = (await page.getByTestId('cle-secours-privee').textContent())!.trim();
  expect(privee).toMatch(/^AGE-SECRET-KEY-1[0-9A-Z]{58}$/);
  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le fichier de la clé' }).click();
  expect((await telechargement).suggestedFilename()).toMatch(/^cle-secours-sauvegardes-\d{4}-\d{2}-\d{2}\.txt$/);
  await page.getByLabel('J’ai rangé la clé privée de secours dans le coffre-fort de l’organisation').check();
  await page.getByLabel('Les 8 derniers caractères de la clé privée').fill('ZZZZZZZZ');
  await expect(page.getByText('Ne correspond pas à la fin de la clé privée.')).toBeVisible();
  await expect(suite).toBeDisabled();
  await page.getByLabel('Les 8 derniers caractères de la clé privée').fill(privee.slice(-8).toLowerCase());
  await expect(suite).toBeEnabled();
  await suite.click();
  await expect(page.getByRole('heading', { name: 'Récupérer le jeton' })).toBeVisible();
  await expect(page.getByText('sudo ./installer.sh')).toBeVisible();

  // Le jeton est saisi en minuscules, avec des espaces : il est mis en forme automatiquement.
  const token = setupToken();
  const field = page.getByLabel('Jeton d’installation');
  await field.click();
  await page.keyboard.type(token.toLowerCase().replace(/-/g, ' '));
  await expect(field).toHaveValue(token);

  await page.getByLabel('Identifiant').fill(ADMIN);
  await page.getByLabel('Nom affiché').fill('Responsable SSI');
  await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(PASSWORD);
  await page.getByRole('textbox', { name: 'Confirmation', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer le compte' }).click();

  await expect(page.getByRole('heading', { name: 'Activer la double authentification' })).toBeVisible();
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  adminSecret = (await page
    .getByText(/^Saisie manuelle/)
    .locator('span')
    .textContent())!.replace(/\s/g, '');
  await page.getByLabel('Chiffre 1 sur 6').click();
  await page.keyboard.type(totp(adminSecret));
  markTotpUsed(adminSecret);
  await expect(page.getByRole('heading', { name: /^Bonjour Responsable SSI/ })).toBeVisible();
  saveAdmin(ADMIN, adminSecret, poivre);

  // Une fois l'administrateur créé, /setup renvoie vers la connexion.
  await page.goto('/setup');
  await expect(page).not.toHaveURL(/\/setup$/);
  expect(problems).toEqual([]);
});

test('poivre : défini à l’installation, changé depuis l’administration avec l’ancien poivre et un code', async ({
  browser,
}) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await page.goto('/systeme/securite');
  await expect(page.getByRole('heading', { name: 'Poivre des mots de passe' })).toBeVisible();
  await expect(page.getByText('Défini', { exact: true })).toBeVisible();
  const nouveau = (await page.getByTestId('poivre-genere').textContent())!.trim();
  await page.getByLabel('J’ai enregistré ce poivre dans le coffre-fort de l’organisation').check();
  await page.getByLabel('Les 8 derniers caractères du poivre').fill(nouveau.replace(/-/g, '').slice(-8));
  const code = page.getByLabel('Code de double authentification');
  const changer = page.getByRole('button', { name: 'Changer le poivre' });
  // Un ancien poivre faux est refusé, sans rien changer.
  await page.getByLabel('Ancien poivre').fill('Vq7!mZ3#kP9$wX2@nR5%tL8&yB4*cD6^hF1(');
  await code.fill(await freshTotp(adminSecret));
  await changer.click();
  await expect(page.getByRole('alert')).toContainText('Ancien poivre incorrect');
  // Avec le bon ancien poivre (celui de l'installation), le changement est enregistré.
  await page.getByLabel('Ancien poivre').fill(loadAdmin().poivre.replace(/-/g, ''));
  await code.fill(await freshTotp(adminSecret));
  await changer.click();
  await expect(page.getByText('Poivre enregistré.')).toBeVisible();
  saveAdmin(ADMIN, adminSecret, nouveau);
  expect(problems).toEqual([]);
  await ctx.close();
});

test('clé de secours : définie à l’installation, recopiée par l’exécutant, remplacée avec un code', async ({
  browser,
}) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await page.goto('/systeme/sauvegardes');
  const panneau = page.getByRole('region', { name: 'Clé de secours des sauvegardes' });
  await expect(panneau.getByRole('heading', { name: 'Clé de secours des sauvegardes' })).toBeVisible();
  // La clé de l'installation est en place : l'exécutant l'a recopiée et la clé du serveur existe (sauvegardes possibles).
  await expect(panneau.getByText('En place', { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[data-cle-secours-requise]')).toHaveCount(0);
  await panneau.getByRole('button', { name: 'Générer la clé de secours' }).click();
  const privee = (await panneau.getByTestId('cle-secours-privee').textContent())!.trim();
  await panneau.getByLabel('J’ai rangé la clé privée de secours dans le coffre-fort de l’organisation').check();
  await panneau.getByLabel('Les 8 derniers caractères de la clé privée').fill(privee.slice(-8));
  const enregistrer = panneau.getByRole('button', { name: 'Enregistrer la clé de secours' });
  await panneau.getByLabel('Code de double authentification').fill('000000');
  await enregistrer.click();
  await expect(panneau.getByRole('alert')).toContainText('Code de double authentification incorrect');
  await panneau.getByLabel('Code de double authentification').fill(await freshTotp(adminSecret));
  await enregistrer.click();
  await expect(panneau.getByText(/Clé de secours enregistrée/)).toBeVisible();
  await expect(panneau.getByText('En place', { exact: true })).toBeVisible({ timeout: 90_000 });
  expect(problems).toEqual([]);
  await ctx.close();
});

test('connexion avec double authentification ; code erroné refusé', async ({ browser }) => {
  const { page, problems } = await newPage(browser);
  await page.goto('/login');
  await page.getByLabel('Identifiant').fill(ADMIN);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByLabel('Chiffre 1 sur 6').click();
  await page.keyboard.type('000000');
  await expect(page.getByRole('alert')).toContainText('Code incorrect');
  await page.getByRole('button', { name: 'Changer de compte' }).click();
  await loginUI(page, ADMIN, PASSWORD, adminSecret);
  expect(problems).toEqual([]);
});

test('documents : dépôt, fiche, modification, version', async ({ browser }) => {
  const { page, problems } = await newPage(browser);
  await loginUI(page, ADMIN, PASSWORD, adminSecret);
  await page.getByRole('link', { name: 'Documents', exact: true }).filter({ visible: true }).click();
  await page.getByRole('link', { name: 'Documents et liens', exact: true }).filter({ visible: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Déposer des documents' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'politique-securite.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Politique de sécurité — test de bout en bout\n'),
  });
  await page.getByRole('button', { name: 'politique-securite' }).click();
  await expect(page.getByRole('heading', { name: 'politique-securite' })).toBeVisible();
  await page.getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Titre').fill('Politique de sécurité');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Politique de sécurité' })).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger' }).click();
  expect(readFileSync(await (await dl).path(), 'utf8')).toContain('test de bout en bout');
  expect(problems).toEqual([]);
});

test('import legacy : simulation, rapport, application, historique', async ({ browser }) => {
  const { page, problems } = await newPage(browser);
  await loginUI(page, ADMIN, PASSWORD, adminSecret);
  await page.goto('/admin/import');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choisir le fichier à importer' }).click();
  await (await chooser).setFiles(fixture);
  await page.getByLabel('Initialiser (base vide uniquement)').check();
  await page.getByRole('button', { name: 'Simuler l’import' }).click();
  const report = page.getByTestId('import-report');
  await expect(report).toContainText('Rapport de simulation');
  await expect(report).toContainText('Processus');
  await expect(report).toContainText('$.suppliers[].MFA-001');
  await page.getByRole('button', { name: 'Appliquer l’import' }).click();
  await expect(page.getByText(/Import n°1 enregistré/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'initialiser' })).toBeVisible();
  // Les données importées sont relues depuis les tables.
  const state = await page.request.get('/api/suivi/etat');
  expect((await state.json()).processes.length).toBe(3);
  expect(problems).toEqual([]);
});

test('temps réel : deux navigateurs, présence et mise à jour sans rechargement', async ({ browser }) => {
  // Compte « redacteur » créé par l'administrateur, puis préparé (mot de passe personnel, TOTP) par l'API.
  const a = await newPage(browser);
  await loginUI(a.page, ADMIN, PASSWORD, adminSecret);
  const csrfA = await csrfOf(a.page.request);
  const created = await a.page.request.post('/api/admin/users', {
    data: { username: 'redacteur', displayName: 'Rédactrice', roles: [{ roleId: 'contributeur' }] },
    headers: { 'x-csrf-token': csrfA },
  });
  const temp = (await created.json()).temporaryPassword as string;

  const b = await newPage(browser);
  const rb = b.page.request;
  await rb.post('/api/auth/login', { data: { username: 'redacteur', password: temp } });
  let csrfB = await csrfOf(rb);
  const begin = await (
    await rb.post('/api/account/totp/begin', { data: {}, headers: { 'x-csrf-token': csrfB } })
  ).json();
  await rb.post('/api/account/totp/confirm', {
    data: { code: totp(begin.secret) },
    headers: { 'x-csrf-token': csrfB },
  });
  markTotpUsed(begin.secret);
  csrfB = await csrfOf(rb);
  await rb.post('/api/account/password', {
    data: { current: temp, next: PASSWORD },
    headers: { 'x-csrf-token': csrfB },
  });
  await apiLogin(rb, 'redacteur', PASSWORD, begin.secret);

  // B consulte les liens ; A les consulte aussi : chacun voit la présence de l'autre.
  await b.page.goto('/documents');
  await b.page.getByRole('tab', { name: 'Liens' }).click();
  await a.page.goto('/documents');
  await expect(b.page.getByText('Responsable SSI consulte')).toBeVisible();
  await expect(b.page.getByText('En direct')).toBeVisible();

  // A ajoute un lien : il apparaît chez B sans rechargement.
  await a.page.getByRole('tab', { name: 'Liens' }).click();
  await a.page.getByRole('button', { name: 'Ajouter un lien' }).click();
  await a.page.getByLabel('Adresse').fill('https://intranet.example.invalid/politiques');
  await a.page.getByLabel('Titre').fill('Politiques internes');
  await a.page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(b.page.getByRole('link', { name: 'Politiques internes' })).toBeVisible();

  expect(a.problems).toEqual([]);
  expect(b.problems).toEqual([]);
});

/** Prépare un compte créé par l'administrateur (mot de passe personnel, TOTP) et ouvre sa session. */
async function prepareAccount(browser: Browser, username: string, temp: string) {
  const b = await newPage(browser);
  const rb = b.page.request;
  await rb.post('/api/auth/login', { data: { username, password: temp } });
  let csrf = await csrfOf(rb);
  const begin = await (
    await rb.post('/api/account/totp/begin', { data: {}, headers: { 'x-csrf-token': csrf } })
  ).json();
  await rb.post('/api/account/totp/confirm', { data: { code: totp(begin.secret) }, headers: { 'x-csrf-token': csrf } });
  markTotpUsed(begin.secret);
  csrf = await csrfOf(rb);
  await rb.post('/api/account/password', {
    data: { current: temp, next: PASSWORD },
    headers: { 'x-csrf-token': csrf },
  });
  await apiLogin(rb, username, PASSWORD, begin.secret);
  return { ...b, secret: begin.secret as string };
}

test('droits : groupe, rôle personnalisé, refus puis accord', async ({ browser }) => {
  const a = await newPage(browser);
  await loginUI(a.page, ADMIN, PASSWORD, adminSecret);
  // Compte sans rôle direct, créé par l'API puis préparé.
  const created = await a.page.request.post('/api/admin/users', {
    data: { username: 'lectrice', displayName: 'Lectrice', roles: [] },
    headers: { 'x-csrf-token': await csrfOf(a.page.request) },
  });
  const temp = (await created.json()).temporaryPassword as string;

  // 1. Création d'un groupe portant le rôle Lecteur, avec la lectrice comme membre (interface).
  await a.page.goto('/admin/groups');
  await a.page.getByRole('button', { name: 'Nouveau groupe' }).click();
  const dlg = a.page.getByRole('dialog');
  await dlg.getByRole('textbox', { name: 'Nom', exact: true }).fill('Équipe de lecture');
  await dlg.getByRole('combobox', { name: 'Rôles portés par le groupe' }).click();
  await a.page.getByRole('option', { name: 'Lecteur', exact: true }).click();
  await dlg.getByRole('textbox', { name: 'Nom', exact: true }).click(); // referme la liste
  await dlg.getByRole('combobox', { name: 'Membres' }).click();
  await a.page.getByRole('option', { name: /Lectrice/ }).click();
  await dlg.getByRole('textbox', { name: 'Nom', exact: true }).click();
  await dlg.getByRole('button', { name: 'Créer' }).click();
  await expect(a.page.getByRole('cell', { name: /Équipe de lecture/ })).toBeVisible();

  // 2. La lectrice consulte les documents, mais ne peut pas ajouter de lien (refus du serveur, bouton absent).
  const b = await prepareAccount(browser, 'lectrice', temp);
  await b.page.goto('/documents');
  await b.page.getByRole('tab', { name: 'Liens' }).click();
  await expect(b.page.getByRole('button', { name: 'Ajouter un lien' })).toHaveCount(0);
  const refused = await b.page.request.post('/api/links', {
    data: { url: 'https://exemple.invalid/refus' },
    headers: { 'x-csrf-token': await csrfOf(b.page.request) },
  });
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error).toMatch(/Droits insuffisants/);
  await b.page.goto('/admin');
  await expect(b.page).toHaveURL(/\/$/);

  // 3. Rôle personnalisé : duplication de Lecteur, ajout de « Documents et liens : Créer et modifier ».
  await a.page.goto('/admin/roles');
  await a.page
    .getByRole('row', { name: /Lecteur Lecture seule/ })
    .getByRole('button', { name: 'Dupliquer' })
    .click();
  await a.page.getByRole('dialog').getByRole('textbox', { name: 'Nom du nouveau rôle' }).fill('Lecteur et liens');
  await a.page.getByRole('button', { name: 'Créer le rôle' }).click();
  await a.page.getByRole('checkbox', { name: 'Documents et liens : Créer et modifier' }).check();
  await a.page.getByRole('button', { name: 'Enregistrer la matrice' }).click();
  await expect(a.page.getByRole('cell', { name: /Lecteur et liens/ })).toBeVisible();

  // 4. Le groupe porte désormais ce rôle : la session de la lectrice est coupée ; après reconnexion, l'ajout passe.
  await a.page.goto('/admin/groups');
  await a.page
    .getByRole('row', { name: /Équipe de lecture/ })
    .getByRole('button', { name: 'Modifier' })
    .click();
  const dlg2 = a.page.getByRole('dialog');
  await dlg2.getByRole('combobox', { name: 'Rôles portés par le groupe' }).click();
  await a.page.getByRole('option', { name: 'Lecteur et liens' }).click();
  await dlg2.getByRole('textbox', { name: 'Nom', exact: true }).click();
  await dlg2.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(a.page.getByRole('cell', { name: /Lecteur et liens/ })).toBeVisible();
  expect((await (await b.page.request.get('/api/auth/me')).json()).stage).toBe('anon');
  await apiLogin(b.page.request, 'lectrice', PASSWORD, b.secret);
  const ok = await b.page.request.post('/api/links', {
    data: { url: 'https://exemple.invalid/accord', title: 'Lien autorisé' },
    headers: { 'x-csrf-token': await csrfOf(b.page.request) },
  });
  expect(ok.status()).toBe(201);

  // 5. Droits effectifs : l'origine (groupe) est affichée.
  await a.page.goto('/admin/users');
  await a.page
    .getByRole('row', { name: /lectrice/ })
    .getByRole('button', { name: 'Droits effectifs' })
    .click();
  await expect(
    a.page
      .getByRole('dialog')
      .getByText(/Lecteur et liens \(groupe Équipe de lecture\)/)
      .first(),
  ).toBeVisible();
  expect(a.problems).toEqual([]);
  expect(b.problems).toEqual([]);
});

test('interface utilisable au téléphone : menu repliable', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await loginUI(page, ADMIN, PASSWORD, adminSecret);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  expect(problems).toEqual([]);
});
