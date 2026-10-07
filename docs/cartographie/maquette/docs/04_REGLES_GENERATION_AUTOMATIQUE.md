# 4. Règles de génération automatique

## 4.1 Objectif

Créer une première cartographie exploitable à partir des données existantes, sans écraser les choix visuels de l’utilisateur.

## 4.2 Étapes

1. Résoudre le périmètre demandé.
2. Charger les objets selon les types sélectionnés.
3. Charger les relations selon la profondeur configurée.
4. Normaliser les données en `nodes` et `edges`.
5. Affecter une zone logique à chaque objet.
6. Appliquer un layout automatique.
7. Détecter les collisions.
8. Générer la frontière du périmètre.
9. Positionner les catégories périphériques.
10. Sauvegarder comme nouvelle carte ou nouvelle version.

## 4.3 Placement proposé — Vue contexte

- centre : SMSI / organisation ;
- intérieur périmètre : processus, applications, infrastructures, sites ;
- extérieur proche : fournisseurs, parties intéressées ;
- bande haute : enjeux externes ;
- bande basse : enjeux internes ;
- panneau latéral : inspecteur ;
- liens secondaires masqués par défaut si le graphe est dense.

## 4.4 Placement proposé — Vue processus

- processus de réalisation : ligne principale ;
- processus de support : zone basse ;
- processus de pilotage : zone haute ;
- sous-processus : enfants du parent ;
- `flows_to` : liens principaux ;
- `supports` / `depends_on` : pointillés.

## 4.5 Règles anti-chaos

- maximum de profondeur par défaut : 1 ;
- maximum de nodes générés configurable ;
- au-delà d’un seuil, demander confirmation ;
- relations secondaires cachées par défaut ;
- possibilité de `déplier` un node ;
- regrouper les sous-processus ;
- regrouper les éléments par type.

## 4.6 Synchronisation ultérieure

À chaque ouverture ou actualisation :

1. comparer les `objectRef` présents à l’état métier ;
2. mettre à jour nom, code, statuts, tags et relations ;
3. conserver positions et tailles ;
4. signaler les objets supprimés ou inaccessibles ;
5. proposer d’ajouter les nouvelles dépendances plutôt que les injecter automatiquement, sauf configuration explicite.

## 4.7 Gestion des objets supprimés

Si un objet métier n’existe plus :

- afficher un statut `Objet indisponible` ;
- conserver temporairement la position ;
- proposer `Retirer de la carte` ;
- ne pas supprimer silencieusement la représentation lors du chargement.

## 4.8 Auto-layout

Modes à prévoir :

- `context-radial`
- `context-layered`
- `process-horizontal`
- `process-layered`
- `compact`

L’auto-layout est une action explicite après qu’un utilisateur a travaillé manuellement la carte.

Ne pas recalculer automatiquement les positions à chaque synchronisation.
