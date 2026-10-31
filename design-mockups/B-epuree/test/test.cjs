/* Test Playwright de la maquette B : six ancres, interactions, console vide, mouvement réduit.
   Exécution : node design-mockups/B-epuree/test/test.cjs */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CAPTURES = path.join(__dirname, 'captures');

async function scenario(browser, options, etiquette) {
  const contexte = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, options));
  const page = await contexte.newPage();
  const problemes = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemes.push('[console ' + m.type() + '] ' + m.text()); });
  page.on('pageerror', (e) => problemes.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) => problemes.push('[requête] ' + r.url() + ' ' + (r.failure() || {}).errorText));
  const verifs = [];
  const ok = (cond, msg) => verifs.push((cond ? 'OK   ' : 'ÉCHEC ') + msg);

  await page.goto(URL + '#/dashboard');
  await page.waitForTimeout(1300);
  ok(await page.locator('#nav-liste a[aria-current="page"]').getAttribute('href') === '#/dashboard', 'nav aria-current sur le dashboard');
  ok((await page.locator('#g-evolution svg path.trace').count()) === 2, 'courbe : 2 tracés');
  ok((await page.locator('#g-statuts svg .barre').count()) === 6, 'barres : 6 statuts');
  ok((await page.locator('#g-donut svg .anneau').count()) === 3, 'donut : 3 segments');
  ok((await page.locator('#g-jauge svg .jauge-arc').count()) === 1, 'jauge présente');
  ok((await page.locator('.kpi').count()) === 6, '6 KPI');
  ok((await page.locator('.echeance-delai.est-depassee').count()) >= 1, 'échéances dépassées signalées');
  await page.hover('#g-statuts svg .barre >> nth=0');
  await page.waitForTimeout(200);
  ok(await page.locator('#infobulle.visible').count() === 1, 'info-bulle au survol d’une barre');
  await page.hover('#g-evolution svg .zone-survol >> nth=5');
  await page.waitForTimeout(200);
  ok((await page.locator('#infobulle').innerText()).indexOf('Ouverts') !== -1, 'info-bulle de la courbe');
  if (etiquette === 'normal') await page.screenshot({ path: path.join(CAPTURES, '01-dashboard.png'), fullPage: true });

  // Liste
  await page.goto(URL + '#/audits');
  await page.waitForTimeout(400);
  ok((await page.locator('#corps-audits tr.ligne').count()) === 10, 'liste : 10 lignes par page');
  ok((await page.locator('#tableau-audits th[aria-sort="descending"]').count()) === 1, 'aria-sort initial');
  await page.click('button.tri[data-cle="nom"]');
  ok(await page.locator('#tableau-audits th[data-cle="nom"]').getAttribute('aria-sort') === 'ascending', 'tri par nom ascendant');
  await page.click('button.tri[data-cle="nom"]');
  ok(await page.locator('#tableau-audits th[data-cle="nom"]').getAttribute('aria-sort') === 'descending', 'tri par nom descendant');
  await page.selectOption('#f-statut', 'Clos');
  await page.waitForTimeout(100);
  const compte = await page.locator('#compte-liste').innerText();
  ok(compte.indexOf('17 audits') === 0, 'filtre statut Clos → 17 audits (' + compte + ')');
  await page.selectOption('#f-statut', '');
  await page.fill('#recherche', 'HDS');
  await page.waitForTimeout(100);
  ok((await page.locator('#corps-audits tr.ligne').count()) === 2, 'recherche plein texte « HDS » → 2 audits');
  await page.click('#btn-reinit');
  await page.waitForTimeout(100);
  ok((await page.locator('#compte-liste').innerText()).indexOf('36 audits') === 0, 'réinitialisation des filtres');
  await page.click('.page-btn[data-page="2"]');
  await page.waitForTimeout(100);
  ok(await page.locator('.page-btn[aria-current="page"]').innerText() === '2', 'pagination page 2');
  if (etiquette === 'normal') await page.screenshot({ path: path.join(CAPTURES, '02-audits.png'), fullPage: true });
  await page.click('#corps-audits tr.ligne >> nth=0');
  await page.waitForTimeout(400);
  ok(/^#\/audit\/AUD-\d\d$/.test(await page.evaluate(() => location.hash)), 'clic sur une ligne → fiche');

  // Fiche
  await page.goto(URL + '#/audit/AUD-07');
  await page.waitForTimeout(400);
  ok((await page.locator('h1').innerText()).indexOf('Audit HDS') === 0, 'fiche AUD-07 affichée');
  ok((await page.locator('[role="tablist"] [role="tab"]').count()) === 4, '4 onglets');
  await page.click('#onglet-constats');
  await page.waitForTimeout(300);
  ok(await page.locator('#panneau-constats').isVisible() && !(await page.locator('#panneau-synthese').isVisible()), 'onglet Constats actif');
  ok((await page.locator('#panneau-constats .constat').count()) === 5, '5 constats');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  ok(await page.locator('#onglet-actions').getAttribute('aria-selected') === 'true', 'flèche droite → Plan d’actions');
  const x = await page.locator('.onglets-indicateur').evaluate((el) => getComputedStyle(el).getPropertyValue('--x'));
  ok(parseFloat(x) > 0, 'indicateur d’onglet déplacé (--x = ' + x.trim() + ')');
  if (etiquette === 'normal') await page.screenshot({ path: path.join(CAPTURES, '03-fiche.png'), fullPage: true });
  await page.click('#onglet-historique');
  ok((await page.locator('#panneau-historique .chrono-item').count()) >= 4, 'historique en chronologie');
  // Modale depuis la fiche
  await page.click('[data-action="ouvrir-modale"]');
  await page.waitForTimeout(350);
  ok(await page.locator('#modale[role="dialog"]').isVisible(), 'modale ouverte');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.closest('#modale') !== null), 'focus dans la modale');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.closest('#modale') !== null), 'piège de focus (Tab reste dans la modale)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  ok(await page.locator('#voile').isHidden(), 'Échap ferme la modale');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-action') === 'ouvrir-modale'), 'focus rendu au déclencheur');

  // Formulaire
  await page.goto(URL + '#/formulaire');
  await page.waitForTimeout(400);
  await page.click('#btn-enregistrer');
  await page.waitForTimeout(100);
  ok((await page.locator('#resume-erreurs[role="alert"]').count()) === 1, 'résumé des erreurs');
  ok(await page.locator('#f-nom').getAttribute('aria-invalid') === 'true', 'aria-invalid posé');
  ok(await page.locator('#f-nom-erreur').isVisible(), 'message d’erreur relié visible');
  await page.fill('#f-nom', 'Audit interne — test de la maquette');
  await page.selectOption('#f-type', 'Interne');
  await page.selectOption('#f-ref', 'iso');
  await page.selectOption('#f-site', 'CH de Brumeval');
  await page.selectOption('#f-resp', 'u1');
  await page.fill('#f-debut', '2026-12-01');
  await page.fill('#f-fin', '2026-11-30');
  await page.locator('#f-fin').blur();
  await page.waitForTimeout(50);
  ok(await page.locator('#f-fin').getAttribute('aria-invalid') === 'true', 'validation au blur : fin < début');
  await page.fill('#f-fin', '2026-12-03');
  await page.click('#btn-enregistrer');
  await page.waitForTimeout(50);
  ok(await page.locator('#btn-enregistrer').isDisabled(), 'bouton désactivé pendant l’envoi');
  await page.waitForTimeout(1100);
  ok((await page.locator('.bandeau-succes').count()) === 1, 'bandeau de succès');
  ok((await page.locator('#toasts .toast').count()) >= 1, 'toast de succès');
  if (etiquette === 'normal') await page.screenshot({ path: path.join(CAPTURES, '04-formulaire.png'), fullPage: true });

  // RETEX
  await page.goto(URL + '#/retex');
  await page.waitForTimeout(400);
  ok((await page.locator('.retex-point:visible').count()) === 0, 'RETEX : aucun point au départ');
  await page.click('#btn-retex-suivant');
  await page.click('#btn-retex-suivant');
  await page.waitForTimeout(300);
  ok((await page.locator('.retex-point:visible').count()) === 2, 'RETEX : deux points déroulés');
  await page.focus('#retex-chrono');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  ok((await page.locator('.retex-point:visible').count()) === 3, 'RETEX : clavier → troisième point');
  if (etiquette === 'normal') await page.screenshot({ path: path.join(CAPTURES, '05-retex.png'), fullPage: true });
  await page.click('[data-action="retex-tout"]');
  await page.waitForTimeout(300);
  ok((await page.locator('.retex-point:visible').count()) === 11, 'RETEX : tout déroulé (11)');
  ok(await page.locator('#retex-suite').isVisible(), 'enseignements affichés');
  ok(await page.locator('#btn-retex-suivant').isDisabled(), 'bouton suivant désactivé à la fin');

  // Composants
  await page.goto(URL + '#/composants');
  await page.waitForTimeout(400);
  await page.click('[data-action="toast"][data-genre="erreur"]');
  await page.click('[data-action="toast"][data-genre="info"]');
  await page.waitForTimeout(300);
  ok((await page.locator('#toasts .toast.visible').count()) >= 2, 'toasts affichés');
  await page.click('#toasts .toast >> nth=0 >> button');
  await page.waitForTimeout(400);
  ok((await page.locator('#toasts .toast').count()) >= 1, 'un toast fermé');
  await page.click('[data-action="simuler-chargement"]');
  await page.waitForTimeout(200);
  ok((await page.locator('#zone-chargement .squelette').count()) === 1, 'squelette de chargement');
  await page.waitForTimeout(1500);
  ok((await page.locator('#zone-chargement .charge-resultat').count()) === 1, 'contenu chargé');
  await page.click('[data-action="ouvrir-modale"]');
  await page.waitForTimeout(350);
  await page.click('[data-action="confirmer-modale"]');
  await page.waitForTimeout(400);
  ok(await page.locator('#voile').isHidden(), 'confirmation ferme la modale');
  if (etiquette === 'normal') await page.screenshot({ path: path.join(CAPTURES, '06-composants.png'), fullPage: true });

  // postMessage
  await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*'));
  await page.waitForTimeout(300);
  ok((await page.evaluate(() => location.hash)) === '#/audits', 'postMessage change la route');

  // 1024 px
  if (etiquette === 'normal') {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(URL + '#/dashboard');
    await page.waitForTimeout(1200);
    const largeurDoc = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(largeurDoc <= 1024, 'pas de débordement horizontal à 1024 px (' + largeurDoc + ')');
    await page.screenshot({ path: path.join(CAPTURES, '07-dashboard-1024.png'), fullPage: true });
    await page.goto(URL + '#/audits');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(CAPTURES, '08-audits-1024.png'), fullPage: false });
  }

  // Aucun attribut style= statique dans le HTML source
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  ok(!/\sstyle=/.test(html), 'aucun attribut style= dans index.html');

  await contexte.close();
  return { verifs, problemes };
}

(async () => {
  fs.mkdirSync(CAPTURES, { recursive: true });
  const browser = await chromium.launch();
  let echec = false;
  for (const [etiquette, options] of [['normal', {}], ['mouvement réduit', { reducedMotion: 'reduce' }]]) {
    const r = await scenario(browser, options, etiquette);
    console.log('\n=== Scénario : ' + etiquette + ' ===');
    r.verifs.forEach((v) => console.log(v));
    if (r.problemes.length) { echec = true; console.log('Problèmes de console :'); r.problemes.forEach((p) => console.log('  ' + p)); }
    else console.log('Console : aucune erreur ni avertissement.');
    if (r.verifs.some((v) => v.indexOf('ÉCHEC') === 0)) echec = true;
  }
  await browser.close();
  process.exit(echec ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
