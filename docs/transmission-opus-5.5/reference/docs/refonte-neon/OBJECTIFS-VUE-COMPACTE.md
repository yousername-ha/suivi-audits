# Objectifs et indicateurs : vue compacte par défaut

04/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Demande explicite traitée avant de poursuivre le dépliage horizontal des périmètres, dont la maquette est validée par « Top ».

La rubrique Objectifs ouvre désormais **Vue compacte**, comme la rubrique Indicateurs. Le menu « Objectifs et indicateurs » mène à `/pilotage/objectifs` au lieu de `/pilotage/processus` ; la destination choisit sa rubrique d'entrée parmi les rubriques autorisées. L'ordre des onglets reste inchangé. La rubrique dédiée Objectifs par processus conserve sa vue Par processus ; les quatre présentations restent sélectionnables.

Réglage initial : `74bc2ee`. Entrée du menu : **`36a92362db38944e1dfa9522e83308480092beed`**. Aucun changement de graphisme, calcul, modèle, formulaire, donnée ni droit. L'utilisation de la vue compacte existante a été explicitement demandée ; aucune nouvelle proposition graphique nécessaire pour ce réglage.

![Affichage réel après ouverture depuis le menu](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-objectifs-compact-defaut/objectifs-compacte-par-defaut.png)

TypeScript web, ESLint et Prettier ciblés, compilation web : code 0. Seize tests de navigation existants et deux E2E existants réussis, sans rejeu. Le scénario Objectifs vérifie désormais l'adresse du lien du menu et la sélection initiale de Vue compacte avant de reprendre ses contrôles de fiches, mesures et filtres dans les autres vues.

Un contrôle navigateur complémentaire vérifie l'arrivée depuis le menu, le retour en vue compacte après rechargement, les quatre bascules, Indicateurs déjà compact et Objectifs par processus inchangé. Aucune erreur JavaScript/CSP ni écriture métier pendant ce contrôle ; tableaux des processus, objectifs et indicateurs identiques avant/après. Capture de l'application compilée, API et données de démonstration fictives de la base de recette séparée. [Reçu](captures-objectifs-compact-defaut/validation.json).

Commandes privées et journaux : `/workspace/work/neon-perimetres-instance/objectifs-compact`. Environnement Node 26, Chromium système et base PostgreSQL de recette déjà utilisée ; aucune production. Build avec les avertissements connus sur le script d'exploitation et les bundles, sans échec. Pas de nouvelle suite de tests écrite pour ce changement de défaut ; le scénario existant a été adapté.

Prochaine étape : reprendre l'intégration du dépliage horizontal des périmètres déjà validé, conserver ce réglage dans le prochain ZIP Docker, puis fournir les contrôles et captures réelles correspondants. **Le dernier ZIP livré (`6710b80`) ne contient pas ce nouveau défaut.** Aucun nouveau ZIP, push, fusion ou déploiement pour cette priorité.
