# Prompt — implémenter le parcours guidé 024

Tu travailles uniquement sur ta branche de codage. `legacy` est une référence de lecture ; ne la modifies pas. Claude reste en lecture seule. Ne merge, ne déploie et ne lance pas de CI/release sans demande distincte.

Lis le prompt commun du socle ASTRA, le contrôle préalable/ordre communs, le [dossier technique 024](DOSSIER-IMPLEMENTATION.md), l’[historique des décisions](README.md) et les notes de la [maquette v011](../maquettes/v011-animations-visibles/README.md).

Avant de coder, vérifie dans ta branche si la fonctionnalité 024 ou chaque capacité 024-F01 à F10 est déjà implémentée et utilisable. Rends un relevé concis : exigence, fichier/composant/API/permission/test réel, preuve et SHA, état, écart, action. Vérifie le code exécutable, pas la seule documentation. Si c’est déjà implémenté et vérifié, ne le réécris pas ; complète uniquement les écarts. Ne lance pas un audit général de la plateforme.

Réutilise les modules, modèles, services, IDs, droits, versions et composants existants. Le parcours est une vue de navigation guidée, pas un registre parallèle. N’invente aucun endpoint ou modèle métier ; documente les contrats manquants et poursuis les travaux indépendants. N’utilise pas les fixtures/localStorage de la maquette comme stockage métier. Ne considère pas un nœud parcouru, une preuve attachée ou une action close comme une conformité ou certification. ISO 27001 n’impose pas EBIOS RM. Ne touche pas à la cartographie dynamique.

Préserve le style et les interactions de v011, les 16 étapes/26 sous-actions, les 11 raccourcis et les compléments HDS, en respectant les limites normatives de `SOURCES.md`. Applique responsive, clavier, focus, labels, permissions serveur, mouvement réduit et les états chargement/vide/erreur/refus/conflit. Pour le détail des comportements, liens réciproques, périmètres et recette, le dossier DOSSIER-IMPLEMENTATION.md est prioritaire.

Exécute uniquement les validations pertinentes et rapporte les résultats réels. Livre branche et SHA, matrice d’existant avant/après, changements, composants/APIs réutilisés, contrôles et limites. Ne crée `implementation/IMPLEMENTATION-OK.md` que lorsque le périmètre v011 est réellement intégré et vérifié, avec branche/SHA/tests. Le classement du dossier vers « implémentées » sera effectué séparément après lecture de ce marqueur.
