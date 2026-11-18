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

test('maintenance : « Retour à l’application » n’est jamais franchi avant le succès publié', async ({ browser }) => {
  // Séquence publiée par un exécutant antérieur : fin du script notée « complete », puis vérification finale.
  const { ctx, page, problems } = await ouvrir(
    browser,
    enCours({
      phase: 'verifying',
      message: 'Vérification finale du système de mise à jour.',
      etapes: [
        ...enCours().etapes,
        { phase: 'verifying', at: new Date(Date.now() - 10_000).toISOString() },
        { phase: 'complete', at: new Date(Date.now() - 6_000).toISOString() },
        { phase: 'verifying', at: new Date(Date.now() - 2_000).toISOString() },
      ],
    }),
    'no-preference',
  );
  try {
    await expect(page.locator('li.current')).toHaveText(/^Vérification/);
    const retour = page.locator('#steps [data-phase="complete"]');
    await expect(retour).not.toHaveClass(/done|current/);
    await expect(retour.locator('time')).toHaveText('');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('maintenance : la coupure annoncée du frontal est affichée, puis reprise par l’avis de connexion', async ({
  browser,
}) => {
  // ADR 0103 : redémarrage du frontal annoncé par le service (indicateur « coupure » de l'état publié).
  const etape =
    'Redémarrage du frontal du site. Cette page peut s’interrompre quelques secondes, puis elle reprend toute seule.';
  const avis =
    'Redémarrage du frontal du site : cette page va s’interrompre quelques secondes puis reprendra toute seule. Si elle ne revient pas après une minute, rechargez-la.';
  const { ctx, page, problems, suivi } = await ouvrir(
    browser,
    enCours({ phase: 'verifying', message: etape, coupure: true }),
    'reduce',
  );
  let horsLigne = false;
  await page.route('**/update/status.json', (route) =>
    horsLigne ? route.abort() : route.fulfill({ json: suivi.etat }),
  );
  const coupure = page.locator('#coupure');
  const connexion = page.locator('#connection');
  try {
    await expect(coupure).toBeVisible();
    await expect(coupure).toHaveText(avis);
    await expect(connexion).toBeHidden();
    // Une seule zone annoncée : le texte de l'étape ; l'encadré n'en fait pas un doublon de lecture.
    await expect(page.getByRole('status')).toHaveText(etape);
    // Frontal en cours de redémarrage : l'avis de connexion reprend le message de la coupure, affiché une seule fois.
    horsLigne = true;
    await expect(connexion).toBeVisible();
    await expect(connexion).toHaveText(avis);
    await expect(coupure).toBeHidden();
    // Frontal revenu, coupure retirée : plus aucun avis.
    suivi.etat = enCours({ phase: 'verifying', message: 'Vérification finale du système de mise à jour.' });
    horsLigne = false;
    await expect(connexion).toBeHidden();
    await expect(coupure).toBeHidden();
    // Sans coupure annoncée, une perte de connexion garde l'avis générique.
    horsLigne = true;
    await expect(connexion).toBeVisible();
    await expect(connexion).toHaveText('Connexion momentanément interrompue. Le suivi reprendra automatiquement.');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

// Progression réelle du téléchargement (ADR 0104) : octets reçus et total publiés par l'exécutant pendant la préparation.
const preparation = (changes = {}) =>
  enCours({
    phase: 'preparing',
    message: 'Préparation et vérification de la nouvelle version.',
    etapes: [{ phase: 'preparing', at: new Date(Date.now() - 95_000).toISOString() }],
    ...changes,
  });
const sansChiffre = /%|\d\s*[MK]o\b/;

test('maintenance : la barre de transfert suit le téléchargement mesuré publié, sans aucun chiffre sinon', async ({
  browser,
}) => {
  const { ctx, page, problems, suivi } = await ouvrir(
    browser,
    preparation({ telechargement: { recu: 180_400_000, total: 290_000_000 } }),
    'no-preference',
  );
  const progression = page.locator('#telechargement');
  const remplissage = page.locator('#transfer-fill');
  const reflet = page.locator('.transfer-band');
  try {
    await expect(page.locator('html')).toHaveAttribute('data-art', 'download');
    const barre = page.getByRole('progressbar', { name: 'Téléchargement de la nouvelle version' });
    await expect(barre).toBeVisible();
    await expect(barre).toHaveAttribute('aria-valuenow', '62');
    await expect(barre).toHaveAttribute('aria-valuemin', '0');
    await expect(barre).toHaveAttribute('aria-valuemax', '100');
    await expect(barre).toHaveAttribute('aria-valuetext', '62 %, 180 Mo sur 290 Mo');
    await expect(page.locator('#telechargement-valeur')).toHaveText('62 % · 180 / 290 Mo');
    // Remplissage proportionnel (164 unités pour la barre entière), sans le reflet décoratif ni animation sur la barre.
    await expect(remplissage).toHaveAttribute('width', '102.02');
    await expect(remplissage).toBeVisible();
    await expect(reflet).toBeHidden();
    expect(
      await page.evaluate(() =>
        ['#transfer-fill', '.transfer-band'].map((s) => document.querySelector(s)!.getAnimations().length),
      ),
    ).toEqual([0, 0]);
    // Une seule zone annoncée : le texte de l'étape ; la barre de progression n'en est pas une.
    await expect(page.getByRole('status')).toHaveText('Préparation et vérification de la nouvelle version.');
    await expect(progression).not.toHaveAttribute('aria-live');
    // Avancement : la barre et le texte suivent la donnée publiée ; tailles en Ko sous 1 Mo, une décimale sous 10.
    suivi.etat = preparation({ telechargement: { recu: 1_500_000, total: 3_200_000 } });
    await expect(page.locator('#telechargement-valeur')).toHaveText('46 % · 1,5 / 3,2 Mo');
    suivi.etat = preparation({ telechargement: { recu: 250_000, total: 800_000 } });
    await expect(page.locator('#telechargement-valeur')).toHaveText('31 % · 250 / 800 Ko');
    suivi.etat = preparation({ telechargement: { recu: 289_600_000, total: 290_000_000 } });
    await expect(page.locator('#telechargement-valeur')).toHaveText('99 % · 289 / 290 Mo');
    suivi.etat = preparation({ telechargement: { recu: 290_000_000, total: 290_000_000 } });
    await expect(page.locator('#telechargement-valeur')).toHaveText('100 % · 290 / 290 Mo');
    await expect(remplissage).toHaveAttribute('width', '164');
    // Téléchargement terminé, donnée retirée : animation décorative d'avant, aucun chiffre.
    suivi.etat = preparation({ message: 'Vérification des signatures.' });
    await expect(page.getByRole('status')).toHaveText('Vérification des signatures.');
    await expect(progression).toBeHidden();
    await expect(remplissage).toBeHidden();
    await expect(reflet).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-telechargement');
    expect(await page.locator('body').innerText()).not.toMatch(sansChiffre);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('maintenance : une progression de téléchargement invalide ou hors préparation est ignorée', async ({
  browser,
}) => {
  const { ctx, page, problems, suivi } = await ouvrir(browser, preparation(), 'no-preference');
  const progression = page.locator('#telechargement');
  try {
    await expect(page.locator('html')).toHaveAttribute('data-art', 'download');
    await expect(progression).toBeHidden();
    expect(await page.locator('body').innerText()).not.toMatch(sansChiffre);
    const invalides: unknown[] = [
      { recu: 300, total: 290 },
      { recu: -1, total: 10 },
      { recu: 1, total: 0 },
      { recu: '1', total: '2' },
      { recu: 1.5, total: 3 },
      { recu: 1 },
      [1, 2],
      'x',
      null,
    ];
    for (const [i, telechargement] of invalides.entries()) {
      suivi.etat = preparation({ message: `Préparation ${i}.`, telechargement });
      await expect(page.getByRole('status')).toHaveText(`Préparation ${i}.`);
      await expect(progression).toBeHidden();
      await expect(page.locator('.transfer-band')).toBeVisible();
      expect(await page.locator('body').innerText()).not.toMatch(sansChiffre);
    }
    // Donnée valide mais autre étape (installation) : rien n'est affiché.
    suivi.etat = enCours({ telechargement: { recu: 1, total: 2 } });
    await expect(page.locator('html')).toHaveAttribute('data-art', 'building');
    await expect(progression).toBeHidden();
    expect(await page.locator('body').innerText()).not.toMatch(sansChiffre);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('maintenance : progression du téléchargement en mouvement réduit, barre remplie et statique', async ({
  browser,
}) => {
  const { ctx, page, problems } = await ouvrir(
    browser,
    preparation({ telechargement: { recu: 145_000_000, total: 290_000_000 } }),
    'reduce',
  );
  try {
    await expect(page.locator('#telechargement-valeur')).toHaveText('50 % · 145 / 290 Mo');
    await expect(page.locator('#transfer-fill')).toHaveAttribute('width', '82');
    await expect(page.locator('#transfer-fill')).toBeVisible();
    await expect(page.locator('.transfer-band')).toBeHidden();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
