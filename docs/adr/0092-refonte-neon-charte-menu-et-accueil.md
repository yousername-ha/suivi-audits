# ADR 0092 — Refonte Neon : charte, menu bleu nuit opaque et vue analytique de l'accueil

- Statut : acceptée pour le lot 1 (décisions du RSSI du 13/11/2026 ; numéro réservé et validé par le RSSI). Complétée à
  chaque lot de la refonte.
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

## Conséquences

- Toutes les captures de référence Playwright changent : elles sont régénérées dans le conteneur officiel (CI) et relues
  image par image par le RSSI avant tout commit.
- Le changement hors interface se limite au schéma partagé des préférences (un champ facultatif) ; l'API n'est pas modifiée.
- Le rôle prédéfini Contributeur lit tous les modules métier : il voit donc le tableau de bord. Restreindre ce que voit un
  contributeur (seulement ce qui lui est attribué) est un changement du modèle de droits, hors refonte graphique, à traiter
  séparément.
- Lots suivants : fenêtres et lignes ouvrables, Contexte/Périmètres/Objectifs, Bibliothèque et DDA, SWOT/PESTEL/Parties/
  Processus/Fournisseurs, Timeline des actions et récurrences, habillage de l'Assistant (après fusion de son backend).
