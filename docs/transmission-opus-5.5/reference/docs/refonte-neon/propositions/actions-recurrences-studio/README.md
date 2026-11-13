# Actions et tâches récurrentes — proposition Studio

> Ajustement du 10/11/2026 : **la Timeline devient la vue par défaut**, à la demande explicite « La vue Time Line est la plus importante , elle devient la vue par défaut ». Le choix est acquis pour les plans d’action et les occurrences récurrentes ; ne pas demander de le choisir à nouveau. La finition de la refonte reste proposée avant intégration. Les [nouveaux visuels](#timeline-principale--visuels-actualisés) et leur reçu remplacent la liste comme présentation d’ouverture. Les rendus et contrôles de la première proposition ci-dessous restent historiques (`247dd72`). Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

10/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Proposition visuelle à valider avant intégration**, à la demande « Refonte des taches récurrente et plans d actions ». La charte reprend les surfaces claires et bleu nuit, les contours visibles, les angles biseautés, les accents bleu/vert/orange/rouge et le relief court des lots précédents. Le violet reste limité à la récurrence et à l’identité du menu. Les états sont remplis, les lueurs restent discrètes et les intitulés conservent une typographie de texte, sans effet de lien hypertexte.

L’application reste au commit applicatif PESTEL `5dd1c68350730f6a59ff204a5e721a482b3125eb`, inclus dans le dernier ZIP Docker livré depuis `b9d08b578eca91fdf1d2c7ec9daa16e16a66a117`. Aucun fichier applicatif, dépendance, base ou configuration Docker modifié. Aucun build ni test applicatif lancé pour cette proposition. **Aucun nouveau ZIP Docker.** Les accords SWOT et PESTEL précédents restent acquis ; cette proposition ne suppose pas celui des autres rubriques Organisation.

## Timeline principale — visuels actualisés

La maquette ouvre maintenant **Timeline** en premier dans les deux rubriques, lors d’un accès direct sans vue explicitement choisie, d’un rechargement et d’un changement de rubrique. Le bouton passe en première position avec la mention Par défaut. La liste compacte et les quatre autres vues restent accessibles ; les séries gardent leur registre distinct. Le retour des séries aux occurrences retrouve la vue sélectionnée.

La frise reprend la représentation de l’application existante, lue dans `apps/web/src/grc/Timeline.tsx` : périodes du début à l’échéance pour les actions, repères datés pour les occurrences, contour rouge pour le retard, résultats OK/KO/NA séparés. La finition proposée regroupe les occurrences par série pour éviter de répéter leur intitulé ; chaque occurrence reste un bouton distinct et nommé, avec sa date et sa validation.

Les dalles de chiffres sont compactées et le bandeau de synthèse devient repliable afin de remonter la frise. Les mois, semaines, week-ends et la ligne Aujourd’hui donnent les repères de lecture. Les échelles 2 semaines, 6 semaines et 3 mois, les périodes précédente/suivante, Aujourd’hui et Tout afficher sont interactifs dans la maquette. Une barre partiellement visible est bornée au cadre ; les éléments hors période, sans date ou à dates incohérentes restent accessibles dans des zones distinctes, sans correction ni date inventée.

Un clic ou Entrée ouvre le détail dans la Timeline, sur toute sa largeur ; Replier restitue le focus au repère. Les repères concomitants occupent plusieurs niveaux, avec une hauteur naturelle et sans barre de défilement intérieure. Une occurrence KO ne devient pas une occurrence en retard. Aucune nouvelle occurrence n’a été générée pour illustrer la répétition.

| Timeline | Clair HD | Sombre HD |
| --- | --- | --- |
| Plan d’actions | [Image complète](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/timeline-actions-light-hd.png) | [Image complète](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/timeline-actions-dark-hd.png) |
| Occurrences récurrentes | [Image complète](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/timeline-recurrences-light-hd.png) | [Image complète](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/timeline-recurrences-dark-hd.png) |

Quatre captures natives de 3 840 px de large ; [manifeste](captures-timeline.json). Elles utilisent le même jeu fictif que la proposition initiale. La vidéo de la première proposition, plus bas, décrit la version antérieure à cette priorité donnée à la Timeline.

[Contrôles de cet ajustement](controles-timeline.json) : **51 dispositions et 14 analyses Axe de `main`, sans violation détectée** ; aucun débordement horizontal, défilement vertical intérieur, repère coupé ou chevauchement de repères détecté dans les zones contrôlées. Les deux thèmes, six largeurs de 390 à 1 920 px, détail déplié, zoom, navigation, synthèse ouverte, accès initial/rechargement/changement de rubrique, filtres, validation en mémoire et retour clavier sont contrôlés. Les cas simulés incluent les dates absentes/inversées et douze occurrences à la même date, hors des captures publiques. Aucune erreur JavaScript, requête API ou externe observée. Les contrôles de la première proposition restent attribués à leur version ; aucun test applicatif n’a été exécuté ici.

À l’intégration autorisée après retour sur la refonte, utiliser Timeline comme vue d’entrée et préserver une vue explicitement demandée dans l’adresse, les filtres, données, droits et parcours existants. Aucune politique publiée ni préférence stockée n’a été réécrite dans cette maquette. Les autres finitions proposées ne sont pas déclarées validées par cette seule consigne de vue par défaut.

## Plan d’actions

- Quatre dalles compactes : actions, actions ouvertes, retard et responsable non attribué. Le bandeau d’échéances distingue les échéances dépassées, les sept prochains jours et la suite ; l’anneau représente seulement le nombre d’actions terminées.
- Registre en lignes compactes, titres à gauche et colonnes centrées, référence, plan, priorité, responsable et désignation, échéance, état et bouton de dépliage.
- État et retard distincts : une action « En cours » conserve cet état lorsque son échéance devient rouge. Les alertes associent texte, pictogramme et couleur.
- Dépliage sur toute la largeur, trois sections : réalisation, liens/dépendances et justification/documents. Aucun panneau à défilement intérieur.
- Recherche, filtres par plan/responsable/état, raccourcis retard/sept jours/bloquées et affichage des actions closes.

## Tâches récurrentes

- Deux entrées complémentaires : **Occurrences** et **Séries**. L’affichage des réalisations reste distinct de la définition de la répétition.
- Les dalles distinguent séries actives/en pause, occurrences ouvertes, retard et résultat KO. Le bandeau présente les échéances ouvertes et les résultats OK/KO/NA séparés.
- Lignes des occurrences : référence de série, périodicité, responsable, échéance et état/résultat. Une occurrence validée KO est mise en rouge sans être indiquée en retard.
- Lignes des séries : périodicité, rappel, responsable, prochaine occurrence déjà présente dans le jeu et état actif/en pause. Une prochaine échéance absente n’est pas inventée.
- Le dépliage montre heure/fuseau, fenêtre autour de l’échéance, jours et dates exclus, rappel, références et preuve. La validation propre à chaque occurrence reste visible.

La liste compacte, le Kanban, le calendrier, la Timeline, le planning/Gantt et la synthèse sont accessibles pour les actions et occurrences. Sur petit écran, le calendrier et le planning ont une lecture en agenda, sans graphe réduit à des textes illisibles ni défilement horizontal imposé. Les séries utilisent leur liste dédiée. Les survols et le focus donnent du relief ; une rotation lente du pictogramme de récurrence et la respiration des alertes disposent d’une pause et respectent la réduction des mouvements.

## Maquette et médias

Ouvrir [index.html](index.html) par un serveur statique, à la racine `docs/refonte-neon/propositions` ou au-dessus. Le fichier de police local des propositions Organisation est réutilisé ; aucun service distant, aucune API et aucune dépendance ajoutée.

| Vue | Clair HD | Sombre HD |
| --- | --- | --- |
| Plan d’actions | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/actions-light-hd.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/actions-dark-hd.png) |
| Occurrences récurrentes | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/recurrences-light-hd.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/recurrences-dark-hd.png) |
| Séries récurrentes | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/series-light-hd.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/series-dark-hd.png) |

[Vidéo des interactions](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-recurrences-studio/actions-recurrences-studio.mp4) : filtres, dépliage d’action, occurrences KO, lecture des séries et de leur fenêtre, passage au thème sombre et relief au survol. Enregistrement natif simplement recadré, sans retouche graphique. [Validation de lecture](validation-video.json) et [manifeste des médias](captures.json).

Six images complètes de 3 840 px de large, à échelle native ×2. Les autres rendus de recette restent privés pour ne pas multiplier les livrables.

## Données et interactions

**Jeu entièrement fictif et créé pour la maquette** : huit actions réparties dans trois plans, six séries dont cinq actives, huit occurrences dont quatre ouvertes et quatre validées (deux OK, une KO, une NA). Situation figée au 10 novembre 2026. Les noms de responsables désignent uniquement des fonctions ou un groupe fictif.

Les compteurs, barres et pourcentage sont calculés à partir de ces seuls éléments, sans courbe historique, score de conformité ni prédiction. Les dalles portent sur le jeu du périmètre ; les compteurs de registre et la vue Synthèse suivent les filtres.

Les modifications, la mise en pause et la validation sont illustratives, en mémoire ; recharger restitue le jeu initial. Le bouton de création prépare seulement une intention de fiche, sans fabriquer d’objet applicatif. L’historique n’est pas peuplé de faux événements. Ces limites sont affichées au moment de l’interaction concernée.

## Contrôles de la maquette

[Reçu détaillé](controles-maquette.json), exécuté avec Node 26.13.0 et Chromium système sur un serveur statique local. Aucun test de l’application n’est attribué à ce travail.

- 106 dispositions contrôlées : 390, 768, 1 024, 1 280, 1 440 et 1 920 px, les deux thèmes, les trois registres, détails dépliés et les six vues. Aucun débordement horizontal ni défilement vertical intérieur détecté dans les zones contrôlées.
- 38 analyses Axe de `main` sur les versions ordinateur, mobile, dépliées et les vues complémentaires : aucune violation détectée au passage final.
- Recherche, filtres rapides, responsable non attribué, réinitialisation et éléments clos vérifiés ; KO distinct du retard, validation en mémoire, mise en pause d’une série, menu mobile et pause/reprise/réduction des animations contrôlés.
- Aucun appel API, requête externe ou erreur JavaScript observé dans les parcours contrôlés. Les ressources statiques et la police locale sont les seules lectures réseau.
- Lecture Chromium de la vidéo vérifiée ; dimensions, empreintes et tailles dans le manifeste.

Les premiers passages ont corrigé le contexte explicite requis par l’outil Axe, puis la cible du commutateur des éléments clos et le rôle du SVG interactif du planning. Les assertions n’ont pas été retirées ; le reçu final porte sur les sources corrigées.

## Points à conserver à l’intégration après accord

Lecture préalable de `apps/web/src/pages/Pilotage.tsx`, `grc/Tasks.tsx`, `grc/Timeline.tsx`, `grc/PlanningSerie.tsx`, `grc/etat-action.ts`, `pilotage/Registry.tsx`, des validations d’occurrence et des schémas partagés. L’actuelle vue des tâches est commune aux deux rubriques : conserver l’accès partagé aux registres autorisés pendant la séparation visuelle des séries et occurrences.

Réutiliser les états publiés de la politique, responsables personne/groupe/fonction, registres, droits, filtres dans l’URL, chargement paginé, mois, jours fériés/fermetures, dépendances, fenêtres, exclusions, iCalendar, preuves, historique, enchaînement et refus serveur existants. Aucun identifiant ou état de la maquette ne devra devenir une nomenclature imposée. Les formulaires complets et leurs contrôles restent à porter dans la charte ; le petit éditeur illustratif n’en est pas un remplacement.

**Prochaine action : retour visuel du demandeur sur ces deux rubriques.** Après accord explicite : intégration, contrôles pertinents, captures de l’application et ZIP Docker actualisé. Les tests applicatifs, recette Docker Windows, CI, déploiement et publication n’ont pas été exécutés pour ce lot ; aucun push.
