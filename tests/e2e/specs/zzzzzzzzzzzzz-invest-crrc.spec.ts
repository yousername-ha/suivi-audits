/* Plan d'investissement et gestion CRRC repris de l'outil de suivi : lignes budgétaires, comparaison des options,
   contrats, tableau de bord des sauvegardes, ressources, restauration guidée et alertes. Données fictives posées par l'API. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage, ecrireEtat } from '../helpers';

const il = (heures: number) => new Date(Date.now() - heures * 36e5).toISOString().slice(0, 16);
const dans = (jours: number) => new Date(Date.now() + jours * 864e5).toISOString().slice(0, 10);

test('Investissements et CRRC : lignes, comparaison, contrat, sauvegardes, restauration, alertes', async ({
  browser,
}) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const cur = await ctx.request.get('/api/suivi/etat');
    const s = await cur.json();
    const annee = new Date().getFullYear();
    Object.assign(s, {
      suppliers: [{ id: 'SUP01', name: 'Fournisseur fictif' }],
      invest: {
        baseYear: annee,
        lines: [
          {
            id: 'INV-001',
            company: 'Société A fictive',
            type: 'EDR',
            n0: 1000,
            n1: 1000,
            n2: 1000,
            status: 'En place',
            perimeter: 'Poste',
            renewal: dans(30),
            notice: 60,
          },
          {
            id: 'INV-002',
            company: 'Société B fictive',
            type: 'EDR',
            n0: 500,
            n1: 500,
            n2: 500,
            status: 'Prévisionnel',
            perimeter: 'Réseau',
            alt: 'Option moins chère',
          },
        ],
      },
      crrc: {
        establishments: [
          {
            id: 'CRRC-001-AAA',
            name: 'Établissement fictif',
            finess: '140000001',
            status: 'Actif',
            capacityGb: 2048,
            retentionDays: 90,
            scopes: { s3: true },
            offers: ['backup'],
          },
        ],
        resources: [{ id: 'RES-1', est: 'CRRC-001-AAA', name: 'NAS fictif', tech: 's3', freq: 'Quotidienne' }],
        runs: [
          {
            id: 'RUN-1',
            res: 'RES-1',
            date: il(48),
            type: 'Complète',
            status: 'Réussie',
            volumeGb: 100,
            durationMin: 30,
          },
          {
            id: 'RUN-2',
            res: 'RES-1',
            date: il(24),
            type: 'Incrémentale',
            status: 'Réussie',
            volumeGb: 10,
            durationMin: 5,
          },
        ],
        alerts: [
          {
            id: 'ALR-1',
            date: il(5),
            severity: 'Haute',
            est: 'CRRC-001-AAA',
            res: 'RES-1',
            message: 'Alerte fictive',
            status: 'Ouverte',
          },
        ],
      },
    });
    await ecrireEtat(ctx.request, csrf, s);

    // Investissements : tableau de bord, ligne ajoutée, comparaison.
    await page.goto('/pilotage/investissements');
    await expect(page.getByText('Budget sécurité sur trois ans', { exact: false })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Budget par année et par statut' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Répartition du budget par périmètre' })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter une ligne' }).click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('textbox', { name: 'Société' }).fill('Société C fictive');
    await fiche.getByRole('textbox', { name: 'Société' }).blur();
    await fiche.getByRole('textbox', { name: 'Type' }).fill('EDR');
    await fiche.getByRole('textbox', { name: 'Type' }).blur();
    await expect(fiche.getByRole('textbox', { name: 'Type' })).toHaveValue('EDR');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Lignes budgétaires' }).click();
    await expect(page.getByRole('button', { name: 'Société C fictive' })).toBeVisible();
    await page.getByRole('tab', { name: 'Comparaison des options' }).click();
    await expect(page.getByText('moins cher', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Renouvellements' }).click();
    await expect(page.getByText('À anticiper', { exact: true })).toBeVisible();

    // CRRC : vue d'ensemble et nouveau contrat.
    await page.goto('/pilotage/crrc-ensemble');
    await expect(page.getByRole('button', { name: 'Établissement fictif' })).toBeVisible();
    await page.getByRole('button', { name: 'Nouveau contrat' }).click();
    const contrat = page.getByRole('dialog');
    await contrat.getByRole('textbox', { name: 'Établissement' }).fill('Contrat créé fictif');
    await contrat.getByRole('textbox', { name: 'Établissement' }).blur();
    await expect(contrat.getByText(/CRRC-002-/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Contrat créé fictif' })).toBeVisible();

    // Tableau de bord des sauvegardes.
    await page.goto('/pilotage/crrc-tableau');
    await expect(page.getByRole('img', { name: 'Évolution du volume protégé' })).toBeVisible();
    await expect(page.getByRole('img', { name: /Carte schématique/ })).toBeVisible();
    await expect(page.getByText('Alerte fictive')).toBeVisible();

    // Ressource : ajout d'une sauvegarde.
    await page.goto('/pilotage/crrc-ressources');
    await page.getByRole('button', { name: 'NAS fictif' }).click();
    await page.getByRole('tab', { name: 'Historique' }).click();
    await page.getByRole('spinbutton', { name: 'Volume (Go)' }).fill('5');
    await page.getByRole('button', { name: 'Ajouter la sauvegarde' }).click();
    await expect(page.getByRole('cell', { name: '5 Go' })).toBeVisible();

    // Restauration guidée.
    await page.goto('/pilotage/crrc-restaurations');
    await page.getByRole('button', { name: 'Sélectionner NAS compatibles S3' }).click();
    await page.getByRole('textbox', { name: 'Ressource' }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('textbox', { name: 'Point de restauration' }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Continuer →' }).click();
    await page.getByRole('button', { name: 'Continuer →' }).click();
    await page.getByRole('button', { name: 'Lancer la restauration' }).click();
    await page.getByRole('tab', { name: /^Historique/ }).click();
    await expect(page.getByRole('textbox', { name: /^Statut de la restauration/ })).toHaveValue('Demandée');

    // Alertes : résolution.
    await page.goto('/pilotage/crrc-alertes');
    await page.getByRole('textbox', { name: 'Statut de l’alerte ALR-1' }).click();
    await page.getByRole('option', { name: 'Résolue', exact: true }).click();
    await expect(page.getByText('Aucune alerte.')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
