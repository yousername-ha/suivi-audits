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
NOM = 'suivi-audits-20261009-120000.tar.age'


def cle_age(chemin):
    """Identité age fictive (0600) ; renvoie la clé publique correspondante."""
    subprocess.run(['age-keygen', '-o', str(chemin)], check=True, capture_output=True)
    chemin.chmod(0o600)
    return subprocess.run(['age-keygen', '-y', str(chemin)], check=True, capture_output=True, text=True).stdout.strip()


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
        for name in ('backup.sh', 'restore.sh', 'lib-commun.sh', 'verifier-archive-restauration.py', 'generer-cles-sauvegarde.sh'):
            shutil.copyfile(REPO / 'scripts' / name, self.root / 'scripts' / name)
        (self.root / '.env').write_text('DATA_DIR=' + str(self.root / 'data') + '\n')
        (self.root / 'data/.suivi-audits-donnees').touch()
        (self.root / 'data/secrets/old').write_text('ancien-secret-fictif')
        # Chiffrement age : identité du serveur + clé de secours du RSSI (clé privée gardée hors de BACKUP_RECIPIENTS_FILE).
        self.key = self.root / 'cle-serveur'
        self.secours_cle = self.root / 'cle-secours'
        self.publique = cle_age(self.key)
        self.publique_secours = cle_age(self.secours_cle)
        self.recipients = self.root / 'destinataires'
        self.recipients.write_text('# secours\n' + self.publique_secours + '\n')
        self.recipients.chmod(0o600)
        self.phrase = self.root / 'phrase'
        self.phrase.write_text('phrase-de-test-fictive')
        self.phrase.chmod(0o600)
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
                    'BACKUP_KEY_FILE': str(self.key), 'BACKUP_RECIPIENTS_FILE': str(self.recipients),
                    'RESTORE_WAIT_SECONDS': '1'}

    def chiffrer(self, clair, nom=NOM, destinataires=None):
        cible = self.root / nom
        args = ['age', '-o', str(cible)]
        for d in destinataires or (self.publique, self.publique_secours):
            args += ['-r', d]
        subprocess.run(args + [str(clair)], check=True, capture_output=True)
        return cible

    def archive(self, secrets=None, outer=None, caddy=None, nom=NOM, info=None, destinataires=None):
        if secrets is None:
            secrets = [('db_app_password', b'password-fictif', tarfile.REGTYPE),
                       ('doc_master_key', base64.b64encode(b'a' * 32), tarfile.REGTYPE)]
        contents = [('suivi.dump', b'PGDMP-dump-fictif', tarfile.REGTYPE),
                    ('INFO', info if info is not None else b'date=20261009-120000\nfichier=' + nom.encode() + b'\n', tarfile.REGTYPE),
                    ('secrets.tgz', tar_bytes(secrets, True), tarfile.REGTYPE)]
        if caddy is not None:
            contents.append(('caddy.tgz', tar_bytes(caddy, True), tarfile.REGTYPE))
        clair = self.root / 'clair.tar'
        clair.write_bytes(tar_bytes(contents if outer is None else outer))
        return self.chiffrer(clair, nom, destinataires)

    def run_restore(self, archive, verify=True, env=None, confirmation='RESTAURER\n', options=()):
        args = ['bash', str(self.root / 'scripts/restore.sh')]
        if verify:
            args.append('--verifier')
        args.extend(options)
        return subprocess.run(args + [str(archive)], input=confirmation, text=True, capture_output=True,
                              env={**self.env, **(env or {})}, timeout=20)

    def assert_refused(self, archive, env=None):
        result = self.run_restore(archive, False, env=env)
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
        encrypted = self.archive()
        digest = hashlib.sha256(encrypted.read_bytes()).hexdigest()
        pathlib.Path(str(encrypted) + '.sha256').write_text(digest + '  ' + encrypted.name + '\n')
        result = self.run_restore(encrypted)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('SHA-256 vérifiée', result.stdout)
        self.assertFalse(self.events.exists())
        # Une clé qui n'est pas destinataire de l'archive est refusée, sans aucun appel à Docker.
        cle_etrangere = self.root / 'cle-etrangere'
        cle_age(cle_etrangere)
        pathlib.Path(str(encrypted) + '.sha256').unlink()
        self.assert_refused(encrypted, env={'BACKUP_KEY_FILE': str(cle_etrangere)})

    def test_recovery_key_alone_decrypts_and_restores(self):
        archive = self.archive()
        env = {'BACKUP_KEY_FILE': str(self.secours_cle)}
        self.assertEqual(self.run_restore(archive, env=env).returncode, 0)
        result = self.run_restore(archive, False, env=env)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Restauration terminée.', result.stdout)

    def test_tampered_truncated_and_foreign_archives_are_refused_without_partial_restore(self):
        valide = self.archive()
        octets = bytearray(valide.read_bytes())
        for nom, contenu in (('un octet modifié', bytes(octets[:200]) + bytes([octets[200] ^ 1]) + bytes(octets[201:])),
                             ('dernier octet modifié', bytes(octets[:-1]) + bytes([octets[-1] ^ 1])),
                             ('tronquée', bytes(octets[:len(octets) // 2])),
                             ('tronquée de 16 octets', bytes(octets[:-16])),
                             ('vide', b''), ('contenu quelconque', b'pas une archive age')):
            with self.subTest(nom):
                altere = self.root / NOM
                altere.write_bytes(contenu)
                self.assert_refused(altere)
                self.events.unlink(missing_ok=True)
        with self.subTest('chiffrée pour d autres clés'):
            etrangere = self.root / 'etrangere'
            publique = cle_age(etrangere)
            self.assert_refused(self.archive(destinataires=(publique,)))

    def test_renamed_or_replayed_archive_is_refused(self):
        valide = self.archive()
        for nom in ('suivi-audits-20261010-130000.tar.age', 'suivi-audits-20261009-120000-0b0e3b6c-5b2a-4f0e-9c1d-2a7a5f6d8e11.tar.age',
                    'autre-20261009-120000.tar.age', 'renommee.tar.age'):
            with self.subTest(nom):
                copie = self.root / 'copies' / nom
                copie.parent.mkdir(exist_ok=True)
                shutil.copyfile(valide, copie)
                self.assert_refused(copie)
                self.events.unlink(missing_ok=True)

    def test_info_binds_job_id_and_timestamp(self):
        job = '0b0e3b6c-5b2a-4f0e-9c1d-2a7a5f6d8e11'
        nom = f'suivi-audits-20261009-120000-{job}.tar.age'
        ok = self.archive(nom=nom, info=f'date=20261009-120000\nfichier={nom}\njob_id={job}\n'.encode())
        self.assertEqual(self.run_restore(ok).returncode, 0)
        autre = '9a8b7c6d-1111-4222-8333-444455556666'
        faux = self.archive(nom=nom, info=f'date=20261009-120000\nfichier={nom}\njob_id={autre}\n'.encode())
        self.assert_refused(faux)
        sans = self.archive(nom=nom, info=f'date=20261009-120000\nfichier={nom}\n'.encode())
        self.assert_refused(sans)
        ancien = self.archive(info=b'date=20261009\n')
        self.assert_refused(ancien)

    def test_plain_archive_and_old_format_are_refused(self):
        clair = self.root / 'suivi-audits-20261009-120000.tar'
        clair.write_bytes(tar_bytes([('suivi.dump', b'PGDMP-dump-fictif', tarfile.REGTYPE)]))
        self.assert_refused(clair)
        valide = self.archive()
        # L'option de l'ancien format n'existe plus (6.0.0, installation neuve uniquement).
        self.assertNotEqual(self.run_restore(valide, options=['--ancien-format']).returncode, 0)
        # Archive .tar.enc de la 5.x : refusée avec un message explicite, sans appeler Docker.
        ancien = self.root / 'suivi-audits-20261009-120000.tar.enc'
        subprocess.run(['openssl', 'enc', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-salt', '-in', str(self.root / 'clair.tar'),
                        '-out', str(ancien), '-pass', 'file:' + str(self.phrase)], check=True)
        for verifier in (True, False):
            refus = self.run_restore(ancien, verify=verifier)
            self.assertNotEqual(refus.returncode, 0)
            self.assertIn('non prise en charge depuis la 6.0.0', refus.stderr + refus.stdout)
        self.assertFalse(self.events.exists())

    def test_decryption_key_with_wide_permissions_is_refused(self):
        archive = self.archive()
        self.key.chmod(0o644)
        self.assert_refused(archive)

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
            clair = self.root / 'too-large.tar'
            clair.write_bytes(member.tobuf(format=tarfile.GNU_FORMAT) + b'\0' * 1024)
            self.assert_refused(self.chiffrer(clair))

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

    def sauvegarder(self, destination, env=None):
        secrets = self.root / 'data/secrets'
        (secrets / 'db_app_password').write_text('password-fictif')
        (secrets / 'doc_master_key').write_bytes(base64.b64encode(b'a' * 32))
        return subprocess.run(['bash', str(self.root / 'scripts/backup.sh'), str(destination)],
                              input='', text=True, capture_output=True, env={**self.env, **(env or {})}, timeout=20)

    def test_archive_produced_by_backup_script_is_compatible(self):
        destination = self.root / 'archives'
        backup = self.sauvegarder(destination)
        self.assertEqual(backup.returncode, 0, backup.stderr)
        archive = next(destination.glob('*.tar.age'))
        self.assertEqual(sorted(f.suffix for f in destination.iterdir()), ['.age', '.sha256'])
        # Illisible sans clé : ce n'est pas une archive tar, et rien n'est resté en clair.
        self.assertNotEqual(subprocess.run(['tar', 'tf', str(archive)], capture_output=True).returncode, 0)
        self.assertFalse(list(destination.glob('*.tar')))
        self.events.unlink()
        result = self.run_restore(archive)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('SHA-256 vérifiée', result.stdout)
        self.assertFalse(self.events.exists())
        # La clé de secours seule suffit, comme la clé du serveur.
        self.assertEqual(self.run_restore(archive, env={'BACKUP_KEY_FILE': str(self.secours_cle)}).returncode, 0)
        # L'INFO lie le contenu au nom du fichier.
        clair = subprocess.run(['age', '-d', '-i', str(self.key), str(archive)], capture_output=True, check=True).stdout
        with tarfile.open(fileobj=io.BytesIO(clair)) as t:
            info = t.extractfile('INFO').read().decode()
        self.assertIn('fichier=' + archive.name, info)
        self.assertIn('date=' + archive.name.split('-', 2)[2].removesuffix('.tar.age'), info)

    def test_backup_refuses_without_valid_keys_and_leaves_no_plaintext(self):
        absent = self.root / 'absente'
        large = self.root / 'cle-large'
        shutil.copyfile(self.key, large)
        large.chmod(0o644)
        invalide = self.root / 'cle-invalide'
        invalide.write_text('pas une identité age\n')
        invalide.chmod(0o600)
        vide = self.root / 'destinataires-vides'
        vide.write_text('# rien\n')
        privee = self.root / 'destinataires-prives'
        privee.write_text(self.secours_cle.read_text())
        cas = {'clé absente': {'BACKUP_KEY_FILE': str(absent)}, 'clé 0644': {'BACKUP_KEY_FILE': str(large)},
               'clé invalide': {'BACKUP_KEY_FILE': str(invalide)}, 'destinataires absents': {'BACKUP_RECIPIENTS_FILE': str(absent)},
               'aucun destinataire': {'BACKUP_RECIPIENTS_FILE': str(vide)},
               'clé privée en destinataire': {'BACKUP_RECIPIENTS_FILE': str(privee)}}
        for nom, env in cas.items():
            with self.subTest(nom):
                destination = self.root / 'archives'
                resultat = self.sauvegarder(destination, env)
                self.assertNotEqual(resultat.returncode, 0)
                self.assertEqual(sorted(destination.glob('*')) if destination.exists() else [], [])
                self.assertFalse(self.events.exists(), 'aucune sauvegarde ne doit démarrer')

    def sauvegarde_avec_anciennes(self, nombre, env=None, prefixe='suivi-audits', age_min=100):
        secrets = self.root / 'data/secrets'
        (secrets / 'db_app_password').write_text('password-fictif')
        (secrets / 'doc_master_key').write_bytes(base64.b64encode(b'a' * 32))
        destination = self.root / 'archives'
        destination.mkdir(exist_ok=True)
        for i in range(nombre):
            archive = destination / f'{prefixe}-202601{i + 1:02d}-000000.tar.age'
            archive.write_bytes(b'ancienne-archive-fictive')
            (destination / f'{archive.name}.sha256').write_text('0' * 64 + f'  {archive.name}\n')
            age = (age_min + nombre - i) * 86400
            for fichier in (archive, destination / f'{archive.name}.sha256'):
                os.utime(fichier, (fichier.stat().st_atime, fichier.stat().st_mtime - age))
        resultat = subprocess.run(['bash', str(self.root / 'scripts/backup.sh'), str(destination)], input='', text=True,
                                  capture_output=True, env={**self.env, **(env or {})}, timeout=20)
        return destination, resultat

    def test_rotation_keeps_the_newest_archives_even_when_all_are_expired(self):
        destination, resultat = self.sauvegarde_avec_anciennes(10, {'RETENTION_DAYS': '1', 'BACKUP_GARDER_MIN': '7'})
        self.assertEqual(resultat.returncode, 0, resultat.stderr)
        restantes = sorted(f.name for f in destination.glob('*.tar.age'))
        self.assertEqual(len(restantes), 7)
        # La nouvelle sauvegarde et les six plus récentes anciennes restent ; les trois plus anciennes sont supprimées.
        for i in range(4, 10):
            self.assertIn(f'suivi-audits-202601{i + 1:02d}-000000.tar.age', restantes)
        for i in range(0, 4):
            self.assertNotIn(f'suivi-audits-202601{i + 1:02d}-000000.tar.age', restantes)
            self.assertFalse((destination / f'suivi-audits-202601{i + 1:02d}-000000.tar.age.sha256').exists())
        for nom in restantes:
            self.assertTrue((destination / f'{nom}.sha256').exists())

    def test_rotation_keeps_recent_archives_beyond_the_minimum(self):
        destination, resultat = self.sauvegarde_avec_anciennes(10, {'RETENTION_DAYS': '90'}, age_min=1)
        self.assertEqual(resultat.returncode, 0, resultat.stderr)
        self.assertEqual(len(list(destination.glob('*.tar.age'))), 11)

    def test_rotation_removes_expired_archives_beyond_the_minimum(self):
        # Âges de 2 à 11 jours, rétention de 5 jours : au-delà des 3 plus récentes, seules les archives de plus de 5 jours
        # partent ; restent la nouvelle (0 jour) et celles de 2, 3, 4 et 5 jours.
        destination, resultat = self.sauvegarde_avec_anciennes(10, {'RETENTION_DAYS': '5', 'BACKUP_GARDER_MIN': '3'}, age_min=1)
        self.assertEqual(resultat.returncode, 0, resultat.stderr)
        self.assertEqual(len(list(destination.glob('*.tar.age'))), 5)

    def test_rotation_leaves_old_format_archives_to_the_operator(self):
        # Archives d'anciennes versions dans un catalogue réutilisé (.tar.enc de la 5.x, .tar en clair) : illisibles par cette
        # version (ADR 0077), jamais supprimées.
        destination = self.root / 'archives'
        destination.mkdir()
        anciennes = [destination / 'suivi-audits-20250101-000000.tar.enc', destination / 'suivi-audits-20250102-000000.tar']
        for ancienne in anciennes:
            ancienne.write_bytes(b'ancienne-archive-fictive')
            os.utime(ancienne, (ancienne.stat().st_atime, ancienne.stat().st_mtime - 400 * 86400))
        destination, resultat = self.sauvegarde_avec_anciennes(10, {'RETENTION_DAYS': '1', 'BACKUP_GARDER_MIN': '3'})
        self.assertEqual(resultat.returncode, 0, resultat.stderr)
        self.assertEqual(len(list(destination.glob('*.tar.age'))), 3)
        for ancienne in anciennes:
            self.assertTrue(ancienne.exists())

    def test_rotation_keeps_everything_when_few_archives_exist(self):
        destination, resultat = self.sauvegarde_avec_anciennes(3, {'RETENTION_DAYS': '1'})
        self.assertEqual(resultat.returncode, 0, resultat.stderr)
        self.assertEqual(len(list(destination.glob('*.tar.age'))), 4)

    def test_rotation_ignores_other_prefixes_and_subfolders(self):
        destination = self.root / 'archives'
        (destination / 'avant-maj').mkdir(parents=True)
        voisins = [destination / 'autre-20200101-000000.tar.age', destination / 'avant-maj/suivi-audits-20200101-000000.tar.age']
        for fichier in voisins:
            fichier.write_bytes(b'x')
            os.utime(fichier, (1, 1))
        destination, resultat = self.sauvegarde_avec_anciennes(2, {'RETENTION_DAYS': '1', 'BACKUP_GARDER_MIN': '1'})
        self.assertEqual(resultat.returncode, 0, resultat.stderr)
        self.assertEqual(len(list(destination.glob('suivi-audits-*.tar.age'))), 1)
        for fichier in voisins:
            self.assertTrue(fichier.exists(), fichier)

    def test_minimum_count_is_validated(self):
        for valeur in ('0', '366', 'x', '-1', '7; echo'):
            with self.subTest(valeur=valeur):
                destination, resultat = self.sauvegarde_avec_anciennes(0, {'BACKUP_GARDER_MIN': valeur})
                self.assertNotEqual(resultat.returncode, 0)
                self.assertIn('BACKUP_GARDER_MIN', resultat.stderr + resultat.stdout)
                self.assertEqual(list(destination.glob('*.tar.age')), [])

    def generer(self, *args, env=None):
        return subprocess.run(['bash', str(self.root / 'scripts/generer-cles-sauvegarde.sh'), *args], input='', text=True,
                              capture_output=True, env={**self.env, **(env or {})}, timeout=20)

    def test_key_generation_creates_private_server_key_and_a_working_setup(self):
        cle, secours = self.root / 'nouvelle-cle', self.root / 'nouveaux-destinataires'
        env = {'BACKUP_KEY_FILE': str(cle), 'BACKUP_RECIPIENTS_FILE': str(secours)}
        resultat = self.generer('--secours', self.publique_secours, '--confirmer', env=env)
        self.assertEqual(resultat.returncode, 0, resultat.stderr)
        self.assertEqual(cle.stat().st_mode & 0o777, 0o600)
        self.assertEqual(secours.stat().st_mode & 0o777, 0o600)
        self.assertNotIn('AGE-SECRET-KEY', resultat.stdout + resultat.stderr)
        self.assertNotIn(cle.read_text().splitlines()[-1], resultat.stdout + resultat.stderr)
        self.assertIn(self.publique_secours, secours.read_text())
        # La configuration produite permet une sauvegarde, relisible par la clé du serveur comme par la clé de secours.
        destination = self.root / 'archives'
        self.assertEqual(self.sauvegarder(destination, env).returncode, 0)
        archive = next(destination.glob('*.tar.age'))
        self.assertEqual(self.run_restore(archive, env=env).returncode, 0)
        self.assertEqual(self.run_restore(archive, env={'BACKUP_KEY_FILE': str(self.secours_cle)}).returncode, 0)
        # Relancer ne remplace jamais la clé existante.
        avant = cle.read_text()
        self.assertEqual(self.generer('--secours', self.publique_secours, '--confirmer', env=env).returncode, 0)
        self.assertEqual(cle.read_text(), avant)

    def test_key_generation_refuses_private_keys_unconfirmed_and_invalid_existing_key(self):
        cle, secours = self.root / 'nouvelle-cle', self.root / 'nouveaux-destinataires'
        env = {'BACKUP_KEY_FILE': str(cle), 'BACKUP_RECIPIENTS_FILE': str(secours)}
        privee = self.secours_cle.read_text().splitlines()[-1]
        for argument in (privee, 'age1court', 'n importe quoi'):
            with self.subTest(argument[:12]):
                resultat = self.generer('--secours', argument, '--confirmer', env=env)
                self.assertNotEqual(resultat.returncode, 0)
                self.assertNotIn(privee, resultat.stdout + resultat.stderr)
                self.assertFalse(secours.exists())
        # Sans confirmation explicite ni terminal, rien n'est enregistré.
        self.assertNotEqual(self.generer('--secours', self.publique_secours, env=env).returncode, 0)
        self.assertFalse(secours.exists())
        # Un fichier existant qui n'est pas une identité age n'est ni écrasé ni remplacé.
        cle.write_text('configuration existante')
        self.assertNotEqual(self.generer('--secours', self.publique_secours, '--confirmer', env=env).returncode, 0)
        self.assertEqual(cle.read_text(), 'configuration existante')

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

    def test_health_is_checked_even_if_the_second_changes_before_the_first_round(self):
        # Horloge simulée : la seconde change juste après le calcul de la limite (délai de 1 s).
        tick = self.root / 'tick'
        script = ('source "$1/scripts/lib-commun.sh"; dc() { :; }; '
                  'date() { n=$(cat "$TICK" 2>/dev/null || echo 0); echo $((n + 1)) > "$TICK"; echo $((100 + (n > 0))); }; '
                  'attendre_sante 1')
        result = subprocess.run(['bash', '-c', script, 'bash', str(self.root)],
                                capture_output=True, text=True, env={**self.env, 'TICK': str(tick)}, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)

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
