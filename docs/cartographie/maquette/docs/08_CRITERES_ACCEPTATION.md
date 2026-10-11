# 8. Critères d’acceptation

## Canvas

- une carte de 100 nodes reste fluide dans un navigateur standard ;
- le zoom et le pan ne modifient pas la position enregistrée ;
- la sélection ouvre la bonne fiche ;
- le fit-to-view fonctionne.

## Persistance

- après déplacement d’un node et rechargement, sa position est conservée ;
- le nom métier est rechargé depuis la plateforme ;
- un renommage métier ne repositionne pas le node.

## Génération

- le wizard peut générer une carte à partir d’un périmètre ;
- les types non cochés ne sont pas générés ;
- la profondeur de relation est respectée ;
- l’utilisateur peut modifier la disposition après génération.

## Vue contexte

- le périmètre est graphiquement identifiable ;
- les objets `in scope` et `out of scope` sont distinguables ;
- les enjeux internes et externes sont différenciés ;
- les parties intéressées sont différenciées des éléments internes.

## Vue processus

- les processus et sous-processus sont identifiables ;
- les flux principaux sont distincts des dépendances ;
- les processus de support peuvent être reliés aux processus de réalisation.

## Sécurité

- un utilisateur en lecture seule ne peut pas modifier la disposition ;
- la modification métier respecte les ACL de la plateforme ;
- `Retirer de la carte` n’efface jamais l’objet métier.

## Export

- le PNG contient toute la carte demandée ;
- le PDF respecte une mise en page lisible ;
- les exports peuvent intégrer titre et légende.
