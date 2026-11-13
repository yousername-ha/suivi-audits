"""Vérification locale sans dépendance de l'archive de transmission (aucun service lancé)."""
import hashlib,json,re,struct,sys
from html.parser import HTMLParser
from pathlib import Path,PurePosixPath
from urllib.parse import unquote,urlsplit
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
manifest=json.loads((root/'MANIFESTE.json').read_text())
errors=[]
for entry in manifest['fichiers']:
 p=PurePosixPath(entry['path'])
 if p.is_absolute() or '..' in p.parts:errors.append('Chemin sortant : '+str(p));continue
 f=root/entry['path']
 if not f.is_file() or f.is_symlink():errors.append('Fichier absent/non régulier : '+str(p));continue
 data=f.read_bytes()
 if hashlib.sha256(data).hexdigest()!=entry['sha256']:errors.append('Empreinte incorrecte : '+str(p))
 if len(data)!=entry['octets']:errors.append('Taille incorrecte : '+str(p))
 if 'dimensionsPNG' in entry and list(struct.unpack('>II',data[16:24]))!=entry['dimensionsPNG']:errors.append('Dimensions incorrectes : '+str(p))
 if any(part in {'.git','node_modules','dist'} for part in p.parts) or p.name.startswith('.env'):errors.append('Fichier interdit : '+str(p))
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  for key,value in attrs:
   if key in {'src','href'} and value:self.links.append(value)
files=list(root.glob('*.md'))+list(root.glob('*.html'))
for f in files:
 text=f.read_text();links=re.findall(r'\]\(([^)\n]+)\)',text) if f.suffix=='.md' else []
 if f.suffix=='.html':
  parser=Links();parser.feed(text);links+=parser.links
 for link in links:
  url=urlsplit(link.strip('<>'))
  if url.scheme or url.netloc or not url.path or url.path.startswith('#'):continue
  target=(f.parent/unquote(url.path)).resolve()
  if not target.is_relative_to(root) or not target.exists():errors.append('Lien principal absent/sortant : '+f.name+' → '+link)
modules=json.loads((root/'annexes/MODULES.json').read_text())
for module in modules:
 for path in module['sources']+module['documents']+module['visuels']:
  if not (root/'reference'/path).exists():errors.append('Source de module absente : '+path)
if errors:
 print('\n'.join(errors));raise SystemExit(1)
print(json.dumps({'integrite':'OK','fichiersVerifies':len(manifest['fichiers']),'imagesPNG':manifest['imagesPNG'],'modules':len(modules),'liensPrincipaux':'OK','cibleAuditee':False},ensure_ascii=False))
