# Décisions et état réel

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

## Acquis à conserver

| Partie | Décision / comportement |
| --- | --- |
| Charte | Neon Studio, deux thèmes, biseau, relief et animations maîtrisés. Éviter l’excès de violet et les lueurs diffuses ; pas de rose pour les états rouges. La source et les derniers visuels validés font foi sur les nuances. |
| Fenêtres | Même famille graphique ; fiche de lecture distincte de l’édition. Hauteur naturelle, sans petit ascenseur intérieur imposé à une fiche longue ; défilement du voile extérieur. |
| Contexte | Distinguer enjeux internes, enjeux externes, interfaces et dépendances. Présentation propre pour l’auditeur, puces et rubriques explicites. |
| Périmètres | Graphe par défaut, centré ; cartes compactes repliées ; « + » centré en bas ; ouverture en rectangle avec extension en largeur. Aucun ascenseur dans la carte. |
| Objectifs / indicateurs | Vue compacte par défaut. Proportions de la version B, intitulés et colonnes alignés, cible violette, valeurs et états colorés. L’alerte Non atteint et les flèches ont été demandées **animées**, pas supprimées. |
| DdA | Mesures en lignes adaptées au nombre, dalles de scores conservées. Choix Applicable et Mise en œuvre colorés, remplis, cliquables, avec menu sans petite flèche imposée. Conserver la finition claire et sombre intégrée. |
| Référentiels | Habillage Studio intégré, à préserver dans la révision des proportions. |
| SWOT | Dernier modèle retenu ; processus au centre, cercle agrandi et centré sans chevaucher les textes ; panneaux au survol et animations. Rattachement aux processus conservé. |
| PESTEL | Constellation et lecture des facteurs intégrées, relations aux processus et distinction des données conservées. |
| Actions / récurrences | Timeline par défaut ; orange À faire et occurrences en attente animés. Pause et réduction des mouvements conservées. |
| Échelle des récurrences | Auto selon la périodicité, choix journalier / hebdomadaire / mensuel / annuel, calendriers réels et éléments hors période accessibles. |
| Repères Timeline | Petite fenêtre de résultat, commentaire et preuve. Actions : OK/KO ; occurrences : OK/KO/NA. Respect du journal, des réouvertures et des droits. |
| Registres | Ouverture depuis toute la ligne, clavier et retour du focus ; boutons/liens/champs imbriqués indépendants. Lignes compactes et zone de défilement limitée à la liste. |
| Budget / CRRC | Retirés de l’interface ; anciennes données, permissions historiques et exports conservés. Aucun nettoyage de base à faire. |
| Docker interfaces | Ouverture directe avec données fictives pour cette copie de test uniquement. Le profil normal conserve son authentification. |

Le code de la livraison `23b33b5` contient ces intégrations. Les rapports détaillés se trouvent dans ses `docs/refonte-neon/`, notamment `LIGNES-ET-VALIDATION-RAPIDE.md`, `TIMELINE-STUDIO-INTEGREE.md`, `SWOT-CENTRE-AGRANDI-INTEGRE.md`, `PESTEL-STUDIO-INTEGRE.md` et `DDA-STUDIO-INTEGREE.md`.

## Nouvelle finition encore proposée

La proposition `commandes-discretes` ajoute six vues en icônes, une loupe, un panneau de filtres et les critères actifs sous forme de pastilles. Le demandeur a ensuite signalé que les éléments étaient trop petits.

La proposition `responsive-equilibre` augmente la lecture utile, utilise la largeur du registre et adapte la hauteur, le menu et les commandes. Les dernières priorités sont **PC** et préparation du dossier pour Claude. Ces nouvelles images n’ont pas reçu de validation explicite d’intégration dans la conversation.

## Ce qui reste à faire

- Valider la finition PC des proportions et des commandes, puis l’intégrer dans les composants réels.
- Auditer les surfaces de toute l’application avec ces règles ; ne pas se limiter à modifier le `font-size` de la racine.
- Revoir les autres rubriques qui n’ont pas reçu de refonte dédiée. Ne pas présenter Parties intéressées et tous les menus Organisation comme déjà terminés.
- Rejouer les contrôles appropriés après intégration et produire les captures de l’application.
- Effectuer la recette du demandeur sous Docker Desktop Windows ; elle n’a pas été exécutée dans cet environnement Linux.

Aucune nouvelle publication GitHub, fusion ou mise en production n’a été faite pour le lot responsive.
