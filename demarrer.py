#!/usr/bin/env python3
"""Serveur statique local, sans API métier ni dépendance tierce."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse, functools, webbrowser

ROOT = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()

    def do_GET(self):
        if self.headers.get('Host', '').split(':')[0] not in ['127.0.0.1', 'localhost', '[::1]']:
            self.send_error(403, 'Accès local uniquement')
            return
        super().do_GET()

    def do_POST(self):
        self.send_error(405, 'Serveur statique — aucune écriture réseau')

def main():
    parser = argparse.ArgumentParser(description='Lancer la copie legacy locale CaRE / HAS')
    parser.add_argument('--port', type=int, default=8123)
    parser.add_argument('--sans-navigateur', action='store_true')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), functools.partial(Handler, directory=str(ROOT)))
    url = f'http://127.0.0.1:{args.port}'
    print(f'Pilotage legacy local : {url}\nLes données et pièces restent dans votre navigateur. Ctrl+C pour arrêter.', flush=True)
    if not args.sans_navigateur:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
