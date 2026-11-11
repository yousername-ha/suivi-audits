/* Harnais de non-régression du RSSI virtuel : parcours déterministes et invariants du SMSI, sur une pile **vierge** (le
   premier fichier installe l'application). Lancement : tests/e2e/rssi-virtuel/lancer.sh (pile Docker éphémère) ou, sur
   une pile vierge déjà démarrée, run-in-container.sh. Les fichiers s'exécutent dans l'ordre de leur numéro. */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  // Aucun rejeu : chaque fichier dépend de l'état laissé par le précédent, et un constat doit rester visible.
  retries: 0,
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results/resultats.json' }],
      ]
    : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://localhost',
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Hors conteneur Playwright (développement) : Chrome du poste, par exemple PILOTE_CHROME=/usr/bin/google-chrome.
    launchOptions: process.env.PILOTE_CHROME ? { executablePath: process.env.PILOTE_CHROME } : {},
  },
  // Poste d'un RSSI : écran de bureau 1440 × 900 (même fenêtre que le pilote de l'agent).
  projects: [{ name: 'rssi', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
