# Sources de l’implémentation de départ

Le code est fourni directement dans la branche, sans duplication dans ce dossier. Ces liens permettent de comparer les
fichiers à ceux de la version cible. Ne pas appliquer leur remplacement complet sans examiner les différences.

- [apps/web/src/components/FichesSansDefilement.tsx](../../../apps/web/src/components/FichesSansDefilement.tsx) — Prototype de navigation des fiches longues ; champ conservé dans son DOM/formulaire.
- [apps/web/src/main.tsx](../../../apps/web/src/main.tsx) — Installation unique du composant et ordre des feuilles CSS.
- [packages/ui/src/neon-fiches-pages.css](../../../packages/ui/src/neon-fiches-pages.css) — Parties, actions maintenues en bas, tableaux et commandes transparentes.
- [packages/ui/src/theme.ts](../../../packages/ui/src/theme.ts) — Ordre des aides, classes des champs, commandes en contour, noms accessibles.
- [packages/ui/src/proportions-champs.ts](../../../packages/ui/src/proportions-champs.ts) — Classification visuelle des champs ; repli à vérifier pour les données ambiguës.
- [packages/ui/src/neon-harmonisation.css](../../../packages/ui/src/neon-harmonisation.css) — Proportions, menus, alignements, centrage des pictogrammes.
- [packages/ui/src/neon-ergonomie.css](../../../packages/ui/src/neon-ergonomie.css) — Tailles et ergonomie commune.
- [packages/ui/src/neon-fenetres.css](../../../packages/ui/src/neon-fenetres.css) — Cadre des fenêtres, corps et pieds ; rayons des commandes.
- [packages/ui/src/neon-densite.css](../../../packages/ui/src/neon-densite.css) — Application des profils de densité.
- [packages/ui/src/tokens.ts](../../../packages/ui/src/tokens.ts) — Source des jetons et profils de densité.
- [packages/ui/src/neon-verre.css](../../../packages/ui/src/neon-verre.css) — Verre des onglets et commandes communes.
- [apps/web/src/components/BarreOutils.tsx](../../../apps/web/src/components/BarreOutils.tsx) — Boîte commune, vues, recherche, filtres et raccourcis.
- [apps/web/src/components/BarreFiltres.tsx](../../../apps/web/src/components/BarreFiltres.tsx) — Adaptateur des champs/menus existants ; conserve les contrats.
- [apps/web/test/proportions-champs.test.ts](../../../apps/web/test/proportions-champs.test.ts) — Contrats des champs, aides et boutons.
- [packages/ui/package.json](../../../packages/ui/package.json) — Export des feuilles ; aucune nouvelle dépendance.

## Complément intégré après validation de la direction sobre

- [DescriptionChamp.ts](../../../packages/ui/src/DescriptionChamp.ts) — aide React native, identifiants et clavier Mantine.
- [neon-fiches-sobres.css](../../../packages/ui/src/neon-fiches-sobres.css) — habillage commun et descriptions repliées uniquement dans les fiches.
- [ProduitsSurveilles.tsx](../../../apps/web/src/vulnerabilites/ProduitsSurveilles.tsx) — Annuler relié à la fermeture existante de l’éditeur.
- [Dossier et preuves d’intégration](../integration-fiches-sobres-2026-11-22/README.md) — référence récente, limites et captures.
