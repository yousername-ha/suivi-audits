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

## BUG-014 — Captures « liste-fiche » dépendantes de la présence résiduelle et de l'état des données

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Recette automatisée (captures de référence) ; MINEURE ; P2 |
| Statut | CORRIGÉ (PR #220 et #217, session « Projet audit_suivi Coeur ») |
| Détection / correction | 2026-11-02 et 2026-11-03, CI des PR #217 et #220 ; correctif dans la PR #220, références remplacées dans la PR #217 avec l'accord du RSSI |
| Déclencheur | Capture « liste-fiche » (fiche de document ouverte) du test `tous-ecrans`, à toutes les largeurs, en clair et en sombre. |
| Attendu | Capture identique d'une exécution à l'autre, indépendante des tests précédents. |
| Observé initialement | Écart de 3 400 à 120 000 pixels selon la largeur : (1) les références contenaient la zone de présence résiduelle (pages laissées ouvertes par des tests précédents, qui continuaient d'envoyer leur présence) ; (2) les références de 1920, 2560 et 3840 px avaient été prises avec un état de données laissé par un test précédent (un nom d'organisation et un menu qui n'étaient plus ceux de l'application, qui affiche « Mon organisation »). |
| Cause / niveau | CONFIRMÉ : pages et contextes non fermés avant les captures ; références générées dans un état de données qui dépend de l'ordre des tests. |
| Correctif | `tous-ecrans.spec.ts` ferme les pages laissées ouvertes et attend l'expiration des présences avant les captures ; références liste-fiche (390, 768, 1366, 1920, 2560 et 3840 px, clair et sombre) remplacées par les images propres produites par la CI. |
| Fichiers | [tests/e2e/specs/tous-ecrans.spec.ts](../../tests/e2e/specs/tous-ecrans.spec.ts) ; [tests/e2e/specs/__captures__/](../../tests/e2e/specs/__captures__/) |
| Non-régression | CI de la PR #217 : 240 tests réussis, aucun échec, aucun instable. |
| Reste à vérifier | Les autres captures de grands écrans n'ont pas échoué ; si l'une d'elles dépend aussi d'un état de données laissé par un test précédent, remplacer sa référence de la même façon (après accord du RSSI). |

## BUG-015 — Cascade de refus « 429 Trop de tentatives » après un échec en CI

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Recette automatisée ; MINEURE ; P2 |
| Statut | CORRIGÉ (PR #222 et #224, session « Projet audit_suivi Coeur », relevé de la CI du 2026-11-04) |
| Détection / correction | 2026-11-03, CI de la PR #217 (run 41719241607) et déjà relevée le 2026-10-31 |
| Déclencheur | Un échec de capture dans `tous-ecrans` relance l'environnement, puis les fichiers suivants (`z-fiabilisation`, `zy-updates`, `zz-*`) se reconnectent. |
| Attendu | Un test en échec n'entraîne pas l'échec des tests suivants. |
| Observé initialement | 105 tests en échec avec `connexion rssi : 429 {"error":"Trop de tentatives. Réessayez dans quelques minutes."}`. |
| Cause / niveau | CONFIRMÉ : limiteurs de connexion `loginByIp` (20 par 15 minutes) et `loginByUser` (10 par 15 minutes) dans `apps/api/src/services.ts`. Les reconnexions après l'échec épuisent le quota, et les tentatives refusées comptent aussi : le refus dure jusqu'à la fin de la suite. |
| Correctif | Étape 1 (PR #222) : relevé des connexions par tranche de 5 minutes dans le journal de la CI. Il a montré, pour un run vert, 19 connexions complètes sur la suite (11, 2, 2 puis 4 par tranche), dont 15 dans le premier quart d'heure, auxquelles s'ajoutent les connexions avec mot de passe provisoire qui comptent aussi pour la limite. Étape 2 (PR #224) : sessions enregistrées par compte créé (`sessionCompte`), session d'installation enregistrée comme session administrateur partagée, préparation d'un compte sans seconde connexion (`preparerCompte`). Les limites de l'application ne sont pas modifiées. |
| Fichiers | [apps/api/src/services.ts](../../apps/api/src/services.ts) (limites, inchangées) ; [tests/e2e/helpers.ts](../../tests/e2e/helpers.ts) ; [tests/e2e/specs/parcours.spec.ts](../../tests/e2e/specs/parcours.spec.ts) ; [tests/e2e/specs/recette-cartographie.spec.ts](../../tests/e2e/specs/recette-cartographie.spec.ts) ; [clés de sécurité](../../tests/e2e/specs/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-cles-securite.spec.ts) ; [RETEX](../../tests/e2e/specs/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-retex.spec.ts) |
| Non-régression | CI de la PR #224 : 240 tests réussis, aucun échec, aucun instable ; relevé de la CI : 6 connexions complètes sur toute la suite (3, 2 puis 1 par tranche de 5 minutes) et 0 refus, contre 19 avant. Le relevé reste dans le journal de chaque exécution de la CI. |
| Reste à vérifier | Un rejeu volontaire d'un test instable n'a pas été fait : relire le relevé sur les prochaines PR (nombre de connexions complètes, aucun refus) ; une cascade de refus ou plus de 15 connexions dans une tranche rouvrirait le bug. |

## BUG-016 — Exclusion d'une mesure de la DdA acceptée sans justification (RSSI-01)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Déclaration d'applicabilité (annexe A, HDS) ; MAJEURE ; P1 |
| Statut | OUVERT |
| Détection | 2026-11-11, premier passage du RSSI virtuel (session « Agent RSSI virtuel », `session_01EnWdzi6XW7jw824ozEWpfF`) |
| Déclencheur | « Applicable » mis à « Non » sur une mesure de l'annexe A, depuis la ligne ou la fiche, sans justification ; ou `PATCH /api/dda/:id` `{ "app": "non", "just": "" }`. |
| Attendu | ISO/IEC 27001:2022, 6.1.3 d) : chaque exclusion est justifiée. L'exclusion non justifiée est refusée, ou signalée comme une incohérence de la DdA (indicateur et filtre, comme « Total avec écart ouvert »). |
| Observé | Réponse 200, la mesure passe « Exclue », aucun message, aucun indicateur ; aucun filtre ne retrouve les exclusions sans justification. |
| Cause / niveau | PROBABLE : `DdaModification` (`packages/shared/src/suivi-dda.ts`) n'a pas de règle entre `app` et `just`, et `incoherente` ne regarde que le niveau « Total ». |
| Non-régression | `tests/e2e/rssi-virtuel/specs/10-dda.spec.ts`, test « RSSI-01 ouvert » (`test.fail` : rouge quand le défaut sera corrigé) ; invariant INV-03. |

## BUG-017 — Taux de mise en œuvre de la DdA calculé sur les mesures non examinées (RSSI-02)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Déclaration d'applicabilité, indicateurs ; MAJEURE ; P1 |
| Statut | OUVERT |
| Détection | 2026-11-11, RSSI virtuel (même session) |
| Déclencheur | DdA de l'annexe A dont seules quelques mesures sont examinées (applicabilité décidée). |
| Attendu | Le taux « en mise en œuvre totale » porte sur les mesures examinées et déclarées applicables ; les mesures non examinées sont comptées à part (« non renseignées »). Un taux affiché ne doit pas laisser croire à un état de la DdA qui n'existe pas (règle « aucun taux inventé » d'AGENTS.md). |
| Observé | Jeu fictif : 6 mesures examinées dont 5 applicables et 2 « Total » ; l'écran affiche 2 % (2 / 92 mesures non exclues) au lieu de 40 %. À part (cause non analysée) : le tableau de bord d'une installation neuve affiche « 0 % » de conformité moyenne sur trois référentiels alors que rien n'est évalué ; « 0 % » n'y est pas distingué de « non évalué ». |
| Cause / niveau | CONFIRMÉ : `statsDda` (`packages/shared/src/suivi-dda.ts`) compte comme applicable toute mesure dont `app` n'est pas « non », donc aussi les mesures non examinées (`app` vide). |
| Non-régression | `10-dda.spec.ts`, test « RSSI-02 ouvert » (`test.fail`), oracle `tauxMiseEnOeuvreTotale` (`tests/e2e/rssi-virtuel/invariants.ts`). |

## BUG-018 — Libellé anglais des boutons d'affichage du mot de passe (RSSI-03)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Installation (création du compte administrateur), accessibilité ; MINEURE ; P3 |
| Statut | OUVERT |
| Détection | 2026-11-11, RSSI virtuel (arbre d'accessibilité de l'écran d'installation) |
| Déclencheur | Étape 3 sur 3 de l'installation, champs « Mot de passe » et « Confirmation ». |
| Attendu | Nom accessible en français (ex. « Afficher le mot de passe »). |
| Observé | Le lecteur d'écran annonce « Toggle password visibility » (libellé par défaut du composant `PasswordInput` de Mantine). Les autres écrans à mot de passe n'ont pas été passés en revue. |
| Non-régression | `tests/e2e/rssi-virtuel/specs/00-installation.spec.ts`, test « RSSI-03 ouvert » (`test.fail`). |

## BUG-019 — Écart désigné par son identifiant technique dans la DdA (RSSI-04)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Déclaration d'applicabilité, colonne « Écarts » ; MINEURE ; P2 |
| Statut | OUVERT |
| Détection | 2026-11-11, RSSI virtuel |
| Déclencheur | Écart du registre rattaché à une mesure de l'annexe A. |
| Attendu | Intitulé ou référence lisible de l'écart, avec un lien vers sa fiche : c'est ce que le RSSI rapproche du rapport d'audit. |
| Observé | La colonne affiche l'UUID de l'écart (ex. `6bc1501f-…`). Le test `zzzzzzzzzzzzzzz-dda-evaluations.spec.ts` vérifie aujourd'hui la présence de cet identifiant : il faudra l'adapter avec le correctif. |
| Non-régression | `tests/e2e/rssi-virtuel/specs/20-ecarts.spec.ts`, test « RSSI-04 ouvert » (`test.fail`). |

## Constats de la recette métier du RSSI virtuel du 12/11/2026 (BUG-020 à BUG-036)

Détection : 2026-11-12, session « Agent RSSI virtuel » (`session_01EnWdzi6XW7jw824ozEWpfF`), commit `7a9494d`, pile native. Déclencheur, observé et attendu de chaque constat : [rapport du 12/11/2026](../05_RECETTE/rssi-virtuel/RAPPORT-2026-11-12.md). Aucune correction par la session de recette. RSSI-13 complète BUG-017 (mesure non examinée affichée « Applicable » dans « Applicabilité et justifications »).

## BUG-020 — Parties intéressées saisies à l'écran comptées nulle part (bandeau et revue de direction à 0) (RSSI-05)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Parties intéressées, revue de direction ; BLOQUANTE ; P1 |
| Statut | OUVERT |
| Cause / niveau | CONFIRMÉE : `Pestel.tsx` (`SynthesePartiesBandeau`) et `pilotage/revue.ts` lisent `interested` du registre historique, pas les objets `stakeholder`. |
| Non-régression | `30-recette-2026-11-12.spec.ts`, « RSSI-05 ouvert » (`test.fail`) |

## BUG-021 — Revue de direction validée non reconnue comme dernière revue (RSSI-19)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Revue de direction ; BLOQUANTE ; P1 |
| Statut | OUVERT |
| Cause / niveau | CONFIRMÉE : `pilotage/revue.ts` lit `etat.reviews`, pas les objets `management_review`. |
| Non-régression | à écrire |

## BUG-022 — Créer un risque sans méthode publiée : liste vide puis « methodId : UUID invalide » (RSSI-07)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Registre des risques ; MAJEURE ; P2 |
| Statut | OUVERT |
| Cause / niveau | PROBABLE : aucun contrôle ni message quand le périmètre n'a pas de méthode publiée. |
| Non-régression | à écrire |

## BUG-023 — Décisions d'appréciation affichées en JSON brut ; « draft », « unacceptable » (RSSI-08)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Appréciation des risques ; MAJEURE ; P2 |
| Statut | OUVERT |
| Cause / niveau | Non analysée. |
| Non-régression | à écrire |

## BUG-024 — Appréciation « Grave × Probable = Faible, acceptable » acceptée sans alerte (à arbitrer) (RSSI-09)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Appréciation des risques, modèle ISO 27005 ; MAJEURE ; P2 |
| Statut | OUVERT |
| Cause / niveau | Le modèle n'a pas de matrice : niveau choisi librement. |
| Non-régression | à écrire |

## BUG-025 — Refus de validation du risque sans désigner l'étape ni le champ (RSSI-10)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Fiche du risque ; MAJEURE ; P2 |
| Statut | OUVERT |
| Cause / niveau | Messages génériques du serveur ; champs obligatoires non marqués. |
| Non-régression | à écrire |

## BUG-026 — Traitement d'un risque relié à une mesure : invisible dans la DdA (RSSI-11)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Traitements, DdA ; MAJEURE ; P1 |
| Statut | OUVERT |
| Cause / niveau | Non analysée (« Risques traités » de la DdA est un texte libre). |
| Non-régression | à écrire |

## BUG-027 — « Origine de référence inconnue » dans les liens d'une déclaration d'applicabilité (RSSI-12)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Applicabilité et justifications ; MAJEURE ; P1 |
| Statut | OUVERT |
| Cause / niveau | CONFIRMÉE côté appel : `GET …/links?ref=legacy:dda:A-8.13` → 422. |
| Non-régression | `30-recette-2026-11-12.spec.ts`, « RSSI-12 ouvert » |

## BUG-028 — Cible d'indicateur « 1 » convertie en « 100 % » sans le dire (RSSI-14)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Objectifs et indicateurs ; MAJEURE ; P2 |
| Statut | OUVERT |
| Cause / niveau | Indicateurs en pourcentage seulement (stocké `target: 1`). |
| Non-régression | à écrire |

## BUG-029 — Réglages de récurrence nommés « start », « interval », « reminderDays »… (RSSI-15)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Tâches récurrentes ; MAJEURE ; P2 |
| Statut | OUVERT |
| Cause / niveau | Libellés non traduits des champs de récurrence. |
| Non-régression | `30-recette-2026-11-12.spec.ts`, « RSSI-15 ouvert » |

## BUG-030 — Audit interne : « Référentiels audités » sans option ; programme et revue à 0 après planification (RSSI-17)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Audits internes ; MAJEURE ; P2 |
| Statut | OUVERT |
| Cause / niveau | PROBABLE : liste alimentée par les référentiels publiés (aucun sur installation neuve) ; compteurs lus ailleurs que dans les fiches d'audit. |
| Non-régression | à écrire |

## BUG-031 — Revue de direction : entrées de l'ISO 9001 seulement, pas celles de l'ISO/IEC 27001 9.3.2 (à arbitrer, ADR 0036) (RSSI-18)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Revue de direction ; MAJEURE ; P1 |
| Statut | OUVERT |
| Cause / niveau | Choix de l'ADR 0036 (volet qualité) ; volet SMSI absent. |
| Non-régression | à écrire après arbitrage |

## BUG-032 — Validation de la revue refusée sans désigner « Décisions et moyens » (RSSI-20)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Revue de direction ; MAJEURE ; P2 |
| Statut | OUVERT |
| Cause / niveau | CONFIRMÉE : `pilotage/service.ts` exige `inputs`, `decisions` et un justificatif ; message générique. |
| Non-régression | à écrire |

## BUG-033 — Document rattaché à une mesure : invisible dans la fiche de la DdA (RSSI-06)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Documents, DdA ; MINEURE ; P3 |
| Statut | OUVERT |
| Cause / niveau | Non analysée. |
| Non-régression | à écrire |

## BUG-034 — « Créer une action suivie » : action sans intitulé propre ni échéance (RSSI-16)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Amélioration continue ; MINEURE ; P3 |
| Statut | OUVERT |
| Cause / niveau | Non analysée. |
| Non-régression | à écrire |

## BUG-035 — « Actions » : 3 ouvertes sur un écran, 0 sur un autre (RSSI-21)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Amélioration continue, Synthèse ; MINEURE ; P3 |
| Statut | OUVERT |
| Cause / niveau | Occurrences de série comptées comme actions sur un seul des écrans. |
| Non-régression | à écrire |

## BUG-036 — Parcours ISO : « Applicabilité — Aucun travail trouvé » malgré une DdA renseignée (RSSI-22)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Parcours ISO 27001 / HDS ; MINEURE ; P3 |
| Statut | OUVERT |
| Cause / niveau | Non analysée. |
| Non-régression | à écrire |
