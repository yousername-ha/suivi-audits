/* Préversions numérotées compatibles avec l'exécutant existant du dépôt privé.
   La décision est inscrite dans le commit étiqueté ; aucune option externe ne peut la remplacer. */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function publication(ref, config) {
  if (
    typeof ref !== 'string' ||
    ref.length > 41 ||
    /\s/.test(ref) ||
    !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(ref)
  ) {
    throw new Error('Étiquette vX.Y.Z requise.');
  }
  const version = ref.slice(1);
  if (
    config !== null &&
    (!config ||
      Array.isArray(config) ||
      typeof config !== 'object' ||
      Object.keys(config).sort().join(',') !== 'channel,version' ||
      config.version !== version ||
      !['stable', 'development'].includes(config.channel))
  ) {
    throw new Error('Le manifeste de publication doit correspondre exactement à la version étiquetée.');
  }
  const development = config?.channel === 'development';
  return {
    version,
    prerelease: development,
    branch: development ? 'claude-suivi-smsi' : 'main',
    title: development ? `Test de développement ${version}` : `Version ${version}`,
  };
}

export function verifierControles(runs, revision) {
  for (const name of ['CI', 'CodeQL']) {
    const matching = runs.filter((r) => r.head_sha === revision && r.name === name).sort((a, b) => b.id - a.id);
    if (!matching.length || matching[0].status !== 'completed' || matching[0].conclusion !== 'success') {
      throw new Error(`Le dernier contrôle ${name} de ce commit doit être terminé et réussi avant publication.`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = existsSync('.github/publication.json')
    ? JSON.parse(readFileSync('.github/publication.json', 'utf8'))
    : null;
  const plan = publication(process.env.GITHUB_REF_NAME, config);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const tagRevision = execFileSync('git', ['rev-parse', `${process.env.GITHUB_REF_NAME}^{commit}`], {
    encoding: 'utf8',
  }).trim();
  if (tagRevision !== revision) throw new Error('Le commit extrait doit correspondre à l’étiquette.');
  execFileSync('git', [
    'fetch',
    '--no-tags',
    'origin',
    `+refs/heads/${plan.branch}:refs/remotes/origin/${plan.branch}`,
  ]);
  execFileSync('git', ['merge-base', '--is-ancestor', revision, `refs/remotes/origin/${plan.branch}`]);
  const response = execFileSync(
    'gh',
    ['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/runs?head_sha=${revision}&per_page=100`],
    { encoding: 'utf8' },
  );
  verifierControles(JSON.parse(response).workflow_runs, revision);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${plan.version}\nprerelease=${plan.prerelease}\ntitle=${plan.title}\n`,
  );
}
