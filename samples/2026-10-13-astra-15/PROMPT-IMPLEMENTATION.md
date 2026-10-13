# Prompt complet d’implémentation

Tu travailles sur `https://github.com/yousername-ha/suivi-audits`, **exclusivement sur ta propre branche de travail dédiée**. Utilise la branche qui t’est attribuée ; si aucune n’existe, crée ta branche dédiée depuis `origin/legacy` sans modifier `legacy`. Implémente la refonte dans l’application existante, en utilisant le dossier consolidé **`samples/2026-10-13-astra-15/`** comme source de vérité. Le but est une application fonctionnelle, pas une nouvelle série de maquettes ou un simple plan.

## Autorisation de branche — instruction explicite de l’utilisateur

Toutes tes modifications, tes commits et tes publications doivent rester sur **ta propre branche**. `legacy` est uniquement la référence de départ et la source du dossier ; aucun commit, push ou fusion vers `legacy`, `main` ou la branche d’un autre agent. Vérifie la branche avant toute écriture Git et utilise un push explicitement ciblé vers ta branche, sans force-push.

Cette instruction remplace, pour ton intervention, les anciennes mentions « branche legacy exclusivement » du dossier, de la recette et d’AGENTS.md. Elle ne modifie aucune autre contrainte. Si un outil de packaging impose encore `legacy`, adapte sa garde uniquement à ta branche dédiée en conservant les contrôles de distribution ; ne bascule pas sur `legacy` pour le contourner. Préserve le travail et l’historique déjà présents sur ta branche et utilise un worktree isolé si nécessaire.

## Lecture obligatoire

1. `AGENTS.md` au HEAD réel, puis `samples/2026-10-13-astra-15/README.md`.
2. `DOSSIER-IMPLEMENTATION.md`, `INVENTAIRE-MENUS.md` et `RECETTE.md` de ce même dossier.
3. Image de référence `samples/2026-10-12-astra-08/02-turquoise-assombri.png`.
4. Les 30 vues et leur galerie dans `samples/2026-10-13-astra-14/`, spécialement Actions 20–25 et Récurrences 26–30.

La base inspectée est `b8ff86126f70114ba3bb7e32a4552fbefd3b7b04` ; vérifie le HEAD courant et les changements depuis. Ne réinitialise pas le dépôt. Préserve les modifications locales étrangères à la tâche, notamment `apps/`, `packages/`, `tests/e2e/`. Les anciennes séries restent historiques : ne reprends pas leurs consignes contradictoires de palette ou de portée personnelle du style. Le dossier 15 prévaut pour l’implémentation ; les instructions directes de l’utilisateur restent prioritaires.

## Résultat attendu

- Identité de la **série 08** : barre latérale vert profond, fond clair chaud, cartes blanches, petits accents turquoise et signature discrète Normand’e-Santé. Utilise les jetons consolidés du dossier et les dispositions de la série 14. Ne transforme pas la navigation simplifiée de l’image en suppression de modules.
- **Navigation de la dernière capture annotée** : conserver les pictogrammes en contour, notamment la maison du tableau de bord ; icône active turquoise, filet turquoise, fond vert éclairci et texte clair. Garder les petits chevrons à droite pour déplier/replier les menus (droite fermé, bas ouvert), les sous-menus et leurs états. Ne pas les remplacer par +/− ou onglets horizontaux. Ajouter les états ARIA et préserver les interactions clavier. Les cercles rouges/violets sont des annotations, pas des couleurs de l’interface. Cette précision prévaut sur les différences de navigation dans les 30 captures et reste sans effet sur les routes cartographiques protégées.
- **Matrice des risques corrigée selon la capture utilisateur** : conserver les cases entièrement colorées (Faible vert, Modéré jaune, Élevé orange, Critique rouge), le libellé, le nombre, les références cliquables, les axes, le contour bleu de sélection, le panneau latéral et la réinitialisation. Cette consigne remplace le rendu atténué de la vue 03. Lis le § 4 bis du dossier : préserver la correspondance cellule/niveau de la politique et les évaluations, distinguer palette de présentation standard et palettes personnalisées, ne pas inventer de barème pour une politique manuelle. Les couleurs métier ne sont pas remplacées par les fonds Sauge/Clair. Cela concerne uniquement le registre des risques, pas la cartographie dynamique.
- Deux styles globaux : `sage` (« Référence 08 — Sauge », défaut) et `clair` (« Clair bleuté »). Ils partagent l’identité 08. Préserve le mode personnel Clair/Sombre/Système ; aucun fond clair ne doit écraser le sombre.
- Toutes les destinations métier existantes restent opérationnelles. Plans d’action : Liste, Kanban, Planning, Calendrier, Gantt, Synthèse. Tâches récurrentes, présentation inspirée de Tenacy dans la palette 08 : Liste, Kanban, Planning, Calendrier, fiche et historique. Réutilise les moteurs, les séries, la saisie des réalisations et les preuves existants ; les projections ne deviennent pas des occurrences indépendantes.
- **Administration → Apparence**, destination `admin-appearance`, `adminView: 'appearance'` : aperçu local, bouton « Enregistrer pour tous », état non enregistré, erreur et succès réels. Seuls les administrateurs écrivent ; tous les utilisateurs de l’instance reçoivent le style sur tous leurs appareils.
- Persistance SQLite de configuration, lecture authentifiée `GET /api/appearance`, écriture administrateur `PUT /api/admin/appearance`, validation serveur/CSRF, révision optimiste, conflit 409 et audit. Ces endpoints sont à créer. Propagation aux sessions actives sous 30 secondes, sans rechargement ni perte de formulaire. `localStorage` seul est insuffisant. Gère migrations, redémarrage, réseau indisponible, réponses obsolètes et aperçu concurrent.

## Contraintes impératives

**Ne modifie ni l’interface ni le fonctionnement des cartographies.** Ne touche pas `modules/carto-core.js`, `modules/carto-ui.js`, `modules/carto.css`, `legacy_cartography.py`. Exclue complètement du nouveau thème `ui.tab === 'carto'` et `ui.tab === 'dash' && ui.dashView === 'map'` : aucun héritage de couleur, police, en-tête, offset ou dimension. La restriction vaut aussi à la réception d’une nouvelle préférence globale. Capturer puis vérifier les trois routes avant/après et leurs interactions. La matrice du registre des risques est un écran distinct.

Conserve HTML/CSS/JS, serveur Python et SQLite, les bibliothèques locales, rôles, périmètres, sessions, files d’écriture, contrôles lecteurs et conflits. Pas de React/Vite/Tailwind, CDN ou nouveau backend. La migration minimale et les changements serveur nécessaires au réglage global sont autorisés ; ne modifie pas les schémas métier. Préserve les liens bidirectionnels risque–Annexe A ISO 27001:2022 et les évaluations/décisions immuables. Les chiffres des aperçus sont fictifs, jamais des constantes à copier.

Conserve toutes les fonctions de compte, recherche, sauvegarde, notifications, import/export, filtres et dialogues. Utilise le registre réel `LegacyIntegrationUI.toolkit.api().astra.navigation()` ; référence 24 rubriques / 100 destinations, plus Apparence, à réconcilier avec le HEAD courant. Borner tous les styles au nouvel attribut ; ne pas copier brute la CSS d’injection des captures. Garder le lien `https://www.normand-esante.fr/` ouvert uniquement sur clic et le fonctionnement avec ressources locales.

## Exécution et livraison

Avance jusqu’à l’intégration et à la vérification complètes : inspecte, implémente, teste et corrige les régressions introduites. Exécute les tests pertinents et la recette du dossier, notamment droits API, migration, deux sessions indépendantes, changement de style pendant un formulaire et conservation des cartes. Ne déclare pas un contrôle réussi sans l’avoir exécuté.

Livre un diff ciblé, le SHA, les résultats réels, une nouvelle série de captures de l’application intégrée dans `samples` et le ZIP via le script de packaging existant. Préserve toutes les images historiques. Publication uniquement sur **ta propre branche dédiée**, identité de commit anonyme prévue, message `[skip ci]`. Ne déploie pas, ne lance pas de CI, ne fusionne pas, ne force-pousse pas et ne modifie aucune autre branche. Si un accès indispensable bloque réellement, décris précisément le blocage et les travaux achevés.
