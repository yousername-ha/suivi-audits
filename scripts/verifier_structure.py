"""Contrôle les références locales et les versions du catalogue de maquettes."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]

def main():
    errors = []
    data = json.loads((ROOT / 'fonctionnalites/catalogue.json').read_text())
    seen = set()
    for feature in data['fonctionnalites']:
        if feature['id'] in seen:
            errors.append(f'Identifiant dupliqué : {feature["id"]}')
        seen.add(feature['id'])
        version = ROOT / feature['maquetteCourante']
        for target in (version / 'README.md', version / 'version.json', ROOT / feature['tests'], ROOT / feature['dossierImplementation']):
            if not target.is_file():
                errors.append(f'Fichier manquant : {target.relative_to(ROOT)}')
        if (version / 'version.json').exists():
            info = json.loads((version / 'version.json').read_text())
            if info['id'] != version.name or info['statut'] != feature['statutMaquette']:
                errors.append(f'Version / statut incohérent : {feature["id"]}')
            for ref in info['references']:
                if not (ROOT / ref).exists():
                    errors.append(f'Référence manquante : {ref}')
        if feature.get('archive') and not (ROOT / feature['archive']).is_file():
            errors.append(f'Archive absente : {feature["id"]}')
    files = [ROOT / 'README.md', ROOT / 'docs/ORGANISATION-LEGACY.md']
    for folder in ('fonctionnalites', 'references', 'implementation', 'samples', 'downloads'):
        files.extend((ROOT / folder).rglob('*.md'))
    checked = 0
    for path in files:
        for link in re.findall(r'\]\(([^)]+)\)', path.read_text()):
            if '://' in link or link.startswith(('#', 'mailto:')):
                continue
            target = (path.parent / unquote(link.split('#')[0])).resolve()
            checked += 1
            if not target.exists():
                errors.append(f'{path.relative_to(ROOT)} : lien manquant {link}')
    common = ROOT / 'implementation/socle-astra'
    for name, digest in json.loads((common / 'MANIFESTE.json').read_text()).items():
        if hashlib.sha256((common / name).read_bytes()).hexdigest() != digest:
            errors.append(f'Manifeste du dossier commun obsolète : {name}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'{len(seen)} fonctionnalités, {checked} liens locaux, versions et manifeste commun : OK.')

if __name__ == '__main__':
    main()
