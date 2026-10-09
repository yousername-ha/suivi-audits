# ADR 0007 — Transition depuis l'outil historique

**Statut** : acceptée (phase 0)

## Contexte
L'outil historique (`app/public/index.html`) reste servi sous `/legacy` jusqu'à la reprise de tous ses modules. Il ne doit jamais exister deux sources modifiables pour la même donnée (`docs/legacy/IMPORT-LEGACY.md` § 4).

## Décision
- Le module legacy est l'unité de reprise : chaque clé de premier niveau du format (`findings`, `processes`…), selon le contrat `LEGACY-FORMAT.md`.
- **Phase 0** : aucun module n'est repris, et toutes les données legacy vivent dans `app_state.data`. Les phases 1 à 3 enregistrent un « mapper » (`ModuleMapper` : lecture et écriture des tables) par module repris.
- `/legacy` reçoit un **état recomposé** (`app_state` + modules repris, relus depuis leurs tables). Le serveur refuse avec **409** toute écriture qui modifie un module repris ; ce module n'est jamais stocké dans `app_state`. L'interface affiche « Module géré dans la nouvelle interface ».
- L'import (simulation, Initialiser, Fusionner, Remplacer un module, annulation) est calculé par **une seule fonction pure** (`planImport`, `packages/shared`). La simulation ne peut donc rien écrire, et l'application enregistre exactement ce qui a été simulé (contrôle de l'empreinte du fichier).
- Le schéma 15 ajoute un identifiant stable à 9 listes. L'algorithme est déterministe et identique dans l'outil historique et dans la nouvelle version (test de parité).

## Conséquences
- Un module se reprend en quatre gestes : tables et migration, mapper, mise à jour de `MAPPING-LEGACY.md`, test d'aller-retour.
- Les tests de couverture du contrat et d'aller-retour sur la fixture protègent contre toute perte de champ.
