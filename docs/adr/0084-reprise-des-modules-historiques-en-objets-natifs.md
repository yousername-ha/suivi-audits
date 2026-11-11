# ADR 0084 — Reprise des modules historiques en objets natifs

- Statut : **proposée** (décisions du RSSI du 11/11/2026 ; numéro annoncé et accepté par le RSSI, règle 5 d'AGENTS).
- Date : 2026-11-11
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Fait suite à la [note de cadrage](../unification/NOTE-CADRAGE-SORTIE-MODELE-HISTORIQUE.md) et complète l'[ADR 0007](0007-transition-legacy.md),
  l'[ADR 0040](0040-sortie-du-json-plat-modules-en-tables.md) et l'[ADR 0083](0083-porte-de-lecture-autorisee-entre-modules.md).

## Contexte

Les clés du format historique sont servies par des tables (ADR 0040) à travers une façade recomposée. Deux familles de références
(`legacy:<clé>:<id>` et `object:<uuid>`) et deux logiques de droits (droit de module clé par clé, ou périmètre, registre restreint et
rôle attribué) coexistent. La note de cadrage proposait une sortie progressive, module par module, et listait quatre décisions.

## Décisions du RSSI (11/11/2026)

1. **Principe** : poursuivre la reprise des modules historiques en objets GRC natifs, **module par module**.
2. **Premier lot** : CRRC, puis investissements, puis revues d'accès (modules à peu de liens transverses).
3. **Références existantes** : **conversion unique à la migration** (les références modifiables sont réécrites en `object:<uuid>`) ; les
   journaux immuables (décisions de pilotage, audit) gardent leur forme d'origine et ne sont pas réécrits.
4. **Règle d'accès** : **registres restreints par défaut**. Chaque module repris range ses objets dans un registre restreint de sa
   famille. À la bascule, **seuls les administrateurs** ont accès ; les droits sont ensuite attribués personne par personne
   (ADR 0043, ADR 0067). Le droit de module reste nécessaire, il n'est plus suffisant.

## Invariants

- L'**import et l'export au format historique restent inchangés** (schéma 15, invariant d'AGENTS) : la façade du module est conservée
  par un mapper qui projette les objets natifs dans le format historique et inversement. Test d'aller-retour sur la fixture et tests de
  couverture du contrat à chaque module.
- **Migrations additives**, jamais de migration publiée modifiée. Retrait des anciennes tables dans une migration ultérieure, après au
  moins une version de transition.
- Identifiants historiques conservés (`legacy_key`, `legacy_id`) ; historique et audit conservés ; aucune perte de champ.
- URL, schémas et niveaux d'accès des routes du module inchangés pendant la reprise, sauf l'ajout de l'écran d'attribution des droits.
- Une PR par étape, 7 contrôles verts, vers `claude-suivi-smsi`.

## Conséquence à connaître : la bascule retire l'accès aux non-administrateurs

La décision 4 change **qui voit quoi** à la bascule d'un module : tant que le RSSI n'a pas attribué de droits sur le registre restreint,
les équipes qui utilisent le module n'y accèdent plus. Mesures prévues : l'annonce figure dans les notes de mise à jour de la version
qui porte la bascule, la procédure d'attribution est décrite dans `docs/INSTALLATION.md`, et la migration journalise les accès retirés.
Le retour arrière passe par la restauration de la sauvegarde d'avant mise à jour (procédure 11.4).

## Plan du premier module : CRRC

Six entités aujourd'hui dans `suivi_crrc_*` : établissements, ressources, sauvegardes, restaurations, alertes, offres.

| Étape | Contenu | Comportement visible |
|---|---|---|
| 1 | **Socle** : types d'objets GRC pour les six entités (schémas partagés), famille de registre « CRRC », migration additive qui ne déplace aucune donnée | aucun |
| 2 | **Mapper** : projection objets natifs ↔ format historique, test d'aller-retour sur la fixture ; les tables `suivi_crrc_*` restent la source | aucun |
| 3 | **Bascule** : migration des données vers des objets natifs rangés dans le registre restreint « CRRC », conversion des références, accès réservé aux administrateurs, journal | **accès retiré aux non-administrateurs** |
| 4 | **Service et routes** `/api/crrc` sur les objets natifs, mêmes URL et mêmes schémas, droits par registre ; écran d'attribution des droits | aucun hors attribution |
| 5 | **Retrait** des tables `suivi_crrc_*` dans une migration ultérieure, après une version de transition | aucun |

Les étapes 1 et 2 ne changent rien pour les utilisateurs et peuvent être livrées sans attendre ; l'étape 3 est la seule qui retire un
accès et se livre avec les notes de mise à jour. Les investissements puis les revues d'accès suivent le même plan, une fois CRRC validé.

## Alternatives écartées

- **Alias durable des références** (écarté par la décision 3) : plus sûr à migrer mais maintient indéfiniment deux familles de références.
- **Reproduire les accès existants à la bascule** (écarté par la décision 4) : évitait la coupure d'accès mais conservait des droits larges.
- **Droit de module seul, sans registre** : plus simple mais sans la finesse des registres pour ces modules.

## Questions ouvertes (avant l'étape 3)

- Texte exact de l'annonce et procédure d'attribution des droits (à rédiger avec la bascule).
- Choix des types GRC pour les six entités (un type par entité proposé) et des champs conservés tels quels dans `data`.
