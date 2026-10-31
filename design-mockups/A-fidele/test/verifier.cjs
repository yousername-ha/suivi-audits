/* Test Playwright de la maquette A-fidele : six ancres, onglets, filtre, tri, modale, toast, RETEX, mouvement réduit.
   Usage : node test/verifier.cjs  (code de sortie 1 en cas d'erreur de console, d'exception ou d'assertion). */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ANCRES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];
const problemes = [];
function verifier(condition, message) { if (!condition) problemes.push('Assertion : ' + message); }

async function parcourir(browser, options, etiquette) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, options));
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemes.push(`[${etiquette}] console.${m.type()} : ${m.text()}`); });
  page.on('pageerror', (e) => problemes.push(`[${etiquette}] pageerror : ${e.message}`));
  page.on('requestfailed', (r) => problemes.push(`[${etiquette}] requête échouée : ${r.url()}`));

  await page.goto(URL + '#/dashboard');
  await page.waitForSelector('.kpi');

  for (const ancre of ANCRES) {
    await page.evaluate((h) => { location.hash = h; }, ancre);
    await page.waitForTimeout(400);
    const titre = await page.locator('h1').first().textContent();
    verifier(titre && titre.trim().length > 0, `${ancre} : titre h1 présent`);
    const courant = await page.locator('.nav__lien[aria-current="page"]').count();
    verifier(courant === 1, `${ancre} : une seule entrée de navigation courante (${courant})`);
    const stylesInline = await page.locator('[style]').evaluateAll((els) => els.filter((e) => !(e.id === 'info-bulle') && !e.closest('.graphique')).map((e) => e.getAttribute('style')).filter((s) => s && !/^(--[a-z-]+:[^;]+;\s*)+$/.test(s)));
    verifier(stylesInline.length === 0, `${ancre} : aucun style en ligne hors variables CSS (${stylesInline.slice(0, 3).join(' | ')})`);
    if (etiquette === 'normal') await page.screenshot({ path: path.join(__dirname, 'capture-' + ancre.replace(/[#/]+/g, '-').replace(/^-|-$/g, '') + '.png'), fullPage: true });
  }

  /* postMessage de la page comparative */
  await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*'));
  await page.waitForTimeout(300);
  verifier((await page.evaluate(() => location.hash)) === '#/audits', 'postMessage route → #/audits');

  /* Liste : filtre, recherche, tri, pagination, clic ligne */
  await page.waitForSelector('#corps-table tr');
  verifier((await page.locator('#corps-table tr').count()) === 10, 'liste : 10 lignes par page');
  await page.selectOption('#filtre-statut', 'Clos');
  await page.waitForTimeout(100);
  const compteur = await page.locator('#compteur').textContent();
  verifier(/17 sur 36/.test(compteur), `liste : filtre statut Clos → 17 (${compteur})`);
  await page.fill('#recherche', 'HDS');
  await page.waitForTimeout(100);
  verifier(/sur 36/.test(await page.locator('#compteur').textContent()), 'liste : recherche HDS filtre');
  await page.click('#reinitialiser');
  await page.click('button[data-tri="nom"]');
  await page.waitForTimeout(100);
  verifier((await page.locator('th[data-cle="nom"]').getAttribute('aria-sort')) === 'ascending', 'liste : tri nom ascendant (aria-sort)');
  await page.click('button[data-tri="nom"]');
  verifier((await page.locator('th[data-cle="nom"]').getAttribute('aria-sort')) === 'descending', 'liste : tri nom descendant');
  await page.click('.pagination__page[data-page="2"]');
  await page.waitForTimeout(100);
  verifier((await page.locator('.pagination__page[aria-current="page"]').textContent()) === '2', 'liste : page 2 active');
  await page.click('#corps-table tr td:nth-child(4)');
  await page.waitForTimeout(300);
  verifier(/^#\/audit\/AUD-\d+$/.test(await page.evaluate(() => location.hash)), 'liste : clic ligne → fiche');

  /* Fiche AUD-07 : onglets */
  await page.evaluate(() => { location.hash = '#/audit/AUD-07'; });
  await page.waitForSelector('[role="tablist"]');
  await page.click('#onglet-constats');
  verifier(!(await page.locator('#panneau-constats').isHidden()), 'fiche : panneau constats visible');
  verifier((await page.locator('#onglet-constats').getAttribute('aria-selected')) === 'true', 'fiche : onglet constats sélectionné');
  await page.focus('#onglet-constats');
  await page.keyboard.press('ArrowRight');
  verifier((await page.locator('#onglet-actions').getAttribute('aria-selected')) === 'true', 'fiche : flèche droite → plan d’actions');
  if (etiquette === 'normal') await page.screenshot({ path: path.join(__dirname, 'capture-audit-constats.png'), fullPage: true });
  await page.click('#onglet-historique');
  verifier((await page.locator('#panneau-historique .chrono__item').count()) > 3, 'fiche : historique rendu');
  const indicateur = await page.locator('.onglets__indicateur').evaluate((el) => el.style.getPropertyValue('--x'));
  verifier(indicateur !== '', 'fiche : indicateur d’onglet positionné');

  /* Modale : ouverture, piège de focus, Échap */
  await page.click('[data-action="cloturer"]');
  await page.waitForTimeout(350);
  verifier(await page.locator('[role="dialog"]').isVisible(), 'modale : visible');
  verifier(await page.evaluate(() => document.activeElement && document.activeElement.id === 'modale-confirmer'), 'modale : focus initial sur Confirmer');
  if (etiquette === 'normal') await page.screenshot({ path: path.join(__dirname, 'capture-modale.png') });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  verifier(await page.evaluate(() => !!document.activeElement.closest('.modale__boite')), 'modale : le focus reste piégé');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  verifier(await page.locator('#modale').isHidden(), 'modale : fermée par Échap');
  verifier(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-action') === 'cloturer'), 'modale : focus rendu au déclencheur');
  await page.click('[data-action="cloturer"]');
  await page.waitForTimeout(300);
  await page.click('#modale-confirmer');
  await page.waitForTimeout(300);
  verifier((await page.locator('.toast').count()) >= 1, 'modale : confirmation → toast');

  /* Formulaire : erreurs puis succès */
  await page.evaluate(() => { location.hash = '#/formulaire'; });
  await page.waitForSelector('#formulaire-audit');
  await page.click('#soumettre');
  await page.waitForTimeout(100);
  verifier((await page.locator('.champ--invalide').count()) === 7, `formulaire : 7 champs invalides (${await page.locator('.champ--invalide').count()})`);
  verifier((await page.locator('#nom').getAttribute('aria-invalid')) === 'true', 'formulaire : aria-invalid posé');
  verifier(/nom-erreur/.test(await page.locator('#nom').getAttribute('aria-describedby')), 'formulaire : aria-describedby relie l’erreur');
  await page.click('#prefill');
  await page.fill('#fin', '2027-01-01');
  await page.locator('#fin').blur();
  verifier((await page.locator('[data-champ="fin"]').getAttribute('class')).includes('champ--invalide'), 'formulaire : fin < début détecté au blur');
  await page.fill('#fin', '2027-02-10');
  await page.click('#soumettre');
  verifier(await page.locator('#soumettre').isDisabled(), 'formulaire : bouton désactivé pendant l’envoi');
  await page.waitForSelector('.bandeau--succes', { timeout: 3000 });
  verifier(!(await page.locator('#soumettre').isDisabled()), 'formulaire : bouton réactivé');

  /* RETEX */
  await page.evaluate(() => { location.hash = '#/retex'; });
  await page.waitForSelector('#retex-liste');
  verifier((await page.locator('.evenement.est-visible').count()) === 1, 'retex : premier point affiché');
  await page.click('#retex-suivant');
  await page.click('#retex-suivant');
  await page.waitForTimeout(200);
  verifier((await page.locator('.evenement.est-visible').count()) === 3, 'retex : 3 points après deux clics');
  await page.focus('#retex-liste');
  await page.keyboard.press('ArrowRight');
  verifier((await page.locator('.evenement.est-visible').count()) === 4, 'retex : clavier flèche droite');
  await page.click('#retex-tout');
  await page.waitForTimeout(1200);
  verifier((await page.locator('.evenement.est-visible').count()) === 11, 'retex : tout déroulé (11)');
  verifier(await page.locator('#retex-fin.est-visible').count() === 1, 'retex : enseignements affichés');
  verifier(await page.locator('#retex-suivant').isDisabled(), 'retex : bouton suivant désactivé à la fin');
  await page.click('#retex-reset');
  verifier((await page.locator('.evenement.est-visible').count()) === 0, 'retex : réinitialisé');

  /* Composants : toasts, chargement */
  await page.evaluate(() => { location.hash = '#/composants'; });
  await page.waitForSelector('[data-toast]');
  for (const t of ['succes', 'alerte', 'erreur', 'info']) await page.click(`[data-toast="${t}"]`);
  await page.waitForTimeout(300);
  verifier((await page.locator('.toast.est-visible').count()) >= 4, 'composants : 4 toasts visibles');
  const premierToast = await page.locator('.toast').first().elementHandle();
  await page.click('.toast button >> nth=0');
  await page.waitForTimeout(400);
  verifier(await premierToast.evaluate((el) => !el.isConnected), 'composants : le toast fermé est retiré du DOM');
  await page.click('#demo-charger');
  await page.waitForTimeout(100);
  verifier((await page.locator('.squelette').count()) === 1, 'composants : squelette pendant le chargement');
  await page.waitForTimeout(1700);
  verifier((await page.locator('.squelette').count()) === 0, 'composants : contenu rechargé');

  /* Graphiques : les arcs et courbes atteignent leur état final */
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(1400);
  const offsets = await page.locator('.graphique .arc').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).strokeDashoffset)));
  verifier(offsets.every((o) => Math.abs(o) < 0.5), `dashboard : arcs déroulés (${offsets.map((o) => o.toFixed(1)).join(', ')})`);
  verifier((await page.locator('.graphique--courbe').count()) === 1 && (await page.locator('.graphique--anneau').count()) === 1, 'dashboard : courbe et anneau présents');
  const arc = page.locator('.graphique--anneau .arc >> nth=0');
  await arc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const boite = await arc.boundingBox();
  /* milieu du premier segment (Critique, ~72°) : angle -54° sur le rayon 58 ; la boîte inclut le trait (134 unités) */
  const echelle = boite.width / 134;
  const angle = (-90 + 36) * Math.PI / 180;
  await arc.hover({ position: { x: (67 + 58 * Math.cos(angle)) * echelle, y: (67 + 58 * Math.sin(angle)) * echelle } });
  await page.waitForTimeout(200);
  verifier(await page.locator('#info-bulle.est-visible').count() === 1, 'dashboard : info-bulle au survol');
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
  verifier(hauteur < 1900, `dashboard : hauteur de page raisonnable (${hauteur}px)`);

  /* Écran 1024 px */
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  verifier(await page.evaluate(() => document.body.classList.contains('nav-repliee')), '1024 px : navigation repliée');
  const largeurDoc = await page.evaluate(() => document.documentElement.scrollWidth);
  verifier(largeurDoc <= 1024, `1024 px : pas de défilement horizontal (${largeurDoc})`);
  if (etiquette === 'normal') await page.screenshot({ path: path.join(__dirname, 'capture-dashboard-1024.png'), fullPage: true });

  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await parcourir(browser, {}, 'normal');
    await parcourir(browser, { reducedMotion: 'reduce' }, 'mouvement réduit');
  } catch (e) {
    problemes.push('Exception du test : ' + (e.stack || e.message));
  } finally {
    await browser.close();
  }
  if (problemes.length) {
    console.error(problemes.length + ' problème(s) :\n- ' + problemes.join('\n- '));
    process.exit(1);
  }
  console.log('Maquette A-fidele : aucun problème détecté (parcours normal et mouvement réduit).');
})();
