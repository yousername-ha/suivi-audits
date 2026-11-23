/* Module Vulnérabilités (ADR 0100, lot SI1) : import du rapport Silène (ANSSI) de bout en bout, sans capture de référence
   (aucune n'est approuvée sans relecture). Carte « Intégrations » de la page Plateforme : instance « Silène, import de
   fichier » créée (ni adresse, ni clé, ni réglage), activée sans flux, rapport fictif importé par le champ de fichier (lu dans
   le navigateur, envoyé par lots), bilan, import inscrit dans « Exécutions » ; écran « Surface externe » : note Silène avec
   sa pastille, actif de la liste commune avec ses ports ouverts et leur source, fiche Silène de l'actif, onglet « Constats
   Silène » et fiche d'un constat ; second rapport où un hôte et un constat ont disparu (évolution de la note, disparus
   comptés) ; lot SI2 : carte « Lignes d'approche » (nœuds de Silène, constats d'un hôte et fiche d'un constat,
   regroupement par adresse IP, branche repliée puis dépliée, filtre unique « Filtrer la carte » de la barre collante
   (décision du RSSI du 23/11/2026) : partie d'un nom puis port annoncés, texte et regroupement gardés en changeant
   d'onglet, puis effacement ; barre collante à 1 366 px, présentation empilée et aucun débordement à 390 px) ; suppression de
   l'instance par « Supprimer ce connecteur et tout ce qu'il a importé », et dans `finally` si le
   parcours s'est arrêté avant. Accessibilité en clair (1 366 px) et en sombre (390 px). Rapports JSON fictifs écrits à la
   main (tests/fixtures/silene), dont les champs interdits portent des marqueurs « INTERDIT » qui ne doivent jamais paraître.
   Sur une pile vierge, AlgoLightHouse n'a aucune donnée : la fusion d'un actif vu par les deux sources est couverte par les
   tests de l'API et de l'interface. Le préfixe place la spec avant celle de l'import Nessus (qui doit rester la dernière). */
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { attendreFenetresStables, ouvrirFiltres, sessionAdmin, watchPage } from '../helpers';

const FIXTURES = path.resolve(import.meta.dirname, '../../fixtures/silene');
const RAPPORT1 = path.join(FIXTURES, 'rapport-fictif-1.json');
const RAPPORT2 = path.join(FIXTURES, 'rapport-fictif-2.json');
const LIBELLE_SUPPRESSION = 'Supprimer ce connecteur et tout ce qu’il a importé';

async function axe(page: Page) {
  // L'animation d'arrivée de l'en-tête fausse le contraste mesuré : même attente que zzzzz-accessibilite.
  await page.waitForTimeout(400);
  await attendreFenetresStables(page); // fenêtre ouverte juste avant : fin de son fondu
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
}

/** Importe un rapport par la fenêtre « Importer un rapport » de l'instance et attend le bilan. */
async function importer(page: Page, nom: string, fichier: string) {
  const tuile = page.getByRole('region', { name: nom, exact: true });
  await tuile.getByRole('button', { name: `Importer un rapport dans ${nom}`, exact: true }).click();
  const fenetre = page.getByRole('dialog', { name: `Importer un rapport : ${nom}`, exact: true });
  await expect(fenetre).toBeVisible();
  await fenetre.locator('input[type="file"]').setInputFiles(fichier);
  await expect(fenetre.getByRole('status').filter({ hasText: 'à importer' })).toBeVisible();
  await fenetre.getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(fenetre.getByRole('status').filter({ hasText: 'Import terminé' })).toBeVisible();
  return fenetre;
}

/** Supprime l'instance par la carte : nombres annoncés (contrôlés s'ils sont donnés), mot à saisir, tuile disparue. */
async function supprimer(page: Page, nom: string, hotes?: number) {
  await page.goto('/plateforme/integrations');
  const tuile = page.getByRole('region', { name: nom, exact: true });
  await tuile.getByRole('button', { name: `${LIBELLE_SUPPRESSION} : ${nom}`, exact: true }).click();
  const fenetre = page.getByRole('dialog', { name: `Supprimer : ${nom}`, exact: true });
  await expect(fenetre).toBeVisible();
  await expect(fenetre).toContainText('Action irréversible');
  if (hotes !== undefined) await expect(fenetre).toContainText(`${hotes} hôtes`);
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
  test(`Import Silène (lot SI1) : instance sans adresse ni clé, rapport importé, note, actif et constats dans la surface externe (${mode}, ${largeur} px)`, async ({
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
    const nom = `Silène fictif ${mode} ${Date.now().toString(36)}`;
    let supprimee = false;
    try {
      await page.goto('/plateforme/integrations');
      const carte = page.getByRole('dialog', { name: 'Intégrations', exact: true });
      await expect(carte).toBeVisible();
      const type = carte.getByRole('region', { name: 'Silène, import de fichier', exact: true });
      await expect(type).toContainText('import de fichier, sans réseau');
      await type.getByRole('button', { name: 'Ajouter une instance', exact: true }).click();
      const ajout = page.getByRole('dialog', { name: 'Ajouter : Silène, import de fichier', exact: true });
      // Ni adresse, ni délai, ni gravités, ni fréquence, ni clé : le nom seul.
      await expect(ajout.getByRole('textbox', { name: 'Adresse du service', exact: true })).toHaveCount(0);
      await expect(ajout.getByText('Fréquence de la synchronisation automatique')).toHaveCount(0);
      await expect(ajout.getByRole('group', { name: 'Gravités à importer' })).toHaveCount(0);
      await ajout.getByRole('textbox', { name: 'Nom', exact: true }).fill(nom);
      await ajout.getByRole('button', { name: 'Créer l’instance', exact: true }).click();
      const config = page.getByRole('dialog', { name: `Configurer ${nom}`, exact: true });
      await expect(config).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(config).toBeHidden();

      const tuile = page.getByRole('region', { name: nom, exact: true });
      await expect(tuile.getByRole('button', { name: 'Tester la connexion' })).toHaveCount(0);
      await expect(tuile.getByRole('button', { name: `Importer un rapport dans ${nom}`, exact: true })).toBeDisabled();
      await tuile.getByRole('button', { name: 'Activer', exact: true }).click();
      await expect(tuile.getByRole('button', { name: 'Désactiver', exact: true })).toBeVisible();
      await expect(page.getByRole('dialog', { name: /ouvrir son flux/ })).toHaveCount(0);

      // Premier rapport : trois hôtes, quatre constats ; écarts comptés ; aucun champ interdit affiché.
      const fenetre = await importer(page, nom, RAPPORT1);
      await expect(fenetre).toContainText('Import : 3 hôtes sur 3, 4 constats sur 4, en 2 lots.');
      await expect(fenetre).toContainText('constats qu’aucun contrôle ne cite : 1');
      await expect(fenetre).not.toContainText('INTERDIT');
      await axe(page);
      await fenetre.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await expect(fenetre).toBeHidden();
      await tuile.getByRole('button', { name: 'Exécutions', exact: true }).click();
      const executions = page.getByRole('dialog', { name: `Exécutions : ${nom}`, exact: true });
      await expect(executions.getByRole('cell', { name: 'Importer un rapport', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(executions).toBeHidden();

      // Surface externe : note Silène, avec sa pastille, à côté d'AlgoLightHouse.
      await page.goto('/vulnerabilites/surface-externe');
      await expect(page.getByRole('heading', { name: 'Surface externe', level: 1 })).toBeVisible();
      const note = page.getByRole('region', { name: 'Note Silène', exact: true });
      await expect(note.getByText(nom, { exact: true })).toBeVisible();
      await expect(note).toContainText('Note : 14,5');
      await expect(note).toContainText('sous-note réseau : 13');
      await expect(note).toContainText('rapport du 15/11/2026');
      await expect(note).toContainText('Premier rapport importé');
      await expect(page.getByRole('region', { name: 'AlgoLightHouse', exact: true })).toBeVisible();
      await axe(page);

      // Actifs : l'hôte vu par Silène, ses ports ouverts et leur source.
      await page.getByRole('tab', { name: 'Actifs', exact: true }).click();
      await page.getByRole('textbox', { name: 'Rechercher un actif' }).fill('192.0.2.10');
      await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
      const ligne = page.getByRole('row').filter({ hasText: '22/tcp · SSH' });
      await expect(ligne).toHaveCount(1);
      await expect(ligne).toContainText('Silène : FictionalSSH');
      await expect(ligne).toContainText('3 ports ouverts selon Silène');
      await expect(ligne.getByRole('img', { name: 'Source : Silène (ANSSI)', exact: true }).first()).toBeVisible();
      await expect(ligne).toContainText('Vu par Silène seul : aucune liaison.');
      await axe(page);
      await ligne.getByRole('button', { name: '192.0.2.10', exact: true }).click();
      const fiche = page.getByRole('dialog', { name: 'Actif exposé : 192.0.2.10', exact: true });
      await expect(fiche.getByRole('region', { name: 'Vu par Silène', exact: true })).toBeVisible();
      await expect(fiche).toContainText('OpenPort');
      await expect(fiche).toContainText('application fictional httpd 9.9');
      await expect(fiche).not.toContainText('INTERDIT');
      await axe(page);
      await fiche.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await expect(fiche).toBeHidden();

      // Constats Silène : classe affichée telle quelle, fiche par hôte.
      await page.getByRole('tab', { name: 'Constats Silène', exact: true }).click();
      const constat = page.getByRole('row').filter({ hasText: 'RES-FICTIF-0001' });
      await expect(constat).toContainText('classe 2');
      await constat.getByRole('button', { name: 'OpenPort', exact: true }).click();
      const ficheConstat = page.getByRole('dialog', { name: 'Constat Silène : OpenPort', exact: true });
      await expect(ficheConstat).toContainText('198.51.100.20');
      await expect(ficheConstat).toContainText('3389/tcp · ms-wbt-server');
      await axe(page);
      await ficheConstat.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await expect(ficheConstat).toBeHidden();

      // Lot SI2 : carte « Lignes d'approche » à deux sources, page entière. À 1 366 px, le dessin et ses repères
      // collants ; à 390 px, la présentation empilée (mêmes noms accessibles), barre non collante.
      await page.getByRole('tab', { name: 'Carte', exact: true }).click();
      const collant = page.locator('.sc-collant');
      expect(await collant.evaluate((e) => getComputedStyle(e).position)).toBe(largeur > 800 ? 'sticky' : 'static');
      // Aucun débordement horizontal de la page.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const www = page.getByRole('button', {
        name: 'Nom de domaine www.example.org, résout vers 192.0.2.10, vu par Silène (ANSSI) : ouvrir sa fiche',
        exact: true,
      });
      await expect(www).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: 'IP publique 192.0.2.10, vu par Silène (ANSSI), 3 services connus : ouvrir sa fiche',
          exact: true,
        }),
      ).toBeVisible();
      await axe(page);
      // Constats Silène de l'hôte : liste, puis fiche d'un constat ; sans priorité.
      await page
        .getByRole('button', { name: '2 constats Silène sur 192.0.2.10, sans priorité : les voir', exact: true })
        .click();
      const constatsHote = page.getByRole('dialog', { name: 'Constats Silène de 192.0.2.10', exact: true });
      await expect(constatsHote).toContainText('ExpiredCertificate');
      await expect(constatsHote).toContainText('Sans priorité');
      await constatsHote.getByRole('button', { name: 'OpenPort', exact: true }).click();
      await expect(constatsHote).toContainText('22/tcp');
      await expect(constatsHote).not.toContainText('INTERDIT');
      await axe(page);
      await constatsHote.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await expect(constatsHote).toBeHidden();
      // Regroupement par adresse IP : tout replier, puis déplier la branche 192.0.2.10 jusqu'à ses noms.
      await ouvrirFiltres(page, 'Regrouper par');
      const regrouper = page.getByRole('combobox', { name: 'Regrouper par', exact: true });
      await regrouper.click();
      await page.getByRole('option', { name: 'Adresse IP publique', exact: true }).click();
      await expect(regrouper).toHaveValue('Adresse IP publique');
      await page.getByRole('button', { name: 'Tout replier', exact: true }).click();
      await expect(www).toHaveCount(0);
      await page.getByRole('button', { name: /^Déplier la branche 192\.0\.2\.10 : / }).click();
      await expect(www).toBeVisible();
      await expect(page.getByRole('button', { name: /^Replier la branche 192\.0\.2\.10 : / })).toBeVisible();
      await axe(page);
      // Un seul champ de filtre, dans la barre collante (décision du RSSI du 23/11/2026) : plus de champ « Nom de domaine
      // ou adresse IP » ni de seconde barre au-dessus de la carte.
      const filtreCarte = collant.getByRole('textbox', { name: 'Filtrer la carte', exact: true });
      await expect(filtreCarte).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Filtrer la carte', exact: true })).toHaveCount(1);
      await expect(page.getByRole('textbox', { name: 'Nom de domaine ou adresse IP' })).toHaveCount(0);
      // Partie d'un nom de domaine (casse ignorée) : résultat annoncé, autres noms retirés.
      const rdp = page.getByRole('button', {
        name: 'Nom de domaine rdp.example.org, résout vers 198.51.100.20, vu par Silène (ANSSI) : ouvrir sa fiche',
        exact: true,
      });
      await filtreCarte.fill('RDP');
      await expect(page.getByRole('status').filter({ hasText: 'correspondent à « RDP »' })).toHaveText(
        '1 nom de domaine et 1 adresse IP correspondent à « RDP ».',
      );
      await expect(www).toHaveCount(0);
      await expect(rdp).toBeVisible();
      await axe(page);
      // Port et protocole : la ligne de 192.0.2.10 reste entière, avec ses noms ; celle de 198.51.100.20 (3389) sort.
      await filtreCarte.fill('22/tcp');
      await expect(page.getByRole('status').filter({ hasText: 'correspondent à « 22/tcp »' })).toHaveText(
        / et 1 adresse IP correspondent à « 22\/tcp »\.$/,
      );
      await expect(www).toBeVisible();
      await expect(rdp).toHaveCount(0);
      // La vue (texte du filtre et regroupement) est gardée pendant la navigation dans la page.
      await page.getByRole('tab', { name: 'Actifs', exact: true }).click();
      await page.getByRole('tab', { name: 'Carte', exact: true }).click();
      await expect(filtreCarte).toHaveValue('22/tcp');
      await expect(www).toBeVisible();
      await ouvrirFiltres(page, 'Regrouper par');
      await expect(page.getByRole('combobox', { name: 'Regrouper par', exact: true })).toHaveValue(
        'Adresse IP publique',
      );
      // Effacement : le champ se vide, l'annonce disparaît, la ligne écartée revient.
      await page.getByRole('button', { name: 'Effacer le filtre', exact: true }).click();
      await expect(filtreCarte).toHaveValue('');
      await expect(page.getByRole('status').filter({ hasText: 'correspondent à' })).toHaveCount(0);
      await expect(rdp).toBeVisible();

      // Second rapport : 198.51.100.20 et RES-FICTIF-0003 ont disparu ; la note progresse.
      await page.goto('/plateforme/integrations');
      const fenetre2 = await importer(page, nom, RAPPORT2);
      await expect(fenetre2).toContainText('Plus présents depuis le rapport précédent : 1 hôte, 1 constat.');
      await fenetre2.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
      await page.goto('/vulnerabilites/surface-externe?onglet=constats-silene');
      await expect(page.getByRole('region', { name: 'Note Silène', exact: true })).toContainText(
        '+1,75 depuis le rapport du 15/11/2026',
      );
      await expect(page.getByRole('row').filter({ hasText: 'RES-FICTIF-0001' })).toHaveCount(1);
      await expect(page.getByRole('row').filter({ hasText: 'RES-FICTIF-0003' })).toHaveCount(0);

      // Suppression de l'instance et de tout ce qu'elle a importé.
      await supprimer(page, nom, 3);
      supprimee = true;
      await page.goto('/vulnerabilites/surface-externe');
      await expect(page.getByRole('region', { name: 'Note Silène', exact: true }).getByText(nom)).toHaveCount(0);
      expect(problems).toEqual([]);
    } finally {
      if (!supprimee)
        try {
          await supprimer(page, nom);
        } catch {
          // Le ménage ne masque pas l'échec d'origine.
        }
      await ctx.close();
    }
  });
