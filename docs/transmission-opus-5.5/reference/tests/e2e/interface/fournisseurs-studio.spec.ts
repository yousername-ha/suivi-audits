/* Frontend réel compilé ; toutes les réponses API sont FICTIVES et interceptées.
   Ces tests ne vérifient ni les permissions serveur ni une persistance PostgreSQL. */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fournisseursFixture, supplierAction } from './fournisseurs-fixture';

test('lecture clavier, rubriques séparées et retour du focus sans écriture', async ({ page }) => {
  const f = await fournisseursFixture(page);
  const row = page.locator('.fs-row').first();
  await row.focus();
  await row.press('Enter');
  const d = page.getByRole('dialog');
  await expect(d).toContainText(f.suppliers[0]!.name);
  await expect(d.getByRole('textbox')).toHaveCount(0);
  await d.getByRole('tab', { name: 'Certificats (1)', exact: true }).click();
  await expect(d).toContainText('05/12/2027');
  await d.getByRole('tab', { name: 'Contrôles (2)', exact: true }).click();
  await expect(d).toContainText('Vérifier l’activation');
  await d.getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(d).toContainText('Revue des accès');
  await d.getByRole('tab', { name: 'Évaluation', exact: true }).click();
  await expect(d).toContainText('2 répond');
  await pClose();
  await expect(row).toBeFocused();
  await row.press('Space');
  await expect(d).toBeVisible();
  await pClose();
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
  async function pClose() {
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
  }
});

test('édition directe isolée du clic ligne et formulaire conservant certificats et contrôles', async ({ page }) => {
  const f = await fournisseursFixture(page),
    original = structuredClone(f.suppliers[0]!),
    name = f.suppliers[0]!.name,
    row = page.locator('.fs-row').first();
  const mfa = row.getByRole('combobox', { name: `MFA de ${name}`, exact: true });
  const beforeColor = await mfa.evaluate((el) => getComputedStyle(el).color);
  await mfa.click();
  await page.getByRole('option', { name: 'Non', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row.getByRole('combobox', { name: `MFA de ${name}`, exact: true })).toHaveValue('Non');
  await expect.poll(() => mfa.evaluate((el) => getComputedStyle(el).color)).not.toBe(beforeColor);
  expect(f.writes[0]).toEqual({ method: 'PATCH', path: '/api/suppliers/SUP-001', body: { mfa: 'Non' } });
  await supplierAction(page, name, 'Modifier la fiche');
  const d = page.getByRole('dialog');
  await d.getByLabel('Notes', { exact: true }).fill('Note fictive modifiée');
  await d.getByRole('button', { name: 'Enregistrer la fiche', exact: true }).click();
  await expect(d).toHaveCount(0);
  const write = f.writes.at(-1)!;
  expect(write.method).toBe('PATCH');
  expect(write.body?.notes).toBe('Note fictive modifiée');
  expect(write.body?.controls).toEqual(original.controls);
  expect(write.body?.certs).toEqual(original.certs);
  await row.locator('td').first().click();
  await expect(d).toContainText('Note fictive modifiée');
  await page.keyboard.press('Escape');
  await expect(row).toBeFocused();
  expect(f.errors).toEqual([]);
});

test('ajout, évaluation et rattachement restent les actions existantes', async ({ page }) => {
  const f = await fournisseursFixture(page);
  await page.getByRole('button', { name: 'Ajouter un fournisseur', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Nom', { exact: false }).fill('Prestataire de recette fictif');
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(page.locator('.fs-row')).toHaveCount(6);
  expect(f.writes[0]).toEqual({
    method: 'POST',
    path: '/api/suppliers',
    body: { name: 'Prestataire de recette fictif' },
  });
  const name = f.suppliers[0]!.name;
  await supplierAction(page, name, 'Évaluer');
  const criterion = f.criteria[0];
  await d.getByRole('checkbox', { name: criterion.label, exact: true }).check();
  await d.getByRole('combobox', { name: `Répond au critère « ${criterion.label} » ?`, exact: true }).click();
  await page.getByRole('option', { name: 'Répond', exact: true }).click();
  await d.getByLabel(`Résultat pour « ${criterion.label} »`, { exact: true }).fill('Contrat fictif examiné');
  await d.getByLabel('Conclusion', { exact: true }).fill('Évaluation de recette');
  await d.getByRole('button', { name: 'Enregistrer l’évaluation', exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(f.writes.at(-1)?.body).toMatchObject({
    confirm: 'ENREGISTRER',
    items: [{ criterionId: criterion.id, meets: true, result: 'Contrat fictif examiné' }],
  });
  await supplierAction(page, name, 'Historique des évaluations');
  await expect(d).toContainText('Évaluation de recette');
  await expect(d).toContainText(criterion.label);
  await page.keyboard.press('Escape');
  await supplierAction(page, name, 'Périmètres de rattachement');
  await d.getByRole('button', { name: `Rattacher au périmètre ${f.scopes[0].name}`, exact: true }).click();
  await expect(
    d.getByRole('button', { name: `Retirer le rattachement au périmètre ${f.scopes[0].name}`, exact: true }),
  ).toBeVisible();
  expect(f.suppliers[0]!.scopes).toEqual([f.scopes[0].id]);
  await page.keyboard.press('Escape');
  expect(f.errors).toEqual([]);
});

test('lecteur : consultation et historique sans commandes d’écriture', async ({ page }) => {
  const f = await fournisseursFixture(page, { readonly: true });
  await expect(page.getByRole('button', { name: 'Ajouter un fournisseur', exact: true })).toHaveCount(0);
  await expect(page.locator('.fs-select')).toHaveCount(0);
  await page.locator('.fs-row').first().locator('td').first().click();
  const d = page.getByRole('dialog');
  await expect(d.getByRole('button', { name: 'Modifier la fiche', exact: true })).toHaveCount(0);
  await expect(d.getByRole('button', { name: 'Évaluer', exact: true })).toHaveCount(0);
  await d.getByRole('button', { name: 'Historique', exact: true }).click();
  const history = page.getByRole('dialog', { name: `Évaluations de ${f.suppliers[0]!.name}`, exact: true });
  await expect(history).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(history).toContainText('Aucune évaluation enregistrée');
  await page.keyboard.press('Escape');
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
});

test('recherche, filtres et soixante lignes gardent le défilement dans le registre', async ({ page }) => {
  const f = await fournisseursFixture(page, { many: 60 });
  await page.getByRole('button', { name: 'Rechercher un fournisseur', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rechercher un fournisseur', exact: true }).fill('hebergeur');
  await page.keyboard.press('Escape');
  await expect(page.locator('.fs-row')).toHaveCount(12);
  await page.getByRole('button', { name: 'Tout effacer', exact: true }).click();
  await page.getByRole('button', { name: 'Filtres fournisseurs', exact: true }).click();
  await page.getByRole('combobox', { name: 'Situation', exact: true }).click();
  await page.getByRole('option', { name: 'Certificats à traiter', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.fs-row')).toHaveCount(12);
  await page.getByRole('button', { name: 'Tout effacer', exact: true }).click();
  await page.getByRole('button', { name: 'Vue détaillée', exact: true }).click();
  await expect(page.locator('.fs-table')).toHaveAttribute('data-density', 'detail');
  await page.getByRole('button', { name: 'Vue compacte', exact: true }).click();
  const scroll = await page.locator('.fs-scroll').evaluate((el) => {
    el.scrollTop = 600;
    return { local: el.scrollTop, page: window.scrollY };
  });
  expect(scroll.local).toBeGreaterThan(0);
  expect(scroll.page).toBe(0);
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
});

test('indisponibilité du registre : ne pas afficher des zéros comme un résultat chargé', async ({ page }) => {
  const f = await fournisseursFixture(page, { unavailable: true });
  await expect(page.locator('.fs-empty')).toContainText('ne sont pas disponibles');
  await expect(page.locator('.fs-stat strong').first()).toHaveText('—');
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
});

test('dimensions PC et accessibilité du registre et de la consultation', async ({ browser }, testInfo) => {
  const layouts = [],
    axe = [];
  for (const [width, height] of [
    [1024, 768],
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
  ] as const)
    for (const theme of ['clair', 'sombre'] as const) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: width === 1920 ? 2 : 1,
        reducedMotion: 'reduce',
      });
      const p = await context.newPage();
      const f = await fournisseursFixture(p, { theme });
      await p.evaluate(() => document.fonts.ready);
      const metrics = await p.evaluate(() => {
        const el = document.querySelector('.fs-scroll')!;
        return {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          pageY: window.scrollY,
          regionHeight: el.clientHeight,
          regionWidth: el.clientWidth,
          contentWidth: el.scrollWidth,
          font: getComputedStyle(document.querySelector('.fs-identity strong')!).fontSize,
        };
      });
      layouts.push({ viewportWidth: width, viewportHeight: height, theme, ...metrics });
      expect(metrics.width).toBeLessThanOrEqual(width + 1);
      expect(metrics.height).toBeLessThanOrEqual(height + 1);
      expect(metrics.regionHeight).toBeGreaterThan(100);
      expect(parseFloat(metrics.font)).toBeGreaterThanOrEqual(14);
      if (width === 1920 && theme === 'sombre' && process.env.NEON_SUPPLIERS_SCREENSHOT) {
        await p.mouse.move(4, 4);
        await p.screenshot({ path: process.env.NEON_SUPPLIERS_SCREENSHOT, fullPage: true });
      }
      if (width === 1920) {
        let a = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        axe.push({ theme, view: 'registre', violations: a.violations });
        expect(a.violations).toEqual([]);
        await p.locator('.fs-row').first().locator('td').first().click();
        a = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        axe.push({ theme, view: 'consultation', violations: a.violations });
        expect(a.violations).toEqual([]);
      }
      if (width !== 1920) await p.locator('.fs-row').first().locator('td').first().click();
      await expect(p.getByRole('dialog')).toBeVisible();
      const modal = await p.getByRole('dialog').evaluate((el) => {
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, client: el.clientHeight, scroll: el.scrollHeight };
      });
      expect(modal.top).toBeGreaterThanOrEqual(0);
      expect(modal.bottom).toBeLessThanOrEqual(height + 1);
      expect(modal.scroll).toBeLessThanOrEqual(modal.client + 1);
      Object.assign(layouts.at(-1)!, { modal });
      expect(f.errors).toEqual([]);
      await context.close();
    }
  await testInfo.attach('dimensions-et-axe', {
    body: JSON.stringify({ layouts, axe }, null, 2),
    contentType: 'application/json',
  });
});
