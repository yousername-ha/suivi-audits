# Modèle de données versionné

Ce document décrit ce qui **existe** après les lots livrés (marqué « livré ») et ce qui est **prévu** (marqué « prévu »). Rien de
« prévu » n'est présenté comme disponible. Contexte : [03](03-ARCHITECTURE-CIBLE.md) ; plan : [05](05-PLAN-IMPLEMENTATION.md).

## 1. Tables du catalogue de configuration (livré, migration `021_catalogue_configuration.sql`)

Migration **additive** : aucune table, donnée ni évaluation existante n'est modifiée.

| Table | Rôle | Points clés |
| --- | --- | --- |
| `cfg_items` | un élément de configuration (échelle, matrice, correspondance, critères, taxonomie) | `kind`, `key` (identifiant stable, unique par type et portée), `scope` `instance` ou `smsi` (avec `smsi_id`), `state` `draft`/`active`/`archived`, `draft` (JSON en cours d'édition), `current_version`, `derived_from_id` + `derived_from_version` (variante), `origin` (modèle adopté), `version` (jeton `If-Match`) |
| `cfg_versions` | versions publiées | clé `(item_id, version)`, `definition` JSON, `reason` (5 à 1000 caractères), auteur, date ; **immuable** (triggers `UPDATE`, `DELETE`, `TRUNCATE`) ; clé étrangère composite `(id, current_version)` depuis `cfg_items` |
| `cfg_usages` | qui épingle quelle version | `(item_id, item_version)` → `cfg_versions` ; consommateur `cfg_version` (un autre élément), `method_version` (une version de méthode publiée) ou `analysis` (prévu) ; **immuable** |

Notifications temps réel : le déclencheur `cfg_items_notify` publie l'entité `config_grc` (permission `metier`).

### Définitions (schémas zod stricts, `packages/shared/src/config-grc.ts`)

| Type | Contenu |
| --- | --- |
| Échelle | catégorie, nature (qualitative / quantitative / hybride), `appliesTo` (`all` ou familles de méthode), unité, dimensions facultatives, 2 à 20 niveaux : `id`, libellé, description, valeur facultative (strictement croissante, obligatoire si quantitative), couleur, effet (`retained` / `excluded`), acceptabilité, critères par dimension (grille de descripteurs) |
| Matrice | catégorie, `appliesTo`, axe des lignes et des colonnes (chacun **épingle une échelle**), échelle des résultats épinglée, cellules **exhaustives** `(ligne, colonne) → résultat` avec score facultatif |
| Correspondance | échelle source et cible épinglées, paires `niveau → niveau`, agrégation (`max`, `min`, `none`) |
| Critères | liste de critères, chacun rattaché à une échelle épinglée |
| Taxonomie | nœuds hiérarchiques (sans cycle), finalités |

Une échelle n'impose ni nombre de niveaux, ni valeur numérique, ni libellé ; la valeur numérique n'existe que si l'organisation
la définit.

## 2. Cycle de vie et règles (livré)

1. Création d'un brouillon (`draft`), enregistrements concurrents refusés (`If-Match`, 412).
2. **Aperçu** : validation complète (références épinglées existantes, du bon type, visibles, non archivées sauf déjà épinglées ;
   exhaustivité des matrices ; couverture des correspondances) et **étude d'impact** de la nouvelle version
   (niveaux ajoutés, retirés, renommés, valeurs modifiées, ordre ; caractère « cassant »), nombre et liste des consommateurs.
3. **Publication** : motif obligatoire, `confirm: 'PUBLIER'`, empreinte d'aperçu (`previewId`) recalculée, verrou de ligne,
   « Aucun changement » refusé, version immuable, usages enregistrés, audit `config.publish`.
4. **Variante** (`derive`) : copie qui mémorise son origine ; l'origine n'est pas modifiée.
5. **Archivage** : plus de nouvel usage, les épinglages existants restent valides ; suppression possible d'un brouillon jamais
   publié, sans usage ni variante.
6. **Modèle** (`templates`, `adopt`) : rien n'est livré dans le catalogue ; l'administrateur adopte un lot, qui crée des éléments
   en version 1 portant leur provenance (`origin`). Seul le lot « pertinence EBIOS RM » existe (3 échelles, 1 matrice) ; sa note
   demande une validation à la source.

## 3. Méthodes et épinglages (livré : lot I3)

La définition de méthode (`grc_method_versions.definition`, strict) reçoit un champ **facultatif** `bindings` :

```
bindings: {
  dimensions: { <dimension de la méthode>: { item, version } },   // niveaux de la dimension (impact, gravité…)
  likelihood?: { item, version },                                 // niveaux de vraisemblance
  levels?: { item, version },                                     // niveaux de risque : couleur + acceptabilité obligatoires
  matrix?: { ref: { item, version }, dimension: <dimension> }    // matrice de calcul
}
```

À l'aperçu et à la publication (`GrcRisks.previewMethod` / `publishMethod`) :

1. les références sont chargées et contrôlées (existence, type attendu, visibilité du périmètre, famille de méthode via
   `appliesTo`, archivage sauf si la version précédente de la méthode les épinglait déjà) ;
2. la définition est **résolue** (`resolveMethodBindings`, fonction pure) : niveaux des dimensions, vraisemblance, niveaux de
   risque, puis calcul `matrix` construit depuis la matrice épinglée, après vérification que ses axes et son résultat sont
   exactement les échelles épinglées ; une échelle de niveaux de risque sans couleur ou acceptabilité est refusée (rien n'est
   inventé) ;
3. la définition **intégrée** est publiée (elle contient aussi `bindings`, comme provenance) : `evaluateMethod` n'est pas modifié ;
4. l'empreinte d'aperçu porte sur la définition résolue ; les références sont relues dans la transaction de publication ;
5. un usage `method_version` est enregistré pour chaque élément épinglé.

Une version de l'échelle publiée après coup **ne change pas** une méthode déjà publiée ; adopter la nouvelle version est une
nouvelle version de méthode.

## 4. Objets prévus (non implémentés)

| Concept | Statut | Piste |
| --- | --- | --- |
| `objects` (types d'objets attendus) et `deliverables` (livrables) d'une méthode | prévu | champs facultatifs de `RiskMethod`, vérifiés à la validation d'étape |
| Méthode partagée entre périmètres | prévu | portée `instance` pour les méthodes (table de pointeurs) ; aujourd'hui une méthode appartient à un `smsi_id` |
| Liaison de configuration d'une analyse | partiel (livré) | `risk_study.configuration.relevanceMatrix` : matrice de pertinence épinglée (version précise), vérifiée à l'enregistrement, usage `analysis` enregistré ; les niveaux d'un couple (`resourcesLevel`, `motivationLevel`, `relevanceLevel`) sont des identifiants de niveau. `configuration.severityMapping` : correspondance impact → gravité (événement redouté : `impactLevels`, `severityLevel`). Méthode, version, entité et statut : prévus |
| Entité / organisation | à arbitrer (point 1) | aujourd'hui texte libre dans les risques |
| Bases de sources de risque / objectifs visés / parties prenantes | à arbitrer (point 8) | taxonomie du catalogue + sélection par étude |
| Migration explicite d'une analyse vers une nouvelle version | prévu | aperçu d'impact puis action confirmée, journalisée, sans réécrire les évaluations passées |

## 5. Droits (aucune nouvelle permission)

| Action | Droit exigé |
| --- | --- |
| Lire le catalogue | `pilotage:lire`, `parametres:lire` ou `administration:lire` |
| Brouillon, variante (portée organisation) | `parametres:modifier` |
| Publication, archivage, suppression (portée organisation) | `parametres:administrer` |
| Même actions (portée périmètre) | `pilotage:administrer` + écriture dans le périmètre |
| Publier une méthode épinglée | `pilotage:administrer` + écriture dans le périmètre (inchangé) |

Un élément de portée périmètre est invisible, et répond 404, hors des membres. Le rôle `rssi` conserve tous les droits
fonctionnels sauf `administration:*`. Choix à confirmer : point à arbitrer n° 2.

## 6. Données conservées et rétrocompatibilité

- `app_state`, `app_state_versions`, `grc_*`, environnement IA et politiques métier ne sont pas touchés (test de non-régression).
- Les méthodes publiées avant cette version gardent leurs échelles embarquées ; `bindings` est absent.
- Une version antérieure de l'application ne sait pas lire une définition qui contient `bindings` (schéma strict) : ne publier
  de méthode épinglée qu'après la mise à jour de tous les serveurs concernés (point à arbitrer n° 6).
