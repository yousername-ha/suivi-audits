# Rapport de recette et limites

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

## Résultats calculés

| Mesure                                    | Résultat                       | Source et portée                                                                                |
| ----------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Cas prévus du plan représentatif          | 45                             | REGISTRES.test_cases ; pas toutes les assertions.                                               |
| Cas avec exécution réussie connue         | 29                             | CI c704fa6 pour le périmètre résumé.                                                            |
| Cas échoués / bloqués                     | 0 / 0                          | Aucun échec final dans les preuves retenues ; ne masque pas les anciens échecs des diagnostics. |
| Cas non exécutés                          | 16                             | Recettes legacy complètes, serveur, humain et mesures/sources restantes.                        |
| Réussite des cas exécutés connus          | 100 % (29/29)                  | Exclut les non exécutés ; ne vaut pas acceptation globale.                                      |
| Tests relancés dans la mission            | 360 passés, 0 échec            | 222 shared + 102 UI + 17 web + 4 Node + 15 Python.                                              |
| Tests de CI historique vérifiée           | 730 passés, 0 échec            | 587 Vitest + 143 Playwright ; autres checks non additionnés.                                    |
| Bugs ouverts confirmés enregistrés        | 0                              | Registre actuel ; ne prouve pas zéro défaut inconnu.                                            |
| Bugs corrigés/validés automatiquement     | 5                              | BUG-001 à BUG-005 ; sur les scopes CI concernés.                                                |
| Acceptation ergonomique                   | En attente                     | BUG-006, TEST-042, PV non signé.                                                                |
| Couverture de toutes exigences normatives | NON CALCULABLE                 | Corpus exhaustif/licences/sources et matrice complète indisponibles.                            |
| Couverture du code                        | NON MESURÉE dans cette mission | Ne pas la déduire du nombre de tests.                                                           |

360 tests locaux et 730 historiques ne sont **pas 1 090 cas distincts** :
des assertions ont été rejouées. Les limites de domaines partiels subsistent
même quand leur cas générique passe.

## Conclusions bornées

[CI](https://github.com/yousername-ha/suivi-audits/actions/runs/38087692231) et [CodeQL](https://github.com/yousername-ha/suivi-audits/actions/runs/38087692214) au commit exact sont verts. Le code actuel et
les contrats testés ont des preuves de non-régression ; la source v2 est conservée.
Le dossier documentaire est distinct d’une recette globale du serveur client.

Fonctions non complètement validées : familles FCT-028 à FCT-038, B2 complet,
E complet, ergonomie humaine, charge cible, reprise hors serveur et sources
officielles non obtenues. Pas de faux PV, capture ni métrique.

Priorité : TEST-041 puis TEST-042 ; sources et migration MIG-001/DEV-001/002.
Toutes les statistiques viennent des registres ; aucun nombre de parcours non
réalisés ou d’abandon volontaire n’est inféré.

## Contrôles documentaires

Deux essais de contrôle ont échoué et sont conservés dans
[les exécutions](EXECUTIONS_RECETTE.md) : EXE-010 comparait aussi les chemins et
numéros de ligne des commentaires ; EXE-011 a détecté une ligne vide ajoutée
dans une section publiée du changelog. Les commentaires seuls sont désormais
normalisés pour la comparaison du guide ; la ligne vide a été retirée. EXE-012
passe. Ces contrôles sont séparés des suites applicatives et des 45 cas du plan.

Le reçu des [contrôles finaux](preuves/2026-10-11-controles-documentaires.json)
trace liens, identifiants, format, confidentialité et préservation du code.
