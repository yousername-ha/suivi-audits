/* Vérifications complémentaires de la maquette F : opacité résiduelle en mouvement réduit et avec l'interrupteur
   « Animations » coupé, compteurs à leur valeur finale, indicateur de focus au Tab, postMessage, console propre,
   à 1440 et 1024 px. Usage : node test/complement.cjs */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ANCRES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];
let echecs = 0;
function ok(cond, message) {
  if (cond) console.log('  OK  ' + message);
  else { echecs += 1; console.log('  KO  ' + message); }
}

/* Éléments visibles (dans le flux, non masqués) dont l'opacité calculée est 0, après stabilisation. */
const OPACITE_ZERO = () => {
  const res = [];
  const tous = document.querySelectorAll('#vue *, .entete *, .nav *');
  tous.forEach((el) => {
    if (el.closest('[hidden], [aria-hidden="true"].sprite')) return;
    /* États intentionnels : points du RETEX pas encore déroulés (lecture point par point). */
    if (el.closest('.g-evt:not(.visible)')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    /* En mode animé, ce qui est sous la ligne de flottaison attend l'IntersectionObserver (repli à 1,5 s + durée). */
    if (window.__strictViewport && r.top > window.innerHeight) return;
    if (parseFloat(cs.opacity) === 0) {
      res.push((el.tagName.toLowerCase()) + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.id ? '#' + el.id : ''));
    }
  });
  return res;
};

async function ecransComplets(page, libelle) {
  const anime = libelle === 'anim';
  await page.evaluate((v) => { window.__strictViewport = v; }, anime);
  for (const ancre of ANCRES) {
    await page.evaluate((h) => { location.hash = h; }, ancre);
    await page.waitForTimeout(1500);
    const zeros = await page.evaluate(OPACITE_ZERO);
    ok(zeros.length === 0, `${libelle} ${ancre} : aucun élément visible à opacité 0` + (zeros.length ? ' — ' + zeros.slice(0, 8).join(', ') + (zeros.length > 8 ? ` (+${zeros.length - 8})` : '') : ''));
    if (ancre === '#/dashboard') {
      const compteurs = await page.evaluate(() => Array.from(document.querySelectorAll('[data-compteur]')).map((el) => ({ v: el.textContent.trim(), cible: el.getAttribute('data-compteur') })));
      const aZero = compteurs.filter((c) => /^0(\s|%|$)/.test(c.v) && !/^0([.,]0+)?$/.test(String(c.cible)));
      ok(compteurs.length > 0 && aZero.length === 0, `${libelle} dashboard : ${compteurs.length} compteurs à leur valeur finale` + (aZero.length ? ' — à 0 : ' + JSON.stringify(aZero) : ''));
      const svgs = await page.evaluate(() => Array.from(document.querySelectorAll('#vue svg')).filter((sv) => sv.getBoundingClientRect().width > 40).length);
      ok(svgs >= 3, `${libelle} dashboard : ${svgs} graphiques SVG dessinés`);
      const traces = await page.evaluate(() => Array.from(document.querySelectorAll('#vue path, #vue circle, #vue rect, #vue line')).filter((el) => {
        const cs = getComputedStyle(el);
        const dash = cs.strokeDashoffset;
        const r = el.getBoundingClientRect();
        return r.width > 0 && (parseFloat(cs.opacity) === 0 || (cs.transform !== 'none' && /matrix\(1, 0, 0, 0,/.test(cs.transform)));
      }).length);
      if (!anime) ok(traces === 0, `${libelle} dashboard : aucun tracé SVG invisible (opacité 0 ou scaleY 0) — ${traces}`);
      else {
        /* Mode animé : tout doit être révélé une fois le repli de l'observateur écoulé (1,5 s + 1,2 s de tracé). */
        await page.waitForTimeout(2500);
        const restes = await page.evaluate(OPACITE_ZERO);
        ok(restes.length === 0, `${libelle} dashboard : tout révélé après 4 s (y compris hors écran) — ${restes.length}`);
      }
    }
    if (ancre === '#/retex') {
      const retex = await page.evaluate(() => ({ visibles: document.querySelectorAll('.g-evt.visible').length, cartes: document.querySelectorAll('.retex-evt').length, svg: Boolean(document.querySelector('.retex-graph__svg')) }));
      ok(retex.svg && retex.visibles >= 1 && retex.cartes >= 1, `${libelle} retex : graphique présent, ${retex.visibles} point(s) révélé(s), ${retex.cartes} carte(s)`);
    }
  }
}

async function parcours(browser, largeur) {
  console.log(`\n== Complément · ${largeur} px ==`);
  const journaux = [];
  const brancher = (page) => {
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') journaux.push(m.type() + ' : ' + m.text()); });
    page.on('pageerror', (e) => journaux.push('pageerror : ' + e.message));
  };

  /* 1. Mouvement réduit : contexte dédié */
  const ctxReduit = await browser.newContext({ viewport: { width: largeur, height: largeur === 1440 ? 900 : 768 }, reducedMotion: 'reduce' });
  const pageR = await ctxReduit.newPage();
  brancher(pageR);
  await pageR.goto(URL + '#/dashboard');
  await pageR.waitForSelector('.kpi');
  ok((await pageR.getAttribute('html', 'data-animations')) === 'off', 'mouvement réduit : data-animations="off" posé automatiquement');
  await ecransComplets(pageR, 'reduce');
  await ctxReduit.close();

  /* 2. Animations activées, puis interrupteur « Désactivées » */
  const ctx = await browser.newContext({ viewport: { width: largeur, height: largeur === 1440 ? 900 : 768 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  brancher(page);
  await page.goto(URL + '#/dashboard');
  await page.waitForSelector('.kpi');
  await ecransComplets(page, 'anim');
  await page.click('#segment-animations .segment__option[data-valeur="off"]');
  ok((await page.getAttribute('html', 'data-animations')) === 'off', 'interrupteur : data-animations="off"');
  const animsActives = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().duration > 50).length);
  ok(animsActives === 0, `interrupteur off : ${animsActives} animation(s) encore en cours de plus de 50 ms`);
  await ecransComplets(page, 'switch-off');

  /* 3. postMessage */
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*'));
  await page.waitForTimeout(400);
  const pm = await page.evaluate(() => ({ hash: location.hash, tableau: Boolean(document.querySelector('.tableau tbody tr')), courant: (document.querySelector('.nav__liste a[aria-current="page"]') || {}).getAttribute ? document.querySelector('.nav__liste a[aria-current="page"]').getAttribute('href') : null }));
  ok(pm.hash === '#/audits' && pm.tableau && pm.courant === '#/audits', `postMessage : hash=${pm.hash}, tableau rendu=${pm.tableau}, nav=${pm.courant}`);

  /* 4. Clavier : Tab depuis le haut, indicateur de focus visible sur chaque élément focalisé */
  await page.click('#segment-animations .segment__option[data-valeur="on"]');
  for (const ancre of ['#/dashboard', '#/audits', '#/formulaire', '#/composants']) {
    await page.evaluate((h) => { location.hash = h; }, ancre);
    await page.waitForTimeout(900);
    await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
    const sansIndicateur = [];
    const vus = new Set();
    let n = 0;
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const ombre = cs.boxShadow && cs.boxShadow !== 'none';
        /* indicateur porté par un pseudo-élément ou un parent (ex. champ dans un conteneur) */
        const apres = getComputedStyle(el, '::after');
        const avant = getComputedStyle(el, '::before');
        const pseudo = [apres, avant].some((p) => p.content !== 'none' && ((p.outlineStyle !== 'none' && parseFloat(p.outlineWidth) > 0) || (p.boxShadow && p.boxShadow !== 'none')));
        const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
        const parentOmbre = parent && el.parentElement.matches(':focus-within') && ((parent.outlineStyle !== 'none' && parseFloat(parent.outlineWidth) > 0) || (parent.boxShadow && parent.boxShadow !== 'none'));
        const desc = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' « ' + (el.textContent || el.getAttribute('aria-label') || el.name || '').trim().slice(0, 28) + ' »';
        return { desc, visible: outline || ombre || pseudo || parentOmbre, outline: cs.outline, boxShadow: cs.boxShadow.slice(0, 60) };
      });
      if (!info) break;
      if (vus.has(info.desc)) break;
      vus.add(info.desc);
      n += 1;
      if (!info.visible) sansIndicateur.push(info.desc + ' [outline=' + info.outline + ' ; box-shadow=' + info.boxShadow + ']');
    }
    ok(n > 3 && sansIndicateur.length === 0, `${ancre} : ${n} éléments parcourus au Tab, ${sansIndicateur.length} sans indicateur de focus` + (sansIndicateur.length ? ' — ' + sansIndicateur.slice(0, 6).join(' ; ') : ''));
  }

  ok(journaux.length === 0, journaux.length ? 'console : ' + journaux.join(' | ') : 'console : aucune erreur ni avertissement');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await parcours(browser, 1440);
    await parcours(browser, 1024);
  } finally {
    await browser.close();
  }
  console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nToutes les vérifications complémentaires passent.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
