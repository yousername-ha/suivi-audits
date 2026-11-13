# Menu clair — contraste et relief

12/11/2026 (Europe/Paris). **Nouvelle maquette claire à valider ; application inchangée.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur trouve la proposition claire moins aboutie graphiquement que la sombre. Cette variante revoit uniquement le menu clair. Le sombre reste celui de la proposition précédente ; ce retour ne constitue pas à lui seul une validation d’intégration globale.

[Image claire HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-clair-signature/menu-clair-hd.png) · [Aperçu interactif clair/sombre](apercu-autonome.html).

Fond blanc cassé avec des teintes bleu glacier/céladon localisées, plutôt qu’un dégradé pastel uniforme. Icônes principales sur de petites plaques remplies de leur couleur de famille ; entrée sélectionnée en aplat dégradé soutenu avec texte blanc et ombre courte. Famille active plus présente, contours et pied de menu mieux définis. Gabarit, hiérarchie et taille des lignes conservés ; espacement horizontal légèrement resserré dans les familles claires pour garder les intitulés confortables. Les longues listes gardent leur défilement propre.

## Résumé technique pour une IA connaissant le code

- **Maquette/documentation seulement** depuis `85e7280`, code applicatif toujours celui de `d9d1478`. Aucun fichier `apps/`/`packages/`, API, backend, droit, donnée ou dépendance modifié.
- `index.html` réutilise les sources du menu coloré : même `menu.js`, même `couleurs.css`, même inventaire 7 familles/26 destinations, mêmes commandes thème et mouvement, mêmes animations et réduction système. Les composants de bibliothèque d’arrière-plan restent identiques.
- Seule nouvelle feuille `clair.css`, dont chaque sélecteur est préfixé par `html[data-theme='light']`. Elle modifie fond, peinture des icônes, sélection, traits et ombres de la sidebar. Elle ne cible ni les contenus métier ni le thème sombre.
- `exporter.py` assemble CSS/JS/police dans l’HTML autonome. Une capture claire native 3840×2160, viewport 1920×1080 à densité 2. Le sombre de l’aperçu est conservé, pas une nouvelle proposition sombre.
- Après validation : porter la variante claire retenue et le menu sombre retenu dans la charte de sidebar existante, en gardant `Layout`, droits, ordre mémorisé, IDs/routes, alertes et entrées conditionnelles. Ne pas importer le simulateur autonome dans l’application. Onglets internes, carte/canevas/génération automatique et Assistant hors du lot.

## Contrôles de la maquette

18 comparaisons de styles sur neuf contextes/deux thèmes, 16 dispositions PC de 1024×768 à 2560×1440 et fenêtre basse 1920×800, sans débordement de page/menu mesuré. Six analyses Axe générales (Bibliothèque/DDA/Objectifs en clair/sombre), puis sept ciblées sur le menu clair avec chaque famille active, sans violation détectée. Pas une certification exhaustive d’accessibilité.

Préservation du sombre contrôlée par comparaison des captures natives de sidebar, avant/après, dans les mêmes conditions 1920×1080 à densité 1 et mouvement réduit : empreintes SHA-256 identiques, pixels inchangés dans cette comparaison. Sources JS réutilisées à l’identique ; aucun mouvement nouveau. Format HTML/CSS ciblé réussi ; aucun appel API, ressource distante ou erreur JavaScript au contrôle final de l’export. [Résultats et empreintes](controles.json).

**Non exécutés :** intégration globale du menu, nouveau build/test applicatif, API/DB, Docker/Windows, ZIP, CI distante, push, fusion ou déploiement. La bibliothèque et l’assistant intégrés conservent leur état ; leurs tests historiques ne sont pas réattribués à cette variante.

Suite : avis sur le clair avant portage, suivant [AGENTS.md](../../../../AGENTS.md) : « Présenter d’abord une proposition visuelle isolée et attendre sa validation explicite. »
