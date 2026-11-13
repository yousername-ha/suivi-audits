"""Fige le rendu déjà compilé de la carte ; embarque uniquement CSS, fontes et SVG."""
from pathlib import Path
import re,base64,sys
folder=Path(__file__).resolve().parent
root=folder.parents[3]/'apps/web/dist'
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/workspace/work/cartographie-habillage')
for vue,name in [('processus','index.html'),('contexte','contexte.html')]:
 original=source/(vue+'.html')
 html=(original if original.exists() else folder/name).read_text()
 html=re.sub(r'<style id="habillage-propose">.*?</style>','',html,flags=re.S)
 html=re.sub(r'<aside class="preview-switch".*?</aside>','',html,flags=re.S)
 html=re.sub(r' data-habillage="[^"]*"','',html,count=1)
 html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
 html=re.sub(r'<link\b(?=[^>]*(?:rel="(?:modulepreload|icon)"))[^>]*>','',html)
 def stylesheet(m):
  href=re.search(r'href="([^"]+)"',m[0])[1];path=root/href.lstrip('/');css=path.read_text()
  def asset(m):
   value=m[1].strip('"\' ')
   if value.startswith(('data:','http:','https:','#')):return m[0]
   p=(root/value.lstrip('/')) if value.startswith('/') else path.parent/value
   if p.is_file():
    mime='font/woff2' if p.suffix=='.woff2' else 'image/svg+xml'
    return 'url(data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()+')'
   raise ValueError('Asset manquant: '+str(p))
  return '<style data-source="application-compilee">'+re.sub(r'url\(([^)]+)\)',asset,css)+'</style>'
 html=re.sub(r'<link\b(?=[^>]*rel="stylesheet")[^>]*>',stylesheet,html)
 html=html.replace('<html ','<html data-habillage="on" ',1)
 html=html.replace('</head>','<style id="habillage-propose">'+(folder/'habillage.css').read_text()+'</style></head>')
 controls='<aside class="preview-switch" aria-label="Comparer les habillages"><span>Aperçu d’habillage · '+vue+'</span><button type="button" data-skin="off" aria-pressed="false">Original</button><button type="button" data-skin="on" aria-pressed="true">Harmonisé</button><button type="button" data-theme-toggle>Mode clair</button></aside>'
 html=html.replace('</body>',controls+'<script>'+(folder/'apercu.js').read_text()+'</script></body>')
 html=re.sub(r'<title>.*?</title>','<title>Cartographie actuelle — aperçu de l’habillage</title>',html)
 html=re.sub(r'(?m)^[ \t]+$','',html)
 (folder/name).write_text(html)
 print(name,len(html.encode()))
