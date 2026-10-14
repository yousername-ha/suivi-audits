# Consignes pour la future IA de codage — après validation utilisateur

Ce ZIP est une maquette fonctionnelle de référence, pas le code de production à copier tel quel. Lire `LIRE-MOI.txt`, `GUIDE-DE-TEST.md`, `TECHNIQUE-MAQUETTE.md`, les sources et `TESTS.json`. Reprendre les interactions et le style explicitement validés par l’utilisateur. Demander quels éléments sont validés si aucune décision n’est fournie ; ne pas supposer que ce ZIP est approuvé.

Le dossier GRC structurel déjà préparé est dans `implementation/grc-transversal/v001-dossier-arm/` sur la branche de référence legacy. Sa nouvelle publication consolidée doit attendre la validation de la maquette. Les données, règles ou simplifications du prototype ne remplacent pas les contrats métier, permissions et migrations du dossier technique.

Pour coder l’intégration, travailler exclusivement sur ta propre branche dédiée, depuis `origin/legacy` en lecture. Ne pas pousser sur legacy, fusionner ou déployer. Préserver les registres canoniques et leurs identifiants, les historiques, les liens Annex A ISO 27001:2022 et tous les contrôles serveur. Ne modifier ni le fonctionnement ni l’interface de la cartographie dynamique.

Le menu cible comporte sept familles métier et Administration séparée, des chevrons et des icônes colorées. Conserver les anciens accès en alias, la portée des droits, les liens contextuels et les tâches récurrentes. Les écrans secondaires génériques ne sont pas des spécifications métier complètes : les détailler avant d’en annoncer l’intégration.

Aucune valeur fictive, échelle de démonstration ou règle de validation simplifiée ne doit devenir une règle normative implicite. Réutiliser le backend et la sécurité de l’application ; ne pas transporter le stockage local de cette maquette comme architecture de production. Livrer une recette réelle, les captures et les limites, sans annoncer une fonction achevée si elle reste simulée.
