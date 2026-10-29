import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('../ci/rapport-e2e.mjs', import.meta.url).pathname;

function annotations(rapport) {
  const dossier = mkdtempSync(join(tmpdir(), 'rapport-e2e-'));
  const fichier = join(dossier, 'resultats.json');
  writeFileSync(fichier, JSON.stringify(rapport));
  return execFileSync('node', [script, fichier], { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.startsWith('::'));
}

const test_ = (statut, essais) => ({
  suites: [
    {
      title: 'exemple.spec.ts',
      specs: [
        {
          title: 'parcours',
          file: 'exemple.spec.ts',
          line: 7,
          tests: [{ status: statut, results: essais }],
        },
      ],
    },
  ],
  stats: {},
});

test("l'annotation d'un test instable indique la ligne de l'assertion qui a échoué", () => {
  const [ligne] = annotations(
    test_('flaky', [
      {
        status: 'failed',
        error: {
          message: 'Error: expect(received).toEqual(expected)\n\n- Expected  - 1\n+ Received  + 58',
          location: { file: '/depot/tests/e2e/specs/exemple.spec.ts', line: 38, column: 5 },
        },
      },
      { status: 'passed' },
    ]),
  );
  assert.match(ligne, /^::warning file=tests\/e2e\/specs\/exemple\.spec\.ts,line=7,/);
  assert.match(ligne, /ligne 38 du test/);
});

test("sans position d'erreur, l'annotation reste inchangée", () => {
  const [ligne] = annotations(test_('unexpected', [{ status: 'failed', error: { message: 'Timeout' } }]));
  assert.match(ligne, /^::error /);
  assert.doesNotMatch(ligne, /ligne \d+ du test/);
});
