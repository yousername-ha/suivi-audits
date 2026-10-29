#!/usr/bin/env node
/* CI, job « Images, sécurité et pile complète » : lit le rapport JSON de Playwright et signale chaque test en échec ou
   instable (réussi seulement au rejeu) par une annotation GitHub. Les annotations se lisent sur la PR et par l'API, sans
   télécharger les journaux ni les artefacts ; un test instable reste visible au lieu d'être masqué par le rejeu.
   Le résultat du job reste celui de Playwright : ce script ne fait jamais échouer la CI.
   Usage : rapport-e2e.mjs tests/e2e/test-results/resultats-e2e.json */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const fichier = process.argv[2];
const echapper = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const echapperPropriete = (s) => echapper(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

if (!fichier || !existsSync(fichier)) {
  console.log(`::warning title=Tests de bout en bout::Rapport JSON absent (${echapper(fichier ?? 'non indiqué')}).`);
  process.exit(0);
}

const rapport = JSON.parse(readFileSync(fichier, 'utf8'));
const constats = { flaky: [], unexpected: [] };
const ECHAP = String.fromCharCode(27);
const sansCouleur = (s) =>
  s
    .split(ECHAP)
    .map((m, i) => (i ? m.replace(/^\[[0-9;]*m/, '') : m))
    .join('');

function parcourir(suite, chemin) {
  for (const s of suite.suites ?? []) parcourir(s, s.title ? [...chemin, s.title] : chemin);
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests ?? []) {
      if (t.status !== 'flaky' && t.status !== 'unexpected') continue;
      const echec = (t.results ?? []).find((r) => r.status !== 'passed' && r.status !== 'skipped');
      const brut = echec?.error?.message ?? echec?.errors?.[0]?.message ?? '';
      const position = echec?.error?.location ?? echec?.errors?.[0]?.location;
      constats[t.status].push({
        fichier: spec.file,
        ligne: spec.line,
        titre: [...chemin.slice(1), spec.title].join(' › '),
        essais: (t.results ?? []).length,
        message: sansCouleur(brut).split('\n').filter(Boolean).slice(0, 3).join(' ').slice(0, 300),
        // Ligne de l'assertion en échec : le message, tronqué, ne dit pas laquelle des vérifications du test a échoué.
        position: position?.line ? ` — ligne ${position.line} du test` : '',
      });
    }
}
for (const s of rapport.suites ?? []) parcourir(s, [s.title]);

const libelles = { flaky: 'Test instable (réussi au rejeu)', unexpected: 'Test en échec' };
for (const [statut, niveau] of [
  ['unexpected', 'error'],
  ['flaky', 'warning'],
])
  for (const c of constats[statut])
    console.log(
      `::${niveau} file=${echapperPropriete(`tests/e2e/specs/${c.fichier}`)},line=${c.ligne},title=${echapperPropriete(
        libelles[statut],
      )}::${echapper(`${c.fichier} › ${c.titre} (${c.essais} essai(s))${c.position} — ${c.message}`)}`,
    );

const st = rapport.stats ?? {};
const resume = [
  '### Tests de bout en bout',
  '',
  `Réussis : ${st.expected ?? 0} · en échec : ${st.unexpected ?? 0} · instables (réussis au rejeu) : ${st.flaky ?? 0} · ignorés : ${st.skipped ?? 0}`,
  '',
  ...[...constats.unexpected.map((c) => ['échec', c]), ...constats.flaky.map((c) => ['instable', c])].map(
    ([etat, c]) => `- ${etat} : \`${c.fichier}:${c.ligne}\` ${c.titre}${c.position} — ${c.message}`,
  ),
  '',
].join('\n');
console.log(resume);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, resume + '\n');
