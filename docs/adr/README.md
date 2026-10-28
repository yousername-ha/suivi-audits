# Décisions d'architecture (ADR)

Une ADR courte par décision structurante : contexte, décision, conséquences. Une décision remplacée n'est pas effacée : elle passe au statut « Remplacée par ADR-NNNN ».

| N° | Décision | Statut |
|---|---|---|
| [0001](0001-monorepo-typescript.md) | Monorepo TypeScript (pnpm workspaces) | Acceptée |
| [0002](0002-api-fastify-zod-openapi.md) | API Fastify, validation zod, OpenAPI généré depuis les mêmes schémas | Acceptée |
| [0003](0003-postgresql-drizzle-migrations-sql.md) | PostgreSQL, Drizzle ORM, migrations SQL versionnées compatibles v2 | Acceptée |
| [0004](0004-concurrence-par-enregistrement.md) | Concurrence optimiste par enregistrement (If-Match, 412) | Acceptée |
| [0005](0005-temps-reel-sse-listen-notify.md) | Temps réel : SSE alimenté par LISTEN/NOTIFY | Acceptée |
| [0006](0006-front-react-mantine-csp-stricte.md) | Front React, Vite, TanStack Query, Mantine sous CSP stricte | Acceptée |
| [0007](0007-transition-legacy.md) | Transition depuis l'outil historique : une seule source modifiable par module | Acceptée |
| [0008](0008-images-ghcr-cosign-caddy-non-root.md) | Images GHCR signées (cosign), frontal Caddy sans privilège | Acceptée |
| [0009](0009-dependances-et-versions.md) | Dépendances retenues et lignes de versions | Acceptée |
| [0010](0010-droits-rbac.md) | Droits : utilisateurs, groupes, rôles (RBAC) | Acceptée |
| [0011](0011-charte-graphique-et-parametres.md) | Charte graphique unique (packages/ui) et page Paramètres | Acceptée |
| [0012](0012-adaptation-ecrans-et-ecran-mural.md) | Adaptation à tous les écrans, préférences d'affichage et écran mural | Acceptée |
| [0013](0013-cartographie.md) | Cartographie du SMSI : moteur SVG maison, tables `maps`, objets par adaptateur | Acceptée |
| [0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) | Données sur le serveur (`DATA_DIR`) et mises à jour outillées | Acceptée |
| [0015](0015-refonte-visuelle-sauge.md) | Direction graphique Sauge, sans changement métier | Proposée |
| [0016](0016-pilotage-sauvegardes.md) | Demandes de sauvegarde chiffrée et exécutant serveur (A1a) | Acceptée |
| [0017](0017-verification-restauration.md) | Vérification préalable et extraction contrôlée des archives de restauration (A1b1) | Acceptée |
| [0018](0018-exploitation-lot-a.md) | Pilotage hôte, reprise durable, planification et TLS (lot A) | Acceptée |
| [0019](0019-activation-modules.md) | Activation versionnée des modules, dépendances, garde serveur et conservation des données (B1) | Acceptée |
| [0020](0020-mise-a-jour-integree.md) | Mise à jour web, exécutant isolé et maintenance indépendante | Acceptée |
| [0021](0021-configuration-environnement-versionnee.md) | Échelles, matrices, simulation et publications immuables (B2a) | Acceptée |
| [0022](0022-evaluations-ia-versionnees.md) | Décisions IA immuables liées aux sources et configurations (B2b) | Acceptée |
| [0023](0023-smsi-referentiels-taches-risques.md) | Registres transversaux, publications et politiques par SMSI (lot C) | Retenue, recette requise |
| [0024](0024-pilotage-metier.md) | Pilotage multi-référentiels, décisions G/H/K et début E | Retenue, recette de PR requise |
| [0025](0025-audit.md) | Audit : cycle, référentiels, couverture, écarts et plan d'audit (ex-0015 de la lignée `refonte/*`) | Acceptée, à réconcilier avec 0023/0024 |
| [0026](0026-cartographie-creation-depuis-la-carte.md) | Cartographie : créer les objets de la plateforme depuis la carte (ex-0016) | Acceptée |
| [0027](0027-risques-ebios-rm-iso27005.md) | Risques : étude EBIOS RM et processus ISO/IEC 27005 distincts, registre commun (lot U3) | Proposée |
| [0028](0028-liens-transverses.md) | Liens transverses : catalogue des relations autorisées, sens explicite (lot U4) | Proposée |
| [0029](0029-recette-automatisee.md) | Recette automatisée : script serveur, performance, accessibilité axe-core (dépendance de test) | Proposée |
| [0030](0030-perimetre-agnostique-qualite-fournisseurs.md) | Périmètres gérés à part (SMI), groupe « Qualité » du Pilotage et fournisseurs transverses | Proposée |
| [0031](0031-bibliotheque-de-referentiels.md) | Bibliothèque de référentiels de l'organisation : déclarer une fois, évaluer sur plusieurs référentiels | Proposée |
| [0032](0032-fournisseurs-de-l-organisation.md) | Fournisseurs de l'organisation : évaluations immuables indépendantes des périmètres, sans grille (lot M4) | Proposée |
| [0033](0033-import-referentiels-outil-de-suivi.md) | Importer dans la bibliothèque les référentiels déjà saisis dans l'outil de suivi (lot M4 suite) | Proposée |
| [0034](0034-apparence-reference-08.md) | Apparence « Référence 08 » de l'application principale et style global | Proposée |
| [0035](0035-postgresql-18-migration-automatique.md) | PostgreSQL 18 avec migration automatique depuis la 17, et Node 26 | Proposée |
| [0036](0036-objectifs-boites-contexte-et-revue-de-direction.md) | Objectifs, boîtes de pilotage, contexte et revue de direction (lots M5 à M8) | Acceptée |
| [0037](0037-standards-verrouilles-jeu-de-test-et-relations.md) | Standards verrouillés, copies personnalisables, jeu de test et contrôle des relations | Acceptée |
| [0038](0038-socle-de-configuration-grc-transversal.md) | Socle de configuration GRC transversal (échelles, matrices, critères) et méthodes épinglées | Proposée |
| [0039](0039-hierarchie-des-perimetres.md) | Hiérarchie des périmètres (organisation → entité → périmètre) et héritage explicite des référentiels | Proposée |
| [0040](0040-sortie-du-json-plat-modules-en-tables.md) | Sortie du JSON plat : modules de l'outil de suivi repris en tables, un par un | Proposée |
| [0041](0041-evaluation-des-exigences-et-couverture.md) | Évaluation des exigences : applicabilité, mise en œuvre, test d'efficacité, validation métier et état de couverture | Proposée |
| [0042](0042-retrait-de-lecran-legacy.md) | Retrait de l'écran /legacy : lecture par /api/suivi, exports Excel natifs, import conservé | Proposée |
| [0043](0043-registres-perimetres-herites-et-droits-par-ressource.md) | Registres, périmètres hérités et droits par ressource (lecteur, contributeur, gestionnaire) | Acceptée |
| [0044](0044-processus-en-cartes-et-types-de-processus.md) | Processus en cartes, registre des types de processus et cartographie qui le suit | Acceptée |
| [0045](0045-parcours-guide-iso-hds.md) | Parcours guidé ISO 27001 / HDS : vue de navigation sans registre parallèle | Acceptée |
| [0046](0046-retrait-du-catalogue-environnement.md) | Retrait du catalogue « Environnement » et des évaluations IA versionnées | Acceptée |
| [0047](0047-calendriers-de-plateforme.md) | Calendriers de plateforme : jours fériés français calculés et iCalendar importés par l'administrateur | Acceptée |
| [0048](0048-conservation-sans-purge-automatique.md) | Conservation : durées réglables, aperçu, aucune purge automatique | Acceptée |
| [0049](0049-courriel-et-sortie-reseau-optionnelle.md) | Courriel SMTP/SMTPS envoyé par l'exécutant d'exploitation, tout dans l'interface | Acceptée |
| [0050](0050-certificats-depuis-l-interface.md) | Certificats TLS (autorité interne, ACME, certificat fourni) choisis dans l'interface | Acceptée |
| [0051](0051-couche-visuelle-ebios.md) | Couche visuelle EBIOS RM : chemins, pictogrammes, cercle, flux animés | Acceptée |
| [0052](0052-registre-fait-foi-matrice-bareme.md) | Le registre fait foi ; la matrice et les échelles sont des barèmes, l'écart est signalé | Acceptée |
| [0053](0053-cloture-avec-liens-ouverts.md) | Clôture d'un écart avec des liens ouverts : refus, sauf motif écrit tracé | Acceptée |
| [0054](0054-bibliotheque-sources-de-risque.md) | Bibliothèque partagée des sources de risque réutilisées par les études | Acceptée |
| [0055](0055-kit-integration-ia.md) | Kit d'intégration IA : contrôles internes importés depuis l'interface, correspondances proposées, veille « à revérifier » | Acceptée |
| [0056](0056-analyser-un-service-et-plan-des-ecarts.md) | Assistant « Analyser un service » et plan d'action des écarts en lot | Acceptée |
| [0057](0057-retrait-de-la-conformite-ia.md) | Retrait de la page « Conformité IA », de ses données et du module de droits « ia » | Acceptée |
| [0058](0058-notifications-metier.md) | Notifications métier : réglage par groupe, rôle et utilisateur (le réglage personnel l'emporte), application et courriel envoyé par l'exécutant | Acceptée |
| [0059](0059-relance-automatique-des-courriels.md) | Relance automatique des courriels de notification : essais et délai réglables, délai doublé, refus définitif non relancé | Acceptée |
| [0060](0060-couverture-agregee-des-cartes-de-perimetres.md) | Couverture agrégée des cartes de périmètres : somme par périmètre, détail par référentiel, provenance, jamais un taux | Acceptée |
| [0061](0061-mise-a-jour-web-renforcee.md) | Mise à jour depuis l'interface renforcée : code TOTP à l'installation, fenêtre de maintenance, exécutant sans identifiants par défaut, avancement horodaté et reçu | Acceptée |
| [0062](0062-acces-aux-donnees-kysely.md) | Accès aux données : migrations SQL source unique, requêtes typées Kysely, types générés de la base migrée, Drizzle retiré | Acceptée |
| [0063](0063-chaine-de-publication-durcie.md) | Chaîne de publication durcie : actions par empreinte de commit, Trivy isolé sans secret, signature dans un job séparé, attestation SBOM exigée à l'installation | Acceptée |
| [0064](0064-gap-ia-iso-27001-hds.md) | GAP IA ISO 27001 / HDS : trois cas d'usage réels, questions sur des faits constatables, points pré-évalués seulement si la réponse tranche | Acceptée |

| [0065](0065-remise-a-vide-de-la-base.md) | Remise à vide de la base pour la recette : interrupteur désactivé par défaut, deux portées, code, phrase, sauvegarde récente, immuabilité suspendue le temps d'une transaction | Acceptée |
| [0066](0066-limitation-des-essais-du-second-facteur-et-verrouillage-partage.md) | Limitation des essais du second facteur par compte, verrouillage partagé avec le mot de passe, sessions incomplètes plafonnées | Acceptée |
| [0067](0067-attribution-des-droits-par-ressource-reservee.md) | Attribution des droits par ressource réservée au gestionnaire attribué ou à qui administre le module ; pas de modification de ses propres droits ; relations soumises à la gestion de l'élément | Acceptée |
| [0068](0068-suppressions-reservees-au-droit-supprimer.md) | Suppressions des modules de suivi réservées au droit « supprimer » (cohérence avec l'ADR 0010) | Acceptée |
| [0069](0069-tableau-de-bord-verre-et-relief.md) | Tableau de bord de l'accueil « verre et relief » : dalles en verre, métriques fines cernées, seuils d'affichage, taux global = moyenne des taux par référentiel (lot 1) | Acceptée |
| [0070](0070-reponse-de-connexion-uniforme-et-alerte-de-verrouillage.md) | Réponse de connexion uniforme et alerte de verrouillage de compte | Proposée |
| [0071](0071-sauvegardes-chiffrees-avec-age.md) | Sauvegardes chiffrées avec age (`.tar.age`), deux destinataires dont une clé de secours hors serveur, INFO liée au nom du fichier, chiffrement obligatoire, ancien format `.tar.enc` restaurable une version | Proposée |
| [0072](0072-poivre-des-mots-de-passe.md) | Poivre des mots de passe : empreinte scrypt chiffrée en AES-256-GCM par une clé que l'organisation conserve au coffre-fort, définie à l'installation, changeable avec l'ancien poivre et un code TOTP, procédures de reprise et d'urgence | Proposée |
| [0074](0074-alerte-de-securite-dans-l-application.md) | Alerte de verrouillage de compte dans l'application (notification aux administrateurs, indépendante du courriel) | Proposée |
| [0075](0075-composition-des-mots-de-passe.md) | Composition des mots de passe de compte alignée sur le poivre ; mots de passe compromis documentés, non retenus | Proposée |

