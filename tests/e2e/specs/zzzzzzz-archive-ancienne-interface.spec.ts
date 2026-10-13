/* Archive visuelle de l'ancienne interface (« Outil de suivi (ancienne interface) ») : une capture par page encore servie
   sous /legacy, prises sur le jeu de données de test fictif. Outil de sauvegarde avant retrait, pas un test de la suite
   complète : il ne tourne que sur demande (E2E_ARCHIVE=1) et écrit dans E2E_CAPTURES_DIR. */
import { test } from '@playwright/test';
import { sessionAdmin } from '../helpers';

test.skip(!process.env.E2E_ARCHIVE, 'Archive visuelle à la demande (E2E_ARCHIVE=1).');
const DIR = process.env.E2E_CAPTURES_DIR || '/tmp/captures';
/** Mêmes pages que PAGES_HISTORIQUES (apps/web/src/pilotage-navigation.ts) : groupe, libellé, onglet, vue. */
const PAGES: [string, string, string, string?][] = [
  ['Gestion de l’audit', 'Pronostic', 'cibles'],
  ['Gestion de l’audit', 'Déroulé', 'orga', 'orgaView=deroule'],
  ['Gestion de l’audit', 'Planning', 'orga', 'orgaView=cal'],
  ['Gestion de l’audit', 'Participants', 'orga', 'orgaView=people'],
  ['Gestion de l’audit', 'Couverture du cycle', 'couverture'],
  ['Conformité', 'Clauses ISO 27001', 'conformite', 'confView=ISO'],
  ['Conformité', 'Annexe A (DdA)', 'conformite', 'confView=A'],
  ['Conformité', 'HDS (DdA)', 'conformite', 'confView=HDS'],
  ['Conformité', 'ReCyF et autres référentiels', 'conformite', 'confView=fw'],
  ['Fournisseurs', 'Fournisseurs et applications', 'fournisseurs', 'supView=list'],
  ['Fournisseurs', 'Revues des accès', 'fournisseurs', 'supView=ar'],
  ['Fournisseurs', 'Évaluations sécurité', 'supeval'],
  ['Plans', 'Calendrier', 'plans', 'planView=cal'],
  ['Plans', 'Planning annuel', 'plans', 'planView=gantt'],
  ['Plans', 'Formation', 'plans', 'planView=formation'],
  ['Plans', 'Sensibilisation', 'plans', 'planView=sensi'],
  ['GAP et IA', 'Applications à intégrer', 'gapapp'],
  ['GAP et IA', 'Usages de l’IA', 'ia', 'iaView=reg'],
  ['Autres modules', 'Gestion CRRC', 'crrc', 'crrcView=over'],
  ['Autres modules', 'Investissements', 'invest', 'invView=dash'],
  ['Autres modules', 'Incidents', 'incidents', 'incView=reg'],
  ['Autres modules', 'Cellule de crise', 'crise', 'crView=cell'],
  ['Autres modules', 'Rapports et exports', 'rapports', 'repView=exp'],
  ['Pilotage', 'Pilotage (processus, objectifs, indicateurs)', 'pilotage', 'pilView=proc'],
];
const nom = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

test('archive : une capture par page de l’ancienne interface', async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext({
    storageState: (await sessionAdmin(browser)).state,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  try {
    let n = 0;
    for (const [groupe, libelle, onglet, vue] of PAGES) {
      n++;
      await page.goto('about:blank');
      await page.goto(`/legacy/#ouvrir=${onglet}${vue ? '&' + vue : ''}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `${DIR}/${String(n).padStart(2, '0')}-${nom(groupe)}--${nom(libelle)}.png`,
        fullPage: true,
      });
    }
  } finally {
    await ctx.close();
  }
});
