# Prompt de reprise

Tu reprends la refonte Neon de **Suivi des audits SMSI — ISO 27001 / HDS**. Lis tout ce dossier avant de modifier l’application. Travaille sur une branche dédiée, en conservant les changements locaux du demandeur. Si tu utilises l’archive source fournie, sa référence applicative est `23b33b5ce4fd4cf5eeee0af97c9638b18852b61a`. Lis les `AGENTS.md`, `HANDOVER.md`, `CONTRIBUTING.md` et documents requis dans le dépôt réel.

## Demande la plus récente

L’interface doit s’adapter à la **largeur et à la hauteur de l’écran** dans toute l’application. Elle ne doit être ni minuscule ni composée de blocs géants. **Le téléphone n’est pas important : priorité aux PC**, notamment portable 1366 × 768, bureau 1920 × 1080, grand écran 2560 × 1440 et fenêtres redimensionnées.

Le demandeur veut aussi de petites icônes pour les vues, une recherche discrète et des filtres accessibles à la demande, afin de réduire les informations affichées en permanence. Les icônes doivent rester faciles à cliquer ; les textes utiles restent lisibles. Utilise la nouvelle maquette comme référence visuelle, pas comme application de remplacement.

## État et autorisation

- Les fonctionnalités détaillées dans `02-DECISIONS-ET-ETAT.md` sont déjà intégrées dans la source. Ne les refais pas et ne les remets pas en attente d’accord.
- La nouvelle règle d’adaptation à l’écran et la priorité PC sont des demandes explicites acquises.
- Les nouvelles proportions et commandes restent des **propositions visuelles**. Ne suppose pas qu’elles ont été approuvées.
- Règle explicite du demandeur : présenter le visuel, attendre sa validation, puis intégrer, tester et fournir de nouveaux visuels de l’application. S’il valide ces rendus dans la nouvelle session, cet accord suffit pour le lot correspondant : ne le redemande pas.
- Avant cet accord, tu peux lire, auditer, préciser le plan et retravailler les maquettes indépendantes. Ne lance pas de build/test applicatif et ne modifie pas le code applicatif pour cette nouvelle finition.

## Travail à conduire après validation

1. Revoir les composants et variables partagés pour une lecture confortable et une occupation équilibrée de l’écran. Examiner les préférences de taille, densité et mode mural existantes avant de changer l’échelle automatique.
2. Intégrer les commandes de vue en icônes et les panneaux de recherche/filtres dans les composants réels. Préserver tous les critères, valeurs actives, préférences et droits ; ne masquer aucune fonction métier pour alléger la page.
3. Adapter les listes, graphiques et dalles selon l’espace, en gardant les vues par défaut acquises et les zones de défilement propres aux listes.
4. Passer progressivement sur Dashboard, Périmètres, Objectifs, Référentiels/DdA, Organisation, Actions/Récurrences et fiches. Une correction du seul écran Actions ne termine pas le chantier transversal.
5. Exécuter les contrôles pertinents et fournir des captures réelles PC, clair/sombre. Ne pas réattribuer les résultats historiques au nouveau commit.

## Contraintes

Conserver React/Mantine, les styles statiques compatibles avec la CSP, la police existante, les thèmes et la charte validée. Pas de nouvelle dépendance sans suivre la règle du dépôt. Le prototype contient des manipulations DOM et des styles de démonstration qui ne doivent pas être copiés tels quels dans l’application.

Préserver les calculs, données, permissions, API, versions, historique, preuves et validations. Ne pas supprimer les données Budget/CRRC : seul leur retrait de l’interface est intégré. Garder la connexion du profil normal ; seule la copie Docker de test des interfaces ouvre directement l’application.

Ne pas écraser une préférence explicite de taille ou le mode mural. Ne pas miniaturiser l’interface entière pour faire tenir un tableau. Ne pas appliquer un agrandissement général qui rend les cartes énormes.

Ne pas travailler directement sur `main`, ne pas pousser, fusionner ou déployer sans autorisation distincte. Ne pas inclure de données réelles, cookies ou secrets dans les rendus ou archives. Communiquer en français, avec des résultats concrets et des visuels à juger.
