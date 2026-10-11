# Historique des corrections

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Référence unique : [REGISTRE_BUGS](../04_QUALITE/REGISTRE_BUGS.md).

| Bug     | Correction                                                                                          | Commit  | Validation / reste                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| BUG-001 | Navigation explicite et recette du clic desktop/mobile.                                             | cc285b4 | CORRIGÉ ET VALIDÉ ; Validation sur le serveur utilisateur.                                                                   |
| BUG-002 | Poller commun intégré dans updater ; clé/destination générées ou configuration explicite conservée. | cc285b4 | CORRIGÉ ET VALIDÉ ; Redéploiement des anciennes images et sauvegarde client à recetter.                                      |
| BUG-003 | findutils ajouté à l’image et recette réalisée avec le vrai updater.                                | cb827c4 | CORRIGÉ ET VALIDÉ ; L’ancienne image requiert un premier redéploiement ; pas de correction rétroactive d’une image immuable. |
| BUG-004 | Maintien des descripteurs 8/9 sur la durée complète ; recettes de retour arrière.                   | f6a52bb | CORRIGÉ ET VALIDÉ ; Pannes matérielles réelles et reprise après perte du serveur non rejouées.                               |
| BUG-005 | Purge des données privées, session observée, reset du mural et propagation logout entre onglets.    | 0e45380 | CORRIGÉ ET VALIDÉ ; Conditions réseau du serveur client non vérifiées.                                                       |
| BUG-006 | Pilotage par rubrique, création SMSI retirée du parcours normal, G/H/K et début E.                  | 661309c | CORRIGÉ NON VALIDÉ ; Tests CI passés ; acceptation ergonomique humaine NON EXÉCUTÉE.                                         |

Les diagnostics conservent les échecs intermédiaires et leurs causes. La CI
finale verte ne réécrit pas leur histoire. Les deux tests navigateur synchronisés
dans fad0205 attendent la transaction d’import et le positionnement de capture ;
les assertions de sécurité/visuel n’ont pas été supprimées pour passer.

Sécurité dépendances : 69e6782, Drizzle 0.45.2 et Go 1.26.9 pour Caddy ; voir
diagnostic dependances-high. La preuve est le scan, pas seulement le titre du commit.
