/* Timeline des actions (dossier 017) : intitulés fixes pendant le défilement horizontal, zone verticale bornée pour cent
   actions, état et retard dits en toutes lettres, légende, sans défilement horizontal de la page sur téléphone. */
import AxeBuilder from '@axe-core/playwright';
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
const JOUR = 86_400_000;
const action = (nom: string, debut: number, echeance: number, status = 'todo') => ({
  kind: 'action',
  name: nom,
  data: {
    description: 'Action de recette',
    status,
    ownerId: null,
    startAt: new Date(debut).toISOString(),
    dueAt: new Date(echeance).toISOString(),
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
});

for (const [nom, largeur, hauteur] of [
  ['ordinateur', 1366, 768],
  ['téléphone', 390, 844],
] as const) {
  test(`Timeline lisible (${nom}) : cent actions, intitulés fixes, retard en toutes lettres`, async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: (await sessionAdmin(browser)).state,
      ignoreHTTPSErrors: true,
      viewport: { width: largeur, height: hauteur },
      reducedMotion: 'reduce',
    });
    test.setTimeout(180_000);
    const page = await ctx.newPage(),
      problems = watchPage(page);
    const suffixe = Date.now().toString(36);
    try {
      await page.goto('/registres');
      const p = await post(page, '/api/grc/smsis', {
        name: `Périmètre frise ${nom} ${suffixe}`,
        nature: 'SMSI',
        scope: 'Fixture de recette',
        timezone: 'Europe/Paris',
        parentId: null,
        entityKind: 'perimetre',
        inheritFrameworks: false,
      });
      const maintenant = Date.now();
      // Cent actions créées par lots de dix : la création séquentielle dépasserait le délai du test.
      for (let lot = 0; lot < 10; lot++)
        await Promise.all(
          Array.from({ length: 10 }, (_, k) => {
            const i = lot * 10 + k;
            return post(
              page,
              `/api/grc/${p.id}/objects`,
              action(
                `Action ${String(i).padStart(3, '0')} ${suffixe}`,
                maintenant + (i - 60) * 3 * JOUR,
                maintenant + (i - 55) * 3 * JOUR,
                i % 4 === 0 ? 'progress' : 'todo',
              ),
            );
          }),
        );
      await page.reload();
      await page.getByRole('combobox', { name: 'Périmètre affiché', exact: true }).click();
      await page.getByRole('option', { name: `Périmètre frise ${nom} ${suffixe}`, exact: true }).click();
      await page.goto('/pilotage/actions');
      await page.getByRole('combobox', { name: 'Vue synchronisée' }).click();
      await page.getByRole('option', { name: 'Timeline', exact: true }).click();
      const frise = page.getByRole('region', { name: /Timeline des actions/ });
      await expect(frise).toBeVisible();
      // Le tableau n'affiche que les 50 premières ; on charge les suivantes pour atteindre cent actions.
      await page.getByRole('button', { name: /Charger les 50 actions suivantes/ }).click();

      // Zone verticale bornée : cent lignes ne font pas une page de plusieurs mètres.
      const mesures = await frise.evaluate((el) => ({ visible: el.clientHeight, total: el.scrollHeight }));
      expect(mesures.visible).toBeLessThanOrEqual(700);
      expect(mesures.total).toBeGreaterThan(mesures.visible);

      // Intitulés fixes : après un défilement horizontal, la colonne reste au bord gauche de la région.
      const decalage = async () =>
        frise.evaluate((el) => {
          const colonne = el.querySelector('.grc-timeline__etiquettes')!.getBoundingClientRect().left;
          return Math.round(colonne - el.getBoundingClientRect().left);
        });
      const avant = await decalage();
      await frise.evaluate((el) => el.scrollTo({ left: 400 }));
      expect(await frise.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
      expect(await decalage()).toBe(avant);

      // L'état et le retard sont dits en toutes lettres, pas seulement par la couleur.
      await expect(frise.getByText('! En retard').first()).toBeVisible();
      const enRetard = frise.getByRole('button', { name: /en retard/ }).first();
      await expect(enRetard).toBeVisible();
      await expect(page.getByRole('group', { name: /Légende/ })).toContainText('En retard');
      expect(await enRetard.getAttribute('aria-label')).toMatch(/à faire|en cours/i);

      // Aucun défilement horizontal de la page.
      const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(debordement).toBeLessThanOrEqual(0);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(
        axe.violations.map(
          (v) =>
            `${v.id} (${v.nodes.length}) : ` +
            v.nodes
              .slice(0, 3)
              .map((n) => `${n.target.join(' ')} ${JSON.stringify(n.any[0]?.data ?? {})}`)
              .join(' | '),
        ),
      ).toEqual([]);
      expect(problems).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}
