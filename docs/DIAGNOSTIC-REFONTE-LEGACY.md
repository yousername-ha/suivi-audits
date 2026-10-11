# Phase 1 — Diagnostic avant refonte du Legacy

11 octobre 2026 · branche `legacy/test-lots-d-f` uniquement.

## Architecture constatée

Le Legacy est une application HTML/CSS/JavaScript avec les bibliothèques locales
déjà fournies, une migration additive du document JSON `S` et les modules D/F.
`demarrer.py` sert les fichiers sur localhost ; il ne possède ni API métier,
authentification ni sauvegarde serveur. LocalStorage et IndexedDB conservent
actuellement l'état et les pièces physiques. Les mises à jour passent par `touch`,
`localSave`, `render` et le pont `LegacyDFUI.install`.

| Registre existant | Réutilisation prévue |
| --- | --- |
| `S.roles` | Rôles fonctionnels ; IDs stables ajoutés, titulaires et affectations conservés |
| `S.findings` | Plan d'action commun, sous-tâches et actions correctives |
| `S.frameworks` | Référentiels et versions, dont CaRE D2 |
| `S.df.dossiers`, `S.df.evaluations` | Suivis CaRE/HAS et exigences, sans registre parallèle |
| `S.evidences` | Preuves centrales et versions physiques ; catégorie comptable ajoutée |
| `S.scope`, `S.processes`, `S.crrc.establishments` | Contexte historique et liens explicites vers les périmètres |
| `S.plans`, `S.incidents`, `S.crisis` | Plans historiques conservés et relations PCRA |

## Causes identifiées

La liste `roleList` n'est appliquée qu'aux inputs reconnus par leurs `data-*`.
Les formulaires D/F emploient des `name` et champs texte indépendants : ils
n'affichent pas les rôles existants et n'enregistrent aucun responsable structuré.
Les périmètres des dossiers D/F sont des libellés libres. Il n'existe pas de
registre hiérarchique GHT/établissements ni de couverture plusieurs-à-plusieurs.

Le parcours guidé existe dans la nouvelle application : les étapes sont définies
dans `packages/shared/src/pilotage.ts` (`JOURNEY_STEPS`) et les règles de lecture
dans `apps/api/src/pilotage/service.ts`. Ces sources sont consultées sans modification.
Leurs définitions seront adaptées au moteur JSON Legacy : les formulaires du
parcours écriront les mêmes objets que les écrans unitaires.

## Décisions d'implémentation

1. Établir les périmètres et responsables avant le parcours et la continuité.
2. Utiliser `S.perimeters`, des IDs de rôles et des relations par identifiants.
   Préserver les libellés et données anciennes lors des migrations.
3. Ajouter les étapes et sous-tâches du parcours ; leurs actions restent dans
   `S.findings`. Le statut d'une étape est calculé sur les données réelles,
   les versions de preuves, les tâches et les validations humaines.
4. La persistance serveur et les permissions exigées ne sont pas réalisables
   par le serveur statique actuel. Étendre le serveur Python du Legacy avec
   SQLite, sessions, protection d'origine/CSRF, versions et pièces protégées.
   Cela reste dans cette branche, sans React/Fastify ni dépendance d'exécution
   supplémentaire. Le serveur reste lié à localhost.
5. Un registre d'authentification distingue les comptes des rôles fonctionnels
   `S.roles`. Les périmètres autorisés sont contrôlés côté serveur et les objets
   non accessibles ne sont pas transmis au navigateur. Les anciens objets sans
   affectation restent visibles à l'administrateur pour classement explicite.
6. Importer CaRE D2 seulement depuis un document officiel effectivement lu.
   Les pages ANS renvoient actuellement une protection automatisée : les PDF
   officiels directement accessibles sont recherchés ; aucune grille inventée.
7. Ajouter le PCRA, puis alléger la navigation à partir de la capture utilisateur.

## Ordre et validation

Phases : audit → fondations → parcours → CaRE D2/preuves → BIA/PCA/PRA/exercices
→ interface → recette globale. Tests de migration, couverture des établissements,
isolation serveur, droits sur les pièces, idempotence des actions, réouverture des
étapes, modification des BIA et plans, sauvegardes et parcours navigateur.

Le diagnostic est produit avant toute modification fonctionnelle. Aucune nouvelle
fonctionnalité ni permission serveur n'est déclarée réalisée à ce stade.

## Résolution de la recherche documentaire (phase 4)

Après ce diagnostic, le PDF officiel D2 et le guide financier ont été obtenus
par leurs URL directes ANS/Convergence. Les 13 références D2 sont maintenant
intégrées ; l’incohérence de version du guide et l’indisponibilité du kit complet
restent documentées dans [SOURCES-ET-LIMITES.md](SOURCES-ET-LIMITES.md).
