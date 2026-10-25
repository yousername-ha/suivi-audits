# ADR 0054 — Bibliothèque partagée des sources de risque (SR/OV)

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 10 du 25/10/2026 (dossier 019-07) : les sources de risque et objectifs visés forment une **bibliothèque partagée réutilisable**, et non des objets propres à chaque étude. S'appuie sur les références typées de l'[ADR 0027](0027-risques-ebios-rm-iso27005.md) et sur l'immuabilité des versions de fiches.

## Décision

- **Une source de risque sans étude propriétaire est une source de la bibliothèque.** C'est un objet `risk_source` du périmètre dont le champ « Étude » est vide : catégorie, motivations, ressources et objectifs visés typiques. Il est versionné comme toute fiche (historique immuable) et gouverné par les droits du module Pilotage du périmètre. Les sources saisies dans une étude restent possibles (sources propres à l'étude).
- **Les études référencent, elles ne copient pas.** Dans l'atelier 2, « Choisir une source dans la bibliothèque » crée le couple source / objectif visé de l'étude avec une **référence** à la source (`sourceRef`), la **version** de la source au moment du choix (`sourceVersion`) et l'objectif visé proposé. Les cotations du couple (motivation, ressources, activité, pertinence, couple retenu, justification) restent **propres à l'étude** : aucune évaluation n'est partagée.
- **La dérive est signalée, jamais appliquée.** Si la source évolue après le choix, le couple affiche « Source modifiée depuis le choix (version N) » ; l'atelier est aussi marqué « modifié depuis la validation », car la source en fait partie. « Marquer comme relue » rend la version retenue égale à la version actuelle, sans toucher aux cotations.
- **Vue de la bibliothèque** : la liste des études présente la bibliothèque (source, catégorie, version, nombre de couples et d'études qui l'utilisent, ouverture de la fiche, ajout d'une source) ; `GET /api/grc/:smsi/risk-library` (droit `pilotage:lire`).
- **Lecture par la vue d'étude** : la vue d'une étude inclut les sources de bibliothèque que ses couples référencent (marquées « Bibliothèque »), de sorte que les chemins, le suivi et les pictogrammes les affichent comme celles de l'étude.

## Ce qui n'est pas fait

- La bibliothèque est **propre à un périmètre** et partagée entre ses études ; elle n'est pas héritée des périmètres parents ni commune à toute l'organisation (ce serait un autre modèle de droits, comme les référentiels de la bibliothèque).
- Les objectifs visés ne forment pas un catalogue distinct : ils sont portés par la source (texte libre) et recopiés comme proposition dans le couple.
- Pas de migration des sources existantes vers la bibliothèque : une source déjà propre à une étude le reste, tant que son champ « Étude » n'est pas vidé.
- Pas de blocage de l'archivage d'une source utilisée ; un couple dont la source est archivée garde sa référence.

## Conséquences

Aucune migration : les sources de bibliothèque sont des `risk_source` existants sans étude ; un champ facultatif `sourceVersion` s'ajoute au couple (`sr_ov`). Le formulaire de fiche d'une étude clôturée n'est pas concerné.
