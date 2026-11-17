import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { verifierAbsence, verifierDemande } from '../ci/verifier-etiquette.mjs';

const stable = (version) => ({ version, channel: 'stable' });

test('version stable depuis main : étiquette vX.Y.Z', () => {
  assert.equal(verifierDemande('7.2.1', 'refs/heads/main', stable('7.2.1')), 'v7.2.1');
});

test('version mal formée ou injectée refusée', () => {
  for (const version of ['', 'v7.2.1', '7.2', '07.2.1', '7.2.1-beta', '7.2.1;id', '7.2.1\n', null, undefined]) {
    assert.throws(() => verifierDemande(version, 'refs/heads/main', stable('7.2.1')));
  }
});

test('lancé hors de main : refusé', () => {
  for (const ref of ['refs/heads/claude-suivi-smsi', 'refs/tags/v7.2.1', '', undefined]) {
    assert.throws(() => verifierDemande('7.2.1', ref, stable('7.2.1')), /main uniquement/);
  }
});

test('manifeste incohérent ou canal de développement : refusé', () => {
  assert.throws(() => verifierDemande('7.2.1', 'refs/heads/main', stable('7.2.0')));
  assert.throws(
    () => verifierDemande('7.2.1', 'refs/heads/main', { version: '7.2.1', channel: 'development' }),
    /stable/,
  );
});

test('étiquette déjà présente : jamais déplacée ni remplacée', () => {
  verifierAbsence('');
  verifierAbsence('\n');
  assert.throws(() => verifierAbsence('abc\trefs/tags/v7.2.1\n'), /existe déjà/);
});

test('workflow : approbation dans etiquette-version, jeton dédié, aucun droit d’écriture du jeton intégré', () => {
  const wf = readFileSync(new URL('../../.github/workflows/poser-etiquette.yml', import.meta.url), 'utf8');
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /environment: etiquette-version/);
  assert.match(wf, /secrets\.ETIQUETTE_VERSION_JETON/);
  assert.doesNotMatch(wf, /contents: write/);
  assert.match(wf, /needs\.verifier\.outputs\.commit/);
});
