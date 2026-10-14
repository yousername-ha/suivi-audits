"""Génère la liste lisible depuis le catalogue unique ; --check détecte une liste obsolète."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def render(data):
    labels = {'en-developpement': 'En développement', 'a-implementer': 'À implémenter', 'implementee': 'Implémentée'}
    lines = [
        '# Liste des fonctionnalités', '',
        'Numéros permanents : ils restent identiques lors du déplacement entre les trois étapes. Chaque lien ouvre le dossier propre à la fonctionnalité.', '',
        '| Numéro | Fonctionnalité | Description courte | Étape |',
        '| --- | --- | --- | --- |',
    ]
    for f in sorted(data['fonctionnalites'], key=lambda x: int(x['numero'])):
        title = f['titre'].replace('|', '\\|')
        description = f['description'].replace('|', '\\|').replace('\n', ' ')
        lines.append(f"| {f['numero']} | [{title}]({f['dossier']}/README.md) | {description} | {labels[f['etape']]} |")
    lines += ['', '[Règles de fonctionnement](docs/ORGANISATION-LEGACY.md) · [Catalogue source](docs/catalogue-fonctionnalites.json).', '',
              'Liste générée par `python scripts/generer_liste_fonctionnalites.py`. À actualiser après toute évolution du catalogue.', '']
    return '\n'.join(lines)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    expected = render(json.loads((ROOT / 'docs/catalogue-fonctionnalites.json').read_text()))
    dest = ROOT / 'LISTE-FONCTIONNALITES.md'
    if args.check:
        if not dest.is_file() or dest.read_text() != expected:
            raise SystemExit('Liste obsolète : exécuter python scripts/generer_liste_fonctionnalites.py')
        print('Liste numérotée synchronisée : OK.')
    else:
        dest.write_text(expected)
        print('LISTE-FONCTIONNALITES.md actualisée.')

if __name__ == '__main__':
    main()
