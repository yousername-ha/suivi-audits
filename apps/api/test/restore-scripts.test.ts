/* A1b1 : recette Python standard, fichiers fictifs et Docker simulé ; aucune restauration de production. */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { REPO } from './helpers.js';

it('protège la restauration contre les archives piégées et préserve le parcours serveur', async () => {
  const result = await promisify(execFile)('python3', [path.join(REPO, 'scripts/tests/test_restoration.py')], {
    timeout: 30_000,
  });
  expect(result.stderr).toContain('Ran 36 tests');
  expect(result.stderr).toMatch(/\nOK\n/);
}, 35_000);
