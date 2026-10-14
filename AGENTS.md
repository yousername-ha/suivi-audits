# Branche legacy — refonte ASTRA

L’utilisateur a autorisé le 11 octobre 2026 la publication de la copie legacy
locale sur une branche GitHub dédiée, pour permettre son téléchargement et ses tests.
Cette instruction remplace l’interdiction initiale de publication pour cette livraison.

- Branche exclusive de travail et de livraison : `legacy`, conformément à la demande
  explicite du 12 octobre 2026. La refonte ASTRA est intégrée sur cette branche.
- Ne modifier, fusionner ni réécrire aucune autre branche. Conserver `main` et
  `feature/gpt6-evolution-smsi-grc` dans leur état existant.
- Historique indépendant : aucune PR de fusion de cette branche vers l’application
  principale ; aucune CI, release, image Docker ou mise à jour déployée par cette livraison.
- Copie HTML/CSS/JavaScript/JSON : appliquer la navigation et le design ASTRA
  demandés par l’utilisateur, en préservant les fonctions et parcours métier.
- Le périmètre actuel inclut la refonte demandée : périmètres, parcours guidé, CaRE D2, preuves financières et PCRA (BIA/PCA/PRA/exercices), puis navigation. Exécuter les phases dans cet ordre. I et J restent exclus.
- Il inclut désormais l’administration (sans sauvegarde ni mise à jour), les rôles de base,
  les références internes automatiques, le jeu FICTIF et le registre central des risques.
  Séparer risques, études, évaluations, scénarios, mesures et décisions. Les évaluations,
  décisions et politiques sont immuables. La cartographie utilise les références explicites ;
  archiver une étude ou clôturer une action ne supprime ni ne recalcule les risques.
- Il inclut les cartographies historiques contexte/processus et l'ordonnancement
  du menu ; les cartes restent liées aux registres et soumises aux périmètres serveur.
- Les risques se rattachent aux mesures de l’Annexe A ISO 27001:2022 via les
  `objectRefs` bidirectionnels existants. Conserver les liens des plans de traitement ;
  un rattachement ne valide ni la conformité ni le risque résiduel.
- Aucun secret, email personnel, document réel, cookie ni profil navigateur en Git.
  Utiliser une identité de commit anonyme et des fixtures synthétiques.
- Exception explicitement demandée : compte public de test local `admin` / `admin`,
  provisionné par le lanceur Legacy, sans écraser un compte existant. Aucun mot de
  passe réel ni aucune base locale n'est publié.
- Les données restent locales : SQLite et pièces dans `.legacy-data`, exclu de Git.
  Les contrôles de session et de périmètres sont côté serveur. Ne pas exposer
  le serveur localhost sur Internet.
- Conserver les restrictions physiques du dossier auditeur et la validation
  humaine des observations. Ne pas inventer de critères ou d’éligibilité officiels.
- Consigner les tests réellement exécutés, sans attribuer une ancienne CI au nouveau SHA.

Les résultats historiques dans `recette/` concernent la recette locale originale.
Le contrôle de préparation de la branche est documenté séparément.

## Cartographie dynamique — restriction explicite de l’utilisateur

- Ne modifier ni le fonctionnement ni l’interface de la cartographie dynamique
  du module cartographique. Cette restriction prévaut sur le périmètre de refonte
  général décrit plus haut. Les propositions visuelles restent isolées dans `fonctionnalites/` et `references/`.

## Organisation par fonctionnalité — demande du 14 octobre 2026

- Point d’entrée : `fonctionnalites/README.md` et `docs/ORGANISATION-LEGACY.md`.
- Chaque fonctionnalité possède `maquettes/`, `tests/` et `implementation/`.
- Ajouter les nouvelles propositions dans une version `vNNN-description`, mettre à jour
  le catalogue, le statut explicite, les références, les résultats et le téléchargement concerné.
- Le dossier commun est `implementation/socle-astra/` ; les références partagées sont
  dans `references/`. `samples/` conserve uniquement l’orientation et le relevé historique.
- Préserver les versions utiles et les images originales. Les suppressions restent
  soumises à une demande explicite ; le nettoyage des séries 01–19 a déjà été autorisé.
- Les tests techniques ne valent pas validation utilisateur et une maquette ne prouve
  pas une intégration métier. Ne jamais marquer une recette réussie sans exécution.
- Conserver le lien stable `downloads/EBIOS-RM-maquette-Windows.zip` pour la maquette
  courante et publier son empreinte SHA-256 lorsqu’elle est régénérée.
- Ce travail de maquettes et d’organisation reste sur `legacy`. L’agent chargé de
  l’implémentation utilise exclusivement sa propre branche dédiée, selon le prompt
  commun et l’instruction explicite de l’utilisateur ; `legacy` est sa référence en lecture.
- Ne modifier aucune cartographie dynamique, autre branche, donnée privée ni travail
  local étranger à la tâche. Aucun déploiement, aucune CI ni fusion automatique.

## ZIP de test — clarification utilisateur du 14 octobre 2026

- Continuer à publier les ZIP de maquettes sur GitHub, sur `legacy`, pour que l’utilisateur puisse les télécharger et les tester. Ne pas attendre la validation de la maquette pour publier son ZIP de test.
- Marquer clairement les propositions « à valider » : publier un ZIP ne vaut pas validation utilisateur ni autorisation d’intégration en production.
- Consolider le dossier final destiné à l’IA de codage après validation ; l’agent de codage reste limité à sa propre branche.
