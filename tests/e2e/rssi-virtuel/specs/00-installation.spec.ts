/* Étape 0 du scénario du RSSI virtuel : installation d'une pile vierge par le RSSI (poivre et clé de secours au coffre,
   jeton, compte administrateur, nom de l'organisation, TOTP). La session ouverte est partagée par les fichiers suivants. */
import { expect, test } from '@playwright/test';
import { enregistrerSessionAdmin, markTotpUsed, PASSWORD, saveAdmin, setupToken, totp, watchPage } from '../../helpers';
import donnees from '../donnees';

/** Boutons nommés en anglais vus sur l'écran d'installation (constat RSSI-03), relevés par le premier test. */
let boutonsEnAnglais = -1;

test('le RSSI installe l’application sur une pile vierge', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const problemes = watchPage(page);
  const etat = await (await ctx.request.get('/api/setup')).json();
  // Garde-fou : le harnais ne s'exécute que sur une installation neuve (règle 1 de l'agent).
  expect(etat, 'le harnais du RSSI virtuel exige une pile vierge').toMatchObject({ needed: true, adminExists: false });

  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole('heading', { name: 'Poivre des mots de passe' })).toBeVisible();
  const poivre = (await page.getByTestId('poivre-genere').textContent())!.trim();
  await page.getByLabel('Les 8 derniers caractères du poivre').fill(poivre.replace(/-/g, '').slice(-8));
  await page.getByLabel('J’ai enregistré ce poivre dans le coffre-fort de l’organisation').check();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByRole('heading', { name: 'Clé de secours des sauvegardes' })).toBeVisible();
  await page.getByRole('button', { name: 'Générer la clé de secours' }).click();
  const privee = (await page.getByTestId('cle-secours-privee').textContent())!.trim();
  await page.getByLabel('J’ai rangé la clé privée de secours dans le coffre-fort de l’organisation').check();
  await page.getByLabel('Les 8 derniers caractères de la clé privée').fill(privee.slice(-8));
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByRole('heading', { name: 'Créer le compte administrateur' })).toBeVisible();
  boutonsEnAnglais = await page.getByRole('button', { name: 'Toggle password visibility' }).count();
  await page.getByRole('textbox', { name: 'Jeton d’installation' }).fill(setupToken());
  await page.getByRole('textbox', { name: 'Nom de l’organisation' }).fill(donnees.organisation.nom);
  await page.getByRole('textbox', { name: 'Identifiant', exact: true }).fill('rssi');
  await page.getByRole('textbox', { name: 'Nom affiché' }).fill('Responsable SSI (fictif)');
  await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(PASSWORD);
  await page.getByRole('textbox', { name: 'Confirmation', exact: true }).fill(PASSWORD);
  // Données de démonstration non chargées : le RSSI part d'un SMSI vide.
  await expect(page.getByRole('checkbox', { name: 'Charger des données de démonstration' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Créer le compte' }).click();

  await expect(page.getByRole('heading', { name: 'Activer la double authentification' })).toBeVisible();
  const secret = (await page.getByText(/^Saisie manuelle/).textContent())!
    .replace(/^Saisie manuelle\s*:\s*/, '')
    .replace(/\s/g, '');
  await page.getByLabel('Chiffre 1 sur 6').click();
  await page.keyboard.type(totp(secret));
  markTotpUsed(secret);
  await expect(page.getByRole('heading', { name: 'Ajouter une clé de sécurité (facultatif)' })).toBeVisible();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByRole('heading', { name: /^Bonjour Responsable SSI/ })).toBeVisible();
  await expect(page.getByText(`Tableau de bord — ${donnees.organisation.nom}`)).toBeVisible();
  saveAdmin('rssi', secret, poivre);
  await enregistrerSessionAdmin(ctx);

  await page.goto('/setup');
  await expect(page).not.toHaveURL(/\/setup$/);
  expect(problemes).toEqual([]);
  await ctx.close();
});

test('RSSI-03 ouvert : les boutons d’affichage du mot de passe sont nommés en anglais', () => {
  // Constat du RSSI virtuel du 11/11/2026 (accessibilité, interface en français) : sur l'écran d'installation, le lecteur
  // d'écran annonce « Toggle password visibility » pour les champs « Mot de passe » et « Confirmation ». Le test devient
  // rouge une fois corrigé : retirer alors le marqueur test.fail et clore le constat dans le rapport.
  test.fail(true, 'RSSI-03 ouvert : libellé anglais « Toggle password visibility »');
  expect(boutonsEnAnglais, 'le test d’installation doit avoir été exécuté').toBeGreaterThanOrEqual(0);
  expect(boutonsEnAnglais).toBe(0);
});
