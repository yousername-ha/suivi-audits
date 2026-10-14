# ADR 0036 — Objectifs, boîtes de pilotage, contexte et revue de direction (lots M5 à M8)

Statut : Acceptée. Date : 13/10/2026. Cadrage : [module qualité ISO 9001](../unification/CADRAGE-MODULE-QUALITE-9001.md), § 4.2, 4.3, 4.5, 4.7 et lots M5 à M8. Édition de référence : ISO 9001:2015 (D9) ; aucun texte de la norme n'est embarqué.

## Contexte

Les processus, objectifs et indicateurs restaient saisis dans l'outil de suivi historique (`app_state`), la revue de direction n'avait qu'une zone de texte, le contexte n'avait ni PESTEL ni opportunités, et la cartographie ne montrait pas l'état des indicateurs. Le RSSI demande la reprise de l'interface de l'ancienne version pour les objectifs, puis la fin des lots M5 à M8.

## Décisions

1. **Les données restent celles de l'outil de suivi** (une seule source modifiable, ADR 0007). Un module dédié (`apps/api/src/pilotage/objectifs.ts`) crée, modifie et supprime processus, objectifs, indicateurs et mesures **dans l'état historique**, sous verrou, avec les mêmes identifiants (`PR1`, `OBJ1`, `IND1`), les mêmes règles de saisie (`parseIndValue` : taux en %, Oui/Non) et le journal d'audit. Les champs écrits l'emportent sur la copie `pilotage` d'une fiche native (elle est tenue à jour : pas de valeur périmée).
2. **Interface des objectifs reprise** : trois vues (par processus, par objectif, compacte), fiches, ajout, mesures, tendance, source de la valeur, légende, filtre d'état ; les états viennent des fonctions partagées en parité avec l'outil historique.
3. **Champs ISO 9001 facultatifs et vides par défaut** : fiche processus (4.4.1 a à h), objectif (6.2.2), indicateur (9.1.1 : quoi, comment, quand surveiller, quand analyser ; 9.1.2 : catégorie « satisfaction », source choisie par l'organisme). La norme n'impose ni valeur, ni fréquence, ni méthode : rien n'est prérempli.
4. **Boîtes de pilotage** (4.4.1 c, 9.1.1) : une par processus ; indicateurs liés par leurs objectifs ou directement, puis actions ouvertes (et en retard), risques, séries récurrentes et **prochaine échéance récurrente**, lus dans le registre commun par liens « lié à ». Ce sont des aides au pilotage, jamais un taux de conformité.
5. **Carte** : calque « santé des indicateurs » (liseré rouge / vert / orange par processus ; pas de liseré sans indicateur) ; `nOk` et `nMes` complètent `nInd` et `nKo` (écart documenté avec la bêta dans le test de parité) ; filtre « ISO 9001 » proposé **seulement si un référentiel 9001 est rattaché** au périmètre commun (révision de l'ADR 0013).
6. **PESTEL** : regroupement des **enjeux externes existants** par facteur, jamais un nouvel objet ; la nomenclature des facteurs est celle de la politique métier (`catalogues.pestelFactors`, optionnelle), six facteurs par défaut ; le facteur d'un enjeu est rangé dans la fiche de périmètre de l'outil de suivi. L'écran précise que la norme ne cite pas le PESTEL et que « politique » et « environnemental » vont au-delà de la note 2 de 4.1.
7. **Opportunité** (6.1) : nouveau type d'objet `opportunity`, plus léger que le risque (origine, bénéfice attendu, décision, revue), sans migration (le type est une donnée). Rattachement aux processus par « lié à ».
8. **Séries proposées** (§ 4.7) : huit modèles tirés du texte de la norme, **sans fréquence** et créés **inactifs** ; l'organisme choisit la fréquence puis active.
9. **Revue de direction** : les entrées de 9.3.2 (a à f, c 1 à 7) sont **préparées à partir des données** (faits chiffrés, sans interprétation ; « aucune donnée » quand elle manque ; adéquation des ressources à saisir) ; les sorties de 9.3.3 sont des champs de la fiche. **Audit combiné** : une fiche d'audit porte ses référentiels audités ; deux ou plus = audit combiné.
10. **Parties intéressées** : champs de l'outil de suivi repris (type, catégorie, traitée, traitement, revue) ; correction du rattachement du champ « exigences » (`req`).

## Conséquences

- Aucune migration SQL. Les données écrites par l'ancienne interface et par la nouvelle sont les mêmes.
- La suppression de l'ancienne interface n'est pas décidée ici : voir [l'archive](../archive/ancienne-interface/README.md).
- Limites assumées : les enjeux sont des lignes de texte (pas des objets), donc le lien enjeu ↔ risque du § 4.6 n'est pas déclaré ; la fréquence d'une série reste à choisir par l'organisme.
