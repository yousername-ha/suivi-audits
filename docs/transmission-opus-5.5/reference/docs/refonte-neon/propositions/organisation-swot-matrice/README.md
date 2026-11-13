# SWOT — proposition Matrice Studio

10/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Demande : rendre le SWOT plus dynamique et plus marquant graphiquement, en conservant la charte déjà retenue et son
rattachement aux processus. **Proposition explicitement validée par « Ok j’aime beaucoup beaucoup . Top intégre »,
puis intégrée au commit `016d69c`.** Voir le [compte rendu et les captures réelles](../../SWOT-STUDIO-INTEGRE.md).

Les sections suivantes conservent les détails de la maquette préparée avant intégration. À cette étape, application conservée à `65bd22fe510ebdda872f7e73cb2974870fd1c992` ; proposition précédente au commit `d3a4271`.
Aucun changement applicatif, API, données, dépendances ou Docker. Aucun build ni test de l’application exécuté.

## Direction proposée

- Le processus conserve sa place en tête : identité, type, pilote, choix du processus et nombre de ses analyses SWOT.
- La matrice distingue les deux axes : **interne / externe** et **favorable / défavorable**. Quatre panneaux de lecture
  entourent le repère du processus ; les liaisons représentent uniquement ce rattachement, sans dépendance ajoutée entre
  les quatre catégories.
- Cadre biseauté, panneaux opaques avec dégradés courts, bordures nettes, relief modéré et lettres SWOT en filigrane.
  Émeraude pour les forces, ambre pour les faiblesses, bleu pour les opportunités, rouge pour les menaces ; l’indigo reste
  réservé à la navigation et aux commandes de la charte Studio. Les couleurs repèrent les catégories, sans noter leur gravité.
- Pictogrammes animés et petits traits en mouvement sur les liaisons. Survol et focus clavier soulignent le panneau.
  Le bouton Pause / Reprendre reste disponible ; la préférence système de réduction des animations est respectée.
- Le bouton Lire ouvre une **lecture agrandie** d’un quadrant, avec le processus et l’analyse toujours identifiés.
  L’accès à la fiche de modification reste séparé. Le repère central ouvre un résumé du processus existant.
- Les analyses rattachées restent accessibles dans une bande compacte. Sur téléphone, les panneaux s’empilent et les
  deux dimensions restent écrites sur chaque panneau. Aucune hauteur fermée ni barre de défilement interne aux panneaux.

Cette proposition ne valide ni les autres vues Organisation ni une nouvelle disposition des onglets de l’application.
[Proposition précédente avec le rattachement explicite](../organisation-contexte-studio/README.md).

## Données et limites de la maquette

Les six processus et l’unique SWOT `SW1`, rattaché à `PR2`, proviennent du jeu fictif déjà fourni. Les quatre textes de
l’analyse, sa date du 16/09/2026, son auteur et sa version 1 sont repris. La situation illustrative reste figée au 09/11/2026.
Aucune analyse supplémentaire, recommandation, évolution, pondération ou score n’est fabriqué. Choisir un processus sans
analyse donne un état vide. Changer de processus ou de thème ne modifie pas les données du jeu ; aucun enregistrement.

Les sources de présentation et de données de la proposition précédente sont réutilisées **en lecture** :
`../organisation-contexte-studio/prototype.css`, `donnees.js` et la police Inter locale avec sa licence `OFL.txt`.
Le serveur de rendu doit donc exposer le dossier parent `propositions`, pas seulement le présent sous-dossier.
Les autres onglets renvoient aux précédentes maquettes. Ces liens ne sont pas une navigation vers l’application.

Les écrans de modification, de liste et d’historique restent des illustrations, pas une recette métier. Les filtres et
recherches du registre complet, responsables réels, états, échéances, registre d’appartenance, liens et justificatifs,
historique, droits, confirmations et versions devront être conservés lors d’une intégration autorisée, avec leurs
composants et API existants. La liste compacte illustrée ne constitue pas une décision de les supprimer.
L’auteur historique ne doit pas être substitué au responsable générique de la fiche ; ce dernier n’est pas renseigné
dans l’illustration. Le rattachement doit continuer à lire le champ historique `swots.process` **et** les liens transverses
déjà pris en compte par les cartes processus. Aucun nouveau champ obligatoire ni copie des analyses dans les processus.

## Visuels natifs

| Vue | Clair | Sombre |
| --- | --- | --- |
| Page entière | [1 440 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/matrice-light-1440.png) | [1 440 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/matrice-dark-1440.png) |
| Page entière HD | [3 840 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/matrice-light-hd.png) | [3 840 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/matrice-dark-hd.png) |
| Matrice en détail | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/detail-matrice-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/detail-matrice-dark.png) |
| Lecture agrandie | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/lecture-forces-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/lecture-forces-dark.png) |
| Téléphone | [390 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/matrice-light-mobile.png) | [390 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/matrice-dark-mobile.png) |

[Animation GIF](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/animation-swot.gif) · [Vidéo MP4](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-matrice/animation-swot.mp4).

Les dix PNG sont des captures natives du prototype Chromium. La vidéo montre les animations, le survol et l’ouverture
d’un quadrant. L’enregistrement natif est simplement recadré sur la matrice, puis encodé en H.264 et en GIF : aucun élément
de l’interface n’a été ajouté ou retouché. Vidéo 1 168 × 652 px, environ 7,5 secondes. Les PNG HD servent à juger les détails
et les couleurs ; le GIF permet d’observer les mouvements. Ces visuels ne sont pas ceux d’une nouvelle intégration.

## Contrôles de la maquette

Serveur statique local : port 8134, racine `docs/refonte-neon/propositions`.
Scripts de rendu privés : `/workspace/work/organisation-contexte-studio/rendre-matrice.mjs`,
`filmer-matrice.mjs` et `verifier-animation-matrice.mjs`. Environnement Cloud Codex, Node 26.13.0, Chromium système,
FFmpeg système déjà présent. Aucune nouvelle dépendance de projet.

[Reçu des contrôles](controles-maquette.json) : 22 dispositions aux largeurs 390, 768, 1 024, 1 280, 1 440 et 1 920 px,
deux thèmes, lecture agrandie, formulaire et processus sans analyse. Aucun débordement horizontal ni défilement vertical
interne détecté dans les zones contrôlées. Six analyses Axe ciblées, sans violation détectée.
Rattachement, quatre quadrants, ouverture et retour de lecture, restauration du focus, résumé du processus, fiche,
annulation, parcours des analyses, sélection et rechargement du processus, données inchangées et commande des animations
vérifiés. Aucun appel externe, écriture HTTP ou erreur JavaScript observé.

[Validation des médias](validation-animation.json) : lecture MP4 décodée par Chromium, dimensions et durée contrôlées,
images du GIF effectivement différentes pendant sa lecture. Le premier enregistrement était bloqué par l’absence du
FFmpeg attendu dans le cache Playwright ; le FFmpeg système a été réutilisé dans un cache de travail local, sans modifier
les dépendances ni le cache utilisateur. Le rendu final tient aussi compte d’un ajustement du pied de matrice sur mobile
et d’un survol neutralisé pour les captures fixes comparables.

**À l’étape de la maquette**, intégration, build et tests applicatifs, recette Docker Windows, nouveau ZIP Docker et
publication n’étaient pas exécutés. Depuis la validation, l’intégration et les contrôles applicatifs ont été effectués ;
consulter le [rapport du lot intégré](../../SWOT-STUDIO-INTEGRE.md). Prochaine action : essai du ZIP sur la copie Docker
Desktop du demandeur. Les autres propositions Organisation restent à valider séparément.
