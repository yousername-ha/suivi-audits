# Ergonomie sur grand écran (version 7.3.0) : en-tête compact et boîte d'outils commune

16/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/ergonomie-ecran`,
partie de `claude-suivi-smsi`. Demande du RSSI transmise par la session « Projet audit_suivi Coeur » et confirmée par le RSSI.
Relevé de départ : [RELEVE-ECRAN-1920.md](RELEVE-ECRAN-1920.md).

## Décisions du RSSI (16/11/2026), prises sur maquettes et vidéos

1. **En-tête compact** : titre réduit, petite liste « Périmètre affiché » sur la ligne du titre, description générique
   retirée, explications longues repliées sous « À propos de cette page ». « Ça paraît bien ».
2. **Contenu remonté** : moins d'espace sous la barre du haut (« gros trou sous Organisation de démonstration »).
3. **Une seule forme de barre d'outils** : la petite boîte bleu nuit aux couleurs du menu, avec les vues, la recherche et
   l'entonnoir des filtres avancés ; les autres filtres se font sur le titre des colonnes ; plus de bande de champs.
4. **Recherche** : contour fin, fondu violet transparent de gauche à droite, une lueur violette qui fait le tour du
   rectangle (« effet à la Apple », sans violet plein à l'intérieur). Validé après vidéo.
5. **Adaptation des tests de bout en bout** : ouvrir l'entonnoir avant de choisir la vue, le mois, le registre ou le
   périmètre, et nom « Filtres avancés » au lieu de « Filtres ». Validée.

## Réalisation

- Composants communs (`apps/web/src/components/BarreOutils.tsx`) : `BoiteOutils`, `FiltresAvances`, `FiltreColonne`,
  `IconeFiltre` ; `APropos` dans `packages/ui/src/components.tsx`.
- Feuille dédiée chargée en dernier : `packages/ui/src/neon-ergonomie.css` (en-tête compact, titres d'une seule taille,
  marge haute, boîte d'outils, filtres de colonnes, lueur de la recherche, règle téléphone).
- Écrans migrés : plan d'actions et tâches récurrentes ; registre commun du Pilotage (preuves, applicabilité, continuité,
  contrôles, revues, amélioration…) ; registres et éléments par périmètre ; fournisseurs, critères fournisseurs, processus,
  parties intéressées, bibliothèque, objectifs ; registre et cartographie des risques ; couverture et organisation de
  l'audit ; documents et liens ; parcours ISO. Explications repliées : fournisseurs, périmètres, parcours ISO, DdA,
  incidents, imports, fournisseurs du périmètre, études EBIOS RM, publication.
- Critères sur les titres de colonnes : État, Responsable, Échéance (registre commun, plan d'actions), Famille (registres),
  Type (fournisseurs), Démarche, Étude, Option, Acceptation (risques), référentiel et écarts (couverture).
- Non migrés, avec la raison : recherche de la Cartographie du SMSI (recherche sur la carte, pas un filtre de liste),
  palette de la carte, champs de recherche situés dans des fenêtres (références, justificatifs, liens).

## Points laissés à la décision du RSSI

1. Processus : retirer le bandeau « Périmètre affiché » qui répète le sélecteur de l'en-tête (un test unitaire le lit).
2. Éléments par périmètre : le périmètre, obligatoire, est dans les filtres avancés avec une ligne d'aide ; l'autre choix
   est de le laisser visible.
3. Documents : Catégorie et Étiquettes sur les titres de colonnes (demande d'étendre le filtre de colonne au choix multiple).
4. Suite du relevé : taille commune des fenêtres, champs de tableau coupés, tuile de l'assistant, densité de Processus,
   titre en double dans les cartes de Plateforme et de Configuration système.

## Contrôles

Prettier, ESLint, `tsc` (web, e2e), Vitest web (423 tests, Node 26 et paquet partagé reconstruit), largeur sans débordement
à 390 px sur sept pages, vidéo de test de la boîte d'outils sans erreur de page. Suite de bout en bout et captures de
référence : CI de la PR ; les captures modifiées seront présentées au RSSI avant remplacement.
