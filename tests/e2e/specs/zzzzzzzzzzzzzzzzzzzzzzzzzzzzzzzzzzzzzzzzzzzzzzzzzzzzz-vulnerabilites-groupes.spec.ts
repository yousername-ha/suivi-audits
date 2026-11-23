/* Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026, maquettes validées le même jour) :
   groupes de machines de bout en bout, sans capture de référence (aucune n'est approuvée sans relecture). Bouton « Groupes
   de machines… » de l'écran « Machines », création d'un groupe (nom unique), fenêtre du groupe : la liste des machines lues
   est remplacée par un jeu fictif (`page.route`, typé par le DTO partagé) pour cocher des machines, lire « aussi dans « X » »
   et « Tout cocher (n trouvées) » ; l'enregistrement des cases est simulé lui aussi (la pile n'a aucune machine à ce stade
   de la suite). Filtre « Groupe » (le groupe, avec son nombre de machines lues, puis « Sans groupe ») sur la route réelle du
   parc ; suppression du groupe avec confirmation. Accessibilité de l'écran et de la fenêtre, CSP. Le parcours nettoie
   derrière lui (groupe supprimé dans `finally` s'il a échoué avant) ; son nom unique le rend rejouable. Droits, non-fuite,
   cloisonnement et nombre de requêtes : apps/api/test/vulnerabilites-groupes.test.ts. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type {
  BilanMembresGroupe,
  GroupeMachines,
  MachineGroupe,
  PageMachinesGroupe,
} from '../../../packages/shared/src/groupes-machines';
import { attendreFenetresStables, csrfOf, ouvrirFiltres, sessionAdmin, watchPage } from '../helpers';

const MACHINES = [
  {
    id: '00000000-0000-4000-8000-0000000094a1',
    nom: 'srv-fictif-groupe-01.interne.invalid',
    adresse: '192.0.2.91',
    systeme: 'Exemple Linux 9',
    role: 'front',
    perimetreNom: 'Périmètre fictif',
    membre: false,
    autresGroupes: [{ id: '00000000-0000-4000-8000-0000000094b1', nom: 'Autre groupe fictif' }],
  },
  {
    id: '00000000-0000-4000-8000-0000000094a2',
    nom: 'srv-fictif-groupe-02.interne.invalid',
    adresse: '192.0.2.92',
    systeme: null,
    role: null,
    perimetreNom: null,
    membre: false,
    autresGroupes: [],
  },
] satisfies MachineGroupe[];

async function axe(page: Page) {
  // Après l'ouverture d'une fenêtre ou un changement d'écran : même attente que zzzzz-accessibilite.
  await page.waitForTimeout(400);
  await attendreFenetresStables(page);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
}

test('Vulnérabilités : groupes de machines, création, cases à cocher, filtre « Groupe », suppression', async ({
  browser,
}) => {
  const session = await sessionAdmin(browser);
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    storageState: session.state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const nom = `Groupe fictif e2e ${Date.now().toString(36)}`;
  let cree: string | null = null;
  try {
    await page.goto('/vulnerabilites/machines');
    await expect(page.getByRole('heading', { name: 'Machines', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Groupes de machines…', exact: true }).click();
    const liste = page.getByRole('dialog', { name: 'Groupes de machines', exact: true });
    await expect(liste).toBeVisible();
    await axe(page);

    // Création : nom, description ; la fenêtre du groupe s'ouvre ensuite.
    await liste.getByRole('button', { name: 'Nouveau groupe', exact: true }).click();
    const nouveau = page.getByRole('dialog', { name: 'Nouveau groupe de machines', exact: true });
    await nouveau.getByRole('textbox', { name: 'Nom du groupe' }).fill(nom);
    await nouveau.getByRole('textbox', { name: 'Description' }).fill('Serveurs d’une application fictive.');
    await axe(page);

    // Machines lues de la fenêtre et enregistrement des cases : jeu fictif (la pile n'a aucune machine ici).
    let envoye: { ajouter: string[]; retirer: string[] } | null = null;
    await page.route(/\/api\/vulnerabilites\/groupes\/[^/]+\/machines/, async (route) => {
      if (route.request().method() === 'GET') {
        const vraie = (await (await route.fetch()).json()) as PageMachinesGroupe;
        return route.fulfill({
          json: {
            ...vraie,
            total: MACHINES.length,
            elements: MACHINES,
            identifiants: MACHINES.map((m) => m.id),
            identifiantsTronques: false,
          } satisfies PageMachinesGroupe,
        });
      }
      envoye = route.request().postDataJSON() as { ajouter: string[]; retirer: string[] };
      const groupe = (await (await page.request.get(`/api/vulnerabilites/groupes/${cree}`)).json()) as GroupeMachines;
      return route.fulfill({
        json: { ajoutees: MACHINES.length, retirees: 0, groupe } satisfies BilanMembresGroupe,
      });
    });
    await nouveau.getByRole('button', { name: 'Créer le groupe', exact: true }).click();
    const fenetre = page.getByRole('dialog', { name: 'Groupe de machines', exact: true });
    await expect(fenetre.getByRole('textbox', { name: 'Nom du groupe' })).toHaveValue(nom);
    cree =
      (
        ((await (await page.request.get('/api/vulnerabilites/groupes')).json()) as GroupeMachines[]).find(
          (g) => g.nom === nom,
        ) ?? null
      )?.id ?? null;
    expect(cree).not.toBeNull();
    await expect(fenetre.getByRole('status').filter({ hasText: '2 machines trouvées' })).toBeVisible();
    await expect(fenetre.getByText('aussi dans « Autre groupe fictif »', { exact: true })).toBeVisible();
    const premiere = fenetre.getByRole('checkbox', { name: `${MACHINES[0]!.nom} dans le groupe`, exact: true });
    const seconde = fenetre.getByRole('checkbox', { name: `${MACHINES[1]!.nom} dans le groupe`, exact: true });
    await expect(premiere).not.toBeChecked();
    await premiere.check();
    await expect(premiere).toBeChecked();
    await premiere.uncheck();
    await fenetre.getByRole('button', { name: 'Tout cocher (2 trouvées)', exact: true }).click();
    await expect(premiere).toBeChecked();
    await expect(seconde).toBeChecked();
    await expect(fenetre.getByText('Cases modifiées, non enregistrées', { exact: true })).toBeVisible();
    await axe(page);
    await fenetre.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText('Groupe enregistré : 2 ajoutées, 0 retirée.')).toBeVisible();
    expect(envoye).toEqual({ ajouter: MACHINES.map((m) => m.id).sort(), retirer: [] });
    await page.unrouteAll({ behavior: 'wait' });
    await fenetre.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
    await expect(fenetre).toBeHidden();

    // Filtre « Groupe » (route réelle) : le groupe avec son nombre de machines lues, puis « Sans groupe ».
    await ouvrirFiltres(page, 'Groupe');
    const menu = page.getByRole('combobox', { name: 'Groupe', exact: true });
    await menu.click();
    await page.getByRole('option', { name: `${nom} (0)`, exact: true }).click();
    await expect(page.getByRole('note').filter({ hasText: `Groupe « ${nom} » : 0 machine` })).toBeVisible();
    await axe(page);
    const sansGroupe = page.waitForResponse((r) =>
      /\/api\/vulnerabilites\/machines(\/parc)?\?groupe=aucun/.test(r.url()),
    );
    // Le panneau des filtres a pu se refermer après le choix : rouvert au besoin.
    await ouvrirFiltres(page, 'Groupe');
    await menu.click();
    await page.getByRole('option', { name: 'Sans groupe', exact: true }).click();
    expect((await sansGroupe).status()).toBe(200);
    await expect(page.getByRole('note').filter({ hasText: nom })).toHaveCount(0);

    // Suppression avec confirmation : les machines restent, le groupe disparaît de la liste et du menu.
    await page.getByRole('button', { name: 'Groupes de machines…', exact: true }).click();
    await liste.getByRole('button', { name: `Modifier ${nom}`, exact: true }).click();
    await fenetre.getByRole('button', { name: 'Supprimer le groupe', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Confirmation', exact: true });
    await expect(confirmation).toContainText('Les machines restent');
    await confirmation.getByRole('button', { name: 'Confirmer', exact: true }).click();
    await expect(liste).toBeVisible();
    await expect(liste.getByRole('button', { name: `Modifier ${nom}`, exact: true })).toHaveCount(0);
    cree = null;
    await liste.getByRole('button', { name: 'Fermer la fenêtre', exact: true }).click();
    expect(problems).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    // Ménage si le parcours s'est arrêté avant la suppression : le ménage ne masque pas l'échec d'origine.
    if (cree)
      try {
        const g = (await (await page.request.get(`/api/vulnerabilites/groupes/${cree}`)).json()) as GroupeMachines;
        await page.request.delete(`/api/vulnerabilites/groupes/${cree}`, {
          headers: { 'x-csrf-token': await csrfOf(page.request), 'if-match': `"${g.version}"` },
        });
      } catch {
        // rien
      }
    await ctx.close();
  }
});
