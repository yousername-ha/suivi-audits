#!/usr/bin/env python3
"""Package complet prêt à lancer, construit uniquement depuis la branche autorisée."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BRANCH = 'legacy'
BASE = '4bcdf60c629b50466aa40f1a98d67346a4641359'
MANIFEST = 'MANIFESTE-LIVRAISON.json'


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args]).decode().strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--update-manifest', action='store_true')
    args = parser.parse_args()
    branch = git('branch', '--show-current')
    if branch != BRANCH:
        raise SystemExit(f'Branche refusée : {branch!r}; attendu : {BRANCH}')
    files = git('ls-files', '-z').split('\0')
    forbidden = ('.git/', '.legacy-data/', 'node_modules/', 'apps/', 'packages/')
    if any(p.startswith(forbidden) or p.endswith(('.sqlite3', '.pyc')) for p in files):
        raise SystemExit('Un fichier non distribuable est suivi. Vérifier la liste.')
    content = {p: (ROOT / p).read_bytes() for p in files if p and p != MANIFEST}
    for required in ('index.html','demarrer.py','demarrer.bat','demarrer.sh',
                     'legacy_server.py','modules/astra-ui.js','modules/astra.css'):
        if required not in content:
            raise SystemExit('Fichier indispensable absent : ' + required)
    manifest = {
        'version': '3.0.1-astra-local',
        'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'branch': branch,
        'baseCommit': BASE,
        'sourceCommit': git('rev-parse', 'HEAD'),
        'workingTreeChanges': bool(git('status', '--porcelain', '--untracked-files=no')),
        'runtime': 'Python >= 3.10 ; HTML/CSS/JavaScript et bibliothèques locales',
        'entryPoints': ['demarrer.bat','demarrer.sh','demarrer.py'],
        'manifestExcludesItself': True,
        'files': [{'path': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
                  for name, data in sorted(content.items())],
    }
    raw = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    if args.update_manifest:
        (ROOT / MANIFEST).write_bytes(raw)
    content[MANIFEST] = raw
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(content.items()):
            archive.writestr('Application-GRC-legacy-refonte/' + name, data)
    with zipfile.ZipFile(args.output) as archive:
        assert archive.testzip() is None
        for f in manifest['files']:
            actual = archive.read('Application-GRC-legacy-refonte/' + f['path'])
            assert hashlib.sha256(actual).hexdigest() == f['sha256'], f['path']
    print(json.dumps({'archive': str(args.output), 'files': len(content),
                      'bytes': args.output.stat().st_size,
                      'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest()}, indent=2))


if __name__ == '__main__':
    main()
