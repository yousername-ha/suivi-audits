# Régressions et changements de comportement

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Trois régressions sont identifiées dans les traces disponibles, **corrigées
et testées sur le code actuel**. Leur observation initiale est historique :
pas de reproduction d’un ancien serveur pendant cette mission.

| ID      | Fonction / bug    | Comportement attendu → écart historique                                              | État et preuves                                                                                            |
| ------- | ----------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| REG-001 | FCT-039 / BUG-001 | Clic Pilotage ouvre la page → seulement dépliage sans navigation                     | Signal utilisateur + diagnostic navigation-sauvegardes ; cc285b4 ; recette au clic desktop/mobile dans CI. |
| REG-002 | FCT-003 / BUG-005 | Erreur de déconnexion conservant la session → erreur ignorée/purge locale trop large | Diagnostic fiabilisation ; 0e45380 ; logout.test.ts et tests sécurité/API.                                 |
| REG-003 | FCT-007 / BUG-005 | Mural révoqué affiche le refus → requête observée supprimée/chargement bloqué        | Diagnostic fiabilisation : échec intermédiaire documenté ; correction cache et recette mural verte.        |

Niveau de preuve : problème initial DÉCLARÉ par traces/retours, cause OBSERVÉE
dans le code/diagnostic, non-régression actuelle CONFIRMÉE par les tests cités.
Ce registre n’est pas une comparaison exhaustive de tous les parcours v2.

## Différences distinctes d’une régression

- Menu GRC/SMSI remplacé volontairement par Pilotage multi-référentiels ;
  acceptation ergonomique non reçue (BUG-006).
- Activation d’un module distincte de ses permissions et de sa visibilité ;
  les données sont conservées même désactivées.
- Adaptateurs directs versus migration SQL : interface reprise ne signifie
  pas que tout app_state est supprimé.
- Notifications de tâches internes ; pas d’email tant que I reste exclu.
- Grilles et normes inaccessibles non embarquées ; début E générique assumé.
- Performances comparatives v2/v3 : NON VÉRIFIÉES, pas de chiffre inventé.

Pour une incompatibilité future : conserver exemple synthétique et empreintes,
ouvrir BUG/MIG stable, détailler perte/changement, test et décision humaine.
