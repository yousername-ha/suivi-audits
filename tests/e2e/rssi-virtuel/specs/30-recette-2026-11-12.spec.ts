/* Constats de la recette métier du 12/11/2026 (docs/05_RECETTE/rssi-virtuel/RAPPORT-2026-11-12.md) qui se rejouent sans
   parcours long. Chaque test décrit le comportement attendu et porte un marqueur test.fail tant que le constat est ouvert :
   il devient rouge une fois le défaut corrigé, ce qui oblige à retirer le marqueur. */
import { expect, test } from '@playwright/test';
import { sessionAdmin } from '../../helpers';
import { PERIMETRE_COMMUN } from '../invariants';

test('RSSI-05 ouvert : le bandeau des parties intéressées ignore les fiches saisies à l’écran', async ({ browser }) => {
  // ISO/IEC 27001:2022, 4.2 et 9.3.2 : une partie intéressée créée par la fiche de la rubrique n'est comptée ni dans le
  // bandeau de la rubrique ni dans l'entrée correspondante de la revue de direction (lecture du registre historique).
  test.fail(true, 'RSSI-05 ouvert : compteurs des parties intéressées à 0 malgré une fiche');
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  try {
    // Même enregistrement que la fiche « Ajouter partie intéressée » de l'écran.
    const r = await ctx.request.post(`/api/grc/${PERIMETRE_COMMUN}/objects`, {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        kind: 'stakeholder',
        name: 'Adhérents du groupement (fictif)',
        data: {
          nature: 'Externe',
          expectations: 'Disponibilité des données hébergées (fictif)',
          requirements: 'Certification HDS maintenue (fictif)',
          addressed: 'Oui',
          reviewedAt: '2025-06-01',
        },
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    await page.goto('/pilotage/parties');
    await expect(page.getByRole('row', { name: /Adhérents du groupement \(fictif\)/ })).toBeVisible();
    const total = page.getByText('parties intéressées', { exact: true }).locator('xpath=preceding-sibling::*[1]');
    await expect(total).toHaveText('1', { timeout: 5000 });
  } finally {
    await ctx.close();
  }
});

test('RSSI-12 ouvert : les liens d’une déclaration d’applicabilité ne se chargent pas', async ({ browser }) => {
  // Fiche « Applicabilité et justifications » d'une mesure, onglet « Liens et justificatifs » : l'écran affiche
  // « Origine de référence inconnue » ; la traçabilité du risque et du traitement vers la mesure n'est pas consultable.
  test.fail(true, 'RSSI-12 ouvert : GET …/links?ref=legacy:dda:… répond 422');
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  try {
    const r = await ctx.request.get(
      `/api/grc/${PERIMETRE_COMMUN}/links?ref=${encodeURIComponent('legacy:dda:A-8.13')}`,
    );
    expect(r.status(), await r.text()).toBe(200);
  } finally {
    await ctx.close();
  }
});

test('RSSI-15 ouvert : la fiche d’une tâche récurrente affiche des noms techniques en anglais', async ({ browser }) => {
  // Réglages de la récurrence nommés « start », « time », « timezone », « interval », « until », « count »,
  // « reminderDays », « active » : un RSSI ne peut pas savoir où fixer la date de début de la série.
  test.fail(true, 'RSSI-15 ouvert : libellés techniques de la récurrence');
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  try {
    await page.goto('/pilotage/recurrences');
    await page.getByRole('button', { name: 'Ajouter une tâche récurrente' }).click();
    const fiche = page.getByRole('dialog', { name: 'Créer — Tâche récurrente' });
    await expect(fiche.getByRole('combobox', { name: 'Périodicité' })).toBeVisible();
    for (const nom of ['start', 'time', 'timezone', 'interval', 'until', 'count', 'reminderDays', 'active'])
      await expect(fiche.getByRole('button', { name: nom, exact: true }), nom).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});

test('RSSI-23 ouvert : la page Processus est vide dès qu’un sous-périmètre est affiché', async ({ browser }) => {
  // Les processus de la page « Processus » vivent dans le registre historique, sans périmètre ; la page ne s'affiche que
  // pour le périmètre racine. Sous un sous-périmètre (ex. hébergement HDS), elle est blanche : ni liste, ni bouton, ni
  // message. Attendu au minimum : pouvoir créer un processus du périmètre affiché, ou lire pourquoi la page est vide.
  test.fail(true, 'RSSI-23 ouvert : page Processus blanche sous un sous-périmètre');
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  try {
    await page.goto('/pilotage/perimetres');
    await page
      .getByRole('button', { name: /^Ajouter un périmètre enfant à / })
      .first()
      .click();
    const creation = page.getByRole('dialog');
    await creation.getByRole('textbox', { name: 'Nom', exact: true }).fill('Hébergement HDS (fictif)');
    await creation.getByRole('button', { name: 'Créer', exact: true }).click();
    await expect(creation).toHaveCount(0);

    await page.goto('/pilotage/processus-cartes');
    const perimetre = page.getByRole('combobox', { name: 'Périmètre affiché' });
    await perimetre.click();
    await page.getByRole('option', { name: 'Hébergement HDS (fictif)', exact: true }).click();
    await expect(perimetre).toHaveValue('Hébergement HDS (fictif)');
    await expect(
      page
        .getByRole('button', { name: /processus/i })
        .or(page.getByText(/aucun processus|processus de l’organisation|périmètre racine/i))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  } finally {
    await ctx.close();
  }
});
