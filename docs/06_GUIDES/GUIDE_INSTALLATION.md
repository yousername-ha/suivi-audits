# Installation, développement et test de branche

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Référence unique : [INSTALLATION.md](../INSTALLATION.md), avec ses blocs bash
rejoués en CI. Le présent guide est une orientation ; il ne recopie ni ne
remplace toutes les étapes de préparation du serveur.

Neuf éléments à identifier : OS/prérequis, Docker Compose, accès au dépôt privé,
accès aux images GHCR, domaine/ports/TLS, dossier applicatif, .env, DATA_DIR
persistant et garde des clés. Valeurs de production non collectées ici.

## Nouvelle installation

Suivre les étapes 1–7 du guide : préparer accès/dépendances, récupérer la version,
configurer .env à partir de l’exemple une seule fois, choisir DATA_DIR hors code,
préparer données et démarrer. init crée exclusivement les secrets manquants.
Puis créer le premier administrateur avec le jeton à usage unique et configurer TOTP.
Le jeton est récupéré côté serveur, jamais ajouté à la documentation.

Depuis 3.0.2, les services gateway/updater et exploitation automatique font
partie de l’installation Compose ; pas de cron supplémentaire normal.

## Installation existante / branche de test

Conserver .env, DATA_DIR, secrets, certificats et clé des archives anciennes.
Avant une opération, sauvegarder selon le guide et connaître la version actuelle.
Pour une installation v2/volumes, suivre 12.4/12.5 ; ne pas appliquer aveuglément
une reconstruction v3 ni supprimer les anciens volumes.

Sur un serveur v3 de test déjà préparé, récupération de source :

```bash
git status --short --branch
git fetch origin
git switch feature/gpt6-evolution-smsi-grc
git pull --ff-only origin feature/gpt6-evolution-smsi-grc
```

Ces commandes nécessitent les droits du clone (sudo si ceux du guide).
Si Git signale des modifications, les préserver ; ne pas reset/clean.
Construire seulement après vérification des variables APP_VERSION/références
d’images et d’une fenêtre autorisée, comme INSTALLATION 7/12.0 :

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.build.yml build
sudo docker compose up -d --pull never
sudo docker compose ps -a
```

Ce bloc est une **procédure à exécuter sur le serveur autorisé**, NON EXÉCUTÉE
pendant l’audit. Références API_IMAGE/WEB_IMAGE/UPDATER_IMAGE épinglées et
GATEWAY_VERSION doivent être examinées : sinon le service peut continuer
d’utiliser une ancienne image. Ne pas tirer des images publiées sous local/test.
Le dernier lot CI c704fa6 ne requiert aucun redéploiement applicatif.

## Développement local

```bash
git status --short --branch
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @suivi/shared test
pnpm --filter @suivi/ui test
pnpm --filter @suivi/web test
node --test scripts/tests/publication.test.mjs
python3 -m unittest discover -s scripts/tests -p test_updates.py
```

Ces commandes supposent Node 24+, pnpm 10.34.6 et un clone de développement.
L’installation de dépendances accède aux registres externes ; elle n’a pas été
rejouée pendant l’audit, car les dépendances étaient présentes. Les tests API,
`pnpm test` et les recettes Docker demandent une base et un environnement
explicitement dédiés. Leur setup peut supprimer les bases `suivi_t_%` :
ne jamais les pointer vers une base partagée ou de production.

Puis `docker compose -f docker-compose.dev.yml up`, interface
`http://localhost:5173`. Dev est local, avec isolation différente de production
et sans tout le système de maintenance/exploitation. Tests API/E2E : voir
CONTRIBUTING et STRATEGIE_RECETTE, environnement dédié requis.
