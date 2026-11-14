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

## BUG-024 — Appréciation « Grave × Probable = Faible, acceptable » acceptée sans alerte (arbitré le 13/11/2026 : matrice obligatoire) (RSSI-09)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Appréciation des risques, modèle ISO 27005 ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Arbitrage du RSSI (13/11/2026) | La matrice est obligatoire pour apprécier un risque. |
| Attendu | Aucune appréciation sans matrice : méthode sans matrice refusée (aperçu ou publication), ou niveau imposé par la matrice ; le modèle « ISO/IEC 27005 » fournit une matrice. |
| Cause / niveau | Le modèle n'a pas de matrice (`calculation.kind: 'judgement'`, `packages/shared/src/risk-methods.ts`) : niveau choisi librement. |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « RSSI-09 ouvert » (`test.fail`), ajouté le 13/11/2026 |
| Correctif | Matrice obligatoire : tous les modèles de méthode en fournissent une ; aperçu, publication, choix de la méthode et nouveau risque refusent une méthode sans matrice (422). Les versions déjà publiées restent lisibles. |
| Tests de la correction | `apps/api/test/grc-integration.test.ts` ; `RSSI-09` à rejouer par la recette |
| Commit | 0131729 |

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

## BUG-031 — Revue de direction : entrées de l'ISO 9001 seulement, pas celles de l'ISO/IEC 27001 9.3.2 (arbitré le 13/11/2026, ADR 0036) (RSSI-18)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Revue de direction ; MAJEURE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Arbitrage du RSSI (13/11/2026) | Les entrées de la revue de direction sont celles de l'ISO/IEC 27001:2022, 9.3.2 ; l'ISO 9001 n'est plus suivie pour le moment, l'application se concentre sur l'ISO/IEC 27001. |
| Attendu | Entrées 9.3.2 a) à g) de l'ISO/IEC 27001 (dont résultats de l'appréciation des risques, état du plan de traitement, retours des parties intéressées, opportunités d'amélioration continue) ; plus de numérotation ni de vocabulaire ISO 9001 (y compris les « séries proposées (ISO 9001:2015) » des tâches récurrentes, constat T4-07). |
| Cause / niveau | Choix de l'ADR 0036 (volet qualité), à amender par la session de développement ; volet SMSI absent. |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « RSSI-18 ouvert » (`test.fail`), ajouté le 13/11/2026 ; « CAMP-C4-05 ouvert » accepte la future numérotation (« 9.3.2 d 1 »). |
| Correctif | Entrées de la revue selon l’ISO/IEC 27001:2022, 9.3.2 (a à g, d 1 à 4) ; sorties 9.3.3 ; ADR 0036 amendée. |
| Tests de la correction | `apps/api/test/pilotage-revue.test.ts` ; `RSSI-18` à rejouer par la recette |
| Commit | 02aed39 |

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

## BUG-037 — Processus du périmètre racine sans périmètre ; page Processus blanche sous un sous-périmètre (RSSI-23)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Organisation → Processus, Objectifs par processus ; MAJEURE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Détection | 2026-11-12, session « Agent RSSI virtuel » (`session_01EnWdzi6XW7jw824ozEWpfF`), version 6.3.0, à la demande du RSSI |
| Observé | Processus de la racine dans le registre historique (`suivi_processus`, aucune colonne de périmètre) ; sous un sous-périmètre, page « Processus » blanche et second registre de processus (objets du Pilotage) sans lien avec le premier. Détail : [rapport du 12/11/2026, complément](../05_RECETTE/rssi-virtuel/RAPPORT-2026-11-12.md). |
| Cause / niveau | CONFIRMÉE : `apps/web/src/pages/Pilotage.tsx` (`smsi === SOCLE`). |
| Non-régression | `30-recette-2026-11-12.spec.ts`, « RSSI-23 ouvert » (`test.fail`). |
| Correctif | Un seul modèle de processus, objectifs et indicateurs, rattaché à un périmètre, disponible sous tous les périmètres ([ADR 0094](../adr/0094-objectifs-indicateurs-processus-par-perimetre.md), BUG-055). |
| Tests de la correction | `apps/api/test/pilotage-objectifs.test.ts`, `apps/api/test/processus-cartes.test.ts` ; `RSSI-23` rejoué par la recette |

## Constats de la campagne de recette à plusieurs agents du 12-13/11/2026 (BUG-038 à BUG-076)

Détection : 12 et 13/11/2026, session « Campagne multi-agent RSSI virtuel » (`session_01EnWdzfKyK172mDzj6dAUWv`), code `2e63e86`, six piles Docker de `lancer.sh` (PostgreSQL 18.6, Node 26.12.1). Chaque défaut ci-dessous a été **rejoué** en phase 3 par un agent indépendant ; seuls les bloquants et majeurs retenus sont inscrits. Constats d'origine, rejeu, gravités modifiées, mineurs et remarques : [rapport de campagne](../05_RECETTE/rssi-virtuel/RAPPORT-CAMPAGNE-2026-11-13.md). Aucune correction par la session de recette.

## BUG-038 — Export « Contexte du SMSI » vide malgré les fiches saisies (C1-04)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Contexte, export Excel ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Feuilles « Parties intéressées », « SWOT » et « Rôles » réduites aux en-têtes alors que 2, 1 et 5 fiches existent ; feuille « Périmètre » vide (l'export lit `statement`, `sites`, `excl`, que le formulaire n'écrit pas) ; aucun périmètre choisi, le sous-périmètre n'est jamais exporté. Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | L'export reprend les fiches saisies à l'écran, pour le périmètre demandé. |
| Cause / niveau | PISTE : même famille que BUG-020 : l'export lit le registre historique au lieu des objets du Pilotage. |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C1-04 ouvert » (`test.fail`) |
| Correctif | Les rubriques « Contexte du SMSI » lisent les fiches du Pilotage (contexte, parties, SWOT, rôles) du périmètre demandé, en plus des entrées historiques du périmètre commun ; `GET /api/suivi/export?perimetre=`, sélecteur « Périmètre exporté ». |
| Tests de la correction | `apps/api/test/export-suivi.test.ts` ; `CAMP-C1-04` à rejouer par la recette |
| Commit | 0131729 |

## BUG-039 — Un risque jamais apprécié peut être formellement accepté (C2-03)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Risques, traitement ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Décision d'acceptation enregistrée (HTTP 200), immuable, sur un risque à l'état « Non apprécié ». Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Refus tant que le risque n'a pas de niveau apprécié (ISO/IEC 27001:2022 6.1.3 f et 8.3). |
| Cause / niveau | PISTE : aucun contrôle de l'appréciation avant la décision. Voisin de BUG-024 (à arbitrer). |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C2-03 ouvert » (`test.fail`) |
| Correctif | Décision d’acceptation refusée (422) sans niveau apprécié (`pilotage/service.ts`). |
| Tests de la correction | `apps/api/test/risques.test.ts` ; `CAMP-C2-03` à rejouer par la recette |
| Commit | 0131729 |

## BUG-040 — Enregistrer une fiche d'applicabilité sans rien changer déclare la mesure « Applicable » (C3-05)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | DdA, applicabilité ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Ouvrir la fiche d'une mesure jamais examinée puis « Enregistrer » écrit `app: "oui"` ; le journal attribue la décision au RSSI. Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Attendu | Une mesure non examinée le reste tant que l'applicabilité n'est pas choisie (6.1.3 d). |
| Cause / niveau | PISTE : valeur par défaut du formulaire envoyée. Prolonge RSSI-13 (BUG-017). |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-05 ouvert » (`test.fail`) |
| Correctif | La fiche d’applicabilité garde la mesure « non examinée » tant que l’applicabilité n’est pas décidée : coche « Applicabilité examinée » ; `app` n’est écrit que sur décision (`pilotage/legacy.ts`). |
| Tests de la correction | `apps/api/test/pilotage-dda.test.ts` ; `CAMP-C3-05` à rejouer par la recette (le test cherche la case « Applicable », toujours présente) |
| Commit | 0131729 |

## BUG-041 — Écart rattaché à l'exigence d'un référentiel ignoré par la DdA (C3-06, C4-04)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | DdA, écarts ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (second rejeu de la PR #269 du 14/11/2026) |
| Observé | Écart lié à « A-5.24 · 5.24 » (exigence du référentiel appliqué) : la DdA n'affiche aucun écart sur la mesure « Total » et l'indicateur « Total avec écart ouvert » reste à 0. Sous un sous-périmètre sans référentiel appliqué, aucune mesure n'est proposée pour l'écart (C4-04). Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Attendu | La DdA reprend l'écart quelle que soit la forme du rattachement ; l'incohérence « Total avec écart ouvert » est signalée. |
| Cause / niveau | PISTE : la DdA ne lit que les rattachements `legacy:items:`. Famille de BUG-026. |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-06 ouvert » ; `42-campagne-conformite-ecarts.spec.ts`, « CAMP-C4-04 ouvert » (`test.fail`) |
| Correctif | La projection des écarts (`findings`) reprend la mesure d’une exigence `requirement:<référentiel>:<version>:<mesure>` comme celle d’un rattachement `legacy:items:` ; la DdA et l’indicateur « Total avec écart ouvert » suivent. **Reste** : la proposition des mesures sous un sous-périmètre sans référentiel appliqué (volet C4-04). Volet ouvert au rejeu du 14/11/2026 (CAMP-C4-04) : sous un sous-périmètre, les sources proposent les mesures communes et les processus, objectifs et indicateurs du périmètre ; à rejouer. |
| Tests de la correction | `apps/api/test/ecarts-natifs.test.ts` ; `CAMP-C3-06` à rejouer par la recette |
| Commit | 0131729 |

## BUG-042 — Revue de direction : rien de préparé sous un périmètre enfant, et ses non-conformités absentes de la revue du parent (C4-05)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Revue de direction ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | La revue préparée du principal annonce « 2 ouvert(s) » et omet la non-conformité majeure ouverte sous « Hébergement HDS » ; sous le sous-périmètre, aucune entrée n'est préparée. Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Arbitrage du RSSI (13/11/2026) | Chaque périmètre enfant a sa propre revue de direction, sauf s'il hérite des référentiels du parent : ses entrées remontent alors dans la revue du parent. |
| Attendu | Enfant sans héritage : revue propre, entrées 9.3.2 préparées. Enfant avec héritage : ses non-conformités et actions comptées dans les entrées du parent. |
| Cause / niveau | PISTE : fonction réservée au périmètre racine (famille de BUG-037) ; la règle dépend de l'héritage des référentiels (`inheritFrameworks`). |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, deux tests « CAMP-C4-05 ouvert » : revue propre d'un enfant sans héritage ; entrée 9.3.2 c du parent comptant l'écart d'un enfant qui hérite (`test.fail`) |
| Correctif | Une revue par périmètre ; les enfants héritiers remontent dans la revue du parent, les autres non. |
| Tests de la correction | `apps/api/test/pilotage-revue.test.ts` ; `CAMP-C4-05` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-043 — Compteur « Continuité » limité aux plans PCRA (C5-01)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Continuité, synthèses ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Un PRA donne « 0 plan de continuité et de reprise » sur Périmètres, la Synthèse et le mur ; le tableau de bord affiche « 1 » pour deux plans. Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Tous les plans de continuité et de reprise sont comptés. |
| Cause / niveau | PISTE : filtre sur le type PCRA. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-01 ouvert » (`test.fail`) |
| Correctif | Le compteur compte tous les plans `continuity_plan` ; champ `continuite.pcra` renommé `continuite.plans` (API, tableau de bord, cartes, mur) ; libellés d’écran sans « PCRA ». |
| Tests de la correction | `apps/api/test/cartes-perimetres.test.ts`, `apps/api/test/tableau-de-bord.test.ts` ; `CAMP-C5-01` à rejouer par la recette |
| Commit | 0131729 |

## BUG-044 — Incidents et crise sans périmètre : un compte non membre lit les incidents d'un sous-périmètre (C5-06)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Incidents, crise ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Incidents, RETEX, cellules, contacts et scénarios ne portent aucun périmètre ; le sélecteur est sans effet ; un contributeur non membre de « Hébergement HDS » reçoit 404 sur le périmètre mais lit ses incidents et cellules de crise. Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Chaque fiche relève d'un périmètre ; la lecture suit l'appartenance au périmètre. |
| Cause / niveau | PISTE : registres hors périmètre. Même famille que BUG-037 et BUG-062 ; cause commune avec BUG-051. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-06 ouvert » (`test.fail`) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Toujours présent ; parcours de création modifié (ADR 0091 : « Nouvel incident » crée une fiche vide). Test « CAMP-C5-06 » adapté. |
| Correctif | Incidents (et événements RETEX) et cellules de crise portent un périmètre `smsi` (commun par défaut) ; lecture, écriture et RETEX du pilote contrôlés par l’accès au périmètre ; l’écran crée dans le périmètre affiché. Contacts et scénarios de crise rattachés au périmètre de la même façon (rang conservé pour les contacts). |
| Tests de la correction | `apps/api/test/historique-incidents-perimetre.test.ts` ; `CAMP-C5-06` à rejouer par la recette |
| Commit | 0131729 |

## BUG-045 — RETEX : gravité « Faible » affichée pour un incident critique sans gravité saisie (C5-11)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | RETEX ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | « Gravité maximale : Faible » pour un incident P1 critique dont aucune gravité n'est renseignée. Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | « Non renseignée » tant qu'aucune gravité n'est saisie. |
| Cause / niveau | PISTE : valeur par défaut dans le calcul des indicateurs du RETEX. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-11 ouvert » (`test.fail`) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Modifié, toujours présent : RETEX dans l'onglet « Chronologie et RETEX » de la fiche de l'incident (ADR 0091) ; « Gravité maximale » = « Faible ». |
| Correctif | `indicateursRetex` : gravité maximale vide tant qu’aucune gravité n’est saisie (`niveauConnu`) ; l’écran affiche « Non renseignée ». |
| Tests de la correction | `packages/shared/test/retex-incidents.test.ts` ; `CAMP-C5-11` à rejouer par la recette |
| Commit | 0131729 |

## BUG-046 — Export Excel : une piste de progrès libellée « Point sensible » (C5-15)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Écarts, export Excel ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Une piste de progrès est exportée dans la colonne de classification comme « Point sensible ». Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Le libellé exporté correspond à la classification saisie. |
| Cause / niveau | PISTE : table de libellés de l'export (`apps/api/src/export/rubriques.ts`, l. 65, piste de la recette). |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-15 ouvert » (`test.fail`) |
| Correctif | `typeEcart` reprend `findingTypeLabel` (table de l’écran) ; « PP » = « Piste de progrès », « PS » = « Point sensible ». |
| Tests de la correction | `apps/api/test/export-suivi-complements.test.ts` ; `CAMP-C5-15` à rejouer par la recette |
| Commit | 0131729 |

## BUG-047 — « Référentiel complémentaire actif » affiché vide ; l'enregistrer désactive ReCyF (C6-04)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Plateforme, Général ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Valeur `recyf-2.5` enregistrée mais liste vide à l'écran ; choisir ReCyF enregistre le nom au lieu de l'identifiant et fait passer ReCyF de « Actif » à « Conservé ». Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | La liste affiche la valeur enregistrée ; l'enregistrer ne change pas l'état du référentiel. |
| Cause / niveau | PISTE : identifiant et libellé confondus entre l'écran et l'API. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-04 ouvert » (`test.fail`) |
| Correctif | La liste « Référentiel complémentaire actif » propose l’identifiant (`id`) du référentiel avec son nom comme libellé et affiche la valeur enregistrée. |
| Tests de la correction | `apps/api/test/settings.test.ts` ; `CAMP-C6-04` à rejouer par la recette |
| Commit | 0131729 |

## BUG-048 — Catégorie NIS 2 impossible à remettre à « Non renseignée » ; « enregistré » et journal inexacts (C6-05)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Plateforme, Général ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Vider la catégorie affiche « enregistré » et trace un changement au journal d'audit, mais la valeur reste « Entité importante ». Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | La valeur vide est enregistrée, ou refusée avec un message ; le journal reflète ce qui est enregistré. |
| Cause / niveau | PISTE : valeur vide ignorée par la fusion des réglages. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-05 ouvert » (`test.fail`) |
| Correctif | La valeur vide est enregistrée (clé conservée avec la valeur vide dans l’état, qui la retire de la table des réglages) au lieu d’être supprimée de l’état sans effet. |
| Tests de la correction | `apps/api/test/settings.test.ts` ; `CAMP-C6-05` à rejouer par la recette |
| Commit | 0131729 |

## BUG-049 — Un contributeur archive un registre (plan d'actions) qu'il n'a pas créé (T4-02)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Registres, droits ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | `POST /api/registres/:id/archivage` par un contributeur sans rôle de gestionnaire → HTTP 200 ; le même compte reçoit 403 pour archiver une seule action ou un écart ; aucune commande de désarchivage. Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Arbitrage du RSSI (13/11/2026) | Seul le gestionnaire du registre peut l'archiver. Le désarchivage est prévu, réservé lui aussi au gestionnaire. |
| Attendu | Archivage et désarchivage par le gestionnaire du registre ; refus (403) pour tout autre compte. |
| Cause / niveau | PISTE : le code lit le point 5 de l'ADR 0043 comme un droit d'archivage pour tout contributeur ; lecture écartée par le RSSI. |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « CAMP-T4-02 ouvert » (`test.fail`). Désarchivage : pas de test tant que la commande n'existe pas (aucune route à viser) ; à écrire par la recette une fois la route livrée. |
| Correctif | Archivage réservé au gestionnaire du registre (ou administrateur) ; commande `POST /api/registres/:id/desarchivage` ; `peutArchiver` dans la fiche, boutons « Archiver » et « Désarchiver le registre ». |
| Tests de la correction | `apps/api/test/registres-archivage.test.ts` ; `CAMP-T4-02` à rejouer par la recette |
| Commit | 0131729 |

## BUG-050 — Un contributeur retire des événements de la chronologie RETEX sans le droit « supprimer » (T5-02)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | RETEX, droits ; BLOQUANTE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | `DELETE /api/incidents/:id/retex/:eid` par un contributeur → HTTP 200, y compris pour l'événement d'un autre compte ; le journal ne garde pas le contenu retiré ; la suppression de l'incident lui est refusée (403). Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Refus sans le droit de suppression ; contenu retiré conservé au journal. |
| Cause / niveau | PISTE : route sans contrôle du droit de suppression. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-T5-02 ouvert » (`test.fail`) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Modifié, toujours présent : dans l'onglet « Chronologie et RETEX », le contributeur voit « Modifier » et « Retirer » sur l'événement d'un autre compte ; `DELETE /api/incidents/:id/retex/:eid` → 200. |
| Correctif | Route de retrait d’un événement RETEX soumise au droit `incidents:supprimer` ; contenu retiré conservé au journal (`incident.retex-deleted`, détail `evenement`). |
| Tests de la correction | `apps/api/test/historique-incidents.test.ts` ; `CAMP-T5-02` à rejouer par la recette |
| Commit | 0131729 |

## BUG-051 — Un compte rattaché à un périmètre enfant voit et modifie le périmètre parent ; rattaché au parent, il ne voit pas les enfants (T1-01, T2-01, T3-01, T4-01, T5-01, T6-02)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Comptes, périmètres, droits ; BLOQUANTE (arbitrage du RSSI du 13/11/2026) ; P1 |
| Statut | CORRIGÉ — À VALIDER PAR LA RECETTE (règle complète du RSSI du 14/11/2026) |
| Arbitrage du RSSI (13/11/2026) | Un compte est rattaché à un périmètre. Rattaché à un périmètre enfant, il ne voit que ce périmètre. Rattaché au parent, il voit le parent et les enfants rattachés à ce parent. |
| Observé | Le périmètre racine est créé « Toute l'organisation » (visibilité `instance`) et aucun écran ni API ne le restreint : un contributeur membre du seul périmètre enfant (« Hébergement HDS » dans le jeu fictif, nom d'un périmètre et non du référentiel HDS) lit le parent et y écrit (`POST …/objects` → 200, `PATCH /api/dda/A-5.1` → 200). À l'inverse, l'appartenance ne descend pas : un contributeur membre du seul parent reçoit 404 « Périmètre introuvable ou non accessible » sur l'enfant (CAMP-T1-02, harnais du 13/11/2026). Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md) ; [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md) (C5-06). |
| Attendu | La règle de l'arbitrage, appliquée côté serveur à toutes les routes du périmètre (lecture et écriture) et reflétée par l'écran « Accès au périmètre » (racine comprise). |
| Cause / niveau | PISTE : visibilité `instance` du périmètre racine sans réglage ; ADR 0039 (périmètre sans propagation des droits) à amender par une ADR de la session de développement (numéro annoncé au RSSI). Liés : BUG-044 (incidents sans périmètre), BUG-062 (sélecteur sans effet), BUG-071 (revue des accès sans périmètres). |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-T1-01 ouvert » (le membre de l'enfant n'écrit pas au parent) et « CAMP-T1-02 ouvert » (le membre du parent voit l'enfant) (`test.fail`) |
| Correctif | ADR 0092 (pyramide des périmètres, migration 060 de la session « Refonte des droits ») : un rattachement ouvre le périmètre et ses descendants, jamais le parent. ADR 0095 (migration 062, `grc_smsi_visible`) : aucune exception pour le périmètre commun ; `Grc.access`, `listSmsis`, `owners`, `checkOwner`, notifications d’échéance. |
| Tests de la correction | `apps/api/test/acces-perimetres-descendants.test.ts` ; `CAMP-T1-01` et `CAMP-T1-02` à rejouer par la recette |
| Commit | 0131729 |
| Correctif (14/11/2026) | Règle complète (ADR 0095) : le périmètre commun suit la pyramide ; rattaché à un enfant, un compte ne le voit plus (404 en lecture et en écriture). À rejouer : CAMP-T1-01. |

## BUG-052 — Fiches du Pilotage ni archivables ni supprimables à l'écran (C1-03, C2-10, C5-03)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Contexte, risques, continuité ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Contexte, parties, SWOT, rôles, traitements, actifs, sources, opportunités, plans de continuité et exercices : le menu « Autres actions » ne propose ni archivage ni suppression, alors que l'API d'archivage existe. Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Archiver (ou supprimer une fiche créée par erreur) depuis l'écran, selon les droits. |
| Cause / niveau | PISTE : fiche générique du Pilotage sans « Archiver la fiche ». |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C1-03 ouvert » ; `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-03 ouvert » (`test.fail`) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Volet « opportunités » sans objet (type `opportunity` retiré, ADR 0090, lot 2 : création → 422). Toujours présent pour le contexte (SWOT…), les traitements (fiche ouverte depuis le plan d'action du risque, sans « Archiver ») et les actifs et sources de risque (fiches de l'étude EBIOS RM, `RecordEditor.tsx` sans archivage). Test « CAMP-C1-03 » réduit au cas SWOT. |
| Correctif | « Archiver la fiche » dans `RecordEditor` (droit de suppression du module). |
| Tests de la correction | Aucun test automatisé (composant) ; `CAMP-C1-03` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-053 — PESTEL, cartographie et processus ignorent les SWOT et enjeux saisis à l'écran (C1-05)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Contexte ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | « Rattacher : SWOT » grisé ; la cartographie et la fiche processus n'affichent pas les SWOT et enjeux saisis. Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Les fiches saisies alimentent le PESTEL, la cartographie et les processus. |
| Cause / niveau | PISTE : lecture du registre historique (famille de BUG-020). |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C1-05 ouvert » (`test.fail`) |
| Correctif | PESTEL (menaces, opportunités et enjeux de contexte saisis à l’écran, classement par périmètre, plus de 404 hors périmètre commun), carte du contexte (enjeux et parties saisis), fiche processus (SWOT saisis rattachables par lien). |
| Tests de la correction | `apps/api/test/pilotage-pestel.test.ts`, `apps/api/test/processus-cartes.test.ts`, `apps/api/test/carto-fiches-pilotage.test.ts` ; `CAMP-C1-05` à rejouer par la recette |
| Commit | 99c426a |

## BUG-054 — Évaluation d'un fournisseur : la page plante au troisième clic sur un critère (C1-07)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Fournisseurs ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Cocher, décocher, recocher un critère : « Cannot read properties of null (reading 'checked') », page inutilisable (3 fois sur 3). Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Le critère se coche et se décoche sans erreur. |
| Cause / niveau | PISTE : piste : `Fournisseurs.tsx`, l. 773 (lecture de l'événement après sa libération). |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C1-07 ouvert » (`test.fail`) |
| Correctif | Valeur lue avant la mise à jour d’état (case et résultat du critère). |
| Tests de la correction | `apps/web/test/evenements-react.test.ts` (garde statique) ; `CAMP-C1-07` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-055 — Objectifs et indicateurs : deux modèles selon le périmètre ; synthèse du sous-périmètre sans objectifs (C1-10)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Objectifs, indicateurs ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Sous le principal, objectifs et indicateurs du registre historique ; sous un sous-périmètre, objets du Pilotage ; la Synthèse du sous-périmètre n'a pas de carte « Objectifs et indicateurs ». Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Un seul modèle, quel que soit le périmètre. |
| Cause / niveau | PISTE : même cause que BUG-037 (`smsi === SOCLE`). |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C1-10 ouvert » (`test.fail`) |
| Correctif | Un seul modèle, celui de l’outil de suivi, dans tous les périmètres (ADR 0094) : chaque fiche porte son périmètre, liens limités au périmètre, lectures (état, Synthèse, export, revue, cartes) filtrées. |
| Tests de la correction | `apps/api/test/pilotage-objectifs.test.ts`, `apps/api/test/processus-cartes.test.ts` ; `CAMP-C1-10` à rejouer par la recette |
| Commit | 9bc62c4 |

## BUG-056 — « Créer les actions pour les écarts » du clausier : aucune action, écart sans responsable ni échéance, dupliqué (C1-12)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Fournisseurs, clausier ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Le bouton annonce des actions mais crée seulement l'écart FOU-01, sans responsable ni échéance, recréé à chaque évaluation ; rien dans le plan d'actions. L'écart est bien dans la DdA (l'échec d'INV-08 était un faux positif, corrigé dans `invariants.ts`). Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Une action par écart, avec responsable et échéance (10.2), sans doublon. |
| Cause / niveau | PISTE : recoupe BUG-034 et BUG-035. |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C1-12 ouvert » (`test.fail`) |
| Correctif | Une action par point du clausier (responsable, échéance 30 jours) ; identifiant d’évaluation déjà traitée refusé (409). |
| Tests de la correction | `apps/api/test/historique-evals-fournisseurs.test.ts` ; `CAMP-C1-12` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-057 — « Stratégie » du traitement affichée « Réduire » mais envoyée vide ; refus en termes techniques (C2-01)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Risques, traitement ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Recliquer la valeur affichée la désélectionne et envoie une stratégie vide ; refus 422 libellé `strategy`, `"reduce"`. Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | La valeur affichée est celle envoyée ; message en français désignant le champ. |
| Cause / niveau | PISTE : liste sans `allowDeselect={false}` (même mécanisme que BUG-022 et BUG-068). |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C2-01 ouvert » (`test.fail`) |
| Correctif | Listes sans désélection accidentelle ; messages de validation français avec libellé du champ. |
| Tests de la correction | `apps/web/test/listes-sans-deselection.test.ts`, `apps/api/test/erreurs-validation.test.ts` ; `CAMP-C2-01` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-058 — Exports incomplets : registre des risques, traitements, EBIOS RM, « export complet » (C2-05, C5-16)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Exports ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Ni le registre des risques, ni le plan de traitement, ni les études EBIOS RM ne sont exportables ; l'« export complet » omet plans de continuité, exercices, RETEX, scénarios, documents, risques et revues, et ne permet pas de choisir le périmètre. Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Les registres du SMSI s'exportent, pour le périmètre choisi. |
| Cause / niveau | PISTE : exports fondés sur le registre historique (famille de BUG-038). |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C2-05 ouvert » ; `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-16 ouvert » (`test.fail`) |
| Correctif | Nouveaux groupes d’export « Gestion des risques » (registre, plan de traitement, études EBIOS RM) et « Continuité et revues » (plans, exercices, revues de direction), pour le périmètre choisi ; l’export complet les reprend. Décision du RSSI : RETEX, scénarios de crise et registre documentaire (fiches, sans le contenu des fichiers) exportés aussi. |
| Tests de la correction | `apps/api/test/export-suivi.test.ts` ; `CAMP-C2-05` à rejouer par la recette |
| Commit | 0131729 |

## BUG-059 — Codes anglais et valeurs techniques à l'écran (carte, atelier 5, rapport, éditeur de méthode) (C2-06)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Risques, EBIOS RM ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Légende de la carte, atelier 5, rapport et éditeur de méthode affichent des codes (`draft`, `unacceptable`, `judgement`…). Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Libellés français. |
| Cause / niveau | PISTE : extension de BUG-023. |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C2-06 ouvert » (`test.fail`) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Toujours présent (atelier 5 « Option : reduce », rapport « reduce » et « draft », éditeur de méthode). |
| Correctif | Libellés français partagés (`libelles-valeurs.ts`) pour la carte, l’étude, l’appréciation et le rapport ; libellé de retrait de l’éditeur de méthode., valeur « Mode » de l’éditeur de méthode. |
| Tests de la correction | `packages/shared/test/libelles-valeurs.test.ts`, `apps/web/test/rapport-comite-libelles.test.ts` ; `CAMP-C2-06` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-060 — Choix des mesures d'un traitement : sans référence, avec doublons et textes tronqués (C2-07)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Risques, traitement ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | 157 options au lieu de 160, sans référence (A.8.13…), avec doublons et exigences HDS tronquées. Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Mesures désignées par leur référence, sans doublon. |
| Cause / niveau | PISTE : volet liens : famille de BUG-026. |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C2-07 ouvert » (`test.fail`) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Modifié, toujours présent : le traitement s'ajoute désormais par le Registre des risques (« Plan d’action de <risque> », « Ajouter un traitement ou une mesure ») ; option « Sauvegarde des informations » toujours sans référence. Test « CAMP-C2-07 » adapté au nouveau chemin. |
| Correctif | Références des mesures dans les noms proposés, exigences dédoublonnées. Les intitulés HDS tronqués par « … » viennent de la source historique des mesures : ils ne sont pas reconstruits (AGENTS.md : une grille inaccessible n’est pas reconstruite). |
| Tests de la correction | `apps/api/test/sources-references.test.ts` ; `CAMP-C2-07` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-061 — EBIOS RM : scénario opérationnel non placé dans la matrice de l'étude (C2-09)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | EBIOS RM ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Le scénario G4 × V2 reste dans « Non placés ». Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Tout scénario évalué est placé dans la matrice. |
| Cause / niveau | PISTE : à établir. |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-C2-09 ouvert » (`test.fail`) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Toujours présent (ligne « G4 — Critique » sans scénario). |
| Correctif | Rang 1 à 4 des niveaux d’échelles publiées de quatre niveaux, utilisé pour la matrice. |
| Tests de la correction | `apps/web/test/ebios-visuel.test.ts` ; `CAMP-C2-09` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-062 — Sélecteur « Périmètre affiché » sans effet sur la DdA, l'audit et les plans annuels (C3-01, C4-02)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | DdA, audit, plans annuels ; MAJEURE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Sous « Hébergement HDS », la DdA (clauses, annexe A, HDS), la gestion de l'audit, les applications à intégrer et les plans annuels montrent le principal ; une modification faite sous le sous-périmètre change le principal (`/api/dda` sans paramètre de périmètre). Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Attendu | Chaque écran filtre sur le périmètre affiché, ou dit qu'il est commun à toute l'organisation. |
| Cause / niveau | PISTE : registres historiques sans périmètre (famille de BUG-037). |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-01 ouvert » ; `42-campagne-conformite-ecarts.spec.ts`, « CAMP-C4-02 ouvert » (`test.fail`) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Volet « applications à intégrer » sans objet (GAP retiré, ADR 0089, lot 2 : `GET /api/gap` → 404). Toujours présent pour la DdA et les plans annuels (« CAMP-C3-01 », « CAMP-C4-02 »). |
| Correctif | DdA par périmètre (ADR 0093, migration 061) : décisions propres à chaque périmètre hors commun, couverture alignée ; plans d’audit et annuels par périmètre (`smsi` sur chaque action) ; clausier et fournisseurs restent communs et l’indiquent sous un autre périmètre. |
| Tests de la correction | `apps/api/test/dda-perimetres.test.ts`, `apps/api/test/couverture-dda.test.ts`, `apps/api/test/historique-incidents-perimetre.test.ts` (plans) ; `CAMP-C3-01` à rejouer par la recette |
| Commit | 454addf |

## BUG-063 — Trois registres d'applicabilité qui s'ignorent (C3-02)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | DdA, couverture ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | DdA, « Applicabilité et justifications » et « Couverture par référentiel » se saisissent séparément ; la Couverture affiche « 92 à déterminer » malgré la DdA remplie. Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Attendu | Une seule source de l'applicabilité. |
| Cause / niveau | PISTE : famille de BUG-036. |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-02 ouvert » (`test.fail`) |
| Correctif | La couverture reprend la DdA (applicabilité et niveau) pour les exigences sans évaluation enregistrée ; « Applicabilité et justifications » et DdA partagent déjà la source `dda`. |
| Tests de la correction | `apps/api/test/couverture-dda.test.ts` ; `CAMP-C3-02` à rejouer par la recette |
| Commit | 99c426a |

## BUG-064 — « Référentiels et exigences » ignore les référentiels attribués et appliqués (C3-03)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Référentiels, correspondances ; MAJEURE ; P2 |
| Statut | SANS OBJET (fonction retirée par l'ADR 0089) |
| Observé | ISO/IEC 27001 et HDS, attribués et appliqués, absents de « Référentiels et exigences » et des correspondances : aucune correspondance ISO ↔ HDS possible. Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Attendu | Les référentiels appliqués sont listés et correspondables. |
| Cause / niveau | PISTE : à établir. |
| Non-régression | aucun : test « CAMP-C3-03 » supprimé (page retirée) |
| Tri du 13/11/2026 sur le code actuel de `claude-suivi-smsi` (`967de1d`, après les ADR 0089 à 0091) | Fonction retirée (ADR 0089, lots 1 et 3) : `/pilotage/referentiels`, `/pilotage/correspondances` et `/pilotage/rapprochements` affichent « Rubrique introuvable » ; `GET /api/library/mappings` et `GET /api/grc/<racine>/rapprochements` → 404. Seule reste la Bibliothèque de référentiels. |

## BUG-065 — Niveau de mise en œuvre accepté sur une mesure non examinée et compté « Total » (C3-04)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | DdA ; MAJEURE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Niveau « Total » enregistré sans applicabilité décidée ; la mesure entre dans le taux et sort des « Non renseignées ». Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Attendu | Niveau refusé tant que l'applicabilité n'est pas décidée. |
| Cause / niveau | PISTE : même cause que BUG-016 ; même indicateur que BUG-017. |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-04 ouvert » (`test.fail`) |
| Correctif | Niveau de mise en œuvre refusé (422) tant que l’applicabilité n’est pas décidée, à la DdA (`PATCH /api/dda/:id`) et dans la fiche ; clauses ISO exceptées. |
| Tests de la correction | `apps/api/test/historique-dda.test.ts`, `apps/api/test/pilotage-dda.test.ts` ; `CAMP-C3-04` à rejouer par la recette |
| Commit | 0131729 |

## BUG-066 — Deux registres d'exercices qui s'ignorent (C5-04)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Continuité, exercices ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Exercice du registre réalisé : compté ni au bandeau, ni dans « Plans du SMSI », ni dans la cellule de crise (l'API refuse tout exercice du registre, 422), ni à l'export ; seul le plan historique `PL-EXO` est lu. Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Un seul registre d'exercices, repris partout. |
| Cause / niveau | PISTE : lecture du registre historique (famille de BUG-020 et BUG-058). |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-04 ouvert » (`test.fail`) |
| Correctif | Exercices saisis à l’écran proposés et rattachables à une cellule de crise ; comptés dans « Plans du SMSI » ; à la clôture, la fiche passe à « Réalisé » (date, synthèse en observations), le résultat reste à saisir ; le plan historique est aussi « Réalisé ». |
| Tests de la correction | `apps/api/test/historique-incidents-perimetre.test.ts` ; `CAMP-C5-04` à rejouer par la recette |
| Commit | 454addf |

## BUG-067 — Scénario de crise : responsable d'une action perdu sans message (C5-05)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Crise, scénarios ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Responsable saisi pendant l'enregistrement du texte de l'action perdu (5 fois sur 5). Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | La saisie est conservée. |
| Cause / niveau | PISTE : ligne recréée à l'enregistrement du texte (clé de ligne contenant le texte). |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-05 ouvert » (`test.fail`) |
| Correctif | Clé de ligne des actions de scénario = indice, plus le texte. |
| Tests de la correction | Aucun test automatisé ; `CAMP-C5-05` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-068 — Resélectionner le périmètre affiché bascule sur le périmètre racine (C5-17, T5-04)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Sélecteur de périmètre, import ; MAJEURE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Recliquer le périmètre affiché le désélectionne et affiche la racine ; un import confirmé « dans le périmètre sélectionné » (HDS) a été enregistré à la racine. Même effet sur le niveau d'accès d'un périmètre (« Lecture et écriture » → « Lecture seule »). Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Recliquer la valeur la conserve. |
| Cause / niveau | PISTE : listes sans `allowDeselect={false}`. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-17 ouvert » (`test.fail`) |
| Correctif | Toutes les listes de choix ont `allowDeselect={false}` ou `clearable` (garde statique). |
| Tests de la correction | `apps/web/test/listes-sans-deselection.test.ts` ; `CAMP-C5-17` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-069 — Crise réelle : le bandeau rouge annoncé n'existe pas (C5-18)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Crise ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Cellule de crise réelle ouverte : aucun bandeau au tableau de bord ni dans le menu. Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Bandeau visible tant que la cellule réelle est ouverte. |
| Cause / niveau | PISTE : à établir. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-18 ouvert » (`test.fail`) |
| Correctif | Composant `BandeauCrise` dans la mise en page. |
| Tests de la correction | Aucun test automatisé (composant) ; `CAMP-C5-18` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-070 — Les incidents ne remontent dans aucune synthèse (C5-19)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Incidents, synthèses, revue ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Tableau de bord, Synthèse, mur, rapport de pilotage et revue : aucun incident ; la diapositive « Revue des incidents » annoncée n'existe pas. Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Les incidents alimentent les synthèses et l'entrée de revue correspondante. |
| Cause / niveau | PISTE : recoupe BUG-031 pour la revue. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-19 ouvert » (`test.fail`) |
| Correctif | Incidents repris dans la revue (d 2), le tableau de bord (`incidents`) et la synthèse du mur. Rapport de pilotage : section « Incidents » ; la phrase de l’écran annonçant une diapositive « Revue des incidents » inexistante est remplacée par les synthèses réellement alimentées. |
| Tests de la correction | `apps/api/test/tableau-de-bord.test.ts`, `apps/api/test/pilotage-revue.test.ts` ; `CAMP-C5-19` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-071 — Revue des accès (A.5.18) sans les accès aux périmètres (C6-12)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Utilisateurs, revue des accès ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Liste, droits effectifs et export n'indiquent pas les accès aux périmètres (dont « Hébergement HDS »). Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | La revue des accès montre les droits par périmètre. |
| Cause / niveau | PISTE : lié à BUG-051. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-12 ouvert » (`test.fail`) |
| Correctif | Colonne « Accès aux périmètres » de la revue des accès (CSV et Excel). |
| Tests de la correction | `apps/api/test/rbac.test.ts` ; `CAMP-C6-12` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-072 — Date du dernier test de restauration dans le futur acceptée : l'alerte disparaît (C6-21)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Sauvegardes ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | `PUT /api/settings/sauvegardes` accepte une date future ; l'alerte « Test de restauration à faire » disparaît. Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Date future refusée avec un message. |
| Cause / niveau | PISTE : validation absente. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-21 ouvert » (`test.fail`) |
| Correctif | Date de dernier test de restauration refusée dans le futur (un jour de marge). |
| Tests de la correction | `apps/api/test/settings.test.ts` ; `CAMP-C6-21` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-073 — Versions de l'état toutes vides : télécharger ou restaurer une version ne rend rien (C6-22)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Import et export, versions ; MAJEURE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | `GET /api/admin/versions/:v` renvoie `{}` (5 octets, même empreinte pour toutes les versions) alors que l'écran propose téléchargement et restauration. Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Une version contient l'état qu'elle date, ou l'écran ne propose pas de la restaurer. |
| Cause / niveau | PISTE : piste : `LegacyStore.save()` retire les modules repris dans des tables. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-22 ouvert » (`test.fail`) |
| Correctif | L’historique de l’état enregistre l’état complet (modules en tables compris). |
| Tests de la correction | `apps/api/test/admin-requetes.test.ts` ; `CAMP-C6-22` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-074 — Au téléphone, la DdA n'affiche pas l'applicabilité ni la mise en œuvre (T3-03)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | DdA, affichage mobile ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | À 390 px, les listes « Applicable » et « Mise en œuvre » (52 et 42 px) ne montrent que la croix d'effacement. Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Attendu | Valeurs lisibles au téléphone. |
| Cause / niveau | PISTE : largeur fixe des listes. |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « CAMP-T3-03 ouvert » (`test.fail`) |
| Correctif | Largeur minimale des listes de choix des tableaux (`.champ-choix`). |
| Tests de la correction | Aucun test automatisé ; `CAMP-T3-03` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-075 — Un contributeur modifie les décisions d'une revue de direction validée (T4-03)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Revue de direction, droits ; MAJEURE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Le contributeur, qui ne peut pas valider (403), modifie une revue validée ; elle repasse en brouillon. Rejeu : [`rejeu-piles-3-4.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-3-4.md). |
| Attendu | Revue validée immuable, sauf réouverture par un administrateur du pilotage. |
| Cause / niveau | PISTE : aggrave C4-06 (libellés d'état). |
| Non-régression | `42-campagne-conformite-ecarts.spec.ts`, « CAMP-T4-03 ouvert » (`test.fail`) |
| Correctif | Revue de direction validée : modification réservée à `pilotage:administrer` (réouverture), 403 sinon. |
| Tests de la correction | `apps/api/test/pilotage.test.ts` ; `CAMP-T4-03` à rejouer par la recette |
| Commit | 0131729 |

## BUG-076 — Le module « Incidents et PCA/PRA » n'ouvre pas les plans de continuité (T5-03)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Droits, modules ; MAJEURE ; P2 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Un auditeur externe limité à ce module reçoit 403 sur les plans de continuité ; il faut lui ouvrir tout « Pilotage du SMSI ». Rejeu : [`rejeu-piles-5-6.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). |
| Attendu | Le module donne accès aux PCA/PRA qu'il annonce. |
| Cause / niveau | PISTE : rattachement des plans de continuité au module Pilotage. |
| Non-régression | `43-campagne-incidents-plateforme.spec.ts`, « CAMP-T5-03 ouvert » (`test.fail`) |
| Correctif | `continuity_plan` et `continuity_exercise` relèvent du module `incidents`. |
| Tests de la correction | `apps/api/test/pilotage.test.ts` ; `CAMP-T5-03` à rejouer par la recette |
| Commit | 02aed39 |

## BUG-077 — Clausier : identifiant FOU-0n réattribué après archivage d'un écart, création en erreur 500 (R12-01)

| Champ | Constat |
| --- | --- |
| Fonction, gravité, priorité | Fournisseurs, clausier ; MAJEURE ; P1 |
| Statut | CORRIGÉ ET VÉRIFIÉ PAR LA RECETTE (rejeu de la PR #269 du 14/11/2026) |
| Observé | Après l'archivage de l'écart FOU-01, « Créer les actions pour les écarts » d'une nouvelle évaluation répond HTTP 500 ; journal de l'API : `duplicate key value violates unique constraint "grc_objects_smsi_id_legacy_key_legacy_id_key"` (deux occurrences relevées sur la pile 2 par la session principale). Défaut trouvé pendant l'écriture de CAMP-C1-12. Rejeu : [`rejeu-piles-1-2.md`](../05_RECETTE/rssi-virtuel/campagne/rejeu-piles-1-2.md). |
| Attendu | Un identifiant historique n'est jamais réattribué ; aucune réponse 5xx. |
| Cause / niveau | PISTE : `identifiantActionFournisseur` (`apps/api/src/historique/evals-fournisseurs.ts`) calcule le prochain numéro sans l'écart archivé. Même famille que C5-09 (référence d'incident réattribuée). |
| Non-régression | `41-campagne-organisation-risques.spec.ts`, « CAMP-R12-01 ouvert » (`test.fail`) |
| Correctif | `identifiantsEcartsPris` : les écarts archivés comptent pour la numérotation (évaluations, incidents, exercices). |
| Tests de la correction | `apps/api/test/historique-evals-fournisseurs.test.ts` ; `CAMP-R12-01` à rejouer par la recette |
| Commit | 02aed39 |

