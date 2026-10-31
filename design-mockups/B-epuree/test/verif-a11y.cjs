/* Vérification complémentaire de la maquette B (Playwright) : six ancres à 1440 et 1024 px, console vide,
   interactions, postMessage, mouvement réduit (aucun élément visible à opacité 0), focus clavier visible,
   statuts toujours accompagnés d'une icône et d'un libellé.
   Exécution : node design-mockups/B-epuree/test/verif-a11y.cjs */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ANCRES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];

function ecoute(page, problemes) {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemes.push('[console ' + m.type() + '] ' + m.text()); });
  page.on('pageerror', (e) => problemes.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) => problemes.push('[requête] ' + r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('request', (r) => { if (/^https?:/.test(r.url())) problemes.push('[réseau externe] ' + r.url()); });
}

// Éléments visibles (boîte non vide, non masqués) dont l'opacité calculée est 0.
async function opacitesNulles(page) {
  return page.evaluate(() => {
    const res = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (el.closest('[hidden]')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (parseFloat(cs.opacity) === 0) {
        const d = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : el.getAttribute('class') ? '.' + el.getAttribute('class') : '');
        res.push(d);
      }
    });
    return res;
  });
}

async function etatGraphiques(page) {
  return page.evaluate(() => {
    const out = { dashoffsetNonNul: [], transformsNonFinis: [] };
    document.querySelectorAll('.graphique .trace, .graphique .anneau, .graphique .jauge-arc').forEach((el) => {
      const v = parseFloat(getComputedStyle(el).strokeDashoffset);
      if (Math.abs(v) > 0.01) out.dashoffsetNonNul.push(el.getAttribute('class') + ' ' + v);
    });
    document.querySelectorAll('.graphique .barre, .graphique .segment, .progression-barre').forEach((el) => {
      const t = getComputedStyle(el).transform;
      if (t !== 'none') {
        const m = t.match(/matrix\(([^)]+)\)/);
        if (m) {
          const a = parseFloat(m[1].split(',')[0]);
          const attendu = el.classList.contains('progression-barre') ? parseFloat(el.style.getPropertyValue('--p') || '0') : 1;
          if (Math.abs(a - attendu) > 0.01) out.transformsNonFinis.push(el.getAttribute('class') + ' scaleX=' + a + ' attendu ' + attendu);
        }
      }
    });
    return out;
  });
}

async function focusVisible(page, n) {
  const sans = [];
  let vus = 0;
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const ombre = cs.boxShadow && cs.boxShadow !== 'none';
      const d = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.getAttribute('class') ? '.' + el.getAttribute('class').split(' ')[0] : '');
      return { d, ok: outline || ombre, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, ombre: cs.boxShadow };
    });
    if (!info) break;
    vus++;
    if (!info.ok) sans.push(info.d + ' (' + info.outline + ' / ' + info.ombre + ')');
  }
  return { vus, sans };
}

async function scenario(browser, options, etiquette) {
  const contexte = await browser.newContext(options);
  const page = await contexte.newPage();
  const problemes = [];
  ecoute(page, problemes);
  const verifs = [];
  const ok = (cond, msg) => verifs.push((cond ? 'OK   ' : 'ÉCHEC ') + msg);
  const reduit = options.reducedMotion === 'reduce';

  // 1. Six ancres, console vide, écran rendu, pas de débordement horizontal
  for (const ancre of ANCRES) {
    await page.goto(URL + ancre);
    await page.waitForTimeout(1500);
    const h1 = await page.locator('h1#titre-page').count();
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    const vp = options.viewport.width;
    const nav = await page.locator('#nav-liste a[aria-current="page"]').count();
    ok(h1 === 1 && largeur <= vp && nav === 1, ancre + ' : rendu (h1, nav aria-current, largeur ' + largeur + ' ≤ ' + vp + ')');
    // 4. Rien ne reste à opacité 0 après 1,5 s (hors info-bulle au repos et curseur de survol)
    const nulles = (await opacitesNulles(page)).filter((d) => !/^div#infobulle|curseur/.test(d));
    ok(nulles.length === 0, ancre + ' : aucun élément visible à opacité 0 après 1,5 s' + (nulles.length ? ' → ' + nulles.join(', ') : ''));
    if (ancre === '#/dashboard') {
      const g = await etatGraphiques(page);
      ok(g.dashoffsetNonNul.length === 0 && g.transformsNonFinis.length === 0, 'dashboard : graphiques entièrement dessinés' + (g.dashoffsetNonNul.length || g.transformsNonFinis.length ? ' → ' + g.dashoffsetNonNul.concat(g.transformsNonFinis).join(' ; ') : ''));
      // Statuts : couleur + icône + libellé
      const badges = await page.evaluate(() => Array.from(document.querySelectorAll('.badge')).map((b) => ({ ico: !!b.querySelector('svg'), txt: b.textContent.trim().length > 0 })));
      ok(badges.length > 0 && badges.every((b) => b.ico && b.txt), 'dashboard : ' + badges.length + ' badges, tous avec icône + libellé');
    }
    if (ancre === '#/audits' || ancre === '#/composants' || ancre === '#/audit/AUD-07') {
      const badges = await page.evaluate(() => Array.from(document.querySelectorAll('.badge')).map((b) => ({ ico: !!b.querySelector('svg'), txt: b.textContent.trim().length > 0 })));
      ok(badges.length > 0 && badges.every((b) => b.ico && b.txt), ancre + ' : ' + badges.length + ' badges, tous avec icône + libellé');
    }
    // 5. Clavier : Tab depuis le haut de page, indicateur de focus visible
    if (!reduit) {
      await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
      const f = await focusVisible(page, ancre === '#/audits' ? 45 : 30);
      ok(f.vus >= 8 && f.sans.length === 0, ancre + ' : ' + f.vus + ' éléments tabulés, tous avec indicateur de focus' + (f.sans.length ? ' → sans indicateur : ' + f.sans.join(', ') : ''));
    }
  }

  // 2. Interactions — fiche : chaque onglet
  await page.goto(URL + '#/audit/AUD-07');
  await page.waitForTimeout(400);
  for (const o of ['constats', 'actions', 'historique', 'synthese']) {
    await page.click('#onglet-' + o);
    await page.waitForTimeout(250);
    const sel = await page.locator('#onglet-' + o).getAttribute('aria-selected');
    const vis = await page.locator('#panneau-' + o).isVisible();
    const autres = await page.locator('[role="tabpanel"]:visible').count();
    ok(sel === 'true' && vis && autres === 1, 'fiche : onglet ' + o + ' actif, un seul panneau visible');
  }
  // Liste : recherche, filtre, tri, page, clic ligne
  await page.goto(URL + '#/audits');
  await page.waitForTimeout(400);
  await page.fill('#recherche', 'Brumeval');
  await page.waitForTimeout(100);
  const nRech = await page.locator('#corps-audits tr.ligne').count();
  ok(nRech > 0 && nRech < 36, 'liste : recherche « Brumeval » → ' + nRech + ' lignes');
  await page.fill('#recherche', '');
  await page.selectOption('#f-type', { index: 1 });
  await page.waitForTimeout(100);
  const compteType = await page.locator('#compte-liste').innerText();
  ok(/sur 36/.test(compteType), 'liste : filtre type → ' + compteType);
  await page.selectOption('#f-type', '');
  await page.click('button.tri[data-cle="statut"]');
  await page.waitForTimeout(50);
  ok(await page.locator('th[data-cle="statut"]').getAttribute('aria-sort') === 'ascending' && (await page.locator('th[aria-sort="none"]').count()) === 8, 'liste : tri statut → aria-sort=ascending, les autres à none');
  await page.click('button.tri[data-cle="statut"]');
  ok(await page.locator('th[data-cle="statut"]').getAttribute('aria-sort') === 'descending', 'liste : second clic → descending');
  await page.click('.page-btn[data-page="3"]');
  await page.waitForTimeout(100);
  ok(await page.locator('.page-btn[aria-current="page"]').innerText() === '3', 'liste : page 3');
  const idLigne = await page.locator('#corps-audits tr.ligne >> nth=2').getAttribute('data-id');
  await page.click('#corps-audits tr.ligne >> nth=2 >> td >> nth=4');
  await page.waitForTimeout(400);
  ok((await page.evaluate(() => location.hash)) === '#/audit/' + idLigne, 'liste : clic sur une ligne → #/audit/' + idLigne);
  ok((await page.locator('h1#titre-page').count()) === 1, 'fiche ouverte depuis la liste');

  // Formulaire vide puis rempli
  await page.goto(URL + '#/formulaire');
  await page.waitForTimeout(400);
  await page.click('#btn-enregistrer');
  await page.waitForTimeout(100);
  const nInvalides = await page.locator('[aria-invalid="true"]').count();
  const nErreursVisibles = await page.locator('.champ-erreur:visible').count();
  ok(nInvalides === 7 && nErreursVisibles === 7 && (await page.locator('#resume-erreurs:focus').count()) === 1, 'formulaire vide : 7 champs aria-invalid, 7 messages visibles, résumé focalisé');
  const described = await page.locator('#f-nom').getAttribute('aria-describedby');
  ok(/f-nom-erreur/.test(described), 'formulaire : aria-describedby relie le message d’erreur');
  await page.fill('#f-nom', 'Audit interne — vérification');
  await page.selectOption('#f-type', { index: 1 });
  await page.selectOption('#f-ref', { index: 1 });
  await page.selectOption('#f-site', { index: 1 });
  await page.selectOption('#f-resp', { index: 1 });
  await page.fill('#f-debut', '2026-12-01');
  await page.fill('#f-fin', '2026-12-05');
  await page.click('#btn-enregistrer');
  await page.waitForTimeout(1200);
  ok((await page.locator('.bandeau-succes[role="status"]').count()) === 1 && (await page.locator('[aria-invalid="true"]').count()) === 0, 'formulaire rempli : succès, plus aucun champ invalide');

  // Modale : role=dialog, Échap, retour du focus
  await page.goto(URL + '#/composants');
  await page.waitForTimeout(400);
  await page.focus('[data-action="ouvrir-modale"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  ok((await page.locator('[role="dialog"][aria-modal="true"]:visible').count()) === 1, 'modale : role=dialog visible');
  ok(await page.evaluate(() => document.activeElement.closest('#modale') !== null), 'modale : focus à l’intérieur');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement.closest('#modale') !== null), 'modale : focus piégé après 4 Tab');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  ok(await page.locator('#voile').isHidden(), 'modale : Échap ferme');
  ok(await page.evaluate(() => document.activeElement.getAttribute('data-action') === 'ouvrir-modale'), 'modale : focus revenu au déclencheur');
  // Toast
  await page.click('[data-action="toast"][data-genre="alerte"]');
  await page.waitForTimeout(300);
  ok((await page.locator('#toasts .toast.visible[role="status"]').count()) >= 1, 'toast déclenché (role=status, visible)');
  await page.click('#toasts .toast >> nth=0 >> button[aria-label]');
  await page.waitForTimeout(400);
  ok((await page.locator('#toasts .toast').count()) === 0, 'toast fermé par son bouton');

  // RETEX point par point jusqu'au bout, puis Tout dérouler
  await page.goto(URL + '#/retex');
  await page.waitForTimeout(400);
  const nPoints = await page.locator('.retex-point').count();
  let clics = 0;
  while (!(await page.locator('#btn-retex-suivant').isDisabled()) && clics < 30) { await page.click('#btn-retex-suivant'); clics++; await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  ok(clics === nPoints && (await page.locator('.retex-point:visible').count()) === nPoints && (await page.locator('#retex-suite').isVisible()), 'RETEX : ' + clics + ' clics → ' + nPoints + ' points visibles, enseignements affichés');
  const nulsRetex = (await opacitesNulles(page)).filter((d) => !/^div#infobulle|curseur/.test(d));
  ok(nulsRetex.length === 0, 'RETEX déroulé : aucun point à opacité 0' + (nulsRetex.length ? ' → ' + nulsRetex.join(', ') : ''));
  await page.click('[data-action="retex-reinit"]');
  await page.waitForTimeout(100);
  ok((await page.locator('.retex-point:visible').count()) === 0, 'RETEX : réinitialisé');
  await page.click('[data-action="retex-tout"]');
  await page.waitForTimeout(500);
  ok((await page.locator('.retex-point:visible').count()) === nPoints && (await page.locator('.retex-point .badge').count()) === nPoints, 'RETEX : « Tout dérouler » → ' + nPoints + ' points, chacun avec un badge de gravité');

  // 3. postMessage
  await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*'));
  await page.waitForTimeout(400);
  const hashPM = await page.evaluate(() => location.hash);
  ok(hashPM === '#/audits' && (await page.locator('#tableau-audits').count()) === 1 && (await page.locator('#nav-liste a[aria-current="page"]').getAttribute('href')) === '#/audits', 'postMessage {type:route} → ' + hashPM + ', écran liste, nav à jour');

  await contexte.close();
  return { verifs, problemes };
}

(async () => {
  const browser = await chromium.launch();
  let echec = false;
  const scenarios = [
    ['1440×900', { viewport: { width: 1440, height: 900 } }],
    ['1024×768', { viewport: { width: 1024, height: 768 } }],
    ['1440×900 mouvement réduit', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }],
    ['1024×768 mouvement réduit', { viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' }],
  ];
  for (const [etiquette, options] of scenarios) {
    const r = await scenario(browser, options, etiquette);
    console.log('\n=== ' + etiquette + ' ===');
    r.verifs.forEach((v) => console.log(v));
    if (r.problemes.length) { echec = true; console.log('Problèmes de console / réseau :'); r.problemes.forEach((p) => console.log('  ' + p)); }
    else console.log('Console : aucune erreur, aucun avertissement, aucune requête externe.');
    if (r.verifs.some((v) => v.indexOf('ÉCHEC') === 0)) echec = true;
  }
  await browser.close();
  console.log(echec ? '\nRésultat : ÉCHEC' : '\nRésultat : tout est conforme.');
  process.exit(echec ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
