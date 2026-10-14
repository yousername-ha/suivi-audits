# Téléchargement local

## Maquette EBIOS RM pour Windows

**[Télécharger le ZIP](https://github.com/yousername-ha/suivi-audits/raw/refs/heads/legacy/downloads/EBIOS-RM-maquette-Windows.zip)** (2.09 Mio).

1. Extraire tout le ZIP.
2. Ouvrir le dossier `EBIOS-RM-maquette-Windows`.
3. Double-cliquer sur `DEMARRER.bat`.

Ouvrir « Scénario visuel » et sélectionner un chemin pour voir les flèches animées et les contours renforcés. Aucune installation de Python ou Node nécessaire. Cette archive contient la maquette, pas l’application métier complète.

[Sources et captures](../fonctionnalites-en-developpement/003-ebios-rm/maquettes/v001-parcours-anime/README.md) · [Empreinte SHA-256](EBIOS-RM-maquette-Windows.sha256).

Pour les cinq ateliers et leurs 18 étapes, lancer **TESTER-PARCOURS-COMPLET.bat**. Le ZIP inclut un guide de test complet.

## Dossier d’implémentation GRC transversal

[**Télécharger le ZIP complet**](https://github.com/yousername-ha/suivi-audits/raw/refs/heads/legacy/downloads/Dossier-implementation-GRC-transversal.zip) · [SHA-256](Dossier-implementation-GRC-transversal.sha256) · [Dossier et prompt](../fonctionnalites-en-developpement/_dossiers-transversaux/grc-transversal/v001-dossier-arm/README.md).

Analyse structurelle des 25 fichiers ARM, architecture, contrats, migration, recette, prompt IA, dix vues PNG, galerie HTML et PDF. Les données ARM réelles restent privées. Extraire le ZIP et ouvrir `README.md`, `Dossier-technique-GRC.pdf` ou `graphiques/DEMARRER.bat`. Il s’agit d’une spécification et de maquettes, pas d’une application métier complète.

## Maquette fonctionnelle ASTRA v2 — à valider

[**Télécharger le ZIP interactif**](https://github.com/yousername-ha/suivi-audits/raw/refs/heads/legacy/downloads/ASTRA-maquette-fonctionnelle-v2.zip) · [SHA-256](ASTRA-maquette-fonctionnelle-v2.sha256).

Extraire tout le ZIP, puis ouvrir `DEMARRER.bat` ou `index.html`. Menu simplifié inspiré de la vidéo, cinq ateliers EBIOS interactifs, matrices, cercle, scénarios animés, actions, tâches récurrentes, sauvegarde locale et export/import JSON. Le ZIP contient le guide et le rapport de 21 contrôles navigateur réussis. Les autres modules sont des fiches de démonstration simplifiées ; l’import ARM réel et la cartographie dynamique sont exclus. Le BAT n’a pas été testé nativement sous Windows.

**Publication pour téléchargement et test, sans validation implicite.** Les ZIP de maquette continuent à être publiés sur GitHub à chaque livraison ; le dossier final de codage est consolidé après validation utilisateur. Le runtime legacy reste inchangé.

## 021 — Registres d’écarts et plans d’action liés

[**Télécharger le ZIP testable**](ASTRA-021-registres-ecarts-v001.zip) · [SHA-256](ASTRA-021-registres-ecarts-v001.sha256) · [Sept aperçus et guide](../fonctionnalites-en-developpement/021-registres-ecarts/maquettes/v001-registres-lies/README.md). Extraire tout, puis lancer `DEMARRER.bat`.

Maquette ciblée à valider : registres d’écarts multiples, plans multiples, liens avec audits/exigences/périmètres, vérification de clôture et conformité distinctes. Données fictives ; HDS illustratif. La maquette EBIOS v2 reste disponible séparément.

## 021 — v002 : ajouter un écart depuis un audit

[**Télécharger la version courante**](ASTRA-021-registres-ecarts-v002.zip) · [SHA-256](ASTRA-021-registres-ecarts-v002.sha256) · [Nouveaux aperçus](../fonctionnalites-en-developpement/021-registres-ecarts/maquettes/v002-creation-depuis-audit/README.md).

Depuis Audits → Ajouter un écart : choisir un registre existant ou en créer un dans la même saisie. Audit et périmètre repris automatiquement. 24 contrôles exécutés, neuf captures ; toujours à valider. La v001 reste disponible plus haut.
