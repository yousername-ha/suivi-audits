/* Accessibilité automatique (ADR 0029, cas TEST-051) : axe-core (règles WCAG 2.0/2.1 A et AA) sur les écrans principaux,
   en clair et en sombre, sur téléphone et sur ordinateur. Toute violation nouvelle fait échouer le test ; les écarts déjà
   connus sont listés ci-dessous avec leur justification (aucune règle n'est désactivée en bloc). Ce contrôle automatique
   ne couvre qu'une partie des critères : il ne remplace ni l'essai au clavier et au lecteur d'écran, ni l'avis humain
   sur l'ergonomie (TEST-042). Exécuté après les parcours qui créent le compte et les données de recette. */
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser } from '@playwright/test';
import { sessionAdmin } from '../helpers';

/** Écarts connus : « règle@écran » → justification. Vide tant que l'on n'a rien à tolérer. */
const ECARTS_CONNUS: Record<string, string> = {};

const ECRANS = [
  ['tableau-de-bord', '/'],
  ['documents', '/documents'],
  ['cartographie', '/cartographie'],
  ['pilotage-synthese', '/pilotage/synthese'],
  ['pilotage-perimetres', '/pilotage/perimetres'],
  ['pilotage-bibliotheque', '/pilotage/bibliotheque'],
  ['pilotage-rapprochements', '/pilotage/rapprochements'],
  ['pilotage-couverture', '/pilotage/couverture'],
  ['pilotage-correspondances-bibliotheque', '/pilotage/correspondances-bibliotheque'],
  ['pilotage-fournisseurs', '/pilotage/fournisseurs'],
  ['pilotage-criteres-fournisseurs', '/pilotage/criteres-fournisseurs'],
  ['pilotage-fournisseurs-perimetre', '/pilotage/fournisseurs-perimetre'],
  ['pilotage-risques', '/pilotage/risques'],
  ['pilotage-applicabilite', '/pilotage/applicabilite'],
  ['pilotage-objectifs', '/pilotage/objectifs'],
  ['pilotage-audits', '/pilotage/audits'],
  ['pilotage-exercices', '/pilotage/exercices'],
  ['aide', '/aide'],
  ['parametres', '/parametres'],
  ['admin-plateforme', '/plateforme'],
  ['admin-systeme-cartes', '/systeme'],
  ['admin-utilisateurs', '/admin/users'],
  ['admin-systeme', '/admin/system'],
] as const;
const AFFICHAGES = [
  ['ordinateur-clair', 1366, 768, 'light'],
  ['ordinateur-sombre', 1366, 768, 'dark'],
  ['telephone-clair', 390, 844, 'light'],
  ['telephone-sombre', 390, 844, 'dark'],
] as const;
const REGLES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

interface Constat {
  affichage: string;
  ecran: string;
  regle: string;
  impact: string | null | undefined;
  aide: string;
  elements: string[];
  details: string[];
  connu: string | null;
}
const constats: Constat[] = [];
let state: Awaited<ReturnType<typeof sessionAdmin>>['state'];

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  state = (await sessionAdmin(browser)).state;
});

for (const [affichage, largeur, hauteur, schema] of AFFICHAGES) {
  test(`axe-core : ${ECRANS.length} écrans, ${affichage}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      viewport: { width: largeur, height: hauteur },
      colorScheme: schema,
      reducedMotion: 'reduce',
      storageState: state,
    });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await page.evaluate(() => sessionStorage.setItem('pilotage-scope', '00000000-0000-4000-8000-000000000001'));
      for (const [ecran, url] of ECRANS) {
        await page.goto(url);
        // Le flux temps réel (SSE) garde une connexion ouverte : « networkidle » n'est jamais atteint.
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 15_000 });
        await page.waitForTimeout(400);
        const resultat = await new AxeBuilder({ page }).withTags(REGLES).analyze();
        for (const v of resultat.violations) {
          constats.push({
            affichage,
            ecran,
            regle: v.id,
            impact: v.impact,
            aide: v.help,
            elements: v.nodes.slice(0, 8).map((n) => n.target.join(' ')),
            details: v.nodes.slice(0, 8).map((n) => (n.any[0] ?? n.all[0] ?? n.none[0])?.message ?? ''),
            connu: ECARTS_CONNUS[`${v.id}@${ecran}`] ?? null,
          });
        }
      }
    } finally {
      await ctx.close();
    }
  });
}

test('aucune violation nouvelle, rapport écrit', async () => {
  const dossier = process.env.A11Y_OUT || path.join('test-results', 'accessibilite');
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    path.join(dossier, 'accessibilite.json'),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        regles: REGLES,
        ecrans: ECRANS.length,
        affichages: AFFICHAGES.length,
        constats,
      },
      null,
      2,
    ) + '\n',
  );
  const nouveaux = constats.filter((c) => !c.connu);
  expect(
    nouveaux.map((c) => `${c.regle} [${c.impact}] ${c.ecran} (${c.affichage}) : ${c.aide} — ${c.elements.join(' | ')}`),
  ).toEqual([]);
});
