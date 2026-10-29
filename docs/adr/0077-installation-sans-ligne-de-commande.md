# ADR 0077 — Installation sans ligne de commande

- Statut : acceptée (étapes 1 et 2 réalisées : clés de sauvegarde, commande d'installation et adresse du site ; étape 3 à venir)
- Date : 2026-10-29
- Contexte : décision du RSSI du 29/10/2026. Le guide d'installation compte des dizaines de commandes (paquets, clés `age`,
  `.env` à éditer, préparation du dossier des données, jeton lu dans les journaux, cosign…). Règle retenue : **aucune ligne
  de commande** au-delà de l'installation de Docker et de la récupération du dépôt git ; tout le reste se fait dans le
  navigateur. La version 6.0.0 s'installe sur un serveur neuf : **aucune migration depuis la 5.x** n'est assurée (décision
  du RSSI du 29/10/2026).

## Décision

1. **Parcours cible.** Sur le serveur : installer Docker et git, puis
   `git clone … /opt/suivi-audits && sudo /opt/suivi-audits/installer.sh`. Cette commande unique (étape 2) vérifie les
   prérequis (Docker, heure synchronisée, ports 80 et 443 libres), prépare la configuration et le dossier des données,
   démarre la pile et affiche **l'adresse à ouvrir et le jeton d'installation**. Tout le reste se fait dans l'assistant
   web : adresse du site (étape 2), poivre, clé de secours des sauvegardes, compte administrateur, double authentification.
2. **Jeton d'installation conservé.** Il prouve la maîtrise du serveur : sans lui, le premier navigateur venu créerait
   l'administrateur. Il est affiché par la commande d'installation au lieu d'être lu dans les journaux.
3. **Clés de sauvegarde (étape 1, réalisée).** L'ADR 0071 reste la référence (format age `.tar.age`, deux destinataires
   par archive, chiffrement obligatoire, scripts `backup.sh` et `restore.sh`) ; seules changent la façon d'obtenir les clés,
   désormais sans commande, et leur emplacement par défaut. Des clés déjà créées dans `/root` ne sont plus lues par défaut
   (installation neuve en 6.0.0) ; `BACKUP_KEY_FILE` et `BACKUP_RECIPIENTS_FILE` permettent encore de les indiquer aux
   scripts lancés sur l'hôte.
   - Emplacement par défaut : `DATA_DIR/cles-sauvegarde/` (root, 0700), déjà monté dans l'exécutant ; les montages de
     `/root/.suivi-backup-key` et `/root/.suivi-backup-recipients` sont retirés de `docker-compose.yml`.
   - **Clé du serveur** (`serveur.key`, 0600) : créée par l'exécutant des sauvegardes (conteneur `updater`, qui contient
     `age`) à son premier passage si elle manque, jamais écrasée ni affichée.
   - **Clé de secours** : paire X25519 au format age générée **dans le navigateur** (WebCrypto, encodage bech32 écrit dans
     `@suivi/shared`, testé contre `age-keygen`, sans dépendance). La clé privée est téléchargée ou copiée vers le coffre-fort
     de l'organisation ; la personne coche le rangement et recopie ses 8 derniers caractères (contrôlés dans le
     navigateur). Seule la **clé publique** est envoyée : avec le compte à l'installation, puis depuis Administration,
     Sauvegardes (droit « administrer », code de double authentification, 5 essais par heure).
   - L'application l'enregistre (`settings`, `sauvegarde:cle-secours`) ; l'exécutant la relit (`suivi backup-secours`) et
     l'écrit dans `secours.pub` (0600). Une réponse vide ou invalide ne remplace jamais le fichier en place ; l'API n'a
     aucun accès en écriture aux fichiers de clés.
   - **Sans clé de secours, aucune sauvegarde** (règle de l'ADR 0071) : l'exécutant le signale et un bandeau rouge invite
     les administrateurs à la définir.
   - Les scripts du serveur (`backup.sh`, `restore.sh`, `generer-cles-sauvegarde.sh`…) gardent les mêmes clés par défaut ;
     ce dernier reste une voie d'expert (clé publique générée hors navigateur).
4. **Commande d'installation et adresse du site (étape 2, réalisée).**
   - `installer.sh` (racine du dépôt, root) refuse de continuer si Docker ou Compose manque, si un autre service occupe
     les ports, et signale une heure non synchronisée. Sans `.env`, il le crée depuis `.env.example` (0600) : nom du site =
     nom complet du serveur, sinon sa première adresse IPv4 ; `SITE_ADDRESS_EXTRA` = ses autres noms et adresses IPv4 (sans
     les passerelles des réseaux Docker), plus `localhost`. Un `.env` existant n'est jamais modifié.
   - Le frontal sert `SITE_ADDRESS` et, **avec le certificat interne seulement**, `SITE_ADDRESS_EXTRA` : l'assistant
     s'ouvre par l'adresse IP avant que le nom DNS existe. Un navigateur n'annonce aucun nom (SNI) pour une adresse IP :
     `default_sni` désigne alors la première adresse IPv4 servie. ACME et un certificat fourni ne couvrent que le nom du
     site.
   - L'assistant propose l'adresse du navigateur (modifiable). Si elle diffère de l'adresse en service, l'application
     l'enregistre (`settings`, `site:adresse`) ; l'exécutant d'exploitation (ADR 0050) la relit (`suivi site-adresse`),
     la revalide, écrit `SITE_ADDRESS` dans `.env` (l'ancienne passe dans `SITE_ADDRESS_EXTRA`) et recrée `app` et
     `gateway`. Ensuite, Administration, Certificats (droit « administrer », code de double authentification).
   - Le jeton est affiché par la commande (`docker compose exec app setup-token`) ; les messages de l'application
     renvoient vers `sudo ./installer.sh`.
5. **Documentation et recette (étape 3).** Guide d'installation réécrit autour de ce parcours ; le job CI qui rejoue le
   guide suit les mêmes étapes ; notes de la 6.0.0 réécrites (installation neuve).

## Conséquences

- Plus d'`age`, de `cosign`, d'éditeur de texte ni de commande de jeton pour installer (hors voies d'expert) ; `age` reste utile sur l'hôte pour
  les scripts d'expert et la restauration manuelle.
- La clé de secours est générée par une page servie par le serveur : il faut faire confiance à ce serveur au moment de la
  génération. À l'installation, il est neuf ; ensuite, `generer-cles-sauvegarde.sh --secours` permet de fournir une clé
  générée ailleurs.
- Remplacer la clé de secours ne protège que les sauvegardes suivantes : les archives déjà faites restent lisibles avec
  l'ancienne clé, à conserver tant qu'elles existent.
- La clé du serveur ne figure pas dans les archives ; sa perte n'empêche pas la restauration avec la clé de secours.

## Alternatives écartées

- *Supprimer le jeton d'installation* : le premier venu sur le réseau pourrait prendre la main sur l'application.
- *Clé de secours collée depuis `age-keygen`* : exige l'outil sur le poste ; conservé seulement comme voie d'expert.
- *Sauvegardes chiffrées pour la seule clé du serveur tant que la clé de secours manque* : archives illisibles si le
  serveur est perdu ; contraire à l'ADR 0071.
