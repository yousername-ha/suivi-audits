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

## Travail attendu — ordre des intégrations

Suis les lots L0–L8 de la section « Ordre d’intégration et conditions de passage » dans `INTEGRATION-RECETTE.md`. Cet ordre technique est distinct de l’ordonnancement visuel du menu.

1. **L0 — Audit de la cible.** Identifier ta branche, le SHA, les technologies, routes, composants, modèles, API et permissions déjà présents. Consulter Claude exclusivement en lecture seule si accessible. Distinguer implémentation prouvée, manque et incertitude.
2. **L1 — Fondations existantes.** Vérifier d’abord les périmètres et leur hiérarchie, les accès multi-périmètres, les annuaires de responsables, les référentiels/applicabilité, les audits, les preuves versionnées et la traçabilité serveur. Préparer la reprise des données avant toute migration. Relever les contrats prêts et les blocages, sans reconstruire le socle.
3. **L2 — Coque et navigation.** Réutiliser le design system, les deux thèmes, le menu fixe, les fenêtres centrales, les composants et défilements partagés. Mapper les destinations/alias aux routes et droits existants. Présenter l’ordre proposé avant son remplacement global ; continuer les lots indépendants pendant cette validation.
4. **L3 — Registres et héritage commun.** Raccorder les registres d’actions, d’écarts et de récurrences aux périmètres autorisés, avec contexte hérité, filtres et contrôles de changement de registre. Les fixtures historiques 018/021 ne sont pas des modèles de données à copier. Tester les trois familles, puis répéter ces contrôles dans chaque module.
5. **L4 — Plans d’action.** Intégrer 017 v004 : actions autonomes d’abord, dates début/fin, quatre libellés mappés au workflow, blocage motivé et responsable personne/groupe/fonction selon contrat. Timeline, Kanban et Liste & détail utilisent les mêmes objets et mutations.
6. **L5 — Écarts et liens correctifs.** Réutiliser les audits et exigences vérifiés en L1, les registres de L3 et les actions de L4. Raccorder audit → écart → action → vérification ; préserver la clôture et créer un nouveau constat lié en cas de récidive. Action terminée, écart clos et conformité évaluée restent trois décisions distinctes.
7. **L6 — Tâches récurrentes.** Raccorder registres, séries et occurrences au moteur existant ; intégrer d’abord calendriers iCal et fenêtres, puis les vues, enfin OK/KO/NA, preuves et enchaînement. La validation nécessite auteur/horodatage serveur, immutabilité et idempotence. L6 peut avancer sans attendre L5 si ses contrats d’action/occurrence, de preuves et de journal sont prêts.
8. **L7 — Cartes de périmètres et synthèses.** Finaliser le graphe et ses compteurs quand les modules producteurs sont disponibles. Le CRUD des périmètres est déjà vérifié en L1 ; la structure du graphe peut avancer plus tôt. Réutiliser conformité/BIA/PCRA/fournisseurs existants, sans fausses données ni double comptage. Ne pas toucher au module cartographique dynamique protégé.
9. **L8 — Recette complète et livraison.** Exécuter les parcours croisés et la non-régression, documenter SHA, fichiers, composants réutilisés, tests et limites. Les contrôles ciblés sont exécutés à chaque lot ; ne pas attendre L8 pour découvrir les erreurs d’intégration.

Ne passe à une mutation dépendante que lorsque son contrat, ses autorisations et son comportement en erreur ont été vérifiés. Si un prérequis manque, noter le lot bloqué et poursuivre les tâches indépendantes ; ne pas présenter une simulation locale comme une intégration opérationnelle. L’ordre de la recette R01–R18 n’est pas l’ordre de développement.

Ne recrée aucun moteur ou API concurrent. Si groupe/fonction, registres multi-périmètres ou validation immuable nécessitent un complément métier, formule le contrat manquant pour l’agent responsable et poursuis les lots indépendants ; ne masque pas l’absence avec un stockage navigateur. Les données fictives restent des fixtures de test.

Préserve le style 08 et les deux thèmes globaux existants. Fenêtres centrales, menu fixe, contenu défilant, intitulés fixes des timelines ; accessible au clavier et sur mobile. Fond graphique uni. Ne modifie ni l’interface interne ni les comportements de la cartographie dynamique.

## Compte rendu attendu

Présente le problème résolu, les changements, les tests réellement exécutés et ce qui reste bloqué. Ne déclare pas une fonction opérationnelle sans vérification de son parcours et de ses accès réels. Ne régénère ni ZIP ni BAT sauf nouvelle demande explicite.

Quand une fonctionnalité est effectivement implémentée, écris dans son dossier `implementation/IMPLEMENTATION-OK.md`, sur TA branche seulement : numéro, version de référence, branche/SHA, périmètre livré, commandes et résultats de recette, limites. Une intention ou un modèle vide ne vaut pas confirmation. Codex gérera ensuite le classement dans `fonctionnalites-implementees` sur legacy ; ne déplace pas toi-même ses dossiers de référence.
