"""Produit un HTML autonome, sans serveur, paquet tiers ni réseau requis."""
from pathlib import Path
p = Path(__file__).resolve().parent
content = (p.parent / 'v002-onboarding-sous-actions/contenu.js').read_text()
css = (p / 'style.css').read_text()
js = (p / 'app.js').read_text()
html = '''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>ASTRA · Parcours ISO / HDS · Maquette interactive</title><style>'''+css+'''</style></head><body><noscript>Activez JavaScript pour tester cette maquette.</noscript><div id="app"></div><dialog id="dialog" aria-labelledby="dialog-title"></dialog><div id="toast" class="toast" role="status" aria-live="polite" hidden></div><script>'''+content+'\n'+js+'''</script></body></html>'''
(p / 'index.html').write_text(html)
print('index.html autonome généré :', len(html.encode()), 'octets')
