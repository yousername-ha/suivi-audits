# ADR 0061 — Mise à jour depuis l'interface renforcée (TOTP, fenêtre de maintenance, exécutant sans identifiants, reçu)

- Statut : acceptée
- Date : 2026-10-26
- Contexte : décisions du RSSI du 26/10/2026. La mise à jour reste **obligatoirement commandée depuis l'interface web**, de la
  manière la plus sûre possible, avec une page d'avancement. Le modèle existant est conservé : l'API n'exécute rien et écrit une
  demande auditée ; l'exécutant (`updater`) la prend, n'accepte que `{id, kind, target}`, vérifie la signature cosign des trois
  images avec l'identité exacte du workflow et de l'étiquette, épingle leurs empreintes, sauvegarde, migre, contrôle et revient
  en arrière en cas d'échec. Un compte administrateur compromis ne peut donc qu'installer une version publiée et signée.

## Décision

1. **Code de double authentification à l'installation.** `POST /api/admin/updates/install` exige un champ `code` (6 chiffres)
   vérifié par `Auth.checkTotp` : même secret et même anti-rejeu que la connexion (pas strictement croissant). Limite : cinq
   essais par compte et par quart d'heure (`updateMfaByUser`). Chaque refus est journalisé (`update.install.mfa_failed`). Le
   rôle et le créneau sont contrôlés **avant** le code, pour qu'un refus horaire ne consomme pas le code saisi.
2. **Pas de double validation.** Une approbation par un second administrateur a été écartée par décision.
3. **Fenêtre de maintenance.** Réglage `securite.fenetreMaintenance` (actif, jours ISO 1 à 7, début et fin `HH:MM`, heure de
   Paris), désactivé par défaut. Hors créneau, l'API refuse la demande (409, `outside_window`) et l'exécutant refuse la prise en
   charge d'une demande dont le créneau s'est refermé (`update.install.outside_window`). La vérification des publications reste
   permise. Un créneau dont la fin précède le début passe minuit et appartient au jour de son début. Fonction pure
   `dansFenetre` dans le paquet partagé, testée (heure d'été, minuit).
4. **Exécutant sans identifiants par défaut.** `/root/.ssh` et `/root/.docker` ne sont plus montés : à leur place, le dossier vide
   `DATA_DIR/updater-sans-identifiants` (créé par `init`). L'étiquette est récupérée par `origin`, sinon en HTTPS public ;
   l'intégrité ne dépend pas de la source, car la révision doit être celle portée par les images signées. Un dépôt ou un registre
   privé se déclare par `UPDATER_SSH_DIR` / `UPDATER_DOCKER_CONFIG` dans `.env`. `mettre-a-jour.sh` les ajoute une seule fois
   pour une installation qui en dépend encore (connexion `ghcr.io` présente, ou origine SSH avec dépôt illisible en HTTPS).
5. **Avancement horodaté.** L'état public (`status.json`) porte `etapes` (transitions de phase horodatées) et `finishedAt` ; la
   page `/update/` affiche l'heure de chaque étape, la durée écoulée puis totale, et le retour arrière quand il a lieu. L'état
   public ne contient aucune donnée sensible (testé).
6. **Reçu structuré.** À la fin de chaque installation, l'exécutant écrit `DATA_DIR/etat/recus-mises-a-jour/<id>.json`
   (schéma `UpdateReceipt`) : versions, statut, étapes, empreintes des images, identité de signature et révision vérifiées,
   nom et empreinte de la sauvegarde, résultats des contrôles avant et après. Aucune sortie brute de commande (elle peut contenir
   des données sensibles) : le journal brut reste dans `DATA_DIR/reprise-updates`, root seulement. L'API (lecture seule) liste
   et sert les reçus conformes au rôle Administrateur, en pièce jointe, chaque téléchargement étant journalisé. Le frontal ne
   les sert pas.

## Ce qui n'est pas fait

- `docker.sock` reste monté dans l'exécutant : il est indispensable pour recréer les conteneurs, et aucun filtrage du socket
  ne le rendrait réellement non privilégié. Le risque se maîtrise par l'absence de port et d'API de l'exécutant, les commandes
  fermées et la vérification des signatures.
- Le principal risque résiduel est la **chaîne de publication** : une version malveillante correctement signée passerait les
  contrôles. Son durcissement côté GitHub (étiquettes protégées, environnement de publication avec approbation, relecture
  obligatoire, clés matérielles) est documenté à part et attend la décision du RSSI.
- Pas de fuseau configurable pour la fenêtre (heure de Paris).
- Pas de transport du reçu vers un outil externe (GED, SIEM) : téléchargement manuel.

## Addendum du 17/11/2026 — exception ponctuelle, décision du RSSI

> **Remplacé par l'[ADR 0103](0103-frontal-mis-a-jour-a-la-demande.md)** (17/11/2026) : l'exception ponctuelle devient la règle
> générale, le frontal est mis à jour à la demande, d'après son empreinte, et la constante `FRONTAL_AVEC_LA_VERSION` est
> retirée. Le texte ci-dessous est conservé pour l'historique.

Le frontal stable (`gateway`) n'étant jamais recréé par une mise à jour web, la page de maintenance Neon (7.2.0) n'était pas
servie aux serveurs mis à jour depuis l'interface. Décision du RSSI : la mise à jour web **vers la 7.2.2, et elle seule**, met
aussi le frontal à jour ; une coupure de quelques secondes est acceptée ; le comportement antérieur revient ensuite.

- Constante unique `FRONTAL_AVEC_LA_VERSION` dans `scripts/update-worker.py` : pendant une mise à jour web, `mettre-a-jour.sh`
  est celui de la version installée ; seul l'exécutant de la cible, qui termine l'opération après son remplacement, exécute du
  code de la 7.2.2.
- Ordre : santé et contrôle des données de la nouvelle version réussis ; image `web` locale égale à l'image signée et épinglée ;
  configuration validée dans un conteneur éphémère (`demarrer-gateway --valider`, comme `fermer_acme`) ; certificat servi relevé ;
  `GATEWAY_VERSION` passée à la cible et frontal recréé, maintenance encore active ; il doit répondre (relais interne, `/healthz`
  en HTTPS) avec le même certificat ; puis levée de la maintenance. Les réglages TLS ne sont ni transmis ni modifiés : mêmes `.env`
  et volumes, donc même mode (ACME, fourni, interne).
- Échec : ancienne `GATEWAY_VERSION` et ancien frontal rétablis ; la mise à jour de l'application reste réussie, avec
  l'avertissement « Frontal non mis à jour » dans le message de fin, le reçu et le journal privé.
- Retrait à la version suivante : `scripts/tests/test_updates.py` échoue tant que la constante désigne une version antérieure à
  celle du dépôt.
