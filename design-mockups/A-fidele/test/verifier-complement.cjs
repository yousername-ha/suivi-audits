/* Vérifications complémentaires de la maquette A-fidele (en plus de verifier.cjs) :
   - six ancres à 1440×900 et 1024×768 : console, exceptions, h1, aria-current, défilement horizontal ;
   - mouvement réduit : aucun élément visible à opacité 0 après 1,5 s, graphiques à l'état final ;
   - clavier : Tab depuis le haut de page, indicateur de focus visible (outline ou box-shadow) ;
   - postMessage { type: 'route' } ; badges toujours icône + libellé ; aucun style en ligne hors variables CSS ;
   - contraste des couples texte/fond réellement calculés dans la page (4,5:1).
   Usage : node test/verifier-complement.cjs */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ANCRES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];
const problemes = [];
let contrasteMin = Infinity, contrasteMinLibelle = '';
function verifier(c, m) { if (!c) problemes.push('Assertion : ' + m); }

function ecouter(page, etiquette) {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemes.push(`[${etiquette}] console.${m.type()} : ${m.text()}`); });
  page.on('pageerror', (e) => problemes.push(`[${etiquette}] pageerror : ${e.message}`));
  page.on('requestfailed', (r) => problemes.push(`[${etiquette}] requête échouée : ${r.url()}`));
}

/* Dans la page : éléments visibles à opacité 0 (hors aria-hidden et hors éléments d'infobulle) */
const OPACITE_ZERO = () => {
  const out = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('[aria-hidden="true"]') || el.closest('[hidden]') || el.closest('.sprite') || el.id === 'info-bulle') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (parseFloat(cs.opacity) === 0) out.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '') + (el.id ? '#' + el.id : ''));
  });
  return out;
};

/* Dans la page : couples texte/fond calculés pour les éléments porteurs de texte, composés sur les fonds ancêtres. */
const COUPLES = () => {
  function parse(c) { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function fondDe(el) {
    let acc = null; let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { acc = acc ? { r: acc.r + (1 - acc.a) * c.r * c.a, g: acc.g + (1 - acc.a) * c.g * c.a, b: acc.b + (1 - acc.a) * c.b * c.a, a: acc.a + (1 - acc.a) * c.a } : { r: c.r * c.a, g: c.g * c.a, b: c.b * c.a, a: c.a }; if (acc.a >= 0.999) return acc; }
      n = n.parentElement;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    return acc ? { r: acc.r + (1 - acc.a) * body.r, g: acc.g + (1 - acc.a) * body.g, b: acc.b + (1 - acc.a) * body.b, a: 1 } : body;
  }
  function lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function ratio(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  const out = [];
  const vus = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('svg') || el.closest('[aria-hidden="true"]') || el.closest('[hidden]') || el.disabled || el.closest(':disabled') || el.closest('.bouton:disabled')) return;
    const texte = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!texte) return;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    const fg = parse(cs.color); if (!fg) return;
    const bg = fondDe(el);
    let fgc = fg;
    if (fg.a < 1) fgc = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const cle = el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '') + '|' + cs.color + '|' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b);
    if (vus.has(cle)) return; vus.add(cle);
    const px = parseFloat(cs.fontSize), gras = parseInt(cs.fontWeight, 10) >= 700;
    const grand = px >= 24 || (px >= 18.66 && gras);
    out.push({ el: cle.split('|')[0], texte: texte.slice(0, 30), fg: cs.color, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`, ratio: ratio(fgc, bg), seuil: grand ? 3 : 4.5 });
  });
  return out;
};

async function ecrans(browser, viewport, options, etiquette) {
  const context = await browser.newContext(Object.assign({ viewport }, options));
  const page = await context.newPage();
  ecouter(page, etiquette);
  await page.goto(URL + '#/dashboard');
  await page.waitForSelector('.kpi');
  for (const ancre of ANCRES) {
    await page.evaluate((h) => { location.hash = h; }, ancre);
    await page.waitForTimeout(options.reducedMotion ? 1500 : 1300);
    const titre = await page.locator('h1').first().textContent();
    verifier(titre && titre.trim(), `[${etiquette}] ${ancre} : h1 présent`);
    verifier((await page.locator('.nav__lien[aria-current="page"]').count()) === 1, `[${etiquette}] ${ancre} : une entrée de navigation courante`);
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    verifier(largeur <= viewport.width, `[${etiquette}] ${ancre} : pas de défilement horizontal (${largeur} > ${viewport.width})`);
    const inline = await page.evaluate(() => Array.from(document.querySelectorAll('[style]')).map((e) => e.getAttribute('style')).filter((s) => s && !/^(--[a-z-]+:\s*[^;]+;\s*)+$/.test(s)));
    verifier(inline.length === 0, `[${etiquette}] ${ancre} : styles en ligne hors variables CSS : ${inline.slice(0, 3).join(' | ')}`);
    /* badges : icône ou libellé */
    const badgesNus = await page.evaluate(() => Array.from(document.querySelectorAll('.badge, .gravite, .echeance-delai, .kpi__detail')).filter((b) => !b.textContent.trim()).length);
    verifier(badgesNus === 0, `[${etiquette}] ${ancre} : ${badgesNus} badge(s) sans libellé`);
    const badgesSansIcone = await page.evaluate(() => Array.from(document.querySelectorAll('.badge:not(.badge--contour):not(.badge--vert):not(.badge--marque-violet):not(.badge--info[title]):not(.badge--alerte[title]):not(.badge--gris[title])')).filter((b) => !b.querySelector('svg')).map((b) => b.className + ' « ' + b.textContent.trim() + ' »'));
    verifier(badgesSansIcone.length === 0, `[${etiquette}] ${ancre} : badges d'état sans icône : ${badgesSansIcone.slice(0, 5).join(', ')}`);
    /* opacité 0 */
    const zeros = await page.evaluate(OPACITE_ZERO);
    verifier(zeros.length === 0, `[${etiquette}] ${ancre} : éléments visibles à opacité 0 : ${Array.from(new Set(zeros)).slice(0, 8).join(', ')}`);
    /* graphiques à l'état final */
    if (ancre === '#/dashboard' || ancre === '#/audit/AUD-07' || ancre === '#/retex') {
      const etat = await page.evaluate(() => {
        const arcs = Array.from(document.querySelectorAll('.graphique .arc')).map((a) => Math.abs(parseFloat(getComputedStyle(a).strokeDashoffset) - parseFloat(a.getAttribute('data-offset-final') || '0')));
        const courbes = Array.from(document.querySelectorAll('.graphique .courbe')).map((c) => Math.abs(parseFloat(getComputedStyle(c).strokeDashoffset)));
        const barres = Array.from(document.querySelectorAll('.graphique .barre')).map((b) => getComputedStyle(b).transform);
        const prog = Array.from(document.querySelectorAll('.progression__valeur')).filter((p) => p.getBoundingClientRect().height > 0).map((p) => ({ t: getComputedStyle(p).transform, p: parseFloat(p.getAttribute('data-p')) }));
        return { arcs, courbes, barres, prog, animes: document.querySelectorAll('.graphique:not(.graphique--mini):not(.est-anime)').length };
      });
      verifier(etat.arcs.every((o) => o < 0.5), `[${etiquette}] ${ancre} : arcs à l'état final (${etat.arcs.map((o) => o.toFixed(1)).join(',')})`);
      verifier(etat.courbes.every((o) => o < 0.5), `[${etiquette}] ${ancre} : courbes tracées (${etat.courbes.map((o) => o.toFixed(1)).join(',')})`);
      verifier(etat.barres.every((t) => t === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(t)), `[${etiquette}] ${ancre} : barres à l'échelle 1 (${etat.barres.filter((t) => !(t === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(t))).slice(0, 3).join(' ; ')})`);
      verifier(etat.prog.every((p) => { const m = p.t.match(/matrix\(([^,]+),/); return m && Math.abs(parseFloat(m[1]) - p.p) < 0.02; }), `[${etiquette}] ${ancre} : barres de progression à leur valeur`);
      verifier(etat.animes === 0, `[${etiquette}] ${ancre} : ${etat.animes} graphique(s) sans est-anime`);
    }
    /* contraste des couples réellement calculés */
    if (etiquette === 'normal-1440') {
      const couples = await page.evaluate(COUPLES);
      couples.forEach((c) => {
        if (c.ratio < contrasteMin) { contrasteMin = c.ratio; contrasteMinLibelle = `${c.el} « ${c.texte} » ${c.fg} sur ${c.bg} (${ancre})`; }
        verifier(c.ratio >= c.seuil, `${ancre} : contraste ${c.ratio.toFixed(2)} < ${c.seuil} pour ${c.el} « ${c.texte} » ${c.fg} sur ${c.bg}`);
      });
    }
    /* clavier : Tab depuis le haut */
    if (etiquette === 'normal-1440' || etiquette === 'normal-1024') {
      /* Repart du haut du document : on retire le focus programmatique posé par le routeur sur #contenu. */
      await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); window.__precedentFocus = null; });
      const sansIndicateur = [];
      let parcourus = 0, passagesCorps = 0;
      for (let i = 0; i < 120; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(async () => {
          const el = document.activeElement; if (!el || el === document.body) { window.__precedentFocus = null; return { corps: true }; }
          /* Attend la fin des transitions (box-shadow, border-color) avant de lire les styles calculés. */
          if (el.getAnimations) await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {})));
          /* Les champs date de Chromium gardent le focus sur le même élément pendant la traversée de leurs sous-champs. */
          const meme = window.__precedentFocus === el && !(el.tagName === 'INPUT' && el.type === 'date'); window.__precedentFocus = el;
          const cs = getComputedStyle(el);
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          const ombre = cs.boxShadow && cs.boxShadow !== 'none';
          const desc = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.getAttribute('class') ? '.' + el.getAttribute('class').split(' ')[0] : '');
          return { desc, meme, ok: outline || ombre, fv: el.matches(':focus-visible') };
        });
        if (!info || info.meme) break;
        if (info.corps) { if (++passagesCorps > 1) break; continue; }
        parcourus++;
        if (!info.ok) sansIndicateur.push(info.desc + (info.fv ? '' : ' (pas :focus-visible)'));
      }
      verifier(parcourus >= 15, `[${etiquette}] ${ancre} : parcours Tab trop court (${parcourus} éléments)`);
      verifier(sansIndicateur.length === 0, `[${etiquette}] ${ancre} : focus sans indicateur visible (${parcourus} parcourus) : ${Array.from(new Set(sansIndicateur)).join(', ')}`);
      if (etiquette === 'normal-1440') console.log(`${ancre} : ${parcourus} éléments parcourus au clavier`);
    }
  }
  /* postMessage */
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*'));
  await page.waitForTimeout(400);
  verifier((await page.evaluate(() => location.hash)) === '#/audits', `[${etiquette}] postMessage → location.hash = #/audits`);
  verifier((await page.locator('#corps-table tr').count()) > 0, `[${etiquette}] postMessage → écran liste rendu`);
  verifier((await page.locator('.nav__lien[aria-current="page"]').getAttribute('href')) === '#/audits', `[${etiquette}] postMessage → navigation à jour`);

  /* RETEX en mouvement réduit : tout dérouler → tout visible immédiatement, enseignements visibles */
  if (options.reducedMotion) {
    await page.evaluate(() => { location.hash = '#/retex'; });
    await page.waitForSelector('#retex-tout');
    await page.click('#retex-tout');
    await page.waitForTimeout(300);
    verifier((await page.locator('.evenement.est-visible').count()) === 11, `[${etiquette}] retex : 11 points visibles`);
    verifier((await page.locator('#retex-fin').isVisible()), `[${etiquette}] retex : enseignements visibles`);
    const zeros = await page.evaluate(OPACITE_ZERO);
    verifier(zeros.length === 0, `[${etiquette}] retex déroulé : opacité 0 : ${zeros.slice(0, 5).join(', ')}`);
    /* toasts et modale en mouvement réduit */
    await page.evaluate(() => { location.hash = '#/composants'; });
    await page.waitForSelector('[data-toast="succes"]');
    await page.click('[data-toast="succes"]');
    await page.waitForTimeout(300);
    verifier(parseFloat(await page.locator('.toast').first().evaluate((e) => getComputedStyle(e).opacity)) === 1, `[${etiquette}] toast opaque`);
    await page.click('#demo-modale');
    await page.waitForTimeout(300);
    verifier(parseFloat(await page.locator('.modale__boite').evaluate((e) => getComputedStyle(e).opacity)) === 1, `[${etiquette}] modale opaque`);
    await page.keyboard.press('Escape');
  }
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await ecrans(browser, { width: 1440, height: 900 }, {}, 'normal-1440');
    await ecrans(browser, { width: 1024, height: 768 }, {}, 'normal-1024');
    await ecrans(browser, { width: 1440, height: 900 }, { reducedMotion: 'reduce' }, 'reduit-1440');
    await ecrans(browser, { width: 1024, height: 768 }, { reducedMotion: 'reduce' }, 'reduit-1024');
  } catch (e) {
    problemes.push('Exception du test : ' + (e.stack || e.message));
  } finally {
    await browser.close();
  }
  console.log('Contraste texte minimal mesuré dans la page : ' + contrasteMin.toFixed(2) + ' — ' + contrasteMinLibelle);
  if (problemes.length) { console.error(problemes.length + ' problème(s) :\n- ' + problemes.join('\n- ')); process.exit(1); }
  console.log('Vérifications complémentaires : aucun problème.');
})();
