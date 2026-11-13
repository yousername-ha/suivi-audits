"""Assemble l'aperçu autonome de la seule maquette, avec sa police locale."""
import base64
import re
import sys
from pathlib import Path

folder = Path(__file__).resolve().parent
output = Path(sys.argv[1]) if len(sys.argv) > 1 else folder / 'apercu-autonome.html'
html = (folder / 'index.html').read_text(encoding='utf-8')


def stylesheet(match):
    href = re.search(r'href="([^"]+)"', match[0])[1]
    source = (folder / href).resolve()
    css = source.read_text(encoding='utf-8')

    def font_url(url):
        value = url[1].strip('"\' ')
        if value.startswith(('data:', 'http:', 'https:', '#')):
            return url[0]
        asset = (source.parent / value).resolve()
        if asset.suffix == '.woff2' and asset.is_file():
            encoded = base64.b64encode(asset.read_bytes()).decode()
            return 'url(data:font/woff2;base64,' + encoded + ')'
        return url[0]

    return '<style>\n' + re.sub(r'url\(([^)]+)\)', font_url, css) + '\n</style>'


html = re.sub(r'<link\s+rel="stylesheet"[^>]*>', stylesheet, html)
html = re.sub(
    r'<script\s+src="([^"]+)"\s*></script>',
    lambda match: '<script>\n' + (folder / match[1]).read_text(encoding='utf-8').replace('</script', '<\\/script') + '\n</script>',
    html,
)
output.write_text(html, encoding='utf-8')
print(f'{output.name} : {len(html.encode())} octets')
