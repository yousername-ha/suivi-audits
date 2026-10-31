/* Test Playwright de la maquette C : six écrans, interactions, console vide, mouvement réduit, captures. */
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ECRANS = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];

async function session(browser, options, label) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, options));
  const page = await ctx.newPage();
  const problemes = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemes.push(`[console ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => problemes.push(`[pageerror] ${e.message}`));
  const verif = (cond, msg) => { if (!cond) problemes.push(`[assert] ${msg}`); };

  await page.goto(URL + '#/dashboard', { waitUntil: 'load' });
  for (const h of ECRANS) {
    await page.evaluate((x) => { location.hash = x; }, h);
    await sleep(900);
    const courant = await page.getAttribute('.nav__lien[aria-current="page"]', 'data-route');
    verif(courant === (h.startsWith('#/audit/') ? '#/audit/AUD-07' : h), `nav aria-current pour ${h} (obtenu ${courant})`);
    const h2 = await page.textContent('#ecran h2');
    verif(h2 && h2.trim().length > 0, `titre présent pour ${h}`);
    if (label === 'normal') await page.screenshot({ path: path.join(__dirname, 'captures', h.replace(/[#/]/g, '-').replace(/^-+/, '') + '.png'), fullPage: true });
  }

  /* Dashboard : graphiques SVG présents */
  await page.evaluate(() => { location.hash = '#/dashboard'; }); await sleep(600);
  verif((await page.$$('.graphique svg')).length >= 4, 'au moins 4 graphiques SVG sur le dashboard');
  verif((await page.$$('.graphique.est-anime')).length >= 4, 'graphiques animés (classe est-anime)');
  await page.hover('.barre-h >> nth=0');
  await sleep(100);
  verif(!(await page.isHidden('#infobulle')), 'infobulle visible au survol d’une barre');

  /* Liste : recherche, filtre, tri, pagination, clic ligne */
  await page.evaluate(() => { location.hash = '#/audits'; }); await sleep(500);
  verif((await page.$$('.tableau tbody tr')).length === 10, '10 lignes par page');
  await page.selectOption('#f-statut', 'Clos'); await sleep(200);
  const resume = await page.textContent('.resume-liste');
  verif(/17 audits/.test(resume), `filtre statut Clos → 17 (${resume.trim().slice(0, 40)})`);
  await page.click('.tri[data-tri="nom"]'); await sleep(200);
  verif((await page.getAttribute('th[aria-sort]', 'aria-sort')) === 'ascending', 'aria-sort ascending après tri par nom');
  await page.click('.tri[data-tri="nom"]'); await sleep(200);
  verif((await page.getAttribute('th[aria-sort]', 'aria-sort')) === 'descending', 'aria-sort descending au second clic');
  await page.click('.pagination__page[data-page="2"]'); await sleep(200);
  verif((await page.getAttribute('.pagination__page[aria-current="page"]', 'data-page')) === '2', 'page 2 active');
  await page.click('#reinit-filtres'); await sleep(200);
  verif((await page.$$('.tableau tbody tr')).length === 10, 'réinitialisation des filtres');
  await page.fill('#recherche', 'imagerie'); await sleep(400);
  verif((await page.$$('.tableau tbody tr')).length >= 1, 'recherche « imagerie » donne des résultats');
  await page.fill('#recherche', 'zzzz-introuvable'); await sleep(400);
  verif(!!(await page.$('.vide')), 'état vide affiché sans résultat');
  await page.click('#vide-reinit'); await sleep(300);
  await page.click('.tableau tbody tr >> nth=0 >> td >> nth=2'); await sleep(500);
  verif(/^#\/audit\/AUD-\d\d$/.test(await page.evaluate(() => location.hash)), 'clic ligne → fiche');

  /* Fiche : onglets */
  await page.evaluate(() => { location.hash = '#/audit/AUD-07'; }); await sleep(500);
  for (const id of ['ong-constats', 'ong-actions', 'ong-historique', 'ong-synthese']) {
    await page.click('#' + id); await sleep(150);
    verif((await page.getAttribute('#' + id, 'aria-selected')) === 'true', `onglet ${id} sélectionné`);
    const panneau = await page.getAttribute('#' + id, 'aria-controls');
    verif(await page.isVisible('#' + panneau), `panneau ${panneau} visible`);
  }
  await page.focus('#ong-synthese'); await page.keyboard.press('ArrowRight'); await sleep(100);
  verif((await page.getAttribute('#ong-constats', 'aria-selected')) === 'true', 'flèche droite change d’onglet');
  const indic = await page.evaluate(() => getComputedStyle(document.querySelector('.onglets__indicateur')).transform);
  verif(indic && indic !== 'none', 'indicateur d’onglet positionné');

  /* Formulaire : erreurs puis succès */
  await page.evaluate(() => { location.hash = '#/formulaire'; }); await sleep(500);
  await page.click('#soumettre'); await sleep(200);
  verif(!!(await page.$('#resume-erreurs')), 'résumé des erreurs affiché');
  verif((await page.getAttribute('#f-nom', 'aria-invalid')) === 'true', 'aria-invalid sur intitulé');
  verif((await page.$$('.toast--erreur')).length === 1, 'toast erreur émis');
  await page.fill('#f-nom', 'Audit interne — test de maquette');
  await page.selectOption('#f-type', 'Interne'); await page.selectOption('#f-ref', 'iso'); await page.selectOption('#f-resp', 'u2');
  await page.fill('#f-debut', '2026-12-01'); await page.fill('#f-fin', '2026-11-30'); await page.dispatchEvent('#f-fin', 'blur'); await sleep(100);
  verif(/postérieure/.test(await page.textContent('#f-fin-erreur')), 'erreur de date de fin au blur');
  await page.fill('#f-fin', '2026-12-02');
  await page.click('#soumettre'); await sleep(100);
  verif(await page.isDisabled('#soumettre'), 'bouton désactivé pendant l’envoi');
  await sleep(1100);
  verif(!!(await page.$('#succes')), 'bandeau de succès affiché');
  verif((await page.$$('.toast--succes')).length === 1, 'toast succès émis');

  /* RETEX */
  await page.evaluate(() => { location.hash = '#/retex'; }); await sleep(500);
  verif((await page.$$('.retex-point.est-visible')).length === 1, 'un point visible au départ');
  await page.click('#retex-suivant'); await sleep(300);
  verif((await page.$$('.retex-point.est-visible')).length === 2, 'point suivant → 2 visibles');
  await page.focus('#retex-chrono'); await page.keyboard.press('ArrowRight'); await sleep(200);
  verif((await page.$$('.retex-point.est-visible')).length === 3, 'clavier → 3 visibles');
  await page.getByRole('button', { name: /tout dérouler/i }).click(); await sleep(600);
  verif((await page.$$('.retex-point.est-visible')).length === 11, 'tout dérouler → 11 visibles');
  verif(await page.isVisible('#retex-suite .graphique svg'), 'courbe de gravité affichée');
  if (label === 'normal') await page.screenshot({ path: path.join(__dirname, 'captures', 'retex-deroule.png'), fullPage: true });

  /* Composants : modale, toasts, chargement */
  await page.evaluate(() => { location.hash = '#/composants'; }); await sleep(500);
  await page.click('#ouvrir-suppression'); await sleep(300);
  verif(await page.isVisible('#modale'), 'modale visible');
  verif((await page.evaluate(() => document.activeElement.id)) === 'modale-annuler', 'focus initial dans la modale');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  verif((await page.evaluate(() => document.activeElement.id)) === 'modale-annuler', 'piège de focus (retour au premier bouton)');
  await page.keyboard.press('Shift+Tab');
  verif((await page.evaluate(() => document.activeElement.id)) === 'modale-confirmer', 'piège de focus arrière');
  await page.keyboard.press('Escape'); await sleep(350);
  verif(await page.isHidden('#modale'), 'Échap ferme la modale');
  verif((await page.evaluate(() => document.activeElement.id)) === 'ouvrir-suppression', 'focus rendu au bouton d’origine');
  await page.click('#ouvrir-suppression'); await sleep(300); await page.click('#modale-confirmer'); await sleep(350);
  verif((await page.$$('.toast--succes')).length >= 1, 'confirmation → toast');
  for (const t of ['alerte', 'erreur', 'info']) await page.click(`[data-toast="${t}"]`);
  await sleep(300);
  verif((await page.$$('.toast.est-visible')).length >= 4, 'quatre toasts visibles');
  const avant = (await page.$$('.toast')).length;
  await page.click('.toast >> nth=0 >> button'); await sleep(400);
  verif((await page.$$('.toast')).length === avant - 1, 'fermeture d’un toast');
  await page.click('#simuler-chargement'); await sleep(200);
  verif(!!(await page.$('.squelette')), 'squelette affiché');
  await sleep(1700);
  verif(!!(await page.$('.contenu-charge')), 'contenu chargé après le squelette');
  if (label === 'normal') { await page.click('#ouvrir-suppression'); await sleep(400); await page.screenshot({ path: path.join(__dirname, 'captures', 'composants-modale.png') }); await page.keyboard.press('Escape'); }

  /* postMessage */
  await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*')); await sleep(400);
  verif((await page.evaluate(() => location.hash)) === '#/audits', 'postMessage route → #/audits');

  /* Tablette */
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => { location.hash = '#/dashboard'; }); await sleep(700);
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verif(!deborde, 'pas de débordement horizontal à 1024 px');
  if (label === 'normal') await page.screenshot({ path: path.join(__dirname, 'captures', 'dashboard-1024.png'), fullPage: false });

  await ctx.close();
  return problemes;
}

(async () => {
  const fs = require('fs');
  fs.mkdirSync(path.join(__dirname, 'captures'), { recursive: true });
  const browser = await chromium.launch();
  let total = 0;
  for (const [label, options] of [['normal', {}], ['reduced-motion', { reducedMotion: 'reduce' }]]) {
    const pb = await session(browser, options, label);
    console.log(`${label} : ${pb.length ? pb.length + ' problème(s)' : 'aucun problème'}`);
    pb.forEach((p) => console.log('  ' + p));
    total += pb.length;
  }
  await browser.close();
  process.exit(total ? 1 : 0);
})();
