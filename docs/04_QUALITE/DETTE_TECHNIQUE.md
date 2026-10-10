# Dette technique

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

| ID        | Dette / fait observé                             | Impact                                                                   | Priorité / action                                              |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| DETTE-001 | Monolithe HTML historique encore indispensable   | CSP moins stricte, parcours et exports à maintenir                       | P1 MIG-001 ; reprise par famille, sans suppression prématurée. |
| DETTE-002 | État legacy JSON partagé et adaptations directes | Verrou global, couplage des versions ; source unique mais non normalisée | P2 migrations explicites et tests d’aller-retour.              |
| DETTE-003 | Deux générations de documentation/planning       | Risque d’annoncer des cibles comme livrées                               | P1 index, snapshots datés et registre de référence.            |
| DETTE-004 | Couverture v2 métier complète non démontrée      | Filtres/exports/champs avancés peuvent échapper aux tests                | P1 recettes dédiées TEST-028 à TEST-038.                       |
| DETTE-005 | API/tables conservent noms SMSI                  | Dette de vocabulaire interne, compatibilité à préserver                  | P3 expliquer, pas de renommage destructif opportuniste.        |
| DETTE-006 | Nomenclatures B2 et ressources E incomplètes     | Personnalisation/couverture normative partielle                          | P2 DEV-001/002 avec sources officielles.                       |
| DETTE-007 | Performance sans SLO/benchmark                   | Pas de capacité garantie malgré index/pagination et test 10 000 constats | P2 OPT-008, TEST-043.                                          |
| DETTE-008 | Accessibilité testée partiellement               | Contrastes/tailles testés ne valent pas audit WCAG complet               | P2 audit clavier/lecteur d’écran à préparer.                   |

Duplication indépendante de risques/mesures : aucun second registre graphique
n’est introduit ; ne pas inventer une dette de duplication sans source.
Les dépendances HIGH citées ont été corrigées ; vieillissement futur à surveiller,
pas présenté comme une vulnérabilité actuelle démontrée.
