# Évaluation de la refonte « Verre » (branche `refonte-verre` seulement)

Décision du RSSI du 26/11/2026 : la branche `refonte-verre` reste une copie de `main` (fusion automatique à chaque
publication dans `main`, workflow `synchroniser-refonte-verre.yml`), plus la refonte graphique, et s'évalue **sans page de
connexion**.

```powershell
docker compose -f docker-compose.verre.yml up --build
```

Ouvrir ensuite <http://localhost:5173>. Le premier démarrage prend quelques minutes : création d'un compte administrateur
fictif (`recette`, par la commande `recette-locale`), chargement du jeu de démonstration, style d'instance « Verre ». Les
démarrages suivants reprennent les mêmes données (dossier `.donnees-verre`). Pour repartir de zéro :
`docker compose -f docker-compose.verre.yml down`, puis supprimer le dossier `.donnees-verre`.

## Fonctionnement

- Le code du poste est copié, à chaque démarrage, dans un volume Linux de la pile (`verre-code`), et les dépendances sont
  installées dans des volumes Docker : sous Windows, le dossier partagé ignore la casse (`Alertes.ts` y désigne
  `alertes.ts`) et les liens de pnpm n'y sont pas fiables. Après un `git pull`, relancer la pile pour reprendre le code.

- L'application n'est pas modifiée. La « porte » (`porte.ts`) ouvre une session ordinaire (table `sessions`) pour le
  compte fictif et relaie l'interface en ajoutant son témoin à chaque requête ; la déconnexion est neutralisée.
- Garde-fous : adresse du site `localhost` et témoins non sécurisés exigés, refus si un autre administrateur existe,
  seule la porte est publiée, sur `127.0.0.1`. L'API et l'interface restent internes à la pile (sans la porte : 401).
- Pile jetable, réservée au poste du RSSI : ne jamais la déployer sur un serveur. `docker-compose.verre.yml` et ce
  dossier ne se reportent jamais dans `claude-suivi-smsi` ni `main` : les lots de la refonte y passent sans eux.
