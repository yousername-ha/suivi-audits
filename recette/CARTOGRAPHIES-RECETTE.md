# Recette cartographies et navigation — 11 octobre 2026

Livraison exclusivement Legacy, à partir de `90d698d5`. Toutes les recettes
utilisent des données FICTIVES, des profils isolés et des bases SQLite temporaires.

| Contrôle exécuté | Résultat |
|---|---:|
| Tests unitaires historiques et nouveaux tests cartographiques | 53 passés |
| Serveur : 5 historiques, 11 risques, 9 cartographiques | 25 passés |
| Navigateur : risques et administration | 18 passés |
| Navigateur : parcours guidé, périmètres, CaRE et PCRA | 17 passés |
| Navigateur : dossier auditeur et fonctions historiques | 22 passés |
| Navigateur : canevas SVG, périmètres et navigation | 12 passés |
| **Total** | **147 passés, 0 échec final** |

Le test historique `file://` n'a pas été exécuté : la politique Chromium du
workspace bloque ce protocole. L'application principale du Legacy est qualifiée
sur son serveur localhost ; le dossier auditeur autonome a été testé séparément.

La nouvelle recette couvre la génération depuis les registres, les références
`MAP-`, les déplacements au clavier, l'annulation/rétablissement, les versions et
leur auteur serveur, le renommage sans déplacement, les objets nouveaux, les
quatre exports réels, les familles de processus, les propositions de flux, le GHT,
la cartographie centrale des risques, les droits lecteur/contributeur et la persistance.
L'affichage est testé à 390, 768, 1440 et 3840 pixels, en thème sombre,
sans débordement du document. Aucune requête externe ni erreur JavaScript n'a été relevée.

Les anciens liens de menu sont vérifiés vers leurs nouvelles rubriques.
Le scénario historique qui utilisait `cr-scen`, absent du menu, a été corrigé
vers l'identifiant réel `cr-sc`. Les tests ont été adaptés à l'ouverture des
rubriques repliables ; aucune assertion métier n'a été supprimée.

Les contrôles serveur vérifient également les références étrangères dans les
versions, les objets supprimés, les reclassifications, les versions immuables,
les cartes privées, les coordonnées invalides et les tailles maximales.

Le scan Gitleaks des fichiers a donné zéro détection. Les empreintes des
592 fichiers du dépôt source ont été comparées : aucun changement.
Les captures, PDF/PNG/SVG générés, bases, cookies et mots de passe de recette
restent hors Git. Seuls les résultats anonymes sont livrés.

Les résultats de cette évolution sont conservés dans `cartographies-*.json`
et les sorties unitaires/serveur correspondantes. Aucune CI GitHub n'est présentée
comme validation de ce travail local. La publication se limite à
`legacy/test-lots-d-f`, avec `[skip ci]`, sans PR ni fusion vers l'application principale.
