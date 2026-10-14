# Registres et configurations transversales

## Registre canonique : déclarer une seule fois

| Concept | Source actuelle / cible proposée | Réutilisation et évaluation |
|---|---|---|
| Organisation, entité, périmètre | `perimeters` existe ; `grc.organizations` proposé seulement pour la propriété/isolation | Une organisation propriétaire n’est pas une copie de tous les périmètres. Liaison explicite avec racines autorisées. |
| Fournisseur/prestataire | `suppliers` | SR, partie prenante, support ou responsable référencent le fournisseur ; ne recopient pas sa fiche. |
| Responsable | `roles`, utilisateurs serveur et leurs affectations | Sélection d’un rôle dans le périmètre ; pas d’utilisateur créé depuis le nom d’un service ARM. |
| Processus | `processes` | Référence pour mission, VM et BIA sans toucher à la cartographie dynamique. |
| Actif/application/service/support | Registre existant à rechercher ; sinon `grc.catalogObjects` type `asset` | Types et catégories configurables ; « support de l’étude » est un rôle de l’actif, pas son doublon. |
| Mission et valeur métier | `grc.catalogObjects` types `mission`, `businessValue` si absents | Associations à l’étude distinctes ; besoins D/I/C évalués par contexte. |
| SR et OV | `grc.catalogObjects` types `riskSource`, `targetObjective` | SR réutilisable, motivation/ressources propres au couple dans une étude. |
| Événement redouté | Type `fearedEventTemplate` et occurrence d’étude | Le modèle ne porte pas une gravité absolue pour toutes les études. |
| Partie prenante | Référence à fournisseur/entité/objet existant | Dépendance, pénétration, maturité et confiance appartiennent à l’étude, pas à la fiche fournisseur globale. |
| Mesure de sécurité | `items` et référentiels de conformité existants | L’application locale d’une mesure se suit dans `riskMgmt.measures`/traitements ; ne pas confondre définition et mise en œuvre. |
| Risque, action, preuve | `riskMgmt.risks`, `findings`, `evidences` | Conserver les identifiants et les liens bidirectionnels ; pas de registres parallèles. |

Les bibliothèques génériques peuvent être partagées ; les objets réels restent propriétaires d’une organisation et de périmètres explicites. La publication d’une configuration générique ne publie jamais les évaluations des études qui l’utilisent.

## Catalogue de configurations

Les familles sont `scale`, `criterion`, `taxonomy`, `matrix`, `impactProfile`, `evaluationPolicy`, `workflow`, `classification`. Chaque famille possède des versions ; une version publiée est immuable. Les états d’activation/archivage sont portés par la famille ou son affectation, pas en réécrivant le snapshot publié.

Une échelle comporte `dimensionKey`, type qualitatif/quantitatif/hybride, niveaux d’identifiants stables et ordre unique, libellé, description, couleur et éventuellement valeur/unité/bornes. Une valeur numérique n’est jamais déduite de l’ordre. Les bornes ne sont validées qu’après définition explicite des inclusions/exclusions. Des niveaux peuvent être renommés dans une nouvelle version ; les historiques gardent les anciens libellés.

Un critère référence une version d’échelle et précise l’objet évalué. Une matrice référence deux versions d’échelles d’entrée et une version d’échelle de sortie. Elle stocke chaque cellule explicitement ; le nombre de niveaux peut différer entre dimensions. Les matrices de pertinence SR/OV et de risque gravité/vraisemblance ont des types distincts et ne sont jamais interchangeables.

Pour l’impact ARM, garder trois concepts : catégories d’impact (4), niveaux d’impact (4), profils descriptifs par catégorie/niveau (16). L’association niveau d’impact → gravité est un mapping explicite versionné ; une règle d’agrégation multimpacts ne se déduit pas de ce mapping.

## Résolution et héritage proposés

Le « global » est une bibliothèque de modèles approuvés, en lecture ; il ne donne aucun accès aux données d’une autre organisation. Les affectations organisationnelles choisissent une version de modèle. Les affectations de méthode doivent être compatibles avec la version de méthode et l’organisation. Une dérogation d’étude est un fork traçable, soumis aux permissions et à une justification.

Ordre de résolution par clé sémantique : **fork explicite de l’étude → affectation organisation+version de méthode → affectation organisation → défaut de la version de méthode → bibliothèque globale explicitement autorisée**. Il ne s’agit pas de fusionner arbitrairement des JSON : chaque clé résout vers une version entière. Deux candidats au même rang provoquent une erreur de conflit, pas le choix du dernier modifié. Les dépendances de chaque version (axes, niveaux, profils) sont fermées et résolues ensemble.

À la création, calculer le bundle complet, vérifier compatibilité et visibilité, afficher l’origine de chaque version puis figer ses références et empreintes. Une modification de valeur par défaut ne change jamais une étude ouverte. « Adopter une nouvelle configuration » crée une nouvelle révision de contexte, montre les différences, conserve les anciennes évaluations et marque les éléments à réévaluer ; aucun recalcul historique implicite.

## Champs libres et sélecteurs

| Champ actuel ou export | Cible | Texte conservé |
|---|---|---|
| `scenario.source` | Référence SR + éventuelle référence fournisseur/entité | Description de l’intention et hypothèses |
| `scenario.fearedEvent` | Occurrence ER de l’étude | Formulation spécifique et conséquences |
| `scenario.supportingAssets` | Multi-sélecteur d’actifs autorisés | Explication de leur rôle |
| `study.method` | Version de méthode publiée | Notes sur le choix |
| `study.workshops[0..4]` | Livrables et validations par étape | Notes héritées intégrales, sans parsing autoritaire |
| Responsable/propriétaire ARM | Rôle référencé ou rapprochement à résoudre | Libellé source dans la piste d’import |
| Catégorie/parent | Taxonomie versionnée, sélecteur hiérarchique | Description et motif de classement |
| Critère/niveau/gravité | Niveau d’échelle épinglée | Justification de l’évaluation |
| Impacts ER concaténés | Liste de profils/évaluations contextualisées | Texte original et commentaire |
| Titres, objectifs d’étude, raisonnement, décisions | Texte encadré | Rester libres : ne pas transformer l’analyse en cases arbitraires |

Créer un objet depuis un sélecteur est possible seulement avec le droit de gestion du registre. Sinon proposer une demande ou une valeur « à rapprocher » qui empêche la validation concernée. Aucun accès par recherche, autocomplétion ou export à un objet non autorisé.
