# Contrôles de la maquette

[Rapport commun](../../_prototype-transversal/demarrage-parcours-v1/verification.json) · [Script reproductible](../../_prototype-transversal/demarrage-parcours-v1/verifier.cjs).

Le rapport couvre les deux prototypes sur Chromium, données fictives : report et reprise, choix des échelles, confirmation, arbre/liste, revue simulée, séparation des périmètres, mobile et défilement. Aucun test backend, audit normatif exhaustif, certification, test Windows ou audit complet de lecteur d’écran revendiqué.

Servir la racine du dépôt sur `http://127.0.0.1:19120`. Installer Playwright à l’extérieur du dépôt et définir NODE_PATH si nécessaire ; définir CHROMIUM_PATH si Chromium n’est pas `/usr/bin/chromium`. Lancer le script depuis la racine. Il régénère les captures de démonstration et le rapport commun.

## v002 — onboarding et sous-actions

[24 contrôles exécutés](../../_prototype-transversal/demarrage-parcours-v2/verification.json) · [Script](../../_prototype-transversal/demarrage-parcours-v2/verifier.cjs). Dépliage/repliage, repositionnement sans collision, attendu spécifique, liens officiels, clavier et retour du focus, vue liste, mobile, report et reprise du brouillon. Le déclenchement automatique côté serveur après création admin n’est pas implémenté dans cette maquette.

## v003 — arbre organique fonctionnel

[40 contrôles exécutés](../maquettes/v003-arbre-organique/verification.json) · [Script reproductible](../maquettes/v003-arbre-organique/verifier.cjs). Tests Chromium sur HTTP local : 16 fiches et 26 sous-actions, revue, synchronisation locale entre parcours et module simulé, persistance, isolation des périmètres, recherche, HDS, zoom, clavier, menu fixe, mobile, mouvement réduit et refus de stockage.

Servir la racine du dépôt à `http://127.0.0.1:19120`, puis lancer le script avec Node et Playwright installé hors du dépôt. `ASTRA_PREVIEW_URL` permet de changer l’URL. Chromium attendu à `/usr/bin/chromium`. Aucun appel backend ni test Windows réel. L’ouverture `file://` est bloquée par la politique de ce navigateur géré ; elle n’a pas été contournée. L’HTML ne charge aucune ressource externe pour fonctionner.

## v004 — style de référence fonctionnel

[56 contrôles exécutés](../maquettes/v004-style-reference/verification.json) · [Script reproductible](../maquettes/v004-style-reference/verifier.cjs). Composition 1280 × 720, sélection des 11 raccourcis, fiche compacte repliable, attendus centraux, 16 étapes/26 sous-actions conservées dans la liste, préparation/revue, données réciproques, persistance, isolation, filtre HDS, clavier, reset, mobile et stockage refusé. Exécution via HTTP local avec Chromium, aucune intégration backend ou vérification Windows revendiquée.

## v005 — animations discrètes

[Rapport exécuté](../maquettes/v005-brume-lueurs/verification.json) · [Script](../maquettes/v005-brume-lueurs/verifier.cjs). La recette de v004 est reprise et complétée par la comparaison géométrique, la présence de brume, le déplacement mesuré des lueurs, les halos, l’arrêt manuel, sa persistance et le mouvement réduit. Les assertions attendent les changements effectifs de styles et la fermeture du dialogue. Hébergement privé validé séparément par le service Sites.

## v006 — plus/minus et enfants

[Rapport exécuté](../maquettes/v006-sous-branches/verification.json) · [Script](../maquettes/v006-sous-branches/verifier.cjs). Recette existante complétée par les 11 commandes de dépliage, leurs liens et enfants, une seule branche ouverte, absence de collision avec la carte, clic parent distinct du plus, attendus enfants, retour du focus, repli, clavier, changements rapides, modes d’animation et interaction mobile. Aucun essai sur téléphone physique revendiqué.
