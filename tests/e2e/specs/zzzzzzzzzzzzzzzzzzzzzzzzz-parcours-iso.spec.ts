/* Parcours guidé ISO 27001 / HDS (dossier 024) : arbre et liste sur les mêmes étapes, sous-actions dépliables, carte compacte,
   fiche détaillée, travaux déjà présents retrouvés dans le périmètre et ouverts dans leur module, compléments HDS masquables,
   animations réglables, accessibilité. Données fictives. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
const action = (name: string) => ({
  kind: 'action',
  name,
  data: {
    description: 'Action de recette',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: null,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
});
async function ouvrir(browser: Browser, options: Record<string, unknown> = {}) {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    ...options,
  });
  const page = await ctx.newPage();
  return { ctx, page, problems: watchPage(page) };
}
const vue = (page: Page, nom: 'Arbre' | 'Liste') =>
  page.locator('.mantine-SegmentedControl-label', { hasText: new RegExp(`^${nom}$`) }).click();
// Les réglages sont enregistrés pour la personne : un passage interrompu ne doit pas fausser le suivant.
async function etatInitial(page: Page) {
  await expect(page.getByRole('heading', { name: 'Parcours ISO 27001 / HDS', level: 1 })).toBeVisible();
  const hds = page.getByLabel('Afficher les compléments HDS');
  if (!(await hds.isChecked())) {
    await hds.click({ force: true });
    await expect(hds).toBeChecked();
  }
  if (!(await page.getByRole('radio', { name: 'Arbre' }).isChecked())) await vue(page, 'Arbre');
}
const noeud = (page: Page, id: string) => page.locator(`g.parcours-noeud[data-raccourci="${id}"]`);

test('Parcours ISO / HDS : arbre, carte, sous-actions, fiche, liste, HDS et animations', async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx, page, problems } = await ouvrir(browser);
  try {
    await page.goto('/pilotage/parcours-iso');
    await etatInitial(page);
    // Réglages mémorisés d'un passage précédent : on repart de l'état par défaut.
    await expect(page.getByRole('heading', { name: 'Parcours ISO 27001 / HDS', level: 1 })).toBeVisible();
    const arbre = page.getByRole('region', { name: /Arbre du parcours/ });
    await expect(arbre).toBeVisible();
    // 11 raccourcis graphiques ; les 5 étapes sans raccourci restent atteignables.
    await expect(page.locator('g.parcours-noeud')).toHaveCount(11);
    await expect(page.getByRole('navigation', { name: 'Autres étapes du parcours' }).getByRole('button')).toHaveCount(
      7,
    );

    // Cercle : carte compacte. Le bouton « + » est distinct et déplie les sous-actions (une seule branche à la fois).
    await noeud(page, 'risques')
      .getByRole('button', { name: /^Risques/ })
      .click();
    const carte = page.getByRole('region', { name: 'Étape sélectionnée' });
    await expect(carte).toBeVisible();
    await expect(carte.getByText('Poser les critères')).toBeVisible();
    const bascule = noeud(page, 'risques').getByRole('button', { name: /les sous-actions : Risques/ });
    await bascule.click();
    await expect(bascule).toHaveAttribute('aria-expanded', 'true');
    const enfants = page.getByRole('group', { name: 'Sous-actions : Risques' });
    await expect(enfants.getByRole('button')).toHaveCount(2);
    await noeud(page, 'gouvernance')
      .getByRole('button', { name: /Déplier/ })
      .click();
    await expect(page.getByRole('group', { name: 'Sous-actions : Risques' })).toHaveCount(0);
    await expect(bascule).toHaveAttribute('aria-expanded', 'false');
    await bascule.click();

    // Aucun libellé ni cercle ne se recouvre : mesure des rectangles réels des sous-actions ouvertes.
    const rects = await page.evaluate(() => {
      const r = (e: Element) => e.getBoundingClientRect();
      const enfants = [
        ...document.querySelectorAll(
          '.parcours-enfant__bouton .parcours-orbe, .parcours-enfant__bouton .parcours-libelle',
        ),
      ].map(r);
      const fixes = [
        ...document.querySelectorAll('.parcours-noeud__bouton, .parcours-racine, .parcours-titre-branche'),
      ].map(r);
      let collisions = 0;
      const detail: string[] = [];
      const noms = [
        ...document.querySelectorAll(
          '.parcours-enfant__bouton .parcours-orbe, .parcours-enfant__bouton .parcours-libelle',
        ),
      ].map((e) => e.closest('[aria-label]')?.getAttribute('aria-label'));
      const fixesNoms = [
        ...document.querySelectorAll('.parcours-noeud__bouton, .parcours-racine, .parcours-titre-branche'),
      ].map((e) => e.getAttribute('aria-label') ?? e.textContent);
      enfants.forEach((a, i) =>
        fixes.forEach((b, j) => {
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
            collisions++;
            detail.push(`${noms[i]} x ${fixesNoms[j]}`);
          }
        }),
      );
      for (let i = 0; i < enfants.length; i++)
        for (let j = i + 1; j < enfants.length; j++) {
          const a = enfants[i]!,
            b = enfants[j]!;
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) collisions++;
        }
      return { enfants: enfants.length, collisions, detail };
    });
    expect(rects.enfants).toBe(4);
    expect(rects.detail).toEqual([]);

    // Clic sur une sous-action : fiche détaillée avec l'attendu ; Échap la ferme et rend le focus.
    await enfants.getByRole('button', { name: /Relier les évaluations/ }).click();
    const fiche = page.getByRole('dialog', { name: 'Apprécier les risques' });
    await expect(fiche).toBeVisible();
    await expect(fiche.getByText('L’attendu', { exact: true })).toBeVisible();
    await expect(fiche.getByText('Format proposé, non imposé par la norme.', { exact: false })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fiche).toHaveCount(0);
    await expect(enfants.getByRole('button', { name: /Relier les évaluations/ })).toBeFocused();

    // La carte se ferme par sa croix, par un clic sur le fond et par Échap.
    await carte.getByRole('button', { name: 'Fermer la carte' }).click();
    await expect(carte).toHaveCount(0);
    await noeud(page, 'audits')
      .getByRole('button', { name: /^Audits/ })
      .click();
    await expect(carte).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(carte).toHaveCount(0);
    await noeud(page, 'revue')
      .getByRole('button', { name: /^Revue/ })
      .click();
    await expect(carte).toBeVisible();
    await page.locator('rect.parcours-fond').click({ position: { x: 20, y: 700 } });
    await expect(carte).toHaveCount(0);

    // Les étapes sans raccourci s'ouvrent depuis la bande « Autres étapes ».
    await page
      .getByRole('navigation', { name: 'Autres étapes du parcours' })
      .getByRole('button', { name: 'Mesurer les résultats' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Mesurer les résultats' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Liste : mêmes étapes (16) et sous-actions (26), recherche, dépliage au clavier.
    await vue(page, 'Liste');
    await expect(page.locator('[data-etape]')).toHaveCount(16);
    await expect(page.locator('button[data-sousaction]')).toHaveCount(26);
    await page.getByLabel('Rechercher une étape ou une sous-action').fill('audit');
    await expect(page.locator('[data-etape]')).not.toHaveCount(16);
    await page.getByLabel('Rechercher une étape ou une sous-action').fill('');
    const premiere = page.locator('button[data-sousaction="context-1"]');
    await premiere.focus();
    await page.keyboard.press('Enter');
    await expect(premiere).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Un périmètre documenté et relié à l’organisation', { exact: false })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(premiere).toHaveAttribute('aria-expanded', 'false');

    // HDS : masquer ne change que l'affichage, et le réglage est mémorisé pour la personne.
    await page.getByLabel('Afficher les compléments HDS').click({ force: true });
    await expect(page.getByLabel('Afficher les compléments HDS')).not.toBeChecked();
    await expect(page.locator('[data-etape]')).toHaveCount(11);
    await page.reload();
    await expect(page.locator('[data-etape]')).toHaveCount(11);
    await page.getByLabel('Afficher les compléments HDS').click({ force: true });
    await expect(page.getByLabel('Afficher les compléments HDS')).toBeChecked();
    await expect(page.locator('[data-etape]')).toHaveCount(16);
    await vue(page, 'Arbre');
    await expect(page.locator('g.parcours-noeud')).toHaveCount(11);

    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Parcours ISO / HDS : travaux présents retrouvés par périmètre, ouverts dans leur module, jamais une conformité', async ({
  browser,
}) => {
  const { ctx, page, problems } = await ouvrir(browser);
  const suffixe = Date.now().toString(36);
  const avecTravail = `Périmètre parcours A ${suffixe}`,
    vide = `Périmètre parcours B ${suffixe}`,
    titre = `Action du parcours ${suffixe}`;
  try {
    await page.goto('/pilotage/parcours-iso');
    await etatInitial(page);
    const creer = (name: string) =>
      post(page, '/api/grc/smsis', {
        name,
        nature: 'SMSI',
        scope: 'Fixture de recette',
        timezone: 'Europe/Paris',
        parentId: null,
        entityKind: 'perimetre',
        inheritFrameworks: false,
      });
    const a = await creer(avecTravail);
    await creer(vide);
    const objet = await post(page, `/api/grc/${a.id}/objects`, action(titre));
    await page.reload();
    const choisir = async (nom: string) => {
      await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
      await page.getByRole('option', { name: nom, exact: true }).click();
    };
    await choisir(avecTravail);
    await page.locator('g.parcours-noeud[data-raccourci="revue"]').waitFor();
    // « Actions correctives » : l'action du périmètre est retrouvée (jamais ajoutée au parcours), la fiche s'ouvre dans son module.
    await vue(page, 'Liste');
    await page.locator('button[data-sousaction="objectives-2"]').click();
    const panneau = page.locator('#liste-objectives-2');
    await expect(panneau.getByText('Action : 1 élément')).toBeVisible();
    await expect(page.locator('[data-etape="objectives"]').getByText('Travaux présents').first()).toBeVisible();
    // Ni revue ni conformité : aucun libellé de ce genre n'est calculé à partir de la présence.
    await expect(page.locator('[data-etape="objectives"]')).not.toContainText(/conforme|revu\b/i);
    await panneau.getByRole('link', { name: titre }).click();
    await expect(page).toHaveURL(new RegExp(`/pilotage/actions\\?.*perimetre=${a.id}`));
    await expect(
      page
        .getByRole('dialog')
        .getByLabel(/Intitulé|Nom|Titre/)
        .first(),
    ).toBeVisible();
    expect(objet.id).toBeTruthy();

    // Autre périmètre : plus aucune donnée du précédent, l'absence est dite (jamais un faux zéro de conformité).
    await page.goto('/pilotage/parcours-iso');
    await etatInitial(page);
    await choisir(vide);
    await vue(page, 'Liste');
    await page.locator('button[data-sousaction="objectives-2"]').click();
    await expect(page.locator('#liste-objectives-2').getByText('Action : aucun élément')).toBeVisible();
    await expect(page.locator('[data-etape="objectives"]').getByText('Aucun travail trouvé').first()).toBeVisible();
    await expect(page.locator('#liste-objectives-2').getByText(titre)).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Parcours ISO / HDS : animations réglables, mouvement réduit respecté, mobile défilant', async ({ browser }) => {
  const { ctx, page, problems } = await ouvrir(browser, {
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 800 },
  });
  try {
    await page.goto('/pilotage/parcours-iso');
    await etatInitial(page);
    const racine = page.locator('.parcours-arbre');
    await vue(page, 'Arbre');
    await page.getByRole('combobox', { name: 'Animations' }).click();
    await page.getByRole('option', { name: 'Automatiques (selon le système)' }).click();
    // Mouvement réduit du système : « Automatiques » n'anime rien, « Animées » force les effets, « Arrêtées » les coupe.
    await expect(racine).toHaveAttribute('data-anime', 'non');
    await page.getByRole('combobox', { name: 'Animations' }).click();
    await page.getByRole('option', { name: 'Animées' }).click();
    await expect(racine).toHaveAttribute('data-anime', 'oui');
    await page.getByRole('combobox', { name: 'Animations' }).click();
    await page.getByRole('option', { name: 'Arrêtées' }).click();
    await expect(racine).toHaveAttribute('data-anime', 'non');
    // Téléphone : la page ne défile pas horizontalement, l'arbre défile dans sa zone et reste navigable.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const zone = page.getByRole('region', { name: /Arbre du parcours/ });
    expect(await zone.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    await page.locator('g.parcours-noeud[data-raccourci="risques"] g.parcours-noeud__bouton').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Étape sélectionnée' })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Parcours ISO / HDS : fiche associée à une sous-action, conservée, retirée avec motif, applicabilité HDS lue', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { ctx, page, problems } = await ouvrir(browser);
  const suffixe = Date.now().toString(36);
  const titre = `Action associée ${suffixe}`;
  try {
    await page.goto('/pilotage/parcours-iso');
    await etatInitial(page);
    const perimetre = await post(page, '/api/grc/smsis', {
      name: `Périmètre associations ${suffixe}`,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    await post(page, `/api/grc/${perimetre.id}/objects`, action(titre));
    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre.name, exact: true }).click();
    await vue(page, 'Liste');
    await page.locator('button[data-sousaction="objectives-2"]').click();
    const panneau = page.locator('#liste-objectives-2');
    const groupe = panneau.getByRole('group', { name: /Fiches et preuves associées/ });
    await expect(groupe.getByText('Aucune fiche ni preuve associée.')).toBeVisible();

    // Association : la fiche est proposée par son intitulé, puis conservée après rechargement.
    await groupe.getByRole('combobox', { name: 'Associer une fiche ou une preuve existante' }).click();
    await page.getByRole('option', { name: new RegExp(titre) }).click();
    await groupe.getByRole('textbox', { name: /Note/ }).fill('Prépare cette sous-action');
    await groupe.getByRole('button', { name: 'Associer', exact: true }).click();
    await expect(groupe.getByText(titre)).toBeVisible();
    await expect(groupe.getByText('Prépare cette sous-action')).toBeVisible();
    // Conservée côté serveur (journal), indépendamment de l'écran.
    const apres = await (await page.request.get(`/api/grc/${perimetre.id}/parcours/associations`)).json();
    expect(apres.items).toHaveLength(1);
    expect(apres.items[0]).toMatchObject({
      sousAction: 'objectives-2',
      name: titre,
      note: 'Prépare cette sous-action',
    });

    // Retrait : un motif est exigé ; l'historique reste côté serveur, la fiche n'est pas touchée.
    await groupe.getByRole('button', { name: new RegExp(`Retirer l’association de ${titre}`) }).click();
    const confirmer = groupe.getByRole('button', { name: 'Confirmer le retrait' });
    await expect(confirmer).toBeDisabled();
    await groupe.getByRole('textbox', { name: /Motif du retrait/ }).fill('Associée par erreur');
    await confirmer.click();
    await expect(groupe.getByText('Aucune fiche ni preuve associée.')).toBeVisible();
    const fiches = await (await page.request.get(`/api/grc/${perimetre.id}/objects?kind=action`)).json();
    expect(fiches.items.map((o: { name: string }) => o.name)).toContain(titre);

    // Applicabilité HDS : lue dans le périmètre, jamais déduite (aucun référentiel HDS n'y est rattaché).
    await page.locator('button[data-sousaction="hds-scope-1"]').click();
    await expect(
      page.locator('#liste-hds-scope-1').getByText(/aucun référentiel HDS n’est rattaché et actif dans ce périmètre/),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
