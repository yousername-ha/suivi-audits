import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage, ecrireEtat } from '../helpers';

for (const width of [1440, 390]) {
  test(`Pilotage : accès par le clic du menu à ${width} px`, async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: (await sessionAdmin(browser)).state,
      ignoreHTTPSErrors: true,
      viewport: { width, height: 900 },
    });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    try {
      await page.goto('/');
      if (width < 576) await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
      await page
        .getByRole('link', { name: /^Pilotage(\s|$)/ })
        .filter({ visible: true })
        .click();
      await expect(page).toHaveURL(/\/pilotage$/);
      await expect(page.getByRole('heading', { name: 'Synthèse', exact: true })).toBeVisible();
      if (width < 576) {
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
      }
      await page.getByText('Contexte et responsabilités', { exact: true }).filter({ visible: true }).click();
      await page.getByRole('link', { name: 'Périmètre et contexte', exact: true }).filter({ visible: true }).click();
      await expect(page).toHaveURL(/\/pilotage\/contexte$/);
      await expect(page.getByRole('heading', { name: 'Périmètre et contexte', exact: true })).toBeVisible();
      expect(problems).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}

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
    await expect(row).toContainText('Dernier résultat : Non réussi');
    // Le focus rendu par la modale peut déplacer les éléments fixes lors d'une capture de page entière.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Exporter le registre et ses décisions', exact: true }).hover();
    await page.screenshot({ path: '/work/onboarding-suivi/ghke-controles-desktop.png', fullPage: true });
    await expect(page).toHaveScreenshot('pilotage-controles-desktop.png', {
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      mask: [
        // Les pastilles du menu dépendent des données cumulées par les parcours précédents.
        page.getByRole('navigation', { name: 'Navigation principale' }),
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
test('Pilotage : page Périmètres, création puis modification de la nature d’un périmètre', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const nom = `QA-Perimetre-${Date.now()}`;
  try {
    await page.goto('/pilotage/perimetres');
    await expect(page.getByRole('heading', { name: 'Périmètres', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Créer un périmètre', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Nom/).fill(nom);
    await dialog.getByLabel('Nature', { exact: true }).fill('SMQ');
    await dialog.getByLabel('Nature', { exact: true }).press('Tab');
    await dialog.getByLabel('Périmètre', { exact: true }).fill('Activités du système de management de la qualité');
    await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await expect(ligne).toContainText('SMQ');
    await ligne.getByRole('button', { name: `Modifier le périmètre ${nom}` }).click();
    await dialog.getByLabel('Nature', { exact: true }).fill('SMI');
    await dialog.getByLabel('Nature', { exact: true }).press('Tab');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(ligne).toContainText('SMI');
    await page.reload();
    await expect(page.getByRole('row').filter({ hasText: nom })).toContainText('SMI');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('Pilotage : bibliothèque de référentiels, import puis rattachement à un périmètre', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const stamp = Date.now(),
    nom = `Référentiel QA ${stamp}`;
  const definition = {
    name: nom,
    identifier: `QA-BIBLIO-${stamp}`,
    source: {
      organisation: 'Organisation fictive',
      document: 'Document fictif',
      url: 'https://example.invalid/qa',
      version: '1',
      date: '2026-10-13',
      license: 'Exemple fictif libre',
      verifiedAt: '',
      normative: false,
      status: 'organisation',
    },
    domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
    requirements: [
      {
        id: 'QA-1',
        domain: 'gouvernance',
        title: 'Exigence fictive',
        description: 'Exemple',
        applicability: 'Tout',
        measureRefs: [],
      },
    ],
  };
  try {
    await page.goto('/pilotage/bibliotheque');
    await expect(page.getByRole('heading', { name: 'Bibliothèque de référentiels', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Importer un référentiel', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Définition du référentiel (JSON)').fill(JSON.stringify(definition));
    await dialog.getByRole('button', { name: 'Simuler la publication', exact: true }).click();
    await expect(dialog.getByText(/1 exigence\(s\) dans 1 domaine\(s\)/)).toBeVisible();
    await dialog.getByLabel('Motif de la publication').fill('Publication de recette automatisée');
    await dialog.getByRole('button', { name: 'Publier', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: nom })).toContainText('QA-BIBLIO');
    await page.goto('/pilotage/perimetres');
    await page.getByRole('button', { name: /^Référentiels rattachés au périmètre Pilotage de l/ }).click();
    await expect(dialog.getByText('Aucun référentiel de la bibliothèque n’est rattaché à ce périmètre.')).toBeVisible();
    await choose(page, 'Rattacher un référentiel de la bibliothèque', nom);
    await dialog.getByRole('button', { name: 'Rattacher', exact: true }).click();
    await expect(dialog.getByText(nom, { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Version 1/)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /^Référentiels rattachés au périmètre Pilotage de l/ }).click();
    await expect(page.getByRole('dialog').getByText(nom, { exact: true })).toBeVisible();
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
        // Les pastilles du menu dépendent des données cumulées par les parcours précédents.
        page.getByRole('navigation', { name: 'Navigation principale' }),
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
test('Pilotage : correspondance validée, rapprochement proposé puis confirmé par le pilote', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const stamp = Date.now();
  const definition = (identifier: string, id: string) => ({
    name: `Référentiel ${identifier}`,
    identifier,
    source: {
      organisation: 'Organisation fictive',
      document: 'Document fictif',
      url: 'https://example.invalid/qa',
      version: '1',
      date: '2026-10-13',
      license: 'Exemple fictif libre',
      verifiedAt: '',
      normative: false,
      status: 'organisation',
    },
    domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
    requirements: [
      {
        id,
        domain: 'gouvernance',
        title: `Exigence ${id}`,
        description: 'Exemple',
        applicability: 'Tout',
        measureRefs: [],
      },
    ],
  });
  const publier = async (identifier: string, id: string) => {
    const def = definition(identifier, id);
    const apercu = await post(page, '/api/library/frameworks/preview', { id: null, definition: def });
    const r = await page.request.post('/api/library/frameworks/publish', {
      headers: {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': await csrfOf(page.request),
        'If-Match': '"0"',
      },
      data: {
        id: null,
        definition: def,
        previewId: apercu.previewId,
        reason: 'Publication fictive de recette automatisée',
        confirm: 'PUBLIER',
      },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return (await r.json()) as { id: string };
  };
  try {
    await page.goto('/pilotage/synthese');
    const a = await publier(`QA-RAP-A-${stamp}`, 'RA-1'),
      b = await publier(`QA-RAP-B-${stamp}`, 'RB-1');
    const perimetre = await post(page, '/api/grc/smsis', {
      name: `Périmètre rapprochements ${stamp}`,
      scope: 'Fixture privée de recette',
      nature: 'SMI',
      timezone: 'Europe/Paris',
    });
    for (const fw of [a.id, b.id]) {
      const r = await page.request.put(`/api/grc/${perimetre.id}/framework-attachments/${fw}`, {
        headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
        data: { version: 1, confirm: 'RATTACHER' },
      });
      expect(r.ok(), await r.text()).toBeTruthy();
    }
    const mesure = await post(page, `/api/grc/${perimetre.id}/objects`, {
      kind: 'measure',
      name: `Mesure rapprochement ${stamp}`,
      data: {},
    });
    await post(page, `/api/library/mappings`, {
      source: { frameworkId: a.id, version: 1, requirementId: 'RA-1' },
      target: { frameworkId: b.id, version: 1, requirementId: 'RB-1' },
      type: 'equivalent',
      justification: 'Correspondance fictive de recette automatisée',
      coverage: 100,
      origin: 'human',
      sourceUrl: 'https://example.invalid/correspondance',
    });
    await page.evaluate((id) => sessionStorage.setItem('pilotage-scope', id), perimetre.id);

    // 1. La correspondance proposée se valide une seule fois, avec un motif.
    await page.goto('/pilotage/correspondances-bibliotheque');
    await expect(page.getByRole('heading', { name: 'Correspondances de la bibliothèque', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Valider la correspondance RA-1 vers RB-1$/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Motif').fill('Correspondance examinée par le responsable');
    await dialog.getByRole('button', { name: 'Valider', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    // 2. Une mesure reliée à l'exigence source : aucune couverture n'est affirmée, une proposition apparaît.
    await post(page, `/api/grc/${perimetre.id}/links`, {
      source: 'object:' + mesure.id,
      target: `requirement:${a.id}:1:RA-1`,
      type: 'implements',
      note: 'Lien de recette',
    });
    await page.goto('/pilotage/synthese');
    await expect(page.getByRole('status').filter({ hasText: 'Rapprochements à valider' })).toBeVisible();
    await page.getByRole('link', { name: 'Examiner les rapprochements' }).click();
    await expect(page.getByRole('heading', { name: 'Rapprochements à valider', exact: true })).toBeVisible();
    const ligne = page.getByRole('row').filter({ hasText: `Mesure rapprochement ${stamp}` });
    await expect(ligne).toContainText('RB-1');

    // 3. Le pilote confirme : le lien explicite est créé et la proposition quitte la file.
    await page
      .getByRole('button', {
        name: new RegExp(`^Confirmer le rapprochement vers RB-1 pour Mesure rapprochement ${stamp}`),
      })
      .click();
    await expect(page.getByText('Aucun rapprochement à valider.')).toBeVisible();
    await page.goto('/pilotage/couverture');
    await expect(page.getByRole('heading', { name: 'Couverture par référentiel', exact: true })).toBeVisible();
    await expect(page.getByText(`Référentiel QA-RAP-B-${stamp}`).first()).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
test('Pilotage : fournisseur évalué une fois, rattaché à deux périmètres avec la même évaluation', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const stamp = Date.now(),
    fournisseur = `Fournisseur fictif ${stamp}`,
    critere = `Critère fictif ${stamp}`;
  try {
    await page.goto('/pilotage/synthese');
    const perimetre = async (name: string) =>
      post(page, '/api/grc/smsis', {
        name,
        scope: 'Fixture privée de recette',
        nature: 'SMQ',
        timezone: 'Europe/Paris',
      });
    const [a, b] = [
      await perimetre(`Périmètre fournisseurs A ${stamp}`),
      await perimetre(`Périmètre fournisseurs B ${stamp}`),
    ];
    await post(page, '/api/suppliers/criteria', {
      label: critere,
      description: 'Critère fictif de recette automatisée',
      purposes: ['evaluation'],
      requirementRefs: [],
      reason: 'Définition fictive de recette',
    });

    // 1. Ajout d'un fournisseur au registre de l'organisation.
    await page.goto('/pilotage/fournisseurs');
    await expect(page.getByRole('heading', { name: 'Fournisseurs de l’organisation', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter un fournisseur', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom', { exact: false }).fill(fournisseur);
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const ligne = page.getByRole('row').filter({ hasText: fournisseur });
    await expect(ligne).toContainText('Non évalué');

    // 2. Une évaluation, indépendante des périmètres.
    await page.getByRole('button', { name: `Évaluer le fournisseur ${fournisseur}`, exact: true }).click();
    await dialog.getByRole('checkbox', { name: new RegExp(critere) }).check();
    await choose(page, `Répond au critère « ${critere} » ?`, 'Répond');
    await dialog.getByLabel(`Résultat pour « ${critere} »`).fill('Contrat examiné');
    await dialog.getByRole('button', { name: 'Enregistrer l’évaluation', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(ligne).toContainText('1 répond');

    // 3. Rattachement à deux périmètres, sans copie de l'évaluation.
    await page.getByRole('button', { name: `Périmètres de rattachement de ${fournisseur}`, exact: true }).click();
    for (const p of [a, b]) {
      await dialog.getByRole('button', { name: `Rattacher au périmètre ${p.name}`, exact: true }).click();
      await expect(
        dialog.getByRole('button', { name: `Retirer le rattachement au périmètre ${p.name}` }),
      ).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(ligne).toContainText('2 rattaché(s)');

    // 4. La même évaluation dans chaque périmètre.
    for (const p of [a, b]) {
      await page.evaluate((id) => sessionStorage.setItem('pilotage-scope', id), p.id);
      await page.goto('/pilotage/fournisseurs-perimetre');
      await expect(page.getByRole('heading', { name: 'Fournisseurs du périmètre', exact: true })).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: fournisseur })).toContainText('1 répond');
    }

    // 5. Suite donnée à l'évaluation, dans un périmètre choisi : une série sans fréquence par défaut.
    await page.goto('/pilotage/fournisseurs');
    await page.getByRole('button', { name: `Historique des évaluations de ${fournisseur}`, exact: true }).click();
    await dialog.getByRole('button', { name: /^Donner suite à l’évaluation du/ }).click();
    await choose(page, 'Type de suite', 'Série de réévaluation');
    await choose(page, 'Périmètre où la créer', b.name);
    await dialog.getByLabel('Intitulé').fill(`Réévaluer ${fournisseur}`);
    await dialog.getByLabel('Première échéance').fill('2027-01-15');
    await expect(dialog.getByRole('button', { name: 'Planifier la réévaluation', exact: true })).toBeDisabled();
    await dialog.getByLabel('Tous les').fill('12');
    await choose(page, 'Unité', 'mois');
    await dialog.getByRole('button', { name: 'Planifier la réévaluation', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('liée au fournisseur');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('Pilotage : les standards sont disponibles d’emblée, verrouillés, et se personnalisent par une copie', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage/bibliotheque');
    // Un standard repris de l'outil de suivi (identifiant propre à l'essai, jamais un texte normatif).
    const etat = await page.request.get('/api/legacy/state');
    const state = await etat.json();
    const me = await (await page.request.get('/api/auth/me')).json();
    const suffixe = String(Date.now());
    const frameworks = [
      ...(state.frameworks ?? []),
      {
        id: `QA-STD-${suffixe}`,
        name: `Standard fictif ${suffixe}`,
        version: '1',
        source: 'Organisation fictive — document fictif',
        objectives: { '1': { title: 'Objectif fictif' } },
        requirements: [{ id: 'QA-1', os: '1', theme: 'Thème fictif', text: 'Exigence fictive.', scope: '' }],
      },
    ];
    await ecrireEtat(page.request, me.csrf, { ...state, frameworks });
    await page.reload();
    const nom = `Standard fictif ${suffixe}`;
    await expect(page.getByText('Standards disponibles', { exact: true })).toBeVisible();
    // Aucune alerte rouge, aucun blocage : le bouton est actif sans motif ni confirmation.
    await expect(
      page.locator('.mantine-Alert-root[data-variant]').filter({ hasText: /non importable|erreur/i }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: `Ajouter ${nom} à la bibliothèque`, exact: true }).click();
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await expect(ligne.getByText('Version source verrouillée')).toBeVisible();
    // Une version source n'offre pas d'ajout d'exigence : seule la copie se personnalise.
    await expect(ligne.getByRole('button', { name: `Ajouter une exigence à ${nom}`, exact: true })).toHaveCount(0);
    await ligne.getByRole('button', { name: `Créer une copie personnalisable de ${nom}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom de la copie').fill(`Copie ${suffixe}`);
    await dialog.getByRole('button', { name: 'Créer la copie', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const copie = page.getByRole('row').filter({ hasText: `Copie ${suffixe}` });
    await expect(copie.getByText('Copie de l’organisation')).toBeVisible();
    await copie.getByRole('button', { name: `Ajouter une exigence à Copie ${suffixe}`, exact: true }).click();
    const ajout = page.getByRole('dialog');
    await ajout.getByLabel('Ou nouveau domaine').fill('Mesures locales');
    await ajout.getByLabel('Identifiant de l’exigence').fill('LOC-1');
    await ajout.getByLabel('Intitulé').fill('Mesure propre à l’organisation fictive');
    await ajout.getByRole('button', { name: 'Publier la nouvelle version', exact: true }).click();
    await expect(ajout).toHaveCount(0);
    await expect(copie.getByRole('cell', { name: '2', exact: true }).first()).toBeVisible();
    // L'original reste en version 1 et verrouillé.
    await expect(ligne.getByRole('cell', { name: '1', exact: true }).first()).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
