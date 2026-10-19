# Prompt pour l’IA de codage

Tu dois intégrer les interfaces ASTRA à l’application existante, en réutilisant son socle métier et son design system.

## Source et limites de travail

Lis d’abord le dossier GitHub de référence :
https://github.com/yousername-ha/suivi-audits/tree/legacy/fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10

Lis entièrement `README.md`, `SPECIFICATIONS.md`, `INTEGRATION-RECETTE.md`, `navigation.json`, puis les maquettes versionnées qu’ils désignent. En cas de contradiction avec un ancien document, cette édition prévaut pour les périmètres des registres et la proposition de navigation. Les règles métier réelles restent à vérifier dans le code cible ; signale tout conflit sans l’écraser.

Travaille et publie exclusivement sur TA propre branche dédiée. `legacy` est une référence en lecture seule. Ne modifie aucun environnement ni branche Claude, aucune référence Git, aucun fichier, index ou configuration de cet environnement. Ne lance pas de build/test/générateur susceptible d’y écrire. Pas de fusion globale, déploiement ou publication en production implicite. Préserve les changements locaux étrangers.

## Règle fonctionnelle confirmée

Le registre porte un ou plusieurs périmètres. Ses éléments les héritent : plan → actions, registre d’écarts → écarts, registre de tâches récurrentes → séries et occurrences. Aucun choix indépendant de périmètre dans une fiche d’élément. Afficher le contexte hérité en lecture seule ; le résoudre depuis le registre réel, pas depuis une copie modifiable sur l’élément. Le filtre global retrouve les registres concernés et leurs éléments.

Préserver les contextes et décisions historiques immuables. Un changement de registre ou de périmètres doit vérifier les droits, les liens et les conflits côté serveur. L’héritage de portée ne rend pas une exigence applicable à tous les périmètres. Aucun masquage UI ne remplace une autorisation.

## Travail attendu

1. Identifier ta branche, le SHA cible, les technologies, routes, composants, API, politiques et permissions déjà présents. Consulter Claude en lecture seule si accessible. Relever précisément les contrats manquants, sans déduire une fonction de sa documentation.
2. Adapter le menu selon la proposition documentée : icônes colorées, chevrons, sept familles, Administration séparée, un accès canonique par objet et des vues internes. L’ordre reste à valider ; présenter le résultat avant de le considérer final. Préserver alias et droits, ne pas perdre de module spécialisé.
3. Mettre en commun le contexte de registre et son héritage dans actions, écarts et tâches récurrentes. Les fixtures historiques 018 et 021 ne sont pas des modèles de données à copier.
4. Raccorder les plans d’action à la référence 017 v004 : Timeline, Kanban, Liste & détail, dates de début/fin, quatre libellés demandés mappés au workflow, blocage motivé, responsable personne/groupe/fonction selon le contrat réel.
5. Raccorder les écarts aux audits, registres, exigences et actions ; préserver clôture et récidive liée. Action terminée, écart clos et conformité évaluée sont des décisions différentes.
6. Raccorder les récurrences : registres, périodicités/fenêtres, calendriers iCal, superpositions, réalisation OK/KO/NA, enchaînement et preuve dans le registre central. Auteur/horodatage serveur et validation immuable, commandes idempotentes.
7. Intégrer les périmètres graphiques si les contrats sont disponibles, sans toucher au module cartographique dynamique protégé.
8. Exécuter la recette, documenter les fichiers, composants réutilisés, SHA, résultats et limites.

Ne recrée aucun moteur ou API concurrent. Si groupe/fonction, registres multi-périmètres ou validation immuable nécessitent un complément métier, formule le contrat manquant pour l’agent responsable et poursuis les lots indépendants ; ne masque pas l’absence avec un stockage navigateur. Les données fictives restent des fixtures de test.

Préserve le style 08 et les deux thèmes globaux existants. Fenêtres centrales, menu fixe, contenu défilant, intitulés fixes des timelines ; accessible au clavier et sur mobile. Fond graphique uni. Ne modifie ni l’interface interne ni les comportements de la cartographie dynamique.

## Compte rendu attendu

Présente le problème résolu, les changements, les tests réellement exécutés et ce qui reste bloqué. Ne déclare pas une fonction opérationnelle sans vérification de son parcours et de ses accès réels. Ne régénère ni ZIP ni BAT sauf nouvelle demande explicite.

Quand une fonctionnalité est effectivement implémentée, écris dans son dossier `implementation/IMPLEMENTATION-OK.md`, sur TA branche seulement : numéro, version de référence, branche/SHA, périmètre livré, commandes et résultats de recette, limites. Une intention ou un modèle vide ne vaut pas confirmation. Codex gérera ensuite le classement dans `fonctionnalites-implementees` sur legacy ; ne déplace pas toi-même ses dossiers de référence.
