# Produit : ce que fait la plateforme

Application web auto-hébergée de pilotage du GCS Normand'e-Santé : qualité (ISO 9001), sécurité de l'information
(ISO/IEC 27001, HDS), continuité, risques, audits, écarts et actions, fournisseurs, preuves. Une base PostgreSQL
normalisée, un enregistrement par élément, des droits par module et action, un journal d'audit et une mise à jour en temps
réel entre utilisateurs. Aucune donnée réelle n'est livrée : les données de départ sont vides et les jeux d'essai
anonymisés.

Cette page résume l'état courant. Le détail par fonction est dans l'[inventaire fonctionnel](02_FONCTIONNALITES/INVENTAIRE_FONCTIONNEL.md),
les limites dans le [rapport de recette](05_RECETTE/RAPPORT_RECETTE.md), les évolutions dans le [journal des modifications](../CHANGELOG.md).

## Menu Pilotage

Le menu **Pilotage** est commun à toutes les démarches (qualité, sécurité, continuité) : il ne faut pas créer un « SMSI » pour
une démarche qualité. Les droits et les modules activés déterminent les rubriques visibles.

| Groupe | Contenu |
| --- | --- |
| Vue d'ensemble | Synthèse, parcours guidé, périmètres (organisation → entité → périmètre) |
| Contexte et responsabilités | Périmètre et contexte, parties intéressées, SWOT par processus, PESTEL, rôles et responsabilités |
| Objectifs et indicateurs | Processus, objectifs, indicateurs (états calculés, valeurs historiques) |
| Gestion de l'audit | Carte du prochain audit, couverture du cycle, déroulé, planning, participants |
| Conformité | Référentiels et exigences, bibliothèque, déclaration d'applicabilité (ISO 27001, Annexe A, HDS), mesures, correspondances, rapprochements, **couverture par exigence**, applications à intégrer (GAP), conformité IA |
| Fournisseurs | Fournisseurs de l'organisation et du périmètre, critères, évaluations par le clausier, revues des accès |
| Risques | Registre, opportunités, études EBIOS RM, cartographie des risques, traitements, scénarios et actifs, configuration des analyses |
| Écarts et actions | Amélioration continue, plan d'actions, tâches récurrentes |
| Preuves et contrôles | Registre des preuves, plan de contrôle |
| Plans et revues | BIA, continuité, exercices et RETEX, plans de formation et de sensibilisation, audits internes, **revues de direction** |
| Incidents et crise | Registre, qualification, cellule de crise, contacts, scénarios et check-lists |
| Gestion CRRC | Établissements, offres, sauvegardes, restaurations, alertes, rapports mensuels |
| Budget | Plan d'investissement |
| Outils | Rappels, import et rapports, configuration du pilotage |

À côté : tableau de bord, documents et liens (chiffrés), cartographie du SMSI, évaluations IA, **exports Excel**, écran mural,
paramètres, administration (comptes, groupes, rôles, sessions, journal, versions, système, import).

## Exports

- **Excel par rubrique** (menu « Exports Excel », droit d'export) : douze groupes en Excel classique (données brutes, filtres)
  ou Excel pro (sommaire, mise en forme), plus l'export complet. Les rubriques non lisibles par la personne sortent vides.
- **Revue de direction** : compte rendu Word, support PowerPoint et classeur Excel générés par le serveur.
- Import et export JSON au format historique (schéma 15), versions de l'état et restauration (administration).

Le pronostic de l'audit, les évaluations fournisseurs (clausier) et le GAP applications sont inclus. Le référentiel ReCyF n'a pas d'export dédié : la page Couverture et les référentiels natifs le remplacent.

## Droits et sécurité

Permissions `module:action` contrôlées par le serveur sur chaque route ; rôles prédéfinis (Administrateur, RSSI, Contributeur,
Lecteur, Auditeur externe) et rôles personnalisés ; double authentification obligatoire ; CSP stricte sans script ni style en
ligne ; journal d'audit en ajout seul. Détail : [SECURITE](03_ARCHITECTURE/SECURITE.md).

## Données

Tous les modules métier sont dans des tables PostgreSQL ([ADR 0040](adr/0040-sortie-du-json-plat-modules-en-tables.md)) ;
`app_state` ne garde que la version et le verrou de l'état. L'écran de l'ancien outil est retiré
([ADR 0042](adr/0042-retrait-de-lecran-legacy.md)) ; son archive testable est sur la branche `archive/outil-legacy-autonome`.

## Limites connues

- La recette de l'ensemble sur le serveur réel du RSSI reste à exécuter (voir [PROJECT_STATUS](../PROJECT_STATUS.md)).
- Les grilles officielles non disponibles ne sont pas intégrées ; aucun texte normatif sous licence n'est fourni.
- Des tests de bout en bout (Playwright) échouent parfois en CI puis réussissent au rejeu (BUG-011). La CI rejoue désormais une fois chaque test en échec et signale les tests instables par une annotation, pour les corriger un à un.
