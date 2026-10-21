/* Graphe des périmètres : cartes de synthèse, compteurs (indisponible plutôt que zéro), création d'un enfant depuis le
   graphe, retrouvé dans la liste avec le même identifiant. Données fictives. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}

test('Graphe des périmètres : compteurs de la carte et création d’un enfant', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    parent = `Périmètre graphe ${suffixe}`,
    enfant = `Enfant du graphe ${suffixe}`;
  try {
    await page.goto('/pilotage/perimetres');
    const p = await post(page, '/api/grc/smsis', {
      name: parent,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'action',
      name: `Action en retard ${suffixe}`,
      data: {
        description: '',
        status: 'todo',
        ownerId: null,
        startAt: null,
        dueAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });

    await page.reload();
    await page.getByText('Graphe', { exact: true }).click();
    const carte = page.getByRole('group', { name: `Périmètre ${parent}` });
    await expect(carte).toBeVisible();
    await expect(carte.getByText('1 ouverte(s) · 1 en retard').first()).toBeVisible();
    // Aucun référentiel activé : la conformité n'est pas mesurable, elle n'est pas affichée comme 0 %.
    await expect(carte.getByText('indisponible')).toBeVisible();

    // Création d'un enfant depuis le graphe : le formulaire est celui de la liste, le parent est prérempli.
    await page.getByRole('button', { name: `Ajouter un périmètre enfant à ${parent}` }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByLabel(/^Nom/).fill(enfant);
    await dialogue.getByRole('button', { name: 'Créer', exact: true }).click();
    await expect(dialogue).toHaveCount(0);
    await expect(page.getByRole('group', { name: `Périmètre ${enfant}` })).toBeVisible();
    // La carte parent affiche son total avec le sous-périmètre : l'action du parent n'est comptée qu'une fois.
    const total = carte.getByRole('group', { name: /^Total de .* avec ses sous-périmètres/ });
    await expect(total).toContainText('Total avec 1 sous-périmètre(s)');
    await expect(total).toContainText('1 ouverte(s) · 1 en retard');

    // Même périmètre dans la liste, rattaché au parent, et dans les sélecteurs de l'API.
    await page.getByText('Liste', { exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: enfant })).toContainText(`de ${parent}`);
    const smsis = (await (await page.request.get('/api/grc/smsis')).json()) as {
      id: string;
      name: string;
      parentId: string | null;
    }[];
    expect(smsis.find((s) => s.name === enfant)?.parentId).toBe(p.id);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Graphe des périmètres : modification depuis le graphe, flèches et flux, fournisseur extérieur, accessibilité', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    nom = `Périmètre modifiable ${suffixe}`,
    renomme = `${nom} renommé`,
    fournisseur = `Fournisseur du graphe ${suffixe}`;
  try {
    await page.goto('/pilotage/perimetres');
    const p = await post(page, '/api/grc/smsis', {
      name: nom,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    const f = await post(page, '/api/suppliers', { name: fournisseur });
    expect(
      (
        await page.request.put(`/api/grc/${p.id}/suppliers/${f.id}`, {
          headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
        })
      ).ok(),
    ).toBe(true);

    await page.reload();
    await page.getByText('Graphe', { exact: true }).click();
    const carte = page.getByRole('group', { name: `Périmètre ${nom}` });
    await expect(carte).toBeVisible();

    // Fournisseur extérieur : colonne dédiée, lien vers sa fiche, jamais un parent.
    const carteFournisseur = page.getByRole('group', { name: `Fournisseur ${fournisseur}` });
    await expect(carteFournisseur).toBeVisible();
    await expect(carteFournisseur.getByRole('link', { name: fournisseur })).toHaveAttribute(
      'href',
      '/pilotage/fournisseurs',
    );

    // Liaisons orientées (pointe de flèche) ; le flux animé se met en pause et reprend.
    await post(page, '/api/grc/smsis', {
      name: `Enfant ${suffixe}`,
      nature: '',
      scope: '',
      timezone: 'Europe/Paris',
      parentId: p.id,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    await page.reload();
    await page.getByText('Graphe', { exact: true }).click();
    const lien = page.locator('path.graphe-lien').first();
    await expect(lien).toHaveAttribute('marker-end', 'url(#graphe-fleche)');
    await expect(lien).toHaveClass(/graphe-lien--flux/);
    const pause = page.getByRole('button', { name: 'Mettre le flux en pause' });
    await pause.click();
    await expect(page.getByRole('button', { name: 'Reprendre le flux' })).toHaveAttribute('aria-pressed', 'true');
    await expect(lien).not.toHaveClass(/graphe-lien--flux/);
    await page.getByRole('button', { name: 'Reprendre le flux' }).click();
    await expect(lien).toHaveClass(/graphe-lien--flux/);

    // Modification depuis le graphe : même formulaire, même identifiant, retrouvée dans la liste.
    await page.getByRole('button', { name: `Modifier le périmètre ${nom}` }).click();
    const dialogue = page.getByRole('dialog');
    await expect(dialogue).toBeVisible();
    const boite = await dialogue.boundingBox();
    const fenetre = page.viewportSize()!;
    expect(Math.abs(boite!.x + boite!.width / 2 - fenetre.width / 2)).toBeLessThan(4); // fenêtre centrée
    await dialogue.getByLabel(/^Nom/).fill(renomme);
    await dialogue.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialogue).toHaveCount(0);
    await expect(page.getByRole('group', { name: `Périmètre ${renomme}` })).toBeVisible();
    const smsis = (await (await page.request.get('/api/grc/smsis')).json()) as { id: string; name: string }[];
    expect(smsis.find((x) => x.id === p.id)?.name).toBe(renomme);

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(
      axe.violations.map(
        (v) =>
          `${v.id} (${v.nodes.length}) : ` +
          v.nodes
            .slice(0, 4)
            .map((n) => `${n.target.join(' ')} ${JSON.stringify(n.any[0]?.data ?? {})}`)
            .join(' | '),
      ),
    ).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Graphe des périmètres : mouvement réduit, flux arrêté d’emblée', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  try {
    await page.goto('/pilotage/perimetres');
    await page.getByText('Graphe', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reprendre le flux' })).toBeVisible();
    await expect(page.locator('path.graphe-lien--flux')).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});
