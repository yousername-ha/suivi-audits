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

## Construire une carte de zéro (CARTO-15 à CARTO-19, [spécification](SPEC-EDITION-LIBRE.md))

Jeu de données : installation **vide** (aucun processus, aucune partie intéressée, aucun fournisseur), puis le jeu
fictif ci-dessus pour les parcours 29 à 32.

| # | Parcours | Résultat attendu | Exigence |
|---|---|---|---|
| 21 | RSSI ouvre Cartographie sur une installation vide | État vide avec « Construire la carte » et « Générer depuis la plateforme » ; « Partir de zéro » donne SMSI + périmètre | 19 |
| 22 | Glisse « Partie intéressée » de la palette sur la carte, saisit « Autorité de contrôle (fictive) », externe | Boîte au point de dépôt ; la partie intéressée existe dans son module (`/legacy` la liste) ; journal `carto.object_create` | 15, 17 |
| 23 | Clic droit sur le fond > Créer ici > Fournisseur | Fenêtre au point visé ; fournisseur créé et placé sans chevauchement | 15, 16 |
| 24 | Vue processus : crée un processus « Réalisation », puis un sous-processus dans son cadre | Processus dans la bande Réalisation ; sous-processus rangé dans son parent ; code proposé | 15, 17 |
| 25 | Crée un enjeu externe | Enjeu dans la bande externe ; enregistré dans les réglages de la carte | 15, 19 |
| 26 | Ctrl+Z après une création | La boîte quitte la carte ; l'objet reste dans la plateforme (message avec lien) | 15 |
| 27 | Ajoute une note et un cadre libre, y glisse deux objets, déplace le cadre | Le cadre emporte les deux objets ; note et cadre conservés après enregistrement, dans les versions et l'export | 17, 19 |
| 28 | Renomme un objet par double-clic | Confirmation la première fois ; nouveau nom dans la plateforme ; position inchangée | 18 |
| 29 | Contributeur sans `fournisseurs:modifier` | « Fournisseur » absent de la palette, grisé dans le menu avec sa raison ; création forcée par l'API : 403 | 15, 16 |
| 30 | Appui long (tactile) et Maj+F10 (clavier) sur un objet | Même menu contextuel, navigable au clavier, fermé par Échap | 16 |
| 31 | Sélection de trois objets > Aligner à gauche, Répartir | Positions alignées et réparties ; Ctrl+Z annule en un pas | 16 |
| 32 | Lecteur : clic droit | Seules « Ouvrir la fiche », « Copier », « Ajuster l'affichage » ; aucune palette | 16 |
