# Relevé ergonomique sur écran 1920 × 1080 (version 7.3.0)

16/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/ergonomie-ecran`,
partie de `claude-suivi-smsi` (`52d4649`, version 7.2.0). Demande du RSSI transmise par la session « Projet audit_suivi
Coeur » et confirmée par le RSSI le 16/11/2026 : revoir fenêtre par fenêtre les textes coupés, donner la même taille aux
fenêtres, occuper toute la largeur, réduire la place des titres et descriptions, et remplacer le sélecteur de périmètre
pleine largeur par une petite liste déroulante. Relevé en lecture seule : aucune modification de code.

## Méthode

Pile locale (API et interface de développement), installation neuve avec les données de démonstration fictives, compte
administrateur, thème clair, fenêtre de navigateur de 1920 × 1080. Un script parcourt les pages atteignables depuis le menu
(93 pages), mesure chaque page, ouvre la fiche de la première ligne et la fenêtre de création quand elles existent
(68 fenêtres mesurées), puis les ferme. Toute requête d'écriture vers l'API est bloquée pendant le relevé.

Mesures : largeur de la zone principale et du contenu ; position du titre, de la description, du sélecteur de périmètre et du
premier contenu de données ; textes coupés (débordement masqué, points de suspension, valeur de champ plus longue que le
champ) ; taille des fenêtres.

## Constats

### 1. Place prise par l'en-tête

- Toutes les pages de Pilotage empilent : onglets éventuels, grand titre (47 px de haut), description, « Périmètre
  affiché » avec sa phrase d'aide, puis souvent un paragraphe ou un bandeau explicatif.
- 37 pages affichent la même description générique « Qualité, sécurité et référentiels : pilotez vos travaux à partir des
  données existantes. », qui n'apporte rien à la page.
- Sur les 48 pages avec sélecteur pleine largeur, le premier contenu de données commence à 555 px en médiane (sur 1 080) ;
  27 pages le placent sous la moitié de l'écran. Exemples : Fournisseurs de l'organisation, premier fournisseur à 808 px ;
  Périmètres, graphe à 622 px ; Actions, liste à 622 px. Sans sélecteur, la médiane est de 343 px.

### 2. Sélecteur de périmètre

- 53 pages l'affichent : 48 en pleine largeur (1 582 px), 5 en largeur réduite (Processus, Parties intéressées : 544 px ;
  déclarations d'applicabilité : 448 px). Il occupe 82 px de haut avec son libellé et sa phrase d'aide.

### 3. Largeur des pages

- La zone principale fait 1 672 px (1 920 moins le menu) et le contenu 1 582 px sur toutes les pages relevées : aucune page
  n'est limitée en largeur au niveau de la mise en page. Certains blocs internes le sont : paragraphes d'explication
  (environ 660 px), formulaires de Mon compte et des Exports, colonnes de Processus. Le cas « Processus » cité par le RSSI
  reste à préciser.

### 4. Tailles des fenêtres

- 68 fenêtres mesurées, quatre largeurs : 440 px (2, dont « Ajouter un fournisseur » et « Nouveau processus »), 800 px (25,
  fiches des registres), 1 024 px (38, fiches de risque, cartes de Plateforme et de Configuration système), 1 216 px (1,
  « Périmètre et contexte »).
- Hauteur naturelle avec défilement de la page (lot 2) : de 221 px (Sessions actives) à plus de 17 000 px (Journaux
  techniques).
- Les cartes de Plateforme et de Configuration système ouvrent une fenêtre qui contient un second cadre au même titre
  (« Général » deux fois).

### 5. Textes coupés

- Champs de tableau trop étroits pour leur valeur : Contacts de crise (nom, organisation, rôle, courriel, disponibilité,
  notes), Organisation : participants (fonction, rôle dans l'audit), Scénarios et check-lists (étapes), note du plan
  d'audit (Organisation : déroulé, planning, participants : champ de 236 px pour 516 px de texte).
- Listes déroulantes : SWOT (processus lié), fiche d'un fournisseur (contrôle), Journaux techniques (niveau).
- Libellés avec points de suspension : événements du calendrier des plans annuels (151 px pour jusqu'à 451 px de texte),
  bouton de scénario de crise.
- Aucune autre coupure détectée dans les fenêtres ouvertes.

### 6. Tuile de l'Assistant RSSI

- Le bouton flottant est fixé en bas à droite (`position: fixed`, 28 px du bord droit, 21 px du bas), au-dessus du contenu,
  sans réserve d'espace dans la page : il masque ce qui passe dessous, par exemple la colonne « Évaluation courante » du
  registre des fournisseurs (capture du RSSI). Non reproduit ici : l'assistant n'est pas activé dans l'installation de
  démonstration (flux fermé).

## Limites

- Thème clair, compte administrateur, 1920 × 1080 uniquement ; les autres tailles et le thème sombre seront vérifiés avec les
  maquettes.
- Fenêtres ouvertes : fiche de la première ligne et fenêtre de création ; les fenêtres de confirmation et les sous-fenêtres
  ne sont pas toutes ouvertes par le script.
- Écrans des flux vers l'extérieur (`FluxExternes.tsx`, `ValidationFlux.tsx`) relevés mais exclus des corrections : ils sont
  en cours de correction pour la 7.2.1.

## Suite

Maquettes à présenter au RSSI avant intégration : en-tête compact (titre et liste déroulante étroite du périmètre sur une
ligne, description réduite), largeur commune, taille commune des fenêtres, champs de tableau lisibles, tuile de l'assistant
qui ne masque plus le contenu.
