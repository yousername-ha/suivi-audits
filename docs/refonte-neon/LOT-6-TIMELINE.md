# Refonte Neon, lot 6 : Timeline Studio des actions et Timeline adaptative des récurrences

14/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche de travail
du lot 6 issue de `a1d096a` (`claude/refonte-neon`). Décision : [ADR 0093](../adr/0093-refonte-neon-charte-menu-et-accueil.md).
Matrice : lignes `actions` et `recurrences` de [MATRICE-COMPATIBILITE.csv](MATRICE-COMPATIBILITE.csv). Référence :
sections « Plan d’actions — Timeline Studio » et « Tâches récurrentes — Timeline adaptative » de
`04-PORTAGE-PAR-MODULE.md` (révisions `5ed760b` puis `23b33b5`).

## 1. Ce qui est porté

| Exigence de la référence                                           | Réalisation dans la cible                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Présentation Studio (panneaux, teintes, légende)                   | Panneau Timeline, synthèse en quatre tuiles, puces d’état et de résultat, barre de filtres, cartes Kanban et liste compacte teintées (`neon-taches.css`)                                                                                                             |
| Lignes fines mais lisibles, liste longue à défilement local         | Lignes de 30 px, intitulé tronqué avec info-bulle ; la Timeline défile dans sa zone (hauteur bornée, colonne d’intitulés fixe) ; la liste compacte passe par `DataTable` (`ListeDefilante`)                                                                         |
| Commandes de vues en icônes                                         | Six boutons-icônes (nom, info-bulle, `aria-pressed`) ; le choix « Vue synchronisée » reste                                                                                                                                                                         |
| « À faire » orange animé, 2,2 s, texte fixe                         | Halo orange autour de la puce et du repère, cycle 2,2 s, **opacité et transformation seulement** ; pause (bouton, mémorisée dans le navigateur), onglet masqué, mouvement réduit, impression et couleurs forcées l’arrêtent ; halo fixe à l’arrêt |
| Retard distinct du statut et du résultat                            | Trois informations séparées : puce d’état (teinte), puce « Validée : OK/KO/NA », mention « ! En retard » et contour pointillé rouge autour du repère                                                                                                              |
| Clic sur un repère : petite fenêtre de résultat                     | `ValidationRapide.tsx` : aperçu (titre sur deux lignes, état, échéance, responsable), saisie, « Fiche complète »                                                                                                                                                 |
| Clic sur le fond de ligne : fiche complète                          | Intitulé (`ficheCliquable` : clic, Entrée, Espace) et fond de la ligne dans le dessin ouvrent la fiche, comme la commande existante                                                                                                                              |
| Validation existante rouverte avec motif, rien d’écrasé             | Composant existant `ValidationOccurrence` : une seconde validation est refusée par le serveur (409), seule la réouverture motivée la reprend, le journal garde toutes les décisions                                                                               |
| Timeline adaptative des récurrences                                 | `TimelineOccurrences.tsx` + `timeline-calendrier.ts` (porté, testé) : Auto (série suivie, sinon unité la plus fine), 14 jours, 12 semaines ISO, 12 mois réels, 5 années civiles, bissextiles, navigation, Aujourd’hui, Tout afficher, repères proches étagés |
| Séries en pause ou vides, fiches hors horizon, sans date, incohérentes | La série suivie garde sa ligne et ses commandes même vide ou en pause ; listes « Hors de la période », « Sans échéance », « Dates à vérifier », toutes ouvrables ; aucune occurrence créée par le rendu                                                        |

## 2. Adapté à la cible, et pourquoi

1. **Structure de la Timeline des actions conservée.** Neuf tests de bout en bout lisent la région « Timeline des actions »
   (défilement dans les deux sens, colonne `.grc-timeline__etiquettes` fixe, un `.grc-timeline__guide` par action,
   « ! En retard » en toutes lettres, légende, `data-fond`, `timeline-fond`, « Période affichée : du … »). La présentation
   Studio est posée sur cette structure (intitulés en HTML, dessin en SVG aligné par une hauteur de ligne unique écrite
   par le DOM), au lieu des cartes de la référence qui ne défilent pas horizontalement.
2. **Noms accessibles.** L’intitulé d’une ligne a pour nom l’intitulé exact (état, résultat, retard et période en
   description) : les tests cherchent un seul bouton portant ce nom dans la région et l’ouvrent au clavier. Le repère
   porte sa commande et son état (« Saisir le résultat : à faire, en retard, échéance le … ») sans répéter l’intitulé.
3. **Période des actions inchangée** (toutes les dates, plafond de deux ans, 4 px par jour) : un test compte les jours
   fériés d’une année entière et un autre fait défiler la frise. L’échelle adaptative est celle des récurrences, comme le
   prévoit la spécification du module.
4. **Vue par défaut : celle de la politique métier** (« Vue des actions par défaut », réglable par périmètre), comme
   l’indique la matrice. La valeur d’usine reste `list` dans `packages/shared` (hors périmètre de ce lot). Pour une
   Timeline par défaut partout : choisir « Timeline » dans la politique du périmètre, ou changer `defaultTaskView` dans
   `packages/shared/src/business-policy.ts` (une ligne, décision à prendre). Le rendu le supporte déjà : en Timeline,
   l’intitulé a le nom exact attendu par `zzz-pilotage`.
5. **Petite fenêtre selon le contrat de l’API.** Occurrence d’une série : OK, KO ou NA, compte rendu, preuve, réouverture
   motivée (routes existantes `…/validations` et `…/validations/reouverture`). Action hors série : l’API refuse un
   résultat (422) ; la fenêtre propose les commentaires et preuves de l’action (`ContributionsAction`, routes existantes)
   et renvoie à la fiche pour l’avancement ; aucun faux bouton OK/KO. Tâche historique : la fiche complète, où se trouve
   la réalisation dans la source (`legacy-tasks/complete`, sans résultat KO dans la cible).
6. **Teintes par sens plutôt que couleurs de la politique** dans la Timeline (orange « à faire », bleu en cours, vert
   terminé ou OK, rouge bloqué ou KO, gris annulé ou NA) ; les couleurs de la politique restent utilisées par le Gantt.
   Carrés d’occurrence : jaune, vert, rouge, gris, comme le dit la légende existante.
7. **Animation.** La référence animait `box-shadow` ; le portage anime un halo par `opacity` et `transform` (règle de la
   refonte). Les jetons sont ceux de la cible (`--mantine-color-*` d’état, `--neon-*`, `--suivi-*`).
8. **Séries et réglages.** La référence regroupait « Séries proposées » et le registre des séries dans un onglet
   « Séries et réglages » ; ils restent visibles sous la Timeline (des tests les lisent directement). Sur la Timeline des
   récurrences, la ligne d’une série ouvre la fiche de la série (planning, iCalendar, réglages).
9. **Liste compacte** : tableau Mantine dans `DataTable`, lignes ouvrables, au lieu du tableau en grille CSS de la
   référence (sémantique de tableau et noms de lignes conservés). Pas de colonne « ↗ » supplémentaire.
10. **Page Tâches récurrentes** : les vues autres que la Timeline montrent les mêmes fiches qu’avant ; la Timeline des
    occurrences liste à part les « Actions hors série » (ouvrables) et inclut les tâches récurrentes historiques.
11. **Synthèse** : compteurs calculés sur les fiches chargées et filtrées, distincts des totaux du serveur (vue Tableau de
    bord). Repères d’occurrence au milieu de leur jour, ligne d’aujourd’hui à l’heure courante.

## 3. Laissé de côté

- L’aperçu dépliable du bouton de titre (référence) : le titre doit ouvrir la fiche complète (tests) et les lignes ont une
  hauteur fixe alignée sur le dessin. L’aperçu passe par l’info-bulle du titre et l’en-tête de la petite fenêtre.
- Grand titre d’accroche, « orbe » d’aujourd’hui et carte d’horizon de la référence : remplacés par un en-tête compact
  (lignes fines). Mention « PAR DÉFAUT » : la vue par défaut dépend de la politique.
- `legacyValidation` et le résultat KO des tâches historiques : absents de l’API cible ; rien n’est inventé.

## 4. Fichiers

- `apps/web/src/grc/` : `Tasks.tsx` (en-tête, vues en icônes, pause, liste compacte, cartes) ; `Timeline.tsx` (calcul pur
  `calculerFrise` conservé, ancien rendu retiré) ; nouveaux `TimelineStudio.tsx`, `TimelineOccurrences.tsx`,
  `TimelineCommun.tsx`, `ValidationRapide.tsx`, `timeline-calendrier.ts`, `mouvement-taches.ts` ; `etat-action.ts`
  (teintes, commande et description des repères).
- `apps/web/src/registres/Validation.tsx` : propriété facultative `onEnregistre` (rafraîchir la Timeline après un
  résultat) ; comportement de la fiche inchangé.
- `apps/web/src/pages/Pilotage.tsx` : une propriété `occurrences={section === 'recurrences'}` passée à `Tasks`.
- `packages/ui/src/neon-taches.css` (déjà importée). Aucun export ni import supplémentaire nécessaire.
- Tests ajoutés : `apps/web/test/timeline-calendrier.test.ts` (13), `apps/web/test/timeline-studio.test.ts` (7).
- Hors interface : aucun fichier (API, `packages/shared`, migrations, Compose, CI inchangés).

## 5. Sélecteurs de bout en bout vérifiés

« Vue synchronisée » et ses options (Timeline, Liste, Kanban, Calendrier, Planning / Gantt, Tableau de bord), « Mois »,
« Registre », `treg` dans l’adresse, « Charger les 50 actions suivantes », région « Timeline des actions »,
`.grc-timeline__etiquettes`, `.grc-timeline__guide`, « ! En retard », groupe « Légende » (« En retard », « Occurrence : jaune
en attente »), « Période affichée : du », `data-fond`, `timeline-fond`, « Jours fériés en fond », boutons à nom exact des
actions (liste, Kanban, calendrier, Timeline), lignes de tableau (date `fr-FR`, « Fonction … »), « Planning des actions et
dépendances », « Total », « Ajouter une action », « Ajouter une tâche récurrente », « Séries proposées », cartes du registre
des séries (« Ouvrir la fiche »), groupe « Validation de l’occurrence ». Noms modifiés, non utilisés par les tests : frise
`role="img"` → groupe « Repères du début à l’échéance de chaque action » ; région de la liste « Tableau, défilement
horizontal possible » → « Actions, vue compacte » ; légende « barre cerclée de rouge » → « repère cerclé de rouge, en plus
de l’état ».

## 6. Contrôles exécutés (Node 22, `--config.engine-strict=false`)

| Contrôle                                                                    | Résultat                       |
| --------------------------------------------------------------------------- | ------------------------------ |
| `pnpm install --frozen-lockfile`, `tsc` de `packages/shared`, `mantine-css-vars` | réussis                   |
| ESLint (fichiers modifiés, `--max-warnings 0`), Prettier `--check`          | réussis                        |
| `packages/ui` : `tsc --noEmit`, Vitest                                      | réussi, 284/284                |
| `apps/web` : `tsc --noEmit`, Vitest (dont `charte`, `listes-sans-deselection`) | réussi, 271/271 (251 + 20) |
| `apps/web` : `vite build`                                                   | réussi                         |
| E2E concernés, pile locale (31 tests, captures de référence ignorées)       | **31/31**                      |
| Recette du lot (13 contrôles, clair, sombre, 390 px, zoom 150 %)            | 13/13                          |

Pile locale : bundle compilé servi avec la CSP du Caddyfile, API sur les sources (`createTestApp`, base PostgreSQL 16
jetable, automate des occurrences toutes les 15 s), administrateur fictif avec TOTP, Chromium de la session. Suites jouées :
`timeline-droits`, `timeline-lisible` (ordinateur et téléphone, Axe), `jours-de-fond`, `collaborateur` (Axe),
`filtres-taches`, `contexte-retour`, `registres-partages`, `deplacement`, `responsables`, `periodicite`, `zz-grc` (4),
`validation-occurrence`, `recurrences-planning`, `zzz-pilotage` (9), `zzzz-pilotage`, `parcours-iso` (4). La recette du lot
vérifie : fond de ligne → fiche ; repère au clavier → petite fenêtre, Échap, focus rendu au repère ; animation
`tache-pouls 2.2s` puis arrêt par la pause ; ligne de la liste ouvrable ; KO motivé depuis un repère, carré actualisé,
seconde validation non proposée, réouverture motivée avec le KO conservé au journal ; échelles et navigation ; Axe sans
violation (clair et sombre) ; aucune erreur JavaScript ni CSP ; aucun débordement horizontal (1440, 390, zoom 150 %).

Non exécutés : captures de référence Playwright (à régénérer par la CI), suite complète dans l’ordre de la CI, pile Docker,
Caddy, Node 26, PostgreSQL 18, `zzzzzz-jeu-de-test` (ignoré hors pile avec jeu de données), lecteur d’écran.
