# Vérification de la maquette 022

Le 19 octobre 2026 : **22 contrôles locaux réussis** avec Chromium/Playwright. [Résultats détaillés](../maquettes/v001-acces-visuels/technique/verification.json) · [Script](../maquettes/v001-acces-visuels/technique/verifier.cjs).

Couverts : un registre détaillé, Collaborateur sans création, fenêtre centrale, cumul des droits directs/groupes, origine, avant/après et motif, impact d’un changement de groupe, projection autorisée, écarts sans opération de réalisation, filtres/état vide, menu fixe, mobile, Escape et absence d’erreur JavaScript. Six captures inspectées ou générées depuis la même version.

Pour reproduire : servir le dossier v001 sur localhost puis lancer le script Node. Variables possibles : `PREVIEW_URL`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` ; les chemins par défaut correspondent à l’environnement de capture. Aucun backend lancé ou testé. Pas d’audit d’accessibilité exhaustif ni de test de sécurité serveur.
