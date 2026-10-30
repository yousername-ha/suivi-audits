# Registre central des bugs

Référence applicative analysée : `70ab3f09c4937d8445b8c02402956cd835f380d3`. Mise à jour : 2026-10-12T17:00:00+02:00 (Europe/Paris).

Source : [registre de référence](../08_PILOTAGE/REGISTRES.json). On conserve les corrections, sans déduire la réussite
du seul préfixe fix. Les tests confirment le code analysé ; un déploiement ancien
peut encore porter le défaut. « CORRIGÉ NON VALIDÉ » de BUG-006 signifie validation
humaine manquante ; sa CI technique est passée.

## BUG-001 — Clic racine Pilotage sans navigation

| Champ                       | Constat                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-039 ; MAJEURE ; P1                                                                                                                                              |
| Statut                      | CORRIGÉ ET VALIDÉ                                                                                                                                                   |
| Détection / correction      | 2026-10-10 ; date d’après trace, heure initiale inconnue                                                                                                            |
| Environnement               | Refonte/Compose de recette ; serveur client non observé                                                                                                             |
| Déclencheur                 | Accueil, clic sur Pilotage avant toute navigation directe.                                                                                                          |
| Reproduction                | Revenir à la révision antérieure dans un environnement isolé, puis effectuer le déclencheur ci-dessus ; NON REJOUÉ ici.                                             |
| Attendu                     | Ouvrir le pilotage.                                                                                                                                                 |
| Observé initialement        | Le clic dépliait les enfants sans changer de page.                                                                                                                  |
| Cause / niveau              | NavLink Mantine appelait preventDefault ; état ouvert déduit de la route. ; diagnostic historique, code actuel examiné                                              |
| Correctif                   | Navigation explicite et recette du clic desktop/mobile.                                                                                                             |
| Fichiers                    | [apps/web/src/components/Layout.tsx](../../apps/web/src/components/Layout.tsx) ; [tests/e2e/specs/zzz-pilotage.spec.ts](../../tests/e2e/specs/zzz-pilotage.spec.ts) |
| Commit                      | cc285b4 ; résultat actuel vérifié au commit c704fa6                                                                                                                 |
| Non-régression              | TEST-039 ; voir exécutions et réserves                                                                                                                              |
| Reste à vérifier            | Validation sur le serveur utilisateur.                                                                                                                              |

## BUG-002 — Exécutant de sauvegarde indisponible sans cron

| Champ                       | Constat                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-010 ; MAJEURE ; P1                                                                                                                                                                 |
| Statut                      | CORRIGÉ ET VALIDÉ                                                                                                                                                                      |
| Détection / correction      | 2026-10-10 ; date d’après trace, heure initiale inconnue                                                                                                                               |
| Environnement               | Refonte/Compose de recette ; serveur client non observé                                                                                                                                |
| Déclencheur                 | Installation Compose normale sans tâche hôte facultative.                                                                                                                              |
| Reproduction                | Revenir à la révision antérieure dans un environnement isolé, puis effectuer le déclencheur ci-dessus ; NON REJOUÉ ici.                                                                |
| Attendu                     | Sauvegarde web automatiquement prise en charge.                                                                                                                                        |
| Observé initialement        | Absence de heartbeat, demande non exécutée.                                                                                                                                            |
| Cause / niveau              | Compose lançait seulement le worker update ; worker exploitation dépendait du cron. ; diagnostic historique, code actuel examiné                                                       |
| Correctif                   | Poller commun intégré dans updater ; clé/destination générées ou configuration explicite conservée.                                                                                    |
| Fichiers                    | [scripts/update-worker.py](../../scripts/update-worker.py) ; [docker-compose.yml](../../docker-compose.yml) ; [tests/e2e/specs/systeme.spec.ts](../../tests/e2e/specs/systeme.spec.ts) |
| Commit                      | cc285b4 ; résultat actuel vérifié au commit c704fa6                                                                                                                                    |
| Non-régression              | TEST-010 ; voir exécutions et réserves                                                                                                                                                 |
| Reste à vérifier            | Redéploiement des anciennes images et sauvegarde client à recetter.                                                                                                                    |

## BUG-003 — Outil GNU find absent de l’ancien updater

| Champ                       | Constat                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-013 ; MAJEURE ; P1                                                                                                            |
| Statut                      | CORRIGÉ ET VALIDÉ                                                                                                                 |
| Détection / correction      | 2026-10-10 ; date d’après trace, heure initiale inconnue                                                                          |
| Environnement               | Refonte/Compose de recette ; serveur client non observé                                                                           |
| Déclencheur                 | Rotation d’archives dans une image updater antérieure au correctif.                                                               |
| Reproduction                | Revenir à la révision antérieure dans un environnement isolé, puis effectuer le déclencheur ci-dessus ; NON REJOUÉ ici.           |
| Attendu                     | Rotation et mise à jour poursuivies.                                                                                              |
| Observé initialement        | Commande find attendue incompatible avec l’outil livré.                                                                           |
| Cause / niveau              | Dépendance système findutils manquante dans cette ancienne image. ; diagnostic historique, code actuel examiné                    |
| Correctif                   | findutils ajouté à l’image et recette réalisée avec le vrai updater.                                                              |
| Fichiers                    | [docker/updater.Dockerfile](../../docker/updater.Dockerfile) ; [scripts/ci/montee-version.sh](../../scripts/ci/montee-version.sh) |
| Commit                      | cb827c4 ; résultat actuel vérifié au commit c704fa6                                                                               |
| Non-régression              | TEST-013 ; voir exécutions et réserves                                                                                            |
| Reste à vérifier            | L’ancienne image requiert un premier redéploiement ; pas de correction rétroactive d’une image immuable.                          |

## BUG-004 — Verrous non conservés pendant le retour arrière

| Champ                       | Constat                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-013 ; CRITIQUE ; P1                                                                                                         |
| Statut                      | CORRIGÉ ET VALIDÉ                                                                                                               |
| Détection / correction      | 2026-10-10 ; date d’après trace, heure initiale inconnue                                                                        |
| Environnement               | Refonte/Compose de recette ; serveur client non observé                                                                         |
| Déclencheur                 | Échec après migration puis restauration de secours.                                                                             |
| Reproduction                | Revenir à la révision antérieure dans un environnement isolé, puis effectuer le déclencheur ci-dessus ; NON REJOUÉ ici.         |
| Attendu                     | Exclusivité sauvegarde/restauration jusqu’à fin de l’opération.                                                                 |
| Observé initialement        | Risque de relâchement des verrous au changement de processus.                                                                   |
| Cause / niveau              | Cycle de vie des descripteurs de verrou dans la chaîne shell. ; diagnostic historique, code actuel examiné                      |
| Correctif                   | Maintien des descripteurs 8/9 sur la durée complète ; recettes de retour arrière.                                               |
| Fichiers                    | [scripts/mettre-a-jour.sh](../../scripts/mettre-a-jour.sh) ; [scripts/ci/montee-version.sh](../../scripts/ci/montee-version.sh) |
| Commit                      | f6a52bb ; résultat actuel vérifié au commit c704fa6                                                                             |
| Non-régression              | TEST-013 ; voir exécutions et réserves                                                                                          |
| Reste à vérifier            | Pannes matérielles réelles et reprise après perte du serveur non rejouées.                                                      |

## BUG-005 — Déconnexion et purge de cache non fiables

| Champ                       | Constat                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-003 ; MAJEURE ; P1                                                                                                                                                                   |
| Statut                      | CORRIGÉ ET VALIDÉ                                                                                                                                                                        |
| Détection / correction      | 2026-10-09 ; date d’après trace, heure initiale inconnue                                                                                                                                 |
| Environnement               | Refonte/Compose de recette ; serveur client non observé                                                                                                                                  |
| Déclencheur                 | Erreur logout ou initialisation anonyme d’un écran mural.                                                                                                                                |
| Reproduction                | Revenir à la révision antérieure dans un environnement isolé, puis effectuer le déclencheur ci-dessus ; NON REJOUÉ ici.                                                                  |
| Attendu                     | Ne purger qu’après résultat serveur et conserver le contrôle mural observé.                                                                                                              |
| Observé initialement        | Erreur ignorée ; cache/observateur mural supprimé, chargement bloqué après révocation.                                                                                                   |
| Cause / niveau              | clear() et purge générique traitaient aussi une autorisation murale indépendante. ; diagnostic historique, code actuel examiné                                                           |
| Correctif                   | Purge des données privées, session observée, reset du mural et propagation logout entre onglets.                                                                                         |
| Fichiers                    | [apps/web/src/logout.ts](../../apps/web/src/logout.ts) ; [apps/web/src/session.tsx](../../apps/web/src/session.tsx) ; [apps/web/test/logout.test.ts](../../apps/web/test/logout.test.ts) |
| Commit                      | 0e45380 ; résultat actuel vérifié au commit c704fa6                                                                                                                                      |
| Non-régression              | TEST-003 ; voir exécutions et réserves                                                                                                                                                   |
| Reste à vérifier            | Conditions réseau du serveur client non vérifiées.                                                                                                                                       |

## BUG-006 — Ergonomie GRC signalée inutilisable

| Champ                       | Constat                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-026 ; MAJEURE ; P1                                                                                                                                      |
| Statut                      | CORRIGÉ NON VALIDÉ                                                                                                                                          |
| Détection / correction      | 2026-10-10 ; date d’après trace, heure initiale inconnue                                                                                                    |
| Environnement               | Refonte/Compose de recette ; serveur client non observé                                                                                                     |
| Déclencheur                 | Ancien écran GRC à onglets techniques et création de SMSI.                                                                                                  |
| Reproduction                | Revenir à la révision antérieure dans un environnement isolé, puis effectuer le déclencheur ci-dessus ; NON REJOUÉ ici.                                     |
| Attendu                     | Menu métier historique, pilotage multi-référentiels accessible.                                                                                             |
| Observé initialement        | Insatisfaction explicite de l’utilisateur ; détails d’une observation serveur indépendants indisponibles.                                                   |
| Cause / niveau              | DÉCLARÉ : organisation technique rejetée. Pas de mesure ergonomique indépendante. ; diagnostic historique, code actuel examiné                              |
| Correctif                   | Pilotage par rubrique, création SMSI retirée du parcours normal, G/H/K et début E.                                                                          |
| Fichiers                    | [apps/web/src/pages/Pilotage.tsx](../../apps/web/src/pages/Pilotage.tsx) ; [apps/web/src/pilotage-navigation.ts](../../apps/web/src/pilotage-navigation.ts) |
| Commit                      | 661309c ; résultat actuel vérifié au commit c704fa6                                                                                                         |
| Non-régression              | TEST-042 ; voir exécutions et réserves                                                                                                                      |
| Reste à vérifier            | Tests CI passés ; acceptation ergonomique humaine NON EXÉCUTÉE.                                                                                             |

Les trois alertes HIGH de dépendances constituent un correctif de sécurité
historique distinct, documenté dans dependances-high et SEC/optimisations ;
elles ne sont pas ajoutées artificiellement comme trois bugs applicatifs ouverts.

## BUG-007 — Tableaux du registre des risques et de l’étude EBIOS sans composant Table

| Champ                       | Constat                                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-042 ; MAJEURE ; P1                                                                                                                                                                                                                   |
| Statut                      | CORRIGÉ ET VALIDÉ                                                                                                                                                                                                                        |
| Détection / correction      | 2026-10-11 ; pendant l’unification, lots U2 et U3                                                                                                                                                                                        |
| Déclencheur                 | Ouverture du registre des risques ou de l’étude EBIOS RM.                                                                                                                                                                                |
| Attendu                     | Tableaux affichés.                                                                                                                                                                                                                       |
| Observé initialement        | Exception d’exécution « Table component was not found in the tree ».                                                                                                                                                                     |
| Cause / niveau              | CONFIRMÉ : DataTable utilisé sans <Table> interne ; mis en évidence par la recette navigateur.                                                                                                                                           |
| Correctif                   | Contenu enveloppé dans <DataTable><Table>…</Table></DataTable>.                                                                                                                                                                          |
| Fichiers                    | [apps/web/src/grc/RegistreRisques.tsx](../../apps/web/src/grc/RegistreRisques.tsx) ; [apps/web/src/grc/Ebios.tsx](../../apps/web/src/grc/Ebios.tsx) ; [tests/e2e/specs/zzzz-risques.spec.ts](../../tests/e2e/specs/zzzz-risques.spec.ts) |
| Commit                      | f23ad4e                                                                                                                                                                                                                                  |
| Non-régression              | TEST-047 ; CI de f9545c3                                                                                                                                                                                                                 |
| Reste à vérifier            | Validation sur le serveur utilisateur.                                                                                                                                                                                                   |

## BUG-008 — Test de pilotage instable selon l’identifiant tiré au hasard

| Champ                       | Constat                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| Fonction, gravité, priorité | FCT-019 ; MINEURE ; P3                                                         |
| Statut                      | CORRIGÉ ET VALIDÉ                                                              |
| Détection / correction      | 2026-10-11 ; pendant l’unification, lots U2 et U3                              |
| Déclencheur                 | Identifiant de document commençant par « 1 » dans pilotage.test.ts.            |
| Attendu                     | Test déterministe.                                                             |
| Observé initialement        | Remplacement de « :1 » au premier endroit rencontré, référence altérée à tort. |
| Cause / niveau              | CONFIRMÉ : défaut du test, pas du code applicatif.                             |
| Correctif                   | Remplacement ancré en fin de référence.                                        |
| Fichiers                    | [apps/api/test/pilotage.test.ts](../../apps/api/test/pilotage.test.ts)         |
| Commit                      | 69e4618                                                                        |
| Non-régression              | TEST-019 ; CI de f9545c3                                                       |
| Reste à vérifier            | Aucun.                                                                         |

## BUG-009 — Échec intermittent de connexion dans les tests API (code TOTP en bord de fenêtre)

| Champ                       | Constat                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-001 ; MINEURE ; P2                                                                                                                                                                    |
| Statut                      | CORRIGÉ ET VALIDÉ                                                                                                                                                                         |
| Détection / correction      | 2026-10-12 ; recette automatisée                                                                                                                                                          |
| Déclencheur                 | CI de main (ec2979b) : documents.test.ts et import.test.ts, « Code incorrect ou déjà utilisé » à l’étape MFA.                                                                             |
| Attendu                     | Connexion de test déterministe.                                                                                                                                                           |
| Observé initialement        | Deux tests en échec sur main, verts sur la PR du même code.                                                                                                                               |
| Cause / niveau              | CONFIRMÉ : nextCode choisissait le pas TOTP précédent, en bord de la fenêtre acceptée ; l’horloge franchissait la limite de 30 s sur un exécuteur chargé. Défaut du test, pas du serveur. |
| Correctif                   | Pas courant essayé en premier, puis le suivant, puis le précédent.                                                                                                                        |
| Fichiers                    | [apps/api/test/helpers.ts](../../apps/api/test/helpers.ts)                                                                                                                                |
| Commit                      | a8f5026                                                                                                                                                                                   |
| Non-régression              | TEST-001 ; CI de 70ab3f0                                                                                                                                                                  |
| Reste à vérifier            | Aucun.                                                                                                                                                                                    |

## BUG-010 — Défauts d’accessibilité relevés par axe-core (53 constats au premier passage)

| Champ                       | Constat                                                                                                                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | FCT-005 ; MAJEURE ; P2                                                                                                                                                                                                                                                      |
| Statut                      | CORRIGÉ                                                                                                                                                                                                                                                                      |
| Détection / correction      | 2026-10-12 ; recette automatisée                                                                                                                                                                                                                                            |
| Déclencheur                 | Premier passage de zzzzz-accessibilite.spec.ts sur 14 écrans, clair/sombre, ordinateur/téléphone.                                                                                                                                                                           |
| Attendu                     | Aucune violation WCAG 2.0/2.1 A et AA détectable.                                                                                                                                                                                                                           |
| Observé initialement        | Contraste insuffisant des couleurs d’état et de l’onglet actif sombre (2,1 à 3,9 pour 4,5), liens distingués par la seule couleur, lien d’accueil sans nom sur téléphone, tableaux défilants inatteignables au clavier.                                                     |
| Cause / niveau              | CONFIRMÉ : nuances par défaut de Mantine trop claires ; liens soulignés au survol seulement ; composants sans nom accessible ni focus.                                                                                                                                      |
| Correctif                   | Tous corrigés : couleurs d’état assombries, liens toujours soulignés, onglet actif sombre (rétablis après le retrait du 12/10/2026, le design étant désormais fourni) ; plus aucun écart connu dans le test. |
| Fichiers                    | [packages/ui/src/tokens.ts](../../packages/ui/src/tokens.ts) ; [packages/ui/src/theme.ts](../../packages/ui/src/theme.ts) ; [tests/e2e/specs/zzzzz-accessibilite.spec.ts](../../tests/e2e/specs/zzzzz-accessibilite.spec.ts)                                                |
| Commit                      | e8af11a                                                                                                                                                                                                                                                                     |
| Non-régression              | TEST-051 ; CI de 70ab3f0                                                                                                                                                                                                                                                    |
| Reste à vérifier            | Passage du test d’accessibilité sur la pile complète (CI).                                                                                                                                                                              |

## BUG-011 — Échecs intermittents des tests de bout en bout en CI

| Champ                       | Constat                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonction, gravité, priorité | Recette automatisée ; MINEURE ; P2                                                                                                                                                       |
| Statut                      | EN COURS : diagnostic outillé                                                                                                                                                            |
| Détection / correction | 2026-10-26 et 2026-10-27 ; CI des PR #92, #112, #122, #123, #124 et #140 |
| Déclencheur                 | Job « Images, sécurité et pile complète (Playwright) », étape des tests de bout en bout.                                                                                                 |
| Attendu                     | Résultat identique d'une exécution à l'autre sur le même commit.                                                                                                                         |
| Observé initialement        | Échec au premier passage, réussite au rejeu sans modification ; les PR concernées ne touchaient pas l'interface.                                                                         |
| Cause / niveau | PARTIELLE : un test identifié (revues des accès, annotation « Test instable » de la CI de la PR #140) : l’enregistrement part au blur, sans être attendu, et la page est rechargée aussitôt ; la requête peut être interrompue. Autres tests : cause inconnue. ; second test identifié le 29/10/2026 (CI de la PR #168) : administration en cartes, contrôle axe-core exécuté avec les transitions de l'interface actives (cause probable, non prouvée : le message de la CI est tronqué). |
| Correctif | Rejeu unique en CI ; annotation GitHub par test en échec ou instable ; revues des accès : le test attend la réponse de l’enregistrement avant de recharger. ; administration en cartes : contexte sans transitions (`reducedMotion`), comme les autres tests axe-core ; l'annotation de la CI donne la ligne de l'assertion en échec. |
| Fichiers                    | [tests/e2e/playwright.config.ts](../../tests/e2e/playwright.config.ts) ; [scripts/ci/rapport-e2e.mjs](../../scripts/ci/rapport-e2e.mjs) ; [.github/workflows/ci.yml](../../.github/workflows/ci.yml) |
| Commit | À compléter à la fusion de la PR de correction. |
| Non-régression              | Annotations « Test instable » relues sur les PR suivantes.                                                                                                                               |
| Reste à vérifier | Une seule instabilité relevée sur les 12 PR du 28 et 29/10/2026 ; relire les annotations sur les PR suivantes. Si le test d'administration en cartes reste instable, la ligne indiquée par l'annotation désigne l'assertion en cause. |

## BUG-012 — Échec passager de la construction de l'image « updater » en CI

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Chaîne de construction des images ; MINEURE ; P2 |
| Statut | CORRIGÉ |
| Détection / correction | 2026-10-28 ; CI des PR #158, #159 et #163 |
| Déclencheur | Job « Montée de version », étape de construction de `docker/updater.Dockerfile` (compilation de cosign avec Go). |
| Attendu | Résultat identique d'une exécution à l'autre sur le même commit. |
| Observé initialement | Échec de `go build` sans rapport avec le code de la PR, réussite au rejeu. |
| Cause / niveau | PROBABLE : indisponibilité passagère du proxy ou de la base de sommes de Go pendant le téléchargement des modules. Le message exact de Go n'est pas conservé par la construction en mode silencieux. |
| Correctif | Les compilations Go des images `updater` et `web` sont réessayées jusqu'à 4 fois (15, 30 puis 45 secondes d'attente) ; la vérification des modules reste active. |
| Fichiers | [docker/updater.Dockerfile](../../docker/updater.Dockerfile) ; [docker/web.Dockerfile](../../docker/web.Dockerfile) ; [scripts/tests/conteneurs.test.mjs](../../scripts/tests/conteneurs.test.mjs) |
| Commit | 6ef7136 (PR #164) |
| Non-régression | Test `scripts/tests/conteneurs.test.mjs` ; CI des PR suivantes. |
| Reste à vérifier | Aucun nouvel échec de cette étape sur les PR suivantes ; sinon, journaliser la sortie de Go. |

## BUG-013 — Main courante de crise écrite sans identifiant du schéma 15

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | FCT-055 (cellule de crise) ; MINEURE ; P2 |
| Statut | CORRIGÉ (CI de la PR à venir) |
| Détection / correction | 2026-10-30, en écrivant le test de bout en bout du RETEX (PR #189) ; correctif dans une PR dédiée (session « Intégration module RETEX incidents ») |
| Déclencheur | Ouverture d'une cellule, entrée de main courante, case de check-list, bascule de mode ou clôture depuis l'écran de crise. |
| Attendu | Chaque entrée de `crisis.cells[].log` porte un identifiant `CL-nnn` unique, comme dans l'outil historique (schéma 15). |
| Observé initialement | Entrées écrites sans identifiant ; l'import « Remplacer un module » d'un état qui en contient est refusé (« Identifiants du schéma 15 manquants ou en double »). L'export officiel n'était pas touché : il attribue les identifiants manquants au moment de l'export. |
| Cause / niveau | CONFIRMÉ : `entreeLog` (`apps/api/src/historique/crise.ts`) créait l'entrée sans `id`. |
| Correctif | Après chaque écriture de la crise, les entrées sans identifiant reçoivent le suivant libre (`nextLegacyId('CL-', …)`), dans toutes les cellules, avec la numérotation de l'export ; les identifiants existants ne changent pas. Les entrées écrites avant le correctif sont numérotées à la prochaine écriture. |
| Fichiers | [apps/api/src/historique/crise.ts](../../apps/api/src/historique/crise.ts) ; [apps/api/test/historique-incidents.test.ts](../../apps/api/test/historique-incidents.test.ts) |
| Non-régression | `historique-incidents.test.ts` : identifiants `CL-001` à `CL-003` et `schema15Problems` vide ; reprise d'une cellule antérieure (`CL-008`, `CL-007` conservé, `CL-009`, `CL-010`). Les deux tests échouent sans le correctif. |
| Reste à vérifier | Instance existante : une cellule restée sans nouvelle écriture garde ses entrées sans identifiant jusqu'à la suivante (l'export les numérote toujours). |
