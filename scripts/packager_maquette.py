"""Construit le ZIP autonome de la version courante d'une fonctionnalité."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('fonctionnalite')
    args = parser.parse_args()
    catalogue = json.loads((ROOT / 'fonctionnalites/catalogue.json').read_text())
    feature = next((f for f in catalogue['fonctionnalites'] if f['id'] == args.fonctionnalite), None)
    if not feature or not feature.get('archive'):
        parser.error('Cette fonctionnalité ne dispose pas d’un prototype lançable déclaré.')
    source = (ROOT / feature['maquetteCourante']).resolve()
    if not source.is_relative_to((ROOT / 'fonctionnalites').resolve()):
        parser.error('La maquette doit rester dans fonctionnalites/.')
    for name in ('index.html', 'DEMARRER.bat'):
        if not (source / name).is_file():
            parser.error(f'Entrée manquante : {name}')
    output = (ROOT / feature['archive']).resolve()
    if output.parent != ROOT / 'downloads' or output.suffix != '.zip':
        parser.error('L’archive doit être un ZIP dans downloads/.')
    paths = sorted(p for p in source.rglob('*') if p.is_file())
    if any(p.is_symlink() or not p.resolve().is_relative_to(source) for p in paths):
        parser.error('Un fichier sort du périmètre de la maquette.')
    if any(any(part.startswith('.') or part in ('node_modules', '__pycache__') for part in p.relative_to(source).parts) for p in paths):
        parser.error('Un fichier caché ou de travail est présent dans la maquette.')
    manifest_file = source / 'technique/manifest.json'
    manifest_file.parent.mkdir(exist_ok=True)
    manifest = {'feature': feature['id'], 'version': source.name, 'files': {}}
    for path in paths:
        if path == manifest_file:
            continue
        data = path.read_bytes()
        manifest['files'][path.relative_to(source).as_posix()] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    paths = sorted(p for p in source.rglob('*') if p.is_file())
    output.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            archive.write(path, Path(output.stem) / path.relative_to(source))
    with zipfile.ZipFile(output) as archive:
        if archive.testzip():
            raise RuntimeError('Archive corrompue')
        for name, meta in manifest['files'].items():
            data = archive.read(f'{output.stem}/{name}')
            if hashlib.sha256(data).hexdigest() != meta['sha256']:
                raise RuntimeError(f'Empreinte incorrecte : {name}')
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.sha256').write_text(f'{digest}  {output.name}\n')
    print(f'{output.relative_to(ROOT)} : {output.stat().st_size} octets, empreintes vérifiées.')

if __name__ == '__main__':
    main()
