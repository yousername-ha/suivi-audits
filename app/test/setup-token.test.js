'use strict';
/* Tests du jeton d'installation : npm test (aucune base de données nécessaire). */
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/setup-token');

const FORMAT = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}(-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}){3}$/;

test('génération : format XXXXX-XXXXX-XXXXX-XXXXX, sans caractère ambigu, au moins 90 bits', () => {
  assert.equal(T.ALPHABET.length, 31);
  assert.doesNotMatch(T.ALPHABET, /[01OIL]/);
  assert.ok(T.BITS >= 90, `entropie ${T.BITS} bits`);
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const t = T.generate();
    assert.match(t, FORMAT);
    seen.add(t);
  }
  assert.equal(seen.size, 500);
});

test('normalisation : minuscules, tirets, espaces, tirets typographiques', () => {
  const ref = 'K7QM2XH9PD4TNRWB8FZC';
  for (const v of ['K7QM2-XH9PD-4TNRW-B8FZC', 'k7qm2-xh9pd-4tnrw-b8fzc', 'K7QM2 XH9PD 4TNRW B8FZC', '  k7qm2xh9pd4tnrwb8fzc  ',
    'K7QM2—XH9PD–4TNRW‐B8FZC', 'k7Qm2-Xh9 pd-4TN rwB8-fzc', 'K7QM2\tXH9PD\n4TNRW-B8FZC']) {
    assert.equal(T.normalize(v), ref, JSON.stringify(v));
  }
  assert.equal(T.format(ref), 'K7QM2-XH9PD-4TNRW-B8FZC');
});

test('normalisation : formats refusés', () => {
  for (const v of ['', 'K7QM2-XH9PD-4TNRW', 'K7QM2-XH9PD-4TNRW-B8FZC-AAAAA', 'K7QM2-XH9PD-4TNRW-B8FZ0', 'O7QM2-XH9PD-4TNRW-B8FZC',
    'I7QM2-XH9PD-4TNRW-B8FZC', 'L7QM2-XH9PD-4TNRW-B8FZC', '17QM2-XH9PD-4TNRW-B8FZC', 'K7QM2.XH9PD.4TNRW.B8FZC', null, undefined, 42, 'x'.repeat(200)]) {
    assert.equal(T.normalize(v), null, JSON.stringify(v));
  }
});

test('vérification : bon jeton accepté quelle que soit la saisie', async () => {
  const tok = T.generate();
  const rec = await T.makeRecord(tok, 'first_start');
  assert.doesNotMatch(JSON.stringify(rec), new RegExp(tok.replace(/-/g, '') + '|' + tok), 'le jeton ne doit pas être stocké en clair');
  assert.equal(await T.check(tok, rec), 'ok');
  assert.equal(await T.check(tok.toLowerCase(), rec), 'ok');
  assert.equal(await T.check(tok.replace(/-/g, ' '), rec), 'ok');
  assert.equal(await T.check(tok.replace(/-/g, ''), rec), 'ok');
  assert.ok(T.pending(rec));
});

test('vérification : jeton erroné ou remplacé refusé', async () => {
  const rec = await T.makeRecord(T.generate(), 'cli');
  assert.equal(await T.check(T.generate(), rec), 'invalid');
  assert.equal(await T.check('pas un jeton', rec), 'invalid');
  assert.equal(await T.check('', rec), 'invalid');
  const old = T.generate();
  await T.makeRecord(old, 'cli');
  const replaced = await T.makeRecord(T.generate(), 'cli');   // un nouveau jeton annule le précédent
  assert.equal(await T.check(old, replaced), 'invalid');
});

test('vérification : jeton expiré', async () => {
  const tok = T.generate();
  const t0 = Date.now();
  const rec = await T.makeRecord(tok, 'first_start', t0);
  assert.equal(await T.check(tok, rec, t0 + T.TTL_MS - 1000), 'ok');
  assert.equal(await T.check(tok, rec, t0 + T.TTL_MS + 1000), 'expired');
  assert.equal(T.pending(rec, t0 + T.TTL_MS + 1000), false);
  assert.equal(await T.check(T.generate(), rec, t0 + T.TTL_MS + 1000), 'invalid', 'un mauvais jeton ne révèle pas l\'expiration');
});

test('vérification : jeton déjà utilisé', async () => {
  const tok = T.generate();
  const rec = { ...(await T.makeRecord(tok, 'first_start')), usedAt: new Date().toISOString() };
  assert.equal(await T.check(tok, rec), 'used');
  assert.equal(await T.check(tok.toLowerCase(), rec), 'used');
  assert.equal(T.pending(rec), false);
  assert.equal(await T.check(T.generate(), rec), 'invalid', 'un mauvais jeton ne révèle pas l\'utilisation');
});

test('vérification : aucun jeton émis', async () => {
  assert.equal(await T.check('K7QM2-XH9PD-4TNRW-B8FZC', null), 'none');
  assert.equal(T.pending(null), false);
  for (const k of ['invalid', 'expired', 'used', 'none']) assert.ok(T.MESSAGES[k]);
});
