# Contrats de données et de services proposés

## Enveloppes et identités

Identifiant opaque stable, distinct du code de présentation, du numéro de ligne et du libellé. Référence typée : `{kind, id, revisionId?}` ; `kind` vient d’une liste de types reconnus, jamais d’un chemin libre dans l’état. La portée est explicite : `organizationId`, `perimeterIds`. Une référence globale n’est permise que pour une configuration ou un modèle générique approuvé, jamais pour un objet réel par défaut.

Chaque nouvelle collection mutable possède `id`, `schemaVersion`, `createdAt`, `createdBy`, `updatedAt`, `revision`, `status`, portée et piste d’audit serveur. Chaque version publiée possède `familyId`, `version`, `previousVersionId`, `sourceVersionId?`, `publicationReason`, `publishedAt`, `publishedBy`, `contentHash` et dépendances exactes. L’empreinte couvre une sérialisation canonique du contenu et des références ; l’ordre des tableaux sémantiques est conservé, celui des clés d’objets normalisé. Ne pas utiliser la présentation HTML comme source du hash.

| Entité | Champs métier principaux | Invariants |
|---|---|---|
| CatalogObject / CatalogRevision | type, nom, catégories, propriétaire référencé, attributs autorisés | Pas de doublon automatique ; révision historique stable ; archivage si référencé |
| Relation | sujet, prédicat, objet, contexte optionnel | Types compatibles, même portée ou partage explicite, pas de cycle pour un parent |
| ScaleVersion | dimensionKey, mode, niveaux | IDs/ordres uniques ; numérique optionnel ; unité obligatoire si valeur quantitative |
| CriterionVersion | clé, type d’objet évalué, scaleVersionId, justificationRequired | Domaine compatible ; ne pas confondre critère et niveau |
| MatrixVersion | rowScaleVersionId, columnScaleVersionId, resultScaleVersionId, cells | Une cellule pour chaque paire exacte ; aucun ID étranger ni doublon |
| ConfigAssignment | clé, versionId, rang, organizationId, methodVersionId?, studyId? | Une affectation applicable par clé et rang ; origine traçable |
| MethodVersion | code, provenance, étapes, inputContracts, configSlots, resultContracts | Dépendances explicites ; moteur/opérateurs autorisés ; publication testée |
| StudyContext | studyId, revision, methodVersionId, configBindings, registrySnapshots, reason | Bundle résolu immuable ; étude et références autorisées ; pas de référence « latest » |
| StepRun | studyId, contextId, stepKey, state, validationRefs | Incomplétude visible ; validation serveur ; réouverture justifiée invalide les validations dépendantes |
| Observation | kind, studyId, contextId, subjectRefs, values, justification, sourceRefs | Évaluation de besoin/ER/couple/partie prenante ; pas un nouveau registre central de risques |
| ScenarioGraph | scenarioId, contextId, nodes, edges, paths | IDs stables, références de livrables ; variantes explicites, pas de lien libre vers un objet interdit |
| ImportRun | sourceHash, parserVersion, mappings, decisions, stateVersion, report | Rejouable/idempotent ; original conservé localement ; aucune publication automatique |

## Risque et évaluation finale

Le risque reste dans `riskMgmt.risks`. Le résultat final d’une analyse reste dans `riskMgmt.assessments` ; ne pas ajouter une seconde collection de risques/évaluations concurrente. Les observations intermédiaires n’ont pas le statut de risque validé.

Les enregistrements historiques sans `schemaVersion` sont interprétés comme version 1. Leur `policyId` et leurs snapshots restent inchangés. Introduire une version 2 additive pour les nouvelles évaluations seulement : `schemaVersion:2`, `studyId`, `studyContextId`, `methodVersionId`, `riskId`, `stage`, `dimensionValues` (références de niveaux), `result` (résultat typé), `justification`, `scenarioIds`, `proofRefs`, auteur/date serveur. Une politique v1 compatible conserve son `policyId`; un bundle multiméthode remplace l’hypothèse obligatoire « impact×vraisemblance » dans le validateur v2. Ne pas forcer toute méthode personnalisée dans deux dimensions v1.

Pour une matrice de risque, `result` contient `resultScaleVersionId` et `levelId`. Pour une appréciation manuelle ou quantitative, le type et les contraintes viennent du contrat de méthode publié. Les vues historiques utilisent l’adaptateur v1 ; les vues de comparaison groupent par contexte compatible. Aucune moyenne ou classement commun entre échelles hétérogènes sans correspondance explicite validée. `riskMgmt` conserve son schéma de conteneur tant qu’une migration de conteneur n’est pas nécessaire ; documenter indépendamment la version de chaque enregistrement.

## Matrice et interprétation

`cells` contient `{rowLevelId,columnLevelId,resultLevelId}`. Axe vertical croissant vers le haut, horizontal croissant vers la droite : l’orientation est une propriété d’affichage, le calcul utilise les IDs. Le schéma JSON fourni décrit le **contrat de bundle échelles/matrices/contexte**, pas tout le modèle métier ; les invariants interobjets nécessitent un validateur sémantique supplémentaire.

L’annexe de pertinence contient les neuf correspondances lues dans le PNG. L’exemple synthétique de contrat est une fixture à visée technique, pas une configuration déjà publiée dans l’application.

## Services métier internes à créer

| Opération | Entrée | Résultat / erreurs attendues |
|---|---|---|
| `resolveConfig` | organisation, périmètres, version méthode, forks explicites | bundle et provenance ; `AMBIGUOUS_ASSIGNMENT`, `INCOMPATIBLE_DIMENSION`, `FORBIDDEN_REFERENCE` |
| `publishConfigVersion` | draftId, expectedRevision, raison | version figée ; `INVALID_MATRIX`, `DEPENDENCY_NOT_PUBLISHED`, `STALE_REVISION` |
| `createStudyContext` | studyId, methodVersionId, bindings, expectedStateVersion | contexte révisé ; `UNRESOLVED_REFERENCE`, `SCOPE_MISMATCH` |
| `evaluateObservation` | contexte, sujets, valeurs, justification | proposition calculée + décision humaine distincte ; `UNKNOWN_LEVEL`, `MISSING_JUSTIFICATION` |
| `validateStep` | contexte, étape, expectedRevision | validation signée ; liste de prérequis manquants si refus |
| `prepareImport` | fichier local, organisation cible, profils | rapport sans mutation métier ; correspondances candidates explicables |
| `commitImport` | importRunId, décisions de rapprochement, expectedStateVersion | transaction atomique ; refuse ambiguïtés bloquantes et import concurrent |

Ces services ne sont **pas des endpoints existants**. Dans le premier lot, les commandes transitent par la sauvegarde `/api/state` actuelle et sont revalidées côté serveur. Si des endpoints dédiés sont ajoutés ensuite, définir un contrat HTTP versionné, les mêmes contrôles et des erreurs 400/403/409/422 documentées avant leur usage ; ne pas faire croire qu’ils existent déjà.
