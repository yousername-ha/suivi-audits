import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publication, verifierControles } from '../ci/preparer-publication.mjs';

test('préversion numérotée : branche de travail, titre explicite et pas de version stable', () => {
  assert.deepEqual(publication('v3.0.1', { version: '3.0.1', channel: 'development' }), {
    version: '3.0.1',
    prerelease: true,
    branch: 'claude-suivi-smsi',
    title: 'Test de développement 3.0.1',
  });
});

test('publication stable : main reste la source par défaut', () => {
  for (const config of [null, { version: '3.1.0', channel: 'stable' }]) {
    const plan = publication('v3.1.0', config);
    assert.equal(plan.prerelease, false);
    assert.equal(plan.branch, 'main');
  }
});

test('étiquette et manifeste incohérents ou commandes injectées refusés', () => {
  for (const ref of ['main', 'v03.0.1', 'v3.0.1-beta', 'v3.0.1;id', 'v3.0.1\ntest', 'v3.0.1\n', null]) {
    assert.throws(() => publication(ref, null));
  }
  for (const config of [
    {},
    [],
    false,
    { version: '3.0.2', channel: 'development' },
    { version: '3.0.1', channel: 'unknown' },
    { version: '3.0.1', channel: 'stable', branch: 'evil' },
  ]) {
    assert.throws(() => publication('v3.0.1', config));
  }
});

const valid = [
  { id: 2, name: 'CI', head_sha: 'a', status: 'completed', conclusion: 'success' },
  { id: 3, name: 'CodeQL', head_sha: 'a', status: 'completed', conclusion: 'success' },
];
test('contrôles obligatoires sur le commit exact, avant toute publication', () => {
  verifierControles(valid, 'a');
  assert.throws(() => verifierControles(valid, 'b'));
  assert.throws(() => verifierControles(valid.slice(0, 1), 'a'));
  for (const conclusion of ['failure', 'cancelled', 'skipped', 'neutral', null]) {
    assert.throws(() => verifierControles([{ ...valid[0], conclusion }, valid[1]], 'a'));
  }
  assert.throws(() =>
    verifierControles([...valid, { ...valid[0], id: 4, status: 'in_progress', conclusion: null }], 'a'),
  );
});
