# ADR 0083 — Porte de lecture autorisée entre modules

- Statut : proposée (chantier d'architecture demandé par le RSSI le 09/11/2026). Numéro annoncé et accepté par le RSSI dans la
  session (règle 5 d'AGENTS) ; l'acceptation de l'ADR reste à prononcer par le RSSI.
- Date : 2026-11-09
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Complète l'[ADR 0010](0010-droits-rbac.md) (droits par module), l'[ADR 0043](0043-registres-perimetres-herites-et-droits-par-ressource.md)
  (registres restreints et périmètres) et l'[ADR 0067](0067-attribution-des-droits-par-ressource-reservee.md) (attribution).
  Ne modifie pas l'architecture de déploiement.

## Contexte

L'application est un monolithe modulaire : une API, une base PostgreSQL, des dossiers par domaine (`grc/`, `historique/`,
`pilotage/`, `carto/`, `export/`, `legacy/`). Ce choix convient à la cible (une organisation, quelques dizaines de comptes,
auto-hébergement) et n'est pas remis en cause.

Les règles d'accès fines (droit de module, périmètre restreint, registre restreint, rôle attribué sur une ressource) sont
appliquées par les services, à chaque endroit qui lit une donnée. Or plusieurs fichiers hors de `grc/` interrogent
directement `grc_objects`, `grc_links`, `registres` ou `registre_perimetres`, et de nombreux fichiers relisent l'état
historique complet par `legacy.recompose()`, qu'ils doivent ensuite filtrer eux-mêmes (`redactLegacy`, `assertLegacyKeys`
ou un contrôle propre). Chaque nouvelle lecture transverse doit donc réécrire les mêmes contrôles ; un oubli expose une
donnée que le lecteur n'aurait pas dû voir. Les correctifs de sécurité de novembre 2026 ont corrigé ces oublis un à un.
Cette décision traite la cause : l'absence d'un endroit unique par où les données d'un module sortent vers un autre.

## Décision

> Toute donnée d'un module qui sort de ce module (réponse HTTP, export, agrégat, copie dans un autre module) passe par une
> **porte de lecture autorisée** qui applique, avec les droits du lecteur : le droit de module, le périmètre, le registre
> restreint et le rôle attribué. Aucun module n'interroge directement les tables d'un autre module, sauf à travers cette
> porte.

La porte est la classe `PorteeLecture` (`apps/api/src/acces/portee.ts`). Une portée est créée **une fois par requête**, pour
**un seul lecteur**, et ne doit pas être conservée au-delà (les droits et les périmètres peuvent changer). Elle compose les
primitives existantes du module GRC sans les remplacer et met leurs résultats en cache pour sa durée de vie.

| Méthode | Rôle | Primitive réutilisée |
|---|---|---|
| `estAdmin()` | l'administrateur contourne les masques | `Grc.isAdmin` |
| `peutLireModule(module)` | droit de lecture effectif et module activé, sans exception | `Rights.can`, `Modules.assert` |
| `perimetresLisibles()`, `perimetreLisible(smsi, module?)` | périmètres que le lecteur peut ouvrir | `Grc.listSmsis` |
| `registresMasques()` | registres restreints illisibles, tous périmètres confondus | `GrcRegistres.inaccessiblesPartout` |
| `typesLisibles()` | types d'objets GRC dont le module est lisible | `GRC_MODULES` |
| `filtrerObjets(requête)` | ajoute à une requête Kysely sur `grc_objects` : module du type, périmètre lisible, registre non masqué | modèle de `Grc.listObjects` |
| `nomSiLisible(smsi, ref)`, `refLisible(smsi, ref)` | résout une référence avec les droits du lecteur ; `null` ou faux si elle est illisible, absente ou supprimée | `Grc.resolve` |
| `etatHistorique()` | état historique déjà rédigé, clé par clé | `redactLegacy` |

Règles de conception :

- **Prudence** : en cas de doute, la porte masque plutôt que de révéler. `filtrerObjets` exclut les éléments d'un registre dont
  le périmètre de référence n'est pas lisible, même si le lecteur y tient un rôle attribué ; la lecture unitaire
  (`Grc.object`) reste la référence pour ce cas.
- **Pas de SQL brut** : les conditions sont des valeurs liées Kysely (pas de `sql.raw` ni de `sql.lit`).
- **Performance** : masques et périmètres sont calculés une fois par portée ; les résolutions de références se regroupent par
  lot plutôt que par appels répétés dans une boucle.
- **Comportement inchangé** : les administrateurs et les rôles attribués légitimes gardent leur comportement.

## Plan de mise en œuvre

Une PR par étape, vers `claude-suivi-smsi`, chacune livrable seule et laissant la CI verte.

1. **Cette ADR et le module `PorteeLecture`**, avec tests ; aucun branchement sur le code existant, aucun changement de
   comportement.
2. Brancher les lecteurs transverses sur la porte, par sous-ensemble : historique, carte des risques et rapport, pilotage,
   registres et import Tenacy, catalogue de configuration, import et export historique, annuaire et agrégats.
3. Ne plus stocker de copies de libellés protégés (libellés de cartes, noms dans les décisions de pilotage, nom des actions
   générées) : les résoudre à la lecture avec les droits du lecteur. Les décisions immuables ne sont pas réécrites.
4. Garde-fous automatiques : un test d'architecture (requêtes sur les tables GRC et appels à `legacy.recompose()` hors d'une
   liste blanche justifiée) et un test d'accès systématique des routes.
5. Découpage des gros fichiers de routes, sans changement d'URL, de schéma ni de niveau d'accès (document OpenAPI identique).

## Hors périmètre

Microservices, découpage de la base ou rôles PostgreSQL par module, sécurité au niveau des lignes (RLS) et changement du
déploiement Compose. La RLS pourrait faire l'objet d'une ADR ultérieure. La sortie progressive du modèle historique (ADR 0007)
est un chantier distinct, qui exige une décision du RSSI et une note de cadrage.

## Conséquences

- Les nouvelles lectures transverses ont un point d'entrée unique ; le test d'architecture (étape 4) empêche d'en
  réintroduire un accès direct sans le voir en revue.
- Un coût de calcul par requête (périmètres lisibles, registres masqués), borné par la mise en cache de la portée.
- Les correctifs ponctuels déjà fusionnés restent en place ; leur migration vers la porte (étape 2) est un changement de
  structure à comportement constant, couvert par les tests existants.

## Alternatives écartées

- **RLS PostgreSQL** : sécurité en profondeur, mais règles d'accès (rôles attribués, héritage de périmètres, registres) trop
  riches pour des politiques SQL maintenables à cette échelle ; envisageable plus tard.
- **Un rôle PostgreSQL par module** : complexité d'exploitation disproportionnée pour la cible.
- **Statu quo (contrôles dans chaque service)** : c'est la source des oublis constatés.
