# API et interfaces

Référence applicative analysée : `f9545c3ce1a1338f13bb39bdaa4468bcc907da2d`. Mise à jour : 2026-10-11T22:10:00+02:00 (Europe/Paris).

**197 déclarations de routes**, 190 opérations documentées sur 153 chemins
OpenAPI et 7 routes cachées. Extrait sans base par allRoutes()/buildOpenApi()
(régénéré sur le commit analysé). Document complet avec paramètres, schémas et réponses :
[API_CONTRAT.json](API_CONTRAT.json). Le serveur expose /api/openapi.json
aux sessions authentifiées, pas publiquement sans session.

## Contrat commun

JSON UTF-8 ; corps binaires pour documents/imports, limites route/config ;
zod valide paramètres, query, body et réponses déclarées. Identifiants UUID,
version d’enregistrement et If-Match/ETag selon route. Méthodes modifiantes :
origine contrôlée et CSRF lié à la session, sauf exceptions pré-session explicites.
Access metier est une garde initiale : les services GRC/Pilotage imposent en plus
permission du type d’objet, activation, appartenance au périmètre et droit de décision.

| Code            | Sens commun, sans garantir que chaque route le produit                   |
| --------------- | ------------------------------------------------------------------------ |
| 200/201/204     | Consultation, création ou opération sans contenu selon contrat.          |
| 400/415         | Corps invalide / type non supporté.                                      |
| 401/403/404     | Session, permission/origine/CSRF ; certaines ressources cachées par 404. |
| 409/412/428     | Conflit métier, version obsolète, If-Match absent.                       |
| 410/413/422/429 | Jeton expiré, taille, validation, limitation de débit.                   |
| 500/503         | Erreur interne générique / maintenance ou service indisponible.          |

Erreurs : `{"error":"message français"}` et informations supplémentaires
autorisées ; jamais de stack client. SSE /api/events transmet des changements
filtrés ; export et téléchargement restent gardés côté serveur.

## Inventaire des déclarations

Le niveau ci-dessous est celui de route(). Pour les gardes supplémentaires,
consulter le handler et le service. Le contrat JSON constitue la référence
pour les champs/paramètres exacts, pas un exemple de données de production.

| Méthode  | URL déclarée                                      | Garde initiale             | But                                                                                                                          |
| -------- | ------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET,HEAD | `/healthz`                                        | public                     | Sonde de santé (base de données joignable)                                                                                   |
| GET      | `/api/health/ready`                               | public                     | Disponibilité complète (base joignable, migrations appliquées, version) — réservée aux appels locaux (script de mise à jour) |
| GET      | `/api/version`                                    | auth                       | Version en service, dernière migration appliquée, schémas de l’outil historique acceptés                                     |
| GET      | `/api/openapi.json`                               | auth                       | Description OpenAPI 3.1 de l’API                                                                                             |
| GET      | `/api/auth/me`                                    | public                     | État de la session (étape d’accès, jeton CSRF, utilisateur)                                                                  |
| POST     | `/api/auth/login`                                 | public                     | Connexion (identifiant et mot de passe)                                                                                      |
| POST     | `/api/auth/mfa`                                   | session                    | Second facteur : code TOTP (anti-rejeu, rotation de la session)                                                              |
| POST     | `/api/auth/logout`                                | public                     | Déconnexion                                                                                                                  |
| GET      | `/api/setup`                                      | public                     | État de l'installation initiale                                                                                              |
| POST     | `/api/setup`                                      | public                     | Création du compte administrateur avec le jeton d'installation                                                               |
| POST     | `/api/account/password`                           | session                    | Changement de mot de passe (ferme les autres sessions)                                                                       |
| POST     | `/api/account/totp/begin`                         | session                    | Début d’enrôlement TOTP (secret et URI otpauth)                                                                              |
| POST     | `/api/account/totp/confirm`                       | session                    | Confirmation de l’enrôlement TOTP (rotation de la session)                                                                   |
| POST     | `/api/account/totp/disable`                       | auth                       | Désactivation de la double authentification (si non obligatoire)                                                             |
| GET      | `/api/account/sessions`                           | auth                       | Mes sessions ouvertes                                                                                                        |
| POST     | `/api/account/sessions/revoke-others`             | auth                       | Fermer mes autres sessions                                                                                                   |
| GET      | `/api/documents`                                  | documents:lire             | Liste des documents (recherche, rattachement, catégorie, corbeille)                                                          |
| GET      | `/api/documents/categories`                       | documents:lire             | Catégories utilisées (documents et liens)                                                                                    |
| POST     | `/api/documents`                                  | documents:modifier         | Dépôt d’un document (corps binaire, en-têtes X-File-Name et X-Meta)                                                          |
| GET      | `/api/documents/:id`                              | documents:lire             | Fiche d’un document et ses versions (ETag = version)                                                                         |
| PATCH    | `/api/documents/:id`                              | documents:modifier         | Modification des métadonnées (If-Match obligatoire, 412 si le document a changé)                                             |
| POST     | `/api/documents/:id/versions`                     | documents:modifier         | Nouvelle version d’un document (corps binaire, X-File-Name, X-Comment)                                                       |
| DELETE   | `/api/documents/:id`                              | documents:supprimer        | Mise à la corbeille (purge=1 : suppression définitive, permission documents:administrer)                                     |
| POST     | `/api/documents/:id/restore`                      | documents:supprimer        | Restauration depuis la corbeille                                                                                             |
| GET      | `/api/documents/:id/download`                     | documents:lire             | Téléchargement (déchiffrement, contrôle d’intégrité SHA-256)                                                                 |
| GET      | `/d/:id`                                          | documents:lire             | Lien interne vers un document (à coller dans l’outil de suivi) (hors OpenAPI)                                                |
| GET      | `/api/links`                                      | documents:lire             | Liste des liens                                                                                                              |
| POST     | `/api/links`                                      | documents:modifier         | Ajout d’un lien                                                                                                              |
| PATCH    | `/api/links/:id`                                  | documents:modifier         | Modification d’un lien (If-Match obligatoire, 412 si le lien a changé)                                                       |
| DELETE   | `/api/links/:id`                                  | documents:supprimer        | Suppression d’un lien                                                                                                        |
| GET      | `/api/admin/users`                                | administration:lire        | Comptes, avec leurs rôles et groupes                                                                                         |
| POST     | `/api/admin/users`                                | administration:administrer | Création d’un compte (mot de passe temporaire affiché une seule fois)                                                        |
| GET      | `/api/admin/users/:id`                            | administration:lire        | Un compte (ETag = version)                                                                                                   |
| PATCH    | `/api/admin/users/:id`                            | administration:administrer | Modification d’un compte : identité, état, expiration, rôles, groupes (If-Match obligatoire)                                 |
| POST     | `/api/admin/users/:id/reset-password`             | administration:administrer | Mot de passe temporaire (changement imposé à la connexion)                                                                   |
| POST     | `/api/admin/users/:id/reset-mfa`                  | administration:administrer | Réinitialisation de la double authentification (téléphone perdu)                                                             |
| DELETE   | `/api/admin/users/:id`                            | administration:supprimer   | Suppression d’un compte                                                                                                      |
| GET      | `/api/admin/users/:id/rights`                     | administration:lire        | Droits effectifs d’un compte, avec l’origine de chaque droit (rôle direct ou groupe)                                         |
| GET      | `/api/admin/access-review`                        | administration:exporter    | Revue des accès (ISO 27001 A.5.18) : comptes, groupes, rôles, droits effectifs, dernière connexion, expiration               |
| GET      | `/api/admin/groups`                               | administration:lire        | Groupes, avec leurs rôles et leurs membres                                                                                   |
| POST     | `/api/admin/groups`                               | administration:administrer | Création d’un groupe                                                                                                         |
| PATCH    | `/api/admin/groups/:id`                           | administration:administrer | Modification d’un groupe : nom, description, rôles, membres (If-Match obligatoire)                                           |
| DELETE   | `/api/admin/groups/:id`                           | administration:supprimer   | Suppression d’un groupe (ses membres perdent les rôles qu’il portait)                                                        |
| GET      | `/api/admin/roles`                                | administration:lire        | Rôles (prédéfinis et personnalisés) et leur matrice de permissions                                                           |
| GET      | `/api/admin/permissions`                          | administration:lire        | Modules et actions du modèle de droits (liste partagée avec l’interface)                                                     |
| POST     | `/api/admin/roles`                                | administration:administrer | Création d’un rôle personnalisé par duplication d’un rôle existant                                                           |
| PATCH    | `/api/admin/roles/:id`                            | administration:administrer | Modification d’un rôle personnalisé : nom, description, matrice (If-Match obligatoire)                                       |
| DELETE   | `/api/admin/roles/:id`                            | administration:supprimer   | Suppression d’un rôle personnalisé (retiré des comptes et des groupes qui le portent)                                        |
| GET      | `/api/admin/sessions`                             | administration:lire        | Sessions ouvertes (tous les comptes)                                                                                         |
| DELETE   | `/api/admin/sessions/:id`                         | administration:administrer | Fermeture d’une session                                                                                                      |
| GET      | `/api/admin/audit`                                | administration:lire        | Journal d’audit (en ajout seul), recherche et pagination ; format=csv pour l’export                                          |
| GET      | `/api/admin/versions`                             | administration:lire        | Historique des versions de l’état de l’outil historique                                                                      |
| GET      | `/api/admin/versions/:v`                          | administration:exporter    | Téléchargement d’une version (JSON ; droit d’exporter chacun des modules qu’elle contient)                                   |
| POST     | `/api/admin/versions/:v/restore`                  | administration:administrer | Restauration d’une version (crée une nouvelle version)                                                                       |
| GET      | `/api/admin/sauvegardes`                          | administration:lire        | Exécutant et historique des demandes de sauvegarde                                                                           |
| POST     | `/api/admin/sauvegardes`                          | administration:administrer | Demander une sauvegarde chiffrée complète                                                                                    |
| POST     | `/api/admin/sauvegardes/:id/annuler`              | administration:administrer | Annuler une demande en attente (If-Match)                                                                                    |
| GET      | `/api/admin/systeme`                              | administration:lire        | Exploitation : version, mises à jour, dernière sauvegarde, espace disque, nouvelle version disponible (lecture seule)        |
| GET      | `/api/admin/info`                                 | administration:lire        | Informations système                                                                                                         |
| GET      | `/api/admin/modules/history`                      | administration:lire        | Historique immuable des changements d’activation                                                                             |
| GET      | `/api/modules`                                    | auth                       | Registre et activation des modules                                                                                           |
| POST     | `/api/admin/modules/preview`                      | administration:administrer | Prévisualiser les conséquences (aucune écriture)                                                                             |
| PUT      | `/api/admin/modules`                              | administration:administrer | Confirmer une activation ou désactivation prévisualisée                                                                      |
| GET      | `/api/admin/exploitation`                         | administration:lire        | Catalogue, politique, TLS et journal durable des opérations                                                                  |
| PUT      | `/api/admin/exploitation/politique`               | administration:administrer | Configurer planification UTC et rétention (If-Match)                                                                         |
| POST     | `/api/admin/exploitation/operations`              | administration:administrer | Demander vérification, restauration confirmée ou changement TLS                                                              |
| POST     | `/api/admin/exploitation/operations/:id/annuler`  | administration:administrer | Annuler une opération en attente (If-Match)                                                                                  |
| GET      | `/api/updates`                                    | auth                       | Disponibilité des mises à jour pour tous les comptes                                                                         |
| POST     | `/api/admin/updates/check`                        | administration:administrer | Vérifier manuellement les publications GitHub                                                                                |
| POST     | `/api/admin/updates/install`                      | administration:administrer | Installer la publication disponible après confirmation                                                                       |
| GET      | `/api/events`                                     | auth                       | Flux SSE : changements (entité, id, version, auteur), présence ; filtré selon le rôle                                        |
| GET      | `/api/presence`                                   | auth                       | Présence courante (qui consulte ou modifie quoi)                                                                             |
| POST     | `/api/presence`                                   | auth                       | Déclaration de présence (renouvelée toutes les 20 s par l’interface)                                                         |
| DELETE   | `/api/presence/:client`                           | auth                       | Fin de présence (fermeture de l’onglet)                                                                                      |
| GET,HEAD | `/api/legacy/state`                               | metier                     | État de l’outil historique (recomposé : app_state + modules repris) ; ETag = version                                         |
| GET,HEAD | `/legacy/data/state.json`                         | metier                     | État (chemin relatif utilisé par le fichier historique) (hors OpenAPI)                                                       |
| PUT      | `/api/legacy/state`                               | metier                     | Enregistrement depuis /legacy (If-Match "vN" ; droits vérifiés par module ; refusé sur les modules repris)                   |
| GET      | `/api/legacy/modules`                             | metier                     | Modules de l’outil historique et leur statut (repris dans la nouvelle interface ou non)                                      |
| GET      | `/api/refs`                                       | metier                     | Référentiels pour les rattachements (mesures, écarts, processus, fournisseurs, objectifs)                                    |
| GET      | `/legacy`                                         | public                     | Redirection vers /legacy/ (hors OpenAPI)                                                                                     |
| GET      | `/legacy/`                                        | public                     | Outil historique (fichier unique adapté) (hors OpenAPI)                                                                      |
| GET      | `/legacy/index.html`                              | public                     | Outil historique (hors OpenAPI)                                                                                              |
| GET      | `/legacy/shim.js`                                 | public                     | Intégration de l’outil historique au serveur (hors OpenAPI)                                                                  |
| GET      | `/legacy/lib/:file`                               | public                     | Bibliothèques locales de l’outil historique (hors OpenAPI)                                                                   |
| POST     | `/api/admin/import/simulate`                      | import_export:modifier     | Simulation d’un import legacy : validation et rapport par module, AUCUNE écriture en base                                    |
| POST     | `/api/admin/import/apply`                         | import_export:modifier     | Application d’un import simulé (transaction, sauvegarde préalable, traçabilité, temps réel)                                  |
| GET      | `/api/admin/import`                               | import_export:lire         | Historique des imports                                                                                                       |
| GET      | `/api/admin/import/:id`                           | import_export:lire         | Détail d’un import (rapport complet)                                                                                         |
| GET      | `/api/admin/import/:id/file`                      | import_export:exporter     | Fichier brut d’un import (déchiffré)                                                                                         |
| POST     | `/api/admin/import/:id/undo`                      | import_export:modifier     | Annulation d’un import (si aucune modification ultérieure n’a touché les mêmes modules)                                      |
| GET      | `/api/admin/export/legacy`                        | import_export:exporter     | Export au format legacy (enveloppe, schéma 15), relisible par l’outil historique                                             |
| GET      | `/api/settings`                                   | parametres:lire            | Paramètres : toutes les sections, avec leur version et le droit d’écriture                                                   |
| GET      | `/api/settings/:section`                          | parametres:lire            | Paramètres : une section (ETag = version)                                                                                    |
| PUT      | `/api/settings/:section`                          | parametres:modifier        | Paramètres : enregistrement d’une section (If-Match obligatoire ; Sécurité : parametres:administrer)                         |
| GET      | `/api/settings/logo`                              | public                     | Logo de l’organisation (PNG ou JPEG), affiché aussi sur la page de connexion                                                 |
| PUT      | `/api/settings/logo`                              | parametres:modifier        | Dépôt du logo (PNG ou JPEG, 256 Ko au plus)                                                                                  |
| DELETE   | `/api/settings/logo`                              | parametres:modifier        | Retrait du logo                                                                                                              |
| GET      | `/api/admin/business-policy`                      | administration:lire        | Configuration de l’environnement et version immuable                                                                         |
| GET      | `/api/admin/business-policy/history`              | administration:lire        | Cent dernières publications de configuration (sans contenu métier)                                                           |
| GET      | `/api/admin/business-policy/versions/:version`    | administration:lire        | Consulter une définition passée immuable                                                                                     |
| POST     | `/api/admin/business-policy/preview`              | administration:administrer | Valider et simuler un brouillon sans aucune écriture                                                                         |
| PUT      | `/api/admin/business-policy`                      | administration:administrer | Publier une nouvelle version prévisualisée, avec audit transactionnel                                                        |
| GET      | `/api/grc/:smsi/tasks`                            | metier                     | Liste paginée des actions natives et historiques sans duplication                                                            |
| PUT      | `/api/grc/:smsi/method`                           | metier                     | Choisir la version méthodologique par défaut du SMSI, sans recalculer le registre                                            |
| GET      | `/api/grc/:smsi/member-candidates`                | metier                     | Comptes actifs proposés pour les membres du périmètre                                                                        |
| GET      | `/api/grc/:smsi/dashboard`                        | metier                     | Tableau de bord SMSI selon les référentiels activés, la politique et les droits                                              |
| GET      | `/api/grc/:smsi/frameworks/:id/history`           | metier                     | Publications versionnées des exigences                                                                                       |
| GET      | `/api/grc/:smsi/report`                           | metier                     | Rapport comité SMSI et audit, filtré par les droits                                                                          |
| PUT      | `/api/grc/:smsi/policy`                           | metier                     | Adopter explicitement une politique métier compatible                                                                        |
| GET      | `/api/grc/:smsi/export/authorize`                 | metier                     | Autoriser et tracer un export du périmètre                                                                                   |
| GET      | `/api/grc/:smsi/sources`                          | metier                     | Sélectionner un objet ou une version de preuve existants                                                                     |
| POST     | `/api/grc/legacy-tasks/complete`                  | metier                     | Réaliser une action historique sans créer de copie                                                                           |
| GET      | `/api/grc/smsis`                                  | metier                     | SMSI accessibles                                                                                                             |
| POST     | `/api/grc/smsis`                                  | metier                     | Créer un périmètre SMSI restreint                                                                                            |
| GET      | `/api/grc/:smsi/members`                          | metier                     | Membres du SMSI                                                                                                              |
| PUT      | `/api/grc/:smsi/members`                          | metier                     | Attribuer un accès au SMSI                                                                                                   |
| DELETE   | `/api/grc/:smsi/members/:id`                      | metier                     | Révoquer un accès au SMSI                                                                                                    |
| GET      | `/api/grc/:smsi/policy`                           | metier                     | Politique métier épinglée au SMSI                                                                                            |
| GET      | `/api/grc/:smsi/owners`                           | metier                     | Responsables autorisés                                                                                                       |
| GET      | `/api/grc/:smsi/objects`                          | metier                     | Registre paginé sans duplication                                                                                             |
| POST     | `/api/grc/:smsi/objects`                          | metier                     | Créer une fiche liée au SMSI                                                                                                 |
| GET      | `/api/grc/:smsi/objects/:id`                      | metier                     | Consulter une fiche                                                                                                          |
| PUT      | `/api/grc/:smsi/objects/:id`                      | metier                     | Modifier avec contrôle de concurrence                                                                                        |
| DELETE   | `/api/grc/:smsi/objects/:id`                      | metier                     | Archiver sans supprimer les décisions                                                                                        |
| GET      | `/api/grc/:smsi/objects/:id/history`              | metier                     | Historique immuable des fiches                                                                                               |
| GET      | `/api/grc/:smsi/links`                            | metier                     | Relations bidirectionnelles filtrées par les droits                                                                          |
| POST     | `/api/grc/:smsi/links`                            | metier                     | Lier deux objets existants                                                                                                   |
| DELETE   | `/api/grc/:smsi/links/:id`                        | metier                     | Retirer une relation                                                                                                         |
| GET      | `/api/grc/:smsi/tasks/window`                     | metier                     | Actions synchronisées pour calendrier et planning                                                                            |
| GET      | `/api/grc/:smsi/tasks/dashboard`                  | metier                     | Indicateurs d’actions selon le workflow du SMSI                                                                              |
| GET      | `/api/grc/:smsi/series/:id/occurrences`           | metier                     | Occurrences uniques et historique de récurrence                                                                              |
| GET      | `/api/grc/notifications`                          | metier                     | Rappels personnels respectant les accès SMSI                                                                                 |
| PUT      | `/api/grc/notifications/:id/read`                 | metier                     | Marquer un rappel comme lu                                                                                                   |
| POST     | `/api/grc/:smsi/frameworks/preview`               | metier                     | Simuler une publication de référentiel                                                                                       |
| POST     | `/api/grc/:smsi/frameworks/publish`               | metier                     | Publier un référentiel et ses exigences versionnées                                                                          |
| GET      | `/api/grc/:smsi/frameworks/:id/versions/:version` | metier                     | Exigences de la version exacte d’un référentiel                                                                              |
| PUT      | `/api/grc/:smsi/frameworks/:id/activation`        | metier                     | Activer un référentiel sans imposer ISO ou HDS                                                                               |
| POST     | `/api/grc/:smsi/mappings/:id/validate`            | metier                     | Décision humaine sur une correspondance                                                                                      |
| POST     | `/api/grc/:smsi/import/preview`                   | metier                     | Simulation locale d’importation                                                                                              |
| POST     | `/api/grc/:smsi/import/commit`                    | metier                     | Importation atomique confirmée par un humain                                                                                 |
| GET      | `/api/grc/methods/templates/:family`              | metier                     | Modèle méthodologique organisationnel à adapter                                                                              |
| GET      | `/api/grc/:smsi/methods`                          | metier                     | Méthodes publiées du SMSI                                                                                                    |
| GET      | `/api/grc/:smsi/methods/:id/history`              | metier                     | Versions immuables de la politique d’appréciation                                                                            |
| POST     | `/api/grc/:smsi/methods/preview`                  | metier                     | Valider une politique méthodologique complète                                                                                |
| POST     | `/api/grc/:smsi/methods/publish`                  | metier                     | Publier sans recalculer les décisions précédentes                                                                            |
| POST     | `/api/grc/:smsi/risks/:id/preview`                | metier                     | Calcul selon la méthode exacte sans écriture                                                                                 |
| POST     | `/api/grc/:smsi/risks/:id/evaluate`               | metier                     | Enregistrer une appréciation brute et résiduelle immuable                                                                    |
| GET      | `/api/grc/:smsi/risks/:id/evaluations`            | metier                     | Historique des appréciations et décisions                                                                                    |
| POST     | `/api/grc/:smsi/treatments/:id/action`            | metier                     | Générer une action sans modifier le résiduel                                                                                 |
| GET      | `/api/grc/:smsi/risk-map`                         | metier                     | Projection cartographique du registre selon chaque méthode                                                                   |
| GET      | `/api/grc/:smsi/pilotage/export`                  | metier                     | Exporter le registre et ses décisions selon les droits du demandeur                                                          |
| GET      | `/api/grc/:smsi/pilotage/history`                 | metier                     | Décisions de pilotage immuables, filtrées par les droits                                                                     |
| POST     | `/api/grc/:smsi/pilotage/decisions`               | metier                     | Enregistrer une réalisation, vérification ou validation tracée                                                               |
| GET      | `/api/grc/:smsi/pilotage/legacy/:key`             | metier                     | Registre historique paginé sans copie                                                                                        |
| GET      | `/api/grc/:smsi/pilotage/legacy/:key/:id`         | metier                     | Lire une fiche historique dans son format métier                                                                             |
| PUT      | `/api/grc/:smsi/pilotage/legacy/:key/:id`         | metier                     | Modifier la source historique en préservant les champs non modélisés                                                         |
| POST     | `/api/grc/:smsi/pilotage/findings`                | metier                     | Ajouter un constat dans le registre existant des écarts                                                                      |
| POST     | `/api/grc/:smsi/pilotage/controls/:id/schedule`   | metier                     | Planifier un contrôle via le moteur partagé de récurrences                                                                   |
| GET      | `/api/grc/:smsi/pilotage/journeys/:id`            | metier                     | Reprendre un parcours guidé avec critères et validations historisées                                                         |
| GET      | `/api/grc/:smsi/pilotage/improvement-indicators`  | metier                     | Indicateurs d’amélioration basés sur les dates et données disponibles                                                        |
| GET      | `/api/account/preferences`                        | auth                       | Préférences d’affichage (taille, densité, thème, colonnes), communes à tous les appareils                                    |
| PUT      | `/api/account/preferences`                        | auth                       | Enregistrement des préférences d’affichage                                                                                   |
| GET      | `/api/admin/murs`                                 | administration:lire        | Écrans muraux                                                                                                                |
| POST     | `/api/admin/murs`                                 | administration:administrer | Création d’un écran mural : lien d’activation à usage unique (24 h), affiché une seule fois                                  |
| DELETE   | `/api/admin/murs/:id`                             | administration:administrer | Révocation d’un écran mural (effet immédiat)                                                                                 |
| POST     | `/api/mur/activer`                                | public                     | Activation d’un écran mural avec son code (pose le cookie de l’écran)                                                        |
| GET      | `/api/mur/synthese`                               | mur                        | Synthèse affichée par le tableau de bord et l’écran mural (lecture seule, selon les droits)                                  |
| GET      | `/api/mur/events`                                 | mur                        | Flux temps réel de l’écran mural (mises à jour des données métier uniquement)                                                |
| GET      | `/api/carto/objects`                              | cartographie:lire          | Cartographie : objets de la plateforme (filtrés selon les droits de leur module d’origine)                                   |
| GET      | `/api/carto/maps`                                 | cartographie:lire          | Cartographie : cartes (une par vue)                                                                                          |
| GET      | `/api/carto/maps/:id`                             | cartographie:lire          | Cartographie : une carte (ETag = version)                                                                                    |
| POST     | `/api/carto/maps`                                 | cartographie:modifier      | Cartographie : création d’une carte (vierge ou générée), une par vue                                                         |
| PUT      | `/api/carto/maps/:id`                             | cartographie:modifier      | Cartographie : enregistrement (If-Match obligatoire ; 412 si la carte a été modifiée entre-temps)                            |
| DELETE   | `/api/carto/maps/:id`                             | cartographie:supprimer     | Cartographie : suppression d’une carte et de ses versions (les objets de la plateforme sont conservés)                       |
| GET      | `/api/carto/maps/:id/versions`                    | cartographie:lire          | Cartographie : versions figées d’une carte (la plus récente d’abord)                                                         |
| GET      | `/api/carto/maps/:id/versions/:v`                 | cartographie:lire          | Cartographie : une version figée, avec sa disposition                                                                        |
| POST     | `/api/carto/maps/:id/versions`                    | cartographie:modifier      | Cartographie : figer la carte enregistrée (20 versions au plus, la plus ancienne est supprimée)                              |
| POST     | `/api/carto/maps/:id/versions/:v/restore`         | cartographie:modifier      | Cartographie : restauration d’une version (If-Match de la carte ; nouvelle version de la carte)                              |
| DELETE   | `/api/carto/maps/:id/versions/:v`                 | cartographie:supprimer     | Cartographie : suppression d’une version figée                                                                               |
| PUT      | `/api/carto/settings/issue-kind`                  | cartographie:modifier      | Cartographie : nature d’un enjeu (externe, interne ; null = nature déduite)                                                  |
| POST     | `/api/carto/exports`                              | cartographie:exporter      | Cartographie : journalisation d’un export (PNG, SVG, PDF, JSON produit par le navigateur)                                    |
