# ADR 0034 — Apparence « Référence 08 » de l'application principale et style global (lot M4 suite)

**Statut** : proposée le 13/10/2026. Reprend, pour l'application principale (React/Mantine), les décisions de design du
[dossier d'implémentation 08](https://github.com/yousername-ha/suivi-audits/blob/legacy/samples/2026-10-13-astra-15/DOSSIER-IMPLEMENTATION.md)
(branche `legacy`) et l'[ADR 0006](0006-front-react-mantine-csp-stricte.md) (CSP stricte).

## Décisions

1. **Style global de l'instance** : `apparence.style` ∈ {`sage` (défaut, « Référence 08 — Sauge »), `clair` (« Clair bleuté »)},
   dans les Paramètres > Apparence, avec la version/`If-Match`, le journal d'audit et le temps réel existants. **Aucune
   migration** : la section `apparence` est un JSON, `style` vaut `sage` quand il est absent. Même valeur pour tous les comptes
   et tous les appareils ; le mode clair/sombre/automatique reste une préférence personnelle distincte (`data-mantine-color-scheme`).
   Le style est posé sur `<html data-style>`. `clair` ne remplace que fond de page, traits et surface douce **en mode clair** ;
   la navigation vert profond, les couleurs métier, les graphiques et la cartographie ne changent pas. Aperçu local dans le
   panneau, abandonné si l'on quitte sans enregistrer.
2. **Identité** : signature de l'organisation dans l'en-tête (nom saisi dans Paramètres > Général + carré turquoise, aucun logo
   tiers, aucune ressource distante) ; lien « Site <organisation> » sur le tableau de bord, seulement si le site saisi est en
   **https**, ouvert par clic explicite (`target="_blank" rel="noopener noreferrer"`) ; entrée de menu active : icône et filet
   turquoise (`#2cc4cb` sur la navigation sombre, ≥ 3:1 avec le fond actif ; la sélection reste portée aussi par le fond, le
   texte et `aria-current`) ; filet turquoise décoratif (`#00a8b0`) sous les titres de cartes du tableau de bord. Les chevrons
   de dépli et les pictogrammes en contour existaient déjà.
3. **Matrice des risques** : pour les méthodes à calcul matriciel, cases **entièrement colorées** (couleur du niveau publié dans
   la méthode, jamais recalculée ni recolorée ici), niveau en texte, nombre de risques (tiret si aucun), références cliquables ;
   impact décroissant de haut en bas, probabilité croissante de gauche à droite ; case sélectionnable (`aria-pressed`, contour
   bleu sans effacer le fond), panneau « Risques sélectionnés · N » et réinitialisation. Les méthodes à jugement ou à règles
   n'ont pas de matrice artificielle. La CSP interdit les styles en ligne : le fond d'une case est un `<svg>` (`fill`). Le
   texte est choisi (blanc ou encre) selon le meilleur contraste calculé, testé sur les quatre couleurs de niveau.
4. **Hors périmètre de ce lot** : plans d'action (six vues), tâches récurrentes (cinq vues) et capture de référence de
   chaque écran — décrits au dossier 08 pour l'outil historique ; leur déclinaison sur l'application principale suit les lots
   M5 à M8 (les écrans correspondants y sont créés). Aucune hexagonale décorative ni police distante.

## Conséquences

- Les captures de référence de l'interface changent (en-tête, navigation active, cartes) : elles sont régénérées avec ce lot.
- Les écarts d'accessibilité connus (7) restent suivis dans le test axe-core ; ce lot n'en introduit pas.
