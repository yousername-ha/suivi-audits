import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const script = path.resolve(import.meta.dirname, '../ci/guide-extraire.mjs');
const guide = path.resolve(import.meta.dirname, '../../docs/INSTALLATION.md');
const dir = mkdtempSync(path.join(tmpdir(), 'guide-'));

function extraire(os, contenu) {
  const f = path.join(dir, `guide-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(f, contenu);
  return spawnSync('node', [script, ...(os ? [`--os=${os}`] : []), f], { encoding: 'utf8' });
}
const exemple = [
  '## Étape',
  '<!-- ci: run -->',
  '<!-- ci: rocky-skip — Debian seulement -->',
  '```bash',
  'sudo apt install -y git',
  '```',
  '<!-- ci: rocky-run -->',
  '```bash',
  'sudo dnf install -y git',
  '```',
  '<!-- ci: run -->',
  '```bash',
  'echo commun',
  '```',
  '',
].join('\n');

test('Debian (défaut) : le bloc apt est rejoué, le bloc Rocky seul est ignoré', () => {
  for (const os of [null, 'debian']) {
    const r = extraire(os, exemple);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /sudo apt install -y git/);
    assert.doesNotMatch(r.stdout, /sudo dnf install/);
    assert.match(r.stdout, /echo commun/);
  }
});

test('Rocky : le bloc apt est ignoré avec sa raison, le bloc Rocky est rejoué, le bloc commun reste', () => {
  const r = extraire('rocky', exemple);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /sudo apt install/);
  assert.match(r.stdout, /# ignoré \(.*\) : Debian seulement/);
  assert.match(r.stdout, /sudo dnf install -y git/);
  assert.match(r.stdout, /echo commun/);
});

test('un bloc bash sans aucun marqueur reste refusé, quel que soit le système', () => {
  for (const os of ['debian', 'rocky']) {
    const r = extraire(os, '```bash\necho x\n```\n');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /sans marqueur/);
  }
});

test('deux marqueurs de même famille sur un bloc sont refusés', () => {
  const r = extraire('rocky', '<!-- ci: rocky-run -->\n<!-- ci: rocky-skip — x -->\n```bash\necho x\n```\n');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /deux marqueurs/);
});

test('système inconnu refusé', () => {
  const r = extraire('freebsd', exemple);
  assert.equal(r.status, 2);
});

test('le guide réel s’extrait pour Debian et pour Rocky, sans commande apt rejouée sur Rocky', () => {
  const deb = execFileSync('node', [script, guide, 'nom_dns=localhost', 'version=ci'], { encoding: 'utf8' });
  const rocky = execFileSync('node', [script, '--os=rocky', guide, 'nom_dns=localhost', 'version=ci'], {
    encoding: 'utf8',
  });
  assert.match(deb, /ufw allow 22\/tcp/);
  assert.doesNotMatch(deb, /firewall-cmd/);
  assert.match(rocky, /firewall-cmd --permanent/);
  assert.match(rocky, /download\.docker\.com\/linux\/rhel\/docker-ce\.repo/);
  const executees = rocky.split('\n').filter((l) => !l.startsWith('#') && !l.startsWith('echo'));
  for (const l of executees)
    assert.doesNotMatch(l, /^(sudo )?(apt|apt-get|ufw|dpkg)\b/, `commande Debian rejouée sur Rocky : ${l}`);
});
