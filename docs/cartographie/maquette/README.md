# Map Builder SMSI — Dossier de handoff développeur

Document de conception historique. La cartographie native est implémentée en
SVG React, conformément à la [spécification v3](../SPEC-CARTOGRAPHIE-V3.md) et au
[DAT actuel](../../03_ARCHITECTURE/DAT.md). Les propositions React Flow/ELK de ce
pack ne sont pas la stack livrée. Les exemples JSON et TypeScript sont des
variantes distinctes, conservées comme références de conception.

Ce dossier décrit la conception d’un **éditeur de cartographie interactif** pour un système de management intégrant notamment ISO 27001, HDS et ISO 9001.

L’objectif n’est pas de produire une image statique : la cartographie est un **canvas éditable piloté par les données déjà présentes dans la plateforme**. L’utilisateur peut :

- partir d’une carte vide ;
- importer des objets déjà connus de la plateforme ;
- générer automatiquement une première carte à partir des relations existantes ;
- déplacer, redimensionner, relier, filtrer et masquer des objets ;
- conserver une disposition manuelle stable malgré les mises à jour métier ;
- basculer entre **Vue contexte** et **Vue processus** sans changer de moteur graphique ;
- exporter une représentation PNG/PDF pour audit, gouvernance ou comité.

## Contenu du pack

- `images/` : références visuelles et variantes de maquette.
- `docs/01_SPECIFICATION_FONCTIONNELLE.md` : comportement attendu de l’application.
- `docs/02_ARCHITECTURE_TECHNIQUE.md` : architecture front/back recommandée.
- `docs/03_MODELE_DE_DONNEES.md` : objets, relations et séparation métier/graphique.
- `docs/04_REGLES_GENERATION_AUTOMATIQUE.md` : règles de génération et de synchronisation.
- `docs/05_DESIGN_SYSTEM.md` : style visuel et composants.
- `docs/06_IMPLEMENTATION_REACT_FLOW.md` : proposition d’implémentation React Flow + ELK.
- `docs/07_BACKLOG_MVP.md` : découpage de réalisation.
- `docs/08_CRITERES_ACCEPTATION.md` : critères de recette.
- `config/` : configuration JSON directement exploitable comme base.
- `contracts/` : interfaces TypeScript de référence.
- `examples/` : données d’exemple basées sur les processus fournis.

## Référence UX principale

La direction graphique à conserver en priorité est `images/01_reference_vue_contexte_preferee.jpeg`.

Le principe retenu : **une même surface graphique et un même moteur**, avec des presets de visualisation différents :

- Vue contexte : périmètre, parties intéressées, enjeux, SI, sites, prestataires, exigences.
- Vue processus : processus, sous-processus, flux, dépendances et éléments support.

## Point d’architecture fondamental

Ne pas stocker la carte comme une image.

Séparer :

1. **Données métier** : objets et relations provenant de la plateforme.
2. **Présentation graphique** : positions, tailles, visibilité, groupes, zoom, style et préférences de la carte.

Ainsi un renommage de processus dans la plateforme est reflété automatiquement, mais la position de la carte reste inchangée.

## Stack conseillée

- Front : React + TypeScript.
- Canvas/graph : React Flow.
- Layout automatique : ELK.js ; Dagre possible pour les cas simples.
- API : REST ou GraphQL selon le socle existant.
- Persistance : base relationnelle ou document, avec versionnement des cartes.
- Export : rendu serveur ou client PNG/PDF selon architecture.

Aucune version de dépendance n’est imposée dans ce dossier : elles sont à figer au moment du démarrage du développement.
