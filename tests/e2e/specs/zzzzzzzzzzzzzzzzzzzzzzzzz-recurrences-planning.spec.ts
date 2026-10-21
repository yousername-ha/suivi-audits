/* Récurrences : fenêtre de réalisation (ouverte, à venir), enchaînement sur l'occurrence suivante et import d'un calendrier
   iCalendar dans les jours exclus (aperçu, refus d'un fichier incorrect, import). Données fictives. */
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
const jour = (decalage: number) => new Date(Date.now() + decalage * 86_400_000).toISOString().slice(0, 10);
const recurrence = (extra: Record<string, unknown>) => ({
  start: jour(-3),
  time: '09:00',
  timezone: 'Europe/Paris',
  unit: 'week',
  interval: 1,
  until: null,
  count: 2,
  reminderDays: 7,
  active: true,
  ...extra,
});
const serie = (name: string, extra: Record<string, unknown>) => ({
  kind: 'task_series',
  name,
  data: {
    description: 'Contrôle périodique de recette',
    ownerId: null,
    category: 'action',
    priority: 'normal',
    refs: [],
    recurrence: recurrence(extra),
  },
});

test('Récurrences : fenêtre de réalisation, enchaînement et calendrier iCalendar', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ storageState: (await sessionAdmin(browser)).state, ignoreHTTPSErrors: true });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  const suffixe = Date.now().toString(36),
    perimetre = `Périmètre planning ${suffixe}`,
    titre = `Contrôle à fenêtre ${suffixe}`,
    titreCalendrier = `Série calendrier ${suffixe}`;
  try {
    await page.goto('/pilotage/recurrences');
    const p = await post(page, '/api/grc/smsis', {
      name: perimetre,
      nature: 'SMSI',
      scope: 'Fixture de recette',
      timezone: 'Europe/Paris',
      parentId: null,
      entityKind: 'perimetre',
      inheritFrameworks: false,
    });
    // Deux occurrences : celle d'il y a trois jours (fenêtre ouverte jusqu'à dix jours après) et celle de dans quatre jours
    // (la fenêtre n'ouvre que deux jours avant).
    const s = await post(page, `/api/grc/${p.id}/objects`, serie(titre, { window: { openDays: 2, closeDays: 10 } }));
    const calendrier = await post(
      page,
      `/api/grc/${p.id}/objects`,
      serie(titreCalendrier, { start: '2030-01-07', count: 5, reminderDays: 0 }),
    );
    await expect
      .poll(async () => (await (await page.request.get(`/api/grc/${p.id}/series/${s.id}/occurrences`)).json()).length, {
        timeout: 150_000,
        intervals: [5_000],
      })
      .toBe(2);

    await page.reload();
    await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
    await page.getByRole('option', { name: perimetre, exact: true }).click();
    await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
    await page.getByRole('option', { name: 'Liste', exact: true }).click();

    const ligne = (decalage: number) =>
      page
        .getByRole('row', {
          name: new RegExp(new Date(Date.now() + decalage * 86_400_000).toLocaleDateString('fr-FR')),
        })
        .getByRole('button', { name: titre, exact: true });
    // Occurrence à venir : la fenêtre n'est pas ouverte, le bouton est désactivé et dit pourquoi (le serveur refuserait aussi).
    await ligne(4).click();
    let fiche = page.getByRole('dialog');
    let panneau = fiche.getByRole('group', { name: 'Validation de l’occurrence' });
    await expect(panneau.getByText(/Fenêtre de réalisation : ouvre le/)).toBeVisible();
    await expect(panneau.getByRole('button', { name: 'Enregistrer la validation' })).toBeDisabled();
    await expect(panneau.getByRole('status')).toContainText('fenêtre de réalisation n’est pas ouverte');
    await page.keyboard.press('Escape');

    // Occurrence dans la fenêtre : validation OK, puis enchaînement (aucune autre n'est encore ouverte).
    await ligne(-3).click();
    fiche = page.getByRole('dialog');
    panneau = fiche.getByRole('group', { name: 'Validation de l’occurrence' });
    await expect(panneau.getByText(/Fenêtre de réalisation : ouverte jusqu’au/)).toBeVisible();
    await panneau.getByRole('button', { name: 'Enregistrer la validation' }).click();
    await expect(panneau.getByText('Validée', { exact: true })).toBeVisible();
    await panneau.getByRole('button', { name: 'Occurrence suivante' }).click();
    await expect(page.getByText('Aucune autre occurrence à traiter pour le moment.')).toBeVisible();
    await page.keyboard.press('Escape');

    // Calendrier iCalendar : fichier incorrect refusé en aperçu, puis fichier valide importé.
    await page
      .locator('.mantine-Card-root')
      .filter({ hasText: titreCalendrier })
      .getByRole('button', { name: 'Ouvrir la fiche' })
      .click();
    fiche = page.getByRole('dialog');
    const planning = fiche.getByRole('group', { name: 'Planning de la série' });
    const zone = planning.getByRole('textbox', { name: 'Ou collez le contenu du calendrier' });
    await zone.fill('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20300231\nEND:VEVENT\nEND:VCALENDAR');
    await planning.getByRole('button', { name: 'Prévisualiser l’import' }).click();
    const apercu = planning.getByRole('region', { name: 'Aperçu de l’import' });
    await expect(apercu.getByRole('alert')).toContainText('rien ne sera importé');
    await expect(planning.getByRole('button', { name: 'Importer ces jours' })).toBeDisabled();
    await zone.fill(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'DTSTART;VALUE=DATE:20300101',
        'SUMMARY:Jour de l’an',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'DTSTART;VALUE=DATE:20300508',
        'SUMMARY:Victoire',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\n'),
    );
    await planning.getByRole('button', { name: 'Prévisualiser l’import' }).click();
    await expect(apercu).toContainText('2 nouveau(x) jour(s) à ajouter');
    await planning.getByRole('button', { name: 'Importer ces jours' }).click();
    await expect
      .poll(async () => {
        const r = await page.request.get(`/api/grc/${p.id}/objects/${calendrier.id}`);
        return (await r.json()).data.recurrence.excludedDays;
      })
      .toEqual(['2030-01-01', '2030-05-08']);
    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
