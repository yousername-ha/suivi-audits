/* Vérifications complémentaires (accessibilité) de la maquette D : mouvement réduit (aucun élément visible à
   opacité 0 après 1,5 s, tracés complets), parcours clavier (indicateur de focus sur chaque arrêt), contraste
   mesuré dans le navigateur (chaque élément textuel visible contre son fond composé), aria-sort, postMessage.
   Usage : node test/verifier-a11y.cjs */
'use strict';
var path = require('path');
var { chromium } = require('playwright');
var URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
var ANCRES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];
var echecs = [];
function ok(cond, msg) { if (cond) console.log('  ok  ' + msg); else { console.log('  KO  ' + msg); echecs.push(msg); } }

/* Exécuté dans la page : liste les éléments visibles (boîte non nulle, hors [hidden]) dont l'opacité calculée est 0. */
function opacitesNulles() {
  var res = [];
  var tous = document.querySelectorAll('body *');
  for (var i = 0; i < tous.length; i++) {
    var e = tous[i];
    if (e.closest('[hidden]') || e.closest('.sprite')) continue;
    var r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    var cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity) === 0) {
      res.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') + (e.id ? '#' + e.id : ''));
    }
  }
  return res;
}

/* Exécuté dans la page : contraste de chaque élément portant un nœud texte visible contre son fond composé. */
function contrastes() {
  function parse(c) {
    var m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function sur(haut, bas) { /* compose haut (avec alpha) sur bas (opaque) */
    var a = haut.a;
    return { r: haut.r * a + bas.r * (1 - a), g: haut.g * a + bas.g * (1 - a), b: haut.b * a + bas.b * (1 - a), a: 1 };
  }
  function fondDe(e) {
    var couches = [];
    var n = e;
    while (n && n.nodeType === 1) {
      var cs = getComputedStyle(n);
      var bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) couches.push(bg);
      if (bg && bg.a >= 1) break;
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundImage.indexOf('gradient') !== -1) couches.push({ degrade: true });
      n = n.parentElement;
    }
    var fond = parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 11, g: 18, b: 32, a: 1 };
    for (var i = couches.length - 1; i >= 0; i--) {
      if (couches[i].degrade) return null;
      fond = sur(couches[i], fond);
    }
    return fond;
  }
  function ratio(a, b) { var l1 = lum(a), l2 = lum(b); var hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
  function desc(e) {
    return e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (e.id ? '#' + e.id : '');
  }
  var res = [];
  var tous = document.querySelectorAll('body *');
  for (var i = 0; i < tous.length; i++) {
    var e = tous[i];
    if (e.closest('[hidden]') || e.closest('.sprite') || e.closest('svg') || e.closest('[aria-hidden="true"]')) continue;
    var texte = '';
    for (var k = 0; k < e.childNodes.length; k++) if (e.childNodes[k].nodeType === 3) texte += e.childNodes[k].nodeValue;
    if (!texte.trim()) continue;
    var r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    var cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    if (e.matches(':disabled, [aria-disabled="true"], :disabled *')) continue; /* composants inactifs : exemptés (WCAG 1.4.3) */
    /* opacité héritée (ancêtre translucide) : on la signale mais on ne la compose pas */
    var opac = 1; var p = e;
    while (p && p.nodeType === 1) { opac *= parseFloat(getComputedStyle(p).opacity); p = p.parentElement; }
    var couleur = parse(cs.color);
    var fond = fondDe(e);
    if (!couleur || !fond) { res.push({ el: desc(e), texte: texte.trim().slice(0, 30), ratio: null, note: 'fond dégradé' }); continue; }
    if (couleur.a < 1) couleur = sur(couleur, fond);
    var taille = parseFloat(cs.fontSize);
    var gras = parseInt(cs.fontWeight, 10) >= 700;
    var grand = taille >= 24 || (taille >= 18.66 && gras);
    res.push({ el: desc(e), texte: texte.trim().slice(0, 30), couleur: cs.color, fond: 'rgb(' + Math.round(fond.r) + ', ' + Math.round(fond.g) + ', ' + Math.round(fond.b) + ')', ratio: ratio(couleur, fond), grand: grand, opacite: opac, seuil: grand ? 3 : 4.5 });
  }
  return res;
}

async function parcoursClavier(page, nom, maxTabs) {
  await page.evaluate(function () { document.activeElement.blur(); window.scrollTo(0, 0); });
  var sansIndicateur = [];
  var vus = 0;
  for (var i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200); /* les anneaux de focus apparaissent par transition de 150 ms */
    var info = await page.evaluate(function () {
      var a = document.activeElement;
      if (!a || a === document.body) return null;
      var cs = getComputedStyle(a);
      var outlineOk = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      var ombreOk = cs.boxShadow && cs.boxShadow !== 'none' && /rgb/.test(cs.boxShadow.replace(/rgba\(0, 0, 0, 0\)/g, '')); /* au moins une couleur non transparente */
      var d = a.tagName.toLowerCase() + (a.className && typeof a.className === 'string' ? '.' + a.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (a.id ? '#' + a.id : '');
      return { desc: d, ok: outlineOk || ombreOk, outline: cs.outlineStyle + ' ' + cs.outlineWidth, shadow: cs.boxShadow, matches: a.matches(':focus-visible') };
    });
    if (!info) break;
    vus++;
    if (!info.ok) sansIndicateur.push(info.desc + ' (outline ' + info.outline + ', box-shadow ' + info.shadow + ', focus-visible=' + info.matches + ')');
  }
  ok(sansIndicateur.length === 0, nom + ' : indicateur de focus sur chacun des ' + vus + ' arrêts de tabulation' + (sansIndicateur.length ? ' — manquants : ' + sansIndicateur.join(' ; ') : ''));
}

(async function () {
  var browser = await chromium.launch();
  var minimumTexte = Infinity, minimumDetail = '';
  try {
    /* 1. Console sur six ancres, deux viewports */
    for (var v of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
      var ctx = await browser.newContext({ viewport: v });
      var page = await ctx.newPage();
      var problemes = [];
      page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') problemes.push(m.type() + ' : ' + m.text()); });
      page.on('pageerror', function (e) { problemes.push('pageerror : ' + e.message); });
      console.log('\nViewport ' + v.width + '×' + v.height);
      for (var a of ANCRES) {
        await page.goto(URL + a);
        await page.waitForTimeout(1500);
        var h1 = (await page.locator('h1').first().textContent()).trim();
        var depasse = await page.evaluate(function () { return document.documentElement.scrollWidth > document.documentElement.clientWidth; });
        ok(h1.length > 0 && !depasse, a + ' → « ' + h1 + ' »' + (depasse ? ' (DÉBORDEMENT HORIZONTAL)' : ''));
        if (v.width === 1440) {
          var c = await page.evaluate(contrastes);
          var mauvais = c.filter(function (x) { return x.ratio !== null && x.ratio < x.seuil; });
          var min = c.filter(function (x) { return x.ratio !== null; }).reduce(function (m, x) { return x.ratio < m.ratio ? x : m; }, { ratio: Infinity });
          if (min.ratio < minimumTexte) { minimumTexte = min.ratio; minimumDetail = min.el + ' « ' + min.texte + ' » ' + min.couleur + ' sur ' + min.fond + ' (' + a + ')'; }
          var inconnus = c.filter(function (x) { return x.ratio === null; });
          ok(mauvais.length === 0, a + ' : contraste de ' + c.length + ' éléments textuels, minimum ' + min.ratio.toFixed(2) + ':1 (' + min.el + ' « ' + min.texte + ' »)' + (mauvais.length ? ' — insuffisants : ' + mauvais.map(function (x) { return x.el + ' « ' + x.texte + ' » ' + x.ratio.toFixed(2); }).join(' ; ') : '') + (inconnus.length ? ' — non mesurés (dégradé) : ' + inconnus.map(function (x) { return x.el; }).join(', ') : ''));
          var translucides = c.filter(function (x) { return x.opacite < 1 && x.opacite > 0; });
          if (translucides.length) console.log('      note : éléments textuels sous opacité héritée < 1 : ' + translucides.map(function (x) { return x.el + ' (' + x.opacite.toFixed(2) + ')'; }).join(', '));
        }
      }
      if (v.width === 1440) {
        /* aria-sort */
        await page.goto(URL + '#/audits');
        await page.waitForTimeout(300);
        var sortsInitiaux = await page.locator('th[aria-sort]').count();
        await page.locator('th .tri', { hasText: 'Statut' }).click();
        var asc = await page.locator('th[aria-sort="ascending"]').count();
        var autres = await page.locator('th[aria-sort="none"]').count();
        ok(asc === 1 && sortsInitiaux >= 1, 'aria-sort : un seul en-tête « ascending » après clic (' + autres + ' en-têtes « none », ' + sortsInitiaux + ' au départ)');
        /* postMessage */
        await page.goto(URL + '#/dashboard');
        await page.waitForTimeout(300);
        await page.evaluate(function () { window.postMessage({ type: 'route', hash: '#/audits' }, '*'); });
        await page.waitForTimeout(300);
        var h1pm = (await page.locator('h1').first().textContent()).trim();
        ok(page.url().indexOf('#/audits') !== -1 && h1pm === 'Audits', 'postMessage {type:route, hash:#/audits} → hash et écran « ' + h1pm + ' »');
        /* 5. Clavier : Tab depuis le haut de chaque écran */
        for (var a2 of ANCRES) {
          await page.goto(URL + a2);
          await page.waitForTimeout(400);
          await parcoursClavier(page, a2, 90);
        }
        /* Clavier : sans la souris, la liste puis la fiche */
        await page.goto(URL + '#/audits');
        await page.waitForTimeout(300);
        await page.locator('.tableau tbody tr').first().locator('a').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        ok(/#\/audit\/AUD-\d\d/.test(page.url()), 'liste → fiche au clavier (Entrée sur le lien de la ligne) : ' + page.url().split('#')[1]);
      }
      ok(problemes.length === 0, 'aucune erreur ni avertissement console (' + v.width + ')' + (problemes.length ? ' — ' + problemes.join(' | ') : ''));
      await ctx.close();
    }

    /* 4. Mouvement réduit */
    var ctxR = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    var pageR = await ctxR.newPage();
    var problemesR = [];
    pageR.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') problemesR.push(m.type() + ' : ' + m.text()); });
    pageR.on('pageerror', function (e) { problemesR.push('pageerror : ' + e.message); });
    console.log('\nMouvement réduit');
    for (var a3 of ANCRES) {
      await pageR.goto(URL + a3);
      await pageR.waitForTimeout(1500);
      var nuls = await pageR.evaluate(opacitesNulles);
      ok(nuls.length === 0, a3 + ' : aucun élément visible à opacité 0 après 1,5 s' + (nuls.length ? ' — ' + nuls.slice(0, 12).join(', ') + (nuls.length > 12 ? ' … (' + nuls.length + ')' : '') : ''));
      var traces = await pageR.evaluate(function () {
        var res = { total: 0, incomplets: [] };
        document.querySelectorAll('.graphique .trace, .graphique .segment').forEach(function (p) {
          res.total++;
          var cs = getComputedStyle(p);
          if (parseFloat(cs.strokeDashoffset) !== 0) res.incomplets.push(p.getAttribute('class') + ' offset=' + cs.strokeDashoffset);
        });
        document.querySelectorAll('.graphique .barre, .graphique .colonne').forEach(function (b) {
          res.total++;
          var t = getComputedStyle(b).transform;
          if (t !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(t)) res.incomplets.push(b.getAttribute('class') + ' transform=' + t);
        });
        return res;
      });
      if (traces.total) ok(traces.incomplets.length === 0, a3 + ' : ' + traces.total + ' tracés/barres dessinés complètement' + (traces.incomplets.length ? ' — ' + traces.incomplets.slice(0, 6).join(' ; ') : ''));
    }
    /* Mouvement réduit : la navigation entre écrans (second rendu) ne laisse pas l'écran à opacité 0 */
    await pageR.goto(URL + '#/dashboard');
    await pageR.waitForTimeout(300);
    await pageR.evaluate(function () { location.hash = '#/retex'; });
    await pageR.waitForTimeout(300);
    var opEcran = await pageR.evaluate(function () { return getComputedStyle(document.getElementById('ecran')).opacity; });
    ok(parseFloat(opEcran) === 1, 'changement d’écran en mouvement réduit : écran à opacité ' + opEcran);
    /* RETEX : tout dérouler → points visibles */
    await pageR.locator('.bouton', { hasText: 'Tout dérouler' }).click();
    await pageR.waitForTimeout(300);
    var nulsRetex = await pageR.evaluate(opacitesNulles);
    ok(nulsRetex.length === 0, 'RETEX déroulé en mouvement réduit : aucun élément à opacité 0' + (nulsRetex.length ? ' — ' + nulsRetex.slice(0, 8).join(', ') : ''));
    ok(problemesR.length === 0, 'aucune erreur console (mouvement réduit)' + (problemesR.length ? ' — ' + problemesR.join(' | ') : ''));
    await ctxR.close();

    console.log('\nContraste minimum mesuré (texte) : ' + minimumTexte.toFixed(2) + ':1 — ' + minimumDetail);
    if (echecs.length) { console.log('\n' + echecs.length + ' échec(s).'); process.exit(1); }
    console.log('\nTout est passé.');
  } finally {
    await browser.close();
  }
})().catch(function (e) { console.error(e.stack || e.message); process.exit(1); });
