# ADR 0060 — Couverture agrégée des cartes de périmètres (L10, dossier 010-04)

- Statut : acceptée
- Date : 2026-10-26
- Contexte : dossier 010-04 (agrégation avec descendants, provenance, détail par référentiel) et décision de l'utilisateur du 26/10/2026 (« Dev L10 et implémente »). Jusqu'ici la carte d'un périmètre reprenait le calcul de l'écran « Couverture » mais le total d'un parent avec ses sous-périmètres laissait la couverture « indisponible » ([ADR 0043](0043-registres-perimetres-herites-et-droits-par-ressource.md), cartes). L'évaluation d'une exigence est **propre à chaque périmètre** : celle du parent n'est pas attribuée à un enfant qui hérite du référentiel.

## Décision

1. **Unité d'agrégation.** La couverture d'un ensemble est la **somme** des couvertures de chaque périmètre lisible (le périmètre et ses descendants accessibles) : une exigence compte **une fois par périmètre où elle est évaluée**. Ce n'est ni une moyenne ni un taux : l'application n'invente toujours pas de pourcentage de conformité. Les champs sont ceux de la carte (exigences, applicables, testées ou validées, à déterminer, clauses obligatoires pas encore conformes).
2. **Détail par référentiel.** Chaque référentiel et version apparaît sur sa ligne avec ses propres sommes et le nombre de périmètres comptés ; la somme du détail est celle du total (testé).
3. **Provenance.** Sur la carte d'un périmètre seul, chaque référentiel dit s'il est **rattaché ici** ou **hérité** d'un parent ; le nom du parent n'est donné que s'il est accessible à la personne (sinon « d'un périmètre parent non accessible » : aucune fuite de nom). Dans un total, la provenance n'est pas reprise (elle varie d'un périmètre à l'autre) ; le total indique le nombre de périmètres sommés.
4. **Périmètres non lisibles.** Un périmètre de l'ensemble dont la couverture ne peut pas être lue (droit) est **exclu et compté** (`nonLus`) : affiché « n périmètre(s) non lisible(s), exclu(s) », jamais compté comme zéro.
5. **Indisponible, jamais zéro.** Sans droit de lecture de la conformité, ou si aucun périmètre de l'ensemble n'a de référentiel effectif, la couverture reste « indisponible ».
6. **Total général.** Le total sans doublon de tous les périmètres (en haut du graphe) n'agrège toujours pas la couverture : il mélangerait des référentiels sans lien.
7. **Réalisation.** Fonction pure `agregerCouvertures` (paquet partagé, testée), `cartesPerimetres` (une lecture de couverture par périmètre, mémorisée), `origineId` ajouté aux référentiels de `coverage()`. Aucune migration, aucun nouveau réglage.

## Ce qui n'est pas fait

- Pas de taux de conformité (aucune formule validée par le métier).
- Pas de pondération entre périmètres ni de dédoublonnage d'une même exigence évaluée dans plusieurs périmètres : chacune est une évaluation distincte.
