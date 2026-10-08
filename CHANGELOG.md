# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Numérotation : [versionnage sémantique](https://semver.org/lang/fr/) (`MAJEUR.MINEUR.CORRECTIF`). Chaque version publiée correspond à une étiquette `vX.Y.Z` et aux images `ghcr.io/yousername-ha/suivi-audits-api` et `suivi-audits-web` de même numéro.

## [Non publié]

### Notes de mise à jour
- **Les données quittent les volumes Docker pour le dossier du serveur `DATA_DIR`** (par défaut `/srv/suivi-audits/donnees`, EXPL-01). La mise à jour par `scripts/mettre-a-jour.sh` fait la copie toute seule, contrôle les données et **conserve les anciens volumes** jusqu'à `sudo ./scripts/migrer-donnees-vers-dossier.sh --supprimer-anciens-volumes`. Prévoir l'espace disque : deux fois la taille de la base.
- Première mise à jour avec le script (il n'existe pas encore dans la version en service) : `sudo git fetch --tags && sudo git show v<version>:scripts/mettre-a-jour.sh | sudo bash -s -- <version>` (`docs/INSTALLATION.md`, étape 12.1).
- Serveur v2 : suivre l'étape 12.4 du guide (copie des volumes par `scripts/migrer-donnees-vers-dossier.sh`).
- Faire inclure `DATA_DIR` **et** le dossier des sauvegardes dans la sauvegarde externalisée du serveur ; planifier `scripts/verifier-version.sh` (étape 11.3).
- `docker compose down -v` ne supprime plus aucune donnée. Pour tout effacer : section 14 du guide.
- Migrations de la base : `003_droits.sql`, `004_affichage_et_ecrans_muraux.sql`, `005_cartographie.sql` (au démarrage, sans action). Durée estimée : 5 minutes, plus la copie des données.
- Cartographie : nouveau module de droits « Cartographie du SMSI » (75 permissions au lieu de 70). Les rôles prédéfinis le reçoivent automatiquement ; les **rôles personnalisés ne l'ont pas** : cochez ses cases dans leur matrice si besoin. Les cartes dessinées avec le module bêta de l'ancien outil sont reprises automatiquement par la migration ; l'ancien outil les affiche ensuite en lecture seule.
- Cartographie, construire de zéro : aucune migration. Créer un objet depuis la carte exige aussi le droit « Créer et modifier » de son module (Pilotage, Fournisseurs ou Conformité) ; un onglet de l'outil historique ouvert pendant une création affiche le conflit habituel à son prochain enregistrement (recharger la page).

### Ajouté
- Audit, socle partagé (ADR 0015, lot 1 de la phase 1) : `@suivi/shared/audit` (modèle et libellés de l'outil historique, schémas zod des enregistrements et des corps d'API prévus) ; `AUD-05` pronostic (`analyze`), pire pronostic d'un créneau et exigences ciblées sans créneau en fonctions pures, testés en parité avec l'outil historique exécuté dans un bac à sable (jeu fictif, états aléatoires, tests de mutation) ; `AUD-09` règles des écarts (tâches et statut, clôture datée et signée, réouverture avec motif obligatoire, retards, tri du registre, identifiants `F01`…) ; `AUD-10` échéance d'une tâche (la sienne, sinon celle de l'écart) et indicateurs du plan d'actions. Aucun changement visible ni migration.
- Cartographie du SMSI (ADR 0013, `CARTO-01` à `CARTO-14`) :
  - `CARTO-01` module de droits `cartographie` ; Contributeur et Lecteur exportent les cartes ; lecture seule réelle ; objets d'un module non lisible jamais envoyés (« Objet non accessible ») ;
  - `CARTO-02` objets lus par adaptateur (état legacy recomposé, filtré selon les droits), relations métier dérivées ;
  - `CARTO-03` tables `maps` et `map_versions` (migration `005_cartographie.sql`), disposition validée (`MapLayoutSchema`) ;
  - `CARTO-04` API `/api/carto/*` avec `If-Match` et 412, temps réel et présence, journal d'audit ;
  - `CARTO-05` assistant de génération (vue contexte, vue processus, propositions de flux), confirmation au-delà de 80 objets, refus au-delà de 400 ; dispositions et génération en fonctions pures, testées en parité avec la bêta ;
  - `CARTO-06` canevas SVG sans dépendance (zoom, pincement, panoramique, aperçu, recherche, préréglages, filtres ISO 27001 et HDS, légende, chiffres clés, plein écran), jetons « carte » clair et sombre ;
  - `CARTO-07` mode édition (déplacer, cadres qui emportent leur contenu, redimensionner, flèches, relier, masquer, valider, retirer, annuler et rétablir sur 60 niveaux), conflit « Recharger / Écraser » ;
  - `CARTO-08` synchronisation (nouveaux objets, objets indisponibles), jamais d'ajout automatique ; `CARTO-09` ajout depuis la plateforme sans chevauchement ;
  - `CARTO-10` fiche détaillée (feuille basse au téléphone, colonne permanente au-delà de 2560 px) ; `CARTO-11` versions (20 au plus) ; `CARTO-12` nature des enjeux corrigeable ;
  - `CARTO-13` exports PNG, SVG, PDF A3 et JSON produits dans le navigateur, journalisés ;
  - `CARTO-14` reprise du module legacy `maps` (import, export et annulation à l'identique ; `/legacy` en lecture seule pour la cartographie).
- Cartographie : construire une carte de zéro (ADR 0016, `CARTO-15` à `CARTO-19`) :
  - `CARTO-15` créer depuis la carte une partie intéressée, un fournisseur, une application, un enjeu, un site, un système, un processus ou un sous-processus : l'objet est enregistré dans son module (mêmes champs et identifiants que l'outil historique), avec la permission de ce module en plus de `cartographie:modifier` ; les enjeux créés sur la carte sont rangés dans les réglages de la carte de contexte ;
  - `CARTO-16` menu contextuel (clic droit, appui long, Maj+F10) sur le fond, un objet, une relation ou une sélection ; sélection multiple (Maj+clic, lasso Maj+glisser) : aligner, répartir, grouper dans un cadre, retirer ;
  - `CARTO-17` palette en glisser-déposer (types créables, note, cadre, objets non placés), ou clic puis clic sur la carte ;
  - `CARTO-18` renommer depuis la carte (double-clic ou F2 en édition) : le nom change dans le module d'origine ;
  - `CARTO-19` notes et cadres libres propres à la carte, « Construire la carte » (SMSI dans le périmètre, ou trois bandes vides).
- Données sur le serveur et mises à jour (chantier 9 quinquies, ADR 0014) :
  - `EXPL-01` toutes les données dans `DATA_DIR` (montages bind avec propriétaires et droits, plus aucun volume nommé) ; le service `init` refuse un dossier non préparé, dans le dossier de l'application, dans un dossier système ou sur un système de fichiers non persistant ; `scripts/preparer-donnees.sh` ;
  - `EXPL-02` `scripts/migrer-donnees-vers-dossier.sh` : sauvegarde chiffrée des volumes, copie, contrôles (fichiers, tailles, enregistrements), démarrage ; idempotent ; anciens volumes conservés jusqu'à confirmation ;
  - `EXPL-03` `scripts/mettre-a-jour.sh` : contrôles, notes de mise à jour, sauvegarde chiffrée obligatoire, signature des images (cosign), migrations sous verrou, santé, retour arrière automatique avec restauration si la base a été migrée, rapport et journal d'audit ; mode `--verifier` ;
  - `EXPL-04` `GET /api/version`, `GET /api/health/ready` (appels locaux), commandes `suivi migrations`, `suivi controle-donnees`, `suivi consigner-mise-a-jour` ; test CI de montée de version avec retour arrière et restauration simulés ;
  - `EXPL-05` Administration > Système : version, historique des mises à jour, dernière sauvegarde (alerte au-delà de 48 h), emplacement des données et espace disque, nouvelle version disponible (`scripts/verifier-version.sh`, tâche planifiée ; rien n'est installé automatiquement) ;
  - `EXPL-07` page de chaque version publiée reprenant sa section du CHANGELOG, paragraphe « Notes de mise à jour » obligatoire (vérifié par la CI) ;
  - `EXPL-08` `backup.sh` et `restore.sh` sur `DATA_DIR` (autorité de certification interne comprise), rapports dans `DATA_DIR/etat/`.
- Gestion des droits (RBAC, chantier 9 bis, ADR 0010) :
  - permissions module × action, déclarées dans `packages/shared` ;
  - rôles prédéfinis (Administrateur, RSSI, Contributeur, Lecteur, Auditeur externe) et rôles personnalisés créés par duplication, avec une matrice éditable ;
  - groupes ; droits effectifs affichés avec leur origine ; expiration des comptes ;
  - export de la revue des accès en CSV et Excel (ISO 27001 A.5.18) ;
  - écrans Utilisateurs, Groupes et Rôles.
- Garde-fous :
  - au moins un administrateur permanent ;
  - interdiction de modifier ses propres droits ;
  - journal avant/après ;
  - coupure des sessions concernées ;
  - désactivation automatique des comptes expirés.
- Charte graphique unique (`packages/ui`, chantier 9 ter, ADR 0011) :
  - identité de l'outil historique ;
  - mode clair et mode sombre ;
  - contrastes WCAG AA vérifiés ;
  - composants communs ;
  - aucune valeur codée en dur dans l'interface (test).
- Page Paramètres pleine largeur :
  - huit sections (Général, Cycle d'audit, Référentiels, Apparence, Notifications, Import et export, Sauvegardes, Sécurité), chacune avec son enregistrement, son contrôle de version et son journal ;
  - politique de sécurité réglable dans des bornes non négociables ;
  - logo de l'organisation.
- Captures de référence Playwright (Paramètres et Administration, 3 largeurs, clair et sombre), produites dans le conteneur Playwright officiel.
- Adaptation à tous les écrans, du téléphone au 55 pouces 4K (chantier 9 quater, ADR 0012) :
  - menu en tiroir au téléphone, en icônes sur tablette, déplié sur ordinateur ; typographie fluide ;
  - tableau de bord en grille de cartes (synthèse des écarts, échéances, plan d'audit, mesures), qui ajoute des colonnes sur les grands écrans ;
  - documents : liste et fiche côte à côte à partir de 1440 px, troisième panneau (versions, rattachements) à partir de 2560 px ;
  - tableaux : colonnes secondaires selon la largeur, sélecteur de colonnes mémorisé ; formulaires longs sur 2 ou 3 colonnes ;
  - préférences « Taille d'affichage », « Densité » et thème, enregistrées sur le serveur (Mon compte > Affichage).
- Écran mural (`/mur`) : tableau de bord plein écran en temps réel, rotation entre vues, lecture seule ; appareils activés par un lien à usage unique (Administration > Écrans muraux), révocables.
- Captures de référence de 390 à 3840 px ; tests de largeur utilisée (2560 et 3840 px) et d'absence de défilement horizontal (390 px).
- Documentation : `docs/BACKLOG-FONCTIONNEL.md`, et feuille de route complétée (exigences `CRRC-01` à `CRRC-04`, `INV-01`, `INV-02`, `INC-01` à `INC-03`).

### Sécurité
- Limite de débit globale par adresse IP sur toutes les routes (`RATE_LIMIT_PER_MINUTE`, 1200 par défaut), appliquée avant toute lecture en base.

### Modifié
- `EXPL-06` : l'outil historique fait partie de l'image ; `scripts/update-ui.sh` est réservé au poste de développement.
- `docker-compose.dev.yml` : données de développement dans `./.donnees-dev` au lieu de volumes nommés.
- Migration `004_affichage_et_ecrans_muraux.sql` : préférences d'affichage par personne (`users.preferences`) et table `wall_screens`.
- Le choix de thème du bouton du menu est enregistré sur le serveur (et non plus dans le navigateur).
- Migration `003_droits.sql` : `admin` devient Administrateur, `rw` devient Contributeur, `ro` devient Lecteur. Un ancien compte « lecture et écriture » ne peut plus supprimer de document ni de lien : lui attribuer le rôle RSSI si nécessaire.
- L'outil historique filtre les modules selon les droits : les modules non lisibles sont masqués, et les modifications non autorisées sont refusées.

## [3.0.0] — Phase 0 : fondations

Nouvelle architecture. La mise à jour depuis la v2 conserve la base, les secrets et les certificats.

### Notes de mise à jour
- Depuis la v2 : `docs/INSTALLATION.md`, étape 12.4 (ajouter `APP_VERSION` dans `.env`, images publiées au lieu d'une construction sur le serveur, retrait du service `proxy`).

### Ajouté
- Monorepo TypeScript strict (pnpm) : API Fastify (`apps/api`), interface React + Vite + Mantine (`apps/web`), schémas zod partagés (`packages/shared`).
- Description OpenAPI 3.1 générée depuis les déclarations de routes (`/api/openapi.json`).
- Concurrence par enregistrement : colonne `version`, `ETag`, `If-Match` obligatoire (428), 412 seulement si l'enregistrement a changé.
- Temps réel : `/api/events` (SSE) alimenté par LISTEN/NOTIFY, filtré par rôle, avec reconnexion automatique ; indicateur de présence.
- Nouvelle interface : installation, connexion et double authentification, mon compte, administration (comptes, sessions, journal, versions, import, système), documents et liens.
- Import et export legacy : simulation sans écriture avec rapport téléchargeable, modes Initialiser, Fusionner et Remplacer un module, sauvegarde préalable, annulation, export au schéma 15. Contrat `LEGACY-FORMAT.md` couvert à 100 %, `MAPPING-LEGACY.md`.
- Outil historique : schéma 15 (identifiants stables sur 9 listes) et bouton « Exporter pour la nouvelle version ». Il est servi sous `/legacy`, avec l'état recomposé et le refus des écritures sur les modules repris.
- Images `suivi-audits-api` et `suivi-audits-web` publiées sur GHCR à chaque étiquette, signées avec cosign, avec un SBOM CycloneDX attesté.
- CI : ESLint, Prettier, typage, Vitest (PostgreSQL 17), Playwright, Trivy, SBOM, CodeQL. Le job « guide » rejoue le guide d'installation sur un runner vierge.
- Guide d'installation pour débutant (`docs/INSTALLATION.md`), architecture, feuille de route, ADR.
- `docker-compose.dev.yml` (rechargement à chaud) et `docker-compose.build.yml` (construction locale des images).

### Modifié
- Le frontal (`web`, ex-`proxy`) tourne sans privilège (uid 1001, ports internes 8080 et 8443) et sert l'interface. Le service `init` lui remet la propriété des volumes de certificats.
- Les commandes d'exploitation deviennent `docker compose exec app suivi <commande>` (au lieu de `node src/cli.js`). `docker compose exec app setup-token` est inchangé.
- Déploiement par images versionnées (`APP_VERSION` dans `.env`, `docker compose pull`) au lieu d'une construction sur le serveur.

### Sécurité
- Toutes les protections de la v2 sont conservées : TOTP obligatoire avec anti-rejeu, cookie `__Host-` SameSite=Strict, CSRF et contrôle d'origine, verrouillage, audit en ajout seul, AES-256-GCM, conteneurs en lecture seule avec `cap_drop: ALL`.
- La CSP de la nouvelle interface interdit tout script et tout style en ligne (vérifié par les tests de bout en bout).

## [2.0.0]

### Notes de mise à jour
- Première version Docker : aucune action.

- Déploiement Docker (Caddy, Node 24, PostgreSQL 17) de l'outil historique : authentification avec TOTP, jeton d'installation, documents chiffrés, journal d'audit, sauvegardes.
