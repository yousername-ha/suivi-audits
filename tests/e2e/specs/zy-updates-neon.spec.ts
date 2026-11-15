/* Page de mise à jour, habillage Neon (lot 1 « Maintenance Neon ») : ce que l'habillage ajoute au suivi existant, servi par
   le frontal réel et sa CSP. Thème sombre seul et animations continues, sans bouton (décisions du RSSI du 15/11/2026) ;
   les animations n'utilisent que transform et opacity ; le mouvement réduit donne un rendu statique avec les mêmes
   informations ; l'illustration ne montre jamais une réussite que le service n'a pas publiée. Le suivi lui-même (bon job, santé, retour) est vérifié par zy-updates.spec.ts. Données fictives. */
import { expect, test, type Browser } from '@playwright/test';
import { watchPage } from '../helpers';

const JOB = '00000000-0000-4000-8000-0000000000a1';
const enCours = (changes = {}) => {
  const debut = new Date(Date.now() - 95_000).toISOString();
  return {
    installed: '3.0.0',
    available: '3.1.0',
    checkedAt: new Date().toISOString(),
    checking: false,
    checkError: false,
    ready: true,
    maintenance: true,
    id: JOB,
    target: '3.1.0',
    status: 'running',
    phase: 'installing',
    message: 'Installation de la nouvelle version.',
    startedAt: debut,
    updatedAt: new Date().toISOString(),
    etapes: [
      { phase: 'preparing', at: debut },
      { phase: 'backup', at: new Date(Date.now() - 60_000).toISOString() },
      { phase: 'installing', at: new Date(Date.now() - 20_000).toISOString() },
    ],
    ...changes,
  };
};
async function ouvrir(browser: Browser, etat: Record<string, unknown>, reducedMotion: 'reduce' | 'no-preference') {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    reducedMotion,
    // Poste et application en clair : la page reste sombre.
    colorScheme: 'light',
  });
  await ctx.addInitScript(() => localStorage.setItem('mantine-color-scheme-value', 'light'));
  const page = await ctx.newPage();
  const problems = watchPage(page);
  const suivi = { etat };
  await page.route('**/update/status.json', (route) => route.fulfill({ json: suivi.etat }));
  await page.goto(`/update/?demande=${JOB}`);
  return { ctx, page, problems, suivi };
}
const animationsActives = () => document.getAnimations().filter((a) => a.playState === 'running').length;

test('maintenance Neon : thème sombre seul, animations continues en transform et opacity, sans bouton, suivi actif', async ({
  browser,
}) => {
  const { ctx, page, problems, suivi } = await ouvrir(browser, enCours(), 'no-preference');
  try {
    await expect(page.locator('html')).toHaveAttribute('data-art', 'building');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
    await expect(page.locator('li.current')).toHaveText(/^Installation/);
    const proprietes = await page.evaluate(() => {
      const vues = new Set<string>();
      for (const feuille of Array.from(document.styleSheets))
        for (const regle of Array.from(feuille.cssRules))
          if (regle instanceof CSSKeyframesRule)
            for (const cle of Array.from(regle.cssRules))
              for (const p of Array.from((cle as CSSKeyframeRule).style)) vues.add(`${regle.name}:${p}`);
      return [...vues];
    });
    expect(proprietes.length).toBeGreaterThan(0);
    expect(proprietes.filter((p) => !/:(transform|opacity)$/.test(p))).toEqual([]);
    expect(await page.evaluate(animationsActives)).toBeGreaterThan(0);
    await expect(page.getByRole('button')).toHaveCount(0);
    // Le suivi continue : l'état publié suivant est reçu et affiché, les animations tournent toujours.
    suivi.etat = enCours({
      phase: 'verifying',
      message: 'Vérification du service et de vos données.',
      etapes: [...(suivi.etat.etapes as object[]), { phase: 'verifying', at: new Date().toISOString() }],
    });
    await expect(page.getByRole('status')).toHaveText('Vérification du service et de vos données.');
    await expect(page.locator('html')).toHaveAttribute('data-art', 'verifying');
    await expect(page.locator('li.current')).toHaveText(/^Vérification/);
    expect(await page.evaluate(animationsActives)).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('maintenance Neon : mouvement réduit, rendu statique avec les mêmes informations', async ({ browser }) => {
  const { ctx, page, problems } = await ouvrir(browser, enCours(), 'reduce');
  try {
    await expect(page.locator('html')).toHaveAttribute('data-art', 'building');
    await expect(page.getByRole('heading', { name: 'Mise à jour en cours' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Installation de la nouvelle version.');
    await expect(page.locator('li.current')).toHaveText(/^Installation/);
    await expect(page.locator('#elapsed')).toContainText(/Durée écoulée : 1 min \d{2} s/);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('maintenance Neon : la phase finale sans succès publié n’affiche aucune réussite', async ({ browser }) => {
  const { ctx, page, problems } = await ouvrir(
    browser,
    enCours({ phase: 'complete', message: 'Dernières vérifications.' }),
    'no-preference',
  );
  try {
    await expect(page.getByRole('status')).toHaveText('Dernières vérifications.');
    await expect(page.locator('#title')).toHaveText('Mise à jour en cours');
    await expect(page.locator('html')).toHaveAttribute('data-art', 'neutral');
    await expect(page.locator('html')).not.toHaveAttribute('data-fin', 'succes');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
