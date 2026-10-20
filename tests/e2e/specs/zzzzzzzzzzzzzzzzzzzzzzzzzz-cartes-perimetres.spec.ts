/* Graphe des périmètres : cartes de synthèse, compteurs (indisponible plutôt que zéro), création d'un enfant depuis le
   graphe, retrouvé dans la liste avec le même identifiant. Données fictives. */
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
