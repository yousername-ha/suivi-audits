# Timeline — nouvelle proposition Studio

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

> Ajustement du 11/11/2026 — **récurrences animées et échelle adaptative** à la demande « Idem pour tâche récurrente. D’ailleurs la vue Time Line s ajuste en taille en fonction de si je met journalier. Hebdomadaire, mensuel, annuel. ». Le mode Auto suit la périodicité de la série sélectionnée ; les quatre échelles restent choisissables. Les badges orange « en attente » rejoignent l’animation des repères, sans modifier l’état d’une occurrence. [Nouveaux visuels et vidéo](#récurrences--échelle-adaptative). Maquette avant intégration, Timeline par défaut maintenue. Les contrôles et médias des étapes antérieures ci-dessous restent historiques. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

> Ajustement demandé le 11/11/2026 : les **oranges « À faire » sont animés**, avec une pulsation douce du contour et du halo sur les badges, rubans et repères d’occurrences en attente. Le texte, les dates et la géométrie restent stables ; les résultats validés ne prennent pas cette animation. Pause/reprise et réduction des mouvements conservées. [Vidéo clair/sombre](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/animation-a-faire.mp4), [contrôles ciblés](orange-motion.json) et [lecture vidéo](validation-video-orange.json). Quatre dispositions ordinateur/mobile et les états d’animation vérifiés ; les contrôles généraux ci-dessous restent attribués à la proposition initiale. Maquette seulement, aucun code/test applicatif ni nouveau ZIP. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Nouvelle proposition visuelle, à évaluer avant intégration**, après « Ça manque un peu de travail et de style comme pour le swot et pestel » puis « Reprend ». Elle succède à la [première Timeline](../actions-recurrences-studio/README.md#timeline-principale--visuels-actualisés) (`9d73943`), conservée avec ses preuves. Le choix explicite de **Timeline par défaut pour les actions et les occurrences est acquis** ; il est maintenu et n’est pas à redemander.

L’application reste à l’intégration PESTEL `5dd1c68350730f6a59ff204a5e721a482b3125eb`. Aucun fichier `apps/`, `packages/`, script d’exploitation, schéma, dépendance, politique publiée, préférence stockée ou source Docker modifié. Aucun build ni test applicatif lancé pour ce lot. Le dernier ZIP Docker PESTEL reste celui livré depuis `b9d08b5` ; aucun nouveau ZIP. Les validations SWOT et PESTEL restent acquises, indépendamment de cette nouvelle proposition.

## Récurrences — échelle adaptative

Le sélecteur **Série à suivre** conserve les séries existantes, leurs périodicités et leur état. En mode **Auto**, la frise choisit l’échelle de cette série, y compris lorsqu’elle est en pause et n’a pas d’occurrence. Avec Toutes les séries, elle utilise la périodicité la plus fine des séries des occurrences filtrées. Une modification de la périodicité dans les données de maquette est répercutée à la prochaine lecture. L’échelle peut aussi être choisie directement :

| Périodicité / échelle | Repères | Horizon initial |
| --- | --- | --- |
| Journalier | Jours | 14 jours |
| Hebdomadaire | Semaines ISO | 12 semaines |
| Mensuel | Mois calendaires | 12 mois |
| Annuel | Années calendaires | 5 ans |

Les repères, grilles, libellés et positions sont recalculés ; les dates et occurrences restent celles du jeu. Les mois et années conservent leur vraie durée, années bissextiles incluses. Les week-ends ne sont tracés que sur les échelles journalière et hebdomadaire. La taille des lignes augmente uniquement lorsque les repères proches demandent plusieurs niveaux, sans défilement intérieur. Le cercle de date est borné graphiquement près des bords pour garder les textes lisibles ; la ligne Aujourd’hui et les positions des échéances gardent leur échelle réelle.

Navigation précédente/suivante, Aujourd’hui et Tout afficher suivent l’échelle. Les éléments hors période restent accessibles et Tout afficher les replace sans générer de nouvelles occurrences. Le sélecteur et les commandes restent disponibles lorsque le résultat est vide. La série annuelle du jeu fictif est **en pause et sans occurrence** : cet état est indiqué explicitement, sans inventer de contrôles futurs ou réalisés.

Les **repères et badges orange de validation en attente** ont la même pulsation que les À faire, avec texte et géométrie stables, pause/reprise et réduction des mouvements. En attente de validation ne remplace pas l’état de l’action ; les validations OK/KO/NA et les retards restent distincts.

[Vidéo des quatre échelles et des animations](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/recurrences-adaptatives.mp4) ; [validation de lecture](adaptive-video-validation.json) ; [manifeste](adaptive-captures.json).

- [Journalier — clair HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/recurrences-day-light-hd.png).
- [Hebdomadaire — clair HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/recurrences-week-light-hd.png).
- [Mensuel — sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/recurrences-month-dark-hd.png).
- [Annuel — sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/recurrences-year-dark-hd.png).

Quatre captures natives complètes, 3 840 px de large. Même jeu fictif, aucun objet créé et aucune occurrence générée. La vidéo fait passer Auto d’une série existante à l’autre, présente l’état annuel en pause, puis l’échelle annuelle sur toutes les séries et le thème sombre.

[Contrôles ciblés de cet ajustement](adaptive-scale-validation.json) : **32 dispositions et neuf analyses Axe de `main`, sans violation détectée** ; les deux thèmes, de 390 à 1 440 px, les quatre échelles, cinq périodicités de série (dont trimestrielle), le cas vide annuel et la fiche ouverte. Aucun débordement horizontal, défilement intérieur, chevauchement de repères ou croisement du cercle avec les libellés détecté dans les zones contrôlées. Valeurs initiales des horizons, mois et semaines, navigation calendaire, conservation des huit occurrences via la frise et la zone hors période, changement de périodicité en mémoire, Tout afficher, sélection clavier et retour de focus vérifiés. Année bissextile 2024 et durée de février contrôlées par simulation privée hors médias. Animation des badges et repères, pause/reprise/réduction et accès au Plan d’actions précédent vérifiés. Aucune erreur JavaScript ni requête externe observée ; aucune API utilisée.

La mise en œuvre reste dans les fichiers de proposition (`adaptive-scale.js`, `adaptive-scale.css`, présentation et contrôles). **Application, politiques et ZIP Docker inchangés, aucun build/test applicatif.** Le choix de Timeline par défaut est acquis ; l’accord global sur la finition et son intégration n’est pas déduit de cet ajustement.

## Direction graphique

La composition reprend les [panneaux biseautés du SWOT](../organisation-swot-centre-agrandi/README.md) et les [repères circulaires du PESTEL](../organisation-pestel-studio/README.md), dans les deux thèmes. Les surfaces sont blanches et légèrement teintées en clair, bleu nuit en sombre ; les contours restent visibles. Bleu, vert, orange et rouge portent les états ; le violet reste limité à l’identité du menu et à la récurrence dans les compteurs. Aucun rose ajouté.

- Les intitulés deviennent des **cartes biseautées**, avec pictogramme en relief, code, référence, responsable et état. Les cartes montent légèrement au survol et au focus ; la ligne correspondante se souligne.
- Le repère **Aujourd’hui** est un cercle à deux anneaux dans la frise, avec la date et le mois. Sa position est calculée sur la même échelle que les barres et occurrences. Les anneaux sont décoratifs : ils ne représentent aucun taux.
- Un cartouche de lecture distingue le nombre d’éléments visibles, plans ou séries représentés, retards et éléments terminés/validés. Les valeurs sont calculées depuis les éléments de la période filtrée.
- Les actions utilisent des **rubans en relief**, une origine circulaire et une terminaison en losange ; la période et l’échéance restent réelles dans le jeu fictif. Les retards gardent leur contour rouge sans remplacer l’état.
- Les occurrences ont des **repères en losange**, la date et le résultat ou l’attente. Une occurrence KO reste distincte d’un retard. Les occurrences d’une même série sont reliées ; aucune échéance intermédiaire ou future n’est inventée.
- Les fiches dépliées présentent trois panneaux encadrés, de petits pictogrammes et les détails sur toute la largeur. Le dépliage reste dans la page et conserve le retour de focus.
- Rotation lente des anneaux et déplacement des pointillés de liaison, pause/reprise et réduction des mouvements. Ces mouvements n’expriment pas un avancement métier. Les ombres sont courtes et les lueurs limitées aux repères et liserés.

Les dalles de chiffres restent compactes et la synthèse repliable pour donner la priorité à la frise. Liste compacte, Kanban, calendrier, planning/Gantt et synthèse restent accessibles ; les séries gardent leur vue dédiée.

## Visuels et vidéo

| Timeline | Clair HD | Sombre HD |
| --- | --- | --- |
| Plan d’actions | [Image complète](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/studio-actions-light-hd.png) | [Image complète](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/studio-actions-dark-hd.png) |
| Occurrences récurrentes | [Image complète](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/studio-recurrences-light-hd.png) | [Image complète](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/studio-recurrences-dark-hd.png) |

[Vidéo du survol, des animations et du dépliage](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/actions-timeline-studio/timeline-studio.mp4), [validation de lecture](validation-video.json) et [manifeste des médias](captures.json).

Quatre captures natives complètes de 3 840 px de large. La vidéo est un enregistrement de la maquette recadré sur son espace de travail, encodé avec conservation de la plage colorimétrique. Aucun rendu d’image générée ni retouche graphique. Les autres captures de recette restent privées.

## Données et interactions conservées

Le fichier `donnees.js` est identique à celui de la proposition précédente : **huit actions dans trois plans, six séries, huit occurrences**. Situation illustrative figée au **10 novembre 2026**, distincte de la date d’enregistrement des médias. Noms de fonctions et groupe entièrement fictifs, aucune donnée ni compte réel. Les variantes de dimensions ne servent pas de source aux captures publiques.

Les valeurs, champs, références et liens de démonstration sont conservés. Le Plan d’actions garde les échelles 2 semaines / 6 semaines / 3 mois ; les récurrences utilisent désormais les échelles adaptatives décrites plus haut. Navigation précédente/suivante, Aujourd’hui, Tout afficher, filtres, états, validation en mémoire et mise en pause d’une série restent illustratifs. Les éléments hors période, sans date ou à dates inversées restent accessibles, sans correction silencieuse. Les repères proches ou concomitants sont répartis sur plusieurs niveaux, à leur véritable position horizontale dans l’échelle.

Les consultations et interactions n’utilisent aucune API. Recharger restitue le jeu initial. Les formulaires de maquette ne remplacent pas les formulaires complets, droits, versions, historique, preuves et validations de l’application.

## Contrôles de la finition initiale

Node 26.13.0, Chromium système, serveur statique local dédié ; aucune base ni API utilisée. Rapports bruts et scripts de capture privés dans `/workspace/work/actions-recurrences-studio`.

- [51 dispositions et 14 analyses Axe de `main`](controles-studio.json), sans violation détectée au passage final : six largeurs de 390 à 1 920 px, les deux thèmes, détails, zoom, navigation et synthèse ouverte. Aucun débordement horizontal, défilement vertical intérieur, repère coupé, chevauchement de repères ou croisement du cercle avec les libellés de mois/semaines détecté dans les zones contrôlées.
- Vue Timeline par défaut à l’ouverture, au rechargement et au changement de rubrique, accès à la liste et aux séries, filtres, sélection clavier, retour de focus, fiche maintenue dans la frise, validation en mémoire et distinction KO/retard contrôlés.
- Cas simulés hors médias publics : éléments sans date ou à dates inversées et douze occurrences concomitantes. Aucun élément masqué pour faire passer les contrôles.
- Aucun appel API, requête externe ou erreur JavaScript observé dans les parcours contrôlés ; seuls les fichiers statiques et la police locale sont lus.
- [Contrôle ciblé des animations](animations.json) : actives, mises en pause, reprises et supprimées sous préférence de mouvement réduit, y compris après la commande Reprendre.
- Lecture Chromium du MP4 vérifiée ; dimensions, tailles et empreintes dans le manifeste.

Un premier passage a repéré le cercle trop proche du libellé de novembre à 1 024 px : l’espacement a été corrigé et les assertions conservées. Le contrôle ciblé de mouvement réduit a ensuite identifié que les pseudo-éléments étaient seulement mis en pause ; la règle CSS les couvre désormais explicitement. Le contrôle ciblé a été rejoué sans retirer l’assertion. Cette dernière correction ne modifie pas les dimensions ou les médias enregistrés sans réduction des mouvements.

**Non exécutés : intégration et tests applicatifs, recette Docker Windows, CI distante, déploiement ou publication. Aucun push.**

## Suite

Recueillir le retour visuel sur cette finition. Après accord explicite, intégrer le lot autorisé en réutilisant les données, états publiés, périmètres, permissions, filtres URL, pagination, dates, jours de fond, dépendances, séries, fenêtres, exclusions, iCalendar, enchaînement, validations et preuves existants ; exécuter les contrôles pertinents, puis fournir les captures de l’application et le ZIP Docker actualisé. Ne pas déduire de cette refonte un accord sur d’autres rubriques Organisation.
