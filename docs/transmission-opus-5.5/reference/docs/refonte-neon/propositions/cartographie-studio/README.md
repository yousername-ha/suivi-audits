# Cartographie du SMSI — proposition Studio

12 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**NON RETENUE — NON INTÉGRÉE.** Décision explicite du demandeur le 12 novembre 2026 : conserver la cartographie actuelle, son aspect visuel et sa génération automatique. Au plus, harmoniser son habillage avec la charte Neon sans réorganiser la carte ni modifier son fonctionnement. Ce dossier reste un historique de proposition, pas une spécification d’intégration. Les visuels, sources et résultats ci-dessous décrivent cette proposition écartée ; ils ne valent pas validation humaine.

Application inchangée à `67a334a` ; la proposition Rôles (`166990f`) conserve son statut distinct. Aucun accord déduit pour une autre maquette.

[Une image HD sombre](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/cartographie-studio/cartographie-hd.png) · [Aperçu interactif autonome clair/sombre](apercu-autonome.html) · [Contrôles](validation.json).

## Présentation préparée

- Deux petits boutons de vue : contexte et processus ; recherche à la demande, filtres référentiel/nature, pause et agrandissement de l’espace de carte. Les valeurs ne sont pas persistées.
- Contexte : SMSI et périmètre au centre, parties intéressées et enjeux à gauche, applications/SI et fournisseurs à droite. Internes et externes ont des rubriques distinctes. Les listes gardent leur défilement local ; la page ne défile pas dans les fenêtres contrôlées.
- Quatre liaisons orthogonales regroupent les relations métier par famille, avec des couloirs réservés. Chaque trait existe seulement si au moins une relation source correspond aux objets visibles et à sa cible réelle. Les traits sont agrégés : ils ne représentent pas quatre relations individuelles. Le détail donne les relations individuelles, leurs sources et leurs destinations.
- Deux segments décoratifs suivent lentement les tracés. Ils ne signifient ni événement ni avancement. Pause et préférence de mouvement réduit respectées.
- Un clic sur chaque objet ouvre la consultation. Les relations de cette fiche sont navigables ; Échap ferme et rend le focus à l’objet initial. Aucune saisie ni écriture n’est simulée.
- Vue processus : familles Pilotage, Réalisation, Support ; sous-processus identifiés par leur code et leur retrait. Aucun flux entre familles inventé. La hiérarchie et les relations sont consultables dans les fiches.
- Ajustement PC : textes de 13–15 px pour les objets, disposition et hauteur adaptées. À 1920×1080, les contours complets des dalles sont conservés. Les fenêtres plus basses gardent un défilement dans l’espace carte ; le téléphone reste non prioritaire.

## Données et portée des chiffres

`donnees.js` est une copie figée issue du **jeu fictif** `tests/fixtures/carto-donnees.json`, préparée avec les fonctions `buildObjects(..., { org: 'Organisation fictive', details: true })` et `deriveRelations()` de `packages/shared/dist/carto/objects.js`, déjà compilé dans l’environnement. Aucun build ni test applicatif n’a été lancé. Les sources correspondantes sont `packages/shared/src/carto/objects.ts` et `model.ts`.

Le jeu comprend **34 objets et 40 relations dérivées** : un SMSI, un périmètre, six processus, deux sous-processus, quatre parties intéressées, huit enjeux, huit fournisseurs, deux applications, un site et une infrastructure. Aucune donnée de compte ou secret copiée. La maquette ne fait aucun appel API.

La synthèse haute compte le jeu complet ; **30 objets figurent dans la vue contexte** (seuls les quatre processus dans le périmètre y sont présents). Les huit processus/sous-processus sont accessibles dans leur vue. Le pied compte les objets présents dans le DOM après filtrage, y compris SMSI/périmètre toujours visibles comme repères dans le contexte. Les éléments des listes défilantes restent comptés ; ils ne sont pas tous dans la partie actuellement visible.

Les traits reprennent uniquement : parties → périmètre (`interacts_with`), enjeux → périmètre (`impacts`), fournisseurs → périmètre (`supports`), applications/site/infrastructure → SMSI (`part_of`). Les autres relations, notamment application → fournisseur et parent → sous-processus, restent accessibles dans les fiches. Les référentiels et la nature des enjeux sont ceux du jeu dérivé existant : la maquette ne requalifie rien. Le filtre ne signifie pas conformité ou certification.

## Résumé technique pour une IA connaissant le code

- `index.html` : structure Studio, commandes par icônes, zone de carte, filtres et dialogue natif. Navigation latérale illustrative.
- `cartographie.css` : thèmes et familles cyan/bleu/ambre/vert, colonnes, défilements locaux, cadre central et états au survol/focus. Réutilisation des styles de présentation des propositions `commandes-discretes`, `responsive-equilibre` et `responsabilites-studio`, sans les modifier.
- `cartographie.js` : `matches()` filtre ; `group()` et `row()` affichent les objets ; `render()` choisit la vue et recalcule les chiffres ; `wires()` mesure les boîtes et dessine les quatre chemins à angles droits dans les gouttières. Recalcul après rendu, changement de taille via `ResizeObserver` et chargement des polices.
- `open()` affiche les informations et les relations réellement présentes dans le jeu ; navigation vers l’autre extrémité par `data-related`. Valeurs échappées ; absence de champ explicitée pour le responsable. `closeDialog()` restitue le focus. `motion()` gère pause et reprise ; mouvement réduit appliqué en CSS et à l’initialisation.
- `donnees.js` contient le jeu figé. `exporter.py` assemble styles, scripts et police dans `apercu-autonome.html`. Export réservé à la maquette, ne pas copier ses scripts en ligne sous la CSP de l’application.

### Contraintes de portage étudiées — proposition désormais écartée

**Ne pas porter la nouvelle disposition décrite dans ce dossier.** Les précautions suivantes documentent l’analyse effectuée avant la décision ; pour une éventuelle harmonisation de style, partir de l’écran applicatif actuel et conserver son organisation visuelle et sa génération automatique.

La carte actuelle **reste l’éditeur de référence**. Conserver `apps/web/src/pages/Cartographie.tsx`, le moteur SVG React `apps/web/src/carto/Canevas.tsx`, les fonctions pures partagées et les contrats des ADR [0013](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/adr/0013-cartographie.md) et [0026](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/adr/0026-cartographie-creation-depuis-la-carte.md), ainsi que les spécifications `docs/cartographie/`.

Cette maquette propose une présentation de consultation regroupée ; elle n’implémente pas le déplacement, la modification de disposition ou les opérations du véritable éditeur. Le portage ne doit supprimer aucune fonction existante : génération assistée, ajout depuis la plateforme, palette, création/renommage avec double contrôle des droits, sélection multiple, alignements, liens graphiques, annuler/rétablir, synchronisation, objets indisponibles/inaccessibles, conflits, versions et exports SVG/PNG/PDF/JSON. Prévoir leurs commandes sous forme d’icônes et menus explicites dans l’intégration, plutôt que des boutons fictifs ici.

Conserver les routes `/cartographie/contexte` et `/cartographie/processus`, les préférences, gardes `cartographie:lire/modifier/exporter`, les lectures filtrées, `If-Match`, versions, notifications et stockage réel. La disposition n’est pas une nouvelle source métier : ne jamais convertir les positions, regroupements ou flux décoratifs en relations métier. Conserver les familles inconnues ou définies par l’organisation lors du portage ; cette proposition illustre seulement les trois familles présentes dans le jeu choisi.

## Vérifications réellement exécutées

Contrôles de la **maquette uniquement** dans Chromium :

- Seize dispositions : contexte/processus × clair/sombre × 1024×768, 1366×768, 1920×1080 et 2560×1440. Aucun débordement de page ; corps des objets à 13 px minimum ; compteur bas égal au nombre d’objets rendus.
- Huit mesures géométriques du contexte : quatre traits présents, aucun segment ne traverse l’intérieur d’une autre dalle de famille. Ce contrôle cible le jeu et les tailles documentés, pas toutes les cartes arbitraires de l’application.
- Quatre analyses Axe des deux vues dans les deux thèmes, sans violation détectée. Elles ne constituent pas une recette complète d’accessibilité.
- Cinq parcours : consultation et vraie relation application/fournisseur avec retour du focus, recherche sans accents et remise à zéro, filtre HDS, défilement local des fournisseurs sans déplacement de page, agrandissement/Échap et mouvement réduit.
- Aucune erreur JavaScript, ressource HTTP en erreur ou requête API détectée. Export autonome servi en HTTP, fiche SMSI ouvrable/fermable, aucune ressource externe. Une seule capture native 3840×2160.
- ESLint ciblé, format explicite HTML/CSS/JS et `git diff --check`. La recherche « equipe » renvoie trois objets, y compris le sous-texte « former les équipes » : le premier contrôle attendait deux et a été corrigé après vérification du jeu. Aucune exclusion de résultat pour contourner ce constat.

**Aucun code applicatif, API, permission, migration, dépendance ou ancien ZIP modifié ; aucun build/test applicatif, push ou déploiement.** Aucune PR ouverte lors de la consultation en lecture. Ouverture directe de l’HTML sur Windows non rejouée ; aperçu servi en HTTP pour les contrôles.

Suite corrigée après le retour du demandeur : conserver la cartographie actuelle. Une éventuelle proposition ultérieure doit se limiter à son habillage graphique et préserver sa génération automatique, son organisation visuelle et toutes ses fonctions d’édition. Aucun portage de cette maquette n’est prévu.
