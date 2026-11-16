import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { expect, it } from 'vitest';
import { REPO } from './helpers.js';
it('exécutant : flux vers l’extérieur appliqués (profils Compose, silence des mises à jour, rapport) — ADR 0097, lot 2', async () => {
  const result = await promisify(execFile)('python3', [path.join(REPO, 'scripts/tests/test_flux_executant.py')]);
  expect(result.stderr).toMatch(/Ran 17 tests[\s\S]*OK/);
});
