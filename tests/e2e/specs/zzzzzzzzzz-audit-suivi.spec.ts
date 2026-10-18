/* Gestion de l'audit reprise de l'outil de suivi : carte du prochain audit, préparation, cycle, couverture, organisation
   (participants, jours, créneaux, planning). L'état d'audit fictif est posé par l'API. Données fictives. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage, ecrireEtat } from '../helpers';

const exigence = (id: string, ref: string, num: string) => ({
  id,
  ref,
  num,
  title: `Exigence fictive ${num}`,
  group: ref === 'A' ? 'A-5' : ref === 'HDS' ? 'HDS' : 'ISO-4',
  depth: 0,
  afnor: {},
  interne: {},
});

test('Gestion de l’audit : carte, préparation, cycle, couverture et organisation', async ({ browser }) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36);
  try {
    // État d'audit fictif.
    const cur = await ctx.request.get('/api/suivi/etat');
    const s = await cur.json();
    Object.assign(s, {
      years: [2025, 2026],
      yearLabels: { '2025': 'Surveillance fictive' },
      nextYear: 2026,
      groups: [{ id: 'A-5', ref: 'A', num: '5', title: 'Organisationnelles' }],
      items: [
        exigence('A-5.1', 'A', '5.1'),
        exigence('A-5.2', 'A', '5.2'),
        exigence('ISO-4.1', 'ISO', '4.1'),
        exigence('HDS-01', 'HDS', '01'),
      ],
      findings: [
        {
          id: 'F01',
          source: 'AFNOR',
          year: 2025,
          type: 'NC min',
          status: 'Ouvert',
          text: 'Écart fictif',
          items: ['A-5.1'],
        },
      ],
    });
    delete s.plan;
    await ecrireEtat(ctx.request, csrf, s);

    // Carte du prochain audit : une case, sa fiche, la préparation.
    await page.goto('/pilotage/audit-pronostic');
    await expect(page.getByText('Carte du prochain audit', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /^A\.5\.1 Exigence fictive 5\.1/ }).click();
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByText(/Score \d+/)).toBeVisible();
    await fiche.getByRole('button', { name: 'Prête' }).click();
    await expect(fiche.getByRole('button', { name: 'Prête' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');

    // Cycle : une année ajoutée.
    await page.getByRole('button', { name: 'Cycle d’audit' }).click();
    const cycle = page.getByRole('dialog');
    await cycle.getByRole('button', { name: 'Ajouter 2027' }).click();
    await cycle.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await (await ctx.request.get('/api/audit-suivi')).json()).years).toEqual([2025, 2026, 2027]);

    // Couverture du cycle : une pastille passe de non auditée à prévue.
    await page.goto('/pilotage/audit-couverture');
    const marque = page.getByRole('button', { name: 'A.5.1, AFNOR 2026 : non auditée' });
    await marque.click();
    await expect(page.getByRole('button', { name: 'A.5.1, AFNOR 2026 : prévue' })).toBeVisible();

    // Organisation : une personne, un jour, un créneau, le planning.
    await page.goto('/pilotage/audit-participants');
    await page.getByRole('button', { name: 'Ajouter une personne' }).click();
    const nom = page.getByRole('textbox', { name: 'Nom', exact: true }).first();
    await expect(nom).toHaveValue('Nouvelle personne');
    await nom.fill(`Personne fictive ${suffixe}`);
    await nom.blur();
    await page.goto('/pilotage/audit-deroule');
    await page.getByRole('button', { name: 'Ajouter un jour' }).click();
    await expect(page.getByText('Jour 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter un créneau' }).first().click();
    const creneau = page.getByRole('dialog');
    await creneau.getByRole('textbox', { name: 'Thème du créneau' }).fill(`Entretien fictif ${suffixe}`);
    await creneau.getByRole('button', { name: new RegExp(`Personne fictive ${suffixe}`) }).click();
    await creneau.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(creneau.getByText('Créneau enregistré.')).toBeVisible();
    await creneau.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByText(`Entretien fictif ${suffixe}`).first()).toBeVisible();
    await page.goto('/pilotage/audit-planning');
    await expect(
      page
        .getByRole('group', { name: 'Planning de l’audit' })
        .getByRole('button', { name: new RegExp(`Entretien fictif ${suffixe}`) }),
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/audit-planning.png', fullPage: true });
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
