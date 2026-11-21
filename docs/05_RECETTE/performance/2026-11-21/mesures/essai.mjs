// Un appel d'une route avec la session de l'administrateur (ou COMPTE=charge01) : statut, durée, taille, début du corps.
//   node essai.mjs GET /api/... [corps JSON]
import fs from 'node:fs';
import { session } from './client.mjs';
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const compte = process.env.COMPTE || 'admin';
const c = compte === 'admin' ? await session(idf.username, idf.password) : await session(compte, idf.motCharge);
const [method, path, body] = process.argv.slice(2);
const r = await c.req(method, path, body ? JSON.parse(body) : undefined);
console.log(r.status, Math.round(r.ms) + 'ms', r.bytes + 'B');
const n = Number(process.env.N ?? 1500);
if (n) console.log(r.text().slice(0, n));
