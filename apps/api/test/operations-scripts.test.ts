import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { REPO } from './helpers.js';
it('exécute le protocole hôte, les sauvegardes de sécurité, les interruptions et les retours arrière sans données de production', async () => {
  const r = await promisify(execFile)('python3', [path.join(REPO, 'scripts/tests/test_exploitation.py')], {
    timeout: 60000,
  });
  expect(r.stderr).toContain('Ran 33 tests');
  expect(r.stderr).toMatch(/\nOK\n/);
}, 65000);
