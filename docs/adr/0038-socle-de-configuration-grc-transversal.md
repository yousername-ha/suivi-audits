# ADR 0038 — Socle de configuration GRC transversal et méthodes épinglées

**Statut** : proposée le 14/10/2026. Étudie et complète les [ADR 0021](0021-configuration-environnement-versionnee.md) (configuration versionnée),
[0023](0023-smsi-referentiels-taches-risques.md) et [0027](0027-risques-ebios-rm-iso27005.md).
Analyse détaillée : [`docs/archive/refonte-grc/`](../archive/refonte-grc/README.md).

## Contexte

Les échelles, matrices, critères et catégories du module de risques sont soit codés en dur (niveaux 1 à 4 de l'étude EBIOS RM),
soit embarqués dans chaque définition de méthode, soit saisis en texte libre. Une même échelle ne peut pas être partagée entre
méthodes, ni versionnée indépendamment, ni auditée. Le cahier de refonte exige une configuration transversale, versionnée,
sans valeur administrable codée en dur, sans dupliquer les registres et sans casser les analyses existantes.

## Décision

1. **Un catalogue de configuration unique** (`cfg_items`, `cfg_versions`, `cfg_usages`) pour cinq types : échelles, matrices,
   correspondances, critères, taxonomies. Mêmes mécanismes que les configurations versionnées existantes : versions
   immuables (triggers), aperçu puis publication confirmée avec motif, `If-Match`, verrou, empreinte d'aperçu, audit.
2. **Épinglage `(élément, version)`** par tout consommateur ; aucune évaluation n'est recalculée avec « la dernière version ». Un
   registre d'usages immuable alimente l'étude d'impact (niveaux ajoutés, retirés, renommés, valeurs, ordre ; consommateurs).
3. **Aucune échelle imposée** : nombre de niveaux, libellés, descriptions, valeurs, couleurs, effets et acceptabilités sont des
   données de l'organisation ; `appliesTo` limite un élément à des familles de méthode sans imposer de concepts EBIOS aux autres.
4. **Les méthodes épinglent** le catalogue par un champ facultatif `bindings` ; la définition publiée **embarque la copie
   résolue** (le moteur `evaluateMethod` est inchangé, les versions antérieures aussi). Les usages `method_version` sont
   enregistrés.
5. **Portées** : `instance` (organisation = instance) et `smsi` (périmètre) ; une variante est une copie dérivée qui mémorise son
   origine. Pas de substitution implicite.
6. **Droits réutilisés** (`parametres:*` pour la portée organisation, `pilotage:administrer` + écriture du périmètre pour un
   périmètre) ; aucun droit n'est élargi.
7. **Rien n'est livré dans le catalogue** : les modèles (par exemple la matrice de pertinence ressources × motivation) sont
   adoptés à la demande, avec leur provenance, et restent des propositions à valider.
8. **Migration SQL additive** ; aucune donnée ni évaluation existante n'est modifiée ; retour arrière : les tables sont ignorées
   par une version antérieure, mais une méthode contenant `bindings` n'est pas relisible par elle (schéma strict) : usage opt-in.

## Conséquences

- Les échelles deviennent réutilisables et auditables ; modifier une échelle crée une version et n'altère aucun consommateur.
- L'interface d'administration, les sélecteurs mutualisés, la liaison d'analyse, la migration explicite et les ateliers EBIOS sur
  catalogue sont des lots suivants ([plan](../archive/refonte-grc/05-PLAN-IMPLEMENTATION.md)).
- Points à arbitrer : [plan](../archive/refonte-grc/05-PLAN-IMPLEMENTATION.md) § 3.
