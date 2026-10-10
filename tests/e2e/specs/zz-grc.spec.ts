import { test, expect, type Page } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';
async function request(page: Page, path: string, body: unknown, version?: number) {
  const me = await (await page.request.get('/api/auth/me')).json();
  const r = await page.request.post(path, {
    headers: {
      Origin: new URL(page.url()).origin,
      'X-CSRF-Token': me.csrf,
      ...(version !== undefined ? { 'If-Match': `"${version}"` } : {}),
    },
    data: body,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
test('SMSI : objet relié, correspondance revue, indicateurs et rapport comité utilisables', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/grc');
    const smsi = await request(page, '/api/grc/smsis', {
      name: 'QA-GRC-comite-' + Date.now(),
      scope: 'Recette isolée du comité',
      timezone: 'Europe/Paris',
    });
    const prefix = `/api/grc/${smsi.id}`;
    const process = await request(page, prefix + '/objects', {
      kind: 'process',
      name: 'Processus lié de recette',
      data: { description: 'Activité métier', refs: [] },
    });
    for (const identifier of ['PSSI-source', 'PSSI-cible']) {
      const definition = {
        name: identifier,
        identifier,
        source: {
          organisation: 'Organisation fictive',
          document: 'PSSI de test',
          url: 'https://example.invalid/pssi',
          version: '1',
          date: '2026-10-10',
          license: 'Test fictif',
          verifiedAt: '',
          normative: false,
          status: 'organisation',
        },
        domains: [{ id: 'governance', label: 'Gouvernance' }],
        requirements: [
          {
            id: 'REQ1',
            domain: 'governance',
            title: 'Revue de test',
            description: 'Exemple fictif',
            applicability: 'Recette',
            measureRefs: [],
          },
        ],
      };
      const p = await request(page, prefix + '/frameworks/preview', { id: null, definition });
      await request(
        page,
        prefix + '/frameworks/publish',
        {
          id: null,
          definition,
          previewId: p.previewId,
          reason: 'Référentiel fictif pour le comité',
          confirm: 'PUBLIER',
        },
        0,
      );
    }
    await page.reload();
    await page.getByRole('textbox', { name: 'SMSI actif', exact: true }).click();
    await page.getByRole('option', { name: smsi.name, exact: true }).click();
    await page.getByRole('tab', { name: 'Objets SMSI', exact: true }).click();
    await page.getByRole('textbox', { name: 'Type d’objet SMSI', exact: true }).click();
    await page.getByRole('option', { name: 'Bien support', exact: true }).click();
    await page.getByRole('button', { name: 'Créer bien support', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom de la fiche', { exact: true }).fill('Bien support lié de recette');
    await dialog.getByLabel('Description', { exact: true }).fill('Objet du socle relié à un processus');
    await dialog.getByRole('textbox', { name: 'Objets liés dans le référentiel SMSI', exact: true }).click();
    await page.getByRole('option', { name: process.name, exact: true }).click();
    await dialog.getByRole('button', { name: 'Enregistrer la fiche', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const assets = await (await page.request.get(prefix + '/objects?kind=support_asset')).json();
    expect(assets.items[0].data.refs).toEqual(['object:' + process.id]);
    await page.getByRole('tab', { name: 'Correspondances', exact: true }).click();
    for (const [direction, framework] of [
      ['source', 'PSSI-source'],
      ['cible', 'PSSI-cible'],
    ]) {
      await page.getByRole('textbox', { name: 'Référentiel ' + direction, exact: true }).click();
      await page.getByRole('option', { name: framework!, exact: true }).click();
      await page.getByRole('textbox', { name: 'Exigence ' + direction, exact: true }).click();
      await page.getByRole('option', { name: 'REQ1 · Revue de test', exact: true }).click();
    }
    await page
      .getByLabel('Justification de la correspondance', { exact: true })
      .fill('Critères partiels examinés dans le cadre de la recette');
    await page
      .getByLabel('Source officielle ou organisationnelle', { exact: true })
      .fill('https://example.invalid/revue');
    await page.getByRole('button', { name: 'Enregistrer la proposition', exact: true }).click();
    await page.getByRole('button', { name: 'Revue humaine', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Décision et justification de la revue humaine', { exact: true })
      .fill('Validation humaine documentée pour le comité');
    await page.getByRole('button', { name: 'Confirmer la validation humaine', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Historique et détail', exact: true }).click();
    await expect(page.getByRole('dialog').getByText(/Version 2/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer l’historique' }).click();
    await page.getByRole('button', { name: 'Modifier la correspondance', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Justification de la correspondance', { exact: true })
      .fill('Critères partiels examinés après révision de recette');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Enregistrer et soumettre à nouveau à revue', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const revised = await (await page.request.get(prefix + '/objects?kind=mapping')).json();
    expect(revised.items[0].data.status).toBe('proposed');
    expect(revised.items[0].version).toBe(3);
    await page.getByRole('button', { name: 'Revue humaine', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Décision et justification de la revue humaine', { exact: true })
      .fill('Nouvelle validation motivée après modification');
    await page.getByRole('button', { name: 'Confirmer la validation humaine', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Tableau de bord SMSI', exact: true }).click();
    await expect(page.getByText('Référentiels activés et correspondances revues', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Import / export', exact: true }).click();
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Rapport comité SMSI / audit', exact: true }).click();
    const download = await promise;
    expect(download.suggestedFilename()).toBe('rapport-comite-smsi.html');
    const html = await (await import('node:fs/promises')).readFile((await download.path())!, 'utf8');
    expect(html).toContain('Correspondances validées');
    expect(html).toContain('Critères partiels examinés après révision de recette');
    expect(html).not.toContain('<script');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('SMSI : action réelle, cinq vues synchronisées, historique et clôture justifiée', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/grc');
    await expect(page.getByRole('heading', { name: 'Pilotage SMSI', exact: true })).toBeVisible();
    const smsi = await request(page, '/api/grc/smsis', {
      name: 'QA-GRC-actions-' + Date.now(),
      scope: 'Recette isolée',
      timezone: 'Europe/Paris',
    });
    await page.reload();
    await page.getByRole('textbox', { name: 'SMSI actif', exact: true }).click();
    await page.getByRole('option', { name: smsi.name, exact: true }).click();
    await page.getByRole('button', { name: 'Créer une action', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom de la fiche', { exact: true }).fill('Action synchronisée de recette');
    await dialog.getByLabel('Description', { exact: true }).fill('Vérification de non-régression et preuve');
    await dialog.getByLabel('Échéance', { exact: true }).fill(new Date().toISOString().slice(0, 10) + 'T09:00');
    await dialog.getByRole('button', { name: 'Enregistrer la fiche', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    for (const name of ['Kanban', 'Calendrier', 'Planning / Gantt', 'Tableau de bord', 'Liste']) {
      await page.getByRole('textbox', { name: 'Vue synchronisée', exact: true }).click();
      await page.getByRole('option', { name, exact: true }).click();
      if (name === 'Tableau de bord') await expect(page.getByText('Total', { exact: true })).toBeVisible();
      else if (name === 'Planning / Gantt')
        await expect(page.getByRole('img', { name: 'Planning des actions et dépendances' })).toBeVisible();
      else
        await expect(page.getByRole('button', { name: 'Action synchronisée de recette', exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Action synchronisée de recette', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'État de l’action', exact: true }).click();
    await page.getByRole('option', { name: 'En cours', exact: true }).click();
    await dialog.getByRole('button', { name: 'Enregistrer la fiche', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Action synchronisée de recette', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'État de l’action', exact: true }).click();
    await page.getByRole('option', { name: 'Terminée', exact: true }).click();
    await dialog
      .getByLabel('Justification de clôture', { exact: true })
      .fill('Contrôle de recette terminé et documenté');
    await dialog.getByRole('button', { name: 'Enregistrer la fiche', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const list = await (await page.request.get(`/api/grc/${smsi.id}/objects?kind=action`)).json();
    expect(list.items[0].data.status).toBe('done');
    expect(
      await (await page.request.get(`/api/grc/${smsi.id}/objects/${list.items[0].id}/history`)).json(),
    ).toHaveLength(3);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('SMSI : gabarit Excel réel, simulation, import atomique et doublon refusé', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/grc');
    const smsi = await request(page, '/api/grc/smsis', {
      name: 'QA-GRC-import-' + Date.now(),
      scope: 'Recette isolée Excel',
      timezone: 'Europe/Paris',
    });
    await page.reload();
    await page.getByRole('textbox', { name: 'SMSI actif', exact: true }).click();
    await page.getByRole('option', { name: smsi.name, exact: true }).click();
    await page.getByRole('tab', { name: 'Import / export', exact: true }).click();
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gabarit et exemple Excel', exact: true }).click();
    const download = await promise;
    expect(download.suggestedFilename()).toBe('exemple-fictif.xlsx');
    const path = await download.path();
    await page.locator('input[type=file]').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await (await import('node:fs/promises')).readFile(path!),
    });
    await expect(page.getByLabel('Contenu à simuler', { exact: true })).toHaveValue(/PSSI-EXEMPLE/);
    await page.getByRole('button', { name: 'Simuler l’importation', exact: true }).click();
    await expect(page.getByText(/1 domaines · 1 exigences/)).toBeVisible();
    await page.getByRole('button', { name: 'Importer le contenu simulé', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer l’importation', exact: true }).click();
    await page.getByRole('button', { name: 'Simuler l’importation', exact: true }).click();
    await expect(page.getByText(/Identifiant de référentiel déjà présent/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Importer le contenu simulé', exact: true })).toBeDisabled();
    expect((await (await page.request.get(`/api/grc/${smsi.id}/objects?kind=framework`)).json()).items).toHaveLength(1);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('SMSI : EBIOS RM publié, appréciation conservée, cartographie et export SVG sur mobile', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 900 },
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/grc');
    const smsi = await request(page, '/api/grc/smsis', {
        name: 'QA-GRC-risques-' + Date.now(),
        scope: 'Recette risques et carte',
        timezone: 'Europe/Paris',
      }),
      root = '/api/grc/' + smsi.id;
    const definition = await (await page.request.get('/api/grc/methods/templates/ebios_rm')).json();
    const preview = await request(page, root + '/methods/preview', { id: null, definition });
    const method = await request(
      page,
      root + '/methods/publish',
      {
        id: null,
        definition,
        previewId: preview.previewId,
        reason: 'Publication EBIOS RM de recette',
        confirm: 'PUBLIER',
      },
      0,
    );
    expect(method.definition.stages).toHaveLength(5);
    const risk = await request(page, root + '/objects', {
      kind: 'risk',
      name: 'Risque cartographié de recette',
      data: {
        description: 'Source unique du registre',
        code: 'QA-R1',
        ownerId: null,
        methodId: method.methodId,
        methodVersion: 1,
        domain: 'SSI',
        entity: 'Équipe',
        scope: 'Recette',
        strategy: 'reduce',
        acceptanceReason: '',
        reviewAt: '2027-01-01',
        stages: {},
      },
    });
    await page.reload();
    await page.getByRole('textbox', { name: 'SMSI actif', exact: true }).click();
    await page.getByRole('option', { name: smsi.name, exact: true }).click();
    await page.getByRole('tab', { name: 'Risques', exact: true }).click();
    await page.getByRole('button', { name: 'Apprécier / réévaluer', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Justification de l’appréciation', { exact: true })
      .fill('Appréciation de recette explicitement documentée');
    await dialog.getByRole('button', { name: 'Simuler l’appréciation', exact: true }).click();
    await expect(dialog.getByText(/Brut : Faible/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Enregistrer cette décision', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirmer l’enregistrement', exact: true }).click();
    await expect(dialog.getByText(/Révision 1/)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Cartographie des risques', exact: true }).click();
    await expect(page.locator(`.grc-risk-canvas [data-n="object:${risk.id}"]`)).toBeVisible();
    await page.getByRole('button', { name: 'Ajuster la carte', exact: true }).click();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter SVG', exact: true }).click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.svg$/);
    const p = await (await page.request.get(root + '/risk-map')).json();
    expect(p.items[0].assessment.risk_snapshot.id).toBe(risk.id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
