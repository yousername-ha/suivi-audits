/* Audit complémentaire de la maquette E (Playwright) : six ancres à 1440 et 1024, interactions clés, postMessage,
   mouvement réduit (aucun élément visible à opacité 0 après 1,5 s), indicateur de focus au clavier, contrastes
   mesurés sur les styles calculés (texte / fond effectif), statuts icône + libellé.
   Usage : node design-mockups/E-data-dense/test/audit-complementaire.cjs */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ROUTES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];

function lum(rgb) {
  const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function ratio(a, b) {
  const l1 = lum(a); const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/* Évalué dans la page : couleur de texte et fond effectif (alpha composé sur les ancêtres) des éléments textuels visibles. */
const SCRIPT_PAIRES = `(() => {
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const fondDe = (el) => {
    let acc = null; let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n); const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        if (!acc) acc = bg;
        else if (acc.a < 1) acc = { r: acc.r * acc.a + bg.r * (1 - acc.a), g: acc.g * acc.a + bg.g * (1 - acc.a), b: acc.b * acc.a + bg.b * (1 - acc.a), a: Math.min(1, acc.a + bg.a * (1 - acc.a)) };
        if (acc.a >= 1) break;
      }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      n = n.parentElement;
    }
    if (!acc) acc = { r: 255, g: 255, b: 255, a: 1 };
    if (acc.a < 1) acc = { r: acc.r * acc.a + 255 * (1 - acc.a), g: acc.g * acc.a + 255 * (1 - acc.a), b: acc.b * acc.a + 255 * (1 - acc.a), a: 1 };
    return [acc.r, acc.g, acc.b];
  };
  const out = [];
  document.querySelectorAll('body *:not(script):not(style):not(svg):not(svg *)').forEach((el) => {
    const texte = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!texte) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    let op = 1; let n = el; while (n && n.nodeType === 1) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
    if (op < 0.95) return;
    const c = parse(cs.color); if (!c) return;
    const fond = fondDe(el); if (!fond) return;
    const taille = parseFloat(cs.fontSize); const graisse = parseInt(cs.fontWeight, 10);
    const grand = taille >= 24 || (taille >= 18.66 && graisse >= 700);
    out.push({ texte: texte.slice(0, 30), classe: (el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 50), tag: el.tagName.toLowerCase(), couleur: [c.r, c.g, c.b], fond, grand });
  });
  return out;
})()`;

const SCRIPT_OPACITE_ZERO = `(() => {
  const out = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('[hidden]') || el.closest('#toasts') || el.closest('#infobulle')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (parseFloat(cs.opacity) === 0) out.push(el.tagName.toLowerCase() + '.' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 40));
  });
  return out;
})()`;

async function main() {
  const browser = await chromium.launch();
  const problemes = [];
  const paires = new Map();
  let reducedMotionOk = true; let postMessageOk = false;

  async function session(options, etiquette) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemes.push(`[${etiquette}] console.${m.type()} : ${m.text()}`); });
    page.on('pageerror', (e) => problemes.push(`[${etiquette}] pageerror : ${e.message}`));
    return { context, page };
  }

  async function collecterPaires(page, etiquette) {
    const liste = await page.evaluate(SCRIPT_PAIRES);
    liste.forEach((p) => {
      const cle = hex(p.couleur) + '/' + hex(p.fond);
      const r = ratio(p.couleur, p.fond);
      if (!paires.has(cle)) paires.set(cle, { ratio: r, grand: p.grand, exemples: new Set() });
      const e = paires.get(cle); if (!p.grand) e.grand = false;
      if (e.exemples.size < 3) e.exemples.add(`${etiquette} ${p.tag}.${p.classe} « ${p.texte} »`);
    });
  }

  /* ---- 1440 et 1024 : six ancres, console propre, débordement, paires de contraste */
  for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    const et = String(vp.width);
    const { context, page } = await session({ viewport: vp }, et);
    for (const r of ROUTES) {
      console.log(`[${et}] ${r}`);
      await page.goto(URL + r); await page.waitForTimeout(1300);
      const courant = await page.getAttribute('.nav-lien[aria-current="page"]', 'href');
      if (courant !== r) problemes.push(`[${et}] ${r} : aria-current = ${courant}`);
      const vide = await page.$eval('#contenu', (m) => m.children.length === 0);
      if (vide) problemes.push(`[${et}] ${r} : écran vide`);
      const debord = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (debord) problemes.push(`[${et}] ${r} : débordement horizontal`);
      await collecterPaires(page, `${et} ${r}`);
      /* Statuts : chaque pastille porte une icône ou un libellé */
      const sansIcone = await page.$$eval('.pastille', (els) => els.filter((e) => !e.querySelector('svg, .point-statut') && !e.textContent.trim()).length);
      if (sansIcone) problemes.push(`[${et}] ${r} : ${sansIcone} pastille(s) sans icône ni libellé`);
      const sansLibelle = await page.$$eval('.pastille', (els) => els.filter((e) => !e.textContent.trim() && !e.getAttribute('aria-label') && !e.getAttribute('title')).length);
      if (sansLibelle) problemes.push(`[${et}] ${r} : ${sansLibelle} pastille(s) icône seule sans aria-label`);
    }
    /* Fiche : état survol/onglets pour couvrir le texte des onglets inactifs et les pastilles de constats */
    await page.goto(URL + '#/audit/AUD-07'); await page.waitForTimeout(400);
    for (const id of ['constats', 'actions', 'historique']) { await page.click('#onglet-' + id); await page.waitForTimeout(250); await collecterPaires(page, `${et} onglet ${id}`); }
    /* Formulaire en erreur : messages d'erreur */
    await page.goto(URL + '#/formulaire'); await page.waitForTimeout(300);
    await page.click('button[type="submit"]'); await page.waitForTimeout(200);
    await collecterPaires(page, `${et} formulaire erreurs`);
    /* Composants : toasts et modale ouverts */
    await page.goto(URL + '#/composants'); await page.waitForTimeout(300);
    for (const t of ['succes', 'alerte', 'erreur', 'info']) await page.click(`[data-toast="${t}"]`);
    await page.waitForTimeout(350);
    await collecterPaires(page, `${et} toasts`);
    await page.click('#btn-ouvrir-modale'); await page.waitForTimeout(350);
    await collecterPaires(page, `${et} modale`);
    await page.keyboard.press('Escape');
    /* Liste : menu de filtre ouvert, jetons actifs */
    await page.goto(URL + '#/audits'); await page.waitForTimeout(300);
    await page.click('.menu-filtre >> nth=0 >> button.btn'); await page.waitForTimeout(200);
    await page.check('#menu-statut input[value="Clos"]'); await page.waitForTimeout(150);
    await collecterPaires(page, `${et} menu filtre`);
    await page.keyboard.press('Escape');
    /* RETEX déroulé */
    await page.goto(URL + '#/retex'); await page.waitForTimeout(300);
    await page.click('text=Tout dérouler'); await page.waitForTimeout(400);
    await collecterPaires(page, `${et} retex`);
    await context.close();
  }

  /* ---- Interactions (1440) */
  {
    const { context, page } = await session({}, 'interactions');
    console.log('[interactions]');
    // Onglets
    await page.goto(URL + '#/audit/AUD-07'); await page.waitForTimeout(400);
    for (const id of ['synthese', 'constats', 'actions', 'historique']) {
      await page.click('#onglet-' + id); await page.waitForTimeout(150);
      if ((await page.getAttribute('#onglet-' + id, 'aria-selected')) !== 'true') problemes.push(`onglet ${id} non sélectionné`);
      if (await page.isHidden('#panneau-' + id)) problemes.push(`panneau ${id} caché`);
    }
    // Liste : recherche, filtre, tri, page, ligne → fiche
    await page.goto(URL + '#/audits'); await page.waitForTimeout(300);
    await page.fill('#recherche-audits', 'hds'); await page.waitForTimeout(150);
    if (!/2 audits/.test(await page.textContent('#compte-resultats'))) problemes.push('recherche « hds » : compte inattendu');
    await page.fill('#recherche-audits', ''); await page.waitForTimeout(150);
    await page.click('.menu-filtre >> nth=1 >> button.btn'); await page.waitForTimeout(150);
    await page.click('#menu-type input[type="checkbox"] >> nth=0'); await page.waitForTimeout(200);
    if (!(await page.$('#menu-type input[type="checkbox"]:checked'))) problemes.push('filtre type : case non cochée après clic');
    if (!/sur 36/.test(await page.textContent('#compte-resultats'))) problemes.push('filtre type : compte non mis à jour');
    const apresFiltre = await page.textContent('#compte-resultats');
    if (/^36 audits sur 36/.test(apresFiltre)) problemes.push('filtre type : aucun effet');
    await page.keyboard.press('Escape');
    await page.click('.filtres-actifs >> text=Réinitialiser'); await page.waitForTimeout(150);
    const enTetes = await page.$$('th[aria-sort] button, th button[aria-label^="Trier"]');
    if (!enTetes.length) problemes.push('aucun en-tête triable');
    await page.click('[aria-label^="Trier par Statut"]'); await page.waitForTimeout(150);
    const sorts = await page.$$eval('th[aria-sort]', (ths) => ths.map((t) => t.textContent.trim() + ':' + t.getAttribute('aria-sort')));
    if (!sorts.some((s) => /Statut:(ascending|descending)/.test(s))) problemes.push(`tri Statut : aria-sort ${sorts.join(', ')}`);
    if (sorts.filter((s) => !/:none$/.test(s)).length !== 1) problemes.push(`aria-sort : plusieurs colonnes actives (${sorts.join(', ')})`);
    await page.click('[aria-label="Page 3"]'); await page.waitForTimeout(150);
    if (!/21–30/.test(await page.textContent('#zone-tableau .panneau-pied span'))) problemes.push('pagination page 3');
    const idLigne = await page.$eval('#zone-tableau tbody tr >> nth=0', (tr) => (tr.textContent.match(/AUD-\d+/) || [''])[0]);
    await page.click('#zone-tableau tbody tr >> nth=0 >> td >> nth=2'); await page.waitForTimeout(300);
    if (!page.url().endsWith('#/audit/' + idLigne.trim())) problemes.push(`clic ligne : ${page.url()} au lieu de #/audit/${idLigne.trim()}`);
    // Formulaire
    await page.goto(URL + '#/formulaire'); await page.waitForTimeout(300);
    await page.click('button[type="submit"]'); await page.waitForTimeout(150);
    const invalides = await page.$$eval('[aria-invalid="true"]', (e) => e.length);
    if (invalides < 5) problemes.push(`formulaire vide : ${invalides} aria-invalid`);
    const erreursVisibles = await page.$$eval('.champ.invalide .erreur, .champ.invalide [id$="-erreur"], .message-erreur', (e) => e.filter((x) => x.getBoundingClientRect().height > 0 && x.textContent.trim()).length);
    if (!erreursVisibles) problemes.push('formulaire vide : aucun message d’erreur visible');
    const lies = await page.$$eval('[aria-invalid="true"]', (els) => els.every((e) => { const d = e.getAttribute('aria-describedby'); return d && d.split(' ').some((id) => { const n = document.getElementById(id); return n && n.textContent.trim(); }); }));
    if (!lies) problemes.push('formulaire : aria-describedby ne pointe pas vers un message non vide');
    await page.fill('#champ-nom', 'Audit interne — test');
    await page.selectOption('#champ-type', 'Interne');
    await page.selectOption('#champ-referentiel', 'iso');
    await page.selectOption('#champ-site', { index: 1 });
    await page.fill('#champ-debut', '2026-12-01'); await page.fill('#champ-fin', '2026-12-03');
    await page.selectOption('#champ-responsable', 'u1'); await page.selectOption('#champ-perimetre', { index: 1 });
    await page.click('button[type="submit"]');
    await page.waitForSelector('.bandeau.succes', { timeout: 3000 }).catch(() => problemes.push('formulaire rempli : pas de bandeau de succès'));
    // Modale : role, Échap, focus retour
    await page.goto(URL + '#/composants'); await page.waitForTimeout(300);
    await page.focus('#btn-ouvrir-modale'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const dlg = await page.$('[role="dialog"][aria-modal="true"]');
    if (!dlg) problemes.push('modale : role=dialog aria-modal absent');
    if (!(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')))) problemes.push('modale : focus non déplacé dans la modale');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    if (!(await page.isHidden('#modale-racine'))) problemes.push('modale : Échap ne ferme pas');
    if ((await page.evaluate(() => document.activeElement.id)) !== 'btn-ouvrir-modale') problemes.push('modale : focus non rendu au déclencheur');
    // Toast
    await page.click('[data-toast="alerte"]'); await page.waitForTimeout(300);
    if (!(await page.$('#toasts .toast'))) problemes.push('toast non affiché');
    // RETEX point par point jusqu'au bout
    await page.goto(URL + '#/retex'); await page.waitForTimeout(300);
    const n = await page.$$eval('.retex-point', (e) => e.length);
    for (let i = 0; i < n; i++) { await page.click('text=Point suivant'); await page.waitForTimeout(60); }
    if ((await page.$$eval('.retex-point.revele', (e) => e.length)) !== n) problemes.push('retex : point par point incomplet');
    if (!(await page.isDisabled('text=Point suivant'))) problemes.push('retex : Point suivant actif à la fin');
    await page.click('text=Réinitialiser'); await page.waitForTimeout(100);
    await page.click('text=Tout dérouler'); await page.waitForTimeout(300);
    if ((await page.$$eval('.retex-point.revele', (e) => e.length)) !== n) problemes.push('retex : tout dérouler incomplet');
    const derniersVisibles = await page.$$eval('.retex-point.revele', (els) => els.every((e) => parseFloat(getComputedStyle(e).opacity) > 0.9));
    if (!derniersVisibles) problemes.push('retex : points révélés encore atténués');
    // postMessage
    await page.goto(URL + '#/dashboard'); await page.waitForTimeout(300);
    await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*'));
    await page.waitForTimeout(300);
    postMessageOk = /#\/audits$/.test(page.url()) && !!(await page.$('#zone-tableau'));
    if (!postMessageOk) problemes.push('postMessage : écran non basculé');
    console.log('[clavier]');
    // Clavier : Tab depuis le haut, indicateur visible
    await page.goto(URL + '#/audits'); await page.waitForTimeout(300);
    await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
    const sansIndicateur = [];
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const a = document.activeElement; if (!a || a === document.body) return null;
        const cs = getComputedStyle(a);
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const ombre = cs.boxShadow && cs.boxShadow !== 'none';
        return { ok: outline || ombre, desc: a.tagName.toLowerCase() + '#' + a.id + '.' + String(a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className).slice(0, 30) + ' « ' + (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 20) + ' »' };
      });
      if (info && !info.ok) sansIndicateur.push(info.desc);
    }
    if (sansIndicateur.length) problemes.push('focus sans indicateur : ' + Array.from(new Set(sansIndicateur)).join(' | '));
    await context.close();
  }

  /* ---- Mouvement réduit */
  {
    const { context, page } = await session({ reducedMotion: 'reduce' }, 'reduit');
    console.log('[reduit]');
    for (const r of ROUTES) {
      await page.goto(URL + r); await page.waitForTimeout(1500);
      const zero = await page.evaluate(SCRIPT_OPACITE_ZERO);
      if (zero.length) { reducedMotionOk = false; problemes.push(`[reduit] ${r} : opacité 0 sur ${zero.length} élément(s) visibles : ${zero.slice(0, 5).join(', ')}`); }
      if (r === '#/dashboard') {
        const svg = await page.evaluate(() => ({
          traces: Array.from(document.querySelectorAll('svg.graphique .trace')).map((t) => { const cs = getComputedStyle(t); return cs.strokeDashoffset + '|' + cs.strokeDasharray; }),
          barres: Array.from(document.querySelectorAll('svg.graphique .barre, svg.graphique .colonne')).map((b) => getComputedStyle(b).transform),
          sparklines: document.querySelectorAll('.kpi svg path').length,
          kpi: Array.from(document.querySelectorAll('.kpi-valeur')).map((k) => k.textContent.trim()),
        }));
        if (!svg.sparklines) problemes.push('[reduit] sparklines absentes');
        if (svg.traces.some((t) => !/^0px\|/.test(t) && !/none/.test(t) && !/^0\|/.test(t))) problemes.push('[reduit] trace non complète : ' + svg.traces.slice(0, 3).join(' ; '));
        if (svg.barres.some((t) => t !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(t))) problemes.push('[reduit] barres non à l’échelle 1 : ' + svg.barres.slice(0, 3).join(' ; '));
        if (svg.kpi.some((k) => !/\d/.test(k))) problemes.push('[reduit] KPI sans valeur : ' + svg.kpi.join(' / '));
      }
    }
    // Fiche : onglets et RETEX en mouvement réduit
    await page.goto(URL + '#/audit/AUD-07'); await page.waitForTimeout(300);
    await page.click('#onglet-actions'); await page.waitForTimeout(300);
    let zero = await page.evaluate(SCRIPT_OPACITE_ZERO);
    if (zero.length) { reducedMotionOk = false; problemes.push('[reduit] onglet actions : opacité 0 : ' + zero.slice(0, 5).join(', ')); }
    await page.goto(URL + '#/retex'); await page.waitForTimeout(300);
    await page.click('text=Tout dérouler'); await page.waitForTimeout(300);
    zero = await page.evaluate(SCRIPT_OPACITE_ZERO);
    if (zero.length) { reducedMotionOk = false; problemes.push('[reduit] retex : opacité 0 : ' + zero.slice(0, 5).join(', ')); }
    await page.goto(URL + '#/composants'); await page.waitForTimeout(300);
    await page.click('#btn-ouvrir-modale'); await page.waitForTimeout(300);
    const modaleOp = await page.$eval('.modale', (m) => getComputedStyle(m).opacity);
    if (parseFloat(modaleOp) < 1) { reducedMotionOk = false; problemes.push('[reduit] modale à opacité ' + modaleOp); }
    await page.keyboard.press('Escape');
    await page.click('[data-toast="succes"]'); await page.waitForTimeout(300);
    const toastOp = await page.$eval('#toasts .toast', (m) => getComputedStyle(m).opacity).catch(() => '0');
    if (parseFloat(toastOp) < 1) { reducedMotionOk = false; problemes.push('[reduit] toast à opacité ' + toastOp); }
    await context.close();
  }

  await browser.close();

  /* ---- Rapport des contrastes */
  let minTexte = Infinity; let minTexteCle = '';
  const echecs = [];
  Array.from(paires.entries()).sort((a, b) => a[1].ratio - b[1].ratio).forEach(([cle, p]) => {
    const seuil = p.grand ? 3 : 4.5;
    if (p.ratio < minTexte) { minTexte = p.ratio; minTexteCle = cle; }
    if (p.ratio < seuil) echecs.push(`${p.ratio.toFixed(2)} : 1  ${cle}  (${Array.from(p.exemples).join(' ; ')})`);
  });
  console.log(`Couples texte/fond mesurés : ${paires.size}. Minimum : ${minTexte.toFixed(2)} : 1 (${minTexteCle})`);
  console.log('Les 8 plus faibles :');
  Array.from(paires.entries()).sort((a, b) => a[1].ratio - b[1].ratio).slice(0, 8).forEach(([cle, p]) => console.log(`  ${p.ratio.toFixed(2)} : 1  ${cle}  ${Array.from(p.exemples)[0]}`));
  if (echecs.length) { problemes.push('contraste texte insuffisant : ' + echecs.length + ' couple(s)'); echecs.forEach((e) => console.log('  ÉCHEC ' + e)); }

  console.log(`\npostMessageOk=${postMessageOk} reducedMotionOk=${reducedMotionOk}`);
  if (problemes.length) {
    console.log('\nPROBLÈMES (' + problemes.length + ') :');
    problemes.forEach((p) => console.log(' - ' + p));
    process.exitCode = 1;
  } else {
    console.log('\nAucun problème.');
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
