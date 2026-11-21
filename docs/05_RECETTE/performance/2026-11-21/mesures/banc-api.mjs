// Banc à une personne : chaque route, 1 passage d'échauffement puis REPET passages séquentiels (cache chaud), médiane / p95 /
// max, taille de la réponse. Compte administrateur et compte de charge (contributeur sur 6 périmètres).
//   node banc-api.mjs [etiquette] [filtre]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { session, pct } from './client.mjs';
const REPET = Number(process.env.REPET || 15);
const idf = JSON.parse(fs.readFileSync('/srv/suivi-banc-perf/identifiants.json'));
const q = (sql) => execSync(`${process.env.BANC}/perf/psql.sh -Atc "${sql}"`).toString().trim();
const S = q("select id from grc_smsis order by created_at, id limit 1");
const machine = q("select machine_id from vulnerabilites_detections group by 1 order by count(*) desc limit 1");
const constat = q("select constat_id from vulnerabilites_detections group by 1 order by count(*) desc limit 1");
const action = q(`select id from grc_objects where kind='action' and smsi_id='${S}' and data ? 'seriesId' limit 1`);
const risque = q(`select id from grc_objects where kind='risk' and smsi_id='${S}' limit 1`);
const doc = q('select id from documents order by created_at desc limit 1');
const mois = new Date(); const de = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth(), 1)).toISOString(); const a = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 0, 23, 59)).toISOString();
const moisPrec = `${mois.getUTCFullYear()}-${String(mois.getUTCMonth() || 12).padStart(2, '0')}`;
export const ROUTES = [
  // [catégorie, nom, chemin]  catégorie : liste (500 ms p95), tdb (1,5 s), export (30 s)
  ['liste', 'Tâches récurrentes : occurrences (page 1)', `/api/grc/${S}/tasks?search=&offset=0`],
  ['liste', 'Tâches récurrentes : occurrences en retard', `/api/grc/${S}/tasks?search=&offset=0&status=todo`],
  ['liste', 'Tâches récurrentes : séries', `/api/grc/${S}/objects?kind=task_series&search=&offset=0`],
  ['liste', 'Tâches récurrentes : calendrier du mois', `/api/grc/${S}/tasks/window?from=${de}&to=${a}`],
  ['tdb', 'Tâches récurrentes : tableau de bord', `/api/grc/${S}/tasks/dashboard`],
  ['liste', 'Plan d’actions (page 1)', `/api/grc/${S}/objects?kind=action&search=&offset=0`],
  ['liste', 'Plan d’actions : page 40', `/api/grc/${S}/objects?kind=action&search=&offset=2000`],
  ['tdb', 'Plan d’actions : recherche « fictive »', `/api/grc/${S}/objects?kind=action&search=fictive&offset=0`],
  ['liste', 'Registres : mes éléments', `/api/registres/mes-elements`],
  ['liste', 'Registres : éléments (actions)', `/api/registres/elements?perimetre=${S}&kind=action&search=&offset=0`],
  ['liste', 'Fiche action', `/api/grc/${S}/objects/${action}`],
  ['liste', 'Risques (page 1)', `/api/grc/${S}/objects?kind=risk&search=&offset=0`],
  ['liste', 'Registre des risques', `/api/grc/${S}/risks/register`],
  ['tdb', 'Carte des risques', `/api/grc/${S}/risk-map`],
  ['liste', 'Fiche risque', `/api/grc/${S}/objects/${risque}`],
  ['liste', 'Incidents (registre, tous périmètres)', `/api/incidents`],
  ['liste', 'Incidents (un périmètre)', `/api/incidents?smsi=${S}`],
  ['liste', 'Documents (liste)', `/api/documents`],
  ['tdb', 'Documents : recherche', `/api/documents?q=fictif`],
  ['liste', 'Fiche document', `/api/documents/${doc}`],
  ['liste', 'Vulnérabilités : constats (page 1)', `/api/vulnerabilites/constats`],
  ['tdb', 'Vulnérabilités : constats recherche CVE', `/api/vulnerabilites/constats?q=CVE-2099-10007`],
  ['liste', 'Vulnérabilités : machines (page 1)', `/api/vulnerabilites/machines`],
  ['liste', 'Vulnérabilités : fiche machine la plus touchée', `/api/vulnerabilites/machines/${machine}`],
  ['liste', 'Vulnérabilités : fiche constat le plus répandu', `/api/vulnerabilites/constats/${constat}`],
  ['tdb', 'Vulnérabilités : vue d’ensemble', `/api/vulnerabilites/vue-ensemble`],
  ['tdb', 'Vulnérabilités : tendances', `/api/vulnerabilites/tendances`],
  ['tdb', 'Vulnérabilités : délais', `/api/vulnerabilites/delais`],
  ['liste', 'Vulnérabilités : veille (failles)', `/api/vulnerabilites/veille/failles`],
  ['liste', 'Vulnérabilités : produits', `/api/vulnerabilites/produits`],
  ['tdb', 'Vulnérabilités : recherche globale', `/api/vulnerabilites/recherche?q=CVE-2099-1000`],
  ['liste', 'Vulnérabilités : périmètres', `/api/vulnerabilites/perimetres`],
  ['liste', 'Journal d’audit (200 dernières)', `/api/admin/audit`],
  ['tdb', 'Journal d’audit : recherche « login »', `/api/admin/audit?q=login`],
  ['tdb', 'Journal d’audit : recherche rare « verrou »', `/api/admin/audit?q=locked`],
  ['tdb', 'Journal d’audit : recherche sans résultat', `/api/admin/audit?q=zzz-introuvable`],
  ['liste', 'Journal d’audit : page 2 000 (before)', `/api/admin/audit?before=1600000`],
  ['liste', 'Journal d’audit : un mois de 2019', `/api/admin/audit?from=2019-03-01&to=2019-03-31`],
  ['liste', 'Journal d’audit : un compte', `/api/admin/audit?user=agent050`],
  ['liste', 'Notifications (cloche)', `/api/grc/notifications`],
  ['liste', 'Compte : notifications', `/api/account/notifications`],
  ['tdb', 'Tableau de bord du périmètre', `/api/grc/${S}/dashboard`],
  ['tdb', 'Cartes des périmètres (synthèse)', `/api/grc/perimetres/synthese`],
  ['tdb', 'Mur : synthèse', `/api/mur/synthese`],
  ['tdb', 'État du suivi (état historique)', `/api/suivi/etat`],
  ['tdb', 'Administration : informations', `/api/admin/info`],
  ['tdb', 'Administration : système', `/api/admin/systeme`],
  ['tdb', 'Couverture du périmètre', `/api/grc/${S}/couverture`],
  ['liste', 'Périmètres accessibles', `/api/grc/smsis`],
  ['liste', 'Session (auth/me)', `/api/auth/me`],
  ['liste', 'Coquille : registres', `/api/registres?archives=false`],
  ['liste', 'Coquille : responsables du périmètre', `/api/grc/${S}/owners`],
  ['liste', 'Coquille : invitations RETEX', `/api/retex/invitations`],
  ['liste', 'Coquille : crise', `/api/crise`],
  ['liste', 'Coquille : alertes vulnérabilités (fenêtre)', `/api/vulnerabilites/alertes/fenetre`],
  ['liste', 'Coquille : état de l’assistant', `/api/assistant/etat`],
  ['export', 'Export : journal d’audit CSV (5 000 lignes)', `/api/admin/audit?format=csv`],
  ['export', 'Export : suivi complet (Excel)', `/api/suivi/export?groupe=all`],
  ['export', 'Rapport comité SMSI', `/api/grc/${S}/report`],
  ['export', 'Rapport mensuel vulnérabilités (CSV)', `/api/vulnerabilites/rapport?mois=${moisPrec}&format=csv`],
  ['export', 'Export de l’état historique', `/api/admin/export/legacy`],
];
// Passage du 21/11/2026 (v7.5.0) : routes nouvelles, ajoutées après celles du 19/11 (V750=1).
if (process.env.V750) {
  const prep = JSON.parse(fs.readFileSync(`${process.env.BANC}/mesures/preparation-v750.json`));
  const action50 = q("select id from grc_objects where kind='action' and jsonb_array_length(coalesce(data->'taches','[]'::jsonb)) = 50 and smsi_id = '" + S + "' limit 1");
  const pubVr = q("select id from veille_reglementaire_publications order by publie_le desc limit 1 offset 40");
  ROUTES.push(
    ['liste', 'Fiche action à 50 tâches', `/api/grc/${S}/objects/${action50}`],
    ['liste', 'Plan d’actions : recherche « Action fictive du plan » (tâches)', `/api/grc/${S}/objects?kind=action&search=Action%20fictive%20du%20plan&offset=0`],
    ['tdb', 'Accueil : liste des tableaux de bord', `/api/tableaux-de-bord`],
    ['tdb', 'Accueil : tableau Global (28 dalles)', `/api/tableaux-de-bord/${prep.tableaux.global}`],
    ['tdb', 'Accueil : tableau partagé', `/api/tableaux-de-bord/${prep.tableaux.partage}`],
    ['tdb', 'Accueil : chiffres du tableau partagé (droits de l’auteur)', `/api/tableaux-de-bord/${prep.tableaux.partage}/chiffres`],
    ['tdb', 'Accueil : tableau public', `/api/tableaux-de-bord/${prep.tableaux.public}`],
    ['tdb', 'Accueil : chiffres du tableau public (droits de l’auteur)', `/api/tableaux-de-bord/${prep.tableaux.public}/chiffres`],
    ['tdb', 'Accueil : journal d’audit de la dalle (500 lignes)', `/api/admin/audit?limit=500`],
    ['liste', 'Veille : avis (page 1, marques parc et Internet)', `/api/vulnerabilites/veille/avis`],
    ['liste', 'Veille : avis du CERT Santé (page 1)', `/api/vulnerabilites/veille/avis?source=cert-sante`],
    ['liste', 'Veille : avis page 200', `/api/vulnerabilites/veille/avis?page=200`],
    ['tdb', 'Veille : avis recherche CVE', `/api/vulnerabilites/veille/avis?q=CVE-2099-1`],
    ['tdb', 'Veille : avis recherche titre', `/api/vulnerabilites/veille/avis?q=produit%20fictif%2042`],
    ['liste', 'Veille : état des sources', `/api/vulnerabilites/veille/etat`],
    ['liste', 'Veille : failles du catalogue KEV', `/api/vulnerabilites/veille/failles?kev=oui`],
    ['tdb', 'Veille : failles recherche produit', `/api/vulnerabilites/veille/failles?q=produit-fictif-42`],
    ['liste', 'Vulnérabilités : parc des machines', `/api/vulnerabilites/machines/parc`],
    ['liste', 'Vulnérabilités : correctifs', `/api/vulnerabilites/correctifs`],
    ['liste', 'Vulnérabilités : alertes', `/api/vulnerabilites/alertes`],
    ['liste', 'Vulnérabilités : état de la synchronisation', `/api/vulnerabilites/synchronisation`],
    ['liste', 'Vulnérabilités : état des imports', `/api/vulnerabilites/imports/etat`],
    ['tdb', 'Annuaire AD : synthèse', `/api/vulnerabilites/annuaire`],
    ['liste', 'Annuaire AD : noms d’un point (200 noms)', `/api/vulnerabilites/annuaire/points/vuln3_point_fictif_2/noms`],
    ['tdb', 'Veille réglementaire : synthèse', `/api/veille-reglementaire/synthese`],
    ['liste', 'Veille réglementaire : publications (page 1)', `/api/veille-reglementaire/publications`],
    ['liste', 'Veille réglementaire : à qualifier, sécurité', `/api/veille-reglementaire/publications?statut=a-qualifier&domaine=securite`],
    ['liste', 'Veille réglementaire : impactant, CNIL', `/api/veille-reglementaire/publications?statut=impactant&domaine=donnees-personnelles&source=cnil`],
    ['tdb', 'Veille réglementaire : recherche', `/api/veille-reglementaire/publications?q=journalisation`],
    ['liste', 'Veille réglementaire : page 300', `/api/veille-reglementaire/publications?page=300`],
    ['liste', 'Veille réglementaire : fiche', `/api/veille-reglementaire/publications/${pubVr}`],
    ['liste', 'Veille réglementaire : sources', `/api/veille-reglementaire/sources`],
  );
}
const SEUILS = { liste: 500, tdb: 1500, export: 30000 };
async function mesurer(c, compte, filtre) {
  const out = [];
  for (const [cat, nom, chemin] of ROUTES) {
    if (filtre && !nom.toLowerCase().includes(filtre.toLowerCase())) continue;
    const rep = cat === 'export' ? Math.min(REPET, 5) : REPET;
    const first = await c.get(chemin);
    const d = [];
    let statut = first.status, octets = first.bytes;
    for (let i = 0; i < rep; i++) { const r = await c.get(chemin); d.push(r.ms); statut = r.status; octets = r.bytes; }
    const m = { compte, categorie: cat, nom, chemin: chemin.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'), statut, octets, repetitions: rep,
      echauffementMs: Math.round(first.ms), medianeMs: Math.round(pct(d, 50)), p95Ms: Math.round(pct(d, 95)), maxMs: Math.round(Math.max(...d)), seuilMs: SEUILS[cat] };
    m.depasse = m.p95Ms > m.seuilMs;
    out.push(m);
    console.log(`${compte.padEnd(12)} ${String(statut)} ${String(m.medianeMs).padStart(6)} ${String(m.p95Ms).padStart(6)} ${String(m.maxMs).padStart(6)} ms ${String(Math.round(octets / 1024)).padStart(7)} Ko ${m.depasse ? 'DEPASSE' : '       '} ${nom}`);
  }
  return out;
}
if (process.argv[1].endsWith('banc-api.mjs')) {
  const [etiquette = 'une-personne', filtre = ''] = process.argv.slice(2);
  const admin = await session(idf.username, idf.password);
  const charge = await session(idf.charge[0], idf.motCharge);
  const res = [...(await mesurer(admin, 'admin', filtre)), ...(process.env.SANS_CHARGE ? [] : await mesurer(charge, idf.charge[0], filtre))];
  fs.writeFileSync(`${process.env.BANC}/mesures/api-${etiquette}.json`, JSON.stringify({ date: new Date().toISOString(), repetitions: REPET, perimetre: 'le plus gros (rang 1)', mesures: res }, null, 2));
}
