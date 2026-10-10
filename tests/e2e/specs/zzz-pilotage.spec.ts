import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function scope(page: Page, name: string) {
  await page.goto('/pilotage');
  await expect(page.getByRole('heading', { name: 'Synthèse', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Créer.*SMSI/ })).toHaveCount(0);
  const s = await post(page, '/api/grc/smsis', {
    name: name + Date.now(),
    scope: 'Fixture privée de recette',
    timezone: 'Europe/Paris',
  });
  await page.reload();
  await page.getByRole('textbox', { name: 'Périmètre affiché', exact: true }).click();
  await page.getByRole('option', { name: s.name, exact: true }).click();
  return '/api/grc/' + s.id;
}
async function choose(page: Page, label: string, value: string) {
  await page.getByRole('textbox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
  if (['Travaux réalisés et justificatifs', 'Éléments liés'].includes(label))
    await page.getByRole('textbox', { name: label, exact: true }).press('Escape');
}
test('Pilotage G/H : contrôle, preuve versionnée, constat et action corrective dans les registres', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const root = await scope(page, 'QA-Pilotage-controle-');
    const docTitle = 'Pièce contrôle pilotage ' + Date.now();
    const doc = await page.request.post('/api/documents', {
      data: Buffer.from('Pièce de recette contrôle'),
      headers: {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': await csrfOf(page.request),
        'Content-Type': 'application/octet-stream',
        'X-File-Name': 'controle-qa.txt',
        'X-Meta': encodeURIComponent(JSON.stringify({ title: docTitle })),
      },
    });
    expect(doc.status(), await doc.text()).toBe(201);
    const docRef = 'document:' + (await doc.json()).id + ':1';
    await page.goto('/pilotage/preuves');
    await page.getByRole('button', { name: 'Ajouter preuve', exact: true }).click();
    const proofDialog = page.getByRole('dialog');
    await proofDialog.getByLabel('Intitulé', { exact: true }).fill('Preuve qualité de recette');
    await choose(page, 'Versions des documents à examiner', docTitle + ' · preuve v1');
    await proofDialog.getByRole('textbox', { name: 'Versions des documents à examiner', exact: true }).press('Escape');
    await proofDialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(proofDialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Examiner', exact: true }).click();
    await proofDialog
      .getByLabel('Observations et justification', { exact: true })
      .fill('Version documentaire examinée et acceptée');
    await proofDialog.getByRole('checkbox', { name: 'Je confirme l’enregistrement de cette décision' }).check();
    await proofDialog.getByRole('button', { name: 'Confirmer l’enregistrement', exact: true }).click();
    await expect(proofDialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Autres actions pour Preuve qualité de recette', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Décisions et réalisations', exact: true }).click();
    await expect(proofDialog.getByText(docTitle + ' · Document examiné, version 1', { exact: true })).toBeVisible();
    await proofDialog.getByRole('button', { name: 'Fermer l’historique', exact: true }).click();

    await page.goto('/pilotage/controles');
    await page.getByRole('button', { name: 'Ajouter contrôle', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Intitulé', { exact: true }).fill('Contrôle qualité de recette');
    await dialog.getByLabel('Objectif du contrôle', { exact: true }).fill('Vérifier la qualité de la pièce');
    await dialog.getByLabel('Périmètre contrôlé', { exact: true }).fill('Service qualité');
    await dialog.getByLabel('Comment réaliser le contrôle', { exact: true }).fill('Comparer le résultat aux critères');
    await dialog.getByLabel('Critères de réussite', { exact: true }).fill('Aucune anomalie documentaire');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const row = page.getByRole('row').filter({ hasText: 'Contrôle qualité de recette' });
    await row.getByRole('button', { name: 'Réaliser le contrôle', exact: true }).click();
    await choose(page, 'Résultat', 'Non réussi');
    await dialog
      .getByLabel('Observations et justification', { exact: true })
      .fill('Anomalie constatée sur la pièce de recette');
    await choose(page, 'Travaux réalisés et justificatifs', docTitle + ' · preuve v1');
    await dialog.getByRole('checkbox', { name: 'Créer un écart dans le registre existant' }).check();
    await dialog.getByRole('checkbox', { name: 'Créer une action corrective suivie' }).check();
    await dialog.getByRole('checkbox', { name: 'Je confirme l’enregistrement de cette décision' }).check();
    await dialog.getByRole('button', { name: 'Confirmer l’enregistrement', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.screenshot({ path: '/work/onboarding-suivi/ghke-controles-desktop.png', fullPage: true });
    await expect(page).toHaveScreenshot('pilotage-controles-desktop.png', {
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      mask: [
        page.getByRole('textbox', { name: 'Périmètre affiché', exact: true }),
        page.locator('.presence-bar'),
        page.locator('.live-badge'),
        page.locator('.app-version'),
        page.locator('.mantine-Notifications-root'),
      ],
    });
    const control = (await (await page.request.get(root + '/objects?kind=control')).json()).items[0];
    expect(control.data.result).toBe('fail');
    const history = await (await page.request.get(root + '/pilotage/history?ref=object:' + control.id)).json();
    expect(history.items[0].refs).toEqual([docRef]);
    expect(history.items[0].generatedRefs).toHaveLength(2);
    await page.goto('/pilotage/amelioration');
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Écart du contrôle : Contrôle qualité de recette' })
        .getByRole('cell')
        .first(),
    ).toContainText('Écart du contrôle : Contrôle qualité de recette');
    await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();
    await dialog
      .getByLabel('Analyse des causes', { exact: true })
      .fill('Cause organisationnelle examinée avec le pilote');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto('/pilotage/actions');
    await expect(page.getByRole('button', { name: 'Action : Contrôle qualité de recette', exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('Pilotage K : parcours qualité enregistré, repris et validation humaine conservée', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const root = await scope(page, 'QA-Pilotage-qualite-');
    await post(page, root + '/objects', {
      kind: 'context',
      name: 'Contexte qualité de recette',
      data: { organisation: 'Recette', scope: 'Service qualité' },
    });
    await page.goto('/pilotage/parcours');
    await page.getByRole('button', { name: 'Démarrer mon parcours', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Intitulé', { exact: true }).fill('Parcours SMQ de recette');
    await dialog.getByLabel('Organisation', { exact: true }).fill('Organisation de recette');
    await dialog.getByLabel('Périmètre de la démarche', { exact: true }).fill('Activités métier');
    await dialog.getByLabel('Objectifs de la démarche', { exact: true }).fill('Piloter les travaux ISO 9001');
    await choose(page, 'Démarche', 'Qualité — SMQ');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Parcours SMQ de recette', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Valider cette étape', exact: true }).nth(1)).toBeDisabled();
    await page.getByRole('button', { name: 'Valider cette étape', exact: true }).first().click();
    await dialog
      .getByLabel('Observations et justification', { exact: true })
      .fill('Contexte examiné et validé par la direction');
    await choose(page, 'Travaux réalisés et justificatifs', 'Contexte qualité de recette');
    await dialog.getByRole('checkbox', { name: 'Je confirme l’enregistrement de cette décision' }).check();
    await dialog.getByRole('button', { name: 'Confirmer l’enregistrement', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/1 étapes de travaux validées sur 11/)).toBeVisible();
    await page.getByRole('button', { name: 'Historique des validations', exact: true }).click();
    await expect(page.getByText(/Parcours version 1/)).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('Pilotage E : BIA sur téléphone, plan relié et rapport imprimable sans débordement', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const root = await scope(page, 'QA-Pilotage-BIA-');
    await page.goto('/pilotage/bia');
    await expect(page.getByRole('textbox', { name: 'Rubrique du pilotage', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter analyse d’impact sur l’activité', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Intitulé', { exact: true }).fill('BIA activité de recette');
    await dialog.getByLabel('Activité', { exact: true }).fill('Accueil métier');
    await dialog.getByLabel('Scénario d’interruption', { exact: true }).fill('Indisponibilité du service');
    await dialog.getByLabel('Durée maximale d’interruption (heures)', { exact: true }).fill('24');
    await dialog.getByLabel('Objectif de reprise (heures)', { exact: true }).fill('4');
    await dialog.getByLabel('Service minimum attendu', { exact: true }).fill('Accueil de secours');
    await dialog.getByRole('button', { name: 'Ajouter une durée d’interruption', exact: true }).click();
    await dialog.getByLabel('Impact métier', { exact: true }).fill('Dossiers en attente et service dégradé');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const bia = (await (await page.request.get(root + '/objects?kind=bia')).json()).items[0];
    expect(bia.data.impacts[0].hours).toBe(24);
    await page.goto('/pilotage/continuite');
    await page.getByRole('button', { name: 'Ajouter plan de continuité ou de reprise', exact: true }).click();
    await dialog.getByLabel('Intitulé', { exact: true }).fill('PRA activité de recette');
    await choose(page, 'Type de plan', 'PRA — reprise informatique');
    await dialog
      .getByLabel('Procédures et ordre des opérations', { exact: true })
      .fill('Restaurer puis vérifier le service métier');
    await dialog.getByRole('tab', { name: 'Liens et justificatifs', exact: true }).click();
    await choose(page, 'Éléments liés', 'BIA activité de recette');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger le rapport imprimable', exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('pilotage-continuity_plan.html');
    const html = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8');
    expect(html).toContain('Restaurer puis vérifier le service métier');
    expect(html).toContain('object:' + bia.id);
    expect(html).not.toContain('<script');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '/work/onboarding-suivi/ghke-bia-mobile.png', fullPage: true });
    await expect(page).toHaveScreenshot('pilotage-continuite-mobile.png', {
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      mask: [
        page.getByRole('textbox', { name: 'Périmètre affiché', exact: true }),
        page.locator('.presence-bar'),
        page.locator('.live-badge'),
        page.locator('.app-version'),
        page.locator('.mantine-Notifications-root'),
      ],
    });
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
