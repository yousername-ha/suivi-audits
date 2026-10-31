/* Captures Playwright de chaque écran de chaque maquette, planche comparative et vidéo/GIF des animations de F.
   Usage : node design-mockups/scripts/capture.cjs [--only F-inspiration] [--no-video]
   Sorties : design-mockups/screenshots/<maquette>/<ecran>.png, screenshots/planche-comparative.png,
             screenshots/F-inspiration-dashboard.webm|.gif, screenshots/F-inspiration-retex.webm|.gif */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'screenshots');
const MAQUETTES = ['A-fidele', 'B-epuree', 'C-institutionnel', 'D-soc-sombre', 'E-data-dense', 'F-inspiration'].filter((m) =>
  fs.existsSync(path.join(ROOT, m, 'index.html')),
);
const ECRANS = [
  ['dashboard', '#/dashboard'],
  ['audits', '#/audits'],
  ['audit-detail', '#/audit/AUD-07'],
  ['formulaire', '#/formulaire'],
  ['retex', '#/retex'],
  ['composants', '#/composants'],
];
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const noVideo = args.includes('--no-video');

const url = (m, hash) => 'file://' + path.join(ROOT, m, 'index.html') + hash;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function captureEcrans(browser) {
  const erreurs = {};
  for (const m of MAQUETTES) {
    if (only && m !== only) continue;
    fs.mkdirSync(path.join(OUT, m), { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    erreurs[m] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') erreurs[m].push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (e) => erreurs[m].push(`[pageerror] ${e.message}`));
    for (const [nom, hash] of ECRANS) {
      await page.goto(url(m, hash), { waitUntil: 'load' });
      await page.evaluate((h) => {
        if (location.hash !== h) location.hash = h;
      }, hash);
      await sleep(1800); // laisse les animations d'entrée se terminer
      if (nom === 'retex') {
        // Déroule toute la chronologie pour la capture.
        const tout = page.getByRole('button', { name: /tout dérouler/i }).first();
        if (await tout.count()) await tout.click().catch(() => {});
        await sleep(1800);
      }
      await page.screenshot({ path: path.join(OUT, m, `${nom}.png`), fullPage: true });
      await page.screenshot({ path: path.join(OUT, m, `${nom}-1440x900.png`), fullPage: false });
    }
    // Tablette : dashboard seulement.
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(url(m, '#/dashboard'), { waitUntil: 'load' });
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT, m, 'dashboard-tablette-1024.png'), fullPage: false });
    await ctx.close();
    console.log(`${m} : ${ECRANS.length} écrans capturés, ${erreurs[m].length} erreur(s) console`);
  }
  return erreurs;
}

async function planche(browser) {
  // Planche comparative : une ligne par maquette, une colonne par écran (vignettes 1440x900 réduites).
  const cellules = MAQUETTES.map(
    (m) => `<section><h2>${m}</h2><div class="ligne">${ECRANS.map(
      ([nom]) => `<figure><img src="${m}/${nom}-1440x900.png" alt="${m} ${nom}"><figcaption>${nom}</figcaption></figure>`,
    ).join('')}</div></section>`,
  ).join('');
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Planche comparative</title>
<style>body{margin:0;padding:24px;background:#eceff3;font:13px/1.4 system-ui,sans-serif;color:#1d2330}
h1{margin:0 0 16px;font-size:20px}h2{margin:16px 0 8px;font-size:14px}
.ligne{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
figure{margin:0;background:#fff;border-radius:8px;padding:6px;box-shadow:0 1px 3px rgb(0 0 0/.12)}
img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:4px;display:block}
figcaption{margin-top:4px;font-size:11px;color:#5a6472;text-align:center}</style>
<h1>Maquettes de refonte, écran par écran (1440×900)</h1>${cellules}</html>`;
  fs.writeFileSync(path.join(OUT, 'planche-comparative.html'), html);
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  await page.goto('file://' + path.join(OUT, 'planche-comparative.html'));
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, 'planche-comparative.png'), fullPage: true });
  await page.close();
  console.log('planche comparative écrite');
}

async function video(browser, hash, nom, scenario) {
  const dir = path.join(OUT, 'tmp-video');
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  await page.goto(url('F-inspiration', hash), { waitUntil: 'load' });
  await scenario(page);
  const v = page.video();
  await ctx.close();
  const src = await v.path();
  const webm = path.join(OUT, `F-inspiration-${nom}.webm`);
  fs.copyFileSync(src, webm);
  try {
    execSync(
      `ffmpeg -y -loglevel error -i "${webm}" -vf "fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 "${path.join(OUT, `F-inspiration-${nom}.gif`)}"`,
    );
    console.log(`vidéo et GIF ${nom} écrits`);
  } catch (e) {
    console.log(`GIF ${nom} non produit (${e.message.split('\n')[0]}) ; la vidéo webm est disponible`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const erreurs = await captureEcrans(browser);
  if (!only) await planche(browser);
  if (!noVideo && MAQUETTES.includes('F-inspiration') && (!only || only === 'F-inspiration')) {
    await video(browser, '#/dashboard', 'dashboard', async (page) => {
      await sleep(3500);
      const carte = page.locator('main [class*=carte], main [class*=card], main article').first();
      if (await carte.count()) await carte.hover().catch(() => {});
      await sleep(800);
      const svg = page.locator('main svg').first();
      if (await svg.count()) {
        const b = await svg.boundingBox();
        if (b) {
          for (let i = 0; i < 6; i++) {
            await page.mouse.move(b.x + (b.width * (i + 1)) / 8, b.y + b.height / 2);
            await sleep(250);
          }
        }
      }
      await sleep(600);
      await page.evaluate(() => (location.hash = '#/audits'));
      await sleep(2200);
    });
    await video(browser, '#/retex', 'retex', async (page) => {
      await sleep(1500);
      const suivant = page.getByRole('button', { name: /point suivant|suivant/i }).first();
      for (let i = 0; i < 5; i++) {
        if (await suivant.count()) await suivant.click().catch(() => {});
        await sleep(900);
      }
      const tout = page.getByRole('button', { name: /tout dérouler/i }).first();
      if (await tout.count()) await tout.click().catch(() => {});
      await sleep(3500);
    });
  }
  await browser.close();
  const total = Object.values(erreurs).reduce((n, l) => n + l.length, 0);
  fs.writeFileSync(path.join(OUT, 'erreurs-console.json'), JSON.stringify(erreurs, null, 2));
  console.log(total ? `ATTENTION : ${total} erreur(s) console, voir screenshots/erreurs-console.json` : 'Aucune erreur console.');
})();
