# Recette du prototype 021

[Résultats réellement exécutés](../maquettes/v002-creation-depuis-audit/technique/recette.json) : 24 contrôles, zéro erreur JavaScript, neuf captures. Parcours de création, liens multiples, clôture, conformité, réouverture, sauvegarde/restauration, CSV, filtrage et mobile.

Recette portable : `node fonctionnalites-en-developpement/021-registres-ecarts/maquettes/v002-creation-depuis-audit/technique/registres.cjs` depuis le dépôt, avec Playwright et Chromium (`CHROMIUM_EXECUTABLE` si nécessaire). Elle démarre un serveur local temporaire et utilise seulement des données fictives.

Limites : BAT non exécuté nativement sous Windows ; prototype local, sans serveur métier. La réussite technique ne constitue pas une validation utilisateur.

Contrôles ajoutés : création depuis audit dans un registre existant sans duplication ; création atomique registre + écart ; audit sans registre, annulation sans effet et filtrage des exigences par périmètre.
