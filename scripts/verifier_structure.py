"""Contrôle les références locales et les versions du catalogue de maquettes."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]

def main():
    errors = []
    data = json.loads((ROOT / 'docs/catalogue-fonctionnalites.json').read_text())
    seen = set()
    for feature in data['fonctionnalites']:
        if feature['id'] in seen:
            errors.append(f'Identifiant dupliqué : {feature["id"]}')
        seen.add(feature['id'])
        stages = {'en-developpement': 'fonctionnalites-en-developpement', 'a-implementer': 'fonctionnalites-a-implementer', 'implementee': 'fonctionnalites-implementees'}
        stage = feature.get('etape')
        expected = stages.get(stage, '') + '/' + feature['id']
        if stage not in stages or feature.get('dossier') != expected:
            errors.append(f'Étape / dossier incohérent : {feature["id"]}')
        for field in ('maquetteCourante', 'tests', 'dossierImplementation', 'suivi'):
            if not feature.get(field, '').startswith(expected + '/'):
                errors.append(f'Chemin hors dossier : {feature["id"]} / {field}')
        follow = ROOT / feature.get('suivi', '__absent__')
        if not follow.is_file():
            errors.append(f'Suivi absent : {feature["id"]}')
        else:
            state = json.loads(follow.read_text())
            if state.get('etape') != stage or state.get('fonctionnalite') != feature['id']:
                errors.append(f'Suivi incohérent : {feature["id"]}')
            if stage in ('a-implementer', 'implementee'):
                if not state.get('validationUtilisateur') or not state.get('livraisonImplementation'):
                    errors.append(f'Validation ou dossier final absent : {feature["id"]}')
            if stage == 'implementee' and not state.get('integration'):
                errors.append(f'Preuve d’intégration absente : {feature["id"]}')
        locations = [folder for folder in stages.values() if (ROOT / folder / feature['id']).exists()]
        if locations != [stages.get(stage)]:
            errors.append(f'Dossier absent ou présent dans plusieurs étapes : {feature["id"]}')

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
    for folder in ('fonctionnalites-en-developpement', 'fonctionnalites-a-implementer', 'fonctionnalites-implementees', 'references', 'samples', 'downloads'):
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
    common = ROOT / 'fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra'
    for name, digest in json.loads((common / 'MANIFESTE.json').read_text()).items():
        if hashlib.sha256((common / name).read_bytes()).hexdigest() != digest:
            errors.append(f'Manifeste du dossier commun obsolète : {name}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'{len(seen)} fonctionnalités, {checked} liens locaux, versions et manifeste commun : OK.')

if __name__ == '__main__':
    main()
