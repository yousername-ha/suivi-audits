/* Vérification de la maquette E avec Playwright : six écrans, interactions, console propre, mouvement réduit.
   Usage : node design-mockups/E-data-dense/test/verifier.cjs */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ROUTES = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];

async function main() {
  const browser = await chromium.launch();
  const problemes = [];
  const journal = [];

  async function session(options, etiquette) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problemes.push(`[${etiquette}] console.${m.type()} : ${m.text()}`);
    });
    page.on('pageerror', (e) => problemes.push(`[${etiquette}] pageerror : ${e.message}`));
    return { context, page };
  }

  async function verifierRoute(page, hash, etiquette) {
    await page.goto(URL + hash);
    await page.waitForTimeout(350);
    const courant = await page.getAttribute('.nav-lien[aria-current="page"]', 'href');
    const attendu = hash === '#/audit/AUD-07' ? '#/audit/AUD-07' : hash;
    if (courant !== attendu) problemes.push(`[${etiquette}] aria-current attendu ${attendu}, obtenu ${courant}`);
    const inlineStyles = await page.$$eval('[style]', (els) => els.filter((e) => !e.closest('#toasts') && e.getAttribute('style') && !/^(--|left|top|width|height|overflow|transform|padding|justify-content)/.test(e.getAttribute('style').trim())).length);
    if (inlineStyles) problemes.push(`[${etiquette}] ${hash} : ${inlineStyles} attributs style inattendus`);
    journal.push(`${etiquette} ${hash} OK`);
    console.log(`${etiquette} ${hash} chargé`);
  }

  /* ---- Session normale */
  {
    const { context, page } = await session({}, 'normal');
    for (const r of ROUTES) await verifierRoute(page, r, 'normal');

    // Dashboard : captures et info-bulle
    await page.goto(URL + '#/dashboard');
    await page.waitForTimeout(1200);
    await page.hover('svg.courbe .zone-survol >> nth=6');
    await page.waitForTimeout(100);
    if (await page.isHidden('#infobulle')) problemes.push('infobulle de courbe non affichée');
    await page.screenshot({ path: path.join(__dirname, 'capture-dashboard.png'), fullPage: true });
    // Repli d'un panneau
    await page.click('#titre-statuts ~ .btn-replier');
    if (!(await page.$('.panneau.replie'))) problemes.push('panneau non replié');
    await page.click('#titre-statuts ~ .btn-replier');

    // Liste : filtre, tri, recherche, pagination, densité, clic ligne
    await page.goto(URL + '#/audits');
    await page.waitForTimeout(300);
    const nbLignes = await page.$$eval('#zone-tableau tbody tr', (r) => r.length);
    if (nbLignes !== 10) problemes.push(`liste : ${nbLignes} lignes au lieu de 10`);
    await page.click('.menu-filtre >> nth=0 >> button.btn');
    await page.waitForTimeout(100);
    await page.check('#menu-statut input[value="Clos"]');
    await page.waitForTimeout(100);
    const compte = await page.textContent('#compte-resultats');
    if (!/17 audits sur 36/.test(compte)) problemes.push(`filtre statut Clos : compte « ${compte} »`);
    await page.keyboard.press('Escape');
    if (!(await page.isHidden('#menu-statut'))) problemes.push('menu filtre non fermé par Échap');
    await page.click('[aria-label^="Trier par Audit"]');
    const sort = await page.getAttribute('th[aria-sort]', 'aria-sort');
    if (sort !== 'ascending') problemes.push(`tri : aria-sort ${sort}`);
    const premier = await page.textContent('#zone-tableau tbody tr >> nth=0 >> td >> nth=1');
    await page.click('[aria-label^="Trier par Audit"]');
    const premierDesc = await page.textContent('#zone-tableau tbody tr >> nth=0 >> td >> nth=1');
    if (premier === premierDesc) problemes.push('tri : même première ligne en asc et desc');
    await page.click('.filtres-actifs >> text=Réinitialiser');
    await page.fill('#recherche-audits', 'hds');
    await page.waitForTimeout(100);
    const compteRecherche = await page.textContent('#compte-resultats');
    if (!/2 audits/.test(compteRecherche)) problemes.push(`recherche hds : « ${compteRecherche} »`);
    if ((await page.evaluate(() => document.activeElement && document.activeElement.id)) !== 'recherche-audits') problemes.push('recherche : focus perdu');
    await page.fill('#recherche-audits', '');
    await page.click('[aria-label="Page 2"]');
    if (!/11–20/.test(await page.textContent('#zone-tableau .panneau-pied span'))) problemes.push('pagination page 2 incorrecte');
    await page.click('[aria-label="Densité des lignes"] >> text=Compact');
    if (!(await page.$('table.tableau.compact'))) problemes.push('densité compacte non appliquée');
    await page.screenshot({ path: path.join(__dirname, 'capture-audits.png'), fullPage: false });
    await page.click('#zone-tableau tbody tr >> nth=0 >> td >> nth=2');
    await page.waitForTimeout(300);
    if (!/#\/audit\/AUD-/.test(page.url())) problemes.push('clic ligne : pas de navigation vers la fiche');

    // Fiche : onglets, clavier, modale
    await page.goto(URL + '#/audit/AUD-07');
    await page.waitForTimeout(400);
    await page.click('#onglet-constats');
    if ((await page.getAttribute('#onglet-constats', 'aria-selected')) !== 'true') problemes.push('onglet Constats non sélectionné');
    if (await page.isHidden('#panneau-constats')) problemes.push('panneau Constats caché');
    await page.keyboard.press('ArrowRight');
    if ((await page.getAttribute('#onglet-actions', 'aria-selected')) !== 'true') problemes.push('clavier onglets : flèche droite');
    await page.screenshot({ path: path.join(__dirname, 'capture-audit-actions.png'), fullPage: true });
    await page.click('#onglet-historique');
    await page.click('.entete-ecran button.btn-danger');
    await page.waitForTimeout(200);
    if (!(await page.$('[role="dialog"]'))) problemes.push('modale de clôture absente');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const dansModale = await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'));
    if (!dansModale) problemes.push('piège de focus : focus sorti de la modale');
    await page.screenshot({ path: path.join(__dirname, 'capture-modale.png') });
    await page.keyboard.press('Escape');
    if (!(await page.isHidden('#modale-racine'))) problemes.push('modale non fermée par Échap');
    const focusRetour = await page.evaluate(() => document.activeElement.textContent.trim());
    if (!/Clore/.test(focusRetour)) problemes.push(`focus non rendu au déclencheur : « ${focusRetour} »`);

    // Formulaire : erreurs puis succès
    await page.goto(URL + '#/formulaire');
    await page.waitForTimeout(300);
    await page.click('button[type="submit"]');
    const nbInvalides = await page.$$eval('.champ.invalide', (e) => e.length);
    if (nbInvalides < 5) problemes.push(`formulaire : ${nbInvalides} champs invalides après envoi vide`);
    if ((await page.getAttribute('#champ-nom', 'aria-invalid')) !== 'true') problemes.push('formulaire : aria-invalid absent');
    await page.screenshot({ path: path.join(__dirname, 'capture-formulaire-erreurs.png'), fullPage: true });
    await page.fill('#champ-nom', 'Audit interne — test maquette');
    await page.selectOption('#champ-type', 'Interne');
    await page.selectOption('#champ-referentiel', 'iso');
    await page.selectOption('#champ-site', { index: 1 });
    await page.fill('#champ-debut', '2026-12-01');
    await page.fill('#champ-fin', '2026-11-01');
    await page.locator('#champ-fin').blur();
    if (!(await page.$('#champ-fin[aria-invalid="true"]'))) problemes.push('formulaire : fin < début non détecté');
    await page.fill('#champ-fin', '2026-12-02');
    await page.selectOption('#champ-responsable', 'u1');
    await page.selectOption('#champ-perimetre', { index: 1 });
    await page.click('button[type="submit"]');
    if (!(await page.isDisabled('button[type="submit"]'))) problemes.push('formulaire : bouton non désactivé pendant l’envoi');
    await page.waitForSelector('.bandeau.succes', { timeout: 3000 });
    await page.waitForSelector('.toast.succes', { timeout: 3000 });

    // RETEX : dérouler
    await page.goto(URL + '#/retex');
    await page.waitForTimeout(300);
    await page.click('text=Point suivant');
    await page.click('text=Point suivant');
    let reveles = await page.$$eval('.retex-point.revele', (e) => e.length);
    if (reveles !== 2) problemes.push(`retex : ${reveles} points révélés après deux clics`);
    await page.keyboard.press('ArrowDown');
    reveles = await page.$$eval('.retex-point.revele', (e) => e.length);
    if (reveles !== 3) problemes.push(`retex : clavier flèche bas → ${reveles}`);
    await page.screenshot({ path: path.join(__dirname, 'capture-retex.png'), fullPage: true });
    await page.click('text=Tout dérouler');
    reveles = await page.$$eval('.retex-point.revele', (e) => e.length);
    if (reveles !== 11) problemes.push(`retex : tout dérouler → ${reveles}`);
    if (!(await page.isDisabled('text=Point suivant'))) problemes.push('retex : bouton suivant non désactivé à la fin');
    await page.click('text=Réinitialiser');

    // Composants : toasts, modale, chargement
    await page.goto(URL + '#/composants');
    await page.waitForTimeout(300);
    const avantToasts = await page.$$eval('#toasts .toast', (e) => e.length);
    await page.click('[data-toast="succes"]');
    await page.click('[data-toast="erreur"]');
    const nbToasts = await page.$$eval('#toasts .toast', (e) => e.length);
    if (nbToasts !== avantToasts + 2) problemes.push(`toasts : ${nbToasts} affichés au lieu de ${avantToasts + 2}`);
    if ((await page.getAttribute('#toasts', 'aria-live')) !== 'polite') problemes.push('toasts : aria-live manquant');
    await page.click('#toasts .toast >> nth=0 >> .fermer');
    await page.waitForTimeout(400);
    if ((await page.$$eval('#toasts .toast', (e) => e.length)) !== nbToasts - 1) problemes.push('toast : fermeture manuelle inopérante');
    await page.click('#btn-ouvrir-modale');
    await page.waitForTimeout(150);
    await page.click('[role="dialog"] button.btn-danger');
    await page.waitForTimeout(150);
    if (!(await page.isHidden('#modale-racine'))) problemes.push('modale composants : non fermée après confirmation');
    await page.click('#btn-simuler');
    if (!(await page.$('.squelette[aria-busy="true"]'))) problemes.push('squelette absent');
    await page.screenshot({ path: path.join(__dirname, 'capture-composants.png'), fullPage: true });
    await page.waitForTimeout(1800);

    // postMessage
    await page.evaluate(() => window.postMessage({ type: 'route', hash: '#/audits' }, '*'));
    await page.waitForTimeout(200);
    if (!/#\/audits$/.test(page.url())) problemes.push('postMessage route non appliqué');

    // Raccourci clavier
    await page.keyboard.press('5');
    await page.waitForTimeout(200);
    if (!/#\/retex$/.test(page.url())) problemes.push('raccourci clavier 5 inopérant');

    // Cibles cliquables ≥ 32 px (boutons principaux)
    const petites = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button.btn, .btn-icone, .nav-lien, .pagination button, .onglet').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.width && r.height && (r.height < 28 || r.width < 28)) out.push(`${b.className} ${Math.round(r.width)}×${Math.round(r.height)}`);
      });
      return out;
    });
    if (petites.length) problemes.push('cibles < 28 px : ' + petites.slice(0, 5).join(' | '));

    await context.close();
  }

  /* ---- 1024 px */
  {
    const { context, page } = await session({ viewport: { width: 1024, height: 768 } }, '1024');
    await page.goto(URL + '#/dashboard');
    await page.waitForTimeout(1000);
    const debord = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (debord) problemes.push('1024 : débordement horizontal du dashboard');
    await page.screenshot({ path: path.join(__dirname, 'capture-dashboard-1024.png'), fullPage: true });
    await page.goto(URL + '#/audits');
    await page.waitForTimeout(300);
    await page.click('#btn-nav');
    if (!(await page.$('.coquille.nav-depliee'))) problemes.push('1024 : navigation non dépliable');
    await context.close();
  }

  /* ---- Mouvement réduit */
  {
    const { context, page } = await session({ reducedMotion: 'reduce' }, 'reduit');
    for (const r of ROUTES) await verifierRoute(page, r, 'reduit');
    await page.goto(URL + '#/audit/AUD-07');
    await page.waitForTimeout(200);
    await page.click('#onglet-actions');
    await page.goto(URL + '#/retex');
    await page.waitForTimeout(200);
    await page.click('text=Tout dérouler');
    await page.goto(URL + '#/composants');
    await page.waitForTimeout(200);
    const avantReduit = await page.$$eval('#toasts .toast', (e) => e.length);
    await page.click('[data-toast="info"]');
    await page.click('#toasts .toast >> nth=-1 >> .fermer');
    await page.waitForTimeout(100);
    if ((await page.$$eval('#toasts .toast', (e) => e.length)) !== avantReduit) problemes.push('reduit : toast non retiré');
    await page.click('#btn-ouvrir-modale');
    await page.keyboard.press('Escape');
    await context.close();
  }

  await browser.close();
  journal.forEach((l) => console.log(l));
  if (problemes.length) {
    console.log('\nPROBLÈMES (' + problemes.length + ') :');
    problemes.forEach((p) => console.log(' - ' + p));
    process.exitCode = 1;
  } else {
    console.log('\nAucun problème : console propre, interactions vérifiées, mouvement réduit testé.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
