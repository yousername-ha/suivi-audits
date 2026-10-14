# Diagnostic de l'architecture actuelle (module de risques et configuration)

Statut : audit du 14/10/2026 sur la branche `claude-suivi-smsi` (v3.2.0 en préparation). Méthode : lecture du code
(`packages/shared`, `apps/api`, `apps/web`, migrations 001 à 020), de l'[ADR 0021](../adr/0021-configuration-environnement-versionnee.md),
[0022](../adr/0022-evaluations-ia-versionnees.md), [0023](../adr/0023-smsi-referentiels-taches-risques.md),
[0027](../adr/0027-risques-ebios-rm-iso27005.md), de la maquette EBIOS RM de la branche `legacy` et de l'archive d'export
([analyse](02-ANALYSE-EXPORT-ARM.md)). Les chemins sont relatifs à la racine du dépôt. Ce qui n'a pas été contrôlé est
signalé « non vérifié ».

## 1. Constat d'ensemble

1. **Quatre systèmes d'échelles et de calcul coexistent sans lien**, avec quatre éditeurs différents (ou aucun) :

   | Système | Portée | Versionné | Éditeur | Consommateur |
   | --- | --- | --- | --- | --- |
   | `EnvironmentDefinition` (`packages/shared/src/environment.ts`) | global à l'instance | oui, immuable, pointeur (migration 010) | page dédiée `AdminEnvironment.tsx` | **uniquement** les évaluations IA |
   | `RiskMethod` (`risk-methods.ts`) | un **périmètre** (`smsi_id`) | oui, immuable (`grc_method_versions`) | éditeur JSON générique `ConfigurationEditor.tsx` | risques et évaluations GRC |
   | Échelles EBIOS RM (`risques.ts`, `pilotage.ts`) | — | non : **codées en dur**, 4 niveaux | aucun | études EBIOS RM (ateliers) |
   | `BusinessPolicy` (`business-policy.ts`) | global, épinglé par périmètre | oui, immuable, pointeur (migration 012) | éditeur JSON générique | statuts, catalogues, tableau de bord |

   S'y ajoutent des règles figées hors de toute configuration : calcul IA historique `legacyAiRisk` (seuils 16/10/5),
   matrice d'incidents de l'outil historique, pronostic d'audit.
2. **Le mécanisme « aperçu → publication confirmée → version immuable » est recopié cinq fois** (environnement, politique,
   méthode, référentiel, module), avec des variantes (empreinte canonique ou non, pointeur ou `max(version)`, longueur du
   motif 5 ou 10). Il n'existe pas de service générique de configuration versionnée.
3. **Une méthode de risque ne peut pas être publiée une fois pour plusieurs périmètres** : chaque méthode appartient à un
   seul `smsi_id`, avec ses échelles et sa matrice **intégrées** à sa définition. Une même échelle de gravité est donc
   recopiée dans chaque méthode et chaque périmètre.
4. **Il n'existe pas d'« organisation » distincte du périmètre.** Pas de table `organisations`, pas d'`organisation_id`.
   L'organisation, c'est l'instance (une base, un `app_state`, une table `settings`). L'isolation se fait par `smsi_id`
   sur les tables GRC et par la visibilité du périmètre (`instance` ou `restricted`) plus l'appartenance
   (`grc_members`) ; aucune sécurité au niveau des lignes PostgreSQL n'a été trouvée dans les migrations.
5. **Le versionnement des consommateurs est partiel** : `risk_assessments.configuration_version`,
   `grc_risk_evaluations.method_version_id`, `grc_scope_frameworks` et `grc_smsis.business_version` portent une clé
   étrangère ; `grc_smsis.risk_method_*` et `data.methodId/methodVersion` des fiches n'en ont pas.
6. **Aucun aperçu d'impact chiffré** (nombre de fiches ou d'évaluations concernées) n'existe pour une publication de
   politique ou de méthode ; seule l'activation des modules calcule un plan d'impact.

## 2. Cartographie

### 2.1 Modules et écrans (Pilotage → Risques)

| Rubrique | Composant | Rôle |
| --- | --- | --- |
| Registre des risques | `RegistreRisques.tsx` | liste filtrable, états d'acceptation |
| Études EBIOS RM | `Ebios.tsx` | vue par atelier ; matrice gravité × vraisemblance **4×4 fixe** qui ignore la méthode publiée |
| Scénarios et actifs, Traitements | `Registry` (`pages/Grc.tsx`) + `RecordEditor.tsx` + `Fields.tsx` (formulaires de `PILOTAGE_FIELDS`) | fiches par type d'objet |
| Cartographie des risques | `RiskMap.tsx`, `MatriceRisques.tsx` | projection, matrice par méthode |
| Configuration du pilotage | `Publication.tsx` (méthodes), `BusinessPolicy.tsx` | édition JSON générique |
| Appréciation d'un risque | `Risks.tsx` | brut/résiduel selon la méthode du risque |
| Évaluations IA | `IaEvaluations.tsx` | utilise l'environnement global |

Éditeurs de configuration existants : méthodes (`ConfigurationEditor`, où les couleurs, l'acceptabilité, les types de
calcul et les identifiants d'étape sont des **champs texte libres**), politique, environnement (éditeur dédié et riche).
Paramètres (`/parametres`) : aucune section ne concerne les risques ni les échelles.

### 2.2 Objets métier et références

Le registre commun (`grc_objects`, 36 types) porte les objets de l'étude EBIOS RM de l'ADR 0027 (`risk_study`,
`business_asset`, `support_asset`, `feared_event`, `risk_source`, `sr_ov`, `ecosystem_party`, `strategic_scenario`,
`operational_scenario`, `treatment`, `risk`), reliés par des références typées (`RISK_REF_KINDS`, validées côté serveur).
Les fournisseurs, applications, sites et systèmes **ne sont pas** des types GRC (voir § 3).

### 2.3 Droits

15 modules × 5 actions. Aucun droit dédié à la configuration des risques : méthodes = `pilotage:administrer` ;
environnement et politique = `administration:administrer` ; référentiels = `conformite:modifier` ; critères fournisseurs =
`fournisseurs:administrer`. Les droits sont **globaux** ; seule l'appartenance filtre par périmètre. Le rôle `rssi` n'est
pas administrateur au sens des périmètres restreints.

## 3. Duplications et données non reliées

| Concept | Où il existe | Problème |
| --- | --- | --- |
| Fournisseurs | `app_state.suppliers` (historique), tables `sup_*` (critères, évaluations), `legacy.supEvals`, objet de carte `sup:<id>` | pas de type GRC `supplier` ; `RISK_REF_KINDS` n'accepte aucun fournisseur ; l'objet `ecosystem_party` d'EBIOS RM n'a **aucun lien** vers un fournisseur |
| Périmètres | `grc_smsis`, `app_state.scope`, objets de carte | champs `scope`, `entity`, `domain` des risques et `scope` de plusieurs fiches sont des **textes libres** |
| Actifs | `business_asset`, `support_asset`, `process` (GRC) ; sites et systèmes du périmètre = lignes de texte | sites et systèmes non référençables |
| Applications | `app_state.appGaps` seulement | aucun type GRC ; lien avec le fournisseur par **nom en minuscules** |
| Responsables | `ownerId` (comptes) côté GRC ; `owner` texte côté historique | aucun lien entre les deux ; participants, titulaires, suppléants et rôles en texte libre |
| Mesures | `app_state.items`, `dda`, objets `measure`/`soa`, exigences de référentiels | plusieurs sources ; le champ « mesures de sécurité sur l'écosystème » (EBIOS RM) est du texte |
| Relations et correspondances | 3 listes de relations (`grc.ts`, `liens.ts`, `carto/model.ts`), 4 copies des types de correspondance | non reliées |
| Familles de processus | `objectifs.ts`, `carto/creation.ts`, `carto/model.ts` | triple copie |
| Indicateurs | `tableau-de-bord.ts` et `carto/objects.ts` | deux copies de la même logique |

## 4. Valeurs codées en dur qui devraient être administrables

| Valeur | Emplacement | Constat |
| --- | --- | --- |
| Niveaux 1 à 4 de gravité, vraisemblance, motivation, ressources, activité, dépendance, pénétration, maturité, confiance | `risques.ts:15`, `:66-67`, `pilotage.ts:361` | échelle unique à quatre niveaux, libellés figés ; l'export fourni montre des échelles à 3 et 4 niveaux |
| Matrice gravité × vraisemblance de l'étude | `apps/web/src/grc/Ebios.tsx:97-110` | 4×4 fixe, indépendante de la méthode |
| Critères de sécurité D/I/C/P/autre | `risques.ts:118` | liste fermée, sans échelle de besoin |
| Indice de menace des parties prenantes | `risques.ts:264-273` | formule fixe (dépendance × pénétration) / (maturité × confiance) |
| Pertinence d'un couple SR/OV | `risques.ts` (`SrOvData`) | **aucun calcul** : motivation, ressources, activité sont des niveaux 1 à 4 saisis ; « retenu » est une case à cocher |
| Stratégies de traitement | `grc.ts:397`, `risques.ts:179`, `pilotage.ts:335-340` | trois énumérations qui divergent (`treated` absent de l'étude) |
| Domaines de risque | `business-policy.ts` `catalogues.riskDomains` | catalogue publié mais **consommé nulle part** ; `RiskData.domain` est un texte libre |
| Socle de sécurité (`baseline`) | schéma `risques.ts:81-94` | présent dans le schéma, **sans interface** |
| Statuts de la plupart des objets | enums zod de `pilotage.ts` | seules les actions suivent la politique métier |
| Priorités, criticité BIA, classifications de documents | `pilotage.ts`, `schemas.ts`, contrainte SQL `001:97` | figées |
| Calcul IA historique | `risk-assessments.ts:60-71` | seuils 16/10/5, facteur 1,25 : aucune configuration |
| Seuils fournisseurs, pronostic d'audit | `suivi-fournisseurs.ts`, `audit/pronostic.ts` | figés (hors périmètre de cette refonte) |

Les modèles de méthode (`methodTemplate`) sont des **valeurs par défaut copiées** à la création : ils ne bloquent pas
l'édition. Ce n'est pas de la configuration codée en dur au sens strict ; c'est un modèle, et ce principe est conservé.

## 5. Champs libres à remplacer par des sélecteurs

Classés par source disponible. « Existe » = la donnée est déjà gérée par la plateforme ; « À créer » = aucun registre n'existe.

| Champ libre (fiche) | Remplacer par | Source | État |
| --- | --- | --- | --- |
| Domaine (risque, carte) | sélecteur de domaine | catalogue `riskDomains` de la politique métier | existe, inutilisé |
| Périmètre (risque, actif, BIA, contrôle, audit) | sélecteur de périmètre | `grc_smsis` (`/api/grc/smsis`) | existe |
| Entité (risque, valeur métier) | sélecteur d'entité | — | **à créer** (voir § 4 de l'architecture : option organisation/entité) |
| Participants, titulaire, suppléant, rôles et contacts | sélecteur de personnes | `/api/grc/{smsi}/owners` | existe |
| Catégorie de source de risque ; catégorie d'objectif visé | sélecteur de taxonomie | taxonomies d'étude | **à créer** (taxonomie, § 3 de l'architecture) |
| Catégorie de partie prenante | sélecteur de taxonomie | idem | à créer |
| Type de bien support, localisation | sélecteur de taxonomie / de site | idem | à créer |
| Dépendances et fournisseurs (BIA), partie prenante de l'écosystème | sélecteur de fournisseur | registre fournisseurs | existe, **non exposé** comme cible |
| Mesures de sécurité sur l'écosystème, risques traités, actions prévues, documents et preuves (SoA) | sélecteur d'objets liés | `ChampLien` | existe, non branché |
| Critères et référentiels (audit) | sélecteur de référentiels | `ReferentielsAudites` | existe, non branché |
| Gravité, vraisemblance, motivation, ressources, activité, dépendance, pénétration, maturité, confiance | sélecteur de niveau d'une échelle configurée | catalogue de configuration | **à créer** |
| Critères atteints (D/I/C/P/autre) | sélecteur de critères de sécurité | catalogue de configuration | à créer |
| Sites, systèmes du périmètre | sélecteur d'actif | actifs | à créer / à relier |
| Menace, vulnérabilité, conséquences (ISO 27005) | sélecteur de catalogue (facultatif) + texte libre de justification | catalogues de menaces | **à créer**, à arbitrer |
| Champs de liaison des étapes de méthode (`references`) | sélecteur typé avec recherche serveur | `/sources?search&cibles=` | défaut : liste tronquée à 100, sans type |

Les champs de **description, justification et analyse** restent libres : ils portent le raisonnement humain.

## 6. Défauts relevés en passant

1. `ObjectEditor` : la branche générique des types hors `risk`/`action` est du **code mort** depuis l'aiguillage vers `RecordEditor`.
2. Le sélecteur de responsable (4 copies), de périmètre (6 requêtes, 3 types locaux), de méthode (4 requêtes) et de sources
   (5 composants) sont **dupliqués**.
3. `GrcFrameworks.activate()` incrémente la version d'objet sans insérer de ligne de version (trous de numérotation).
4. L'empreinte d'aperçu des politiques et de l'environnement dépend de l'ordre des clés (`JSON.stringify`) ; celle de GRC est canonique.
5. Le choix de stratégie d'un risque enregistre `s.kind` et non `s.id` : deux stratégies de même type sont indiscernables.
6. Les tests e2e ciblent les libellés actuels des champs libres (`zzzz-risques.spec.ts`, `zz-grc.spec.ts`, `zzz-pilotage.spec.ts`) :
   toute refonte de formulaire impose de les adapter.

## 7. Ce qui n'existe pas (à ne pas supposer)

Organisation distincte, entités, périmètres hiérarchiques ; service de configuration versionnée ; rattachement d'un périmètre à
un environnement ; passerelle entre échelle IA, environnement et méthode ; types GRC `supplier`, `application`, `site`,
`system` ; aperçu d'impact chiffré ; interface de configuration des statuts, priorités, stratégies, classifications ;
sécurité au niveau des lignes (non vérifiée).
