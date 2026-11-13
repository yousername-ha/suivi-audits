> **Suite du 12/11/2026 : variante [icônes colorées, dégradé et animation légère](../menu-couleurs-degrade/README.md)** à la demande du demandeur. Aucune validation de l’ancienne proposition ni intégration du menu déduite de cette demande d’ajustement ; ce dossier reste le comparatif précédent.

# Menu latéral — version finale proposée

12/11/2026 (Europe/Paris). **Menu final préparé pour validation, pas encore intégré.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur rouvre explicitement le travail sur la navigation : « Je veux le menu définitif ». La demande concerne une sidebar unique sur toute la plateforme. Elle remplace la mise de côté précédente comme objectif actif ; elle n’autorise pas à confondre les visuels de bibliothèque/assistant déjà validés avec une validation de ce nouveau menu.

[Clair HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-final/menu-clair-hd.png) · [Sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-final/menu-sombre-hd.png) · [Aperçu autonome](apercu-autonome.html).

## Version préparée

Fond blanc en clair, bleu nuit en sombre ; sélection cyan/bleu, typographie et proportions communes. Présentation sobre proche du Dashboard initial, sans grandes plaques d’icônes ni animation permanente. Les libellés longs reviennent à la ligne sans être tronqués. Une famille dépliée à la fois, repères distincts de famille et destination active, défilement du menu seulement en fenêtre basse.

Sept familles dans l’ordre existant : Organisation (8 destinations), Pilotage (5), Risques (1), Conformité et audits (4), Actions (4), Résilience (2), Documents (2). Bibliothèque et couverture restent réunies. Budget/CRRC et les six rubriques de référentiels retirées restent masqués.

Le décor de démonstration montre aussi Plateforme, Configuration système, Mon compte, Guide d’utilisation et Écran mural, puis la signature et la commande de thème. Dans l’application, droits et configuration continuent à déterminer ces accès ; « Mes contributions RETEX » doit rester affiché uniquement aux personnes invitées, comme aujourd’hui. La démonstration ne simule pas une invitation réelle.

## Résumé technique pour une IA connaissant le code

- Dossier autonome `index.html`, `menu.css`, `menu.js`, `exporter.py` et export embarquant la police. Départ : proposition `menus-harmonises`, reprise sans le menu à plaques dont la demande concernait en réalité la bibliothèque. Contenu de bibliothèque déjà validé utilisé uniquement comme contexte visuel.
- Style de navigation indépendant de la destination ; aucune condition `.shell:has(.dda-module/...)` dans la maquette. Les onglets internes et commandes de vues sont hors de ce lot.
- **Après validation** : conserver `components/Layout.tsx`, `navigation.ts`, ordre enregistré, `useTriMenu`, libellés d’alertes, droits/modules, destinations, liens et retour du focus. L’ID réel de la bibliothèque reste `referentiels` pour la compatibilité des préférences. Ne pas porter les tableaux statiques du script de démonstration dans l’application.
- Centraliser l’habillage de `.shell-nav` et retirer les seules surcharges conditionnelles de sidebar de `neon-dda.css`. Ne pas supprimer les fonds métier, headers ou onglets présents dans la même section. Les pages doivent ensuite partager le même menu dans chacun des thèmes.
- Conserver le menu en icônes/tiroir et les préférences d’affichage existants là où ils s’appliquent ; ne pas changer la largeur des canevas de cartographie ni réserver de nouvelle marge à ses objets. Génération automatique et disposition inchangées.
- [Bibliothèque Studio et Assistant Neon sont portés dans un lot validé distinct](../../BIBLIOTHEQUE-ASSISTANT-NEON-INTEGRES.md). Aucun nouveau style du menu n’est importé dans ce lot applicatif.

## Vérifications de maquette

18 comparaisons (9 contextes × 2 thèmes) : même fond, couleur, bordure, largeur et police dans chaque thème. 16 dispositions PC de 1024×768 à 2560×1440, dont 1920×800 ; aucun débordement de page/menu mesuré. Six analyses Axe sur Bibliothèque/DDA/Objectifs clair/sombre sans violation détectée ; pas une certification complète d’accessibilité.

Structure contrôlée : 7 familles, 26 destinations, 5 entrées de compte/administration illustratives, famille dépliée unique, destination active, thème depuis le pied de menu et absence de Budget/CRRC. Aucun appel API, ressource distante ou erreur JavaScript. Deux captures natives 3840×2160 ; ESLint et format ciblés réussis. Résultats et empreintes dans [controles.json](controles.json).

Les tests/build applicatifs de cette reprise concernent les habillages Bibliothèque/Assistant **déjà validés**. Le menu reste une maquette ; intégration/tests applicatifs de son harmonisation, DB/Docker et déploiement non exécutés. Aucun ZIP.

Une demande de validation asynchrone accompagne les visuels. Aucune réponse positive n’est déduite du temps écoulé. Suite : appliquer la réponse du demandeur, puis porter le menu s’il le valide, selon [AGENTS.md](../../../../AGENTS.md) : « Présenter d’abord une proposition visuelle isolée et attendre sa validation explicite. »
