/* Registre des incidents et cellule de crise repris de l'outil de suivi : nouvel incident, qualification guidée dans la
   fiche (ADR 0091), obligations, action du registre des écarts, ouverture d'une cellule, main courante, check-list, contacts et
   scénarios. Données fictives posées par l'API. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage, ecrireEtat } from '../helpers';

test('Incidents et cellule de crise : qualification guidée, fiche, cellule, main courante, contacts, scénarios', async ({
  browser,
}) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const cur = await ctx.request.get('/api/suivi/etat');
    const s = await cur.json();
    Object.assign(s, {
      entityCategory: 'importante',
      incidents: [],
      plans: [{ id: 'EXO-1', type: 'exo', title: 'Exercice PRA fictif', status: 'Planifié' }],
      crisis: {
        scenarios: [
          {
            id: 'SCN-1',
            title: 'Rançongiciel fictif',
            items: [{ phase: 'Alerte', t: 'Alerter la direction', owner: 'RSSI' }],
          },
        ],
        contacts: [],
        cells: [],
      },
    });
    await ecrireEtat(ctx.request, csrf, s);

    // Nouvel incident : fiche vide ouverte dans le registre, titre saisi dans l'onglet « Fiche ».
    await page.goto('/pilotage/incidents-registre');
    await page.getByRole('button', { name: 'Nouvel incident' }).click();
    await expect(page.getByRole('tab', { name: 'Fiche', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Qualifier un signalement' })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Intitulé' }).fill('Courriel suspect fictif');
    await page.getByRole('textbox', { name: 'Intitulé' }).blur();
    await expect(page.getByRole('heading', { name: /Courriel suspect fictif/ })).toBeVisible();

    // Qualification guidée : atteinte aux données personnelles, donc incident de sécurité avec obligations.
    await page.getByRole('tab', { name: 'Qualification guidée' }).click();
    await page
      .getByRole('group', { name: /La confidentialité, l’intégrité ou la disponibilité/ })
      .getByRole('button', { name: 'Oui', exact: true })
      .click();
    await page
      .getByRole('group', { name: /Des données à caractère personnel/ })
      .getByRole('button', { name: 'Oui', exact: true })
      .click();
    await expect(page.getByText('Atteinte avérée ou probable', { exact: false })).toBeVisible();
    await expect(page.getByText('Catégorie de l’organisation : importante', { exact: false })).toBeVisible();
    // Les réponses restent modifiables : elles sont enregistrées dans la fiche.
    await expect(
      page
        .getByRole('group', { name: /Des données à caractère personnel/ })
        .getByRole('button', { name: 'Oui', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Retenir « Incident de sécurité »' }).click();
    await expect(page.getByText('Qualification de la fiche : Incident de sécurité', { exact: false })).toBeVisible();

    // Fiche : obligation traitée, action du registre des écarts.
    await page.getByRole('tab', { name: 'Fiche', exact: true }).click();
    const fiche = page.getByRole('tabpanel', { name: 'Fiche' });
    await expect(fiche.getByRole('textbox', { name: 'Intitulé' })).toHaveValue('Courriel suspect fictif');
    await fiche.getByRole('checkbox', { name: /RGPD/ }).click();
    await expect(fiche.getByText(/traité le/)).toBeVisible();
    await fiche.getByRole('button', { name: 'Créer une action dans le registre des écarts' }).click();
    await expect(fiche.getByText(/Action INC-AC-01/)).toBeVisible();

    // Retour au registre : la ligne indique l'état du RETEX (aucun RETEX n'est ouvert).
    await page.getByRole('button', { name: '← Registre des incidents' }).click();
    const ligne = page.getByRole('row', { name: /^INC-\d{4}-001/ });
    await expect(ligne).toContainText('Incident de sécurité');
    await expect(ligne).toContainText('Pas de RETEX');

    // Les anciennes adresses mènent au registre.
    await page.goto('/pilotage/incidents-qualifier');
    await expect(page).toHaveURL(/\/pilotage\/incidents-registre$/);

    // Cellule de crise : ouverture en exercice, main courante, check-list, échéance, clôture.
    await page.goto('/pilotage/crise-cellule');
    await page.getByRole('textbox', { name: 'Intitulé' }).fill('Exercice fictif');
    await page.getByRole('combobox', { name: 'Scénario' }).click();
    await page.getByRole('option', { name: 'Rançongiciel fictif' }).click();
    await page.getByRole('combobox', { name: 'Exercice planifié lié' }).click();
    await page.getByRole('option', { name: /EXO-1/ }).click();
    await page.getByRole('button', { name: 'Ouvrir la cellule de crise' }).click();
    await expect(page.getByText('EXERCICE', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Entrée', exact: true }).last().fill('Isolement du serveur décidé');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByText('Isolement du serveur décidé')).toBeVisible();
    await page.getByRole('checkbox', { name: /Alerter la direction/ }).click();
    await expect(page.getByText(/Check-list : Alerter la direction — fait\./)).toBeVisible();
    await page.getByRole('button', { name: 'CNIL 72 h' }).click();
    await expect(page.getByText('Notification CNIL (RGPD)')).toBeVisible();
    await page.getByRole('button', { name: 'Clôturer la cellule' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
    await expect(page.getByText(/clôturée le/)).toBeVisible();

    // Contacts de crise et scénarios.
    await page.goto('/pilotage/crise-contacts');
    await page.getByRole('button', { name: 'Ajouter un contact' }).click();
    await page.getByRole('textbox', { name: 'Nom du contact 1' }).fill('Contact fictif');
    await page.getByRole('textbox', { name: 'Nom du contact 1' }).blur();
    await expect(page.getByRole('textbox', { name: 'Nom du contact 1' })).toHaveValue('Contact fictif');
    await page.goto('/pilotage/crise-scenarios');
    await page.getByRole('button', { name: 'Ajouter un scénario' }).click();
    await expect(page.getByRole('textbox', { name: 'Scénario' })).toHaveValue('Nouveau scénario');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
