# Vérifications de cette livraison

13 octobre 2026. Base inspectée : `f7e543a5c1f31e0bd904f40cf941dbed32fa9dd3`.

## Contrôles réalisés

- 24 rubriques / **100 destinations** parcourues depuis le registre réel.
- **104 captures** de l’application : 100 routes + quatre utilitaires ; une reconstitution de référence supplémentaire, soit **105 PNG** dans cette série.
- Dimensions, lecture PNG et empreintes SHA-256 vérifiées.
- Erreurs JavaScript de page : **0**.
- Requêtes HTTP vers un tiers pendant la capture : **0**.
- Base temporaire et fixture `LegacyDemo` ; aucun document utilisateur ni base réelle capturé.
- Empreintes des sources applicatives inchangées ; seules des ressources de documentation sont ajoutées.
- Source de la recette et résultats détaillés : `technique/capture.cjs`, `technique/verification.json`.

## Cartographies

- Cartographie sans habillage dmap : PASSÉ.
- Cartographie sans habillage mb-ctx : PASSÉ.
- Cartographie sans habillage mb-proc : PASSÉ.

L’égalité est vérifiée entre deux captures consécutives du rendu inchangé, sans CSS de prévisualisation. Cela prouve la non-application du thème durant cette capture ; **ce n’est pas une recette complète des interactions cartographiques**. La future implémentation devra comparer un avant/après réel et tester les interactions.

## Largeurs contrôlées sur le cockpit du prototype

| Fenêtre | Largeur du document | Résultat |
| --- | --- | --- |
| 390 px | 390 px | Sans débordement |
| 768 px | 768 px | Sans débordement |
| 1440 px | 1442 px | Sans débordement |
| 1920 px | 1922 px | Sans débordement |

Débordements globaux sur les captures bureau : **0**. Les éventuels défilements internes de tables sont conservés.

## Limites

Les captures techniques cadrent le premier écran ; elles ne sont pas des captures complètes de toutes les tables ni de tous les formulaires. Des états vides sont normaux dans la fixture. Le thème sombre et tous les scénarios métier n’ont pas été recettés pour cette livraison documentaire. Les suites unitaires/API existantes ne sont pas réexécutées puisque le code applicatif est inchangé ; les commandes nécessaires à l’implémentation sont fournies dans le dossier.

Le prototype injecte un en-tête et des styles en mémoire. Il ne vaut pas une livraison du thème en production. La référence HTML illustre les choix de composition approuvés ; elle ne doit pas remplacer les calculs métier réels.
