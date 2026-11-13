# Consigne de reprise — à transmettre au développeur

Poursuivre la refonte graphique Neon de Suivi des audits à partir du dossier joint et des derniers visuels validés. Référence applicative : `65bd22f` ; documents et captures : `c11277f`, branche `codex/refonte-neon-main`, copie isolée de main.

La portée est graphique. Conserver les fonctionnalités, calculs, données, champs, sauvegardes, droits, API, versions, relations et exports. Préserver le graphique RETEX généré. Réutiliser React, Mantine et les styles centralisés dans `packages/ui`.

Appliquer la dernière direction validée : Studio opaque blanc/lavande en clair, marine en sombre, contours visibles et relief discret. Le violet reste un accent, notamment pour la cible ; les états gardent vert/orange/rouge. Aucun état DdA rose. Conserver le Biseau et les pictogrammes animés du Contexte.

Points impératifs :

- Contexte : lecture distincte de l’édition, quatre catégories explicites Interfaces/Dépendances/Enjeux internes/Enjeux externes, données non classées dans À préciser.
- Périmètres : graphe initial et centré, cartes repliées, + centré en bas, dépliage indépendant en rectangle plus large, liaisons et voisins recalculés.
- Objectifs : vue compacte initiale, blocs proportionnés selon le choix B, cible violette, valeur et état remplis, colonnes centrées ; Non atteint et flèches animés avec pause et mouvement réduit.
- DdA : quatre dalles conservées, mesures en lignes, sélecteurs remplis sans chevrons décoratifs, fonctions et restrictions existantes.
- Référentiels : publications locales distinctes de la bibliothèque, registre en lignes, provenance exacte, versions et confirmations conservées.
- Dalles et fenêtres : hauteur naturelle ; les fiches longues défilent dans le voile extérieur, sans ascenseur vertical dans le corps de la fiche.

Lire le registre des validations avant toute proposition : les anciennes palettes, cartes de mesures et variantes de cadre écartées ne sont pas des références actuelles. Les chiffres des captures sont fictifs et ne doivent pas être codés en dur.

Pour toute nouvelle proposition : présenter un visuel isolé, attendre l’accord explicite, intégrer ensuite, exécuter les contrôles pertinents et fournir des captures réelles après intégration. Les validations déjà acquises ne sont pas à redemander pour terminer les travaux correspondants.

Comparer les instantanés de sources avec la branche cible avant portage. Vérifier les deux thèmes, le mobile, la lecture seule, les erreurs et la conservation des valeurs. Transmettre séparément les défauts métier connus, notamment la promotion après activation, sans les déclarer corrigés par le graphisme.

La mise en ligne, le push, la fusion dans main et le déploiement ne font pas partie de cette consigne. La copie Docker Desktop existante conserve son projet `neon-refonte-test`, ses données `.donnees-dev` et sa configuration locale.
