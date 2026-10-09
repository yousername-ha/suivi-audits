/* Le runner d'installation ne doit pas exposer les secrets renvoyés par une réponse HTTP. */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';

describe('confidentialité du runner du guide', () => {
  it.each([201, 500])('ne journalise pas le mot de passe ni le corps HTTP (%i)', async (status) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'suivi-guide-test-'));
    const marker = 'Secret-fictif-a-ne-pas-journaliser';
    writeFileSync(path.join(dir, 'guide-etat.json'), JSON.stringify({ cookies: { test: 'test' } }), { mode: 0o600 });
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/auth/me') res.end(JSON.stringify({ stage: 'ok', csrf: 'csrf-fictif' }));
      else {
        res.statusCode = status;
        res.end(JSON.stringify({ temporaryPassword: marker, error: marker }));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('adresse de test absente');
      const result = await new Promise<{ code: number | null; out: string }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [path.join(REPO, 'scripts/ci/guide-api.mjs'), 'compte', `http://127.0.0.1:${address.port}`],
          {
            env: { ...process.env, RUNNER_TEMP: dir, GITHUB_ACTIONS: 'true' },
          },
        );
        let out = '';
        child.stdout.on('data', (b) => {
          out += b.toString();
        });
        child.stderr.on('data', (b) => {
          out += b.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, out }));
      });
      expect(result.code).toBe(status === 201 ? 0 : 1);
      expect(result.out).not.toContain(marker);
      if (status === 500) expect(result.out).toContain('HTTP 500');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
