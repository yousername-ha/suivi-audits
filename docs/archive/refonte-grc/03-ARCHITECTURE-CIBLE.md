# Architecture cible : plateforme GRC multiméthode à configuration transversale

Statut : proposition du 14/10/2026, décision formalisée dans l'[ADR 0038](../../adr/0038-socle-de-configuration-grc-transversal.md).
S'appuie sur le [diagnostic](01-DIAGNOSTIC.md) et l'[analyse de l'export](02-ANALYSE-EXPORT-ARM.md). Le modèle de données est détaillé
dans [04](04-MODELE-DE-DONNEES.md), le plan dans [05](05-PLAN-IMPLEMENTATION.md).

## 1. Principe directeur : étendre l'existant, ne pas le remplacer

L'audit montre que la plateforme possède déjà les bonnes briques : versions **immuables**, publication **confirmée avec
aperçu et motif**, **épinglage** de la version par le consommateur, journal d'audit, notification temps réel, droits par
module, moteur de méthode (`RiskMethod`) et objets d'étude EBIOS RM typés (ADR 0027). Ce qui manque, c'est :

1. un **catalogue commun** d'échelles, de matrices, de critères, de correspondances et de taxonomies, **hors** des méthodes ;
2. la **référence** (et non la copie) de ces éléments par les méthodes et les analyses ;
3. des **sélecteurs** qui remplacent les champs libres.

La refonte ajoute donc un catalogue et des références, et laisse intacts le moteur d'évaluation, les versions de méthode
déjà publiées, les évaluations enregistrées et les droits. Aucune nouvelle application, aucun nouveau stockage parallèle.

## 2. Les trois niveaux

```
NIVEAU A  Socle transversal            référentiels (existants) + CATALOGUE DE CONFIGURATION (nouveau)
              │  référence épinglée (élément, version)
NIVEAU B  Moteur multiméthode          méthodes versionnées (RiskMethod étendu) : EBIOS RM, ISO/IEC 27005, MÉHARI, personnalisées
              │  la méthode épingle ses éléments de catalogue ; l'analyse épingle la version de méthode
NIVEAU C  Analyses et évaluations      analyses (étude), objets d'analyse, évaluations immuables, décisions
```

### Niveau A : socle transversal

**A.1 Référentiels réutilisés, pas recréés.** Un objet déclaré une fois est sélectionné partout :

| Référentiel | Source existante | Action |
| --- | --- | --- |
| Périmètres | `grc_smsis` | sélecteur |
| Responsables et utilisateurs | `/owners` (comptes) | sélecteur ; les textes libres historiques restent lisibles |
| Fournisseurs et prestataires | registre fournisseurs (`/api/suppliers`) | **exposer comme cible de liaison** ; aucune seconde fiche |
| Valeurs métier, biens supports, processus | `grc_objects` | sélecteur (existant via `ChampLien`) |
| Mesures et exigences | `measure`, `soa`, exigences de référentiels | sélecteur |
| Documents et preuves | GED, `evidence` | sélecteur |
| Parties prenantes | `stakeholder`, `ecosystem_party` | sélecteur |
| Applications, sites, systèmes | `appGaps`, texte du périmètre | **à créer ou relier** (hors socle, voir plan) |
| Incidents, vulnérabilités | incidents de l'outil historique ; vulnérabilités non gérées | non traités tant que le module n'existe pas (aucun module inventé) |

Un fournisseur n'est donc jamais ressaisi dans une étude : l'objet `ecosystem_party` reçoit un champ de liaison vers la fiche du registre
fournisseurs (et les parties prenantes internes un lien vers `stakeholder`). Les évaluations d'une partie prenante (dépendance,
pénétration, maturité, confiance) restent propres à l'étude (principe 5).

**A.2 Catalogue de configuration.** Nouveau, instance-wide (voir § 4 pour la portée), pour cinq types d'éléments :

| Type | Contenu | Exemples tirés de l'export |
| --- | --- | --- |
| `scale` | échelle qualitative, quantitative ou hybride : niveaux ordonnés (libellé, description, valeur facultative, couleur facultative, effet facultatif) | gravité (4), confidentialité (4), intégrité (3), motivation (3), pertinence (3, avec effet « écarté » sur le niveau le plus bas) |
| `matrix` | deux axes (chacun une échelle épinglée) et une échelle de résultat épinglée ; cellules exhaustives, score facultatif | matrice de pertinence ressources × motivation → pertinence ; matrice de risque gravité × vraisemblance |
| `mapping` | correspondance niveau à niveau entre deux échelles, avec règle d'agrégation (maximum, minimum, aucune) | niveau d'impact → gravité ; gravité proposée = maximum des gravités des impacts |
| `criteria` | liste de critères, chacun rattaché à une échelle épinglée | critères de sécurité → échelle de besoin de chaque critère |
| `taxonomy` | catégories hiérarchiques (parent, libellé court, description) | catégories d'impact, de source de risque, d'objectif visé, de bien support |

Les statuts, workflows et catalogues de la politique métier (`BusinessPolicy`) **restent** où ils sont : le catalogue de
configuration les **référence** par la suite (étape ultérieure) au lieu de les dupliquer. Aucune donnée de départ n'est
livrée : le catalogue est **vide à l'installation** (règle du projet) ; des **modèles** sont proposés et adoptés à la
demande, comme les standards de la bibliothèque de référentiels.

**Pas d'échelle générique imposée.** Chaque élément déclare sa **catégorie** (impact, gravité, vraisemblance, criticité, maturité,
conformité, confiance, motivation, ressources, pertinence, exposition, fiabilité, dangerosité, besoin de sécurité, autre),
sa **nature** (qualitative, quantitative, hybride) et les **familles de méthode compatibles** (`all` ou une liste parmi
EBIOS RM, ISO/IEC 27005, MÉHARI, personnalisée). Une matrice de pertinence SR/OV est déclarée compatible EBIOS RM seulement :
les sélecteurs d'une analyse ISO/IEC 27005 ne la proposent pas.

### Niveau B : moteur multiméthode

Le moteur existe (`RiskMethod`, familles `ebios_rm | iso27005 | mehari | custom`, étapes avec dépendances, champs, dimensions,
vraisemblance, niveaux, calcul par jugement / matrice / table de correspondance, stratégies, réévaluation, affichage) ;
la publication est versionnée et immuable. Les évolutions :

| Besoin du cahier | Existant | Évolution |
| --- | --- | --- |
| identifiant, nom, version, description | oui | — |
| phases et relations | `stages` + `requires` | — |
| échelles et matrices applicables | **embarquées** dans la définition | `bindings` : la méthode **épingle** des éléments du catalogue (élément, version) ; à la publication, le serveur **résout et fige** une copie dans la définition (le moteur d'évaluation reste inchangé) |
| règles de calcul | `judgement`, `matrix`, `lookup` | la matrice de calcul peut venir d'un élément `matrix` épinglé |
| données obligatoires, validations | `fields[].required`, validation d'étape | — |
| objets utilisés, référentiels nécessaires | implicite (champs `references`) | `objects` (types d'objets de l'analyse) déclaré, vérifié |
| livrables attendus | non | `deliverables` (liste de libellés, rattachés à des étapes) |
| périmètre d'application | par `smsi_id` | une méthode peut être **partagée** entre périmètres (voir § 5) |
| composants spécialisés | écrans EBIOS RM codés (ateliers) | conservés ; la méthode `ebios_rm` déclare ses ateliers, les écrans les rendent |

**Ce que le moteur ne prétend pas faire.** Un éditeur de méthodes ne représente pas tout EBIOS RM : les ateliers conservent leurs
écrans spécialisés (objets typés, chemins d'attaque, graphes). Une méthode personnalisée s'appuie sur les étapes, champs,
échelles et matrices configurables ; si une méthode exige un composant spécial, il est ajouté comme composant et déclaré par la
méthode, sans modifier le moteur.

**Partage des composants sans partage des règles.** Une échelle de gravité peut être épinglée par plusieurs méthodes
compatibles ; la matrice de pertinence reste déclarée `appliesTo: [ebios_rm]`. Les règles propres à une méthode (par
exemple l'obligation des cinq ateliers) restent dans la méthode.

**ISO/IEC 27005.** La démarche est une **méthode configurable**, pas un formulaire imposé : le modèle proposé (étapes :
contexte et critères ; identification ; analyse ; évaluation ; traitement ; acceptation et suivi, avec communication,
consultation et revue transverses) est « inspiré de », sans conformité revendiquée ni texte normatif reproduit (règle déjà
posée dans l'ADR 0027). Il s'adapte à la version de la norme choisie dans la méthode.

### Niveau C : analyses et évaluations

Une **analyse** est une instance exploitant **une version de méthode** et ses éléments épinglés. L'objet existant `risk_study`
(ADR 0027) joue ce rôle : il reste du type `risk_study` pour la compatibilité, son libellé d'interface devient « Analyse », et il
reçoit en champs facultatifs la méthode et sa version, les **liaisons de configuration épinglées** (surcharges d'étude
comprises), l'entité, le statut de validation et l'état d'avancement. Une analyse ISO/IEC 27005 ou personnalisée est donc une
étude sans objets d'ateliers EBIOS. Les risques, évaluations (`grc_risk_evaluations`, immuables), mesures de traitement
(`treatment`) et décisions (`pilotage_decisions`) existent déjà et conservent leurs liens.

Les études existantes **sans** liaison de configuration continuent de fonctionner : elles utilisent implicitement l'échelle
historique à quatre niveaux (« échelle d'origine »), jamais recalculée. Passer à un élément du catalogue est une **migration
explicite** (§ 6).

## 3. Référentiel, sélection, évaluation : trois choses distinctes

| Notion | Exemple | Où | Partagé ? |
| --- | --- | --- | --- |
| **Objet de référentiel** | « Prestataire externe » (source de risque), un fournisseur, un bien support | base (registre commun, taxonomie) | oui, entre analyses autorisées |
| **Sélection** | « cette source de risque est retenue dans cette étude » (case `✓/❒` de l'export) | l'analyse | non |
| **Évaluation** | motivation, ressources, gravité retenue, pertinence d'un couple | l'analyse | **jamais** (propre à son contexte) |

Partager un objet ne partage pas son évaluation. Dans le modèle cible, une évaluation référence l'objet et la version d'échelle
épinglée par l'analyse, jamais l'inverse.

## 4. Portée, héritage et isolation

**Organisation.** L'organisation est aujourd'hui **l'instance** ; il n'existe ni table ni identifiant d'organisation, et
aucune sécurité au niveau des lignes. La refonte n'en introduit pas : introduire plusieurs organisations dans une instance est un
chantier d'isolation transversal (tables, requêtes, droits) qui n'est pas justifié par ce cahier tant que l'hébergement
multi-organisation n'est pas un objectif produit. Le modèle reste prêt : la portée d'un élément est une énumération extensible
et chaque élément porte son créateur. **Point à arbitrer n° 1.**

**Portée d'un élément de catalogue :**

| Portée | Qui le voit | Qui le modifie |
| --- | --- | --- |
| `instance` (organisation) | tous les utilisateurs autorisés | droits de configuration |
| `smsi` (périmètre) | membres du périmètre | membres en écriture avec le droit d'administrer le pilotage |

**Hiérarchie de configuration** (du plus général au plus spécifique) : plateforme/organisation → périmètre → méthode → analyse.

| Niveau | Mécanisme |
| --- | --- |
| Organisation | élément `instance` |
| Périmètre | variante `smsi` **dérivée** (copie qui mémorise son origine) |
| Méthode | épinglage par `bindings` (élément + version) |
| Analyse | liaison de configuration de l'analyse ; une surcharge est une variante dérivée, explicitement choisie |

**Règle de priorité.** Aucune substitution implicite : l'analyse utilise ce que **sa** liaison épingle ; à défaut, ce que sa
**méthode** épingle ; à défaut, l'échelle d'origine. Une variante ne modifie jamais son origine ; elle porte `derivedFrom`
(élément et version d'origine) et une surcharge est donc **traçable, autorisée et visible** dans la fiche de dépendances.

## 5. Versionnement obligatoire

1. Toute publication crée une **version immuable** (triggers SQL), précédée d'un **aperçu**, avec **motif** et confirmation
   (`PUBLIER`), sous verrou et `If-Match`. Reprendre une ancienne définition crée une nouvelle version.
2. Un consommateur **épingle (élément, version)** et conserve son résultat. Aucune évaluation n'est recalculée avec « la dernière
   version ».
3. Les références sont enregistrées dans un **registre d'usages** : « quelles méthodes et analyses utilisent cet élément, en quelle
   version ? ». L'élément affiche ses dépendances ; l'archivage empêche les **nouveaux** usages sans toucher aux anciens.
4. Les évolutions incompatibles (niveau supprimé, renommé, échelle d'une autre longueur) sont des **nouvelles versions** ;
   la **migration** d'une analyse vers une nouvelle version est une action explicite (§ 6).
5. Une **méthode** peut être publiée une fois pour plusieurs périmètres : la méthode « d'organisation » est partagée ; son
   adoption par un périmètre épingle sa version (comme la politique métier). Cela corrige la limite actuelle
   (« une méthode = un périmètre »). Étape ultérieure, voir plan.

## 6. Migration explicite et étude d'impact

Le passage d'une analyse (ou d'une méthode) de la version V1 à V2 d'un élément se fait par une action dédiée :

1. **Étude d'impact** (calculée, sans écriture) : différences structurelles (niveaux ajoutés, supprimés, renommés, réordonnés,
   valeurs modifiées), nombre d'analyses, de risques et d'évaluations épinglés sur V1, et pour chacun si les niveaux utilisés
   existent encore dans V2.
2. **Décision humaine** : motif, confirmation, et pour chaque niveau supprimé le niveau de remplacement choisi par l'analyste.
3. **Application** : crée une nouvelle version de la méthode (qui épingle V2) et, pour les analyses choisies, une nouvelle
   appréciation (évaluation immuable). L'ancienne appréciation reste consultable ; **rien n'est recalculé en silence**.

## 7. Navigation

```
PARAMÈTRES DE LA PLATEFORME   /parametres/configuration-grc
  → Configuration GRC
      → Échelles          liste, éditeur, versions, dépendances
      → Matrices          éditeur graphique de cellules, versions, dépendances
      → Critères          critères de sécurité et leurs échelles
      → Correspondances   niveau → niveau, agrégation
      → Taxonomies        catégories hiérarchiques
      → Méthodes d'analyse   (même éditeur que Gestion des risques)
      → Règles et workflows  (statuts : politique métier, déjà existants)

GESTION DES RISQUES   /pilotage/configuration
  → Configuration des analyses   consultation et gestion, selon les droits, des MÊMES éléments (mêmes API, même stockage)
```

Les deux accès appellent les mêmes services (`/api/config-grc/*`) ; il n'y a **pas de second stockage**. Le style graphique,
le menu et la charte ne changent pas ; les nouvelles pages utilisent les composants de `packages/ui`.

## 8. Composants d'interface mutualisés

| Composant | Rôle | Base existante |
| --- | --- | --- |
| `SelecteurObjet` (générique : fournisseur, actif, valeur métier, mesure, partie prenante, document) | recherche serveur, types cibles, création rapide dans le **registre officiel** | `ChampLien` |
| `SelecteurPerimetre`, `SelecteurResponsable`, `SelecteurFournisseur` | idem, avec droits et périmètre | 4 copies de `/owners`, 6 de `/smsis` à factoriser |
| `SelecteurEchelle`, `SelecteurNiveau` | choix d'une échelle compatible ; niveau avec libellé **et description** | nouveau |
| `MatriceEvaluation` | grille d'un élément `matrix`, résultat recalculé selon la version épinglée | `MatriceRisques.tsx` |
| `Justification` | zone de raisonnement libre obligatoire quand la règle l'exige | nouveau |
| `HistoriqueVersions`, `Dependances` | versions immuables, usages d'un élément | `Decision`, historiques existants |
| `EditeurEchelle`, `EditeurMatrice`, `EditeurCorrespondance`, `EditeurTaxonomie` | édition guidée, remplace le JSON brut | `AdminEnvironment.tsx` (`Levels`) |
| `AssistantAnalyse` | création d'une analyse : méthode, version, périmètre, entité, éléments épinglés | nouveau |

Règles : respect des permissions et du contexte ; recherche dynamique au-delà de 100 objets (la liste actuelle est tronquée) ;
cas « aucune donnée » explicite avec lien de création ; la création rapide **enrichit le registre officiel**, elle ne crée pas
de donnée parallèle. Contraintes de style : [ADR 0006](../../adr/0006-front-react-mantine-csp-stricte.md) (pas de style en ligne,
pas de props responsives de style, jetons du thème).

## 9. Parcours EBIOS RM sur le catalogue

| Atelier | Évolution |
| --- | --- |
| 1 Cadrage et socle | périmètre, valeurs métier, biens supports, responsables **sélectionnés** ; critères de sécurité et **échelle de besoin propre à chaque critère** ; catégories d'impact et impacts (catégorie × niveau) ; **gravité proposée** par agrégation (maximum) via la correspondance niveau d'impact → gravité, **gravité retenue** décidée par l'analyste ; socle de sécurité : référentiels **sélectionnés** (interface qui manque aujourd'hui) |
| 2 Sources de risque | sources et objectifs **sélectionnés** dans les bases (taxonomies de catégories) avec sélection par étude ; motivation et ressources choisies sur leurs échelles ; **pertinence proposée** par la matrice épinglée ; pertinence retenue et justification décidées par l'analyste ; le niveau d'effet de l'échelle (« écarté ») signale les couples sortant de l'étude sans les supprimer |
| 3 Scénarios stratégiques | parties prenantes **liées** au registre des fournisseurs et aux parties prenantes ; critères d'écosystème sur échelles ; couples SR/OV repris de l'atelier 2 ; descriptions libres conservées |
| 4 Scénarios opérationnels | scénarios stratégiques, biens supports sélectionnés ; vraisemblance sur l'échelle de la méthode ; modes opératoires libres conservés |
| 5 Traitement | risques et scénarios repris ; critères d'acceptation et de traitement de la méthode ; mesures **sélectionnées** dans les catalogues ; décisions, risque résiduel et plans conservés (existant) |

Les calculs (gravité proposée, pertinence proposée, criticité) sont des **propositions explicites** issues d'une règle publiée
(correspondance, matrice) ; l'analyste les retient ou les corrige avec justification. Aucune décision n'est calculée seule.

## 10. Compatibilité et non-régression

- Aucune modification des tables ni des définitions existantes ; les migrations sont **additives**.
- Les méthodes déjà publiées gardent leurs échelles embarquées ; l'épinglage est facultatif.
- Les études existantes sans liaison utilisent l'échelle d'origine.
- Les droits existants sont réutilisés (voir [04](04-MODELE-DE-DONNEES.md) § 5) ; aucun droit n'est élargi.
- Retour arrière : une version antérieure de l'application ignore les tables du catalogue ; une définition de méthode qui contient
  `bindings` n'est pas relisible par une version antérieure (schéma strict) : l'épinglage est donc **opt-in** et signalé
  (point à arbitrer n° 6).
