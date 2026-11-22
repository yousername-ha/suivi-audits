/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : écran « Veille » de bout en bout, sans capture de référence (aucune
   n'est approuvée sans relecture) : état des sources, fenêtre de validation du flux (destinations, ce qui sort), recherche,
   accessibilité, CSP. Le flux n'est jamais ouvert ici : la fenêtre est annulée, pour qu'aucune source réelle ne soit jointe
   depuis la pile de test. Lot V4c : état de la lecture des fiches du CERT Santé.
   Lot L1 : alertes et avis en liste aérée, pastilles de source, fiche d'une alerte et CVE citées, en clair et en sombre, à
   1 366 et 390 px ; lectures remplacées par des données fictives (`page.route`, rien n'atteint la base ni n'y est écrit). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('Vulnérabilités : écran « Veille », sources, validation du flux annulée, recherche', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/vulnerabilites/veille');
    await expect(page.getByRole('heading', { name: 'Veille', level: 1 })).toBeVisible();
    const sources = page.getByRole('region', { name: 'Sources de la veille' });
    for (const hote of [
      'www.cisa.gov',
      'services.nvd.nist.gov',
      'api.first.org',
      'cert.cyber.gouv.fr',
      'cyberveille.esante.gouv.fr',
    ])
      await expect(sources).toContainText(hote);
    await expect(page.getByText('Aucune source n’est lue')).toBeVisible();
    // Lot V4c : état de la lecture des fiches du CERT Santé, aucune lue sur une pile vierge.
    await expect(page.getByText(/Fiches du CERT Santé .* 0 fiche lue, aucune à lire\./)).toBeVisible();
    // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Validation du flux : destinations et ce qui sort ; « Confirmer » exige la case ; annulée, rien n'est ouvert.
    await page.getByRole('button', { name: 'Activer la veille' }).click();
    const fenetre = page.getByRole('dialog', { name: /Veille sur les vulnérabilités/ });
    await expect(fenetre).toContainText('cyberveille.esante.gouv.fr');
    await expect(fenetre).toContainText('Aucune donnée métier');
    await expect(fenetre.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
    await fenetre.getByRole('button', { name: 'Annuler' }).click();
    await expect(fenetre).toBeHidden();
    const flux = (await (await page.request.get('/api/admin/flux-externes')).json()) as {
      modules: { module: string; ouvert: boolean }[];
    };
    expect(flux.modules.find((m) => m.module === 'veille-vulnerabilites')?.ouvert).toBe(false);
    await expect(page.getByRole('button', { name: 'Collecter maintenant' })).toHaveCount(0);

    // Recherche : aucune donnée collectée sur la pile de test.
    await page.getByLabel('Rechercher', { exact: true }).fill('CVE-2026-0001');
    await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(page.getByText('Aucune faille connue ne correspond à la recherche.')).toBeVisible();
    await expect(page.getByText('Aucune alerte ni aucun avis à afficher.')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

const ALERTE = {
  id: '00000000-0000-4000-8000-0000000000a1',
  source: 'cert-fr',
  identifiant: 'CERTFR-2026-ALE-9001',
  nature: 'alerte',
  titre: 'Vulnérabilité dans une passerelle fictive',
  resume:
    'Une vulnérabilité fictive permet l’exécution de code à distance. L’éditeur indique qu’elle est exploitée. - Appliquer le correctif ; - Restreindre l’accès.',
  adresse: 'https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-9001/',
  publieLe: '2026-11-17T10:00:00.000Z',
  cves: ['CVE-2026-90001'],
  vuLe: '2026-11-18T05:00:00.000Z',
  produit: null,
  fiche: null,
};
const AVIS = {
  ...ALERTE,
  id: '00000000-0000-4000-8000-0000000000a2',
  identifiant: 'CERTFR-2026-AVI-9002',
  nature: 'avis',
  titre: 'Multiples vulnérabilités dans un serveur fictif',
  adresse: 'https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-9002/',
  cves: [],
};
const FICHE_CVE = {
  nature: 'cve',
  cves: ['CVE-2026-90001'],
  nombreCves: 1,
  composant: 'Passerelle fictive',
  priorite: {
    niveau: 'P4',
    faits: [
      { fait: 'presence', presence: 'absente' },
      { fait: 'gravite', gravite: null },
    ],
  },
  marques: { zeroDay: false, exploitable: false },
  alerte: null,
  presence: { machines: 0, actifs: 0, horsLecture: false },
  correctif: { etat: 'non_renseigne', sources: [] },
  situationExploitation: null,
  finSupport: null,
  vecteurs: [],
  recommandations: {
    tenable: null,
    tenableRegroupes: [],
    kev: [],
    kevTronque: false,
    versionsNvd: [],
    versionsNvdTronquees: false,
    certSante: null,
    avis: [
      {
        source: 'cert-fr',
        identifiant: ALERTE.identifiant,
        nature: 'alerte',
        titre: ALERTE.titre,
        adresse: ALERTE.adresse,
        le: ALERTE.publieLe,
      },
    ],
    avisTronques: false,
    alh: [],
    alhTronquees: false,
  },
};

for (const [mode, scheme, largeur] of [
  ['clair', 'light', 1366],
  ['sombre', 'dark', 390],
] as const)
  test(`Vulnérabilités : alertes et avis lisibles, pastilles de source, fiche d’une alerte (${mode}, ${largeur} px)`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'fr-FR',
      viewport: { width: largeur, height: 900 },
      colorScheme: scheme,
      storageState: (await sessionAdmin(browser)).state,
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    const axe = async () => {
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    };
    try {
      await page.route(/\/api\/vulnerabilites\/veille\/avis(\?|$)/, (r) =>
        r.fulfill({ json: { total: 2, page: 1, parPage: 25, elements: [ALERTE, AVIS] } }),
      );
      await page.route('**/api/vulnerabilites/fiches/cve/CVE-2026-90001', (r) => r.fulfill({ json: FICHE_CVE }));
      await page.goto('/vulnerabilites/veille');
      const liste = page.getByRole('list', { name: 'Alertes et avis' });
      await expect(liste.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3 }) })).toHaveCount(2);
      await expect(liste.getByRole('heading', { name: ALERTE.titre, level: 3 })).toBeVisible();
      await expect(liste.getByRole('img', { name: 'Source : CERT-FR (ANSSI)' })).toHaveCount(2);
      await expect(liste.locator('.va-item--urgente')).toHaveCount(1);
      await expect(liste.locator('.va-item--urgente')).toContainText('Alerte');
      await expect(liste.getByText('Exploitation avérée (alerte du CERT-FR)')).toBeVisible();
      const original = liste.getByRole('link', { name: /CERTFR-2026-ALE-9001 \(nouvel onglet\)/ });
      await expect(original).toHaveAttribute('target', '_blank');
      await expect(original).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(original).toHaveAttribute('referrerpolicy', 'no-referrer');
      // Aucun débordement horizontal, y compris à 390 px.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await axe();

      // Fiche de l'alerte, ouverte au clavier : résumé découpé en liste, CVE citée qui ouvre sa fiche illustrée.
      const ouvrir = page.getByRole('button', { name: 'Ouvrir la fiche : CERTFR-2026-ALE-9001', exact: true });
      await ouvrir.focus();
      await page.keyboard.press('Enter');
      const fiche = page.getByRole('dialog', { name: 'CERTFR-2026-ALE-9001 (alerte)' });
      await expect(fiche).toBeVisible();
      await expect(fiche.getByRole('listitem').filter({ hasText: 'Restreindre l’accès.' })).toBeVisible();
      await axe();
      await fiche.getByRole('button', { name: 'CVE-2026-90001', exact: true }).click();
      await expect(fiche).toBeHidden();
      const ficheCve = page.getByRole('dialog', { name: 'CVE-2026-90001 (veille)' });
      await expect(ficheCve.getByRole('list', { name: 'Sources reprises par la fiche' })).toBeVisible();
      await expect(ficheCve.getByText('CERT-FR · alerte', { exact: true })).toBeVisible();
      await axe();
      await ficheCve.getByRole('button', { name: 'Fermer la fenêtre' }).click();
      await expect(ficheCve).toBeHidden();
      expect(problems).toEqual([]);
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await ctx.close();
    }
  });
