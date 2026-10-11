/* A1a : états d'interface simulés. La sauvegarde automatique réelle est testée dans systeme.spec.ts. */
import { randomUUID } from 'node:crypto';
import type { BackupJobOut } from '../../../packages/shared/src/exploitation';
import { expect, test, type Browser } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';
async function open(browser: Browser, width = 1366) {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({
    storageState: state,
    ignoreHTTPSErrors: true,
    viewport: { width, height: 900 },
  });
  const page = await ctx.newPage();
  return { ctx, page, problems: watchPage(page) };
}
const job = (): BackupJobOut => ({
  id: randomUUID(),
  status: 'en_attente',
  requestedBy: 'rssi',
  createdAt: '2026-10-09T12:00:00Z',
  startedAt: null,
  finishedAt: null,
  version: 1,
  report: null,
  message: '',
});
const worker = { available: true, seenAt: '2026-10-09T12:00:00Z', message: 'Exécutant prêt' };
test('A1a : sans exécutant configuré, la demande est désactivée', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser);
  await page.route('**/api/admin/sauvegardes', (route) =>
    route.fulfill({
      json: {
        worker: { available: false, seenAt: null, message: 'Exécutant indisponible' },
        jobs: [],
      },
    }),
  );
  await page.goto('/admin/system');
  await expect(page.getByRole('heading', { name: 'Demandes de sauvegarde' })).toBeVisible();
  await expect(page.getByText('Exécutant serveur indisponible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demander une sauvegarde' })).toBeDisabled();
  expect(problems).toEqual([]);
  await ctx.close();
});
test('A1a : confirmation, suivi et annulation avec version', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser);
  let jobs: BackupJobOut[] = [];
  await page.route('**/api/admin/sauvegardes**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') await route.fulfill({ json: { worker, jobs } });
    else if (req.url().endsWith('/annuler')) {
      expect(req.headers()['if-match']).toBe('"1"');
      jobs[0] = { ...jobs[0]!, status: 'annulee', version: 2 };
      await route.fulfill({ json: jobs[0] });
    } else {
      expect(req.postDataJSON().requestId).toMatch(/^[a-f0-9-]{36}$/);
      jobs = [job()];
      await route.fulfill({ status: 202, json: jobs[0] });
    }
  });
  await page.goto('/admin/system');
  await page.getByRole('button', { name: 'Demander une sauvegarde' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByRole('button', { name: 'Annuler la demande' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demander une sauvegarde' })).toBeDisabled();
  await page.getByRole('button', { name: 'Annuler la demande' }).click();
  await expect(page.getByText('Annulée', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demander une sauvegarde' })).toBeEnabled();
  expect(problems).toEqual([]);
  await ctx.close();
});
test('A1a : erreur réseau explicite et réessai avec le même identifiant', async ({ browser }) => {
  const { ctx, page } = await open(browser);
  const ids: string[] = [];
  let jobs: BackupJobOut[] = [];
  await page.route('**/api/admin/sauvegardes**', async (route) => {
    if (route.request().method() === 'GET') await route.fulfill({ json: { worker, jobs } });
    else {
      ids.push(route.request().postDataJSON().requestId);
      if (ids.length === 1) await route.abort();
      else {
        jobs = [job()];
        await route.fulfill({ status: 202, json: jobs[0] });
      }
    }
  });
  await page.goto('/admin/system');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Demander une sauvegarde' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    if (i === 0) await expect(page.getByText('Serveur injoignable. Vérifiez la connexion réseau.')).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Annuler la demande' })).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  await ctx.close();
});
test('A1a : résultats chiffrés et échecs consultables au téléphone, sans débordement', async ({ browser }) => {
  const { ctx, page, problems } = await open(browser, 390);
  const done: BackupJobOut = {
    ...job(),
    status: 'reussie',
    report: {
      fichier: 'suivi-fictif.tar.enc',
      tailleOctets: 1024,
      dureeSecondes: 12,
      sha256: 'a'.repeat(64),
      chiffree: true,
      integriteVerifiee: true,
    },
  };
  const failed: BackupJobOut = { ...job(), status: 'echec', message: 'Exécutant en échec (code 7).' };
  await page.route('**/api/admin/sauvegardes', (route) => route.fulfill({ json: { worker, jobs: [done, failed] } }));
  await page.goto('/admin/system');
  await expect(page.getByText('suivi-fictif.tar.enc')).toBeVisible();
  await expect(page.getByText(/1.0 Ko.*SHA-256 vérifié/)).toBeVisible();
  await expect(page.getByText('Exécutant en échec (code 7).')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(problems).toEqual([]);
  await ctx.close();
});
test('A1a : la lecture seule ne propose pas les actions de sauvegarde', async ({ browser }) => {
  const { ctx, page } = await open(browser);
  await page.route('**/api/auth/me', async (route) => {
    const res = await route.fetch();
    const me = await res.json();
    await route.fulfill({ json: { ...me, permissions: ['administration:lire'] } });
  });
  await page.route('**/api/admin/sauvegardes', (route) => route.fulfill({ json: { worker, jobs: [job()] } }));
  await page.goto('/admin/system');
  await expect(page.getByRole('heading', { name: 'Demandes de sauvegarde' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demander une sauvegarde' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Annuler la demande' })).toHaveCount(0);
  await ctx.close();
});
