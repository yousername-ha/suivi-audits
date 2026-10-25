/* Couche visuelle EBIOS RM (décision 5) : chemins stratégiques avec flux animé sur le chemin choisi seulement, pause et
   mouvement réduit, pictogrammes indicatifs, suivi / matrice / cercle à sélection commune. Périmètre privé de recette,
   données fictives créées par l'API. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

async function appel(page: Page, path: string, data: unknown) {
  const r = await page.request.fetch(path, {
    method: 'POST',
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': await csrfOf(page.request) },
    data,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

async function jeu(page: Page) {
  await page.goto('/pilotage');
  const s = await appel(page, '/api/grc/smsis', {
    name: 'QA-Ebios-visuel-' + Date.now(),
    scope: 'Fixture privée de recette',
    timezone: 'Europe/Paris',
  });
  const obj = async (kind: string, name: string, data: Record<string, unknown>) =>
    (await appel(page, `/api/grc/${s.id}/objects`, { kind, name, data })).id as string;
  const etude = await obj('risk_study', 'Étude visuelle fictive', { objective: 'Service fictif' });
  const e = { studyRef: 'object:' + etude };
  const source = await obj('risk_source', 'Groupe criminel fictif', { ...e, category: 'Criminel organisé' });
  const feu = await obj('risk_source', 'Incendie fictif', { ...e, category: 'Incendie / accident' });
  const couple = await obj('sr_ov', 'Couple criminel', { ...e, sourceRef: 'object:' + source });
  await obj('sr_ov', 'Couple incendie', { ...e, sourceRef: 'object:' + feu });
  const partie = await obj('ecosystem_party', 'Prestataire fictif', e);
  const evenement = await obj('feared_event', 'Indisponibilité fictive', e);
  const fuite = await obj('feared_event', 'Fuite fictive', e);
  const st1 = await obj('strategic_scenario', 'Rançongiciel fictif', {
    ...e,
    srOvRef: 'object:' + couple,
    partyRefs: ['object:' + partie],
    fearedEventRefs: ['object:' + evenement, 'object:' + fuite],
    gravity: 4,
  });
  await obj('strategic_scenario', 'Intrusion fictive', {
    ...e,
    srOvRef: 'object:' + couple,
    fearedEventRefs: ['object:' + fuite],
    gravity: 3,
  });
  await obj('operational_scenario', 'Chiffrement fictif', {
    ...e,
    strategicScenarioRef: 'object:' + st1,
    likelihood: 3,
  });
  await obj('operational_scenario', 'Sans rang fictif', { ...e, strategicScenarioRef: 'object:' + st1 });
  return s as { id: string; name: string };
}

async function sansViolation(page: Page, zone: string) {
  const r = await new AxeBuilder({ page })
    .include(zone)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(r.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
}

async function ouvrirEtude(page: Page, nom: string) {
  await page.goto('/pilotage/etudes');
  await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
  await page.getByRole('option', { name: nom, exact: true }).click();
  await page.getByRole('button', { name: 'Ouvrir l’étude' }).click();
}

test('EBIOS visuel : chemins, flux sur le chemin choisi seulement, pause et pictogrammes indicatifs', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const s = await jeu(page);
    await ouvrirEtude(page, s.name);
    // Atelier 2 : pictogramme indicatif écrit à côté de chaque source, sans reclasser.
    await page.getByRole('tab', { name: /2\. / }).click();
    await expect(page.getByText('pictogramme indicatif : Criminel, voleur')).toBeVisible();
    await expect(page.getByText('pictogramme indicatif : Accident, incendie, panne')).toBeVisible();

    await page.getByRole('tab', { name: 'Chemins', exact: true }).click();
    const zone = page.locator('.ebios-chemins');
    await expect(page.locator('.ebios-flux')).toHaveCount(0);
    await expect(page.locator('.ebios-lien--choisi')).toHaveCount(0);
    await expect(page.locator('.ebios-lien').first()).toBeAttached();

    await page.getByRole('button', { name: 'Rançongiciel fictif', exact: true }).click();
    await expect(page.getByTestId('chemin-detail')).toContainText('Partie prenante : Prestataire fictif');
    await expect(page.getByTestId('chemin-detail')).toContainText('Gravité du scénario : G4 — Critique');
    await expect(page.locator('.ebios-flux').first()).toBeAttached();
    await expect(zone).toHaveAttribute('data-anime', 'oui');
    // Les autres chemins restent tracés (liens non choisis encore présents).
    expect(await page.locator('.ebios-lien:not(.ebios-lien--choisi)').count()).toBeGreaterThan(0);
    await expect(page.getByText('Chemins alternatifs')).toBeVisible();
    await sansViolation(page, '.ebios-chemins');

    await page.getByRole('button', { name: 'Mettre en pause' }).click();
    await expect(zone).toHaveAttribute('data-anime', 'non');
    await expect(page.locator('.ebios-lien--choisi').first()).toBeAttached();
    await page.getByRole('button', { name: 'Reprendre le mouvement' }).click();
    await expect(zone).toHaveAttribute('data-anime', 'oui');

    await page.getByRole('button', { name: 'Voir tous les chemins' }).click();
    await expect(page.locator('.ebios-flux')).toHaveCount(0);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('EBIOS visuel : mouvement réduit du système, aucun flux animé', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const s = await jeu(page);
    await ouvrirEtude(page, s.name);
    await page.getByRole('tab', { name: 'Chemins', exact: true }).click();
    await page.getByRole('button', { name: 'Rançongiciel fictif', exact: true }).click();
    await expect(page.locator('.ebios-lien--choisi').first()).toBeAttached();
    await expect(page.locator('.ebios-chemins')).toHaveAttribute('data-anime', 'non');
    // Le choix « Animées » force l'effet malgré le réglage du système, comme dans le parcours guidé.
    await page.getByRole('combobox', { name: 'Animations' }).click();
    await page.getByRole('option', { name: 'Animées', exact: true }).click();
    await expect(page.locator('.ebios-chemins')).toHaveAttribute('data-anime', 'oui');
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('EBIOS visuel : suivi, matrice et cercle partagent la sélection et les filtres', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    const s = await jeu(page);
    await ouvrirEtude(page, s.name);
    await page.getByRole('tab', { name: 'Suivi, matrice et cercle' }).click();
    const synthese = page.getByTestId('synthese-ebios');
    await expect(synthese).toContainText('G4 — Critique');
    await expect(page.getByTestId('non-places')).toContainText('Sans rang fictif');

    // Sélection depuis la liste : la matrice et le cercle la reflètent.
    await synthese.getByRole('button', { name: 'Chiffrement fictif', exact: true }).first().click();
    await expect(synthese.getByRole('button', { name: /Scénario \d : Chiffrement fictif/ })).toHaveCount(2);
    for (const b of await synthese.getByRole('button', { name: /Scénario \d : Chiffrement fictif/ }).all())
      await expect(b).toHaveAttribute('aria-pressed', 'true');
    await expect(synthese.locator('.ebios-ligne--choisie')).toHaveCount(1);
    await sansViolation(page, '[data-testid="synthese-ebios"]');

    // Filtre commun : seul le scénario de gravité 4 et vraisemblance 3 reste affiché, les autres s'estompent.
    await synthese.getByRole('combobox', { name: 'Vraisemblance' }).click();
    await page.getByRole('option', { name: 'V3 — Très vraisemblable', exact: true }).click();
    await expect(synthese.getByRole('status')).toContainText('1 scénario(s) affiché(s) sur 2');
    await expect(synthese.locator('.ebios-point--masque')).toHaveCount(1);
    await synthese.getByRole('button', { name: 'Effacer les filtres' }).click();
    await expect(synthese.getByRole('status')).toContainText('2 scénario(s) affiché(s) sur 2');

    // Navigation vers le chemin puis retour à la synthèse.
    await synthese.getByRole('button', { name: 'Voir son chemin' }).click();
    await expect(page.getByTestId('chemin-detail')).toContainText('Rançongiciel fictif');
    await page.getByRole('button', { name: 'Voir dans la synthèse' }).first().click();
    await expect(page.getByTestId('synthese-ebios')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
