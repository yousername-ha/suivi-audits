/* Contrôles avant la pose d'une étiquette de version par le workflow « poser-etiquette.yml » (ADR 0102).
   Lancé sur la tête de main, en lecture seule, avant toute demande d'approbation : la version demandée, le manifeste de
   publication, la section du CHANGELOG, la CI et CodeQL du commit exact, et l'absence de l'étiquette. Le commit vérifié est
   rendu au job suivant, qui pose l'étiquette dessus et nulle part ailleurs. */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publication, verifierControles } from './preparer-publication.mjs';

/** Version demandée X.Y.Z, publiée sur le canal stable depuis main uniquement. Rend l'étiquette `vX.Y.Z`. */
export function verifierDemande(version, ref, config) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Version X.Y.Z requise (chiffres seulement, sans préfixe ni suffixe).');
  }
  if (ref !== 'refs/heads/main') {
    throw new Error('Le workflow se lance sur la branche main uniquement.');
  }
  const etiquette = `v${version}`;
  const plan = publication(etiquette, config);
  if (plan.prerelease || plan.branch !== 'main') {
    throw new Error('Seul le canal stable se publie par ce workflow (manifeste de publication).');
  }
  return etiquette;
}

/** L'étiquette ne doit exister ni localement ni sur le dépôt : jamais de déplacement ni de remplacement. */
export function verifierAbsence(sortieLsRemote) {
  if (sortieLsRemote.trim() !== '')
    throw new Error('Cette étiquette existe déjà : elle ne sera ni déplacée ni remplacée.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = existsSync('.github/publication.json')
    ? JSON.parse(readFileSync('.github/publication.json', 'utf8'))
    : null;
  const etiquette = verifierDemande(process.env.VERSION, process.env.GITHUB_REF, config);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  verifierAbsence(
    execFileSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/${etiquette}`], { encoding: 'utf8' }),
  );
  // Section de la version et « Notes de mise à jour » (échoue si elles manquent).
  execFileSync('node', ['scripts/ci/verifier-changelog.mjs', 'CHANGELOG.md', '--section', process.env.VERSION], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const response = execFileSync(
    'gh',
    ['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/runs?head_sha=${revision}&per_page=100`],
    { encoding: 'utf8' },
  );
  verifierControles(JSON.parse(response).workflow_runs, revision);
  appendFileSync(process.env.GITHUB_OUTPUT, `commit=${revision}\netiquette=${etiquette}\n`);
  console.log(`Prêt : ${etiquette} sur ${revision} (manifeste, CHANGELOG, CI et CodeQL vérifiés).`);
}
