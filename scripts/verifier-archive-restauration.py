#!/usr/bin/env python3
"""A1b1 : contrôle et copie bornée des archives, sans extractall ni commande système."""
import base64
import hashlib
import gzip
import pathlib
import shutil
import sys
import tarfile

MAX_OUTER = 64 * 1024**3
MAX_NESTED = 512 * 1024**2
MAX_ENTRIES = 20000


def fail(message):
    raise ValueError(message)


class SafeInfo(tarfile.TarInfo):
    @classmethod
    def frombuf(cls, buf, encoding, errors):
        member = super().frombuf(buf, encoding, errors)
        # Les sauvegardes GNU/USTAR n’utilisent pas PAX. Refuser ses extensions avant allocation.
        if member.type in (tarfile.XHDTYPE, tarfile.XGLTYPE, tarfile.GNUTYPE_SPARSE, tarfile.GNUTYPE_LONGLINK):
            fail('Extension tar non autorisée.')
        if member.type == tarfile.GNUTYPE_LONGNAME and member.size > 4097:
            fail('Nom étendu excessif.')
        return member

    @classmethod
    def fromtarfile(cls, archive):
        archive.safe_headers = getattr(archive, 'safe_headers', 0) + 1
        if archive.safe_headers > MAX_ENTRIES:
            fail('Nombre d’en-têtes excessif.')
        return super().fromtarfile(archive)


class SafeReader:
    def __init__(self, incoming):
        self.incoming = incoming

    def read(self, size):
        if size < 0 or size > 1024**2:
            fail('Lecture de métadonnées excessive.')
        return self.incoming.read(size)

    def seek(self, *args):
        return self.incoming.seek(*args)

    def tell(self):
        return self.incoming.tell()


def name_of(member):
    name = member.name
    if member.isdir() and member.size != 0:
        fail('Dossier avec contenu interdit.')
    if name.startswith('./'):
        name = name[2:]
    if member.isdir() and name in ('', '.'):
        return None
    if member.isdir():
        name = name.rstrip('/')
    parts = name.split('/')
    if (not name or name.startswith('/') or '\\' in name or
            any(p in ('', '.', '..') for p in parts) or len(parts) > 64 or
            len(name.encode('utf-8')) > 4096 or
            any(ord(c) < 32 or ord(c) == 127 for c in name)):
        fail('Chemin d’archive interdit.')
    if not (member.isdir() or member.isreg()) or member.sparse is not None:
        fail('Liens, fichiers spéciaux et sparse interdits.')
    return name


def unpack(source, target, limit, allowed=None):
    target.mkdir(mode=0o700)
    seen = set()
    total = 0
    count = 0
    opener = gzip.open if source.name.endswith('.tgz') else open
    with opener(source, 'rb') as stream, tarfile.open(fileobj=SafeReader(stream), mode='r:', tarinfo=SafeInfo) as archive:
        for member in archive:
            count += 1
            if count > MAX_ENTRIES:
                fail('Nombre d’entrées excessif.')
            name = name_of(member)
            if name is None:
                continue
            if name in seen:
                fail('Entrée dupliquée.')
            seen.add(name)
            if allowed is not None and (name not in allowed or not member.isreg() or member.size > allowed[name]):
                fail('Contenu extérieur non autorisé.')
            if member.size < 0 or member.size > limit:
                fail('Taille d’entrée excessive.')
            total += member.size
            if total > limit:
                fail('Taille décompressée excessive.')
            if member.size > shutil.disk_usage(target).free - 8 * 1024**2:
                fail('Espace temporaire insuffisant.')
            destination = target.joinpath(*name.split('/'))
            destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            if member.isdir():
                destination.mkdir(mode=0o700, exist_ok=True)
                continue
            # Aucun lien n'est créé ; destination privée, exclusive et sans métadonnées restaurées.
            with archive.extractfile(member) as incoming, destination.open('xb') as outgoing:
                remaining = member.size
                while remaining:
                    block = incoming.read(min(1024**2, remaining))
                    if not block:
                        fail('Archive tronquée.')
                    outgoing.write(block)
                    remaining -= len(block)
            destination.chmod(0o600)
    return seen


def verify(source, destination):
    allowed = {'suivi.dump': MAX_OUTER, 'secrets.tgz': MAX_NESTED, 'INFO': 1024**2, 'caddy.tgz': MAX_NESTED}
    names = unpack(source, destination, MAX_OUTER, allowed)
    if not {'suivi.dump', 'secrets.tgz', 'INFO'} <= names:
        fail('Archive incomplète.')
    with (destination / 'suivi.dump').open('rb') as dump:
        if dump.read(5) != b'PGDMP':
            fail('Format du dump PostgreSQL incorrect.')
    info = destination / 'INFO'
    if info.stat().st_size > 1024**2:
        fail('Métadonnées excessives.')
    text = info.read_text(encoding='utf-8')
    if any(ord(c) < 32 and c not in '\n\t' for c in text) or '\x7f' in text:
        fail('Métadonnées invalides.')
    secrets = destination / 'secrets'
    unpack(destination / 'secrets.tgz', secrets, MAX_NESTED)
    password = secrets / 'db_app_password'
    key = secrets / 'doc_master_key'
    if not password.is_file() or not key.is_file():
        fail('Secrets indispensables absents.')
    if password.stat().st_size > 4096 or not password.read_text().strip():
        fail('Secret PostgreSQL invalide.')
    if key.stat().st_size > 4096 or len(base64.b64decode(key.read_text().strip(), validate=True)) != 32:
        fail('Clé des documents invalide.')
    if 'caddy.tgz' in names:
        unpack(destination / 'caddy.tgz', destination / 'caddy', MAX_NESTED)
    print('Structure et secrets de l’archive vérifiés.')


def checksum(original, snapshot):
    sidecar = pathlib.Path(str(original) + '.sha256')
    if not sidecar.exists():
        print('ATTENTION : empreinte absente ; authenticité non établie.', file=sys.stderr)
        return
    if sidecar.stat().st_size > 1024:
        fail('Fichier d’empreinte excessif.')
    line = sidecar.read_text(encoding='utf-8').rstrip('\n')
    if len(line) < 67 or line[64:66] not in ('  ', ' *') or line[66:] != original.name:
        fail('Fichier d’empreinte incohérent.')
    expected = line[:64]
    if any(c not in '0123456789abcdef' for c in expected):
        fail('Empreinte invalide.')
    with snapshot.open('rb') as archive:
        digest = hashlib.file_digest(archive, 'sha256').hexdigest()
    if digest != expected:
        fail('Empreinte incorrecte.')
    print('Empreinte SHA-256 vérifiée.')


if __name__ == '__main__':
    try:
        if len(sys.argv) == 4 and sys.argv[1] == '--checksum':
            checksum(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
        elif len(sys.argv) == 3:
            verify(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
        else:
            fail('Usage : verifier-archive-restauration.py archive.tar destination-neuve')
    except (ValueError, OSError, tarfile.TarError, EOFError, RecursionError):
        print('Archive refusée : structure, empreinte, secrets ou espace temporaire invalides.', file=sys.stderr)
        sys.exit(1)
