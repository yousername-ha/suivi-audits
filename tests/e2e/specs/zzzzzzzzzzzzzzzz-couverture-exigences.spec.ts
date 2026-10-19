/* Couverture et évaluation des exigences (ADR 0041) : un référentiel de la bibliothèque rattaché au périmètre commun,
   une exigence évaluée (mise en œuvre puis test), l'état recalculé et l'historique des versions. Données fictives. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const SOCLE = '00000000-0000-4000-8000-000000000001';

test('Couverture : une exigence passe de non implémentée à testée, avec historique des versions', async ({
  browser,
}) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36);
  const definition = {
    name: `Référentiel couverture ${suffixe}`,
    identifier: `COUV-${suffixe}`.toUpperCase(),
    source: {
      organisation: 'Organisation fictive',
      document: 'Document de recette',
      url: 'https://example.invalid/recette',
      version: '1',
      date: '2026-10-18',
      license: 'Données fictives de test',
      verifiedAt: '',
      normative: false,
      status: 'organisation',
    },
    domains: [{ id: 'd', label: 'Domaine' }],
    requirements: [
      {
        id: 'R1',
        domain: 'd',
        title: 'Exigence fictive à évaluer',
        description: 'Fictif',
        applicability: '',
        measureRefs: [],
      },
      {
        id: 'R2',
        domain: 'd',
        title: 'Autre exigence fictive',
        description: 'Fictif',
        applicability: '',
        measureRefs: [],
      },
    ],
  };
  const entetes = { 'x-csrf-token': csrf };
  try {
    const apercu = await ctx.request.post('/api/library/frameworks/preview', {
      data: { id: null, definition },
      headers: entetes,
    });
    expect(apercu.ok(), await apercu.text()).toBeTruthy();
    const publie = await ctx.request.post('/api/library/frameworks/publish', {
      data: {
        id: null,
        definition,
        previewId: (await apercu.json()).previewId,
        reason: 'Publication fictive de recette',
        confirm: 'PUBLIER',
      },
      headers: { ...entetes, 'if-match': '"0"' },
    });
    expect(publie.ok(), await publie.text()).toBeTruthy();
    const fw = (await publie.json()).id as string;
    const att = await ctx.request.put(`/api/grc/${SOCLE}/framework-attachments/${fw}`, {
      data: { version: 1, confirm: 'RATTACHER' },
      headers: entetes,
    });
    expect(att.ok(), await att.text()).toBeTruthy();

    await page.goto('/pilotage/couverture');
    await expect(page.getByText(definition.name).first()).toBeVisible();
    await page.getByRole('combobox', { name: 'Détail par exigence' }).click();
    await page.getByRole('option', { name: definition.name }).click();
    const ligne = page.getByRole('row', { name: /R1 · Exigence fictive à évaluer/ });
    await expect(ligne.getByText('Non implémenté')).toBeVisible();

    // Première version : applicable, mise en œuvre complète.
    await page.getByRole('button', { name: 'Évaluer l’exigence R1' }).click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('combobox', { name: 'Applicabilité', exact: true }).click();
    await page.getByRole('option', { name: 'Applicable', exact: true }).click();
    await fiche.getByRole('combobox', { name: 'Mise en œuvre', exact: true }).click();
    await page.getByRole('option', { name: 'Complète' }).click();
    await fiche.getByRole('textbox', { name: 'Motif de cette version' }).fill('Mise en œuvre constatée');
    await fiche.getByRole('button', { name: 'Enregistrer une nouvelle version' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(ligne.getByText('Implémenté', { exact: true })).toBeVisible();
    await expect(ligne.getByText('Aucune mesure reliée').first()).toBeVisible();

    // Deuxième version : test d'efficacité conforme ; un test sans résultat est refusé avant l'envoi.
    await page.getByRole('button', { name: 'Évaluer l’exigence R1' }).click();
    await fiche.getByLabel('Date du test d’efficacité').fill('2026-10-10');
    await expect(fiche.getByRole('alert')).toContainText('vont ensemble');
    await expect(fiche.getByRole('button', { name: 'Enregistrer une nouvelle version' })).toBeDisabled();
    await fiche.getByRole('combobox', { name: 'Résultat du test', exact: true }).click();
    await page.getByRole('option', { name: 'Conforme', exact: true }).click();
    await fiche.getByRole('textbox', { name: 'Motif de cette version' }).fill('Test réalisé');
    await fiche.getByRole('button', { name: 'Enregistrer une nouvelle version' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(ligne.getByText('Testé', { exact: true })).toBeVisible();

    // L'historique conserve les deux versions, la plus récente d'abord ; l'autre exigence reste inchangée.
    await page.getByRole('button', { name: 'Évaluer l’exigence R1' }).click();
    await expect(fiche.getByText(/^v2 · Testé/)).toBeVisible();
    await expect(fiche.getByText(/^v1 · Implémenté/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('row', { name: /R2 · Autre exigence fictive/ }).getByText('Non implémenté'),
    ).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
