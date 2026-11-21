// Charge : N personnes fictives simultanées (comptes charge01..20, contributeurs ou lecteurs sur 6 périmètres), mélange
// réaliste de lectures (listes, fiches, tableaux de bord) et d'écritures (≈ 5 %), temps de réflexion 0,5 à 2 s.
// Relevés : latences par route, erreurs, débit ; toutes les 5 s, connexions de l'API à PostgreSQL (actives, en attente de
// verrou) ; toutes les 30 s, mémoire et processeur des conteneurs (docker stats).
//   node charge.mjs <personnes> <minutes> <etiquette> [reflexionMinMs] [reflexionMaxMs]
import fs from 'node:fs';
import { execSync, exec } from 'node:child_process';
import { session, pct } from './client.mjs';
const [N = '20', MIN = '10', ETIQ = 'charge', RMIN = '500', RMAX = '2000'] = process.argv.slice(2);
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const q = (sql) => execSync(`${process.env.BANC}/perf/psql.sh -Atc "${sql}"`).toString().trim();
const perims = q('select id from grc_smsis order by created_at, id limit 6').split('\n');
const actions = {};
for (const s of perims) actions[s] = q(`select id from grc_objects where kind='action' and smsi_id='${s}' and not archived and data->>'status' in ('todo','progress') limit 200`).split('\n').filter(Boolean);
const machines = q('select id from vulnerabilites_machines limit 300').split('\n');
const constats = q('select id from vulnerabilites_constats limit 300').split('\n');
const vuln = new Set(q("select u.username from users u join user_roles ur on ur.user_id=u.id where ur.role_id in ('rssi','administrateur')").split('\n'));
const lecteurs = new Set(q("select u.username from users u join user_roles ur on ur.user_id=u.id where ur.role_id='lecteur'").split('\n'));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const now = new Date(); const de = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(); const a = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59)).toISOString();
// [poids, nom, fonction(c, s) -> Promise<réponse>]
const MELANGE = [
  [10, 'tasks', (c, s) => c.get(`/api/grc/${s}/tasks?search=&offset=0`)],
  [5, 'tasks-window', (c, s) => c.get(`/api/grc/${s}/tasks/window?from=${de}&to=${a}`)],
  [4, 'tasks-dashboard', (c, s) => c.get(`/api/grc/${s}/tasks/dashboard`)],
  [10, 'actions', (c, s) => c.get(`/api/grc/${s}/objects?kind=action&search=&offset=${Math.random() < 0.8 ? 0 : 50 * Math.floor(Math.random() * 10)}`)],
  [8, 'fiche-action', (c, s) => c.get(`/api/grc/${s}/objects/${pick(actions[s])}`)],
  [6, 'risques-registre', (c, s) => c.get(`/api/grc/${s}/risks/register`)],
  [3, 'risk-map', (c, s) => c.get(`/api/grc/${s}/risk-map`)],
  [5, 'incidents', (c, s) => c.get(`/api/incidents?smsi=${s}`)],
  [5, 'documents', (c) => c.get('/api/documents')],
  [5, 'vuln-constats', (c) => c.get('/api/vulnerabilites/constats')],
  [4, 'vuln-machines', (c) => c.get('/api/vulnerabilites/machines')],
  [3, 'vuln-fiche-machine', (c) => c.get(`/api/vulnerabilites/machines/${pick(machines)}`)],
  [3, 'vuln-fiche-constat', (c) => c.get(`/api/vulnerabilites/constats/${pick(constats)}`)],
  [3, 'vuln-vue', (c) => c.get('/api/vulnerabilites/vue-ensemble')],
  [8, 'notifications', (c) => c.get('/api/grc/notifications')],
  [5, 'dashboard', (c, s) => c.get(`/api/grc/${s}/dashboard`)],
  [3, 'synthese-perimetres', (c) => c.get('/api/grc/perimetres/synthese')],
  [4, 'mes-elements', (c) => c.get('/api/registres/mes-elements')],
  [3, 'me', (c) => c.get('/api/auth/me')],
  // Passage du 21/11/2026 (v7.5.0, CHARGE_V750=1) : accueil à plusieurs tableaux, veille chargée, veille réglementaire.
  ...(process.env.CHARGE_V750 ? [
    [3, 'accueil-tableaux', (c) => c.get('/api/tableaux-de-bord')],
    [2, 'vuln-veille-avis', (c) => c.get('/api/vulnerabilites/veille/avis')],
    [2, 'vr-publications', (c) => c.get('/api/veille-reglementaire/publications?statut=a-qualifier')],
  ] : []),
  [3, 'ecr-action-creer', async (c, s) => c.post(`/api/grc/${s}/objects`, { kind: 'action', name: 'Action fictive de charge', data: { description: 'Charge', status: 'todo', ownerId: null, startAt: null, dueAt: new Date(Date.now() + 30 * 864e5).toISOString(), priority: 'normal', category: 'action', justification: '', reminderDays: 7, dependencies: [] } })],
  [2, 'ecr-action-modifier', async (c, s) => {
    const id = pick(actions[s]); const r = await c.get(`/api/grc/${s}/objects/${id}`);
    if (r.status !== 200) return r;
    const o = r.json; return c.req('PUT', `/api/grc/${s}/objects/${id}`, { kind: 'action', name: o.name, data: { ...o.data, description: 'Modifiée en charge ' + Date.now() } }, { 'If-Match': r.headers.etag ?? `"${o.version}"` });
  }],
];
const total = MELANGE.reduce((x, [p]) => x + p, 0);
const tirer = () => { let r = Math.random() * total; for (const m of MELANGE) { r -= m[0]; if (r <= 0) return m; } return MELANGE[0]; };
const res = []; const erreurs = {};
const fin = Date.now() + Number(MIN) * 60000;
const debut = Date.now();
const veille = setInterval(() => {
  exec(`${process.env.BANC}/perf/psql.sh -Atc "select count(*) filter (where state='active'), count(*) filter (where state like 'idle in%'), count(*) filter (where wait_event_type='Lock'), count(*) from pg_stat_activity where usename='suivi_app'"`, (e, o) => {
    if (!e) fs.appendFileSync(`${process.env.BANC}/mesures/${ETIQ}-connexions.txt`, `${Math.round((Date.now() - debut) / 1000)}|${o.trim()}\n`);
  });
}, 5000);
const stats = setInterval(() => {
  exec(`docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' suivi-banc-perf-app-1 suivi-banc-perf-db-1`, (e, o) => {
    if (!e) fs.appendFileSync(`${process.env.BANC}/mesures/${ETIQ}-docker-stats.txt`, o.trim().split('\n').map((l) => `${Math.round((Date.now() - debut) / 1000)}|${l}`).join('\n') + '\n');
  });
}, 30000);
async function personne(i) {
  const nom = idf.charge[i % idf.charge.length];
  const c = await session(nom, idf.motCharge);
  while (Date.now() < fin) {
    let [, route, f] = tirer();
    if (route.startsWith('ecr-') && lecteurs.has(nom)) [, route, f] = MELANGE[3];
    // Vulnérabilités : réservées aux comptes qui ont le droit de lecture du module (RSSI) ; les autres lisent une autre liste.
    if ((route.startsWith('vuln-') || route.startsWith('vr-')) && !vuln.has(nom)) [, route, f] = MELANGE[0];
    const s = pick(perims);
    const t = performance.now();
    let statut;
    try { const r = await f(c, s); statut = r.status; if (r.status >= 400) erreurs[`${route} ${r.status} ${r.text().slice(0, 120)}`] = (erreurs[`${route} ${r.status} ${r.text().slice(0, 120)}`] || 0) + 1; }
    catch (e) { statut = 'exception'; erreurs[`${route} ${e.message}`] = (erreurs[`${route} ${e.message}`] || 0) + 1; }
    res.push({ route, ms: performance.now() - t, statut, t: Date.now() - debut });
    await new Promise((r) => setTimeout(r, Number(RMIN) + Math.random() * (Number(RMAX) - Number(RMIN))));
  }
}
await Promise.all(Array.from({ length: Number(N) }, (_, i) => personne(i)));
clearInterval(veille); clearInterval(stats);
const parRoute = {};
for (const r of res) (parRoute[r.route] ||= []).push(r);
const synthese = Object.entries(parRoute).map(([route, l]) => {
  const d = l.map((x) => x.ms);
  return { route, n: l.length, erreurs: l.filter((x) => x.statut === 'exception' || x.statut >= 400).length, medianeMs: Math.round(pct(d, 50)), p95Ms: Math.round(pct(d, 95)), maxMs: Math.round(Math.max(...d)) };
}).sort((x, y) => y.p95Ms - x.p95Ms);
const toutes = res.map((x) => x.ms);
const g = { etiquette: ETIQ, personnes: Number(N), minutes: Number(MIN), reflexionMs: [Number(RMIN), Number(RMAX)], requetes: res.length,
  debitParSeconde: +(res.length / ((Date.now() - debut) / 1000)).toFixed(2), erreurs: res.filter((x) => x.statut === 'exception' || x.statut >= 400).length,
  medianeMs: Math.round(pct(toutes, 50)), p95Ms: Math.round(pct(toutes, 95)), maxMs: Math.round(Math.max(...toutes)), detailErreurs: erreurs, parRoute: synthese };
fs.writeFileSync(`${process.env.BANC}/mesures/${ETIQ}.json`, JSON.stringify(g, null, 2));
console.log(JSON.stringify({ ...g, parRoute: undefined }, null, 1));
for (const s of synthese) console.log(`${String(s.n).padStart(6)} err=${String(s.erreurs).padStart(4)} ${String(s.medianeMs).padStart(6)} ${String(s.p95Ms).padStart(6)} ${String(s.maxMs).padStart(6)} ms ${s.route}`);
