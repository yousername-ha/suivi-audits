/* Collaborateur : commentaire et preuve jointe à une action depuis sa fiche, journal immuable restitué. Les refus de rôle
   (création, modification, suppression, autres actions) sont vérifiés par la suite API `collaborateur.test.ts`. Données fictives. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

const PDF = Buffer.from('%PDF-1.4\n% test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}

test('Action : commentaire puis preuve jointe depuis la fiche, restitués dans le journal', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre collaborateur ${suffixe}`,
    titre = `Action collaborateur ${suffixe}`,
    nomDoc = `Compte rendu ${suffixe}.pdf`;
  try {
    await page.goto('/pilotage/actions');
    const p = await post(page, '/api/grc/smsis', {
      name: perimetre,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    const debut = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const fin = new Date(Date.now() + 20 * 86_400_000).toISOString();
    await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'action',
      name: titre,
      data: {
        description: 'Action de recette',
        status: 'todo',
        ownerId: null,
        startAt: debut,
        dueAt: fin,
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
    const doc = await page.request.post('/api/documents', {
      headers: {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': await csrfOf(page.request),
        'x-file-name': encodeURIComponent(nomDoc),
        'x-meta': encodeURIComponent('{}'),
        'content-type': 'application/octet-stream',
      },
      data: PDF,
    });
    expect(doc.ok(), await doc.text()).toBe(true);

    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Timeline', exact: true }).click();
    await page
      .getByRole('region', { name: /Timeline des actions/ })
      .getByRole('button', { name: titre })
      .click();

    const fiche = page.getByRole('dialog');
    const zone = fiche.getByRole('region', { name: 'Commentaires et preuves' });
    await expect(zone.getByText('Aucun commentaire ni preuve pour l’instant.')).toBeVisible();

    // Commentaire.
    await zone.getByLabel('Commentaire', { exact: true }).fill('Revue réalisée avec le responsable, aucun écart.');
    await zone.getByRole('button', { name: 'Ajouter le commentaire' }).click();
    const premier = zone.getByRole('group', { name: 'Contribution 1' });
    await expect(premier).toContainText('Commentaire');
    await expect(premier).toContainText('Revue réalisée avec le responsable, aucun écart.');

    // Preuve : un document que la personne peut lire, avec une note.
    const titreDoc = nomDoc.replace('.pdf', '');
    const choix = zone.getByRole('combobox', { name: 'Preuve' });
    await choix.click();
    await choix.fill(titreDoc);
    await page
      .getByRole('option', { name: new RegExp(titreDoc) })
      .first()
      .click();
    await zone.getByLabel('Note sur la preuve').fill('Version signée.');
    await zone.getByRole('button', { name: 'Joindre la preuve' }).click();
    const second = zone.getByRole('group', { name: 'Contribution 2' });
    await expect(second).toContainText('Preuve');
    await expect(second).toContainText(titreDoc);
    await expect(second).toContainText('Version signée.');

    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
