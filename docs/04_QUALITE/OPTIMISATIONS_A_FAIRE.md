# Optimisations à faire

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

| ID / description                                            | Bénéfice attendu                                                        | Complexité / priorité         | Prérequis                                                          | Acceptation / tests                                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPT-006 — Mesurer les minutes GitHub par job et fréquence   | Identifier la consommation réelle face au plafond mensuel.              | À estimer après collecte ; P2 | Accès aux statistiques et fenêtre de référence représentative.     | Mesures datées, coûts runner et fréquence ; aucune réduction des contrôles sans analyse. Comparaison non destructive des données Actions.                |
| OPT-007 — Étudier les caches et ciblages de CI documentaire | Limiter les reconstructions lors des changements sans effet applicatif. | À estimer ; P2                | OPT-006 ; vérifier garde de publication et protections de branche. | CI/CodeQL du commit exact restent exigés pour publier ; aucun bypass par job ignoré. Cas doc/code/migration/tag et concurrence sur PR de test autorisée. |
| OPT-008 — Mesurer les grands registres et graphes           | Fixer des budgets et améliorer l’ergonomie aux volumes utiles.          | À estimer ; P2                | Jeux fictifs représentatifs, isolation et objectifs de service.    | Latence/mémoire, limites et comparaison de base publiées ; droits conservés. Charge autorisée hors production et parcours sur graphes volumineux.        |

Risques : cache incorrect ou garde CI contourné, seuils de sécurité relâchés,
perte de non-régression, fuite de données par agrégats/graphes. Toute optimisation
nécessite une mesure de base et la même recette de droits/intégrité avant annonce.
Aucune de ces pistes n’est implémentée pendant l’audit.
