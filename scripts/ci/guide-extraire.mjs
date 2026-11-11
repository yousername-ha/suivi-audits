#!/usr/bin/env node
/* CI, job « guide » : transforme docs/INSTALLATION.md en script bash, rejoué sur un runner Ubuntu vierge.
   Chaque bloc ```bash du guide doit être précédé d'un marqueur (commentaire HTML, invisible sur GitHub) :
     <!-- ci: run -->                     exécuter le bloc tel quel (après substitution des <valeurs>)
     <!-- ci: skip — raison -->           ne pas l'exécuter (raison obligatoire)
     <!-- ci: instead: commande -->       exécuter cette commande à la place (geste interactif, secret…)
   Rocky Linux 10 (--os=rocky, ADR 0085) : un bloc peut porter, en plus, un marqueur « rocky-run », « rocky-skip » ou
   « rocky-instead » qui remplace le marqueur ci pour ce système. Un bloc sans marqueur rocky-* est rejoué tel quel sur
   Rocky ; un bloc Rocky seul (sans marqueur ci) est ignoré sur Debian et Ubuntu.
   Et, n'importe où :
     <!-- ci: then: commande -->          (après un bloc) contrôle du résultat attendu
     <!-- ci: exec: commande -->          geste fait dans le navigateur, rejoué par l'API
   Échec : bloc bash sans marqueur, marqueur orphelin, <valeur> sans substitution, marqueur inconnu.
   Usage : guide-extraire.mjs [--os=debian|rocky] docs/INSTALLATION.md nom_dns=localhost version=ci > guide.sh */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const osArg = args.find((a) => a.startsWith('--os='));
const os = osArg ? osArg.slice(5) : 'debian';
const [file, ...pairs] = args.filter((a) => !a.startsWith('--os='));
if (!file || !['debian', 'rocky'].includes(os)) {
  console.error('Usage : guide-extraire.mjs [--os=debian|rocky] <guide.md> [cle=valeur ...]');
  process.exit(2);
}
const values = Object.fromEntries(pairs.map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]));
const lines = readFileSync(file, 'utf8').split('\n');
const errors = [];
const out = [
  '#!/usr/bin/env bash',
  '# Généré depuis ' + file + ' par scripts/ci/guide-extraire.mjs',
  'set -euo pipefail',
  '',
];

const subst = (cmd, where) =>
  cmd.replace(/<([a-z][a-z0-9_]*)>/g, (m, k) => {
    if (k in values) return values[k];
    errors.push(
      `${where} : valeur <${k}> sans substitution (ajouter ${k}=… à l'appel, ou marquer le bloc skip/instead)`,
    );
    return m;
  });
const MARK = /^\s*<!--\s*ci:\s*([a-z]+(?:-[a-z]+)?)\s*(?:[:—–-]\s*)?(.*?)\s*-->\s*$/;
let section = '';
let pending = null; // { common: {kind, arg, line}, rocky: {kind, arg, line}, after: [] }
let blocks = 0;

// Citation shell sûre : entre apostrophes, chaque apostrophe devient '\''.
const sq = (s) => `'${s.replace(/'/g, "'\\''")}'`;
const emit = (title, body) => {
  out.push(`echo ${sq(`::group::${title}`)}`, ...body, 'echo "::endgroup::"', '');
};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const where = `${file}:${i + 1}`;
  if (/^##+ /.test(line)) section = line.replace(/^#+\s*/, '');
  const m = MARK.exec(line);
  if (m) {
    const [, kind, arg] = m;
    const rocky = kind.startsWith('rocky-');
    const base = rocky ? kind.slice(6) : kind;
    if (base === 'run' || base === 'skip' || base === 'instead') {
      const slot = rocky ? 'rocky' : 'common';
      pending ??= {};
      if (pending[slot])
        errors.push(
          `${where} : deux marqueurs ${rocky ? 'rocky-*' : 'ci'} pour le même bloc (précédent ligne ${pending[slot].line})`,
        );
      if (base === 'skip' && !arg) errors.push(`${where} : « ${kind} » sans raison`);
      if (base === 'instead' && !arg) errors.push(`${where} : « ${kind} » sans commande`);
      pending[slot] = { kind: base, arg, line: i + 1 };
    } else if (kind === 'then' || kind === 'exec') {
      if (!arg) errors.push(`${where} : « ${kind} » sans commande`);
      else if (!pending) emit(`[${kind}] ${section}`, [subst(arg, where)]);
      else (pending.after ??= []).push(subst(arg, where)); // « then » placé avant le bloc qu'il contrôle
    } else errors.push(`${where} : marqueur inconnu « ${kind} »`);
    continue;
  }
  const fence = /^(\s*)```(\w*)\s*$/.exec(line);
  if (!fence) continue;
  const lang = fence[2];
  const body = [];
  let j = i + 1;
  while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) body.push(lines[j++].slice(fence[1].length));
  if (j >= lines.length) errors.push(`${where} : bloc de code non fermé`);
  if (lang !== 'bash') {
    if (pending)
      errors.push(
        `${where} : marqueur de la ligne ${(pending.common ?? pending.rocky).line} placé devant un bloc « ${lang || 'sans langage'} »`,
      );
    pending = null;
    i = j;
    continue;
  }
  blocks++;
  const title = `${section} — ${body[0] ?? ''}`.slice(0, 160);
  // Marqueur retenu : celui du système rejoué ; sur Rocky, à défaut de marqueur rocky-*, le marqueur ci commun ; sur Debian,
  // un bloc réservé à Rocky (marqueur rocky-* seul) n'est pas rejoué.
  const mark = os === 'rocky' ? (pending?.rocky ?? pending?.common) : (pending?.common ?? null);
  if (!pending) errors.push(`${where} : bloc bash sans marqueur ci (run, skip ou instead)`);
  else if (!mark) out.push(`# ignoré (${where}) : bloc réservé à Rocky Linux`, '');
  else if (mark.kind === 'run')
    emit(
      title,
      body.map((b) => subst(b, where)),
    );
  else if (mark.kind === 'instead') emit(`${title} [CI : variante]`, [subst(mark.arg, where)]);
  else out.push(`# ignoré (${where}) : ${mark.arg}`, '');
  if (pending?.after && (mark || os === 'rocky')) emit(`[then] ${section}`, pending.after);
  pending = null;
  i = j;
}
if (pending) errors.push(`${file}:${(pending.common ?? pending.rocky)?.line ?? '?'} : marqueur sans bloc bash`);
if (!blocks) errors.push(`${file} : aucun bloc bash`);
if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(1);
}
out.push('echo "Guide d’installation rejoué : toutes les étapes ont réussi."');
process.stdout.write(out.join('\n') + '\n');
console.error(`${blocks} bloc(s) bash lus dans ${file}.`);
