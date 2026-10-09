"""Recette A1b1 isolée : aucun Docker réel ni donnée du serveur n'est utilisé."""
import base64
import hashlib
import io
import os
import pathlib
import shutil
import subprocess
import tarfile
import tempfile
import unittest

REPO = pathlib.Path(__file__).resolve().parents[2]


def tar_bytes(entries, compressed=False):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz' if compressed else 'w', format=tarfile.GNU_FORMAT) as archive:
        for name, content, kind in entries:
            member = tarfile.TarInfo(name)
            member.type = kind
            if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                member.linkname = '../../outside'
            if kind == tarfile.REGTYPE:
                member.size = len(content)
                archive.addfile(member, io.BytesIO(content))
            else:
                archive.addfile(member)
    return output.getvalue()


class Restoration(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='suivi-restore-test-')
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        for name in ('scripts', 'bin', 'data/etat', 'data/secrets'):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        for name in ('backup.sh', 'restore.sh', 'lib-commun.sh', 'verifier-archive-restauration.py'):
            shutil.copyfile(REPO / 'scripts' / name, self.root / 'scripts' / name)
        (self.root / '.env').write_text('DATA_DIR=' + str(self.root / 'data') + '\n')
        (self.root / 'data/.suivi-audits-donnees').touch()
        (self.root / 'data/secrets/old').write_text('ancien-secret-fictif')
        self.key = self.root / 'phrase'
        self.key.write_text('phrase-de-test-fictive')
        self.key.chmod(0o600)
        self.events = self.root / 'events'
        fake = self.root / 'bin/docker'
        fake.write_text('''#!/usr/bin/env python3
import os, sys, json
from pathlib import Path
args = sys.argv[1:]
with open(os.environ['TEST_EVENTS'], 'a') as log: log.write(json.dumps(args) + '\\n')
if 'pg_dump' in args: sys.stdout.buffer.write(b'PGDMP-dump-fictif')
if 'psql' in args and '-Atc' not in args:
    with open(os.environ['TEST_EVENTS'], 'a') as log: log.write(sys.stdin.read() + '\\n')
if 'pg_restore' in args and '--list' in args and os.environ.get('TEST_BAD_DUMP'): sys.exit(7)
if 'pg_isready' in args and os.environ.get('TEST_NO_PG'): sys.exit(1)
if args[0] == 'inspect': print('unhealthy' if os.environ.get('TEST_NO_HEALTH') else 'healthy')
if 'pg_restore' in args and '--list' not in args: Path(os.environ['TEST_RESTORED']).write_bytes(sys.stdin.buffer.read())
''')
        fake.chmod(0o700)
        fake_id = self.root / 'bin/id'
        fake_id.write_text('#!/usr/bin/env bash\necho 0\n')
        fake_id.chmod(0o700)
        self.env = {**os.environ, 'PATH': str(self.root / 'bin') + ':' + os.environ['PATH'],
                    'TEST_EVENTS': str(self.events), 'TEST_RESTORED': str(self.root / 'restored.dump'),
                    'BACKUP_PASSPHRASE_FILE': str(self.key), 'RESTORE_WAIT_SECONDS': '1'}

    def archive(self, secrets=None, outer=None, caddy=None):
        if secrets is None:
            secrets = [('db_app_password', b'password-fictif', tarfile.REGTYPE),
                       ('doc_master_key', base64.b64encode(b'a' * 32), tarfile.REGTYPE)]
        contents = [('suivi.dump', b'PGDMP-dump-fictif', tarfile.REGTYPE),
                    ('INFO', b'date=20261009\n', tarfile.REGTYPE),
                    ('secrets.tgz', tar_bytes(secrets, True), tarfile.REGTYPE)]
        if caddy is not None:
            contents.append(('caddy.tgz', tar_bytes(caddy, True), tarfile.REGTYPE))
        target = self.root / 'backup.tar'
        target.write_bytes(tar_bytes(contents if outer is None else outer))
        return target

    def run_restore(self, archive, verify=True, env=None, confirmation='RESTAURER\n'):
        args = ['bash', str(self.root / 'scripts/restore.sh')]
        if verify:
            args.append('--verifier')
        return subprocess.run(args + [str(archive)], input=confirmation, text=True, capture_output=True,
                              env={**self.env, **(env or {})}, timeout=20)

    def assert_refused(self, archive):
        result = self.run_restore(archive, False)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.events.exists(), 'Docker ne doit pas être appelé pour une archive refusée')
        self.assertEqual((self.root / 'data/secrets/old').read_text(), 'ancien-secret-fictif')
        self.assertFalse((self.root / 'outside').exists())

    def test_verification_is_non_destructive(self):
        result = self.run_restore(self.archive())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Vérification réussie', result.stdout)
        self.assertFalse(self.events.exists())
        self.assertTrue((self.root / 'data/secrets/old').exists())

    def test_encrypted_roundtrip_and_checksum(self):
        plain = self.archive()
        encrypted = self.root / 'backup.tar.enc'
        subprocess.run(['openssl', 'enc', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-salt',
                        '-in', str(plain), '-out', str(encrypted), '-pass', 'file:' + str(self.key)], check=True)
        digest = hashlib.sha256(encrypted.read_bytes()).hexdigest()
        pathlib.Path(str(encrypted) + '.sha256').write_text(digest + '  ' + encrypted.name + '\n')
        result = self.run_restore(encrypted)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('SHA-256 vérifiée', result.stdout)
        self.assertFalse(self.events.exists())
        self.key.write_text('mauvaise-phrase-fictive')
        self.assert_refused(encrypted)

    def test_checksum_cannot_select_another_file(self):
        archive = self.archive()
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        pathlib.Path(str(archive) + '.sha256').write_text(digest + '  autre.tar\n')
        self.assert_refused(archive)
        sidecar = pathlib.Path(str(archive) + '.sha256')
        sidecar.unlink()
        os.mkfifo(sidecar)
        self.assert_refused(archive)

    def test_checksum_detects_corruption(self):
        archive = self.archive()
        pathlib.Path(str(archive) + '.sha256').write_text('0' * 64 + '  ' + archive.name + '\n')
        self.assert_refused(archive)

    def test_outer_unknown_duplicate_and_missing_members(self):
        for entries in ([('../outside', b'x', tarfile.REGTYPE)],
                        [('suivi.dump', b'PGDMP', tarfile.REGTYPE)] * 2,
                        [('INFO', b'date\n', tarfile.REGTYPE)],
                        [('suivi.dump', b'not-a-dump', tarfile.REGTYPE), ('INFO', b'x', tarfile.REGTYPE),
                         ('secrets.tgz', tar_bytes([], True), tarfile.REGTYPE)]):
            with self.subTest(entries=entries):
                self.assert_refused(self.archive(outer=entries))

    def test_nested_paths_and_special_types(self):
        for name, kind in [('../outside', tarfile.REGTYPE), ('/outside', tarfile.REGTYPE),
                           ('a/../../outside', tarfile.REGTYPE), ('a\\outside', tarfile.REGTYPE),
                           ('link', tarfile.SYMTYPE), ('hard', tarfile.LNKTYPE),
                           ('device', tarfile.CHRTYPE), ('fifo', tarfile.FIFOTYPE)]:
            with self.subTest(name=name, kind=kind):
                self.assert_refused(self.archive(secrets=[(name, b'x', kind)]))

    def test_caddy_is_also_checked(self):
        self.assert_refused(self.archive(caddy=[('link', b'', tarfile.SYMTYPE)]))

    def test_missing_and_invalid_secrets(self):
        for content in ([], [('db_app_password', b'x', tarfile.REGTYPE)],
                        [('db_app_password', b'', tarfile.REGTYPE), ('doc_master_key', b'bad', tarfile.REGTYPE)]):
            with self.subTest(content=content):
                self.assert_refused(self.archive(secrets=content))

    def test_oversized_metadata_and_pax_headers(self):
        # Un en-tête seul annonce une taille excessive : aucune allocation du contenu ne doit être tentée.
        for kind, size in ((tarfile.REGTYPE, 65 * 1024**3), (tarfile.XHDTYPE, 1024**3),
                           (tarfile.GNUTYPE_SPARSE, 1024**3)):
            member = tarfile.TarInfo('suivi.dump')
            member.type = kind
            member.size = size
            archive = self.root / 'too-large.tar'
            archive.write_bytes(member.tobuf(format=tarfile.GNU_FORMAT) + b'\0' * 1024)
            self.assert_refused(archive)

    def test_gnu_long_names_and_root_directory_remain_compatible(self):
        archive = self.archive(caddy=[('./', b'', tarfile.DIRTYPE),
                                      ('./certs/' + 'a' * 120 + '.crt', b'certificat-fictif', tarfile.REGTYPE)])
        result = self.run_restore(archive)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_nested_duplicates_and_excessive_depth(self):
        for entries in ([('duplicate', b'x', tarfile.REGTYPE)] * 2,
                        [('/'.join(['deep'] * 65), b'x', tarfile.REGTYPE)]):
            with self.subTest(entries=entries):
                self.assert_refused(self.archive(secrets=entries))

    def test_archive_produced_by_backup_script_is_compatible(self):
        secrets = self.root / 'data/secrets'
        (secrets / 'db_app_password').write_text('password-fictif')
        (secrets / 'doc_master_key').write_bytes(base64.b64encode(b'a' * 32))
        destination = self.root / 'archives'
        backup = subprocess.run(['bash', str(self.root / 'scripts/backup.sh'), str(destination)],
                                input='', text=True, capture_output=True, env=self.env, timeout=20)
        self.assertEqual(backup.returncode, 0, backup.stderr)
        archive = next(destination.glob('*.tar.enc'))
        self.events.unlink()
        result = self.run_restore(archive)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('SHA-256 vérifiée', result.stdout)
        self.assertFalse(self.events.exists())

    def test_confirmation_is_required(self):
        result = self.run_restore(self.archive(), False, confirmation='NON\n')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.events.exists())
        self.assertTrue((self.root / 'data/secrets/old').exists())

    def test_dump_catalog_is_checked_before_stop(self):
        result = self.run_restore(self.archive(), False, env={'TEST_BAD_DUMP': '1'})
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('"stop"', self.events.read_text())
        self.assertTrue((self.root / 'data/secrets/old').exists())

    def test_restore_copies_validated_data_and_purges_sessions(self):
        result = self.run_restore(self.archive(caddy=[('cert', b'cert-fictif', tarfile.REGTYPE)]), False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / 'restored.dump').read_bytes(), b'PGDMP-dump-fictif')
        self.assertEqual((self.root / 'data/secrets/db_app_password').read_text(), 'password-fictif')
        self.assertEqual((self.root / 'data/caddy/data/cert').read_bytes(), b'cert-fictif')
        self.assertIn('DELETE FROM public.sessions', self.events.read_text())
        self.assertTrue((self.root / 'data/etat/sauvegardes/derniere-restauration.json').exists())
        self.assertIn('Restauration terminée.', result.stdout)

    def test_old_secret_directories_and_links_are_replaced_without_following_links(self):
        outside = self.root / 'external'
        outside.mkdir()
        (outside / 'token').write_text('extérieur-inchange')
        (self.root / 'data/secrets/extra').symlink_to(outside, target_is_directory=True)
        entries = [('db_app_password', b'password-fictif', tarfile.REGTYPE),
                   ('doc_master_key', base64.b64encode(b'a' * 32), tarfile.REGTYPE),
                   ('extra/token', b'nouveau-secret-fictif', tarfile.REGTYPE)]
        result = self.run_restore(self.archive(secrets=entries), False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((outside / 'token').read_text(), 'extérieur-inchange')
        self.assertFalse((self.root / 'data/secrets/extra').is_symlink())
        self.assertEqual((self.root / 'data/secrets/extra/token').read_bytes(), b'nouveau-secret-fictif')

    def test_unavailable_postgres_has_bounded_wait_and_no_success(self):
        result = self.run_restore(self.archive(), False, env={'TEST_NO_PG': '1'})
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('Restauration terminée.', result.stdout)
        self.assertFalse((self.root / 'data/etat/sauvegardes/derniere-restauration.json').exists())

    def test_unhealthy_application_has_no_success_report(self):
        result = self.run_restore(self.archive(), False, env={'TEST_NO_HEALTH': '1'})
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / 'data/etat/sauvegardes/derniere-restauration.json').exists())

    def test_restore_respects_existing_backup_lock(self):
        archive = self.archive()
        lock = self.root / 'data/etat/sauvegarde.lock'
        result = subprocess.run(['flock', str(lock), 'bash', str(self.root / 'scripts/restore.sh'), str(archive)],
                                input='RESTAURER\n', text=True, capture_output=True, env=self.env, timeout=20)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.events.exists())
        self.assertTrue((self.root / 'data/secrets/old').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
