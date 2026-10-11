# Livraison de la version legacy de test

Publication autorisée par l’utilisateur le 11 octobre 2026, après échec des
liens de téléchargement du chat.

La branche `legacy/test-lots-d-f` contient la copie autonome legacy, ses sources,
son lanceur Python et sa documentation. L’historique est indépendant. Les fichiers
fonctionnels sont ceux du ZIP local déjà livré ; seuls les documents de livraison,
les consignes de cette branche et les preuves de préparation sont actualisés.
Les données utilisateur ne sont pas incluses.

Pour télécharger : ouvrir la branche sur GitHub puis **Code → Download ZIP**.
Pour tester après extraction : `python3 demarrer.py`, puis ouvrir
`http://127.0.0.1:8123`. Sous Windows : `demarrer.bat`.

Les tableaux de recette historiques restent datés de leur exécution originale.
`recette/preparation-branche.json` décrit les contrôles spécifiques à cette copie.
`MANIFESTE-LIVRAISON.json` contient les empreintes des fichiers livrés ; son propre
hash est exclu pour éviter une référence circulaire.

Les limites fonctionnelles restent celles de la livraison locale : suivi générique
pour les domaines CaRE dont une grille officielle n’est pas intégrée, évaluations
internes, sauvegardes non chiffrées et absence d’authentification serveur.
Cette livraison ne modifie pas les installations existantes.
