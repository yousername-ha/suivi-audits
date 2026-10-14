# 30 vues à valider — style de référence 08

**13 octobre 2026 · Branche `legacy` · Référence applicative `ae11bac6d8398cd145951f0d93492c85a857e367`.**

La [série 08](../2026-10-12-astra-08/02-turquoise-assombri.png) est la référence visuelle explicitement retenue. Son README confirme désormais ce choix.

**Cette livraison sert à valider le rendu avant de refaire le dossier d’implémentation.** 30 PNG distincts, en 1600 × 1100 px, transposent le vert profond, le fond clair chaud, les accents turquoise et la signature Normand’e-Santé sur les vues réelles. La disposition des modules est adaptée à leur contenu : ce ne sont pas des copies pixel à pixel du cockpit de référence.

- [Planche d’ensemble des 30 vues](PLANCHE-CONTACT.jpg).
- [Galerie hors ligne avec recherche](index.html) : télécharger le ZIP, l’extraire puis ouvrir `index.html`.
- **Plans d’action : vues 20 à 25** — Liste, Kanban, Planning, Calendrier, Gantt, Synthèse.
- **Tâches récurrentes : vues 26 à 30** — Liste, Kanban, Planning, Calendrier, fiche et historique.

## Les 30 images

| N° | Vue | Image originale |
| --- | --- | --- |
| 01 | Cockpit RSSI — Synthèse | [Ouvrir](images/001-dash-dash.png) |
| 02 | Risques et études — Registre central | [Ouvrir](images/002-risks-risk-register.png) |
| 03 | Risques et études — Matrice des risques | [Ouvrir](images/003-risks-risk-map.png) |
| 04 | Risques et études — Études EBIOS RM | [Ouvrir](images/004-risks-risk-studies.png) |
| 05 | Conformité et applicabilité — Clauses ISO 27001 | [Ouvrir](images/005-compliance-iso.png) |
| 06 | Conformité et applicabilité — Annexe A (DdA) | [Ouvrir](images/006-compliance-ann.png) |
| 07 | Programme CaRE — Tableau de bord | [Ouvrir](images/007-care-df-care-dash.png) |
| 08 | Qualité · HAS — Tableau de bord | [Ouvrir](images/008-has-df-has-dash.png) |
| 09 | Gestion de l'audit — Pronostic 2027 | [Ouvrir](images/009-audit-cibles.png) |
| 10 | Preuves et justificatifs — Registre des preuves | [Ouvrir](images/010-proofs-prv-reg.png) |
| 11 | PCRA · continuité et reprise — Vue d’ensemble | [Ouvrir](images/011-pcra-pcra-dashboard.png) |
| 12 | PCRA · continuité et reprise — Analyses d’impact · BIA | [Ouvrir](images/012-pcra-pcra-bias.png) |
| 13 | Périmètres — Organisations et établissements | [Ouvrir](images/013-perimeters-perimeter-registry.png) |
| 14 | Fournisseurs et accès — Fournisseurs et applications | [Ouvrir](images/014-suppliers-sup.png) |
| 15 | Administration — Vue d’ensemble | [Ouvrir](images/015-admin-admin-overview.png) |
| 16 | Programmes du SMSI — Formation | [Ouvrir](images/016-programs-pl-formation.png) |
| 17 | Incidents et crise — Registre | [Ouvrir](images/017-ops-inc-reg.png) |
| 18 | Gouvernance de l’IA — Registre des usages | [Ouvrir](images/018-ai-reg.png) |
| 19 | Contexte et parties intéressées — Parties intéressées | [Ouvrir](images/019-context-ctx-pi.png) |
| 20 | Plans d’action — Liste | [Ouvrir](images/020-actions-list.png) |
| 21 | Plans d’action — Kanban | [Ouvrir](images/021-actions-kanban.png) |
| 22 | Plans d’action — Planning | [Ouvrir](images/022-actions-planning.png) |
| 23 | Plans d’action — Calendrier | [Ouvrir](images/023-actions-calendar.png) |
| 24 | Plans d’action — Gantt | [Ouvrir](images/024-actions-gantt.png) |
| 25 | Plans d’action — Synthèse | [Ouvrir](images/025-actions-summary.png) |
| 26 | Tâches récurrentes — Liste | [Ouvrir](images/026-recurring-list.png) |
| 27 | Tâches récurrentes — Kanban | [Ouvrir](images/027-recurring-kanban.png) |
| 28 | Tâches récurrentes — Planning | [Ouvrir](images/028-recurring-planning.png) |
| 29 | Tâches récurrentes — Calendrier | [Ouvrir](images/029-recurring-calendar.png) |
| 30 | Tâches récurrentes — Fiche et historique | [Ouvrir](images/030-recurring-fiche-historique.png) |

## Périmètre de validation

Valider les couleurs, la barre latérale, l’en-tête, la lisibilité des tableaux, cartes, plannings et fiches. Les données sont fictives. Quelques modules montrent leur état vide réel pour examiner aussi ce cas. L’inspiration Tenacy porte sur la lecture des activités, les filtres, les responsables et les échéances ; cette proposition ne revendique pas une reproduction exacte d’un écran privé Tenacy. Référence publique consultée : https://www.tenacy.io/solutions.

Le module de cartographie dynamique est exclu des captures et de l’habillage. La « Matrice des risques » (vue 03) appartient au registre des risques, distinct du module cartographique protégé.

Le choix de style global par l’administrateur pour tous les utilisateurs reste prévu conformément à la demande précédente. La vue 15 montre l’administration existante, pas un sélecteur global déjà intégré. Le dossier et le prompt d’implémentation ne sont pas réécrits dans cette livraison.

## Contrôles effectués

30 images lisibles et distinctes, intégrité SHA-256, aucun débordement global mesuré à 1600 px, aucun message d’erreur JavaScript ni requête HTTP externe pendant les captures. Vues actives vérifiées pour les plans d’action et les récurrences ; présence de l’historique vérifiée dans la fiche. Application servie sur localhost avec base temporaire. Aucun fichier applicatif modifié ; seul le dossier `samples` est publié.

Les captures montrent le premier écran de chaque vue ; elles ne représentent pas nécessairement tout le contenu défilant. Ces contrôles visuels ne constituent pas une nouvelle recette métier, responsive complète, accessibilité ou cartographie. Les réalisations récurrentes restent historiques et les dates futures sont des projections du moteur existant.

Les fichiers de `technique/` reproduisent l’habillage en mémoire uniquement. L’historique des séries précédentes est conservé.
