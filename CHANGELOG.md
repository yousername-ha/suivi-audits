# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Numérotation : [versionnage sémantique](https://semver.org/lang/fr/) (`MAJEUR.MINEUR.CORRECTIF`). Chaque version publiée correspond à une étiquette `vX.Y.Z` et aux images `ghcr.io/yousername-ha/suivi-audits-api` et `suivi-audits-web` de même numéro.

## [Non publié]

### Notes de mise à jour
- **Migration SQL 021** (catalogue de configuration, additive, appliquée automatiquement au démarrage) ; aucune donnée existante n’est modifiée.
- **Aucune autre action sur le serveur.**

### Ajouté
- **Catalogue de configuration GRC transversal** ([ADR 0038](docs/adr/0038-socle-de-configuration-grc-transversal.md), analyse dans [docs/refonte-grc](docs/refonte-grc/README.md)) : échelles, matrices, correspondances, critères et taxonomies **versionnés** (versions immuables, aperçu avec étude d'impact, publication confirmée avec motif, usages enregistrés, variantes dérivées, archivage), API `/api/config-grc/*`, droits existants réutilisés, **vide à l'installation** ; le lot « pertinence EBIOS RM » (ressources × motivation) peut être adopté à la demande, à valider. **Migration SQL 021** (additive). Les écrans d'administration arrivent dans un lot suivant.
- **Méthodes de risque épinglées au catalogue** : une méthode peut épingler des échelles et une matrice (`bindings`) ; la version publiée embarque la copie résolue, les méthodes existantes ne changent pas. Une méthode épinglée n'est pas relisible par une version antérieure de l'application.
- **Écrans de configuration GRC** : Paramètres → Configuration GRC et Gestion des risques → Configuration des analyses (mêmes données) : liste filtrée, création guidée, éditeurs sans JSON (niveaux décrits, grille de matrice, correspondances, critères, catégories), simulation avec étude d'impact, publication confirmée avec motif, versions, dépendances, variantes, archivage, adoption d'un modèle.
- **Atelier 2 EBIOS RM sur le catalogue** : l'étude épingle une matrice de pertinence (version précise, usage « analyse » enregistré) ; le couple source de risque / objectif visé choisit ses niveaux sur les échelles de la matrice et reçoit la pertinence **proposée**, que l'analyste retient ou corrige en la justifiant. Une étude sans matrice garde l'échelle d'origine.

## [3.2.0] — 2026-10-14

### Notes de mise à jour
- **PostgreSQL 17 → 18 : migration automatique de la base** ([ADR 0035](docs/adr/0035-postgresql-18-migration-automatique.md)). Pendant la mise à jour (script ou menu Système), après la sauvegarde chiffrée obligatoire, l'application est arrêtée, la base est exportée avec le moteur 17, recréée en PostgreSQL 18 dans `DATA_DIR/postgres18`, restaurée, puis contrôlée (nombres de lignes identiques table par table). Durée : quelques minutes, proportionnelle à la taille de la base. Espace libre nécessaire : deux fois la base plus 512 Mo. **L'ancienne base n'est jamais modifiée** : en cas d'échec, la version précédente redémarre dessus. Après avoir vérifié l'application, libérer la place : `sudo ./scripts/nettoyer-ancienne-base-postgresql.sh`. Ne pas lancer `docker compose up` directement avant la mise à jour : le démarrage est refusé tant que la base n'est pas migrée.
- **Node 24 → 26** dans les images : aucune action sur le serveur.
- Aucune migration SQL.
- **Aucune action sur le serveur** pour les nouveautés ci-dessous ; la commande `suivi jeu-de-test` n'est jamais lancée par une mise à jour.

### Corrigé
- **Cartographie des risques : plus d'écran gris.** La zone de la carte n'avait pas de repère de positionnement et recouvrait toute la fenêtre ; elle reste dans son cadre (test de non-régression).
- Parties intéressées : le champ « exigences » est relu et écrit sous le bon nom de l'outil de suivi (`req`).

### Modifié
- **Menu** : une seule section dépliée à la fois (groupes du Pilotage, « Outil de suivi (ancienne interface) » et ses groupes) ; **pastilles collées aux libellés**, rouges quand un indicateur est mauvais (indicateur non atteint, échéance dépassée), neutres pour un simple volume à traiter (rapprochements, risques sans décision) ; lignes alignées à gauche.
- **Police globale réduite d'environ 6 %** (14 à 16 px selon la largeur, au lieu de 15 à 17) ; le choix de taille d'affichage de chaque personne s'applique par-dessus.
- **Objectifs et indicateurs : interface de l'ancienne version reprise** ([ADR 0036](docs/adr/0036-objectifs-boites-contexte-et-revue-de-direction.md)) : vues « Par processus », « Par objectif » et « Vue compacte », ajout de processus, d'objectifs et d'indicateurs, fiches, mesures (taux en %, Oui/Non), tendance, source de la valeur, légende et filtre d'état.
- **Fournisseurs** : colonnes Type, SSO, MFA, Critique, Hébergeur HDS, Certificats, Contrôles et Prochain, indicateurs MFA/SSO des services SaaS, bouton **Filtres** (sans MFA, contrôles à faire, certificats à traiter, critiques, type), modification en ligne et **fiche** (certificats, contrôles périodiques, contrôles types) ; les états sont ceux de l'outil de suivi.
- Listes du Pilotage (registres) : bouton **Filtres** (état, responsable, échéance, origine).
- Bibliothèque de référentiels : les **standards** de l'outil de suivi sont disponibles d'emblée (un geste, sans motif ni alerte rouge, y compris depuis le rattachement d'un périmètre) en **version source verrouillée** ; pour personnaliser un standard (par exemple l'ISO 27001) et ajouter des exigences ou des mesures, on **crée une copie** ([ADR 0037](docs/adr/0037-standards-verrouilles-jeu-de-test-et-relations.md)). « Nouvelle version » devient « Nouvelle édition » (import explicite).

### Ajouté
- **Lots M5 à M8 du module qualité** ([ADR 0036](docs/adr/0036-objectifs-boites-contexte-et-revue-de-direction.md)) : fiche processus (ISO 9001:2015, 4.4.1 a à h), champs de surveillance et de mesure des indicateurs (9.1.1) et catégorie « satisfaction du client » (9.1.2), planification des objectifs (6.2.2), tous facultatifs et vides par défaut ; **boîtes de pilotage** par processus ; **calque « santé des indicateurs »** sur la cartographie et filtre ISO 9001 quand un référentiel 9001 est rattaché ; **PESTEL** des enjeux externes ; objet **Opportunité** (6.1) ; **séries récurrentes proposées** sans fréquence ; **entrées de la revue de direction** (9.3.2) préparées à partir des données, sorties (9.3.3) ; **audit combiné** (référentiels audités).
- **Jeu de données de test** fictif et cohérent : `docker compose exec app suivi jeu-de-test <administrateur> --confirmer` (instance de test vide uniquement, par l'API publique).
- **Contrôle des relations** : `suivi controle-relations` (et clé `relations` de `controle-donnees`) vérifie les références logiques (état historique, liens, méthodes, référentiels, critères) ; la mise à jour signale les anomalies apparues pendant son déroulement. La migration PostgreSQL 17 → 18 compare aussi les contraintes (clés étrangères, uniques, contrôles) avant et après.
- Archive visuelle de l'ancienne interface : [docs/archive/ancienne-interface](docs/archive/ancienne-interface/README.md) (inventaire, correspondance avec le nouveau, captures).

## [3.1.1] — 2026-10-13

### Notes de mise à jour
- **Quatre migrations additives**, appliquées automatiquement au démarrage après la sauvegarde habituelle, sans action sur le serveur : `017_perimetres_nature.sql` (colonne `nature` des périmètres, vide par défaut), `018_bibliotheque_referentiels.sql` (tables de la bibliothèque de référentiels), `019_correspondances_rapprochements.sql` (correspondances entre exigences, leur historique immuable et les propositions de rapprochement) et `020_fournisseurs_organisation.sql` (critères, évaluations immuables et rattachements des fournisseurs ; aucune table existante n'est modifiée). Les périmètres et les référentiels existants sont inchangés.
- Aucune autre migration. **Apparence** : l'identité « Référence 08 » est appliquée à l'application principale ([ADR 0034](docs/adr/0034-apparence-reference-08.md)) ; le style global (sauge par défaut, clair bleuté) se règle dans Paramètres > Apparence et s'applique à tous les comptes, sans migration. Les contrastes de couleur sont renforcés (badges et boutons pleins, textes des variantes légères, onglet actif en mode sombre, liens toujours soulignés) : les sept écarts visuels connus du test d'accessibilité sont résolus. Pour la signature de l'organisation dans l'en-tête, renseigner le nom (et le site en https) dans Paramètres > Général. Durée de la mise à jour : quelques minutes.

### Modifié
- Sécurité des dépendances : Vitest 3.2.7 → 4.1.11 (outil de test, développement seulement : failles « tinypool » critiques et « @vitest/mocker » modérée) et fflate 0.8.2 → 0.8.3 (lecture et écriture des classeurs dans l'interface : boucle infinie possible sur une archive ZIP64 malformée). `pnpm audit` ne signale plus aucune faille.
- Accessibilité (WCAG 2.1 AA), défauts relevés par le contrôle automatique axe-core : contraste du texte sur les fonds d'état (rouge, orange, jaune, vert, sarcelle, bleu) et sur l'onglet actif en mode sombre ; liens toujours soulignés (distinction autrement que par la couleur) ; lien d'accueil nommé sur téléphone ; tableaux à défilement horizontal atteignables au clavier et annoncés comme régions.

### Ajouté
- **Bibliothèque de référentiels de l'organisation** ([ADR 0031](docs/adr/0031-bibliotheque-de-referentiels.md), lot M2) : un référentiel s'importe **une fois**, hors périmètre, par versions immuables (simulation, motif, publication), puis se **rattache** à une version précise dans chaque périmètre (activation, changement de version explicite, détachement refusé tant que le périmètre en référence les exigences). Les références `requirement:` d'un référentiel rattaché se résolvent comme celles d'un référentiel de périmètre et sont proposées à la recherche de liens. **Promotion** explicite, simulée avant application, d'un référentiel publié dans un périmètre (copie ; l'original et les liens aux mesures restent dans le périmètre). Les référentiels déjà publiés dans un périmètre continuent de fonctionner sans changement. API : `/api/library/frameworks`, `/api/grc/{smsi}/framework-attachments`, `/api/grc/{smsi}/frameworks/{id}/promotion`.
- **Fournisseurs de l'organisation** ([ADR 0032](docs/adr/0032-fournisseurs-de-l-organisation.md), lot M4) : rubrique « Fournisseurs » du Pilotage. Registre = celui de l'outil de suivi (sans copie, ajout possible) ; **critères d'évaluation définis par l'organisme** (aucun fourni, ni note ni seuil ; usages de l'ISO 9001:2015 8.4.1 ; exigences visées de la bibliothèque ; versions et historique immuable) ; **évaluations immuables indépendantes des périmètres** (répond / ne répond pas / non évalué, libellé et version du critère figés, réévaluation facultative) ; **rattachement à plusieurs périmètres** sans copie de l'évaluation ; lecture par périmètre (rattachés, évalués, non évalués, à réévaluer). API : `/api/suppliers`, `/api/suppliers/criteria`, `/api/suppliers/{id}/evaluations`, `/api/grc/{smsi}/suppliers`. **Suite donnée à une évaluation** : « Donner suite » dans l'historique crée une action ou une série de réévaluation dans le périmètre choisi, liée au fournisseur (`POST /api/suppliers/{id}/evaluations/{evaluationId}/follow-up`) ; aucune fréquence par défaut. La référence `legacy:suppliers:<id>` est liable depuis tout périmètre.
- **Référentiels de l'outil de suivi dans la bibliothèque** ([ADR 0033](docs/adr/0033-import-referentiels-outil-de-suivi.md)) : « Importer depuis l'outil de suivi » (Bibliothèque, droit `conformite:modifier`) simule puis importe, un par un et après confirmation `IMPORTER`, ISO/IEC 27001:2022 (33 clauses + 93 mesures de l'Annexe A), HDS (31 exigences) et le ReCyF (152 exigences, 20 objectifs) déjà présents dans l'état de l'outil. Intitulés ou textes saisis seulement ; source `unverified`, jamais normative ; intitulés HDS tronqués signalés ; correspondances et auto-évaluations non reprises. API : `GET` et `POST /api/library/tracker-import`. Aucune migration, aucune donnée de départ ajoutée.
- **Apparence « Référence 08 »** ([ADR 0034](docs/adr/0034-apparence-reference-08.md)) : style global de l'instance (Paramètres > Apparence : « Référence 08 — Sauge » par défaut ou « Clair bleuté », pour tous les comptes, indépendant du thème clair/sombre personnel ; aperçu local puis enregistrement) ; signature de l'organisation dans l'en-tête et lien « Site » (https seulement) sur le tableau de bord ; icône et filet turquoise de l'entrée de menu active ; filets turquoise sous les titres de cartes. **Matrice des risques** : cases pleines de la couleur exacte du niveau de la méthode publiée, nombre et références cliquables, sélection et panneau « Risques sélectionnés · N », impact décroissant et probabilité croissante, texte au contraste vérifié. Aucune migration (`apparence.style` vaut `sage` s'il est absent) ; `GET /api/auth/me` expose `appearance.style` et `orgSite`.
- **Déclarer une fois, être évalué sur plusieurs référentiels** ([ADR 0031](docs/adr/0031-bibliotheque-de-referentiels.md), lot M3) : **correspondances** entre exigences de la bibliothèque (proposées, validées une fois pour l'organisation par une décision humaine tracée, historique immuable) ; **rapprochements proposés** dans un périmètre à partir des mesures déjà reliées à une exigence (jamais appliqués seuls, correspondance partielle jamais comptée comme couverture complète) ; **file « Rapprochements à valider »** avec pastille du menu, bandeau de la synthèse et rappel dans « Mes rappels » ; confirmation (crée un lien « met en œuvre » à nom du pilote) ou rejet motivé, unitaire ou en lot ; vue **Couverture par référentiel** (couvertes, à valider, non couvertes). API : `/api/library/mappings`, `/api/grc/{smsi}/rapprochements`, `/api/grc/{smsi}/couverture`.
- **Page « Périmètres »** du Pilotage ([ADR 0030](docs/adr/0030-perimetre-agnostique-qualite-fournisseurs.md), lot M1) : créer et modifier un périmètre de management, lui donner une **nature libre** (SMSI, SMQ, SMI… : une étiquette sans règle de comportement), afficher un périmètre dans le Pilotage et gérer les accès des périmètres restreints. Création et modification réservées au droit `pilotage:administrer` (RSSI, administrateur). API : `PATCH /api/grc/smsis/{smsi}` (version attendue en `If-Match`, journal d'audit), `nature` ajoutée à la création et à la liste.
- CI : étape « Audit des dépendances » (`pnpm audit --audit-level=moderate`) dans le job Qualité, bloquante : une faille connue de gravité modérée ou plus empêche la fusion.
- Recette automatisée ([ADR 0029](docs/adr/0029-recette-automatisee.md), [mode d'emploi](docs/05_RECETTE/RECETTE_AUTOMATISEE.md)) : `scripts/recette-serveur.sh` (contrôles du serveur après installation ou mise à jour, rapport sans secret), test de performance sur 10 000 risques fictifs, test d'accessibilité automatique sur 14 écrans (sept écarts visuels connus, reportés). Nouvelle dépendance de test : `@axe-core/playwright` 4.13.0 (développement seulement).

## [3.1.0] — 2026-10-11

### Notes de mise à jour
- **Version stable unique**, publiée depuis `main` (qui reprend la branche de travail `claude-suivi-smsi`) : mise à jour par **Administration → Système → Mise à jour de l’application** (guide, section 12.0). Sauvegarde chiffrée automatique avant mise à jour ; retour à 3.0.2 décrit dans `docs/unification/PLAN-EVOLUTION.md`.
- Branches du dépôt : `main`, `claude-suivi-smsi` et `legacy` (outil historique autonome) ; les autres sont conservées sous les étiquettes `archive/*`. Les préversions éventuelles viennent de `claude-suivi-smsi`.
- Liens transverses (lot U4) : aucune migration ; les liens existants sont conservés tels quels. Une création de lien hors catalogue par l'API reçoit désormais une erreur 422 (« Lié à » reste possible).
- Pilotage SMSI (lot U2) : aucune migration ni action sur le serveur ; la DdA, les objectifs, les indicateurs et les plans restent enregistrés dans l'outil de suivi (`app_state`).
- Gestion des risques (lot U3) : migration additive `016_risques_acceptation.sql` appliquée automatiquement au démarrage (colonne `terms` des décisions, index) ; aucune action sur le serveur. Les risques et objets EBIOS existants restent valides, sans recalcul.
- Branche `claude-suivi-smsi` (unification, [plan](docs/unification/PLAN-EVOLUTION.md)) : aucune migration ni nouveau service pour l'édition libre de la carte et le socle Audit. Les notes et cadres libres sont enregistrés dans la disposition des cartes (`maps`, `map_versions`) ; les objets créés depuis la carte le sont dans leur module de l'outil historique (`app_state`), sous verrou, au nom de la personne et journalisés (`carto.object_create`, `carto.object_rename`).

### Modifié
- Dépôt : retrait d’un ancien prompt de chantier terminé et d’un rapport ponctuel inutilisé ; consignes Claude consolidées, renvois cartographiques corrigés et exclusions de lint/format d’un dossier absent supprimées. Code applicatif, archives, migrations et références visuelles conservés.
- CI : un seul scan Trivy bloquant HIGH/CRITICAL par image API, web et updater ; suppression du second scan identique destiné à réafficher le tableau. Les SBOM et le scan des dépendances du dépôt sont conservés.
- CI : la pile de recette Playwright relève la limite de débit (`RATE_LIMIT_PER_MINUTE=6000`) pour sa seule pile de test, toute la recette partant d'une même adresse IP ; la valeur par défaut des serveurs (1 200) est inchangée. Le lien direct vers l'outil historique n'accepte plus que les noms de vue connus de l'outil (alerte CodeQL `js/remote-property-injection`).
- CodeQL : une nouvelle analyse de la même référence Git annule l'exécution précédente encore en cours, comme le fait déjà la CI.

### Ajouté

- Cartographie, construire une carte de zéro (`CARTO-15` à `CARTO-19`, ADR 0026) : créer depuis la carte une partie intéressée, un fournisseur, une application, un enjeu, un site, un système ou un processus, enregistré dans son module avec la permission de ce module ; menu contextuel (clic droit, appui long, Maj+F10) ; palette en glisser-déposer ; renommage depuis la carte ; sélection multiple, alignement et répartition ; notes et cadres libres ; carte vierge. Aucune suppression d'un objet de la plateforme depuis la carte. La carte des risques réutilise le canevas sans menu contextuel.
- Audit, socle partagé (`AUD-05`, `AUD-09`, `AUD-10`, ADR 0025) : `@suivi/shared/audit` (modèle et libellés, pronostic en parité avec l'outil historique, règles des écarts et du plan d'actions, schémas zod). Aucun écran ni route à ce stade.
- Liens transverses (lot U4, ADR 0028) : catalogue des relations autorisées entre types d'objets, contrôlé par le serveur (« Traite », « Démontre », « Supporte »… seulement dans leur sens métier ; « Lié à » pour toute paire) ; panneau « Liens et preuves » lisible des deux côtés (« Traite » / « Est traité par ») et accessible depuis le registre des risques ; objets archivés signalés et fermés aux nouveaux liens ; données de l'outil de suivi reliables seulement dans le périmètre de l'organisation ; responsables proposés limités aux comptes qui peuvent consulter le pilotage.
- Pilotage SMSI complété (lot U2, `FCT-019`, `FCT-028`, `FCT-030`, `FCT-038`) : « Applicabilité » affiche et modifie la déclaration d'applicabilité de l'outil de suivi (clauses ISO 27001, Annexe A, HDS) sans copie — seule l'entrée de l'exigence est réécrite, sous verrou, avec contrôle de version et journal ; « Objectifs » présente les vues « Par processus » et « Vue compacte » de l'outil historique (états des indicateurs calculés à l'identique, tests de parité) ; « Audits internes » et « Exercices » affichent en lecture seule le programme d'audit et le plan d'exercices historiques (retards signalés), avec lien direct vers leur planification ; la synthèse du Pilotage reprend les graphiques indicateurs, écarts par type, conformité par référentiel et plans par état.
- Gestion des risques refondue (`RISK-01` à `RISK-10`, ADR 0027) : études EBIOS RM organisées en cinq ateliers d'objets typés (valeurs métier, biens supports, événements redoutés gradués, couples source de risque / objectif visé, parties prenantes avec indice de menace, scénarios stratégiques et opérationnels, matrice gravité × vraisemblance), validation de chaque atelier par décision tracée, création d'un risque du registre depuis un scénario opérationnel ; fiche de risque enrichie selon un processus inspiré de l'ISO/IEC 27005 (actifs, menace, vulnérabilité, conséquences) ; acceptation formelle immuable avec échéance ; registre filtrable (niveaux, option, acceptation, revue) ; références typées contrôlées par le serveur et sélecteur filtré par type. Aucune conformité revendiquée.
- Tableau de bord unifié (`UI-02`, lot U1) : l'accueil et l'écran mural retrouvent les graphiques du tableau de bord historique — conformité par référentiel (DdA, histogramme empilé), écarts ouverts par type (anneau) et actions réalisées (jauge), objectifs et indicateurs (anneau), plans de l'année (histogramme) — calculés côté serveur à l'identique de l'outil historique (tests de parité), plus les compteurs du Pilotage (constats ouverts, risques sans appréciation validée, actions en retard) ; la synthèse du Pilotage présente ses compteurs en anneaux. Composants SVG `Anneau`, `Histogramme`, `Jauge` dans `packages/ui`, sans dépendance, contrastes vérifiés en clair et en sombre.
- Menu : « Évaluations IA » accessible ; « Outil de suivi (ancienne interface) » ouvre directement les pages encore historiques (audit, DdA, fournisseurs, plans, GAP, CRRC, investissements, incidents, rapports), selon les droits ; « Cartographie du SMSI » distinguée de la carte des risques.
- Unification : [audit L1 et correspondance ancien / nouveau](docs/unification/L1-AUDIT-ET-CORRESPONDANCE.md) et [plan d'évolution](docs/unification/PLAN-EVOLUTION.md) ; spécifications Audit et carte libre validées par le RSSI, ADR renumérotées 0025 et 0026.
- Dossier documentaire de reprise IA : inventaire et comparaison v2, DAT actuel, guides, registres de qualité, backlog et recette avec preuves datées. Aucun changement applicatif.

## [3.0.2] — 2026-10-10 — Préversion de développement

### Notes de mise à jour
- Reprise de la publication interrompue de `3.0.1` : cache pnpm automatique désactivé dans le job des notes qui utilise uniquement Node. Le tag initial reste immuable ; aucune image installable `3.0.1` n’a été publiée.
- Recette de montée de version compatible avec les tags annotés et les trois images API/web/updater ; erreurs des contrôles de mise à jour visibles dans le journal, sans changer les chemins des verrous ni assouplir les refus.
- Le script serveur partage les verrous de l'exécutant automatique pendant toute la mise à jour, sauvegarde et retour arrière compris ; une opération active est attendue avant tout remplacement. Le chemin web réutilise ses verrous hérités.
- L'image updater fournit GNU find, nécessaire à la rotation des archives dans le script serveur. Un ancien updater sans cet outil doit être reconstruit/redéployé une première fois selon INSTALLATION 12.0 ; il ne peut pas se remplacer lui-même si son ancien script échoue avant installation.
- Recette navigateur synchronisée sur la fin effective de l'import Excel ; capture du plan de contrôle à une position de défilement et de pointeur explicite, sans changer la référence visuelle ni le code applicatif.
- Correctifs de recette : le clic du menu Pilotage ouvre réellement sa synthèse, puis ses rubriques, sur ordinateur et téléphone. L'exécutant Compose lance automatiquement les sauvegardes/exploitation : plus de cron à ajouter pour activer le bouton. Destination privée persistante `DATA_DIR/sauvegardes`, clé existante générée `DATA_DIR/update-secrets/backup-pass` ; les chemins explicites `BACKUP_DEST`/`BACKUP_PASSPHRASE_FILE` restent prioritaires. Garder les clés originales des anciens catalogues et la clé générée dans le coffre-fort. `EXPLOITATION_AUTO=0` conserve un poller hôte choisi explicitement. Aucune nouvelle migration applicative n'est nécessaire pour ces correctifs.
- Version **de test**, étiquetée exclusivement depuis `feature/gpt6-evolution-smsi-grc`, sans fusion ni modification de `main`. GitHub la marque comme préversion ; les images signées portent uniquement `3.0.2`, sans remplacer les alias stables `3.0` ou `latest`. Le numéro sans suffixe assure la compatibilité avec le menu de mise à jour déjà installé.
- Sur le dépôt **privé**, l'exécutant existant réutilise la clé Git et les accès GHCR pour détecter l'étiquette et les trois images disponibles. Tous les serveurs autorisés sur ce dépôt privé peuvent voir cette version ; l'installation reste une décision explicite de l'administrateur. Pas de canal de test isolé dans l'ancien menu. Si le dépôt devient public, ce chemin de préversion n'est pas proposé par `/releases/latest`.
- Pré-requis : installation v3 avec `gateway` et `updater`, accès privés Git/GHCR déjà fonctionnels, `APP_VERSION` numérique inférieur à `3.0.2` (par exemple `3.0.0`). Les installations locales marquées `test`, `local` ou `ci` doivent d'abord utiliser un numéro de version ; voir INSTALLATION 12.0. La première mise à niveau d'une v2 reste la procédure serveur 12.4.
- Cette première publication de développement regroupe le socle ZIP Sauge, A/B/C, G/H/K et le début E. Les migrations additives `006` à `015` s'appliquent automatiquement selon la version installée ; prévoir quelques minutes, plus la sauvegarde selon le volume. E reste partiel ; D/J/I/F exclus. Sauvegarde chiffrée obligatoire, signatures et commit contrôlés, maintenance persistante, contrôle des données et retour arrière conservés. Les mentions historiques « aucune publication » ci-dessous décrivent les lots avant cette livraison de test.

### Détails de préparation des lots
- Pilotage G/H/K et début E : migration additive `015_pilotage_decisions.sql`, automatique, sans dépendance/service supplémentaire. Navigation et formulaires métier français ; parcours commun sans création de SMSI ; périmètres privés et données historiques conservés. Preuves versionnées, contrôles/récurrences, constats/actions/efficacité/clôtures gardées, parcours qualité/sécurité/intégré reprenable ; premières BIA, plans et exercices avec rapports imprimables. E reste partiel (kits/grilles officiels indisponibles) ; D/J/I/F hors périmètre. Voir `docs/PILOTAGE.md`. Aucune fusion, publication ou installation sur un serveur utilisateur.
- B2b : migration additive `011_evaluations_versionnees.sql`, initialisation automatique. Écran Sauge `/ia/evaluations`, accessible depuis le guide et le menu utilisateur historique. Simulation et décisions confirmées liées aux scénarios IA existants, instantanés source/configuration immuables, résultat serveur, audit atomique, concurrence et réessais idempotents, historique et export JSON contrôlés. Aucun recalcul du passé ni modification du registre v2 ; les autres familles et sous-lots B2 restent à livrer.
- B2a : migration additive `010_configuration_environnement.sql`, initialisation automatique sans modification des méthodes ni évaluations v2. Administration → Système → Configuration de l’environnement ajoute des échelles et matrices organisationnelles versionnées, validation/simulation, confirmation, motif et audit transactionnel. Les publications sont immuables ; une reprise crée une nouvelle version. Aucun nouveau paquet ni service. Les autres raccordements métier, nomenclatures, workflows et autres sous-lots B2 restent à livrer.
- Mise à jour intégrée : migration additive `009_mises_a_jour.sql` ; services `gateway` et `updater` installés par Compose. L’API reste sans accès Internet ni socket Docker. Les accès Git/registre déjà installés sont réutilisés. Clé de sauvegarde spécifique générée sans remplacement, à conserver dans le coffre-fort. Bandeau pour tous les utilisateurs, commandes réservées au rôle Administrateur, maintenance indépendante pendant redémarrage, signatures/empreintes et contrôle du commit, sauvegarde chiffrée, reprise durable et retour arrière. L’exécutant se met lui-même à jour ; le frontal stable est entretenu séparément (`GATEWAY_VERSION`, INSTALLATION 12). Aucun tag, déploiement ou fusion automatique de cette branche.
- Lot A complet : migration additive `007_exploitation.sql`, poller hôte Python 3 standard selon INSTALLATION 11.6–11.7. Remplacer le poller A1a par le poller commun ; la planification web est désactivée par défaut et ne modifie aucun cron existant. Destination et clé restent côté serveur. `TLS_WEB_MANAGEMENT=0` par défaut ; `TLS_TERMINATION=external` interdit les changements. Aucun paquet applicatif ajouté. Une restauration ferme les sessions ; le journal/reprise hors PostgreSQL survit et le retour arrière de sécurité est contrôlé.
- A1b1 : installer `python3` sur l’hôte (bibliothèque standard uniquement), selon INSTALLATION 2 et 11.4. Aucun nouveau service ni migration. `restore.sh --verifier` contrôle une archive sans restauration ; les restaurations confirmées ferment les sessions anciennes et exigent une reconnexion. Archives GNU/USTAR uniquement, limites et formats interdits documentés.
- A1a : migration additive `006_sauvegardes.sql` au démarrage, sans nouvelle dépendance. Configurer l’exécutant hôte selon l’étape 11.5 du guide pour activer les demandes manuelles chiffrées. Sans exécutant, l’action est désactivée. Le lot A complet ci-dessus les ajoute.
- Lot de fiabilisation A3/A4/A5/A6 : aucune nouvelle migration ni dépendance. Les modules historiques restent accessibles sous `/legacy` jusqu'à validation de leur reprise Sauge. Le lot A ajoute ensuite le pilotage TLS ; les lots B–L restent à développer.
- Intégration de la base ZIP Sauge sur `feature/gpt6-evolution-smsi-grc` uniquement : la v2 complète est conservée dans `archives/v2-source.zip`, avec manifeste SHA-256. Aucune migration des données de l’environnement existant ni publication d’image n’est réalisée par ce lot. Voir `docs/diagnostics/2026-10-09-integration-sauge.md`.
- **Les données quittent les volumes Docker pour le dossier du serveur `DATA_DIR`** (par défaut `/srv/suivi-audits/donnees`, EXPL-01). La mise à jour par `scripts/mettre-a-jour.sh` fait la copie toute seule, contrôle les données et **conserve les anciens volumes** jusqu'à `sudo ./scripts/migrer-donnees-vers-dossier.sh --supprimer-anciens-volumes`. Prévoir l'espace disque : deux fois la taille de la base.
- Première mise à jour avec le script (il n'existe pas encore dans la version en service) : `sudo git fetch --tags && sudo git show v<version>:scripts/mettre-a-jour.sh | sudo bash -s -- <version>` (`docs/INSTALLATION.md`, étape 12.1).
- Serveur v2 : suivre l'étape 12.4 du guide (copie des volumes par `scripts/migrer-donnees-vers-dossier.sh`).
- Faire inclure `DATA_DIR` **et** le dossier des sauvegardes dans la sauvegarde externalisée du serveur ; planifier `scripts/verifier-version.sh` (étape 11.3).
- `docker compose down -v` ne supprime plus aucune donnée. Pour tout effacer : section 14 du guide.
- Migrations de la base : `003_droits.sql`, `004_affichage_et_ecrans_muraux.sql`, `005_cartographie.sql` (au démarrage, sans action). Durée estimée : 5 minutes, plus la copie des données.
- Cartographie : nouveau module de droits « Cartographie du SMSI » (75 permissions au lieu de 70). Les rôles prédéfinis le reçoivent automatiquement ; les **rôles personnalisés ne l'ont pas** : cochez ses cases dans leur matrice si besoin. Les cartes dessinées avec le module bêta de l'ancien outil sont reprises automatiquement par la migration ; l'ancien outil les affiche ensuite en lecture seule.

### Corrigé
- A1b1 / EXPL-08 : contrôler les contenus tar imbriqués avant remplacement, vérifier l’empreinte de l’archive sélectionnée, exclure les opérations concurrentes et borner l’attente PostgreSQL/application ; aucun succès avant contrôle de santé.
- A1a : préserver la rétention de 36500 jours utilisée par la sauvegarde avant mise à jour ; test de compatibilité avec la procédure existante.
- A4 : déconnexion fiable, purge des caches privés et propagation aux onglets ; erreur explicite si le serveur est injoignable ou refuse la fermeture. MFA, cookie et contrôles serveur conservés.
- Écran mural : préserver la requête observée lors du démarrage anonyme ; réinitialiser ses données et recontrôler son autorisation indépendante à la déconnexion.
- A3 : connexion sans bandeau numéroté d'étapes, avec le formulaire et la charte Sauge conservés.
- A6 / CARTO-10 : fiche de sélection rétractable sur grand écran ; sa fermeture rend la largeur au canevas.
- Sécurité CI : aucun mot de passe temporaire inutilisé ni corps de réponse sensible dans le journal du guide ; document de test transmis en mémoire plutôt que par un fichier temporaire prévisible.

### Ajouté
- A1 : politique versionnée de planification hebdomadaire UTC/rétention, catalogue d’archives avec contrôle SHA-256, vérification depuis le navigateur, restauration guidée confirmée, sauvegarde de sécurité et retour arrière, journal durable hors base, neutralisation des anciennes demandes après restauration et notifications.
- A2 : métadonnées et alertes d’expiration TLS, remplacement certificat/chaîne et clé masquée/scellée, contrôle de cohérence/hôte/validité, validation Caddy et certificat servi, retour arrière et retour à `.env`. Terminaison externe en observation seule ; renouvellement interne/ACME conservé chez Caddy. Clés et marqueur sauvegardés avec les secrets.
- A1a / EXPL-08 : demandes manuelles de sauvegarde chiffrée dans Administration > Système, confirmation, suivi des 50 dernières demandes, annulation versionnée avant prise en charge, réessais idempotents et audit transactionnel. Exécutant hôte à commandes fixes, verrou partagé avec les sauvegardes existantes, contrôle SHA-256 et échecs explicites ; aucun accès Docker ou secret offert à l’API.
- A5 : guide d'utilisation embarqué, versionné, recherchable et filtré par permissions, couvrant les modules Sauge et toutes les familles métier encore dans l'ancienne interface.
- Références Playwright alignées sur la charte Sauge déjà fournie dans le ZIP, avec navigateur officiel et seuils de comparaison inchangés.
- Cadrage A–L, architecture minimale et inventaire de reprise intégrale du socle v2 (`docs/REPRISE-SOCLE-LEGACY.md`). Les migrations des modules historiques restent à livrer progressivement.
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
- Refonte visuelle Sauge (ADR 0015) : palette, Inter locale, navigation, tableau de bord, connexion, cartographie et styles historiques harmonisés ; animations discrètes et mode sombre. Aucun changement de logique métier. Détail et recette : `LIRE-MOI-REFONTE.md`.
- `EXPL-06` : l'outil historique fait partie de l'image ; `scripts/update-ui.sh` est réservé au poste de développement.
- `docker-compose.dev.yml` : données de développement dans `./.donnees-dev` au lieu de volumes nommés.
- Migration `004_affichage_et_ecrans_muraux.sql` : préférences d'affichage par personne (`users.preferences`) et table `wall_screens`.
- Le choix de thème du bouton du menu est enregistré sur le serveur (et non plus dans le navigateur).
- Migration `003_droits.sql` : `admin` devient Administrateur, `rw` devient Contributeur, `ro` devient Lecteur. Un ancien compte « lecture et écriture » ne peut plus supprimer de document ni de lien : lui attribuer le rôle RSSI si nécessaire.
- L'outil historique filtre les modules selon les droits : les modules non lisibles sont masqués, et les modifications non autorisées sont refusées.

## [3.0.0] — Phase 0 : fondations

Nouvelle architecture. La mise à jour depuis la v2 conserve la base, les secrets et les certificats.

### Notes de mise à jour
- B2b : migration additive `011_evaluations_versionnees.sql`, initialisation automatique. Écran Sauge `/ia/evaluations`, accessible depuis le guide et le menu utilisateur historique. Simulation et décisions confirmées liées aux scénarios IA existants, instantanés source/configuration immuables, résultat serveur, audit atomique, concurrence et réessais idempotents, historique et export JSON contrôlés. Aucun recalcul du passé ni modification du registre v2 ; les autres familles et sous-lots B2 restent à livrer.
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
- B2b : migration additive `011_evaluations_versionnees.sql`, initialisation automatique. Écran Sauge `/ia/evaluations`, accessible depuis le guide et le menu utilisateur historique. Simulation et décisions confirmées liées aux scénarios IA existants, instantanés source/configuration immuables, résultat serveur, audit atomique, concurrence et réessais idempotents, historique et export JSON contrôlés. Aucun recalcul du passé ni modification du registre v2 ; les autres familles et sous-lots B2 restent à livrer.
- Première version Docker : aucune action.

- Déploiement Docker (Caddy, Node 24, PostgreSQL 17) de l'outil historique : authentification avec TOTP, jeton d'installation, documents chiffrés, journal d'audit, sauvegardes.
