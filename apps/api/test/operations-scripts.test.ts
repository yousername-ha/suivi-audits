import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { REPO } from './helpers.js';
it('exécute le protocole hôte, les sauvegardes de sécurité, les interruptions et les retours arrière sans données de production', async () => {
  const r = await promisify(execFile)('python3', [path.join(REPO, 'scripts/tests/test_exploitation.py')], {
    timeout: 60000,
  });
  expect(r.stderr).toContain('Ran 56 tests');
  expect(r.stderr).toMatch(/\nOK\n/);
}, 65000);
it('exécute le script isolé des connecteurs contre un faux service HTTPS local (module Intégrations, ADR 0076)', async () => {
  const r = await promisify(execFile)('python3', [path.join(REPO, 'scripts/tests/test_integration_http.py')], {
    timeout: 60000,
  });
  expect(r.stderr).toContain('Ran 18 tests');
  expect(r.stderr).toMatch(/\nOK\n/);
}, 65000);
it('exécute le script isolé de la veille contre un faux service HTTPS local (module Vulnérabilités, ADR 0100)', async () => {
  const r = await promisify(execFile)('python3', [path.join(REPO, 'scripts/tests/test_veille_vulnerabilites.py')], {
    timeout: 60000,
  });
  expect(r.stderr).toContain('Ran 21 tests');
  expect(r.stderr).toMatch(/\nOK\n/);
}, 65000);
