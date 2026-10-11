# Dossier Cartographie — références de conception et de parité

La cartographie native est déjà livrée. Pour reprendre le projet, lire
[AGENTS](../../AGENTS.md), [HANDOVER](../../HANDOVER.md) et
[l’index actuel](../00_INDEX.md). Le dossier présent conserve les exigences et
les références nécessaires à la maintenance de la carte et aux tests du legacy.

| Élément                                                          | Rôle                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [SPEC-CARTOGRAPHIE-V3.md](SPEC-CARTOGRAPHIE-V3.md)               | Exigences CARTO-01 à CARTO-14, droits, API et reprise legacy.                         |
| [RECETTE.md](RECETTE.md)                                         | Parcours de recette de conception, à distinguer des résultats réellement exécutés.    |
| [reference-beta-legacy](reference-beta-legacy/CONTRAT-S-MAPS.md) | Contrat, code bêta consommé par les tests de parité, scripts et captures historiques. |
| [maquette](maquette/README.md)                                   | Intentions fonctionnelles, données fictives, types et références visuelles.           |
| [ADR 0013](../adr/0013-cartographie.md)                          | Choix de l’implémentation native SVG React.                                           |
| [Recette actuelle](../05_RECETTE/RAPPORT_RECETTE.md)             | Preuves datées, limites et validations encore attendues.                              |

Le premier chantier d’intégration et son ordre de fusion des PR datent du
8 octobre 2026 ; ils sont terminés. L’ancien prompt de réalisation a été retiré
au nettoyage du dépôt pour éviter de relancer ces opérations. L’historique Git
conserve son contenu et les anciens constats.

Le module `reference-beta-legacy/carto.js` est toujours lu par
[packages/shared/test/beta-carto.ts](../../packages/shared/test/beta-carto.ts).
Les captures Playwright actuelles de `tests/e2e/specs/__captures__` restent les
références de non-régression de l’interface. Les captures de ce dossier et de
la galerie Sauge sont des références historiques, pas une nouvelle acceptation.

Aucune donnée réelle dans les exemples ; ne pas modifier l’outil en service pour
rejouer un script historique. La liste des éléments retirés et des preuves de
conservation est dans [le diagnostic de nettoyage](../diagnostics/2026-10-11-nettoyage-depot.md).
