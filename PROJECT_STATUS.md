# État synthétique du projet

2026-10-11T04:04:46+02:00 (Europe/Paris). Source applicative : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`, version 3.0.2,
branche `feature/gpt6-evolution-smsi-grc`. Lire [HANDOVER](HANDOVER.md).

## Branche d'unification `claude-suivi-smsi` (11/10/2026, après-midi)

| Sujet | État réel |
| --- | --- |
| Lots livrés sur la branche | U0 carte libre et socle Audit ; U1 tableau de bord unique ; U2 Pilotage (DdA, objectifs par processus, plans, synthèse) ; U3 risques EBIOS RM / ISO/IEC 27005 ; U4 liens transverses |
| Migrations | une seule nouvelle, additive : `016_risques_acceptation.sql` ; retour arrière décrit dans le [plan](docs/unification/PLAN-EVOLUTION.md#retour-arrière) |
| Tests locaux | Vitest : shared 327, ui 117, web 17, API 270 (PostgreSQL 17) ; Playwright complet sur la pile Docker locale (voir HANDOVER) |
| CI GitHub | non utilisée : quota Actions atteint ; aucune PR ouverte pour cette branche |
| Non fait | recette du RSSI, PR unique, rationalisation des branches (U7, sur accord explicite), actualisation de l'audit documentaire ci-dessous |

Le registre `docs/08_PILOTAGE/REGISTRES.json` et `verifier-documentation.mjs` restent l'instantané de `c704fa6` : sur cette
branche, le vérificateur signale à juste titre « sources applicatives modifiées depuis le snapshot ». Les lignes
FCT-019, FCT-022, FCT-030 et FCT-038 y sont dépassées par les lots U2 et U3 ; leur réévaluation demande une recette
datée sur le code de la branche.

## Instantané documentaire de `feature/gpt6-evolution-smsi-grc`

| Sujet                      | État réel                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Architecture               | React/Fastify/PostgreSQL + source legacy conservée ; gateway et updater intégrés.                                |
| Livraisons                 | A, B1, B2a/B2b, C, G/H/K et début E ; B2/E complets non établis.                                                 |
| Non autorisés actuellement | D/J/I/F ; aucune fusion dans main.                                                                               |
| Fonctionnalités            | 40 domaines, 27 avec validation automatisée bornée, 6 partiels, 6 familles non reprises dans Sauge.              |
| Qualité                    | 5 bugs corrigés/validés automatiquement ; aucun ouvert confirmé enregistré ; ergonomie en attente d’acceptation. |
| Tests                      | 360 relancés localement sans base ; CI historique vérifiée : 587 Vitest + 143 Playwright.                        |
| Risques sécurité           | 6 risques/limites documentés ; aucune attestation exhaustive d’absence de secret.                                |
| Optimisations              | 5 réalisées ; 3 à étudier ; gain global de minutes non mesuré.                                                   |
| Recette utilisateur        | NON EXÉCUTÉE dans cet audit ; PV EN ATTENTE DE VALIDATION.                                                       |
| GitHub                     | Privé ; documentation 7cc35dc publiée ; PR #12 ouverte en brouillon, sans fusion ni release.                     |

Prochaine action : TEST-041 sur le serveur réellement utilisé, puis TEST-042
(ergonomie). Sources chiffrées : [registre de référence](docs/08_PILOTAGE/REGISTRES.json). Limitations :
[rapport](docs/05_RECETTE/RAPPORT_RECETTE.md). Les chiffres décrivent ces registres,
pas toutes les fonctions nommées du HTML ni toutes les exigences ISO/HDS.

Entretien du dépôt : voir [nettoyage](docs/diagnostics/2026-10-11-nettoyage-depot.md).
Les chiffres de l’audit initial restent distincts des contrôles de cet entretien.

CI documentaire 7cc35dc : échec sur le protocole de retour arrière simulé
(245/246 API), qualité/guide/CodeQL réussis ; suivi dans le diagnostic de nettoyage.
