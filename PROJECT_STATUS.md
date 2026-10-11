# État synthétique du projet

2026-10-11T04:04:46+02:00 (Europe/Paris). Source applicative : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`, version 3.0.2,
branche `feature/gpt6-evolution-smsi-grc`. Lire [HANDOVER](HANDOVER.md).

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
