# Branche legacy de test — lots D et F

L’utilisateur a autorisé le 11 octobre 2026 la publication de la copie legacy
locale sur une branche GitHub dédiée, pour permettre son téléchargement et ses tests.
Cette instruction remplace l’interdiction initiale de publication pour cette livraison.

- Branche exclusive de cette copie : `legacy/test-lots-d-f`.
- Ne modifier, fusionner ni réécrire aucune autre branche. Conserver `main` et
  `feature/gpt6-evolution-smsi-grc` dans leur état existant.
- Historique indépendant : aucune PR de fusion de cette branche vers l’application
  principale ; aucune CI, release, image Docker ou mise à jour déployée par cette livraison.
- Copie HTML/CSS/JavaScript/JSON : préserver le menu, le style Sauge et les parcours.
- Le périmètre actuel inclut la refonte demandée : périmètres, parcours guidé, CaRE D2, preuves financières et PCRA (BIA/PCA/PRA/exercices), puis navigation. Exécuter les phases dans cet ordre. I et J restent exclus.
- Il inclut désormais l’administration (sans sauvegarde ni mise à jour), les rôles de base,
  les références internes automatiques, le jeu FICTIF et le registre central des risques.
  Séparer risques, études, évaluations, scénarios, mesures et décisions. Les évaluations,
  décisions et politiques sont immuables. La cartographie utilise les références explicites ;
  archiver une étude ou clôturer une action ne supprime ni ne recalcule les risques.
- Il inclut les cartographies historiques contexte/processus et l'ordonnancement
  du menu ; les cartes restent liées aux registres et soumises aux périmètres serveur.
- Aucun secret, email personnel, document réel, cookie ni profil navigateur en Git.
  Utiliser une identité de commit anonyme et des fixtures synthétiques.
- Les données restent locales : SQLite et pièces dans `.legacy-data`, exclu de Git.
  Les contrôles de session et de périmètres sont côté serveur. Ne pas exposer
  le serveur localhost sur Internet.
- Conserver les restrictions physiques du dossier auditeur et la validation
  humaine des observations. Ne pas inventer de critères ou d’éligibilité officiels.
- Consigner les tests réellement exécutés, sans attribuer une ancienne CI au nouveau SHA.

Les résultats historiques dans `recette/` concernent la recette locale originale.
Le contrôle de préparation de la branche est documenté séparément.
