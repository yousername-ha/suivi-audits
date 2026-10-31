/* Vérification Playwright de la maquette F : six ancres, onglets, filtre, tri, modale, toasts, RETEX,
   formulaire, interrupteur d'animations, mouvement réduit, 1440 et 1024 px. Aucune erreur ni avertissement
   console tolérés. Usage : node test/verifier.cjs  (captures dans test/captures/). */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CAPTURES = path.join(__dirname, 'captures');
fs.mkdirSync(CAPTURES, { recursive: true });

const ANCRES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];
let echecs = 0;
function ok(cond, message) {
  if (cond) console.log('  OK  ' + message);
  else { echecs += 1; console.log('  KO  ' + message); }
}

async function parcours(browser, options) {
  const { reduit, largeur, capturer } = options;
  console.log(`\n== Parcours ${reduit ? 'mouvement réduit' : 'animations'} · ${largeur} px ==`);
  const context = await browser.newContext({ viewport: { width: largeur, height: 900 }, reducedMotion: reduit ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const journaux = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') journaux.push(m.type() + ' : ' + m.text()); });
  page.on('pageerror', (e) => journaux.push('pageerror : ' + e.message));

  await page.goto(URL + '#/dashboard');
  await page.waitForSelector('.kpi');
  const etatAnim = await page.getAttribute('html', 'data-animations');
  ok(etatAnim === (reduit ? 'off' : 'on'), `data-animations="${etatAnim}" conforme à la préférence système`);

  for (const ancre of ANCRES) {
    await page.evaluate((hsh) => { location.hash = hsh; }, ancre);
    await page.waitForTimeout(reduit ? 150 : 700);
    const courant = await page.getAttribute('.nav__liste a[aria-current="page"]', 'href');
    ok(courant && ('#/' + ancre.split('/')[1]) === ('#/' + courant.split('/')[1]), `${ancre} rendu, navigation marquée (${courant})`);
    if (capturer) {
      await page.waitForFunction(() => !document.querySelector('.a-observer:not(.anime)'), null, { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(reduit ? 100 : 1400);
      await page.screenshot({ path: path.join(CAPTURES, `${ancre.replace(/[#/]+/g, '-').replace(/^-/, '')}-${largeur}${reduit ? '-reduit' : ''}.png`), fullPage: true });
    }
  }

  const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(largeurPage <= largeur, `aucun débordement horizontal (scrollWidth ${largeurPage} ≤ ${largeur})`);

  /* postMessage */
  await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*'));
  await page.waitForTimeout(400);
  ok((await page.evaluate(() => location.hash)) === '#/audits', 'postMessage { type: route } change l’ancre');

  /* Liste : recherche, filtre, tri, pagination, ligne cliquable */
  await page.waitForSelector('.tableau tbody tr');
  const lignesInitiales = await page.locator('.tableau tbody tr').count();
  ok(lignesInitiales === 10, `pagination : ${lignesInitiales} lignes sur la première page`);
  await page.click('.chip:has-text("Clos")');
  await page.waitForTimeout(200);
  const compte = await page.textContent('.resultat-compte');
  ok(/17 audits/.test(compte), `filtre statut Clos → « ${compte.trim()} »`);
  await page.click('.chip:has-text("Tous")');
  await page.fill('input[type="search"]', 'HDS');
  await page.waitForTimeout(200);
  const compteRecherche = await page.textContent('.resultat-compte');
  ok(/2 audits/.test(compteRecherche), `recherche « HDS » → « ${compteRecherche.trim()} »`);
  await page.fill('input[type="search"]', '');
  await page.click('th button:has-text("Identifiant")');
  await page.waitForTimeout(200);
  const triId = await page.getAttribute('th:has(button:has-text("Identifiant"))', 'aria-sort');
  const premierId = await page.textContent('.tableau tbody tr:first-child td:first-child');
  ok(triId === 'ascending' && premierId.trim() === 'AUD-01', `tri Identifiant : aria-sort=${triId}, première ligne ${premierId.trim()}`);
  await page.click('th button:has-text("Identifiant")');
  await page.waitForTimeout(200);
  const triId2 = await page.getAttribute('th:has(button:has-text("Identifiant"))', 'aria-sort');
  ok(triId2 === 'descending', `tri inversé : aria-sort=${triId2}`);
  await page.click('.pagination__page[aria-label="Page 2"]');
  await page.waitForTimeout(200);
  ok(/11 à 20/.test(await page.textContent('.pagination__info')), 'pagination : page 2 affiche 11 à 20');
  await page.click('.tableau tbody tr:first-child td:nth-child(3)');
  await page.waitForTimeout(500);
  ok(/^#\/audit\/AUD-/.test(await page.evaluate(() => location.hash)), 'clic sur une ligne → fiche de l’audit');

  /* Fiche : onglets */
  await page.evaluate(() => { location.hash = '#/audit/AUD-07'; });
  await page.waitForSelector('[role="tablist"]');
  await page.click('[role="tab"]:has-text("Constats")');
  await page.waitForTimeout(300);
  const ongletActif = await page.getAttribute('[role="tab"][aria-selected="true"]', 'aria-controls');
  const panneauVisible = await page.isVisible('#' + ongletActif);
  const nbConstats = await page.locator('#' + ongletActif + ' .constat').count();
  ok(panneauVisible && nbConstats === 5, `onglet Constats actif, ${nbConstats} constats affichés`);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  ok((await page.textContent('[role="tab"][aria-selected="true"]')).indexOf('Plan') === 0, 'flèche droite → onglet Plan d’actions');
  await page.click('[role="tab"]:has-text("Historique")');
  await page.waitForTimeout(200);
  ok((await page.locator('.chrono__item').count()) >= 4, 'onglet Historique : chronologie rendue');

  /* Formulaire : validation puis succès */
  await page.evaluate(() => { location.hash = '#/formulaire'; });
  await page.waitForSelector('form.formulaire');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(300);
  const nbInvalides = await page.locator('[aria-invalid="true"]').count();
  ok(nbInvalides === 7 && (await page.isVisible('.bandeau--erreur')), `soumission vide : ${nbInvalides} champs invalides, bandeau d’erreur`);
  const focusErreur = await page.evaluate(() => document.activeElement && document.activeElement.name);
  ok(focusErreur === 'nom', `focus placé sur le premier champ en erreur (${focusErreur})`);
  await page.fill('input[name="nom"]', 'Audit interne — test de maquette');
  await page.selectOption('select[name="type"]', 'Interne');
  await page.selectOption('select[name="referentiel"]', 'iso');
  await page.selectOption('select[name="site"]', { index: 1 });
  await page.selectOption('select[name="responsable"]', 'u1');
  await page.fill('input[name="debut"]', '2026-12-10');
  await page.fill('input[name="fin"]', '2026-12-05');
  await page.locator('input[name="fin"]').blur();
  await page.waitForTimeout(200);
  ok((await page.getAttribute('input[name="fin"]', 'aria-invalid')) === 'true', 'validation au blur : fin < début signalée');
  await page.fill('input[name="fin"]', '2026-12-12');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(100);
  ok(await page.isDisabled('button[type="submit"]'), 'bouton désactivé pendant l’envoi');
  await page.waitForSelector('.bandeau--succes', { timeout: 4000 });
  ok(await page.isVisible('.toast--succes'), 'succès : bandeau et toast');

  /* RETEX */
  await page.evaluate(() => { location.hash = '#/retex'; });
  await page.waitForSelector('.retex-graph__svg');
  await page.waitForTimeout(reduit ? 200 : 1000);
  await page.click('button:has-text("Point suivant")');
  await page.waitForTimeout(400);
  const visibles = await page.locator('.g-evt.visible').count();
  ok(visibles === 2 && (await page.isVisible('.retex-bulle.ouverte .retex-bulle__titre')), `RETEX : ${visibles} points révélés, bulle ouverte`);
  await page.focus('.retex-graph__svg');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  ok((await page.locator('.g-evt.visible').count()) === 3, 'RETEX : flèche droite révèle le point suivant');
  await page.click('button:has-text("Tout dérouler")');
  await page.waitForTimeout(reduit ? 300 : 3200);
  ok((await page.locator('.g-evt.visible').count()) === 11 && (await page.locator('.retex-evt').count()) === 11, 'RETEX : tout dérouler → 11 points et 11 cartes');
  ok(await page.isDisabled('button:has-text("Tout dérouler")'), 'RETEX : bouton Tout dérouler désactivé en fin de lecture');

  /* Composants : modale, toasts, badge, chargement */
  await page.evaluate(() => { location.hash = '#/composants'; });
  await page.waitForSelector('button:has-text("Clore l’audit AUD-07")');
  await page.click('button:has-text("Clore l’audit AUD-07")');
  await page.waitForSelector('[role="dialog"]');
  const focusDansModale = await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]')));
  ok(focusDansModale, 'modale : focus initial dans la boîte');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  ok(await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))), 'modale : le focus reste piégé après plusieurs Tab');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 3000 }).catch(() => {});
  ok((await page.locator('[role="dialog"]').count()) === 0, 'modale : Échap ferme');
  ok(await page.evaluate(() => document.activeElement.textContent.indexOf('Clore') >= 0), 'modale : focus rendu au déclencheur');
  await page.click('button:has-text("Clore l’audit AUD-07")');
  await page.waitForTimeout(400);
  await page.click('[role="dialog"] .modale__actions button:has-text("Clore l’audit")');
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 3000 }).catch(() => {});
  await page.waitForSelector('.toast--succes', { timeout: 3000 }).catch(() => {});
  ok((await page.locator('.toast--succes').count()) >= 1, 'modale : confirmation → toast succès');
  await page.click('.bouton--or:has-text("Alerte")');
  await page.click('.bouton--corail:has-text("Erreur")');
  await page.click('button:has-text("Information")');
  await page.waitForTimeout(300);
  ok((await page.locator('.toast').count()) >= 4, 'toasts : quatre types affichés');
  const toastsAvant = await page.locator('.toast').count();
  await page.click('.toast .toast__fermer >> nth=0');
  await page.waitForFunction((n) => document.querySelectorAll('.toast').length < n, toastsAvant, { timeout: 3000 }).catch(() => {});
  ok((await page.locator('.toast').count()) < toastsAvant, `toast : fermeture manuelle (${toastsAvant} → ${await page.locator('.toast').count()})`);
  const texteBadgeAvant = await page.textContent('.demo.mt-2 .badge .badge__texte');
  await page.click('button:has-text("Simuler un changement de statut")');
  await page.waitForTimeout(500);
  const texteBadgeApres = await page.textContent('.demo.mt-2 .badge .badge__texte');
  ok(texteBadgeAvant !== texteBadgeApres, `badge : « ${texteBadgeAvant} » → « ${texteBadgeApres} »`);
  await page.click('button:has-text("Simuler un chargement")');
  await page.waitForSelector('.squelette', { timeout: 2000 }).catch(() => {});
  ok((await page.locator('.squelette').count()) === 1, 'chargement : squelette affiché');
  await page.waitForSelector('.squelette', { state: 'detached', timeout: 4000 }).catch(() => {});
  ok((await page.locator('.squelette').count()) === 0, 'chargement : contenu revenu');

  /* Info-bulles de graphiques (survol et clavier) et View Transitions */
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForSelector('.graphique .g-zone');
  await page.waitForTimeout(reduit ? 150 : 800); /* fin de la transition d'écran avant le survol */
  await page.hover('.graphique .g-zone >> nth=2');
  await page.waitForFunction(() => { const b = document.getElementById('infobulle'); return !b.hidden && b.classList.contains('visible'); }, null, { timeout: 2000 }).catch(() => {});
  const bulleVisible = await page.evaluate(() => { const b = document.getElementById('infobulle'); return !b.hidden && b.classList.contains('visible') && b.textContent.trim().length > 0; });
  ok(bulleVisible, 'info-bulle de graphique affichée au survol (' + (await page.textContent('#infobulle')).trim().replace(/\s+/g, ' ') + ')');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.getElementById('infobulle').hidden), 'info-bulle masquée quand le pointeur sort');
  await page.focus('.graphique .g-zone >> nth=0');
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => !document.getElementById('infobulle').hidden), 'info-bulle affichée au focus clavier');
  await page.evaluate(() => document.activeElement.blur());
  const vt = await page.evaluate(() => ({ api: typeof document.startViewTransition === 'function', nom: getComputedStyle(document.getElementById('vue')).viewTransitionName }));
  ok(vt.api && vt.nom === 'vue', `View Transitions : API ${vt.api ? 'disponible' : 'absente'}, view-transition-name="${vt.nom}"`);
  const retexBulle = await page.evaluate(() => { location.hash = '#/retex'; return true; });
  await page.waitForSelector('.retex-bulle.ouverte .retex-bulle__detail', { timeout: 4000 });
  const titreBulle = await page.textContent('.retex-bulle.ouverte .retex-bulle__titre');
  const detailBulle = await page.textContent('.retex-bulle.ouverte .retex-bulle__detail');
  ok(retexBulle && /^\d+\. .+/.test(titreBulle.trim()) && detailBulle.trim().length > 20, `RETEX : bulle avec titre « ${titreBulle.trim()} » et détail`);

  /* Interrupteur d'animations */
  await page.click('#segment-animations .segment__option[data-valeur="off"]');
  ok((await page.getAttribute('html', 'data-animations')) === 'off', 'interrupteur : data-animations="off"');
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForSelector('.kpi');
  await page.waitForFunction(() => document.querySelector('.kpi.anime'), null, { timeout: 3000 }).catch(() => {});
  const kpiDirect = await page.textContent('.kpi [data-compteur] >> nth=0');
  ok(kpiDirect.trim() !== '0', `animations coupées : compteur affiché directement (${kpiDirect.trim()})`);
  await page.click('#segment-animations .segment__option[data-valeur="on"]');
  ok((await page.getAttribute('html', 'data-animations')) === 'on', 'interrupteur : retour à "on"');

  /* Accessibilité statique */
  await page.evaluate(() => { location.hash = '#/audits'; });
  await page.waitForTimeout(300);
  const stylesInline = await page.evaluate(() => Array.from(document.querySelectorAll('[style]')).filter((el) => {
    const s = el.getAttribute('style');
    return s && s.split(';').some((d) => d.trim() && !d.trim().startsWith('--'));
  }).length);
  ok(stylesInline === 0, `aucun attribut style= hors variables CSS (${stylesInline})`);
  const sansLibelle = await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).filter((el) => !(el.textContent.trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))).length);
  ok(sansLibelle === 0, `boutons et liens tous nommés (${sansLibelle} sans libellé)`);

  ok(journaux.length === 0, journaux.length ? 'console : ' + journaux.join(' | ') : 'console : aucune erreur ni avertissement');
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await parcours(browser, { reduit: false, largeur: 1440, capturer: true });
    await parcours(browser, { reduit: true, largeur: 1440, capturer: false });
    await parcours(browser, { reduit: false, largeur: 1024, capturer: true });
  } finally {
    await browser.close();
  }
  console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nToutes les vérifications passent.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
