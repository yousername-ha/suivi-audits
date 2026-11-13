# Listes compactes et résultats depuis la Timeline

11 novembre 2026, Europe/Paris. Branche isolée `codex/refonte-neon-main`.
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

## Demandes intégrées

Les demandes fonctionnelles du 11/11 autorisent le retrait de Budget et CRRC de l’interface, l’ouverture des fiches par leur ligne entière, la saisie du résultat depuis les repères de la Timeline et le défilement des longues listes. La charte Neon déjà validée est réutilisée. Les captures de cette intégration restent soumises à la recette du demandeur ; aucune nouvelle validation humaine n’est supposée.

- Budget et CRRC disparaissent du menu, des onglets et des catalogues de modules actifs. Les anciennes adresses Pilotage redirigent vers la synthèse. Les données, permissions historiques et exports complets sont conservés ; aucune suppression de base ou de migration.
- Une ligne de fiche s’ouvre au clic sur ses cellules et son espace libre, ainsi qu’avec Entrée ou Espace. Les boutons, liens, menus, champs modifiables et la sélection de texte gardent leur action propre. Les noms accessibles des lignes conservent leurs données, dont les dates ; la commande d’ouverture est décrite séparément.
- Les listes de fiches et les lignes de la Timeline défilent dans une zone limitée à l’espace disponible. Les en-têtes de tableau restent visibles dans cette zone. La pagination et le chargement des pages suivantes restent disponibles. Les descriptions d’aperçu sont raccourcies visuellement ; les données complètes restent dans les fiches.
- Le clic sur un repère de Timeline ouvre une fenêtre compacte « Résultat de réalisation », avec résultat, commentaire et preuve accessible. OK et KO sont proposés pour une action ; NA reste disponible pour les occurrences récurrentes. Le fond de ligne ouvre la fiche complète ; le bouton de titre conserve son aperçu dépliable.
- L’enregistrement actualise le repère et sa couleur. Une validation existante se reprend par une réouverture motivée ; les décisions antérieures restent au journal. Le retour du focus vise la ligne ou le repère déclencheur.

## Couverture des listes

| Périmètre | Listes concernées |
| --- | --- |
| Registre métier commun | Contexte en lecture, parties intéressées, responsabilités, objectifs et indicateurs natifs, applicabilité, mesures, écarts, preuves, contrôles, BIA, continuité, exercices, audits et revues ; registre SWOT lorsqu’il est affiché |
| Organisation et pilotage | Périmètres en liste, fournisseurs et fournisseurs du périmètre, évaluations par clausier, applications GAP, couverture, plans et objectifs/indicateurs compacts |
| Risques et résilience | Registre des risques, objets et sources EBIOS, scénarios de la synthèse EBIOS, incidents, RETEX et cellules de crise |
| Actions | Liste, cartes secondaires, lignes de Timeline et repères ; éléments des registres et vue filtrée par périmètre |
| Documents et administration | Documents, registres et accès, configuration du pilotage et comparaison de versions, comptes/droits, rôles, groupes, fonctions, types de processus et calendriers selon les droits existants |

Les matrices, totaux, journaux sans fiche et grilles de saisie directe conservent leurs interactions propres. Une ligne ne déclenche jamais une suppression, une validation ou une autre commande de mutation à la place d’une ouverture de fiche.

## Contrats conservés

Le journal `occurrence_validations`, déjà lié aux objets GRC, accueille aussi les actions sans série. Les mêmes droits de ressource, preuves lisibles, identifiants de requête, verrous, auteurs et heures serveur, contraintes d’immutabilité et réouvertures motivées s’appliquent. Les événements d’audit des actions portent le préfixe `action.*` ; les occurrences gardent `occurrence.*`. Le résultat complète le statut du workflow et ne modifie ni la définition ni la version de la fiche.

La fenêtre de réalisation continue de borner les occurrences récurrentes. Pour une tâche historique, un KO s’inscrit dans sa source et son historique sans avancer sa dernière réalisation ni créer une copie native. Les anciens appels de réalisation sans résultat explicite restent compatibles et valent OK.

Le profil Docker interfaces conserve l’ouverture directe et ses données fictives. Le profil normal conserve son authentification. Aucun ajout de dépendance, publication GitHub, fusion ou déploiement.

## Recette locale

Les preuves brutes restent dans le dossier privé de recette. Les captures publiques utilisent uniquement les données fictives de l’instance de test. Les exécutions et limites finales sont consignées avec la livraison ; les chiffres historiques de `docs/08_PILOTAGE/REGISTRES.json` ne sont pas réattribués à cette branche graphique.

- Web : 265 tests réussis ; UI : 243 tests réussis.
- API : 31 tests réussis sur quatre fichiers, dans un PostgreSQL 18 éphémère distinct, supprimé après recette. Droits contributeur/lecteur/gestionnaire, preuve, idempotence, immutabilité, réouverture, fenêtres et conservation des données historiques vérifiés. Aucun compte PostgreSQL ajouté à l’instance partagée.
- Navigateurs : 14 parcours finaux réussis, sans reprise automatique, dont 100 actions sur ordinateur et téléphone, menus et champs indépendants, preuve associée, rechargement, KO puis réouverture et OK, récurrences, calendriers et droits. Quatre analyses Axe supplémentaires sur registre et petite fenêtre en clair/sombre : aucune violation détectée.
- Le retour clavier du contexte, d’abord défaillant, passe trois exécutions consécutives après correction. Les premiers essais ont aussi permis de corriger l’actualisation des résultats des actions et de préserver le nom accessible complet des lignes.
- Les captures de référence CI restent intactes. La CI distante, CodeQL, un nouveau scan d’image et Docker Desktop Windows ne sont pas exécutés dans cette recette locale.

Le Docker local réutilise l’image de dépendances déjà vérifiée et reçoit l’API et le frontal compilés. Les derniers ajustements du frontal sont copiés dans le conteneur de recette par l’API Docker. Le ZIP contient les sources complètes et le Dockerfile de construction ; il ne contient ni cette image locale ni les bases et identités de recette. La construction complète du Compose utilisateur à deux nouveaux conteneurs reste à essayer sur Docker Desktop, comme dans la livraison précédente.

Pour installer le paquet et conserver les essais existants : [guide Docker interfaces](DOCKER-INTERFACES.md).


### Résultats finaux — 11/11/2026, Europe/Paris

| Contrôle | Commande / périmètre | Résultat |
| --- | --- | --- |
| Web | `node node_modules/vitest/vitest.mjs run`, dans `apps/web` | 265 tests, 33 fichiers, code 0 |
| UI | Même commande dans `packages/ui` | 243 tests, 4 fichiers, code 0 |
| API | Vitest : `validations-occurrences`, `occurrences-validees-vues`, `grc-integration`, `series-fenetres-calendrier`, un worker ; PostgreSQL 18 éphémère isolé | 31 tests, code 0 |
| Navigateur | Playwright Chromium : `neon-lignes-validation`, `neon-timeline-studio`, droits Timeline, récurrences/planning, cent actions ordinateur/téléphone, filtres et jours de fond | 14 parcours réussis, zéro échec et zéro rejeu automatique, code 0 ; dernier passage après ajustement de la réserve sous les listes |
| Accessibilité ciblée | Axe : registre et fenêtre de résultat, clair/sombre | Quatre analyses, aucune violation détectée ; deux analyses supplémentaires dans les parcours cent actions |
| Compilation | TypeScript web/API/E2E ; API compilée ; frontal UI-test Vite | Codes 0 ; avertissements Vite existants sur le chargement de configuration et le poids des chunks |
| Qualité | ESLint avec zéro avertissement ; Prettier ; `git diff --check` | Codes 0 |
| Exécution | Conteneur de recette interfaces sur `http://localhost:5174` | `healthy`, API et frontal compilés ; PostgreSQL existant conservé |

Les premières exécutions ont échoué sur le retour du focus, l’actualisation des actions sans série et des attentes d’anciens parcours. Ces points ont été corrigés et revérifiés. Le contrôle du défilement mesure les positions après mise à l’écran de la zone et vérifie aussi que la position de défilement de la page ne change pas ; une tolérance de moins d’un demi-pixel couvre les arrondis CSS. Les assertions métier, les droits et les références visuelles CI n’ont pas été supprimés.

La création d’un rôle de test sur l’instance PostgreSQL partagée a été refusée par le contrôle automatique. La recette API a donc utilisé une instance PostgreSQL distincte, éphémère, avec son stockage temporaire ; celle-ci a été supprimée après les tests. Aucune modification des comptes de l’instance partagée.

### Captures réelles, sans retouche

Six images natives de 3840 px de large :

| Vue | Clair | Sombre |
| --- | --- | --- |
| Lignes compactes et zone défilante | [PNG HD](captures/lignes-validation/lignes-light-hd.png) | [PNG HD](captures/lignes-validation/lignes-dark-hd.png) |
| Timeline | [PNG HD](captures/lignes-validation/timeline-light-hd.png) | [PNG HD](captures/lignes-validation/timeline-dark-hd.png) |
| Résultat avec commentaire et preuve | [PNG HD](captures/lignes-validation/validation-light-hd.png) | [PNG HD](captures/lignes-validation/validation-dark-hd.png) |

La vidéo de livraison montre le défilement interne, l’ouverture du contexte par sa ligne et l’enregistrement d’un KO depuis un repère, avec sa couleur actualisée. Les écrans et résultats sont exclusivement fictifs. La recette visuelle humaine et l’essai Docker Desktop Windows restent à réaliser.
