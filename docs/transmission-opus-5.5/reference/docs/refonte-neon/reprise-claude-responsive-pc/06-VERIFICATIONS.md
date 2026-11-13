# Vérifications réellement effectuées

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

## Nouvelle proposition indépendante

Le rendu utilise Chromium système et des fichiers HTML/CSS/JS statiques locaux. Aucun appel API métier et aucune erreur JavaScript observés dans les parcours de maquette contrôlés.

Le premier contrôle couvre vingt dispositions, deux thèmes et des fenêtres de 320 à 3840 px, avec menu de vue, filtres, changement de période, maintien de la vue au redimensionnement et défilement propre à la liste. Sept analyses Axe ciblées n’ont détecté aucune violation. Ces essais incluaient les premiers rendus mobiles, réalisés avant que le demandeur précise que le téléphone n’était pas important.

Un contrôle complémentaire **PC** accompagne la dernière finition des métadonnées et contrastes : captures portable, bureau, grand écran et fenêtre 1024 px ; liste et Kanban. Ses résultats exacts sont dans `maquettes/docs/refonte-neon/propositions/responsive-equilibre/controles-pc.json`. Le rapport général est `controles.json` dans le même dossier. Un premier contrôle exigeait un défilement même lorsque toutes les lignes tenaient sur grand écran ; le contrôle final distingue correctement ce cas sans inventer un besoin de défilement.

La proposition utilise la même situation entièrement fictive : 8 actions, 6 séries, 8 occurrences au 11 novembre 2026. Les captures sont natives, sans retouche ni génération d’image.

**Aucun build, test unitaire applicatif, E2E applicatif ou essai Docker n’a été lancé pour la nouvelle finition non validée.** Les zooms et les vrais droits/écritures restent à contrôler lors de l’intégration ; une analyse Axe de maquette n’est pas une certification d’accessibilité de toute l’application.

## Résultats historiques de l’application livrée

Le lot `23b33b5` a son compte rendu dans `docs/refonte-neon/LIGNES-ET-VALIDATION-RAPIDE.md` de l’archive source : 265 tests web, 243 UI, 31 API et 14 E2E finaux réussis, avec les autres contrôles et limites détaillés dans ce rapport. Ces résultats sont historiques et n’ont pas été rejoués pour la maquette responsive.

Le Docker interfaces compilé avait été vérifié dans l’environnement Linux de travail avec données fictives et ouverture directe. L’installation complète Docker Desktop Windows et la recette humaine du demandeur ne sont pas présentées comme exécutées ici.

## Dossier de reprise

L’empreinte de l’archive source est contrôlée lors de la construction du dossier. Le manifeste SHA-256 et le contrôle CRC de l’archive de reprise permettent de vérifier l’intégrité des fichiers fournis. Ces contrôles portent sur la livraison de fichiers, pas sur l’intégration de la nouvelle interface.
