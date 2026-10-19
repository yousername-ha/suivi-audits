# Implémentation — Périmètres

**Proposition v007 à valider. Aucun raccordement effectué.**

## Correction du constat de compatibilité — 19 octobre 2026

L’ancienne note fondée sur `d044eb9` indiquait l’absence de parent/enfant. Elle est remplacée par la lecture du snapshot Claude `284cb1e4ffbaee37e0952073db5659c2257c888e`, sans modification ni exécution dans cet espace.

| Élément vérifié dans le code source | Contrat constaté |
| --- | --- |
| `packages/shared/src/grc.ts` | `SmsiCreate` et `SmsiUpdate` acceptent `parentId`, `entityKind`, `inheritFrameworks`. `entityKind` : organisation, entite, perimetre. Schémas stricts. |
| `packages/shared/src/hierarchie-perimetres.ts` | Parent sans cycle, profondeur maximale 8. Héritage explicite à chaque niveau ; rattachement local prioritaire pour le même référentiel, même désactivé. |
| `apps/api/src/routes/grc.ts` | GET/POST `/api/grc/smsis` ; PATCH `/api/grc/smsis/:smsi`, version attendue dans `If-Match`. |
| `apps/api/src/grc/core.ts` | Création réservée à `pilotage:administrer`, contrôle d’accès en écriture au parent, journalisation. |
| `apps/api/test/perimetres-hierarchie.test.ts` | Tests présents pour cycles, accès, héritage, exceptions locales et couverture. **Sources lues, tests non exécutés dans ce travail.** |

Les fichiers de référence sont consultables au [commit Claude examiné](https://github.com/yousername-ha/suivi-audits/tree/284cb1e4ffbaee37e0952073db5659c2257c888e). Vérifier à nouveau les contrats sur le commit de l’intégration.

## Consignes pour la future intégration

1. Partir des [visuels v007](../maquettes/v007-fond-uni/README.md) une fois validés. Le dossier reste en développement jusque-là.
2. Réutiliser les fonctions partagées existantes ; ne pas recopier le modèle de démonstration JS dans le domaine métier. Utiliser les UUID réels et le versionnement serveur.
3. Présenter les rattachements effectifs et leur origine ; ne pas confondre héritage, conformité, certification et droits d’accès. Une coupure d’héritage n’efface pas les preuves ou écarts historiques.
4. Vérifier les contrats propres à chaque registre pour les associations multiples. Dédupliquer par identité d’objet. L’agrégation parent/enfant doit rester un choix explicite et respecter les accès serveur.
5. Le responsable de suivi n’appartient pas au schéma strict `SmsiCreate` lu : résoudre son contrat avant de l’envoyer. La relation fournisseur externe est confirmée par l’utilisateur. Réutiliser le registre fournisseur et ses rattachements existants ; ne pas détourner `parentId` pour représenter une relation de service.
6. Conserver le menu et le bandeau fixes, les fenêtres centrées, le graphique défilant et les états d’erreur, vide, accès refusé, conflit de version et chargement. Le masquage d’un bouton ne remplace pas les contrôles serveur.

La source de rendu couvre seulement les cas de démonstration ; les contrôles d’héritage complet, déplacement, suppression, droits et API restent à tester lors de l’intégration. Le graphique à positions fixes est une référence visuelle, pas le moteur d’agencement final.

L’IA de codage travaille exclusivement sur **sa propre branche** ; `legacy` lui sert de référence en lecture. Aucun changement dans Claude, aucune fusion, CI, mise en production ou modification de la cartographie dynamique n’est autorisé par cette livraison.

## Complément vérifié et contrat de réciprocité

`apps/api/src/grc/suppliers.ts` maintient un registre fournisseur unique, ses évaluations et ses rattachements aux périmètres (`scopes`). Routes lues dans `apps/api/src/routes/grc.ts` : `/api/suppliers`, `/api/suppliers/:id/evaluations`, `/api/grc/:smsi/suppliers` et `/api/grc/:smsi/suppliers/:supplierId`. Les vues existantes comprennent `Fournisseurs.tsx` et `FournisseursPerimetre.tsx`. Tests non exécutés dans Claude.

Les compteurs `mapped/requirements` du dashboard et la couverture des rapprochements ne sont pas des taux de conformité. Ne pas les renommer pour obtenir le nouvel indicateur.

[Spécification de la collection unique, du rendu et de la recette](PERIMETRES-GRAPHIQUES.md). Le dossier final sera consolidé après validation puis déplacé vers « à implémenter ». À chaque reprise, lire le marqueur « implémentation ok » selon les règles globales avant un éventuel classement dans « implémentées ».

## Mini-tableau de bord — lecture complémentaire

Dans le même snapshot de référence, `packages/shared/src/pilotage.ts` définit les BIA et `continuity_plan.planType` (`pca`, `pra`, `pcra`, `activity`). `apps/api/src/grc/tasks.ts` crée les occurrences récurrentes comme des actions munies de `seriesId`/`occurrenceKey` ; son dashboard des actions applique les statuts terminaux de la politique métier. Réutiliser ces modèles et ne pas ajouter un compteur de « tâches » au total des actions sans définir la partition.

Le contrat d’un agrégat complet par périmètre n’a pas été vérifié. Ne pas affirmer qu’une API unique expose déjà les quatre indicateurs ; réutiliser les services existants après examen des permissions et demander l’agrégat manquant au responsable métier si nécessaire.
