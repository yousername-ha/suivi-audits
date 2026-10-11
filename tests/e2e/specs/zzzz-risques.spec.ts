/* Gestion des risques (lot U3, RISK-01 à RISK-10) : étude EBIOS RM construite dans l'interface, éléments reliés par
   références typées, validation d'un atelier, risque créé depuis un scénario opérationnel, acceptation formelle et
   registre. Périmètre privé de recette, données fictives. */
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function appel(page: Page, method: 'POST' | 'PUT', path: string, data: unknown, version?: number) {
  const headers: Record<string, string> = {
    Origin: new URL(page.url()).origin,
    'X-CSRF-Token': await csrfOf(page.request),
  };
  if (version !== undefined) headers['If-Match'] = `"${version}"`;
  const r = await page.request.fetch(path, { method, headers, data });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function choisir(page: Page, champ: string, option: string) {
  const dialogue = page.getByRole('dialog');
  await dialogue.getByRole('textbox', { name: champ, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('Risques : étude EBIOS RM, atelier validé, risque issu du scénario et acceptation formelle', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    // Périmètre privé et méthode publiée (préparation par l'API, déjà couverte par ses propres tests).
    await page.goto('/pilotage');
    const s = await appel(page, 'POST', '/api/grc/smsis', {
      name: 'QA-Risques-' + Date.now(),
      scope: 'Fixture privée de recette',
      timezone: 'Europe/Paris',
    });
    const root = '/api/grc/' + s.id;
    const definition = await (await page.request.get('/api/grc/methods/templates/iso27005')).json();
    const apercu = await appel(page, 'POST', root + '/methods/preview', { id: null, definition });
    const methode = await appel(
      page,
      'POST',
      root + '/methods/publish',
      { id: null, definition, previewId: apercu.previewId, reason: 'Méthode de la recette', confirm: 'PUBLIER' },
      0,
    );
    await appel(page, 'PUT', root + '/method', { methodId: methode.methodId, version: 1, confirm: 'CHOISIR' }, 1);

    // Étude créée dans l'interface.
    await page.goto('/pilotage/etudes');
    await page.getByRole('textbox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: s.name, exact: true }).click();
    await expect(page.getByText('inspirée de la méthode EBIOS Risk Manager')).toBeVisible();
    await page.getByRole('button', { name: 'Nouvelle étude' }).click();
    let d = page.getByRole('dialog');
    await d.getByRole('textbox', { name: 'Intitulé', exact: true }).fill('Étude fictive de recette');
    await d.getByRole('textbox', { name: 'Objet de l’étude', exact: true }).fill('Service fictif de recette');
    await d.getByRole('textbox', { name: 'Périmètre étudié', exact: true }).fill('Plateforme fictive');
    await d.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(d).toHaveCount(0);
    await page.getByRole('button', { name: 'Ouvrir l’étude' }).click();

    // Atelier 1 : valeur métier, puis événement redouté relié (référence typée) et gradué.
    await page.getByRole('button', { name: 'Ajouter : Valeur métier' }).click();
    d = page.getByRole('dialog');
    await d.getByRole('textbox', { name: 'Intitulé', exact: true }).fill('Prise en charge fictive');
    await d.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(d).toHaveCount(0);
    await page.getByRole('button', { name: 'Ajouter : Événement redouté' }).click();
    d = page.getByRole('dialog');
    await d.getByRole('textbox', { name: 'Intitulé', exact: true }).fill('Interruption du service');
    await choisir(page, 'Valeur métier', 'Prise en charge fictive');
    await choisir(page, 'Gravité', '3 — Grave');
    await d.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(d).toHaveCount(0);
    const atelier1 = page.getByRole('region', { name: 'Atelier 1 — Cadrage et socle de sécurité' });
    await expect(atelier1.getByRole('row', { name: /Interruption du service/ })).toContainText('Gravité 3 — Grave');

    // Validation de l'atelier 1 : décision tracée, liée aux travaux de l'atelier.
    await page.getByRole('button', { name: 'Valider l’atelier' }).click();
    d = page.getByRole('dialog');
    await d.getByRole('textbox', { name: 'Observations et justification' }).fill('Atelier relu en séance de recette');
    await d.getByRole('textbox', { name: 'Rechercher un justificatif' }).fill('Prise');
    await choisir(page, 'Travaux réalisés et justificatifs', 'Prise en charge fictive');
    await d.getByRole('textbox', { name: 'Travaux réalisés et justificatifs', exact: true }).press('Escape');
    await d.getByRole('checkbox', { name: 'Je confirme l’enregistrement de cette décision' }).check();
    await d.getByRole('button', { name: 'Confirmer l’enregistrement' }).click();
    await expect(d).toHaveCount(0);
    await expect(page.getByText('Atelier validé')).toBeVisible();

    // Atelier 4 : un scénario opérationnel (préparé par l'API) donne un risque du registre avec sa filiation.
    const etude = (await (await page.request.get(root + '/objects?kind=risk_study')).json()).items[0];
    await appel(page, 'POST', root + '/objects', {
      kind: 'operational_scenario',
      name: 'Hameçonnage fictif',
      data: { studyRef: 'object:' + etude.id, attackSequence: 'Courriel piégé puis chiffrement', likelihood: 2 },
    });
    await page.reload();
    await page.getByRole('button', { name: 'Ouvrir l’étude' }).click();
    await page.getByRole('tab', { name: '4. Scénarios opérationnels' }).click();
    await page.getByRole('button', { name: 'Créer le risque' }).click();
    d = page.getByRole('dialog', { name: 'Créer — Risque' });
    await expect(d.getByRole('textbox', { name: 'Nom de la fiche' })).toHaveValue('Risque : Hameçonnage fictif');
    await d.getByRole('textbox', { name: 'Menace', exact: true }).fill('Rançongiciel');
    await choisir(page, 'Stratégie', 'Accepter');
    await d.getByRole('textbox', { name: 'Justification d’acceptation' }).fill('Réduction disproportionnée en recette');
    await d.getByRole('button', { name: 'Enregistrer la fiche' }).click();
    await expect(d).toHaveCount(0);

    // Registre : acceptation à décider, puis décision formelle avec échéance.
    await page.goto('/pilotage/risques');
    const ligne = page.getByRole('row', { name: /Risque : Hameçonnage fictif/ });
    await expect(ligne).toContainText('Acceptation à décider');
    await ligne.getByRole('button', { name: 'Décider de l’acceptation' }).click();
    d = page.getByRole('dialog');
    await d.getByLabel('Échéance de l’acceptation').fill('2027-06-30');
    await d
      .getByRole('textbox', { name: 'Conditions et justification de la décision' })
      .fill('Risque accepté sous réserve de surveillance mensuelle');
    await d.getByRole('checkbox', { name: 'Je confirme l’enregistrement de cette décision' }).check();
    await d.getByRole('button', { name: 'Confirmer l’enregistrement' }).click();
    await expect(d).toHaveCount(0);
    await expect(ligne).toContainText('Acceptée');
    await expect(ligne).toContainText('jusqu’au 30/06/2027');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
