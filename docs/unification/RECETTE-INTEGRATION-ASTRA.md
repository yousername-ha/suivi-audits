# Recette de l'intégration des interfaces ASTRA (R01 à R18)

Référence : prompt et [recette de la branche `legacy`](https://github.com/yousername-ha/suivi-audits/tree/legacy/fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10) (lecture seule). Audit de départ : [AUDIT-L0](AUDIT-L0-INTEGRATION-UI-ASTRA.md). Décisions : [ADR 0043](../adr/0043-registres-perimetres-herites-et-droits-par-ressource.md).

**Bilan : l'intégration est partielle.** Elle livre le socle (registres, périmètres hérités, droits fins), le menu à sept familles, la contribution, la vue Timeline, la validation d'occurrence et la reprise des écarts. Elle ne livre pas les plans d'actions comme conteneurs, les responsables de type groupe ou fonction, les calendriers iCal et les fenêtres, les cartes de périmètres ni le déplacement d'un élément. Le marqueur `implementation/IMPLEMENTATION-OK.md` n'est donc **pas** écrit : aucune fonctionnalité annoncée comme bloquée ne peut être déclarée livrée.

Légende : **Présent** (parcours vérifié, accès et refus compris) · **Partiel** (une partie du scénario est vérifiée) · **Absent** (non réalisé).

## Scénarios

| ID | Scénario | Statut | Preuve et limite |
| --- | --- | --- | --- |
| R01 | Registre sur A et B, puis un élément | **Partiel** | Registre à plusieurs périmètres, élément qui l'hérite sans sélecteur propre : `registres-droits.test.ts`, parcours Playwright « Registres ». Vérifié pour les actions ; les écarts et les tâches récurrentes utilisent le même rattachement (registre par défaut du périmètre) mais leur création dans un registre multi-périmètre n'a pas son propre parcours. |
| R02 | Filtrer sur B avec plusieurs registres | **Partiel** | `GET /api/registres?perimetre=` renvoie les registres concernés ; les listes d'éléments ne proposent pas encore de filtre global par registres sélectionnés. |
| R03 | Déplacer un élément d'un registre à un autre | **Absent** | Aucune commande de déplacement (droits, liens, concurrence, aperçu). |
| R04 | Modifier les périmètres d'un registre qui contient des éléments | **Présent** | Aperçu d'impact (éléments, séries, liens, droits), motif obligatoire, `If-Match`, atomicité et journal : `registres-droits.test.ts`, parcours « Registres ». Le périmètre de référence ne peut pas être retiré. |
| R05 | Personne autorisée seulement sur A d'un registre A/B | **Partiel** | Lecture si un périmètre au moins est accessible, écriture seulement si tous le sont ; périmètres non autorisés comptés, jamais nommés ; 404 uniforme sans droit de lecture (`registres-droits.test.ts`). Limite connue : compteurs agrégés et événements temps réel ne tiennent pas encore compte des registres restreints ni des droits attribués. |
| R06 | Ancien lien, favori, accès contextuel | **Partiel** | Aucune adresse supprimée, mêmes droits de lecture (`navigation.test.ts`, 176 parcours Playwright). Le retour de contexte depuis un audit n'est pas traité. |
| R07 | Timeline : dates absentes, un jour, deux mois, début après fin | **Partiel** | Calcul pur testé (`timeline.test.ts`) : pas de durée inventée, actions sans date listées à part, période bornée à deux ans ; début après fin refusé par le serveur (`TaskData`). Pas de messages d'erreur dédiés dans la vue. |
| R08 | « En attente » puis « terminé » ; responsable personne, groupe, fonction | **Partiel** | Transitions du workflow, motif de clôture et auteur de session respectés (`POST …/contribution`). Le responsable reste une personne : groupe et fonction **Absents**. |
| R09 | Écart depuis un audit et une action liée | **Partiel** | Champ « Audit d'origine » contrôlé par le serveur (un audit, pas une autre fiche) ; action liée par « Créer une action suivie ». Pas de création d'écart depuis l'écran d'audit. Aucune clôture ni conformité automatique. |
| R10 | Récidive après clôture | **Partiel** | Champ « Constat précédent (récidive) » (jamais le constat lui-même), badge « Récidive », clôture d'origine intacte ; en plus, réouverture motivée tracée au journal immuable (`pilotage.test.ts`). Le nouveau constat lié se crée à la main. |
| R11 | Fenêtre de tâche ouverte ou fermée, jours exclus | **Absent** | Aucune fenêtre de réalisation ni jour exclu dans le moteur de récurrence. |
| R12 | Import iCal valide, incorrect, répété | **Absent** | Aucun import de calendrier. |
| R13 | OK/KO/NA, preuve, double clic, panne réseau | **Présent** | Journal immuable (déclencheurs), auteur de session, heure du serveur, idempotence par `requestId`, KO et NA motivés, preuve résolue par le serveur, réouverture motivée réservée aux gestionnaires : `validations-occurrences.test.ts` (6 tests), parcours Playwright « validation d'occurrence ». |
| R14 | Enchaînement automatique des occurrences | **Absent** | La validation n'écrit pas le statut de l'action ni ne déclenche la suivante. Une validation KO ne crée aucun écart (comportement non demandé). |
| R15 | Menu, contenu long, 390 px, clavier, deux thèmes | **Partiel** | Sept familles, onglets de rubriques défilants, captures à 390 et 1440 px, clair et sombre, axe-core sans violation nouvelle. Pas de parcours clavier dédié au menu. |
| R16 | Créer un périmètre depuis la liste et depuis le graphe | **Partiel** | Création depuis la liste (Pilotage → Périmètres). Pas de graphe de périmètres. |
| R17 | Action récurrente et autres compteurs sur la carte | **Absent** | Pas de cartes de périmètres ni de compteurs de synthèse. |
| R18 | Régression de la cartographie dynamique | **Présent** | Aucun fichier du module cartographique modifié (seule la liste des migrations attendues de `carto.test.ts` s'allonge) ; ses parcours Playwright (`recette-cartographie`) passent dans les 176 parcours de la pile complète. |

## Ce qui est livré, par lot

| Lot | Contenu | État |
| --- | --- | --- |
| L0 | Audit de la cible, matrice présent/absent, anomalies A1 à A8 | Livré (document) |
| L1 | Fondations | Vérifiées par l'audit ; plan de reprise des données appliqué par la migration 029 |
| L2 | Coque et menu à sept familles | Livré |
| L3 | Registres, périmètres hérités, droits par ressource, écran « Registres et droits » | Livré, sauf déplacement d'élément et filtre global |
| L4 | Plans d'actions | **Partiel** : contribution, droits par élément, vue Timeline ; pas de plan conteneur, pas de responsable groupe ou fonction |
| L5 | Écarts | **Partiel** : classification, audit d'origine, récidive, réouverture motivée |
| L6 | Tâches récurrentes | **Partiel** : validation OK/KO/NA ; pas d'iCal, de fenêtres ni d'enchaînement |
| L7 | Cartes de périmètres | **Non commencé** |
| L8 | Recette | Ce document |

## Contrats métier à compléter (aucun mock branché)

- Responsable de type groupe ou fonction : contrat d'affectation typée et résolution des annuaires.
- Fenêtres de réalisation, jours exclus, calendriers iCal : extension versionnée de `recurrence.ts`.
- Déplacement d'un élément entre registres : droits, liens, concurrence, aperçu, trace.
- Plan d'actions comme conteneur (dates, statut, responsable, actions ordonnées).
- Cartes de périmètres : compteurs de conformité, écarts, BIA/PCRA, retards, sans double comptage.

## Commandes exécutées

Sur le commit de la version, avec Node 24 en local et PostgreSQL 18 (conteneur) :

```
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm -r typecheck
pnpm test                       # shared, ui, web, API sur PostgreSQL 18
# pile Docker complète (images construites depuis le commit), Playwright 1.56.1 dans l'image de la CI ; reproduit en local puis rejoué par le job « Images, sécurité et pile complète »
```

Résultats consignés dans la section de version du [journal des modifications](../../CHANGELOG.md) et dans les exécutions de CI de la pull request correspondante (six contrôles).
