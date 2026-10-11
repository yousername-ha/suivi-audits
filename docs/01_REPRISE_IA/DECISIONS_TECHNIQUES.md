# Décisions techniques

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Source normative interne : les ADR ci-dessous, pas une reconstruction du chat.

| ADR  | Décision et preuve                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0001 | [ADR 0001 — Monorepo TypeScript (pnpm workspaces)](../../docs/adr/0001-monorepo-typescript.md)                                      |
| 0002 | [ADR 0002 — API Fastify, validation zod, OpenAPI généré](../../docs/adr/0002-api-fastify-zod-openapi.md)                            |
| 0003 | [ADR 0003 — PostgreSQL, Drizzle ORM, migrations SQL versionnées](../../docs/adr/0003-postgresql-drizzle-migrations-sql.md)          |
| 0004 | [ADR 0004 — Concurrence optimiste par enregistrement](../../docs/adr/0004-concurrence-par-enregistrement.md)                        |
| 0005 | [ADR 0005 — Temps réel : SSE alimenté par LISTEN/NOTIFY](../../docs/adr/0005-temps-reel-sse-listen-notify.md)                       |
| 0006 | [ADR 0006 — Front React, Vite, TanStack Query, Mantine sous CSP stricte](../../docs/adr/0006-front-react-mantine-csp-stricte.md)    |
| 0007 | [ADR 0007 — Transition depuis l'outil historique](../../docs/adr/0007-transition-legacy.md)                                         |
| 0008 | [ADR 0008 — Images GHCR signées, frontal Caddy sans privilège](../../docs/adr/0008-images-ghcr-cosign-caddy-non-root.md)            |
| 0009 | [ADR 0009 — Dépendances retenues et lignes de versions](../../docs/adr/0009-dependances-et-versions.md)                             |
| 0010 | [ADR 0010 — Droits : utilisateurs, groupes, rôles (RBAC)](../../docs/adr/0010-droits-rbac.md)                                       |
| 0011 | [ADR 0011 — Charte graphique unique et page Paramètres](../../docs/adr/0011-charte-graphique-et-parametres.md)                      |
| 0012 | [ADR 0012 — Adaptation à tous les écrans et écran mural](../../docs/adr/0012-adaptation-ecrans-et-ecran-mural.md)                   |
| 0013 | [ADR 0013 — Cartographie du SMSI](../../docs/adr/0013-cartographie.md)                                                              |
| 0014 | [ADR 0014 — Données sur le serveur et mises à jour outillées](../../docs/adr/0014-donnees-sur-le-serveur-et-mises-a-jour.md)        |
| 0015 | [ADR 0015 — Direction graphique Sauge](../../docs/adr/0015-refonte-visuelle-sauge.md)                                               |
| 0016 | [ADR 0016 — Demandes de sauvegarde et exécutant sur le serveur](../../docs/adr/0016-pilotage-sauvegardes.md)                        |
| 0017 | [ADR 0017 — Vérification préalable des archives de restauration](../../docs/adr/0017-verification-restauration.md)                  |
| 0018 | [ADR 0018 — Pilotage hôte des sauvegardes, restaurations et certificats](../../docs/adr/0018-exploitation-lot-a.md)                 |
| 0019 | [ADR 0019 — Activation globale des modules](../../docs/adr/0019-activation-modules.md)                                              |
| 0020 | [ADR 0020 — Mise à jour web et maintenance indépendante](../../docs/adr/0020-mise-a-jour-integree.md)                               |
| 0021 | [ADR 0021 — Échelles et matrices organisationnelles immuables (B2a)](../../docs/adr/0021-configuration-environnement-versionnee.md) |
| 0022 | [ADR 0022 — Décisions IA versionnées sur les sources historiques](../../docs/adr/0022-evaluations-ia-versionnees.md)                |
| 0023 | [ADR 0023 — Registres transversaux et politiques versionnées par SMSI](../../docs/adr/0023-smsi-referentiels-taches-risques.md)     |
| 0024 | [ADR 0024 — Pilotage métier, décisions G/H/K et début E](../../docs/adr/0024-pilotage-metier.md)                                    |

Décisions utilisateur conservées : branche dédiée, main intacte, dépôt privé,
source v2 complète, charte Sauge ; pilotage multi-référentiels avec menu métier ;
G/H/K et début E, D/J/I/F exclus. Les identités Git ne sont pas réécrites et
leurs valeurs personnelles ne sont pas reproduites dans ce dossier.

Choix observés et limites : table grc_smsis conservée par compatibilité ; un
périmètre commun automatique ; références vers versions documentaires exactes ;
front HTTPS séparé de l’application et mis à jour lors d’une fenêtre distincte.
Les configurations/matrices sont organisationnelles et versionnées, sans formule
universelle, sans conformité ni risque résiduel calculés par simple clôture d’action.

Aucune nouvelle ADR d’architecture applicative n’est créée pour cet audit :
il ne change pas l’architecture. Les corrections de documentation distinguent
snapshot historique et état actuel.
