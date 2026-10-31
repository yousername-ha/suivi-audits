/* Vérification de la maquette D avec Playwright (Chromium) : six écrans, interactions, console vide,
   mouvement réduit. Usage : node test/verifier.cjs  (captures dans /tmp/maquette-D/ si CAPTURES=1). */
'use strict';
var path = require('path');
var fs = require('fs');
var { chromium } = require('playwright');
var URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
var ANCRES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];
var captures = process.env.CAPTURES === '1';
var dossierCaptures = '/tmp/maquette-D';
if (captures && !fs.existsSync(dossierCaptures)) fs.mkdirSync(dossierCaptures, { recursive: true });

function verifier(cond, msg) { if (!cond) throw new Error('Échec : ' + msg); console.log('  ok  ' + msg); }

async function scenario(browser, options) {
  var context = await browser.newContext({ viewport: options.viewport, reducedMotion: options.reducedMotion || 'no-preference' });
  var page = await context.newPage();
  var problemes = [];
  page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') problemes.push(m.type() + ' : ' + m.text()); });
  page.on('pageerror', function (e) { problemes.push('pageerror : ' + e.message); });
  console.log('\nScénario ' + options.nom);

  for (var i = 0; i < ANCRES.length; i++) {
    await page.goto(URL + ANCRES[i]);
    await page.waitForTimeout(250);
    var h1 = await page.locator('h1').first().textContent();
    verifier(h1 && h1.trim().length > 0, ANCRES[i] + ' → h1 « ' + h1.trim() + ' »');
    var courant = await page.locator('.nav__lien[aria-current="page"]').count();
    verifier(courant === 1, 'navigation : une seule entrée courante');
    if (captures) await page.screenshot({ path: dossierCaptures + '/' + options.nom + '-' + ANCRES[i].replace(/[#/]/g, '_') + '.png', fullPage: true });
  }

  /* Dashboard : graphiques et info-bulle */
  await page.goto(URL + '#/dashboard');
  await page.waitForTimeout(1200);
  verifier((await page.locator('svg.graphique').count()) >= 4, 'dashboard : au moins quatre graphiques SVG');
  await page.locator('.graphique .barre').first().hover();
  await page.waitForTimeout(100);
  verifier(!(await page.locator('#infobulle').isHidden()), 'info-bulle visible au survol d’une barre');
  await page.mouse.move(5, 5);
  verifier(await page.locator('#infobulle').isHidden(), 'info-bulle masquée après le survol');
  verifier((await page.locator('.delai--depasse').count()) >= 1, 'échéances dépassées signalées (icône + libellé)');

  /* Liste : recherche, filtre, tri, pagination, clic ligne */
  await page.goto(URL + '#/audits');
  await page.waitForTimeout(200);
  verifier((await page.locator('.tableau tbody tr').count()) === 10, 'liste : 10 lignes par page');
  verifier((await page.locator('.pagination__page[aria-current="page"]').textContent()) === '1', 'pagination sur la page 1');
  await page.locator('.pagination__page', { hasText: '4' }).click();
  verifier((await page.locator('.tableau tbody tr').count()) === 6, 'page 4 : 6 lignes (36 audits)');
  await page.selectOption('#filtre-statut', 'Clos');
  var compteur = await page.locator('#compteur-audits').textContent();
  verifier(/^17 audits/.test(compteur), 'filtre statut Clos → ' + compteur);
  await page.fill('#recherche-audits', 'hds');
  compteur = await page.locator('#compteur-audits').textContent();
  verifier(/audit/.test(compteur), 'recherche « hds » → ' + compteur);
  await page.locator('.bouton', { hasText: 'Réinitialiser' }).click();
  verifier(/^36 audits$/.test((await page.locator('#compteur-audits').textContent()).trim()), 'réinitialisation des filtres');
  await page.locator('th .tri', { hasText: 'Audit' }).click();
  verifier((await page.locator('th[aria-sort="ascending"]').count()) === 1, 'tri croissant sur la colonne Audit (aria-sort)');
  await page.locator('th .tri', { hasText: 'Audit' }).click();
  verifier((await page.locator('th[aria-sort="descending"]').count()) === 1, 'tri décroissant au second clic');
  await page.locator('.tableau tbody tr').first().locator('td').nth(5).click();
  await page.waitForTimeout(200);
  verifier(/#\/audit\/AUD-\d\d/.test(page.url()), 'clic sur une ligne → fiche ' + page.url().split('#')[1]);

  /* Fiche : onglets */
  await page.goto(URL + '#/audit/AUD-07');
  await page.waitForTimeout(200);
  verifier((await page.locator('[role="tablist"] [role="tab"]').count()) === 4, 'fiche : quatre onglets');
  await page.locator('#onglet-constats').click();
  verifier((await page.locator('#panneau-constats').isVisible()), 'onglet Constats affiché');
  verifier((await page.locator('#onglet-constats').getAttribute('aria-selected')) === 'true', 'aria-selected sur l’onglet actif');
  await page.keyboard.press('ArrowRight');
  verifier(await page.locator('#panneau-actions').isVisible(), 'flèche droite → Plan d’actions');
  await page.keyboard.press('End');
  verifier(await page.locator('#panneau-historique').isVisible(), 'touche Fin → Historique');
  verifier((await page.locator('.chronologie li').count()) >= 4, 'historique en chronologie');

  /* Formulaire : erreurs puis succès */
  await page.goto(URL + '#/formulaire');
  await page.waitForTimeout(200);
  await page.locator('button[type="submit"]').click();
  verifier((await page.locator('.champ.est-invalide').count()) === 7, 'soumission vide : 7 champs obligatoires en erreur');
  verifier((await page.locator('[aria-invalid="true"]').count()) === 7, 'aria-invalid posé sur les champs');
  verifier(await page.locator('.bandeau--erreur').isVisible(), 'bandeau d’erreur affiché');
  await page.fill('#nom', 'Audit interne — test maquette');
  await page.selectOption('#type', 'Interne');
  await page.selectOption('#referentiel', 'iso');
  await page.selectOption('#site', 'Siège du GHT');
  await page.selectOption('#responsable', 'u2');
  await page.fill('#debut', '2026-12-01');
  await page.fill('#fin', '2026-11-30');
  await page.locator('#fin').blur();
  verifier((await page.locator('#fin-erreur').textContent()).indexOf('postérieure') !== -1, 'validation au blur : fin < début détectée');
  await page.fill('#fin', '2026-12-02');
  await page.locator('button[type="submit"]').click();
  verifier(await page.locator('button[type="submit"]').isDisabled(), 'bouton désactivé pendant l’envoi');
  await page.waitForTimeout(1200);
  verifier(await page.locator('.bandeau--succes').isVisible(), 'bandeau de succès affiché');
  verifier((await page.locator('.toast--succes').count()) >= 1, 'toast de succès émis');

  /* RETEX : déroulé point par point */
  await page.goto(URL + '#/retex');
  await page.waitForTimeout(200);
  verifier((await page.locator('.retex-point:not([hidden])').count()) === 1, 'RETEX : un point visible au départ');
  await page.locator('.bouton', { hasText: 'Point suivant' }).click();
  await page.locator('.bouton', { hasText: 'Point suivant' }).click();
  verifier((await page.locator('.retex-point:not([hidden])').count()) === 3, 'deux clics → trois points');
  await page.locator('.retex-chrono').focus();
  await page.keyboard.press('ArrowRight');
  verifier((await page.locator('.retex-point:not([hidden])').count()) === 4, 'flèche droite → quatre points');
  await page.locator('.bouton', { hasText: 'Tout dérouler' }).click();
  verifier((await page.locator('.retex-point:not([hidden])').count()) === 11, 'tout dérouler → onze points');
  verifier(await page.locator('.retex-fin').isVisible(), 'enseignements affichés à la fin');
  await page.locator('.bouton', { hasText: 'Réinitialiser' }).click();
  verifier((await page.locator('.retex-point:not([hidden])').count()) === 1, 'réinitialisation');

  /* Composants : modale, toasts, chargement */
  await page.goto(URL + '#/composants');
  await page.waitForTimeout(200);
  await page.locator('.bouton', { hasText: 'Clôturer l’audit AUD-07' }).click();
  verifier(await page.locator('[role="dialog"]').isVisible(), 'modale ouverte');
  var actif = await page.evaluate(function () { return document.activeElement.textContent; });
  verifier(actif === 'Annuler', 'focus initial sur « Annuler »');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  var dansModale = await page.evaluate(function () { return !!document.activeElement.closest('[role="dialog"]'); });
  verifier(dansModale, 'focus piégé dans la modale après trois tabulations');
  await page.keyboard.press('Escape');
  verifier((await page.locator('[role="dialog"]').count()) === 0, 'Échap ferme la modale');
  var retour = await page.evaluate(function () { return document.activeElement.textContent; });
  verifier(retour.indexOf('Clôturer') !== -1, 'focus rendu au bouton déclencheur');
  await page.locator('.bouton', { hasText: 'Clôturer l’audit AUD-07' }).click();
  await page.locator('.modale__pied .bouton--danger').click();
  verifier((await page.locator('.toast--succes').count()) >= 1, 'confirmation → toast de succès');
  await page.locator('.demo__rangee .bouton', { hasText: 'Erreur' }).click();
  /* Les ancres ne rechargent pas la page : les toasts des étapes précédentes peuvent encore être affichés. */
  var dernierToast = page.locator('.toast').last();
  verifier((await dernierToast.getAttribute('role')) === 'alert' && /toast--erreur/.test(await dernierToast.getAttribute('class')), 'toast d’erreur avec role=alert');
  var toastCible = page.locator('.toast', { hasText: 'Export impossible' });
  await toastCible.locator('button').click();
  await toastCible.waitFor({ state: 'detached', timeout: 2000 });
  verifier((await toastCible.count()) === 0, 'fermeture manuelle du toast');
  await page.locator('.bouton', { hasText: 'Simuler un chargement' }).click();
  verifier(await page.locator('.squelette').isVisible(), 'squelette affiché');
  await page.waitForTimeout(1600);
  verifier(await page.locator('.charge').isVisible(), 'contenu rechargé');

  /* postMessage */
  await page.evaluate(function () { window.postMessage({ type: 'route', hash: '#/audits' }, '*'); });
  await page.waitForTimeout(200);
  verifier(page.url().indexOf('#/audits') !== -1, 'postMessage route → #/audits');

  /* Focus visible sur un bouton au clavier */
  await page.keyboard.press('Tab');
  var ombre = await page.evaluate(function () { return getComputedStyle(document.activeElement).boxShadow; });
  verifier(ombre && ombre !== 'none', 'anneau de focus visible au clavier');

  await context.close();
  if (problemes.length) { console.error('\nProblèmes console :\n' + problemes.join('\n')); throw new Error(problemes.length + ' problème(s) console'); }
  console.log('  ok  aucune erreur ni avertissement console');
}

(async function () {
  var browser = await chromium.launch();
  try {
    await scenario(browser, { nom: '1440', viewport: { width: 1440, height: 900 } });
    await scenario(browser, { nom: '1024', viewport: { width: 1024, height: 768 } });
    await scenario(browser, { nom: 'mouvement-reduit', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    console.log('\nTout est passé.');
  } finally {
    await browser.close();
  }
})().catch(function (e) { console.error(e.message); process.exit(1); });
