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
