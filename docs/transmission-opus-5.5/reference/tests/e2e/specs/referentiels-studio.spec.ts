/* Contrôle du parcours de publication existant après son changement de présentation. Données fictives et périmètre dédié. */
import { expect, test } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

test('Référentiels Studio : publication, export, nouvelle version, historique et activation conservent leurs données', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  try {
    const csrf = await csrfOf(ctx.request),
      suffixe = Date.now().toString(36),
      nom = `Référentiel Studio fictif ${suffixe}`;
    const response = await ctx.request.post('/api/grc/smsis', {
      headers: { 'x-csrf-token': csrf },
      data: {
        name: `Publication Studio ${suffixe}`,
        nature: 'SMSI',
        scope: 'Périmètre isolé de recette',
        timezone: 'Europe/Paris',
        parentId: null,
        entityKind: 'perimetre',
        inheritFrameworks: false,
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const perimetre = await response.json();
    const definition = {
      name: nom,
      identifier: `STUDIO-${suffixe}`,
      source: {
        organisation: 'Organisation fictive',
        document: 'Document fictif de recette',
        url: 'https://example.invalid/studio',
        version: 'édition 2026',
        date: '2026-11-05',
        license: 'Exemple fictif libre',
        verifiedAt: '',
        normative: false,
        status: 'organisation',
      },
      domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
      requirements: Array.from({ length: 55 }, (_, n) => ({
        id: `ST-${n + 1}`,
        domain: 'gouvernance',
        title: `Exigence fictive ${n + 1}`,
        description: 'Contenu fictif initial',
        applicability: 'Périmètre de recette',
        measureRefs: [],
      })),
    };
    const page = await ctx.newPage(),
      problems = watchPage(page);
    await page.goto(`/pilotage/referentiels?perimetre=${perimetre.id}`);
    await page.getByRole('button', { name: 'Créer un référentiel', exact: true }).click();
    await page.getByRole('button', { name: 'Ouvrir le mode JSON avancé', exact: true }).click();
    await page.getByLabel('Définition JSON avancée', { exact: true }).fill(JSON.stringify(definition));
    await page.getByRole('button', { name: 'Appliquer au brouillon', exact: true }).click();
    await page.getByLabel('Motif de publication', { exact: true }).fill('Publication initiale fictive de recette');
    await page.getByRole('button', { name: 'Simuler la publication', exact: true }).click();
    await page.getByRole('button', { name: 'Publier cette version', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer la publication', exact: true }).click();
    const carte = page.getByRole('article', { name: `Référentiel ${nom}`, exact: true });
    await expect(carte).toBeVisible();
    await page.reload();
    await expect(carte.getByRole('button', { name: `Consulter ${nom}`, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const exigences = page.getByRole('region', { name: `Exigences de ${nom}`, exact: true });
    await expect(exigences.locator('tbody tr')).toHaveCount(50);
    await page.getByRole('button', { name: 'Afficher 50 exigences supplémentaires', exact: true }).click();
    await expect(exigences.locator('tbody tr')).toHaveCount(55);
    await page.getByRole('button', { name: 'Source et publication', exact: true }).click();
    const source = page.getByRole('dialog', { name: 'Source et publication', exact: true });
    await expect(source).toContainText('Document fictif de recette');
    await expect(source).toContainText('édition 2026');
    await expect(source).toContainText('Choix de l’organisation');
    await source.getByRole('button', { name: 'Fermer', exact: true }).click();
    const fichier = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter la définition JSON', exact: true }).click();
    const stream = await (await fichier).createReadStream();
    const morceaux: Buffer[] = [];
    for await (const morceau of stream!) morceaux.push(morceau);
    const exporte = JSON.parse(Buffer.concat(morceaux).toString());
    expect(exporte).toMatchObject({ identifier: definition.identifier, requirements: definition.requirements });
    await page.getByRole('button', { name: 'Préparer une nouvelle version', exact: true }).click();
    await page.getByRole('button', { name: 'Ouvrir le mode JSON avancé', exact: true }).click();
    const nouvelle = structuredClone(definition);
    nouvelle.requirements[0]!.description = 'Contenu fictif révisé';
    await page.getByLabel('Définition JSON avancée', { exact: true }).fill(JSON.stringify(nouvelle));
    await page.getByRole('button', { name: 'Appliquer au brouillon', exact: true }).click();
    await page.getByLabel('Motif de publication', { exact: true }).fill('Révision fictive conservant les exigences');
    await page.getByRole('button', { name: 'Simuler la publication', exact: true }).click();
    await page.getByRole('button', { name: 'Publier cette version', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer la publication', exact: true }).click();
    await carte.getByRole('button', { name: `Consulter ${nom}`, exact: true }).click();
    const objets = await (await ctx.request.get(`/api/grc/${perimetre.id}/objects?kind=framework`)).json();
    const objet = objets.items.find((o: { name: string }) => o.name === nom);
    const historique = await (await ctx.request.get(`/api/grc/${perimetre.id}/frameworks/${objet.id}/history`)).json();
    expect(historique).toHaveLength(2);
    expect(historique.find((h: { version: number }) => h.version === 1).definition.requirements[0].description).toBe(
      'Contenu fictif initial',
    );
    expect(historique.find((h: { version: number }) => h.version === 2).definition.requirements[0].description).toBe(
      'Contenu fictif révisé',
    );
    await page.getByRole('combobox', { name: 'Consulter une version publiée', exact: true }).click();
    await page.getByRole('option', { name: /^Version 1 / }).click();
    await expect(page.getByText(/Contenu fictif initial/)).toBeVisible();
    await page.getByRole('button', { name: 'Promouvoir dans la bibliothèque', exact: true }).click();
    const promotion = page.getByRole('dialog', { name: 'Promouvoir dans la bibliothèque', exact: true });
    await expect(promotion).toContainText('55 exigence(s)');
    await promotion.getByRole('button', { name: 'Promouvoir', exact: true }).click();
    await expect(promotion).toContainText('Référentiel promu');
    const bibliotheque = await (await ctx.request.get('/api/library/frameworks')).json();
    const promu = bibliotheque.find((f: { identifier: string }) => f.identifier === definition.identifier);
    const publication = await (
      await ctx.request.get(`/api/library/frameworks/${promu.id}/versions/${promu.version}`)
    ).json();
    expect(publication.definition.requirements).toEqual(nouvelle.requirements);
    const original = await (await ctx.request.get(`/api/grc/${perimetre.id}/objects/${objet.id}`)).json();
    expect(original.data.definition.requirements).toEqual(nouvelle.requirements);
    await page.keyboard.press('Escape');
    const activation = carte.getByRole('button', { name: /^(Activer|Désactiver)$/ });
    const avant = await activation.innerText();
    await activation.click();
    await expect(
      carte.getByRole('button', { name: avant === 'Activer' ? 'Désactiver' : 'Activer', exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(
      await exigences
        .locator('th')
        .nth(1)
        .evaluate((e) => e.getBoundingClientRect().width),
    ).toBeGreaterThan(150);
    expect(
      await exigences
        .locator('tbody tr')
        .first()
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeLessThan(150);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
