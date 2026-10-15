/* Déclaration d'applicabilité et évaluations de sécurité des fournisseurs par le clausier, repris de l'outil de suivi :
   indicateurs et niveaux de la DdA, fiche d'une mesure, évaluation par le clausier (chapitres, points, note, action des
   écarts). Données fictives posées par l'API. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

test('DdA et évaluation par le clausier : niveaux, fiche, chapitres, points, note, écarts', async ({ browser }) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const cur = await ctx.request.get('/api/legacy/state');
    const s = await cur.json();
    const mesure = (id: string, ref: string, num: string) => ({
      id,
      ref,
      num,
      title: `Mesure fictive ${num}`,
      group: 'G',
      depth: 0,
      afnor: {},
      interne: {},
    });
    Object.assign(s, {
      items: [mesure('A-5.1', 'A', '5.1'), mesure('A-5.2', 'A', '5.2'), mesure('A-5.19', 'A', '5.19')],
      dda: {
        'A-5.1': { app: 'oui', level: 'Total', just: '', risk: '', actions: 'Action fictive', docs: '', comment: '' },
        'A-5.2': { app: 'non', level: '', just: 'Hors périmètre fictif', risk: '', actions: '', docs: '', comment: '' },
      },
      findings: [
        { id: 'NC-01', type: 'NC mineure', status: 'Ouvert', source: 'Audit', text: 'Écart fictif', items: ['A-5.1'] },
      ],
      suppliers: [{ id: 'SUP01', name: 'Fournisseur fictif', hds: 'Non', mfa: 'Oui', sso: 'SAML' }],
      supEvals: [],
    });
    const put = await ctx.request.put('/api/legacy/state', {
      data: s,
      headers: { 'if-match': cur.headers().etag!, 'x-csrf-token': csrf },
    });
    expect(put.status()).toBe(204);

    // DdA : indicateurs, incohérence, niveau modifié.
    await page.goto('/pilotage/dda-annexe-a');
    await expect(page.getByText('« Total » avec écart ouvert', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('img', { name: /Répartition des mesures applicables/ })).toBeVisible();
    await expect(page.getByText('NC-01', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Niveau de A.5.19' }).click();
    await page.getByRole('option', { name: 'Partiel', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Niveau de A.5.19' })).toHaveValue('Partiel');
    await page.getByText('Exclues', { exact: true }).click();
    await expect(page.getByText('Mesure fictive 5.2')).toBeVisible();
    await expect(page.getByText('Hors périmètre fictif')).toBeVisible();
    await page.getByText('Toutes', { exact: true }).click();
    await page.getByRole('button', { name: 'A.5.1', exact: true }).click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('textbox', { name: 'Commentaire de la revue' }).fill('Revue fictive');
    await fiche.getByRole('textbox', { name: 'Commentaire de la revue' }).blur();
    await expect(fiche.getByRole('textbox', { name: 'Commentaire de la revue' })).toHaveValue('Revue fictive');
    await page.keyboard.press('Escape');

    // Évaluation par le clausier : licence, chapitres applicables, points, note, action des écarts.
    await page.goto('/pilotage/evaluations-clausier');
    await expect(page.getByText('CC BY-NC-SA 4.0').first()).toBeVisible();
    await page.getByRole('button', { name: 'Nouvelle évaluation' }).click();
    await expect(page.getByText('Note indicative de l’outil')).toBeVisible();
    const avant = await page.getByText(/^\d+ points$/).innerText();
    await page.getByRole('checkbox', { name: /Dispositifs mobiles/ }).click();
    await expect(page.getByText(/^\d+ points$/)).not.toHaveText(avant);
    await page.getByRole('textbox', { name: 'État du point O-1.1' }).click();
    await page.getByRole('option', { name: 'Conforme', exact: true }).click();
    await expect(page.getByText('100 % conforme')).toBeVisible();
    await page.getByRole('textbox', { name: 'État du point O-1.2' }).click();
    await page.getByRole('option', { name: 'Non conforme', exact: true }).click();
    await expect(page.getByText('50 % conforme')).toBeVisible();
    await page.getByRole('button', { name: 'Créer les actions pour les écarts' }).click();
    await expect(page.getByText(/Action FOU-01 créée avec 1 tâche/)).toBeVisible();
    await page.getByText('← Toutes les évaluations').click();
    await expect(page.getByRole('button', { name: 'Fournisseur fictif' })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
