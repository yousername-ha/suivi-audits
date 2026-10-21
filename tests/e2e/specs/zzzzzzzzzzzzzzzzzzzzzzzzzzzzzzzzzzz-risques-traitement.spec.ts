/* Dossiers 002 et 003 : action issue d'un traitement avec choix du plan d'accueil, socle de sécurité de l'étude
   (atelier 1) saisi dans la fiche et restitué dans l'atelier. Données fictives. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}

test('Traitement : action générée dans le plan choisi ; étude : socle de sécurité', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre traitement ${suffixe}`,
    plan = `Plan des traitements ${suffixe}`,
    traitement = `Durcir les accès ${suffixe}`,
    etude = `Étude du socle ${suffixe}`;
  try {
    await page.goto('/pilotage/traitements');
    const p = await post(page, '/api/grc/smsis', {
      name: perimetre,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    const registre = await post(page, '/api/registres', { kind: 'plan_actions', name: plan, referenceId: p.id });
    const t = await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'treatment',
      name: traitement,
      data: { description: 'Traitement de recette' },
    });
    await post(page, `/api/grc/${p.id}/objects`, {
      kind: 'risk_study',
      name: etude,
      data: { objective: 'Recette', scope: 'Service fictif' },
    });

    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await page.getByRole('button', { name: 'Générer une action de traitement' }).first().click();
    const dialogue = page.getByRole('dialog');
    await expect(dialogue.getByLabel('Nom de l’action')).toHaveValue(`Mettre en œuvre : ${traitement}`);
    await dialogue.getByRole('combobox', { name: /Plan d.actions d.accueil/ }).click();
    await page.getByRole('option', { name: plan, exact: true }).click();
    await dialogue.getByRole('button', { name: 'Générer l’action' }).click();
    // La fiche de l'action s'ouvre ; elle est dans le plan choisi, liée au traitement.
    await expect(page.getByRole('dialog').getByText(plan)).toBeVisible();
    const liste = (await (await page.request.get(`/api/grc/${p.id}/objects?kind=action`)).json()) as {
      items: { name: string; registreId: string }[];
    };
    expect(liste.items.find((a) => a.name === `Mettre en œuvre : ${traitement}`)?.registreId).toBe(registre.id);
    const liens = (await (
      await page.request.get(`/api/grc/${p.id}/links?ref=${encodeURIComponent('object:' + t.id)}`)
    ).json()) as { other: { name: string } }[];
    expect(liens.some((l) => l.other.name.includes(traitement))).toBe(true);

    // Étude : socle de sécurité saisi dans la fiche, restitué dans l'atelier 1.
    await page.goto('/pilotage/etudes');
    await page.getByRole('button', { name: 'Ouvrir l’étude' }).first().click();
    await expect(page.getByText('Aucun socle renseigné')).toBeVisible();
    await page.getByRole('button', { name: 'Fiche de l’étude' }).click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('button', { name: 'Ajouter un référentiel au socle' }).click();
    await fiche.getByLabel('Référentiel', { exact: true }).fill('Politique de sécurité fictive');
    await fiche.getByLabel('Écart constaté').fill('Revue annuelle à planifier');
    await fiche.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(fiche).toHaveCount(0);
    await expect(page.getByTestId('socle-securite')).toContainText('Politique de sécurité fictive');
    await expect(page.getByTestId('socle-securite')).toContainText('Revue annuelle à planifier');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
