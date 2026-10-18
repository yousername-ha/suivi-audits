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
  saveAdmin,
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
  await expect(page.getByRole('heading', { name: 'Récupérer le jeton' })).toBeVisible();
  await expect(page.getByText('sudo docker compose exec app setup-token')).toBeVisible();

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
  saveAdmin(ADMIN, adminSecret);

  // Une fois l'administrateur créé, /setup renvoie vers la connexion.
  await page.goto('/setup');
  await expect(page).not.toHaveURL(/\/setup$/);
  expect(problems).toEqual([]);
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
  await page.getByRole('link', { name: 'Documents et liens' }).first().click();
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
  await expect(report).toContainText('Écarts et actions');
  await expect(report).toContainText('$.suppliers[].MFA-001');
  await page.getByRole('button', { name: 'Appliquer l’import' }).click();
  await expect(page.getByText(/Import n°1 enregistré/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'initialiser' })).toBeVisible();
  // Les données importées sont relues depuis les tables.
  const state = await page.request.get('/api/suivi/etat');
  expect((await state.json()).findings.length).toBe(2);
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
  await dlg.getByRole('textbox', { name: 'Rôles portés par le groupe' }).click();
  await a.page.getByRole('option', { name: 'Lecteur', exact: true }).click();
  await dlg.getByRole('textbox', { name: 'Nom', exact: true }).click(); // referme la liste
  await dlg.getByRole('textbox', { name: 'Membres' }).click();
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
  await dlg2.getByRole('textbox', { name: 'Rôles portés par le groupe' }).click();
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
