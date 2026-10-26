/* Kit d'intégration IA (ADR 0055) : chargement de fichiers depuis l'interface, aperçu sans écriture, import confirmé,
   rejeu à l'identique sans effet, annexes de veille « à revérifier ». Données fictives créées par ce test (le kit réel ne
   figure jamais dans le dépôt). */
import { expect, test } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

const controle = (n: number, portees: string[]) => ({
  id: `IA-${String(n).padStart(3, '0')}`,
  domain: '01 Gouvernance',
  title_fr: `Contrôle fictif ${n}`,
  requirement_fr: 'Le service décrit son usage de l’IA et en désigne un responsable.',
  eligible_scopes: portees,
  is_official_normative_text: false,
});
const version = 'fictif-' + Date.now(); // un rejeu du test sur la même pile reste possible
const fichiers = [
  { name: 'version.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version })) },
  {
    name: 'controles.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([controle(1, ['external', 'business']), controle(2, ['external'])])),
  },
  {
    name: 'deltas.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        {
          delta_id: 'D-1',
          draft_ref: 'Projet fictif',
          theme_fr: 'Thème fictif',
          proposed_change_fr: 'Évolution préparatoire fictive',
          import_as_enforceable_HDS_2_1_control: false,
        },
      ]),
    ),
  },
  {
    name: 'sources.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([{ title: 'Source fictive', url: 'https://example.invalid/source' }])),
  },
];

test('Kit IA : aperçu, import confirmé, rejeu sans effet, veille à revérifier', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage/bibliotheque');
    const carte = page.getByTestId('kit-ia');
    await carte.getByRole('button', { name: /^Importer (le kit IA|une nouvelle édition du kit)$/ }).click();
    const dialogue = page.getByRole('dialog', { name: 'Importer le kit d’intégration IA' });
    await dialogue.locator('input[type=file]').setInputFiles(fichiers);
    const apercu = dialogue.getByTestId('apercu-kit');
    await expect(apercu).toContainText('2 contrôle(s) en 1 domaine(s)');
    await expect(apercu).toContainText('1 pour l’IA externe');
    await expect(apercu).toContainText('Contrôles internes proposés');
    // Rien n'est écrit tant que le motif et la confirmation manquent.
    const importer = dialogue.getByRole('button', { name: 'Importer', exact: true });
    await expect(importer).toBeDisabled();
    await dialogue.getByLabel('Motif de l’import').fill('Import du kit fictif de recette');
    await dialogue.getByLabel('Confirmation').fill('IMPORTER');
    await importer.click();
    await expect(dialogue).toContainText('Kit importé');
    await dialogue.getByRole('button', { name: 'Fermer', exact: true }).click();

    await expect(carte).toContainText('importé par');
    await expect(page.getByRole('region', { name: /Référentiels de la bibliothèque/ })).toContainText(
      'Contrôles IA internes',
    );

    // Rejeu à l'identique : l'aperçu l'annonce et l'import reste fermé.
    await carte.getByRole('button', { name: 'Importer une nouvelle édition du kit' }).click();
    const rejeu = page.getByRole('dialog', { name: 'Importer le kit d’intégration IA' });
    await rejeu.locator('input[type=file]').setInputFiles(fichiers);
    await expect(rejeu).toContainText('déjà importé à l’identique');
    await expect(rejeu.getByRole('button', { name: 'Importer', exact: true })).toBeDisabled();
    await rejeu.getByRole('button', { name: 'Fermer', exact: true }).click();

    // Veille : delta préparatoire et source portent « à revérifier ».
    await carte.getByRole('button', { name: 'Veille et annexes du kit' }).click();
    const veille = page.getByRole('dialog', { name: 'Veille et annexes du kit IA' });
    await expect(veille).toContainText('Préparatoire — à revérifier');
    await expect(veille).toContainText('Source fictive');
    await expect(veille.getByText('à revérifier', { exact: true }).first()).toBeVisible();
    await veille.getByRole('button', { name: 'Fermer', exact: true }).click();

    // La page « Conformité IA » est retirée (ADR 0057) : plus de menu ni d'adresse.
    await page.goto('/pilotage/conformite-ia');
    await expect(page.getByText('Rubrique introuvable')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
