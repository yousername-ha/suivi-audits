/* Module Vulnérabilités (ADR 0100, lot S3) : vue « Par correctif », fin de support et état du correctif, de bout en bout, sans
   capture de référence. Lecture seule : le parcours n'écrit rien, la pile reste dans son état initial (les réponses
   remplacées sont retirées dans le bloc `finally`). Une pile vierge n'a aucune faille : la route est vérifiée sur ses refus
   et sa réponse vide, puis la vue est jouée avec deux réponses de lecture remplacées par des données fictives (`page.route`,
   rien n'atteint la base) : en-tête « n mises à jour à faire pour m failles », table, fenêtre d'un correctif, accessibilité
   en clair et en sombre, CSP. Filtres « Fin de support » des failles et des machines, tuile de la vue d'ensemble. Il ne
   dépend d'aucun état qui change seul (le tic de l'API ne crée aucune faille). Regroupement, droits, non-fuite et nombre de
   requêtes sur des données rangées : apps/api/test/vulnerabilites-correctifs.test.ts. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ouvrirFiltres, sessionAdmin, watchPage } from '../helpers';

const CLE = '0123456789abcdef';
const SOLUTION = 'Upgrade to Exemple Web 2.0 or later (fictif).';
const DELAI = {
  etat: 'en_depassement',
  priorite: 'P1',
  delai: { duree: 48, unite: 'heures' },
  premiere: '2026-11-01T08:00:00.000Z',
  depuis: '2026-11-01T08:00:00.000Z',
  echeance: '2026-11-03T08:00:00.000Z',
};
const GROUPE = {
  cle: CLE,
  solution: SOLUTION,
  failles: 37,
  cves: 112,
  machines: { lisibles: 14, horsLecture: true },
  priorite: 'P1',
  exploitees: 3,
  exploiteesSansCorrectif: 1,
  exploitables: 5,
  finDeSupport: 2,
  delai: { etat: 'en_depassement', echeance: '2026-11-03T08:00:00.000Z', enDepassement: 4 },
  correctif: { disponible: 30, aucun_connu: 1, non_renseigne: 6 },
  sourcesCorrectif: ['tenable', 'cert-sante'],
};
const LISTE = {
  misesAJour: 1,
  failles: 37,
  sansCorrectif: 0,
  groupes: [GROUPE],
  total: 1,
  tronquee: false,
  calculeLe: '2026-11-18T10:00:00.000Z',
};
const DETAIL = {
  groupe: GROUPE,
  failles: [
    {
      id: '00000000-0000-4000-8000-0000000000c1',
      plugin: '900101',
      nom: 'Exemple Web < 2.0 Multiple Vulnerabilities (fictif)',
      priorite: 'P1',
      exploitee: true,
      exploitable: false,
      correctif: { etat: 'aucun_connu', sources: [{ source: 'cert-sante', valeur: 'aucun', le: null }] },
      situation: 'sans_correctif',
      finSupportLe: null,
      finDeSupport: false,
      delai: DELAI,
      cves: 3,
      lisible: false,
    },
  ],
  faillesTronquees: false,
  machines: [],
  machinesTronquees: false,
};

for (const [mode, scheme] of [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const)
  test(`Vulnérabilités : vue par correctif et fin de support (${mode})`, async ({ browser }) => {
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
      // Après un changement de page, d'onglet ou l'ouverture d'une fenêtre : même attente que zzzzz-accessibilite.
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    };
    try {
      // Routes de lecture sur une pile vierge : aucune mise à jour ; clé contrôlée ; groupe inconnu.
      const r = await page.request.get('/api/vulnerabilites/correctifs');
      expect(r.status()).toBe(200);
      expect(await r.json()).toMatchObject({ misesAJour: 0, failles: 0, sansCorrectif: 0, groupes: [], total: 0 });
      expect((await page.request.get('/api/vulnerabilites/correctifs/pas-une-cle')).status()).toBe(422);
      expect((await page.request.get(`/api/vulnerabilites/correctifs/${CLE}`)).status()).toBe(404);
      expect((await page.request.get('/api/vulnerabilites/machines?finSupport=oui')).status()).toBe(200);

      // Vue « Par correctif » vide, ouverte par l'adresse.
      await page.goto('/vulnerabilites/failles?vue=correctifs');
      await expect(page.getByRole('heading', { name: 'Failles détectées', level: 1 })).toBeVisible();
      await expect(page.getByRole('heading', { name: '0 mise à jour à faire pour 0 faille', level: 2 })).toBeVisible();
      for (const t of ['Priorité', 'Correctif indiqué par Tenable', 'Failles corrigées', 'État du correctif'])
        await expect(page.locator('th', { hasText: new RegExp(`^${t}$`) })).toBeVisible();
      await expect(page.getByText('Aucune faille détectée à traiter ne correspond.')).toBeVisible();
      await axe();

      // Lectures remplacées par des données fictives (rien n'est écrit).
      await page.route(/\/api\/vulnerabilites\/correctifs(\?|$)/, (x) => x.fulfill({ json: LISTE }));
      await page.route(`**/api/vulnerabilites/correctifs/${CLE}`, (x) => x.fulfill({ json: DETAIL }));
      await page.reload();
      await expect(
        page.getByRole('heading', { name: '1 mise à jour à faire pour 37 failles', level: 2 }),
      ).toBeVisible();
      await expect(page.getByText('14 machines lues, et d’autres que vous ne lisez pas')).toBeVisible();
      await expect(page.getByText('3 à exploitation avérée, dont 1 sans correctif connu')).toBeVisible();
      await page.getByRole('textbox', { name: 'Rechercher un correctif', exact: true }).fill('upgrade');
      await ouvrirFiltres(page, 'Priorité du correctif');
      await expect(page.getByRole('combobox', { name: 'Priorité du correctif', exact: true })).toBeVisible();
      await axe();
      const ouvrir = page.getByRole('button', { name: SOLUTION, exact: true });
      await ouvrir.focus();
      await page.keyboard.press('Enter');
      const fenetre = page.getByRole('dialog', { name: 'Correctif indiqué par Tenable' });
      await expect(fenetre).toBeVisible();
      await expect(fenetre.getByText('Exploitée, sans correctif connu', { exact: true })).toBeVisible();
      await expect(fenetre.getByText('Aucun correctif connu', { exact: true })).toBeVisible();
      await expect(fenetre.getByText(/aucune de ses machines n’est lue par vous/)).toBeVisible();
      await expect(fenetre.getByText('Aucune machine que vous lisez.')).toBeVisible();
      await axe();
      await fenetre.getByRole('button', { name: 'Fermer la fenêtre' }).click();
      await expect(fenetre).toBeHidden();
      await page.unrouteAll({ behavior: 'ignoreErrors' });

      // Filtre « Fin de support » des failles, repris de l'adresse (lien de la tuile).
      await page.goto('/vulnerabilites/failles?finSupport=oui');
      await ouvrirFiltres(page, /^Fin de support/);
      await expect(page.getByRole('checkbox', { name: /^Fin de support/ })).toBeChecked();
      await expect(page.getByText('Aucune faille détectée ne correspond')).toBeVisible();
      await axe();

      // Vue d'ensemble : tuile « Fin de support » vers la liste filtrée.
      await page.goto('/vulnerabilites/vue');
      const tuiles = page.getByRole('navigation', { name: 'Chiffres clés : listes filtrées' });
      await expect(tuiles.getByRole('link', { name: /Fin de support/ })).toHaveAttribute(
        'href',
        '/vulnerabilites/failles?finSupport=oui',
      );
      await expect(tuiles.getByRole('link', { name: /Fin de support/ })).toContainText('00');
      expect(problems).toEqual([]);
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await ctx.close();
    }
  });
