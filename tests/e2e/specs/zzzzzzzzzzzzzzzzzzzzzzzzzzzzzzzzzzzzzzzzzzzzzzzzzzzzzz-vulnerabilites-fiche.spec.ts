/* Module Vulnérabilités (ADR 0100, lot PC4) : fiche illustrée d'une faille, de bout en bout, sans capture de référence.
   Lecture seule : le parcours n'écrit rien, la pile reste dans son état initial. Une pile vierge n'a aucune faille : la
   route est vérifiée sur ses refus (identifiant mal formé, faille inconnue), puis l'écran « Veille » est joué avec deux
   réponses de lecture remplacées par des données fictives (`page.route`, rien n'atteint la base) : recherche d'une CVE,
   ouverture de sa fiche au clavier, en-tête, vecteur traduit, schéma nommé et son équivalent texte, recommandations par
   source, accessibilité en clair et en sombre, CSP. Il ne dépend d'aucun état qui change seul (planification de l'API). Les
   droits, la non-fuite et la règle des sources sur des données rangées sont couverts par les tests de l'API et de
   l'interface (apps/api/test/vulnerabilites-fiches.test.ts, apps/web/test/vulnerabilites-fiche-faille.test.ts). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const CVE = 'CVE-2026-90001';
const SOURCES = { exploitation: [], exploitable: [], valeurs: { gravites: [], cvss: [], epss: [] }, certSante: null };
const FAILLE = {
  cve: CVE,
  description: 'Fictional NVD description.',
  publieLe: '2026-11-10T00:00:00.000Z',
  modifieLe: '2026-11-12T00:00:00.000Z',
  cvss31: { score: 9.8, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', gravite: 'CRITICAL' },
  cvss40: null,
  editeurs: ['editeur_fictif'],
  produits: ['produit_fictif'],
  epss: null,
  kev: null,
  publications: [{ source: 'nvd', le: '2026-11-10T00:00:00.000Z' }],
  produitsCites: [],
  sources: SOURCES,
  surfaceExterne: null,
};
const FICHE = {
  nature: 'cve',
  cves: [CVE],
  nombreCves: 1,
  composant: 'editeur_fictif produit_fictif',
  priorite: {
    niveau: 'P3',
    faits: [
      { fait: 'presence', presence: 'absente' },
      { fait: 'gravite', gravite: 'critique' },
    ],
  },
  marques: { zeroDay: false, exploitable: false },
  alerte: null,
  presence: { machines: 0, actifs: 0, horsLecture: false },
  vecteurs: [{ source: 'nvd', cve: CVE, brut: FAILLE.cvss31.vecteur, score: 9.8 }],
  recommandations: {
    tenable: null,
    kev: [],
    kevTronque: false,
    versionsNvd: [
      {
        cve: CVE,
        editeur: 'editeur_fictif',
        produit: 'produit_fictif',
        version: null,
        debutInclus: '1.0',
        debutExclus: null,
        finInclus: null,
        finExclus: '2.0',
      },
    ],
    versionsNvdTronquees: false,
    certSante: null,
    avis: [],
    avisTronques: false,
    alh: [],
    alhTronquees: false,
  },
};

for (const [mode, scheme] of [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const)
  test(`Vulnérabilités : fiche illustrée d’une faille (${mode})`, async ({ browser }) => {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'fr-FR',
      viewport: { width: 1366, height: 900 },
      colorScheme: scheme,
      storageState: (await sessionAdmin(browser)).state,
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    const axe = async () => {
      // Après un changement de page ou l'ouverture d'une fenêtre : même attente que zzzzz-accessibilite.
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    };
    try {
      // Route de lecture : identifiant contrôlé, faille inconnue (pile vierge) : 404.
      expect((await page.request.get('/api/vulnerabilites/fiches/cve/pas-une-cve')).status()).toBe(422);
      expect((await page.request.get('/api/vulnerabilites/fiches/machine/CVE-2026-90001')).status()).toBe(422);
      expect((await page.request.get('/api/vulnerabilites/fiches/cve/CVE-2026-99999')).status()).toBe(404);
      expect(
        (await page.request.get('/api/vulnerabilites/fiches/constat/00000000-0000-4000-8000-00000000dead')).status(),
      ).toBe(404);

      // Lectures remplacées par des données fictives (rien n'est écrit) : recherche de la veille et fiche de la CVE.
      await page.route(/\/api\/vulnerabilites\/veille\/failles(\?|$)/, (r) => {
        const kev = new URL(r.request().url()).searchParams.get('kev') === 'oui';
        return r.fulfill({
          json: { total: kev ? 0 : 1, page: 1, parPage: 25, elements: kev ? [] : [FAILLE] },
        });
      });
      await page.route(`**/api/vulnerabilites/fiches/cve/${CVE}`, (r) => r.fulfill({ json: FICHE }));

      await page.goto(`/vulnerabilites/veille?q=${CVE}`);
      const ouvrir = page.getByRole('button', { name: CVE, exact: true });
      await expect(ouvrir).toBeVisible();
      await ouvrir.focus();
      await page.keyboard.press('Enter');
      const fenetre = page.getByRole('dialog', { name: `${CVE} (veille)` });
      await expect(fenetre).toBeVisible();
      await expect(fenetre.getByText('Priorité 3 (P3)', { exact: true })).toBeVisible();
      await expect(fenetre.getByRole('heading', { name: 'Vecteur d’attaque, en clair', level: 3 })).toBeVisible();
      await expect(fenetre.getByText('Vecteur d’accès : réseau', { exact: false }).first()).toBeVisible();
      await expect(fenetre.getByText('Aucun compte nécessaire', { exact: true })).toBeVisible();
      await expect(fenetre.getByText(FAILLE.cvss31.vecteur, { exact: true }).first()).toBeVisible();
      await expect(
        fenetre.getByRole('img', { name: /^Schéma du vecteur d’attaque : attaque depuis internet/ }),
      ).toBeVisible();
      await expect(fenetre.getByText('D’où vient l’attaque : Internet ou tout réseau (AV:N).')).toBeVisible();
      await expect(fenetre.getByRole('heading', { name: 'Recommandations des sources', level: 3 })).toBeVisible();
      await expect(fenetre.getByText('NVD · versions touchées', { exact: true })).toBeVisible();
      await axe();
      await fenetre.getByRole('button', { name: 'Fermer la fenêtre' }).click();
      await expect(fenetre).toBeHidden();
      expect(problems).toEqual([]);
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await ctx.close();
    }
  });
