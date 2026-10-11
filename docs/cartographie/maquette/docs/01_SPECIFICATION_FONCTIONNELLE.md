# 1. Spécification fonctionnelle

## 1.1 Finalité

Le Map Builder doit permettre de représenter graphiquement le contexte d’un SMSI et les processus du système de management à partir des données déjà saisies dans la plateforme.

La cartographie n’est pas un simple module de dessin. Elle est une **projection graphique des données de gouvernance** enrichie par une disposition visuelle éditable.

## 1.2 Écran principal

L’écran conserve la structure de la maquette de référence :

- barre de navigation verticale ;
- panneau gauche de filtres et de légende ;
- canvas central ;
- panneau droit de détail de l’objet sélectionné ;
- barre supérieure avec recherche et changement de vue.

## 1.3 Bascule de vue

Contrôle segmenté :

- `Vue contexte`
- `Vue processus`

La bascule change le **preset d’affichage**, pas le moteur de rendu.

### Vue contexte

Peut afficher :

- centre SMSI / organisation ;
- frontière du périmètre ;
- processus ;
- applications et SI ;
- infrastructures ;
- sites ;
- fournisseurs ;
- parties intéressées ;
- enjeux internes ;
- enjeux externes ;
- exigences ;
- risques en option.

### Vue processus

Peut afficher :

- processus de réalisation ;
- processus de support ;
- processus de pilotage si présents ;
- sous-processus ;
- flux principaux ;
- dépendances ;
- liens vers exigences, risques, parties intéressées ou composants SI.

## 1.4 Modes de travail

### Consultation

- sélectionner un objet ;
- afficher sa fiche à droite ;
- filtrer par référentiel ;
- filtrer par catégorie ;
- rechercher ;
- zoomer / dézoomer ;
- recentrer ;
- exporter.

### Édition

Activation via `Modifier la cartographie`.

Fonctions :

- ajouter un objet ;
- importer depuis la plateforme ;
- créer une relation ;
- supprimer un objet de la vue sans supprimer la donnée métier ;
- déplacer ;
- redimensionner ;
- grouper ;
- changer la visibilité ;
- définir `dans le périmètre` / `hors périmètre` si l’utilisateur est autorisé à modifier cette propriété métier ;
- modifier le style de représentation si autorisé ;
- annuler / rétablir ;
- enregistrer.

## 1.5 Ajout d’objet

Bouton `Ajouter` avec types configurables :

- Processus
- Sous-processus
- Partie intéressée
- Enjeu interne
- Enjeu externe
- Application
- Infrastructure
- Site
- Fournisseur
- Exigence
- Risque
- Objet libre, si autorisé

Deux origines :

1. `Créer un nouvel objet` — si la plateforme le permet.
2. `Ajouter depuis la plateforme` — sélection d’un objet existant.

## 1.6 Import depuis la plateforme

Lorsqu’un utilisateur sélectionne un objet existant, proposer :

- `Ajouter uniquement l’objet`
- `Ajouter l’objet + dépendances directes`
- `Ajouter l’objet + tous les éléments liés`

La profondeur maximale est configurable afin d’éviter une carte illisible.

## 1.7 Génération automatique

Bouton `Générer ma cartographie`.

Assistant proposé :

### Référentiels

- ISO 27001
- HDS
- ISO 9001
- autres référentiels configurés dans la plateforme

### Éléments à inclure

- Processus
- Parties intéressées
- Enjeux
- Applications
- Infrastructures
- Fournisseurs
- Sites
- Risques
- Exigences

### Périmètre

- toute l’organisation ;
- périmètre SMSI ;
- périmètre sélectionné ;
- ensemble d’objets sélectionnés.

### Relations

- relations principales ;
- toutes les relations ;
- profondeur 1 à N.

### Disposition

- automatique ;
- concentrique ;
- hiérarchique ;
- processus horizontal ;
- organisation manuelle.

## 1.8 Frontière de périmètre

Le périmètre est un conteneur graphique spécifique.

Propriétés :

- nom ;
- statut ;
- référentiels associés ;
- objets inclus ;
- style ;
- texte descriptif ;
- version / date d’effet si gérées par la plateforme.

Les objets peuvent être :

- dedans ;
- dehors ;
- liés au périmètre sans être inclus.

## 1.9 Panneau de détail

Au clic sur un objet, afficher un inspecteur à droite.

Champs possibles :

- code ;
- nom ;
- type ;
- responsable / propriétaire ;
- statut de périmètre ;
- objectifs ;
- référentiels ;
- exigences ;
- risques ;
- processus liés ;
- SI / infrastructures liés ;
- KPI ;
- documents ;
- historique / activité récente.

Le contenu dépend du type d’objet.

## 1.10 Synchronisation

Règle essentielle :

- la plateforme est source de vérité pour les attributs métier ;
- la carte est source de vérité pour les attributs de présentation.

Exemple :

- le nom de `PR04` change dans la plateforme → la carte affiche le nouveau nom ;
- sa position `x/y` reste inchangée ;
- sa taille reste inchangée ;
- sa visibilité reste inchangée.

## 1.11 Suppression

Deux notions distinctes :

- `Retirer de la carte` : supprime uniquement l’instance graphique.
- `Supprimer l’objet` : action métier séparée, soumise aux droits et idéalement réalisée hors du Map Builder.

## 1.12 Versionnement

Prévoir :

- sauvegarde manuelle ;
- autosave optionnel ;
- historique de versions ;
- restauration ;
- auteur ;
- date ;
- commentaire de version ;
- comparaison future possible.

## 1.13 Export

Minimum :

- PNG haute résolution ;
- PDF ;
- éventuellement SVG si le besoin métier le justifie.

L’export doit pouvoir :

- inclure ou non le panneau latéral ;
- inclure la légende ;
- inclure les métadonnées de la carte ;
- choisir portrait / paysage ;
- exporter la vue courante ou la carte complète.
