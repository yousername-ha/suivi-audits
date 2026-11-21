// Remplissage par l'API (chemin normal) : périmètres, comptes, accès, séries récurrentes, échantillons d'actions, risques,
// incidents et documents. Données fictives. Les identifiants des comptes de charge restent hors dépôt (0600).
// Passage du 21/11/2026 : réunit en un script les étapes du 19/11 (remplir-api.mjs puis remplir-api-2 à 5 et
// registres-manquants.mjs), mêmes graines, mêmes volumes, mêmes formes ; exécuté sur la pile en v7.4.0.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { Client, session } from './client.mjs';
const IDF = '/srv/suivi-banc-perf/identifiants.json';
const idf = JSON.parse(fs.readFileSync(IDF));
const a = await session(idf.username, idf.password);
let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const ok = (r, what) => { if (r.status >= 300) throw new Error(`${what}: ${r.status} ${r.text().slice(0, 300)}`); return r.json; };
const t0 = Date.now(); const etapes = {};
const etape = (n) => { etapes[n] = Math.round((Date.now() - t0) / 1000); console.log(n, etapes[n] + 's'); };
// Limite de 20 connexions par adresse et par 15 min : l'API est redémarrée (compteur en mémoire) avant les connexions des
// comptes de charge, comme le 19/11.
const relancer = () => { execSync('docker restart suivi-banc-perf-app-1'); execSync('until [ "$(docker inspect -f {{.State.Health.Status}} suivi-banc-perf-app-1)" = healthy ]; do sleep 2; done', { shell: '/bin/bash' }); };

// 1. Périmètres : 30 au total (périmètre commun + existants + nouveaux), pyramide : 4 établissements, sites rattachés.
let smsis = ok(await a.get('/api/grc/smsis'), 'smsis');
const etabs = [];
for (let i = 1; smsis.length + etabs.length < 6 && i <= 4; i++)
  etabs.push(ok(await a.post('/api/grc/smsis', { name: `Etablissement fictif ${i}`, scope: 'Établissement de santé fictif', timezone: 'Europe/Paris' }), 'etab'));
smsis = ok(await a.get('/api/grc/smsis'), 'smsis');
for (let i = 1; smsis.length < 30; i++) {
  const parent = etabs.length ? etabs[i % etabs.length].id : null;
  ok(await a.post('/api/grc/smsis', { name: `Site fictif ${String(i).padStart(2, '0')}`, scope: 'Site fictif', parentId: parent, timezone: 'Europe/Paris' }), 'site');
  smsis = ok(await a.get('/api/grc/smsis'), 'smsis');
}
const ids = smsis.map((s) => s.id);
// poids inégaux (loi de Zipf douce) : le premier périmètre porte ~12 %, le dernier ~1,5 %
const poids = ids.map((_, i) => 1 / Math.pow(i + 1, 0.8)); const somme = poids.reduce((x, y) => x + y);
const tirerPerimetre = () => { let r = rnd() * somme; for (let i = 0; i < ids.length; i++) { r -= poids[i]; if (r <= 0) return ids[i]; } return ids.at(-1); };
etape('perimetres');

// 2. Comptes : 300 au total ; 20 comptes de charge (charge01..20).
const users = ok(await a.get('/api/admin/users'), 'users');
const existants = new Set(users.map((u) => u.username));
const charge = [];
for (let i = 1; existants.size < 300; i++) {
  const nom = i <= 20 ? `charge${String(i).padStart(2, '0')}` : `agent${String(i).padStart(3, '0')}`;
  if (existants.has(nom)) continue;
  const role = i <= 2 ? 'rssi' : i <= 20 ? (i % 3 === 0 ? 'lecteur' : 'contributeur') : rnd() < 0.05 ? 'rssi' : rnd() < 0.7 ? 'contributeur' : 'lecteur';
  const r = ok(await a.post('/api/admin/users', { username: nom, displayName: `Agent fictif ${i}`, email: `${nom}@hopital.example`, roles: [{ roleId: role }] }), 'user');
  existants.add(nom);
  if (i <= 20) charge.push({ username: nom, id: r.id, temp: r.temporaryPassword, role });
}
etape('comptes');
const tous = ok(await a.get('/api/admin/users'), 'users');
// 3. Accès aux périmètres : chaque compte non administrateur sur 1 à 4 périmètres ; comptes de charge sur 6 périmètres.
let acces = 0;
for (const u of tous) {
  if (u.username === idf.username) continue;
  const n = u.username.startsWith('charge') ? 6 : 1 + Math.floor(rnd() * 4);
  const set = new Set(); while (set.size < n) set.add(u.username.startsWith('charge') ? ids[set.size] : tirerPerimetre());
  for (const s of set) { ok(await a.put(`/api/grc/${s}/members`, { userId: u.id, write: rnd() < 0.6 || u.username.startsWith('charge') }), 'member'); acces++; }
}
etape('acces');
// Comptes de charge : première connexion, changement du mot de passe temporaire.
const motCharge = 'Ch-' + crypto.randomBytes(15).toString('base64').replace(/[^A-Za-z0-9]/g, '') + '!7';
relancer();
for (const [n, u] of charge.entries()) {
  if (n === 15) relancer();
  const c = new Client(); await c.login(u.username, u.temp);
  ok(await c.post('/api/account/password', { current: u.temp, next: motCharge }), 'pwd');
  await c.refreshCsrf();
  fs.mkdirSync('/srv/suivi-banc-perf/sessions', { recursive: true, mode: 0o700 });
  fs.writeFileSync(`/srv/suivi-banc-perf/sessions/${u.username}.json`, JSON.stringify([...c.cookies]), { mode: 0o600 });
}
fs.writeFileSync(IDF, JSON.stringify({ ...idf, charge: charge.map((u) => u.username), motCharge }), { mode: 0o600 });
etape('motsDePasseCharge');

// 4. Séries récurrentes : 150 mensuelles commencées il y a dix ans (l'automate génère ~120 occurrences chacune).
const owners = tous.filter((u) => u.username !== idf.username).map((u) => u.id);
const titres = ['Revue des comptes à privilèges', 'Contrôle des sauvegardes', 'Test de restauration', 'Revue des journaux', 'Mise à jour antivirale', 'Revue des pare-feux', 'Contrôle des habilitations', 'Vérification des correctifs', 'Revue des accès distants', 'Contrôle de la climatisation'];
for (let i = 0; i < 150; i++) {
  const s = tirerPerimetre();
  const jour = String(1 + Math.floor(rnd() * 27)).padStart(2, '0');
  ok(await a.post(`/api/grc/${s}/objects`, { kind: 'task_series', name: `${pick(titres)} ${i + 1}`, data: {
    description: 'Tâche d’exploitation récurrente fictive', ownerId: pick(owners), category: 'action', priority: pick(['low', 'normal', 'normal', 'high']), refs: [],
    recurrence: { start: `2016-12-${jour}`, time: '09:00', timezone: 'Europe/Paris', unit: 'month', interval: 1, until: null, count: null, reminderDays: 7, active: true } } }), 'series');
}
etape('series');
// 5. Échantillon d'actions du plan (50), de risques (20, après publication d'une méthode), d'incidents (30), de documents (20).
for (let i = 0; i < 50; i++) {
  const due = new Date(Date.UTC(2017 + Math.floor(rnd() * 11), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27), 9));
  ok(await a.post(`/api/grc/${tirerPerimetre()}/objects`, { kind: 'action', name: `Action du plan fictive ${i + 1}`, data: {
    description: 'Action fictive du plan', status: pick(['todo', 'progress']), ownerId: null, startAt: null,
    dueAt: due.toISOString(), priority: pick(['low', 'normal', 'high', 'urgent']), category: 'action', justification: '', reminderDays: 7, dependencies: [] } }), 'action');
}
etape('actionsApi');
const methodes = {}, membres = {};
for (const s of ids) {
  const tpl = ok(await a.get('/api/grc/methods/templates/iso27005'), 'tpl');
  const pv = ok(await a.post(`/api/grc/${s}/methods/preview`, { id: null, definition: tpl }), 'preview');
  const pub = ok(await a.post(`/api/grc/${s}/methods/publish`, { id: null, definition: tpl, previewId: pv.previewId, reason: 'Méthode de recette du banc', confirm: 'PUBLIER' }, { 'If-Match': '"0"' }), 'publish');
  const m = ok(await a.get(`/api/grc/${s}/methods`), 'methods')[0];
  methodes[s] = { id: m?.methodId ?? pub.id ?? pub.methodId, version: m?.version ?? pub.version ?? 1 };
  membres[s] = ok(await a.get(`/api/grc/${s}/members`), 'members').filter((x) => x.write).map((x) => x.userId);
}
etape('methodes');
for (let i = 0; i < 20; i++) {
  const s = tirerPerimetre();
  ok(await a.post(`/api/grc/${s}/objects`, { kind: 'risk', name: `Risque fictif ${i + 1}`, data: {
    description: 'Risque fictif', code: `R-${i + 1}`, ownerId: membres[s].length ? pick(membres[s]) : null, methodId: methodes[s].id, methodVersion: methodes[s].version, domain: 'information',
    entity: `Entité ${i % 7}`, scope: 'Recette', strategy: pick(['reduce', 'accept', 'transfer', 'avoid']), acceptanceReason: 'Risque résiduel accepté par la direction fictive', reviewAt: '2027-06-30', stages: {} } }), 'risk');
}
etape('risquesApi');
const tIncidents = [];
for (let i = 0; i < 30; i++) {
  const r = await a.post('/api/incidents', { title: `Incident fictif API ${i + 1}`, reporter: 'Agent fictif', smsi: tirerPerimetre() });
  ok(r, 'incident'); tIncidents.push(Math.round(r.ms));
}
etape('incidentsApi');
for (let i = 0; i < 20; i++) {
  const meta = encodeURIComponent(JSON.stringify({ title: `Procédure fictive ${i + 1}`, description: 'Document fictif', category: 'Procédure', tags: [], refs: [], classification: 'interne' }));
  const r = await a.req('POST', '/api/documents', Buffer.from(`Procédure fictive ${i + 1}\n`.repeat(50)), { 'X-File-Name': `procedure-${i + 1}.txt`, 'X-Meta': meta, 'Content-Type': 'application/octet-stream' });
  if (r.status >= 300) { console.log('document', r.status, r.text().slice(0, 300)); break; }
}
etape('documentsApi');
// 6. Registre « plan d'actions » par défaut de chaque périmètre : créé par la première action (remplir-sql.sql s'y range).
const manquants = execSync(`${process.env.BANC}/perf/psql.sh -Atc "select id from grc_smsis s where not exists (select 1 from registres r where r.reference_smsi_id=s.id and r.kind='plan_actions' and r.par_defaut)"`).toString().trim().split('\n').filter(Boolean);
for (const s of manquants)
  ok(await a.post(`/api/grc/${s}/objects`, { kind: 'action', name: 'Action fictive d’ouverture du plan', data: { description: 'Action fictive', status: 'todo', ownerId: null, startAt: null, dueAt: '2027-03-01T09:00:00.000Z', priority: 'normal', category: 'action', justification: '', reminderDays: 7, dependencies: [] } }), 'ouverture');
etape('registresParDefaut');
fs.writeFileSync(process.env.BANC + '/mesures/remplissage-api.json', JSON.stringify({ etapes, tIncidentsCreationMs: tIncidents, acces, registresOuverts: manquants.length }, null, 2));
