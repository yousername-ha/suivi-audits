> **Suite du 12/11/2026 : visuels validés par « Top », puis portés dans le frontend existant.** Voir [intégration, tests et captures natives](../../BIBLIOTHEQUE-ASSISTANT-NEON-INTEGRES.md). Le présent dossier conserve la proposition et ses preuves de maquette.

# Assistant RSSI — proposition Neon Studio

12/11/2026 (Europe/Paris). **Proposition autonome à valider, non intégrée.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur souhaite un assistant plus néon, dans le style SWOT, légèrement animé, avec des contours présents et un logo net. Ce dossier prépare uniquement l’habillage et l’identité ; aucune évolution du service Mistral ou du menu n’est engagée.

[Clair HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/assistant-neon/assistant-clair-hd.png) · [Sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/assistant-neon/assistant-sombre-hd.png) · [Vidéo](assistant-animation.mp4) · [Aperçu interactif](apercu-autonome.html) · [Avatar SVG](avatar-hd.svg) · [Avatar PNG transparent 1024×1024](avatar-1024.png).

## Présentation proposée

Panneau à angles asymétriques comme les dalles SWOT, cadre cyan/bleu de 2 px et filets de 3 px. Réponses, questions et champ de saisie ont des contours de 1,5 px ; les petites icônes passent de 1,5 à 1,9 px de trait. Fonds légèrement teintés et ombres limitées, sans filtre de flou sur l’avatar. Les couleurs d’état conservent leur rôle : ambre pour une question attendue, bleu pour une source, cyan pour le compagnon.

L’avatar conserve le bouclier et la bulle de discussion, redessinés en SVG avec traits plus présents et repères de circuit. En-tête 60 px (48 px en fenêtre basse/étroite), lanceur 48 px, miniature de message 32 px. SVG indépendant de la résolution et PNG natif 1024×1024 fournis. Ce symbole est l’avatar original du compagnon, pas une marque officielle Mistral.

Animation limitée : variation lente d’opacité du circuit sur 7 secondes et clignement discret des yeux sur 9 secondes. Les miniatures des réponses restent statiques ; ni réponse ni source ne sont animées pour simuler une activité. Survol des petites commandes : relief d’un pixel. Bouton de pause conservé et réduction du mouvement système respectée.

## Résumé technique pour une IA connaissant le code

- **Maquette et documentation uniquement** depuis `5ba1150`, aucun fichier `apps/`/`packages/`, API, backend, dépendance, droit ou donnée réelle modifié. L’application conserve le portage Assistant existant et la bibliothèque précédemment intégrée.
- `index.html` réutilise le décor fictif et les commandes de `assistant-global`, avec une feuille supplémentaire `neon.css`. Le Dashboard d’arrière-plan reste illustratif, sans refonte proposée du Dashboard ou du menu.
- `neon.css` ne cible que les composants `as-*`/`an-*` de l’assistant : cadres, en-tête, réponse, saisie, sources, avatar et mouvements. Pas de marge/canevas de cartographie modifié. Le dock reste global, borné et non modal ; fil, boîte et détails conservent leur défilement propre.
- `avatar-hd.svg` est une source vectorielle sans image embarquée, flou ou filtre raster. `avatar.js` expose la même géométrie pour la maquette ; `avatar()` dans `assistant.js` remplace le jeton d’identifiant pour chaque instance, évitant les collisions de dégradés. `an-orbit`/`an-eyes` sont contrôlés par le bouton de pause existant et `prefers-reduced-motion`.
- Le script local `assistant.js` reprend l’état fictif de la proposition historique : profils, fils, brouillons, sources, questions, rappels, propositions et missions. **Correction de compatibilité conservée : `enPause` suspend les rondes, ne bloque pas le chat.** Le quota de la maquette est désormais un état explicite de disponibilité de recette, distinct de cette pause. Ne pas porter cet état de démonstration comme un nouveau DTO serveur.
- Le backend de `claude/assistant-rssi` n’est pas fusionné ni sollicité. Les données réutilisées sont fictives ; elles ne prouvent pas extraction documentaire/RAG, rondes ou réponses Mistral opérationnelles. Le [rapport du frontend intégré](../../ASSISTANT-RSSI-GLOBAL-INTEGRE.md) et les contrats existants restent la référence pour le raccordement réel.
- `exporter.py` assemble CSS/JS/police dans `apercu-autonome.html`. Cet HTML est destiné à la consultation, pas à copier des scripts en ligne sous la CSP applicative.

## Vérifications exécutées sur cette proposition

13 parcours de maquette réussis : brouillons/navigation/fermeture/focus ; profils et historique ; réponse asynchrone dans le bon fil ; réponse à une question avec conservation de saisie sur échec ; rappel/avis ; examen/confirmation et rejet d’une proposition ; gardes UI ; mission ; sources/clavier ; indisponibilité/quota/périmètre avec pause des rondes distincte ; limites 4000/2000 ; pause et mouvement réduit.

16 dispositions PC en clair/sombre, de 1024×768 à 2560×1440, dont 1920×800 : panneau et compositeur dans l’écran, fil à défilement local, pas de débordement mesuré. Quatre analyses Axe Discussion/Pour vous en clair/sombre sans violation détectée ; pas une certification exhaustive d’accessibilité. Aucun appel API ni erreur JavaScript dans la recette. Export autonome sans ressource distante contrôlé séparément.

Mouvement mesuré : circuit à 0,65/1 d’opacité, cycle 7 s ; yeux 9 s ; pause manuelle et arrêt système effectifs. Avatar sans filtre CSS ni image raster et identifiants SVG uniques. ESLint ciblé et Prettier ciblé `--ignore-path /dev/null` réussis. Deux captures natives 3840×2160 (viewport 1920×1080, densité 2), avatar PNG 1024×1024, vidéo issue de 48 captures natives avec durées réelles préservées. Résultats/empreintes dans [controles.json](controles.json), mouvement dans [animation.json](animation.json).

**Non exécutés :** intégration/build/tests applicatifs, vraie API/DB/Mistral, extraction de documents, Docker/Windows, nouvelle archive Assistant ou ZIP, CI distante, push, fusion ou déploiement. Les tests historiques du frontend intégré ne sont pas réattribués à cette maquette.

Suite : avis sur le visuel, puis portage graphique autorisé dans `IdentiteAssistant.tsx` et `packages/ui/src/neon-assistant.css`, en conservant `AssistantGlobal`, contrats, droits, limites, sources réelles et état global. Le fichier applicatif est déjà en SVG ; sa petite taille et son `drop-shadow` sont constatés, sans prétendre avoir mesuré la cause exacte du flou sur l’écran du demandeur. Ne pas remplacer le service par le simulateur de ce dossier.

Validation préalable selon [AGENTS.md](../../../../AGENTS.md) : « Présenter d’abord une proposition visuelle isolée et attendre sa validation explicite. » La bibliothèque reçoit dans un lot de maquette distinct le fond de nom plus soutenu et le contour ambre lentement animé. Menu et cartographie restent hors du périmètre.
