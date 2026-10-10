# Problèmes techniques et causes

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

| ID       | Problème                                                       | Cause / preuve                                                         | État / traitement                                                                         |
| -------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| TECH-001 | Documents de phase 0 ne décrivent plus toute la pile           | ARCHITECTURE/README anciens schémas sans gateway/updater               | CORRIGÉ documentaire : DAT actuel et avis de snapshot ; pas de changement infrastructure. |
| TECH-002 | Ancien updater incapable d’auto-corriger son outil find absent | BUG-003 ; image immuable antérieure au correctif                       | Code corrigé, premier redéploiement client à confirmer TEST-041.                          |
| TECH-003 | Une interface native n’implique pas migration SQL              | PilotageLegacy écrit app_state ; seul maps enregistré dans LegacyStore | OBSERVÉ, contrat voulu ; adapter le discours de reprise et tester par famille.            |
| TECH-004 | Les tests API suppriment des bases temporaires au setup        | apps/api/test/global-setup.ts, nom suivi_t_%                           | CONFIRMÉ ; interdits sur instance partagée, non exécutés ici.                             |
| TECH-005 | E/HDS ne disposent pas de toutes les grilles officielles       | sources-lot-c.json ; ressources ISO sous licence, accès ANS limité     | Limite explicite ; DEV-002, aucune reconstruction supposée.                               |
| TECH-006 | 2 000 minutes mensuelles non garanties                         | Recettes Docker/guide/rollback conservées malgré 3 scans supprimés     | OPT-006/007 ; pas de mesure de budget complète.                                           |
| TECH-007 | Noms techniques SMSI persistent dans API/tables                | grc_smsis, /api/grc/:smsi, compatibilité données                       | Décision volontaire ; libellés Pilotage dans le parcours normal.                          |
| TECH-008 | Tests/recette réels du serveur client inconnus                 | Commandes fournies, aucun résultat transmis                            | TEST-041/042 ; ne pas attribuer la CI au serveur utilisateur.                             |

Les tentatives de lecture d’un chemin documentaire inexistant ont été corrigées
pendant l’inventaire ; elles ne sont pas classées comme bugs applicatifs.
