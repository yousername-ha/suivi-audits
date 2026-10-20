# Recette de l'intégration des interfaces ASTRA (R01 à R18)

Référence : prompt et [recette de la branche `legacy`](https://github.com/yousername-ha/suivi-audits/tree/legacy/fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10) (lecture seule). Audit de départ : [AUDIT-L0](AUDIT-L0-INTEGRATION-UI-ASTRA.md). Décisions : [ADR 0043](../adr/0043-registres-perimetres-herites-et-droits-par-ressource.md).

**Bilan : les dix-huit scénarios sont réalisés dans le périmètre décrit ci-dessous, avec leurs limites connues.** Chaque ligne cite la preuve exécutée (tests Vitest sur PostgreSQL 18 et parcours Playwright sur la pile Docker complète) ; les limites restent écrites là où elles existent. Le marqueur `implementation/IMPLEMENTATION-OK.md` est écrit pour cette raison et pour elle seule : il atteste ce tableau, pas une absence de défaut.

Légende : **Présent** (parcours vérifié, accès et refus compris) · **Partiel** (une partie du scénario est vérifiée) · **Absent** (non réalisé).

## Scénarios

| ID | Scénario | Statut | Preuve et limite |
| --- | --- | --- | --- |
| R01 | Registre sur A et B, puis un élément | **Présent** | Registre à plusieurs périmètres, élément qui l'hérite sans sélecteur propre, pour les trois familles (actions, écarts, tâches récurrentes avec leurs occurrences) : `registres-droits.test.ts`, `registres-familles.test.ts`, parcours Playwright « Registres ». Un élément dans un registre d'une autre famille est refusé. |
| R02 | Filtrer sur B avec plusieurs registres | **Présent** | Onglet « Éléments par périmètre » et `GET /api/registres/elements` : union des registres choisis, sans doublon, limitée aux registres lisibles (`registres-deplacement.test.ts`, parcours Playwright). |
| R03 | Déplacer un élément d'un registre à un autre | **Présent** | Commande atomique avec aperçu d'impact, motif, `If-Match`, droit de gestion des deux registres, même famille, même identifiant, liens incompatibles confirmés, journal (`registres-deplacement.test.ts`, parcours Playwright). Limite : les constats historiques du périmètre commun vivent dans des tables propres, sans registre, et ne se déplacent pas. |
| R04 | Modifier les périmètres d'un registre qui contient des éléments | **Présent** | Aperçu d'impact (éléments, séries, liens, droits), motif obligatoire, `If-Match`, atomicité et journal : `registres-droits.test.ts`, parcours « Registres ». Le périmètre de référence ne peut pas être retiré. |
| R05 | Personne autorisée seulement sur A d'un registre A/B | **Présent** | Lecture si un périmètre au moins est accessible, écriture seulement si tous le sont ; périmètres non autorisés comptés, jamais nommés ; 404 uniforme (`registres-droits.test.ts`). Registres restreints : listes, tableau de bord des tâches, calendrier, compteurs partagés, cartes de périmètres et flux temps réel n'exposent ni élément, ni identifiant, ni version à qui ne peut pas lire le registre (`realtime.test.ts`, `cartes-perimetres.test.ts`). |
| R06 | Ancien lien, favori, accès contextuel | **Présent** | Aucune adresse supprimée, mêmes droits de lecture (`navigation.test.ts`). « Voir l'audit d'origine » et « Voir le constat précédent » ouvrent la fiche dans sa rubrique, avec « Retour à la page précédente » : chemin et filtres de liste (dans l'adresse) retrouvés, périmètre conservé ; seuls les chemins internes sont acceptés (`retour.test.ts`, parcours Playwright « contexte de retour »). |
| R07 | Timeline : dates absentes, un jour, deux mois, début après fin | **Présent** | `timeline.test.ts` : pas de durée inventée, actions sans date listées à part, période affichée annoncée et bornée à deux ans avec les actions hors période listées, début après l'échéance ou date illisible signalés avec la raison (jamais inversés) ; le serveur refuse déjà ces dates à la saisie. Parcours Playwright : période affichée. |
| R08 | « En attente » puis « terminé » ; responsable personne, groupe, fonction | **Présent** | Transitions du workflow, motif de clôture et auteur de session respectés (`POST …/contribution`) ; responsable personne, groupe ou fonction (migration 031) : désignation validée par le serveur, une seule désignation, rappels aux titulaires actifs (`responsables.test.ts`, parcours Playwright « fonction désignée »). |
| R09 | Écart depuis un audit et une action liée | **Présent** | « Constater un écart pour cet audit » préremplit l'audit d'origine, contrôlé par le serveur ; action liée par « Créer une action suivie » ; aucune clôture ni conformité automatique (`pilotage.test.ts`, parcours Playwright). |
| R10 | Récidive après clôture | **Présent** | « Déclarer une récidive » sur un constat clos : nouveau constat lié (jamais à lui-même), clôture d'origine intacte, réouverture motivée au journal immuable (`pilotage.test.ts`). Parcours Playwright de bout en bout : constat clos (cause, preuve, efficacité vérifiée, clôture), « Déclarer une récidive », nouveau constat lié, clôture d'origine intacte, « Voir le constat précédent » (`zzzzzzzzzzzzzzzzzzzzzzzzzzzzz-recidive.spec.ts`). |
| R11 | Fenêtre de tâche ouverte ou fermée, jours exclus | **Présent** | Fenêtre de réalisation (ouverture avant l'échéance, clôture après) appliquée par le serveur à la validation ; jours exclus (dates, jours de la semaine) reportent l'échéance, les superpositions ne produisent qu'une occurrence (`series-fenetres-calendrier.test.ts`, `recurrence-calendrier.test.ts`, parcours Playwright). |
| R12 | Import iCal valide, incorrect, répété | **Présent** | Aperçu, erreurs avec leur ligne, import tout ou rien sous `If-Match`, rejeu sans doublon (`series-fenetres-calendrier.test.ts`, parcours Playwright). Limites : le calendrier est fourni en fichier ou en texte (aucune adresse distante n'est consultée, donc pas de « source indisponible ») ; les règles de répétition (RRULE) usuelles (quotidienne, hebdomadaire avec jours, mensuelle par jour du mois — dernier jour compris — ou par jour de rang comme le premier lundi ou le dernier vendredi, annuelle avec mois ; intervalle, nombre, date de fin, exceptions EXDATE) sont développées de un an en arrière à cinq ans en avant, les règles plus rares sont signalées avec leur raison et laissées de côté (`recurrence-calendrier.test.ts`). |
| R13 | OK/KO/NA, preuve, double clic, panne réseau | **Présent** | Journal immuable (déclencheurs), auteur de session, heure du serveur, idempotence par `requestId`, KO et NA motivés, preuve résolue par le serveur, réouverture motivée réservée aux gestionnaires : `validations-occurrences.test.ts`, parcours Playwright « validation d'occurrence ». |
| R14 | Enchaînement automatique des occurrences | **Présent** | « Occurrence suivante » (et option « passer automatiquement » après une validation) ouvre la plus ancienne occurrence non validée dont la fenêtre est ouverte ; le résultat précédent reste figé au journal, un KO reste une validation réalisée ; en cas d'échec de validation, on ne passe pas à la suivante (`series-fenetres-calendrier.test.ts`, parcours Playwright). |
| R15 | Menu, contenu long, 390 px, clavier, deux thèmes | **Présent** | Sept familles, onglets de rubriques défilants, captures à 390 et 1440 px, clair et sombre, axe-core sans violation nouvelle ; parcours clavier du menu (famille activée à Entrée, focus visible dans les deux thèmes), menu mobile ouvert et fermé au clavier avec retour du focus, aucun défilement horizontal (parcours Playwright « menu au clavier »). |
| R16 | Créer un périmètre depuis la liste et depuis le graphe | **Présent** | Page Périmètres : liste et graphe ; « Ajouter un enfant » sur une carte ouvre le formulaire de la liste (même route, même identifiant, présent dans tous les sélecteurs) : parcours Playwright « graphe des périmètres » et « Périmètres » existant. |
| R17 | Action récurrente et autres compteurs sur la carte | **Présent** | `GET /api/grc/perimetres/synthese` : actions, séries et occurrences (comptées une seule fois, jamais aussi dans les actions), écarts, BIA et plans, conformité ; éléments terminés et archivés exclus ; « indisponible » (null) sans droit ou sans donnée mesurable, jamais zéro : `cartes-perimetres.test.ts`, parcours Playwright. Les cartes d'un registre multi-périmètre comptent chacune ses éléments : elles ne s'additionnent pas, d'où un total sans doublon : **chaque carte parent affiche son total avec ses sous-périmètres** (chaque élément une seule fois, jamais la somme des cartes enfants) et un total général est affiché sous les cartes. |
| R18 | Régression de la cartographie dynamique | **Présent** | Aucun fichier du module cartographique modifié (seule la liste des migrations attendues de `carto.test.ts` s'allonge) ; ses parcours Playwright (`recette-cartographie`) passent dans la pile complète. |

## Ce qui est livré, par lot

| Lot | Contenu | État |
| --- | --- | --- |
| L0 | Audit de la cible, matrice présent/absent, anomalies A1 à A8 | Livré (document) |
| L1 | Fondations | Vérifiées par l'audit ; plan de reprise des données appliqué par la migration 029 ; annuaire des fonctions (migration 031) |
| L2 | Coque et menu à sept familles | Livré |
| L3 | Registres, périmètres hérités, droits par ressource, déplacement, filtre global | Livré |
| L4 | Plans d'actions | Livré : plan conteneur (période, statut, responsable, actions ordonnées, migration 032), contribution, droits par élément, Timeline |
| L5 | Écarts | Livré : classification, audit d'origine, création depuis un audit, récidive, réouverture motivée |
| L6 | Tâches récurrentes | Livré : validation OK/KO/NA, fenêtres, jours exclus, calendriers iCalendar, enchaînement |
| L7 | Cartes de périmètres | Livré : graphe et compteurs de synthèse |
| L8 | Recette | Ce document |

## Limites connues (reportées, non cachées)

- Les constats historiques du périmètre commun (outil de suivi d'origine) ne sont pas des fiches de registre : ni déplacement, ni registre propre.
- Calendriers iCalendar : fichier ou texte seulement ; règles de répétition rares (BYSETPOS, BYWEEKNO, BYYEARDAY, heures, etc.) signalées et non développées ; heure et fuseau des événements ignorés.
- Les cartes de périmètres comptent les éléments visibles dans chaque périmètre ; un registre multi-périmètre figure donc dans chacune de ses cartes. Le total d'une carte parent et le total général comptent chaque élément une seule fois (conformité non agrégée).

## Commandes exécutées

Sur le commit de code `5d95560` (branche `claude-suivi-smsi`), avec Node 24 en local et PostgreSQL 18 (conteneur) :

```
pnpm install --frozen-lockfile
prettier --check . ; eslint . --max-warnings 0 ; tsc --noEmit (shared, API, web)      # propres
vitest : shared 507, ui 166, web 54, API 595 (71 fichiers, PostgreSQL 18)             # tous réussis
node --test scripts/tests/publication.test.mjs ; verifier-changelog.mjs ; test_updates.py   # réussis
# pile Docker complète construite depuis le commit, Playwright 1.56.1 dans l'image de la CI :
#   suite complète : 187 parcours réussis, 2 ignorés, 3 échecs — les trois nouveaux parcours « menu au clavier »
#   (attente erronée : Entrée déplie une famille, il n'y mène pas) et « contexte de retour » (mauvaise adresse de
#   rubrique) ; corrigés, rejoués avec l'installation : 11 réussis ; les captures de l'écran Administration
#   (onglet « Fonctions ») ont été régénérées.
```

Limite de cette preuve : la suite complète n'a pas été rejouée d'un seul tenant après les deux corrections de parcours ; le job « Images, sécurité et pile complète » de la pull request le fait sur le commit exact. Les résultats de CI sont consignés dans la pull request correspondante (six contrôles) et dans la section de version du [journal des modifications](../../CHANGELOG.md).
