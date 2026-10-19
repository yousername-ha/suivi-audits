# Tests — Périmètres

## v007 — contrôle visuel

[Contrôle de capture](../maquettes/v007-fond-uni/verification.json) : aucun motif de fond, teinte conservée et aucune erreur JavaScript. Aucun nouveau test fonctionnel pour cette modification CSS.

## v006 — historique, exécutés le 19 octobre 2026

[Rapport](../maquettes/v006-ecarts-dashboard-compact/technique/verification.json) · [Script](../maquettes/v006-ecarts-dashboard-compact/technique/verifier.cjs).

Couleurs calculées vérifiées, troisième catégorie présente, badges sans débordement. Comparaison v005/v006 dans le même navigateur : largeur des cartes inchangée, hauteur des périmètres réduite de 12 px, fournisseur réduit de 1 px en hauteur. Les contrôles existants de flux, réciprocité et compteurs passent également. Un premier contrôle avait détecté 2 px ajoutés au fournisseur par les bordures ; le padding a été corrigé et le contrôle a ensuite réussi. Aucune intégration backend testée.

## v005 — historique, exécutés le 19 octobre 2026

[Rapport v005](../maquettes/v005-flux-mini-dashboard/technique/verification.json) · [Script](../maquettes/v005-flux-mini-dashboard/technique/verifier.cjs).

Quatorze groupes de contrôles réussis, dont compteurs filtrés, modal détaillée et état vide, sens des chemins, animation CSS, pause, mouvement réduit, symétrie, ajout d’un lien lors d’une création et non-régression liste/graphique. Trois PNG et un GIF de 24 images. Ces contrôles portent sur la maquette, sans intégration backend.

## v004 — historique, exécutés le 19 octobre 2026

[Rapport v004](../maquettes/v004-conformite-fournisseurs/technique/verification.json) · [Script](../maquettes/v004-conformite-fournisseurs/technique/verifier.cjs).

Onze contrôles passent : taux fictifs et non-évalué, identité fournisseur hors hiérarchie, héritage, défilement fixe, déduplication des plans, fenêtre centrée, modification de l’héritage, création et échappement des entrées, création/modification réciproques dans liste et graphique (même identifiant), remise à zéro au rechargement, mobile et absence d’erreurs JS. Les groupes détaillés figurent dans le rapport. Quatre captures en 1600 × 1340.

Le contrôle de réciprocité a détecté un panneau partagé dupliqué au rafraîchissement ; le sélecteur DOM a été corrigé et le parcours complet a ensuite réussi. Aucune intégration backend ou synchronisation multi-session testée.

## v003 — historique, exécutés le 19 octobre 2026

[Rapport](../maquettes/v003-gestion-graphique/technique/verification.json) · [Script reproductible](../maquettes/v003-gestion-graphique/technique/verifier.cjs).

Neuf contrôles de la source de rendu ont réussi sous Chromium/Playwright : héritage visible B et gestion locale C, défilement indépendant, union A+B sans doublon de plan, fenêtre centrée, désactivation simulée de l’héritage, création en mémoire et échappement du texte, réinitialisation au rechargement, vue mobile 390 px, absence d’erreur JS. Les cinq captures sont produites en 1600 × 1060.

Il ne s’agit pas d’une recette du backend ou de l’application intégrée. Aucun test n’a été lancé dans Claude. La validation utilisateur reste à recueillir, notamment sur la relation fournisseur.

## Historique

[Contrôles des anciennes captures](../../../references/vues-modules/technique/verification.json), conservés sans leur attribuer la validation de v003.

## À tester lors de l’intégration

Droits serveur et accès refusés, cycles et profondeur, exceptions locales de référentiels, versionnement concurrent, agrégations autorisées, contrats de chaque registre, données volumineuses, navigation clavier et lecteur d’écran, mobile, états de chargement/erreur/vide. Consigner le SHA et l’environnement effectivement testés.
