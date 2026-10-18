/* Registre des incidents et cellule de crise repris de l'outil de suivi : qualification d'un signalement, fiche,
   obligations, action du registre des écarts, ouverture d'une cellule, main courante, check-list, contacts et
   scénarios, alerte CRRC → incident. Données fictives posées par l'API. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage, ecrireEtat } from '../helpers';

test('Incidents et cellule de crise : qualification, fiche, cellule, main courante, contacts, scénarios', async ({
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
      findings: [],
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
      crrc: {
        establishments: [{ id: 'E1', name: 'Établissement fictif', status: 'Actif' }],
        resources: [{ id: 'R1', est: 'E1', name: 'NAS fictif', tech: 's3' }],
        alerts: [
          {
            id: 'ALR-1',
            date: '2026-10-12T03:00',
            severity: 'Haute',
            est: 'E1',
            res: 'R1',
            message: 'Échec fictif',
            status: 'Ouverte',
          },
        ],
      },
    });
    await ecrireEtat(ctx.request, csrf, s);

    // Qualification d'un signalement : atteinte aux données personnelles, donc incident de sécurité avec obligations.
    await page.goto('/pilotage/incidents-qualifier');
    await page.getByRole('textbox', { name: 'Intitulé du signalement' }).fill('Courriel suspect fictif');
    await page
      .getByRole('group', { name: /La confidentialité, l’intégrité ou la disponibilité/ })
      .getByRole('button', { name: 'Oui', exact: true })
      .click();
    await page
      .getByRole('group', { name: /Des données à caractère personnel/ })
      .getByRole('button', { name: 'Oui', exact: true })
      .click();
    await expect(page.getByText('Atteinte avérée ou probable', { exact: false })).toBeVisible();
    await expect(page.getByText('Catégorie du GCS : importante', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Créer la fiche dans le registre' }).click();

    // Fiche : obligation traitée, action du registre des écarts.
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByRole('textbox', { name: 'Intitulé' })).toHaveValue('Courriel suspect fictif');
    await fiche.getByRole('checkbox', { name: /RGPD/ }).click();
    await expect(fiche.getByText(/traité le/)).toBeVisible();
    await fiche.getByRole('button', { name: 'Créer une action dans le registre des écarts' }).click();
    await expect(fiche.getByText(/Action INC-AC-01/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^INC-\d{4}-001$/ })).toBeVisible();

    // Alerte CRRC → incident.
    await page.goto('/pilotage/crrc-alertes');
    await page.getByRole('button', { name: 'Créer un incident' }).click();
    // L'alerte passe « En cours » et quitte l'onglet des alertes ouvertes.
    await page.getByText(/^En cours \(1\)$/).click();
    await expect(page.getByText(/^INC-\d{4}-002$/)).toBeVisible();

    // Cellule de crise : ouverture en exercice, main courante, check-list, échéance, clôture.
    await page.goto('/pilotage/crise-cellule');
    await page.getByRole('textbox', { name: 'Intitulé' }).fill('Exercice fictif');
    await page.getByRole('textbox', { name: 'Scénario' }).click();
    await page.getByRole('option', { name: 'Rançongiciel fictif' }).click();
    await page.getByRole('textbox', { name: 'Exercice planifié lié' }).click();
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
