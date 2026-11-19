/* A1b1 : recette Python standard, fichiers fictifs et Docker simulé ; aucune restauration de production. */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { REPO } from './helpers.js';

it('protège la restauration contre les archives piégées et préserve le parcours serveur', async () => {
  const result = await promisify(execFile)('python3', [path.join(REPO, 'scripts/tests/test_restoration.py')], {
    // Rotation par nombre et contrôle d'espace de backup.sh (ADR 0106) : sept sauvegardes réelles de plus.
    timeout: 60_000,
  });
  expect(result.stderr).toContain('Ran 48 tests');
  expect(result.stderr).toMatch(/\nOK\n/);
}, 65_000);
