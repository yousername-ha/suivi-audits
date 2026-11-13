/* Frontend compilé + réponses fictives interceptées : aucune API ou base métier requise. */
import { defineConfig } from '@playwright/test';
const external = process.env.E2E_UI_URL;
export default defineConfig({
  testDir: './interface',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  outputDir: './test-results/interface',
  use: {
    baseURL: external || 'http://127.0.0.1:5212',
    locale: 'fr-FR',
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'off',
    trace: 'off',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] },
  },
  webServer: external
    ? undefined
    : {
        command: 'python3 interface/serve-built-web.py --port 5212',
        url: 'http://127.0.0.1:5212',
        reuseExistingServer: false,
        timeout: 15_000,
      },
});
