# Cartographie existante — habillage harmonisé uniquement

12 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Proposition d’habillage avant validation ; aucune intégration.** Répond à la demande de conserver la carte actuelle, sa présentation et sa génération automatique. La proposition de panorama `cartographie-studio` demeure non retenue.

[Une image HD, vue processus](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/cartographie-habillage/habillage-hd.png) · [Comparer Original / Harmonisé](index.html) · [Même aperçu, vue contexte](contexte.html) · [Reçu de comparaison](validation.json).

## Ce qui est proposé

Couleurs cyan/bleu, vert et ambre plus cohérentes avec Studio, violet limité à sa famille existante, contours plus nets et léger relief des commandes et panneaux. Les titres et boutons restent à leur place. Aucun changement de dimensions, ordre, tailles des nœuds, lignes, calques, algorithmes ou commandes. Aucun mouvement décoratif ajouté à la carte.

Le fichier `habillage.css` applique les jetons `--carte-*` et les couleurs/ombres des commandes dans `.carte-page`. Les règles ajoutées n’affectent pas le placement du canevas. Le seul positionnement introduit concerne le sélecteur d’aperçu, extérieur à l’application.

Le comparateur peut montrer l’original, l’habillage proposé et les deux thèmes. Ses deux boutons de vue ouvrent les deux aperçus figés. **Les autres commandes de l’application sont visibles mais inactives dans ce document de présentation** : ce n’est pas une copie fonctionnelle de l’éditeur. La génération automatique et l’édition demeurent présentes dans le code applicatif, qui n’a pas été modifié.

## Origine du rendu et limites

Le DOM/SVG provient du moteur React existant, chargé depuis le bundle déjà disponible dans `apps/web/dist`, **sans le reconstruire**. La dernière modification des sources cartographiques consultées est `fede361`. Cet aperçu n’est pas une capture d’une nouvelle intégration ni une preuve que ce bundle représente tous les autres écrans du dernier commit.

Pour le rendu isolé, les lectures ont été interceptées dans Chromium avec les archives **fictives** `api/carto-objets.json`, `types-processus.json` et `rattachements-referentiels.json`. Les deux dispositions ont été préparées avec les fonctions existantes déjà compilées `cartoContext`, `defaultGenerateOptions`, `selectForGeneration`, `generateLayout`, et les types du registre : 22 nœuds en contexte ; six processus et trois cadres dans la vue processus. Aucun placement manuel ni nouvel algorithme. Le contrôle natif « Ajuster à l’écran » a préparé le cadrage avant le gel de l’aperçu.

Tous les appels de ce rendu sont interceptés, y compris les battements de présence et l’enregistrement de préférence de cadrage : aucun serveur métier contacté, aucun compte ou carte réelle modifié. Le profil de démonstration exclut les permissions Budget/CRRC afin de conserver leur retrait de l’interface. Le nom affiché est « Démonstration » ; aucun secret ni état de connexion joint.

Le libellé de version/date dans le pied appartient à la réponse fictive servant au rendu ; il ne prouve pas un enregistrement sur le serveur. L’indication « Hors ligne » et les éventuels défauts de texte du jeu de contexte sont ceux du rendu figé ; ils n’ont pas été corrigés par cette proposition de style. L’aperçu ne recalcule pas le cadrage comme l’application lors du redimensionnement : la comparaison géométrique a été faite à 1920×1080. Le PNG complet fait 3840×2756 pixels, incluant les panneaux et le pied existants.

## Résumé technique pour la reprise IA

- `habillage.css` : seule proposition de changement produit, palettes clair/sombre, contours, ombres et poids des boutons. Ne pas porter `.preview-switch`, qui appartient uniquement au comparateur.
- `index.html` et `contexte.html` : instantanés autonomes avec SVG et CSS existants embarqués ; aucun bundle React ni moteur métier embarqué dans ces exports. Police locale incluse. À conserver comme preuves visuelles, pas comme code à copier dans l’application.
- `apercu.js` : bascule des styles/thèmes et navigation entre les instantanés ; aucune requête ou persistance.
- `exporter.py` : assemble le DOM de rendu isolé lorsqu’il est disponible ; à défaut réutilise les HTML figés de ce dossier pour actualiser uniquement l’habillage et le comparateur. Les répertoires privés de capture ne sont pas nécessaires pour réappliquer une modification de palette aux aperçus présents.

Après validation, intégrer seulement les règles de style pertinentes dans la charte cartographique existante (`packages/ui` / `apps/web/src/app.css`) et continuer à utiliser `apps/web/src/pages/Cartographie.tsx`, `carto/Canevas.tsx`, `rendu.tsx`, `Dialogues.tsx`, `Construire.tsx`, `Panneau.tsx`, `Inspecteur.tsx` et les algorithmes de `packages/shared/src/carto/`. Aucun remplacement par `cartographie-studio`.

Préserver la génération assistée, ajout/création/renommage, zoom et panoramique, édition, annuler/rétablir, synchronisation, vues, filtres, versions, exports, droits, données et API. Les choix de famille/teinte viennent toujours du registre. Rejouer ensuite les contrôles applicatifs pertinents et rendre une capture réelle de la version intégrée.

## Contrôles de cet aperçu

Quatre comparaisons à 1920×1080 : contexte/processus × clair/sombre. Entre Original et Harmonisé, SVG complet identique, mêmes boîtes du canevas et mêmes limites géométriques de chaque nœud (`getBBox`). Le bouton Générer reste présent. Aucune erreur JavaScript ; les quatre ouvertures des exports ne chargent que leur HTML, sans requête API ni ressource externe. ESLint ciblé, format des CSS/JS et diff contrôlés.

Une seule image produite pour cette livraison. La proposition Fournisseurs est fournie dans un aperçu HTML distinct, sans autre capture. Aucun build/test applicatif avant validation ; ni application, API, dépendance, migration, ancien ZIP, push ou déploiement modifié. Les premiers essais de contrôle ont rencontré une réponse vide de l’ancien serveur statique ; le rendu final a été vérifié avec un serveur local silencieux distinct.
