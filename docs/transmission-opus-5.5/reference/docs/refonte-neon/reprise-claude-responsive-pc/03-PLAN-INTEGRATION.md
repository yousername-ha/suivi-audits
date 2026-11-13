# Plan d’intégration — priorité PC

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Ce plan s’exécute **après validation visuelle** de la nouvelle finition. Avant accord, audit et maquettes seulement. Préserver les modifications des autres sessions et vérifier leurs fichiers avant toute intervention partagée.

## 1. Examiner les causes communes

`packages/ui/src/styles.css` contient déjà la base responsive et les variables communes. Ne pas construire une deuxième charte indépendante.

- La racine utilise une taille fluide de 87,5 % à 100 %, multipliée par `--suivi-echelle`.
- `html[data-taille='auto']` passe à 1,15 / 1,3 / 1,5 aux grands seuils de largeur. Les proportions des composants en `rem` suivent cette échelle.
- Les tailles explicites 90 / 100 / 115 / 130 / 150 et `data-mur` existent également.
- Plusieurs composants ont des petits textes autour de 0,6–0,8 rem : agrandir seulement la page peut conserver des écarts de hiérarchie et faire grossir les surfaces en même temps.

Ces constats sont issus de la lecture des sources, pas d’un diagnostic visuel complet de l’application. Examiner la combinaison de ces règles, la densité et les styles locaux. **Préserver les préférences manuelles et le mode mural** ; revoir l’automatique ordinaire avec des tailles bornées et une disposition adaptée, sans contourner les réglages de la personne.

`apps/web/src/components/Layout.tsx` applique les préférences de thème, taille et densité à la racine. Vérifier le comportement après chargement et changement des préférences, pas seulement le premier rendu.

## 2. Composants et fichiers à inspecter

| Zone | Fichiers existants |
| --- | --- |
| Socle et proportions | `packages/ui/src/styles.css`, `packages/ui/src/tokens.ts`, `apps/web/src/app.css` |
| Coquille / rubriques | `apps/web/src/components/Layout.tsx`, `apps/web/src/components/OngletsRubriques.tsx`, `apps/web/src/navigation.ts`, `apps/web/src/pilotage-navigation.ts` |
| Registres communs | `apps/web/src/registres/Registres.tsx`, `apps/web/src/registres/SelecteurRegistre.tsx`, composants partagés de listes défilantes / lignes ouvrables |
| Actions et récurrences | `apps/web/src/grc/Tasks.tsx`, `TimelineStudio.tsx`, `Timeline.tsx`, `timeline-calendrier.ts`, `PlanningSerie.tsx`, `SelecteurPeriodicite.tsx`, `ValidationRapide.tsx` |
| Dashboard | `apps/web/src/components/TableauDeBord.tsx`, `DispositionTableauDeBord.tsx` |
| Périmètres | `apps/web/src/pilotage/Perimetres.tsx`, `CartesPerimetres.tsx` |
| Objectifs | `apps/web/src/pilotage/ObjectifsProcessus.tsx`, `FichesObjectifs.tsx` |
| Référentiels / DdA | `apps/web/src/grc/ReferentielsStudio.tsx`, `LegacyFrameworks.tsx`, `ObjectEditor.tsx` et leurs styles |
| Organisation | `apps/web/src/pilotage/SwotMatrice.tsx`, `PestelStudio.tsx`, `Pestel.tsx`, registre métier du contexte |
| Fiches et fenêtres | Éditeurs et composants de dialogues partagés, puis les fenêtres particulières de chaque module |

Les noms peuvent avoir évolué dans la branche de reprise : les retrouver avec `rg` avant d’éditer. Ne pas copier les CSS de maquette en fin de fichier pour écraser indistinctement tous les composants.

## 3. Ordre conseillé

1. Vérifier la branche, les règles du dépôt, l’état de travail et les préférences d’affichage.
2. Définir les tailles de lecture et zones de clic communes ; corriger les plafonds de largeur des zones de travail et les contraintes de hauteur.
3. Construire un mécanisme commun pour les vues en icônes, la recherche discrète, les filtres et les critères actifs. Réutiliser les filtres réels, avec leur état et leurs remises à zéro.
4. Intégrer d’abord Actions/Récurrences et un registre compact. Confirmer les dimensions PC et les vrais parcours.
5. Décliner sur Dashboard, Périmètres, Objectifs, Référentiels/DdA et Organisation ; gérer chaque géométrie graphique avec ses libellés, plutôt que réduire un SVG complet.
6. Terminer par les fenêtres particulières, les textes longs, états vides/erreurs et listes volumineuses.

L’allègement visuel ne change ni les calculs, ni le workflow, ni les droits. Une cellule éditable garde son contrôle propre ; le clic sur la ligne n’enregistre rien. La validation rapide garde son API réelle, ses preuves et son historique. Les dalles DdA restent présentes et les vues par défaut restent celles déjà validées.

## 4. Référence et preuve de fin

Le HTML autonome sert au jugement visuel. Porter son intention dans React/Mantine en conservant la CSP et les styles statiques du projet ; ne pas reprendre ses modifications DOM, données fictives et enregistrements en mémoire.

Après intégration : tests pertinents, recette PC, captures natives de l’application clair/sombre et mise à jour documentaire. Indiquer les menus effectivement vérifiés et les limites restantes ; ne pas déclarer toute l’application corrigée après une seule page.
