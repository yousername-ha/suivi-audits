/* Registres (ADR 0043) : création, périmètres hérités avec aperçu de l'impact et motif, droit attribué à une personne.
   Données fictives. */
import { expect, test } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

test('Registres : registre créé, périmètre ajouté après aperçu de l’impact, droit de contributeur attribué', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    nom = `Plan de recette ${suffixe}`,
    second = `Périmètre registres ${suffixe}`;
  try {
    // Un second périmètre à rattacher.
    await page.goto('/registres');
    const r = await page.request.post('/api/grc/smsis', {
      headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
      data: {
        name: second,
        nature: 'SMSI',
        scope: '',
        timezone: 'Europe/Paris',
        parentId: null,
        entityKind: 'perimetre',
        inheritFrameworks: false,
      },
    });
    expect(r.ok()).toBe(true);
    await page.reload();

    // La reprise a créé un registre par défaut ; la liste le montre avec son accès.
    await expect(page.getByRole('heading', { name: 'Registres', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pilotage commun' }).first()).toBeVisible();

    // Création.
    await page.getByRole('button', { name: 'Nouveau registre' }).click();
    const creation = page.getByRole('dialog');
    await creation.getByRole('textbox', { name: /^Nom/ }).fill(nom);
    await creation.getByRole('combobox', { name: 'Périmètre de référence' }).click();
    await page.getByRole('option').first().click();
    await creation.getByRole('button', { name: 'Créer', exact: true }).click();
    await expect(page.getByRole('heading', { name: nom, level: 1 })).toBeVisible();
    await expect(page.getByText('Plan d’actions · ', { exact: false }).first()).toBeVisible();

    // Périmètres : aperçu, motif obligatoire, confirmation ; le périmètre apparaît dans la fiche.
    await page.getByRole('tab', { name: 'Périmètres' }).click();
    await page.getByRole('button', { name: 'Modifier les périmètres' }).click();
    const edition = page.getByRole('dialog');
    await edition.getByRole('combobox', { name: 'Périmètres du registre' }).click();
    await page.getByRole('option', { name: second }).click();
    await edition.getByRole('combobox', { name: 'Périmètres du registre' }).press('Escape');
    await edition.getByRole('button', { name: 'Prévisualiser l’impact' }).click();
    await expect(edition.getByText('Impact de la modification')).toBeVisible();
    await expect(edition.getByText(`Ajoutés : ${second}`)).toBeVisible();
    const confirmer = edition.getByRole('button', { name: 'Confirmer le changement' });
    await expect(confirmer).toBeDisabled();
    await edition.getByLabel('Motif du changement').fill('Rattachement de recette automatique.');
    await confirmer.click();
    await expect(page.getByRole('list').getByText(second)).toBeVisible();

    // Droits : la personne choisie reçoit le rôle de contributeur, puis le perd.
    await page.getByRole('tab', { name: 'Droits' }).click();
    await page.getByRole('combobox', { name: 'Utilisateur ou groupe' }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Attribuer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer l’attribution' }).click();
    const tableau = page.getByRole('region', { name: /Droits attribués sur le registre/ });
    await expect(tableau.getByText('Contributeur', { exact: true })).toBeVisible();
    await tableau
      .getByRole('row', { name: /Contributeur/ })
      .getByRole('button', { name: /^Retirer le droit de/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(tableau.getByText('Contributeur', { exact: true })).toHaveCount(0);

    // Menu : la destination est dans la famille « Actions ».
    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Registres et droits' })
      .waitFor({ state: 'visible' });
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
