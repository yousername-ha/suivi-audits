# Recette du registre central et de l’administration

11 octobre 2026, branche `legacy/test-lots-d-f`, base de livraison `3e3fad5`.
Tests locaux avec Python, Node.js, Playwright et Chromium. Bases, comptes,
documents et profils exclusivement synthétiques, dans des dossiers temporaires.

| Ensemble réellement exécuté | Résultat | Preuve |
| --- | --- | --- |
| Moteurs D/F, intégration et risques | 48 réussis | `recette/risques-admin-unit-resultats.txt` |
| Risques, immutabilité, permissions, migration et compteurs serveur | 11 réussis | `recette/risques-admin-serveur-resultats.txt` |
| Sessions, cloisonnement, pièces et concurrence existants | 5 réussis | `recette/risques-admin-serveur-historique-resultats.txt` |
| Administration, risques, démonstration et cartographie dans le navigateur | 18 réussis | `recette/risques-admin-browser-resultats.json` |
| Parcours de refonte existants, dont CaRE/PCRA | 17 réussis | `recette/risques-admin-refonte-resultats.json` |
| Non-régression D/F existante | 22 réussis | `recette/risques-admin-regression-resultats.json` |
| Conservation de l’application source | 592 fichiers identiques | `recette/risques-admin-conservation.json` |

**121 tests réussis, aucun échec.** Aucune erreur JavaScript ni requête externe
automatique observée dans les trois recettes navigateur. Voir les horodatages et
résultats individuels dans les fichiers de preuve. Les résultats précédents
`refonte-*` restent ceux de la livraison initiale, conservés séparément.

Le contrôle historique `file://` est **non exécuté** : le navigateur bloque cette
ouverture. Il n’est pas compté comme réussi ; le serveur Python local est requis.
Les nouvelles captures, fichiers téléchargés, bases, cookies et mots de passe de recette
ne sont pas publiés. Les sept captures synthétiques historiques restent inchangées. Aucun résultat GitHub Actions n’est attribué à cette livraison.

## Critère d’acceptation

La recette crée depuis l’administration le jeu FICTIF, vérifie trois risques
distincts, une étude initiale avec trois évaluations, puis une seconde étude
réévaluant uniquement le premier risque. Celui-ci possède deux évaluations
datées, de méthodes/politiques déclarées et attribuées au compte authentifié.

Les niveaux initial, résiduel et accepté ont des références distinctes. La carte
consolidée du GHT et ses filtres établissement consultent ces références. Archiver
la première étude conserve les trois risques, leurs quatre évaluations et leurs
liens. Le serveur refuse l’effacement des risques et l’altération des évaluations.

Une autre fiche est créée et évaluée sans étude depuis le registre. Une politique
personnalisée à deux impacts, trois vraisemblances et deux niveaux est configurée
dans une matrice explicite. Son résultat est contrôlé sur le serveur. Sa nouvelle
version ne modifie pas la politique liée à l’évaluation précédente. Les méthodes
restent séparées dans la cartographie ; aucune formule uniforme n’est imposée.

## Autres vérifications

- Administration accessible via menu et engrenage, sans section sauvegarde/update ;
  dix rôles de base et responsabilités disponibles dans les périmètres.
- Identifiants `PERI`, `IMP`, `RISK`, `EVR`, etc. automatiques, uniques, immuables ;
  compteurs persistants et attribution répétable sans doublon.
- Mise à niveau d’objets déjà validés sans codes : révision du BIA, validation BIA/PCA
  et contenu métier du parcours conservés.
- Démonstration répétable, conservation d’un périmètre antérieur, aucun compte créé
  par le jeu ; facture physique liée aux données CaRE/PCRA et mesures.
- Traitement, mesure et action centrale unique ; clôture de l’action sans changement
  du résiduel ; historique serveur avec auteur réel et preuves conservées.
- Lecteur et contributeur d’établissement limités à leur couverture ; politique
  GHT héritée en lecture seule ; historique d’étude hors périmètre non divulgué.
- Références, décisions et politiques réservées aux validateurs sur l’API ; accès
  aux routes d’administration refusé aux comptes ordinaires.
- Parcours guidé modifiant le même risque que le registre, sans duplication.
- Excel analysé après téléchargement, rapport/PDF généré depuis les filtres courants.
- Affichage à 390, 768, 1440 et 3840 pixels sans débordement du document ;
  sous-menu actif correspondant à la vue cartographique.
- Redémarrage réel du serveur sur le même SQLite : références, historiques,
  périmètres et pièces intégralement conservés.

Syntaxe des modules JavaScript, scripts inline, Python et JSON contrôlée.
Gitleaks n’a détecté aucun secret dans les fichiers de livraison contrôlés.
Ces contrôles ne prétendent pas certifier les référentiels ou un déploiement Internet.

## Reproduire

```sh
node --test tests/core.test.cjs tests/integration.test.cjs tests/risk.test.cjs
python3 tests/server_test.py
python3 tests/server_risk_test.py
node tests/browser-refonte.cjs
node tests/browser-risks.cjs
```

Installer Playwright et Chromium dans l’environnement de recette, ou renseigner
`PLAYWRIGHT_MODULE` et `CHROMIUM_PATH` vers une installation existante. Les deux
derniers scripts lancent leur propre serveur et stockage temporaire. La recette
historique utilise un serveur neuf dédié selon la procédure du README.
Ne jamais lancer ces recettes sur une base contenant les données des utilisateurs.
