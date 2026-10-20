/* Récidive après clôture : un constat clos (causes, preuve, efficacité vérifiée, clôture) donne un nouveau constat lié en un
   clic, la clôture d'origine reste intacte, et le lien « Voir le constat précédent » revient à la fiche d'origine.
   Données fictives. */
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

test('Récidive : constat clos, nouveau constat lié, retour au constat précédent', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre récidive ${suffixe}`,
    nomEcart = `Constat à clore ${suffixe}`;
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
    // Preuve : un document, référencé par le constat (version 1).
    const doc = await envoyer(page, '/api/documents', Buffer.from('Justificatif de recette'), {
      'x-file-name': 'preuve-recidive.txt',
      'x-meta': encodeURIComponent(JSON.stringify({ title: `Justificatif ${suffixe}` })),
      'Content-Type': 'application/octet-stream',
    });
    const preuve = `document:${doc.id}:1`;
    const ecart = await envoyer(page, `/api/grc/${p.id}/objects`, {
      kind: 'nonconformity',
      name: nomEcart,
      data: { cause: 'Cause de recette analysée', refs: [preuve] },
    });
    const decision = (operation: string, result: string, version: number) =>
      envoyer(
        page,
        `/api/grc/${p.id}/pilotage/decisions`,
        {
          ref: `object:${ecart.id}`,
          decision: {
            operation,
            result,
            date: new Date().toISOString().slice(0, 10),
            note: 'Justification détaillée de la recette métier',
            refs: [preuve],
            requestId: crypto.randomUUID(),
            step: '',
            createFinding: false,
            createAction: false,
            confirm: 'ENREGISTRER',
          },
        },
        { 'If-Match': `"${version}"` },
      );
    await decision('effectiveness', 'effective', ecart.version);
    await decision('close', 'completed', ecart.version + 1);
    const clos = await (await page.request.get(`/api/grc/${p.id}/objects/${ecart.id}`)).json();
    expect(clos.data.status).toBe('closed');

    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await page.getByRole('button', { name: `Autres actions pour ${nomEcart}` }).click();
    await page.getByRole('menuitem', { name: 'Déclarer une récidive' }).click();
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByRole('textbox', { name: 'Intitulé' })).toHaveValue(`Récidive : ${nomEcart}`);
    await fiche.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(fiche).toBeHidden();

    // Le nouveau constat est lié au précédent ; la clôture d'origine est intacte.
    await expect
      .poll(async () => {
        const liste = (await (await page.request.get(`/api/grc/${p.id}/objects?kind=nonconformity`)).json()) as {
          items: { name: string; data: { recidiveRef?: string } }[];
        };
        return liste.items.find((o) => o.name === `Récidive : ${nomEcart}`)?.data.recidiveRef;
      })
      .toBe(`object:${ecart.id}`);
    const apres = await (await page.request.get(`/api/grc/${p.id}/objects/${ecart.id}`)).json();
    expect(apres.data.status).toBe('closed');
    expect(apres.version).toBe(clos.version);

    // Depuis la récidive, « Voir le constat précédent » ouvre la fiche d'origine.
    await page.getByRole('button', { name: `Autres actions pour Récidive : ${nomEcart}` }).click();
    await page.getByRole('menuitem', { name: 'Voir le constat précédent' }).click();
    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Intitulé' })).toHaveValue(nomEcart);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
