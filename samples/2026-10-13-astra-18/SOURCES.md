# Sources et choix de représentation

Source d’entrée : [page ANSSI indiquée par l’utilisateur](https://messervices.cyber.gouv.fr/guides/la-methode-ebios-risk-manager-le-guide). Guide consulté : **version 1.5, septembre 2024**, ANSSI-PA-048, Licence Ouverte / Open Licence Etalab V1. Le cas de biotechnologie est pédagogique et ne représente pas l’organisation utilisatrice.

| Élément | Origine | Adaptation de la maquette |
| --- | --- | --- |
| Parties prenantes, C1–C3, P1–P3, F1–F3 | [p. 46–47](https://messervices.cyber.gouv.fr/documents-guides/250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf#page=48) | Recomposition du cercle ; positions schématiques, pas de nouveaux scores. |
| Source de risque concurrent, vol de R&D, chemins direct / P3 / F3, gravité 3 | [p. 50 et 52](https://messervices.cyber.gouv.fr/documents-guides/250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf#page=52) | Libellés raccourcis du tableau. |
| Activiste, perturbation de production / distribution, gravité 4 | [p. 51–52](https://messervices.cyber.gouv.fr/documents-guides/250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf#page=53) | Libellés métier simplifiés ; F2 désigne le fournisseur de matériel comme dans le texte. |
| Vraisemblance R1=3, R2=2, R3=4, R4=2, R5=1 | [p. 67](https://messervices.cyber.gouv.fr/documents-guides/250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf#page=69) | Affichage V1 à V4, sans calcul ajouté. |
| Identifiants R1 à R5 | [p. 72](https://messervices.cyber.gouv.fr/documents-guides/250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf#page=74) | Sélection d’une ligne et mise en évidence dans la matrice. |
| Graphe d’attaque de R1, trois modes opératoires, branche en pointillés | [p. 63–64](https://messervices.cyber.gouv.fr/documents-guides/250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf#page=65) et seconde image fournie | Recomposition SVG avec embranchements et filtres ; libellés abrégés, pas de nouvelle action technique. |
| Parcours guidé hérité | [Sources de la série 17](SOURCES-PARCOURS.md) | Les cinq ateliers et 18 étapes restent accessibles. |

## Précisions de lecture

- Les gravités utilisées viennent explicitement des textes des pages 50–52. La figure de la page 72 présente une graduation verticale qui ne concorde pas avec ces textes. La maquette affiche G4 en haut, G1 en bas et conserve les valeurs textuelles G3/G4 ; elle ne prétend pas corriger le guide officiel.
- La matrice de couleurs vert / jaune / orange / rouge suit la référence visuelle validée par l’utilisateur. Ses classes et seuils sont une **proposition d’interface**, pas une règle universelle de l’ANSSI. Ils devront être validés pour l’étude avant une utilisation réelle. Aucun calcul produit gravité × vraisemblance n’est ajouté.
- Le rouge des badges identifie le type « risque » ; il n’attribue pas automatiquement une criticité. La gravité, la vraisemblance et les classes de matrice sont distinctes.
- Dans le cercle, les anneaux représentent les zones de dangerosité des parties prenantes. La taille des points reprend schématiquement l’exposition, leur couleur la fiabilité cyber, et le halo bleu indique seulement la partie liée à la ligne sélectionnée. Les classes visuelles de l’exemple ne sont pas des mesures de votre organisation.
- P3, F3 et F2 sont associés respectivement aux chemins R2, R3 et R4 d’après les pages 50–52. R1 et R5 n’ont pas de partie prenante intermédiaire dans les chemins présentés. Cliquer une ligne ne recalcule pas la dangerosité.
- Le graphe opérationnel détaillé n’est disponible que pour R1, qui est illustré par la source. Les autres lignes portent « Non illustré » : aucun graphe n’a été inventé.
- Les couleurs d’objets (risque rouge, valeur métier violet, source orange, partie prenante bleu, mesure vert), les filtres, la sélection synchronisée et l’agencement sont des choix d’interface proposés.

Aucune modification de la cartographie dynamique existante. Cette série est une maquette autonome dans `samples/`, pas une intégration métier ou une étude terminée.
