/* Étapes 8 et 9 du scénario : l'audit interne relève deux écarts mineurs, dont un sur une mesure que le RSSI a déclarée
   « Total ». La DdA doit signaler l'incohérence, le tableau de bord compter les écarts ; le RSSI lève l'incohérence en
   ramenant la mesure à « Partiel ». Les écarts sont posés par l'API du registre (comme un import du rapport d'audit) ;
   tout le reste se lit et se fait à l'écran. */
import { expect, test, type Page } from '@playwright/test';
import { creerEcartCommun, sessionAdmin, watchPage } from '../../helpers';
import donnees, { litteral } from '../donnees';
import { lireInstantane, verifier } from '../invariants';

const incoherences = (page: Page) =>
  page
    .getByText('« Total » avec écart ouvert', { exact: true })
    .locator('xpath=preceding-sibling::*[1]')
    .innerText()
    .then((t) => Number(t.trim()));

test('un écart sur une mesure « Total » est signalé, compté et levé par le RSSI', async ({ browser }) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const problemes = watchPage(page);
  const ecartsOuverts = async () => {
    await page.goto('/');
    const valeur = page
      .getByRole('region', { name: 'Écarts' })
      .locator('dt', { hasText: /^ouverts$/ })
      .locator('xpath=following-sibling::dd[1]');
    await expect(valeur).toHaveText(/^\d+$/);
    return Number(await valeur.innerText());
  };
  const avant = await ecartsOuverts();

  for (const e of donnees.ecarts)
    await creerEcartCommun(ctx.request, csrf, {
      name: e.titre,
      source: e.source,
      classification: e.classification,
      items: e.mesures,
    });

  // Mesures « Total » du jeu touchées par un écart : l'incohérence attendue se calcule depuis les données fictives.
  const totalTouchees = donnees.dda.filter(
    (l) => l.applicable === 'oui' && l.niveau === 'Total' && donnees.ecarts.some((e) => e.mesures.includes(l.mesure)),
  );
  expect(totalTouchees.length).toBeGreaterThan(0);
  expect(verifier(await lireInstantane(ctx.request)).filter((v) => v.regle === 'INV-05')).toHaveLength(
    totalTouchees.length,
  );

  // La DdA affiche l'incohérence et son filtre la retrouve.
  await page.goto('/pilotage/dda-annexe-a');
  await expect.poll(() => incoherences(page)).toBe(totalTouchees.length);
  await page.getByText('Total avec écart ouvert', { exact: true }).click();
  for (const l of totalTouchees)
    await expect(page.getByRole('button', { name: l.mesure.replace(/^A-/, 'A.'), exact: true })).toBeVisible();

  // Le tableau de bord compte les écarts ouverts du registre.
  await expect.poll(ecartsOuverts).toBe(avant + donnees.ecarts.length);

  // Le RSSI lève l'incohérence à l'écran : la mesure passe à « Partiel » tant que l'écart est ouvert.
  await page.goto('/pilotage/dda-annexe-a');
  await expect.poll(() => incoherences(page)).toBe(totalTouchees.length);
  for (const l of totalTouchees) {
    // Par la fiche de la mesure, comme à l'étape de la DdA (la liste déroulante de la ligne est masquée par l'en-tête
    // collant du tableau quand le navigateur l'amène en haut de la zone de défilement).
    await page.getByRole('button', { name: l.mesure.replace(/^A-/, 'A.'), exact: true }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByRole('combobox', { name: 'Mise en œuvre', exact: true }).click();
    await page.getByRole('option', { name: 'Partiel', exact: true }).click();
    await expect(dialogue.getByRole('combobox', { name: 'Mise en œuvre', exact: true })).toHaveValue('Partiel');
    await page.keyboard.press('Escape');
    await expect(dialogue).toHaveCount(0);
  }
  await expect.poll(() => incoherences(page)).toBe(0);
  expect(verifier(await lireInstantane(ctx.request)).filter((v) => v.regle === 'INV-05')).toEqual([]);
  expect(problemes).toEqual([]);
  await ctx.close();
});

test('RSSI-04 ouvert : la DdA désigne l’écart par son identifiant technique', async ({ browser }) => {
  // Constat du 11/11/2026 : la colonne « Écarts » de la DdA affiche l'identifiant interne de l'écart (UUID), que ni le RSSI
  // ni l'auditeur ne peuvent rapprocher du rapport d'audit. Attendu : l'intitulé de l'écart (ou sa référence lisible),
  // avec un lien vers sa fiche. Devient rouge une fois corrigé : retirer le marqueur.
  test.fail(true, 'RSSI-04 ouvert : écart affiché par son UUID dans la DdA');
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  try {
    const e = donnees.ecarts[0]!;
    await page.goto('/pilotage/dda-annexe-a');
    const id = (await lireInstantane(ctx.request)).ecarts.find((x) => x.name === e.titre)?.id;
    expect(id, 'écart du jeu fictif introuvable dans le registre').toBeTruthy();
    const code = litteral(e.mesures[0]!.replace(/^A-/, 'A.'));
    const ligne = page.getByRole('row', { name: new RegExp(`^${code} `) });
    // La ligne a chargé ses écarts (identifiant ou intitulé affiché) : seul le libellé reste ensuite en cause.
    await expect(ligne).toContainText(new RegExp(`${litteral(id!)}|${litteral(e.titre)}`), { timeout: 15_000 });
    await expect(ligne).toContainText(e.titre, { timeout: 2000 });
  } finally {
    await ctx.close();
  }
});
