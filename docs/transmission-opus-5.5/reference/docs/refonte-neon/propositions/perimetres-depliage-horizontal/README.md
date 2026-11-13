# Périmètres : commande en bas et dépliage horizontal

> **04/11/2026 — Validée et intégrée** avec les deux propositions, commit applicatif `eed9f21`.
> [Captures réelles, contrôles et livraison Docker](../../HORIZONTAL-STUDIO-INTEGRE.md).
> Les indications de maquette et d’attente de validation ci-dessous sont historiques. Session : Codex.

04/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Proposition validée par « Top, avant de continuer… » le 04/11/2026.** Le demandeur a priorisé [la vue compacte par défaut pour les objectifs](../../OBJECTIFS-VUE-COMPACTE.md). Le dépliage horizontal reste à intégrer ensuite, sans redemander l’accord. Le demandeur souhaite déplacer le « + » au centre du bas de chaque dalle, puis ouvrir une carte rectangulaire en largeur pour éviter un détail en liste très longue. La précédente intégration (`495427d`, documentation `6710b80`) reste conservée ; aucune modification applicative, compilation ou suite de tests applicatifs pour cette nouvelle proposition.

## Proposition

- Carte repliée d'environ **260 × 202 px**, nom et trois indicateurs essentiels conservés.
- « + » centré dans le pied de la carte, entre l'alerte à gauche et l'accès Afficher à droite.
- Au dépliage, largeur **620 px** et hauteur naturelle d'environ **369 px** dans l'exemple.
- Identité à gauche et trois indicateurs à droite en tête de la carte ouverte.
- Détails répartis sur trois zones : couverture ; récurrences et continuité ; écarts, classifications et actions.
- Sous-total dédupliqué sur une ligne dédiée ; commandes Détail, Modifier et Ajouter un enfant dans le pied.
- « − » au même emplacement, centré en bas, pour replier. Les autres cartes gardent leur état.
- Disposition calculée selon la largeur et la hauteur de chaque carte : les voisins se repositionnent et l'ensemble du graphe reste centré, fournisseur extérieur compris.
- Sur écran étroit, utilisation de la largeur disponible et deux colonnes pour les détails ; la page peut s'allonger sans défilement interne aux cartes.

Les données sont celles du jeu entièrement fictif de la maquette précédente. Elles illustrent la présentation, sans prétendre reproduire les compteurs de l'instance du demandeur. La couverture ne constitue pas un taux de conformité. Les formulaires et boutons de gestion de cette page autonome ne font aucune sauvegarde.

## Visuels

![Comparatif clair, carte repliée et rectangle déplié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/comparatif-light-1000.png)

![Comparatif sombre, carte repliée et rectangle déplié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/comparatif-dark-1000.png)

| Vue | Clair | Sombre |
| --- | --- | --- |
| Comparatif HD | [Repliée et dépliée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/comparatif-light-hd.png) | [Repliée et dépliée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/comparatif-dark-hd.png) |
| Graphe, une carte ouverte | [1440](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/graphe-deplie-light-1440.png) · [HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/graphe-deplie-light-hd.png) | [1440](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/graphe-deplie-dark-1440.png) · [HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/graphe-deplie-dark-hd.png) |
| Détail de carte | [Rectangle déplié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/carte-depliee-light.png) | [Rectangle déplié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/carte-depliee-dark.png) |
| Dépliage indépendant | — | [Deux cartes ouvertes](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/deux-cartes-depliees-dark-1440.png) |
| Agrégat | [Sous-totaux dépliés](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/sous-totaux-deplies-light-1440.png) | — |
| Mobile | [Replié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/graphe-replie-mobile.png) · [Déplié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/graphe-deplie-mobile.png) | — |

[Maquette HTML](index.html) · [Mesures des rendus](captures.json) · [Licence de la police Inter](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-depliage-horizontal/OFL.txt).

## Rendus et limites

Seize captures natives de Chromium : dix vues de graphe, quatre comparatifs et deux détails de carte. HTML, CSS, JavaScript et police embarqués en mémoire avec `setContent`, sans API ni requête réseau. Commande privée : `node /workspace/work/neon-instance/perimetres-horizontal/rendre.mjs`, code 0. Aucune erreur JavaScript.

Les contrôles du prototype vérifient l'ouverture Graphe, l'état replié initial, le « + »/« − » dans le pied et son centrage horizontal, l'ouverture indépendante de deux cartes, le repliage global, les sous-totaux et les dimensions après changement de thème ou de largeur. Aucun chevauchement, carte hors cadre, débordement horizontal de page ou défilement interne de dalle dans les vues mesurées ; écart de centrage du graphe et du bouton inférieur à un pixel.

Ces contrôles portent uniquement sur la maquette. Ils ne valent ni tests d'intégration, ni audit d'accessibilité de l'application. Une grande hiérarchie réelle, les différentes données et tous les droits devront être vérifiés après accord.

À la reprise de l’intégration validée : intégrer la largeur variable et la nouvelle disposition dans les composants existants, conserver les compteurs serveur, classifications, liens, agrégats, formulaires et droits, puis effectuer les tests pertinents et fournir de nouvelles captures réelles. **Aucun nouveau ZIP, push, fusion ou déploiement pour cette proposition.** La publication GitHub reste en attente de son autorisation distincte. La PR #226 a été consultée avant les mises à jour des documents partagés ; aucun chevauchement sur ces documents.
