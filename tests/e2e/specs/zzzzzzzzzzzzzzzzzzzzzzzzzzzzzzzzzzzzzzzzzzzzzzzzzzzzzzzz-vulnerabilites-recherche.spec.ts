/* Module Vulnérabilités (ADR 0100, lot R1) : barre de recherche globale, de bout en bout, sans capture de référence. Lecture
   seule : le parcours n'écrit rien et la pile reste dans son état initial (les réponses remplacées sont retirées dans le bloc
   `finally`). Sur une pile vierge, la route est vérifiée sur ses refus, sur une recherche sans résultat et sur un
   identifiant CVE inconnu (« CVE inconnue de la veille locale », aucun appel sortant) ; puis la barre est jouée avec une
   réponse de lecture remplacée par des données fictives (`page.route`, rien n'atteint la base) : groupes, clavier (flèches,
   Échap, Entrée), « tout voir » vers la veille filtrée, fiche d'une CVE ouverte dans la veille, accessibilité en clair et en
   sombre, CSP. Il ne dépend d'aucun état qui change seul (le tic de l'API ne crée ni CVE ni machine). Droits, cloisonnement
   et échappement sur des données rangées : apps/api/test/vulnerabilites-recherche.test.ts. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const CHAMP = 'Rechercher une CVE, une machine, une adresse IP ou une application';
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const vide = { elements: [], total: 0 };
const REPONSE = {
  q: 'exemple',
  cves: {
    elements: [
      {
        cve: 'CVE-2026-90001',
        veille: true,
        resume: 'Fictional flaw in a fictional product.',
        produit: 'Editeur fictif Produit fictif',
        gravite: 'CRITICAL',
        score: 9.8,
        kev: false,
        machines: 0,
        machinesDeclarees: 0,
        actifs: 0,
        horsLecture: false,
        fiche: true,
      },
    ],
    total: 3,
  },
  machines: {
    elements: [
      {
        id: ID(1),
        nom: 'srv-exemple-1.example.org',
        adresse: '192.0.2.41',
        systeme: 'Exemple Linux 9',
        role: 'front',
        perimetreNom: null,
      },
    ],
    total: 1,
  },
  actifs: {
    elements: [
      {
        id: ID(11),
        type: 'domaine',
        valeur: 'portail.example.org',
        adresse: '203.0.113.13',
        perimetreNom: null,
        alertesOuvertes: 0,
      },
    ],
    total: 1,
  },
  produits: vide,
  technologies: vide,
  controles: vide,
  cveInconnue: null,
};

for (const [mode, scheme] of [
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const)
  test(`Vulnérabilités : barre de recherche globale (${mode})`, async ({ browser }) => {
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
      // Après un changement de page ou l'ouverture d'une liste : même attente que zzzzz-accessibilite.
      await page.waitForTimeout(400);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    };
    try {
      // Route sur une pile vierge : bornes de la saisie, aucun résultat, identifiant inconnu signalé.
      expect((await page.request.get('/api/vulnerabilites/recherche?q=a')).status()).toBe(422);
      expect((await page.request.get(`/api/vulnerabilites/recherche?q=${'x'.repeat(201)}`)).status()).toBe(422);
      const r = await page.request.get('/api/vulnerabilites/recherche?q=CVE-2026-99999');
      expect(r.status()).toBe(200);
      expect(await r.json()).toMatchObject({ cves: vide, machines: vide, cveInconnue: { cve: 'CVE-2026-99999' } });

      // Barre en tête des pages du module.
      await page.goto('/vulnerabilites/vue');
      const champ = page.getByRole('combobox', { name: CHAMP, exact: true });
      await expect(champ).toBeVisible();
      await champ.fill('CVE-2026-99999');
      // Message du panneau, et la même information annoncée par la zone de statut.
      await expect(page.getByText(/CVE inconnue de la veille locale\. Aucune source collectée/)).toBeVisible();
      await expect(page.getByText(/ne consulte aucun service extérieur/)).toBeVisible();
      await expect(
        page.getByRole('status').filter({ hasText: 'CVE-2026-99999 : CVE inconnue de la veille locale.' }),
      ).toHaveCount(1);
      await axe();
      await champ.fill('zz-aucun-resultat');
      await expect(
        page.getByText('Aucun résultat dans le module pour « zz-aucun-resultat ».', { exact: true }),
      ).toBeVisible();

      // Réponse remplacée par des données fictives (lecture seule).
      await page.route(/\/api\/vulnerabilites\/recherche\?/, (x) => x.fulfill({ json: REPONSE }));
      await page.goto('/vulnerabilites/machines');
      const champ2 = page.getByRole('combobox', { name: CHAMP, exact: true });
      await champ2.fill('exemple');
      const liste = page.getByRole('listbox', { name: 'Résultats de la recherche' });
      await expect(liste).toBeVisible();
      await expect(champ2).toHaveAttribute('aria-expanded', 'true');
      for (const g of ['CVE', 'Machines internes', 'Actifs exposés'])
        await expect(liste.getByRole('group', { name: new RegExp(`^${g}`) })).toBeVisible();
      await expect(liste.getByRole('option', { name: /CVE-2026-90001.*Non détectée sur le parc/ })).toBeVisible();
      await expect(liste.getByRole('option', { name: 'srv-exemple-1.example.org' })).toBeVisible();
      await expect(liste.getByRole('option', { name: /Tout voir \(3\)/ })).toBeVisible();
      await axe();

      // Clavier : la flèche désigne la première option ; Échap ferme ; Entrée ouvre la fiche de la CVE dans la veille.
      await champ2.press('ArrowDown');
      const premiere = liste.getByRole('option').first();
      await expect(premiere).toHaveAttribute('aria-selected', 'true');
      await expect(champ2).toHaveAttribute('aria-activedescendant', (await premiere.getAttribute('id'))!);
      await champ2.press('Escape');
      await expect(champ2).toHaveAttribute('aria-expanded', 'false');
      await champ2.press('ArrowDown');
      await champ2.press('Enter');
      await expect(page).toHaveURL(/\/vulnerabilites\/veille\?q=CVE-2026-90001&cve=CVE-2026-90001$/);
      const fiche = page.getByRole('dialog', { name: 'CVE-2026-90001 (veille)' });
      await expect(fiche).toBeVisible();
      await fiche.getByRole('button', { name: 'Fermer la fenêtre' }).click();
      await expect(fiche).toBeHidden();

      // « Tout voir » : la veille filtrée sur la saisie, depuis la page déjà affichée.
      const champ3 = page.getByRole('combobox', { name: CHAMP, exact: true });
      await champ3.fill('');
      await champ3.fill('exemple');
      await page.getByRole('option', { name: /Tout voir \(3\)/ }).click();
      await expect(page).toHaveURL(/\/vulnerabilites\/veille\?q=exemple$/);
      await expect(page.getByRole('textbox', { name: 'Rechercher', exact: true })).toHaveValue('exemple');
      await axe();
      expect(problems).toEqual([]);
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await ctx.close();
    }
  });
