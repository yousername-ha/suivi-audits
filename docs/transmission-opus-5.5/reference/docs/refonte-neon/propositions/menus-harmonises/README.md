> **Correction du 12/11/2026 : menu mis de côté, ne pas intégrer.** Le demandeur précise « on touche pas au menu » : le style SWOT/PESTEL concernait [la bibliothèque de référentiels](../bibliotheque-studio/README.md). Les propositions de menu restent un historique uniquement ; aucun portage du menu effectué.

# Menu latéral principal — harmonisation proposée

12/11/2026 · **Maquette autonome à valider, aucun habillage global intégré.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Précision reçue du demandeur : les différences concernent le **menu latéral principal**. Les onglets internes des pages ne font pas partie de cette proposition. La règle visuel → validation → intégration/tests → capture intégrée reste applicable.

[Image HD 3840×2160](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menus-harmonises/menu-commun-hd.png) · [Aperçu autonome clair/sombre](apercu-autonome.html). Cliquer sur les familles et destinations permet de comparer le même menu dans différents contextes. Les corps de page autres que la bibliothèque sont des illustrations fictives, pas de nouvelles propositions métier.

## Diagnostic confirmé dans le code et le navigateur

`packages/ui/src/neon-dda.css`, autour des lignes 978–1071, applique plusieurs sélecteurs `.shell:has(:is(.dda-module, .objectifs-module, .perimetres-graphe-compact, .referentiels-studio)) .shell-nav`. En clair, ces pages changent la sidebar en dégradé violet sombre, ses liens, les états actifs, la marque et les légendes. D’autres pages gardent le menu normal. La cause est donc un habillage dépendant du contenu, pas un second système de navigation.

Sur le frontend compilé, en retirant/rétablissant uniquement la classe métier dans le DOM de recette, le même menu passe de `linear-gradient(165deg, rgb(48, 41, 78), rgb(37, 34, 64) 77%)`, texte `rgb(209, 201, 232)`, au fond normal sans dégradé, texte `rgb(39, 48, 73)`. Largeur inchangée : 240 px. Cette manipulation de contrôle n’a modifié aucune source applicative. Relevé dans les preuves de l’intégration Bibliothèque.

## Proposition visuelle

Un seul menu par thème : blanc en clair dans l’esprit du Dashboard initial, bleu nuit en sombre, texte contrasté et sélection bleu/vert discret. Même grille d’icônes, typographie, espacements, survol, focus et repères de famille/destination active sur toutes les pages. Violet limité à la marque. Les longs libellés restent lisibles ; menu à défilement propre en fenêtre basse.

Les familles, destinations et nombres illustrent la navigation actuelle après le regroupement Bibliothèque/Couverture. Budget et CRRC restent masqués. Lors du portage, les droits et préférences existantes de `Layout` restent la source de vérité : ne pas remplacer le menu de l’application par les données statiques de la maquette.

## Résumé technique pour une IA connaissant le code

- Ce dossier ajoute seulement `index.html`, `menu.css`, `menu.js`, l’assembleur `exporter.py`, son export autonome et les preuves. Aucun import de ce CSS/JS dans l’application.
- `menu.css` définit une palette commune indépendante de la destination. `menu.js` sert uniquement aux comparaisons interactives de la maquette ; il ne possède ni session ni API ni persistance de droits.
- Portage **après validation** : conserver `Layout`, son inventaire `navigation.ts`, permissions, modules activés, ordre enregistré et localisation active. Centraliser les styles de `.shell-nav` et retirer les seules surcharges de sidebar conditionnées par une page dans `neon-dda.css` ; vérifier les éventuelles surcharges des autres feuilles. Ne pas supprimer en bloc cette section CSS : elle contient aussi des fonds métier, un header et des onglets, hors du périmètre clarifié.
- Préserver header, fonds/cartes métier, onglets internes, commandes de vues, Timeline par défaut, Graphe et vue compacte. Ne pas restyler tous les `MantineTabs`/`SegmentedControl`.
- Cartographie : aucune modification du canevas, placement, liens, dimensions internes ou génération automatique. Assistant global et archives existantes inchangés.
- La Bibliothèque/Couverture est déjà portée dans un lot validé distinct ; voir [le rapport intégré](../../BIBLIOTHEQUE-UNIFIEE-INTEGREE.md).

## Contrôles de la maquette

18 comparaisons de styles (9 contextes × 2 thèmes) : fond, texte, bordure, largeur et police du menu identiques dans chaque thème. Contextes Bibliothèque, Objectifs, DDA, Actions, Récurrences, Périmètres, Fournisseurs, Configuration et Cartographie.

16 dispositions PC dans les deux thèmes : 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440, 1920×800. Aucun débordement de page ou menu mesuré. Six analyses Axe sur trois contextes/deux thèmes sans violation détectée. Pas une certification exhaustive d’accessibilité. Aucun appel API, ressource externe ou erreur JavaScript. ESLint/format ciblés contrôlés.

Une capture native 3840×2160, viewport 1920×1080 à densité 2 ; export autonome avec police embarquée, styles/scripts assemblés par `python3 exporter.py`. [Résultats et empreintes](controles.json).

Les tests/build de l’application exécutés dans cette reprise concernent **l’intégration Bibliothèque déjà validée**, pas un portage du nouveau menu. Ce dernier attend l’avis visuel ; tests applicatifs du menu, recette DB/Docker et déploiement non exécutés. Aucun nouveau ZIP.
