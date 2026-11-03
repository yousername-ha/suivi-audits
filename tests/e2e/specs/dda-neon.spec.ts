/* Régression des parcours DdA après la refonte : choix, effacement, filtres, fiche et erreurs.
   Jeu fictif isolé, état restauré après le scénario. */
import { expect, test } from '@playwright/test';
import { ecrireEtat, sessionAdmin, watchPage } from '../helpers';

test('DdA Neon : filtres, choix au clavier, effacement, fiche persistante et erreur de sauvegarde', async ({
  browser,
}) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const avant = await (await ctx.request.get('/api/suivi/etat')).json();
  const mesure = (id: string, ref: string, num: string) => ({
    id,
    ref,
    num,
    title: `Mesure fictive ${num}`,
    group: 'G',
    depth: 0,
    afnor: {},
    interne: {},
    refText: 'Référence fictive saisie par l’utilisateur.',
  });
  const choix = (name: string) => page.getByRole('combobox', { name, exact: true });
  const valeurs = async (reference = 'A') =>
    (await (await ctx.request.get(`/api/dda?reference=${reference}`)).json()).dda;
  try {
    await ecrireEtat(ctx.request, csrf, {
      ...avant,
      items: [
        mesure('A-5.1', 'A', '5.1'),
        mesure('A-5.2', 'A', '5.2'),
        mesure('A-5.3', 'A', '5.3'),
        mesure('A-5.4', 'A', '5.4'),
        mesure('ISO-4.1', 'ISO', '4.1'),
      ],
      dda: {
        'A-5.1': {
          app: 'oui',
          level: 'Total',
          docs: 'Procédure fictive\nAnnexe fictive',
          url: 'https://example.test/procedure.pdf',
          req: 'Extrait fictif conservé.',
          comment: 'Tenacy — note fictive',
        },
        'A-5.2': { app: 'non', level: 'Partiel', just: 'Exclusion fictive justifiée' },
        'A-5.4': { app: 'oui', level: 'Insuffisant' },
      },
    });
    await page.goto('/pilotage/dda-annexe-a');
    const filtres = page.getByRole('group', { name: 'Filtre des mesures' });
    await expect(page.getByRole('img', { name: /Répartition des mesures applicables.*3 applicables/ })).toBeVisible();
    await expect(filtres.getByRole('button', { name: 'Toutes 4', exact: true })).toBeVisible();
    await filtres.getByRole('button', { name: 'Exclues 1', exact: true }).click();
    await expect(page.getByText('Exclusion fictive justifiée')).toBeVisible();
    await expect(choix('Niveau de A.5.2')).toHaveCount(0);
    await filtres.getByRole('button', { name: 'Non renseignées 1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'A.5.3', exact: true })).toBeVisible();
    await choix('Applicabilité de A.5.3').focus();
    await page.keyboard.press('ArrowDown');
    const oui = page.getByRole('option', { name: 'Oui', exact: true });
    await expect(oui).toBeVisible();
    for (let pas = 0; pas < 3 && (await oui.getAttribute('data-combobox-selected')) !== 'true'; pas++) {
      await page.keyboard.press('ArrowDown');
    }
    await expect(oui).toHaveAttribute('data-combobox-selected', 'true');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await valeurs())['A-5.3']?.app).toBe('oui');
    await choix('Niveau de A.5.3').click();
    await page.getByRole('option', { name: 'Partiel', exact: true }).click();
    await expect.poll(async () => (await valeurs())['A-5.3']?.level).toBe('Partiel');
    await expect(page.getByText('Aucune mesure.', { exact: true })).toBeVisible();
    await filtres.getByRole('button', { name: 'Toutes 4', exact: true }).click();
    // Recliquer le choix sélectionné conserve l'effacement disponible au clavier ou à la souris.
    await choix('Niveau de A.5.3').click();
    await page.getByRole('option', { name: 'Partiel', exact: true }).click();
    await expect.poll(async () => (await valeurs())['A-5.3']?.level).toBe('');
    await choix('Applicabilité de A.5.3').click();
    await page.getByRole('option', { name: 'Oui', exact: true }).click();
    await expect.poll(async () => (await valeurs())['A-5.3']?.app).toBe('');
    await page.getByRole('button', { name: 'Ouvrir la fiche A.5.1', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Extrait fictif conservé.', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Documents associés', exact: true })).toHaveValue(
      'Procédure fictive\nAnnexe fictive',
    );
    await expect(dialog.getByRole('textbox', { name: 'Texte de référence', exact: true })).toHaveValue(
      'Référence fictive saisie par l’utilisateur.',
    );
    await expect(dialog.getByRole('link', { name: 'Ouvrir le document' })).toHaveAttribute(
      'href',
      'https://example.test/procedure.pdf',
    );
    const commentaire = dialog.getByRole('textbox', { name: 'Commentaire de la revue' });
    await commentaire.fill('Revue fictive Neon');
    await commentaire.blur();
    await expect.poll(async () => (await valeurs())['A-5.1'].comment).toBe('Revue fictive Neon');
    // Un refus serveur reste visible dans la fiche et ne remplace pas la valeur enregistrée.
    await page.route('**/api/dda/A-5.1', async (route) => {
      if (route.request().method() === 'PATCH')
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Enregistrement indisponible pour le test' }),
        });
      else await route.continue();
    });
    await dialog.getByRole('combobox', { name: 'Mise en œuvre', exact: true }).click();
    await page.getByRole('option', { name: 'Insuffisant', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    expect((await valeurs())['A-5.1'].level).toBe('Total');
    await page.unroute('**/api/dda/A-5.1');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: 'A.5.1', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Commentaire de la revue' })).toHaveValue(
      'Revue fictive Neon',
    );
    await page.keyboard.press('Escape');
    await page.goto('/pilotage/dda-iso');
    await expect(page.getByText('Obligatoire', { exact: true })).toBeVisible();
    await expect(choix('Applicabilité de 4.1')).toHaveCount(0);
    await page.getByRole('button', { name: '4.1', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Niveau', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Justification', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto('/pilotage/dda-hds');
    await expect(page.getByText('Aucune mesure.', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /Répartition des mesures applicables.*0 applicables/ })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const courant = await (await ctx.request.get('/api/suivi/etat')).json();
    await ecrireEtat(ctx.request, csrf, { ...courant, items: avant.items, dda: avant.dda });
    await ctx.close();
  }
});
