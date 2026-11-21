// Écritures nouvelles de la v7.5.0, à une personne (1 échauffement + 15 mesures chacune) :
// - qualification d'une publication de la veille réglementaire (domaine sécurité, rôle RSSI : compte charge01), If-Match ;
// - modification d'une action portant 50 tâches (une tâche cochée de plus à chaque fois), If-Match ;
// - création d'un tableau de bord puis sa suppression (compte charge01).
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { session, pct } from './client.mjs';
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const rssi = await session(idf.charge[0], idf.motCharge);
const admin = await session(idf.username, idf.password);
const q = (sql) => execSync(`${process.env.BANC}/perf/psql.sh -Atc "${sql}"`).toString().trim();
const res = (nom, d, extra = {}) => ({ nom, repetitions: d.length, medianeMs: Math.round(pct(d, 50)), p95Ms: Math.round(pct(d, 95)), maxMs: Math.round(Math.max(...d)), ...extra });
const out = [];

// 1. Qualification (veille réglementaire).
const ids = q("select id from veille_reglementaire_publications where statut='a-qualifier' and domaine='securite' order by publie_le desc limit 16").split('\n');
const qual = [];
for (const [i, id] of ids.entries()) {
  const f = await rssi.get(`/api/veille-reglementaire/publications/${id}`);
  const r = await rssi.req('PATCH', `/api/veille-reglementaire/publications/${id}`, { statut: i % 2 ? 'a-suivre' : 'sans-objet' }, { 'If-Match': f.headers.etag });
  if (r.status >= 300) throw new Error('qualification ' + r.status + ' ' + r.text().slice(0, 200));
  if (i) qual.push(r.ms);
}
out.push(res('Veille réglementaire : qualification (PATCH, RSSI)', qual));

// 2. Action à 50 tâches.
const prep = JSON.parse(fs.readFileSync(`${process.env.BANC}/mesures/preparation-v750.json`));
const { perimetre: S, action: A } = prep.taches;
const mod = [];
for (let i = 0; i < 16; i++) {
  const f = await admin.get(`/api/grc/${S}/objects/${A}`);
  const taches = f.json.data.taches.map((t, j) => ({ ...t, faite: j <= i }));
  const r = await admin.req('PUT', `/api/grc/${S}/objects/${A}`, { kind: 'action', name: f.json.name, data: { ...f.json.data, taches } }, { 'If-Match': f.headers.etag ?? `"${f.json.version}"` });
  if (r.status >= 300) throw new Error('taches ' + r.status + ' ' + r.text().slice(0, 200));
  if (i) mod.push(r.ms);
}
out.push(res('Action à 50 tâches : modification (PUT, administrateur)', mod));

// 3. Tableau de bord : création et suppression.
const cr = [], sup = [];
for (let i = 0; i < 16; i++) {
  const r = await rssi.post('/api/tableaux-de-bord', { nom: `Tableau fictif de charge ${i}`, depart: { type: 'standard' } });
  if (r.status >= 300) throw new Error('creation tableau ' + r.status + ' ' + r.text().slice(0, 200));
  const d = await rssi.req('DELETE', `/api/tableaux-de-bord/${r.json.id}`, undefined, { 'If-Match': r.headers.etag ?? `"${r.json.version}"` });
  if (d.status >= 300) throw new Error('suppression tableau ' + d.status + ' ' + d.text().slice(0, 200));
  if (i) { cr.push(r.ms); sup.push(d.ms); }
}
out.push(res('Tableau de bord : création (POST, RSSI)', cr), res('Tableau de bord : suppression (DELETE, RSSI)', sup));
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(`${process.env.BANC}/mesures/ecritures-v750.json`, JSON.stringify({ date: new Date().toISOString(), mesures: out }, null, 2));
