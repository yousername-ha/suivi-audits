# Périmètres — graphe centré et cartes repliables

04/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Maquette validée par « Go intégration », puis intégrée au commit `495427d`.** Voir [le résultat réel, les contrôles et la livraison Docker](../../PERIMETRES-COMPACTS-INTEGRES.md). Les sections suivantes conservent la description de la proposition autonome. Le demandeur souhaite réduire les grandes dalles de Périmètres, ouvrir le Graphe par défaut, limiter les cartes aux informations essentielles et déplier chaque carte avec un « + ». Avant cet accord, l’application était inchangée au commit `d4ced29` et aucun build/test applicatif n’avait été exécuté pour la proposition.

## Présentation

- Graphe sélectionné à l'ouverture ; vue Liste conservée.
- Cartes repliées par défaut, de 260 px de large et environ 194 px de haut sur ordinateur. Le composant actuel réserve 380 × 680 px avant mesure du contenu.
- Nom, nature, périmètre affiché, couverture, actions ouvertes et écarts ouverts visibles immédiatement. Retards et clauses obligatoires signalés.
- « + » et « − » indépendants : les autres cartes gardent leur état. Tout replier agit sur l'ensemble.
- Détails : numérateur/dénominateur de couverture, récurrences, continuité, classification des écarts, sous-total distinct et boutons de gestion.
- Synthèse globale dédupliquée au-dessus du graphe, distincte de la somme des cartes.
- Ensemble centré, fournisseur extérieur compris ; bouton Centrer après déplacement. Périmètre unique également centré.
- Hauteur naturelle des cartes et repositionnement des rangées suivantes, sans défilement interne aux dalles. La page peut s'allonger.
- Sur téléphone, hiérarchie verticale lisible ; le lien fournisseur contourne les cartes.

Palette blanche/indigo inspirée de la direction Studio récemment validée, avec déclinaison sombre. La navigation et les fenêtres illustrent le contexte de la maquette ; elles ne constituent pas une nouvelle modification de ces rubriques.

## Visuels pour validation

![Graphe centré et cartes repliées](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-replie-light-1440.png)

| État | Clair | Sombre |
| --- | --- | --- |
| Replié | [Vue 1440](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-replie-light-1440.png) · [HD 3840 × 2400](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-replie-light-4k.png) | [Vue 1440](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-replie-dark-1440.png) · [HD 3840 × 2400](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-replie-dark-4k.png) |
| Une carte dépliée | [Vue intégrale](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-deplie-light-1440.png) · [HD intégrale](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-deplie-light-4k.png) | [Vue intégrale](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-deplie-dark-1440.png) · [HD intégrale](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-deplie-dark-4k.png) |
| Détails | [Carte repliée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/carte-repliee.png) · [Carte dépliée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/carte-depliee.png) | — |
| Téléphone | [Replié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-mobile-replie.png) · [Déplié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/graphe-mobile-deplie.png) | — |
| Périmètre unique | [Carte centrée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/perimetre-seul-centre.png) | — |

[Maquette HTML interactive](index.html) · [Mesures et provenance](captures.json).

## Rendus et limites

Treize captures directes de Chromium système : onze pages et deux détails, sans retouche. Fenêtres 1440 × 1050, 1920 × 1200 à densité ×2 et 390 × 844 à densité ×2. Inter locale sous [SIL Open Font License](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/perimetres-compacts/OFL.txt), mouvements réduits. HTML/CSS/JS et police chargés en mémoire avec `setContent`, sans réseau ni API.

Commande privée : `node /workspace/work/neon-instance/perimetres-compacts/rendre.mjs`, Node 26, code 0. Aucune erreur JavaScript ni requête réseau. Vérifications de maquette : Graphe initial, cartes repliées, dépliage indépendant, repliage global, accès Liste, centrage, déplacement/recentrage, ouverture des sous-totaux et ouverture multiple. Les onze pages mesurées n'ont ni chevauchement, ni carte hors cadre, ni débordement horizontal, ni défilement interne de dalle. Écart de centrage horizontal nul dans ces vues.

Quatre périmètres et un fournisseur entièrement fictifs. Couverture indisponible conservée comme telle ; pourcentage d'exigences testées/validées parmi les applicables, sans taux de conformité inventé. Les actions de gestion sont illustratives et ne sauvegardent rien.

Ces vérifications ne valent pas tests d'intégration, audit d'accessibilité ou recette de l'application. Une grande hiérarchie réelle reste à vérifier après validation.

## Suite

Après accord explicite : intégrer uniquement la présentation sur la copie isolée de main, préserver données/calculs serveur, droits, actions, liens et fournisseurs extérieurs ; exécuter les contrôles pertinents et livrer des captures réelles.

PR ouverte #226 consultée avant les mises à jour documentaires : elle touche également les composants Périmètres dans une autre branche, aucun changement importé. Aucun push, fusion ou déploiement. Publication GitHub toujours en attente de l'accord explicite déjà demandé après le refus automatique antérieur.
