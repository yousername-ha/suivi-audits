# Contrôles de la maquette

[Rapport commun](../../_prototype-transversal/demarrage-parcours-v1/verification.json) · [Script reproductible](../../_prototype-transversal/demarrage-parcours-v1/verifier.cjs).

Le rapport couvre les deux prototypes sur Chromium, données fictives : report et reprise, choix des échelles, confirmation, arbre/liste, revue simulée, séparation des périmètres, mobile et défilement. Aucun test backend, audit normatif exhaustif, certification, test Windows ou audit complet de lecteur d’écran revendiqué.

Servir la racine du dépôt sur `http://127.0.0.1:19120`. Installer Playwright à l’extérieur du dépôt et définir NODE_PATH si nécessaire ; définir CHROMIUM_PATH si Chromium n’est pas `/usr/bin/chromium`. Lancer le script depuis la racine. Il régénère les captures de démonstration et le rapport commun.

## v002 — onboarding et sous-actions

[24 contrôles exécutés](../../_prototype-transversal/demarrage-parcours-v2/verification.json) · [Script](../../_prototype-transversal/demarrage-parcours-v2/verifier.cjs). Dépliage/repliage, repositionnement sans collision, attendu spécifique, liens officiels, clavier et retour du focus, vue liste, mobile, report et reprise du brouillon. Le déclenchement automatique côté serveur après création admin n’est pas implémenté dans cette maquette.
