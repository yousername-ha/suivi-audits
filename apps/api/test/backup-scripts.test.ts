import { execFile } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';
const exec = promisify(execFile);
const dirs: string[] = [];
const JOB = '00000000-0000-4000-8000-000000000001';
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'suivi-worker-test-'));
  dirs.push(dir);
  for (const part of ['scripts', 'bin', 'data/etat', 'data/secrets', 'archives'])
    mkdirSync(path.join(dir, part), { recursive: true, mode: 0o700 });
  for (const name of ['backup.sh', 'backup-worker.sh', 'lib-commun.sh'])
    copyFileSync(path.join(REPO, 'scripts', name), path.join(dir, 'scripts', name));
  writeFileSync(path.join(dir, '.env'), `DATA_DIR=${dir}/data\nAPP_VERSION=ci\n`);
  const key = path.join(dir, 'phrase-fictive');
  writeFileSync(key, 'Phrase-de-test-fictive', { mode: 0o600 });
  writeFileSync(path.join(dir, 'data/secrets/doc_key'), 'cle-document-fictive', { mode: 0o600 });
  const events = path.join(dir, 'events.jsonl');
  writeFileSync(
    path.join(dir, 'bin/docker'),
    String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_EVENTS, JSON.stringify(args) + '\n');
const cmd = args[args.indexOf('suivi') + 1];
if (args.includes('pg_dump')) { if (process.env.TEST_FAIL_DUMP) process.exit(7); console.log('dump-fictif'); }
else if (args.includes('psql')) console.log('006_sauvegardes.sql');
else if (cmd === 'backup-claim' && !process.env.TEST_EMPTY) console.log('${JOB}');
`,
    { mode: 0o700 },
  );
  const env = {
    ...process.env,
    PATH: `${dir}/bin:${process.env.PATH}`,
    TEST_EVENTS: events,
    BACKUP_DEST: path.join(dir, 'archives'),
    BACKUP_PASSPHRASE_FILE: key,
  };
  return { dir, key, events, env };
}
describe('exécutant serveur A1a', () => {
  it('exécute uniquement backup.sh, chiffre la sauvegarde, contrôle son empreinte et termine le job', async () => {
    const f = fixture();
    await exec('bash', [path.join(f.dir, 'scripts/backup-worker.sh')], { env: f.env });
    const report = JSON.parse(readFileSync(path.join(f.dir, 'data/etat/sauvegardes/jobs', `${JOB}.json`), 'utf8'));
    expect(report).toMatchObject({ jobId: JOB, resultat: 'reussie', chiffree: true, integriteVerifiee: true });
    expect(report.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(report.fichier.replace(/\.enc$/, ''))).toBe(false);
    await exec('sha256sum', ['-c', path.basename(report.fichier) + '.sha256'], { cwd: path.dirname(report.fichier) });
    const plain = path.join(f.dir, 'controle.tar');
    await exec('openssl', [
      'enc',
      '-d',
      '-aes-256-cbc',
      '-pbkdf2',
      '-iter',
      '600000',
      '-in',
      report.fichier,
      '-out',
      plain,
      '-pass',
      `file:${f.key}`,
    ]);
    const dump = await exec('tar', ['-xOf', plain, 'suivi.dump']);
    expect(dump.stdout).toBe('dump-fictif\n');
    const secret = await exec('tar', ['-tf', plain]);
    expect(secret.stdout).toContain('secrets.tgz');
    const events = readFileSync(f.events, 'utf8');
    expect(events).toContain('backup-finish');
    expect(events).not.toContain('Phrase-de-test-fictive');
  });
  it('ne crée pas de sauvegarde quand aucune demande n’est en attente', async () => {
    const f = fixture();
    await exec('bash', [path.join(f.dir, 'scripts/backup-worker.sh')], { env: { ...f.env, TEST_EMPTY: '1' } });
    expect(readFileSync(f.events, 'utf8')).not.toContain('pg_dump');
  });
  it('refuse une clé trop accessible sans prendre en charge de demande', async () => {
    const f = fixture();
    await exec('chmod', ['0644', f.key]);
    await expect(exec('bash', [path.join(f.dir, 'scripts/backup-worker.sh')], { env: f.env })).rejects.toMatchObject({
      code: 1,
    });
    const events = readFileSync(f.events, 'utf8');
    expect(events).toContain('unavailable');
    expect(events).not.toContain('backup-claim');
  });
  it('consigne un échec du dump sans annoncer une sauvegarde réussie', async () => {
    const f = fixture();
    await expect(
      exec('bash', [path.join(f.dir, 'scripts/backup-worker.sh')], { env: { ...f.env, TEST_FAIL_DUMP: '1' } }),
    ).rejects.toMatchObject({ code: 7 });
    const report = JSON.parse(readFileSync(path.join(f.dir, 'data/etat/sauvegardes/jobs', `${JOB}.json`), 'utf8'));
    expect(report.resultat).toBe('echec');
    expect(report.integriteVerifiee).toBe(false);
    expect(readFileSync(f.events, 'utf8')).toContain('backup-finish');
  });
  it('ne publie aucune archive ni copie en clair si le chiffrement échoue', async () => {
    const f = fixture();
    writeFileSync(path.join(f.dir, 'bin/openssl'), '#!/usr/bin/env bash\nexit 9\n', { mode: 0o700 });
    await expect(exec('bash', [path.join(f.dir, 'scripts/backup-worker.sh')], { env: f.env })).rejects.toMatchObject({
      code: 9,
    });
    expect(readdirSync(path.join(f.dir, 'archives'))).toEqual([]);
    const report = JSON.parse(readFileSync(path.join(f.dir, 'data/etat/sauvegardes/jobs', `${JOB}.json`), 'utf8'));
    expect(report.resultat).toBe('echec');
    expect(report.integriteVerifiee).toBe(false);
  });
  it('respecte le verrou d’une sauvegarde existante sans exécuter un deuxième dump', async () => {
    const f = fixture();
    await expect(
      exec(
        'flock',
        [path.join(f.dir, 'data/etat/sauvegarde.lock'), 'bash', path.join(f.dir, 'scripts/backup-worker.sh')],
        { env: f.env },
      ),
    ).rejects.toMatchObject({ code: 1 });
    const events = readFileSync(f.events, 'utf8');
    expect(events).not.toContain('pg_dump');
    expect(events).toContain('backup-finish');
    const report = JSON.parse(readFileSync(path.join(f.dir, 'data/etat/sauvegardes/jobs', `${JOB}.json`), 'utf8'));
    expect(report.resultat).toBe('echec');
  });
  it('préserve la sauvegarde directe avant mise à jour et sa rétention de 36500 jours', async () => {
    const f = fixture();
    await exec('bash', [path.join(f.dir, 'scripts/backup.sh'), f.env.BACKUP_DEST], {
      env: { ...f.env, RETENTION_DAYS: '36500', BACKUP_PREFIXE: 'avant-maj-ci-vers-99.0.0' },
    });
    const report = JSON.parse(readFileSync(path.join(f.dir, 'data/etat/sauvegardes/derniere-reussie.json'), 'utf8'));
    expect(report).toMatchObject({ resultat: 'reussie', chiffree: true, integriteVerifiee: true, jobId: '' });
    expect(path.basename(report.fichier)).toMatch(/^avant-maj-ci-vers-99\.0\.0-.*\.tar\.enc$/);
    await exec('sha256sum', ['-c', path.basename(report.fichier) + '.sha256'], { cwd: path.dirname(report.fichier) });
  });
});
