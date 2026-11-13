# Bibliothèque Studio et Assistant Neon — intégration après validation

12/11/2026 (Europe/Paris). Branche isolée `codex/refonte-neon-main`, base `c8e32a0`. Le « Top » du demandeur valide les derniers visuels de bibliothèque et d’assistant. Ce lot les porte dans le frontend existant. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

[Navigation finale proposée séparément](propositions/menu-final/README.md). Le menu de l’application conserve ici son état antérieur ; l’habillage global du menu n’est pas inclus dans ce portage validé.

## Résultat et résumé technique pour reprise IA

- `packages/ui/src/neon-bibliotheque.css` porte la grille identité/couverture de la proposition : nom/version/catalogue à gauche, états du périmètre à droite, contours présents, tailles intermédiaires et liste à défilement propre. Panneaux des noms plus soutenus dans le thème clair, états distincts et valeurs inchangées. Icône flottant ±0,6 px sur 6 s, survol −2 px, réduction du mouvement respectée.
- `BibliothequeStudio.tsx` ajoute uniquement la classe `bb-warning-clauses` au bandeau des clauses obligatoires non conformes. Seul ce bandeau reçoit la pulsation demandée (5,5 s, halo limité à 3 px/9 %, texte immobile) ; l’avertissement d’applicabilité à déterminer garde son traitement normal. Aucun changement de requête, formule, données, droits, formulaire, évaluation, historique ou `If-Match`.
- `IdentiteAssistant.tsx` redessine le bouclier/bulle en SVG 96×96 : pas d’image raster ni de filtre diffus, traits renforcés, dégradés dont les IDs utilisent `useId`. Aucun HTML injecté, simulateur de réponse ou code de la maquette copié dans le service réel.
- `packages/ui/src/neon-assistant.css` porte le cadre de 2 px, les contours intérieurs de 1,5 px, les accents cyan/bleu et l’avatar plus grand (60 px dans l’en-tête, 48 px selon l’espace, 32 px dans les messages). Cycle d’opacité du circuit de 7 s, clignement de 9 s ; miniatures de message statiques. Le bouton de pause existant et la préférence de mouvement réduit commandent les nouveaux groupes SVG.
- Les couleurs du SVG résident dans la feuille de charte via des classes, jamais directement dans le JSX. `AssistantGlobal.tsx`, ses contrats, profils, brouillons, droits, décisions, limites, CSRF et raccordement serveur restent inchangés. La pause des rondes demeure distincte du quota et de la discussion. Le backend de la branche assistant n’est pas fusionné.
- `tests/e2e/interface/assistant-global.spec.ts` étend le parcours existant : SVG sans filtre/image raster, IDs uniques et pause/reprise/réduction des nouvelles animations. `bibliotheque-unifiee.spec.ts` vérifie également l’arrêt du bandeau ambre avec la réduction du mouvement. Les assertions fonctionnelles existantes sont conservées.

Aucun schéma partagé, dépendance, API/backend, migration, préférence de menu, export métier, Docker, ZIP ou archive Assistant existante modifié. Cartographie, canevas et génération automatique intacts.

## Vérifications réellement exécutées

- 289 tests web (36 fichiers) et 246 UI (5 fichiers) réussis sur les sources finales. TypeScript web/E2E, ESLint et format ciblés réussis.
- Build frontend Vite réussi. Avertissements préexistants : script `/update/client.js` non-module et gros bundles ; aucun seuil augmenté.
- 25 parcours du frontend compilé réussis sur le dernier build : 10 Assistant, 8 Bibliothèque et 7 Fournisseurs. **API exclusivement fictive et interceptée**, sans base ni appel Mistral. Droits UI, conservation des formulaires/brouillons, requêtes strictes/CSRF/If-Match et erreurs restent couverts, sans prétendre valider les gardes du vrai serveur.
- Ces suites contrôlent 12 vues Axe au total (catalogue/détail, discussion/boîte et fournisseurs, deux thèmes), sans violation détectée. Pas une certification exhaustive d’accessibilité.
- Deux parcours complémentaires de capture réussis : 16 dispositions PC par module, de 1024×768 à 2560×1440 dans les deux thèmes, contrôle Assistant à taille d’affichage 150 %, pas de débordement horizontal mesuré et défilement propre. Une analyse Axe supplémentaire Dashboard + Assistant sombre sans violation. Quatre captures natives 3840×2160.

Commandes : `vitest run` dans web/UI, `tsc -p apps/web/tsconfig.json --noEmit`, `tsc -p tests/e2e/tsconfig.json --noEmit`, build Vite web ; puis `E2E_UI_URL=http://127.0.0.1:5220 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/node_modules/@playwright/test/cli.js test --config tests/e2e/playwright.interface.config.ts bibliotheque-unifiee.spec.ts fournisseurs-studio.spec.ts assistant-global.spec.ts`. Serveur de fichiers compilés sur boucle locale, aucun service métier démarré.

Incidents corrigés : le contrôle de charte a relevé 13 couleurs dans le JSX du SVG ; déplacées dans le CSS sans affaiblir ce contrôle, puis 289 tests verts. Le script privé de capture manquait de `package.json` avec `type: module`, provoquant une erreur de transformation ESM ; configuration privée corrigée, puis deux captures/parcours verts. Une première recette frontend était verte avant le déplacement des couleurs ; les 25 parcours ont été rejoués avec succès sur le build final après cette correction.

## Visuels intégrés et limites

- Bibliothèque : [clair](preuves/studio-integre/bibliotheque-clair-hd.png) et [sombre](preuves/studio-integre/bibliotheque-sombre-hd.png).
- Assistant : [clair](preuves/studio-integre/assistant-clair-hd.png) et [sombre](preuves/studio-integre/assistant-sombre-hd.png).
- [Contrôles et empreintes](preuves/studio-integre/controles.json).

Les captures affichent le **menu antérieur**, distinct de la proposition finale à valider. Ne pas les présenter comme une intégration du nouveau menu. Le logo SVG/PNG HD de la proposition reste disponible dans son dossier ; l’application affiche la géométrie vectorielle dans React.

**Non exécutés :** DB/API réels, Mistral, extraction documentaire/RAG, rondes réelles, Docker Desktop/Windows, CI distante, push, fusion, déploiement ou nouvelle archive. Prochaine action : réponse sur le menu final, puis harmonisation limitée à la sidebar du cadre existant ; ne pas remplacer sa logique de droits/ordre/alertes par les tableaux statiques de maquette.
