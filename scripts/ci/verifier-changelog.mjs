#!/usr/bin/env node
/* CI (EXPL-07) : chaque section de CHANGELOG.md (« ## [Non publié] » et chaque version publiée) contient un paragraphe
   « ### Notes de mise à jour », même réduit à « Aucune action. ». Avec une version en argument, affiche le texte de
   sa section (page de la release GitHub) et échoue si elle est absente.
   Usage : verifier-changelog.mjs [CHANGELOG.md] [--section X.Y.Z] */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const i = args.indexOf('--section');
const section = i >= 0 ? args[i + 1] : null;
const file = args.find((a, j) => !a.startsWith('--') && j !== i + 1) || 'CHANGELOG.md';
const lines = readFileSync(file, 'utf8').split('\n');
const sections = [];
for (const l of lines) {
  const m = /^## \[([^\]]+)\]/.exec(l);
  if (m) sections.push({ nom: m[1], lignes: [] });
  else if (sections.length) sections.at(-1).lignes.push(l);
}
const erreurs = sections
  .filter((s) => !s.lignes.some((l) => /^### Notes de mise à jour\s*$/.test(l)))
  .map((s) => `section « ${s.nom} » sans paragraphe « ### Notes de mise à jour »`);
if (section) {
  const s = sections.find((x) => x.nom === section);
  if (!s) erreurs.unshift(`version ${section} absente de ${file}`);
  else if (!erreurs.length) process.stdout.write(s.lignes.join('\n').trim() + '\n');
}
if (erreurs.length) {
  for (const e of erreurs) console.error(`::error file=${file}::${e}`);
  process.exit(1);
}
if (!section) console.log(`${file} : ${sections.length} section(s), notes de mise à jour présentes.`);
