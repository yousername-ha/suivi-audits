// Après la mise à jour en v7.5.0 : objets nouveaux créés par l'API (chemin normal), mesurés au passage.
// - tableaux de bord (migration 096) : « Global » proposé d'office, un tableau partagé avec le rôle RSSI et un tableau
//   public, créés par l'administrateur (droit de publier : chiffres calculés avec ses droits) ;
// - rapport fictif de l'Active Directory de grande taille (300 points non conformes × 200 noms, borne ADS_BORNES), importé
//   trois fois (le troisième import efface les noms du premier) ;
// - une action portée à 50 tâches par l'API (ADR 0111) ;
// Données fictives seulement (noms « compte-fictif-… », « poste-fictif-… »).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { session } from './client.mjs';
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const a = await session(idf.username, idf.password);
const ok = (r, w) => { if (r.status >= 300) throw new Error(`${w}: ${r.status} ${r.text().slice(0, 400)}`); return r; };
const out = { tableaux: {}, annuaire: [], taches: {} };

// 1. Tableaux de bord.
const t = ok(await a.get('/api/tableaux-de-bord'), 'tableaux').json;
const tous = t.tableaux ?? t.disponibles ?? t.items ?? [];
out.tableaux.formeListe = Object.keys(t);
const global = (Array.isArray(tous) ? tous : []).find((x) => x.modele === 'global' || x.nom === 'Global');
out.tableaux.global = global?.id ?? null;
const creer = async (nom) => {
  const r = await a.post('/api/tableaux-de-bord', { nom, depart: { type: 'standard' } });
  if (r.status === 201) return r.json;
  const l = ok(await a.get('/api/tableaux-de-bord'), 'tableaux').json;
  return (l.tableaux ?? []).find((x) => x.nom === nom);
};
const partage = await creer('Tableau partagé fictif');
const p1 = ok(await a.get(`/api/tableaux-de-bord/${partage.id}/partage`), 'partage-lire');
ok(await a.req('PUT', `/api/tableaux-de-bord/${partage.id}/partage`, { destinataires: [{ type: 'role', id: 'rssi' }], public: false }, { 'If-Match': p1.headers.etag }), 'partage');
const pub = await creer('Tableau public fictif');
const p2 = ok(await a.get(`/api/tableaux-de-bord/${pub.id}/partage`), 'public-lire');
ok(await a.req('PUT', `/api/tableaux-de-bord/${pub.id}/partage`, { destinataires: [], public: true }, { 'If-Match': p2.headers.etag }), 'public');
out.tableaux.partage = partage.id; out.tableaux.public = pub.id;

// 2. Rapport de l'Active Directory, grande taille.
const natures = ['utilisateur', 'service', 'groupe', 'ordinateur', 'controleur', 'gpo', 'approbation', 'autre'];
const rapport = (n) => ({
  rapport: { date: `2026-11-${String(10 + n).padStart(2, '0')}`, note: 2 + (n % 3), conformes: 120 + n,
    progression: [1, 2, 3, 4, 5].map((niveau) => ({ niveau, conformes: 20 + niveau + n, total: 80, pourcentage: null })) },
  points: Array.from({ length: 300 }, (_, i) => ({
    identifiant: `${['info', 'warn', 'vuln'][i % 3]}${1 + (i % 5)}_point_fictif_${i}`, reference: `R-FICTIF-${i}`, type: 1 + (i % 3), niveau: 1 + (i % 5),
    titre: `Point de contrôle fictif ${i} de l’annuaire`, objets: 200 + ((i * 37 + n * 11) % 4000),
    noms: Array.from({ length: 200 }, (_, j) => ({ nom: `${j % 4 === 3 ? 'poste' : 'compte'}-fictif-${String((j + n * 7 + i) % 5000).padStart(4, '0')}`, nature: natures[(i + j) % 8] })),
  })),
  ecartes: { nomsAuDela: 0, nomsIllisibles: 0, identifiantsSeuls: 0, nomsRaccourcis: 0, nomsEnDouble: 0, titresRaccourcis: 0 },
});
for (let n = 1; n <= 3; n++) {
  const corps = rapport(n);
  corps.points.forEach((p) => { p.noms = [...new Map(p.noms.map((x) => [`${x.nature}|${x.nom}`, x])).values()]; });
  const octets = Buffer.byteLength(JSON.stringify(corps));
  const r = ok(await a.post('/api/vulnerabilites/annuaire/imports', corps), 'import-ad');
  out.annuaire.push({ import: n, octetsCorps: octets, ms: Math.round(r.ms), statut: r.status, bilan: r.json });
  console.log('import AD', n, octets, 'octets', Math.round(r.ms), 'ms', JSON.stringify(r.json));
}

// 3. Une action du plan portée à 50 tâches par l'API.
const S = ok(await a.get('/api/grc/smsis'), 'smsis').json[0].id;
const liste = ok(await a.get(`/api/grc/${S}/objects?kind=action&search=Action%20du%20plan%20fictive&offset=0`), 'actions').json.items;
const cible = liste.find((o) => !o.data.seriesId && !o.data.taches) ?? liste[0];
const fiche = ok(await a.get(`/api/grc/${S}/objects/${cible.id}`), 'fiche');
const taches = Array.from({ length: 50 }, (_, i) => ({ id: crypto.randomUUID(), intitule: `Tâche fictive ${i + 1} saisie par l’API`, faite: i % 3 === 0, responsable: null, echeance: null }));
const r = ok(await a.req('PUT', `/api/grc/${S}/objects/${cible.id}`, { kind: 'action', name: fiche.json.name, data: { ...fiche.json.data, taches } }, { 'If-Match': fiche.headers.etag ?? `"${fiche.json.version}"` }), 'taches');
out.taches = { perimetre: S, action: cible.id, ms: Math.round(r.ms), statut: r.status, octets: r.bytes };
console.log('50 tâches', r.status, Math.round(r.ms), 'ms');
fs.writeFileSync(`${process.env.BANC}/mesures/preparation-v750.json`, JSON.stringify(out, null, 2));
