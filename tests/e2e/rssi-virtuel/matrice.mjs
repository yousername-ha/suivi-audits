#!/usr/bin/env node
/* Matrice de couverture de la recette du RSSI virtuel. L'inventaire des écrans est lu dans le code de l'interface
   (menu du pilotage, cartes Plateforme et Système, routes), jamais saisi à la main : un écran ajouté apparaît à la
   génération suivante et reste « non testé » tant qu'un agent ne l'a pas couvert.

     node tests/e2e/rssi-virtuel/matrice.mjs generer          écrit MATRICE-COUVERTURE.md
     node tests/e2e/rssi-virtuel/matrice.mjs generer --verifier   code 1 si les fichiers versionnés ne sont plus à jour
     node tests/e2e/rssi-virtuel/matrice.mjs modele <n>       modèle CSV des cases de l'agent n (sortie standard)
     node tests/e2e/rssi-virtuel/matrice.mjs modele 7 <t>     cases transversales limitées aux écrans de la tranche t
     node tests/e2e/rssi-virtuel/matrice.mjs bilan [dossier]  consolide les CSV des agents ; code 1 s'il reste des trous

   Lecture seule sur apps/ et packages/. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const DEPOT = resolve(ICI, '../../..');
const MD_SORTIE = join(DEPOT, 'docs/05_RECETTE/rssi-virtuel/MATRICE-COUVERTURE.md');
const CAMPAGNE = join(DEPOT, 'docs/05_RECETTE/rssi-virtuel/campagne');
const lire = (chemin) => readFileSync(join(DEPOT, chemin), 'utf8');

/* ------------------------------------------------------------------ Tranches (une par agent) */
const AGENTS = [
  { n: 1, id: 'organisation', titre: 'Organisation, contexte, objectifs, fournisseurs' },
  { n: 2, id: 'risques', titre: 'Risques : méthode, appréciation, traitement, EBIOS RM' },
  { n: 3, id: 'conformite', titre: 'Conformité, DdA, audits, preuves et contrôles' },
  { n: 4, id: 'actions', titre: 'Écarts, actions, plans annuels, revue de direction, registres' },
  { n: 5, id: 'resilience', titre: 'Incidents, crise, continuité, documents, exports' },
  { n: 6, id: 'plateforme', titre: 'Installation, comptes, Plateforme, Système, paramètres' },
  { n: 7, id: 'transversal', titre: 'Tous les écrans sous chaque rôle, chaque périmètre, et au téléphone' },
];
const GROUPES = {
  'Vue d’ensemble': 1,
  'Parcours guidé': 1,
  'Contexte et responsabilités': 1,
  'Objectifs et indicateurs': 1,
  Fournisseurs: 1,
  Risques: 2,
  'Gestion de l’audit': 3,
  Conformité: 3,
  'Preuves et contrôles': 3,
  'Écarts et actions': 4,
  'Plans et revues': 4,
  'Incidents et crise': 5,
  Outils: 4,
};
// Exceptions au rattachement par groupe du menu.
const PAR_ECRAN = { audits: 3, continuite: 5, exercices: 5, imports: 5, configuration: 6 };
const ROUTES = {
  '/': 1,
  '/cartographie/:vue?': 1,
  '/registres/:id?': 4,
  '/documents': 5,
  '/documents/:id': 5,
  '/exports': 5,
  '/retex/:incident?': 5,
  '/mur': 5,
  '/mur/activer': 5,
};
const ROUTES_IGNOREES = new Set(['/pilotage/:section?', '/plateforme/:carte?', '/systeme/:carte?', '/grc', '*']);
// Types d'objets du registre : chaque type doit être créé, modifié, lié, supprimé et exporté au moins une fois.
const OBJETS = {
  1: ['context', 'stakeholder', 'swot', 'governance', 'process', 'objective', 'indicator', 'journey'],
  2: [
    'risk',
    'risk_source',
    'feared_event',
    'business_asset',
    'support_asset',
    'strategic_scenario',
    'operational_scenario',
    'treatment',
    'risk_study',
    'sr_ov',
    'ecosystem_party',
    'opportunity',
  ],
  3: ['framework', 'requirement', 'measure', 'mapping', 'soa', 'control', 'evidence', 'audit'],
  4: ['action', 'task_series', 'nonconformity', 'management_review'],
  5: ['incident', 'continuity_plan', 'continuity_exercise'],
};

/* ------------------------------------------------------------------ Inventaire lu dans le code */
function inventaire() {
  const ecrans = [];
  const nav = lire('apps/web/src/pilotage-navigation.ts');
  let groupe = '';
  for (const ligne of nav.split('\n')) {
    const g = ligne.match(/^\s{4}label: '(.+)',$/);
    if (g) groupe = g[1];
    const i = ligne.match(/\{ id: '([^']+)', label: '(.+)', module: '([^']+)' \}/);
    if (!i) continue;
    const agent = PAR_ECRAN[i[1]] ?? GROUPES[groupe];
    if (!agent) throw new Error(`Groupe du menu sans tranche : « ${groupe} » (compléter GROUPES dans matrice.mjs)`);
    ecrans.push({ id: `pilotage/${i[1]}`, chemin: `/pilotage/${i[1]}`, libelle: i[2], groupe, module: i[3], agent });
  }
  const admin = lire('apps/web/src/pages/Administration.tsx');
  for (const c of admin.matchAll(/id: '([^']+)',\s*cote: '(plateforme|systeme)',\s*titre: (['"`])(.+?)\3/g)) {
    ecrans.push({
      id: `${c[2]}/${c[1]}`,
      chemin: `/${c[2]}/${c[1]}`,
      libelle: c[4],
      groupe: c[2] === 'plateforme' ? 'Plateforme' : 'Système',
      module: 'administration',
      agent: 6,
    });
  }
  const main = lire('apps/web/src/main.tsx');
  for (const r of main.matchAll(/path:\s*'([^']+)'/g)) {
    const chemin = r[1];
    if (ROUTES_IGNOREES.has(chemin)) continue;
    ecrans.push({
      id: `route${chemin}`,
      chemin,
      libelle: chemin,
      groupe: 'Hors menu du pilotage',
      module: '',
      agent: ROUTES[chemin] ?? 6,
    });
  }
  const doublons = ecrans.map((e) => e.id).filter((id, k, t) => t.indexOf(id) !== k);
  if (doublons.length) throw new Error(`Écrans en double : ${doublons.join(', ')}`);
  const shared = lire('packages/shared/src/grc.ts');
  const kinds = [...shared.match(/GRC_KINDS = \[([\s\S]*?)\] as const/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const ranges = Object.values(OBJETS).flat();
  const oublies = kinds.filter((k) => !ranges.includes(k));
  if (oublies.length)
    throw new Error(`Types d'objets sans tranche : ${oublies.join(', ')} (compléter OBJETS dans matrice.mjs)`);
  const roles = [
    ...lire('packages/shared/src/permissions.ts')
      .match(/SYSTEM_ROLES = \[(.*?)\]/)[1]
      .matchAll(/'([^']+)'/g),
  ].map((m) => m[1]);
  return { ecrans, kinds, roles };
}

/* ------------------------------------------------------------------ Cases exigées */
const cle = (ecran, perimetre, role, etat, affichage) => [ecran, perimetre, role, etat, affichage].join('|');
function cases({ ecrans, roles }) {
  const liste = [];
  for (const e of ecrans) {
    for (const p of ['principal', 'sous-perimetre'])
      for (const etat of ['vide', 'rempli', 'erreur'])
        liste.push({ agent: e.agent, cellule: cle(e.id, p, 'rssi', etat, 'bureau') });
    for (const role of roles.filter((r) => r !== 'rssi'))
      for (const p of ['principal', 'sous-perimetre'])
        liste.push({ agent: 7, cellule: cle(e.id, p, role, 'rempli', 'bureau') });
    liste.push({ agent: 7, cellule: cle(e.id, 'restreint', 'contributeur', 'rempli', 'bureau') });
    liste.push({ agent: 7, cellule: cle(e.id, 'principal', 'rssi', 'rempli', 'telephone') });
  }
  return liste;
}

/* ------------------------------------------------------------------ Sorties */
function contenus() {
  const inv = inventaire();
  const exigees = cases(inv);
  const l = [];
  l.push('# Matrice de couverture de la recette', '');
  l.push(
    'Fichier généré par `node tests/e2e/rssi-virtuel/matrice.mjs generer` à partir du code de l’interface. Ne pas le',
  );
  l.push('modifier à la main : corriger le rattachement dans `matrice.mjs`, puis régénérer.', '');
  l.push(`- Écrans inventoriés : **${inv.ecrans.length}**`);
  l.push(`- Types d’objets du registre : **${inv.kinds.length}**`);
  l.push(`- Cases exigées : **${exigees.length}**`, '');
  l.push('## Axes', '');
  l.push('| Axe | Valeurs |', '|---|---|');
  l.push(
    '| Périmètre | `principal` (périmètre commun), `sous-perimetre` (périmètre rattaché), `restreint` (compte limité à un sous-périmètre) |',
  );
  l.push(`| Rôle | ${inv.roles.map((r) => `\`${r}\``).join(', ')} |`);
  l.push(
    '| État | `vide` (rien de saisi), `rempli` (jeu de données fictif), `erreur` (saisie refusée : champ obligatoire, valeur invalide, doublon) |',
  );
  l.push('| Affichage | `bureau` (1440 × 900), `telephone` (390 × 844) |', '');
  l.push('## Cases exigées par écran', '');
  l.push(
    '- **Agent du domaine** (6 cases) : rôle `rssi`, périmètres `principal` et `sous-perimetre`, états `vide`, `rempli`, `erreur`.',
  );
  l.push(
    '- **Agent transversal** (10 cases) : chaque autre rôle sous `principal` et `sous-perimetre` (état `rempli`), le',
  );
  l.push('  contributeur `restreint`, et le RSSI au `telephone`.', '');
  l.push(
    'Résultats possibles d’une case : `ok`, `defaut` (avec la référence du constat), `sans-objet` (avec la raison, par',
  );
  l.push('exemple un écran indépendant du périmètre). Une case absente des résultats est `non testée`.', '');
  l.push('## Répartition', '');
  l.push('| Agent | Tranche | Écrans | Cases |', '|---|---|---|---|');
  for (const a of AGENTS) {
    const n = a.n === 7 ? inv.ecrans.length : inv.ecrans.filter((e) => e.agent === a.n).length;
    l.push(`| ${a.n} | ${a.titre} | ${n} | ${exigees.filter((c) => c.agent === a.n).length} |`);
  }
  l.push('');
  for (const a of AGENTS.filter((x) => x.n !== 7)) {
    l.push(`## Agent ${a.n} : ${a.titre}`, '');
    l.push('| Écran | Chemin | Rubrique | Module |', '|---|---|---|---|');
    for (const e of inv.ecrans.filter((x) => x.agent === a.n))
      l.push(`| ${e.libelle} | \`${e.chemin}\` | ${e.groupe} | ${e.module || 'sans'} |`);
    l.push('');
    if (OBJETS[a.n]) {
      l.push('Types d’objets à créer, modifier, lier, supprimer et exporter au moins une fois :', '');
      l.push(OBJETS[a.n].map((k) => `\`${k}\``).join(', '), '');
    }
  }
  l.push('## Agent 7 : transversal', '');
  l.push(
    'Tous les écrans ci-dessus. Pour chaque case, vérifier ce que le rôle voit, ce qu’il peut modifier, et ce que l’API',
  );
  l.push(
    'refuse quand l’interface masque le bouton (appel direct avec `pilote.mjs api`). Le passage transversal se fait',
  );
  l.push(
    'tranche par tranche, sur la pile déjà remplie par l’agent du domaine (`matrice.mjs modele 7 <tranche>`).',
    '',
  );
  return { md: l.join('\n'), inv, exigees };
}

function generer(verifier) {
  const { md, inv, exigees } = contenus();
  if (verifier) {
    const ok = existsSync(MD_SORTIE) && readFileSync(MD_SORTIE, 'utf8') === md;
    console.log(ok ? 'Matrice à jour.' : 'Matrice périmée : relancer « matrice.mjs generer ».');
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(MD_SORTIE, md);
  console.log(`${inv.ecrans.length} écrans, ${exigees.length} cases exigées.`);
}

function modele(n, tranche) {
  const { exigees, inv } = contenus();
  const ecrans = new Set(inv.ecrans.filter((e) => !tranche || e.agent === tranche).map((e) => e.id));
  const miennes = exigees.filter((c) => c.agent === n && ecrans.has(c.cellule.split('|')[0]));
  if (!miennes.length) throw new Error('Numéro d’agent attendu : 1 à 7 (et tranche 1 à 6 pour l’agent 7).');
  console.log('cellule;resultat;constat;commentaire');
  for (const c of miennes) console.log(`${c.cellule};;;`);
}

function bilan(dossier) {
  const { exigees } = contenus();
  const resultats = new Map();
  const erreurs = [];
  const fichiers = existsSync(dossier)
    ? readdirSync(dossier)
        .filter((f) => f.endsWith('.csv'))
        .sort()
    : [];
  for (const f of fichiers) {
    const lignes = readFileSync(join(dossier, f), 'utf8')
      .split('\n')
      .slice(1)
      .filter((x) => x.trim());
    for (const [k, ligne] of lignes.entries()) {
      const [cellule, resultat, constat = '', commentaire = ''] = ligne.split(';').map((x) => x.trim());
      if (!resultat) continue;
      const ou = `${f}:${k + 2}`;
      if (!['ok', 'defaut', 'sans-objet'].includes(resultat)) erreurs.push(`${ou} résultat inconnu « ${resultat} »`);
      if (resultat === 'defaut' && !constat) erreurs.push(`${ou} défaut sans référence de constat`);
      if (resultat === 'sans-objet' && !commentaire) erreurs.push(`${ou} sans-objet sans raison`);
      resultats.set(cellule, resultat);
    }
  }
  const connues = new Set(exigees.map((c) => c.cellule));
  for (const c of resultats.keys()) if (!connues.has(c)) erreurs.push(`case inconnue de la matrice : ${c}`);
  console.log('Agent | Exigées | ok | défaut | sans objet | non testées');
  let trous = 0;
  for (const a of AGENTS) {
    const miennes = exigees.filter((c) => c.agent === a.n);
    const compte = (r) => miennes.filter((c) => resultats.get(c.cellule) === r).length;
    const manque = miennes.filter((c) => !resultats.has(c.cellule));
    trous += manque.length;
    console.log(
      `${a.n} | ${miennes.length} | ${compte('ok')} | ${compte('defaut')} | ${compte('sans-objet')} | ${manque.length}`,
    );
  }
  if (trous) {
    console.log(`\nCases non testées (${trous}), 40 premières :`);
    for (const c of exigees.filter((x) => !resultats.has(x.cellule)).slice(0, 40))
      console.log(`  agent ${c.agent}  ${c.cellule}`);
  }
  for (const e of erreurs) console.log(`ERREUR ${e}`);
  process.exit(trous || erreurs.length ? 1 : 0);
}

const [commande, ...reste] = process.argv.slice(2);
try {
  if (commande === 'generer') generer(reste.includes('--verifier'));
  else if (commande === 'modele') modele(Number(reste[0]), reste[1] ? Number(reste[1]) : 0);
  else if (commande === 'bilan') bilan(reste[0] ? resolve(reste[0]) : CAMPAGNE);
  else {
    console.log('Usage : matrice.mjs generer [--verifier] | modele <n> [tranche] | bilan [dossier]');
    process.exit(2);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
