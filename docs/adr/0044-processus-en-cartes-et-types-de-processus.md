# ADR 0044 — Processus en cartes et registre des types de processus

**Statut** : acceptée le 22/10/2026 (cadrée le 21/10/2026 avec le RSSI, [suivi ASTRA](../unification/SUIVI-ASTRA-2026-10-21.md)).
Complète l'[ADR 0013](0013-cartographie.md) (cartographie) et s'appuie sur les liens transverses du Pilotage.

## Contexte

Les processus vivaient à deux endroits qui ne se parlaient pas : la fiche du Pilotage (identité, objectifs) et la cartographie
(bandes fixes Pilotage, Réalisation, Support). Le classement en trois familles était figé dans le code, ni modifiable ni
extensible, et les éléments rattachés à un processus (objectifs, indicateurs, SWOT, risques, fournisseurs) n'étaient visibles
nulle part ensemble.

## Décision

1. **Source unique.** Un processus existe une fois, dans les données du Pilotage. La cartographie en est une vue : un processus
   créé dans l'une apparaît dans l'autre (test de réciprocité). Aucune table nouvelle pour les processus.
2. **Registre des types de processus** dans la Plateforme (migration `035_types_processus.sql`, carte « Types de processus ») :
   code immuable, libellé, description, teinte parmi un jeu fermé, rang, archivage. Les trois familles historiques sont les
   types de départ (« Pilotage » garde le code `Management`) ; les processus existants sont donc migrés sans réécriture. Un
   type utilisé n'est pas supprimable (archivage), un type archivé reste lisible sur les processus qui le portent.
   La famille d'un processus est validée par le serveur contre le registre.
3. **Rattachements en lecture agrégée**, `GET /api/grc/:smsi/pilotage/processus-cartes` : objectifs et leurs indicateurs, SWOT,
   risques, fournisseurs. Ils restent stockés à leur source (champ `processes` des objectifs, liens transverses
   `demonstrates`, `impacts`, `supports`) : rattacher ou détacher depuis une carte écrit à cet endroit, et la relation N–N est
   celle des liens existants. Les fournisseurs ne sont renvoyés qu'avec le droit de lecture correspondant.
4. **Imbrication** : un sous-processus est rattaché à son parent et s'affiche dans la carte du parent.
5. **Interface** : onglet « Processus » de la famille Organisation, cartes classées par type, recherche et filtre par type, fiche
   en fenêtre centrée (identité, rattachements). L'ancien onglet devient « Objectifs par processus ».
6. **Cartographie pilotée par le registre** : les bandes de la vue processus, leurs préréglages, légendes et teintes viennent
   du registre (`definirFamilles`, `packages/shared/src/carto/model.ts`). Les trois clés historiques (`pil`, `rea`, `sup`) sont
   conservées pour les cartes déjà enregistrées ; un nouveau type reçoit une bande `x_<code>`. Un registre vide retombe sur les
   types de départ, et la page recharge son contenu quand le registre change.
7. **Disposition** : la génération place un nouveau processus sans déplacer les autres ; l'ajustement manuel reste mémorisé par
   la carte, comme avant.

## Conséquences

- Aucun JSON à migrer : seuls les types sont nouveaux (table additive, graines idempotentes).
- Le parc de couleurs reste dans la charte (`packages/ui`) : une teinte est un jeton, jamais une valeur libre.
- Dans l'état global du module partagé `carto`, les familles sont une variable de module affectée à l'entrée de la page ;
  tout nouveau point d'entrée de la carte (impression, export) devra passer par `CartographiePage` ou appeler `definirFamilles`.
- Reste hors périmètre : réordonner les cartes à la main dans la page Processus (l'ordre est celui du registre puis du code).

## Preuves

`types-processus.test.ts`, `processus-cartes.test.ts` (dont la réciprocité cartographie ⇄ cartes), `carto-familles.test.ts`,
parcours Playwright `…-processus-cartes.spec.ts` (création, sous-processus, rattachement, bande d'un type ajouté) et
`…-administration-cartes.spec.ts`.
