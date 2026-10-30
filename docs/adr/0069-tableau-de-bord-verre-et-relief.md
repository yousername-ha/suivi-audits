# ADR 0069 — Tableau de bord de l'accueil « verre et relief »

- Statut : acceptée (lot 1)
- Date : 2026-10-27
- Contexte : demande de l'utilisateur du 26 et du 27/10/2026. Une maquette interactive (hors dépôt) a comparé plusieurs
  directions graphiques ; la version retenue pour la production est « A · Sauge — verre et relief » : charte Sauge,
  dalles en verre épais, métriques fines cernées d'un contour sombre, jauges en arc fin, couleurs de seuils plus
  franches. Décision de l'utilisateur : l'appliquer **au seul tableau de bord** pour le moment, en trois étapes.

## Décision

1. **Portée.** Le nouveau rendu ne concerne que l'accueil (`/`) : classe `tdb` sur le conteneur, fond de page propre à
   l'accueil (`.app-main:has(.tdb)`). L'écran mural (`/mur`) et la synthèse du Pilotage gardent les cartes de
   `Synthese.tsx`. Le reste de l'application ne change pas.
2. **Composants.** `packages/ui/src/tableau-de-bord.tsx` : `Dalle` (verre), `ChiffreCle`, `JaugeArc` (demi-cercle fin,
   zones de seuils en filet, curseur, cible facultative), `BarresHorizontales`, `BarresEmpilees`, et les fonctions pures
   `teinteSeuil`, `bandesSeuils`, `pointArc`, `cheminArc` (testées). L'anneau et l'histogramme existants sont repris ;
   dans le tableau de bord, leurs teintes sont celles des seuils et leurs traits sont affinés.
3. **Seuils d'affichage.** Une métrique est colorée selon des seuils : teinte de base, puis teinte du plus haut palier
   atteint. Par défaut, un pourcentage est rouge sous 60, orange de 60 à 80 et vert à partir de 80 ; les jours avant
   l'audit sont rouges sous 30, orange sous 60, verts au-delà ; un compteur de retards est vert à zéro et rouge sinon.
   Ces seuils sont un **choix d'affichage**, pas une règle métier : ils deviendront réglables à l'étape 2.
4. **Taux de conformité global et taux par référentiel.** Toutes les valeurs viennent de la synthèse existante
   (`/api/mur/synthese`), filtrée selon les droits ; une dalle sans donnée lisible n'apparaît pas.
   - **Taux par référentiel** : exigences applicables mises en œuvre totalement sur exigences applicables, pour chaque
     référentiel (déclaration d'applicabilité), dalle « Taux de conformité par référentiel ».
   - **Taux global** (décision du RSSI du 28/10/2026) : **moyenne simple des taux par référentiel**, chaque référentiel
     comptant autant quel que soit son nombre d'exigences. Dalle « Taux de conformité global », sous-titre « Moyenne des
     référentiels », avec le nombre de référentiels moyennés ; il est aussi tracé en trait violet sur les barres des
     taux par référentiel. Ce n'est **jamais** une somme d'exigences de référentiels différents, que
     l'[ADR 0060](0060-couverture-agregee-des-cartes-de-perimetres.md) écarte parce qu'elle mélangerait des
     référentiels sans lien et donnerait plus de poids au plus gros. L'ADR 0060 reste valable pour les cartes de
     périmètres.
   - Les deux portent la mention « déclaration interne, non certifiée » : ce n'est ni un taux certifié ni le résultat
     d'un audit.
5. **Couleurs.** Jetons `TABLEAU_DE_BORD` (clair et sombre) dans `tokens.ts`, variables `--tdb-*` générées dans
   `mantine-vars.css` : remplissage vif, texte foncé pour les chiffres, teinte douce pour les pastilles, contour. Le
   contour sombre (clair à l'écran sombre) porte le contraste des éléments graphiques (WCAG 1.4.11, 3:1) ; les textes et
   pastilles respectent 4,5:1 sur le verre. Ces couples sont ajoutés au test de contraste de la charte.
6. **CSP et charte.** Aucun style en ligne : valeurs calculées en attributs SVG, couleurs par classes. Les styles sont
   dans `packages/ui/src/styles.css`. Rayon des dalles : 12 px (`--mantine-radius-lg`), maximum de la charte, au lieu des
   20 px de la maquette. Aucune dépendance nouvelle.
7. **Accessibilité.** Chaque métrique garde une alternative textuelle (libellé chiffré, liste, tableau masqué).
   `prefers-reduced-transparency` remplace le verre par une surface opaque ; `forced-colors` ajoute une bordure.

8. **Haut du tableau de bord** (demande du RSSI du 28/10/2026, après la première mise en service) :
   - une **carte phare** sur la demi-rangée, au style de l'ancienne carte « Prochain audit » (fond vert profond de la
     navigation, titre en petites capitales, arc décoratif) : la date du prochain audit en haut, avec son compte à
     rebours en pastille colorée selon les seuils de jours, puis le taux de conformité global (point 4). Elle remplace
     les dalles « Taux de conformité global » et « Prochain audit » ;
   - à sa droite, la carte **« Écarts »** reprend la grille 2 × 2 de l'ancienne carte (ouverts, en retard, à échéance
     proche, au total) au style verre et relief, chaque chiffre précédé d'un filet à la teinte de son seuil
     (`GrilleChiffres`).

## Étapes suivantes (non réalisées dans ce lot)

- **Étape 2 — personnalisation** (backlog DEV-004 ; décrite par l'[ADR 0078](0078-disposition-et-partage-du-tableau-de-bord.md), lot 2a réalisé) : créer et dupliquer un tableau, déplacer et redimensionner les
  dalles, réglages par dalle (métrique, axe, visualisation, cible, seuils), bibliothèque de dalles, visibilité (privé,
  équipe, périmètre, écran mural), enregistrement côté serveur (migration, routes `route()`, droits, versions, audit).
  Une ADR complémentaire précisera le stockage et le partage.
- **Étape 3 — historique mensuel** (backlog DEV-005) : séries mensuelles pour les courbes d'évolution, les tendances des
  chiffres clés et la comparaison avec la période précédente. La lueur violette retenue sur la maquette pour
  « Évolution de la conformité » est prête (`lueur` de `Dalle`) mais n'est utilisée par aucune dalle tant que cette
  courbe n'existe pas.

## Conséquences

- Les captures de référence du tableau de bord (`tests/e2e/specs/__captures__/ecrans-tableau-de-bord-*`, 12 images)
  changent et doivent être régénérées sur la pile Docker (`./tests/e2e/run-in-container.sh --update-snapshots`), puis
  relues dans la PR (backlog TEST-043). Le compte à rebours du prochain audit change chaque jour : il porte la classe
  `horodatage`, masquée dans ces captures comme les autres dates.
- L'effet de verre (`backdrop-filter`) sollicite la carte graphique ; à surveiller sur un poste modeste.
