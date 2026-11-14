# ADR 0093 — Refonte Neon : charte, menu bleu nuit opaque et vue analytique de l'accueil

- Statut : acceptée pour les lots 1 et 2 (décisions du RSSI du 13/11/2026). Lots 3 à 8 portés le 14/11/2026 à la demande du
  RSSI (« tous les lots sans s'arrêter », version 7.1.1) ; captures de référence relues par le RSSI avant tout commit.
- Numéro : 0092 retenu par le RSSI le 13/11/2026, devenu **0093** à l'intégration de `claude-suivi-smsi`, où l'ADR 0092 a été
  attribuée entre-temps à la [refonte des droits](0092-refonte-des-droits-pyramide-des-perimetres.md).
- Date : 2026-11-13
- Rédaction : session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`)
- Remplace, pour la direction graphique, l'[ADR 0015](0015-refonte-visuelle-sauge.md) (palette Sauge). Les autres
  principes de l'ADR 0015 restent : Inter locale, styles partagés dans `packages/ui`, rayons de 6 à 12 px, mouvement réduit.

## Contexte

Le RSSI a validé une refonte graphique « Neon », préparée sur une branche distincte jamais fusionnée et transmise sous forme
de dossier (décisions, maquettes, captures approuvées, sources de référence). La version actuelle a évolué depuis : plusieurs
modules ont été retirés (ADR 0084, 0087, 0088, 0089, 0090, 0091) et d'autres sont plus récents que la référence. Le portage
se fait donc par lots sur la version actuelle, après un audit de compatibilité
([docs/refonte-neon/AUDIT-CIBLE.md](../refonte-neon/AUDIT-CIBLE.md)), sans réintroduire de module retiré ni changer les
droits, les calculs ou les contrats existants.

## Décision (lot 1)

1. **Charte Neon.** Les jetons de couleur de `packages/ui/src/tokens.ts` passent à la palette Neon (violet d'accent,
   surfaces lavande et bleu nuit, constantes `NEON` et variables `--neon-*`). Les rayons restent bornés à 12 px. Les teintes
   métier (cartographie, matrice des risques, états) ne changent pas.
2. **Menu latéral bleu nuit opaque**, identique dans les deux thèmes et dans toutes les rubriques ; le contenu garde son
   thème. Une teinte par identité d'entrée (treize identités, jetons `MENU`), jamais par position. Pictogrammes SVG
   déclaratifs ; les huit familles bougent à l'intérieur du dessin, **uniquement par transform et opacity**. Un bouton met
   les mouvements en pause (choix gardé dans le navigateur : confort d'affichage) ; un onglet masqué et la préférence
   système de mouvement réduit les arrêtent. La logique de navigation (droits, ordre personnel, alertes, rail, tiroir) est
   inchangée ; le nombre de destinations affiché vient de la navigation filtrée par les droits.
3. **Marque** : le logo de l'organisation déposé dans Plateforme > Général (route publique existante) s'affiche en tête du
   menu et dans l'en-tête, sur une tuile claire ; à défaut, la pastille de l'application.
4. **Accueil** : une seconde présentation, la **vue analytique Neon** (cartes calculées sur la synthèse et les API
   existantes, filtrées par les droits), à côté du tableau personnalisable (ADR 0078), qui reste la présentation par défaut.
   Sans droit de lecture métier, aucune des deux n'est affichée. La carte de la référence alimentée par le module CRRC
   retiré n'est pas reprise.
5. **Choix de la présentation de l'accueil enregistré dans le compte** : champ facultatif `accueil` (`personnalisee` ou
   `analytique`) des préférences d'affichage (`packages/shared/src/affichage.ts`), lu et écrit par la route existante
   `/api/account/preferences`. Aucune migration (préférences en JSON), aucune route nouvelle ; une préférence absente vaut
   `personnalisee`.

## Décision (lot 2)

6. **Fenêtres « Biseau »** (validées dans la référence) : habillage commun des fenêtres et panneaux
   (`packages/ui/src/neon-fenetres.css`), cadre à angles coupés et traits violet/cyan, typographie des formulaires,
   **hauteur naturelle** : le corps d'une fiche ne défile plus, c'est le voile extérieur qui défile, titre collant au bord de
   l'écran. Exclus : fenêtres RETEX (`.retex-modal`, graphe et chronologie inchangés), fenêtres plein écran et menu mobile
   (lot 1). Les fenêtres de la cartographie prennent le même habillage (décision du RSSI du 13/11/2026), sans changer le
   canevas ni la génération. Le nom accessible par défaut « Fermer la fenêtre » de la référence n'est pas repris : des tests
   existants cherchent un bouton « Fermer » par nom partiel.
7. **Lecture distincte** : limitée, comme dans la référence, aux fiches Contexte, Parties intéressées et Processus, portées à
   leurs lots (3 et 5) ; les autres fiches gardent leur formulaire (décision du RSSI du 13/11/2026).
8. **Lignes ouvrables** (`apps/web/src/fiche-cliquable.ts`) : la ligne ou la carte d'une fiche s'ouvre au clic, à Entrée ou à
   Espace, avec **la même ouverture et la même condition de droits** que la commande existante, qui reste en place (boutons
   « Ouvrir » compris). Commandes imbriquées, touches de modification et sélection de texte gardent leur action. Le focus
   revient à la ligne à la fermeture (`focus-fiche.ts`). Les listes du registre commun, des risques, d'EBIOS, des incidents,
   de la crise, des registres et droits, des documents, de l'administration, des plans et des fournisseurs (critères,
   évaluations) sont couvertes ; Périmètres, Objectifs, Couverture, DDA et Actions le seront à leurs lots.
9. **Listes à défilement local** (`ListeDefilante`, `lignes-fiches.css`) : une liste de lignes ouvrables défile dans sa propre
   zone, en-têtes visibles, pagination dessous. Adaptation à la version actuelle : une liste placée sous d'autres blocs prend
   la hauteur de l'écran sous l'en-tête, au lieu d'être réduite au minimum. Hauteur écrite par le DOM (CSSOM), sans style en
   ligne.

## Décision (lots 3 à 8)

Les présentations validées de la référence sont portées **sur** les écrans actuels : logique, appels d'API, routes, droits,
filtres et fonctions propres à la cible restent ; aucun module retiré n'est réintroduit ; aucun changement serveur.

10. **Lecture distincte** (lots 3 et 5) : les fiches Contexte, Parties intéressées et Processus s'ouvrent en présentation,
    « Modifier » passe au formulaire. La création d'un processus ouvre directement le formulaire (parcours existant). Les
    Parties intéressées s'affichent en panorama centré avec leurs liaisons ; le registre détaillé reste disponible derrière
    « Parcourir le registre », avec ses filtres et ses décisions. Le bandeau « Synthèse des parties intéressées » est conservé.
11. **Périmètres** (lot 3) : graphe compact centré, à taille réelle (défilement et commande « Ajuster », pas de réduction
    globale) ; une carte repliée garde ses commandes et ses compteurs. **Objectifs et indicateurs** : vue compacte Studio par
    défaut dans la rubrique Objectifs ; « non atteint » en accent rouge animé, flèches d'évolution conservées, atteinte selon la
    cible et son opérateur.
12. **DdA** (lot 4) : synthèse et mesures en lignes, titre de page et périmètre conservés. **Bibliothèque** : présentation Studio
    du catalogue et de la couverture, détail exigence par exigence sous le catalogue ; l'écran « Référentiels et exigences » de
    la référence n'est pas réintroduit ([ADR 0089](0089-simplification-du-menu-conformite.md)). **Fournisseurs** (lot 5) : registre
    compact, actions de ligne en boutons icônes aux noms accessibles inchangés, sans consultation distincte (décision 7).
13. **SWOT** (lot 5) : matrice Studio à quatre quadrants, cercle du processus centré qui ouvre le processus réel ; le registre
    complet reste affiché sous la matrice. **PESTEL** : constellation des facteurs de la nomenclature de l'API, enjeux et
    processus du facteur choisi, enjeux externes non classés et enjeux internes séparés.
14. **Timeline** (lot 6) : style Studio posé sur la structure existante de la Timeline des actions ; un repère ouvre une petite
    fenêtre qui n'utilise que les routes existantes (résultat OK, KO ou NA, preuve et réouverture motivée pour une occurrence ;
    commentaires et preuves pour une action hors série) ; le fond de ligne ouvre la fiche complète. Timeline adaptative des
    tâches récurrentes. La vue par défaut reste celle de la politique métier (`defaultTaskView`, aujourd'hui la liste).
15. **Assistant RSSI** (lot 7) : avatar vectoriel 96×96 et habillage final validé (cadre, accents cyan et bleu, animations
    commandées par la pause et le mouvement réduit). Service, contrats, droits et brouillons inchangés.
16. **Harmonisation** (lot 8) : couleurs tirées des seuls jetons (aucun hexadécimal), rayons de 12 px au plus, animations en
    `transform` et `opacity`, arrêtées par le mouvement réduit, l'impression et les couleurs forcées ; règles devenues inutiles
    retirées. « Rôles et responsabilités » n'est pas porté (proposition non validée).

## Conséquences

- Toutes les captures de référence Playwright changent : elles sont régénérées dans le conteneur officiel (CI) et relues
  image par image par le RSSI avant tout commit.
- Le changement hors interface se limite au schéma partagé des préférences (un champ facultatif) ; l'API n'est pas modifiée.
- Le rôle prédéfini Contributeur lit tous les modules métier : il voit donc le tableau de bord. Restreindre ce que voit un
  contributeur (seulement ce qui lui est attribué) est un changement du modèle de droits, hors refonte graphique, **traité
  dans une autre session** (réponse du RSSI du 13/11/2026) : [ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md).
- Lots 3 à 8 : aucun test existant modifié ; les sélecteurs lus par les parcours de bout en bout sont conservés, ce qui explique
  plusieurs écarts à la référence (registre SWOT visible, note ISO 9001 du PESTEL visible, titre de la DdA, structure de la
  Timeline). Rapports : `docs/refonte-neon/LOT-3-*.md` à `LOT-7-8-*.md`.
- Points laissés à la décision du RSSI : Timeline par défaut pour les tâches (une ligne de `packages/shared`) ; coexistence du
  bandeau de synthèse et des compteurs du panorama des Parties intéressées (constat RSSI-05) ; nom accessible de la croix de
  fermeture des fenêtres (règle axe `button-name`, déjà présente avant la refonte).
