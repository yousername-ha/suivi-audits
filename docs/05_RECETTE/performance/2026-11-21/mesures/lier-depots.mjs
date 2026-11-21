// Vulnérabilités, chemin normal (API) : les 6 dépôts de Tenable reliés aux 6 premiers périmètres (ceux des comptes de
// charge), et 80 machines avec un périmètre propre (affectation en masse), comme le 19/11.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { session } from './client.mjs';
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const a = await session(idf.username, idf.password);
const q = (sql) => execSync(`${process.env.BANC}/perf/psql.sh -Atc "${sql}"`).toString().trim();
const ok = (r, w) => { if (r.status >= 300) throw new Error(`${w}: ${r.status} ${r.text().slice(0, 300)}`); return r; };
const perims = q('select id from grc_smsis order by created_at, id limit 30').split('\n');
const depots = ok(await a.get('/api/vulnerabilites/depots'), 'depots').json;
const liste = Array.isArray(depots) ? depots : depots.depots ?? depots.items;
for (const [i, d] of liste.entries()) {
  const r = await a.req('PUT', `/api/vulnerabilites/depots/${d.id}`, { perimetreId: perims[i % 6] }, { 'If-Match': `"${d.version}"` });
  console.log('depot', d.nom ?? d.id, r.status);
}
const machines = q("select id || '|' || version from vulnerabilites_machines order by identifiant_source limit 80 offset 300").split('\n').map((l) => { const [id, v] = l.split('|'); return { id, version: Number(v) }; });
for (let i = 0; i < 80; i += 20) {
  const r = await a.post('/api/vulnerabilites/machines/affectation', { machines: machines.slice(i, i + 20), perimetreId: perims[6 + (i / 20)] });
  console.log('affectation', r.status, r.status >= 300 ? r.text().slice(0, 200) : '');
}
