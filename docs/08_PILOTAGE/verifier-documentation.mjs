// Contrôles documentaires en lecture seule, sans base, réseau ou modification.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const data = JSON.parse(read('docs/08_PILOTAGE/REGISTRES.json'));
const receipt = JSON.parse(read('docs/05_RECETTE/preuves/2026-10-11-executions.json'));
const errors = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
};
const groups = {
  '01_REPRISE_IA': [
    'CONTEXTE_PROJET',
    'ETAT_ACTUEL',
    'TRAVAUX_REALISES',
    'TRAVAUX_EN_COURS',
    'RESTE_A_FAIRE',
    'PLAN_REPRISE',
    'DECISIONS_TECHNIQUES',
    'JOURNAL_DE_BORD',
  ],
  '02_FONCTIONNALITES': [
    'INVENTAIRE_FONCTIONNEL',
    'COMPARAISON_ANCIEN_NOUVEAU',
    'FONCTIONNALITES_NON_REPRISES',
    'REGRESSIONS',
    'MATRICE_TRACABILITE',
  ],
  '03_ARCHITECTURE': [
    'DAT',
    'ARCHITECTURE_APPLICATIVE',
    'ARCHITECTURE_TECHNIQUE',
    'BASE_DE_DONNEES',
    'API_INTERFACES',
    'SECURITE',
    'DEPLOIEMENT',
    'EXPLOITATION_MAINTENANCE',
  ],
  '04_QUALITE': [
    'REGISTRE_BUGS',
    'PROBLEMES_TECHNIQUES',
    'DETTE_TECHNIQUE',
    'OPTIMISATIONS_REALISEES',
    'OPTIMISATIONS_A_FAIRE',
    'RISQUES',
  ],
  '05_RECETTE': [
    'STRATEGIE_RECETTE',
    'PLAN_DE_TESTS',
    'CAS_DE_TEST',
    'EXECUTIONS_RECETTE',
    'RAPPORT_RECETTE',
    'COUVERTURE_FONCTIONNELLE',
    'PV_RECETTE',
  ],
  '06_GUIDES': ['GUIDE_UTILISATEUR', 'GUIDE_ADMINISTRATEUR', 'GUIDE_INSTALLATION', 'GUIDE_DEPANNAGE', 'FAQ'],
  '07_HISTORIQUE': ['CHANGELOG', 'HISTORIQUE_MIGRATION', 'HISTORIQUE_CORRECTIONS', 'VERSIONS'],
  '08_PILOTAGE': ['BACKLOG', 'PRIORITES', 'DEPENDANCES', 'TABLEAU_DE_BORD'],
};
const required = [
  'AGENTS.md',
  'HANDOVER.md',
  'PROJECT_STATUS.md',
  'docs/00_INDEX.md',
  ...Object.entries(groups).flatMap(([dir, names]) => names.map((n) => 'docs/' + dir + '/' + n + '.md')),
];
for (const p of required) check(exists(p), 'Document demandé absent : ' + p);
const collections = ['features', 'bugs', 'optimisations', 'security_risks', 'backlog', 'test_cases', 'executions'];
for (const name of collections) {
  const ids = data[name].map((x) => x.id);
  check(new Set(ids).size === ids.length, 'Identifiants en double dans ' + name);
}
const featureIds = new Set(data.features.map((f) => f.id));
const caseIds = new Set(data.test_cases.map((t) => t.id));
const exeIds = new Set(data.executions.map((e) => e.id));
const statuses = new Set(['PASSÉ', 'ÉCHOUÉ', 'BLOQUÉ', 'NON EXÉCUTÉ', 'NON APPLICABLE']);
const migrationStatuses = new Set([
  'REPRISE ET VALIDÉE',
  'REPRISE MAIS NON TESTÉE',
  'REPRISE PARTIELLEMENT',
  'NON REPRISE',
  'MODIFIÉE VOLONTAIREMENT',
  'ABANDON VALIDÉ',
  'À ARBITRER',
  'IMPOSSIBLE À DÉTERMINER',
]);
for (const f of data.features) {
  check(caseIds.has(f.case), 'Cas manquant pour ' + f.id);
  check(migrationStatuses.has(f.migration), 'État de reprise inconnu : ' + f.id);
  for (const p of [...f.implementation, ...f.tests]) check(exists(p), 'Source de preuve absente : ' + p);
  check(Boolean(f.verified_scope && f.gap), 'Portée ou réserve absente : ' + f.id);
}
for (const t of data.test_cases) {
  check(featureIds.has(t.feature), 'Fonction absente pour ' + t.id);
  check(statuses.has(t.result), 'Statut de recette inconnu : ' + t.id);
  if (t.result === 'PASSÉ') {
    const e = data.executions.find((e) => e.id === t.proof);
    check(
      Boolean(e && e.status === 'PASSÉ' && e.commit === data.analysed_commit && e.cases.includes(t.id)),
      'Résultat sans preuve liée : ' + t.id,
    );
    check(t.code.length > 0, 'Cas automatique sans source : ' + t.id);
  }
}
for (const b of data.bugs) {
  check(featureIds.has(b.feature) && caseIds.has(b.test), 'Bug sans fonction/cas : ' + b.id);
  for (const p of b.files) check(exists(p), 'Fichier de correction absent : ' + p);
  if (b.status === 'CORRIGÉ ET VALIDÉ') {
    check(
      data.test_cases.some((t) => t.id === b.test && t.result === 'PASSÉ'),
      'Bug déclaré validé sans cas passé : ' + b.id,
    );
  }
}
for (const o of data.optimisations)
  if (o.status === 'RÉALISÉE') check(exists(o.proof), 'Optimisation sans source : ' + o.id);
for (const e of data.executions) {
  check(statuses.has(e.status), 'Statut d’exécution inconnu : ' + e.id);
  check(e.status !== 'PASSÉ' || e.code === 0, 'Exécution passée avec code non nul : ' + e.id);
  for (const t of e.cases) check(caseIds.has(t), 'Exécution avec cas absent : ' + e.id);
}
check(exeIds.size === data.executions.length, 'Exécutions en double');
check(
  receipt.commit === data.analysed_commit && JSON.stringify(receipt.executions) === JSON.stringify(data.executions),
  'Reçu et registre divergent',
);
const count = (key, fn) => data[key].filter(fn).length;
const computed = {
  features: data.features.length,
  automated_validated: count('features', (f) => f.validation === 'VALIDÉ AUTOMATIQUEMENT'),
  partial: count('features', (f) => f.validation === 'PARTIEL'),
  historical_not_migrated: count('features', (f) => f.migration === 'NON REPRISE'),
  bugs_open: count('bugs', (b) => ['OUVERT', 'EN ANALYSE', 'EN COURS DE CORRECTION'].includes(b.status)),
  bugs_fixed_validated: count('bugs', (b) => b.status === 'CORRIGÉ ET VALIDÉ'),
  bugs_fixed_user_validation_pending: count('bugs', (b) => b.status === 'CORRIGÉ NON VALIDÉ'),
  regressions_documented: new Set(read('docs/02_FONCTIONNALITES/REGRESSIONS.md').match(/REG-\d{3}/g) || []).size,
  security_risks: data.security_risks.length,
  optimisations_done: count('optimisations', (o) => o.status === 'RÉALISÉE'),
  optimisations_remaining: count('optimisations', (o) => o.status === 'À FAIRE'),
  planned_cases: data.test_cases.length,
  case_passed: count('test_cases', (t) => t.result === 'PASSÉ'),
  case_failed: count('test_cases', (t) => t.result === 'ÉCHOUÉ'),
  case_blocked: count('test_cases', (t) => t.result === 'BLOQUÉ'),
  case_not_executed: count('test_cases', (t) => t.result === 'NON EXÉCUTÉ'),
  local_test_passages: data.executions
    .filter((e) => e.type === 'SUITE LOCALE' && e.commit === data.analysed_commit)
    .reduce((n, e) => n + e.passed, 0),
  ci_test_passages: data.executions.find((e) => e.id === 'EXE-013').passed,
};
for (const [k, v] of Object.entries(computed)) check(data.statistics[k] === v, 'Statistique incohérente : ' + k);
const ci = data.executions.find((e) => e.id === 'EXE-013');
check(Object.values(ci.breakdown).reduce((a, b) => a + b, 0) === ci.total, 'Total CI et suites divergents');
check(read('docs/05_RECETTE/PV_RECETTE.md').includes('EN ATTENTE DE VALIDATION'), 'PV ne conserve pas son attente');
const api = JSON.parse(read('docs/03_ARCHITECTURE/API_CONTRAT.json'));
check(api.openapi === '3.1.0', 'Version OpenAPI inattendue');
const methods = new Set(['get', 'head', 'post', 'put', 'patch', 'delete', 'options', 'trace']);
const operations = Object.values(api.paths).reduce(
  (n, entry) => n + Object.keys(entry).filter((k) => methods.has(k)).length,
  0,
);
check(Object.keys(api.paths).length === 153 && operations === 190, 'Inventaire OpenAPI différent du snapshot');

const tick = String.fromCharCode(96);
function prose(text) {
  let fenced = false;
  return text
    .split('\n')
    .filter((line) => {
      if (line.trimStart().startsWith(tick.repeat(3)) || line.trimStart().startsWith('~~~')) {
        fenced = !fenced;
        return false;
      }
      return !fenced;
    })
    .join('\n');
}
function anchors(text) {
  const ids = new Set();
  const seen = new Map();
  for (const line of prose(text).split('\n')) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (!h) continue;
    const slug = h[1]
      .toLowerCase()
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[^\p{L}\p{N}_ -]/gu, '')
      .replace(/ /g, '-');
    const repeats = seen.get(slug) || 0;
    ids.add(slug + (repeats ? '-' + repeats : ''));
    seen.set(slug, repeats + 1);
  }
  return ids;
}
const changedOld = [
  'CLAUDE.md',
  'README.md',
  'CHANGELOG.md',
  'docs/ARCHITECTURE.md',
  'docs/ARCHITECTURE-EVOLUTION.md',
  'docs/ROADMAP.md',
  'docs/REPRISE-SOCLE-LEGACY.md',
  'docs/PILOTAGE-SMSI.md',
  'docs/INSTALLATION.md',
  'docs/cartographie/00-LISEZ-MOI.md',
  'docs/cartographie/maquette/README.md',
  'docs/cartographie/reference-beta-legacy/CONTRAT-S-MAPS.md',
  'docs/diagnostics/2026-10-11-nettoyage-depot.md',
];
let localLinks = 0;
for (const p of [...required, ...changedOld]) {
  for (const match of prose(read(p)).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const raw = match[1];
    if (/^(https?:|mailto:|data:)/.test(raw)) continue;
    const [base, fragment] = raw.split('#');
    const target = path.resolve(root, path.dirname(p), decodeURIComponent(base || path.basename(p)));
    check(target.startsWith(root + path.sep), 'Lien hors dépôt : ' + p);
    check(fs.existsSync(target), 'Lien cassé : ' + p + ' → ' + raw);
    if (fs.existsSync(target) && fragment && target.endsWith('.md')) {
      check(
        anchors(fs.readFileSync(target, 'utf8')).has(decodeURIComponent(fragment)),
        'Ancre absente : ' + p + ' → ' + raw,
      );
    }
    localLinks++;
  }
}
const appChanges = execFileSync(
  'git',
  [
    'diff',
    '--name-only',
    data.analysed_commit,
    '--',
    'apps',
    'packages',
    'scripts',
    'docker',
    '.github',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'docker-compose.yml',
    'docker-compose.build.yml',
    'docker-compose.dev.yml',
  ],
  { cwd: root, encoding: 'utf8' },
).trim();
check(!appChanges, 'Sources applicatives modifiées depuis le snapshot ; actualiser l’audit');
const output = {
  status: errors.length ? 'ÉCHOUÉ' : 'PASSÉ',
  code: errors.length ? 1 : 0,
  analysedCommit: data.analysed_commit,
  date: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour12: false }),
  timezone: 'Europe/Paris',
  markdownFiles: required.length + changedOld.length,
  localLinks,
  statistics: computed,
  errors,
  limits:
    'Contrôles locaux de fichiers/liens inline/ancres, sources, IDs, chiffres et statuts ; aucune validation réseau, métier, Mermaid rendu ou humaine.',
};
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.code;
