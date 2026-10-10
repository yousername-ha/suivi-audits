import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { expect, it } from 'vitest';
import { REPO } from './helpers.js';
it('exécutant de mise à jour : publications, signatures, verrous et reprise durable', async () => {
  const result = await promisify(execFile)('python3', [path.join(REPO, 'scripts/tests/test_updates.py')]);
  expect(result.stderr).toMatch(/Ran 9 tests[\s\S]*OK/);
});
