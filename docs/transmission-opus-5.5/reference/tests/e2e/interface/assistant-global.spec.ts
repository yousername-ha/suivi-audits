/* Frontend réel compilé ; API interceptée. Aucune requête Mistral, base ou notification sortante. */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { assistantFixture } from './assistant-fixture';
const chat = (page: Page) => page.locator('#assistant-chat-view');
const inbox = (page: Page) => page.locator('#assistant-inbox-view');

test('discussion globale, brouillons séparés, contexte figé et retour du focus', async ({ page }) => {
  const f = await assistantFixture(page);
  const message = page.getByLabel('Votre message à l’assistant', { exact: true });
  await message.fill('Brouillon mise en œuvre');
  await page.getByRole('button', { name: 'Contexte de la page', exact: true }).click();
  await page.getByRole('combobox', { name: 'Profil de l’assistant' }).selectOption('audit_interne');
  await expect(message).toHaveValue('');
  await message.fill('Brouillon audit');
  await page.getByRole('combobox', { name: 'Profil de l’assistant' }).selectOption('mise_en_oeuvre');
  await expect(message).toHaveValue('Brouillon mise en œuvre');
  await page.getByRole('link', { name: 'Tableau de bord', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(message).toHaveValue('Brouillon mise en œuvre');
  await expect(page.locator('.as-attached')).toContainText('Fournisseurs');
  await expect(page.locator('.as-context-button')).toContainText('Tableau de bord');
  await message.press('Escape');
  await expect(page.locator('.as-dock')).toBeHidden();
  await expect(page.locator('.as-launcher')).toBeFocused();
  await page.locator('.as-launcher').click();
  await expect(message).toHaveValue('Brouillon mise en œuvre');
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
});

test('corps strict, CSRF et réponse dans le fil d’origine après changement de profil', async ({ page }) => {
  const f = await assistantFixture(page);
  f.state.delay = 200;
  await page.getByLabel('Votre message à l’assistant', { exact: true }).fill('Priorités avant revue');
  await page.getByRole('button', { name: 'Envoyer le message', exact: true }).click();
  await page.getByRole('combobox', { name: 'Profil de l’assistant' }).selectOption('audit_interne');
  await expect.poll(() => f.data.conversations[0].messages.length).toBe(3);
  await page.getByRole('combobox', { name: 'Profil de l’assistant' }).selectOption('mise_en_oeuvre');
  await expect(chat(page)).toContainText('Réponse de recette API fictive', { timeout: 10000 });
  const w = f.writes.find((w) => w.path.endsWith('/messages'))!;
  expect(w.body).toEqual({ texte: 'Priorités avant revue' });
  expect(w.csrf).toBe('apercu-ui-sans-session');
  await page.getByRole('combobox', { name: 'Profil de l’assistant' }).selectOption('audit_interne');
  await expect(chat(page)).not.toContainText('Réponse de recette');
  expect(f.errors).toEqual([]);
});

test('échec d’envoi conserve texte et contexte ; limites et pause des rondes', async ({ page }) => {
  const f = await assistantFixture(page, { pause: true });
  const message = page.getByLabel('Votre message à l’assistant', { exact: true });
  await expect(message).toBeEnabled();
  await message.fill('Ma question');
  f.state.fail = '/messages';
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.getByRole('alert')).toContainText('Indisponibilité simulée');
  await expect(message).toHaveValue('Ma question');
  await page.getByRole('button', { name: 'Contexte de la page', exact: true }).click();
  await message.fill('x'.repeat(3990));
  await expect(page.getByRole('button', { name: 'Envoyer le message' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retirer le contexte joint' }).click();
  await expect(page.getByRole('button', { name: 'Envoyer le message' })).toBeEnabled();
  await page.getByRole('tab', { name: /Pour vous/ }).click();
  await expect(page.locator('.as-availability')).toContainText('Le dialogue reste disponible');
  expect(f.errors).toEqual([]);
});

test('question et rappels personnels partagés entre les vues, échec conservant la réponse', async ({ page }) => {
  const f = await assistantFixture(page);
  await chat(page).getByRole('button', { name: 'Répondre à la question' }).click();
  const answer = chat(page).getByLabel('Votre réponse', { exact: true });
  await expect(answer).toBeFocused();
  await answer.fill('Revue effectuée, preuve à vérifier.');
  f.state.fail = '/reponse';
  await chat(page).getByRole('button', { name: 'Transmettre la réponse' }).click();
  await expect(page.getByRole('alert')).toContainText('Indisponibilité simulée');
  await expect(answer).toHaveValue('Revue effectuée, preuve à vérifier.');
  await chat(page).getByRole('button', { name: 'Transmettre la réponse' }).click();
  await expect(chat(page)).toContainText('prochaine ronde');
  await page.getByRole('tab', { name: /Pour vous/ }).click();
  await expect(inbox(page)).toContainText('Revue effectuée, preuve à vérifier.');
  await inbox(page).getByRole('button', { name: 'Marquer comme lu', exact: true }).click();
  await inbox(page).getByRole('button', { name: 'Peu utile', exact: true }).click();
  await expect(inbox(page).getByRole('button', { name: 'Peu utile' })).toHaveAttribute('aria-pressed', 'true');
  expect(f.data.notifications[0].reponse).toBe('Revue effectuée, preuve à vérifier.');
  expect(f.data.notifications[1].avis).toBe('inutile');
  expect(f.errors).toEqual([]);
});

test('proposition corrigée puis confirmée, constat conservé en brouillon et mission', async ({ page }) => {
  const f = await assistantFixture(page, { constat: true });
  await page.getByRole('tab', { name: /Pour vous/ }).click();
  await inbox(page).getByRole('button', { name: 'Examiner la proposition' }).first().click();
  await expect(page.getByRole('button', { name: 'Retour aux suivis' })).toBeFocused();
  await page.getByLabel('Titre de l’action', { exact: true }).fill('Revue prioritaire');
  await page.getByLabel('Note de décision', { exact: true }).fill('Validation après examen');
  f.state.fail = '/decision';
  await page.getByRole('button', { name: 'Confirmer l’action' }).click();
  await expect(page.getByRole('alert')).toContainText('Indisponibilité simulée');
  await expect(page.getByLabel('Titre de l’action')).toHaveValue('Revue prioritaire');
  await page.getByRole('button', { name: 'Confirmer l’action' }).click();
  await expect(inbox(page)).toContainText('Décision enregistrée');
  expect(f.data.propositions[0].titre).toBe('Revue prioritaire');
  await inbox(page).getByRole('button', { name: 'Examiner la proposition' }).click();
  await expect(page.locator('.as-side-view')).toContainText('brouillon');
  await expect(page.locator('.as-side-view')).toContainText('à apprécier par l’auditeur');
  await page.getByRole('button', { name: 'Créer le constat en brouillon' }).click();
  await expect(inbox(page)).toBeVisible();
  await inbox(page).getByRole('button', { name: 'Demander un suivi' }).click();
  await page.getByLabel('Votre consigne', { exact: true }).fill('Suivre la réception de la preuve');
  await page.getByRole('button', { name: 'Confier ce suivi' }).click();
  await expect(inbox(page)).toContainText('Suivre la réception de la preuve');
  expect(f.writes.find((w) => w.path.endsWith('/missions'))?.body).toEqual({
    profil: 'mise_en_oeuvre',
    consigne: 'Suivre la réception de la preuve',
  });
  expect(f.errors).toEqual([]);
});

test('lecture seule et destinataire sans droit assistant', async ({ page }) => {
  let f = await assistantFixture(page, { modify: false });
  await page.getByRole('tab', { name: /Pour vous/ }).click();
  await inbox(page).getByRole('button', { name: 'Examiner la proposition' }).click();
  await expect(page.getByRole('button', { name: 'Confirmer l’action' })).toBeDisabled();
  expect(f.writes).toEqual([]);
  await page.unrouteAll({ behavior: 'wait' });
  f = await assistantFixture(page, { read: false, modify: false });
  await inbox(page).getByRole('button', { name: 'Répondre à la question' }).click();
  await inbox(page).getByLabel('Votre réponse', { exact: true }).fill('Réponse de mon compte');
  await inbox(page).getByRole('button', { name: 'Transmettre la réponse' }).click();
  await expect(inbox(page)).toContainText('Réponse de mon compte');
  expect(f.calls.some((c) => c.includes('/api/assistant/'))).toBe(false);
  expect(f.errors).toEqual([]);
});

test('service absent : aucune discussion ou réponse locale de remplacement', async ({ page }) => {
  const f = await assistantFixture(page, { missing: true, empty: true });
  await expect(page.locator('.as-launcher')).toHaveCount(0);
  expect(f.writes).toEqual([]);
  expect(f.errors).toEqual([]);
});

test('sources, clavier, dimensions PC, mouvements et contraste des deux thèmes', async ({ page }) => {
  const f = await assistantFixture(page);
  await chat(page).getByRole('button', { name: 'Fiche documentaire' }).click();
  await expect(page.locator('.as-side-view')).toContainText('contenu du fichier n’est pas reproduit');
  await expect(page.locator('.as-side-view a')).toHaveAttribute('href', /\/pilotage\/synthese\?perimetre=/);
  await page.getByRole('button', { name: 'Retour à la discussion' }).press('Escape');
  await expect(page.getByRole('tab', { name: 'Discussion', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Discussion', exact: true }).press('ArrowRight');
  await expect(inbox(page)).toBeVisible();
  await page.getByRole('tab', { name: /Pour vous/ }).press('Home');
  await expect(chat(page)).toBeVisible();
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
    [1366, 768],
    [1440, 900],
    [1536, 864],
    [1920, 1080],
    [2560, 1440],
    [1920, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(70);
    const box = await page.locator('.as-dock').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    const scroll = await page
      .locator('.as-thread')
      .evaluate((e) => ({ w: e.clientWidth, sw: e.scrollWidth, h: e.clientHeight }));
    expect(scroll.sw).toBeLessThanOrEqual(scroll.w);
    expect(scroll.h).toBeGreaterThan(160);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => (document.documentElement.dataset.mantineColorScheme = t), theme);
    for (const view of ['Discussion', 'Pour vous']) {
      await page
        .getByRole('tab', { name: view === 'Discussion' ? 'Discussion' : /Pour vous/, exact: view === 'Discussion' })
        .click();
      const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(a.violations).toEqual([]);
    }
  }
  await expect(page.locator('.an-orbit').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.as-avatar').first()).toHaveCSS('filter', 'none');
  await expect(page.locator('.as-avatar image')).toHaveCount(0);
  const ids = await page.locator('.as-avatar svg [id]').evaluateAll((nodes) => nodes.map((n) => n.id));
  expect(ids.length).toBeGreaterThan(2);
  expect(new Set(ids).size).toBe(ids.length);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.as-global')).toHaveAttribute('data-assistant-motion', 'on');
  const orbit = page.locator('.as-head .an-orbit');
  await expect(orbit).toHaveCSS('animation-play-state', 'running');
  await page.getByRole('button', { name: 'Suspendre les animations', exact: true }).click();
  await expect(orbit).toHaveCSS('animation-play-state', 'paused');
  await page.getByRole('button', { name: 'Reprendre les animations', exact: true }).click();
  await expect(orbit).toHaveCSS('animation-play-state', 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(orbit).toHaveCSS('animation-name', 'none');
  expect(f.errors).toEqual([]);
});

test('historique du profil, nouvelle discussion et suppression confirmée', async ({ page }) => {
  const f = await assistantFixture(page);
  await page.getByRole('button', { name: 'Historique des discussions' }).click();
  await expect(page.locator('.as-history-row')).toHaveCount(1);
  await expect(page.locator('.as-side-view')).not.toContainText('Préparer un audit interne');
  await page.getByRole('button', { name: 'Nouvelle discussion', exact: true }).click();
  await expect.poll(() => f.data.conversations.length).toBe(3);
  await expect(page.getByLabel('Votre message à l’assistant', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Historique des discussions' }).click();
  await expect(page.locator('.as-history-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Supprimer la discussion', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText('ne pourra pas être retrouvée');
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(f.writes.some((w) => w.method === 'DELETE')).toBe(false);
  await page.getByRole('button', { name: 'Supprimer la discussion', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
  await expect(page.locator('.as-history-row')).toHaveCount(1);
  expect(f.writes.filter((w) => w.method === 'DELETE')).toHaveLength(1);
  expect(f.errors).toEqual([]);
});

test('l’adresse administration garde le brouillon et reste refusée sans droit', async ({ page }) => {
  const f = await assistantFixture(page);
  await page.getByLabel('Votre message à l’assistant', { exact: true }).fill('Brouillon transversal');
  await page.evaluate(() => {
    history.pushState(null, '', '/admin/users');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
  await expect(page.getByLabel('Votre message à l’assistant', { exact: true })).toHaveValue('Brouillon transversal');
  expect(f.errors).toEqual([]);
  await page.unrouteAll({ behavior: 'wait' });
  const reader = await assistantFixture(page, { noAdmin: true });
  const calls: string[] = [];
  await page.route('**/api/admin/**', (r) => {
    calls.push(r.request().url());
    return r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Accès refusé' }) });
  });
  await page.evaluate(() => {
    history.pushState(null, '', '/admin/users');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toHaveCount(0);
  expect(calls).toEqual([]);
  expect(reader.errors).toEqual([]);
});
