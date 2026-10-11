# ADR 0012 — Adaptation à tous les écrans et écran mural

**Statut** : acceptée (phase 0, chantier 9 quater).

## Contexte
L'outil est utilisé sur des écrans très différents : téléphone pendant un audit, tablette, portable, écran de 22 à 27 pouces, et grand écran de salle de réunion (55 pouces, 4K) qui affiche le tableau de bord en permanence. Sur un grand écran, la page ne doit pas rester une colonne étroite au milieu d'un fond vide ; sur un téléphone, rien ne doit défiler horizontalement. Chaque personne doit pouvoir agrandir l'affichage ou le resserrer, sur tous ses appareils. Le tout reste sous CSP stricte (aucun style injecté, ADR 0006).

## Décision
- **Points de rupture** (jetons de `packages/ui`, en `em` pour suivre le zoom) : téléphone < 36em (576 px), tablette 36 à 64em (1024 px), bureau 64 à 90em (1440 px), grand 90 à 120em (1920 px), très grand 120 à 160em (2560 px), ultra ≥ 160em. Les composants (tableaux, formulaires) s'adaptent à la largeur **de leur conteneur** (requêtes de conteneur), pas seulement à celle de l'écran.
- **Typographie fluide** : taille de base bornée `clamp(15 px, …, 17 px)` selon la largeur, multipliée par la taille d'affichage choisie. Le zoom du navigateur et la mise à l'échelle de Windows (125 à 200 %) restent pris en compte : toutes les longueurs sont en `rem` ou `em`.
- **Tableaux de bord** : grille `auto-fill` de cartes de 24rem au minimum (environ 380 à 480 px selon la taille de base). On **ajoute des colonnes** au lieu d'élargir les cartes : 1 au téléphone, 2 sur tablette et portable, 3 sur un écran de 1920 px, 4 à 6 en 4K. Le minimum de 24rem respecte la contrainte « cartes de 320 à 480 px » ; il donne 3 colonnes sur un écran de 22 pouces en 1920 px plutôt que 2, car 2 colonnes y imposeraient des cartes de plus de 700 px.
- **Listes et fiches (maître-détail)** : sous 1440 px, la fiche s'ouvre dans un tiroir ; à partir de 1440 px, liste et fiche côte à côte ; à partir de 2560 px, un troisième panneau (historique des versions, rattachements). Appliqué aux documents ; les écarts, mesures et fournisseurs le reprendront à leur reprise.
- **Tableaux** : pleine largeur, en-tête et première colonne figés ; les colonnes secondaires (priorité 2 et 3) apparaissent selon la largeur du tableau. Un sélecteur « Colonnes » permet de choisir ses colonnes ; ce choix est mémorisé par personne et par tableau.
- **Largeurs de lecture** : textes à environ 75 caractères, formulaires simples à 720 px, formulaires longs en 2 ou 3 colonnes selon la largeur de leur conteneur.
- **Navigation** : tiroir au téléphone, barre d'icônes (avec infobulles) sur tablette, menu déplié à partir de 1024 px.
- **Préférences par personne, enregistrées sur le serveur** (`users.preferences`, `GET/PUT /api/account/preferences`) : « Taille d'affichage » (90, 100, 115, 130, 150 %, ou Automatique : agrandissement progressif au-delà de 2560 px), « Densité » (Compacte, Normale, Confortable, ou valeur de l'organisation), thème (clair, sombre, système, ou valeur de l'organisation), colonnes des tableaux. Elles s'appliquent sur tous les appareils de la personne.
- **Accessibilité** : mouvements réduits (`prefers-reduced-motion`), contraste renforcé (`prefers-contrast`), couleurs forcées de Windows (`forced-colors`).
- **Écran mural (`/mur`)** : tableau de bord plein écran, sans menu, texte agrandi d'un quart, mis à jour en temps réel (`GET /api/mur/events`), rotation facultative entre les vues Synthèse, Écarts ouverts, Échéances et Plan d'audit, aucune action de modification.
  - Accessible avec une session personnelle (tout droit de lecture métier, donc aussi au rôle Lecteur), ou depuis un **appareil enregistré** sans compte nominatif.
  - L'administrateur crée l'écran (Administration > Écrans muraux) : nom, modules visibles, durée de validité (1 à 365 jours). Il obtient un **lien d'activation à usage unique, valable 24 h**, affiché une seule fois. Le code est dans le fragment de l'adresse (`#`) : il n'est jamais envoyé dans l'URL au serveur ni journalisé par le frontal.
  - L'appareil échange ce code contre un jeton de longue durée, dans un cookie `__Host-`, `HttpOnly`, `SameSite=Strict`, qui n'ouvre **que** `GET /api/mur/synthese` et `GET /api/mur/events` (accès `mur`), en lecture des seuls modules choisis.
  - Seules les empreintes SHA-256 du code et du jeton sont stockées (`wall_screens`). Révocation immédiate ; le flux temps réel vérifie l'accès chaque minute et s'arrête sur un écran révoqué ou expiré. Création, activation (réussie ou non) et révocation sont journalisées. L'activation est limitée à 10 tentatives par 15 minutes et par adresse IP.
- **Synthèse** : calculée côté serveur par `computeSynthese` (`packages/shared`), à partir de l'état déjà filtré selon les droits ; un module non lisible n'apparaît pas.
- **Tests** :
  - captures de référence du tableau de bord, d'une liste avec sa fiche, de l'administration et des Paramètres à 390, 768, 1366, 1920, 2560 et 3840 px, en clair et en sombre (`tests/e2e/specs/tous-ecrans.spec.ts`) ;
  - échec si le tableau de bord laisse plus de 35 % de la largeur inutilisée à 2560 et 3840 px ;
  - échec sur tout défilement horizontal à 390 px ;
  - parcours de l'écran mural (activation, rotation, révocation, lien déjà utilisé) et des préférences.

## Conséquences
- Tout nouvel écran utilise `grille-cartes`, `maitre-detail`, `DataTable` avec des colonnes par priorité et `useColonnes`, et `grille-formulaire` pour les formulaires longs.
- Un écran mural n'est pas une personne : il ne voit que des agrégats et la liste des prochaines échéances des modules choisis, jamais les pages de détail.
- Aucune nouvelle dépendance.
