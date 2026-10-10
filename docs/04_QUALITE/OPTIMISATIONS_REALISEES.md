# Optimisations réalisées

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

| ID      | Problème / changement                        | Preuve Git et fichier                                                                      | Gain démontré / limite                                                                      | Validation                                                                           |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| OPT-001 | Un seul Trivy bloquant par image             | c704fa6 ; [.github/workflows/ci.yml](../../.github/workflows/ci.yml)                       | 6 → 3 scans vuln d’images par CI complète ; aucun gain global de minutes démontré.          | Bloc simulé avec arrêt sur erreur, Actionlint et job Trivy réel CI réussis.          |
| OPT-002 | Annulation CodeQL obsolète par référence     | c704fa6 ; [.github/workflows/codeql.yml](../../.github/workflows/codeql.yml)               | Évite des exécutions concurrentes obsolètes ; minutes économisées non mesurées.             | YAML validé, CodeQL vert ; scénario réel de deux exécutions concurrentes non rejoué. |
| OPT-003 | Agrégats SQL d’amélioration                  | 661309c ; [apps/api/src/pilotage/service.ts](../../apps/api/src/pilotage/service.ts)       | Compteurs sur 10 000 constats testés sans charger les fiches ; pas de benchmark de latence. | apps/api/test/pilotage.test.ts dans CI c704fa6.                                      |
| OPT-004 | Largeur cartographique rendue au canevas     | 0e45380 ; [apps/web/src/pages/Cartographie.tsx](../../apps/web/src/pages/Cartographie.tsx) | Panneau vide fermé et largeur utile récupérée en 4K ; pas de gain CPU annoncé.              | tests/e2e/specs/z-fiabilisation.spec.ts dans CI.                                     |
| OPT-005 | Cache conservé au premier hello SSE inchangé | 17b6754 ; [apps/web/src/modules.ts](../../apps/web/src/modules.ts)                         | Évite une purge initiale quand les permissions sont inchangées ; volume réseau non mesuré.  | apps/web/test/modules.test.ts relancé, 17 tests web verts.                           |

La suppression de 50 % des scans vuln d’images ne signifie pas 50 % de durée
globale. Aucun benchmark avant/après ni économie totale de facture n’est acquis.
CodeQL annule seulement les anciennes exécutions de la même référence ;
une annulation ne satisfait jamais le garde de publication du commit exact.
