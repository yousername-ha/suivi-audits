# Implémentation — Périmètres

**Proposition graphique v003 à valider. Aucun raccordement effectué.**

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

1. Partir des [visuels v003](../maquettes/v003-gestion-graphique/README.md) une fois validés. Le dossier reste en développement jusque-là.
2. Réutiliser les fonctions partagées existantes ; ne pas recopier le modèle de démonstration JS dans le domaine métier. Utiliser les UUID réels et le versionnement serveur.
3. Présenter les rattachements effectifs et leur origine ; ne pas confondre héritage, conformité, certification et droits d’accès. Une coupure d’héritage n’efface pas les preuves ou écarts historiques.
4. Vérifier les contrats propres à chaque registre pour les associations multiples. Dédupliquer par identité d’objet. L’agrégation parent/enfant doit rester un choix explicite et respecter les accès serveur.
5. Le responsable de suivi n’appartient pas au schéma strict `SmsiCreate` lu : résoudre son contrat avant de l’envoyer. La relation externe fournisseur et ses autorisations restent à confirmer ; ne pas détourner `parentId` pour représenter une relation de service.
6. Conserver le menu et le bandeau fixes, les fenêtres centrées, le graphique défilant et les états d’erreur, vide, accès refusé, conflit de version et chargement. Le masquage d’un bouton ne remplace pas les contrôles serveur.

La source de rendu couvre seulement les cas de démonstration ; les contrôles d’héritage complet, déplacement, suppression, droits et API restent à tester lors de l’intégration. Le graphique à positions fixes est une référence visuelle, pas le moteur d’agencement final.

L’IA de codage travaille exclusivement sur **sa propre branche** ; `legacy` lui sert de référence en lecture. Aucun changement dans Claude, aucune fusion, CI, mise en production ou modification de la cartographie dynamique n’est autorisé par cette livraison.
