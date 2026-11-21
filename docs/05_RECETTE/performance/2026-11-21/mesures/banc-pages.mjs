// Pages à l'écran (Chromium du système piloté par Playwright) : temps jusqu'à la page utilisable = navigation lancée →
// plus aucune requête /api/ en cours depuis 500 ms (hors flux SSE /api/events) et aucun indicateur de chargement visible.
// Cache vide : nouveau contexte à chaque mesure ; cache chaud : seconde navigation dans le même contexte.
//   node banc-pages.mjs [repetitions] [compte]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { session, pct, BASE } from './client.mjs';
const require = createRequire(process.env.PLAYWRIGHT_DEPUIS || `${process.cwd()}/tests/e2e/package.json`);
const { chromium } = require('@playwright/test');
const REPET = Number(process.argv[2] || 5);
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const compte = process.argv[3] || 'admin';
const c = compte === 'admin' ? await session(idf.username, idf.password) : await session(compte, idf.motCharge);
const cookies = [...c.cookies].map(([name, value]) => ({ name, value, url: BASE, secure: true, httpOnly: true, sameSite: 'Strict' }));
const TOUTES = [
  ['Accueil (tableau de bord)', '/'],
  ['Tâches récurrentes', '/pilotage/recurrences'],
  ['Plan d’actions', '/pilotage/actions'],
  ['Risques', '/pilotage/risques'],
  ['Registre des incidents', '/pilotage/incidents-registre'],
  ['Documents', '/documents'],
  ['Vulnérabilités : vue d’ensemble', '/vulnerabilites/vue'],
  ['Vulnérabilités : failles', '/vulnerabilites/failles'],
  ['Vulnérabilités : machines', '/vulnerabilites/machines'],
  ['Vulnérabilités : veille', '/vulnerabilites/veille'],
  ['Journal d’audit', '/systeme/journal'],
  ['Périmètres (cartes)', '/pilotage/perimetres'],
];
// Passage du 21/11/2026 (v7.5.0) : frises refaites, veille réglementaire, annuaire AD.
if (process.env.V750) TOUTES.push(
  ['Plan d’actions : frise', '/pilotage/actions?tvue=timeline'],
  ['Tâches récurrentes : frise', '/pilotage/recurrences?tvue=timeline'],
  ['Veille réglementaire', '/veille-reglementaire'],
  ['Vulnérabilités : annuaire AD', '/vulnerabilites/annuaire'],
);
const PAGES = process.env.PAGE ? TOUTES.filter(([n]) => n.includes(process.env.PAGE)) : TOUTES;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--ignore-certificate-errors'] });
async function charger(page, chemin) {
  let enCours = 0, dernier = performance.now(), api = 0, octets = 0, erreurs = 0; const urlsErreur = [];
  const suivi = new Set();
  page.on('request', (r) => { if (r.url().includes('/api/') && !r.url().includes('/api/events')) { enCours++; api++; suivi.add(r); dernier = performance.now(); } });
  const fin = (r) => { if (suivi.delete(r)) { enCours--; dernier = performance.now(); } };
  page.on('requestfinished', async (r) => { try { const s = await r.sizes(); octets += s.responseBodySize; } catch { /* requête annulée : taille inconnue */ } fin(r); });
  page.on('requestfailed', (r) => { erreurs++; urlsErreur.push('échec ' + new URL(r.url()).pathname); fin(r); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) { erreurs++; urlsErreur.push(r.status() + ' ' + new URL(r.url()).pathname); } });
  const t0 = performance.now();
  await page.goto(BASE + chemin, { waitUntil: 'load', timeout: 120000 });
  const tLoad = performance.now() - t0;
  for (;;) {
    await page.waitForTimeout(50);
    if (enCours === 0 && performance.now() - dernier >= 500) {
      const chargeur = await page.locator('.mantine-Loader-root:visible, [aria-busy="true"]:visible').count();
      if (chargeur === 0) break;
    }
    if (performance.now() - t0 > 120000) break;
  }
  page.removeAllListeners();
  return { utilisableMs: Math.round(dernier - t0), loadMs: Math.round(tLoad), requetesApi: api, octetsApi: octets, erreurs, urlsErreur };
}
const out = [];
for (const [nom, chemin] of PAGES) {
  const froid = [], chaud = [];
  let detail = null;
  for (let i = 0; i < REPET + 1; i++) {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    const a = await charger(page, chemin);
    const b = await charger(page, chemin);
    if (i > 0) { froid.push(a.utilisableMs); chaud.push(b.utilisableMs); detail = { froid: a, chaud: b }; }
    await ctx.close();
  }
  const m = { compte, nom, chemin, repetitions: REPET, froidMedianeMs: pct(froid, 50), froidP95Ms: pct(froid, 95), froidMaxMs: Math.max(...froid),
    chaudMedianeMs: pct(chaud, 50), chaudP95Ms: pct(chaud, 95), chaudMaxMs: Math.max(...chaud), dernier: detail, seuilMs: 2000 };
  m.depasse = m.froidP95Ms > 2000 || m.chaudP95Ms > 2000;
  out.push(m);
  console.log(`${String(m.froidMedianeMs).padStart(6)} ${String(m.froidP95Ms).padStart(6)} | ${String(m.chaudMedianeMs).padStart(6)} ${String(m.chaudP95Ms).padStart(6)} ms  api=${detail.chaud.requetesApi} ${Math.round(detail.chaud.octetsApi / 1024)} Ko err=${detail.chaud.erreurs} [${detail.chaud.urlsErreur.join(', ')}] ${m.depasse ? 'DEPASSE' : ''} ${nom}`);
}
await browser.close();
fs.writeFileSync(`${process.env.BANC}/mesures/pages-${compte}.json`, JSON.stringify({ date: new Date().toISOString(), mesures: out }, null, 2));
