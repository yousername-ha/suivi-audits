/* Module Vulnérabilités (ADR 0100, lot N1) : import d'un scan Nessus de bout en bout, sans capture de référence (aucune n'est
   approuvée sans relecture). Carte « Intégrations » de la page Plateforme : instance « Nessus, import de fichier » créée (ni
   adresse ni clé), activée sans flux, scan fictif importé par le champ de fichier (lu dans le navigateur, envoyé par lots),
   progression puis bilan, import inscrit dans « Exécutions » ; écrans du module : machines et failles marquées de leur
   source ; second fichier où une faille a disparu sur une machine scannée et où une machine est absente (inchangée) ;
   accessibilité en clair (1 366 px) et en sombre (390 px). Fichiers .nessus fictifs écrits à la main (tests/fixtures/nessus).
   Lot N2 : le contrôle 919101 des deux fichiers porte `exploited_by_malware` : il est marqué « Exploitée par un logiciel
   malveillant (selon Tenable) », en P1, et sort du filtre « Exploitation avérée » ; il ouvre donc une alerte critique,
   dont la fenêtre (toutes les pages) est écartée pour la session par « Plus tard » quand elle paraît. Le refus d'un import
   au-delà de la limite horaire (429) est simulé par une réponse interceptée, sans import de plus (la limite de trente
   imports par heure s'applique aussi en CI). Enfin la spec supprime l'instance par « Supprimer ce connecteur et tout ce
   qu'il a importé » (nombres annoncés, mot SUPPRIMER), et la supprime dans `finally` si le parcours a échoué avant : elle
   nettoie derrière elle. Elle garde son préfixe (passe en DERNIER) : la suppression clôt l'alerte critique ouverte par
   l'import, mais l'alerte close et les notifications envoyées aux comptes restent (historique), et les parcours
   précédents vérifient des listes d'alertes vides sur une pile vierge. Ses assertions ne visent que l'instance qu'il crée
   (nom unique), ce qui le rend rejouable. Lot GRP-MACHINES : l'écran « Machines » s'ouvre désormais sur le « Parc » ; ce
   parcours, qui lit les lignes de la liste, mémorise « Liste » pour le compte au départ et rend ses préférences à la fin. */
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { attendreFenetresStables, csrfOf, ouvrirFiltres, sessionAdmin, watchPage } from '../helpers';

const FIXTURES = path.resolve(import.meta.dirname, '../../fixtures/nessus');
const SCAN1 = path.join(FIXTURES, 'scan-fictif-1.nessus');
const SCAN2 = path.join(FIXTURES, 'scan-fictif-2.nessus');

const LIBELLE_SUPPRESSION = 'Supprimer ce connecteur et tout ce qu’il a importé';
// Ligne allégée de « Failles détectées » (choix du RSSI du 22/11/2026) : un seul fait « Exploitation avérée » dans la liste,
// la source (terme officiel de Tenable, « Exploited by malware ») dans la fiche.
const AVEREE = 'Exploitation avérée';
const MALWARE_FICHE = 'Exploitée par un logiciel malveillant selon Tenable';
const LIMITE = 'Trop d’imports de fichiers commencés (30 par heure). Réessayez dans une heure.';

/** Fenêtre d'alerte critique (lot N2 : ouverte par le contrôle exploité par un logiciel malveillant) : écartée pour la
    session, sans décision (« Plus tard » pour le rôle RSSI, « Fermer pour cette session » sinon). */
async function ecarterAlerte(page: Page) {
  const fenetre = page.getByRole('alertdialog');
  if (!(await fenetre.isVisible().catch(() => false))) return;
  // Appelée hors du gestionnaire (axe), ce clic peut lui-même déclencher le gestionnaire, qui écarte la fenêtre avant lui :
  // le clic est alors sans objet (délai court, erreur ignorée) ; seule compte la fenêtre écartée.
  await fenetre
    .getByRole('button', { name: /^(Plus tard|Fermer pour cette session)$/ })
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await expect(fenetre).toBeHidden();
}

async function axe(page: Page) {
  // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
  await page.waitForTimeout(400);
  await ecarterAlerte(page);
  await attendreFenetresStables(page); // fenêtre ouverte juste avant : fin de son fondu
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

/** Supprime l'instance par la carte (lot N2) : nombres annoncés (contrôlés s'ils sont donnés), mot à saisir, tuile
    disparue. */
async function supprimer(page: Page, nom: string, machines?: number) {
  await page.goto('/plateforme/integrations');
  const tuile = page.getByRole('region', { name: nom, exact: true });
  await tuile.getByRole('button', { name: `${LIBELLE_SUPPRESSION} : ${nom}`, exact: true }).click();
  const fenetre = page.getByRole('dialog', { name: `Supprimer : ${nom}`, exact: true });
  await expect(fenetre).toBeVisible();
  await expect(fenetre).toContainText('Action irréversible');
  if (machines !== undefined) await expect(fenetre).toContainText(`${machines} machines`);
  const bouton = fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true });
  await expect(bouton).toBeDisabled();
  await fenetre.getByRole('textbox', { name: 'Saisissez SUPPRIMER pour confirmer', exact: true }).fill('SUPPRIMER');
  await bouton.click();
  await expect(fenetre).toBeHidden();
  await expect(tuile).toHaveCount(0);
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
    // La fenêtre d'alerte critique peut paraître à tout moment après le premier import : écartée avant chaque geste.
    await page.addLocatorHandler(page.getByRole('alertdialog'), () => ecarterAlerte(page));
    const nom = `Nessus fictif ${mode} ${Date.now().toString(36)}`;
    const source = `Source : ${nom} (Nessus, import de fichier)`;
    let supprimee = false;
    // Lot GRP-MACHINES : présentation « Liste » mémorisée le temps du parcours (préférences d'origine rendues à la fin).
    const preferences = await (await page.request.get('/api/account/preferences')).json();
    try {
      expect(
        (
          await page.request.put('/api/account/preferences', {
            data: {
              ...preferences,
              vulnerabilitesMachines: { ...(preferences.vulnerabilitesMachines ?? {}), vue: 'liste' },
            },
            headers: { 'x-csrf-token': await csrfOf(page.request) },
          })
        ).status(),
      ).toBe(200);
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
      const web = lignes.filter({ hasText: 'Fictional Web Server < 9.9 Remote Flaw' });
      await expect(web).toContainText('2');
      // Lot N2 : exploitation avérée selon Tenable, marque et priorité ; seule cette faille sort du filtre. Ligne allégée
      // (choix du RSSI du 22/11/2026) : la liste dit « Exploitation avérée », la fiche en donne la source (Tenable).
      await expect(web).toContainText(AVEREE);
      await expect(web).toContainText('P1');
      await expect(lignes.filter({ hasText: 'Fictional SSH Daemon Weak Setting' })).not.toContainText(AVEREE);
      await web.getByRole('button', { name: 'Fictional Web Server < 9.9 Remote Flaw', exact: true }).click();
      const ficheWeb = page.getByRole('dialog', { name: 'Fictional Web Server < 9.9 Remote Flaw', exact: true });
      await expect(ficheWeb).toContainText(MALWARE_FICHE);
      await ficheWeb.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await expect(ficheWeb).toBeHidden();
      await ouvrirFiltres(page, 'Exploitation avérée');
      await page.getByRole('checkbox', { name: 'Exploitation avérée', exact: true }).check();
      await expect(page.getByRole('row').filter({ hasText: source })).toHaveCount(1);
      await expect(page.getByRole('row').filter({ hasText: source })).toContainText(AVEREE);
      await axe(page);
      await ouvrirFiltres(page, 'Exploitation avérée');
      await page.getByRole('checkbox', { name: 'Exploitation avérée', exact: true }).uncheck();
      await expect(page.getByRole('row').filter({ hasText: source })).toHaveCount(3);
      await page.goto('/vulnerabilites/machines');
      await expect(page.getByRole('heading', { name: 'Machines', level: 1 })).toBeVisible();
      const machines = page.getByRole('row').filter({ hasText: source });
      await expect(machines).toHaveCount(3);
      await expect(machines.filter({ hasText: 'srv-fictif-01.example.org' })).toBeVisible();
      await expect(machines.filter({ hasText: '203.0.113.23' })).toBeVisible();
      await axe(page);
      // Lot TEN-SCORES : criticité (ACR) et exposition (AES), colonnes et filtres, seulement si une intégration Tenable
      // Security Center existe (état des synchronisations) ; une machine importée n'en porte pas (« — », non fournie).
      const tenable =
        ((await (await page.request.get('/api/vulnerabilites/synchronisation')).json()) as unknown[]).length > 0;
      const scores = /^(Criticité \(ACR, Tenable\)|Exposition \(AES, Tenable\))$/;
      // En-têtes lus par leur texte : la version de Playwright de la CI (1.56) range ces <th> parmi les cellules (« cell »),
      // pas parmi les en-têtes de colonne ; un sélecteur par rôle n'en trouverait aucun.
      const colonnesScores = page.locator('thead th').filter({ hasText: scores });
      const filtresScores = page.getByRole('combobox', { name: scores });
      if (tenable) {
        await expect(colonnesScores).toHaveCount(2);
        // Les filtres sont repliés dans le panneau de la boîte d'outils (refonte du 22/11/2026).
        await ouvrirFiltres(page, 'Criticité (ACR, Tenable)');
        await expect(filtresScores).toHaveCount(2);
        for (const ligne of await machines.all()) await expect(ligne).toContainText('Non fournie par Tenable');
        // Filtre actif : aucune machine sans valeur n'y répond.
        await page.getByRole('combobox', { name: 'Criticité (ACR, Tenable)', exact: true }).click();
        await page.getByRole('option', { name: 'Moyenne ou plus', exact: true }).click();
        await expect(page.getByRole('row').filter({ hasText: source })).toHaveCount(0);
        await axe(page);
        await page.goto('/vulnerabilites/machines');
        await expect(page.getByRole('row').filter({ hasText: source })).toHaveCount(3);
      } else {
        await expect(colonnesScores).toHaveCount(0);
        await expect(filtresScores).toHaveCount(0);
      }

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

      // Lot N2 : refus au-delà de la limite horaire, simulé (aucun import de plus) ; la fenêtre reste ouverte et le dit.
      await page.goto('/plateforme/integrations');
      // Début d'un import seulement (POST …/imports), désigné par son chemin.
      const debutImport = (u: URL) =>
        u.pathname.startsWith('/api/integrations/instances/') && u.pathname.endsWith('/imports');
      await page.route(debutImport, (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: LIMITE }) })
          : route.fallback(),
      );
      await tuile.getByRole('button', { name: `Importer un scan dans ${nom}`, exact: true }).click();
      const fenetre3 = page.getByRole('dialog', { name: `Importer un scan : ${nom}`, exact: true });
      await fenetre3.locator('input[type="file"]').setInputFiles(SCAN2);
      await expect(fenetre3.getByRole('status').filter({ hasText: 'à importer' })).toBeVisible();
      const importerBouton = fenetre3.getByRole('button', { name: 'Importer', exact: true });
      await importerBouton.click();
      const refus = fenetre3.getByRole('alert').filter({ hasText: 'Import refusé' });
      await expect(refus).toContainText(LIMITE);
      await expect(refus).toContainText('Aucune machine n’a été importée.');
      await expect(fenetre3).toBeVisible();
      await expect(importerBouton).toHaveAccessibleDescription(
        /^Trop d’imports de fichiers commencés \(30 par heure\)\. Réessayez dans une heure\..*Aucune machine n’a été importée\./,
      );
      await axe(page);
      await page.unrouteAll({ behavior: 'wait' });
      await fenetre3.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await expect(fenetre3).toBeHidden();

      // Lot N2 : suppression de l'instance et de tout ce qu'elle a importé ; ses machines quittent le module.
      await supprimer(page, nom, 3);
      supprimee = true;
      await page.goto('/vulnerabilites/machines');
      await expect(page.getByRole('heading', { name: 'Machines', level: 1 })).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: source })).toHaveCount(0);
      expect(problems).toEqual([]);
    } finally {
      // Nettoyage : l'instance créée et tout ce qu'elle a importé sont supprimés si le parcours s'est arrêté avant.
      if (!supprimee)
        try {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          await supprimer(page, nom);
        } catch {
          // Le ménage ne masque pas l'échec d'origine.
        }
      await page.request.put('/api/account/preferences', {
        data: preferences,
        headers: { 'x-csrf-token': await csrfOf(page.request) },
      });
      await ctx.close();
    }
  });
