/* Parcours complet sur une installation neuve : installation, double authentification, documents, import legacy,
   temps réel entre deux navigateurs. Les tests s'enchaînent (état partagé : la pile n'est installée qu'une fois). */
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { apiLogin, csrfOf, freshTotp, markTotpUsed, PASSWORD, setupToken, totp, watchPage } from '../helpers';

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

test('installation : jeton, création de l’administrateur, activation de la double authentification', async ({ browser }) => {
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
  adminSecret = (await page.getByText(/^Saisie manuelle/).locator('span').textContent())!.replace(/\s/g, '');
  await page.getByLabel('Chiffre 1 sur 6').click();
  await page.keyboard.type(totp(adminSecret));
  markTotpUsed(adminSecret);
  await expect(page.getByRole('heading', { name: /^Bonjour Responsable SSI/ })).toBeVisible();

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
  // L'ancienne interface est accessible avec la même session.
  await page.goto('/legacy/');
  await expect(page.getByRole('navigation', { name: 'Menu du compte' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('documents : dépôt, fiche, modification, version', async ({ browser }) => {
  const { page, problems } = await newPage(browser);
  await loginUI(page, ADMIN, PASSWORD, adminSecret);
  await page.getByRole('link', { name: 'Documents et liens' }).first().click();
  const file = path.join(os.tmpdir(), 'politique-securite.txt');
  writeFileSync(file, 'Politique de sécurité — test de bout en bout\n');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Déposer des documents' }).click();
  await (await chooser).setFiles(file);
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
  // Les données importées sont servies à l'ancienne interface.
  const state = await page.request.get('/api/legacy/state');
  expect((await state.json()).findings.length).toBe(2);
  expect(problems).toEqual([]);
});

test('temps réel : deux navigateurs, présence et mise à jour sans rechargement', async ({ browser }) => {
  // Compte « redacteur » créé par l'administrateur, puis préparé (mot de passe personnel, TOTP) par l'API.
  const a = await newPage(browser);
  await loginUI(a.page, ADMIN, PASSWORD, adminSecret);
  const csrfA = await csrfOf(a.page.request);
  const created = await a.page.request.post('/api/admin/users', { data: { username: 'redacteur', displayName: 'Rédactrice', role: 'rw' }, headers: { 'x-csrf-token': csrfA } });
  const temp = (await created.json()).temporaryPassword as string;

  const b = await newPage(browser);
  const rb = b.page.request;
  await rb.post('/api/auth/login', { data: { username: 'redacteur', password: temp } });
  let csrfB = await csrfOf(rb);
  const begin = await (await rb.post('/api/account/totp/begin', { data: {}, headers: { 'x-csrf-token': csrfB } })).json();
  await rb.post('/api/account/totp/confirm', { data: { code: totp(begin.secret) }, headers: { 'x-csrf-token': csrfB } });
  markTotpUsed(begin.secret);
  csrfB = await csrfOf(rb);
  await rb.post('/api/account/password', { data: { current: temp, next: PASSWORD }, headers: { 'x-csrf-token': csrfB } });
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

test('interface utilisable au téléphone : menu repliable', async ({ browser }) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = watchPage(page);
  await loginUI(page, ADMIN, PASSWORD, adminSecret);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  expect(problems).toEqual([]);
});
