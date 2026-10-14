# Vérifications reproductibles du dossier

- `python verification/verifier_dossier.py` : dépendance Python `jsonschema`, contrôle de contrats et annexes.
- `node verification/verifier_maquette.cjs` : Playwright et Chromium, port localhost 18769 disponible ; option `CHROMIUM_EXECUTABLE`. Génère les captures et `navigateur.json`, puis ferme le serveur local.

Exécuter depuis le dossier extrait. Ces contrôles ne lancent pas l’application legacy et ne valident pas ses migrations ou sa sécurité métier. Les images ne contiennent que des données fictives/constats structurels. Le BAT Windows est fourni pour ouvrir la galerie, sans test natif Windows ici.
