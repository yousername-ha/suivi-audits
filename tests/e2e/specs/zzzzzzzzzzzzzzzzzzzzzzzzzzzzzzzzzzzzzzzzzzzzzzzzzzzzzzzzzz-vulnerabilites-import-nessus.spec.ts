/* Module Vulnérabilités (ADR 0100, lot N1) : import d'un scan Nessus de bout en bout, sans capture de référence (aucune n'est
   approuvée sans relecture). Carte « Intégrations » de la page Plateforme : instance « Nessus, import de fichier » créée (ni
   adresse ni clé), activée sans flux, scan fictif importé par le champ de fichier (lu dans le navigateur, envoyé par lots),
   progression puis bilan, import inscrit dans « Exécutions » ; écrans du module : machines et failles marquées de leur
   source ; second fichier où une faille a disparu sur une machine scannée et où une machine est absente (inchangée) ;
   accessibilité en clair (1 366 px) et en sombre (390 px). Fichiers .nessus fictifs écrits à la main (tests/fixtures/nessus).
   Ce fichier passe en DERNIER (préfixe le plus long) : aucune route ne retire une machine importée, et les parcours
   précédents vérifient des listes vides sur une pile vierge. Ses assertions ne visent que l'instance qu'il crée (nom
   unique), ce qui le rend rejouable ; l'instance est désactivée dans `finally`. Les contrôles fictifs ne citent aucune CVE
   du catalogue KEV : aucune alerte critique ne s'ouvre. */
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const FIXTURES = path.resolve(import.meta.dirname, '../../fixtures/nessus');
const SCAN1 = path.join(FIXTURES, 'scan-fictif-1.nessus');
const SCAN2 = path.join(FIXTURES, 'scan-fictif-2.nessus');

async function axe(page: Page) {
  // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
  await page.waitForTimeout(400);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
}

/** Importe un fichier par la fenêtre « Importer un scan » de l'instance et attend le bilan. */
async function importer(page: Page, nom: string, fichier: string) {
  const tuile = page.getByRole('region', { name: nom, exact: true });
  await tuile.getByRole('button', { name: `Importer un scan dans ${nom}`, exact: true }).click();
  const fenetre = page.getByRole('dialog', { name: `Importer un scan : ${nom}`, exact: true });
  await expect(fenetre).toBeVisible();
  await fenetre.locator('input[type="file"]').setInputFiles(fichier);
  await expect(fenetre.getByRole('status').filter({ hasText: 'à importer' })).toBeVisible();
  await fenetre.getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(
    fenetre
      .getByRole('progressbar', { name: 'Progression de l’import', exact: true })
      .or(fenetre.getByRole('status').filter({ hasText: 'Import terminé' })),
  ).toBeVisible();
  const fini = fenetre.getByRole('status').filter({ hasText: 'Import terminé' });
  await expect(fini).toBeVisible();
  return fenetre;
}

for (const [mode, scheme, largeur] of [
  ['clair', 'light', 1366],
  ['sombre', 'dark', 390],
] as const)
  test(`Import Nessus (lot N1) : instance sans adresse ni clé, scan importé, source dans le module, faille disparue (${mode}, ${largeur} px)`, async ({
    browser,
  }) => {
    const admin = await sessionAdmin(browser);
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'fr-FR',
      colorScheme: scheme,
      viewport: { width: largeur, height: 900 },
      storageState: admin.state,
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    const nom = `Nessus fictif ${mode} ${Date.now().toString(36)}`;
    const source = `Source : ${nom} (Nessus, import de fichier)`;
    try {
      await page.goto('/plateforme/integrations');
      const carte = page.getByRole('dialog', { name: 'Intégrations', exact: true });
      await expect(carte).toBeVisible();
      const type = carte.getByRole('region', { name: 'Nessus, import de fichier', exact: true });
      await expect(type).toContainText('import de fichier, sans réseau');
      await type.getByRole('button', { name: 'Ajouter une instance', exact: true }).click();
      const ajout = page.getByRole('dialog', { name: 'Ajouter : Nessus, import de fichier', exact: true });
      // Ni adresse, ni délai, ni fréquence, ni clé : le nom et les gravités.
      await expect(ajout.getByRole('textbox', { name: 'Adresse du service', exact: true })).toHaveCount(0);
      await expect(ajout.getByText('Fréquence de la synchronisation automatique')).toHaveCount(0);
      await expect(ajout.getByText('Secrets', { exact: true })).toHaveCount(0);
      await ajout.getByRole('textbox', { name: 'Nom', exact: true }).fill(nom);
      await ajout.getByRole('button', { name: 'Créer l’instance', exact: true }).click();
      const config = page.getByRole('dialog', { name: `Configurer ${nom}`, exact: true });
      await expect(config.getByRole('group', { name: 'Gravités à importer' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(config).toBeHidden();

      const tuile = page.getByRole('region', { name: nom, exact: true });
      await expect(tuile.getByRole('button', { name: 'Tester la connexion' })).toHaveCount(0);
      await expect(tuile.getByRole('button', { name: 'Synchroniser maintenant' })).toHaveCount(0);
      await expect(tuile.getByRole('button', { name: `Importer un scan dans ${nom}`, exact: true })).toBeDisabled();
      // Activer : aucun flux à valider.
      await tuile.getByRole('button', { name: 'Activer', exact: true }).click();
      await expect(tuile.getByRole('button', { name: 'Désactiver', exact: true })).toBeVisible();
      await expect(page.getByRole('dialog', { name: /ouvrir son flux/ })).toHaveCount(0);

      // Premier scan : trois machines, trois failles retenues (critiques et élevées), éléments écartés comptés.
      const fenetre = await importer(page, nom, SCAN1);
      await expect(fenetre).toContainText('Import : 3 machines sur 3, 3 failles (4 détections) en 1 lot.');
      await expect(fenetre).toContainText('machines sans adresse ni identifiant : 1');
      await expect(fenetre).not.toContainText('SORTIE-BRUTE');
      await axe(page);
      await fenetre.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await expect(fenetre).toBeHidden();
      await tuile.getByRole('button', { name: 'Exécutions', exact: true }).click();
      const executions = page.getByRole('dialog', { name: `Exécutions : ${nom}`, exact: true });
      await expect(executions.getByRole('cell', { name: 'Importer un scan', exact: true })).toBeVisible();
      await expect(executions).toContainText('Gravités retenues : Critique, Élevée.');
      await page.keyboard.press('Escape');
      await expect(executions).toBeHidden();
      await axe(page);

      // Écrans du module : failles et machines marquées de leur source (cette instance seulement).
      await page.goto('/vulnerabilites/failles');
      await expect(page.getByRole('heading', { name: 'Failles détectées', level: 1 })).toBeVisible();
      const etat = page.getByRole('region', { name: 'État de l’intégration Nessus (import de fichier)', exact: true });
      await expect(etat.getByText(nom, { exact: true })).toBeVisible();
      await expect(etat).toContainText('3 machines');
      const lignes = page.getByRole('row').filter({ hasText: source });
      await expect(lignes).toHaveCount(3);
      await expect(lignes.filter({ hasText: 'Fictional Web Server < 9.9 Remote Flaw' })).toContainText('2');
      await axe(page);
      await page.goto('/vulnerabilites/machines');
      await expect(page.getByRole('heading', { name: 'Machines', level: 1 })).toBeVisible();
      const machines = page.getByRole('row').filter({ hasText: source });
      await expect(machines).toHaveCount(3);
      await expect(machines.filter({ hasText: 'srv-fictif-01.example.org' })).toBeVisible();
      await expect(machines.filter({ hasText: '203.0.113.23' })).toBeVisible();
      await axe(page);

      // Second scan : 919102 a disparu de srv-fictif-01, 203.0.113.23 est absente du fichier (inchangée).
      await page.goto('/plateforme/integrations');
      const fenetre2 = await importer(page, nom, SCAN2);
      await expect(fenetre2).toContainText('Import : 2 machines sur 2, 1 faille (2 détections) en 1 lot.');
      await expect(fenetre2).toContainText('1 détection disparue sur les machines scannées.');
      await fenetre2.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await page.goto('/vulnerabilites/failles?etat=tous');
      const toutes = page.getByRole('row').filter({ hasText: source });
      await expect(toutes).toHaveCount(3);
      const disparue = toutes.filter({ hasText: 'Fictional SSH Daemon Weak Setting' });
      await expect(disparue).toContainText('vue en dernier');
      await expect(toutes.filter({ hasText: 'Fictional Database Unsupported Version' })).not.toContainText(
        'vue en dernier',
      );
      await axe(page);
      expect(problems).toEqual([]);
    } finally {
      // L'instance créée ne reste pas active ; ses machines restent (aucune route de retrait).
      try {
        await page.goto('/plateforme/integrations');
        const desactiver = page
          .getByRole('region', { name: nom, exact: true })
          .getByRole('button', { name: 'Désactiver', exact: true });
        if (await desactiver.isVisible({ timeout: 3000 }).catch(() => false)) await desactiver.click();
      } catch {
        // Le ménage ne masque pas l'échec d'origine.
      }
      await ctx.close();
    }
  });
