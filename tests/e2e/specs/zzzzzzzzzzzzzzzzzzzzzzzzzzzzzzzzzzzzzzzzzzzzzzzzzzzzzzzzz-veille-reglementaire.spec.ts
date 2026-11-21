/* Veille réglementaire (ADR 0110, lot VR-1) : écran de bout en bout, sans capture de référence (aucune n'est approuvée sans
   relecture). État des sources, fenêtre de validation du flux (destinations, ce qui sort) annulée : aucune source réelle
   n'est jointe depuis la pile de test. Liste et qualification en un clic sur des données fictives (`page.route`) : la
   demande de qualification part avec If-Match et le statut choisi, rien n'atteint la base ni n'y est écrit. Accessibilité,
   CSP (watchPage). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const PUBLICATION = {
  id: '00000000-0000-4000-8000-0000000000b1',
  source: 'anssi',
  domaine: 'securite',
  titre: 'Publication fictive de l’ANSSI',
  resume: null,
  lien: 'https://cyber.gouv.fr/fictif/publication',
  publieLe: '2026-11-19T08:00:00.000Z',
  collecteLe: '2026-11-20T06:00:00.000Z',
  statut: 'a-qualifier',
  qualifieLe: null,
  qualifiePar: null,
  suites: { exigences: 0, actions: 0, documents: 0 },
  version: 4,
};

test('Veille réglementaire : sources, validation du flux annulée', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/veille-reglementaire');
    await expect(page.getByRole('heading', { name: 'Veille réglementaire', level: 1 })).toBeVisible();
    const sources = page.getByRole('region', { name: 'Sources de la veille réglementaire' });
    for (const hote of ['www.cnil.fr', 'www.edpb.europa.eu', 'eur-lex.europa.eu', 'cyber.gouv.fr'])
      await expect(sources).toContainText(hote);
    // ANS et Légifrance : aucun flux, source affichée non disponible, hôte de l'ANS absent.
    await expect(sources).toContainText('Non disponible : aucun flux public connu.');
    await expect(sources).not.toContainText('esante.gouv.fr');
    // Filtre d'EUR-Lex : liste par défaut, saisissable par l'administrateur (droit d'administrer le module).
    await expect(page.getByRole('heading', { name: 'Filtre d’EUR-Lex' })).toBeVisible();
    await expect(page.getByLabel('Mots du domaine « Sécurité de l’information »')).toHaveValue(/cybersecurity/);
    await expect(page.getByText('Aucune source n’est lue')).toBeVisible();
    await expect(page.getByText('Aucune publication ne correspond.')).toBeVisible();
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await page.getByRole('button', { name: 'Activer la veille réglementaire' }).click();
    const fenetre = page.getByRole('dialog', { name: /Veille réglementaire/ });
    await expect(fenetre).toContainText('www.cnil.fr');
    await expect(fenetre).not.toContainText('esante.gouv.fr');
    await expect(fenetre).toContainText('Aucune donnée métier');
    await expect(fenetre.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
    await fenetre.getByRole('button', { name: 'Annuler' }).click();
    await expect(fenetre).toBeHidden();
    const flux = (await (await page.request.get('/api/admin/flux-externes')).json()) as {
      modules: { module: string; ouvert: boolean }[];
    };
    expect(flux.modules.find((m) => m.module === 'veille-reglementaire')?.ouvert).toBe(false);
    await expect(page.getByRole('button', { name: 'Collecter maintenant' })).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Veille réglementaire : qualification en un clic (données fictives)', async ({ browser }) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    let courante: Record<string, unknown> = { ...PUBLICATION };
    const envois: { statut: unknown; ifMatch: string | undefined }[] = [];
    await page.route('**/api/veille-reglementaire/droits', (r) =>
      r.fulfill({ json: { administrer: true, qualifier: { securite: true, donneesPersonnelles: false } } }),
    );
    await page.route(/\/api\/veille-reglementaire\/publications(\?|$)/, (r) =>
      r.fulfill({ json: { elements: [courante], total: 1, page: 1, parPage: 25 } }),
    );
    await page.route(`**/api/veille-reglementaire/publications/${PUBLICATION.id}`, (r) => {
      envois.push({ statut: r.request().postDataJSON().statut, ifMatch: r.request().headers()['if-match'] });
      courante = {
        ...courante,
        statut: 'impactant',
        qualifieLe: '2026-11-20T09:00:00.000Z',
        qualifiePar: { id: '00000000-0000-4000-8000-0000000000c1', nom: 'Nom fictif' },
        version: 5,
      };
      return r.fulfill({ json: courante });
    });
    await page.goto('/veille-reglementaire');
    const liste = page.getByRole('list', { name: 'Publications' });
    await expect(liste).toContainText('Publication fictive de l’ANSSI');
    await expect(liste.getByRole('link', { name: 'Lire sur le site de la source' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    const groupe = liste.getByRole('group', { name: /Qualifier « Publication fictive/ });
    await groupe.getByRole('button', { name: 'Impactant' }).click();
    await expect(liste).toContainText('Qualifiée par Nom fictif');
    await expect(groupe.getByRole('button', { name: 'Impactant' })).toHaveAttribute('aria-pressed', 'true');
    expect(envois).toEqual([{ statut: 'impactant', ifMatch: '"4"' }]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
