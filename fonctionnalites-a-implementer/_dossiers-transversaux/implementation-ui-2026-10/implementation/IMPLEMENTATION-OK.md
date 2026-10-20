# Confirmation d'implémentation — interfaces ASTRA (dossier implementation-ui-2026-10)

| Élément | Valeur |
| --- | --- |
| Numéro | implementation-ui-2026-10 (lots L0 à L8, scénarios R01 à R18) |
| Version de référence | 3.6.0 (étiquette `v3.6.0` à poser par le RSSI sur `main` ; elle porte la 3.5.0, jamais publiée) |
| Branche et commit de code évalué | `claude-suivi-smsi`, `5d95560` |
| Base de référence lue | dossier `legacy` : `PROMPT-IMPLEMENTATION.md`, `INTEGRATION-RECETTE.md` (lecture seule, non modifié) |

## Périmètre livré

Registres (actions, écarts, tâches récurrentes) à plusieurs périmètres, hérités sans sélecteur propre ; droits par ressource
(lecteur, contributeur, gestionnaire) ; déplacement d'un élément ; filtre global par registres ; menu à sept familles ;
contribution, Timeline, plan d'actions conteneur ; responsable personne, groupe ou fonction ; écarts (classification, audit
d'origine, création depuis un audit, récidive, réouverture motivée) ; tâches récurrentes (validation OK/KO/NA immuable et
idempotente, fenêtres, jours exclus, calendriers iCalendar, enchaînement) ; graphe des périmètres et compteurs ; registres
restreints respectés par les listes, compteurs, calendrier, cartes et temps réel ; contexte de retour ; parcours clavier du menu.

Preuve scénario par scénario : [recette R01 à R18](../../../../docs/unification/RECETTE-INTEGRATION-ASTRA.md).
Décisions : [ADR 0043](../../../../docs/adr/0043-registres-perimetres-herites-et-droits-par-ressource.md).
Migrations SQL additives : `022` à `032` (la 3.6.0 porte aussi les migrations de la 3.5.0).

## Commandes et résultats

Voir la section « Commandes exécutées » de la recette : lint, format, typage propres ; Vitest shared 507, ui 166, web 54, API 595
sur PostgreSQL 18 ; contrôles de publication ; suite Playwright complète sur la pile Docker construite depuis le commit
(187 réussis, 2 ignorés, trois nouveaux parcours corrigés puis rejoués). Le job « Images, sécurité et pile complète » de la pull
request rejoue la suite complète sur le commit exact.

## Limites

- Les constats historiques du périmètre commun (outil de suivi d'origine) ne sont pas des fiches de registre : ils ne se déplacent pas.
- Calendriers iCalendar : fichier ou texte seulement (aucune adresse distante consultée) ; règles de répétition (RRULE) usuelles développées (cinq ans en avant au plus), règles rares signalées et laissées de côté ; heure et fuseau des événements ignorés.
- Une carte de périmètre compte les éléments visibles dans son périmètre : un registre multi-périmètre figure dans chacune de ses cartes ; le total général affiché sous les cartes compte chaque élément une seule fois.
- Aucun fichier du module cartographique dynamique n'a été modifié.

Ce fichier atteste le tableau de la recette, pas l'absence de défaut ; la recette du RSSI sur son serveur reste à faire.
