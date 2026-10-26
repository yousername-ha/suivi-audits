import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifier } from '../ci/verifier-epinglage.mjs';

const sha = 'a'.repeat(40);

test('accepte une action épinglée avec sa version, et une action locale', () => {
  assert.deepEqual(verifier(`      - uses: actions/checkout@${sha} # v5.1.0\n      - uses: ./.github/actions/x\n`), []);
  assert.deepEqual(verifier(`      - uses: github/codeql-action/init@${sha} # v4.39.1\n`), []);
});

test('refuse étiquette, branche, empreinte courte, version absente et action Docker', () => {
  const cas = [
    '      - uses: actions/checkout@v5',
    '      - uses: actions/checkout@main',
    `      - uses: actions/checkout@${sha.slice(0, 7)} # v5`,
    `      - uses: actions/checkout@${sha}`,
    '      - uses: docker://alpine:3.20',
  ];
  for (const ligne of cas) assert.equal(verifier(ligne).length, 1, ligne);
});

test('refuse un outil de sécurité lancé par image à étiquette', () => {
  assert.equal(verifier('run: docker run --rm aquasec/trivy:0.75.0 image x').length, 1);
  assert.equal(verifier('run: docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.28.0 git /repo').length, 1);
  assert.deepEqual(verifier('run: trivy image --input image.tar'), []);
});
