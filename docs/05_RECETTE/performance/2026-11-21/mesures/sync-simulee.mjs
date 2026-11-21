// Synchronisation Tenable simulée localement (aucun réseau extérieur) : même chemin serveur que l'exécutant d'exploitation
// (scripts/exploitation-worker.py) : `suivi integrations-claim`, puis `suivi integrations-lot <id>` par lots de 500 éléments
// (un `docker exec` par lot, comme `docker compose exec -T app suivi …`), puis `suivi integrations-finish <id>`.
// Le script isolé integration-http.py (lecture de Tenable) n'est PAS exercé : seule la réception côté application est mesurée.
// Données fictives : machines *.hopital.example, adresses 192.0.2.0/24 et 198.51.100.0/24, CVE-2099-nnnnn.
//   node sync-simulee.mjs preparer            crée l'instance (API) et renvoie son identifiant
//   node sync-simulee.mjs synchroniser <inst> [machines] [constats] [detections]
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { session } from './client.mjs';
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const a = await session(idf.username, idf.password);
const ok = (r, w) => { if (r.status >= 300) throw new Error(`${w}: ${r.status} ${r.text().slice(0, 300)}`); return r; };
const cli = (args, input) => execFileSync('docker', ['exec', '-i', 'suivi-banc-perf-app-1', 'suivi', ...args], { input: input ?? '', maxBuffer: 1 << 26 }).toString();
const [cmd, inst, nbM = '1000', nbC = '3000', nbD = '20000'] = process.argv.slice(2);

if (cmd === 'preparer') {
  const cle = () => crypto.randomBytes(24).toString('hex');
  const i = ok(await a.post('/api/integrations/instances', { type: 'tenable', nom: 'Tenable fictif', smsiId: null, configuration: { adresse: 'https://tenable.hopital.example' } }), 'creation').json;
  ok(await a.put(`/api/integrations/instances/${i.id}/secrets`, { accessKey: cle(), secretKey: cle() }), 'secrets');
  const v = ok(await a.get(`/api/integrations/instances/${i.id}`), 'lecture');
  const r = await a.req('POST', `/api/integrations/instances/${i.id}/activation`, { actif: true, fluxConfirme: true }, { 'If-Match': v.headers.etag });
  if (r.status >= 300) { const r2 = await a.req('PUT', `/api/integrations/instances/${i.id}/activation`, { actif: true, fluxConfirme: true }, { 'If-Match': v.headers.etag }); ok(r2, 'activation'); }
  console.log(i.id);
  process.exit(0);
}

// Éléments déterministes : machine k = UUID dérivé de k ; constats concentrés (Zipf) ; 80 % des détections sur 20 % des machines.
const uuidDe = (k) => { const h = crypto.createHash('sha256').update('machine-fictive-' + k).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const iso = (d) => new Date(d).toISOString();
let s = 7; const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const M = Number(nbM), C = Number(nbC), D = Number(nbD);
const elements = [];
for (let k = 0; k < M; k++) {
  const uuid = uuidDe(k);
  elements.push({ type: 'machine', cle: `uuid:${uuid}`, uuid, nom: `srv-${String(k).padStart(4, '0')}.hopital.example`, adresse: k < 250 ? `192.0.2.${k + 1}` : `198.51.100.${(k % 250) + 1}`,
    systeme: (['Linux fictif 8', 'Windows Server fictif 2019', 'Windows fictif 10', 'Appliance fictive'])[k % 4], premiere: iso(Date.UTC(2017, k % 12, 1)), derniere: iso(Date.now() - 86400000),
    exposition: k % 10 === 0 ? 'internet' : 'interne', acr: 1 + (k % 9), depot: { id: String(1 + (k % 6)), nom: `Depot fictif ${1 + (k % 6)}` } });
}
const grav = ['critique', 'elevee', 'moyenne', 'faible'];
for (let c = 0; c < C; c++) {
  const plugin = 100000 + c;
  elements.push({ type: 'constat', plugin: String(plugin), nom: `Faille fictive du composant ${c}`, gravite: grav[c % 4], famille: (['Windows', 'Linux', 'Web', 'Bases de données'])[c % 4],
    synopsis: 'Synopsis fictif de la faille.', correctif: 'Appliquer la mise à jour fictive.', cvss3Vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', cvss3Score: 4 + (c % 60) / 10,
    vpr: 3 + (c % 70) / 10, epss: (c % 100) / 1000, exploitable: c % 7 === 0, exploitLibelle: c % 7 === 0 ? 'Code d’exploitation public' : null,
    failleLe: iso(Date.UTC(2017 + (c % 9), c % 12, 1)), correctifLe: iso(Date.UTC(2017 + (c % 9), c % 12, 15)), finSupportLe: null,
    voirAussi: `https://editeur.example/avis/${c}`, cves: [`CVE-2099-${String(10000 + c).padStart(5, '0')}`, `CVE-2099-${String(30000 + c).padStart(5, '0')}`], cvesTronquees: false });
}
const vues = new Set();
for (let d = 0; vues.size < D; d++) {
  const k = rnd() < 0.8 ? Math.floor(rnd() * M * 0.2) : Math.floor(rnd() * M);
  const c = Math.floor(Math.pow(rnd(), 2) * C);
  const port = ([0, 22, 80, 443, 445, 3389, 1433, 8080])[Math.floor(rnd() * 8)];
  const cle = `${c}|${k}|${port}`; if (vues.has(cle)) continue; vues.add(cle);
  elements.push({ type: 'detection', plugin: String(100000 + c), machine: `uuid:${uuidDe(k)}`, port, protocole: 'TCP', premiere: iso(Date.UTC(2018, k % 12, 1)), derniere: iso(Date.now() - 86400000),
    attenue: false, risqueAccepte: false, risqueRequalifie: false });
}
{ const r = await a.post(`/api/integrations/instances/${inst}/synchroniser`, {}); console.error('demande', r.status, r.status >= 300 ? r.text().slice(0, 200) : ''); }
const t0 = performance.now();
const job = JSON.parse(cli(['integrations-claim']).trim() || 'null');
if (!job) throw new Error('aucune demande réclamée');
const tClaim = performance.now() - t0;
const lots = [];
for (let i = 0; i < elements.length; i += 500) {
  const t = performance.now();
  cli(['integrations-lot', job.id], JSON.stringify({ elements: elements.slice(i, i + 500) }));
  lots.push(Math.round(performance.now() - t));
}
const tLots = performance.now() - t0;
const resultat = { pages: Math.min(100, Math.ceil(D / 200)), constats: C, detections: D, machines: M, hotes: 0, ecartes: 0, elements: elements.length, tronque: false, inventaire: { ok: true, erreur: null } };
cli(['integrations-finish', job.id], JSON.stringify({ ok: true, resultat, erreur: null }));
const total = performance.now() - t0;
const tri = [...lots].sort((x, y) => x - y);
const m = { date: new Date().toISOString(), machines: M, constats: C, detections: D, elements: elements.length, lots: lots.length, claimMs: Math.round(tClaim),
  lotsMs: Math.round(tLots - tClaim), finishMs: Math.round(total - tLots), totalMs: Math.round(total), lotMedianeMs: tri[Math.floor(tri.length / 2)], lotP95Ms: tri[Math.ceil(tri.length * 0.95) - 1], lotMaxMs: tri.at(-1) };
console.log(JSON.stringify(m));
fs.appendFileSync(process.env.BANC + '/mesures/synchronisations.jsonl', JSON.stringify(m) + '\n');
