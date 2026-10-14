# ADR 0037 — Standards verrouillés, copies personnalisables, jeu de test et contrôle des relations

Statut : Acceptée. Date : 13/10/2026.

## Contexte

Les référentiels de l'outil de suivi (ISO 27001, Annexe A, HDS, ReCyF) ne se choisissaient qu'après une importation explicite, avec motif et alertes rouges. Il fallait pouvoir les sélectionner d'emblée **sans alerte ni blocage**, tout en gardant les versions sources inchangées. Par ailleurs, la plateforme n'avait ni jeu de données de test cohérent ni contrôle des références logiques (celles que PostgreSQL ne garantit pas).

## Décisions

1. **Standards disponibles d'emblée** : la bibliothèque et la page Périmètres proposent les standards lus dans l'outil de suivi ; un geste (« Ajouter à la bibliothèque », ou le choix dans le sélecteur de rattachement) les publie en version 1, sans motif ni confirmation. Un standard aux données incomplètes est indiqué sans alerte et ne bloque pas les autres.
2. **Version source verrouillée** : toute version publiée est immuable ; une version **sans** `derivedFrom` est une version source, sur laquelle on **n'ajoute pas** d'exigence (refus 422 « créez une copie »). **Créer une copie** produit un référentiel de l'organisation (statut `organisation`, jamais normatif, `derivedFrom` = origine) auquel on ajoute ou remplace des exigences, chaque ajout publiant une nouvelle version immuable. « Nouvelle édition » reste l'import explicite d'une édition ultérieure du standard.
3. **Jeu de données de test** (`suivi jeu-de-test <compte> --confirmer`) : entièrement fictif, cohérent (processus, objectifs, indicateurs atteints / non atteints / calculés, fournisseurs évalués, écarts, audits, revue, référentiel de démonstration, risques appréciés, actions, série, opportunités et liens), relatif au jour du chargement, **refusé sur une instance qui contient déjà des données de pilotage** (les données de départ restent vides), chargé **par l'API publique** au nom d'un administrateur (mêmes validations que l'interface).
4. **Contrôle des relations** (`suivi controle-relations`, intégré à `controle-donnees`) : références logiques de l'état historique, liens et références des fiches du registre commun, méthodes, référentiels rattachés, critères et rattachements des fournisseurs. Lecture seule ; une anomalie est signalée, jamais corrigée. La mise à jour **n'échoue pas** sur une anomalie préexistante : elle avertit des seules anomalies **apparues** pendant la mise à jour.
5. **Migration PostgreSQL 17 → 18** (ADR 0035) : en plus des nombres de lignes, les contraintes (clés étrangères, primaires, uniques, contrôles) sont comparées avant et après la restauration et doivent toutes être validées.

## Conséquences

- Aucune migration SQL. Le jeu de test n'est jamais chargé automatiquement ni par une mise à jour.
- Le référentiel de démonstration et les données du jeu de test ne reproduisent aucun texte normatif.
