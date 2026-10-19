# 017 — Notes d’intégration préparatoires, v003

**Maquette à valider, dossier final non livré.** Ne pas intégrer sans validation de son périmètre. L’IA de codage travaille uniquement sur sa propre branche ; legacy est sa référence en lecture. Aucun changement de l’environnement Claude.

## Parcours et règles visuelles

Un plan contient des actions. Le module reçoit les actions créées directement ou issues des écarts et autres modules ; « transversal » décrit ces sources, pas un type de plan distinct. Les liens vers les référentiels et la conformité restent ceux des objets métiers existants. Une réalisation ne clôture pas automatiquement un écart et ne valide pas une exigence.

Un ou plusieurs périmètres associés aux plans et actions. Les exemples utilisent un plan par action : ne pas convertir cette hypothèse de présentation en nouvelle cardinalité backend sans vérifier le modèle actuel.

Timeline, Kanban, Liste & détail partagent données, filtres, identifiants et mutations. Pour la maquette, tableaux locaux en mémoire, sans doublons entre les vues. En intégration : cache des objets existants, invalidation après mutation et gestion des conflits/erreurs serveur.

| État demandé | Couleur | Comportement de la proposition |
| --- | --- | --- |
| À planifier | gris bleuté `#718597` | dates absentes ou proposées, jamais inventées |
| En cours | bleu `#2D6EAC` | dates de début et fin renseignées |
| En attente | orange `#B16A16` | dates conservées, motif du blocage visible |
| Terminé | vert `#36855C` | compte rendu de réalisation |

Retard rouge `#AC2948`, distinct du statut. Dans les fixtures : échéance antérieure au 19 octobre 2026 et action non terminée. En production, prendre la date, le fuseau, la politique métier et les statuts terminaux du serveur.

Début/fin inclusifs dans les barres de démonstration, coupure aux limites du mois, action d’un jour conservée. Les dates vides ne génèrent pas de durée arbitraire. Les barres et les intitulés ouvrent une fenêtre centrale (680 px max). Intitulés fixes à gauche, dates défilantes ; menu et en-tête fixes. Liste et Kanban ont des zones de défilement bornées. Sur mobile, menu replié, fiche centrale adaptée, timeline défilante avec intitulés de 205 px.

Responsable : identifiant + type personne/groupe/fonction, sélection issue des annuaires. Ne pas remplacer une fonction par une personne ou stocker uniquement un libellé. Une fonction peut changer de titulaire ; l’identité de l’auteur d’une opération doit rester l’utilisateur authentifié, distinct de l’affectation. Le contrat de résolution de ces affectations est à définir avec le socle.

## Socle consulté en lecture seule

Instantané Claude `284cb1e4ffbaee37e0952073db5659c2257c888e`, copie consultée le 19 octobre 2026. Aucune affirmation de fraîcheur de la branche distante ni de tests serveur exécutés.

- `packages/shared/src/grc.ts`, `TaskData` : `ownerId` UUID nullable, `startAt` et `dueAt` datetimes nullable, `status`, `description`, `justification`, dépendances ; schéma strict, début <= échéance.
- `apps/api/src/grc/core.ts`, normalisation action : états/catégories de la politique publiée ; transitions autorisées ; validation du responsable ; création terminale refusée ; justification de clôture d’au moins 10 caractères ; dépendances non terminées bloquant la clôture ; origine récurrente réservée à l’automate.
- `apps/api/src/routes/grc.ts` : GET `/api/grc/:smsi/tasks/window` (from/to) et `/api/grc/:smsi/tasks/dashboard`. Réutiliser les routes d’objets et de liens existantes après vérification au SHA d’intégration.
- `apps/api/src/grc/tasks.ts` : les actions sont des objets natifs/historiques ; occurrences récurrentes identifiables via `seriesId`/`occurrenceKey`. Éviter toute copie et tout double comptage avec 018.
- `packages/shared/src/suivi-plans.ts` décrit aussi les plans historiques spécialisés formation/sensibilisation/audit/exercice, leurs champs `start`, `end`, `owner` et leurs propres statuts. Ce modèle spécialisé ne doit pas être confondu avec le registre général des plans d’action.

## Écarts à résoudre avant raccordement

1. Groupe/fonction : non présents dans `TaskData` strict consulté (`ownerId` individuel). Faire confirmer ou compléter le contrat par l’agent métier, ne pas envoyer `ownerType` au schéma existant et ne pas créer un backend concurrent.
2. Quatre libellés : mapper sur la politique réellement publiée ; ne pas imposer les identifiants de démonstration `planned/active/blocked/done`. L’interface finale n’offre que les transitions permises.
3. Plan et associations à plusieurs périmètres : vérifier le modèle général et ses liens au SHA courant ; ne pas déduire une prise en charge d’un seul `smsi` dans l’URL ni réutiliser aveuglément les plans spécialisés historiques.
4. Blocage : faire confirmer le champ et le cycle de conservation du motif. La maquette possède `block` uniquement dans sa mémoire locale.
5. Contrôles UX proposés : dates complètes hors « À planifier » et motif obligatoire ; le schéma actuel permet des dates nullable. Faire confirmer cette différence avant implémentation.
6. Préserver autorisations serveur, refus 403, conflits 409, validation 422, historique et identité d’auteur. Le masquage frontend n’est pas une autorisation. Dates et changements de titulaire ne doivent pas réécrire l’historique.

La maquette ne couvre ni téléversement de preuves, ni envoi de notifications, ni drag-and-drop, ni permissions réelles, ni persistance. La présentation de l’origine n’est pas une preuve de création depuis les autres modules.

## Réutilisation et validation

Coque visuelle extraite de la maquette 018 v008 : en-tête, menu, variables de couleurs, statistiques, filtres et onglets. Dans l’application cible, réutiliser ces composants partagés et leurs jetons ; `shell.css` constitue un instantané autonome pour ce prototype et n’a pas vocation à dupliquer le design system en production.

[Recette exécutée](../maquettes/v003-timeline-responsables/technique/verification.json) : 27 contrôles de navigateur, sur le prototype uniquement. La génération des captures est séparée de la recette et les six images présentent les fixtures initiales, pas les données mutées par les tests. Une validation UX ne vaut pas recette API.

Après validation utilisateur, compléter le dossier technique/graphique et le prompt, puis déplacer toute la fonctionnalité vers `fonctionnalites-a-implementer`. À réception d’un marqueur « implémentation ok » confirmant la version, conserver la provenance et appliquer le cycle global. Aucun marqueur de confirmation trouvé lors de cette reprise.
