# ADR 0084 — Retrait définitif des modules CRRC et Investissements

- Statut : acceptée (décision du RSSI du 11/11/2026, numéro annoncé et accepté dans la session)
- Date : 2026-11-11
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Remplace la proposition d'ADR 0084 « Reprise des modules historiques en objets natifs » (jamais fusionnée, PR fermée) pour
  ces deux modules. Applique le précédent de l'[ADR 0057](0057-retrait-de-la-page-conformite-ia.md) (retrait d'un module et de
  ses données). Déroge à la règle « migrations additives » du dépôt, comme la migration 043.

## Contexte

Le chantier d'architecture du 09/11/2026 prévoyait de reprendre CRRC, Investissements et Revues d'accès en objets natifs
(note de cadrage `NOTE-CADRAGE-SORTIE-MODELE-HISTORIQUE.md`). Au moment d'écrire l'ADR de reprise, le RSSI a décidé de
**retirer définitivement de l'ancien et du nouveau code le module CRRC et le module Budget** — c'est-à-dire, après
vérification dans le menu, le module **Investissements** (« Plan d'investissement », rubrique Budget). Il n'y a donc plus rien
à reprendre pour ces deux modules.

## Décision

- **Les pages, menus et routes disparaissent** : rubriques « Sauvegardes (CRRC) » (huit pages) et « Budget » du menu, routes
  `/api/crrc/*` et `/api/investissements/*`, services `GestionCrrc` et `Investissements`, schémas partagés `suivi-crrc` et
  `suivi-invest`, rubriques d'export Excel « Gestion CRRC » et « Plan d'investissement », données de démonstration et du jeu de
  test, entrées des listes de remise à vide.
- **Les données sont supprimées définitivement** par la migration `053_retrait_crrc_investissements.sql` : tables
  `suivi_crrc_*` (six), `invest_lines` et `invest_settings` (`DROP TABLE`), clés `crrc` et `invest` de l'état historique et de
  `suivi_presence`, liens `legacy:crrc:*` et `legacy:invest:*`. La sauvegarde automatique de `scripts/mettre-a-jour.sh`
  précède la migration ; c'est le seul retour arrière. Le journal d'audit et les décisions immuables ne sont pas touchés.
- **Les modules de droits `crrc` et `investissements` sont retirés** : leurs permissions sortent des rôles personnalisés, leur
  restriction des attributions directes et des écrans muraux, leur activation du réglage des modules (contrainte de liste
  recréée). La matrice passe de 15 à 13 modules (65 permissions).
- **Format d'échange historique (schéma 15)** : les clés `crrc` et `invest` disparaissent du contrat (`LEGACY-FORMAT.md`), du
  mapping, du schéma de validation et de la fixture. Un fichier de l'outil historique qui les contient reste importable : elles
  sont **écartées sans rien dire** (liste des clés retirées de `plan.ts`, avec les constats historiques) ; l'export ne les produit
  plus. Le schéma reste à 15.
- **Le plan de l'ADR 0084 proposée est abandonné** pour ces modules ; les Revues d'accès restent un module historique non
  repris (décision ultérieure).

## Ce qui n'est pas fait

- Aucun export automatique des données avant suppression : qui veut les conserver exporte les rubriques Excel de la version
  précédente avant la mise à jour (indiqué dans `INSTALLATION.md`).
- Les documents ou fournisseurs qui citaient un établissement CRRC ou une ligne budgétaire ne sont pas réécrits : seules les
  références `legacy:crrc:*` et `legacy:invest:*` sont retirées.

## Conséquences

Migration destructive mais bornée (huit tables, deux clés d'état, droits). Moins de code historique à reprendre : plus de 5 000
lignes d’application et de tests en moins, dont les 17 routes CRRC et 5 routes Investissements. Les entrées de
l'inventaire fonctionnel FCT-033, FCT-034, FCT-052 et FCT-053 passent à « RETIRÉ ». Le garde-fou d'architecture et le test RBAC
sont mis à jour (routes et modules supprimés).
