# Analyse exhaustive de l’export ARM

## Méthode et limites

Les 25 entrées utiles ont été inventoriées : chaque classeur a été ouvert, toutes ses feuilles et cellules non vides lues, les plages fusionnées et les remplissages inspectés ; les trois PNG ont été examinés visuellement. Les 21 classeurs ont chacun une feuille visible `Sheet1`, sans formule ni table Excel structurée. Le cache `Thumbs.db` est exclu du modèle métier. L’inventaire avec empreintes et le relevé de colonnes sont en annexes.

L’export n’est ni le code d’ARM, ni sa base complète, ni une preuve de cardinalités globales. Les références sont principalement des libellés et abréviations. `#` indique une ligne exportée ; `✓/❒` est un marqueur exporté dont la sémantique exacte n’est pas documentée. Aucun des deux ne devient un identifiant métier ou un statut actif par défaut.

## Contenu, fichier par fichier

| Atelier | Fichier | Observations | Classement cible |
|---|---|---|---|
| 1 | Base d’évènements redoutés | 17 entrées ; VM vide ; critère, besoin, impacts, gravité proposée/retenue, description | Modèle d’événement réutilisable séparé de son évaluation dans l’étude |
| 1 | Base de catégories d’impact | 4 catégories ; parent et abréviation vides | Taxonomie organisationnelle |
| 1 | Base de critères de sécurité | 3 critères : disponibilité, intégrité, confidentialité ; échelle de besoin associée | Critères et associations de versions d’échelles |
| 1 | Base de responsables | 13 entrées de rôles/services/prestataires ; associations VM/supports vides | Rapprochement avec rôles et organisations, pas création automatique de comptes |
| 1 | Biens supports | 2 objets ; catégorie Matériels ; propriétaire libellé ; parent vide ; numéros exportés 3 et 4 | Registre d’actifs/supports canonique |
| 1 | Catégories de bien support | 9 catégories hiérarchiques ; certaines très spécifiques | Taxonomie ; les catégories ne créent pas automatiquement des applications |
| 1 | Définir le cadre de l’étude | 1 étude, confidentialité et langue ; durées des cycles et contraintes vides | Instance et contexte de l’étude |
| 1 | Identifier les missions et l’objet de l’étude | 89 lignes physiques, **9 missions**, 60 plages fusionnées ; aucune valeur VM/support dans D:I | Missions et associations à compléter, pas 89 missions |
| 1 | Impacts | 16 définitions = 4 catégories × 4 niveaux | Profils d’impact configurés ; pas 16 évaluations de risques |
| 1 | Échelle d’intégrité | 3 niveaux | Échelle qualitative de besoin |
| 1 | Échelle de confidentialité | 4 niveaux | Échelle qualitative de besoin |
| 1 | Échelle de disponibilité | 4 niveaux avec descriptions de durée | Échelle qualitative ; seuils non normalisés |
| 1 | Échelle de gravité | 4 niveaux G1 à G4 ; valeur indicative vide | Échelle ordinale, valeur numérique non imposée |
| 1 | Échelle de niveau d’impact | 4 niveaux ; correspondance explicite vers G1 à G4 | Échelle distincte et relation vers la gravité |
| 2 | Base d’objectifs visés | 4 objets, dont un accidentel/non malveillant | Catalogue OV avec contrôle de compatibilité méthodologique |
| 2 | Base de sources de risque | 5 objets ; catégories associées par libellé | Catalogue de sources, séparé de leur évaluation |
| 2 | Catégories d’objectif visé | 7 catégories, 4 cochées | Taxonomie ; préserver le marqueur sans le surinterpréter |
| 2 | Catégories de source de risque | 12 catégories, 6 cochées | Taxonomie ; une catégorie cochée n’implique pas un objet SR présent |
| 2 | Échelle de motivation | 3 niveaux +, ++, +++ | Échelle qualitative ordonnée |
| 2 | Échelle des ressources | 3 niveaux +, ++, +++ | Échelle qualitative ordonnée |
| 2 | Échelle de pertinence | 3 niveaux Faible, Moyenne, Élevée | Résultat configuré ; sélection finale motivée |
| 2 | Matrice de niveau de pertinence.png | 3×3 ; ressources verticales croissantes, motivation horizontale croissante | Transcription documentée à valider, pas import de données structurées |
| 2 | Couples par SR.png | Vue polaire groupée par source ; anneaux de pertinence | Vue dérivée, jamais source canonique des évaluations |
| 2 | Couples par OV.png | Vue polaire groupée par objectif, mêmes concepts | Autre regroupement du même jeu de couples |
| 2 | Thumbs.db | Cache système | Ignoré, tracé dans le rapport d’import |

## Les huit échelles réellement observées

| Échelle | Ordre observé | Particularité |
|---|---|---|
| Intégrité | Négligeable → Limitée → Critique | 3 niveaux, ne pas inventer un quatrième |
| Confidentialité | Public → Interne → Restreint → Confidentiel | 4 niveaux locaux |
| Disponibilité | Négligeable → Limitée → Importante → Critique | Descriptions : > 1 jour ; 4 h–1 jour ; < 4 h ; < 30 min |
| Gravité | G1 Mineure → G2 Significative → G3 Grave → G4 Critique | Indice ordinal distinct de toute valeur de calcul |
| Niveau d’impact | Mineure → Significatif → Grave → Critique | Correspondance explicite aux quatre gravités ; conserver le libellé source |
| Motivation | + → ++ → +++ | Ordre seul ne démontre pas une distance numérique entre niveaux |
| Ressources | + → ++ → +++ | Même représentation, concept distinct |
| Pertinence | Faible → Moyenne → Élevée | 3 niveaux, pas une gravité de risque |

Les couleurs des cellules « Couleur » existent dans le remplissage Excel même quand leur valeur est vide : gravité/impact `#009F8F`, `#F6EB45`, `#FF9A35`, `#E73C50` ; pertinence `#009F8F`, `#FF9A35`, `#E73C50`. Préserver ces valeurs de configuration, en ajoutant texte et contraste accessibles. Les couleurs de l’interface sont indépendantes.

## Matrice de pertinence transcrite

| Ressources ↓ / Motivation → | 1 | 2 | 3 |
|---|---|---|---|
| 3 | Moyenne | Élevée | Élevée |
| 2 | Faible | Moyenne | Élevée |
| 1 | Faible | Faible | Moyenne |

La matrice à neuf cellules est observée dans l’image. Ce n’est ni une multiplication ni une prescription universelle ANSSI. Le rayon du cercle représente la pertinence : 3 près du centre, 1 à l’extérieur sur l’illustration source. L’angle regroupe SR ou OV ; il n’est pas une dimension calculée. Les PNG ne donnent pas une table fiable des ressources, motivations, activités ou justifications de chaque couple : ne pas reconstituer ces valeurs depuis les pixels. Les couples seront saisis ou importés d’un export structuré complémentaire.

## Points à arbitrer avant import validant

1. **Associations manquantes** : aucune VM renseignée sur les 17 ER ; aucune association mission–VM–support visible. Créer une liste « À rapprocher », ne jamais inventer ces relations.
2. **Disponibilité** : `< 30 min` est inclus dans `< 4 h` ; les bornes 4 h, 30 min et 1 jour ne constituent pas une partition explicite. Conserver les descriptions ; demander un arbitrage avant calcul quantitatif.
3. **Accidentel dans SR/OV** : conserver la donnée importée, signaler son incompatibilité avec le parcours de scénarios intentionnels EBIOS ; proposer le socle de sécurité ou un autre parcours pertinent, après décision humaine.
4. **Gravité proposée/retenue** : ces deux champs existent ; aucune formule n’est exportée. Une ressemblance des résultats avec un maximum des impacts ne prouve pas la règle. La cible doit demander une règle publiée ou une appréciation justifiée.
5. **Identités** : codes incomplets et numéros discontinus ne prouvent pas des objets supprimés. Rapprochement explicite par type, organisation, libellé et preuve de décision.
6. **Portée incomplète** : pas de données structurées des ateliers 3–5, de matrice de risque gravité/vraisemblance, d’échelle de vraisemblance ni de workflow complet. Aucun de ces éléments ne doit être présenté comme extrait d’ARM.
