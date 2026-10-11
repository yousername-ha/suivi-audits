# Cartographies et navigation du Legacy

## Où trouver les fonctions

| Rubrique | Entrées, dans l’ordre par défaut |
|---|---|
| Vue d’ensemble | Tableau de bord, Parcours guidé, Cartographies |
| Organisation et pilotage | Périmètres, Contexte et parties intéressées, Objectifs et indicateurs, Risques et études, Plan d’action et échéances |
| Référentiels et audits | Conformité et applicabilité, Programme CaRE, Qualité HAS, Gestion de l’audit, Preuves et justificatifs |
| Continuité et opérations | PCRA, Incidents et crise, Fournisseurs et accès, GAP, Gestion CRRC |
| Ressources et bilans | Investissements, Rapports et exports, Administration |

Les rubriques se replient ; celle de la page visitée s’ouvre automatiquement.
L’ouverture manuelle est mémorisée sur le poste. Les entrées peuvent être déplacées
dans leur rubrique sans mélanger les familles de fonctions. Les anciens liens
internes trouvent leur nouvelle rubrique ; les rôles utilisent le registre partagé
dans Périmètres. Aucun registre métier n’est déplacé ou supprimé.

## Utiliser Cartographies

L’entrée réunit quatre vues : **Contexte et dépendances**, **Processus et
interactions**, **Risques consolidés**, **Conformité et indicateurs**. Les deux
dernières réutilisent les vues existantes ; les deux premières importent le
canevas SVG historique, adapté au Legacy Sauge et au pilotage de plusieurs référentiels.

1. Choisir un établissement, un GHT ou tous les périmètres autorisés.
2. Cliquer sur **Générer** et sélectionner les types d’objets existants à afficher.
3. Utiliser **Modifier la disposition** pour déplacer/redimensionner les objets,
   créer des relations graphiques et annuler/rétablir les modifications.
4. Cliquer sur **Enregistrer**. Le succès est annoncé après confirmation du serveur.
5. Ouvrir **Versions** pour nommer une disposition, la consulter ou la restaurer.
6. Utiliser **Exporter** pour obtenir un SVG, PNG, PDF A3 ou JSON de disposition.

Les objets proviennent des processus, objectifs/SWOT, parties intéressées,
applications, fournisseurs, sites et systèmes déclarés. Cliquer sur un objet
affiche l’inspecteur et permet de retrouver sa fiche ou sa rubrique d’origine.
Les références lisibles `PROC-`, `PERI-` et `MAP-` sont attribuées par le serveur.

Une modification de nom apparaît sur la carte sans déplacer l’objet. Un nouvel
objet est signalé et s’ajoute sur demande pour préserver la disposition manuelle.
Un objet supprimé conserve sa dernière position jusqu’à son retrait explicite.
Retirer un objet de la carte ne supprime jamais sa fiche métier.

Les anciennes cartes globales sont reprises une fois dans **Contexte historique
(administration)**. Les originaux sont conservés. Les données sans périmètre restent
dans cette vue privée jusqu’à leur classement explicite ; aucun rattachement n’est deviné.

## Données et contrôles

`cartography.maps` conserve seulement les dispositions : références, positions,
tailles, arêtes graphiques, masquages et versions. Le registre central des risques
reste la source de sa cartographie consolidée avec ses évaluations de référence.
Les cartes contexte/processus ne remplacent pas une appréciation des risques.

Chaque disposition est liée à une vue et à une couverture de périmètres. Un GHT
couvre ses descendants ; un lien de mutualisation n’accorde aucun droit supplémentaire.
Les comptes lecteurs peuvent consulter et exporter leurs cartes. Les contributeurs
peuvent modifier celles de leurs périmètres. Les cartes globales historiques sont
réservées à l’administration. Les sauvegardes métier existantes incluent les dispositions.

Le serveur refuse les références hors couverture, les relations invalides,
les coordonnées non finies et la réécriture d’une version enregistrée. Si une fiche
est reclassée hors des droits d’un utilisateur, ses références sont retirées de
la carte transmise, aussi dans les versions. La disposition devient en lecture
seule pour cet utilisateur jusqu’à sa révision par un administrateur.
Le journal serveur trace les enregistrements et attribue l’auteur des nouvelles versions.

## Limites identifiées

- Maximum **400 objets**, **4 000 relations** et **20 versions** par disposition.
  Au-delà, sélectionner une couverture ou des types d’objets plus précis.
- Les flux proposés entre processus sont des **relations graphiques à valider**.
  Ils ne constituent pas des dépendances métier déclarées ni des exigences normatives.
- Le JSON exporte la disposition ; il ne constitue pas une sauvegarde des registres
  ou des pièces. Le PDF est une page A3 contenant le rendu de la carte ; le SVG
  permet de conserver une représentation vectorielle.
- Le thème s’applique aux commandes et panneaux. Les couleurs sémantiques
  pastel du canevas historique restent identiques dans les exports.
- Aucune CI GitHub n’a été déclenchée ni attribuée à cette livraison locale.

Le diagnostic avant modification est dans [DIAGNOSTIC-CARTOGRAPHIES.md](DIAGNOSTIC-CARTOGRAPHIES.md).
Les résultats réellement exécutés sont dans `recette/cartographies-*.json` et
`recette/CARTOGRAPHIES-RECETTE.md`.
