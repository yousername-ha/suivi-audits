/* Notifications métier (décision 012-10, ADR 0058) : réglage par groupe, aperçu des destinataires, et le réglage personnel qui
   l'emporte (Mon compte). Données fictives ; l'état initial est rétabli. Non rejouée en local pendant le chantier : la pile
   Docker était occupée, cette spec est à lancer par ./tests/e2e/run-in-container.sh. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

const TYPE = 'Échéance d’une action';
const COURRIEL = `${TYPE} : Par courriel`;

async function choisir(page: Page, zone: ReturnType<Page['locator']>, nom: string, option: string) {
  await zone.getByRole('combobox', { name: nom, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('Notifications : groupe coché, retrait dans le profil, aperçu des destinataires', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 1000 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    groupe = `Équipe notifications ${suffixe}`;
  let groupeId = '';
  try {
    await page.goto('/plateforme');
    const entetes = async () => ({ Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) });
    const moi = (await (await page.request.get('/api/auth/me')).json()).user.id as string;
    const cree = await page.request.post('/api/admin/groups', {
      headers: await entetes(),
      data: { name: groupe, description: 'Recette des notifications', roles: [], members: [moi] },
    });
    expect(cree.ok(), await cree.text()).toBe(true);
    groupeId = (await cree.json()).id;

    // 1. Le groupe reçoit les échéances par courriel.
    await page.getByRole('link', { name: /^Destinataires des notifications/ }).click();
    const fenetre = page.getByRole('dialog', { name: 'Destinataires des notifications' });
    await expect(fenetre).toBeVisible();
    await expect(fenetre.getByText(/Courriel (non configuré, rien n’est envoyé|configuré)/).first()).toBeVisible();
    await choisir(page, fenetre, 'Groupe ou rôle', groupe + ' (1 compte actif)');
    const matrice = fenetre.getByRole('region', { name: 'Réglages de notification de la portée choisie' });
    await choisir(page, matrice, COURRIEL, 'Activé');
    await matrice.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Réglages de notification enregistrés.')).toBeVisible();

    // 2. L'aperçu liste le compte avec son origine : le groupe.
    const apercu = fenetre.getByRole('region', { name: 'Destinataires résolus' });
    await expect(apercu).toContainText(`groupe « ${groupe} »`);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');

    // 3. Dans Mon compte, la personne retire le courriel : son réglage personnel l'emporte.
    await page.goto('/account');
    const carte = page.getByRole('region', { name: 'Mes réglages de notification' });
    await choisir(page, carte, COURRIEL, 'Désactivé');
    await carte.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Réglages de notification enregistrés.').first()).toBeVisible();
    await expect(carte).toContainText('Résultat : désactivé');
    await expect(carte).toContainText('votre réglage personnel');

    // 4. L'aperçu l'indique en toutes lettres : exclu par son réglage personnel.
    await page.goto('/plateforme/notifications-destinataires');
    const fenetre2 = page.getByRole('dialog', { name: 'Destinataires des notifications' });
    await expect(fenetre2.getByRole('region', { name: 'Destinataires résolus' })).toContainText(
      'Exclu par son réglage personnel',
    );
  } finally {
    // Retour à l'état initial : réglage personnel retiré, groupe supprimé (ses réglages partent avec lui).
    try {
      await page.goto('/account');
      const carte = page.getByRole('region', { name: 'Mes réglages de notification' });
      if (
        (await carte.count()) &&
        (await carte.getByRole('combobox', { name: COURRIEL, exact: true }).inputValue()) === 'Désactivé'
      ) {
        await choisir(page, carte, COURRIEL, 'Non défini (hérite)');
        await carte.getByRole('button', { name: 'Enregistrer' }).click();
        await expect(page.getByText('Réglages de notification enregistrés.').first()).toBeVisible();
      }
      if (groupeId)
        await page.request.delete(`/api/admin/groups/${groupeId}`, {
          headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
        });
    } finally {
      await ctx.close();
    }
  }
  expect(problems).toEqual([]);
});
