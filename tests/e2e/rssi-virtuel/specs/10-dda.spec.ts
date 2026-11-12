/* Étape 6 bis du scénario : le RSSI établit sa déclaration d'applicabilité (annexe A) par la fiche de chaque mesure, comme
   à l'écran : applicabilité, mise en œuvre, justification. Puis il contrôle ce que la page lui affiche contre les données. */
import { expect, test, type Page } from '@playwright/test';
import { sessionAdmin, watchPage } from '../../helpers';
import donnees, { litteral } from '../donnees';
import { lireInstantane, tauxMiseEnOeuvreTotale } from '../invariants';

const code = (id: string) => id.replace(/^A-/, 'A.');

async function ouvrirDda(page: Page) {
  await page.goto('/pilotage/dda-annexe-a');
  await expect(page.getByRole('heading', { name: 'Annexe A (DdA)', level: 1 })).toBeVisible();
  await expect(page.getByText('93 mesures', { exact: true })).toBeVisible();
}
/** Indicateur de la page : la valeur précède son libellé (« 1 % » puis « en mise en œuvre totale »). */
const indicateur = (page: Page, libelle: string) =>
  page
    .getByText(libelle, { exact: true })
    .locator('xpath=preceding-sibling::*[1]')
    .innerText()
    .then((t) => t.trim());

async function choisir(page: Page, champ: string, option: string) {
  const dialogue = page.getByRole('dialog');
  await dialogue.getByRole('combobox', { name: champ, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(dialogue.getByRole('combobox', { name: champ, exact: true })).toHaveValue(option);
}

test('le RSSI déclare l’applicabilité de ses mesures par la fiche de chaque mesure', async ({ browser }) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const problemes = watchPage(page);
  await ouvrirDda(page);

  for (const l of donnees.dda) {
    await page.getByRole('button', { name: code(l.mesure), exact: true }).click();
    const dialogue = page.getByRole('dialog');
    await expect(dialogue.getByRole('heading', { name: new RegExp(`^${litteral(code(l.mesure))} — `) })).toBeVisible();
    await choisir(page, 'Applicable', l.applicable === 'oui' ? 'Oui' : 'Non');
    if (l.niveau) await choisir(page, 'Mise en œuvre', l.niveau);
    const just = dialogue.getByRole('textbox', { name: 'Justification', exact: true });
    await just.fill(l.justification);
    await just.blur();
    await expect(just).toHaveValue(l.justification);
    await page.keyboard.press('Escape');
    await expect(dialogue).toHaveCount(0);
  }

  // Ce que l'écran a enregistré est bien ce que le RSSI a saisi (relu par l'API, après rechargement).
  const { dda } = await lireInstantane(ctx.request);
  for (const l of donnees.dda) {
    expect(dda.A.dda[l.mesure], l.mesure).toMatchObject({
      app: l.applicable,
      just: l.justification,
      ...(l.niveau ? { level: l.niveau } : {}),
    });
  }
  await ouvrirDda(page);
  const exclues = donnees.dda.filter((l) => l.applicable === 'non').length;
  expect(await indicateur(page, 'exclue')).toBe(String(exclues));
  // Filtre « Exclues » : la justification de l'exclusion est affichée dans la ligne.
  await page.getByText('Exclues', { exact: true }).click();
  for (const l of donnees.dda.filter((x) => x.applicable === 'non'))
    await expect(page.getByRole('row', { name: new RegExp(litteral(code(l.mesure))) })).toContainText(l.justification);
  expect(problemes).toEqual([]);
  await ctx.close();
});

test('RSSI-02 ouvert : le taux de mise en œuvre compte les mesures non examinées comme applicables', async ({
  browser,
}) => {
  // Constat du 11/11/2026 : « x % en mise en œuvre totale » divise par toutes les mesures non exclues, y compris celles
  // dont l'applicabilité n'a pas encore été décidée (6 mesures examinées sur 93 donnent 3 % au lieu de 60 %). Un auditeur
  // lit ce taux comme l'état de la DdA (6.1.3 d) : il doit porter sur les mesures examinées et déclarées applicables, les
  // mesures non examinées étant comptées à part. Devient rouge une fois corrigé : retirer le marqueur.
  test.fail(true, 'RSSI-02 ouvert : dénominateur du taux de mise en œuvre');
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const attendu = tauxMiseEnOeuvreTotale((await lireInstantane(ctx.request)).dda.A);
  expect(attendu.examinees).toBeGreaterThan(0);
  await ouvrirDda(page);
  expect(await indicateur(page, 'en mise en œuvre totale')).toBe(`${attendu.taux} %`);
  await ctx.close();
});

test('RSSI-01 ouvert : une mesure peut être exclue de la DdA sans justification', async ({ browser }) => {
  // Constat du 11/11/2026 (ISO/IEC 27001:2022, 6.1.3 d) : choisir « Non » dans la colonne « Applicable » enregistre
  // l'exclusion sans demander de justification ni la signaler (aucun filtre « exclue sans justification »). Attendu : la
  // justification est exigée, ou l'exclusion non justifiée est signalée comme une incohérence de la DdA.
  test.fail(true, 'RSSI-01 ouvert : exclusion sans justification acceptée sans signalement');
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  await ouvrirDda(page);
  const mesure = 'A.5.7';
  const applicabilite = page.getByRole('combobox', { name: `Applicabilité de ${mesure}`, exact: true });
  const enregistrement = page
    .waitForResponse((r) => r.url().endsWith('/api/dda/A-5.7') && r.request().method() === 'PATCH', { timeout: 5000 })
    .catch(() => null);
  await applicabilite.click();
  await page.getByRole('option', { name: 'Non', exact: true }).click();
  await enregistrement;
  try {
    // Attendu : l'exclusion sans justification est refusée (rien n'est enregistré) ou signalée à l'écran.
    const ligne = (await lireInstantane(ctx.request)).dda.A.dda['A-5.7'];
    const refusee = ligne?.app !== 'non';
    const signalee =
      (await page.getByText(/sans justification|justification (obligatoire|requise|manquante)/i).count()) > 0;
    expect(refusee || signalee, 'exclusion de A.5.7 sans justification ni refus ni signalement').toBe(true);
  } finally {
    // Remise en état : la mesure redevient « non examinée » pour ne pas fausser les fichiers suivants.
    await ctx.request.patch('/api/dda/A-5.7', {
      data: { app: '' },
      headers: { 'X-CSRF-Token': (await (await ctx.request.get('/api/auth/me')).json()).csrf },
    });
    await ctx.close();
  }
});
