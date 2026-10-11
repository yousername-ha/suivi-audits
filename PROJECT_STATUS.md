# État synthétique du projet

2026-10-11T04:04:46+02:00 (Europe/Paris). Source applicative : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`, version 3.0.2,
branche `feature/gpt6-evolution-smsi-grc`. Lire [HANDOVER](HANDOVER.md).

## Branche d'unification `claude-suivi-smsi` (11/10/2026, après-midi)

| Sujet | État réel |
| --- | --- |
| Lots livrés sur la branche | U0 carte libre et socle Audit ; U1 tableau de bord unique ; U2 Pilotage (DdA, objectifs par processus, plans, synthèse) ; U3 risques EBIOS RM / ISO/IEC 27005 ; U4 liens transverses |
| Migrations | une seule nouvelle, additive : `016_risques_acceptation.sql` ; retour arrière décrit dans le [plan](docs/unification/PLAN-EVOLUTION.md#retour-arrière) |
| Tests locaux | Vitest : shared 327, ui 117, web 17, API 270 (PostgreSQL 17) ; Playwright complet sur la pile Docker locale (voir HANDOVER) |
| CI GitHub | dépôt rendu public par son propriétaire le 11/10 ; [CI déclenchée manuellement sur `6e921fe`](https://github.com/yousername-ha/suivi-audits/actions/runs/38146426254) : 5 jobs verts (qualité, Vitest sur PostgreSQL, guide d'installation sur Ubuntu vierge, montée de version avec retour arrière et restauration, images + Trivy + Playwright complet + mise à jour intégrée et persistance). CodeQL non exécuté (déclenché seulement par PR ou poussée sur `main`) ; aucune PR ouverte |
| Fusion dans `main` | faite le 11/10 : [#14](https://github.com/yousername-ha/suivi-audits/pull/14) (version 3.1.0) puis [#15](https://github.com/yousername-ha/suivi-audits/pull/15) (limite de débit de la pile de test) ; CI et CodeQL verts sur `57a7bc9` ; PR #1 à #13 fermées sans fusion |
| Non fait | étiquette `v3.1.0` (publication des images), nettoyage des branches (script remis au RSSI : `archive/*`, branche `legacy`), recette du RSSI sur son serveur |

Le registre `docs/08_PILOTAGE/REGISTRES.json`, ses documents dérivés et `verifier-documentation.mjs` ont été réévalués
sur `f9545c3` (CI et CodeQL verts, EXE-013 et EXE-014) : 45 fonctions, 50 cas dont 37 passés en CI, 13 non exécutés (serveur,
ergonomie, performance, références officielles). Les autres documents narratifs gardent l'estampille `c704fa6` (voir l'index).

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
