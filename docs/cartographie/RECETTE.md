# Recette — Cartographie (CARTO-01 à CARTO-14)

Jeu de données : fixture legacy anonymisée (`tests/fixtures/legacy-fixture.json`) complétée de données fictives :
6 processus (2 pilotage, 2 réalisation, 2 support dont un avec 2 sous-processus), périmètre incluant 2 processus,
4 parties intéressées, 2 SWOT, 8 fournisseurs (dont 1 HDS critique), 2 applications GAP, 1 site, 1 système.
Aucune donnée réelle.

| # | Parcours | Résultat attendu | Exigence |
|---|---|---|---|
| 1 | Lecteur ouvre Cartographie sans carte | État vide, aucun bouton Générer / Modifier | 01 |
| 2 | RSSI génère la vue contexte (défauts) | SMSI au centre, cadre périmètre, PI à gauche, fournisseurs à droite, enjeux en bandes, hors périmètre en zone ; bandeau « non enregistrée » | 05, 06 |
| 3 | Génère la vue processus | 3 bandes ; sous-processus dans leur parent ; flux principal plein ; liens support/pilotage pointillés marqués « à valider » en édition | 05 |
| 4 | Déplace le SMSI de 60×40 px, enregistre, recharge | Position conservée ; zoom/panoramique sans effet sur les positions | 03, 06, 07 |
| 5 | Déplace le cadre « Périmètre » | Tout son contenu suit | 07 |
| 6 | Renomme un processus dans son module | Nouveau nom sur la carte, position inchangée, sans enregistrer la carte | 02, 08 |
| 7 | Supprime une partie intéressée | « Objet indisponible » + bandeau ; « Retirer de la carte » la retire | 08 |
| 8 | Crée une partie intéressée | Bandeau « 1 nouvel objet » ; « Choisir et ajouter » la place près du périmètre sans chevauchement | 08, 09 |
| 9 | Relie deux processus (Dépendance), puis Suppr sur un objet, Ctrl+Z, Ctrl+Y | Relation graphique créée ; retrait puis restauration puis retrait ; l'objet métier existe toujours | 07 |
| 10 | Masque une relation métier, valide une proposition | Relation masquée sur cette carte seulement ; proposition devenue relation graphique | 07 |
| 11 | Deux sessions modifient la même carte | Présence affichée ; la seconde reçoit 412 et le choix Recharger / Écraser | 04, 07 |
| 12 | Enregistre la version « Revue de direction », modifie, restaure | Restauration exacte ; 21e version supprime la plus ancienne | 11 |
| 13 | Change la nature d'un enjeu, disposition automatique | L'enjeu passe dans l'autre bande | 12 |
| 14 | Recherche « achat », Entrée | 1 résultat, centré, sélectionné, reste atténué | 06 |
| 15 | Filtre HDS désactivé ; préréglage « Parties intéressées » | Objets HDS seuls masqués ; préréglage atténue sans déplacer | 06 |
| 16 | Exports PNG, SVG, PDF, JSON | Fichiers lisibles avec titre, date, légende ; journal d'audit | 13 |
| 17 | Rôle sans `fournisseurs:lire` | Fournisseurs absents de `/api/carto/objects` ; boîtes « Objet non accessible » | 01 |
| 18 | Import legacy d'un fichier avec `S.maps` | Simulation : module « maps » reconnu ; après import, cartes identiques ; `/legacy` en lecture seule pour la cartographie ; export retour identique | 14 |
| 19 | 390, 1920, 3840 px | Pas de défilement horizontal, inspecteur en feuille basse sur téléphone, captures de référence | 06 |
| 20 | 400 nœuds générés | Confirmation au-delà de 80 ; glisser fluide ; refus au-delà de 400 | 05, 06 |

Les scripts Playwright de la bêta (`reference-beta-legacy/t_*.py`) montrent ces parcours sur l'outil historique ;
ils servent de modèle, les tests v3 sont écrits en TypeScript dans `tests/e2e`.
