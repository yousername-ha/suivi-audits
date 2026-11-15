"""Contrôle documentaire autonome, Python standard ; aucune application démarrée."""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'MANIFESTE.json').read_text())
errors = []
listed = set()

for entry in manifest['fichiers']:
    rel = PurePosixPath(entry['path'])
    listed.add(str(rel))
    path = ROOT / rel
    if rel.is_absolute() or '..' in rel.parts:
        errors.append('Chemin sortant : ' + str(rel))
        continue
    if path.is_symlink() or not path.is_file():
        errors.append('Absent ou non régulier : ' + str(rel))
        continue
    data = path.read_bytes()
    if len(data) != entry['octets'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
        errors.append('Taille ou empreinte incorrecte : ' + str(rel))
    if any(x in {'.git', 'node_modules', '__pycache__'} for x in rel.parts) or rel.name.startswith('.env'):
        errors.append('Fichier interdit : ' + str(rel))

actual = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file()}
if actual != listed | {'MANIFESTE.json'}:
    errors.append('Fichiers hors manifeste ou absents : ' + str(sorted(actual ^ (listed | {'MANIFESTE.json'}))))

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {'src', 'href'} and value:
                self.links.append(value)

link_count = 0
for path in ROOT.rglob('*'):
    if not path.is_file() or path.suffix not in {'.md', '.html', '.css'}:
        continue
    if 'existant-2026-11-15' in path.parts:
        continue  # Instantanés de code, pas des documents ou assets de la maquette.
    content = path.read_text()
    links = []
    if path.suffix == '.md':
        links = re.findall(r'\]\(([^)\n]+)\)', content)
    if path.suffix == '.html':
        parser = Links()
        parser.feed(content)
        links.extend(parser.links)
    if path.suffix == '.css':
        links.extend(x.strip('"\' ') for x in re.findall(r'url\(([^)]+)\)', content))
    for link in links:
        url = urlsplit(link.strip('<>'))
        if url.scheme or url.netloc:
            if 'maquette' in path.parts:
                errors.append('Asset externe de maquette : ' + link)
            continue
        if not url.path:
            continue
        target = (path.parent / unquote(url.path)).resolve()
        link_count += 1
        if not target.is_relative_to(ROOT) or not target.exists():
            errors.append('Lien absent ou sortant : ' + str(path.relative_to(ROOT)) + ' → ' + link)

sources = json.loads((ROOT/'annexes/PROVENANCE-MAQUETTE-ET-VISUELS.json').read_text())
for item in sources:
    p = ROOT / item['destination']
    if hashlib.sha256(p.read_bytes()).hexdigest() != item['sha256Livraison']:
        errors.append('Provenance divergente : ' + item['destination'])
    if item['transformation'] == 'Aucune' and item['sha256Source'] != item['sha256Livraison']:
        errors.append('Copie altérée : ' + item['destination'])

audit = json.loads((ROOT/'annexes/SNAPSHOTS-GITHUB.json').read_text())
for item in audit:
    data = (ROOT/item['destination']).read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if blob != item['blobGit'] or hashlib.sha256(data).hexdigest() != item['sha256']:
        errors.append('Instantané GitHub altéré : ' + item['destination'])

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(json.dumps({'integrite':'OK','fichiersVerifies':len(listed),'liensDocumentairesEtAssets':link_count,
    'imagesOriginales':len(manifest['visuels']),'snapshotsGitHub':len(audit),
    'codeApplicatifTeste':False}, ensure_ascii=False))
