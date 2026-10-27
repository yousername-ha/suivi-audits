/* Tests de bout en bout sur la pile Docker démarrée (docker compose up) : https://localhost par défaut. */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  // Captures de référence sans suffixe de plateforme : elles sont produites et comparées dans le même conteneur
  // (mcr.microsoft.com/playwright, voir run-in-container.sh).
  snapshotPathTemplate: '{testDir}/__captures__/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // En CI, un test en échec est rejoué une fois : un échec aléatoire ne bloque plus la fusion, mais le test reste signalé
  // comme instable (annotation de scripts/ci/rapport-e2e.mjs) pour être corrigé. Deux échecs : la CI échoue.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/resultats-e2e.json' }]]
    : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://localhost',
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'ordinateur', use: { ...devices['Desktop Chrome'] } }],
});
