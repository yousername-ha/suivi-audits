# Décisions de pilotage

Les décisions d'architecture et de conception sont dans les [ADR](adr/README.md). Cette page recense les décisions de
pilotage qui orientent le travail et qui ne sont pas toutes des ADR. En cas de doute sur une décision, ne rien changer et poser la question.

| Sujet | Décision | Conséquence |
| --- | --- | --- |
| Branches | Trois branches : `main` (version Docker unique, publiée par étiquette `vX.Y.Z`), `claude-suivi-smsi` (travail), `legacy` (outil historique autonome). Les autres branches sont conservées sous les étiquettes `archive/*`. | `main` n'évolue que par pull request depuis `claude-suivi-smsi`, après CI verte. La branche `legacy` n'est jamais modifiée. |
| Étiquettes | Seul le RSSI pousse les étiquettes de version. | L'agent prépare la publication (journal, migrations) et indique la branche à étiqueter. |
| Dépôt public | Aucune donnée réelle ni secret, y compris dans les messages de commit. | Données de départ vides, fixtures anonymisées. |
| Reprise de la branche de travail | Après une fusion, la branche de travail repart de `main`. | Pas de commits empilés sur un historique déjà fusionné. |
| Sortie du JSON plat | Les modules passent en tables d'abord ; l'import reste non destructif ; le retrait de l'ancien écran vient après la recette. | [ADR 0040](adr/0040-sortie-du-json-plat-modules-en-tables.md). |
| Référentiels et périmètres | Un référentiel couvre un périmètre entier ; tâches, actions, écarts, DdA et risques sont dans ce périmètre ; un onglet gère les référentiels ; Pilotage regroupe les menus ISO 27001 et 9001. | Aucun changement de structure en cas de doute. Voir [REFERENTIALS](REFERENTIALS.md). |
| Ancien outil | L'écran `/legacy` est retiré ; l'outil autonome est sauvegardé sur la branche `archive/outil-legacy-autonome` (archive ZIP testable, somme de contrôle). | [ADR 0042](adr/0042-retrait-de-lecran-legacy.md). |
| Périmètre du retrait | On retire l'écran mais on garde les exports Excel (repris côté serveur), l'import et l'export JSON, les versions de l'état. La page ReCyF est couverte par la page Couverture et les référentiels natifs. | Pronostic d'audit, clausier et GAP applications en export Excel restent à reprendre. |
| Documentation | Structure 01 à 08 et registres conservés ; documents de travail datés déplacés dans `docs/archive/`. | Voir [index](00_INDEX.md). Aucun document supprimé. |
