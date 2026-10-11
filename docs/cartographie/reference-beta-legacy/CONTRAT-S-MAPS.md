# Cartographie (bêta) — module de test dans l'outil historique

Module « Cartographie » (Vue contexte, Vue processus) ajouté à `app/public/index.html` pour tester la
maquette _Map Builder SMSI_ sur l'outil historique avant son portage dans l'application refondue.

## Fichiers

| Fichier          | Rôle                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `carto.js`       | Module complet (données, dispositions, rendu SVG, interactions, exports PNG / PDF / SVG).                                |
| `carto.css`      | Styles du module (jetons de la maquette : marine `#0B2B55`, bleu `#1677FF`, violet, orange, vert).                       |
| `apply_carto.py` | Insère ou met à jour le module dans un `index.html` exporté de l'artefact (idempotent, marqueurs `MB-BEGIN` / `MB-END`). |

Le script est conservé dans ce dossier comme outil historique. Il s’utilise sur
une copie locale destinée à une vérification du legacy, hors installation active :

```bash
python3 docs/cartographie/reference-beta-legacy/apply_carto.py /tmp/source-legacy.html /tmp/legacy-cartographie.html
```

La cartographie native est déjà livrée ; cette injection n’est pas une étape
d’installation ou de mise à jour v3. Le module JavaScript reste nécessaire aux
[tests de parité](../../../packages/shared/test/beta-carto.ts).

## Contrat de données (sans changement de version de structure)

`S.maps` est créé à la volée ; l'import historique (schéma 14) le range dans les clés inconnues.

```text
S.maps = {
  context: MapState, process: MapState,
  issueKind: { "issue:<hash>": "ext" | "int" }      // nature d'un enjeu corrigée à la main
}
MapState = {
  nodes:   { [objectRef]: { x, y, w, h, label } },  // label = dernier nom connu (affiché si l'objet disparaît)
  edges:   [ { id, s, t, type, gen? } ],             // relations graphiques ; gen = proposition à valider
  hide:    { [cléRelationMétier]: 1 },               // relations dérivées masquées sur cette carte
  ignored: { [objectRef]: 1 },                       // objets volontairement absents (pas de bandeau « nouveau »)
  versions:[ { id, at, label, map } ],               // 20 au plus
  updatedAt
}
```

`objectRef` : `process:<code>`, `pi:<id>`, `sup:<id>`, `app:<id>`, `issue:<hash du libellé>`,
`site:<hash>`, `infra:<hash>`, `isms`, `scope` ; cadres propres à la carte : `lane:pil|rea|sup|oth`,
`band:ext|int`, `zone:out`.

Les noms, codes, responsables, familles et l'appartenance au périmètre ne sont **jamais** stockés dans la
carte : ils sont relus dans `S` à chaque affichage (la donnée métier l'emporte, la carte garde x / y / w / h).

## Objets et relations repris de la plateforme

- Processus et sous-processus (`S.processes` : famille, `parent` ou code `X.Y`), périmètre (`S.scope.processes`).
- Parties intéressées (`S.interested`), fournisseurs (`S.suppliers`), applications du GAP (`S.appGaps`).
- Enjeux : `enjeux` des objectifs (« Libellé : description ») et éléments du SWOT le plus récent par processus
  (forces / faiblesses = internes, opportunités / menaces = externes).
- Sites et systèmes : lignes de `S.scope.sites` et `S.scope.systems`.
- Relations dérivées (lecture seule) : processus et SI du périmètre → SMSI, parties intéressées et
  fournisseurs → périmètre, application → fournisseur, enjeu → périmètre et processus (secondaire),
  processus → sous-processus.
- Vue processus : les flux entre processus **n'existent pas dans les données** ; l'assistant les crée comme
  propositions (`gen`) à valider sur la carte.

## Points à arbitrer avant le portage

1. Modéliser les relations entre processus (flux, support) comme données métier, ou les laisser graphiques.
2. Responsabilité de l'appartenance au périmètre (aujourd'hui : écran Périmètre, liste de processus).
3. Nature interne / externe des enjeux : champ métier sur l'enjeu plutôt que surcharge dans `S.maps`.
4. Versionnement : version explicite seulement (actuel) ou aussi automatique à chaque enregistrement.
5. Statut de l'export PDF : support visuel ou preuve documentaire (ajouter alors signature / référence).
6. Tables de la refonte : `maps` (vue, état jsonb), `map_versions`, et identifiants stables (schéma 15)
   pour les objets aujourd'hui repérés par un hachage de libellé (enjeux, sites, systèmes).

## Recette rapide

Générer chaque vue, déplacer un objet, enregistrer, recharger (position conservée) ; renommer un processus
(nom repris, position inchangée) ; supprimer une partie intéressée (« Objet indisponible ») ; mode lecture
seule (`?lecture`) : aucune modification possible ; exports PNG, PDF, SVG.
