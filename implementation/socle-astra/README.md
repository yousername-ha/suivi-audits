# Dossier d’implémentation consolidé — référence 08

**Version courante du 13 octobre 2026, branche `legacy`.** Base inspectée : `b8ff86126f70114ba3bb7e32a4552fbefd3b7b04`.

Ce dossier est le point d’entrée pour implémenter la refonte. Il remplace les prescriptions contradictoires des séries 09, 12 et 13, retrouvables dans l’historique Git. La référence visuelle est la **série 08** ; les **30 vues de la série 14** en donnent la déclinaison. Le thème et le réglage global restent à intégrer dans le code.

## Lire et utiliser

1. [Dossier d’implémentation](DOSSIER-IMPLEMENTATION.md) : décisions, palette, écrans, récurrences, administration globale, architecture et invariants.
2. [Inventaire des menus](INVENTAIRE-MENUS.md) : 100 destinations existantes à préserver, plus Apparence à ajouter.
3. [Recette de réalisation](RECETTE.md) : contrôles à exécuter sur la future implémentation.
4. [Prompt complet à copier](PROMPT-IMPLEMENTATION.md).

## Références visuelles

- [Image de référence 08](../../references/style-08/02-turquoise-assombri.png).
- [30 vues, galerie et liste](../../references/vues-modules/README.md).
- [Planche des 30 vues](../../references/vues-modules/PLANCHE-CONTACT.jpg).
- [Plans d’action : exemple Kanban](../../references/vues-modules/images/021-actions-kanban.png).
- [Tâches récurrentes : liste](../../references/vues-modules/images/026-recurring-list.png) et [fiche / historique](../../references/vues-modules/images/030-recurring-fiche-historique.png).

## Corrections consolidées

- Série 08 rétablie comme référence, couleurs et composition alignées avec la série 14.
- Pictogrammes et icône active turquoise conservés ; dépli/repli par chevrons à droite, selon la capture annotée du 13 octobre. Cette précision prévaut sur la navigation visible dans la série 14.
- Matrice des risques corrigée : cellules pleines vert/jaune/orange/rouge, sélection bleue et panneau latéral ; la dernière capture utilisateur prévaut sur la vue 03 de la série 14 (§ 4 bis du dossier).
- Deux styles conservés, choisis par un administrateur **pour tous les utilisateurs**, avec persistance serveur et synchronisation.
- Six vues Actions et cinq vues Récurrences explicitement couvertes, sans inventer de fonctions Tenacy absentes.
- Évolution serveur limitée à la configuration d’apparence désormais prévue ; fin de l’ancienne interdiction générale de modification serveur pour cette fonction.
- Cartographies strictement exclues, même lors d’un changement de style global.

Cette série ne contient pas de nouveaux aperçus ni de code applicatif. Les anciennes livraisons restent récupérables dans l’historique Git. Les tests de recette sont à exécuter lors de l’implémentation ; ils ne sont pas présentés comme passés par cette livraison documentaire.
