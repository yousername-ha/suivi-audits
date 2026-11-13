/* Refonte de présentation : mêmes identifiants, états, écritures et mesures sur des données fictives dédiées. */
import { expect, test } from '@playwright/test';
import { csrfOf, sessionAdmin, watchPage } from '../helpers';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const BASE = `/api/grc/${SOCLE}/pilotage/objectifs`;

test('Objectifs : conserver les rattachements, la planification, les mesures et les filtres dans les nouvelles vues', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1080 },
    reducedMotion: 'reduce',
  });
  const crees: string[] = [];
  try {
    const csrf = await csrfOf(ctx.request),
      suffixe = Date.now().toString(36);
    const post = async (path: string, data: unknown) => {
      const r = await ctx.request.post(`${BASE}/${path}`, { headers: { 'x-csrf-token': csrf }, data });
      expect(r.status(), await r.text()).toBe(200);
      const objet = await r.json();
      if (['processes', 'objectives', 'indicators'].includes(path))
        crees.push(`${BASE}/${path}/${objet.id}?confirm=SUPPRIMER`);
      return objet;
    };
    const processus = await post('processes', {
      name: `Processus graphique fictif ${suffixe}`,
      owner: 'Pilote fictif',
    });
    const objectif = await post('objectives', {
      name: `Objectif graphique fictif ${suffixe}`,
      owner: 'Responsable fictif',
      due: '2030-12-31',
      processes: [processus.id],
      enjeux: ['Enjeu fictif conservé'],
      plan: 'Plan initial',
      resources: 'Équipe fictive',
      evaluation: 'Relecture mensuelle fictive',
    });
    const indicateur = await post('indicators', {
      name: `Indicateur manuel fictif ${suffixe}`,
      obj: objectif.id,
      target: 0.9,
      dir: '≥',
      processes: [processus.id],
      owner: 'Pilote fictif',
      freq: 'Mensuelle',
      method: 'Calcul sur les relevés fictifs',
    });
    await post(`indicators/${indicateur.id}/values`, { date: '2026-01-01', value: '70 %', note: 'Mesure fictive' });
    const page = await ctx.newPage(),
      problems = watchPage(page);
    await page.goto('/pilotage/objectifs');
    await page.evaluate((socle) => sessionStorage.setItem('pilotage-scope', socle), SOCLE);
    await page.reload();
    const entree = page.getByRole('link', { name: /^Objectifs et indicateurs/ });
    await expect(entree).toHaveAttribute('href', '/pilotage/objectifs');
    await entree.click();
    await expect(page.getByRole('tab', { name: 'Vue compacte', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Objectifs, vue compacte', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Par objectif', exact: true }).click();
    const carte = page.getByRole('group', { name: `Objectif ${objectif.id}`, exact: true });
    await expect(
      carte.getByRole('button', { name: `Ouvrir l’indicateur ${indicateur.id}`, exact: true }),
    ).toBeVisible();
    await expect(carte.getByText('Non atteint', { exact: true })).toBeVisible();

    await carte.getByRole('button', { name: `Ouvrir l’objectif ${objectif.id}`, exact: true }).click();
    let fiche = page.getByRole('dialog', { name: `Objectif ${objectif.id}`, exact: true });
    await expect(fiche.getByLabel('Ressources nécessaires', { exact: true })).toHaveValue('Équipe fictive');
    await fiche.getByLabel('Ce qui sera fait', { exact: true }).fill('Plan mis à jour depuis la fiche');
    await fiche.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(fiche).toHaveCount(0);
    const etat = await (await ctx.request.get('/api/suivi/etat')).json();
    const relu = etat.objectives.find((o: { id: string }) => o.id === objectif.id);
    expect(relu).toMatchObject({
      plan: 'Plan mis à jour depuis la fiche',
      processes: [processus.id],
      enjeux: ['Enjeu fictif conservé'],
      resources: 'Équipe fictive',
      evaluation: 'Relecture mensuelle fictive',
    });

    await carte.getByRole('button', { name: `Ouvrir l’indicateur ${indicateur.id}`, exact: true }).click();
    fiche = page.getByRole('dialog', { name: `Indicateur ${indicateur.id}`, exact: true });
    await expect(fiche.getByLabel('Méthodes de surveillance et de mesure', { exact: true })).toHaveValue(
      'Calcul sur les relevés fictifs',
    );
    await fiche.getByLabel('Date de la mesure', { exact: true }).fill('2026-11-01');
    await fiche.getByLabel('Valeur', { exact: true }).fill('95 %');
    await fiche.getByLabel('Commentaire', { exact: true }).fill('Nouvelle mesure fictive');
    await fiche.getByRole('button', { name: 'Ajouter la mesure', exact: true }).click();
    await expect(
      fiche.getByRole('region', { name: `Mesures de l’indicateur ${indicateur.id}`, exact: true }),
    ).toContainText('95 %');
    await fiche.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(carte.getByText('Atteint', { exact: true })).toBeVisible();
    await expect(carte.getByRole('img', { name: 'Tendance : en hausse', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Par processus', exact: true }).click();
    await expect(page.getByRole('button', { name: `Ouvrir le processus ${processus.id}`, exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Boîtes de pilotage', exact: true }).click();
    await expect(page.getByLabel(`Boîte du processus ${processus.id}`, { exact: true })).toContainText(
      `Indicateur manuel fictif ${suffixe}`,
    );
    await page.getByRole('tab', { name: 'Vue compacte', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const compacte = page.getByRole('region', { name: 'Objectifs, vue compacte', exact: true });
    await expect(
      compacte.getByRole('button', { name: `Ouvrir l’indicateur ${indicateur.id}`, exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole('button', { name: 'Filtres', exact: true }).click();
    await page.getByRole('tab', { name: 'Non atteints', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Non atteints/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(
      compacte.getByRole('button', { name: `Ouvrir l’indicateur ${indicateur.id}`, exact: true }),
    ).toHaveCount(0);
    const apres = await (await ctx.request.get('/api/suivi/etat')).json();
    const mesure = apres.indicators.find((i: { id: string }) => i.id === indicateur.id);
    expect(mesure.target).toBe(0.9);
    expect(mesure.values).toEqual(
      expect.arrayContaining([expect.objectContaining({ v: 0.95, note: 'Nouvelle mesure fictive' })]),
    );
    expect(problems).toEqual([]);
  } finally {
    try {
      const csrf = await csrfOf(ctx.request);
      for (const url of crees.reverse()) {
        const r = await ctx.request.delete(url, { headers: { 'x-csrf-token': csrf } });
        expect(r.ok(), await r.text()).toBe(true);
      }
    } finally {
      await ctx.close();
    }
  }
});
