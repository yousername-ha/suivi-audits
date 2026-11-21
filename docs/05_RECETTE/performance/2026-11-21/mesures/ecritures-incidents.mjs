// Écritures dans le registre des incidents à 3 000 incidents (état historique) : 15 créations et 15 modifications
// séquentielles ; taille de l'instantané ajouté à state_history à chaque écriture.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { session, pct } from './client.mjs';
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const a = await session(idf.username, idf.password);
const q = (sql) => execSync(`${process.env.BANC}/perf/psql.sh -Atc "${sql}"`).toString().trim();
const S = q('select id from grc_smsis order by created_at, id limit 1');
const avant = q("select count(*) || '|' || coalesce(sum(pg_column_size(data)),0) || '|' || pg_total_relation_size('state_history') from state_history");
const creer = [], modifier = [];
let dernier;
for (let i = 0; i < 16; i++) {
  const r = await a.post('/api/incidents', { title: `Incident fictif de charge ${i}`, reporter: 'Agent fictif', smsi: S });
  if (r.status >= 300) throw new Error(r.text());
  if (i) creer.push(r.ms); dernier = r.json.id;
}
for (let i = 0; i < 16; i++) {
  const r = await a.patch(`/api/incidents/${dernier}`, { desc: `Description modifiée ${i}` });
  if (r.status >= 300) throw new Error(r.status + r.text().slice(0, 200));
  if (i) modifier.push(r.ms);
}
const apres = q("select count(*) || '|' || coalesce(sum(pg_column_size(data)),0) || '|' || pg_total_relation_size('state_history') from state_history");
const dernierInstantane = q('select pg_column_size(data) || \'|\' || octet_length(data::text) from state_history order by version desc limit 1');
const m = { incidents: Number(q('select count(*) from suivi_incidents')), creation: { repetitions: 15, medianeMs: Math.round(pct(creer, 50)), p95Ms: Math.round(pct(creer, 95)), maxMs: Math.round(Math.max(...creer)) },
  modification: { repetitions: 15, medianeMs: Math.round(pct(modifier, 50)), p95Ms: Math.round(pct(modifier, 95)), maxMs: Math.round(Math.max(...modifier)) },
  stateHistoryAvant: avant, stateHistoryApres: apres, dernierInstantaneOctetsStockes_Texte: dernierInstantane };
console.log(JSON.stringify(m, null, 1));
fs.writeFileSync(`${process.env.BANC}/mesures/ecritures-incidents.json`, JSON.stringify(m, null, 2));
