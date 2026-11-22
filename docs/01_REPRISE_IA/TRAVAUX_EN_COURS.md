# Travaux en cours

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

À la clôture de cet audit, aucune modification applicative non commitée n’est
présente. « En cours » ne signifie pas qu’un développeur travaille actuellement :

| Sujet                           | État                                                                     | Point de reprise        |
| ------------------------------- | ------------------------------------------------------------------------ | ----------------------- |
| Recette du serveur client       | Commandes fournies ; résultat NON REÇU                                   | TEST-041 puis TEST-042. |
| Ergonomie Pilotage              | Correctif code et CI faits, validation humaine pendante                  | BUG-006, PV de recette. |
| B2 global                       | Sous-lots et socle livrés ; raccordements à terminer                     | DEV-001.                |
| E continuité                    | Générique BIA/plans/exercices livré ; ressources officielles à compléter | DEV-002.                |
| Migration intégrale du socle v2 | Source conservée ; plusieurs reprises seulement partielles               | MIG-001 et comparaison. |
| Optimisation du coût Actions    | Doublons supprimés ; coût global non mesuré                              | OPT-006 à OPT-008.      |

La PR #12 est en brouillon et non fusionnée. Aucun lot D/J/I/F n’est entrepris.
La documentation a été publiée sur la branche au commit 7cc35dc à la demande
explicite de l’utilisateur ; les workflows habituels se déclenchent automatiquement.
Le nettoyage ultérieur est tracé dans le diagnostic du 11 octobre.

## Module Vulnérabilités (mise à jour du 22/11/2026, Europe/Paris)

Session « Module surveillance vulnérabilités SMSI ». Voir la [reprise du 22/11/2026](REPRISE-2026-11-22.md).

| Sujet | État | Point de reprise |
| --- | --- | --- |
| « Quoi faire » avec les correctifs regroupés de Tenable (QF-TEN) | En cours, visé pour la 7.6.0 | Reprise du 22/11/2026, § 3. |
| CVE inconnue de la veille et alerte précoce (CVE-INC) | En cours, version suivante ; trois hôtes nouveaux | Reprise du 22/11/2026, § 3. |
| Veille réglementaire, tranche 2 (VR-2) | En cours, version suivante | ADR 0110, décision du 22/11/2026. |
| Délais de la veille active (dictionnaire CPE) | À mesurer par la session Coeur | ADR 0097, addendum. |
| Formats `.nessus`, Silène et `sumremediation` | Jamais vérifiés sur un export réel complet | Addenda de l'ADR 0100. |
