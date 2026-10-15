/* Applications à intégrer (GAP) et conformité IA reprises de l'outil de suivi : questionnaire guidé, fiche d'application,
   action du registre des écarts, registre des usages, évaluation et plan IA. Données fictives posées par l'API. */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const exigence = (id: string, ref: string, num: string) => ({
  id,
  ref,
  num,
  title: `Exigence fictive ${num}`,
  group: 'G',
  depth: 0,
  afnor: {},
  interne: {},
});

test('GAP guidé, fiche, action ; conformité IA : usage, scénario, plan', async ({ browser }) => {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36);
  try {
    const cur = await ctx.request.get('/api/legacy/state');
    const s = await cur.json();
    Object.assign(s, {
      items: [exigence('ISO-6.1.2', 'ISO', '6.1.2'), exigence('ISO-4.3', 'ISO', '4.3'), exigence('A-5.9', 'A', '5.9')],
      dda: {},
      findings: [],
      suppliers: [{ id: 'SUP01', name: 'Fournisseur fictif du GAP' }],
      appGaps: [],
      ai: {
        context: 'Contexte fictif de la conformité IA',
        start: '2026-01-01',
        startValidated: true,
        register: [],
        evals: [
          {
            id: 'E01',
            domain: 'Domaine fictif',
            scenario: 'Scénario fictif',
            app: 'Applicable',
            scope: 'Tous les usages externes',
            c: 3,
            i: 2,
            a: 1,
            audit: 0,
            patient: 4,
            prob: 3,
            maturity: 2,
            effort: 5,
            dscp: 'Oui',
            iso: 'A.5.9',
            hds: 'HDS 04',
            measure: 'Mesure fictive',
          },
        ],
        plan: [
          {
            id: 'AP-001',
            step: '1',
            phase: 'Phase fictive',
            action: 'Étape fictive du plan',
            result: 'Résultat',
            proof: 'Preuve',
            iso: '',
            hds: '',
            owner: 'Pilote',
            priority: 'P1',
            status: 'À faire',
            progress: 0,
            jStart: 0,
            jEnd: 30,
          },
        ],
        policies: [
          {
            policy: 'Politique fictive',
            impact: 'Impact',
            change: 'Changement',
            iso: '',
            annex: '',
            hds: '',
            owner: 'Pilote',
            target: '',
            status: 'À faire',
          },
        ],
      },
    });
    const put = await ctx.request.put('/api/legacy/state', {
      data: s,
      headers: { 'if-match': cur.headers().etag!, 'x-csrf-token': csrf },
    });
    expect(put.status()).toBe(204);

    // GAP guidé.
    await page.goto('/pilotage/gap-applications');
    await expect(page.getByText('Aucune application.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Nouveau GAP guidé' }).click();
    const guide = page.getByRole('dialog');
    await guide.getByRole('textbox', { name: 'Outil ou service' }).fill(`Service fictif ${suffixe}`);
    await guide
      .getByRole('group', { name: /Des données de santé à caractère personnel/ })
      .getByRole('button', { name: 'Non', exact: true })
      .click();
    await guide
      .getByRole('group', { name: 'Authentification multifacteur (MFA)' })
      .getByRole('button', { name: 'Disponible, non activée' })
      .click();
    await guide.getByRole('button', { name: 'Générer le GAP' }).click();

    // Fiche de l'application : point partiel, action du registre des écarts.
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByText(/^APP\d{2} — Service fictif/)).toBeVisible();
    await expect(fiche.getByRole('textbox', { name: 'État du point G10' })).toHaveValue('Partiel');
    await fiche.getByRole('textbox', { name: 'Constat du point G03' }).fill('Constat fictif');
    await fiche.getByRole('textbox', { name: 'Constat du point G03' }).blur();
    await fiche.getByRole('textbox', { name: 'État du point G03' }).click();
    await page.getByRole('option', { name: 'Non conforme', exact: true }).click();
    await expect(fiche.getByText(/Plan d’action GAP-\d+/)).toBeVisible();
    await expect(fiche.getByText(/Action GAP-\d+/).first()).toBeVisible();
    // Un point ajouté après coup n'a pas encore d'action : on la crée.
    await fiche.getByRole('textbox', { name: 'Point de contrôle' }).fill('Point ajouté fictif');
    await fiche.getByRole('textbox', { name: 'Point de contrôle' }).blur();
    await fiche.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await fiche.getByRole('textbox', { name: 'État du point C1' }).click();
    await page.getByRole('option', { name: 'Non conforme', exact: true }).click();
    await fiche.getByRole('button', { name: 'Créer l’action dans le registre des écarts' }).click();
    await expect(fiche.getByRole('button', { name: 'Créer l’action dans le registre des écarts' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: new RegExp(`Service fictif ${suffixe}`) })).toBeVisible();

    // Conformité IA : registre.
    await page.goto('/pilotage/conformite-ia');
    await expect(page.getByText('Contexte fictif de la conformité IA')).toBeVisible();
    await page.getByRole('tab', { name: 'Usages de l’IA' }).click();
    await page.getByRole('button', { name: 'Ajouter un usage' }).click();
    const presence = page.getByRole('textbox', { name: /^IA présente — EXT-IA-/ }).first();
    await expect(presence).toHaveValue('À vérifier');
    await presence.click();
    await page.getByRole('option', { name: 'Oui', exact: true }).click();
    await expect(presence).toHaveValue('Oui');

    // Évaluation : la probabilité modifie l'indice (E01 : maturité 2, DSCP, probabilité 3 → 4).
    await page.getByRole('tab', { name: 'Évaluation des scénarios' }).click();
    await expect(page.getByText('Scénario fictif')).toBeVisible();
    await page.getByRole('textbox', { name: 'Probabilité — E01' }).click();
    await page.getByRole('option', { name: '5', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Probabilité — E01' })).toHaveValue('5');

    // Plan : une étape terminée passe à 100 %.
    await page.getByRole('tab', { name: 'Plan d’action' }).click();
    await page.getByRole('textbox', { name: 'Statut de l’étape 1' }).click();
    await page.getByRole('option', { name: 'Terminé', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Avancement de l’étape 1' })).toHaveValue('100 %');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
