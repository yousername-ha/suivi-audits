# État synthétique du projet

> **22/11/2026 — style sobre retenu et intégré** : [sources et recette](docs/refonte-neon/integration-fiches-sobres-2026-11-22/README.md).
> Réponse « Top » sur la proposition claire ; aide React native via Mantine, palette centralisée, CSS commun clair/sombre,
> Annuler natif dans la fiche Produit. 1 222 tests web/UI réussis. Déclinaison sombre à valider visuellement, recette serveur
> non exécutée. Les limites du découpage automatique des fiches restent documentées, sans généralisation de leur validation.
>

> **22/11/2026 — proposition graphique des fenêtres** : [galerie clair/sombre](docs/refonte-neon/propositions/fenetres-maintenance-2026-11-22/README.md)
> dans le style de la page de maintenance : surfaces bleu nuit/blanc bleuté, contours cyan et accents violets discrets,
> champs rectangulaires et commandes en contour. Sept variantes, 28 images dont détails HD et exemples compacts.
> CSS isolé, non importé dans le produit ; 12 cas client / 24 ouvertures avec API fictive. Validation graphique attendue.
> Les limites du prototype de mini-menu restent à corriger séparément ; aucune recette serveur ou livraison de version.
>

> **22/11/2026 — dossier d’implémentation pour l’IA** : [point d’entrée](docs/refonte-neon/implementation-interface-2026-11-21/README.md),
> [prompt complet](docs/refonte-neon/implementation-interface-2026-11-21/PROMPT-IA.md) et résumé technique avec neuf captures natives.
> Sources, règles et limites regroupées pour comparer l’existant avant report. Proportions `2742e16`, commandes bleu/cyan
> en contour et prototype de mini-menu sans défilement vertical. Ce prototype reste à finaliser : limites de partie,
> sections trop vides, titres et pieds atypiques. 1 221 tests web/UI réussis, contrôles du code et 11 cas client / 27 ouvertures
> de 7 variantes ; API simulée. Validation humaine et recette Docker/API réelle non exécutées. Aucune fusion ou publication.
>

> **21/11/2026 — proportions et alignements des fenêtres** : [complément documenté](docs/refonte-neon/proportions-fenetres-2026-11-21/README.md).
> Largeurs différenciées pour codes, dates, états et responsables ; aides sous les saisies et alignement à gauche.
> Fiches lg/xl ramenées à 736/864 px à 100 %, grandes présentations graphiques conservées. Inventaire de 302 sélecteurs,
> sans prétendre les avoir tous ouverts individuellement. Validation des images et recette Docker réelle à effectuer.
>

> **21/11/2026 — harmonisation transversale de l’interface** : le [dossier et les images](docs/refonte-neon/harmonisation-plateforme-2026-11-21/README.md)
> décrivent le complément au lot de densité : 58 points d’intégration dans 50 fichiers consommateurs pour les vues,
> recherches et filtres ; cadre commun des fenêtres, formulaires courts en colonnes, aides repliées et icônes centrées.
> **1 214 tests web/UI réussis**, TypeScript web/UI/E2E, lint, format et build verts ; 72 cas de pages et 56 ouvertures de
> 7 variantes de fenêtres, API simulée et données fictives. Les 127 déclarations de fenêtres sont inventoriées, sans
> prétendre avoir testé chaque formulaire. Prochaine action : validation des images puis recette Docker/API réelle,
> non exécutée ici. Aucune fusion de PR, publication de version ou mise en production.
> Code du complément : `e29d6f6` ; raccordement de la 7.5.1 (`01130ce`), métadonnées seulement. Les changements UI restent non publiés.
>

> **21/11/2026 — refonte de densité, branche dédiée** : lot local fondé sur `15dc5a6` (7.5.0), après analyse d’une vidéo privée
> conservée hors dépôt. Le normal devient plus dense que l’ancien compact et le compact resserre encore l’affichage ;
> planning SVG sans agrandissement des textes, aides contextuelles des Vulnérabilités repliées, cache bilan/affectation des
> périmètres séparé. Dernier retour intégré : signature d’organisation et badge Live retirés visuellement, thème en icônes,
> onglets et ajouts en verre transparent ; couleurs métier et attente de connexion SSE conservées.
> **Contrôles finaux locaux** : 352 tests ciblés, TypeScript/lint/format/build réussis ; 60 rendus et 24 cas d’interaction
> avec frontend réel, API interceptée et données fictives, sans erreur. Recette Docker/API réelle et validation humaine
> à faire ; aucune fusion ni mise en production. Détail, invariants et commandes : [dossier du lot](docs/refonte-neon/densite-2026-11-21/README.md).
>
> **20/11/2026** : module Vulnérabilités ([ADR 0100](docs/adr/0100-module-vulnerabilites.md)) sur `claude-suivi-smsi` depuis
> la 7.4.0 : recherche du module, alertes de la veille en cartes, intégrations dans la page Plateforme, fréquences de
> synchronisation (migration `090`, PR #326), imports `.nessus` et exploitation par logiciel malveillant (migrations `093` et
> `094`, PR #331), import du rapport Silène et carte de la surface externe à deux sources en page entière (migration `095`,
> PR #333) ; correctifs de performance PERF-01 à PERF-04 sans migration (PR #339, ouverte). Formats `.nessus` et Silène jamais
> vérifiés sur un export réel. PERF-09 tranché le 20/11/2026 (bornes de synchronisation inchangées) ; ordre du calcul global tranché le
> 20/11/2026 (à priorité égale, le contrôle détecté le plus récemment ; lot PERF-04, PR #339, sans migration). Décisions en
> attente : classes Silène, type du rapport de l'Active Directory. Détail et file : [reprise du 20/11/2026](docs/01_REPRISE_IA/REPRISE-2026-11-20.md).
>
> **15/11/2026** : versions 7.0.0 à 7.1.1 publiées ; sur `claude-suivi-smsi`, flux vers l'extérieur fermés par défaut et ouverts
> par l'activation du module (ADR 0097, lots 1 à 3, migration `071`), critères fournisseurs (ADR 0098, migration `070`), animations en
> continu (ADR 0099). Détail et suite : [reprise du 15/11/2026](docs/01_REPRISE_IA/REPRISE-2026-11-15.md). Le tableau ci-dessous est daté.

## État au 20/10/2026

| Sujet | État réel |
| --- | --- |
| Branches | `main` (version Docker unique), `claude-suivi-smsi` (travail, alignée sur `main`), `legacy` (outil autonome) ; archive testable de l'ancien outil sur `archive/outil-legacy-autonome` |
| Dernière version | `v4.2.0` étiquetée ; `v5.0.0` étiquetée et publiée le 27/10/2026 ; `v5.1.0` préparée le même jour mais jamais étiquetée (son contenu est repris par la 6.0.0) ; **`v6.0.0` préparée** le 29/10/2026, sous le numéro 5.2.0 puis renumérotée par le RSSI (actions manuelles à la mise à jour : MAJEUR), jamais étiquetée en 5.2.0 (étiquette à poser sur `main` après fusion de la PR de version ; notes de mise à jour dans le [CHANGELOG](CHANGELOG.md#600--2026-10-29) ; la 5.0.0 reste décrite dans le [CHANGELOG](CHANGELOG.md#500--2026-10-27)). Historique : `v3.6.1` publiée ; la `v4.2.0` ajoute les processus en cartes, les types de processus (migration `035`) et la cartographie qui les suit ([ADR 0044](docs/adr/0044-processus-en-cartes-et-types-de-processus.md)) ; la 4.1.0, restée sans étiquette et publiée avec elle, portait : Administration en deux pages à cartes (« Plateforme », « Configuration système »), journaux techniques (migration `034`), couverture ISO/IEC 27001 clause par clause. La 3.6.1 portait la 3.5.0 et la 3.6.0 (jamais publiée : la publication de la 3.6.0 avait échoué sur l'image de l'exécutant) : migrations `022` à `032` (hiérarchie, tables des modules, couverture, registres et droits, validations d'occurrence, fonctions, plans conteneurs), menu à sept familles, registres et déplacement, responsables personne, groupe ou fonction, plans d'actions conteneurs, récurrences (fenêtres, jours exclus, iCalendar, enchaînement), graphe des périmètres, validation OK/KO/NA, écarts classés et rouvrables, pile à jour (TypeScript 6, Vite 8, Vitest 5, React Router 8, Mantine 9), retrait de `/legacy` |
| Intégration ASTRA | **Complète dans le périmètre de la recette** : [R01 à R18](docs/unification/RECETTE-INTEGRATION-ASTRA.md) tous présents, limites connues écrites (iCalendar en fichier seulement, règles de répétition rares non développées) ; constats historiques supprimés (migration 033) |
| Prompt maître ASTRA du 21/10 | **En cours, non terminé** : [audit](docs/unification/AUDIT-ASTRA-2026-10-21.md) (89 exigences) et [suivi d'avancement](docs/unification/SUIVI-ASTRA-2026-10-21.md) (état par exigence, preuves, décisions en attente) ; lots L2 à L11 codés sur la branche de travail, aucun marqueur `IMPLEMENTATION-OK` tant que des exigences restent partielles ou en attente de décision |
| Modules | Tous en tables PostgreSQL ; `app_state` ne garde que la version et le verrou ([ADR 0040](docs/adr/0040-sortie-du-json-plat-modules-en-tables.md)) |
| Ancien outil | Écran `/legacy` retiré ([ADR 0042](docs/adr/0042-retrait-de-lecran-legacy.md)) ; import et export JSON, versions de l'état conservés |
| Tests (local, 20/10) | shared 507+, ui 166, web 54, API 592+ (PostgreSQL 18) ; Playwright complet sur la pile Docker : voir la recette |
| CI GitHub | six contrôles par PR (qualité, tests, CodeQL, guide d'installation, montée de version, pile complète) ; dernière PR fusionnée : #43 |
| Non fait | Recette du RSSI sur son serveur ; étiquette de version (poussée par le RSSI) |

Lire aussi : [PRODUCT](docs/PRODUCT.md), [REFERENTIALS](docs/REFERENTIALS.md), [DECISIONS](docs/DECISIONS.md), [ROADMAP](docs/ROADMAP.md).
Les sections suivantes sont des instantanés datés des 11 et 12 octobre.


2026-10-11T04:04:46+02:00 (Europe/Paris). Source applicative : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`, version 3.0.2,
branche `feature/gpt6-evolution-smsi-grc`. Lire [HANDOVER](HANDOVER.md).

## Branche d'unification `claude-suivi-smsi` (11/10/2026, après-midi)

| Sujet | État réel |
| --- | --- |
| Lots livrés sur la branche | U0 carte libre et socle Audit ; U1 tableau de bord unique ; U2 Pilotage (DdA, objectifs par processus, plans, synthèse) ; U3 risques EBIOS RM / ISO/IEC 27005 ; U4 liens transverses |
| Migrations | une seule nouvelle, additive : `016_risques_acceptation.sql` ; retour arrière décrit dans le [plan](docs/unification/PLAN-EVOLUTION.md#retour-arrière) |
| Tests locaux | Vitest : shared 327, ui 117, web 17, API 270 (PostgreSQL 17, avant le passage à PostgreSQL 18 : [ADR 0035](docs/adr/0035-postgresql-18-migration-automatique.md)) ; Playwright complet sur la pile Docker locale (voir HANDOVER) |
| CI GitHub | dépôt rendu public par son propriétaire le 11/10 ; [CI déclenchée manuellement sur `6e921fe`](https://github.com/yousername-ha/suivi-audits/actions/runs/38146426254) : 5 jobs verts (qualité, Vitest sur PostgreSQL, guide d'installation sur Ubuntu vierge, montée de version avec retour arrière et restauration, images + Trivy + Playwright complet + mise à jour intégrée et persistance). CodeQL non exécuté (déclenché seulement par PR ou poussée sur `main`) ; aucune PR ouverte |
| Fusion dans `main` | faite le 11/10 : [#14](https://github.com/yousername-ha/suivi-audits/pull/14) (version 3.1.0) puis [#15](https://github.com/yousername-ha/suivi-audits/pull/15) (limite de débit de la pile de test) ; CI et CodeQL verts sur `57a7bc9` ; PR #1 à #13 fermées sans fusion |
| Publication | fait le 12/10 : étiquette `v3.1.0` sur `f9545c3` ; [workflow Publication](https://github.com/yousername-ha/suivi-audits/actions/runs/38230058314) vert à la 2e tentative (la 1re n'a obtenu aucun exécutant, aucune étape lancée) : images API, web et updater construites, scannées (Trivy), signées, [release 3.1.0](https://github.com/yousername-ha/suivi-audits/releases/tag/v3.1.0) stable avec SBOM |
| Branches | nettoyées le 12/10 : `main`, `claude-suivi-smsi`, `legacy` (reprend `legacy/test-lots-d-f`, tête `4bcdf60`) ; anciennes branches conservées sous les étiquettes `archive/*` |
| Non fait | recette du RSSI sur son serveur : mise à jour vers 3.1.0 (menu Système) puis `sudo ./scripts/recette-serveur.sh --version 3.1.0 --avec-sauvegarde`, rapport à joindre au PV |

Le registre `docs/08_PILOTAGE/REGISTRES.json`, ses documents dérivés et `verifier-documentation.mjs` ont été réévalués
le 12/10 sur `70ab3f0` (CI 898 tests, CodeQL et recette serveur automatisée en CI verts : EXE-015 à EXE-017) : 45 fonctions,
51 cas dont 39 passés, 12 non exécutés (recette sur le serveur du RSSI, ergonomie, références officielles, fonctions encore
historiques) ; BUG-010 ouvert (sept écarts visuels d'accessibilité reportés, graphisme en cours dans `legacy`). Les autres
documents narratifs gardent l'estampille `c704fa6` (voir l'index). Recette automatisée : [mode d'emploi](docs/05_RECETTE/RECETTE_AUTOMATISEE.md).

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

Entretien du dépôt : voir [nettoyage](docs/archive/diagnostics/2026-10-11-nettoyage-depot.md).
Les chiffres de l’audit initial restent distincts des contrôles de cet entretien.

CI documentaire 7cc35dc : échec sur le protocole de retour arrière simulé
(245/246 API), qualité/guide/CodeQL réussis ; suivi dans le diagnostic de nettoyage.
