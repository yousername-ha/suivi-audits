# ADR 0099 — Animations en continu, sans bouton de pause

- Statut : **acceptée** par le RSSI le 15/11/2026, dans la session (numéro 0099 annoncé et accepté).
- Date : 2026-11-15
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Modifie** l'[ADR 0051](0051-couche-visuelle-ebios.md) (couche visuelle EBIOS RM : le bouton de pause des chemins est
  retiré, le réglage « Animées / Automatiques / Arrêtées » reste) et l'[ADR 0093](0093-refonte-neon-charte-menu-et-accueil.md)
  (refonte Neon : le bouton de pause du menu et ceux des écrans des lots 3 à 8 sont retirés).

## Contexte

Décision du RSSI du 15/11/2026 : « Retire les boutons d'arrêt d'animation. Les animations sont en continu. » La refonte Neon
(ADR 0093) et la couche visuelle EBIOS RM (ADR 0051) avaient ajouté, écran par écran, un bouton qui met en pause ou reprend
les animations décoratives. Ces boutons s'étaient multipliés (dix écrans), chacun avec son libellé, son état et parfois une
préférence gardée dans le navigateur. Les animations concernées sont toutes **décoratives** : elles ne portent aucun état
métier, qui reste écrit à côté (valeur, libellé, couleur doublée d'un texte).

## Décision

1. **Les boutons de pause et de reprise des animations sont retirés**, sans remplacement :
   - menu latéral (pied du menu, « Mettre en pause les animations du menu »), avec la préférence `menu-mouvement` gardée dans
     le navigateur ;
   - Plan d'actions et tâches récurrentes (« Mettre en pause les animations des tâches »), avec la préférence
     `taches-mouvement` ;
   - EBIOS RM, onglet Chemins (« Mettre en pause » / « Reprendre le mouvement ») ;
   - Assistant RSSI (pied du panneau, « Suspendre les animations ») ;
   - Processus, Parties intéressées, PESTEL, SWOT, Objectifs et indicateurs (« Pause animations », « Mettre les animations en
     pause ») ;
   - graphe des Périmètres (« Mettre le flux en pause » / « Reprendre le flux »).
2. **Ce qui arrête encore les animations est gardé** :
   - la préférence système ou du navigateur « réduire les animations » (`prefers-reduced-motion: reduce`), appliquée par les
     feuilles de style et, pour les mouvements pilotés par le script (points lumineux des Parties intéressées, flux des
     chemins EBIOS, flux du graphe des Périmètres, avatar de l'assistant), par la même requête lue dans le composant ;
   - l'arrêt quand l'onglet est masqué (menu, tâches, chemins EBIOS, parcours ISO, Parties intéressées) ;
   - l'impression et les couleurs forcées, là où elles les arrêtaient ;
   - le réglage « Animées / Automatiques / Arrêtées » du parcours ISO ([ADR 0045](0045-parcours-guide-iso-hds.md)) et
     de l'onglet Chemins d'EBIOS RM (ADR 0051), qui est un réglage d'affichage distinct d'un bouton de pause.
3. **Hors champ** : la lecture automatique de la chronologie RETEX (« ▶ Lecture » / « ❚❚ Pause ») est une navigation de
   point en point, désactivée par défaut, et non un arrêt d'animation décorative : elle reste. La pause des rondes de
   l'assistant (réglage d'administration, ADR 0086) et la pause d'une série de tâches récurrentes sont des notions métier sans
   rapport.
4. **Aucune migration, aucune API, aucune donnée** : changement d'interface seul. Les préférences `menu-mouvement` et
   `taches-mouvement` déjà écrites dans un navigateur ne sont plus lues ; elles ne sont pas effacées (pas de code de
   compatibilité avec d'anciennes données, consigne du 14/11/2026).

## Accessibilité (RGAA 13.8, WCAG 2.2.2)

Le critère RGAA 13.8 et le critère de succès WCAG 2.2.2 « Mettre en pause, arrêter, masquer » (niveau A) demandent qu'un
contenu en mouvement lancé automatiquement, qui dure plus de cinq secondes et s'affiche avec d'autres contenus, puisse être
arrêté ou masqué par l'utilisateur, sauf s'il est essentiel.

Choix retenu : le **moyen d'arrêt est la préférence de mouvement réduit** du système ou du navigateur, que toutes les
animations concernées respectent (règles `prefers-reduced-motion` des feuilles de style et des composants, gardées et
vérifiées par les tests). Ce moyen vaut pour toute l'application, d'un seul réglage, et ne dépend pas d'un bouton à retrouver sur chaque
écran. Il est complété par l'arrêt quand l'onglet est masqué et, pour le parcours ISO et les chemins EBIOS, par le réglage
« Arrêtées » dans la page. Les animations restent décoratives et limitées à `transform` et `opacity` ; aucun texte ne bouge et
aucune information n'est portée par le seul mouvement. Le changement ne modifie aucune cadence d'animation (critères RGAA 13.7
et WCAG 2.3.1 non touchés).

Limite assumée : la préférence de mouvement réduit est un réglage extérieur à la page. Un audit RGAA peut considérer qu'elle
ne suffit pas, seule, à satisfaire le critère 13.8 sur les écrans qui n'ont pas de réglage dans la page (menu, tâches,
Processus, Parties intéressées, PESTEL, SWOT, Objectifs, Périmètres, assistant). Ce risque est accepté par le RSSI ; s'il
fallait y répondre, la mesure la moins intrusive serait un réglage unique dans les préférences du compte, plutôt qu'un bouton
par écran.

## Conséquences

- Code retiré : boutons, états de pause, deux modules de préférence (`components/mouvement-menu.ts`,
  `grc/mouvement-taches.ts`), pictogrammes « pause » et « lecture » devenus inutiles, règles de style mortes (`.nav-pause`,
  `.taches-pause`, `.swot-motion-control`, `data-animations` des objectifs, en-têtes et pied d'assistant). Le menu et les
  tâches lisent directement la visibilité de l'onglet (`useOngletVisible`) ; l'attribut `data-mouvement='pause'` ne signifie
  plus que « onglet masqué ».
- Tests : un test web vérifie qu'aucun libellé de pause ou de reprise ne subsiste, qu'aucune préférence n'est gardée et que
  chaque feuille concernée garde sa règle de mouvement réduit ; le rendu de Processus, Parties intéressées, Chemins EBIOS et du
  graphe des Périmètres (mouvement réduit compris) le confirme. Les parcours de bout en bout EBIOS et Périmètres vérifient
  l'absence des boutons ; l'arrêt par le réglage « Arrêtées » et par le mouvement réduit reste couvert.
- Captures de référence : elles sont prises en mouvement réduit, où le bouton du menu était déjà masqué ; aucune ne montre un
  bouton retiré.
- Les exigences historiques qui demandaient une pause (chemins EBIOS 003-10, graphe des périmètres 010-08) sont satisfaites,
  pour l'arrêt, par la préférence de mouvement réduit et, pour EBIOS, par le réglage « Arrêtées ».
