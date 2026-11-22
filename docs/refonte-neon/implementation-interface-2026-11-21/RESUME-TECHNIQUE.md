# Résumé technique pour l’IA qui reprend

Remise du 22/11/2026, Europe/Paris. Session « Codex » (`01a193c1-316c-7677-831f-2f31592aa052`).
Branche source : `codex/refonte-densite-2026-11-21` ; PR de travail : [#355](https://github.com/yousername-ha/suivi-audits/pull/355).
Base intégrée : `01130ce47e0e2fa92fb4ef0efc233aff7d965126` (7.5.1). Le code de la version cible doit être comparé avant report.

## Ce qui a changé

| Partie | Implémentation et raison |
| --- | --- |
| Densité | Jetons communs et CSS statique : normal plus resserré que l’ancien compact, compact encore réduit, tailles explicites et mural conservés. |
| Navigation et outils | Bascule de thème en icône, en-tête épuré, onglets transparents ; `BarreOutils`/`BarreFiltres` raccordent les contrôles existants sans changer leurs callbacks. |
| Fenêtres et champs | Cadre commun, alignements à gauche, aides sous les saisies, grilles fondées sur la largeur disponible, formats de champ différenciés. Commit des proportions : `2742e16`. |
| Menus déroulants | Menus Mantine bornés, options longues sur plusieurs lignes ; attention aux classes spécifiques Select/MultiSelect. Les menus natifs restent gérés par le navigateur. |
| Commandes | `Button` reçoit `outline` par défaut ; `commande-neon` porte le contour bleu/cyan transparent. Les couleurs métier explicites sont conservées. Rayon plus discret dans les fenêtres. |
| Fiches longues | Nouveau `FichesSansDefilement`, installé une fois sous Mantine ; prototype de mini-menu et de fragmentation horizontale, à finaliser. |
| Branchement | Import final de `neon-fiches-pages.css` dans `main.tsx`, export du CSS dans `packages/ui/package.json`. Aucune dépendance ajoutée. |
| Contrats | Tests SSR dans le paquet web, qui possède déjà les dépendances : aides associées, valeurs et formulaires, cas de champs longs, variantes et soumission des boutons. |

[Liste cliquable des sources](SOURCES.md). Les empreintes SHA-256 fournies rattachent les preuves aux fichiers examinés.

## Architecture du prototype de mini-menu

Un observateur repère les fenêtres Mantine, y compris leurs portails, en excluant le tiroir de navigation. Si le corps
ne tient pas, une navigation est rendue dans un hôte dédié. Le CSS présente le contenu en colonnes ; les champs restent
montés, dans leur DOM et leur formulaire d’origine. Le changement de partie utilise le défilement horizontal programmatique.
Le focus et la validation peuvent sélectionner la partie d’un champ. Les observateurs suivent contenu, taille et préférences.

Le repérage du pied utilise `.fenetre-actions` ou un dernier groupe direct. Les pieds atypiques nécessitent une adaptation.
La table de stress a révélé un débordement lié aux conteneurs de tableau ; le CSS a été adapté, puis le contrôle rejoué.
Cette technique reste un **prototype**, pas un remplacement terminé de chaque formulaire.

## Invariants à préserver

Aucun changement des contrats API, authentification, droits, stockage, concurrence, calculs ou génération SMSI.
Aucune donnée de recette dans le produit ; les captures utilisent uniquement une API interceptée et des exemples fictifs.
Ne pas reconstruire les pages validées à partir des images si le code correct existe déjà. Ne pas remplacer une branche
plus récente par cette version. Aucun changement de version, migration, image Docker, fusion ou déploiement effectué.

## Résultat des contrôles et portée

- 936 tests web + 285 UI : **1 221 tests distincts réussis**. TypeScript web/UI, lint, format et build contrôlés.
- Dernières campagnes client : **11 cas de pages, 27 ouvertures de 7 variantes** à 1280×720, 1440×900,
  1920×1080 et 3840×2100 ; clair/sombre et normal/compact représentés, pas toutes les combinaisons.
- Tests de présentation supplémentaires : fournisseur avec 20 contrôles fictifs, tableau synthétique de 60 lignes.
- Pas de recette Docker/API/base ou E2E serveur, ni de validation humaine. Les inventaires 127 fenêtres / 710 saisies
  ne signifient pas que chaque écran a été testé.

Les métriques sans débordement ne valident pas toute coupure visuelle. Les limites de partie, les sections presque vides
et les titres génériques/répétés sont à corriger. Voir [la recette et les limites](INTEGRATION-ET-RECETTE.md).

## Prochaine action précise

Comparer la version actuelle à ces sources, relever présent/partiel/absent/différent, puis terminer les mini-menus par
sections cohérentes et une hauteur adaptée. Vérifier chaque famille de fiche, pieds et listes dynamiques compris,
avec valeurs conservées, focus, erreurs, permissions et soumission. Produire les captures réelles pour le RSSI, puis les
contrôles du dépôt sur une pile isolée. Livrer la PR et un nouveau résumé technique, sans fusionner ni publier de version.
