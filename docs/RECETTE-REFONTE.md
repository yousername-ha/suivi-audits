# Recette de la refonte Legacy

Branche `legacy/test-lots-d-f`, 11 octobre 2026. Chromium local, comptes,
établissements et pièces exclusivement **synthétiques**. Les recettes utilisent
des bases temporaires hors dépôt ; aucun profil de production n’est chargé.

## Résultats exécutés

| Ensemble | Résultat | Preuve |
| --- | --- | --- |
| Moteurs Legacy D/F et intégration | **39 réussis**, 0 échec | `recette/refonte-unit-resultats.txt` |
| API et règles serveur | **5 réussis**, 0 échec | `recette/refonte-serveur-resultats.txt` |
| Parcours navigateur de la refonte | **17 réussis**, 0 échec | `recette/refonte-browser-resultats.json` |
| Non-régression navigateur existante | **22 réussis**, 0 échec | `recette/refonte-regression-resultats.json` |
| Conservation de l’application source | **592 fichiers identiques** par SHA-256 | `recette/refonte-conservation.json` |

**83 contrôles automatisés réussis.** Exécution navigateur de la refonte :
`2026-10-11T13:09:45.970Z`. Non-régression : `2026-10-11T13:10:42.914Z`. Aucune erreur JavaScript
et aucune requête externe automatique dans les deux recettes surveillées.
Syntaxe Python/JavaScript et JSON contrôlée ; Gitleaks ne détecte aucun secret
dans les fichiers de livraison contrôlés.

Un ancien contrôle d’ouverture directe `file://` est **non exécuté** : la politique
locale du navigateur bloque ce chemin. L’exécution courante exige de toute façon
le serveur Python pour la persistance et les permissions. Ce contrôle n’est pas
compté comme réussi. Le dossier auditeur autonome hors ligne est, lui, testé.

## Critères d’acceptation du prompt

| Scénario | Contrôles effectivement couverts |
| --- | --- |
| A — Parcours/actions | Sélection D2, 13 évaluations partagées, sous-tâche transformée en action une seule fois, clôture centrale, recalcul serveur, passage automatique à l’étape suivante et retour à une étape précédente ; preuves et validation humaine restent distinctes |
| B — Données partagées | Modification d’un établissement depuis le même formulaire du parcours, consultation du menu unitaire, modifications de BIA retrouvées dans les plans ; l’état persiste au rechargement |
| C — GHT | GHT/deux établissements/SI mutualisé saisis, responsable existant sélectionné, vue consolidée puis établissement avec contexte conservé ; droits parent/enfant et isolation A/B testés sur l’API |
| D — BIA/PCRA | Impacts temporels, besoins, RTO/RPO métier, validation, PCA/PRA distincts, réévaluation après modification du BIA, exercice/RETEX/action, liens BIA–D2 et preuve commune, PDF/Excel réellement générés |
| E — Comptabilité | Facture déposée, métadonnées HT/TTC exactes en centimes, fichier protégé, preuve centrale et même version rattachée à D2/PCRA ; le dépôt ne vaut pas acceptation |
| F — Non-régression | Pages historiques, rôles/relations, 118 critères HAS, versions précises des preuves, budgets, Excel/PDF, dossier auditeur filtré, import d’observations, ZIP/restauration, refus des archives altérées, lecture seule et données sources préservées |

Les tests de moteur couvrent aussi migrations répétables, FINESS adaptés au type,
cycles hiérarchiques et de tâches, responsables multi-établissements, champs manquants,
preuves refusées/obsolètes/remplacées, validation obsolète, politiques immuables,
historique sans snapshots récursifs, centimes et idempotence des actions.

Les tests serveur vérifient session/CSRF/origine, écriture et téléchargement refusés
hors périmètre, fusion conservant les objets masqués, 409 concurrent, lecture seule,
interdiction de forger une progression/validation, refus d’identifiants injectables,
historique masqué, fermeture
initiale et chemins privés inaccessibles. Le journal identifie le compte effectif.

## Contrôle graphique

Largeurs **390, 768, 1440 et 3840 px**, sans débordement du document. Groupes
repliables et menu mobile testés au clavier. Thème sombre couvert par la recette
historique ; captures de debug exclues de la publication. Les captures historiques
initiales restent conservées, avec leurs anciens résultats datés.

## Reproduire

Commandes dans le [README](../README.md). `browser-refonte.cjs` lance son propre
serveur et dossier temporaire. Pour `browser.cjs`, utiliser un serveur **neuf de
recette**, jamais l’instance contenant les données réelles : certains scénarios
réinitialisent explicitement cet état synthétique.

Ces résultats sont des tests locaux de cette livraison, sans attribution d’une
ancienne CI au nouveau commit. Ils ne constituent ni certification ANS/HAS,
ni campagne de performance sur des volumes hospitaliers réels. Les sources et
éléments à confirmer sont documentés dans [SOURCES-ET-LIMITES.md](SOURCES-ET-LIMITES.md).
