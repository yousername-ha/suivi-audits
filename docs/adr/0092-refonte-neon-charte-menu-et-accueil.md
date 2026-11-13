# ADR 0092 — Refonte Neon : charte, menu bleu nuit opaque et vue analytique de l'accueil

- Statut : acceptée pour les lots 1 et 2 (décisions du RSSI du 13/11/2026 ; numéro réservé et validé par le RSSI). Complétée
  à chaque lot de la refonte.
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

## Conséquences

- Toutes les captures de référence Playwright changent : elles sont régénérées dans le conteneur officiel (CI) et relues
  image par image par le RSSI avant tout commit.
- Le changement hors interface se limite au schéma partagé des préférences (un champ facultatif) ; l'API n'est pas modifiée.
- Le rôle prédéfini Contributeur lit tous les modules métier : il voit donc le tableau de bord. Restreindre ce que voit un
  contributeur (seulement ce qui lui est attribué) est un changement du modèle de droits, hors refonte graphique, **traité
  dans une autre session** (réponse du RSSI du 13/11/2026).
- Lots suivants : Contexte/Périmètres/Objectifs, Bibliothèque et DDA, SWOT/PESTEL/Parties/Processus/Fournisseurs, Timeline
  des actions et récurrences, habillage de l'Assistant (après fusion de son backend), harmonisation finale.
