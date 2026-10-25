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

## Addendum (25/10/2026) — échelles des scénarios EBIOS RM épinglées par l'étude (dossier 003-05 et 003-11)

La configuration d'une étude (`StudyConfiguration`) gagne deux liaisons facultatives, de type échelle : `scenarioSeverityScale` (gravité des scénarios stratégiques, atelier 3) et `likelihoodScale` (vraisemblance des scénarios opérationnels, atelier 4). Elles suivent le mécanisme de la matrice de pertinence et de la correspondance impact → gravité : élément et version précis, vérifiés à l'enregistrement (existence, type, visibilité, famille `ebios_rm`, archivage), usage « analyse » enregistré, migration explicite avec aperçu d'impact.

- Le niveau retenu est porté par deux champs nouveaux, `severityLevel` (scénario stratégique) et `likelihoodLevel` (scénario opérationnel). Les champs d'origine `gravity` et `likelihood` ne sont ni supprimés ni réécrits : ils continuent de servir aux études sans épinglage, et leur valeur déjà saisie dans une étude épinglée est conservée (l'interface le dit).
- Le serveur refuse un niveau absent de l'échelle épinglée, seulement quand le niveau change (une évaluation passée n'est jamais réécrite).
- L'aperçu de migration mesure les niveaux ajoutés, retirés ou renommés (« résultats modifiés ») et signale les niveaux retenus qui n'existent plus dans la nouvelle version ; l'application ne réécrit aucun scénario.
- La vue de l'étude renvoie le libellé publié du niveau retenu, que la synthèse de l'atelier affiche avec la mention « échelle publiée ».
- Aucune migration SQL : les données restent dans les fiches existantes (JSON validé par le schéma partagé).

Reste hors de ce lot : l'échelle des critères des parties prenantes (`ECHELLE_CRITERE`, 003-04) et la gravité des événements redoutés sans correspondance, qui gardent leur barème local.

Le catalogue `environment` (ADR 0021), qui ne servait qu'aux évaluations des usages de l'IA, a été supprimé le 25/10/2026 avec ces évaluations ([ADR 0046](0046-retrait-du-catalogue-environnement.md)) : la Configuration GRC est le seul catalogue d'échelles et de matrices (012-06).
