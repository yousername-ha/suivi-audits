"""Serveur de fichiers de test : aucune API, aucun accès aux données métier."""
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=5212)
args = parser.parse_args()
root = Path(__file__).resolve().parents[3] / 'apps/web/dist'
if not (root / 'index.html').is_file():
    raise SystemExit('Compiler apps/web avant de lancer la recette de présentation.')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *values, **kwargs):
        super().__init__(*values, directory=str(root), **kwargs)

    def do_GET(self):
        if self.path.startswith('/api/'):
            self.send_error(503, 'API absente de ce serveur de test')
            return
        if self.path.startswith('/update/'):
            self.send_response(200)
            self.end_headers()
            return
        if not (root / self.path.split('?')[0].lstrip('/')).is_file():
            self.path = '/index.html'
        super().do_GET()

    def log_message(self, *_args):
        pass

    def do_POST(self):
        self.send_error(503, 'Aucune ecriture autorisee sur ce serveur statique')

    do_PUT = do_PATCH = do_DELETE = do_POST

HTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
