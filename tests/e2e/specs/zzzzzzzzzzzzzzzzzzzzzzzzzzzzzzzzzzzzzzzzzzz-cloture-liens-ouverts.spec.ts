/* Clôture d'un écart avec une action liée encore ouverte (décision 7) : refusée, puis acceptée avec un motif écrit conservé
   sur la fiche et au journal ; l'action reste suivie. Périmètre privé de recette, données fictives. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function envoyer(page: Page, path: string, data: unknown, extra: Record<string, string> = {}) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request), ...extra },
    data: data as never,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}

test('Clôture avec liens ouverts : refus puis motif écrit', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre clôture ${suffixe}`,
    nomEcart = `Écart à clore ${suffixe}`;
  try {
    await page.goto('/pilotage/amelioration');
    const p = await envoyer(page, '/api/grc/smsis', {
      name: perimetre,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    const doc = await envoyer(page, '/api/documents', Buffer.from('Justificatif de recette'), {
      'x-file-name': 'preuve-cloture.txt',
      'x-meta': encodeURIComponent(JSON.stringify({ title: `Justificatif ${suffixe}` })),
      'Content-Type': 'application/octet-stream',
    });
    const preuve = `document:${doc.id}:1`;
    const ecart = await envoyer(page, `/api/grc/${p.id}/objects`, {
      kind: 'nonconformity',
      name: nomEcart,
      data: { cause: 'Cause de recette analysée', refs: [preuve] },
    });
    const action = await envoyer(page, `/api/grc/${p.id}/objects`, {
      kind: 'action',
      name: `Action ouverte ${suffixe}`,
      data: {
        description: 'Action liée à l’écart, volontairement non terminée',
        status: 'todo',
        ownerId: null,
        startAt: null,
        dueAt: '2030-01-15T09:00:00Z',
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
    await envoyer(page, `/api/grc/${p.id}/links`, {
      source: `object:${action.id}`,
      target: `object:${ecart.id}`,
      type: 'implements',
      note: '',
    });
    await envoyer(
      page,
      `/api/grc/${p.id}/pilotage/decisions`,
      {
        ref: `object:${ecart.id}`,
        decision: {
          operation: 'effectiveness',
          result: 'effective',
          date: new Date().toISOString().slice(0, 10),
          note: 'Efficacité vérifiée lors de la recette',
          refs: [preuve],
          requestId: crypto.randomUUID(),
          step: '',
          createFinding: false,
          createAction: false,
          confirm: 'ENREGISTRER',
        },
      },
      { 'If-Match': `"${ecart.version}"` },
    );

    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await page.getByRole('button', { name: `Autres actions pour ${nomEcart}` }).click();
    await page.getByRole('menuitem', { name: 'Clôturer le constat' }).click();
    const d = page.getByRole('dialog');
    await d
      .getByRole('textbox', { name: /Observations et justification/ })
      .fill('Clôture décidée en revue de direction.');
    await d.getByRole('checkbox', { name: /Je confirme l’enregistrement/ }).check();
    await d.getByRole('button', { name: 'Confirmer l’enregistrement' }).click();
    // Refus explicite : la clôture n'a pas eu lieu et un motif écrit est demandé.
    await expect(d.getByText(/Des liens restent ouverts \(1 action\(s\) liée\(s\) non terminée\(s\)/)).toBeVisible();
    const motif = d.getByRole('textbox', { name: /Motif écrit de la clôture malgré les liens ouverts/ });
    await expect(motif).toBeVisible();
    await expect(d.getByRole('button', { name: 'Confirmer l’enregistrement' })).toBeDisabled();
    await motif.fill('Action reprise au plan annuel de l’année prochaine.');
    await d.getByRole('button', { name: 'Confirmer l’enregistrement' }).click();
    await expect(d).toHaveCount(0);

    const clos = await (await page.request.get(`/api/grc/${p.id}/objects/${ecart.id}`)).json();
    expect(clos.data.status).toBe('closed');
    expect(clos.data.closureOpenLinksReason).toBe('Action reprise au plan annuel de l’année prochaine.');
    const suivie = await (await page.request.get(`/api/grc/${p.id}/objects/${action.id}`)).json();
    expect(suivie.data.status).toBe('todo');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
