/* Coque de l'application (dossiers 020 et 012) : en-tête et menu fixes pendant le défilement du contenu (ordinateur,
   tablette, téléphone), style global Clair appliqué en direct aux sessions ouvertes, sans écart d'accessibilité.
   Le style Sauge est rétabli à la fin : les autres parcours le supposent. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const AFFICHAGES = [
  ['ordinateur', 1366, 768],
  ['tablette', 800, 900],
  ['téléphone', 390, 844],
] as const;

/** Ajoute au contenu une hauteur de 3000 px, fait défiler la page puis renvoie le haut de chaque élément fixe avant/après. */
async function positionsApresDefilement(page: Page, selecteurs: string[]) {
  const lire = () =>
    page.evaluate(
      (s) => s.map((sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().top ?? Number.NaN)),
      selecteurs,
    );
  await page.evaluate(() => {
    const cale = document.createElement('div');
    cale.style.height = '3000px';
    cale.setAttribute('data-cale', '');
    (document.querySelector('main') ?? document.body).appendChild(cale);
  });
  const avant = await lire();
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  return { avant, apres: await lire() };
}

for (const [nom, largeur, hauteur] of AFFICHAGES) {
  test(`Coque (${nom}, ${largeur} px) : en-tête et menu restent en place pendant le défilement`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      storageState: (await sessionAdmin(browser)).state,
      ignoreHTTPSErrors: true,
      viewport: { width: largeur, height: hauteur },
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    try {
      await page.goto('/pilotage/synthese');
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const selecteurs = largeur >= 576 ? ['.shell-top', '.shell-nav-inner'] : ['.shell-top'];
      const { avant, apres } = await positionsApresDefilement(page, selecteurs);
      expect(avant.every((v) => Number.isFinite(v))).toBe(true);
      expect(apres).toEqual(avant);
      if (largeur >= 576) {
        // Le menu est borné à la hauteur de la fenêtre et défile seul s'il est plus long.
        const borne = await page.evaluate(() => {
          const el = document.querySelector('.shell-nav-inner') as HTMLElement;
          return {
            hauteur: el.getBoundingClientRect().height,
            fenetre: window.innerHeight,
            overflowY: getComputedStyle(el).overflowY,
          };
        });
        expect(borne.overflowY).toBe('auto');
        expect(borne.hauteur).toBeLessThanOrEqual(borne.fenetre);
      }
      expect(problems).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}

test('Style Clair : enregistré par l’administrateur, appliqué sans rechargement à une session ouverte, accessible', async ({
  browser,
}) => {
  const etat = (await sessionAdmin(browser)).state;
  const ouvrir = (viewport = { width: 1366, height: 768 }) =>
    browser.newContext({ storageState: etat, ignoreHTTPSErrors: true, viewport, colorScheme: 'light' });
  const [a, b] = [await ouvrir(), await ouvrir()];
  const [pa, pb] = [await a.newPage(), await b.newPage()];
  const problems = watchPage(pb);
  const choisir = async (libelle: RegExp) => {
    await pa.goto('/parametres/apparence');
    await pa.getByRole('radio', { name: libelle }).check();
    await pa.getByRole('button', { name: /Enregistrer/ }).click();
  };
  try {
    await pb.goto('/');
    await expect(pb.locator('html')).toHaveAttribute('data-style', 'sage');
    await choisir(/Clair bleuté/);
    // La seconde session reçoit le changement par le flux temps réel, sans rechargement.
    await expect(pb.locator('html')).toHaveAttribute('data-style', 'clair', { timeout: 15_000 });
    for (const url of ['/', '/parametres', '/pilotage/synthese']) {
      await pb.goto(url);
      await expect(pb.locator('html')).toHaveAttribute('data-style', 'clair');
      const r = await new AxeBuilder({ page: pb }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(
        r.violations.map((v) => `${v.id} (${v.nodes.length})`),
        url,
      ).toEqual([]);
    }
    expect(problems).toEqual([]);
  } finally {
    await choisir(/Référence 08/).catch(() => undefined);
    await pb
      .locator('html')
      .getAttribute('data-style')
      .catch(() => undefined);
    await a.close();
    await b.close();
  }
});
