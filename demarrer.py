#!/usr/bin/env python3
"""Lance le serveur Legacy local et son stockage protégé, sans dépendance externe."""
from pathlib import Path
from http.server import ThreadingHTTPServer
import argparse, functools, webbrowser
from legacy_server import Handler, Store

ROOT = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser(description='Lancer le pilotage Legacy local')
    parser.add_argument('--port', type=int, default=8123)
    parser.add_argument('--sans-navigateur', action='store_true')
    parser.add_argument('--donnees', type=Path, default=ROOT / '.legacy-data', help='Répertoire privé SQLite et pièces (ne pas publier)')
    args = parser.parse_args()
    Handler.store = Store(args.donnees)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), functools.partial(Handler, directory=str(ROOT)))
    url = f'http://127.0.0.1:{args.port}'
    print(f'Pilotage Legacy : {url}\nStockage privé sur ce serveur ; créer le compte administrateur à la première ouverture. Ctrl+C pour arrêter.', flush=True)
    if not args.sans_navigateur: webbrowser.open(url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == '__main__': main()
